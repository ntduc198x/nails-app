import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as browserSupabase } from "@/lib/supabase";

export const ACTIVE_APPOINTMENT_STATUSES = ["BOOKED", "CHECKED_IN", "IN_SERVICE"] as const;
export const CAPACITY_HOLDING_BOOKING_STATUSES = ["NEW", "CONFIRMED"] as const;
export const OPEN_BOOKING_STATUSES = ["NEW", "CONFIRMED", "NEEDS_RESCHEDULE"] as const;

type CapacityClient = SupabaseClient;

export type AppointmentOverlapRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  customers?: { name?: string } | { name?: string }[] | null;
};

export type BookingRequestOverlapRow = {
  id: string;
  customer_name: string;
  requested_start_at: string;
  requested_end_at: string;
  status: string;
  created_at: string;
};

export type CapacityOverlapRow =
  | ({ kind: "appointment" } & AppointmentOverlapRow)
  | ({
      kind: "booking_request";
      start_at: string;
      end_at: string;
      customers: { name?: string };
    } & BookingRequestOverlapRow);

function requireClient(client?: CapacityClient) {
  const resolved = client ?? (browserSupabase as CapacityClient | null);
  if (!resolved) throw new Error("Supabase chưa cấu hình");
  return resolved;
}

function overlaps(startA: string, endA: string, startB: string, endB: string) {
  return new Date(startA).getTime() < new Date(endB).getTime()
    && new Date(endA).getTime() > new Date(startB).getTime();
}

export async function getActiveResourceCapacity(input: {
  client?: CapacityClient;
  orgId: string;
}) {
  const client = requireClient(input.client);
  const { count, error } = await client
    .from("resources")
    .select("id", { count: "exact", head: true })
    .eq("org_id", input.orgId)
    .eq("active", true);

  if (error) throw error;
  return Math.max(count ?? 0, 1);
}

export async function listCapacityAppointments(input: {
  client?: CapacityClient;
  orgId: string;
}) {
  const client = requireClient(input.client);
  const { data, error } = await client
    .from("appointments")
    .select("id,start_at,end_at,status,customers(name)")
    .eq("org_id", input.orgId)
    .in("status", [...ACTIVE_APPOINTMENT_STATUSES])
    .order("start_at", { ascending: true })
    .limit(500);

  if (error) throw error;
  return (data ?? []) as AppointmentOverlapRow[];
}

export async function listOpenBookingRequestsForCapacity(input: {
  client?: CapacityClient;
  orgId: string;
}) {
  const client = requireClient(input.client);
  const { data, error } = await client
    .from("booking_requests")
    .select("id,customer_name,requested_start_at,requested_end_at,status,created_at")
    .eq("org_id", input.orgId)
    .in("status", [...OPEN_BOOKING_STATUSES])
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) throw error;
  return (data ?? []) as BookingRequestOverlapRow[];
}

export async function rebalanceOpenBookingRequests(input: {
  client?: CapacityClient;
  orgId: string;
}) {
  const client = requireClient(input.client);
  const [maxSimultaneous, appointments, bookingRequests] = await Promise.all([
    getActiveResourceCapacity(input),
    listCapacityAppointments(input),
    listOpenBookingRequestsForCapacity(input),
  ]);

  const now = Date.now();
  const acceptedRequests: Array<BookingRequestOverlapRow & { desiredStatus: "NEW" | "CONFIRMED" }> = [];
  const updates: Array<{ id: string; status: "NEW" | "NEEDS_RESCHEDULE" | "CONFIRMED" }> = [];

  for (const row of bookingRequests) {
    const startAt = row.requested_start_at;
    const endAt = row.requested_end_at;

    if (!startAt || !endAt) continue;

    let desiredStatus: "NEW" | "NEEDS_RESCHEDULE" | "CONFIRMED";

    if (new Date(startAt).getTime() < now) {
      desiredStatus = "NEEDS_RESCHEDULE";
    } else {
      const overlappingAppointments = appointments.filter((appointment) =>
        overlaps(appointment.start_at, appointment.end_at, startAt, endAt),
      );
      const overlappingAcceptedRequests = acceptedRequests.filter((accepted) =>
        overlaps(accepted.requested_start_at, accepted.requested_end_at, startAt, endAt),
      );

      const occupied = overlappingAppointments.length + overlappingAcceptedRequests.length;
      desiredStatus = occupied < maxSimultaneous
        ? (row.status === "CONFIRMED" ? "CONFIRMED" : "NEW")
        : "NEEDS_RESCHEDULE";
    }

    if (desiredStatus !== "NEEDS_RESCHEDULE") {
      acceptedRequests.push({ ...row, desiredStatus });
    }

    if (row.status !== desiredStatus) {
      updates.push({ id: row.id, status: desiredStatus });
    }
  }

  for (const update of updates) {
    const { error } = await client
      .from("booking_requests")
      .update({ status: update.status })
      .eq("id", update.id)
      .eq("org_id", input.orgId);

    if (error) throw error;
  }

  return {
    maxSimultaneous,
    changedCount: updates.length,
  };
}

export async function getBookingWindowCapacitySnapshot(input: {
  client?: CapacityClient;
  orgId: string;
  startAt: string;
  endAt: string;
  excludeBookingRequestId?: string | null;
}) {
  const [maxSimultaneous, appointments, bookingRequests] = await Promise.all([
    getActiveResourceCapacity(input),
    listCapacityAppointments(input),
    listOpenBookingRequestsForCapacity(input),
  ]);

  const overlappingAppointments = appointments.filter((appointment) =>
    overlaps(appointment.start_at, appointment.end_at, input.startAt, input.endAt),
  );

  const overlappingBookingRequests = bookingRequests.filter((row) =>
    row.id !== input.excludeBookingRequestId
    && CAPACITY_HOLDING_BOOKING_STATUSES.includes(row.status as (typeof CAPACITY_HOLDING_BOOKING_STATUSES)[number])
    && overlaps(row.requested_start_at, row.requested_end_at, input.startAt, input.endAt),
  );

  const overlapsForDisplay: CapacityOverlapRow[] = [
    ...overlappingAppointments.map((row) => ({ kind: "appointment" as const, ...row })),
    ...overlappingBookingRequests.map((row) => ({
      kind: "booking_request" as const,
      ...row,
      start_at: row.requested_start_at,
      end_at: row.requested_end_at,
      customers: { name: row.customer_name },
    })),
  ].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  const occupiedCount = overlappingAppointments.length + overlappingBookingRequests.length;

  return {
    maxSimultaneous,
    appointmentOverlaps: overlappingAppointments,
    bookingRequestOverlaps: overlappingBookingRequests,
    overlaps: overlapsForDisplay,
    overlapCount: occupiedCount,
    allowed: occupiedCount < maxSimultaneous,
  };
}
