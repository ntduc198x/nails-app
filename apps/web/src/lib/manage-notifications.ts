import { ensureOrgContext } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import type { AppRole } from "@nails/shared";

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
  href: string;
  createdAt: string;
  actionRequired: boolean;
};

function isManageNotificationItem(
  value: ManageNotificationItem | null,
): value is ManageNotificationItem {
  return value !== null;
}

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

async function loadProfileNameMap(userIds: string[]) {
  if (!supabase || userIds.length === 0) return new Map<string, string>();

  const { data, error } = await supabase
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
  if (!supabase) return [] as PendingAttendanceRow[];

  const { data, error } = await supabase
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
  if (!supabase) return [] as PendingLeaveRow[];

  const { data, error } = await supabase
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
  if (!supabase) return [] as BookingNotificationRow[];

  const { data, error } = await supabase
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
  if (!supabase) return [] as AppointmentNotificationRow[];

  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
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
  if (!supabase) return [] as ShiftPlanNotificationRow[];

  const sinceIso = new Date(Date.now() - RECENT_SHIFT_PUBLISHED_HOURS * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
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

export async function loadManageNotifications(role: AppRole) {
  if (!supabase) return [] as ManageNotificationItem[];

  const { orgId } = await ensureOrgContext();
  const canApproveShift = role === "OWNER" || role === "MANAGER";
  const canSeeBookings = role === "OWNER" || role === "MANAGER" || role === "RECEPTION" || role === "TECH";
  const canSeeAppointments =
    role === "OWNER" || role === "MANAGER" || role === "RECEPTION" || role === "TECH" || role === "ACCOUNTANT";
  const shouldSeeShiftPublished = role === "RECEPTION" || role === "TECH" || role === "ACCOUNTANT";

  const { data: sessionData } = await supabase.auth.getSession();
  const currentUserId = sessionData.session?.user?.id ?? null;

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
        const now = Date.now();
        if (startAtMs <= now - APPOINTMENT_OVERDUE_MINUTES * 60 * 1000) {
          return {
            id: `arrival-overdue-${row.id}`,
            kind: "customer_arrival_overdue",
            title: "Khách tới giờ nhưng chưa check-in",
            message: `${pickCustomerName(row.customers)} đã qua giờ hẹn lúc ${formatTime(row.start_at)} mà chưa thấy đến.`,
            href: "/manage/appointments",
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
            href: "/manage/appointments",
            createdAt: row.checked_in_at,
            actionRequired: true,
          };
        }

        return {
          id: `checked-in-${row.id}`,
          kind: "customer_checked_in",
          title: "Khách đã check-in",
          message: `${pickCustomerName(row.customers)} đã check-in lúc ${formatTime(row.checked_in_at)}.`,
          href: "/manage/appointments",
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
          href: "/manage/checkout",
          createdAt: row.updated_at,
          actionRequired: false,
        };
      }

      return null;
    })
    .filter(isManageNotificationItem);

  const shiftPublishedNotifications =
    shouldSeeShiftPublished && currentUserId
      ? publishedShiftPlans
          .filter((plan) =>
            Array.isArray(plan.assignments_json)
              ? plan.assignments_json.some((assignment) => assignment.employeeId === currentUserId)
              : false,
          )
          .map<ManageNotificationItem>((plan) => ({
            id: `shift-published-${plan.id}`,
            kind: "shift_published",
            title: "Lịch ca mới đã được publish",
            message: `OWNER vừa publish lịch ca tuần bắt đầu ngày ${formatDate(plan.week_start)}. Bạn có thể vào xem lịch của mình ngay.`,
            href: "/manage/shifts",
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
      href: "/manage/shifts",
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
      href: "/manage/shifts",
      createdAt: row.requested_at,
      actionRequired: true,
    })),
    ...bookingRequests.map((row) => ({
      id: `booking-${row.id}`,
      kind: "booking_request" as const,
      title: row.status === "NEEDS_RESCHEDULE" ? "Booking cần đổi lịch" : "Booking mới từ web",
      message: `${row.customer_name} · ${row.requested_service || "Dịch vụ chưa rõ"} · ${formatTime(row.requested_start_at)} ${formatDate(row.requested_start_at)}.`,
      href: "/manage/booking-requests",
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
