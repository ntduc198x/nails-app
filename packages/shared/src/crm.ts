import type { SharedSupabaseClient } from "./org";
import { ensureOrgContext } from "./org";

export type CustomerStatus = "NEW" | "ACTIVE" | "RETURNING" | "VIP" | "AT_RISK" | "LOST";
export type FollowUpStatus = "PENDING" | "DONE" | "SKIPPED";

export type CustomerCrmMembershipTier = {
  id: string;
  code: string;
  name: string;
  accentColor: string | null;
  gradientFrom: string | null;
  gradientTo: string | null;
  badgeIcon: string | null;
  themeKey: string | null;
};

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
  membershipTier: CustomerCrmMembershipTier | null;
};

export type CrmDashboardMetrics = {
  newToday: number;
  returningToday: number;
  atRiskCount: number;
  repeat30: number;
};

export type CustomerDuplicateCandidate = {
  orgId: string;
  matchType: "EMAIL" | "PHONE";
  matchValue: string;
  duplicateCount: number;
  canonicalCustomerId: string;
  duplicateCustomerIds: string[];
};

export type SafeCustomerDuplicateMergePreview = {
  canonicalCustomerId: string;
  duplicateCustomerId: string;
  matchValue: string;
  action: string;
  reason: string;
};

export type SafeCustomerDuplicateCandidate = {
  matchType: "EMAIL" | "PHONE";
  matchValue: string;
  canonicalCustomerId: string;
  duplicateCustomerIds: string[];
  duplicateCount: number;
  reason: string;
};

export type CustomerMergeResult = {
  success: boolean;
  orgId: string;
  canonicalCustomerId: string;
  duplicateCustomerId: string;
  reason: string;
};

export type CustomerCrmFilters = {
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

function toLocalDateKey(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function parseMembershipTier(row: Record<string, unknown> | null | undefined): CustomerCrmMembershipTier | null {
  if (!row) return null;
  const id = String(row.id ?? "").trim();
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!id || !name) return null;

  return {
    id,
    code: typeof row.code === "string" ? row.code.trim() : "",
    name,
    accentColor: typeof row.accent_color === "string" ? row.accent_color : null,
    gradientFrom: typeof row.gradient_from === "string" ? row.gradient_from : null,
    gradientTo: typeof row.gradient_to === "string" ? row.gradient_to : null,
    badgeIcon: typeof row.badge_icon === "string" ? row.badge_icon : null,
    themeKey: typeof row.theme_key === "string" ? row.theme_key : null,
  };
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
    membershipTier: parseMembershipTier(
      row.membership_tiers && typeof row.membership_tiers === "object"
        ? (row.membership_tiers as Record<string, unknown>)
        : row.membership_tier && typeof row.membership_tier === "object"
          ? (row.membership_tier as Record<string, unknown>)
          : undefined,
    ),
  };
}

