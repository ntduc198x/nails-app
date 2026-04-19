import { NextResponse } from "next/server";
import { getBookingWindowCapacitySnapshot, rebalanceOpenBookingRequests } from "@/lib/booking-capacity";
import { verifyTelegramWebhookRequest } from "@/lib/route-secrets";
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
  handleManageCommand,
  handleCompactManageCommand,
  sendFreshAdminReplyKeyboard,
  clearReplyPanelState,
  editTelegramMessage,
  handleCrmMenu,
  handleMeCommand,
  handleOverviewCommand,
  handleRevenueReportCommand,
  handleCrmFollowUpCommand,
  handleCrmAtRiskCommand,
  handleCrmContactedCommand,
  beginCustomReportConversation,
  handleQuickCreateMenu,
  beginQuickCreateAppointmentConversation,
  confirmQuickCreateAppointment,
  handleQuickCreateDateSelection,
  handleQuickCreateServiceSelection,
  cancelTelegramConversation,
  handleQuickCheckinMenu,
  handleQuickCheckinAction,
  handleBookingDetailCommand,
  handleTelegramConversationMessage,
} from "@/lib/telegram-bot";

const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://chambeauty.io.vn";
const NEARBY_WARNING_MINUTES = Number(process.env.BOOKING_NEARBY_WARNING_MINUTES ?? "30");

