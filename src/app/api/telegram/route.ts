import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_BOOKING_CHAT_ID;
const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://chambeauty.io.vn";

function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Thiếu cấu hình Supabase env.");
  return createClient(supabaseUrl, supabaseAnonKey);
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
    "<b>📥 Booking mới từ landing page</b>",
    `• Booking ID: <code>${payload.bookingId}</code>`,
    `• Khách: <b>${payload.customerName}</b>`,
    `• SĐT: <b>${payload.customerPhone}</b>`,
    `• Dịch vụ: ${payload.requestedService || "-"}`,
    `• Thợ mong muốn: ${payload.preferredStaff || "-"}`,
    `• Giờ yêu cầu: ${whenText}`,
    payload.note ? `• Ghi chú: ${payload.note}` : null,
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
    const sent = await sendTelegramBookingMessage({
      bookingId: String(record.id),
      customerName: record.customer_name,
      customerPhone: record.customer_phone,
      requestedService: record.requested_service,
      preferredStaff: record.preferred_staff,
      note: record.note,
      requestedStartAt: record.requested_start_at,
    });

    const messageId = sent.telegram.result?.message_id ?? null;
    const chatId = sent.telegram.result?.chat?.id != null ? String(sent.telegram.result.chat.id) : telegramChatId ?? null;

    const updateRes = await supabase
      .from("booking_requests")
      .update({
        telegram_message_id: messageId,
        telegram_chat_id: chatId,
        notified_at: new Date().toISOString(),
      })
      .eq("id", String(record.id))
      .select("id,telegram_message_id,telegram_chat_id,notified_at")
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      messageId,
      chatId,
      debug: {
        bookingId: String(record.id),
        callbackData: sent.debug,
        updateError: updateRes.error ? {
          message: updateRes.error.message,
          details: (updateRes.error as { details?: string }).details,
          hint: (updateRes.error as { hint?: string }).hint,
        } : null,
        updatedRow: updateRes.data ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Telegram API route failed" },
      { status: 500 },
    );
  }
}
