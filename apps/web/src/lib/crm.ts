import { ensureOrgContext } from "@/lib/domain";
import { supabase } from "@/lib/supabase";

export type CustomerStatus = "NEW" | "ACTIVE" | "RETURNING" | "VIP" | "AT_RISK" | "LOST";
export type FollowUpStatus = "PENDING" | "DONE" | "SKIPPED";
export type CustomerActivityType =
  | "BOOKING_REQUEST"
  | "APPOINTMENT"
  | "CHECKOUT"
  | "FOLLOW_UP_NOTE"
  | "TELEGRAM_CONTACT";

export type CustomerCrmSummary = {
  id: string;
  org_id?: string;
  full_name: string;
  phone: string | null;
  birthday: string | null;
  gender: string | null;
  first_visit_at: string | null;
  last_visit_at: string | null;
  total_visits: number;
  total_spend: number;
  last_service_summary: string | null;
  favorite_staff_user_id: string | null;
  customer_status: CustomerStatus;
  tags: string[];
  care_note: string | null;
  source: string | null;
  next_follow_up_at: string | null;
  last_contacted_at: string | null;
  follow_up_status: FollowUpStatus;
  needs_merge_review: boolean;
  dormant_days: number | null;
};

export type CustomerTimelineActivity = {
  id: string;
  customer_id: string;
  type: CustomerActivityType;
  channel: string | null;
  content_summary: string;
  created_by: string | null;
  created_at: string;
};

export type CustomerAppointmentSummary = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  staff_user_id: string | null;
  resource_id: string | null;
};

export type CustomerTicketSummary = {
  id: string;
  status: string;
  created_at: string;
  appointment_id: string | null;
  totals_json?: {
    subtotal?: number;
    vat_total?: number;
    grand_total?: number;
  } | null;
  receipts?: Array<{ public_token?: string; expires_at?: string }>;
};

export type CustomerBookingSummary = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  requested_service: string | null;
  requested_start_at: string;
  requested_end_at: string;
  source: string | null;
  status: string;
  created_at: string;
};

export type CustomerCrmDetail = {
  customer: CustomerCrmSummary;
  appointments: CustomerAppointmentSummary[];
  tickets: CustomerTicketSummary[];
  bookingRequests: CustomerBookingSummary[];
  activities: CustomerTimelineActivity[];
};

type CustomerCrmFilters = {
  search?: string;
  status?: CustomerStatus | "ALL";
  dormantDays?: number | null;
  vipOnly?: boolean;
  source?: string | "ALL";
};

function normalizePhone(raw: string | null | undefined) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("84") && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

function daysBetweenIso(iso: string | null | undefined) {
  if (!iso) return null;
  const value = new Date(iso).getTime();
  if (Number.isNaN(value)) return null;
  return Math.max(0, Math.floor((Date.now() - value) / 86400000));
}

function inferStatus(row: Partial<CustomerCrmSummary>): CustomerStatus {
  if (row.customer_status) return row.customer_status;

  const totalVisits = Number(row.total_visits ?? 0);
  const totalSpend = Number(row.total_spend ?? 0);
  const dormantDays = daysBetweenIso(row.last_visit_at);

  if (totalSpend >= 3_000_000 || totalVisits >= 8) return "VIP";
  if (dormantDays !== null && dormantDays >= 60) return "LOST";
  if (dormantDays !== null && dormantDays >= 30) return "AT_RISK";
  if (totalVisits >= 3) return "RETURNING";
  if (totalVisits >= 1) return "ACTIVE";
  return "NEW";
}

function parseCustomerRow(row: Record<string, unknown>): CustomerCrmSummary {
  const phone = normalizePhone((row.phone as string | null | undefined) ?? null);
  const lastVisitAt = (row.last_visit_at as string | null | undefined) ?? null;

  return {
    id: String(row.id ?? ""),
    org_id: typeof row.org_id === "string" ? row.org_id : undefined,
    full_name: String(row.full_name ?? row.name ?? "-"),
    phone,
    birthday: typeof row.birthday === "string" ? row.birthday : null,
    gender: typeof row.gender === "string" ? row.gender : null,
    first_visit_at: typeof row.first_visit_at === "string" ? row.first_visit_at : null,
    last_visit_at: lastVisitAt,
    total_visits: Number(row.total_visits ?? 0),
    total_spend: Number(row.total_spend ?? 0),
    last_service_summary:
      typeof row.last_service_summary === "string" ? row.last_service_summary : null,
    favorite_staff_user_id:
      typeof row.favorite_staff_user_id === "string" ? row.favorite_staff_user_id : null,
    customer_status: inferStatus({
      customer_status:
        typeof row.customer_status === "string" ? (row.customer_status as CustomerStatus) : undefined,
      total_visits: Number(row.total_visits ?? 0),
      total_spend: Number(row.total_spend ?? 0),
      last_visit_at: lastVisitAt,
    }),
    tags: Array.isArray(row.tags) ? row.tags.map((item) => String(item)) : [],
    care_note:
      typeof row.care_note === "string" ? row.care_note : typeof row.notes === "string" ? row.notes : null,
    source: typeof row.source === "string" ? row.source : null,
    next_follow_up_at:
      typeof row.next_follow_up_at === "string" ? row.next_follow_up_at : null,
    last_contacted_at:
      typeof row.last_contacted_at === "string" ? row.last_contacted_at : null,
    follow_up_status:
      typeof row.follow_up_status === "string"
        ? (row.follow_up_status as FollowUpStatus)
        : "PENDING",
    needs_merge_review: Boolean(row.needs_merge_review),
    dormant_days: daysBetweenIso(lastVisitAt),
  };
}

