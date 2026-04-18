import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "node:fs";
import path from "node:path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;

export function getAdminSupabase() {
  if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Thiếu Supabase env");
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function sendTelegramMessage(chatId: string, text: string, opts?: { parse_mode?: string; reply_markup?: unknown }) {
  if (!telegramBotToken) throw new Error("Thiếu TELEGRAM_BOT_TOKEN");

  const res = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: opts?.parse_mode ?? "HTML",
      disable_web_page_preview: true,
      ...(opts?.reply_markup ? { reply_markup: opts.reply_markup } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Telegram sendMessage failed: ${errText}`);
  }

  return (await res.json()) as { ok: boolean; result?: { message_id: number } };
}

export async function answerCallbackQuery(callbackQueryId: string, text: string) {
  if (!telegramBotToken) return;
  await fetch(`https://api.telegram.org/bot${telegramBotToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

export async function deleteTelegramMessage(chatId: string, messageId: number) {
  if (!telegramBotToken) return;
  await fetch(`https://api.telegram.org/bot${telegramBotToken}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
  });
}

export interface TelegramUserRole {
  linked: boolean;
  user_id?: string;
  role?: string;
  display_name?: string;
  org_id?: string;
}

type TelegramConversationStep =
  | "report:custom"
  | "quickcreate:name"
  | "quickcreate:phone"
  | "quickcreate:date"
  | "quickcreate:date_custom"
  | "quickcreate:time"
  | "quickcreate:service";

type TelegramConversationState = {
  step: TelegramConversationStep;
  data: Record<string, string>;
  timestamp: number;
};

type TelegramQuickCreateServiceSuggestion = {
  id: string;
  name: string;
};

const telegramConversationState = new Map<string, TelegramConversationState>();
const TELEGRAM_CONVERSATION_TTL_MS = 10 * 60 * 1000;
let telegramConversationStorageFallbackLogged = false;
const TELEGRAM_CONVERSATION_FALLBACK_FILE = path.join(process.cwd(), ".tmp", "telegram-conversations.json");
const QUICK_CREATE_START_HOUR = 9;
const QUICK_CREATE_END_HOUR = 21;
const VIETNAM_MOBILE_PHONE_REGEX = /^(03|05|07|08|09)\d{8}$/;

export async function getTelegramUserRole(telegramUserId: number): Promise<TelegramUserRole> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase.rpc("get_telegram_user_role", {
    p_telegram_user_id: telegramUserId,
  });
  if (error) throw error;
  return data as TelegramUserRole;
}

export function isManagerOrOwner(role?: string): boolean {
  return role === "OWNER" || role === "MANAGER";
}

function getConversationKey(telegramUserId: number): string {
  return String(telegramUserId);
}

function getInMemoryConversationState(telegramUserId: number): TelegramConversationState | null {
  const state = telegramConversationState.get(getConversationKey(telegramUserId));
  if (!state) return null;
  if (Date.now() - state.timestamp > TELEGRAM_CONVERSATION_TTL_MS) {
    telegramConversationState.delete(getConversationKey(telegramUserId));
    return null;
  }
  return state;
}

function setInMemoryConversationState(telegramUserId: number, step: TelegramConversationStep, data: Record<string, string> = {}) {
  telegramConversationState.set(getConversationKey(telegramUserId), {
    step,
    data,
    timestamp: Date.now(),
  });
}

function clearInMemoryConversationState(telegramUserId: number) {
  telegramConversationState.delete(getConversationKey(telegramUserId));
}

async function ensureConversationFallbackDir() {
  await fs.mkdir(path.dirname(TELEGRAM_CONVERSATION_FALLBACK_FILE), { recursive: true });
}

async function readConversationFallbackFile(): Promise<Record<string, TelegramConversationState>> {
  try {
    const raw = await fs.readFile(TELEGRAM_CONVERSATION_FALLBACK_FILE, "utf8");
    return JSON.parse(raw) as Record<string, TelegramConversationState>;
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (message.includes("enoent")) return {};
    throw error;
  }
}

async function writeConversationFallbackFile(states: Record<string, TelegramConversationState>) {
  await ensureConversationFallbackDir();
  await fs.writeFile(TELEGRAM_CONVERSATION_FALLBACK_FILE, JSON.stringify(states, null, 2), "utf8");
}

async function getFileConversationState(telegramUserId: number): Promise<TelegramConversationState | null> {
  const states = await readConversationFallbackFile();
  const key = getConversationKey(telegramUserId);
  const state = states[key];
  if (!state) return null;
  if (Date.now() - state.timestamp > TELEGRAM_CONVERSATION_TTL_MS) {
    delete states[key];
    await writeConversationFallbackFile(states);
    return null;
  }
  return state;
}

async function setFileConversationState(telegramUserId: number, step: TelegramConversationStep, data: Record<string, string> = {}) {
  const states = await readConversationFallbackFile();
  states[getConversationKey(telegramUserId)] = {
    step,
    data,
    timestamp: Date.now(),
  };
  await writeConversationFallbackFile(states);
}

async function clearFileConversationState(telegramUserId: number) {
  const states = await readConversationFallbackFile();
  delete states[getConversationKey(telegramUserId)];
  await writeConversationFallbackFile(states);
}

function shouldUseConversationFallback(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("telegram_conversations") || message.includes("does not exist") || message.includes("schema cache");
}

function logConversationFallbackOnce(error: unknown) {
  if (telegramConversationStorageFallbackLogged) return;
  telegramConversationStorageFallbackLogged = true;
  console.warn("[telegram] Falling back to in-memory conversation state.", error);
}

async function getConversationState(telegramUserId: number): Promise<TelegramConversationState | null> {
  const supabase = getAdminSupabase();
  try {
    const { data, error } = await supabase
      .from("telegram_conversations")
      .select("step,data_json,expires_at")
      .eq("telegram_user_id", telegramUserId)
      .maybeSingle();

    if (error) throw error;
    if (!data?.step) return null;

    const expiresAtMs = data.expires_at ? new Date(data.expires_at as string).getTime() : 0;
    if (!expiresAtMs || expiresAtMs <= Date.now()) {
      await supabase.from("telegram_conversations").delete().eq("telegram_user_id", telegramUserId);
      return null;
    }

    return {
      step: data.step as TelegramConversationStep,
      data: ((data.data_json as Record<string, string> | null) ?? {}),
      timestamp: expiresAtMs - TELEGRAM_CONVERSATION_TTL_MS,
    };
  } catch (error) {
    if (!shouldUseConversationFallback(error)) throw error;
    logConversationFallbackOnce(error);
    const memoryState = getInMemoryConversationState(telegramUserId);
    if (memoryState) return memoryState;
    return getFileConversationState(telegramUserId);
  }
}

async function setConversationState(telegramUserId: number, step: TelegramConversationStep, data: Record<string, string> = {}) {
  const supabase = getAdminSupabase();
  try {
    const expiresAt = new Date(Date.now() + TELEGRAM_CONVERSATION_TTL_MS).toISOString();
    const { error } = await supabase
      .from("telegram_conversations")
      .upsert({
        telegram_user_id: telegramUserId,
        step,
        data_json: data,
        expires_at: expiresAt,
      }, {
        onConflict: "telegram_user_id",
      });

    if (error) throw error;
  } catch (error) {
    if (!shouldUseConversationFallback(error)) throw error;
    logConversationFallbackOnce(error);
    setInMemoryConversationState(telegramUserId, step, data);
    await setFileConversationState(telegramUserId, step, data);
  }
}

async function clearConversationState(telegramUserId: number) {
  const supabase = getAdminSupabase();
  try {
    const { error } = await supabase
      .from("telegram_conversations")
      .delete()
      .eq("telegram_user_id", telegramUserId);

    if (error) throw error;
  } catch (error) {
    if (!shouldUseConversationFallback(error)) throw error;
    logConversationFallbackOnce(error);
    clearInMemoryConversationState(telegramUserId);
    await clearFileConversationState(telegramUserId);
  }
}

export async function cancelTelegramConversation(telegramUserId: number) {
  await clearConversationState(telegramUserId);
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

export function formatViTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatViDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatViDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatViShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getTicketGrandTotal(ticket: { totals_json?: { grand_total?: number } | null }): number {
  return Number(ticket.totals_json?.grand_total ?? 0);
}

function pickCustomerName(customers: { name?: string } | { name?: string }[] | null | undefined): string {
  if (Array.isArray(customers)) return customers[0]?.name ?? "Khách";
  return customers?.name ?? "Khách";
}

export async function handleLichCommand(orgId: string, chatId: string) {
  const supabase = getAdminSupabase();
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id,status,start_at,staff_user_id,customers(name)")
    .eq("org_id", orgId)
    .gte("start_at", start.toISOString())
    .lt("start_at", end.toISOString())
    .order("start_at", { ascending: true });

  if (error) throw error;

  const rows = appointments ?? [];
  const booked = rows.filter((a) => a.status === "BOOKED");
  const checkedIn = rows.filter((a) => a.status === "CHECKED_IN");
  const done = rows.filter((a) => a.status === "DONE");

  const staffIds = [...new Set(rows.map((a) => a.staff_user_id as string | null).filter((v): v is string => Boolean(v)))];
  let staffNameMap = new Map<string, string>();
  if (staffIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id,display_name")
      .in("user_id", staffIds);
    staffNameMap = new Map((profiles ?? []).map((p) => [p.user_id as string, ((p.display_name as string | null) || String(p.user_id).slice(0, 8))]));
  }

  const lines = [
    `<b>📋 LỊCH HÔM NAY (${formatViDate(now.toISOString())})</b>`,
    `Tổng: <b>${rows.length}</b> lịch | Chờ: <b>${booked.length}</b> | Đang làm: <b>${checkedIn.length}</b> | Xong: <b>${done.length}</b>`,
    "",
  ];

  if (checkedIn.length > 0) {
    lines.push("<b>🔴 Đang làm:</b>");
    for (const a of checkedIn.slice(0, 5)) {
      const name = pickCustomerName(a.customers as Parameters<typeof pickCustomerName>[0]);
      const staff = a.staff_user_id ? (staffNameMap.get(a.staff_user_id as string) ?? "-") : "-";
      lines.push(`  ${formatViTime(a.start_at as string)} - ${name} → ${staff}`);
    }
  }

  if (booked.length > 0) {
    lines.push("<b>🟡 Chờ check-in:</b>");
    for (const a of booked.slice(0, 8)) {
      const name = pickCustomerName(a.customers as Parameters<typeof pickCustomerName>[0]);
      const staff = a.staff_user_id ? (staffNameMap.get(a.staff_user_id as string) ?? "-") : "-";
      lines.push(`  ${formatViTime(a.start_at as string)} - ${name} → ${staff}`);
    }
    if (booked.length > 8) lines.push(`  ... và ${booked.length - 8} khách khác`);
  }

  if (rows.length === 0) {
    lines.push("Chưa có lịch nào hôm nay.");
  }

  await sendTelegramMessage(chatId, lines.join("\n"));
}

export async function handleDoanhthuCommand(orgId: string, chatId: string) {
  await handleRevenueReportCommand(orgId, chatId, "today");
  /*
  const trendIcon = trend > 0 ? "↑" : trend < 0 ? "↓" : "→";

    .join(" → ");

  const lines = [
    `<b>💰 DOANH THU HÔM NAY</b>`,
    `<b>${formatVND(revenue)}</b> (${tickets.length} bill)`,
    "",
    `💵 Tiền mặt: ${formatVND(cashRev)}`,
    `🏦 Chuyển khoản: ${formatVND(transferRev)}`,
    "",
    `So với hôm qua: ${trendIcon} ${Math.abs(trend)}%`,
    "",
    `<b>Trend 7 ngày:</b>`,
    trendLine,
  ];

  await sendTelegramMessage(chatId, lines.join("\n"));
  */
}

export async function handleCaCommand(orgId: string, chatId: string) {
  const supabase = getAdminSupabase();
  const now = new Date();

  const { data: openShifts, error } = await supabase
    .from("time_entries")
    .select("staff_user_id,clock_in")
    .eq("org_id", orgId)
    .is("clock_out", null)
    .order("clock_in", { ascending: true });

  if (error) throw error;

  const shifts = openShifts ?? [];
  if (!shifts.length) {
    await sendTelegramMessage(chatId, "<b>🕐 CA LÀM</b>\n\nKhông có ai đang mở ca.");
    return;
  }

  const staffIds = shifts.map((s) => s.staff_user_id as string);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id,display_name")
    .in("user_id", staffIds);
  const nameMap = new Map((profiles ?? []).map((p) => [p.user_id as string, ((p.display_name as string | null) || String(p.user_id).slice(0, 8))]));

  const lines = ["<b>🕐 CA LÀM ĐANG MỞ</b>", ""];

  for (const s of shifts) {
    const name = nameMap.get(s.staff_user_id as string) ?? "-";
    const clockIn = new Date(s.clock_in as string);
    const diffMs = now.getTime() - clockIn.getTime();
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    const duration = `${hours}h${minutes}p`;
    const warning = diffMs > 10 * 3600000 ? " ⚠️ QUÁ 10H!" : diffMs > 8 * 3600000 ? " ⚠️ gần 8h" : "";
    lines.push(`• <b>${name}</b> — ${duration} (vào ${formatViTime(s.clock_in as string)})${warning}`);
  }

  await sendTelegramMessage(chatId, lines.join("\n"));
}

export async function handleBookingCommand(orgId: string, chatId: string) {
  const supabase = getAdminSupabase();
  const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://chambeauty.io.vn";

  const { data: bookings, error } = await supabase
    .from("booking_requests")
    .select("id,customer_name,customer_phone,requested_service,requested_start_at,status")
    .eq("org_id", orgId)
    .in("status", ["NEW", "NEEDS_RESCHEDULE"])
    .order("requested_start_at", { ascending: true })
    .limit(10);

  if (error) throw error;

  const rows = bookings ?? [];
  if (!rows.length) {
    await sendTelegramMessage(chatId, "<b>📌 BOOKING</b>\n\nKhông có booking mới chờ xử lý.");
    return;
  }

  const newCount = rows.filter((r) => r.status === "NEW").length;
  const rescheduleCount = rows.filter((r) => r.status === "NEEDS_RESCHEDULE").length;

  const lines = [
    `<b>📌 BOOKING CHỜ XỬ LÝ</b>`,
    `Mới: <b>${newCount}</b> | Cần dời: <b>${rescheduleCount}</b>`,
    "",
  ];
  const keyboardRows = rows.map((b) => [
    {
      text: `🔎 ${b.customer_name} (${formatViTime(b.requested_start_at as string)})`,
      callback_data: `booking:view:${b.id}`,
    },
  ]);

  for (const b of rows) {
    const statusIcon = b.status === "NEW" ? "🆕" : "🔄";
    lines.push(`${statusIcon} <b>${b.customer_name}</b> — ${formatViDateTime(b.requested_start_at as string)}`);
    if (b.requested_service) lines.push(`   DV: ${b.requested_service}`);
    if (b.customer_phone) lines.push(`   SĐT: ${b.customer_phone}`);
  }

  lines.push("", `👉 ${publicBaseUrl}/manage/booking-requests`);
  keyboardRows.push([{ text: "◀️ Quay lại", callback_data: "menu:admin" }]);

  await sendTelegramMessage(chatId, lines.join("\n"), {
    reply_markup: { inline_keyboard: keyboardRows },
  });
}

function getAdminMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "CRM", callback_data: "menu:crm" }],
      [
        { text: "📊 Tổng quan", callback_data: "menu:overview" },
        { text: "📈 Báo cáo", callback_data: "menu:report" },
      ],
      [
        { text: "🕐 Ca làm", callback_data: "menu:ca" },
        { text: "⚡ Tạo nhanh", callback_data: "menu:quickcreate" },
      ],
      [
        { text: "📌 Booking", callback_data: "menu:booking" },
      ],
    ],
  };
}

function getQuickCreateKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "1️⃣ Tao lich moi", callback_data: "quickcreate:new" }],
      [{ text: "2️⃣ Check-in nhanh", callback_data: "quickcreate:checkin" }],
      [{ text: "◀️ Quay lại", callback_data: "menu:admin" }],
    ],
  };
}

function getQuickCreateConfirmKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "✅ Xác nhận tao lich", callback_data: "quickcreate:confirm" },
        { text: "❌ Hủy", callback_data: "quickcreate:cancel" },
      ],
      [{ text: "◀️ Quay lại", callback_data: "menu:quickcreate" }],
    ],
  };
}

function getQuickCreateDateKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "📅 Hôm nay", callback_data: "quickcreate:date:today" },
        { text: "📆 Mai", callback_data: "quickcreate:date:tomorrow" },
      ],
      [
        { text: "🗓️ Mot", callback_data: "quickcreate:date:day_after_tomorrow" },
        { text: "✍️ Tuy chon", callback_data: "quickcreate:date:custom" },
      ],
      [{ text: "◀️ Quay lại", callback_data: "menu:quickcreate" }],
    ],
  };
}

function getQuickCreateServiceKeyboard(services: TelegramQuickCreateServiceSuggestion[]) {
  const serviceRows = [];

  for (let index = 0; index < services.length; index += 2) {
    serviceRows.push(
      services.slice(index, index + 2).map((service) => ({
        text: `💅 ${service.name}`,
        callback_data: `quickcreate:service:${service.id}`,
      })),
    );
  }

  return {
    inline_keyboard: [
      ...serviceRows,
      [{ text: "✍️ Tu nhap dich vu", callback_data: "quickcreate:service:custom" }],
      [{ text: "◀️ Quay lại", callback_data: "menu:quickcreate" }],
    ],
  };
}

export function getReportMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "📅 Hôm nay", callback_data: "report:today" },
        { text: "📆 Tuần này", callback_data: "report:week" },
      ],
      [
        { text: "🗓️ Tháng này", callback_data: "report:month" },
        { text: "📊 Tùy chọn", callback_data: "report:custom" },
      ],
      [{ text: "◀️ Quay lại", callback_data: "menu:admin" }],
    ],
  };
}

function getBackToAdminKeyboard() {
  return {
    inline_keyboard: [[{ text: "◀️ Quay lại", callback_data: "menu:admin" }]],
  };
}

function getCrmMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Đến hạn chăm sóc", callback_data: "crm:followups" }],
      [{ text: "Khách có nguy cơ", callback_data: "crm:at_risk" }],
      [{ text: "Quay lại", callback_data: "menu:admin" }],
    ],
  };
}

function getCrmBackKeyboard() {
  return {
    inline_keyboard: [[{ text: "Về CRM", callback_data: "menu:crm" }]],
  };
}

function getCustomerCrmWebUrl(customerId: string) {
  return `${process.env.NEXT_PUBLIC_APP_URL || "https://chambeauty.io.vn"}/manage/customers/${customerId}`;
}

async function listTelegramCrmCustomers(orgId: string, mode: "followups" | "at_risk", limit = 8) {
  const supabase = getAdminSupabase();
  let query = supabase
    .from("customers")
    .select("id,full_name,name,phone,total_visits,total_spend,last_visit_at,last_service_summary,next_follow_up_at,customer_status,follow_up_status")
    .eq("org_id", orgId)
    .is("merged_into_customer_id", null);

  if (mode === "followups") {
    query = query
      .not("next_follow_up_at", "is", null)
      .neq("follow_up_status", "DONE")
      .order("next_follow_up_at", { ascending: true })
      .limit(limit);
  } else {
    query = query
      .in("customer_status", ["AT_RISK", "LOST"])
      .order("last_visit_at", { ascending: true, nullsFirst: true })
      .limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function markTelegramCrmContacted(orgId: string, customerId: string) {
  const supabase = getAdminSupabase();
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id,full_name,name")
    .eq("org_id", orgId)
    .eq("id", customerId)
    .maybeSingle();

  if (customerError) throw customerError;
  if (!customer?.id) {
    return { ok: false, message: "Không tìm thấy khách." };
  }

  const { error: updateError } = await supabase
    .from("customers")
    .update({
      last_contacted_at: new Date().toISOString(),
      follow_up_status: "DONE",
    })
    .eq("org_id", orgId)
    .eq("id", customerId);

  if (updateError) throw updateError;

  const { error: activityError } = await supabase
    .from("customer_activities")
    .insert({
      org_id: orgId,
      customer_id: customerId,
      type: "TELEGRAM_CONTACT",
      channel: "TELEGRAM",
      content_summary: "Đánh dấu đã liên hệ từ Telegram CRM",
      created_by: null,
    });

  if (activityError) throw activityError;

  return {
    ok: true,
    message: `Đã đánh dấu đã liên hệ: ${customer.full_name || customer.name || "Khach"}`,
  };
}

function parseCustomReportDate(raw: string): Date | null {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = new Date().getFullYear();
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalizeVietnamPhone(raw: string): string | null {
  const digitsOnly = raw.replace(/\D/g, "");
  if (!VIETNAM_MOBILE_PHONE_REGEX.test(digitsOnly)) return null;
  return digitsOnly;
}

function parseQuickCreateDate(raw: string): { iso: string; label: string } | null {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = match[3] ? Number(match[3]) : new Date().getFullYear();
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  if (date < today) return null;

  return {
    iso: date.toISOString(),
    label: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}${match[3] ? `/${year}` : ""}`,
  };
}

function getQuickCreatePresetDateLabel(offsetDays: number): { iso: string; label: string } {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);

  const label = offsetDays === 0
    ? "Hôm nay"
    : offsetDays === 1
      ? "Ngày mai"
      : "Ngày mốt";

  return {
    iso: date.toISOString(),
    label: `${label} (${formatViShortDate(date.toISOString())})`,
  };
}

function parseQuickCreateTime(raw: string, baseDateIso: string): { iso: string; label: string } | null {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  if (hour < QUICK_CREATE_START_HOUR || hour > QUICK_CREATE_END_HOUR) return null;
  if (hour === QUICK_CREATE_END_HOUR && minute > 0) return null;

  const date = new Date(baseDateIso);
  date.setHours(hour, minute, 0, 0);
  return {
    iso: date.toISOString(),
    label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

async function getQuickCreateServiceSuggestions(orgId: string): Promise<TelegramQuickCreateServiceSuggestion[]> {
  const supabase = getAdminSupabase();

  const featuredResult = await supabase
    .from("services")
    .select("id,name")
    .eq("org_id", orgId)
    .eq("active", true)
    .eq("featured_in_lookbook", true)
    .order("name", { ascending: true })
    .limit(6);

  if (featuredResult.error) throw featuredResult.error;

  const featuredRows = (featuredResult.data ?? []) as TelegramQuickCreateServiceSuggestion[];
  if (featuredRows.length > 0) return featuredRows;

  const fallbackResult = await supabase
    .from("services")
    .select("id,name")
    .eq("org_id", orgId)
    .eq("active", true)
    .order("name", { ascending: true })
    .limit(6);

  if (fallbackResult.error) throw fallbackResult.error;
  return (fallbackResult.data ?? []) as TelegramQuickCreateServiceSuggestion[];
}

async function promptQuickCreateServiceSelection(chatId: string, orgId: string) {
  const suggestions = await getQuickCreateServiceSuggestions(orgId);

  await sendTelegramMessage(
    chatId,
    [
      "⚡ <b>TẠO LỊCH MỚI</b>",
      "",
      "Chọn dịch vụ theo mẫu Lookbook bên dưới",
      "hoặc tự nhập dịch vụ mong muốn.",
    ].join("\n"),
    {
      reply_markup: suggestions.length > 0
        ? getQuickCreateServiceKeyboard(suggestions)
        : getBackToAdminKeyboard(),
    },
  );
}

export async function handleQuickCreateDateSelection(telegramUserId: number, chatId: string, dateMode: string) {
  const state = await getConversationState(telegramUserId);
  if (!state || state.step !== "quickcreate:date") {
    return { ok: false, message: "Không tìm thấy bước chọn ngày." };
  }

  if (dateMode === "custom") {
    await setConversationState(telegramUserId, "quickcreate:date_custom", state.data);
    await sendTelegramMessage(
      chatId,
      "⚡ <b>TẠO LỊCH MỚI</b>\n\nNhập ngày hẹn theo định dạng <code>dd/mm</code> hoac <code>dd/mm/yyyy</code>.",
      { parse_mode: "HTML", reply_markup: getBackToAdminKeyboard() },
    );
    return { ok: true, message: "Nhập ngày tùy chọn" };
  }

  const presetDate = dateMode === "today"
    ? getQuickCreatePresetDateLabel(0)
    : dateMode === "tomorrow"
      ? getQuickCreatePresetDateLabel(1)
      : dateMode === "day_after_tomorrow"
        ? getQuickCreatePresetDateLabel(2)
        : null;

  if (!presetDate) {
    return { ok: false, message: "Lựa chọn ngày không hợp lệ." };
  }

  await setConversationState(telegramUserId, "quickcreate:time", {
    ...state.data,
    appointmentDateIso: presetDate.iso,
    appointmentDateLabel: presetDate.label,
  });
  await sendTelegramMessage(
    chatId,
    `⚡ <b>TẠO LỊCH MỚI</b>\n\nNgày hẹn: <b>${escapeHtml(presetDate.label)}</b>\nNhập giờ hẹn. VD: <code>14:30</code>\nChỉ nhận khung giờ <b>09:00 - 21:00</b>.`,
    { parse_mode: "HTML", reply_markup: getBackToAdminKeyboard() },
  );
  return { ok: true, message: "Đã chọn ngày hẹn" };
}

async function findOrCreateTelegramCustomer(orgId: string, customerName: string, customerPhone: string, requestedService: string) {
  const supabase = getAdminSupabase();
  const { data: existingCustomer, error: existingError } = await supabase
    .from("customers")
    .select("id,notes")
    .eq("org_id", orgId)
    .eq("name", customerName)
    .eq("phone", customerPhone)
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  const mergedNotes = [existingCustomer?.notes, requestedService ? `DV: ${requestedService}` : null]
    .filter(Boolean)
    .join(" | ");

  if (existingCustomer?.id) {
    const { error: updateError } = await supabase
      .from("customers")
      .update({ notes: mergedNotes || null })
      .eq("id", existingCustomer.id);

    if (updateError) throw updateError;
    return existingCustomer.id;
  }

  const { data: createdCustomer, error: createError } = await supabase
    .from("customers")
    .insert({
      org_id: orgId,
      name: customerName,
      phone: customerPhone,
      notes: mergedNotes || null,
    })
    .select("id")
    .single();

  if (createError) throw createError;
  return createdCustomer.id as string;
}

async function createTelegramQuickAppointment(orgId: string, customerName: string, customerPhone: string, startAt: string, requestedService: string) {
  const supabase = getAdminSupabase();
  const endAt = new Date(new Date(startAt).getTime() + 60 * 60 * 1000).toISOString();
  const customerId = await findOrCreateTelegramCustomer(orgId, customerName, customerPhone, requestedService);

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("default_branch_id")
    .eq("org_id", orgId)
    .not("default_branch_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profileRow?.default_branch_id) {
    throw new Error("Chua tim thay branch mac dinh de tao lich.");
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .insert({
      org_id: orgId,
      branch_id: profileRow.default_branch_id,
      customer_id: customerId,
      staff_user_id: null,
      resource_id: null,
      start_at: startAt,
      end_at: endAt,
      status: "BOOKED",
    })
    .select("id,start_at")
    .single();

  if (appointmentError) throw appointmentError;
  return appointment;
}

export async function handleQuickCreateServiceSelection(telegramUserId: number, chatId: string, serviceIdOrMode: string) {
  const state = await getConversationState(telegramUserId);
  if (!state || state.step !== "quickcreate:service" || !state.data.orgId) {
    return { ok: false, message: "Không tìm thấy bước chọn dịch vụ." };
  }

  if (serviceIdOrMode === "custom") {
    await sendTelegramMessage(chatId, "⚡ <b>TẠO LỊCH MỚI</b>\n\nNhập dịch vụ mong muốn:", {
      reply_markup: getBackToAdminKeyboard(),
    });
    return { ok: true, message: "Nhập dịch vụ mong muốn" };
  }

  const supabase = getAdminSupabase();
  const { data: serviceRow, error } = await supabase
    .from("services")
    .select("id,name")
    .eq("org_id", state.data.orgId)
    .eq("id", serviceIdOrMode)
    .eq("active", true)
    .maybeSingle();

  if (error) throw error;
  if (!serviceRow?.name) {
    return { ok: false, message: "Không tìm thấy dịch vụ đã chọn." };
  }

  await setConversationState(telegramUserId, "quickcreate:service", {
    ...state.data,
    requestedService: serviceRow.name,
  });
  await sendTelegramMessage(
    chatId,
    [
      "⚡ <b>XÁC NHẬN TẠO LỊCH</b>",
      "",
      `👤 Khách: <b>${escapeHtml(state.data.customerName || "-")}</b>`,
      `📞 SĐT: <b>${escapeHtml(state.data.customerPhone || "-")}</b>`,
      `📅 Ngày hẹn: <b>${escapeHtml(state.data.appointmentDateLabel || "-")}</b>`,
      `🕐 Giờ hẹn: <b>${escapeHtml(state.data.appointmentTimeLabel || "-")}</b>`,
      `💅 DV: <b>${escapeHtml(serviceRow.name)}</b>`,
    ].join("\n"),
    { reply_markup: getQuickCreateConfirmKeyboard() },
  );

  return { ok: true, message: "Đã chọn dịch vụ" };
}

export async function handleTelegramConversationMessage(telegramUserId: number, chatId: string, text: string) {
  const state = await getConversationState(telegramUserId);
  if (!state) return false;

  const normalized = text.trim().toLowerCase();
  if (normalized === "back" || normalized === "huy" || normalized === "/cancel") {
    await clearConversationState(telegramUserId);
    if (state.step === "report:custom") {
      await sendTelegramMessage(chatId, "📈 <b>BAO CAO DOANH THU</b>\n\nChon khoang thoi gian:", {
        reply_markup: getReportMenuKeyboard(),
      });
    } else {
      await sendTelegramMessage(chatId, "⚡ <b>TẠO NHANH</b>\n\nChọn chức năng:", {
        reply_markup: getQuickCreateKeyboard(),
      });
    }
    return true;
  }

  if (state.step === "report:custom") {
    const parts = text.split("-").map((item) => item.trim());
    if (parts.length !== 2) {
      await sendTelegramMessage(chatId, "❌ Dinh dang không đúng.\n\nVD: <code>01/04 - 30/04</code>\n\nThử lại:", {
        parse_mode: "HTML",
      });
      return true;
    }

    const startDate = parseCustomReportDate(parts[0]);
    const endDate = parseCustomReportDate(parts[1]);
    if (!startDate || !endDate) {
      await sendTelegramMessage(chatId, "❌ Dinh dang ngay không đúng.\n\nVD: <code>01/04 - 30/04</code>\n\nThử lại:", {
        parse_mode: "HTML",
      });
      return true;
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    await clearConversationState(telegramUserId);
    await handleRevenueReportCommand(state.data.orgId, chatId, "custom", startDate, endDate);
    return true;
  }

  if (state.step === "quickcreate:name") {
    await setConversationState(telegramUserId, "quickcreate:phone", {
      ...state.data,
      customerName: text.trim(),
    });
    await sendTelegramMessage(chatId, "⚡ <b>TẠO LỊCH MỚI</b>\n\nSố điện thoại?", {
      reply_markup: getBackToAdminKeyboard(),
    });
    return true;
  }

  if (state.step === "quickcreate:phone") {
    const normalizedPhone = normalizeVietnamPhone(text.trim());
    if (!normalizedPhone) {
      await sendTelegramMessage(
        chatId,
        "❌ Số điện thoại không hợp lệ.\n\nChỉ nhận số di động Việt Nam <b>10 số</b>.\nVD: <code>0901234567</code>",
        { parse_mode: "HTML" },
      );
      return true;
    }

    await setConversationState(telegramUserId, "quickcreate:date", {
      ...state.data,
      customerPhone: normalizedPhone,
    });
    await sendTelegramMessage(chatId, "⚡ <b>TẠO LỊCH MỚI</b>\n\nChon ngay hen:", {
      parse_mode: "HTML",
      reply_markup: getQuickCreateDateKeyboard(),
    });
    return true;
  }

  if (state.step === "quickcreate:date_custom") {
    const parsedDate = parseQuickCreateDate(text);
    if (!parsedDate) {
      await sendTelegramMessage(
        chatId,
        "❌ Ngày hẹn khong hop le.\n\nNhap theo dinh dang <code>dd/mm</code> hoac <code>dd/mm/yyyy</code> và không được nhỏ hơn hôm nay.",
        { parse_mode: "HTML" },
      );
      return true;
    }

    await setConversationState(telegramUserId, "quickcreate:time", {
      ...state.data,
      appointmentDateIso: parsedDate.iso,
      appointmentDateLabel: parsedDate.label,
    });
    await sendTelegramMessage(
      chatId,
      `⚡ <b>TẠO LỊCH MỚI</b>\n\nNgày hẹn: <b>${escapeHtml(parsedDate.label)}</b>\nNhập giờ hẹn. VD: <code>14:30</code>\nChỉ nhận khung giờ <b>09:00 - 21:00</b>.`,
      { parse_mode: "HTML", reply_markup: getBackToAdminKeyboard() },
    );
    return true;
  }

  if (state.step === "quickcreate:time") {
    if (!state.data.appointmentDateIso) {
      await clearConversationState(telegramUserId);
      await handleQuickCreateMenu(chatId);
      return true;
    }

    const parsedTime = parseQuickCreateTime(text, state.data.appointmentDateIso);
    if (!parsedTime) {
      await sendTelegramMessage(chatId, "❌ Giờ hẹn không hợp lệ.\n\nChi nhan trong khung <b>09:00 - 21:00</b>.\nVD: <code>14:30</code>\n\nThử lại:", {
        parse_mode: "HTML",
      });
      return true;
    }

    await setConversationState(telegramUserId, "quickcreate:service", {
      ...state.data,
      appointmentTimeIso: parsedTime.iso,
      appointmentTimeLabel: parsedTime.label,
    });
    await promptQuickCreateServiceSelection(chatId, state.data.orgId);
    return true;
  }

  if (state.step === "quickcreate:service") {
    await setConversationState(telegramUserId, "quickcreate:service", {
      ...state.data,
      requestedService: text.trim(),
    });
    await sendTelegramMessage(
      chatId,
      [
        "⚡ <b>XÁC NHẬN TẠO LỊCH</b>",
        "",
        `👤 Khách: <b>${escapeHtml(state.data.customerName || "-")}</b>`,
        `📞 SĐT: <b>${escapeHtml(state.data.customerPhone || "-")}</b>`,
        `📅 Ngày hẹn: <b>${escapeHtml(state.data.appointmentDateLabel || "-")}</b>`,
        `🕐 Giờ hẹn: <b>${escapeHtml(state.data.appointmentTimeLabel || "-")}</b>`,
        `💅 DV: <b>${escapeHtml(text.trim() || "-")}</b>`,
      ].join("\n"),
      { reply_markup: getQuickCreateConfirmKeyboard() },
    );
    return true;
  }

  return false;
}

export async function handleManageCommand(chatId: string) {
  await sendTelegramMessage(chatId, "⚙️ <b>MENU QUAN TRI</b>\n\nChọn chức năng:", {
    reply_markup: getAdminMenuKeyboard(),
  });
}

export async function handleCrmMenu(chatId: string) {
  await sendTelegramMessage(chatId, "CRM <b>KHACH</b>\n\nChọn chế độ quản trị CRM:", {
    reply_markup: getCrmMenuKeyboard(),
  });
}

export async function handleQuickCreateMenu(chatId: string) {
  await sendTelegramMessage(chatId, "⚡ <b>TẠO NHANH</b>\n\nChọn chức năng:", {
    reply_markup: getQuickCreateKeyboard(),
  });
}

export async function handleMeCommand(telegramUserId: number, chatId: string) {
  const userInfo = await getTelegramUserRole(telegramUserId);
  if (!userInfo.linked) {
    await sendTelegramMessage(chatId, "❌ <b>Chưa liên kết</b>\n\nVui lòng liên kết tài khoản trong Nails App.");
    return;
  }

  await sendTelegramMessage(
    chatId,
    `✅ <b>Đã liên kết</b>\n\nTài khoản: <b>${userInfo.display_name || "N/A"}</b>\nVai trò: <b>${userInfo.role || "N/A"}</b>\n\nDùng /manage để vào quản trị.`,
  );
}

export async function handleCrmFollowUpCommand(orgId: string, chatId: string) {
  const rows = await listTelegramCrmCustomers(orgId, "followups");

  if (!rows.length) {
    await sendTelegramMessage(chatId, "CRM <b>FOLLOW-UP</b>\n\nChưa có khách nào đến hạn chăm sóc.", {
      reply_markup: getCrmBackKeyboard(),
    });
    return;
  }

  const lines = ["CRM <b>FOLLOW-UP</b>", "", "Khách đến hạn chăm sóc:"];
  const inlineKeyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];

  for (const row of rows) {
    const displayName = escapeHtml(String(row.full_name || row.name || "Khach"));
    const phone = escapeHtml(String(row.phone || "Chua co SDT"));
    const service = escapeHtml(String(row.last_service_summary || "-"));
    const nextFollowUp = row.next_follow_up_at ? formatViDateTime(String(row.next_follow_up_at)) : "-";
    lines.push(`• <b>${displayName}</b> — ${phone}`);
    lines.push(`  Follow-up: ${nextFollowUp} | DV gan nhat: ${service}`);
    inlineKeyboard.push([
      { text: `Done ${String(row.full_name || row.name || "Khach").slice(0, 14)}`, callback_data: `crm:contacted:${row.id}` },
      { text: "Hồ sơ", url: getCustomerCrmWebUrl(String(row.id)) },
    ]);
  }

  inlineKeyboard.push([{ text: "Về CRM", callback_data: "menu:crm" }]);

  await sendTelegramMessage(chatId, lines.join("\n"), {
    reply_markup: { inline_keyboard: inlineKeyboard },
  });
}

export async function handleCrmAtRiskCommand(orgId: string, chatId: string) {
  const rows = await listTelegramCrmCustomers(orgId, "at_risk");

  if (!rows.length) {
    await sendTelegramMessage(chatId, "CRM <b>AT RISK</b>\n\nChưa có khách nào ở nhóm AT_RISK/LOST.", {
      reply_markup: getCrmBackKeyboard(),
    });
    return;
  }

  const lines = ["CRM <b>AT RISK</b>", "", "Khách cần ưu tiên chăm sóc lại:"];
  const inlineKeyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];

  for (const row of rows) {
    const displayName = escapeHtml(String(row.full_name || row.name || "Khach"));
    const phone = escapeHtml(String(row.phone || "Chua co SDT"));
    const lastVisit = row.last_visit_at ? formatViDateTime(String(row.last_visit_at)) : "Chua co";
    const status = escapeHtml(String(row.customer_status || "AT_RISK"));
    lines.push(`• <b>${displayName}</b> — ${status}`);
    lines.push(`  SĐT: ${phone} | Lần ghé cuối: ${lastVisit}`);
    inlineKeyboard.push([
      { text: `Done ${String(row.full_name || row.name || "Khach").slice(0, 14)}`, callback_data: `crm:contacted:${row.id}` },
      { text: "Hồ sơ", url: getCustomerCrmWebUrl(String(row.id)) },
    ]);
  }

  inlineKeyboard.push([{ text: "Về CRM", callback_data: "menu:crm" }]);

  await sendTelegramMessage(chatId, lines.join("\n"), {
    reply_markup: { inline_keyboard: inlineKeyboard },
  });
}

export async function handleCrmContactedCommand(orgId: string, chatId: string, customerId: string) {
  const result = await markTelegramCrmContacted(orgId, customerId);
  await sendTelegramMessage(chatId, `${result.ok ? "OK" : "ERR"} <b>CRM</b>\n\n${escapeHtml(result.message)}`, {
    reply_markup: getCrmBackKeyboard(),
  });
  return result;
}

export async function handleOverviewCommand(orgId: string, chatId: string) {
  const supabase = getAdminSupabase();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const [appointmentsRes, todayTicketsRes, yesterdayTicketsRes, openShiftsRes, newBookingsRes, rescheduleRes] = await Promise.all([
    supabase.from("appointments").select("id,status,start_at").eq("org_id", orgId).gte("start_at", todayStart.toISOString()).lt("start_at", todayEnd.toISOString()),
    supabase.from("tickets").select("totals_json").eq("org_id", orgId).eq("status", "CLOSED").gte("created_at", todayStart.toISOString()).lt("created_at", todayEnd.toISOString()),
    supabase.from("tickets").select("totals_json").eq("org_id", orgId).eq("status", "CLOSED").gte("created_at", yesterdayStart.toISOString()).lt("created_at", todayStart.toISOString()),
    supabase.from("time_entries").select("id").eq("org_id", orgId).is("clock_out", null),
    supabase.from("booking_requests").select("id").eq("org_id", orgId).eq("status", "NEW"),
    supabase.from("booking_requests").select("id").eq("org_id", orgId).eq("status", "NEEDS_RESCHEDULE"),
  ]);

  if (appointmentsRes.error) throw appointmentsRes.error;
  if (todayTicketsRes.error) throw todayTicketsRes.error;
  if (yesterdayTicketsRes.error) throw yesterdayTicketsRes.error;
  if (openShiftsRes.error) throw openShiftsRes.error;
  if (newBookingsRes.error) throw newBookingsRes.error;
  if (rescheduleRes.error) throw rescheduleRes.error;

  const appointments = appointmentsRes.data ?? [];
  const todayTickets = todayTicketsRes.data ?? [];
  const yesterdayTickets = yesterdayTicketsRes.data ?? [];
  const openShifts = openShiftsRes.data ?? [];
  const newBookings = newBookingsRes.data ?? [];
  const rescheduleBookings = rescheduleRes.data ?? [];
  const checkedIn = appointments.filter((a) => a.status === "CHECKED_IN").length;
  const done = appointments.filter((a) => a.status === "DONE").length;
  const booked = appointments.filter((a) => a.status === "BOOKED").length;
  const todayRevenue = todayTickets.reduce((sum, t) => sum + Number((t.totals_json as { grand_total?: number } | null)?.grand_total ?? 0), 0);
  const yesterdayRevenue = yesterdayTickets.reduce((sum, t) => sum + Number((t.totals_json as { grand_total?: number } | null)?.grand_total ?? 0), 0);

  let revenueTrend = "";
  if (yesterdayRevenue > 0) {
    const trend = Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100);
    const icon = trend > 0 ? "↑" : trend < 0 ? "↓" : "→";
    revenueTrend = ` ${icon} ${Math.abs(trend)}%`;
  }

  const labelDate = new Date().toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
  });
  const lines = [
    `<b>📊 TỔNG HÔM NAY (${labelDate})</b>`,
    "",
    `📋 Lịch: <b>${appointments.length}</b> | 🔴 Đang làm: <b>${checkedIn}</b> | ✅ Xong: <b>${done}</b> | 🟡 Chờ: <b>${booked}</b>`,
    `💰 Doanh thu: <b>${formatVND(todayRevenue)}</b>${revenueTrend}`,
    `🕐 Ca: <b>${openShifts.length}</b> người đang mở`,
    "",
    "─────────────────────",
    `📌 Booking: <b>${newBookings.length}</b> mới, <b>${rescheduleBookings.length}</b> cần dời lịch`,
  ];

  await sendTelegramMessage(chatId, lines.join("\n"), { reply_markup: getBackToAdminKeyboard() });
}

export async function handleRevenueReportCommand(orgId: string, chatId: string, period: "today" | "week" | "month" | "custom", customStartDate?: Date, customEndDate?: Date) {
  const supabase = getAdminSupabase();
  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  let title: string;

  if (period === "custom" && customStartDate && customEndDate) {
    startDate = customStartDate;
    endDate = customEndDate;
    title = "📊 BÁO CÁO TÙY CHỌN";
  } else if (period === "today") {
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    title = "📅 BAO CAO HOM NAY";
  } else if (period === "week") {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - now.getDay());
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    title = "📆 BAO CAO TUAN NAY";
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    title = "🗓️ BAO CAO THANG NAY";
  }

  const [{ data: tickets, error: ticketsError }, { data: payments, error: paymentsError }] = await Promise.all([
    supabase
      .from("tickets")
      .select("id,totals_json,created_at")
      .eq("org_id", orgId)
      .eq("status", "CLOSED")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString()),
    supabase
      .from("payments")
      .select("ticket_id,method,amount,created_at,status")
      .eq("org_id", orgId)
      .eq("status", "PAID")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString()),
  ]);

  if (ticketsError) throw ticketsError;
  if (paymentsError) throw paymentsError;

  const rows = tickets ?? [];
  const paymentRows = payments ?? [];
  const reportEndDate = new Date(endDate.getTime() - 1);
  const revenue = rows.reduce((sum, t) => sum + getTicketGrandTotal(t as { totals_json?: { grand_total?: number } | null }), 0);
  const cashRevenue = paymentRows
    .filter((p) => p.method === "CASH")
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const transferRevenue = paymentRows
    .filter((p) => p.method === "TRANSFER")
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const averageBill = rows.length > 0 ? Math.round(revenue / rows.length) : 0;
  const totalDays = Math.max(1, Math.ceil((reportEndDate.getTime() - startDate.getTime() + 1) / 86400000));
  const averagePerDay = Math.round(revenue / totalDays);
  const highestBill = rows.reduce((max, row) => Math.max(max, getTicketGrandTotal(row as { totals_json?: { grand_total?: number } | null })), 0);

  const paymentBreakdown = new Map<string, number>();
  for (const payment of paymentRows) {
    const method = String(payment.method ?? "OTHER");
    paymentBreakdown.set(method, (paymentBreakdown.get(method) ?? 0) + Number(payment.amount ?? 0));
  }

  const dailyBuckets = new Map<string, number>();
  const cursor = new Date(startDate);
  while (cursor <= reportEndDate) {
    dailyBuckets.set(cursor.toISOString().slice(0, 10), 0);
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const row of rows) {
    const key = String(row.created_at).slice(0, 10);
    const current = dailyBuckets.get(key);
    if (current !== undefined) {
      dailyBuckets.set(key, current + getTicketGrandTotal(row as { totals_json?: { grand_total?: number } | null }));
    }
  }

  const peakDay = [...dailyBuckets.entries()].sort((a, b) => b[1] - a[1])[0];
  const recentBills = [...rows]
    .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
    .slice(0, 5);

  const lines = [
    `<b>${title}</b>`,
    `🗓️ Tu: <b>${formatViShortDate(startDate.toISOString())}</b> den <b>${formatViShortDate(reportEndDate.toISOString())}</b>`,
    "",
    `💰 Tong doanh thu: <b>${formatVND(revenue)}</b>`,
    `🧾 So bill: <b>${rows.length}</b>`,
    `💵 Trung binh: <b>${formatVND(averageBill)}</b>/bill`,
    `📆 Trung binh/ngay: <b>${formatVND(averagePerDay)}</b>`,
    `🏆 Bill cao nhat: <b>${formatVND(highestBill)}</b>`,
    "",
    `💵 Tien mat: ${formatVND(cashRevenue)}`,
    `🏦 Chuyen khoan: ${formatVND(transferRevenue)}`,
  ];

  if (paymentBreakdown.size > 0) {
    lines.push("", "<b>💳 Co cau thanh toan:</b>");
    for (const [method, amount] of [...paymentBreakdown.entries()].sort((a, b) => b[1] - a[1])) {
      const percent = revenue > 0 ? Math.round((amount / revenue) * 100) : 0;
      lines.push(`• ${method}: ${formatVND(amount)} (${percent}%)`);
    }
  }

  if (peakDay) {
    lines.push("", `📈 Ngay cao nhat: <b>${formatViShortDate(peakDay[0])}</b> — <b>${formatVND(peakDay[1])}</b>`);
  }

  if (period === "today") {
    lines.push("", "<b>🕐 5 bill gan nhat:</b>");
    if (recentBills.length === 0) {
      lines.push("• Chua co bill nao.");
    } else {
      for (const row of recentBills) {
        lines.push(`• ${formatViDateTime(String(row.created_at))}: ${formatVND(getTicketGrandTotal(row as { totals_json?: { grand_total?: number } | null }))}`);
      }
    }
  } else {
    lines.push("", "<b>📊 Chi tiet theo ngay:</b>");
    for (const [date, amount] of dailyBuckets.entries()) {
      const dayLabel = new Date(date).toLocaleDateString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      });
      lines.push(`• ${dayLabel}: ${formatVND(amount)}`);
    }
  }

  await sendTelegramMessage(chatId, lines.join("\n"), { reply_markup: getBackToAdminKeyboard() });
}

