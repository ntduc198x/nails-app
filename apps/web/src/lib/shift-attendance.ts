import { ensureOrgContext } from "@/lib/domain";
import { loadShiftPlanWeek, type ShiftPlanRecord } from "@/lib/shift-plans";
import { supabase } from "@/lib/supabase";
import type { AutoScheduleAssignment } from "@nails/shared";

export const LATE_GRACE_MINUTES = 10;

export type AttendanceApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type LeaveRequestType = "DAY_OFF" | "EARLY_LEAVE";
export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ShiftWindow = {
  weekStart: string;
  dateKey: string;
  assignment: AutoScheduleAssignment;
  scheduledStartIso: string;
  scheduledEndIso: string;
  lateGraceUntilIso: string;
};

export type ShiftTimeEntryRecord = {
  id: string;
  staff_user_id: string | null;
  clock_in: string;
  clock_out: string | null;
  effective_clock_in: string | null;
  effective_clock_out: string | null;
  scheduled_date: string | null;
  scheduled_shift_type: string | null;
  scheduled_shift_label: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  approval_status: AttendanceApprovalStatus;
  approval_note: string | null;
  approved_by: string | null;
  approved_at: string | null;
  auto_closed: boolean | null;
};

export type ShiftLeaveRequestRecord = {
  id: string;
  staff_user_id: string;
  request_type: LeaveRequestType;
  status: LeaveRequestStatus;
  scheduled_date: string | null;
  requested_at: string;
  requested_end_at: string | null;
  note: string | null;
  owner_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  time_entry_id: string | null;
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStartOfWeek(date: Date) {
  const next = new Date(date);
  const weekday = next.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function combineDateTime(dateKey: string, time: string) {
  return new Date(`${dateKey}T${time}:00`);
}

function mapTimeEntry(row: Record<string, unknown>): ShiftTimeEntryRecord {
  return {
    id: String(row.id ?? ""),
    staff_user_id: typeof row.staff_user_id === "string" ? row.staff_user_id : null,
    clock_in: String(row.clock_in ?? ""),
    clock_out: typeof row.clock_out === "string" ? row.clock_out : null,
    effective_clock_in: typeof row.effective_clock_in === "string" ? row.effective_clock_in : null,
    effective_clock_out: typeof row.effective_clock_out === "string" ? row.effective_clock_out : null,
    scheduled_date: typeof row.scheduled_date === "string" ? row.scheduled_date : null,
    scheduled_shift_type: typeof row.scheduled_shift_type === "string" ? row.scheduled_shift_type : null,
    scheduled_shift_label: typeof row.scheduled_shift_label === "string" ? row.scheduled_shift_label : null,
    scheduled_start: typeof row.scheduled_start === "string" ? row.scheduled_start : null,
    scheduled_end: typeof row.scheduled_end === "string" ? row.scheduled_end : null,
    approval_status:
      row.approval_status === "APPROVED" || row.approval_status === "REJECTED" ? row.approval_status : "PENDING",
    approval_note: typeof row.approval_note === "string" ? row.approval_note : null,
    approved_by: typeof row.approved_by === "string" ? row.approved_by : null,
    approved_at: typeof row.approved_at === "string" ? row.approved_at : null,
    auto_closed: typeof row.auto_closed === "boolean" ? row.auto_closed : null,
  };
}

function mapLeaveRequest(row: Record<string, unknown>): ShiftLeaveRequestRecord {
  return {
    id: String(row.id ?? ""),
    staff_user_id: String(row.staff_user_id ?? ""),
    request_type: row.request_type === "EARLY_LEAVE" ? "EARLY_LEAVE" : "DAY_OFF",
    status: row.status === "APPROVED" || row.status === "REJECTED" ? row.status : "PENDING",
    scheduled_date: typeof row.scheduled_date === "string" ? row.scheduled_date : null,
    requested_at: String(row.requested_at ?? row.created_at ?? ""),
    requested_end_at: typeof row.requested_end_at === "string" ? row.requested_end_at : null,
    note: typeof row.note === "string" ? row.note : null,
    owner_note: typeof row.owner_note === "string" ? row.owner_note : null,
    reviewed_at: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
    reviewed_by: typeof row.reviewed_by === "string" ? row.reviewed_by : null,
    time_entry_id: typeof row.time_entry_id === "string" ? row.time_entry_id : null,
  };
}

export async function loadPublishedShiftWindowForUser(userId: string, targetDate = new Date()): Promise<ShiftWindow | null> {
  const dateKey = toDateKey(targetDate);
  const weekStart = toDateKey(getStartOfWeek(new Date(`${dateKey}T00:00:00`)));
  const plan = await loadShiftPlanWeek(weekStart, { publishedOnly: true });
  const assignment = plan?.result.assignments.find(
    (item) => item.employeeId === userId && item.dateKey === dateKey && item.shiftType !== "OFF",
  );

  if (!plan || !assignment || !assignment.startTime || !assignment.endTime) {
    return null;
  }

  const scheduledStart = combineDateTime(dateKey, assignment.startTime);
  const scheduledEnd = combineDateTime(dateKey, assignment.endTime);
  const lateGraceUntil = new Date(scheduledStart.getTime() + LATE_GRACE_MINUTES * 60_000);

  return {
    weekStart,
    dateKey,
    assignment,
    scheduledStartIso: scheduledStart.toISOString(),
    scheduledEndIso: scheduledEnd.toISOString(),
    lateGraceUntilIso: lateGraceUntil.toISOString(),
  };
}

export function describeShiftWindow(window: ShiftWindow | null, now = new Date()) {
  if (!window) {
    return {
      canCheckIn: false,
      isActive: false,
      started: false,
      ended: false,
      lateMinutes: 0,
      withinGrace: false,
      reason: "Hôm nay bạn không có ca đã được publish.",
    };
  }

  const start = new Date(window.scheduledStartIso).getTime();
  const end = new Date(window.scheduledEndIso).getTime();
  const current = now.getTime();
  const lateMinutes = Math.max(0, Math.floor((current - start) / 60_000));
  const started = current >= start;
  const ended = current > end;
  const withinGrace = current <= new Date(window.lateGraceUntilIso).getTime();

  if (!started) {
    return {
      canCheckIn: false,
      isActive: false,
      started,
      ended,
      lateMinutes: 0,
      withinGrace: false,
      reason: "Bạn chỉ có thể mở ca khi ca của mình bắt đầu.",
    };
  }

  if (ended) {
    return {
      canCheckIn: false,
      isActive: false,
      started,
      ended,
      lateMinutes,
      withinGrace: false,
      reason: "Ca này đã kết thúc, không thể mở ca nữa.",
    };
  }

  return {
    canCheckIn: true,
    isActive: true,
    started,
    ended,
    lateMinutes,
    withinGrace,
    reason: null,
  };
}

export async function syncExpiredShiftEntries() {
  if (!supabase) return;

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("time_entries")
    .select("id,approval_status,scheduled_end,effective_clock_in,clock_in")
    .is("clock_out", null)
    .not("scheduled_end", "is", null)
    .lte("scheduled_end", nowIso)
    .limit(50);

  if (error) throw error;

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const scheduledEnd = typeof row.scheduled_end === "string" ? row.scheduled_end : null;
    if (!scheduledEnd) continue;

    const approvalStatus =
      row.approval_status === "APPROVED" || row.approval_status === "REJECTED" ? row.approval_status : "PENDING";
    const effectiveClockIn =
      typeof row.effective_clock_in === "string"
        ? row.effective_clock_in
        : typeof row.clock_in === "string"
          ? row.clock_in
          : scheduledEnd;
    const effectiveClockOut = approvalStatus === "REJECTED" ? effectiveClockIn : scheduledEnd;

    const { error: updateError } = await supabase
      .from("time_entries")
      .update({
        clock_out: scheduledEnd,
        effective_clock_out: effectiveClockOut,
        auto_closed: true,
      })
      .eq("id", String(row.id));

    if (updateError) throw updateError;
  }
}

export async function listPersonalShiftEntries(userId: string) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("time_entries")
    .select(
      "id,staff_user_id,clock_in,clock_out,effective_clock_in,effective_clock_out,scheduled_date,scheduled_shift_type,scheduled_shift_label,scheduled_start,scheduled_end,approval_status,approval_note,approved_by,approved_at,auto_closed",
    )
    .eq("staff_user_id", userId)
    .order("clock_in", { ascending: false })
    .limit(8);

  if (error) throw error;
  return (data ?? []).map((row) => mapTimeEntry(row as Record<string, unknown>));
}

