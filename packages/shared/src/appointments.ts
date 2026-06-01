import { DEFAULT_LOCALE, type Locale, translate } from "./i18n";
import type { ObserverScopeInput, SharedSupabaseClient } from "./org";
import { ensureOrgContext, resolveMobileAdminViewContext } from "./org";

export type MobileAppointmentSummary = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  staffUserId: string | null;
  resourceId: string | null;
  checkedInAt: string | null;
  customerName: string;
  customerPhone: string | null;
};

export type AppointmentStatus = "BOOKED" | "CHECKED_IN" | "DONE" | "CANCELLED" | "NO_SHOW";
export const APPOINTMENT_CHECK_IN_WINDOW_MINUTES = 15;

type AppointmentMutationInput = {
  customerName: string;
  customerPhone?: string | null;
  startAt: string;
  endAt: string;
  staffUserId?: string | null;
  resourceId?: string | null;
  appointmentId?: string | null;
};

type AppointmentRow = {
  id: unknown;
  start_at: unknown;
  end_at: unknown;
  status: unknown;
  staff_user_id: unknown;
  resource_id: unknown;
  checked_in_at?: unknown;
  customers?: { name?: unknown; phone?: unknown }[] | { name?: unknown; phone?: unknown } | null;
};

function mapAppointmentRow(row: AppointmentRow): MobileAppointmentSummary {
  const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
  return {
    id: String(row.id ?? ""),
    startAt: String(row.start_at ?? ""),
    endAt: String(row.end_at ?? ""),
    status: String(row.status ?? ""),
    staffUserId: typeof row.staff_user_id === "string" ? row.staff_user_id : null,
    resourceId: typeof row.resource_id === "string" ? row.resource_id : null,
    checkedInAt: typeof row.checked_in_at === "string" ? row.checked_in_at : null,
    customerName: typeof customer?.name === "string" ? customer.name : "-",
    customerPhone: typeof customer?.phone === "string" ? customer.phone : null,
  };
}

export function canCheckInAppointmentAt(startAt: string, now = new Date()): boolean {
  const scheduledAtMs = new Date(startAt).getTime();
  const nowMs = now.getTime();
  if (!Number.isFinite(scheduledAtMs) || !Number.isFinite(nowMs)) {
    return false;
  }

  const windowMs = APPOINTMENT_CHECK_IN_WINDOW_MINUTES * 60 * 1000;
  return nowMs >= scheduledAtMs - windowMs && nowMs <= scheduledAtMs + windowMs;
}

export function assertAppointmentCheckInWindow(startAt: string, now = new Date(), locale: Locale = DEFAULT_LOCALE) {
  if (!canCheckInAppointmentAt(startAt, now)) {
    throw new Error(translate(locale, "errors", "appointmentCheckInWindow"));
  }
}

function normalizeAppointmentStatusMutationError(error: unknown, locale: Locale = DEFAULT_LOCALE): Error {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("CHECK_IN_WINDOW_VIOLATION")) {
    return new Error(translate(locale, "errors", "appointmentCheckInWindow"));
  }
  if (message.includes("INVALID_APPOINTMENT_STATUS_TRANSITION")) {
    return new Error(translate(locale, "errors", "invalidAppointmentStatusTransition"));
  }
  return error instanceof Error ? error : new Error(message || translate(locale, "errors", "appointmentMutationFailed"));
}

