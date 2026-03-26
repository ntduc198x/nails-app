import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://chambeauty.io.vn";

function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Thiếu cấu hình Supabase env.");
  return createClient(supabaseUrl, supabaseAnonKey);
}

async function answerCallbackQuery(callbackQueryId: string, text: string) {
  if (!telegramBotToken) return;
  await fetch(`https://api.telegram.org/bot${telegramBotToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

async function editMessage(chatId: string, messageId: number, text: string, done = false) {
  if (!telegramBotToken) return;
  await fetch(`https://api.telegram.org/bot${telegramBotToken}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: done ? { inline_keyboard: [] } : undefined,
    }),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const callback = body?.callback_query;
    if (!callback?.data) {
      return NextResponse.json({ ok: true, ignored: true, debug: { reason: "missing_callback_data" } });
    }

    const parts = String(callback.data).split(":");
    const [prefix, action, ...rest] = parts;
    const bookingId = rest.join(":");

    if (prefix !== "booking" || !action || !bookingId) {
      return NextResponse.json({ ok: true, ignored: true, debug: { callbackData: callback.data, parsed: parts } });
    }

    const nextStatus = action === "confirm" ? "CONFIRMED" : action === "cancel" ? "CANCELLED" : null;
    if (!nextStatus) {
      return NextResponse.json({ ok: true, ignored: true, debug: { callbackData: callback.data, parsed: parts } });
    }

    const supabase = getSupabase();

    const { data: row, error: readErr } = await supabase
      .from("booking_requests")
      .select("id,customer_name,customer_phone,requested_service,preferred_staff,note,requested_start_at,status,telegram_message_id,telegram_chat_id")
      .eq("id", bookingId)
      .maybeSingle();

    if (readErr) throw readErr;
    if (!row?.id) {
      await answerCallbackQuery(callback.id, "Không tìm thấy booking.");
      return NextResponse.json({ ok: true, missing: true, debug: { callbackData: callback.data, parsed: parts, bookingId } });
    }

    const updateRes = await supabase
      .from("booking_requests")
      .update({ status: nextStatus })
      .eq("id", bookingId)
      .select("id,status,telegram_message_id,telegram_chat_id")
      .maybeSingle();

    if (updateRes.error) throw updateRes.error;

    const whenText = new Date(row.requested_start_at).toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour12: false,
    });

    const text = [
      `<b>${nextStatus === "CONFIRMED" ? "✅ Đã xác nhận booking" : "❌ Đã huỷ booking"}</b>`,
      `• Booking ID: <code>${row.id}</code>`,
      `• Khách: <b>${row.customer_name}</b>`,
      `• SĐT: <b>${row.customer_phone}</b>`,
      `• Dịch vụ: ${row.requested_service || "-"}`,
      `• Thợ mong muốn: ${row.preferred_staff || "-"}`,
      `• Giờ yêu cầu: ${whenText}`,
      row.note ? `• Ghi chú: ${row.note}` : null,
      `• Trạng thái: <b>${nextStatus}</b>`,
      `• Quản trị: ${publicBaseUrl}/manage/booking-requests`,
    ].filter(Boolean).join("\n");

    if (row.telegram_chat_id && row.telegram_message_id) {
      await editMessage(String(row.telegram_chat_id), Number(row.telegram_message_id), text, true);
    }

    await answerCallbackQuery(callback.id, nextStatus === "CONFIRMED" ? "Đã xác nhận booking" : "Đã huỷ booking");

    return NextResponse.json({
      ok: true,
      status: nextStatus,
      debug: {
        callbackData: callback.data,
        parsed: parts,
        bookingId,
        foundRow: row.id,
        updatedRow: updateRes.data ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Telegram callback failed" },
      { status: 500 },
    );
  }
}
