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
  secondaryResourceId: string | null;
  checkedInAt: string | null;
  customerName: string;
  customerPhone: string | null;
};

export type AppointmentStatus = "BOOKED" | "CHECKED_IN" | "DONE" | "CANCELLED" | "NO_SHOW";
export const APPOINTMENT_CHECK_IN_WINDOW_MINUTES = 15;
export const APPOINTMENT_ARRIVAL_OVERDUE_MINUTES = 20;
export const APPOINTMENT_OVERDUE_AUTO_CANCEL_DAYS = 1;
export const APPOINTMENT_TIME_PAST_ERROR = "BOOKING_TIME_PAST";
export const RESOURCE_TIME_CONFLICT_ERROR = "RESOURCE_TIME_CONFLICT";

export type OverdueBookedAutoCancelledAppointment = {
  id: string;
  startAt: string;
  customerName: string;
  customerPhone: string | null;
};

export type OverdueBookedCleanupResult = {
  autoCancelledCount: number;
  cleanupError: string | null;
  autoCancelledAppointments: OverdueBookedAutoCancelledAppointment[];
};

type AppointmentMutationInput = {
  customerName: string;
  customerPhone?: string | null;
  startAt: string;
  endAt: string;
  staffUserId?: string | null;
  resourceId?: string | null;
  secondaryResourceId?: string | null;
  appointmentId?: string | null;
};

type AppointmentRow = {
  id: unknown;
  branch_id?: unknown;
  customer_id?: unknown;
  start_at: unknown;
  end_at: unknown;
  status: unknown;
  staff_user_id: unknown;
  resource_id: unknown;
  secondary_resource_id?: unknown;
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
    secondaryResourceId: typeof row.secondary_resource_id === "string" ? row.secondary_resource_id : null,
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

export function isAppointmentStartAtOrAfterNow(startAt: string, now = new Date()): boolean {
  const scheduledAtMs = new Date(startAt).getTime();
  const nowMs = now.getTime();
  if (!Number.isFinite(scheduledAtMs) || !Number.isFinite(nowMs)) {
    return false;
  }

  return scheduledAtMs >= nowMs;
}

export function isAppointmentArrivalOverdue(
  appointment: Pick<MobileAppointmentSummary, "startAt" | "status">,
  now = new Date(),
): boolean {
  if (appointment.status !== "BOOKED") {
    return false;
  }

  const scheduledAtMs = new Date(appointment.startAt).getTime();
  const nowMs = now.getTime();
  if (!Number.isFinite(scheduledAtMs) || !Number.isFinite(nowMs)) {
    return false;
  }

  return nowMs >= scheduledAtMs + APPOINTMENT_ARRIVAL_OVERDUE_MINUTES * 60 * 1000;
}

export function isAppointmentPastAutoCancelThreshold(
  appointment: Pick<MobileAppointmentSummary, "startAt" | "status">,
  now = new Date(),
): boolean {
  if (appointment.status !== "BOOKED") {
    return false;
  }

  const scheduledAtMs = new Date(appointment.startAt).getTime();
  const nowMs = now.getTime();
  if (!Number.isFinite(scheduledAtMs) || !Number.isFinite(nowMs)) {
    return false;
  }

  return nowMs >= scheduledAtMs + APPOINTMENT_OVERDUE_AUTO_CANCEL_DAYS * 24 * 60 * 60 * 1000;
}

export function assertAppointmentCheckInWindow(startAt: string, now = new Date(), locale: Locale = DEFAULT_LOCALE) {
  if (!canCheckInAppointmentAt(startAt, now)) {
    throw new Error(translate(locale, "errors", "appointmentCheckInWindow"));
  }
}

export function assertAppointmentTimeNotPast(startAt: string, now = new Date(), locale: Locale = DEFAULT_LOCALE) {
  if (!isAppointmentStartAtOrAfterNow(startAt, now)) {
    throw new Error(`${APPOINTMENT_TIME_PAST_ERROR}:${translate(locale, "errors", "bookingTimePast")}`);
  }
}

function normalizeAppointmentStatusMutationError(error: unknown, locale: Locale = DEFAULT_LOCALE): Error {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes(APPOINTMENT_TIME_PAST_ERROR)) {
    return new Error(translate(locale, "errors", "bookingTimePast"));
  }
  if (message.includes(RESOURCE_TIME_CONFLICT_ERROR)) {
    return new Error(translate(locale, "errors", "appointmentResourceConflict"));
  }
  if (message.includes("CHECK_IN_WINDOW_VIOLATION")) {
    return new Error(translate(locale, "errors", "appointmentCheckInWindow"));
  }
  if (message.includes("INVALID_APPOINTMENT_STATUS_TRANSITION")) {
    return new Error(translate(locale, "errors", "invalidAppointmentStatusTransition"));
  }
  return error instanceof Error ? error : new Error(message || translate(locale, "errors", "appointmentMutationFailed"));
}

