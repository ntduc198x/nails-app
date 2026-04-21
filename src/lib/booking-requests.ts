import { supabase } from "@/lib/supabase";
import { ensureOrgContext } from "@/lib/domain";
import { getBookingWindowCapacitySnapshot, rebalanceOpenBookingRequests } from "@/lib/booking-capacity";

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
    const rebalance = await rebalanceOpenBookingRequests({ orgId });

    if (expiredIds.length > 0) {
      await supabase
        .from("booking_requests")
        .update({ status: "NEEDS_RESCHEDULE" })
        .eq("org_id", orgId)
        .in("id", expiredIds)
        .eq("status", "NEW");
    }

    if (expiredIds.length > 0 || rebalance.changedCount > 0) {
      const refresh = await supabase
        .from("booking_requests")
        .select(selectFields)
        .eq("org_id", orgId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (!refresh.error) {
        return patchExpiredRows((refresh.data ?? []) as BookingRequestRow[]).rows;
      }
    }

    return patchedRows;
  }

  const rpc = await supabase.rpc("list_booking_requests_secure", {
    p_status: status ?? null,
  });
  if (!rpc.error && rpc.data) {
    const rows = (rpc.data ?? []) as BookingRequestRow[];
    const { expiredIds, rows: patchedRows } = patchExpiredRows(rows);
    const rebalance = await rebalanceOpenBookingRequests({ orgId });

    if (expiredIds.length > 0) {
      await supabase
        .from("booking_requests")
        .update({ status: "NEEDS_RESCHEDULE" })
        .eq("org_id", orgId)
        .in("id", expiredIds)
        .eq("status", "NEW");
    }

    if (expiredIds.length > 0 || rebalance.changedCount > 0) {
      const refresh = await supabase
        .from("booking_requests")
        .select(selectFields)
        .eq("org_id", orgId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (!refresh.error) {
        return patchExpiredRows((refresh.data ?? []) as BookingRequestRow[]).rows;
      }
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
  await rebalanceOpenBookingRequests({ orgId });
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
  await rebalanceOpenBookingRequests({ orgId });
}

export async function checkAppointmentCapacity(input: {
  bookingRequestId?: string | null;
  startAt: string;
  endAt: string;
}) {
  const { orgId } = await ensureOrgContext();
  await rebalanceOpenBookingRequests({ orgId });
  const result = await getBookingWindowCapacitySnapshot({
    orgId,
    startAt: input.startAt,
    endAt: input.endAt,
    excludeBookingRequestId: input.bookingRequestId ?? null,
  });

  return {
    overlaps: result.overlaps,
    overlapCount: result.overlapCount,
    allowed: result.allowed,
    maxSimultaneous: result.maxSimultaneous,
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
    const rawMessage = [error.message, (error as { details?: string }).details, (error as { hint?: string }).hint]
      .filter(Boolean)
      .join(" | ");

    if (rawMessage.includes("DEFAULT_BRANCH_REQUIRED")) {
      throw new Error("Chưa có chi nhánh mặc định để tạo lịch. Hãy cấu hình default_branch_id cho tài khoản hoặc booking này.");
    }
    if (rawMessage.includes("BOOKING_START_REQUIRED")) {
      throw new Error("Thiếu thời gian chốt lịch mới.");
    }
    if (rawMessage.includes("INVALID_TIME_RANGE")) {
      throw new Error("Khoảng thời gian không hợp lệ.");
    }
    if (rawMessage.includes("BOOKING_REQUEST_ALREADY_FINALIZED")) {
      throw new Error("Booking này đã được xử lý trước đó.");
    }
    if (rawMessage.includes("BOOKING_REQUEST_NOT_FOUND")) {
      throw new Error("Không tìm thấy booking request.");
    }
    if (rawMessage.includes("FORBIDDEN")) {
      throw new Error("Tài khoản hiện tại không có quyền tạo lịch từ booking này.");
    }

    throw new Error(rawMessage || "Không convert được booking request");
  }

  const { orgId } = await ensureOrgContext();
  await rebalanceOpenBookingRequests({ orgId });

  return data as { booking_request_id: string; appointment_id: string; status: string };
}
