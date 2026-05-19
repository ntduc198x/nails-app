import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyTelegramInternalRequest } from "@/lib/route-secrets";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_BOOKING_CHAT_ID;
const bookingAlertMediaUrl = process.env.BOOKING_TELEGRAM_ALERT_MEDIA_URL?.trim() || "";
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildBookingMessageText(payload: {
  bookingId: string;
  customerName: string;
  customerPhone: string;
  requestedService?: string | null;
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
  const whenText = formatViDateTime(payload.requestedStartAt);
  const safeCustomerName = escapeHtml(payload.customerName);
  const safePhone = escapeHtml(payload.customerPhone);
  const safeService = escapeHtml(payload.requestedService || "-");
  const safeNote = escapeHtml(payload.note || "-");

  const lines = payload.conflict
    ? [
        "<b>Có khách mới kìa các Sếp ơi.</b>",
        "",
        `👤 <b>Khách:</b> ${safeCustomerName}`,
        `📞 <b>SĐT:</b> ${safePhone}`,
        `💅 <b>Dịch vụ:</b> ${safeService}`,
        `🕐 <b>Giờ hẹn:</b> ${whenText}`,
        `📝 <b>Ghi chú:</b> ${safeNote}`,
        "",
        `⚠️ <b>Trùng lịch:</b> ${payload.conflict.overlapCount} lịch hiện có`,
        ...(payload.conflict.appointment ?? []).slice(0, 3).map((item) => `• ${escapeHtml(pickCustomerName(item.customers))} — ${formatViDateTime(item.start_at)}`),
      ]
    : [
        "<b>Có khách mới kìa các Sếp ơi.</b>",
        "",
        `👤 <b>Khách:</b> ${safeCustomerName}`,
        `📞 <b>SĐT:</b> ${safePhone}`,
        `💅 <b>Dịch vụ:</b> ${safeService}`,
        `🕐 <b>Giờ hẹn:</b> ${whenText}`,
        `📝 <b>Ghi chú:</b> ${safeNote}`,
        payload.nearbyWarning ? "" : null,
        payload.nearbyWarning
          ? `⚠️ <b>Cảnh báo sát lịch:</b> có ${payload.nearbyWarning.nearbyCount} khách trong khoảng ±${NEARBY_WARNING_MINUTES} phút`
          : null,
        ...(payload.nearbyWarning?.appointment ?? []).slice(0, 2).map((item) => `• ${escapeHtml(pickCustomerName(item.customers))} — ${formatViDateTime(item.start_at)}`),
      ];

  return lines.filter(Boolean).join("\n");
}

function buildBookingActionKeyboard(payload: { bookingId: string }) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Xác nhận", callback_data: `booking:confirm:${payload.bookingId}` },
        { text: "❌ Hủy", callback_data: `booking:cancel:${payload.bookingId}` },
      ],
      [{ text: "📅 Đổi lịch", callback_data: `booking:reschedule:${payload.bookingId}` }],
    ],
  };
}

async function sendTelegramBookingMessageV2(payload: {
  bookingId: string;
  customerName: string;
  customerPhone: string;
  requestedService?: string | null;
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

  const method = bookingAlertMediaUrl ? "sendAnimation" : "sendMessage";
  const body = bookingAlertMediaUrl
    ? {
        chat_id: telegramChatId,
        animation: bookingAlertMediaUrl,
        caption: buildBookingMessageText(payload),
        parse_mode: "HTML",
        reply_markup: buildBookingActionKeyboard({
          bookingId: payload.bookingId,
        }),
      }
    : {
        chat_id: telegramChatId,
        text: buildBookingMessageText(payload),
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: buildBookingActionKeyboard({
          bookingId: payload.bookingId,
        }),
      };

  const res = await fetch(`https://api.telegram.org/bot${telegramBotToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Telegram ${method} failed: ${await res.text()}`);
  }

  return {
    telegram: await res.json() as { ok: boolean; result?: { message_id: number; chat: { id: number | string } } },
    debug: { bookingId: payload.bookingId },
  };
}

export async function processTelegramBookingNotification(body: unknown) {
  try {
    const payload =
      typeof body === "object" && body !== null
        ? (body as {
            record?: unknown;
            new?: unknown;
            payload?: { record?: unknown } | null;
          })
        : null;

    const recordCandidate = payload?.record ?? payload?.new ?? payload?.payload?.record ?? body;
    const record =
      typeof recordCandidate === "object" && recordCandidate !== null
        ? (recordCandidate as { id?: string | number })
        : null;

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

      const sent = await sendTelegramBookingMessageV2({
        bookingId,
        customerName: bookingRow.customer_name,
        customerPhone: bookingRow.customer_phone,
        requestedService: bookingRow.requested_service,
        note: bookingRow.note,
        requestedStartAt: bookingRow.requested_start_at,
        conflict: bookingRow.status === "NEEDS_RESCHEDULE"
          ? {
              overlapCount: 0,
            }
          : null,
        nearbyWarning: null,
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

export async function POST(req: Request) {
  const verification = verifyTelegramInternalRequest(req);
  if (!verification.ok) {
    return NextResponse.json({ ok: false, error: verification.error }, { status: verification.status });
  }

  const body = await req.json();
  return processTelegramBookingNotification(body);
}
