import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Href } from "expo-router";
import { ensureOrgContext, type AppRole } from "@nails/shared";
import { mobileSupabase } from "@/src/lib/supabase";

export type ManageNotificationKind =
  | "leave_request"
  | "staff_clock_in_approval"
  | "booking_request"
  | "customer_arrival_overdue"
  | "customer_checked_in"
  | "customer_checked_in_stale"
  | "customer_checked_out"
  | "shift_published";

export type ManageNotificationItem = {
  id: string;
  kind: ManageNotificationKind;
  title: string;
  message: string;
  href: Href;
  createdAt: string;
  actionRequired: boolean;
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
};

type PendingLeaveRow = {
  id: string;
  staff_user_id: string;
  request_type: "DAY_OFF" | "EARLY_LEAVE";
  scheduled_date?: string | null;
  requested_at: string;
  requested_end_at?: string | null;
};

type BookingNotificationRow = {
  id: string;
  customer_name: string;
  requested_service?: string | null;
  requested_start_at: string;
  status: "NEW" | "NEEDS_RESCHEDULE";
  created_at: string;
};

type AppointmentNotificationRow = {
  id: string;
  status: "BOOKED" | "CHECKED_IN" | "DONE";
  start_at: string;
  checked_in_at?: string | null;
  updated_at?: string | null;
  customers?: { name?: string | null; full_name?: string | null } | Array<{ name?: string | null; full_name?: string | null }> | null;
};

type ShiftPlanNotificationRow = {
  id: string;
  week_start: string;
  published_at: string | null;
  assignments_json?: Array<{ employeeId?: string | null }> | null;
};

const APPOINTMENT_OVERDUE_MINUTES = 20;
const STALE_CHECKED_IN_MINUTES = 90;
const RECENT_SHIFT_PUBLISHED_HOURS = 72;
const STORAGE_PREFIX = "nails.mobile.manage.notifications.seenAt";
const MANAGE_NOTIFICATION_ROLES: AppRole[] = ["OWNER", "PARTNER", "MANAGER", "RECEPTION", "TECH", "ACCOUNTANT"];

const NOTIFICATION_PRIORITY: Record<ManageNotificationKind, number> = {
  customer_arrival_overdue: 0,
  customer_checked_in_stale: 1,
  booking_request: 2,
  customer_checked_in: 3,
  customer_checked_out: 4,
  leave_request: 5,
  staff_clock_in_approval: 6,
  shift_published: 7,
};

function formatTime(dateTime: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateTime));
}

function formatDate(dateTime: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(dateTime));
}

function pickCustomerName(
  customer: AppointmentNotificationRow["customers"],
  fallback = "Khách mới",
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
      return "/(admin)/booking";
    case "customer_arrival_overdue":
    case "customer_checked_in":
    case "customer_checked_in_stale":
      return "/(admin)/scheduling";
    case "customer_checked_out":
      return "/(admin)/checkout";
    case "leave_request":
    case "staff_clock_in_approval":
    case "shift_published":
    default:
      return "/(admin)/shifts";
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

async function listPendingAttendance(orgId: string) {
  if (!mobileSupabase) return [] as PendingAttendanceRow[];

  const { data, error } = await mobileSupabase
    .from("time_entries")
    .select("id,staff_user_id,clock_in,scheduled_start")
    .eq("org_id", orgId)
    .eq("approval_status", "PENDING")
    .order("clock_in", { ascending: false })
    .limit(6);

  if (error) return [] as PendingAttendanceRow[];
  return (data ?? []) as PendingAttendanceRow[];
}

async function listPendingLeaveRequests(orgId: string) {
  if (!mobileSupabase) return [] as PendingLeaveRow[];

  const { data, error } = await mobileSupabase
    .from("shift_leave_requests")
    .select("id,staff_user_id,request_type,scheduled_date,requested_at,requested_end_at")
    .eq("org_id", orgId)
    .eq("status", "PENDING")
    .order("requested_at", { ascending: false })
    .limit(6);

  if (error) return [] as PendingLeaveRow[];
  return (data ?? []) as PendingLeaveRow[];
}

async function listOpenBookingRequests(orgId: string) {
  if (!mobileSupabase) return [] as BookingNotificationRow[];

  const { data, error } = await mobileSupabase
    .from("booking_requests")
    .select("id,customer_name,requested_service,requested_start_at,status,created_at")
    .eq("org_id", orgId)
    .in("status", ["NEW", "NEEDS_RESCHEDULE"])
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) return [] as BookingNotificationRow[];
  return (data ?? []) as BookingNotificationRow[];
}

async function listRecentAppointmentEvents(orgId: string) {
  if (!mobileSupabase) return [] as AppointmentNotificationRow[];

  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await mobileSupabase
    .from("appointments")
    .select("id,status,start_at,checked_in_at,updated_at,customers(name,full_name)")
    .eq("org_id", orgId)
    .in("status", ["BOOKED", "CHECKED_IN", "DONE"])
    .or(`start_at.gte.${sinceIso},updated_at.gte.${sinceIso}`)
    .order("updated_at", { ascending: false })
    .limit(16);

  if (error) return [] as AppointmentNotificationRow[];
  return (data ?? []) as AppointmentNotificationRow[];
}

