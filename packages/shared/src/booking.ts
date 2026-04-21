import type { SharedSupabaseClient } from "./org";
import { ensureOrgContext } from "./org";
import type { PublicBookingInput } from "./validation";
import { publicBookingInputSchema } from "./validation";

export type BookingRequestStatus = "NEW" | "CONFIRMED" | "NEEDS_RESCHEDULE" | "CANCELLED" | "CONVERTED";

export type BookingRequestAppointmentResult = {
  booking_request_id: string;
  appointment_id: string;
  status: string;
};

export type MobileBookingRequestSummary = {
  id: string;
  customerName: string;
  customerPhone: string | null;
  requestedService: string | null;
  preferredStaff: string | null;
  note: string | null;
  requestedStartAt: string;
  requestedEndAt: string;
  status: BookingRequestStatus;
  appointmentId: string | null;
  source: string | null;
  createdAt: string;
};

export interface BookingRequestApiResponse<TData = unknown, TBookingRequest = unknown> {
  ok: boolean;
  data?: TData;
  bookingRequest?: TBookingRequest;
  telegramNotification?: unknown;
  error?: string;
}

export type PublicBookingSubmissionResult<TData = unknown> = {
  bookingRequestId: string | null;
  bookingRequestStatus: string | null;
  data: TData | null;
  telegramNotification: unknown;
};

function patchExpiredRows(rows: MobileBookingRequestSummary[]) {
  const now = Date.now();
  const expiredIds = rows
    .filter((row) => row.status === "NEW" && new Date(row.requestedStartAt).getTime() < now)
    .map((row) => row.id);

  return {
    expiredIds,
    rows: rows.map((row) =>
      expiredIds.includes(row.id) ? { ...row, status: "NEEDS_RESCHEDULE" as BookingRequestStatus } : row,
    ),
  };
}

function extractBookingRequestId<TBookingRequest>(
  json: BookingRequestApiResponse<unknown, TBookingRequest>,
): string | null {
  if (typeof json.data === "string" && json.data) {
    return json.data;
  }

  if (typeof json.data === "object" && json.data) {
    const data = json.data as Record<string, unknown>;
    const fromData = data.booking_request_id ?? data.id;
    if (typeof fromData === "string" && fromData) {
      return fromData;
    }
  }

  if (typeof json.bookingRequest === "object" && json.bookingRequest) {
    const bookingRequest = json.bookingRequest as Record<string, unknown>;
    if (typeof bookingRequest.id === "string" && bookingRequest.id) {
      return bookingRequest.id;
    }
  }

  return null;
}

function extractBookingRequestStatus<TBookingRequest>(
  json: BookingRequestApiResponse<unknown, TBookingRequest>,
): string | null {
  if (typeof json.bookingRequest === "object" && json.bookingRequest) {
    const bookingRequest = json.bookingRequest as Record<string, unknown>;
    if (typeof bookingRequest.status === "string" && bookingRequest.status) {
      return bookingRequest.status;
    }
  }

  return null;
}

export async function createPublicBookingRequest<
  TData = unknown,
  TBookingRequest = unknown,
>(
  input: PublicBookingInput,
  options?: {
    baseUrl?: string;
    fetcher?: typeof fetch;
  },
) {
  const payload = publicBookingInputSchema.parse(input);
  const fetcher = options?.fetcher ?? fetch;
  const endpoint = options?.baseUrl
    ? new URL("/api/booking-request", options.baseUrl).toString()
    : "/api/booking-request";

  const res = await fetcher(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = (await res.json()) as BookingRequestApiResponse<TData, TBookingRequest>;

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Khong tao duoc booking request");
  }

  return {
    bookingRequestId: extractBookingRequestId(json),
    bookingRequestStatus: extractBookingRequestStatus(json),
    data: (json.data as TData | undefined) ?? null,
    telegramNotification: json.telegramNotification ?? null,
  } satisfies PublicBookingSubmissionResult<TData>;
}

