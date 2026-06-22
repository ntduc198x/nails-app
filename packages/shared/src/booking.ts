import type { ObserverScopeInput, SharedSupabaseClient } from "./org";
import { DEFAULT_LOCALE, translate } from "./i18n";
import { ensureOrgContext, resolveMobileAdminViewContext } from "./org";
import { APPOINTMENT_TIME_PAST_ERROR, assertAppointmentTimeNotPast } from "./appointments";
import type { PublicBookingInput } from "./validation";
import { publicBookingInputSchema } from "./validation";

export type BookingRequestStatus =
  | "NEW"
  | "CONFIRMED"
  | "NEEDS_RESCHEDULE"
  | "CANCELLED"
  | "CONVERTED"
  | "EXPIRED_UNCONFIRMED";

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
  updatedAt: string | null;
};

export const BOOKING_REQUEST_AUTO_CANCEL_RESCHEDULE_DAYS = 3;

export type BookingRequestCleanupResult = {
  autoCancelledCount: number;
  cleanupError: string | null;
  autoCancelledBookings: Array<{
    id: string;
    customerName: string;
    requestedService: string | null;
    requestedStartAt: string;
    referenceAt: string;
  }>;
};

export interface BookingRequestApiResponse<TData = unknown, TBookingRequest = unknown> {
  ok: boolean;
  data?: TData;
  bookingRequest?: TBookingRequest;
  telegramNotification?: unknown;
  message?: string;
  error?: string;
}

export type PublicBookingSubmissionResult<TData = unknown> = {
  bookingRequestId: string | null;
  bookingRequestStatus: string | null;
  data: TData | null;
  telegramNotification: unknown;
  successMessage: string | null;
};

