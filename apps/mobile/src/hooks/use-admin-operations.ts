import { useCallback, useEffect, useState } from "react";
import {
  type AppRole,
  type AppointmentStatus,
  type CustomerCrmSummary,
  type MobileCheckoutService,
  type MobileRecentTicketSummary,
  type CrmDashboardMetrics,
  type MobileAppointmentSummary,
  type MobileBookingRequestSummary,
  type MobileDashboardSnapshot,
  createCheckoutForMobile,
  deleteAppointmentForMobile,
  convertBookingRequestToAppointmentForMobile,
  deleteBookingRequestForMobile,
  ensureOrgContext,
  getCrmDashboardMetricsForMobile,
  getDashboardSnapshotForMobile,
  hasOpenShiftForMobile,
  listAppointmentsForMobile,
  listBookingRequestsForMobile,
  listCustomersCrmForMobile,
  listRecentTicketsForMobile,
  listServicesForMobile,
  saveAppointmentForMobile,
  updateBookingRequestForMobile,
  updateAppointmentStatusForMobile,
  updateBookingRequestStatusForMobile,
} from "@nails/shared";
import { mobileSupabase } from "@/src/lib/supabase";
import { useSession } from "@/src/providers/session-provider";

export type StaffOption = {
  roleId?: string;
  userId: string;
  name: string;
};

export type ResourceOption = {
  id: string;
  name: string;
  type: string;
};

type AdminOperationsState = {
  dashboard: MobileDashboardSnapshot | null;
  bookingRequests: MobileBookingRequestSummary[];
  appointments: MobileAppointmentSummary[];
  crmMetrics: CrmDashboardMetrics | null;
  staffOptions: StaffOption[];
  resourceOptions: ResourceOption[];
  checkoutServices: MobileCheckoutService[];
  recentTickets: MobileRecentTicketSummary[];
  techShiftOpen: boolean | null;
  customerCrmByPhone: Record<string, CustomerCrmSummary>;
};

const INITIAL_STATE: AdminOperationsState = {
  dashboard: null,
  bookingRequests: [],
  appointments: [],
  crmMetrics: null,
  staffOptions: [],
  resourceOptions: [],
  checkoutServices: [],
  recentTickets: [],
  techShiftOpen: null,
  customerCrmByPhone: {},
};

const ADMIN_OPERATIONS_CACHE_TTL_MS = 60 * 1000;

let cachedAdminState: AdminOperationsState = INITIAL_STATE;
let cachedAdminStateAt = 0;
let cachedAdminScopeKey: string | null = null;
let inflightAdminLoad: Promise<AdminOperationsState> | null = null;
const adminStateListeners = new Set<(state: AdminOperationsState) => void>();

function emitAdminState(nextState: AdminOperationsState) {
  // Only emit state if data actually changed to prevent unnecessary re-renders
  const stateChanged = JSON.stringify(cachedAdminState) !== JSON.stringify(nextState);
  if (!stateChanged) {
    return;
  }

  cachedAdminState = nextState;
  cachedAdminStateAt = Date.now();
  adminStateListeners.forEach((listener) => listener(nextState));
}

function resetAdminStateCache(scopeKey?: string | null) {
  cachedAdminState = INITIAL_STATE;
  cachedAdminStateAt = 0;
  inflightAdminLoad = null;
  cachedAdminScopeKey = scopeKey ?? null;
  adminStateListeners.forEach((listener) => listener(INITIAL_STATE));
}

function isAdminStateCacheFresh() {
  return cachedAdminStateAt > 0 && Date.now() - cachedAdminStateAt < ADMIN_OPERATIONS_CACHE_TTL_MS;
}

function hasCachedAdminState() {
  return (
    cachedAdminState.bookingRequests.length > 0 ||
    cachedAdminState.appointments.length > 0 ||
    cachedAdminState.checkoutServices.length > 0 ||
    cachedAdminState.staffOptions.length > 0 ||
    cachedAdminState.resourceOptions.length > 0 ||
    cachedAdminState.recentTickets.length > 0 ||
    cachedAdminState.dashboard !== null ||
    cachedAdminState.crmMetrics !== null
  );
}

function normalizePhone(raw: string | null | undefined) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("84") && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

