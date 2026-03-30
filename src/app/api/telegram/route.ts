import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_BOOKING_CHAT_ID;
const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://chambeauty.io.vn";

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function sendTelegramBookingMessage(payload: {
  bookingId: string;
  customerName: string;
  customerPhone: string;
  requestedService?: string | null;
  preferredStaff?: string | null;
  note?: string | null;
  requestedStartAt: string;
}) {
  if (!telegramBotToken || !telegramChatId) throw new Error("Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_BOOKING_CHAT_ID");

  const whenText = new Date(payload.requestedStartAt).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
  });

  const confirmData = `booking:confirm:${payload.bookingId}`;
  const cancelData = `booking:cancel:${payload.bookingId}`;

  const text = [
    "<b>📥 BOOKING MỚI CẦN XÁC NHẬN</b>",
    `• Booking ID: <code>${payload.bookingId}</code>`,
    `• Khách: <b>${payload.customerName}</b>`,
    `• SĐT: <b>${payload.customerPhone}</b>`,
    `• Dịch vụ: ${payload.requestedService || "-"}`,
    `• Thợ mong muốn: ${payload.preferredStaff || "-"}`,
    `• Giờ yêu cầu: ${whenText}`,
    payload.note ? `• Ghi chú: ${payload.note}` : null,
    "• Hành động: chờ xác nhận / hủy",
    `• Quản trị: ${publicBaseUrl}/manage/booking-requests`,
  ].filter(Boolean).join("\n");

  const res = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: telegramChatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Confirm", callback_data: confirmData },
            { text: "❌ Cancel", callback_data: cancelData },
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
      .eq("status", "NEW")
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
        reason: "already_claimed_or_not_new",
        debug: { existingRow },
      });
    }

    try {
      const { data: bookingRow, error: bookingError } = await supabase
        .from("booking_requests")
        .select("id,customer_name,customer_phone,requested_service,preferred_staff,note,requested_start_at,status")
        .eq("id", bookingId)
        .maybeSingle();

      if (bookingError) throw bookingError;
      if (!bookingRow?.id) throw new Error("Không đọc được booking request sau khi claim.");

      const sent = await sendTelegramBookingMessage({
        bookingId,
        customerName: bookingRow.customer_name,
        customerPhone: bookingRow.customer_phone,
        requestedService: bookingRow.requested_service,
        preferredStaff: bookingRow.preferred_staff,
        note: bookingRow.note,
        requestedStartAt: bookingRow.requested_start_at,
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
        .select("id,telegram_message_id,telegram_chat_id,notified_at")
        .maybeSingle();

      return NextResponse.json({
        ok: true,
        messageId,
        chatId,
        debug: {
          bookingId,
          callbackData: sent.debug,
          bookingRow,
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