export async function listOwnerShiftEntries() {
  if (!supabase) return [];
  const { orgId } = await ensureOrgContext();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("time_entries")
    .select(
      "id,staff_user_id,clock_in,clock_out,effective_clock_in,effective_clock_out,scheduled_date,scheduled_shift_type,scheduled_shift_label,scheduled_start,scheduled_end,approval_status,approval_note,approved_by,approved_at,auto_closed",
    )
    .eq("org_id", orgId)
    .gte("clock_in", todayStart.toISOString())
    .order("clock_in", { ascending: false })
    .limit(30);

  if (error) throw error;
  return (data ?? []).map((row) => mapTimeEntry(row as Record<string, unknown>));
}

export async function listShiftLeaveRequests(opts?: { userId?: string; status?: LeaveRequestStatus }) {
  if (!supabase) return [];
  const { orgId } = await ensureOrgContext();

  let query = supabase
    .from("shift_leave_requests")
    .select("id,staff_user_id,request_type,status,scheduled_date,requested_at,requested_end_at,note,owner_note,reviewed_at,reviewed_by,time_entry_id,created_at")
    .eq("org_id", orgId)
    .order("requested_at", { ascending: false })
    .limit(30);

  if (opts?.userId) {
    query = query.eq("staff_user_id", opts.userId);
  }
  if (opts?.status) {
    query = query.eq("status", opts.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapLeaveRequest(row as Record<string, unknown>));
}

async function getApprovedDayOffRequest(userId: string, dateKey: string) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("shift_leave_requests")
    .select("id")
    .eq("staff_user_id", userId)
    .eq("request_type", "DAY_OFF")
    .eq("status", "APPROVED")
    .eq("scheduled_date", dateKey)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createShiftCheckIn() {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { orgId } = await ensureOrgContext();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) throw new Error("Chưa đăng nhập");

  await syncExpiredShiftEntries();

  const existingEntries = await listPersonalShiftEntries(userId);
  if (existingEntries.some((entry) => entry.clock_out === null && entry.approval_status !== "REJECTED")) {
    throw new Error("Bạn đang có một ca làm chưa đóng.");
  }

  const window = await loadPublishedShiftWindowForUser(userId, new Date());
  const windowState = describeShiftWindow(window, new Date());
  if (!window || !windowState.canCheckIn) {
    throw new Error(windowState.reason ?? "Không thể mở ca vào lúc này.");
  }

  const dayOffRequest = await getApprovedDayOffRequest(userId, window.dateKey);
  if (dayOffRequest) {
    throw new Error("Bạn đã được duyệt nghỉ cho ca này nên không thể mở ca.");
  }

  const nowIso = new Date().toISOString();
  const effectiveClockIn = windowState.withinGrace ? window.scheduledStartIso : nowIso;

  const { data: inserted, error } = await supabase
    .from("time_entries")
    .insert({
      org_id: orgId,
      staff_user_id: userId,
      clock_in: nowIso,
      effective_clock_in: effectiveClockIn,
      scheduled_date: window.dateKey,
      scheduled_week_start: window.weekStart,
      scheduled_shift_type: window.assignment.shiftType,
      scheduled_shift_label: window.assignment.shiftLabel,
      scheduled_start: window.scheduledStartIso,
      scheduled_end: window.scheduledEndIso,
      approval_status: "PENDING",
      auto_closed: false,
    })
    .select(
      "id,staff_user_id,clock_in,clock_out,effective_clock_in,effective_clock_out,scheduled_date,scheduled_shift_type,scheduled_shift_label,scheduled_start,scheduled_end,approval_status,approval_note,approved_by,approved_at,auto_closed",
    )
    .single();

  if (error) throw error;
  return mapTimeEntry(inserted as Record<string, unknown>);
}

