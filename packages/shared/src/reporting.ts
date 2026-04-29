import type { SharedSupabaseClient } from "./org";
import { ensureOrgContext } from "./org";

export type MobileReportTicketRow = {
  id: string;
  status: string;
  createdAt: string;
  appointmentId: string | null;
  staffUserId: string | null;
  customerName: string | null;
  receiptToken: string | null;
  subtotal: number;
  vat: number;
  grandTotal: number;
};

export type MobileReportBreakdown = {
  summary: { count: number; subtotal: number; vat: number; revenue: number };
  byService: Array<{ serviceName: string; qty: number; subtotal: number }>;
  byPayment: Array<{ method: string; count: number; amount: number }>;
};

export type MobileStaffRevenueRow = {
  staffUserId: string;
  staff: string;
  revenue: number;
  tickets: number;
};

export type MobileStaffHoursRow = {
  staffUserId: string;
  staff: string;
  minutes: number;
  entries: number;
};

export type MobileReportStaffOption = {
  userId: string;
  name: string;
};

export type MobileTicketDetail = {
  ticket: {
    id: string;
    createdAt: string;
    status: string;
    subtotal: number;
    vat: number;
    grandTotal: number;
  };
  customer: { name: string | null; phone: string | null } | null;
  payment: { method: string | null; amount: number; status: string | null; createdAt: string | null } | null;
  receipt: { publicToken: string | null; expiresAt: string | null } | null;
  items: Array<{ qty: number; unitPrice: number; vatRate: number; serviceName: string }>;
};

export async function listTicketsInRangeForMobile(
  client: SharedSupabaseClient,
  fromIso: string,
  toIso: string,
): Promise<MobileReportTicketRow[]> {
  const { orgId } = await ensureOrgContext(client);

  const { data, error } = await client
    .from("tickets")
    .select("id,status,created_at,appointment_id,totals_json,customers(name),receipts(public_token)")
    .eq("org_id", orgId)
    .gte("created_at", fromIso)
    .lt("created_at", toIso)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw error;
  }

  const baseRows = (data ?? []).map((row) => {
    const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
    const receipt = Array.isArray(row.receipts) ? row.receipts[0] : row.receipts;
    const totals = (row.totals_json as { subtotal?: number; vat_total?: number; grand_total?: number } | null) ?? null;

    return {
      id: String(row.id ?? ""),
      status: String(row.status ?? ""),
      createdAt: String(row.created_at ?? ""),
      appointmentId: typeof row.appointment_id === "string" ? row.appointment_id : null,
      staffUserId: null,
      customerName: typeof customer?.name === "string" ? customer.name : null,
      receiptToken: typeof receipt?.public_token === "string" ? receipt.public_token : null,
      subtotal: Number(totals?.subtotal ?? 0),
      vat: Number(totals?.vat_total ?? 0),
      grandTotal: Number(totals?.grand_total ?? 0),
    } satisfies MobileReportTicketRow;
  });

  const appointmentIds = [
    ...new Set(baseRows.map((row) => row.appointmentId).filter((value): value is string => Boolean(value))),
  ];
  if (!appointmentIds.length) {
    return baseRows;
  }

  const { data: appointments, error: appointmentErr } = await client
    .from("appointments")
    .select("id,staff_user_id")
    .eq("org_id", orgId)
    .in("id", appointmentIds);

  if (appointmentErr) {
    throw appointmentErr;
  }

  const appointmentMap = new Map(
    (appointments ?? []).map((row) => [
      String(row.id ?? ""),
      typeof row.staff_user_id === "string" ? row.staff_user_id : null,
    ]),
  );

  return baseRows.map((row) => ({
    ...row,
    staffUserId: row.appointmentId ? (appointmentMap.get(row.appointmentId) ?? null) : null,
  }));
}

export async function getReportBreakdownForMobile(
  client: SharedSupabaseClient,
  fromIso: string,
  toIso: string,
): Promise<MobileReportBreakdown> {
  await ensureOrgContext(client);

  const { data, error } = await client.rpc("get_report_breakdown_secure", {
    p_from: fromIso,
    p_to: toIso,
  });

  if (error) {
    throw error;
  }

  const payload = (data ?? {
    summary: { count: 0, subtotal: 0, vat: 0, revenue: 0 },
    by_service: [],
    by_payment: [],
  }) as {
    summary?: { count?: number; subtotal?: number; vat?: number; revenue?: number };
    by_service?: Array<{ service_name?: string; qty?: number; subtotal?: number }>;
    by_payment?: Array<{ method?: string; count?: number; amount?: number }>;
  };

  return {
    summary: {
      count: Number(payload.summary?.count ?? 0),
      subtotal: Number(payload.summary?.subtotal ?? 0),
      vat: Number(payload.summary?.vat ?? 0),
      revenue: Number(payload.summary?.revenue ?? 0),
    },
    byService: (payload.by_service ?? []).map((row) => ({
      serviceName: String(row.service_name ?? "-"),
      qty: Number(row.qty ?? 0),
      subtotal: Number(row.subtotal ?? 0),
    })),
    byPayment: (payload.by_payment ?? []).map((row) => ({
      method: String(row.method ?? "Khác"),
      count: Number(row.count ?? 0),
      amount: Number(row.amount ?? 0),
    })),
  };
}