export async function beginCustomReportConversation(telegramUserId: number, orgId: string, chatId: string) {
  await setConversationState(telegramUserId, "report:custom", { orgId });
  await sendTelegramMessage(
    chatId,
    "📊 <b>BÁO CÁO TÙY CHỌN</b>\n\nNhập theo định dạng:\n• <code>01/04 - 30/04</code>\n\nGõ <code>back</code> hoac <code>/cancel</code> để hủy.",
    { parse_mode: "HTML", reply_markup: getBackToAdminKeyboard() },
  );
}

export async function beginQuickCreateAppointmentConversation(telegramUserId: number, orgId: string, chatId: string) {
  await setConversationState(telegramUserId, "quickcreate:name", { orgId });
  await sendTelegramMessage(chatId, "⚡ <b>TẠO LỊCH MỚI</b>\n\nTên khách hàng?", {
    reply_markup: getBackToAdminKeyboard(),
  });
}

export async function confirmQuickCreateAppointment(telegramUserId: number, chatId: string) {
  const state = await getConversationState(telegramUserId);
  if (!state || state.step !== "quickcreate:service") {
    return { ok: false, message: "Không tìm thấy dữ liệu tạo lịch." };
  }

  const appointment = await createTelegramQuickAppointment(
    state.data.orgId,
    state.data.customerName,
    state.data.customerPhone,
    state.data.appointmentTimeIso,
    state.data.requestedService,
  );

  await clearConversationState(telegramUserId);
  await sendTelegramMessage(
    chatId,
    [
      "✅ <b>TẠO LỊCH THÀNH CÔNG!</b>",
      "",
      `👤 Khách: <b>${escapeHtml(state.data.customerName || "-")}</b>`,
      `📞 SĐT: <b>${escapeHtml(state.data.customerPhone || "-")}</b>`,
      `🕐 Giờ hẹn: <b>${formatViDateTime(appointment.start_at as string)}</b>`,
      `💅 DV: <b>${escapeHtml(state.data.requestedService || "-")}</b>`,
      `🆔 Appointment: <code>${appointment.id}</code>`,
    ].join("\n"),
    { reply_markup: getBackToAdminKeyboard() },
  );

  return { ok: true, message: "Đã tạo lịch mới!" };
}