type BookingRequestRow = {
  id?: unknown;
  customer_name?: unknown;
  customer_phone?: unknown;
  requested_service?: unknown;
  preferred_staff?: unknown;
  note?: unknown;
  requested_start_at?: unknown;
  requested_end_at?: unknown;
  status?: unknown;
  appointment_id?: unknown;
  source?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

function mapBookingRequestRow(row: BookingRequestRow): MobileBookingRequestSummary {
  return {
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
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

async function persistPatchedBookingRequestStatuses(
  client: SharedSupabaseClient,
  input: {
    orgId: string;
    branchId?: string | null;
    expiredIds: string[];
    autoCancelledIds: string[];
  },
) {
  const { orgId, branchId, expiredIds, autoCancelledIds } = input;

  if (expiredIds.length > 0) {
    await client
      .from("booking_requests")
      .update({ status: "EXPIRED_UNCONFIRMED" })
      .eq("org_id", orgId)
      .in("id", expiredIds)
      .eq("status", "NEW");
  }

  if (autoCancelledIds.length > 0) {
    let cancelQuery = client
      .from("booking_requests")
      .update({ status: "CANCELLED" })
      .eq("org_id", orgId)
      .in("id", autoCancelledIds)
      .eq("status", "NEEDS_RESCHEDULE");

    if (branchId) {
      cancelQuery = cancelQuery.eq("branch_id", branchId);
    }

    await cancelQuery;
  }
}

function patchExpiredRows(rows: MobileBookingRequestSummary[]) {
  const now = Date.now();
  const expiredIds = rows
    .filter((row) => row.status === "NEW" && new Date(row.requestedStartAt).getTime() < now)
    .map((row) => row.id);

  return {
    expiredIds,
    rows: rows.map((row) =>
      expiredIds.includes(row.id) ? { ...row, status: "EXPIRED_UNCONFIRMED" as BookingRequestStatus } : row,
    ),
  };
}

function getBookingRequestRescheduleReferenceMs(row: Pick<MobileBookingRequestSummary, "status" | "updatedAt" | "createdAt">) {
  const referenceValue = row.updatedAt ?? row.createdAt;
  const referenceMs = new Date(referenceValue).getTime();
  return Number.isFinite(referenceMs) ? referenceMs : 0;
}

function patchAutoCancelledRescheduleRows(rows: MobileBookingRequestSummary[]) {
  const thresholdMs = Date.now() - BOOKING_REQUEST_AUTO_CANCEL_RESCHEDULE_DAYS * 24 * 60 * 60 * 1000;
  const autoCancelledIds = rows
    .filter((row) => row.status === "NEEDS_RESCHEDULE")
    .filter((row) => getBookingRequestRescheduleReferenceMs(row) <= thresholdMs)
    .map((row) => row.id);

  return {
    autoCancelledIds,
    rows: rows.map((row) =>
      autoCancelledIds.includes(row.id) ? { ...row, status: "CANCELLED" as BookingRequestStatus } : row,
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
    timeoutMs?: number;
  },
) {
  const payload = publicBookingInputSchema.parse(input);
  const fetcher = options?.fetcher ?? fetch;
  const endpoint = options?.baseUrl
    ? new URL("/api/booking-request", options.baseUrl).toString()
    : "/api/booking-request";
  const timeoutMs = options?.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("BOOKING_API_TIMEOUT"), timeoutMs);

  let res: Response;
  try {
    res = await fetcher(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (
      (error instanceof Error && error.name === "AbortError") ||
      error === "BOOKING_API_TIMEOUT"
    ) {
      throw new Error("BOOKING_API_TIMEOUT");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const rawText = await res.text();
  let json: BookingRequestApiResponse<TData, TBookingRequest> | null = null;

  try {
    json = rawText ? (JSON.parse(rawText) as BookingRequestApiResponse<TData, TBookingRequest>) : null;
  } catch {
    const preview = rawText.slice(0, 160).trim();
    throw new Error(preview ? `BOOKING_API_NON_JSON:${preview}` : "BOOKING_API_NON_JSON");
  }

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Khong tao duoc booking request");
  }

  return {
    bookingRequestId: extractBookingRequestId(json),
    bookingRequestStatus: extractBookingRequestStatus(json),
    data: (json.data as TData | undefined) ?? null,
    telegramNotification: json.telegramNotification ?? null,
    successMessage: typeof json.message === "string" && json.message ? json.message : null,
  } satisfies PublicBookingSubmissionResult<TData>;
}

export async function createPublicBookingRequestForMobile(
  client: SharedSupabaseClient,
  input: PublicBookingInput,
) {
  const payload = publicBookingInputSchema.parse(input);
  const { data, error } = await client.rpc("create_booking_request_public", {
    p_branch_id: payload.branchId ?? null,
    p_customer_name: payload.customerName,
    p_customer_phone: payload.customerPhone,
    p_requested_service: payload.requestedService ?? null,
    p_preferred_staff: payload.preferredStaff ?? null,
    p_note: payload.note ?? null,
    p_requested_start_at: payload.requestedStartAt,
    p_requested_end_at: payload.requestedEndAt ?? null,
    p_source: payload.source ?? "mobile_guest",
    p_applied_offer_id: payload.appliedOfferId ?? null,
    p_applied_offer_claim_id: payload.appliedOfferClaimId ?? null,
    p_applied_offer_code: payload.appliedOfferCode ?? null,
  });

  if (error) {
    const message = [error.message, (error as { details?: string }).details, (error as { hint?: string }).hint]
      .filter(Boolean)
      .join(" | ");
    throw new Error(message || "Khong tao duoc booking request");
  }

  const bookingRequestId = typeof data === "string"
    ? data
    : typeof data === "object" && data
      ? String((data as { booking_request_id?: string; id?: string }).booking_request_id ?? (data as { id?: string }).id ?? "")
      : "";

  const bookingRequestStatus = typeof data === "object" && data && typeof (data as { status?: string }).status === "string"
    ? (data as { status: string }).status
    : bookingRequestId
      ? "NEW"
      : null;

  return {
    bookingRequestId: bookingRequestId || null,
    bookingRequestStatus,
    data: null,
    telegramNotification: null,
    successMessage: bookingRequestId ? "Đã gửi yêu cầu thành công" : null,
  } satisfies PublicBookingSubmissionResult<null>;
}

export async function listBookingRequestsForMobile(
  client: SharedSupabaseClient,
  options?: { observerScope?: ObserverScopeInput | null },
): Promise<MobileBookingRequestSummary[]> {
  const view = await resolveMobileAdminViewContext(client, options?.observerScope);

  const selectFields =
    "id,customer_name,customer_phone,requested_service,preferred_staff,note,requested_start_at,requested_end_at,status,appointment_id,source,created_at,updated_at";

  let directQuery = client
    .from("booking_requests")
    .select(selectFields)
    .eq("org_id", view.orgId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (view.viewBranchId) {
    directQuery = directQuery.eq("branch_id", view.viewBranchId);
  }

  const direct = await directQuery;
  let directData = direct.data ?? [];
  let directError = direct.error;

  if (directError?.message?.includes("updated_at")) {
    let fallbackQuery = client
      .from("booking_requests")
      .select("id,customer_name,customer_phone,requested_service,preferred_staff,note,requested_start_at,requested_end_at,status,appointment_id,source,created_at")
      .eq("org_id", view.orgId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (view.viewBranchId) {
      fallbackQuery = fallbackQuery.eq("branch_id", view.viewBranchId);
    }

    const fallback = await fallbackQuery;
    directData = (fallback.data ?? []).map((row) => ({ ...row, updated_at: null }));
    directError = fallback.error;
  }

  if (!directError) {
    const rows = directData.map((row) => mapBookingRequestRow(row as BookingRequestRow));

    const expiredPatched = patchExpiredRows(rows);
    const autoCancelledPatched = patchAutoCancelledRescheduleRows(expiredPatched.rows);
    await persistPatchedBookingRequestStatuses(client, {
      orgId: view.orgId,
      branchId: view.viewBranchId,
      expiredIds: expiredPatched.expiredIds,
      autoCancelledIds: autoCancelledPatched.autoCancelledIds,
    });

    return autoCancelledPatched.rows;
  }

  const rpc = await client.rpc("list_booking_requests_secure", {
    p_status: null,
  });

  if (rpc.error) {
    throw rpc.error;
  }

  const rows = ((rpc.data ?? []) as BookingRequestRow[]).map(mapBookingRequestRow);

  const expiredPatched = patchExpiredRows(rows);
  const autoCancelledPatched = patchAutoCancelledRescheduleRows(expiredPatched.rows);
  await persistPatchedBookingRequestStatuses(client, {
    orgId: view.orgId,
    branchId: view.viewBranchId,
    expiredIds: expiredPatched.expiredIds,
    autoCancelledIds: autoCancelledPatched.autoCancelledIds,
  });

  return autoCancelledPatched.rows;
}

export async function cleanupRescheduleBookingRequestsForMobile(
  client: SharedSupabaseClient,
  options?: { observerScope?: ObserverScopeInput | null },
): Promise<BookingRequestCleanupResult> {
  const view = await resolveMobileAdminViewContext(client, options?.observerScope);
  const thresholdMs = Date.now() - BOOKING_REQUEST_AUTO_CANCEL_RESCHEDULE_DAYS * 24 * 60 * 60 * 1000;

  let query = client
    .from("booking_requests")
    .select("id,customer_name,requested_service,requested_start_at,created_at,updated_at")
    .eq("org_id", view.orgId)
    .eq("status", "NEEDS_RESCHEDULE")
    .limit(200);

  if (view.viewBranchId) {
    query = query.eq("branch_id", view.viewBranchId);
  }

  let { data, error } = await query;

  if (error?.message?.includes("updated_at")) {
    let fallbackQuery = client
      .from("booking_requests")
      .select("id,customer_name,requested_service,requested_start_at,created_at")
      .eq("org_id", view.orgId)
      .eq("status", "NEEDS_RESCHEDULE")
      .limit(200);

    if (view.viewBranchId) {
      fallbackQuery = fallbackQuery.eq("branch_id", view.viewBranchId);
    }

    const fallback = await fallbackQuery;
    data = (fallback.data ?? []).map((row) => ({ ...row, updated_at: null }));
    error = fallback.error;
  }

  if (error) {
    return {
      autoCancelledCount: 0,
      cleanupError: error.message || "Khong the tu dong huy booking can doi lich.",
      autoCancelledBookings: [],
    };
  }

  const candidates = (data ?? []) as Array<Record<string, unknown>>;
  const autoCancelledBookings = candidates
    .map((row) => {
      const referenceAt =
        typeof row.updated_at === "string" && row.updated_at
          ? row.updated_at
          : String(row.created_at ?? "");
      const referenceMs = new Date(referenceAt).getTime();
      if (!Number.isFinite(referenceMs) || referenceMs > thresholdMs) {
        return null;
      }

      return {
        id: typeof row.id === "string" ? row.id : "",
        customerName: typeof row.customer_name === "string" ? row.customer_name : "-",
        requestedService: typeof row.requested_service === "string" ? row.requested_service : null,
        requestedStartAt: String(row.requested_start_at ?? ""),
        referenceAt,
      };
    })
    .filter(
      (
        row,
      ): row is {
        id: string;
        customerName: string;
        requestedService: string | null;
        requestedStartAt: string;
        referenceAt: string;
      } => Boolean(row?.id),
    );

  const autoCancelledIds = autoCancelledBookings.map((row) => row.id);

  if (autoCancelledIds.length === 0) {
    return {
      autoCancelledCount: 0,
      cleanupError: null,
      autoCancelledBookings: [],
    };
  }

  let updateQuery = client
    .from("booking_requests")
    .update({ status: "CANCELLED" })
    .eq("org_id", view.orgId)
    .in("id", autoCancelledIds)
    .eq("status", "NEEDS_RESCHEDULE");

  if (view.viewBranchId) {
    updateQuery = updateQuery.eq("branch_id", view.viewBranchId);
  }

  const { error: cleanupError } = await updateQuery;
  if (cleanupError) {
    return {
      autoCancelledCount: 0,
      cleanupError: cleanupError.message || "Khong the tu dong huy booking can doi lich.",
      autoCancelledBookings: [],
    };
  }

  return {
    autoCancelledCount: autoCancelledIds.length,
    cleanupError: null,
    autoCancelledBookings,
  };
}

export async function updateBookingRequestStatusForMobile(
  client: SharedSupabaseClient,
  id: string,
  status: BookingRequestStatus,
) {
  const { orgId, branchId } = await ensureOrgContext(client);

  const { error } = await client
    .from("booking_requests")
    .update({ status })
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("branch_id", branchId);

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
  const { orgId, branchId } = await ensureOrgContext(client);
  const payload: Record<string, string | null> = {};

  if (input.requestedStartAt !== undefined && input.requestedStartAt !== null) {
    assertAppointmentTimeNotPast(input.requestedStartAt);
  }

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
    .eq("org_id", orgId)
    .eq("branch_id", branchId);

  if (error) {
    throw error;
  }
}

export async function deleteBookingRequestForMobile(
  client: SharedSupabaseClient,
  id: string,
) {
  const { orgId, branchId } = await ensureOrgContext(client);

  const { error } = await client
    .from("booking_requests")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("branch_id", branchId);

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
    secondaryResourceId?: string | null;
    startAt?: string | null;
    endAt?: string | null;
  },
): Promise<BookingRequestAppointmentResult> {
  if (input.startAt) {
    assertAppointmentTimeNotPast(input.startAt);
  }

  const { data, error } = await client.rpc("convert_booking_request_to_appointment_secure", {
    p_booking_request_id: input.bookingRequestId,
    p_staff_user_id: input.staffUserId ?? null,
    p_resource_id: input.resourceId ?? null,
    p_secondary_resource_id: input.secondaryResourceId ?? null,
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
    if (rawMessage.includes(APPOINTMENT_TIME_PAST_ERROR)) {
      throw new Error(`${APPOINTMENT_TIME_PAST_ERROR}:${translate(DEFAULT_LOCALE, "errors", "bookingTimePast")}`);
    }

    throw new Error(rawMessage || "Khong convert duoc booking request");
  }

  return data as BookingRequestAppointmentResult;
}

export type { PublicBookingInput } from "./validation";
