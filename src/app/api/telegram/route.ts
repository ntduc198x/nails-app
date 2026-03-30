import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_BOOKING_CHAT_ID;
const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://chambeauty.io.vn";
const MAX_SIMULTANEOUS_BOOKINGS = Number(process.env.BOOKING_MAX_SIMULTANEOUS ?? "2");
const NEARBY_WARNING_MINUTES = Number(process.env.BOOKING_NEARBY_WARNING_MINUTES ?? "30");

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60 * 1000).toISOString();
}

function formatViDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
  });
}

async function listAppointmentOverlaps(supabase: ReturnType<typeof getSupabase>, orgId: string, startAt: string, endAt: string) {
  const { data, error } = await supabase
    .from("appointments")
    .select("id,start_at,end_at,status,customers(name)")
    .eq("org_id", orgId)
    .lt("start_at", endAt)
    .gt("end_at", startAt)
    .in("status", ["BOOKED", "CHECKED_IN", "IN_SERVICE"])
    .order("start_at", { ascending: true })
    .limit(10);

  if (error) throw error;
  return (data ?? []) as Array<{ id: string; start_at: string; end_at: string; status: string; customers?: { name?: string } | { name?: string }[] | null }>;
}

async function listNearbyAppointments(supabase: ReturnType<typeof getSupabase>, orgId: string, startAt: string) {
  const from = addMinutes(startAt, -NEARBY_WARNING_MINUTES);
  const to = addMinutes(startAt, NEARBY_WARNING_MINUTES);

  const { data, error } = await supabase
    .from("appointments")
    .select("id,start_at,end_at,status,customers(name)")
    .eq("org_id", orgId)
    .gte("start_at", from)
    .lte("start_at", to)
    .in("status", ["BOOKED", "CHECKED_IN", "IN_SERVICE"])
    .order("start_at", { ascending: true })
    .limit(10);

  if (error) throw error;
  return (data ?? []) as Array<{ id: string; start_at: string; end_at: string; status: string; customers?: { name?: string } | { name?: string }[] | null }>;
}

function pickCustomerName(customers: { name?: string } | { name?: string }[] | null | undefined) {
  if (Array.isArray(customers)) return customers[0]?.name ?? "Khách";
  return customers?.name ?? "Khách";
}

