import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Href } from "expo-router";
import { ensureOrgContext, resolveMobileAdminViewContext, translate, type AppRole, type Locale, type ObserverScopeInput } from "@nails/shared";
import { mobileSupabase } from "@/src/lib/supabase";

export type ManageNotificationKind =
  | "leave_request"
  | "staff_clock_in_approval"
  | "booking_request"
  | "booking_expired_unconfirmed"
  | "customer_arrival_overdue"
  | "customer_checked_in"
  | "customer_checked_in_stale"
  | "customer_checked_out"
  | "customer_membership_upgrade"
  | "customer_membership_offer"
  | "shift_published";

export type ManageNotificationSeverity = "critical" | "warning" | "info" | "success";

export type ManageNotificationItem = {
  id: string;
  kind: ManageNotificationKind;
  title: string;
  message: string;
  href: Href;
  createdAt: string;
  actionRequired: boolean;
  severity: ManageNotificationSeverity;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
};

type ProfileNameRow = {
  user_id: string;
  display_name?: string | null;
};

type PendingAttendanceRow = {
  id: string;
  staff_user_id: string;
  clock_in: string;
  scheduled_start?: string | null;
  branch_id?: string | null;
};

type PendingLeaveRow = {
  id: string;
  staff_user_id: string;
  request_type: "DAY_OFF" | "EARLY_LEAVE";
  scheduled_date?: string | null;
  requested_at: string;
  requested_end_at?: string | null;
  branch_id?: string | null;
};

type BookingNotificationRow = {
  id: string;
  customer_name: string;
  requested_service?: string | null;
  requested_start_at: string;
  status: "NEW" | "NEEDS_RESCHEDULE" | "EXPIRED_UNCONFIRMED";
  created_at: string;
  source?: string | null;
  branch_id?: string | null;
};

type MembershipNotificationRow = {
  id: string;
  customer_id: string;
  title: string;
  body: string;
  kind: string;
  sent_at: string;
  branch_id?: string | null;
};

type AppointmentNotificationRow = {
  id: string;
  status: "BOOKED" | "CHECKED_IN" | "DONE";
  start_at: string;
  checked_in_at?: string | null;
  updated_at?: string | null;
  branch_id?: string | null;
  customers?: { name?: string | null; full_name?: string | null } | Array<{ name?: string | null; full_name?: string | null }> | null;
};

function buildAppointmentHref(appointmentId: string): Href {
  return {
    pathname: "/scheduling/[appointmentId]",
    params: { appointmentId },
  };
}

type ShiftPlanNotificationRow = {
  id: string;
  week_start: string;
  published_at: string | null;
  branch_id?: string | null;
  assignments_json?: Array<{ employeeId?: string | null }> | null;
};

const ADMIN_NOTIFICATION_RULES = {
  appointmentOverdueMinutes: 20,
  staleCheckedInMinutes: 90,
  staleCheckedInDays: 7,
  recentShiftPublishedHours: 72,
  recentMembershipHours: 72,
} as const;
const LEGACY_SEEN_AT_STORAGE_PREFIX = "nails.mobile.manage.notifications.seenAt";
const FEED_READ_STORAGE_PREFIX = "nails.mobile.manage.notifications.feedRead";
const ACTION_DISMISSED_STORAGE_PREFIX = "nails.mobile.manage.notifications.actionDismissed";
const MANAGE_NOTIFICATION_ROLES: AppRole[] = ["OWNER", "PARTNER", "MANAGER", "RECEPTION", "TECH", "ACCOUNTANT"];

const NOTIFICATION_PRIORITY: Record<ManageNotificationKind, number> = {
  customer_arrival_overdue: 0,
  customer_checked_in_stale: 1,
  booking_request: 2,
  booking_expired_unconfirmed: 3,
  customer_checked_in: 4,
  customer_checked_out: 5,
  customer_membership_upgrade: 6,
  customer_membership_offer: 7,
  leave_request: 8,
  staff_clock_in_approval: 9,
  shift_published: 10,
};