function parseCustomerBranchRow(row: Record<string, unknown>): CustomerCrmSummary {
  const nestedCustomer = Array.isArray(row.customers)
    ? row.customers[0]
    : row.customers && typeof row.customers === "object"
      ? row.customers
      : null;
  const customer = nestedCustomer && typeof nestedCustomer === "object"
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

async function listMembershipTierByCustomerId(
  client: SharedSupabaseClient,
  orgId: string,
  customerIds: string[],
): Promise<Map<string, CustomerCrmMembershipTier>> {
  const uniqueCustomerIds = [...new Set(customerIds.filter(Boolean))];
  if (!uniqueCustomerIds.length) {
    return new Map();
  }

  const membershipRes = await client
    .from("customer_memberships")
    .select(
      "customer_id,membership_tiers(id,code,name,accent_color,gradient_from,gradient_to,badge_icon,theme_key)",
    )
    .eq("org_id", orgId)
    .in("customer_id", uniqueCustomerIds);

  if (membershipRes.error) {
    return new Map();
  }

  const tierMap = new Map<string, CustomerCrmMembershipTier>();
  for (const row of (membershipRes.data ?? []) as Array<Record<string, unknown>>) {
    const customerId = typeof row.customer_id === "string" ? row.customer_id : "";
    if (!customerId || tierMap.has(customerId)) continue;

    const rawTier = Array.isArray(row.membership_tiers)
      ? row.membership_tiers[0]
      : row.membership_tiers && typeof row.membership_tiers === "object"
        ? row.membership_tiers
        : null;
    const tier = parseMembershipTier(rawTier as Record<string, unknown> | null);
    if (tier) {
      tierMap.set(customerId, tier);
    }
  }

  return tierMap;
}

async function attachMembershipTier(
  client: SharedSupabaseClient,
  orgId: string,
  rows: CustomerCrmSummary[],
): Promise<CustomerCrmSummary[]> {
  if (!rows.length || rows.some((row) => row.membershipTier)) {
    return rows;
  }

  const tierMap = await listMembershipTierByCustomerId(
    client,
    orgId,
    rows.map((row) => row.id),
  );

  if (!tierMap.size) {
    return rows;
  }

  return rows.map((row) => ({
    ...row,
    membershipTier: tierMap.get(row.id) ?? null,
  }));
}

async function selectCustomersBase(
  client: SharedSupabaseClient,
  orgId: string,
  branchId: string | null,
) {
  let query = client
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

export async function listCustomersCrmForMobile(
  client: SharedSupabaseClient,
  filters: CustomerCrmFilters = {},
): Promise<CustomerCrmSummary[]> {
  const { orgId, branchId } = await ensureOrgContext(client);

  const rpc = await client.rpc("list_customers_crm", {
    p_search: filters.search?.trim() || null,
    p_status: filters.status && filters.status !== "ALL" ? filters.status : null,
    p_dormant_days: filters.dormantDays ?? null,
    p_vip_only: Boolean(filters.vipOnly),
    p_source: filters.source && filters.source !== "ALL" ? filters.source : null,
    p_branch_id: branchId,
  });

  if (!rpc.error && Array.isArray(rpc.data)) {
    return attachMembershipTier(
      client,
      orgId,
      rpc.data.map((row) => parseCustomerRow(row as Record<string, unknown>)),
    );
  }

  const { data, error } = await selectCustomersBase(client, orgId, branchId);
  if (error) {
    throw error;
  }

  let rows = (data ?? []).map((row) => parseCustomerBranchRow(row as Record<string, unknown>));

  if (filters.search?.trim()) {
    const query = filters.search.trim().toLowerCase();
    rows = rows.filter((row) =>
      row.fullName.toLowerCase().includes(query) || (row.phone ?? "").includes(normalizePhone(query) ?? query),
    );
  }

  if (filters.status && filters.status !== "ALL") {
    rows = rows.filter((row) => row.customerStatus === filters.status);
  }

  if (filters.source && filters.source !== "ALL") {
    rows = rows.filter((row) => row.source === filters.source);
  }

  if (filters.vipOnly) {
    rows = rows.filter((row) => row.customerStatus === "VIP");
  }

  if (filters.dormantDays != null) {
    const minimumDormantDays = filters.dormantDays;
    rows = rows.filter((row) => (row.dormantDays ?? -1) >= minimumDormantDays);
  }

  return attachMembershipTier(client, orgId, rows);
}

export async function listFollowUpCandidatesForMobile(
  client: SharedSupabaseClient,
  range?: { fromIso?: string | null; toIso?: string | null },
): Promise<CustomerCrmSummary[]> {
  const { branchId } = await ensureOrgContext(client);

  const rpc = await client.rpc("list_follow_up_candidates", {
    p_from: range?.fromIso ?? null,
    p_to: range?.toIso ?? null,
    p_branch_id: branchId,
  });

  if (!rpc.error && Array.isArray(rpc.data)) {
    return rpc.data.map((row) => parseCustomerRow(row as Record<string, unknown>));
  }

  const rows = await listCustomersCrmForMobile(client);
  return rows.filter((row) => {
    if (!row.nextFollowUpAt) return false;
    const time = new Date(row.nextFollowUpAt).getTime();
    if (Number.isNaN(time)) return false;
    if (range?.fromIso && time < new Date(range.fromIso).getTime()) return false;
    if (range?.toIso && time > new Date(range.toIso).getTime()) return false;
    return row.followUpStatus !== "DONE";
  });
}

export async function listCustomerDuplicateCandidatesForMobile(
  client: SharedSupabaseClient,
): Promise<CustomerDuplicateCandidate[]> {
  const rpc = await client.rpc("list_customer_duplicate_candidates");
  if (rpc.error) {
    throw rpc.error;
  }

  return ((rpc.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    orgId: String(row.org_id ?? ""),
    matchType: String(row.match_type ?? "PHONE") as "EMAIL" | "PHONE",
    matchValue: String(row.match_value ?? ""),
    duplicateCount: Number(row.duplicate_count ?? 0),
    canonicalCustomerId: String(row.canonical_customer_id ?? ""),
    duplicateCustomerIds: Array.isArray(row.duplicate_customer_ids)
      ? row.duplicate_customer_ids.map((item) => String(item))
      : [],
  }));
}

export async function mergeCustomerRecordsForMobile(
  client: SharedSupabaseClient,
  input: { canonicalCustomerId: string; duplicateCustomerId: string; reason?: string },
): Promise<CustomerMergeResult> {
  const rpc = await client.rpc("merge_customer_records", {
    p_canonical_customer_id: input.canonicalCustomerId,
    p_duplicate_customer_id: input.duplicateCustomerId,
    p_reason: input.reason ?? "MANUAL_CRM_MERGE",
  });

  if (rpc.error) {
    throw rpc.error;
  }

  const row = (rpc.data ?? {}) as Record<string, unknown>;
  const result = {
    success: Boolean(row.success),
    orgId: String(row.org_id ?? ""),
    canonicalCustomerId: String(row.canonical_customer_id ?? input.canonicalCustomerId),
    duplicateCustomerId: String(row.duplicate_customer_id ?? input.duplicateCustomerId),
    reason: String(row.reason ?? input.reason ?? "MANUAL_CRM_MERGE"),
  };

  if (!result.success) {
    throw new Error(result.reason || "MERGE_FAILED");
  }

  return result;
}

export async function previewSafeCustomerDuplicateMergesForMobile(
  client: SharedSupabaseClient,
  input: { kind: "EMAIL" | "PHONE" },
): Promise<SafeCustomerDuplicateMergePreview[]> {
  const fn = input.kind === "EMAIL" ? "merge_safe_customer_duplicates_by_email" : "merge_safe_customer_duplicates_by_phone";
  const rpc = await client.rpc(fn, { p_org_id: null, p_dry_run: true });
  if (rpc.error) {
    throw rpc.error;
  }
  return ((rpc.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    canonicalCustomerId: String(row.canonical_customer_id ?? ""),
    duplicateCustomerId: String(row.duplicate_customer_id ?? ""),
    matchValue: String(row.match_value ?? ""),
    action: String(row.action ?? "DRY_RUN"),
    reason: String(row.reason ?? ""),
  }));
}

