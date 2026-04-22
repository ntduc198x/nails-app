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

type AppointmentMutationInput = {
  customerName: string;
  customerPhone?: string | null;
  startAt: string;
  endAt: string;
  staffUserId?: string | null;
  resourceId?: string | null;
  appointmentId?: string | null;
};

export async function listAppointmentsForMobile(client: SharedSupabaseClient): Promise<MobileAppointmentSummary[]> {
  const { orgId } = await ensureOrgContext(client);

  let { data, error } = await client
    .from("appointments")
    .select("id,start_at,end_at,status,staff_user_id,resource_id,checked_in_at,customers(name,phone)")
    .eq("org_id", orgId)
    .gte("start_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order("start_at", { ascending: true })
    .limit(300);

  if (error && error.message.includes("checked_in_at")) {
    const fallback = await client
      .from("appointments")
      .select("id,start_at,end_at,status,staff_user_id,resource_id,customers(name,phone)")
      .eq("org_id", orgId)
      .gte("start_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("start_at", { ascending: true })
      .limit(300);

    data = (fallback.data ?? []).map((row) => ({ ...row, checked_in_at: null })) as typeof data;
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
      throw new Error("Chi OWNER moi duoc huy lich da check-in.");
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
    throw error;
  }
}

async function findOrCreateCustomerForMobile(
  client: SharedSupabaseClient,
  orgId: string,
  customerName: string,
  customerPhone?: string | null,
) {
  const normalizedName = customerName.trim();
  const normalizedPhone = customerPhone?.trim() ? customerPhone.trim() : null;
  if (!normalizedName) {
    throw new Error("Ten khach hang la bat buoc.");
  }

  const existing = await client
    .from("customers")
    .select("id")
    .eq("org_id", orgId)
    .eq("name", normalizedName)
    .limit(1);

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data?.[0]?.id) {
    if (normalizedPhone) {
      const updateRes = await client
        .from("customers")
        .update({ phone: normalizedPhone })
        .eq("id", String(existing.data[0].id))
        .eq("org_id", orgId);

      if (updateRes.error) {
        throw updateRes.error;
      }
    }

    return String(existing.data[0].id);
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

export async function saveAppointmentForMobile(
  client: SharedSupabaseClient,
  input: AppointmentMutationInput,
) {
  const { orgId, branchId } = await ensureOrgContext(client);
  const customerId = await findOrCreateCustomerForMobile(client, orgId, input.customerName, input.customerPhone);

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