function getLocaleTag(locale: Locale) {
  return locale === "en" ? "en-US" : "vi-VN";
}

function formatTime(dateTime: string, locale: Locale) {
  return new Intl.DateTimeFormat(getLocaleTag(locale), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateTime));
}

function formatDate(dateTime: string, locale: Locale) {
  return new Intl.DateTimeFormat(getLocaleTag(locale), {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(dateTime));
}

function pickCustomerName(
  customer: AppointmentNotificationRow["customers"],
  fallback: string,
) {
  if (Array.isArray(customer)) {
    const first = customer[0];
    return first?.full_name || first?.name || fallback;
  }

  return customer?.full_name || customer?.name || fallback;
}

function mapNotificationHref(kind: ManageNotificationKind): Href {
  switch (kind) {
    case "booking_request":
    case "booking_expired_unconfirmed":
      return {
        pathname: "/scheduling",
        params: { tab: "bookings" },
      };
    case "customer_arrival_overdue":
    case "customer_checked_in":
    case "customer_checked_in_stale":
      return "/scheduling";
    case "customer_checked_out":
      return "/checkout";
    case "customer_membership_upgrade":
    case "customer_membership_offer":
      return "/manage-content";
    case "leave_request":
    case "staff_clock_in_approval":
    case "shift_published":
    default:
      return "/shifts";
  }
}

async function loadProfileNameMap(userIds: string[]) {
  if (!mobileSupabase || userIds.length === 0) return new Map<string, string>();

  const { data, error } = await mobileSupabase
    .from("profiles")
    .select("user_id,display_name")
    .in("user_id", userIds);

  if (error) return new Map<string, string>();

  return new Map(
    ((data ?? []) as ProfileNameRow[]).map((row) => [
      row.user_id,
      row.display_name?.trim() || row.user_id.slice(0, 8),
    ]),
  );
}

async function listPendingAttendance(orgId: string, branchId?: string | null) {
  if (!mobileSupabase) return [] as PendingAttendanceRow[];

  let query = mobileSupabase
    .from("time_entries")
    .select("id,staff_user_id,clock_in,scheduled_start,branch_id")
    .eq("org_id", orgId)
    .eq("approval_status", "PENDING")
    .order("clock_in", { ascending: false })
    .limit(6);

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;

  if (error) return [] as PendingAttendanceRow[];
  return (data ?? []) as PendingAttendanceRow[];
}

async function listPendingLeaveRequests(orgId: string, branchId?: string | null) {
  if (!mobileSupabase) return [] as PendingLeaveRow[];

  let query = mobileSupabase
    .from("shift_leave_requests")
    .select("id,staff_user_id,request_type,scheduled_date,requested_at,requested_end_at,branch_id")
    .eq("org_id", orgId)
    .eq("status", "PENDING")
    .order("requested_at", { ascending: false })
    .limit(6);

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;

  if (error) return [] as PendingLeaveRow[];
  return (data ?? []) as PendingLeaveRow[];
}

async function listOpenBookingRequests(orgId: string, branchId?: string | null) {
  if (!mobileSupabase) return [] as BookingNotificationRow[];

  let query = mobileSupabase
    .from("booking_requests")
    .select("id,customer_name,requested_service,requested_start_at,status,created_at,source,branch_id")
    .eq("org_id", orgId)
    .in("status", ["NEW", "NEEDS_RESCHEDULE", "EXPIRED_UNCONFIRMED"])
    .order("created_at", { ascending: false })
    .limit(8);

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;

  if (error) return [] as BookingNotificationRow[];
  return (data ?? []) as BookingNotificationRow[];
}

async function listRecentAppointmentEvents(orgId: string, branchId?: string | null) {
  if (!mobileSupabase) return [] as AppointmentNotificationRow[];

  const recentEventSinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const checkedInSinceIso = new Date(Date.now() - ADMIN_NOTIFICATION_RULES.staleCheckedInDays * 24 * 60 * 60 * 1000).toISOString();
  let query = mobileSupabase
    .from("appointments")
    .select("id,status,start_at,checked_in_at,updated_at,branch_id,customers(name,full_name)")
    .eq("org_id", orgId)
    .in("status", ["BOOKED", "CHECKED_IN", "DONE"])
    .or(`and(status.eq.BOOKED,start_at.gte.${recentEventSinceIso}),and(status.eq.DONE,updated_at.gte.${recentEventSinceIso}),and(status.eq.CHECKED_IN,start_at.gte.${checkedInSinceIso})`)
    .order("updated_at", { ascending: false })
    .limit(24);

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;

  if (error) return [] as AppointmentNotificationRow[];

  const rows = (data ?? []) as AppointmentNotificationRow[];
  const staleThresholdMs = Date.now() - ADMIN_NOTIFICATION_RULES.staleCheckedInDays * 24 * 60 * 60 * 1000;
  const staleIds = rows
    .filter((row) => row.status === "CHECKED_IN")
    .filter((row) => {
      const referenceValue = row.checked_in_at ?? row.start_at;
      return new Date(referenceValue).getTime() < staleThresholdMs;
    })
    .map((row) => row.id);

  if (staleIds.length > 0) {
    let updateQuery = mobileSupabase
      .from("appointments")
      .update({ status: "CANCELLED" })
      .eq("org_id", orgId)
      .in("id", staleIds)
      .eq("status", "CHECKED_IN");

    if (branchId) {
      updateQuery = updateQuery.eq("branch_id", branchId);
    }

    await updateQuery;
  }

  return rows.filter((row) => !staleIds.includes(row.id));
}

async function listRecentPublishedShiftPlans(orgId: string, branchId?: string | null) {
  if (!mobileSupabase) return [] as ShiftPlanNotificationRow[];

  const sinceIso = new Date(Date.now() - ADMIN_NOTIFICATION_RULES.recentShiftPublishedHours * 60 * 60 * 1000).toISOString();
  let query = mobileSupabase
    .from("shift_plans")
    .select("id,week_start,published_at,assignments_json,branch_id")
    .eq("org_id", orgId)
    .eq("status", "published")
    .gte("published_at", sinceIso)
    .order("published_at", { ascending: false })
    .limit(4);

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;

  if (error) return [] as ShiftPlanNotificationRow[];
  return (data ?? []) as ShiftPlanNotificationRow[];
}

async function listRecentMembershipNotifications(orgId: string) {
  if (!mobileSupabase) return [] as MembershipNotificationRow[];

  const sinceIso = new Date(Date.now() - ADMIN_NOTIFICATION_RULES.recentMembershipHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await mobileSupabase
    .from("customer_notifications")
    .select("id,customer_id,title,body,kind,sent_at")
    .eq("org_id", orgId)
    .eq("kind", "MEMBERSHIP")
    .gte("sent_at", sinceIso)
    .order("sent_at", { ascending: false })
    .limit(8);

  if (error) return [] as MembershipNotificationRow[];
  return (data ?? []) as MembershipNotificationRow[];
}

async function loadCustomerBranchMembershipSet(
  orgId: string,
  branchId: string,
  customerIds: string[],
) {
  if (!mobileSupabase || customerIds.length === 0) return new Set<string>();

  const { data, error } = await mobileSupabase
    .from("customer_branches")
    .select("customer_id")
    .eq("org_id", orgId)
    .eq("branch_id", branchId)
    .in("customer_id", customerIds);

  if (error) return new Set<string>();

  return new Set(
    ((data ?? []) as Array<{ customer_id: string | null }>).flatMap((row) =>
      typeof row.customer_id === "string" ? [row.customer_id] : [],
    ),
  );
}

async function loadAdminNotificationStates(orgId: string) {
  if (!mobileSupabase) return new Map<string, { acknowledged_at?: string | null; resolved_at?: string | null }>();

  const { data, error } = await mobileSupabase
    .from("admin_notification_states")
    .select("notification_key,acknowledged_at,resolved_at")
    .eq("org_id", orgId);

  if (error) return new Map<string, { acknowledged_at?: string | null; resolved_at?: string | null }>();

  return new Map(
    (data ?? []).map((row) => [String(row.notification_key ?? ""), { acknowledged_at: row.acknowledged_at, resolved_at: row.resolved_at }]),
  );
}

function isManageNotificationItem(
  value: ManageNotificationItem | null,
): value is ManageNotificationItem {
  return value !== null;
}

export async function loadManageNotificationsForMobile(
  role: AppRole,
  userId?: string | null,
  observerScope?: ObserverScopeInput | null,
  locale: Locale = "vi",
) {
  if (!mobileSupabase) return [] as ManageNotificationItem[];

  const { orgId } = await ensureOrgContext(mobileSupabase);
  const viewContext = observerScope ? await resolveMobileAdminViewContext(mobileSupabase, observerScope) : null;
  const branchId = viewContext?.observerScope.mode === "branch" ? viewContext.viewBranchId : null;
  const canApproveShift = role === "OWNER" || role === "PARTNER" || role === "MANAGER";
  const canSeeBookings = role === "OWNER" || role === "PARTNER" || role === "MANAGER" || role === "RECEPTION" || role === "TECH";
  const canSeeAppointments =
    role === "OWNER" || role === "PARTNER" || role === "MANAGER" || role === "RECEPTION" || role === "TECH" || role === "ACCOUNTANT";
  const shouldSeeShiftPublished =
    role === "MANAGER" || role === "RECEPTION" || role === "TECH" || role === "ACCOUNTANT";

  const [pendingAttendance, pendingLeaveRequests, bookingRequests, appointmentEvents, publishedShiftPlans, membershipNotifications, stateMap] = await Promise.all([
    canApproveShift ? listPendingAttendance(orgId, branchId) : Promise.resolve([] as PendingAttendanceRow[]),
    canApproveShift ? listPendingLeaveRequests(orgId, branchId) : Promise.resolve([] as PendingLeaveRow[]),
    canSeeBookings ? listOpenBookingRequests(orgId, branchId) : Promise.resolve([] as BookingNotificationRow[]),
    canSeeAppointments ? listRecentAppointmentEvents(orgId, branchId) : Promise.resolve([] as AppointmentNotificationRow[]),
    shouldSeeShiftPublished ? listRecentPublishedShiftPlans(orgId, branchId) : Promise.resolve([] as ShiftPlanNotificationRow[]),
    role === "OWNER" || role === "PARTNER" || role === "MANAGER" ? listRecentMembershipNotifications(orgId) : Promise.resolve([] as MembershipNotificationRow[]),
    loadAdminNotificationStates(orgId),
  ]);

  const membershipBranchCustomerIds =
    branchId && membershipNotifications.length > 0
      ? await loadCustomerBranchMembershipSet(orgId, branchId, membershipNotifications.map((row) => row.customer_id))
      : new Set<string>();

  const nameMap = await loadProfileNameMap([
    ...new Set([
      ...pendingAttendance.map((row) => row.staff_user_id),
      ...pendingLeaveRequests.map((row) => row.staff_user_id),
    ]),
  ]);

  const appointmentNotifications = appointmentEvents
    .map<ManageNotificationItem | null>((row) => {
      if (row.status === "BOOKED") {
        const startAtMs = new Date(row.start_at).getTime();
        if (startAtMs <= Date.now() - ADMIN_NOTIFICATION_RULES.appointmentOverdueMinutes * 60 * 1000) {
          return {
            id: `arrival-overdue-${row.id}`,
            kind: "customer_arrival_overdue",
            title: translate(locale, "admin", "notificationsArrivalOverdueTitle"),
            message: translate(locale, "admin", "notificationsArrivalOverdueMessage", {
              customer: pickCustomerName(
                row.customers,
                translate(locale, "admin", "notificationsCustomerFallback"),
              ),
              time: formatTime(row.start_at, locale),
            }),
            href: buildAppointmentHref(row.id),
            createdAt: row.start_at,
            actionRequired: true,
            severity: "warning",
          };
        }
        return null;
      }

      if (row.status === "CHECKED_IN" && row.checked_in_at) {
        const checkedInAtMs = new Date(row.checked_in_at).getTime();
        if (checkedInAtMs <= Date.now() - ADMIN_NOTIFICATION_RULES.staleCheckedInMinutes * 60 * 1000) {
          return {
            id: `checked-in-stale-${row.id}`,
            kind: "customer_checked_in_stale",
            title: translate(locale, "admin", "notificationsCheckedInStaleTitle"),
            message: translate(locale, "admin", "notificationsCheckedInStaleMessage", {
              customer: pickCustomerName(
                row.customers,
                translate(locale, "admin", "notificationsCustomerFallback"),
              ),
              time: formatTime(row.checked_in_at, locale),
            }),
            href: mapNotificationHref("customer_checked_in_stale"),
            createdAt: row.checked_in_at,
            actionRequired: true,
            severity: "warning",
          };
        }

        return {
          id: `checked-in-${row.id}`,
          kind: "customer_checked_in",
          title: translate(locale, "admin", "notificationsCheckedInTitle"),
          message: translate(locale, "admin", "notificationsCheckedInMessage", {
            customer: pickCustomerName(
              row.customers,
              translate(locale, "admin", "notificationsCustomerFallback"),
            ),
            time: formatTime(row.checked_in_at, locale),
          }),
          href: buildAppointmentHref(row.id),
          createdAt: row.checked_in_at,
          actionRequired: false,
          severity: "info",
        };
      }

      if (row.status === "DONE" && row.updated_at) {
        return {
          id: `checked-out-${row.id}`,
          kind: "customer_checked_out",
          title: translate(locale, "admin", "notificationsCheckedOutTitle"),
          message: translate(locale, "admin", "notificationsCheckedOutMessage", {
            customer: pickCustomerName(
              row.customers,
              translate(locale, "admin", "notificationsCustomerFallback"),
            ),
            time: formatTime(row.updated_at, locale),
          }),
          href: buildAppointmentHref(row.id),
          createdAt: row.updated_at,
          actionRequired: false,
          severity: "success",
        };
      }

      return null;
    })
    .filter(isManageNotificationItem);

  const shiftPublishedNotifications =
    shouldSeeShiftPublished && userId
      ? publishedShiftPlans
          .filter((plan) =>
            Array.isArray(plan.assignments_json)
              ? plan.assignments_json.some((assignment) => assignment.employeeId === userId)
              : false,
          )
          .map<ManageNotificationItem>((plan) => ({
            id: `shift-published-${plan.id}`,
            kind: "shift_published",
            title: translate(locale, "admin", "notificationsShiftPublishedTitle"),
            message: translate(locale, "admin", "notificationsShiftPublishedMessage", {
              date: formatDate(plan.week_start, locale),
            }),
            href: mapNotificationHref("shift_published"),
            createdAt: plan.published_at ?? new Date().toISOString(),
            actionRequired: false,
            severity: "info",
          }))
      : [];

  const notifications: ManageNotificationItem[] = [
    ...pendingAttendance.map<ManageNotificationItem>((row) => ({
      id: `attendance-${row.id}`,
      kind: "staff_clock_in_approval" as const,
      title: translate(locale, "admin", "notificationsAttendanceApprovalTitle"),
      message: translate(locale, "admin", "notificationsAttendanceApprovalMessage", {
        staff: nameMap.get(row.staff_user_id) ?? translate(locale, "admin", "notificationsStaffFallback"),
        time: formatTime(row.clock_in, locale),
      }),
      href: mapNotificationHref("staff_clock_in_approval"),
      createdAt: row.clock_in,
      actionRequired: true,
      severity: "warning",
    })),
    ...pendingLeaveRequests.map<ManageNotificationItem>((row) => ({
      id: `leave-${row.id}`,
      kind: "leave_request" as const,
      title:
        row.request_type === "DAY_OFF"
          ? translate(locale, "admin", "notificationsLeaveDayOffTitle")
          : translate(locale, "admin", "notificationsLeaveEarlyTitle"),
      message:
        row.request_type === "DAY_OFF"
          ? translate(locale, "admin", "notificationsLeaveDayOffMessage", {
              staff: nameMap.get(row.staff_user_id) ?? translate(locale, "admin", "notificationsStaffFallback"),
              date: row.scheduled_date
                ? formatDate(row.scheduled_date, locale)
                : translate(locale, "admin", "notificationsUnknownDate"),
            })
          : row.requested_end_at
            ? translate(locale, "admin", "notificationsLeaveEarlyMessageWithTime", {
                staff: nameMap.get(row.staff_user_id) ?? translate(locale, "admin", "notificationsStaffFallback"),
                time: formatTime(row.requested_end_at, locale),
              })
            : translate(locale, "admin", "notificationsLeaveEarlyMessageDefault", {
                staff: nameMap.get(row.staff_user_id) ?? translate(locale, "admin", "notificationsStaffFallback"),
              }),
      href: mapNotificationHref("leave_request"),
      createdAt: row.requested_at,
      actionRequired: true,
      severity: "warning",
    })),
    ...bookingRequests.map<ManageNotificationItem>((row) => ({
      id: `booking-${row.id}`,
      kind: row.status === "EXPIRED_UNCONFIRMED" ? "booking_expired_unconfirmed" : "booking_request",
      title:
        row.status === "NEEDS_RESCHEDULE"
          ? translate(locale, "admin", "notificationsBookingNeedsRescheduleTitle")
          : row.status === "EXPIRED_UNCONFIRMED"
            ? translate(locale, "admin", "notificationsBookingExpiredTitle")
            : typeof row.source === "string" && row.source.toLowerCase().includes("mobile")
              ? translate(locale, "admin", "notificationsBookingMobileTitle")
              : translate(locale, "admin", "notificationsBookingWebTitle"),
      message: translate(locale, "admin", "notificationsBookingMessage", {
        customer: row.customer_name,
        service: row.requested_service || translate(locale, "admin", "notificationsUnknownService"),
        time: formatTime(row.requested_start_at, locale),
        date: formatDate(row.requested_start_at, locale),
      }),
      href: {
        pathname: "/scheduling",
        params: {
          tab: "bookings",
          focusBookingId: row.id,
          status: row.status,
        },
      },
      createdAt: row.created_at,
      actionRequired: row.status !== "EXPIRED_UNCONFIRMED",
      severity:
        row.status === "NEEDS_RESCHEDULE"
          ? "critical"
          : row.status === "EXPIRED_UNCONFIRMED"
            ? "info"
            : "warning",
    })),
    ...appointmentNotifications,
    ...shiftPublishedNotifications,
    ...membershipNotifications
      .filter((row) => {
        if (!branchId) return true;
        return membershipBranchCustomerIds.has(row.customer_id);
      })
      .map<ManageNotificationItem>((row) => ({
        id: `membership-${row.id}`,
        kind: row.title.includes("lên hạng") ? ("customer_membership_upgrade" as const) : ("customer_membership_offer" as const),
        title: row.title,
        message: row.body,
        href: {
          pathname: "/manage-content",
          params: { tab: "membership-feed", customerId: row.customer_id },
        },
        createdAt: row.sent_at,
        actionRequired: false,
        severity: row.title.includes("lên hạng") ? "success" : "info",
      })),
  ];

  const hydratedNotifications = notifications.map((item) => {
    const state = stateMap.get(item.id);
    const isBookingDriven = item.kind === "booking_request" || item.kind === "booking_expired_unconfirmed";
    return {
      ...item,
      acknowledgedAt: state?.acknowledged_at ?? null,
      resolvedAt: isBookingDriven ? null : state?.resolved_at ?? null,
    };
  });

  return hydratedNotifications
    .filter((item) => !item.resolvedAt)
    .sort((a, b) => {
      const priorityDiff = (NOTIFICATION_PRIORITY[a.kind] ?? 99) - (NOTIFICATION_PRIORITY[b.kind] ?? 99);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 12);
}

export function useAdminNotifications(
  role: AppRole | null | undefined,
  email?: string | null,
  userId?: string | null,
  observerScope?: ObserverScopeInput | null,
  locale: Locale = "vi",
) {
  const [notifications, setNotifications] = useState<ManageNotificationItem[]>([]);
  const [legacySeenAt, setLegacySeenAt] = useState<string | null>(null);
  const [readFeedIds, setReadFeedIds] = useState<string[]>([]);
  const [dismissedActionIds, setDismissedActionIds] = useState<string[]>([]);

  const legacySeenAtStorageKey = email ? `${LEGACY_SEEN_AT_STORAGE_PREFIX}.${email}` : null;
  const feedReadStorageKey = email ? `${FEED_READ_STORAGE_PREFIX}.${email}` : null;
  const actionDismissedStorageKey = email ? `${ACTION_DISMISSED_STORAGE_PREFIX}.${email}` : null;
  const enabled = Boolean(role && MANAGE_NOTIFICATION_ROLES.includes(role));

  const loadLegacySeenAt = useCallback(async () => {
    if (!legacySeenAtStorageKey) {
      setLegacySeenAt(null);
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(legacySeenAtStorageKey);
      setLegacySeenAt(stored);
    } catch {
      setLegacySeenAt(null);
    }
  }, [legacySeenAtStorageKey]);

  const loadReadFeedIds = useCallback(async () => {
    if (!feedReadStorageKey) {
      setReadFeedIds([]);
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(feedReadStorageKey);
      const parsed = stored ? (JSON.parse(stored) as string[]) : [];
      setReadFeedIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setReadFeedIds([]);
    }
  }, [feedReadStorageKey]);

  const loadDismissedActionIds = useCallback(async () => {
    if (!actionDismissedStorageKey) {
      setDismissedActionIds([]);
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(actionDismissedStorageKey);
      const parsed = stored ? (JSON.parse(stored) as string[]) : [];
      setDismissedActionIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setDismissedActionIds([]);
    }
  }, [actionDismissedStorageKey]);

  const loadNotifications = useCallback(async () => {
    if (!enabled || !role) {
      setNotifications([]);
      return;
    }

    try {
      const rows = await loadManageNotificationsForMobile(role, userId, observerScope, locale);
      setNotifications(rows);
    } catch {
      setNotifications([]);
    }
  }, [enabled, locale, observerScope, role, userId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadLegacySeenAt();
      void loadReadFeedIds();
      void loadDismissedActionIds();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [loadDismissedActionIds, loadLegacySeenAt, loadReadFeedIds]);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    async function run() {
      const rows = await loadManageNotificationsForMobile(role as AppRole, userId, observerScope, locale);
      if (!disposed) setNotifications(rows);
    }

    void run();
    const id = setInterval(() => {
      void run();
    }, 30000);

    return () => {
      disposed = true;
      clearInterval(id);
    };
  }, [enabled, locale, observerScope, role, userId]);

  const actionNotifications = useMemo(
    () => notifications.filter((item) => item.actionRequired && !item.resolvedAt),
    [notifications],
  );

  const openBookingActionCount = useMemo(
    () =>
      actionNotifications.filter(
        (item) => item.kind === "booking_request" || item.kind === "booking_expired_unconfirmed",
      ).length,
    [actionNotifications],
  );
  const bookingQueueCount = openBookingActionCount;

  const nonBookingActionCount = useMemo(
    () =>
      notifications.filter(
        (item) =>
          !item.resolvedAt &&
          item.actionRequired &&
          item.kind !== "booking_request" &&
          item.kind !== "booking_expired_unconfirmed",
      ).length,
    [notifications],
  );

  const actionOpenCount = actionNotifications.length;
  const visibleNotifications = useMemo(() => (enabled ? notifications : []), [enabled, notifications]);
  const feedNotifications = useMemo(
    () => visibleNotifications.filter((item) => !item.actionRequired),
    [visibleNotifications],
  );

  const legacySeenAtMs = useMemo(() => {
    if (!legacySeenAt) return 0;
    const nextValue = new Date(legacySeenAt).getTime();
    return Number.isFinite(nextValue) ? nextValue : 0;
  }, [legacySeenAt]);

  const unreadCount = useMemo(() => {
    return visibleNotifications.filter((item) => {
      if (item.resolvedAt) return false;
      if (item.actionRequired) return !dismissedActionIds.includes(item.id);
      if (readFeedIds.includes(item.id)) return false;
      return new Date(item.createdAt).getTime() > legacySeenAtMs;
    }).length;
  }, [dismissedActionIds, legacySeenAtMs, readFeedIds, visibleNotifications]);

  const feedUnreadCount = useMemo(() => {
    return visibleNotifications.filter((item) => {
      if (item.resolvedAt || item.actionRequired) return false;
      if (readFeedIds.includes(item.id)) return false;
      return new Date(item.createdAt).getTime() > legacySeenAtMs;
    }).length;
  }, [legacySeenAtMs, readFeedIds, visibleNotifications]);

  const badgeCount = actionOpenCount + feedUnreadCount;

  const markFeedRead = useCallback(async (notificationId: string) => {
    if (!notificationId) return;
    if (readFeedIds.includes(notificationId)) return;

    const nextIds = Array.from(new Set([...readFeedIds, notificationId]));
    setReadFeedIds(nextIds);
    if (!feedReadStorageKey) return;

    try {
      await AsyncStorage.setItem(feedReadStorageKey, JSON.stringify(nextIds));
    } catch {}
  }, [feedReadStorageKey, readFeedIds]);

  const markActionHandled = useCallback(
    async (notificationId: string) => {
      const nextIds = Array.from(new Set([...dismissedActionIds, notificationId]));
      setDismissedActionIds(nextIds);
      if (actionDismissedStorageKey) {
        try {
          await AsyncStorage.setItem(actionDismissedStorageKey, JSON.stringify(nextIds));
        } catch {}
      }
      setNotifications((prev) =>
        prev.map((item) => (item.id === notificationId ? { ...item, acknowledgedAt: item.acknowledgedAt ?? new Date().toISOString() } : item)),
      );
      if (mobileSupabase) {
        const { orgId } = await ensureOrgContext(mobileSupabase);
        if (orgId) {
          await mobileSupabase.rpc("touch_admin_notification_state", {
            p_org_id: orgId,
            p_notification_key: notificationId,
            p_action: "ack",
          });
        }
      }
    },
    [actionDismissedStorageKey, dismissedActionIds],
  );

  const markActionResolved = useCallback(
    async (notificationId: string) => {
      setNotifications((prev) => prev.map((item) => (item.id === notificationId ? { ...item, resolvedAt: new Date().toISOString() } : item)));
      if (mobileSupabase) {
        const { orgId } = await ensureOrgContext(mobileSupabase);
        if (orgId) {
          await mobileSupabase.rpc("touch_admin_notification_state", {
            p_org_id: orgId,
            p_notification_key: notificationId,
            p_action: "resolve",
          });
          void loadNotifications();
        }
      }
    },
    [loadNotifications],
  );

  return {
    notifications: visibleNotifications,
    actionNotifications,
    feedNotifications,
    unreadCount,
    feedUnreadCount,
    badgeCount,
    actionOpenCount,
    bookingQueueCount,
    openBookingActionCount,
    nonBookingActionCount,
    reloadNotifications: loadNotifications,
    markFeedRead,
    markActionHandled,
    markActionResolved,
  };
}