export async function closeShiftEntryIfAllowed(entry: ShiftTimeEntryRecord) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  if (entry.clock_out) return entry;

  const now = new Date();
  const scheduledEnd = entry.scheduled_end ? new Date(entry.scheduled_end) : null;
  if (scheduledEnd && now.getTime() < scheduledEnd.getTime()) {
    throw new Error("Muốn về sớm bạn cần gửi xin nghỉ sớm để OWNER duyệt.");
  }

  const closedAt = entry.scheduled_end ?? now.toISOString();
  const effectiveClockOut = entry.approval_status === "REJECTED" ? entry.effective_clock_in ?? entry.clock_in : closedAt;

  const { data, error } = await supabase
    .from("time_entries")
    .update({
      clock_out: closedAt,
      effective_clock_out: effectiveClockOut,
      auto_closed: entry.scheduled_end ? true : false,
    })
    .eq("id", entry.id)
    .select(
      "id,staff_user_id,clock_in,clock_out,effective_clock_in,effective_clock_out,scheduled_date,scheduled_shift_type,scheduled_shift_label,scheduled_start,scheduled_end,approval_status,approval_note,approved_by,approved_at,auto_closed",
    )
    .single();

  if (error) throw error;
  return mapTimeEntry(data as Record<string, unknown>);
}