function parseCustomerBranchRow(row: Record<string, unknown>): CustomerCrmSummary {
  const nestedCustomer = Array.isArray(row.customers)
    ? row.customers[0]
    : row.customers && typeof row.customers === "object"
      ? row.customers
      : null;
  const customer =
    nestedCustomer && typeof nestedCustomer === "object"
      ? (nestedCustomer as Record<string, unknown>)
      : {};

  return parseCustomerRow({
    ...customer,
    id: customer.id ?? row.customer_id ?? row.id,
    org_id: row.org_id ?? customer.org_id,
    last_visit_at: row.last_seen_at ?? customer.last_visit_at,
    total_visits: row.total_visits ?? customer.total_visits,
    total_spend: row.total_spend ?? customer.total_spend,
    favorite_staff_user_id: row.favorite_staff_user_id ?? customer.favorite_staff_user_id,
    customer_status: row.customer_status ?? customer.customer_status,
    tags: row.tags ?? customer.tags,
    care_note: row.care_note ?? row.notes ?? customer.care_note ?? customer.notes,
    source: row.source ?? customer.source,
    next_follow_up_at: row.next_follow_up_at ?? customer.next_follow_up_at,
    last_contacted_at: row.last_contacted_at ?? customer.last_contacted_at,
    follow_up_status: row.follow_up_status ?? customer.follow_up_status,
    needs_merge_review: row.needs_merge_review ?? customer.needs_merge_review,
    last_service_summary: customer.last_service_summary ?? row.last_service_summary,
  });
}

function customerSortScore(row: CustomerCrmSummary) {
  const lastVisitMs = row.last_visit_at ? new Date(row.last_visit_at).getTime() : 0;
  return {
    lastVisitMs: Number.isFinite(lastVisitMs) ? lastVisitMs : 0,
    totalVisits: row.total_visits,
    totalSpend: row.total_spend,
  };
}

function dedupeCustomerRows(rows: CustomerCrmSummary[]): CustomerCrmSummary[] {
  const grouped = new Map<string, CustomerCrmSummary>();

  for (const row of rows) {
    const existing = grouped.get(row.id);
    if (!existing) {
      grouped.set(row.id, row);
      continue;
    }

    const left = customerSortScore(existing);
    const right = customerSortScore(row);
    const keepIncoming =
      right.lastVisitMs > left.lastVisitMs ||
      (right.lastVisitMs === left.lastVisitMs && right.totalVisits > left.totalVisits) ||
      (right.lastVisitMs === left.lastVisitMs &&
        right.totalVisits === left.totalVisits &&
        right.totalSpend > left.totalSpend);

    const primary = keepIncoming ? row : existing;
    const secondary = keepIncoming ? existing : row;

    grouped.set(row.id, {
      ...primary,
      tags: [...new Set([...primary.tags, ...secondary.tags])],
      care_note: primary.care_note ?? secondary.care_note,
      source: primary.source ?? secondary.source,
      next_follow_up_at: primary.next_follow_up_at ?? secondary.next_follow_up_at,
      last_contacted_at: primary.last_contacted_at ?? secondary.last_contacted_at,
      last_service_summary: primary.last_service_summary ?? secondary.last_service_summary,
      needs_merge_review: primary.needs_merge_review || secondary.needs_merge_review,
    });
  }

  return Array.from(grouped.values());
}

async function selectCustomersBase() {
  if (!supabase) throw new Error("Supabase chua cau hinh");
  const { orgId, branchId } = await ensureOrgContext();

  let query = supabase
    .from("customer_branches")
    .select(
      "customer_id,org_id,branch_id,first_seen_at,last_seen_at,total_visits,total_spend,customer_status,favorite_staff_user_id,care_note,tags,source,next_follow_up_at,last_contacted_at,follow_up_status,customers!inner(id,org_id,full_name,name,phone,birthday,gender,first_visit_at,last_visit_at,last_service_summary,needs_merge_review)",
    )
    .eq("org_id", orgId)
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  return query;
}

