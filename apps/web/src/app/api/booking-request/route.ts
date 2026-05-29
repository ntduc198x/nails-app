import { after, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publicBookingInputSchema } from "@nails/shared";
import { processTelegramBookingNotification } from "@/lib/telegram-booking-notification";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Thiếu cấu hình Supabase env.");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
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
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("create_booking_request_public", {
      p_branch_id: payload.branchId ?? null,
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
    const createdBookingStatus = typeof data === "object" && data && typeof (data as { status?: string }).status === "string"
      ? (data as { status: string }).status
      : "NEW";

    if (createdBookingId) {
      after(() => {
        void processTelegramBookingNotification({
          record: { id: createdBookingId },
        }).catch((error) => {
          console.error("booking-request telegram notify failed", error);
        });
      });

      return NextResponse.json({
        ok: true,
        message: "Đã gửi yêu cầu thành công",
        data: {
          booking_request_id: createdBookingId,
          id: createdBookingId,
          status: createdBookingStatus,
        },
        bookingRequest: {
          id: createdBookingId,
          status: createdBookingStatus,
        },
      });
    }

    return NextResponse.json({ ok: true, data });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Không xử lý được yêu cầu đặt lịch lúc này." },
      { status: 500 },
    );
  }
}
