import type { SharedSupabaseClient } from "./org";
import { ensureOrgContext } from "./org";

export type CustomerStatus = "NEW" | "ACTIVE" | "RETURNING" | "VIP" | "AT_RISK" | "LOST";
export type FollowUpStatus = "PENDING" | "DONE" | "SKIPPED";

export type CustomerCrmSummary = {
  id: string;
  orgId?: string;
  fullName: string;
  phone: string | null;
  birthday: string | null;
  gender: string | null;
  firstVisitAt: string | null;
  lastVisitAt: string | null;
  totalVisits: number;
  totalSpend: number;
  lastServiceSummary: string | null;
  favoriteStaffUserId: string | null;
  customerStatus: CustomerStatus;
  tags: string[];
  careNote: string | null;
  source: string | null;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  followUpStatus: FollowUpStatus;
  needsMergeReview: boolean;
  dormantDays: number | null;
};

export type CrmDashboardMetrics = {
  newToday: number;
  returningToday: number;
  atRiskCount: number;
  repeat30: number;
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

function inferStatus(row: {
  customerStatus?: CustomerStatus | null;
  totalVisits: number;
  totalSpend: number;
  lastVisitAt: string | null;
}): CustomerStatus {
  if (row.customerStatus) {
    return row.customerStatus;
  }

  const dormantDays = daysBetweenIso(row.lastVisitAt);
  if (row.totalSpend >= 3_000_000 || row.totalVisits >= 8) return "VIP";
  if (dormantDays !== null && dormantDays >= 60) return "LOST";
  if (dormantDays !== null && dormantDays >= 30) return "AT_RISK";
  if (row.totalVisits >= 3) return "RETURNING";
  if (row.totalVisits >= 1) return "ACTIVE";
  return "NEW";
}

function parseCustomerRow(row: Record<string, unknown>): CustomerCrmSummary {
  const lastVisitAt = typeof row.last_visit_at === "string" ? row.last_visit_at : null;
  const totalVisits = Number(row.total_visits ?? 0);
  const totalSpend = Number(row.total_spend ?? 0);

  return {
    id: String(row.id ?? ""),
    orgId: typeof row.org_id === "string" ? row.org_id : undefined,
    fullName: String(row.full_name ?? row.name ?? "-"),
    phone: normalizePhone(typeof row.phone === "string" ? row.phone : null),
    birthday: typeof row.birthday === "string" ? row.birthday : null,
    gender: typeof row.gender === "string" ? row.gender : null,
    firstVisitAt: typeof row.first_visit_at === "string" ? row.first_visit_at : null,
    lastVisitAt,
    totalVisits,
    totalSpend,
    lastServiceSummary: typeof row.last_service_summary === "string" ? row.last_service_summary : null,
    favoriteStaffUserId: typeof row.favorite_staff_user_id === "string" ? row.favorite_staff_user_id : null,
    customerStatus: inferStatus({
      customerStatus: typeof row.customer_status === "string" ? (row.customer_status as CustomerStatus) : null,
      totalVisits,
      totalSpend,
      lastVisitAt,
    }),
    tags: Array.isArray(row.tags) ? row.tags.map((item) => String(item)) : [],
    careNote: typeof row.care_note === "string" ? row.care_note : typeof row.notes === "string" ? row.notes : null,
    source: typeof row.source === "string" ? row.source : null,
    nextFollowUpAt: typeof row.next_follow_up_at === "string" ? row.next_follow_up_at : null,
    lastContactedAt: typeof row.last_contacted_at === "string" ? row.last_contacted_at : null,
    followUpStatus: typeof row.follow_up_status === "string" ? (row.follow_up_status as FollowUpStatus) : "PENDING",
    needsMergeReview: Boolean(row.needs_merge_review),
    dormantDays: daysBetweenIso(lastVisitAt),
  };
}

async function selectCustomersBase(client: SharedSupabaseClient, orgId: string) {
  const primary = await client
    .from("customers")
    .select(
      "id,org_id,full_name,name,phone,birthday,gender,first_visit_at,last_visit_at,total_visits,total_spend,last_service_summary,favorite_staff_user_id,customer_status,tags,care_note,notes,source,next_follow_up_at,last_contacted_at,follow_up_status,needs_merge_review",
    )
    .eq("org_id", orgId)
    .order("last_visit_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (!primary.error) {
    return primary;
  }

  return client
    .from("customers")
    .select("id,org_id,name,phone,notes,first_visit_at,last_visit_at,total_visits,total_spend,customer_status")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
}

export async function listCustomersCrmForMobile(client: SharedSupabaseClient): Promise<CustomerCrmSummary[]> {
  const { orgId } = await ensureOrgContext(client);

  const rpc = await client.rpc("list_customers_crm", {
    p_search: null,
    p_status: null,
    p_dormant_days: null,
    p_vip_only: false,
    p_source: null,
  });

  if (!rpc.error && Array.isArray(rpc.data)) {
    return rpc.data.map((row) => parseCustomerRow(row as Record<string, unknown>));
  }

  const { data, error } = await selectCustomersBase(client, orgId);
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => parseCustomerRow(row as Record<string, unknown>));
}

export async function getCrmDashboardMetricsForMobile(client: SharedSupabaseClient): Promise<CrmDashboardMetrics> {
  const customers = await listCustomersCrmForMobile(client);
  const todayKey = new Date().toISOString().slice(0, 10);

  const newToday = customers.filter((row) => row.firstVisitAt?.slice(0, 10) === todayKey).length;
  const returningToday = customers.filter(
    (row) => row.lastVisitAt?.slice(0, 10) === todayKey && row.totalVisits > 1,
  ).length;
  const atRiskCount = customers.filter(
    (row) => row.customerStatus === "AT_RISK" || row.customerStatus === "LOST",
  ).length;
  const repeat30 = customers.length > 0
    ? Math.round((customers.filter((row) => row.totalVisits > 1 && (row.dormantDays ?? 9999) <= 30).length / customers.length) * 100)
    : 0;

  return {
    newToday,
    returningToday,
    atRiskCount,
    repeat30,
  };
}