export async function listCustomersCrm(filters: CustomerCrmFilters = {}): Promise<CustomerCrmSummary[]> {
  if (!supabase) return [];
  const { branchId } = await ensureOrgContext();

  const rpc = await supabase.rpc("list_customers_crm", {
    p_search: filters.search?.trim() || null,
    p_status: filters.status && filters.status !== "ALL" ? filters.status : null,
    p_dormant_days: filters.dormantDays ?? null,
    p_vip_only: Boolean(filters.vipOnly),
    p_source: filters.source && filters.source !== "ALL" ? filters.source : null,
    p_branch_id: branchId,
  });

  if (!rpc.error && Array.isArray(rpc.data)) {
    return dedupeCustomerRows(rpc.data.map((row) => parseCustomerRow(row as Record<string, unknown>)));
  }

  const { data, error } = await selectCustomersBase();
  if (error) throw error;

  let rows = (data ?? []).map((row) => parseCustomerBranchRow(row as Record<string, unknown>));

  if (filters.search?.trim()) {
    const query = filters.search.trim().toLowerCase();
    rows = rows.filter(
      (row) =>
        row.full_name.toLowerCase().includes(query) ||
        (row.phone ?? "").includes(normalizePhone(query) ?? query),
    );
  }

  if (filters.status && filters.status !== "ALL") {
    rows = rows.filter((row) => row.customer_status === filters.status);
  }

  if (filters.source && filters.source !== "ALL") {
    rows = rows.filter((row) => row.source === filters.source);
  }

  if (filters.vipOnly) {
    rows = rows.filter((row) => row.customer_status === "VIP");
  }

  if (filters.dormantDays != null) {
    const minimumDormantDays = filters.dormantDays;
    rows = rows.filter((row) => (row.dormant_days ?? -1) >= minimumDormantDays);
  }

  return dedupeCustomerRows(rows);
}

export async function listCustomerCardsByPhones(phones: Array<string | null | undefined>) {
  if (!supabase) return [];
  const normalized = [
    ...new Set(
      phones.map((item) => normalizePhone(item)).filter((item): item is string => Boolean(item)),
    ),
  ];
  if (!normalized.length) return [];

  const rows = await listCustomersCrm();
  return rows.filter((row) => {
    const phone = normalizePhone(row.phone);
    return phone ? normalized.includes(phone) : false;
  });
}