async function listStaffOptions(): Promise<StaffOption[]> {
  if (!mobileSupabase) {
    return [];
  }

  const teamRpc = await mobileSupabase.rpc("list_team_members_secure_v2");
  if (!teamRpc.error && teamRpc.data) {
    return (teamRpc.data as Array<Record<string, unknown>>)
      .filter((row) => String(row.role ?? "") === "TECH")
      .map((row) => {
        const userId = String(row.user_id ?? "");
        const roleId = String(row.id ?? "");
        const displayName = typeof row.display_name === "string" && row.display_name.trim().length > 0
          ? row.display_name.trim()
          : userId.slice(0, 8);

        return {
          roleId: roleId || undefined,
          userId,
          name: displayName,
        };
      })
      .filter((staff) => Boolean(staff.userId));
  }

  const { orgId } = await ensureOrgContext(mobileSupabase);
  const rolesRes = await mobileSupabase
    .from("user_roles")
    .select("id,user_id,role")
    .eq("org_id", orgId)
    .eq("role", "TECH");

  if (rolesRes.error) {
    throw rolesRes.error;
  }

  const roleRows = (rolesRes.data ?? []) as Array<{ id: string; user_id: string; role: string }>;
  const userIds = [...new Set(roleRows.map((row) => String(row.user_id)).filter(Boolean))];
  const preferredStaffRes = await mobileSupabase
    .from("booking_requests")
    .select("preferred_staff")
    .eq("org_id", orgId)
    .not("preferred_staff", "is", null)
    .limit(200);

  const preferredIds = preferredStaffRes.error
    ? []
    : [
        ...new Set(
          (preferredStaffRes.data ?? [])
            .map((row) => (typeof row.preferred_staff === "string" ? row.preferred_staff.trim() : ""))
            .filter((value) => Boolean(value) && /^[0-9a-f-]{32,36}$/i.test(value)),
        ),
      ];

  const lookupUserIds = [...new Set([...userIds, ...preferredIds])];
  const profilesRes = await mobileSupabase
    .from("profiles")
    .select("user_id,display_name")
    .eq("org_id", orgId)
    .in("user_id", lookupUserIds);

  if (profilesRes.error) {
    throw profilesRes.error;
  }

  const displayNameMap = new Map(
    (profilesRes.data ?? []).map((profile) => [
      String(profile.user_id),
      typeof profile.display_name === "string" && profile.display_name.trim().length > 0
        ? profile.display_name.trim()
        : String(profile.user_id).slice(0, 8),
    ]),
  );

  return roleRows.map((row) => {
    const userId = String(row.user_id);
    return {
      roleId: String(row.id ?? "") || undefined,
      userId,
      name: displayNameMap.get(userId) ?? userId.slice(0, 8),
    };
  });
}

async function listResourceOptions(): Promise<ResourceOption[]> {
  if (!mobileSupabase) {
    return [];
  }

  const { orgId } = await ensureOrgContext(mobileSupabase);
  const resourcesRes = await mobileSupabase
    .from("resources")
    .select("id,name,type,active")
    .eq("org_id", orgId)
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (resourcesRes.error) {
    const message = resourcesRes.error.message || "";
    if (message.includes("resources") || message.includes("resource_id")) {
      return [];
    }
    throw resourcesRes.error;
  }

  return (resourcesRes.data ?? []).map((resource) => ({
    id: String(resource.id ?? ""),
    name: String(resource.name ?? "-"),
    type: String(resource.type ?? "RESOURCE"),
  }));
}