export async function handleQuickCheckinMenu(orgId: string, chatId: string) {
  const supabase = getAdminSupabase();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id,status,start_at,customers(name)")
    .eq("org_id", orgId)
    .eq("status", "BOOKED")
    .gte("start_at", todayStart.toISOString())
    .lt("start_at", todayEnd.toISOString())
    .order("start_at", { ascending: true });

  if (error) throw error;

  const rows = appointments ?? [];
  if (!rows.length) {
    await sendTelegramMessage(chatId, "<b>✅ CHECK-IN NHANH</b>\n\nKhông có khách chờ check-in hôm nay.", {
      reply_markup: getBackToAdminKeyboard(),
    });
    return;
  }

  const lines = ["<b>✅ CHECK-IN NHANH</b>", "", "Danh sách khách chờ check-in:"];
  const keyboardRows = rows.map((row) => [
    {
      text: `✅ ${pickCustomerName(row.customers as Parameters<typeof pickCustomerName>[0])} (${formatViTime(row.start_at as string)})`,
      callback_data: `checkin:${row.id}`,
    },
  ]);
  keyboardRows.push([{ text: "◀️ Quay lại", callback_data: "menu:admin" }]);

  for (const row of rows) {
    lines.push(`• <b>${pickCustomerName(row.customers as Parameters<typeof pickCustomerName>[0])}</b> — ${formatViTime(row.start_at as string)}`);
  }

  await sendTelegramMessage(chatId, lines.join("\n"), { reply_markup: { inline_keyboard: keyboardRows } });
}

