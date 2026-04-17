import { createClient } from "@supabase/supabase-js";

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

export function formatViDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
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
  const supabase = getAdminSupabase();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const { data: todayTickets, error } = await supabase
    .from("tickets")
    .select("id,totals_json,payment_method")
    .eq("org_id", orgId)
    .eq("status", "CLOSED")
    .gte("created_at", todayStart.toISOString())
    .lt("created_at", todayEnd.toISOString());

  if (error) throw error;

  const tickets = todayTickets ?? [];
  const revenue = tickets.reduce((sum, t) => sum + Number((t.totals_json as { grand_total?: number } | null)?.grand_total ?? 0), 0);
  const cashRev = tickets.filter((t) => (t as { payment_method?: string }).payment_method === "CASH").reduce((sum, t) => sum + Number((t.totals_json as { grand_total?: number } | null)?.grand_total ?? 0), 0);
  const transferRev = revenue - cashRev;

  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  const { data: weekTickets } = await supabase
    .from("tickets")
    .select("created_at,totals_json")
    .eq("org_id", orgId)
    .eq("status", "CLOSED")
    .gte("created_at", weekStart.toISOString())
    .lt("created_at", todayEnd.toISOString());

  const weekBuckets = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    weekBuckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const t of weekTickets ?? []) {
    const key = String(t.created_at).slice(0, 10);
    const target = weekBuckets.get(key);
    if (target !== undefined) {
      weekBuckets.set(key, target + Number((t.totals_json as { grand_total?: number } | null)?.grand_total ?? 0));
    }
  }

  const yesterdayKey = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const todayKey = todayStart.toISOString().slice(0, 10);
  const yesterdayRev = weekBuckets.get(yesterdayKey) ?? 0;
  const trend = yesterdayRev > 0 ? Math.round(((revenue - yesterdayRev) / yesterdayRev) * 100) : 0;
  const trendIcon = trend > 0 ? "↑" : trend < 0 ? "↓" : "→";

  const trendLine = [...weekBuckets.entries()]
    .slice(-7)
    .map(([, v]) => (v > 0 ? `${formatVND(v)}` : "0"))
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

  for (const b of rows) {
    const statusIcon = b.status === "NEW" ? "🆕" : "🔄";
    lines.push(`${statusIcon} <b>${b.customer_name}</b> — ${formatViDateTime(b.requested_start_at as string)}`);
    if (b.requested_service) lines.push(`   DV: ${b.requested_service}`);
    if (b.customer_phone) lines.push(`   SĐT: ${b.customer_phone}`);
  }

  lines.push("", `👉 ${publicBaseUrl}/manage/booking-requests`);

  await sendTelegramMessage(chatId, lines.join("\n"));
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
    "Bạn có thể dùng các lệnh sau:",
    "/lich — Lịch hôm nay",
    "/doanhthu — Doanh thu hôm nay",
    "/ca — Ca làm đang mở",
    "/booking — Booking chờ xử lý",
  ].join("\n"));
}

export async function handleStartCommand(telegramUserId: number, chatId: string) {
  const userInfo = await getTelegramUserRole(telegramUserId);

  if (userInfo.linked) {
    await sendTelegramMessage(chatId, [
      "👋 <b>Chào lại!</b>",
      "",
      `Đã liên kết: <b>${userInfo.display_name}</b> (${userInfo.role})`,
      "",
      "Dùng lệnh:",
      "/lich — Lịch hôm nay",
      "/doanhthu — Doanh thu hôm nay",
      "/ca — Ca làm đang mở",
      "/booking — Booking chờ xử lý",
    ].join("\n"));
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