function normalizeTelegramMenuText(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
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

function buildBookingResultMessage(payload: {
  title: string;
  customerName: string;
  customerPhone?: string | null;
  requestedService?: string | null;
  requestedStartAt: string;
  note?: string | null;
  resultLine: string;
  extraLines?: string[];
}) {
  const lines = [
    "🔔 ═══════════════════",
    payload.title,
    "─────────────────────",
    `👤 Khách: <b>${escapeHtml(payload.customerName)}</b>`,
    `📞 SĐT: <b>${escapeHtml(payload.customerPhone || "-")}</b>`,
    `💅 DV: ${escapeHtml(payload.requestedService || "-")}`,
    `🕐 Hẹn: ${formatViDateTime(payload.requestedStartAt)}`,
    `📝 Ghi chú: ${escapeHtml(payload.note || "-")}`,
    "─────────────────────",
    payload.resultLine,
    ...(payload.extraLines ?? []),
  ];

  return lines.join("\n");
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

async function handleMenuCallback(callback: { id: string; data?: string; from?: { id: number }; message?: { from?: { id: number } } }, action: string, chatId: string) {
  const telegramUserId = callback.from?.id ?? callback.message?.from?.id;
  if (!telegramUserId) {
    await sharedAnswerCallback(callback.id, "Không xác định được người dùng.");
    return NextResponse.json({ ok: false, error: "no_user_id" });
  }

  const userInfo = await getTelegramUserRole(telegramUserId);

  if (!userInfo.linked) {
    await sharedAnswerCallback(callback.id, "Bạn chưa liên kết tài khoản. Dùng /start để bắt đầu.");
    return NextResponse.json({ ok: true, reason: "not_linked" });
  }

  if (!isManagerOrOwner(userInfo.role)) {
    await sharedAnswerCallback(callback.id, "Chỉ OWNER hoặc MANAGER mới được sử dụng chức năng này.");
    return NextResponse.json({ ok: true, reason: "forbidden" });
  }

  const orgId = userInfo.org_id!;

  switch (action) {
    case "admin":
      await handleManageCommand(chatId);
      await sharedAnswerCallback(callback.id);
      break;
    case "overview":
      await handleOverviewCommand(orgId, chatId);
      await sharedAnswerCallback(callback.id, "Đã cập nhật tổng quan");
      break;
    case "crm":
      await handleCrmMenu(chatId);
      await sharedAnswerCallback(callback.id);
      break;
    case "quickcreate":
      await handleQuickCreateMenu(chatId);
      await sharedAnswerCallback(callback.id);
      break;
    case "lich":
      await handleLichCommand(orgId, chatId);
      await sharedAnswerCallback(callback.id, "Đã cập nhật lịch hôm nay");
      break;
    case "doanhthu":
      await handleDoanhthuCommand(orgId, chatId);
      await sharedAnswerCallback(callback.id, "Đã cập nhật doanh thu");
      break;
    case "ca":
      await handleCaCommand(orgId, chatId);
      await sharedAnswerCallback(callback.id);
      break;
    case "booking":
      await handleBookingCommand(orgId, chatId);
      await sharedAnswerCallback(callback.id);
      break;
    default:
      await sharedAnswerCallback(callback.id, "Chức năng không hỗ trợ.");
  }

  return NextResponse.json({ ok: true, action });
}

export async function processTelegramUpdate(body: unknown) {
  try {
    type TelegramUpdatePayload = {
      message?: Parameters<typeof handleMessage>[0];
      callback_query?: Parameters<typeof handleCallback>[0] | null;
    };

    const update = typeof body === "object" && body !== null ? (body as TelegramUpdatePayload) : null;

    if (update?.message) {
      return await handleMessage(update.message);
    }

    const callback = update?.callback_query;
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

export async function POST(req: Request) {
  const auth = verifyTelegramWebhookRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  return processTelegramUpdate(body);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/telegram/callback",
    mode: process.env.NODE_ENV,
    note: "GET chỉ để health-check. Telegram webhook thật sự dùng POST.",
    local_test: {
      message: {
        method: "POST",
        sample: {
          message: {
            from: { id: 123456789, username: "local_test", first_name: "Local" },
            chat: { id: 123456789 },
            text: "/start",
          },
        },
      },
      callback_query: {
        method: "POST",
        sample: {
          callback_query: {
            id: "local-callback-1",
            data: "menu:admin",
            message: {
              chat: { id: 123456789 },
              message_id: 1,
              from: { id: 123456789 },
            },
          },
        },
      },
    },
  });
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

  const consumedByConversation = await handleTelegramConversationMessage(telegramUserId, chatId, text);
  if (consumedByConversation) {
    return NextResponse.json({ ok: true, handled: "conversation" });
  }

  if (text) {
    const normalizedText = normalizeTelegramMenuText(text);
    const userInfo = await getTelegramUserRole(telegramUserId);

    if (userInfo.linked && isManagerOrOwner(userInfo.role) && userInfo.org_id) {
      switch (normalizedText) {
        case "🧭 mo menu quan tri":
        case "mo menu quan tri":
        case "menu quan tri":
        case "⚙️ menu quan tri":
          await sendFreshAdminReplyKeyboard(chatId);
          return NextResponse.json({ ok: true, handled: "reply_manage" });
        case "📊 tong quan":
        case "tong quan":
          await clearReplyPanelState(chatId);
          await handleOverviewCommand(userInfo.org_id, chatId);
          return NextResponse.json({ ok: true, handled: "reply_overview" });
        case "crm":
          await clearReplyPanelState(chatId);
          await handleCrmMenu(chatId);
          return NextResponse.json({ ok: true, handled: "reply_crm" });
        case "📌 booking":
        case "booking":
          await clearReplyPanelState(chatId);
          await handleBookingCommand(userInfo.org_id, chatId);
          return NextResponse.json({ ok: true, handled: "reply_booking" });
        case "🕐 ca lam":
        case "ca lam":
          await clearReplyPanelState(chatId);
          await handleCaCommand(userInfo.org_id, chatId);
          return NextResponse.json({ ok: true, handled: "reply_shift" });
        case "⚡ tao nhanh":
        case "tao nhanh":
          await clearReplyPanelState(chatId);
          await handleQuickCreateMenu(chatId);
          return NextResponse.json({ ok: true, handled: "reply_quickcreate" });
      }
    }
  }

  const parts = text.split(/\s+/);
  const rawCommand = parts[0]?.toLowerCase() ?? "";
  const command = rawCommand.startsWith("/") ? rawCommand.split("@")[0] : rawCommand;
  const args = parts.slice(1);

  if (command === "/start" || command === "/manage") {
    const userInfo = await getTelegramUserRole(telegramUserId);

    if (!userInfo.linked) {
      await handleStartCommand(telegramUserId, chatId);
      return NextResponse.json({ ok: true, command });
    }

    if (!isManagerOrOwner(userInfo.role)) {
      await sendTelegramMessage(chatId, "❌ Chỉ OWNER hoặc MANAGER mới được dùng lệnh này.");
      return NextResponse.json({ ok: true, command, error: "forbidden", role: userInfo.role });
    }

    await handleManageCommand(chatId, { forceNew: true });
    return NextResponse.json({ ok: true, command: "manage" });
  }

  if (command === "/link") {
    const code = args[0]?.trim();
    if (!code) {
      await sendTelegramMessage(chatId, "❌ Cú pháp: <code>/link MÃ_6_SỐ</code>\n\nLấy mã trong Nails App → Hồ sơ & bảo mật → Liên kết Telegram");
      return NextResponse.json({ ok: true, command: "link", error: "missing_code" });
    }
    await handleLinkCommand(telegramUserId, telegramUsername, telegramFirstName, code, chatId);
    return NextResponse.json({ ok: true, command: "link" });
  }

  if (["/me", "/crm", "/lich", "/doanhthu", "/ca", "/booking"].includes(command)) {
    const userInfo = await getTelegramUserRole(telegramUserId);

    if (!userInfo.linked) {
      await sendTelegramMessage(chatId, "❌ Bạn chưa liên kết tài khoản.\n\nDùng /start để bắt đầu.");
      return NextResponse.json({ ok: true, command, error: "not_linked" });
    }

    if (command !== "/me" && !isManagerOrOwner(userInfo.role)) {
      await sendTelegramMessage(chatId, "❌ Chỉ OWNER hoặc MANAGER mới được dùng lệnh này.");
      return NextResponse.json({ ok: true, command, error: "forbidden", role: userInfo.role });
    }

    const orgId = userInfo.org_id!;

    switch (command) {
      case "/crm":
        await handleCrmMenu(chatId);
        break;
      case "/me":
        await handleMeCommand(telegramUserId, chatId);
        break;
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

async function handleCallback(callback: { id: string; data?: string; from?: { id: number }; message?: { chat?: { id?: number | string }; message_id?: number; from?: { id: number } } }) {
  try {
    const chatId = callback.message?.chat?.id ? String(callback.message.chat.id) : null;
    const messageId = callback.message?.message_id;
    const telegramUserId = callback.from?.id ?? callback.message?.from?.id;

    const parts = String(callback.data).split(":");
    const [prefix, action, ...rest] = parts;
    const bookingId = rest.join(":");

    if (prefix === "menu") {
      if (!chatId || !action) return NextResponse.json({ ok: true, ignored: true });
      return await handleMenuCallback(callback, action, chatId);
    }

    if (prefix === "report") {
      if (!telegramUserId || !chatId || !action) {
        return NextResponse.json({ ok: true, ignored: true, debug: { callbackData: callback.data, parsed: parts } });
      }

      const userInfo = await getTelegramUserRole(telegramUserId);
      if (!userInfo.linked || !isManagerOrOwner(userInfo.role) || !userInfo.org_id) {
        await sharedAnswerCallback(callback.id, "Bạn không có quyền sử dụng chức năng này.");
        return NextResponse.json({ ok: true, reason: "forbidden_report" });
      }

      if (action === "custom") {
        await beginCustomReportConversation(telegramUserId, userInfo.org_id, chatId);
        await sharedAnswerCallback(callback.id, "Nhập khoảng ngày để xem báo cáo");
        return NextResponse.json({ ok: true, action: "report_custom" });
      }

      if (action === "today" || action === "week" || action === "month") {
        await handleRevenueReportCommand(userInfo.org_id, chatId, action);
        await sharedAnswerCallback(callback.id, "Đã cập nhật báo cáo");
        return NextResponse.json({ ok: true, action: `report_${action}` });
      }

      return NextResponse.json({ ok: true, ignored: true, debug: { callbackData: callback.data, parsed: parts } });
    }

    if (prefix === "crm") {
      if (!telegramUserId || !chatId || !action) {
        return NextResponse.json({ ok: true, ignored: true, debug: { callbackData: callback.data, parsed: parts } });
      }

      const userInfo = await getTelegramUserRole(telegramUserId);
      if (!userInfo.linked || !isManagerOrOwner(userInfo.role) || !userInfo.org_id) {
        await sharedAnswerCallback(callback.id, "Bạn không có quyền sử dụng chức năng này.");
        return NextResponse.json({ ok: true, reason: "forbidden_crm" });
      }

      if (action === "followups") {
        await handleCrmFollowUpCommand(userInfo.org_id, chatId);
        await sharedAnswerCallback(callback.id, "Đã mở danh sách follow-up");
        return NextResponse.json({ ok: true, action: "crm_followups" });
      }

      if (action === "at_risk") {
        await handleCrmAtRiskCommand(userInfo.org_id, chatId);
        await sharedAnswerCallback(callback.id, "Đã mở nhóm khách cần chăm sóc");
        return NextResponse.json({ ok: true, action: "crm_at_risk" });
      }

      if (action === "contacted") {
        const customerId = rest.join(":");
        const result = await handleCrmContactedCommand(userInfo.org_id, chatId, customerId);
        await sharedAnswerCallback(callback.id, result.message);
        return NextResponse.json({ ok: true, action: "crm_contacted", result });
      }

      return NextResponse.json({ ok: true, ignored: true, debug: { callbackData: callback.data, parsed: parts } });
    }

    if (prefix === "quickcreate") {
      if (!telegramUserId || !chatId || !action) {
        return NextResponse.json({ ok: true, ignored: true, debug: { callbackData: callback.data, parsed: parts } });
      }

      const userInfo = await getTelegramUserRole(telegramUserId);
      if (!userInfo.linked || !isManagerOrOwner(userInfo.role) || !userInfo.org_id) {
        await sharedAnswerCallback(callback.id, "Bạn không có quyền sử dụng chức năng này.");
        return NextResponse.json({ ok: true, reason: "forbidden_quickcreate" });
      }

      if (action === "new") {
        await beginQuickCreateAppointmentConversation(telegramUserId, userInfo.org_id, chatId);
        await sharedAnswerCallback(callback.id, "Nhập tên khách hàng");
        return NextResponse.json({ ok: true, action: "quickcreate_new" });
      }

      if (action === "checkin") {
        await handleQuickCheckinMenu(userInfo.org_id, chatId);
        await sharedAnswerCallback(callback.id, "Đã mở check-in nhanh");
        return NextResponse.json({ ok: true, action: "quickcreate_checkin" });
      }

      if (action === "confirm") {
        const result = await confirmQuickCreateAppointment(telegramUserId, chatId);
        await sharedAnswerCallback(callback.id, result.message);
        return NextResponse.json({ ok: true, action: "quickcreate_confirm", result });
      }

      if (action === "date") {
        const dateMode = rest.join(":");
        const result = await handleQuickCreateDateSelection(telegramUserId, chatId, dateMode);
        await sharedAnswerCallback(callback.id, result.message);
        return NextResponse.json({ ok: true, action: "quickcreate_date", result });
      }

      if (action === "service") {
        const serviceIdOrMode = rest.join(":");
        const result = await handleQuickCreateServiceSelection(telegramUserId, chatId, serviceIdOrMode);
        await sharedAnswerCallback(callback.id, result.message);
        return NextResponse.json({ ok: true, action: "quickcreate_service", result });
      }

      if (action === "cancel") {
        await cancelTelegramConversation(telegramUserId);
        await handleQuickCreateMenu(chatId);
        await sharedAnswerCallback(callback.id, "Đã hủy tạo lịch");
        return NextResponse.json({ ok: true, action: "quickcreate_cancel" });
      }

      return NextResponse.json({ ok: true, ignored: true, debug: { callbackData: callback.data, parsed: parts } });
    }

    if (prefix === "checkin") {
      if (!telegramUserId || !chatId || !action) {
        return NextResponse.json({ ok: true, ignored: true, debug: { callbackData: callback.data, parsed: parts } });
      }

      const userInfo = await getTelegramUserRole(telegramUserId);
      if (!userInfo.linked || !isManagerOrOwner(userInfo.role) || !userInfo.org_id) {
        await sharedAnswerCallback(callback.id, "Bạn không có quyền sử dụng chức năng này.");
        return NextResponse.json({ ok: true, reason: "forbidden_checkin" });
      }

      const result = await handleQuickCheckinAction(userInfo.org_id, chatId, action);
      await sharedAnswerCallback(callback.id, result.message);
      return NextResponse.json({ ok: true, action: "checkin", result });
    }

    if (prefix !== "booking" || !action || !bookingId) {
      return NextResponse.json({ ok: true, ignored: true, debug: { callbackData: callback.data, parsed: parts } });
    }

    if (action === "view") {
      if (!telegramUserId || !chatId) {
        return NextResponse.json({ ok: true, ignored: true, debug: { callbackData: callback.data, parsed: parts } });
      }

      const userInfo = await getTelegramUserRole(telegramUserId);
      if (!userInfo.linked || !isManagerOrOwner(userInfo.role) || !userInfo.org_id) {
        await sharedAnswerCallback(callback.id, "Bạn không có quyền sử dụng chức năng này.");
        return NextResponse.json({ ok: true, reason: "forbidden_booking_view" });
      }

      await handleBookingDetailCommand(userInfo.org_id, chatId, bookingId);
      await sharedAnswerCallback(callback.id, "Đã mở chi tiết booking");
      return NextResponse.json({ ok: true, action: "booking_view", bookingId });
    }

    const nextStatus =
      action === "confirm" ? "CONFIRMED"
      : action === "cancel" ? "CANCELLED"
      : action === "reschedule" ? "NEEDS_RESCHEDULE"
      : null;
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

    const oldMessageId = row.telegram_message_id ? Number(row.telegram_message_id) : messageId ? Number(messageId) : null;

    if (row.status === "CANCELLED") {
      await sharedAnswerCallback(callback.id, "Booking này đã bị hủy trước đó.");
      return NextResponse.json({ ok: true, skipped: true, reason: "already_cancelled", debug: { bookingId, status: row.status } });
    }

    if (row.status === "NEEDS_RESCHEDULE" && nextStatus === "NEEDS_RESCHEDULE") {
      await sharedAnswerCallback(callback.id, "Booking này đã ở trạng thái cần đổi lịch.");
      return NextResponse.json({ ok: true, skipped: true, reason: "already_reschedule", debug: { bookingId, status: row.status } });
    }

    if (row.status === "CONVERTED" && row.appointment_id) {
      await sharedAnswerCallback(callback.id, "Booking này đã được tạo appointment trước đó.");
      return NextResponse.json({ ok: true, skipped: true, reason: "already_converted", debug: { bookingId, status: row.status, appointmentId: row.appointment_id } });
    }

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
        await sendTelegramMessage(chatId, buildBookingResultMessage({
          title: "<b>❌ BOOKING ĐÃ HỦY</b>",
          customerName: row.customer_name,
          customerPhone: row.customer_phone,
          requestedService: row.requested_service,
          requestedStartAt: row.requested_start_at,
          note: row.note,
          resultLine: "❌ Kết quả: <b>Đã hủy từ Telegram</b>",
          extraLines: [`🔗 Quản trị: ${publicBaseUrl}/manage/booking-requests`],
        }));
      }

      await sharedAnswerCallback(callback.id, "Đã hủy booking");
      return NextResponse.json({ ok: true, status: "CANCELLED", debug: { bookingId } });
    }

    if (nextStatus === "NEEDS_RESCHEDULE") {
      const updateRes = await supabase
        .from("booking_requests")
        .update({ status: "NEEDS_RESCHEDULE" })
        .eq("id", bookingId)
        .select("id,status")
        .maybeSingle();

      if (updateRes.error) throw updateRes.error;
      await rebalanceOpenBookingRequests({ client: supabase, orgId: row.org_id });

      if (chatId && oldMessageId) await deleteTelegramMessage(chatId, oldMessageId);
      if (chatId) {
        await sendTelegramMessage(chatId, buildBookingResultMessage({
          title: "<b>📅 BOOKING CẦN ĐỔI LỊCH</b>",
          customerName: row.customer_name,
          customerPhone: row.customer_phone,
          requestedService: row.requested_service,
          requestedStartAt: row.requested_start_at,
          note: row.note,
          resultLine: "📅 Kết quả: <b>Đã chuyển sang trạng thái cần đổi lịch</b>",
          extraLines: [`🔗 Quản trị: ${publicBaseUrl}/manage/booking-requests`],
        }));
      }

      await sharedAnswerCallback(callback.id, "Đã chuyển booking sang cần đổi lịch");
      return NextResponse.json({ ok: true, status: "NEEDS_RESCHEDULE", debug: { bookingId } });
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
        await sendTelegramMessage(chatId, buildBookingResultMessage({
          title: "<b>⚠️ BOOKING VƯỢT GIỚI HẠN KHUNG GIỜ</b>",
          customerName: row.customer_name,
          customerPhone: row.customer_phone,
          requestedService: row.requested_service,
          requestedStartAt: row.requested_start_at,
          note: row.note,
          resultLine: "📅 Kết quả: <b>Đã chuyển sang cần đổi lịch, chưa tạo appointment</b>",
          extraLines: [
            `⚠️ Trùng/vượt giới hạn với <b>${overlapCount}</b> lịch hiện có`,
            ...appointmentOverlaps.slice(0, 3).map((item) => `• ${escapeHtml(pickCustomerName(item.customers))} — ${formatViDateTime(item.start_at)}`),
            `ℹ️ Cảnh báo sát lịch trong khoảng ±${NEARBY_WARNING_MINUTES} phút chỉ dùng để nhắc`,
            `🔗 Quản trị: ${publicBaseUrl}/manage/booking-requests`,
          ],
        }));
      }

      await sharedAnswerCallback(callback.id, `Booking vượt giới hạn ${MAX_SIMULTANEOUS_BOOKINGS} khách cùng giờ, cần đổi lịch`);
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
      await sendTelegramMessage(chatId, buildBookingResultMessage({
        title: "<b>✅ BOOKING ĐÃ XÁC NHẬN</b>",
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        requestedService: row.requested_service,
        requestedStartAt: row.requested_start_at,
        note: row.note,
        resultLine: "✅ Kết quả: <b>Đã xác nhận và tạo appointment</b>",
        extraLines: [
          `🆔 Appointment: <code>${appointmentId}</code>`,
          `📌 Trạng thái mới: <b>BOOKED ONLINE</b>`,
          `ℹ️ Giới hạn hiện tại: tối đa <b>${MAX_SIMULTANEOUS_BOOKINGS}</b> khách cùng giờ, cảnh báo sát lịch ±${NEARBY_WARNING_MINUTES} phút`,
          `🔗 Quản trị: ${publicBaseUrl}/manage/appointments`,
        ],
      }));
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