export async function handleQuickCheckinAction(orgId: string, chatId: string, appointmentId: string) {
  const supabase = getAdminSupabase();
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("id,status,start_at,customers(name)")
    .eq("org_id", orgId)
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) throw error;
  if (!appointment?.id) {
    return { ok: false, message: "Không tìm thấy lịch." };
  }

  if (appointment.status === "CHECKED_IN" || appointment.status === "DONE") {
    return { ok: false, message: "Lịch này đã được xử lý." };
  }

  const { error: updateError } = await supabase
    .from("appointments")
    .update({ status: "CHECKED_IN" })
    .eq("id", appointmentId);

  if (updateError) throw updateError;

  await sendTelegramMessage(
    chatId,
    `✅ <b>CHECK-IN THÀNH CÔNG!</b>\n\nĐã check-in khách: <b>${pickCustomerName(appointment.customers as Parameters<typeof pickCustomerName>[0])}</b>\nGiờ hẹn: ${formatViDateTime(appointment.start_at as string)}`,
    { reply_markup: getBackToAdminKeyboard() },
  );

  return { ok: true, message: "Đã check-in!" };
}

export async function handleBookingDetailCommand(orgId: string, chatId: string, bookingId: string) {
  const supabase = getAdminSupabase();
  const manageUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://chambeauty.io.vn"}/manage/booking-requests`;
  const isLocalManageUrl = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(manageUrl);
  const { data: booking, error } = await supabase
    .from("booking_requests")
    .select("id,org_id,customer_name,customer_phone,requested_service,requested_start_at,status,note")
    .eq("org_id", orgId)
    .eq("id", bookingId)
    .maybeSingle();

  if (error) throw error;
  if (!booking?.id) {
    await sendTelegramMessage(chatId, "❌ Khong tim thay booking.");
    return;
  }

  const statusLabel = booking.status === "NEW" ? "🆕 Mới" : "🔄 Cần đổi lịch";
  const lines = [
    "<b>📌 CHI TIẾT BOOKING</b>",
    "",
    `<b>Trạng thái:</b> ${statusLabel}`,
    `<b>Khách:</b> ${escapeHtml(booking.customer_name)}`,
    `<b>SĐT:</b> ${escapeHtml(booking.customer_phone || "-")}`,
    `<b>Dịch vụ:</b> ${escapeHtml(booking.requested_service || "-")}`,
    `<b>Giờ hẹn:</b> ${formatViDateTime(booking.requested_start_at as string)}`,
  ];
  if (booking.note) lines.push(`<b>Ghi chú:</b> ${escapeHtml(booking.note)}`);

  await sendTelegramMessage(chatId, lines.join("\n"), {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Xác nhận", callback_data: `booking:confirm:${booking.id}` },
          { text: "❌ Hủy", callback_data: `booking:cancel:${booking.id}` },
        ],
        [{ text: "📅 Đổi lịch", callback_data: `booking:reschedule:${booking.id}` }],
        ...(!isLocalManageUrl ? [[{ text: "🔗 Quản trị", url: manageUrl }]] : []),
        [{ text: "◀️ Quay lại", callback_data: "menu:booking" }],
      ],
    },
  });
}

