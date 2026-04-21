import { useCallback, useEffect, useState } from "react";
import {
  type AppRole,
  type AppointmentStatus,
  type MobileCheckoutService,
  type MobileRecentTicketSummary,
  type CrmDashboardMetrics,
  type MobileAppointmentSummary,
  type MobileBookingRequestSummary,
  type MobileDashboardSnapshot,
  createCheckoutForMobile,
  convertBookingRequestToAppointmentForMobile,
  deleteBookingRequestForMobile,
  ensureOrgContext,
  getCrmDashboardMetricsForMobile,
  getDashboardSnapshotForMobile,
  hasOpenShiftForMobile,
  listAppointmentsForMobile,
  listBookingRequestsForMobile,
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
};

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
  const [state, setState] = useState<AdminOperationsState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [busyTargetId, setBusyTargetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!mobileSupabase || !isHydrated || !role) {
      setState(INITIAL_STATE);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [dashboard, bookingRequests, appointments, crmMetrics, staffOptions, resourceOptions, checkoutServices, recentTickets, techShiftOpen] = await Promise.all([
        getDashboardSnapshotForMobile(mobileSupabase),
        listBookingRequestsForMobile(mobileSupabase),
        listAppointmentsForMobile(mobileSupabase),
        getCrmDashboardMetricsForMobile(mobileSupabase),
        listStaffOptions(),
        listResourceOptions(),
        listServicesForMobile(mobileSupabase),
        listRecentTicketsForMobile(mobileSupabase, { limit: 12 }),
        role === "TECH" ? hasOpenShiftForMobile(mobileSupabase).catch(() => false) : Promise.resolve(null),
      ]);

      setState({
        dashboard,
        bookingRequests,
        appointments,
        crmMetrics,
        staffOptions,
        resourceOptions,
        checkoutServices,
        recentTickets,
        techShiftOpen,
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Khong tai duoc du lieu van hanh");
    } finally {
      setLoading(false);
    }
  }, [isHydrated, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const runMutation = useCallback(
    async (targetId: string, action: () => Promise<void>) => {
      setMutating(true);
      setBusyTargetId(targetId);
      setError(null);

      try {
        await action();
        await load();
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
      status?: "NEW" | "NEEDS_RESCHEDULE" | "CANCELLED";
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
    }) => {
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

  return {
    ...state,
    role: role as AppRole | null,
    user,
    loading,
    mutating,
    busyTargetId,
    error,
    reload: load,
    updateBookingRequestStatus,
    saveBookingRequest,
    deleteBookingRequest,
    convertBookingRequest,
    updateAppointmentStatus,
    saveAppointment,
    createCheckout,
  };
}
