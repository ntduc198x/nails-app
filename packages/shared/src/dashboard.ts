import type { SharedSupabaseClient } from "./org";
import { ensureOrgContext } from "./org";
import { getAuthenticatedUserSummary } from "./session";

export type MobileDashboardSnapshot = {
  appointmentsToday: number;
  waiting: number;
  active: number;
  revenue: number;
  closedCount: number;
  checkingInCustomers: string[];
  waitingSchedule: Array<{ time: string; customer: string; staff: string }>;
  activeServiceBoard: Array<{ time: string; customer: string; staff: string; status: string; appointmentId: string }>;
};

export async function getDashboardSnapshotForMobile(
  client: SharedSupabaseClient,
): Promise<MobileDashboardSnapshot> {
  const { orgId } = await ensureOrgContext(client);
  const authUser = await getAuthenticatedUserSummary(client);

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const fromIso = start.toISOString();
  const toIso = end.toISOString();

  const appointmentsRes = await client
    .from("appointments")
    .select("id,status,start_at,staff_user_id,customers(name)")
    .eq("org_id", orgId)
    .gte("start_at", fromIso)
    .lt("start_at", toIso);

  if (appointmentsRes.error) {
    throw appointmentsRes.error;
  }

  let appointments = appointmentsRes.data ?? [];
  if (authUser?.role === "TECH") {
    appointments = appointments.filter((row) => row.staff_user_id === authUser.id);
  }

  const staffIds = [
    ...new Set(
      appointments
        .map((appointment) => (typeof appointment.staff_user_id === "string" ? appointment.staff_user_id : null))
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  let staffNameMap = new Map<string, string>();
  if (staffIds.length > 0) {
    const { data: profiles, error: profilesError } = await client
      .from("profiles")
      .select("user_id,display_name")
      .in("user_id", staffIds)
      .eq("org_id", orgId);

    if (profilesError) {
      throw profilesError;
    }

    staffNameMap = new Map(
      (profiles ?? []).map((profile) => [
        String(profile.user_id),
        typeof profile.display_name === "string" && profile.display_name.trim().length > 0
          ? profile.display_name
          : String(profile.user_id).slice(0, 8),
      ]),
    );
  }

  let tickets: Array<{ id: string; totals_json?: { grand_total?: number } | null }> = [];
  if (authUser?.role !== "TECH") {
    const ticketsRes = await client
      .from("tickets")
      .select("id,totals_json")
      .eq("org_id", orgId)
      .eq("status", "CLOSED")
      .gte("created_at", fromIso)
      .lt("created_at", toIso);

    if (ticketsRes.error) {
      throw ticketsRes.error;
    }

    tickets = (ticketsRes.data ?? []) as typeof tickets;
  }

  const waitingRows = appointments.filter((row) => row.status === "BOOKED");
  const checkingInRows = appointments.filter((row) => row.status === "CHECKED_IN");

  const checkingInCustomers = checkingInRows
    .map((row) => {
      const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
      return typeof customer?.name === "string" ? customer.name : null;
    })
    .filter((value): value is string => Boolean(value));

  const revenue = tickets.reduce((sum, ticket) => sum + Number(ticket.totals_json?.grand_total ?? 0), 0);

  return {
    appointmentsToday: appointments.length,
    waiting: waitingRows.length,
    active: checkingInRows.length,
    revenue,
    closedCount: tickets.length,
    checkingInCustomers,
    waitingSchedule: waitingRows.map((row) => {
      const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
      const staff = typeof row.staff_user_id === "string" ? (staffNameMap.get(row.staff_user_id) ?? "-") : "-";
      return {
        time: new Date(String(row.start_at)).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        customer: typeof customer?.name === "string" ? customer.name : "-",
        staff,
      };
    }),
    activeServiceBoard: checkingInRows.map((row) => {
      const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
      const staff = typeof row.staff_user_id === "string" ? (staffNameMap.get(row.staff_user_id) ?? "-") : "-";
      return {
        time: new Date(String(row.start_at)).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        customer: typeof customer?.name === "string" ? customer.name : "-",
        staff,
        status: String(row.status ?? ""),
        appointmentId: String(row.id ?? ""),
      };
    }),
  };
}