function groupSafeDuplicatePreviewRows(
  kind: "EMAIL" | "PHONE",
  rows: SafeCustomerDuplicateMergePreview[],
): SafeCustomerDuplicateCandidate[] {
  const grouped = new Map<string, SafeCustomerDuplicateCandidate>();

  for (const row of rows) {
    const key = `${kind}:${row.matchValue}:${row.canonicalCustomerId}`;
    const existing = grouped.get(key);
    if (existing) {
      if (!existing.duplicateCustomerIds.includes(row.duplicateCustomerId)) {
        existing.duplicateCustomerIds.push(row.duplicateCustomerId);
        existing.duplicateCount = existing.duplicateCustomerIds.length + 1;
      }
      continue;
    }

    grouped.set(key, {
      matchType: kind,
      matchValue: row.matchValue,
      canonicalCustomerId: row.canonicalCustomerId,
      duplicateCustomerIds: [row.duplicateCustomerId],
      duplicateCount: 2,
      reason: row.reason,
    });
  }

  return Array.from(grouped.values()).sort((left, right) => {
    if (left.matchType !== right.matchType) {
      return left.matchType.localeCompare(right.matchType);
    }
    return left.matchValue.localeCompare(right.matchValue);
  });
}

export async function listSafeCustomerDuplicateCandidatesForMobile(
  client: SharedSupabaseClient,
): Promise<SafeCustomerDuplicateCandidate[]> {
  const [emailRows, phoneRows] = await Promise.all([
    previewSafeCustomerDuplicateMergesForMobile(client, { kind: "EMAIL" }),
    previewSafeCustomerDuplicateMergesForMobile(client, { kind: "PHONE" }),
  ]);

  return [
    ...groupSafeDuplicatePreviewRows("EMAIL", emailRows),
    ...groupSafeDuplicatePreviewRows("PHONE", phoneRows),
  ];
}

export async function getCrmDashboardMetricsForMobile(client: SharedSupabaseClient): Promise<CrmDashboardMetrics> {
  const customers = await listCustomersCrmForMobile(client);
  const todayKey = toLocalDateKey(new Date());

  const newToday = customers.filter((row) => toLocalDateKey(row.firstVisitAt) === todayKey).length;
  const returningToday = customers.filter(
    (row) => toLocalDateKey(row.lastVisitAt) === todayKey && row.totalVisits > 1,
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