export function useAdminOperations() {
  const { isHydrated, role, user } = useSession();
  const userId = user?.id ?? null;
  const scopeKey = isHydrated && role && userId ? `${role}:${userId}` : null;
  const [state, setState] = useState<AdminOperationsState>(
    scopeKey && cachedAdminScopeKey === scopeKey ? cachedAdminState : INITIAL_STATE,
  );
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [busyTargetId, setBusyTargetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (scopeKey && cachedAdminScopeKey !== scopeKey) {
      resetAdminStateCache(scopeKey);
    }
  }, [scopeKey]);

  useEffect(() => {
    const listener = (nextState: AdminOperationsState) => {
      setState(nextState);
    };

    adminStateListeners.add(listener);
    if (scopeKey && cachedAdminScopeKey === scopeKey) {
      listener(cachedAdminState);
    }

    return () => {
      adminStateListeners.delete(listener);
    };
  }, [scopeKey]);

  const load = useCallback(async (force = false) => {
    if (!mobileSupabase || !isHydrated || !role) {
      if (cachedAdminScopeKey !== null) {
        resetAdminStateCache(null);
      }
      return INITIAL_STATE;
    }

    const nextScopeKey = userId ? `${role}:${userId}` : null;
    if (!nextScopeKey) {
      return INITIAL_STATE;
    }

    if (cachedAdminScopeKey !== nextScopeKey) {
      resetAdminStateCache(nextScopeKey);
    }

    if (!force && hasCachedAdminState() && isAdminStateCacheFresh()) {
      setState(cachedAdminState);
      return cachedAdminState;
    }

    if (inflightAdminLoad && !force) {
      return inflightAdminLoad;
    }

    setLoading(true);
    setError(null);

    inflightAdminLoad = (async () => {
      const canSeeBookingRequests =
        role === "OWNER" || role === "PARTNER" || role === "MANAGER" || role === "RECEPTION";
      const canSeeCrm =
        role === "OWNER" || role === "PARTNER" || role === "MANAGER" || role === "RECEPTION";
      const canSeeRecentTickets =
        role === "OWNER" || role === "PARTNER" || role === "MANAGER" || role === "RECEPTION" || role === "ACCOUNTANT";

      const [dashboard, bookingRequests, appointments, crmMetrics, staffOptions, resourceOptions, checkoutServices, recentTickets, techShiftOpen, customersCrm] = await Promise.all([
        getDashboardSnapshotForMobile(mobileSupabase),
        canSeeBookingRequests ? listBookingRequestsForMobile(mobileSupabase) : Promise.resolve([]),
        listAppointmentsForMobile(mobileSupabase),
        canSeeCrm ? getCrmDashboardMetricsForMobile(mobileSupabase) : Promise.resolve(null),
        listStaffOptions(),
        listResourceOptions(),
        listServicesForMobile(mobileSupabase),
        canSeeRecentTickets ? listRecentTicketsForMobile(mobileSupabase, { limit: 12 }) : Promise.resolve([]),
        role === "TECH" ? hasOpenShiftForMobile(mobileSupabase).catch(() => false) : Promise.resolve(null),
        canSeeCrm ? listCustomersCrmForMobile(mobileSupabase).catch(() => []) : Promise.resolve([]),
      ]);

      const customerCrmByPhone = Object.fromEntries(
        customersCrm
          .map((customer) => {
            const phone = normalizePhone(customer.phone);
            return phone ? [phone, customer] : null;
          })
          .filter((entry): entry is [string, CustomerCrmSummary] => Boolean(entry)),
      );

      const nextState: AdminOperationsState = {
        dashboard,
        bookingRequests: bookingRequests.filter(
          (bookingRequest) =>
            bookingRequest.status === "NEW" ||
            bookingRequest.status === "NEEDS_RESCHEDULE" ||
            bookingRequest.status === "EXPIRED_UNCONFIRMED",
        ),
        appointments,
        crmMetrics,
        staffOptions,
        resourceOptions,
        checkoutServices,
        recentTickets,
        techShiftOpen,
        customerCrmByPhone,
      };

      emitAdminState(nextState);
      return nextState;
    })();

    try {
      return await inflightAdminLoad;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Khong tai duoc du lieu van hanh");
      throw nextError;
    } finally {
      inflightAdminLoad = null;
      setLoading(false);
    }
  }, [isHydrated, role, userId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!hasCachedAdminState()) {
        void load();
        return;
      }

      setState(cachedAdminState);
      if (!isAdminStateCacheFresh()) {
        void load();
      }
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [load]);

  const runMutation = useCallback(
    async (targetId: string, action: () => Promise<void>) => {
      setMutating(true);
      setBusyTargetId(targetId);
      setError(null);

      try {
        await action();
        await load(true);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Thao tac that bai");
        throw nextError;
      } finally {
        setMutating(false);
        setBusyTargetId(null);
      }
    },
    [load],
  );

  const updateBookingRequestStatus = useCallback(
    async (bookingRequestId: string, status: "NEEDS_RESCHEDULE" | "CANCELLED") => {
      const client = mobileSupabase;
      if (!client) {
        throw new Error("Thieu cau hinh Supabase mobile.");
      }

      await runMutation(bookingRequestId, async () => {
        await updateBookingRequestStatusForMobile(client, bookingRequestId, status);
      });
    },
    [runMutation],
  );

  const saveBookingRequest = useCallback(
    async (input: {
      bookingRequestId: string;
      status?: "NEW" | "NEEDS_RESCHEDULE" | "EXPIRED_UNCONFIRMED" | "CANCELLED";
      requestedStartAt?: string | null;
      durationMinutes?: number;
      preferredStaff?: string | null;
    }) => {
      const client = mobileSupabase;
      if (!client) {
        throw new Error("Thieu cau hinh Supabase mobile.");
      }

      await runMutation(input.bookingRequestId, async () => {
        let requestedEndAt: string | null | undefined = undefined;
        if (input.requestedStartAt) {
          const startAt = new Date(input.requestedStartAt);
          if (Number.isNaN(startAt.getTime())) {
            throw new Error("Thoi gian mong muon khong hop le.");
          }

          const durationMinutes = input.durationMinutes ?? 60;
          requestedEndAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000).toISOString();
        }

        await updateBookingRequestForMobile(client, {
          id: input.bookingRequestId,
          status: input.status,
          requestedStartAt: input.requestedStartAt,
          requestedEndAt,
          preferredStaff: input.preferredStaff,
        });
      });
    },
    [runMutation],
  );

  const deleteBookingRequest = useCallback(
    async (bookingRequestId: string) => {
      const client = mobileSupabase;
      if (!client) {
        throw new Error("Thieu cau hinh Supabase mobile.");
      }

      await runMutation(bookingRequestId, async () => {
        await deleteBookingRequestForMobile(client, bookingRequestId);
      });
    },
    [runMutation],
  );

  const convertBookingRequest = useCallback(
    async (input: {
      bookingRequestId: string;
      startAt: string;
      durationMinutes?: number;
      staffUserId?: string | null;
      resourceId?: string | null;
    }) => {
      const client = mobileSupabase;
      if (!client) {
        throw new Error("Thieu cau hinh Supabase mobile.");
      }

      await runMutation(input.bookingRequestId, async () => {
        const startAt = new Date(input.startAt);
        if (Number.isNaN(startAt.getTime())) {
          throw new Error("Thoi gian booking khong hop le.");
        }

        const durationMinutes = input.durationMinutes ?? 60;
        const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);

        await convertBookingRequestToAppointmentForMobile(client, {
          bookingRequestId: input.bookingRequestId,
          staffUserId: input.staffUserId ?? null,
          resourceId: input.resourceId ?? null,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        });
      });
    },
    [runMutation],
  );

  const updateAppointmentStatus = useCallback(
    async (appointmentId: string, status: AppointmentStatus) => {
      const client = mobileSupabase;
      if (!client) {
        throw new Error("Thieu cau hinh Supabase mobile.");
      }

      await runMutation(appointmentId, async () => {
        await updateAppointmentStatusForMobile(client, appointmentId, status);
      });
    },
    [runMutation],
  );

  const saveAppointment = useCallback(
    async (input: {
      customerName: string;
      customerPhone?: string | null;
      startAt: string;
      endAt: string;
      staffUserId?: string | null;
      resourceId?: string | null;
      appointmentId?: string | null;
    }) => {
      const client = mobileSupabase;
      if (!client) {
        throw new Error("Thieu cau hinh Supabase mobile.");
      }

      const targetId = input.appointmentId ?? `create:${input.customerName}:${input.startAt}`;
      await runMutation(targetId, async () => {
        await saveAppointmentForMobile(client, input);
      });
    },
    [runMutation],
  );

  const createCheckout = useCallback(
    async (input: {
      customerName: string;
      paymentMethod: "CASH" | "TRANSFER";
      lines: Array<{ serviceId: string; qty: number }>;
      appointmentId?: string | null;
      dedupeWindowMs?: number;
      idempotencyKey?: string | null;
    }): Promise<{
      ticketId: string;
      receiptToken: string;
      grandTotal: number;
      deduped: boolean;
    } | null> => {
      const client = mobileSupabase;
      if (!client) {
        throw new Error("Thieu cau hinh Supabase mobile.");
      }

      const targetId = input.appointmentId ?? `checkout:${input.customerName}`;
      let result: {
        ticketId: string;
        receiptToken: string;
        grandTotal: number;
        deduped: boolean;
      } | null = null;

      await runMutation(targetId, async () => {
        result = await createCheckoutForMobile(client, input);
      });

      return result;
    },
    [runMutation],
  );

  const deleteAppointment = useCallback(
    async (appointmentId: string) => {
      const client = mobileSupabase;
      if (!client) {
        throw new Error("Thieu cau hinh Supabase mobile.");
      }

      await runMutation(appointmentId, async () => {
        await deleteAppointmentForMobile(client, appointmentId);
      });
    },
    [runMutation],
  );

  return {
    ...state,
    role: role as AppRole | null,
    user,
    loading,
    mutating,
    busyTargetId,
    error,
    reload: () => load(true),
    updateBookingRequestStatus,
    saveBookingRequest,
    deleteBookingRequest,
    convertBookingRequest,
    updateAppointmentStatus,
    saveAppointment,
    createCheckout,
    deleteAppointment,
  };
}
