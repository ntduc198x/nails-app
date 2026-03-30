import { supabase } from "@/lib/supabase";
import { ensureOrgContext } from "@/lib/domain";

export type BookingRequestRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  requested_service?: string | null;
  preferred_staff?: string | null;
  note?: string | null;
  requested_start_at: string;
  requested_end_at: string;
  status: "NEW" | "CONFIRMED" | "CANCELLED" | "CONVERTED";
  appointment_id?: string | null;
  source?: string | null;
  created_at: string;
};

export async function listBookingRequests(status?: BookingRequestRow["status"]) {
  if (!supabase) return [];
  const { orgId } = await ensureOrgContext();

  let query = supabase
    .from("booking_requests")
    .select("id,customer_name,customer_phone,requested_service,preferred_staff,note,requested_start_at,requested_end_at,status,appointment_id,source,created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as BookingRequestRow[];
}

export async function countNewBookingRequests() {
  if (!supabase) return 0;
  const { orgId } = await ensureOrgContext();

  const { count, error } = await supabase
    .from("booking_requests")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "NEW");

  if (error) throw error;
  return count ?? 0;
}

export async function updateBookingRequestStatus(id: string, status: BookingRequestRow["status"]) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { orgId } = await ensureOrgContext();

  const { error } = await supabase
    .from("booking_requests")
    .update({ status })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) throw error;
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
