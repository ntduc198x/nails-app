import { ensureOrgContext, type AppRole } from "@nails/shared";
import {
  generateWeekDates,
  normalizeServiceSkill,
  type AutoScheduleAssignment,
  type AutoScheduleConflict,
  type AutoScheduleDaySummary,
  type AutoScheduleDemand,
  type AutoScheduleEmployeeSummary,
  type AutoScheduleResult,
  type AutoScheduleSuggestion,
  type AvailabilityRule,
  type ServiceSkill,
  type ShiftType,
  type StaffRole,
} from "@nails/shared";
import { mobileSupabase } from "@/src/lib/supabase";

export const LATE_GRACE_MINUTES = 10;

export type ShiftPlanStatus = "draft" | "published";
export type AttendanceApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type LeaveRequestType = "DAY_OFF" | "EARLY_LEAVE";
export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

type ShiftPlanRow = {
  id: string;
  week_start: string;
  status: ShiftPlanStatus;
  assignments_json: AutoScheduleAssignment[] | null;
  demands_json: AutoScheduleDemand[] | null;
  forecast_json: Record<string, number> | null;
  employee_summaries_json: AutoScheduleEmployeeSummary[] | null;
  day_summaries_json: AutoScheduleDaySummary[] | null;
  conflicts_json: AutoScheduleConflict[] | null;
  suggestions_json: AutoScheduleSuggestion[] | null;
  published_at: string | null;
};

type StaffShiftProfileRow = {
  user_id: string;
  staff_role: StaffRole | null;
  skills_json: ServiceSkill[] | null;
  availability_json: AvailabilityRule[] | null;
  leave_dates_json: string[] | null;
  max_weekly_hours: number | null;
  fairness_offset_hours: number | null;
  performance_score: number | null;
};

export type ShiftPlanRecord = {
  id: string;
  weekStart: string;
  status: ShiftPlanStatus;
  publishedAt: string | null;
  result: AutoScheduleResult;
  demands: AutoScheduleDemand[];
  forecast: Record<string, number>;
};

export type StaffShiftProfileRecord = {
  userId: string;
  staffRole: StaffRole;
  skills: ServiceSkill[];
  availability: AvailabilityRule[];
  leaveDateKeys: string[];
  maxWeeklyHours: number;
  fairnessOffsetHours: number;
  performanceScore: number;
};

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

const SHIFT_TYPE_OPTIONS: ShiftType[] = ["MORNING", "AFTERNOON", "FULL_DAY"];
const STAFF_ROLE_OPTIONS: StaffRole[] = ["MANAGER", "RECEPTION", "TECH", "ACCOUNTANT"];
const FORECAST_BOOKING_STATUSES = ["BOOKED", "CHECKED_IN", "DONE"] as const;
const FORECAST_REQUEST_STATUSES = ["OPEN", "PENDING", "CONFIRMED"] as const;

function requireSupabase() {
  if (!mobileSupabase) throw new Error("Thiếu cấu hình Supabase mobile.");
  return mobileSupabase;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, amount: number) {
  const next = new Date(`${dateKey}T00:00:00`);
  next.setDate(next.getDate() + amount);
  return toDateKey(next);
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

function clampInteger(value: number | null | undefined, min: number, max: number, fallback: number) {
  const numeric = Number.isFinite(value) ? Number(value) : fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function normalizeSkills(value: ServiceSkill[] | null | undefined) {
  return [
    ...new Set(
      (value ?? [])
        .map((skill) => normalizeServiceSkill(String(skill)))
        .filter((skill): skill is ServiceSkill => !!skill),
    ),
  ];
}

function normalizeAvailability(value: AvailabilityRule[] | null | undefined) {
  return (value ?? [])
    .filter((rule): rule is AvailabilityRule => Number.isInteger(rule?.weekday) && rule.weekday >= 0 && rule.weekday <= 6)
    .map((rule) => ({
      weekday: rule.weekday,
      shiftTypes: [
        ...new Set(
          (rule.shiftTypes ?? []).filter((shiftType): shiftType is ShiftType => SHIFT_TYPE_OPTIONS.includes(shiftType)),
        ),
      ],
    }))
    .filter((rule) => rule.shiftTypes.length > 0)
    .sort((left, right) => left.weekday - right.weekday);
}

function normalizeLeaveDateKeys(value: string[] | null | undefined) {
  return [...new Set((value ?? []).filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item)))].sort();
}

function normalizeStaffRole(role: StaffRole | null | undefined, fallback: StaffRole): StaffRole {
  return role && STAFF_ROLE_OPTIONS.includes(role) ? role : fallback;
}