function normalizeCustomerPhone(raw: string | null | undefined) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("84") && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

function collectAppointmentResourceIds(row: Pick<AppointmentRow, "resource_id" | "secondary_resource_id">) {
  return [row.resource_id, row.secondary_resource_id].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

function hasAppointmentOverlap(
  existingStartAt: string,
  existingEndAt: string,
  nextStartAt: string,
  nextEndAt: string,
) {
  return new Date(existingStartAt).getTime() < new Date(nextEndAt).getTime()
    && new Date(existingEndAt).getTime() > new Date(nextStartAt).getTime();
}

async function assertAppointmentResourcesAvailable(
  client: SharedSupabaseClient,
  input: {
    orgId: string;
    branchId: string | null;
    startAt: string;
    endAt: string;
    resourceIds: string[];
    excludeAppointmentId?: string | null;
    locale?: Locale;
  },
) {
  if (!input.branchId || input.resourceIds.length === 0) {
    return;
  }

  let query = client
    .from("appointments")
    .select("id,start_at,end_at,status,resource_id,secondary_resource_id")
    .eq("org_id", input.orgId)
    .eq("branch_id", input.branchId)
    .in("status", ["BOOKED", "CHECKED_IN"])
    .lt("start_at", input.endAt)
    .gt("end_at", input.startAt);

  if (input.excludeAppointmentId) {
    query = query.neq("id", input.excludeAppointmentId);
  }

  const result = await query;

  let rows = (result.data ?? []) as AppointmentRow[];
  let error = result.error;

  if (error?.message?.includes("secondary_resource_id")) {
    let fallbackQuery = client
      .from("appointments")
      .select("id,start_at,end_at,status,resource_id")
      .eq("org_id", input.orgId)
      .eq("branch_id", input.branchId)
      .in("status", ["BOOKED", "CHECKED_IN"])
      .lt("start_at", input.endAt)
      .gt("end_at", input.startAt);

    if (input.excludeAppointmentId) {
      fallbackQuery = fallbackQuery.neq("id", input.excludeAppointmentId);
    }

    const fallback = await fallbackQuery;
    rows = ((fallback.data ?? []) as AppointmentRow[]).map((row) => ({
      ...row,
      secondary_resource_id: null,
    }));
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  const requestedResourceIds = new Set(input.resourceIds);
  const conflict = rows.some((row) => {
    if (
      typeof row.start_at !== "string"
      || typeof row.end_at !== "string"
      || !hasAppointmentOverlap(row.start_at, row.end_at, input.startAt, input.endAt)
    ) {
      return false;
    }

    return collectAppointmentResourceIds(row).some((resourceId) => requestedResourceIds.has(resourceId));
  });

  if (conflict) {
    throw new Error(`${RESOURCE_TIME_CONFLICT_ERROR}:${translate(input.locale ?? DEFAULT_LOCALE, "errors", "appointmentResourceConflict")}`);
  }
}

export async function listAppointmentsForMobile(
  client: SharedSupabaseClient,
  options?: { observerScope?: ObserverScopeInput | null },
): Promise<MobileAppointmentSummary[]> {
  const view = await resolveMobileAdminViewContext(client, options?.observerScope);
  let query = client
    .from("appointments")
    .select("id,start_at,end_at,status,staff_user_id,resource_id,secondary_resource_id,checked_in_at,customers(name,phone)")
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

  if (error?.message?.includes("checked_in_at") || error?.message?.includes("secondary_resource_id")) {
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
    data = ((fallback.data ?? []) as AppointmentRow[]).map((row) => ({
      ...row,
      checked_in_at: null,
      secondary_resource_id: null,
    }));
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapAppointmentRow);
}

export async function cleanupOverdueBookedAppointmentsForMobile(
  client: SharedSupabaseClient,
  options?: { observerScope?: ObserverScopeInput | null },
): Promise<OverdueBookedCleanupResult> {
  const view = await resolveMobileAdminViewContext(client, options?.observerScope);
  const thresholdIso = new Date(
    Date.now() - APPOINTMENT_OVERDUE_AUTO_CANCEL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  let query = client
    .from("appointments")
    .select("id,start_at,status,customers(name,phone)")
    .eq("org_id", view.orgId)
    .eq("status", "BOOKED")
    .lte("start_at", thresholdIso)
    .order("start_at", { ascending: true })
    .limit(200);

  if (view.viewBranchId) {
    query = query.eq("branch_id", view.viewBranchId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const rows = ((data ?? []) as AppointmentRow[]).map((row) => {
    const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
    return {
      id: String(row.id ?? ""),
      startAt: String(row.start_at ?? ""),
      customerName: typeof customer?.name === "string" ? customer.name : "-",
      customerPhone: typeof customer?.phone === "string" ? customer.phone : null,
    };
  });

  const autoCancelledIds = rows.map((row) => row.id).filter(Boolean);
  if (autoCancelledIds.length === 0) {
    return {
      autoCancelledCount: 0,
      cleanupError: null,
      autoCancelledAppointments: [],
    };
  }

  let updateQuery = client
    .from("appointments")
    .update({ status: "CANCELLED" })
    .eq("org_id", view.orgId)
    .in("id", autoCancelledIds)
    .eq("status", "BOOKED");

  if (view.viewBranchId) {
    updateQuery = updateQuery.eq("branch_id", view.viewBranchId);
  }

  const { error: cleanupError } = await updateQuery;
  if (cleanupError) {
    return {
      autoCancelledCount: 0,
      cleanupError: cleanupError.message || "Khong the tu dong huy lich qua hen.",
      autoCancelledAppointments: [],
    };
  }

  return {
    autoCancelledCount: autoCancelledIds.length,
    cleanupError: null,
    autoCancelledAppointments: rows,
  };
}

export async function getAppointmentForMobile(
  client: SharedSupabaseClient,
  appointmentId: string,
  options?: { observerScope?: ObserverScopeInput | null },
): Promise<MobileAppointmentSummary | null> {
  const view = await resolveMobileAdminViewContext(client, options?.observerScope);

  let query = client
    .from("appointments")
    .select("id,start_at,end_at,status,staff_user_id,resource_id,secondary_resource_id,checked_in_at,customers(name,phone)")
    .eq("org_id", view.orgId)
    .eq("id", appointmentId)
    .limit(1);

  if (view.viewBranchId) {
    query = query.eq("branch_id", view.viewBranchId);
  }

  const result = await query.maybeSingle();

  let data = result.data as AppointmentRow | null;
  let error: { message?: string } | null = result.error;

  if (error?.message?.includes("checked_in_at") || error?.message?.includes("secondary_resource_id")) {
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
    data = fallback.data
      ? ({ ...(fallback.data as AppointmentRow), checked_in_at: null, secondary_resource_id: null })
      : null;
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

    const currentAppointmentSummary: Pick<MobileAppointmentSummary, "startAt" | "status"> = {
      startAt: String(currentAppointment.start_at ?? ""),
      status: String(currentAppointment.status ?? ""),
    };

    if (!canCheckInAppointmentAt(currentAppointmentSummary.startAt)) {
      assertAppointmentCheckInWindow(currentAppointmentSummary.startAt);
    }
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
  assertAppointmentTimeNotPast(input.startAt);

  if (input.appointmentId) {
    const { orgId, branchId } = await ensureOrgContext(client);
    const existingAppointmentRes = await client
      .from("appointments")
      .select("id,branch_id,customer_id,secondary_resource_id")
      .eq("id", input.appointmentId)
      .eq("org_id", orgId)
      .limit(1)
      .maybeSingle();

    if (existingAppointmentRes.error) {
      throw existingAppointmentRes.error;
    }

    if (!existingAppointmentRes.data?.id) {
      throw new Error("APPOINTMENT_NOT_FOUND");
    }

    const targetBranchId =
      typeof existingAppointmentRes.data.branch_id === "string" && existingAppointmentRes.data.branch_id
        ? existingAppointmentRes.data.branch_id
        : branchId;
    let customerId =
      typeof existingAppointmentRes.data.customer_id === "string" && existingAppointmentRes.data.customer_id
        ? existingAppointmentRes.data.customer_id
        : null;

    if (customerId) {
      const normalizedName = input.customerName.trim();
      if (!normalizedName) {
        throw new Error(translate(DEFAULT_LOCALE, "errors", "customerNameRequired"));
      }

      const trimmedPhone = input.customerPhone?.trim() ? input.customerPhone.trim() : null;
      const normalizedPhone = normalizeCustomerPhone(trimmedPhone);
      const customerUpdateRes = await client
        .from("customers")
        .update({
          full_name: normalizedName,
          name: normalizedName,
          phone: trimmedPhone,
          normalized_phone: normalizedPhone,
          branch_id: targetBranchId ?? null,
        })
        .eq("id", customerId)
        .eq("org_id", orgId)
        .select("id")
        .single();

      if (customerUpdateRes.error) {
        throw customerUpdateRes.error;
      }
    } else {
      customerId = await findOrCreateCustomerForMobile(
        client,
        orgId,
        targetBranchId ?? null,
        input.customerName,
        input.customerPhone,
      );
    }

    const payload = {
      customer_id: customerId,
      start_at: input.startAt,
      end_at: input.endAt,
      staff_user_id: input.staffUserId ?? null,
      resource_id: input.resourceId ?? null,
      secondary_resource_id:
        input.secondaryResourceId === undefined
          ? (typeof existingAppointmentRes.data.secondary_resource_id === "string"
              ? existingAppointmentRes.data.secondary_resource_id
              : null)
          : input.secondaryResourceId,
    };

    await assertAppointmentResourcesAvailable(client, {
      orgId,
      branchId: targetBranchId,
      startAt: input.startAt,
      endAt: input.endAt,
      resourceIds: [payload.resource_id, payload.secondary_resource_id].filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      ),
      excludeAppointmentId: input.appointmentId,
      locale: DEFAULT_LOCALE,
    });

    const updateRes = await client
      .from("appointments")
      .update(payload)
      .eq("id", input.appointmentId)
      .eq("org_id", orgId)
      .eq("branch_id", targetBranchId)
      .select("id")
      .maybeSingle();

    if (updateRes.error) {
      throw updateRes.error;
    }

    if (!updateRes.data?.id) {
      throw new Error("APPOINTMENT_UPDATE_TARGET_NOT_FOUND");
    }

    return { appointmentId: input.appointmentId, mode: "updated" as const };
  }

  const { orgId, branchId } = await ensureOrgContext(client);
  const customerId = await findOrCreateCustomerForMobile(client, orgId, branchId ?? null, input.customerName, input.customerPhone);
  const payload = {
    customer_id: customerId,
    start_at: input.startAt,
    end_at: input.endAt,
    staff_user_id: input.staffUserId ?? null,
    resource_id: input.resourceId ?? null,
    secondary_resource_id: input.secondaryResourceId ?? null,
  };

  await assertAppointmentResourcesAvailable(client, {
    orgId,
    branchId,
    startAt: input.startAt,
    endAt: input.endAt,
    resourceIds: [payload.resource_id, payload.secondary_resource_id].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    ),
    locale: DEFAULT_LOCALE,
  });

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