async function listRecentPublishedShiftPlans(orgId: string) {
  if (!mobileSupabase) return [] as ShiftPlanNotificationRow[];

  const sinceIso = new Date(Date.now() - RECENT_SHIFT_PUBLISHED_HOURS * 60 * 60 * 1000).toISOString();
  const { data, error } = await mobileSupabase
    .from("shift_plans")
    .select("id,week_start,published_at,assignments_json")
    .eq("org_id", orgId)
    .eq("status", "published")
    .gte("published_at", sinceIso)
    .order("published_at", { ascending: false })
    .limit(4);

  if (error) return [] as ShiftPlanNotificationRow[];
  return (data ?? []) as ShiftPlanNotificationRow[];
}

function isManageNotificationItem(
  value: ManageNotificationItem | null,
): value is ManageNotificationItem {
  return value !== null;
}

export async function loadManageNotificationsForMobile(role: AppRole, userId?: string | null) {
  if (!mobileSupabase) return [] as ManageNotificationItem[];

  const { orgId } = await ensureOrgContext(mobileSupabase);
  const canApproveShift = role === "OWNER" || role === "PARTNER" || role === "MANAGER";
  const canSeeBookings = role === "OWNER" || role === "PARTNER" || role === "MANAGER" || role === "RECEPTION" || role === "TECH";
  const canSeeAppointments =
    role === "OWNER" || role === "PARTNER" || role === "MANAGER" || role === "RECEPTION" || role === "TECH" || role === "ACCOUNTANT";
  const shouldSeeShiftPublished = role === "RECEPTION" || role === "TECH" || role === "ACCOUNTANT";

  const [pendingAttendance, pendingLeaveRequests, bookingRequests, appointmentEvents, publishedShiftPlans] = await Promise.all([
    canApproveShift ? listPendingAttendance(orgId) : Promise.resolve([] as PendingAttendanceRow[]),
    canApproveShift ? listPendingLeaveRequests(orgId) : Promise.resolve([] as PendingLeaveRow[]),
    canSeeBookings ? listOpenBookingRequests(orgId) : Promise.resolve([] as BookingNotificationRow[]),
    canSeeAppointments ? listRecentAppointmentEvents(orgId) : Promise.resolve([] as AppointmentNotificationRow[]),
    shouldSeeShiftPublished ? listRecentPublishedShiftPlans(orgId) : Promise.resolve([] as ShiftPlanNotificationRow[]),
  ]);

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
        if (startAtMs <= Date.now() - APPOINTMENT_OVERDUE_MINUTES * 60 * 1000) {
          return {
            id: `arrival-overdue-${row.id}`,
            kind: "customer_arrival_overdue",
            title: "Khách tới giờ nhưng chưa check-in",
            message: `${pickCustomerName(row.customers)} đã qua giờ hẹn lúc ${formatTime(row.start_at)} mà chưa thấy đến.`,
            href: mapNotificationHref("customer_arrival_overdue"),
            createdAt: row.start_at,
            actionRequired: true,
          };
        }
        return null;
      }

      if (row.status === "CHECKED_IN" && row.checked_in_at) {
        const checkedInAtMs = new Date(row.checked_in_at).getTime();
        if (checkedInAtMs <= Date.now() - STALE_CHECKED_IN_MINUTES * 60 * 1000) {
          return {
            id: `checked-in-stale-${row.id}`,
            kind: "customer_checked_in_stale",
            title: "Khách check-in đã lâu",
            message: `${pickCustomerName(row.customers)} đã check-in từ ${formatTime(row.checked_in_at)} và đang ở trong tiệm khá lâu.`,
            href: mapNotificationHref("customer_checked_in_stale"),
            createdAt: row.checked_in_at,
            actionRequired: true,
          };
        }

        return {
          id: `checked-in-${row.id}`,
          kind: "customer_checked_in",
          title: "Khách đã check-in",
          message: `${pickCustomerName(row.customers)} đã check-in lúc ${formatTime(row.checked_in_at)}.`,
          href: mapNotificationHref("customer_checked_in"),
          createdAt: row.checked_in_at,
          actionRequired: false,
        };
      }

      if (row.status === "DONE" && row.updated_at) {
        return {
          id: `checked-out-${row.id}`,
          kind: "customer_checked_out",
          title: "Khách đã check-out",
          message: `${pickCustomerName(row.customers)} đã hoàn tất lúc ${formatTime(row.updated_at)}.`,
          href: mapNotificationHref("customer_checked_out"),
          createdAt: row.updated_at,
          actionRequired: false,
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
            title: "Lịch ca mới đã được publish",
            message: `OWNER vừa publish lịch ca tuần bắt đầu ngày ${formatDate(plan.week_start)}. Bạn có thể vào xem lịch của mình ngay.`,
            href: mapNotificationHref("shift_published"),
            createdAt: plan.published_at ?? new Date().toISOString(),
            actionRequired: false,
          }))
      : [];

  const notifications: ManageNotificationItem[] = [
    ...pendingAttendance.map((row) => ({
      id: `attendance-${row.id}`,
      kind: "staff_clock_in_approval" as const,
      title: "Nhân sự vào ca chờ duyệt",
      message: `${nameMap.get(row.staff_user_id) ?? "Nhân sự"} vừa chấm công vào ca lúc ${formatTime(row.clock_in)}.`,
      href: mapNotificationHref("staff_clock_in_approval"),
      createdAt: row.clock_in,
      actionRequired: true,
    })),
    ...pendingLeaveRequests.map((row) => ({
      id: `leave-${row.id}`,
      kind: "leave_request" as const,
      title: row.request_type === "DAY_OFF" ? "Xin nghỉ ca chờ duyệt" : "Xin về sớm chờ duyệt",
      message:
        row.request_type === "DAY_OFF"
          ? `${nameMap.get(row.staff_user_id) ?? "Nhân sự"} xin nghỉ ngày ${row.scheduled_date ? formatDate(row.scheduled_date) : "chưa rõ"}.`
          : `${nameMap.get(row.staff_user_id) ?? "Nhân sự"} xin về sớm${row.requested_end_at ? ` lúc ${formatTime(row.requested_end_at)}` : ""}.`,
      href: mapNotificationHref("leave_request"),
      createdAt: row.requested_at,
      actionRequired: true,
    })),
    ...bookingRequests.map((row) => ({
      id: `booking-${row.id}`,
      kind: "booking_request" as const,
      title: row.status === "NEEDS_RESCHEDULE" ? "Booking cần đổi lịch" : "Booking mới từ web",
      message: `${row.customer_name} · ${row.requested_service || "Dịch vụ chưa rõ"} · ${formatTime(row.requested_start_at)} ${formatDate(row.requested_start_at)}.`,
      href: mapNotificationHref("booking_request"),
      createdAt: row.created_at,
      actionRequired: true,
    })),
    ...appointmentNotifications,
    ...shiftPublishedNotifications,
  ];

  return notifications
    .sort((a, b) => {
      const priorityDiff = (NOTIFICATION_PRIORITY[a.kind] ?? 99) - (NOTIFICATION_PRIORITY[b.kind] ?? 99);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 12);
}

