import { supabase } from "@/lib/supabase";
import { ensureOrgContext, listAppointments, listResources } from "@/lib/domain";

export type BookingRequestStatus = "NEW" | "CONFIRMED" | "NEEDS_RESCHEDULE" | "CANCELLED" | "CONVERTED";

export type BookingRequestRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  requested_service?: string | null;
  preferred_staff?: string | null;
  note?: string | null;
  requested_start_at: string;
  requested_end_at: string;
  status: BookingRequestStatus;
  appointment_id?: string | null;
  source?: string | null;
  created_at: string;
};

function patchExpiredRows(rows: BookingRequestRow[]) {
  const now = Date.now();
  const expiredIds = rows
    .filter((row) => row.status === "NEW" && !!row.requested_start_at && new Date(row.requested_start_at).getTime() < now)
    .map((row) => row.id);

  return {
    expiredIds,
    rows: rows.map((row) => (expiredIds.includes(row.id) ? { ...row, status: "NEEDS_RESCHEDULE" as BookingRequestStatus } : row)),
  };
}

export async function listBookingRequests(status?: BookingRequestStatus) {
  if (!supabase) return [];
  const { orgId } = await ensureOrgContext();

  const selectFields = "id,customer_name,customer_phone,requested_service,preferred_staff,note,requested_start_at,requested_end_at,status,appointment_id,source,created_at";

  let query = supabase
    .from("booking_requests")
    .select(selectFields)
    .eq("org_id", orgId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (!error) {
    const rows = (data ?? []) as BookingRequestRow[];
    const { expiredIds, rows: patchedRows } = patchExpiredRows(rows);

    if (expiredIds.length > 0) {
      await supabase
        .from("booking_requests")
        .update({ status: "NEEDS_RESCHEDULE" })
        .eq("org_id", orgId)
        .in("id", expiredIds)
        .eq("status", "NEW");
    }

    return patchedRows;
  }

  const rpc = await supabase.rpc("list_booking_requests_secure", {
    p_status: status ?? null,
  });
  if (!rpc.error && rpc.data) {
    const rows = (rpc.data ?? []) as BookingRequestRow[];
    const { expiredIds, rows: patchedRows } = patchExpiredRows(rows);

    if (expiredIds.length > 0) {
      await supabase
        .from("booking_requests")
        .update({ status: "NEEDS_RESCHEDULE" })
        .eq("org_id", orgId)
        .in("id", expiredIds)
        .eq("status", "NEW");
    }

    return patchedRows;
  }

  throw error;
}

export async function countNewBookingRequests() {
  if (!supabase) return 0;
  const { orgId } = await ensureOrgContext();

  const { count, error } = await supabase
    .from("booking_requests")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", ["NEW", "NEEDS_RESCHEDULE"]);

  if (error) throw error;
  return count ?? 0;
}

export async function updateBookingRequestStatus(id: string, status: BookingRequestStatus) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { orgId } = await ensureOrgContext();

  const { error } = await supabase
    .from("booking_requests")
    .update({ status })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) throw error;
}

export async function deleteBookingRequest(id: string) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { orgId } = await ensureOrgContext();

  const { error } = await supabase
    .from("booking_requests")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) throw error;
}

export async function checkAppointmentCapacity(input: {
  bookingRequestId?: string | null;
  startAt: string;
  endAt: string;
}) {
  const appointments = await listAppointments({ force: true }) as Array<{
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    customers?: { name?: string } | { name?: string }[] | null;
  }>;

  const activeResources = await listResources({ force: true, activeOnly: true }) as Array<{ id: string; active?: boolean }>;
  const activeCapacity = activeResources.length;
  const maxSimultaneous = activeCapacity > 0 ? activeCapacity : 1;

  const overlaps = appointments.filter((row) => {
    if (!["BOOKED", "CHECKED_IN", "IN_SERVICE"].includes(row.status)) return false;
    return new Date(row.start_at).getTime() < new Date(input.endAt).getTime()
      && new Date(row.end_at).getTime() > new Date(input.startAt).getTime();
  });

  return {
    overlaps,
    overlapCount: overlaps.length,
    allowed: overlaps.length < maxSimultaneous,
    maxSimultaneous,
  };
}

export async function convertBookingRequestToAppointment(input: {
  bookingRequestId: string;
  staffUserId?: string | null;
  resourceId?: string | null;
  startAt?: string | null;
  endAt?: string | null;
}) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");

  const { data, error } = await supabase.rpc("convert_booking_request_to_appointment_secure", {
    p_booking_request_id: input.bookingRequestId,
    p_staff_user_id: input.staffUserId ?? null,
    p_resource_id: input.resourceId ?? null,
    p_start_at: input.startAt ?? null,
    p_end_at: input.endAt ?? null,
  });

  if (error) {
    const message = [error.message, (error as { details?: string }).details, (error as { hint?: string }).hint]
      .filter(Boolean)
      .join(" | ");
    throw new Error(message || "Không convert được booking request");
  }

  return data as { booking_request_id: string; appointment_id: string; status: string };
}