export async function getCustomerCrmDetail(customerId: string): Promise<CustomerCrmDetail> {
  if (!supabase) throw new Error("Supabase chua cau hinh");

  const rpc = await supabase.rpc("get_customer_crm_detail", {
    p_customer_id: customerId,
  });

  if (!rpc.error && rpc.data) {
    const payload = rpc.data as {
      customer: Record<string, unknown>;
      appointments?: CustomerAppointmentSummary[];
      tickets?: CustomerTicketSummary[];
      booking_requests?: CustomerBookingSummary[];
      activities?: CustomerTimelineActivity[];
    };

    return {
      customer: parseCustomerRow(payload.customer),
      appointments: payload.appointments ?? [],
      tickets: payload.tickets ?? [],
      bookingRequests: payload.booking_requests ?? [],
      activities: payload.activities ?? [],
    };
  }

  const { orgId, branchId } = await ensureOrgContext();

  let customerQuery = supabase
    .from("customer_branches")
    .select(
      "customer_id,org_id,branch_id,first_seen_at,last_seen_at,total_visits,total_spend,customer_status,favorite_staff_user_id,care_note,tags,source,next_follow_up_at,last_contacted_at,follow_up_status,customers!inner(id,org_id,full_name,name,phone,birthday,gender,first_visit_at,last_visit_at,last_service_summary,needs_merge_review)",
    )
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(1);

  if (branchId) {
    customerQuery = customerQuery.eq("branch_id", branchId);
  }

  const customerRes = await customerQuery;
  if (customerRes.error) throw customerRes.error;

  const customerRow = Array.isArray(customerRes.data) ? customerRes.data[0] : null;
  if (!customerRow) throw new Error("Khong tim thay khach hang");
  const customer = parseCustomerBranchRow(customerRow as Record<string, unknown>);

  const appointmentsRes = await supabase
    .from("appointments")
    .select("id,start_at,end_at,status,staff_user_id,resource_id")
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .order("start_at", { ascending: false })
    .limit(50);
  if (appointmentsRes.error) throw appointmentsRes.error;

  const ticketsRes = await supabase
    .from("tickets")
    .select("id,status,created_at,appointment_id,totals_json,receipts(public_token,expires_at)")
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (ticketsRes.error) throw ticketsRes.error;

  let bookingQuery = supabase
    .from("booking_requests")
    .select(
      "id,customer_name,customer_phone,requested_service,requested_start_at,requested_end_at,source,status,created_at",
    )
    .eq("org_id", orgId)
    .or(`customer_phone.eq.${customer.phone ?? ""},customer_name.eq.${customer.full_name}`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (branchId) {
    bookingQuery = bookingQuery.eq("branch_id", branchId);
  }

  const bookingRes = await bookingQuery;

  const activityRes = await supabase
    .from("customer_activities")
    .select("id,customer_id,type,channel,content_summary,created_by,created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(80);

  return {
    customer,
    appointments: (appointmentsRes.data ?? []) as CustomerAppointmentSummary[],
    tickets: (ticketsRes.data ?? []) as CustomerTicketSummary[],
    bookingRequests: bookingRes.error ? [] : ((bookingRes.data ?? []) as CustomerBookingSummary[]),
    activities: activityRes.error ? [] : ((activityRes.data ?? []) as CustomerTimelineActivity[]),
  };
}

export async function updateCustomerCareNote(input: {
  customerId: string;
  careNote: string;
  tags: string[];
  nextFollowUpAt?: string | null;
  followUpStatus?: FollowUpStatus;
}) {
  if (!supabase) throw new Error("Supabase chua cau hinh");

  const rpc = await supabase.rpc("update_customer_care_note", {
    p_customer_id: input.customerId,
    p_care_note: input.careNote || null,
    p_tags: input.tags,
    p_next_follow_up_at: input.nextFollowUpAt ?? null,
    p_follow_up_status: input.followUpStatus ?? "PENDING",
  });

  if (!rpc.error) return rpc.data;

  const { orgId, branchId } = await ensureOrgContext();
  if (!branchId) {
    throw new Error("Khong xac dinh duoc branch hien tai de cap nhat CRM.");
  }

  const update = await supabase.from("customer_branches").upsert(
    {
      customer_id: input.customerId,
      org_id: orgId,
      branch_id: branchId,
      care_note: input.careNote || null,
      tags: input.tags,
      next_follow_up_at: input.nextFollowUpAt ?? null,
      follow_up_status: input.followUpStatus ?? "PENDING",
      last_contacted_at: new Date().toISOString(),
    },
    {
      onConflict: "customer_id,branch_id",
    },
  );

  if (update.error) throw update.error;

  try {
    await supabase.from("customer_activities").insert({
      customer_id: input.customerId,
      type: "FOLLOW_UP_NOTE",
      channel: "MANUAL",
      content_summary: input.careNote || "Cap nhat ghi chu cham soc",
    });
  } catch {}
}

export async function listFollowUpCandidates(range?: { fromIso?: string | null; toIso?: string | null }) {
  if (!supabase) return [];
  const { branchId } = await ensureOrgContext();

  const rpc = await supabase.rpc("list_follow_up_candidates", {
    p_from: range?.fromIso ?? null,
    p_to: range?.toIso ?? null,
    p_branch_id: branchId,
  });

  if (!rpc.error && Array.isArray(rpc.data)) {
    return rpc.data.map((row) => parseCustomerRow(row as Record<string, unknown>));
  }

  const rows = await listCustomersCrm();
  return rows.filter((row) => {
    if (!row.next_follow_up_at) return false;
    const time = new Date(row.next_follow_up_at).getTime();
    if (Number.isNaN(time)) return false;
    if (range?.fromIso && time < new Date(range.fromIso).getTime()) return false;
    if (range?.toIso && time > new Date(range.toIso).getTime()) return false;
    return row.follow_up_status !== "DONE";
  });
}

export async function getCrmDashboardMetrics() {
  const customers = await listCustomersCrm();
  const todayKey = new Date().toISOString().slice(0, 10);

  const newToday = customers.filter((row) => row.first_visit_at?.slice(0, 10) === todayKey).length;
  const returningToday = customers.filter(
    (row) => row.last_visit_at?.slice(0, 10) === todayKey && (row.total_visits ?? 0) > 1,
  ).length;
  const atRiskCount = customers.filter(
    (row) => row.customer_status === "AT_RISK" || row.customer_status === "LOST",
  ).length;
  const repeat30 = customers.length
    ? Math.round(
        (customers.filter((row) => (row.total_visits ?? 0) > 1 && (row.dormant_days ?? 9999) <= 30)
          .length /
          customers.length) *
          100,
      )
    : 0;

  return {
    newToday,
    returningToday,
    atRiskCount,
    repeat30,
  };
}
