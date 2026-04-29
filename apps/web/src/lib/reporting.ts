import { getCurrentSessionRole, listUserRoles } from "@/lib/auth";
import { ensureOrgContext } from "@/lib/domain";
import { supabase } from "@/lib/supabase";

export type ReportTicketRow = {
  id: string;
  status: string;
  created_at: string;
  appointment_id?: string | null;
  staff_user_id?: string | null;
  totals_json?: { subtotal?: number; vat_total?: number; grand_total?: number };
};

export async function listTicketsInRange(fromIso: string, toIso: string) {
  if (!supabase) return [];
  const { orgId } = await ensureOrgContext();

  const { data, error } = await supabase
    .from("tickets")
    .select("id,status,created_at,appointment_id,totals_json")
    .eq("org_id", orgId)
    .gte("created_at", fromIso)
    .lt("created_at", toIso)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  const rows = (data ?? []) as ReportTicketRow[];
  const appointmentIds = [...new Set(rows.map((r) => r.appointment_id).filter((v): v is string => Boolean(v)))];
  if (!appointmentIds.length) return rows;

  const { data: appointments, error: appointmentErr } = await supabase
    .from("appointments")
    .select("id,staff_user_id")
    .eq("org_id", orgId)
    .in("id", appointmentIds);
  if (appointmentErr) throw appointmentErr;

  const appointmentMap = new Map((appointments ?? []).map((row) => [row.id as string, (row.staff_user_id as string | null) ?? null]));
  return rows.map((row) => ({
    ...row,
    staff_user_id: row.appointment_id ? (appointmentMap.get(row.appointment_id) ?? null) : null,
  }));
}

let dashboardCache: { at: number; value: { appointmentsToday: number; waiting: number; active: number; revenue: number; closedCount: number; checkingInCustomers: string[]; waitingSchedule: Array<{ time: string; customer: string; staff: string }>; activeServiceBoard: Array<{ time: string; customer: string; staff: string; status: string; appointmentId: string }> } } | null = null;
const DASHBOARD_TTL = 20_000;

