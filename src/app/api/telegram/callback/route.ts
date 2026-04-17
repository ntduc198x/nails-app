import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBookingWindowCapacitySnapshot, rebalanceOpenBookingRequests } from "@/lib/booking-capacity";
import {
  getAdminSupabase,
  getTelegramUserRole,
  isManagerOrOwner,
  answerCallbackQuery as sharedAnswerCallback,
  deleteTelegramMessage,
  sendTelegramMessage,
  handleStartCommand,
  handleLinkCommand,
  handleLichCommand,
  handleDoanhthuCommand,
  handleCaCommand,
  handleBookingCommand,
} from "@/lib/telegram-bot";

const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://chambeauty.io.vn";
const NEARBY_WARNING_MINUTES = Number(process.env.BOOKING_NEARBY_WARNING_MINUTES ?? "30");

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60 * 1000).toISOString();
}

function formatViDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
  });
}

function pickCustomerName(customers: { name?: string } | { name?: string }[] | null | undefined) {
  if (Array.isArray(customers)) return customers[0]?.name ?? "Khách";
  return customers?.name ?? "Khách";
}

async function ensureCustomer(supabase: ReturnType<typeof getAdminSupabase>, booking: {
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

async function convertBookingToAppointment(supabase: ReturnType<typeof getAdminSupabase>, booking: {
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

  await rebalanceOpenBookingRequests({ client: supabase, orgId: booking.org_id });

  return appointment.id;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body?.message) {
      return await handleMessage(body.message);
    }

    const callback = body?.callback_query;
    if (!callback?.data) {
      return NextResponse.json({ ok: true, ignored: true, debug: { reason: "unsupported_update" } });
    }

    return await handleCallback(callback);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Telegram webhook failed" },
      { status: 500 },
    );
  }
}

async function handleMessage(message: { from?: { id: number; username?: string; first_name?: string }; chat?: { id: number | string }; text?: string }) {
  const chatId = message.chat?.id ? String(message.chat.id) : null;
  if (!chatId) return NextResponse.json({ ok: true, ignored: true });

  const text = (message.text ?? "").trim();
  const from = message.from;
  if (!from?.id) return NextResponse.json({ ok: true, ignored: true });

  const telegramUserId = from.id;
  const telegramUsername = from.username;
  const telegramFirstName = from.first_name;

  const parts = text.split(/\s+/);
  const command = parts[0]?.toLowerCase() ?? "";
  const args = parts.slice(1);

  if (command === "/start") {
    await handleStartCommand(telegramUserId, chatId);
    return NextResponse.json({ ok: true, command: "start" });
  }

  if (command === "/link") {
    const code = args[0]?.trim();
    if (!code) {
      await sendTelegramMessage(chatId, "❗ Cú pháp: <code>/link MÃ_6_SỐ</code>\n\nLấy mã trong Nails App → Hồ sơ & bảo mật → Liên kết Telegram");
      return NextResponse.json({ ok: true, command: "link", error: "missing_code" });
    }
    await handleLinkCommand(telegramUserId, telegramUsername, telegramFirstName, code, chatId);
    return NextResponse.json({ ok: true, command: "link" });
  }

  if (["/lich", "/doanhthu", "/ca", "/booking"].includes(command)) {
    const userInfo = await getTelegramUserRole(telegramUserId);

    if (!userInfo.linked) {
      await sendTelegramMessage(chatId, "❌ Bạn chưa liên kết tài khoản.\n\nDùng /start để bắt đầu.");
      return NextResponse.json({ ok: true, command, error: "not_linked" });
    }

    if (!isManagerOrOwner(userInfo.role)) {
      await sendTelegramMessage(chatId, "❌ Chỉ OWNER hoặc MANAGER mới được dùng lệnh này.");
      return NextResponse.json({ ok: true, command, error: "forbidden", role: userInfo.role });
    }

    const orgId = userInfo.org_id!;
    const supabase = getAdminSupabase();

    switch (command) {
      case "/lich":
        await handleLichCommand(orgId, chatId);
        break;
      case "/doanhthu":
        await handleDoanhthuCommand(orgId, chatId);
        break;
      case "/ca":
        await handleCaCommand(orgId, chatId);
        break;
      case "/booking":
        await handleBookingCommand(orgId, chatId);
        break;
    }

    return NextResponse.json({ ok: true, command });
  }

  return NextResponse.json({ ok: true, ignored: true, text: text.slice(0, 50) });
}

