import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publicBookingInputSchema } from "@nails/shared";
import { rebalanceOpenBookingRequests } from "@/lib/booking-capacity";
import { assertPublicBookingRequestAllowed } from "@/lib/public-booking-guard";
import { createServiceRoleClient } from "@/lib/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Thiếu cấu hình Supabase env.");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

function getServiceSupabase() {
  try {
    return createServiceRoleClient();
  } catch {
    return null;
  }
}

function resolveInternalBaseUrl(req: Request) {
  const requestUrl = new URL(req.url);
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();

  if (forwardedHost) {
    return `${forwardedProto || requestUrl.protocol.replace(":", "")}://${forwardedHost}`;
  }

  return requestUrl.origin;
}

async function notifyTelegramBookingRequest(req: Request, bookingRequestId: string) {
  const internalSecret = process.env.TELEGRAM_INTERNAL_ROUTE_SECRET;
  if (!internalSecret) {
    return {
      ok: false,
      skipped: true,
      reason: "missing_internal_secret",
    };
  }

  const notifyUrl = new URL("/api/telegram", resolveInternalBaseUrl(req)).toString();

  try {
    const response = await fetch(notifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${internalSecret}`,
      },
      body: JSON.stringify({
        record: { id: bookingRequestId },
      }),
    });

    const payload = await response.json().catch(() => null);

    return {
      ok: response.ok && payload?.ok === true,
      status: response.status,
      payload,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function mapBookingRequestError(error: { message?: string } | null | undefined) {
  const code = (error?.message ?? "").trim().toUpperCase();

  switch (code) {
    case "CUSTOMER_NAME_REQUIRED":
      return { status: 400, error: "Vui lòng nhập tên khách hàng." };
    case "CUSTOMER_PHONE_REQUIRED":
      return { status: 400, error: "Vui lòng nhập số điện thoại." };
    case "REQUESTED_START_REQUIRED":
      return { status: 400, error: "Vui lòng chọn thời gian bắt đầu." };
    case "INVALID_TIME_RANGE":
      return { status: 400, error: "Khung thời gian không hợp lệ." };
    case "BOOKING_REQUEST_DUPLICATE_COOLDOWN":
      return { status: 409, error: "Yêu cầu đặt lịch trùng vừa được gửi. Vui lòng kiểm tra lại hoặc chờ ít phút rồi thử lại." };
    case "BOOKING_REQUEST_RATE_LIMITED":
      return { status: 429, error: "Bạn gửi yêu cầu quá nhanh. Vui lòng chờ ít phút rồi thử lại." };
    case "OFFER_NOT_AVAILABLE":
      return { status: 400, error: "Ưu đãi không còn khả dụng." };
    case "OFFER_REQUIRES_LINKED_CUSTOMER":
      return { status: 400, error: "Ưu đãi này yêu cầu tài khoản khách hàng hợp lệ." };
    case "OFFER_ALREADY_USED_OR_RESERVED":
      return { status: 409, error: "Ưu đãi này đã được dùng hoặc đang được giữ chỗ." };
    default:
      return { status: 400, error: "Không tạo được yêu cầu đặt lịch." };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = publicBookingInputSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { ok: false, error: firstIssue?.message || "Dữ liệu đặt lịch không hợp lệ." },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const serviceClient = getServiceSupabase();
    const guardResult = await assertPublicBookingRequestAllowed({
      req,
      client: serviceClient,
      customerPhone: payload.customerPhone,
      requestedStartAt: payload.requestedStartAt,
    });

    if (!guardResult.allowed) {
      return NextResponse.json({ ok: false, error: guardResult.error }, { status: guardResult.status });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("create_booking_request_public", {
      p_customer_name: payload.customerName,
      p_customer_phone: payload.customerPhone,
      p_requested_service: payload.requestedService ?? null,
      p_preferred_staff: payload.preferredStaff ?? null,
      p_note: payload.note ?? null,
      p_requested_start_at: payload.requestedStartAt,
      p_requested_end_at: payload.requestedEndAt ?? null,
      p_source: payload.source ?? "landing_page",
      p_applied_offer_id: payload.appliedOfferId ?? null,
      p_applied_offer_claim_id: payload.appliedOfferClaimId ?? null,
      p_applied_offer_code: payload.appliedOfferCode ?? null,
    });

    if (error) {
      const mapped = mapBookingRequestError(error);
      return NextResponse.json({ ok: false, error: mapped.error }, { status: mapped.status });
    }

    const createdBookingId = typeof data === "string"
      ? data
      : typeof data === "object" && data
        ? String((data as { booking_request_id?: string; id?: string }).booking_request_id ?? (data as { id?: string }).id ?? "")
        : "";

    if (createdBookingId) {
      const telegramNotification = await notifyTelegramBookingRequest(req, createdBookingId);

      if (serviceClient) {
        const { data: createdRow } = await serviceClient
          .from("booking_requests")
          .select("id,org_id,status")
          .eq("id", createdBookingId)
          .maybeSingle();

        if (createdRow?.org_id) {
          await rebalanceOpenBookingRequests({ client: serviceClient, orgId: createdRow.org_id });
          const { data: refreshedRow } = await serviceClient
            .from("booking_requests")
            .select("id,status")
            .eq("id", createdBookingId)
            .maybeSingle();

          return NextResponse.json({
            ok: true,
            data,
            bookingRequest: refreshedRow ?? createdRow,
            telegramNotification,
          });
        }
      }

      return NextResponse.json({ ok: true, data, telegramNotification });
    }

    return NextResponse.json({ ok: true, data });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Không xử lý được yêu cầu đặt lịch lúc này." },
      { status: 500 },
    );
  }
}