export async function getDashboardSnapshot(opts?: { force?: boolean }): Promise<{ appointmentsToday: number; waiting: number; active: number; revenue: number; closedCount: number; checkingInCustomers: string[]; waitingSchedule: Array<{ time: string; customer: string; staff: string }>; activeServiceBoard: Array<{ time: string; customer: string; staff: string; status: string; appointmentId: string }> }> {
  if (!supabase) throw new Error("Supabase chưa cấu hình");

  if (!opts?.force && dashboardCache && Date.now() - dashboardCache.at < DASHBOARD_TTL) {
    return {
      ...dashboardCache.value,
      activeServiceBoard: dashboardCache.value.activeServiceBoard ?? [],
      waitingSchedule: dashboardCache.value.waitingSchedule ?? [],
      checkingInCustomers: dashboardCache.value.checkingInCustomers ?? [],
    };
  }

  const { orgId } = await ensureOrgContext();
  const role = await getCurrentSessionRole();

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const fromIso = start.toISOString();
  const toIso = end.toISOString();

  const appointmentsRes = await supabase
    .from("appointments")
    .select("id,status,start_at,staff_user_id,customers(name)")
    .eq("org_id", orgId)
    .gte("start_at", fromIso)
    .lt("start_at", toIso);

  if (appointmentsRes.error) throw appointmentsRes.error;

  let tickets: Array<{ id: string; totals_json?: { grand_total?: number } | null }> = [];
  if (role !== "TECH") {
    const ticketsRes = await supabase
      .from("tickets")
      .select("id,totals_json")
      .eq("org_id", orgId)
      .eq("status", "CLOSED")
      .gte("created_at", fromIso)
      .lt("created_at", toIso);
    if (ticketsRes.error) throw ticketsRes.error;
    tickets = (ticketsRes.data ?? []) as typeof tickets;
  }

  let appointments = appointmentsRes.data ?? [];
  if (role === "TECH") {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    appointments = appointments.filter((a) => a.staff_user_id === userId);
  }

  const staffIds = [...new Set(appointments.map((a) => a.staff_user_id as string | null).filter((v): v is string => Boolean(v)))];
  let staffNameMap = new Map<string, string>();
  if (staffIds.length) {
    const { data: staffProfiles, error: staffErr } = await supabase
      .from("profiles")
      .select("user_id,display_name")
      .in("user_id", staffIds)
      .eq("org_id", orgId);
    if (staffErr) throw staffErr;
    staffNameMap = new Map((staffProfiles ?? []).map((p) => [p.user_id as string, ((p.display_name as string | null) || String(p.user_id).slice(0, 8))]));
  }

  const waitingRows = appointments.filter((a) => a.status === "BOOKED");
  const waiting = waitingRows.length;
  const checkingInRows = appointments.filter((a) => a.status === "CHECKED_IN");
  const active = checkingInRows.length;
  const checkingInCustomers = checkingInRows
    .map((a) => {
      const c = a.customers as { name?: string } | Array<{ name?: string }> | null | undefined;
      return Array.isArray(c) ? c[0]?.name : c?.name;
    })
    .filter((name): name is string => Boolean(name));

  const revenue = tickets.reduce((acc, t) => acc + Number((t.totals_json as { grand_total?: number } | null)?.grand_total ?? 0), 0);
  const count = tickets.length;

  const waitingSchedule = waitingRows.map((a) => {
    const c = a.customers as { name?: string } | Array<{ name?: string }> | null | undefined;
    const customer = (Array.isArray(c) ? c[0]?.name : c?.name) || "-";
    const staff = a.staff_user_id ? (staffNameMap.get(a.staff_user_id as string) ?? "-") : "-";
    return {
      time: new Date(a.start_at as string).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      customer,
      staff,
    };
  });

  const activeServiceBoard = checkingInRows.map((a) => {
    const c = a.customers as { name?: string } | Array<{ name?: string }> | null | undefined;
    const customer = (Array.isArray(c) ? c[0]?.name : c?.name) || "-";
    const staff = a.staff_user_id ? (staffNameMap.get(a.staff_user_id as string) ?? "-") : "-";
    return {
      time: new Date(a.start_at as string).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      customer,
      staff,
      status: String(a.status ?? "CHECKED_IN"),
      appointmentId: String(a.id ?? ""),
    };
  });

  const snapshot = {
    appointmentsToday: appointments.length,
    waiting,
    active,
    revenue,
    closedCount: count,
    checkingInCustomers,
    waitingSchedule,
    activeServiceBoard,
  };

  dashboardCache = { at: Date.now(), value: snapshot };
  return snapshot;
}

let revenueTrendCache: { at: number; value: Array<{ label: string; revenue: number; closedCount: number }> } | null = null;
const REVENUE_TREND_TTL = 60_000;

export async function getRevenueTrend7d(opts?: { force?: boolean }) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");

  if (!opts?.force && revenueTrendCache && Date.now() - revenueTrendCache.at < REVENUE_TREND_TTL) {
    return revenueTrendCache.value;
  }

  const { orgId } = await ensureOrgContext();

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from("tickets")
    .select("created_at,totals_json")
    .eq("org_id", orgId)
    .eq("status", "CLOSED")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .order("created_at", { ascending: true });

  if (error) throw error;

  const buckets = new Map<string, { revenue: number; closedCount: number }>();

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { revenue: 0, closedCount: 0 });
  }

  for (const row of data ?? []) {
    const key = String(row.created_at).slice(0, 10);
    const target = buckets.get(key);
    if (!target) continue;
    target.closedCount += 1;
    target.revenue += Number((row.totals_json as { grand_total?: number } | null)?.grand_total ?? 0);
  }

  const out = [...buckets.entries()].map(([isoDate, val]) => ({
    label: new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("vi-VN", { weekday: "short" }),
    revenue: val.revenue,
    closedCount: val.closedCount,
  }));

  revenueTrendCache = { at: Date.now(), value: out };
  return out;
}