export async function listBookingRequestsForMobile(
  client: SharedSupabaseClient,
): Promise<MobileBookingRequestSummary[]> {
  const { orgId } = await ensureOrgContext(client);

  const selectFields =
    "id,customer_name,customer_phone,requested_service,preferred_staff,note,requested_start_at,requested_end_at,status,appointment_id,source,created_at";

  const direct = await client
    .from("booking_requests")
    .select(selectFields)
    .eq("org_id", orgId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (!direct.error) {
    const rows = (direct.data ?? []).map((row) => ({
      id: String(row.id ?? ""),
      customerName: String(row.customer_name ?? ""),
      customerPhone: typeof row.customer_phone === "string" ? row.customer_phone : null,
      requestedService: typeof row.requested_service === "string" ? row.requested_service : null,
      preferredStaff: typeof row.preferred_staff === "string" ? row.preferred_staff : null,
      note: typeof row.note === "string" ? row.note : null,
      requestedStartAt: String(row.requested_start_at ?? ""),
      requestedEndAt: String(row.requested_end_at ?? ""),
      status: String(row.status ?? "NEW") as BookingRequestStatus,
      appointmentId: typeof row.appointment_id === "string" ? row.appointment_id : null,
      source: typeof row.source === "string" ? row.source : null,
      createdAt: String(row.created_at ?? ""),
    }));

    const patched = patchExpiredRows(rows);
    if (patched.expiredIds.length > 0) {
      await client
        .from("booking_requests")
        .update({ status: "NEEDS_RESCHEDULE" })
        .eq("org_id", orgId)
        .in("id", patched.expiredIds)
        .eq("status", "NEW");
    }

    return patched.rows;
  }

  const rpc = await client.rpc("list_booking_requests_secure", {
    p_status: null,
  });

  if (rpc.error) {
    throw rpc.error;
  }

  const rows = ((rpc.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id ?? ""),
    customerName: String(row.customer_name ?? ""),
    customerPhone: typeof row.customer_phone === "string" ? row.customer_phone : null,
    requestedService: typeof row.requested_service === "string" ? row.requested_service : null,
    preferredStaff: typeof row.preferred_staff === "string" ? row.preferred_staff : null,
    note: typeof row.note === "string" ? row.note : null,
    requestedStartAt: String(row.requested_start_at ?? ""),
    requestedEndAt: String(row.requested_end_at ?? ""),
    status: String(row.status ?? "NEW") as BookingRequestStatus,
    appointmentId: typeof row.appointment_id === "string" ? row.appointment_id : null,
    source: typeof row.source === "string" ? row.source : null,
    createdAt: String(row.created_at ?? ""),
  }));

  const patched = patchExpiredRows(rows);
  if (patched.expiredIds.length > 0) {
    await client
      .from("booking_requests")
      .update({ status: "NEEDS_RESCHEDULE" })
      .eq("org_id", orgId)
      .in("id", patched.expiredIds)
      .eq("status", "NEW");
  }

  return patched.rows;
}

export async function updateBookingRequestStatusForMobile(
  client: SharedSupabaseClient,
  id: string,
  status: BookingRequestStatus,
) {
  const { orgId } = await ensureOrgContext(client);

  const { error } = await client
    .from("booking_requests")
    .update({ status })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) {
    throw error;
  }
}

export async function updateBookingRequestForMobile(
  client: SharedSupabaseClient,
  input: {
    id: string;
    status?: BookingRequestStatus;
    requestedStartAt?: string | null;
    requestedEndAt?: string | null;
    preferredStaff?: string | null;
  },
) {
  const { orgId } = await ensureOrgContext(client);
  const payload: Record<string, string | null> = {};

  if (typeof input.status === "string") {
    payload.status = input.status;
  }
  if (input.requestedStartAt !== undefined) {
    payload.requested_start_at = input.requestedStartAt;
  }
  if (input.requestedEndAt !== undefined) {
    payload.requested_end_at = input.requestedEndAt;
  }
  if (input.preferredStaff !== undefined) {
    payload.preferred_staff = input.preferredStaff;
  }

  const { error } = await client
    .from("booking_requests")
    .update(payload)
    .eq("id", input.id)
    .eq("org_id", orgId);

  if (error) {
    throw error;
  }
}

export async function deleteBookingRequestForMobile(
  client: SharedSupabaseClient,
  id: string,
) {
  const { orgId } = await ensureOrgContext(client);

  const { error } = await client
    .from("booking_requests")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) {
    throw error;
  }
}

export async function convertBookingRequestToAppointmentForMobile(
  client: SharedSupabaseClient,
  input: {
    bookingRequestId: string;
    staffUserId?: string | null;
    resourceId?: string | null;
    startAt?: string | null;
    endAt?: string | null;
  },
): Promise<BookingRequestAppointmentResult> {
  const { data, error } = await client.rpc("convert_booking_request_to_appointment_secure", {
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
      throw new Error("Chua co default branch de tao lich.");
    }
    if (rawMessage.includes("BOOKING_START_REQUIRED")) {
      throw new Error("Thieu thoi gian chot lich.");
    }
    if (rawMessage.includes("INVALID_TIME_RANGE")) {
      throw new Error("Khoang thoi gian khong hop le.");
    }
    if (rawMessage.includes("BOOKING_REQUEST_ALREADY_FINALIZED")) {
      throw new Error("Booking nay da duoc xu ly truoc do.");
    }
    if (rawMessage.includes("BOOKING_REQUEST_NOT_FOUND")) {
      throw new Error("Khong tim thay booking request.");
    }
    if (rawMessage.includes("FORBIDDEN")) {
      throw new Error("Tai khoan hien tai khong co quyen tao lich tu booking nay.");
    }

    throw new Error(rawMessage || "Khong convert duoc booking request");
  }

  return data as BookingRequestAppointmentResult;
}

export type { PublicBookingInput } from "./validation";