export async function handleLinkCommand(telegramUserId: number, telegramUsername: string | undefined, telegramFirstName: string | undefined, code: string, chatId: string) {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase.rpc("confirm_telegram_link", {
    p_code: code,
    p_telegram_user_id: telegramUserId,
    p_telegram_username: telegramUsername ?? null,
    p_telegram_first_name: telegramFirstName ?? null,
  });

  if (error) {
    await sendTelegramMessage(chatId, `❌ Lỗi liên kết: ${error.message}`);
    return;
  }

  if (!data?.success) {
    const err = data?.error;
    if (err === "INVALID_CODE") {
      await sendTelegramMessage(chatId, "❌ Mã không hợp lệ. Vui lòng kiểm tra lại trong app.");
    } else if (err === "CODE_EXPIRED") {
      await sendTelegramMessage(chatId, "❌ Mã đã hết hạn (5 phút). Vui lòng tạo mã mới trong app.");
    } else if (err === "CODE_USED") {
      await sendTelegramMessage(chatId, "❌ Mã đã được sử dụng.");
    } else {
      await sendTelegramMessage(chatId, `❌ Không thể liên kết: ${err ?? "Lỗi không xác định"}`);
    }
    return;
  }

  const role = data.role as string;
  const displayName = data.display_name as string;
  await sendTelegramMessage(chatId, [
    "✅ <b>LIÊN KẾT THÀNH CÔNG!</b>",
    "",
    `Tài khoản: <b>${displayName}</b>`,
    `Vai trò: <b>${role}</b>`,
    "",
    "Chọn chức năng:",
  ].join("\n"), { reply_markup: getMainMenuKeyboard() });
}