export async function listAppointmentsForMobile(
  client: SharedSupabaseClient,
  options?: { observerScope?: ObserverScopeInput | null },
): Promise<MobileAppointmentSummary[]> {
  const view = await resolveMobileAdminViewContext(client, options?.observerScope);
  let query = client
    .from("appointments")
    .select("id,start_at,end_at,status,staff_user_id,resource_id,checked_in_at,customers(name,phone)")
    .eq("org_id", view.orgId)
    .gte("start_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order("start_at", { ascending: true })
    .limit(300);

  if (view.viewBranchId) {
    query = query.eq("branch_id", view.viewBranchId);
  }

  const result = await query;

  let data: AppointmentRow[] | null = (result.data ?? []) as AppointmentRow[];
  let error: { message?: string } | null = result.error;

  if (error?.message?.includes("checked_in_at")) {
    let fallbackQuery = client
      .from("appointments")
      .select("id,start_at,end_at,status,staff_user_id,resource_id,customers(name,phone)")
      .eq("org_id", view.orgId)
      .gte("start_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("start_at", { ascending: true })
      .limit(300);

    if (view.viewBranchId) {
      fallbackQuery = fallbackQuery.eq("branch_id", view.viewBranchId);
    }

    const fallback = await fallbackQuery;
    data = ((fallback.data ?? []) as AppointmentRow[]).map((row) => ({ ...row, checked_in_at: null }));
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapAppointmentRow);
}

export async function getAppointmentForMobile(
  client: SharedSupabaseClient,
  appointmentId: string,
  options?: { observerScope?: ObserverScopeInput | null },
): Promise<MobileAppointmentSummary | null> {
  const view = await resolveMobileAdminViewContext(client, options?.observerScope);

  let query = client
    .from("appointments")
    .select("id,start_at,end_at,status,staff_user_id,resource_id,checked_in_at,customers(name,phone)")
    .eq("org_id", view.orgId)
    .eq("id", appointmentId)
    .limit(1);

  if (view.viewBranchId) {
    query = query.eq("branch_id", view.viewBranchId);
  }

  const result = await query.maybeSingle();

  let data = result.data as AppointmentRow | null;
  let error: { message?: string } | null = result.error;

  if (error?.message?.includes("checked_in_at")) {
    let fallbackQuery = client
      .from("appointments")
      .select("id,start_at,end_at,status,staff_user_id,resource_id,customers(name,phone)")
      .eq("org_id", view.orgId)
      .eq("id", appointmentId)
      .limit(1);

    if (view.viewBranchId) {
      fallbackQuery = fallbackQuery.eq("branch_id", view.viewBranchId);
    }

    const fallback = await fallbackQuery.maybeSingle();
    data = fallback.data ? ({ ...(fallback.data as AppointmentRow), checked_in_at: null }) : null;
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  return data ? mapAppointmentRow(data) : null;
}

export async function updateAppointmentStatusForMobile(
  client: SharedSupabaseClient,
  appointmentId: string,
  status: AppointmentStatus,
) {
  const { orgId, branchId } = await ensureOrgContext(client);

  if (status === "CHECKED_IN") {
    const { data: currentAppointment, error: currentAppointmentError } = await client
      .from("appointments")
      .select("start_at,status")
      .eq("id", appointmentId)
      .eq("org_id", orgId)
      .eq("branch_id", branchId)
      .single();

    if (currentAppointmentError) {
      throw currentAppointmentError;
    }

    if (currentAppointment.status !== "BOOKED") {
      throw new Error(translate(DEFAULT_LOCALE, "errors", "appointmentCheckinOnlyBooked"));
    }

    assertAppointmentCheckInWindow(String(currentAppointment.start_at ?? ""));
  }

  if (status === "CANCELLED") {
    const {
      data: { session },
    } = await client.auth.getSession();

    const currentUserId = session?.user?.id;
    if (!currentUserId) {
      throw new Error(translate(DEFAULT_LOCALE, "errors", "signInRequired"));
    }

    const [{ data: currentRoleRow, error: currentRoleError }, { data: currentAppointment, error: currentAppointmentError }] =
      await Promise.all([
        client
          .from("user_roles")
          .select("role")
          .eq("org_id", orgId)
          .eq("user_id", currentUserId)
          .limit(1)
          .maybeSingle(),
        client
          .from("appointments")
          .select("status")
          .eq("id", appointmentId)
          .eq("org_id", orgId)
          .eq("branch_id", branchId)
          .single(),
      ]);

    if (currentRoleError) {
      throw currentRoleError;
    }

    if (currentAppointmentError) {
      throw currentAppointmentError;
    }

    if (currentAppointment.status === "CHECKED_IN" && currentRoleRow?.role !== "OWNER") {
      throw new Error(translate(DEFAULT_LOCALE, "errors", "ownerOnlyCancelCheckedIn"));
    }
  }

  const updateData: Record<string, unknown> = { status };
  if (status === "CHECKED_IN") {
    updateData.checked_in_at = new Date().toISOString();
  }

  const { error } = await client
    .from("appointments")
    .update(updateData)
    .eq("id", appointmentId)
    .eq("org_id", orgId)
    .eq("branch_id", branchId);

  if (error) {
    throw normalizeAppointmentStatusMutationError(error);
  }
}

async function findOrCreateCustomerForMobile(
  client: SharedSupabaseClient,
  orgId: string,
  branchId: string | null,
  customerName: string,
  customerPhone?: string | null,
) {
  const normalizedName = customerName.trim();
  const normalizedPhone = customerPhone?.trim() ? customerPhone.trim() : null;
  if (!normalizedName) {
    throw new Error(translate(DEFAULT_LOCALE, "errors", "customerNameRequired"));
  }

  const response = await client.rpc("upsert_customer_by_identity", {
    p_org_id: orgId,
    p_full_name: normalizedName,
    p_phone: normalizedPhone,
    p_source: "admin_mobile_scheduling",
    p_care_note: null,
    p_branch_id: branchId,
  });

  if (response.error) {
    throw response.error;
  }

  if (!response.data) {
    throw new Error("CUSTOMER_UPSERT_FAILED");
  }

  return String(response.data);
}

export async function saveAppointmentForMobile(
  client: SharedSupabaseClient,
  input: AppointmentMutationInput,
) {
  const { orgId, branchId } = await ensureOrgContext(client);
  const customerId = await findOrCreateCustomerForMobile(client, orgId, branchId ?? null, input.customerName, input.customerPhone);

  const payload = {
    customer_id: customerId,
    start_at: input.startAt,
    end_at: input.endAt,
    staff_user_id: input.staffUserId ?? null,
    resource_id: input.resourceId ?? null,
  };

  if (input.appointmentId) {
    const updateRes = await client
      .from("appointments")
      .update(payload)
      .eq("id", input.appointmentId)
      .eq("org_id", orgId)
      .eq("branch_id", branchId);

    if (updateRes.error) {
      throw updateRes.error;
    }

    return { appointmentId: input.appointmentId, mode: "updated" as const };
  }

  const insertRes = await client
    .from("appointments")
    .insert({
      org_id: orgId,
      branch_id: branchId,
      ...payload,
      status: "BOOKED",
    })
    .select("id")
    .single();

  if (insertRes.error) {
    throw insertRes.error;
  }

  return { appointmentId: String(insertRes.data.id), mode: "created" as const };
}

export async function deleteAppointmentForMobile(
  client: SharedSupabaseClient,
  appointmentId: string,
) {
  const { orgId, branchId } = await ensureOrgContext(client);

  const { error } = await client
    .from("appointments")
    .delete()
    .eq("id", appointmentId)
    .eq("org_id", orgId)
    .eq("branch_id", branchId);

  if (error) {
    throw error;
  }
}