function normalizeShiftPlan(row: ShiftPlanRow): ShiftPlanRecord {
  const assignments = (row.assignments_json ?? []).map((assignment) => ({
    ...assignment,
    matchedSkills: normalizeSkills(assignment.matchedSkills),
  }));
  const demands = (row.demands_json ?? []).map((demand) => ({
    ...demand,
    requiredSkills: normalizeSkills(demand.requiredSkills),
  }));
  const employeeSummaries = (row.employee_summaries_json ?? []).map((summary) => ({
    ...summary,
    skillsCovered: normalizeSkills(summary.skillsCovered),
  }));
  const rawDaySummaries = (row.day_summaries_json ?? []).map((summary) => ({
    ...summary,
    missingSkills: normalizeSkills(summary.missingSkills),
  }));
  const recordedWeekDates = rawDaySummaries.map((item) => item.dateKey);
  const fallbackWeekDates = [...new Set(assignments.map((item) => item.dateKey))].sort();
  const earliestDateKey = [...recordedWeekDates, ...fallbackWeekDates].sort()[0] ?? row.week_start;
  const legacyOffsetDays = earliestDateKey < row.week_start ? 1 : 0;

  const normalizedAssignments =
    legacyOffsetDays === 0
      ? assignments
      : assignments.map((assignment) => ({ ...assignment, dateKey: addDays(assignment.dateKey, legacyOffsetDays) }));
  const normalizedDemands =
    legacyOffsetDays === 0
      ? demands
      : demands.map((demand) => ({ ...demand, dateKey: addDays(demand.dateKey, legacyOffsetDays) }));
  const daySummaries =
    legacyOffsetDays === 0
      ? rawDaySummaries
      : rawDaySummaries.map((summary) => ({ ...summary, dateKey: addDays(summary.dateKey, legacyOffsetDays) }));
  const normalizedForecast =
    legacyOffsetDays === 0
      ? row.forecast_json ?? {}
      : Object.fromEntries(
          Object.entries(row.forecast_json ?? {}).map(([dateKey, value]) => [addDays(dateKey, legacyOffsetDays), value]),
        );

  return {
    id: row.id,
    weekStart: row.week_start,
    status: row.status,
    publishedAt: row.published_at,
    result: {
      weekStart: row.week_start,
      weekDates: daySummaries.map((item) => item.dateKey),
      assignments: normalizedAssignments,
      conflicts: row.conflicts_json ?? [],
      suggestions: row.suggestions_json ?? [],
      employeeSummaries,
      daySummaries,
    },
    demands: normalizedDemands,
    forecast: normalizedForecast,
  };
}