async function sendTelegramBookingMessage(payload: {
  bookingId: string;
  customerName: string;
  customerPhone: string;
  requestedService?: string | null;
  preferredStaff?: string | null;
  note?: string | null;
  requestedStartAt: string;
  conflict?: {
    appointment?: Array<{ id: string; start_at: string; customers?: { name?: string } | { name?: string }[] | null }>;
    overlapCount: number;
  } | null;
  nearbyWarning?: {
    appointment?: Array<{ id: string; start_at: string; customers?: { name?: string } | { name?: string }[] | null }>;
    nearbyCount: number;
  } | null;
}) {
  if (!telegramBotToken || !telegramChatId) throw new Error("Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_BOOKING_CHAT_ID");

  const whenText = formatViDateTime(payload.requestedStartAt);

  const confirmData = `booking:confirm:${payload.bookingId}`;
  const cancelData = `booking:cancel:${payload.bookingId}`;

  const lines = payload.conflict
    ? [
        "<b>⚠️ BOOKING MỚI BỊ TRÙNG LỊCH</b>",
        `• Booking ID: <code>${payload.bookingId}</code>`,
        `• Khách: <b>${payload.customerName}</b>`,
        `• SĐT: <b>${payload.customerPhone}</b>`,
        `• Dịch vụ: ${payload.requestedService || "-"}`,
        `• Giờ yêu cầu: ${whenText}`,
        `• Rule hiện tại: chỉ check trùng với <b>appointments</b> (gồm booked thủ công và booked online đã converted). Đây là khách thứ <b>${payload.conflict.overlapCount + 1}</b> cùng khung giờ.`,
        ...(payload.conflict.appointment ?? []).slice(0, 3).map((item) => `• ${pickCustomerName(item.customers)} — ${formatViDateTime(item.start_at)}`),
        "• Trạng thái: <b>CẦN DỜI LỊCH</b>",
        `• Quản trị: ${publicBaseUrl}/manage/booking-requests`,
      ]
    : [
        "<b>📥 BOOKING MỚI CẦN XÁC NHẬN</b>",
        `• Booking ID: <code>${payload.bookingId}</code>`,
        `• Khách: <b>${payload.customerName}</b>`,
        `• SĐT: <b>${payload.customerPhone}</b>`,
        `• Dịch vụ: ${payload.requestedService || "-"}`,
        `• Giờ yêu cầu: ${whenText}`,
        payload.nearbyWarning
          ? `• Cảnh báo sát lịch: có <b>${payload.nearbyWarning.nearbyCount}</b> khách trong appointments nằm trong khoảng ±${NEARBY_WARNING_MINUTES} phút.`
          : null,
        ...(payload.nearbyWarning?.appointment ?? []).slice(0, 2).map((item) => `• ${pickCustomerName(item.customers)} — ${formatViDateTime(item.start_at)}`),
        "• Hành động: chờ xác nhận / hủy",
        `• Quản trị: ${publicBaseUrl}/manage/booking-requests`,
      ];

  const res = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: telegramChatId,
      text: lines.filter(Boolean).join("\n"),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: payload.conflict
        ? {
            inline_keyboard: [
              [
                { text: "📅 Dời lịch", url: `${publicBaseUrl}/manage/booking-requests` },
                { text: "❌ Hủy lịch", callback_data: cancelData },
              ],
            ],
          }
        : {
            inline_keyboard: [
              [
                { text: "✅ Confirm", callback_data: confirmData },
                { text: "❌ Hủy lịch", callback_data: cancelData },
              ],
            ],
          },
    }),
  });

  if (!res.ok) {
    throw new Error(`Telegram sendMessage failed: ${await res.text()}`);
  }

  return {
    telegram: await res.json() as { ok: boolean; result?: { message_id: number; chat: { id: number | string } } },
    debug: { confirmData, cancelData },
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const record = body?.record ?? body?.new ?? body?.payload?.record ?? body;

    if (!record?.id) {
      return NextResponse.json({ ok: false, error: "Missing booking record", debug: { bodyKeys: Object.keys(body ?? {}) } }, { status: 400 });
    }

    const supabase = getSupabase();
    const bookingId = String(record.id);
    const claimedAt = new Date().toISOString();

    const claimRes = await supabase
      .from("booking_requests")
      .update({ notified_at: claimedAt })
      .eq("id", bookingId)
      .in("status", ["NEW", "NEEDS_RESCHEDULE"])
      .is("telegram_message_id", null)
      .is("notified_at", null)
      .select("id")
      .maybeSingle();

    if (claimRes.error) throw claimRes.error;

    if (!claimRes.data) {
      const { data: existingRow, error: existingError } = await supabase
        .from("booking_requests")
        .select("id,status,telegram_message_id,telegram_chat_id,notified_at")
        .eq("id", bookingId)
        .maybeSingle();

      if (existingError) throw existingError;

      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "already_claimed_or_not_open",
        debug: { existingRow },
      });
    }

    try {
      const { data: bookingRow, error: bookingError } = await supabase
        .from("booking_requests")
        .select("id,org_id,customer_name,customer_phone,requested_service,preferred_staff,note,requested_start_at,requested_end_at,status")
        .eq("id", bookingId)
        .maybeSingle();

      if (bookingError) throw bookingError;
      if (!bookingRow?.id) throw new Error("Không đọc được booking request sau khi claim.");

      const requestedEndAt = bookingRow.requested_end_at ?? addMinutes(bookingRow.requested_start_at, 60);
      const appointmentOverlaps = await listAppointmentOverlaps(supabase, bookingRow.org_id, bookingRow.requested_start_at, requestedEndAt);
      const overlapCount = appointmentOverlaps.length;
      const hasConflict = overlapCount >= MAX_SIMULTANEOUS_BOOKINGS;

      const nearbyAppointments = await listNearbyAppointments(supabase, bookingRow.org_id, bookingRow.requested_start_at);
      const nearbyCount = nearbyAppointments.length;
      const hasNearbyWarning = !hasConflict && nearbyCount >= MAX_SIMULTANEOUS_BOOKINGS;

      if (hasConflict && bookingRow.status !== "NEEDS_RESCHEDULE") {
        const { error: markConflictError } = await supabase
          .from("booking_requests")
          .update({ status: "NEEDS_RESCHEDULE" })
          .eq("id", bookingId)
          .eq("notified_at", claimedAt);

        if (markConflictError) throw markConflictError;
      }

      const sent = await sendTelegramBookingMessage({
        bookingId,
        customerName: bookingRow.customer_name,
        customerPhone: bookingRow.customer_phone,
        requestedService: bookingRow.requested_service,
        preferredStaff: bookingRow.preferred_staff,
        note: bookingRow.note,
        requestedStartAt: bookingRow.requested_start_at,
        conflict: hasConflict
          ? {
              appointment: appointmentOverlaps.map((item) => ({ id: item.id, start_at: item.start_at, customers: item.customers })),
              overlapCount,
            }
          : null,
        nearbyWarning: hasNearbyWarning
          ? {
              appointment: nearbyAppointments.map((item) => ({ id: item.id, start_at: item.start_at, customers: item.customers })),
              nearbyCount,
            }
          : null,
      });

      const messageId = sent.telegram.result?.message_id ?? null;
      const chatId = sent.telegram.result?.chat?.id != null ? String(sent.telegram.result.chat.id) : telegramChatId ?? null;

      const updateRes = await supabase
        .from("booking_requests")
        .update({
          telegram_message_id: messageId,
          telegram_chat_id: chatId,
          notified_at: claimedAt,
        })
        .eq("id", bookingId)
        .eq("notified_at", claimedAt)
        .select("id,telegram_message_id,telegram_chat_id,notified_at,status")
        .maybeSingle();

      return NextResponse.json({
        ok: true,
        messageId,
        chatId,
        debug: {
          bookingId,
          conflict: hasConflict,
          overlapCount,
          nearbyWarning: hasNearbyWarning,
          nearbyCount,
          callbackData: sent.debug,
          bookingRow,
          appointmentOverlaps,
          nearbyAppointments,
          updatedRow: updateRes.data ?? null,
          updateError: updateRes.error ? {
            message: updateRes.error.message,
            details: (updateRes.error as { details?: string }).details,
            hint: (updateRes.error as { hint?: string }).hint,
          } : null,
        },
      });
    } catch (sendError) {
      await supabase
        .from("booking_requests")
        .update({ notified_at: null })
        .eq("id", bookingId)
        .eq("notified_at", claimedAt);

      throw sendError;
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Telegram API route failed" },
      { status: 500 },
    );
  }
}