export function getMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "CRM", callback_data: "menu:crm" }],
      [
        { text: "⚙️ Quản trị", callback_data: "menu:admin" },
        { text: "📊 Tổng quan", callback_data: "menu:overview" },
      ],
      [
        { text: "📈 Báo cáo", callback_data: "menu:report" },
        { text: "📌 Booking", callback_data: "menu:booking" },
      ],
    ],
  };
}

export async function handleStartCommand(telegramUserId: number, chatId: string) {
  const userInfo = await getTelegramUserRole(telegramUserId);

  if (userInfo.linked) {
    await sendTelegramMessage(chatId, [
      "👋 <b>Chào lại!</b>",
      "",
      `Đã liên kết: <b>${userInfo.display_name}</b> (${userInfo.role})`,
      "",
      "Chọn chức năng quản trị:",
    ].join("\n"), { reply_markup: getMainMenuKeyboard() });
  } else {
    await sendTelegramMessage(chatId, [
      "👋 <b>Chào bạn!</b>",
      "",
      "Để sử dụng bot, hãy liên kết tài khoản Nails App:",
      "1. Mở Nails App → Hồ sơ & bảo mật",
      "2. Bấm \"Liên kết Telegram\"",
      "3. Gửi lệnh: <code>/link MÃ_6_SỐ</code>",
      "",
      "Ví dụ: <code>/link 482910</code>",
    ].join("\n"));
  }
}