export async function reviewShiftCheckIn(entryId: string, approve: boolean, note?: string) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { data } = await supabase.auth.getSession();
  const ownerId = data.session?.user?.id;
  if (!ownerId) throw new Error("Chưa đăng nhập");

  const { data: current, error: fetchError } = await supabase
    .from("time_entries")
    .select(
      "id,clock_in,effective_clock_in,scheduled_start,scheduled_end,clock_out,approval_status,staff_user_id,scheduled_date,scheduled_shift_type,scheduled_shift_label,effective_clock_out,approval_note,approved_by,approved_at,auto_closed",
    )
    .eq("id", entryId)
    .single();

  if (fetchError) throw fetchError;

  const row = current as Record<string, unknown>;
  const scheduledStart = typeof row.scheduled_start === "string" ? row.scheduled_start : typeof row.clock_in === "string" ? row.clock_in : new Date().toISOString();
  const clockIn = typeof row.clock_in === "string" ? row.clock_in : scheduledStart;
  const approvedClockIn = new Date(clockIn).getTime() <= new Date(scheduledStart).getTime() + LATE_GRACE_MINUTES * 60_000
    ? scheduledStart
    : clockIn;

  const payload = approve
    ? {
        approval_status: "APPROVED",
        approval_note: note ?? null,
        approved_by: ownerId,
        approved_at: new Date().toISOString(),
        effective_clock_in: approvedClockIn,
      }
    : {
        approval_status: "REJECTED",
        approval_note: note ?? null,
        approved_by: ownerId,
        approved_at: new Date().toISOString(),
        clock_out: typeof row.clock_out === "string" ? row.clock_out : clockIn,
        effective_clock_in: clockIn,
        effective_clock_out: clockIn,
      };

  const { data: updated, error } = await supabase
    .from("time_entries")
    .update(payload)
    .eq("id", entryId)
    .select(
      "id,staff_user_id,clock_in,clock_out,effective_clock_in,effective_clock_out,scheduled_date,scheduled_shift_type,scheduled_shift_label,scheduled_start,scheduled_end,approval_status,approval_note,approved_by,approved_at,auto_closed",
    )
    .single();

  if (error) throw error;
  return mapTimeEntry(updated as Record<string, unknown>);
}

export async function submitDayOffRequest(dateKey: string, note?: string) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { orgId } = await ensureOrgContext();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) throw new Error("Chưa đăng nhập");

  const window = await loadPublishedShiftWindowForUser(userId, new Date(`${dateKey}T12:00:00`));
  if (!window || window.dateKey !== dateKey) {
    throw new Error("Ngày này không có ca đã publish để xin nghỉ.");
  }

  const { data: inserted, error } = await supabase
    .from("shift_leave_requests")
    .insert({
      org_id: orgId,
      staff_user_id: userId,
      request_type: "DAY_OFF",
      status: "PENDING",
      scheduled_date: dateKey,
      note: note ?? null,
    })
    .select("id,staff_user_id,request_type,status,scheduled_date,requested_at,requested_end_at,note,owner_note,reviewed_at,reviewed_by,time_entry_id,created_at")
    .single();

  if (error) throw error;
  return mapLeaveRequest(inserted as Record<string, unknown>);
}

