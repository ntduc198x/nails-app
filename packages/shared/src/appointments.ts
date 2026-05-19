import type { SharedSupabaseClient } from "./org";
import { ensureOrgContext } from "./org";

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

export function canCheckInAppointmentAt(startAt: string, now = new Date()): boolean {
  const scheduledAtMs = new Date(startAt).getTime();
  const nowMs = now.getTime();
  if (!Number.isFinite(scheduledAtMs) || !Number.isFinite(nowMs)) {
    return false;
  }

  const windowMs = APPOINTMENT_CHECK_IN_WINDOW_MINUTES * 60 * 1000;
  return nowMs >= scheduledAtMs - windowMs && nowMs <= scheduledAtMs + windowMs;
}

export function assertAppointmentCheckInWindow(startAt: string, now = new Date()) {
  if (!canCheckInAppointmentAt(startAt, now)) {
    throw new Error("Chỉ được check-in trong khoảng 15 phút trước/sau giờ hẹn.");
  }
}

function normalizeAppointmentStatusMutationError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("CHECK_IN_WINDOW_VIOLATION")) {
    return new Error("Chỉ được check-in trong khoảng 15 phút trước/sau giờ hẹn.");
  }
  if (message.includes("INVALID_APPOINTMENT_STATUS_TRANSITION")) {
    return new Error("Trạng thái lịch hẹn không hợp lệ cho thao tác này.");
  }
  return error instanceof Error ? error : new Error(message || "Thao tác lịch hẹn thất bại.");
}

export async function listAppointmentsForMobile(client: SharedSupabaseClient): Promise<MobileAppointmentSummary[]> {
  const { orgId } = await ensureOrgContext(client);
  const result = await client
    .from("appointments")
    .select("id,start_at,end_at,status,staff_user_id,resource_id,checked_in_at,customers(name,phone)")
    .eq("org_id", orgId)
    .gte("start_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order("start_at", { ascending: true })
    .limit(300);

  let data: AppointmentRow[] | null = (result.data ?? []) as AppointmentRow[];
  let error: { message?: string } | null = result.error;

  if (error?.message?.includes("checked_in_at")) {
    const fallback = await client
      .from("appointments")
      .select("id,start_at,end_at,status,staff_user_id,resource_id,customers(name,phone)")
      .eq("org_id", orgId)
      .gte("start_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("start_at", { ascending: true })
      .limit(300);

    data = ((fallback.data ?? []) as AppointmentRow[]).map((row) => ({ ...row, checked_in_at: null }));
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
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
  });
}

export async function updateAppointmentStatusForMobile(
  client: SharedSupabaseClient,
  appointmentId: string,
  status: AppointmentStatus,
) {
  const { orgId } = await ensureOrgContext(client);

  if (status === "CHECKED_IN") {
    const { data: currentAppointment, error: currentAppointmentError } = await client
      .from("appointments")
      .select("start_at,status")
      .eq("id", appointmentId)
      .eq("org_id", orgId)
      .single();

    if (currentAppointmentError) {
      throw currentAppointmentError;
    }

    if (currentAppointment.status !== "BOOKED") {
      throw new Error("Chỉ có lịch chờ check-in mới được check-in.");
    }

    assertAppointmentCheckInWindow(String(currentAppointment.start_at ?? ""));
  }

  if (status === "CANCELLED") {
    const {
      data: { session },
    } = await client.auth.getSession();

    const currentUserId = session?.user?.id;
    if (!currentUserId) {
      throw new Error("Chua dang nhap");
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
          .single(),
      ]);

    if (currentRoleError) {
      throw currentRoleError;
    }

    if (currentAppointmentError) {
      throw currentAppointmentError;
    }

    if (currentAppointment.status === "CHECKED_IN" && currentRoleRow?.role !== "OWNER") {
      throw new Error("Chỉ OWNER mới được hủy lịch đã check-in.");
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
    .eq("org_id", orgId);

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
    throw new Error("Tên khách hàng là bắt buộc.");
  }

  const findExistingByBranchScope = async () => {
    if (!branchId) {
      return null;
    }

    if (normalizedPhone) {
      const byPhone = await client
        .from("customers")
        .select("id,phone,customer_branches!inner(branch_id)")
        .eq("org_id", orgId)
        .eq("customer_branches.branch_id", branchId)
        .eq("phone", normalizedPhone)
        .limit(1)
        .maybeSingle();

      if (byPhone.error) {
        throw byPhone.error;
      }

      if (byPhone.data?.id) {
        return {
          id: String(byPhone.data.id),
          phone: typeof byPhone.data.phone === "string" ? byPhone.data.phone : null,
        };
      }
    }

    for (const field of ["full_name", "name"] as const) {
      const byName = await client
        .from("customers")
        .select("id,phone,customer_branches!inner(branch_id)")
        .eq("org_id", orgId)
        .eq("customer_branches.branch_id", branchId)
        .eq(field, normalizedName)
        .limit(1)
        .maybeSingle();

      if (byName.error) {
        throw byName.error;
      }

      if (byName.data?.id) {
        return {
          id: String(byName.data.id),
          phone: typeof byName.data.phone === "string" ? byName.data.phone : null,
        };
      }
    }

    return null;
  };

  const existingInBranch = await findExistingByBranchScope();
  if (existingInBranch?.id) {
    if (normalizedPhone && !existingInBranch.phone) {
      const updateRes = await client
        .from("customers")
        .update({ phone: normalizedPhone })
        .eq("id", existingInBranch.id)
        .eq("org_id", orgId);

      if (updateRes.error) {
        throw updateRes.error;
      }
    }

    return existingInBranch.id;
  }

  const created = await client
    .from("customers")
    .insert({
      org_id: orgId,
      name: normalizedName,
      phone: normalizedPhone,
    })
    .select("id")
    .single();

  if (created.error) {
    throw created.error;
  }

  return String(created.data.id);
}

async function ensureCustomerBranchLinkForMobile(
  client: SharedSupabaseClient,
  input: { customerId: string; orgId: string; branchId: string | null },
) {
  if (!input.branchId) {
    return;
  }

  const upsert = await client.from("customer_branches").upsert(
    {
      customer_id: input.customerId,
      org_id: input.orgId,
      branch_id: input.branchId,
    },
    {
      onConflict: "customer_id,branch_id",
    },
  );

  if (upsert.error) {
    throw upsert.error;
  }
}

export async function saveAppointmentForMobile(
  client: SharedSupabaseClient,
  input: AppointmentMutationInput,
) {
  const { orgId, branchId } = await ensureOrgContext(client);
  const customerId = await findOrCreateCustomerForMobile(client, orgId, branchId ?? null, input.customerName, input.customerPhone);
  await ensureCustomerBranchLinkForMobile(client, {
    customerId,
    orgId,
    branchId: branchId ?? null,
  });

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
      .eq("org_id", orgId);

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
  const { orgId } = await ensureOrgContext(client);

  const { error } = await client
    .from("appointments")
    .delete()
    .eq("id", appointmentId)
    .eq("org_id", orgId);

  if (error) {
    throw error;
  }
}
