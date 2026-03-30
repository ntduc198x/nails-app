import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
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

async function answerCallbackQuery(callbackQueryId: string, text: string) {
  if (!telegramBotToken) return;
  await fetch(`https://api.telegram.org/bot${telegramBotToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

async function deleteMessage(chatId: string, messageId: number) {
  if (!telegramBotToken) return;
  await fetch(`https://api.telegram.org/bot${telegramBotToken}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
  });
}

async function sendStatusMessage(chatId: string, text: string) {
  if (!telegramBotToken) return;
  await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
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

function pickCustomerName(customers: { name?: string } | { name?: string }[] | null | undefined) {
  if (Array.isArray(customers)) return customers[0]?.name ?? "Khách";
  return customers?.name ?? "Khách";
}

async function ensureCustomer(supabase: ReturnType<typeof getSupabase>, booking: {
  org_id: string;
  customer_name: string;
  customer_phone: string;
  requested_service?: string | null;
  preferred_staff?: string | null;
  note?: string | null;
}) {
  const { data: existingCustomer, error: customerError } = await supabase
    .from("customers")
    .select("id,notes")
    .eq("org_id", booking.org_id)
    .eq("name", booking.customer_name)
    .eq("phone", booking.customer_phone)
    .limit(1)
    .maybeSingle();

  if (customerError) throw customerError;

  const mergedNotes = [
    existingCustomer?.notes,
    booking.requested_service ? `DV: ${booking.requested_service}` : null,
    booking.preferred_staff ? `Thợ mong muốn: ${booking.preferred_staff}` : null,
    booking.note || null,
  ].filter(Boolean).join(" | ");

  if (existingCustomer?.id) {
    const { error: updateCustomerError } = await supabase
      .from("customers")
      .update({ notes: mergedNotes || null })
      .eq("id", existingCustomer.id);

    if (updateCustomerError) throw updateCustomerError;
    return existingCustomer.id;
  }

  const { data: newCustomer, error: newCustomerError } = await supabase
    .from("customers")
    .insert({
      org_id: booking.org_id,
      name: booking.customer_name,
      phone: booking.customer_phone,
      notes: mergedNotes || null,
    })
    .select("id")
    .single();

  if (newCustomerError) throw newCustomerError;
  return newCustomer.id;
}

async function convertBookingToAppointment(supabase: ReturnType<typeof getSupabase>, booking: {
  id: string;
  org_id: string;
  branch_id?: string | null;
  customer_name: string;
  customer_phone: string;
  requested_service?: string | null;
  preferred_staff?: string | null;
  note?: string | null;
  requested_start_at: string;
  requested_end_at: string;
}) {
  const customerId = await ensureCustomer(supabase, booking);

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("default_branch_id")
    .eq("org_id", booking.org_id)
    .not("default_branch_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (profileError) throw profileError;

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .insert({
      org_id: booking.org_id,
      branch_id: booking.branch_id ?? profileRow?.default_branch_id ?? null,
      customer_id: customerId,
      staff_user_id: null,
      resource_id: null,
      start_at: booking.requested_start_at,
      end_at: booking.requested_end_at,
      status: "BOOKED",
    })
    .select("id")
    .single();

  if (appointmentError) throw appointmentError;

  const { error: updateBookingError } = await supabase
    .from("booking_requests")
    .update({
      status: "CONVERTED",
      appointment_id: appointment.id,
    })
    .eq("id", booking.id);

  if (updateBookingError) throw updateBookingError;

  return appointment.id;
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
      .select("id,org_id,branch_id,customer_name,customer_phone,requested_service,preferred_staff,note,requested_start_at,requested_end_at,status,telegram_message_id,telegram_chat_id,appointment_id")
      .eq("id", bookingId)
      .maybeSingle();

    if (readErr) throw readErr;
    if (!row?.id) {
      await answerCallbackQuery(callback.id, "Không tìm thấy booking.");
      return NextResponse.json({ ok: true, missing: true, debug: { callbackData: callback.data, parsed: parts, bookingId } });
    }

    const chatId = row.telegram_chat_id ? String(row.telegram_chat_id) : callback.message?.chat?.id ? String(callback.message.chat.id) : null;
    const oldMessageId = row.telegram_message_id ? Number(row.telegram_message_id) : callback.message?.message_id ? Number(callback.message.message_id) : null;

    if (row.status === "CANCELLED") {
      await answerCallbackQuery(callback.id, "Booking này đã bị hủy trước đó.");
      return NextResponse.json({ ok: true, skipped: true, reason: "already_cancelled", debug: { bookingId, status: row.status } });
    }

    if (row.status === "CONVERTED" && row.appointment_id) {
      await answerCallbackQuery(callback.id, "Booking này đã được tạo appointment trước đó.");
      return NextResponse.json({ ok: true, skipped: true, reason: "already_converted", debug: { bookingId, status: row.status, appointmentId: row.appointment_id } });
    }

    const whenText = formatViDateTime(row.requested_start_at);

    if (nextStatus === "CANCELLED") {
      const updateRes = await supabase
        .from("booking_requests")
        .update({ status: "CANCELLED" })
        .eq("id", bookingId)
        .select("id,status")
        .maybeSingle();

      if (updateRes.error) throw updateRes.error;

      if (chatId && oldMessageId) await deleteMessage(chatId, oldMessageId);
      if (chatId) {
        await sendStatusMessage(chatId, [
          "<b>🛑 BOOKING ĐÃ BỊ HỦY</b>",
          `• Booking ID: <code>${row.id}</code>`,
          `• Khách: <b>${row.customer_name}</b>`,
          `• SĐT: <b>${row.customer_phone}</b>`,
          `• Dịch vụ: ${row.requested_service || "-"}`,
          `• Giờ yêu cầu: ${whenText}`,
          "• Kết quả: <b>Đã hủy từ Telegram</b>",
          `• Quản trị: ${publicBaseUrl}/manage/booking-requests`,
        ].join("\n"));
      }

      await answerCallbackQuery(callback.id, "Đã hủy booking");
      return NextResponse.json({ ok: true, status: "CANCELLED", debug: { bookingId } });
    }

    const requestedEndAt = row.requested_end_at ?? addMinutes(row.requested_start_at, 60);
    const appointmentOverlaps = await listAppointmentOverlaps(supabase, row.org_id, row.requested_start_at, requestedEndAt);
    const overlapCount = appointmentOverlaps.length;

    if (overlapCount >= MAX_SIMULTANEOUS_BOOKINGS) {
      const updateRes = await supabase
        .from("booking_requests")
        .update({ status: "NEEDS_RESCHEDULE" })
        .eq("id", bookingId)
        .select("id,status")
        .maybeSingle();

      if (updateRes.error) throw updateRes.error;

      if (chatId && oldMessageId) await deleteMessage(chatId, oldMessageId);
      if (chatId) {
        const lines = [
          "<b>⚠️ BOOKING VƯỢT GIỚI HẠN KHUNG GIỜ</b>",
          `• Booking ID: <code>${row.id}</code>`,
          `• Khách mới: <b>${row.customer_name}</b>`,
          `• Giờ yêu cầu: ${whenText}`,
          `• Rule hiện tại: chỉ check trùng với <b>appointments</b> (gồm booked thủ công và booked online đã converted). Đây là khách thứ <b>${overlapCount + 1}</b>.`,
          ...(appointmentOverlaps.slice(0, 3).map((item) => `• ${pickCustomerName(item.customers)} — ${formatViDateTime(item.start_at)}`)),
          "• Kết quả: <b>Booking đã chuyển sang trạng thái CẦN DỜI LỊCH, CHƯA convert sang appointment</b>",
          `• Cảnh báo sát lịch (±${NEARBY_WARNING_MINUTES} phút) chỉ dùng để nhắc, không tự coi là trùng.`,
          `• Quản trị: ${publicBaseUrl}/manage/booking-requests`,
        ];

        await sendStatusMessage(chatId, lines.join("\n"));
      }

      await answerCallbackQuery(callback.id, `Booking vượt giới hạn ${MAX_SIMULTANEOUS_BOOKINGS} khách cùng giờ, cần dời lịch`);
      return NextResponse.json({ ok: true, status: "LIMIT_EXCEEDED", debug: { bookingId, overlapCount, appointmentOverlaps } });
    }

    const appointmentId = await convertBookingToAppointment(supabase, {
      id: row.id,
      org_id: row.org_id,
      branch_id: row.branch_id,
      customer_name: row.customer_name,
      customer_phone: row.customer_phone,
      requested_service: row.requested_service,
      preferred_staff: row.preferred_staff,
      note: row.note,
      requested_start_at: row.requested_start_at,
      requested_end_at: requestedEndAt,
    });

    if (chatId && oldMessageId) await deleteMessage(chatId, oldMessageId);
    if (chatId) {
      await sendStatusMessage(chatId, [
        "<b>✅ BOOKING ĐÃ XÁC NHẬN THÀNH CÔNG</b>",
        `• Booking ID: <code>${row.id}</code>`,
        `• Khách: <b>${row.customer_name}</b>`,
        `• Giờ hẹn đã chốt: ${whenText}`,
        `• Appointment ID: <code>${appointmentId}</code>`,
        "• Trạng thái mới: <b>BOOKED ONLINE</b>",
        `• Rule hiện tại: tối đa <b>${MAX_SIMULTANEOUS_BOOKINGS}</b> khách cùng đúng khung giờ; cảnh báo sát lịch trong ±${NEARBY_WARNING_MINUTES} phút.`,
        "• Kết quả: <b>Đã confirm và tạo appointment</b>",
        `• Quản trị: ${publicBaseUrl}/manage/appointments`,
      ].join("\n"));
    }

    await answerCallbackQuery(callback.id, "Đã xác nhận và tạo appointment");

    return NextResponse.json({
      ok: true,
      status: "CONVERTED",
      debug: {
        bookingId,
        appointmentId,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Telegram callback failed" },
      { status: 500 },
    );
  }
}