async function handleCallback(callback: { id: string; data?: string; message?: { chat?: { id?: number | string }; message_id?: number } }) {
  try {
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

    const supabase = getAdminSupabase();

    const { data: row, error: readErr } = await supabase
      .from("booking_requests")
      .select("id,org_id,branch_id,customer_name,customer_phone,requested_service,preferred_staff,note,requested_start_at,requested_end_at,status,telegram_message_id,telegram_chat_id,appointment_id")
      .eq("id", bookingId)
      .maybeSingle();

    if (readErr) throw readErr;
    if (!row?.id) {
      await sharedAnswerCallback(callback.id, "Không tìm thấy booking.");
      return NextResponse.json({ ok: true, missing: true, debug: { callbackData: callback.data, parsed: parts, bookingId } });
    }

    const chatId = row.telegram_chat_id ? String(row.telegram_chat_id) : callback.message?.chat?.id ? String(callback.message.chat.id) : null;
    const oldMessageId = row.telegram_message_id ? Number(row.telegram_message_id) : callback.message?.message_id ? Number(callback.message.message_id) : null;

    if (row.status === "CANCELLED") {
      await sharedAnswerCallback(callback.id, "Booking này đã bị hủy trước đó.");
      return NextResponse.json({ ok: true, skipped: true, reason: "already_cancelled", debug: { bookingId, status: row.status } });
    }

    if (row.status === "CONVERTED" && row.appointment_id) {
      await sharedAnswerCallback(callback.id, "Booking này đã được tạo appointment trước đó.");
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
      await rebalanceOpenBookingRequests({ client: supabase, orgId: row.org_id });

      if (chatId && oldMessageId) await deleteTelegramMessage(chatId, oldMessageId);
      if (chatId) {
        await sendTelegramMessage(chatId, [
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

      await sharedAnswerCallback(callback.id, "Đã hủy booking");
      return NextResponse.json({ ok: true, status: "CANCELLED", debug: { bookingId } });
    }

    const requestedEndAt = row.requested_end_at ?? addMinutes(row.requested_start_at, 60);
    await rebalanceOpenBookingRequests({ client: supabase, orgId: row.org_id });
    const snapshot = await getBookingWindowCapacitySnapshot({
      client: supabase,
      orgId: row.org_id,
      startAt: row.requested_start_at,
      endAt: requestedEndAt,
      excludeBookingRequestId: bookingId,
    });
    const appointmentOverlaps = snapshot.overlaps;
    const MAX_SIMULTANEOUS_BOOKINGS = snapshot.maxSimultaneous;
    const overlapCount = snapshot.overlapCount;

    const { data: refreshedBooking, error: refreshedBookingError } = await supabase
      .from("booking_requests")
      .select("status")
      .eq("id", bookingId)
      .maybeSingle();

    if (refreshedBookingError) throw refreshedBookingError;

    if (refreshedBooking?.status === "NEEDS_RESCHEDULE" || !snapshot.allowed) {
      const updateRes = await supabase
        .from("booking_requests")
        .update({ status: "NEEDS_RESCHEDULE" })
        .eq("id", bookingId)
        .select("id,status")
        .maybeSingle();

      if (updateRes.error) throw updateRes.error;

      if (chatId && oldMessageId) await deleteTelegramMessage(chatId, oldMessageId);
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

        await sendTelegramMessage(chatId, lines.join("\n"));
      }

      await sharedAnswerCallback(callback.id, `Booking vượt giới hạn ${MAX_SIMULTANEOUS_BOOKINGS} khách cùng giờ, cần dời lịch`);
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

    if (chatId && oldMessageId) await deleteTelegramMessage(chatId, oldMessageId);
    if (chatId) {
      await sendTelegramMessage(chatId, [
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

    await sharedAnswerCallback(callback.id, "Đã xác nhận và tạo appointment");

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