export async function submitEarlyLeaveRequest(entry: ShiftTimeEntryRecord, requestedEndIso: string, note?: string) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { orgId } = await ensureOrgContext();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) throw new Error("Chưa đăng nhập");
  if (!entry.scheduled_end) throw new Error("Ca này không có giờ kết thúc chuẩn.");

  const requestedEnd = new Date(requestedEndIso);
  const scheduledEnd = new Date(entry.scheduled_end);
  const actualStart = new Date(entry.clock_in);
  if (requestedEnd.getTime() <= actualStart.getTime()) {
    throw new Error("Giờ xin nghỉ sớm phải sau giờ mở ca.");
  }
  if (requestedEnd.getTime() >= scheduledEnd.getTime()) {
    throw new Error("Nếu làm hết ca, hệ thống sẽ tự động đóng ca, không cần xin nghỉ sớm.");
  }

  const { data: inserted, error } = await supabase
    .from("shift_leave_requests")
    .insert({
      org_id: orgId,
      staff_user_id: userId,
      request_type: "EARLY_LEAVE",
      status: "PENDING",
      scheduled_date: entry.scheduled_date,
      requested_end_at: requestedEnd.toISOString(),
      note: note ?? null,
      time_entry_id: entry.id,
    })
    .select("id,staff_user_id,request_type,status,scheduled_date,requested_at,requested_end_at,note,owner_note,reviewed_at,reviewed_by,time_entry_id,created_at")
    .single();

  if (error) throw error;
  return mapLeaveRequest(inserted as Record<string, unknown>);
}

export async function reviewShiftLeaveRequest(requestId: string, approve: boolean, ownerNote?: string) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { data } = await supabase.auth.getSession();
  const ownerId = data.session?.user?.id;
  if (!ownerId) throw new Error("Chưa đăng nhập");

  const { data: current, error: fetchError } = await supabase
    .from("shift_leave_requests")
    .select("id,request_type,time_entry_id,requested_end_at")
    .eq("id", requestId)
    .single();

  if (fetchError) throw fetchError;

  const status = approve ? "APPROVED" : "REJECTED";
  const { data: updated, error } = await supabase
    .from("shift_leave_requests")
    .update({
      status,
      owner_note: ownerNote ?? null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: ownerId,
    })
    .eq("id", requestId)
    .select("id,staff_user_id,request_type,status,scheduled_date,requested_at,requested_end_at,note,owner_note,reviewed_at,reviewed_by,time_entry_id,created_at")
    .single();

  if (error) throw error;

  if (approve && current.request_type === "EARLY_LEAVE" && typeof current.time_entry_id === "string" && typeof current.requested_end_at === "string") {
    const requestedEndIso = current.requested_end_at;
    const { error: timeEntryError } = await supabase
      .from("time_entries")
      .update({
        clock_out: requestedEndIso,
        effective_clock_out: requestedEndIso,
        auto_closed: false,
      })
      .eq("id", current.time_entry_id);

    if (timeEntryError) throw timeEntryError;
  }

  return mapLeaveRequest(updated as Record<string, unknown>);
}

export function applyApprovedDayOffToAssignments(
  assignments: AutoScheduleAssignment[],
  requests: ShiftLeaveRequestRecord[],
) {
  const approvedDayOffs = new Set(
    requests
      .filter((request) => request.request_type === "DAY_OFF" && request.status === "APPROVED" && request.scheduled_date)
      .map((request) => request.scheduled_date as string),
  );

  return assignments.map((assignment) =>
    approvedDayOffs.has(assignment.dateKey)
      ? {
          ...assignment,
          shiftType: "OFF" as const,
          shiftLabel: "Nghỉ (đã duyệt)",
          shortCode: "OFF",
          startTime: "",
          endTime: "",
          hours: 0,
        }
      : assignment,
  );
}

export function getTodayAssignmentFromPlan(plan: ShiftPlanRecord | null, userId: string, dateKey: string) {
  if (!plan) return null;
  return (
    plan.result.assignments.find(
      (assignment) => assignment.employeeId === userId && assignment.dateKey === dateKey && assignment.shiftType !== "OFF",
    ) ?? null
  );
}