export function useAdminNotifications(role: AppRole | null | undefined, email?: string | null, userId?: string | null) {
  const [notifications, setNotifications] = useState<ManageNotificationItem[]>([]);
  const [seenAt, setSeenAt] = useState<string | null>(null);

  const storageKey = email ? `${STORAGE_PREFIX}.${email}` : null;
  const enabled = Boolean(role && MANAGE_NOTIFICATION_ROLES.includes(role));

  const loadSeenAt = useCallback(async () => {
    if (!storageKey) {
      setSeenAt(null);
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(storageKey);
      setSeenAt(stored);
    } catch {
      setSeenAt(null);
    }
  }, [storageKey]);

  const loadNotifications = useCallback(async () => {
    if (!enabled || !role) {
      setNotifications([]);
      return;
    }

    try {
      const rows = await loadManageNotificationsForMobile(role, userId);
      setNotifications(rows);
    } catch {
      setNotifications([]);
    }
  }, [enabled, role, userId]);

  useEffect(() => {
    void loadSeenAt();
  }, [loadSeenAt]);

  useEffect(() => {
    if (!enabled) {
      setNotifications([]);
      return;
    }

    let disposed = false;
    async function run() {
      const rows = await loadManageNotificationsForMobile(role as AppRole, userId);
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
  }, [enabled, role, userId]);

  const actionNotifications = useMemo(
    () => notifications.filter((item) => item.actionRequired),
    [notifications],
  );

  const feedNotifications = useMemo(
    () => notifications.filter((item) => !item.actionRequired),
    [notifications],
  );

  const unreadCount = useMemo(() => {
    const seenAtMs = seenAt ? new Date(seenAt).getTime() : 0;
    return notifications.filter((item) => {
      if (item.actionRequired) return true;
      return new Date(item.createdAt).getTime() > seenAtMs;
    }).length;
  }, [notifications, seenAt]);

  const markSeen = useCallback(async () => {
    const nextSeenAt = new Date().toISOString();
    setSeenAt(nextSeenAt);
    if (!storageKey) return;

    try {
      await AsyncStorage.setItem(storageKey, nextSeenAt);
    } catch {}
  }, [storageKey]);

  return {
    notifications,
    actionNotifications,
    feedNotifications,
    unreadCount,
    reloadNotifications: loadNotifications,
    markSeen,
  };
}