export async function getReportBreakdown(fromIso: string, toIso: string) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  await ensureOrgContext();

  const { data, error } = await supabase.rpc("get_report_breakdown_secure", {
    p_from: fromIso,
    p_to: toIso,
  });

  if (error) throw error;
  return (data ?? {
    summary: { count: 0, subtotal: 0, vat: 0, revenue: 0 },
    by_service: [],
    by_payment: [],
  }) as {
    summary: { count: number; subtotal: number; vat: number; revenue: number };
    by_service: Array<{ service_name: string; qty: number; subtotal: number }>;
    by_payment: Array<{ method: string; count: number; amount: number }>;
  };
}

export async function listTimeEntriesInRange(fromIso: string, toIso: string) {
  if (!supabase) return [];
  const { orgId } = await ensureOrgContext();

  const { data, error } = await supabase
    .from("time_entries")
    .select("staff_user_id,effective_clock_in,effective_clock_out")
    .eq("org_id", orgId)
    .eq("approval_status", "APPROVED")
    .gte("clock_in", fromIso)
    .lt("clock_in", toIso)
    .order("clock_in", { ascending: false })
    .limit(500);

  if (error) throw error;
  return data ?? [];
}

export async function getStaffRevenueInRange(fromIso: string, toIso: string) {
  if (!supabase) return [];
  const { orgId } = await ensureOrgContext();

  const { data: tickets, error: ticketErr } = await supabase
    .from("tickets")
    .select("id,appointment_id,totals_json")
    .eq("org_id", orgId)
    .eq("status", "CLOSED")
    .gte("created_at", fromIso)
    .lt("created_at", toIso)
    .not("appointment_id", "is", null)
    .limit(500);
  if (ticketErr) throw ticketErr;

  const appointmentIds = [...new Set((tickets ?? []).map((t) => t.appointment_id as string | null).filter((v): v is string => Boolean(v)))];
  if (!appointmentIds.length) return [];

  const { data: appointments, error: apptErr } = await supabase
    .from("appointments")
    .select("id,staff_user_id")
    .eq("org_id", orgId)
    .in("id", appointmentIds);
  if (apptErr) throw apptErr;

  const teamRows = (await listUserRoles()) as Array<{ user_id: string; display_name?: string }>;
  const nameMap = new Map(teamRows.map((row) => [row.user_id, row.display_name || String(row.user_id).slice(0, 8)]));
  const apptMap = new Map((appointments ?? []).map((a) => [a.id as string, a.staff_user_id as string | null]));
  const totals = new Map<string, { staff: string; revenue: number; tickets: number }>();

  for (const ticket of (tickets ?? []) as Array<{ appointment_id?: string | null; totals_json?: { grand_total?: number } | null }>) {
    const staffUserId = ticket.appointment_id ? apptMap.get(ticket.appointment_id) : null;
    if (!staffUserId) continue;
    const prev = totals.get(staffUserId) ?? { staff: nameMap.get(staffUserId) ?? staffUserId, revenue: 0, tickets: 0 };
    prev.revenue += Number(ticket.totals_json?.grand_total ?? 0);
    prev.tickets += 1;
    totals.set(staffUserId, prev);
  }

  return Array.from(totals.entries()).map(([staffUserId, val]) => ({ staffUserId, staff: val.staff, revenue: val.revenue, tickets: val.tickets })).sort((a, b) => b.revenue - a.revenue);
}

export async function getTicketDetail(ticketId: string) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  await ensureOrgContext();

  const { data, error } = await supabase.rpc("get_ticket_detail_secure", {
    p_ticket_id: ticketId,
  });

  if (error) throw error;
  if (!data) throw new Error("Không có dữ liệu ticket");

  const payload = data as {
    ticket: { id: string; created_at: string; status: string; totals_json?: { subtotal?: number; vat_total?: number; grand_total?: number } };
    customer?: { name?: string; phone?: string };
    payment?: { method?: string; amount?: number; status?: string; created_at?: string };
    receipt?: { public_token?: string; expires_at?: string };
    items?: Array<{ qty: number; unit_price: number; vat_rate: number; service_name: string }>;
  };

  return {
    ticket: payload.ticket,
    customer: payload.customer ?? null,
    payment: payload.payment ?? null,
    receipt: payload.receipt ?? null,
    items: payload.items ?? [],
  };
}