function normalizeStaffShiftProfile(row: StaffShiftProfileRow, fallbackRole: StaffRole): StaffShiftProfileRecord {
  return {
    userId: row.user_id,
    staffRole: normalizeStaffRole(row.staff_role, fallbackRole),
    skills: normalizeSkills(row.skills_json),
    availability: normalizeAvailability(row.availability_json),
    leaveDateKeys: normalizeLeaveDateKeys(row.leave_dates_json),
    maxWeeklyHours: clampInteger(row.max_weekly_hours, 0, 84, 40),
    fairnessOffsetHours: clampInteger(row.fairness_offset_hours, 0, 24, 0),
    performanceScore: clampInteger(row.performance_score, 1, 10, 7),
  };
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

export function createEmptyStaffShiftProfile(userId: string, staffRole: StaffRole): StaffShiftProfileRecord {
  return {
    userId,
    staffRole,
    skills: [],
    availability: [],
    leaveDateKeys: [],
    maxWeeklyHours: 40,
    fairnessOffsetHours: 0,
    performanceScore: 7,
  };
}

export function normalizeStaffShiftProfiles(rows: StaffShiftProfileRow[], fallbackRoles: Map<string, StaffRole>) {
  return rows.map((row) => normalizeStaffShiftProfile(row, fallbackRoles.get(row.user_id) ?? "TECH"));
}

export function isMissingShiftPlansSchema(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = [
    (error as { message?: string }).message,
    (error as { details?: string }).details,
    (error as { hint?: string }).hint,
    (error as { code?: string }).code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    message.includes("shift_plans") &&
    (message.includes("does not exist") ||
      message.includes("could not find the table") ||
      message.includes("42p01") ||
      message.includes("schema cache"))
  );
}

export function isMissingStaffShiftProfilesSchema(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = [
    (error as { message?: string }).message,
    (error as { details?: string }).details,
    (error as { hint?: string }).hint,
    (error as { code?: string }).code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    message.includes("staff_shift_profiles") &&
    (message.includes("does not exist") ||
      message.includes("could not find the table") ||
      message.includes("42p01") ||
      message.includes("schema cache"))
  );
}

async function getCurrentUserId() {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const userId = data.session?.user?.id;
  if (!userId) throw new Error("Chưa đăng nhập");
  return userId;
}

export async function loadShiftPlanWeek(
  weekStart: string,
  opts?: { publishedOnly?: boolean; status?: ShiftPlanStatus },
): Promise<ShiftPlanRecord | null> {
  const supabase = requireSupabase();
  const { orgId, branchId } = await ensureOrgContext(supabase);

  let query = supabase
    .from("shift_plans")
    .select(
      "id,week_start,status,assignments_json,demands_json,forecast_json,employee_summaries_json,day_summaries_json,conflicts_json,suggestions_json,published_at",
    )
    .eq("org_id", orgId)
    .eq("branch_id", branchId)
    .eq("week_start", weekStart);

  const targetStatus = opts?.status ?? (opts?.publishedOnly ? "published" : "draft");
  query = query.eq("status", targetStatus);

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return normalizeShiftPlan(data as ShiftPlanRow);
}

export async function saveShiftPlanWeek(input: {
  weekStart: string;
  status: ShiftPlanStatus;
  result: AutoScheduleResult;
  demands: AutoScheduleDemand[];
  forecast: Record<string, number>;
}) {
  const supabase = requireSupabase();
  const { orgId, branchId } = await ensureOrgContext(supabase);
  const userId = await getCurrentUserId();

  const payload = {
    org_id: orgId,
    branch_id: branchId,
    week_start: input.weekStart,
    status: input.status,
    assignments_json: input.result.assignments,
    demands_json: input.demands,
    forecast_json: input.forecast,
    employee_summaries_json: input.result.employeeSummaries,
    day_summaries_json: input.result.daySummaries,
    conflicts_json: input.result.conflicts,
    suggestions_json: input.result.suggestions,
    notes_json: { source: "mobile-admin-shifts" },
    published_at: input.status === "published" ? new Date().toISOString() : null,
    created_by: userId,
    updated_by: userId,
  };

  const { data, error } = await supabase
    .from("shift_plans")
    .upsert(payload, { onConflict: "org_id,branch_id,week_start,status" })
    .select(
      "id,week_start,status,assignments_json,demands_json,forecast_json,employee_summaries_json,day_summaries_json,conflicts_json,suggestions_json,published_at",
    )
    .single();

  if (error) throw error;
  return normalizeShiftPlan(data as ShiftPlanRow);
}

export async function loadStaffShiftProfiles() {
  const supabase = requireSupabase();
  const { orgId, branchId } = await ensureOrgContext(supabase);

  const { data, error } = await supabase
    .from("staff_shift_profiles")
    .select(
      "user_id,staff_role,skills_json,availability_json,leave_dates_json,max_weekly_hours,fairness_offset_hours,performance_score",
    )
    .eq("org_id", orgId)
    .eq("branch_id", branchId);

  if (error) throw error;
  return (data ?? []) as StaffShiftProfileRow[];
}

export async function saveStaffShiftProfile(input: StaffShiftProfileRecord) {
  const supabase = requireSupabase();
  const { orgId, branchId } = await ensureOrgContext(supabase);

  const payload = {
    user_id: input.userId,
    org_id: orgId,
    branch_id: branchId,
    staff_role: input.staffRole,
    skills_json: normalizeSkills(input.skills),
    availability_json: normalizeAvailability(input.availability),
    leave_dates_json: normalizeLeaveDateKeys(input.leaveDateKeys),
    max_weekly_hours: clampInteger(input.maxWeeklyHours, 0, 84, 40),
    fairness_offset_hours: clampInteger(input.fairnessOffsetHours, 0, 24, 0),
    performance_score: clampInteger(input.performanceScore, 1, 10, 7),
    notes_json: { source: "mobile-admin-shifts" },
  };

  const { data, error } = await supabase
    .from("staff_shift_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select(
      "user_id,staff_role,skills_json,availability_json,leave_dates_json,max_weekly_hours,fairness_offset_hours,performance_score",
    )
    .single();

  if (error) throw error;
  return normalizeStaffShiftProfile(data as StaffShiftProfileRow, input.staffRole);
}

export async function loadWeeklyShiftForecast(weekStart: string) {
  const supabase = requireSupabase();
  const { orgId } = await ensureOrgContext(supabase);
  const weekDates = generateWeekDates(weekStart);
  const startAt = `${weekDates[0]}T00:00:00.000Z`;
  const endAt = `${weekDates[weekDates.length - 1]}T23:59:59.999Z`;

  const [appointmentsResult, bookingRequestsResult] = await Promise.all([
    supabase
      .from("appointments")
      .select("start_at,status")
      .eq("org_id", orgId)
      .gte("start_at", startAt)
      .lte("start_at", endAt)
      .in("status", [...FORECAST_BOOKING_STATUSES]),
    supabase
      .from("booking_requests")
      .select("requested_start_at,status")
      .eq("org_id", orgId)
      .gte("requested_start_at", startAt)
      .lte("requested_start_at", endAt)
      .in("status", [...FORECAST_REQUEST_STATUSES]),
  ]);

  if (appointmentsResult.error) throw appointmentsResult.error;
  if (bookingRequestsResult.error) throw bookingRequestsResult.error;

  const forecast = weekDates.reduce<Record<string, number>>((result, dateKey) => {
    result[dateKey] = 0;
    return result;
  }, {});

  for (const row of appointmentsResult.data ?? []) {
    if (!row.start_at) continue;
    const dateKey = new Date(row.start_at).toISOString().slice(0, 10);
    if (dateKey in forecast) forecast[dateKey] += 1;
  }

  for (const row of bookingRequestsResult.data ?? []) {
    if (!row.requested_start_at) continue;
    const dateKey = new Date(row.requested_start_at).toISOString().slice(0, 10);
    if (dateKey in forecast) forecast[dateKey] += 1;
  }

  return forecast;
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
      reason: "Hôm nay bạn không có ca đã được xuất bản.",
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
  const supabase = requireSupabase();
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
  const supabase = requireSupabase();
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
  const supabase = requireSupabase();
  const { orgId } = await ensureOrgContext(supabase);
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
  const supabase = requireSupabase();
  const { orgId } = await ensureOrgContext(supabase);

  let query = supabase
    .from("shift_leave_requests")
    .select("id,staff_user_id,request_type,status,scheduled_date,requested_at,requested_end_at,note,owner_note,reviewed_at,reviewed_by,time_entry_id,created_at")
    .eq("org_id", orgId)
    .order("requested_at", { ascending: false })
    .limit(30);

  if (opts?.userId) query = query.eq("staff_user_id", opts.userId);
  if (opts?.status) query = query.eq("status", opts.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapLeaveRequest(row as Record<string, unknown>));
}

async function getApprovedDayOffRequest(userId: string, dateKey: string) {
  const supabase = requireSupabase();
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
  const supabase = requireSupabase();
  const { orgId } = await ensureOrgContext(supabase);
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
  const supabase = requireSupabase();
  if (entry.clock_out) return entry;

  const now = new Date();
  const scheduledEnd = entry.scheduled_end ? new Date(entry.scheduled_end) : null;
  if (scheduledEnd && now.getTime() < scheduledEnd.getTime()) {
    throw new Error("Muốn về sớm bạn cần gửi xin nghỉ sớm để quản lý duyệt.");
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
  const supabase = requireSupabase();
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
  const scheduledStart =
    typeof row.scheduled_start === "string" ? row.scheduled_start : typeof row.clock_in === "string" ? row.clock_in : new Date().toISOString();
  const clockIn = typeof row.clock_in === "string" ? row.clock_in : scheduledStart;
  const approvedClockIn =
    new Date(clockIn).getTime() <= new Date(scheduledStart).getTime() + LATE_GRACE_MINUTES * 60_000
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
  const supabase = requireSupabase();
  const { orgId } = await ensureOrgContext(supabase);
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
  const supabase = requireSupabase();
  const { orgId } = await ensureOrgContext(supabase);
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
  const supabase = requireSupabase();
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

export function applyApprovedDayOffToAssignments(assignments: AutoScheduleAssignment[], requests: ShiftLeaveRequestRecord[]) {
  const approvedDayOffs = new Set(
    requests
      .filter((request) => request.request_type === "DAY_OFF" && request.status === "APPROVED" && request.scheduled_date)
      .map((request) => `${request.staff_user_id}:${request.scheduled_date as string}`),
  );

  return assignments.map((assignment) =>
    approvedDayOffs.has(`${assignment.employeeId}:${assignment.dateKey}`)
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

export function canManageShiftPlans(role: AppRole | null) {
  return role === "OWNER" || role === "PARTNER" || role === "MANAGER";
}
