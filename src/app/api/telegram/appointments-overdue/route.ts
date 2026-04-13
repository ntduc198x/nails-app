import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_BOOKING_CHAT_ID;
const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://chambeauty.io.vn";
const APPOINTMENT_OVERDUE_MINUTES = Number(process.env.APPOINTMENT_OVERDUE_MINUTES ?? "15");

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function pickCustomerName(customers: { name?: string } | { name?: string }[] | null | undefined) {
  if (Array.isArray(customers)) return customers[0]?.name ?? "Khách";
  return customers?.name ?? "Khách";
}

function formatViDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
  });
}

async function sendTelegramMessage(text: string) {
  if (!telegramBotToken || !telegramChatId) throw new Error("Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_BOOKING_CHAT_ID");

  const res = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: telegramChatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) throw new Error(`Telegram sendMessage failed: ${await res.text()}`);
  return res.json() as Promise<{ ok: boolean }>;
}

export async function POST() {
  try {
    const supabase = getSupabase();
    const now = new Date();
    const cutoffIso = new Date(now.getTime() - APPOINTMENT_OVERDUE_MINUTES * 60 * 1000).toISOString();

    const { data: rows, error } = await supabase
      .from("appointments")
      .select("id,start_at,status,staff_user_id,resource_id,overdue_alert_sent_at,customers(name)")
      .eq("status", "BOOKED")
      .is("overdue_alert_sent_at", null)
      .lte("start_at", cutoffIso)
      .order("start_at", { ascending: true })
      .limit(20);

    if (error) throw error;

    const overdueRows = (rows ?? []) as Array<{
      id: string;
      start_at: string;
      status: string;
      staff_user_id?: string | null;
      resource_id?: string | null;
      overdue_alert_sent_at?: string | null;
      customers?: { name?: string } | { name?: string }[] | null;
    }>;

    if (!overdueRows.length) {
      return NextResponse.json({ ok: true, sent: 0, skipped: true });
    }

    let sent = 0;
    for (const row of overdueRows) {
      const { data: existingBooking, error: existingError } = await supabase
        .from("booking_requests")
        .select("id")
        .eq("appointment_id", row.id)
        .not("telegram_message_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existingBooking?.id) continue;

      await sendTelegramMessage(
        [
          "<b>⚠️ KHÁCH QUÁ GIỜ CHƯA CHECK-IN</b>",
          `• Khách: <b>${pickCustomerName(row.customers)}</b>`,
          `• Appointment ID: <code>${row.id}</code>`,
          `• Giờ hẹn: ${formatViDateTime(row.start_at)}`,
          `• Trạng thái: <b>${row.status}</b>`,
          `• Cảnh báo: đã quá <b>${APPOINTMENT_OVERDUE_MINUTES} phút</b> nhưng chưa check-in.`,
          `• Mở quản trị: ${publicBaseUrl}/manage/appointments`,
        ].join("\n"),
      );

      const { error: markError } = await supabase
        .from("appointments")
        .update({ overdue_alert_sent_at: new Date().toISOString() })
        .eq("id", row.id)
        .is("overdue_alert_sent_at", null)
        .eq("status", "BOOKED");

      if (markError) throw markError;
      sent += 1;
    }

    return NextResponse.json({ ok: true, sent });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Telegram overdue appointments route failed" },
      { status: 500 },
    );
  }
}