export async function listTimeEntriesInRangeForMobile(
  client: SharedSupabaseClient,
  fromIso: string,
  toIso: string,
) {
  const { orgId } = await ensureOrgContext(client);

  const { data, error } = await client
    .from("time_entries")
    .select("staff_user_id,effective_clock_in,effective_clock_out")
    .eq("org_id", orgId)
    .eq("approval_status", "APPROVED")
    .gte("clock_in", fromIso)
    .lt("clock_in", toIso)
    .order("clock_in", { ascending: false })
    .limit(500);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function listStaffNameMap(client: SharedSupabaseClient, orgId: string, staffUserIds: string[]) {
  if (!staffUserIds.length) {
    return new Map<string, string>();
  }

  const { data: profiles, error: profilesError } = await client
    .from("profiles")
    .select("user_id,display_name")
    .eq("org_id", orgId)
    .in("user_id", staffUserIds);

  if (profilesError) {
    throw profilesError;
  }

  return new Map(
    (profiles ?? []).map((profile) => [
      String(profile.user_id),
      typeof profile.display_name === "string" && profile.display_name.trim().length > 0
        ? profile.display_name.trim()
        : String(profile.user_id).slice(0, 8),
    ]),
  );
}

export async function listReportStaffOptionsForMobile(
  client: SharedSupabaseClient,
): Promise<MobileReportStaffOption[]> {
  const { orgId } = await ensureOrgContext(client);

  const { data: roleRows, error: roleErr } = await client
    .from("user_roles")
    .select("user_id,role")
    .eq("org_id", orgId)
    .neq("role", "OWNER");

  if (roleErr) {
    throw roleErr;
  }

  const staffUserIds = [
    ...new Set(
      (roleRows ?? [])
        .map((row) => (typeof row.user_id === "string" ? row.user_id : ""))
        .filter(Boolean),
    ),
  ];
  const nameMap = await listStaffNameMap(client, orgId, staffUserIds);

  return staffUserIds
    .map((userId) => ({
      userId,
      name: nameMap.get(userId) ?? userId.slice(0, 8),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

export async function getStaffRevenueInRangeForMobile(
  client: SharedSupabaseClient,
  fromIso: string,
  toIso: string,
): Promise<MobileStaffRevenueRow[]> {
  const { orgId } = await ensureOrgContext(client);

  const { data: tickets, error: ticketErr } = await client
    .from("tickets")
    .select("id,appointment_id,totals_json")
    .eq("org_id", orgId)
    .eq("status", "CLOSED")
    .gte("created_at", fromIso)
    .lt("created_at", toIso)
    .not("appointment_id", "is", null)
    .limit(500);

  if (ticketErr) {
    throw ticketErr;
  }

  const appointmentIds = [
    ...new Set(
      (tickets ?? [])
        .map((ticket) => (typeof ticket.appointment_id === "string" ? ticket.appointment_id : ""))
        .filter(Boolean),
    ),
  ];
  if (!appointmentIds.length) {
    return [];
  }

  const { data: appointments, error: apptErr } = await client
    .from("appointments")
    .select("id,staff_user_id")
    .eq("org_id", orgId)
    .in("id", appointmentIds);

  if (apptErr) {
    throw apptErr;
  }

  const staffUserIds = [
    ...new Set(
      (appointments ?? [])
        .map((row) => (typeof row.staff_user_id === "string" ? row.staff_user_id : ""))
        .filter(Boolean),
    ),
  ];
  const nameMap = await listStaffNameMap(client, orgId, staffUserIds);
  const appointmentMap = new Map(
    (appointments ?? []).map((row) => [
      String(row.id ?? ""),
      typeof row.staff_user_id === "string" ? row.staff_user_id : null,
    ]),
  );
  const totals = new Map<string, { revenue: number; tickets: number }>();

  for (const ticket of (tickets ?? []) as Array<{ appointment_id?: string | null; totals_json?: { grand_total?: number } | null }>) {
    const staffUserId = ticket.appointment_id ? (appointmentMap.get(ticket.appointment_id) ?? null) : null;
    if (!staffUserId) {
      continue;
    }

    const previous = totals.get(staffUserId) ?? { revenue: 0, tickets: 0 };
    previous.revenue += Number(ticket.totals_json?.grand_total ?? 0);
    previous.tickets += 1;
    totals.set(staffUserId, previous);
  }

  return Array.from(totals.entries())
    .map(([staffUserId, value]) => ({
      staffUserId,
      staff: nameMap.get(staffUserId) ?? staffUserId.slice(0, 8),
      revenue: value.revenue,
      tickets: value.tickets,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export async function getStaffHoursInRangeForMobile(
  client: SharedSupabaseClient,
  fromIso: string,
  toIso: string,
): Promise<MobileStaffHoursRow[]> {
  await ensureOrgContext(client);
  const [entries, staffOptions] = await Promise.all([
    listTimeEntriesInRangeForMobile(client, fromIso, toIso),
    listReportStaffOptionsForMobile(client),
  ]);

  const allowedStaffIds = new Set(staffOptions.map((row) => row.userId));
  const nameMap = new Map(staffOptions.map((row) => [row.userId, row.name]));
  const totals = new Map<string, { minutes: number; entries: number }>();

  for (const row of entries as Array<{ staff_user_id?: string | null; effective_clock_in?: string | null; effective_clock_out?: string | null }>) {
    const staffUserId = typeof row.staff_user_id === "string" ? row.staff_user_id : null;
    if (!staffUserId || !allowedStaffIds.has(staffUserId)) {
      continue;
    }

    const startedAt = typeof row.effective_clock_in === "string" ? new Date(row.effective_clock_in).getTime() : NaN;
    const endedAt = typeof row.effective_clock_out === "string" ? new Date(row.effective_clock_out).getTime() : Date.now();
    if (Number.isNaN(startedAt) || Number.isNaN(endedAt)) {
      continue;
    }

    const minutes = Math.max(0, Math.round((endedAt - startedAt) / 60000));
    const previous = totals.get(staffUserId) ?? { minutes: 0, entries: 0 };
    previous.minutes += minutes;
    previous.entries += 1;
    totals.set(staffUserId, previous);
  }

  return Array.from(totals.entries())
    .map(([staffUserId, value]) => ({
      staffUserId,
      staff: nameMap.get(staffUserId) ?? staffUserId.slice(0, 8),
      minutes: value.minutes,
      entries: value.entries,
    }))
    .sort((a, b) => b.minutes - a.minutes);
}

export async function getTicketDetailForMobile(
  client: SharedSupabaseClient,
  ticketId: string,
): Promise<MobileTicketDetail> {
  await ensureOrgContext(client);

  const { data, error } = await client.rpc("get_ticket_detail_secure", {
    p_ticket_id: ticketId,
  });

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("Không có dữ liệu ticket");
  }

  const payload = data as {
    ticket?: { id?: string; created_at?: string; status?: string; totals_json?: { subtotal?: number; vat_total?: number; grand_total?: number } | null };
    customer?: { name?: string | null; phone?: string | null } | null;
    payment?: { method?: string | null; amount?: number | null; status?: string | null; created_at?: string | null } | null;
    receipt?: { public_token?: string | null; expires_at?: string | null } | null;
    items?: Array<{ qty?: number | null; unit_price?: number | null; vat_rate?: number | null; service_name?: string | null }>;
  };

  return {
    ticket: {
      id: String(payload.ticket?.id ?? ""),
      createdAt: String(payload.ticket?.created_at ?? ""),
      status: String(payload.ticket?.status ?? ""),
      subtotal: Number(payload.ticket?.totals_json?.subtotal ?? 0),
      vat: Number(payload.ticket?.totals_json?.vat_total ?? 0),
      grandTotal: Number(payload.ticket?.totals_json?.grand_total ?? 0),
    },
    customer: payload.customer
      ? {
          name: typeof payload.customer.name === "string" ? payload.customer.name : null,
          phone: typeof payload.customer.phone === "string" ? payload.customer.phone : null,
        }
      : null,
    payment: payload.payment
      ? {
          method: typeof payload.payment.method === "string" ? payload.payment.method : null,
          amount: Number(payload.payment.amount ?? 0),
          status: typeof payload.payment.status === "string" ? payload.payment.status : null,
          createdAt: typeof payload.payment.created_at === "string" ? payload.payment.created_at : null,
        }
      : null,
    receipt: payload.receipt
      ? {
          publicToken: typeof payload.receipt.public_token === "string" ? payload.receipt.public_token : null,
          expiresAt: typeof payload.receipt.expires_at === "string" ? payload.receipt.expires_at : null,
        }
      : null,
    items: (payload.items ?? []).map((item) => ({
      qty: Number(item.qty ?? 0),
      unitPrice: Number(item.unit_price ?? 0),
      vatRate: Number(item.vat_rate ?? 0),
      serviceName: typeof item.service_name === "string" ? item.service_name : "Dịch vụ",
    })),
  };
}
