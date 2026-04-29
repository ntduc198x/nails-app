"use client";

import { AppShell } from "@/components/app-shell";
import { ManageAlert } from "@/components/manage-alert";
import { MobileSectionHeader, MobileStickyActions } from "@/components/manage-mobile";
import { ManageQuickNav, operationsQuickNav } from "@/components/manage-quick-nav";
import { getCurrentSessionRole, listUserRoles, type AppRole } from "@/lib/auth";
import { getRoleLabel } from "@/lib/role-labels";
import {
  applyApprovedDayOffToAssignments,
  closeShiftEntryIfAllowed,
  createShiftCheckIn,
  describeShiftWindow,
  getTodayAssignmentFromPlan,
  listOwnerShiftEntries,
  listPersonalShiftEntries,
  listShiftLeaveRequests,
  loadPublishedShiftWindowForUser,
  reviewShiftCheckIn,
  reviewShiftLeaveRequest,
  submitDayOffRequest,
  submitEarlyLeaveRequest,
  syncExpiredShiftEntries,
  type ShiftLeaveRequestRecord,
  type ShiftTimeEntryRecord,
  type ShiftWindow,
} from "@/lib/shift-attendance";
import { loadWeeklyShiftForecast } from "@/lib/shift-forecast";
import {
  isMissingShiftPlansSchema,
  loadShiftPlanWeek,
  saveShiftPlanWeek,
  type ShiftPlanRecord,
  type ShiftPlanStatus,
} from "@/lib/shift-plans";
import {
  createEmptyStaffShiftProfile,
  isMissingStaffShiftProfilesSchema,
  loadStaffShiftProfiles,
  normalizeStaffShiftProfiles,
  saveStaffShiftProfile,
  type StaffShiftProfileRecord,
} from "@/lib/shift-staff-profiles";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_SHIFT_DEFINITIONS,
  buildAutoScheduleResult,
  buildDefaultWeekDemands,
  generateDraftSchedule,
  getRecommendedShiftTypesForDate,
  generateWeekDates,
  type AutoScheduleAssignment,
  type AutoScheduleDaySummary,
  type AutoScheduleDemand,
  type AutoScheduleEmployee,
  type AutoScheduleResult,
  type ServiceSkill,
  type ShiftDefinition,
  type ShiftType,
  type StaffRole,
} from "@nails/shared";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TeamRoleRow = {
  user_id: string;
  display_name?: string | null;
  email?: string | null;
  role?: AppRole | null;
};

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const FILTER_ALL = "ALL";

function getWeekdayLabel(dateKey: string) {
  const weekday = new Date(`${dateKey}T00:00:00`).getDay();
  return WEEKDAY_LABELS[(weekday + 6) % 7];
}

function getStartOfWeek(date: Date) {
  const next = new Date(date);
  const weekday = next.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonths(date: Date, amount: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

function formatWeekRange(weekStart: string) {
  const weekDates = generateWeekDates(weekStart);
  const start = new Date(`${weekDates[0]}T00:00:00`);
  const end = new Date(`${weekDates[6]}T00:00:00`);
  return `${new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "long",
  }).format(start)} - ${new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(end)}`;
}

function formatDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${dateKey}T00:00:00`));
}

function formatTime(dateTime: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateTime));
}

function formatEntryDuration(clockIn: string, clockOut: string | null) {
  const start = new Date(clockIn).getTime();
  const end = clockOut ? new Date(clockOut).getTime() : Date.now();
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours}h ${String(remaining).padStart(2, "0")}m`;
}

function shiftThemeClasses(theme: ShiftDefinition["theme"]) {
  switch (theme) {
    case "morning":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "afternoon":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "full":
      return "border-violet-200 bg-violet-50 text-violet-800";
    default:
      return "border-rose-200 bg-rose-50 text-rose-700";
  }
}

function summaryTone(status: "ok" | "warn" | "critical") {
  if (status === "ok") return "text-emerald-700";
  if (status === "warn") return "text-amber-600";
  return "text-rose-600";
}

function createOwnerEmployees(rows: TeamRoleRow[], profiles: StaffShiftProfileRecord[]) {
  const profileMap = new Map(profiles.map((profile) => [profile.userId, profile]));

  return rows
    .filter((row) => row.role && row.role !== "OWNER" && row.role !== "USER")
    .map<AutoScheduleEmployee>((row, index) => {
      const role = row.role as StaffRole;
      const name = row.display_name?.trim() || row.email?.split("@")[0] || `Staff ${index + 1}`;
      const profile = profileMap.get(row.user_id) ?? createEmptyStaffShiftProfile(row.user_id, role);

      return {
        id: row.user_id,
        name,
        role,
        skills: profile.skills,
        availability: profile.availability,
        leaveDateKeys: profile.leaveDateKeys,
        maxWeeklyHours: profile.maxWeeklyHours,
        fairnessOffsetHours: profile.fairnessOffsetHours,
        performanceScore: profile.performanceScore,
      };
    });
}

function createEmptyForecast(weekStart: string) {
  return generateWeekDates(weekStart).reduce<Record<string, number>>((result, dateKey) => {
    result[dateKey] = 0;
    return result;
  }, {});
}

function getAllSkills(employees: AutoScheduleEmployee[]) {
  return [...new Set(employees.flatMap((employee) => employee.skills))];
}

function buildMatrix(assignments: AutoScheduleAssignment[]) {
  return new Map(assignments.map((assignment) => [`${assignment.employeeId}:${assignment.dateKey}`, assignment]));
}

function buildManualDraft(
  currentDraft: AutoScheduleResult,
  employees: AutoScheduleEmployee[],
  demands: AutoScheduleDemand[],
  employeeId: string,
  dateKey: string,
  shiftType: ShiftType,
) {
  const definitions = new Map(DEFAULT_SHIFT_DEFINITIONS.map((definition) => [definition.type, definition]));
  const definition = definitions.get(shiftType) ?? DEFAULT_SHIFT_DEFINITIONS[3];
  const targetEmployee = employees.find((employee) => employee.id === employeeId);
  if (!targetEmployee) return currentDraft;

  const nextAssignments = currentDraft.assignments.map((assignment) => {
    if (assignment.employeeId !== employeeId || assignment.dateKey !== dateKey) {
      return assignment;
    }

    const matchedDemand = demands.find((demand) => demand.dateKey === dateKey && demand.shiftType === shiftType);
    return {
      ...assignment,
      role: targetEmployee.role,
      shiftType,
      shiftLabel: definition.label,
      shortCode: definition.shortCode,
      startTime: definition.startTime,
      endTime: definition.endTime,
      hours: definition.hours,
      source: "manual" as const,
      score: matchedDemand ? 90 : 0,
      matchedSkills:
        matchedDemand && targetEmployee.skills.length
          ? matchedDemand.requiredSkills.filter((skill) => targetEmployee.skills.includes(skill))
          : [],
    };
  });

  return buildAutoScheduleResult({
    weekStart: currentDraft.weekStart,
    employees,
    demands,
    assignments: nextAssignments,
  });
}

function createOffAssignment(dateKey: string, employeeName = "Bạn"): AutoScheduleAssignment {
  const offDefinition = DEFAULT_SHIFT_DEFINITIONS.find((definition) => definition.type === "OFF") ?? DEFAULT_SHIFT_DEFINITIONS[3];
  return {
    employeeId: "off",
    employeeName,
    role: "RECEPTION",
    dateKey,
    shiftType: "OFF",
    shiftLabel: offDefinition.label,
    shortCode: offDefinition.shortCode,
    startTime: offDefinition.startTime,
    endTime: offDefinition.endTime,
    hours: 0,
    source: "system",
    score: 0,
    matchedSkills: [],
  };
}

function getAssignmentTheme(assignment: AutoScheduleAssignment | null | undefined) {
  const definition =
    DEFAULT_SHIFT_DEFINITIONS.find((item) => item.type === assignment?.shiftType) ?? DEFAULT_SHIFT_DEFINITIONS[3];
  return {
    assignment,
    definition,
    classes: shiftThemeClasses(definition.theme),
  };
}

function SidebarMenu({
  onJump,
}: {
  onJump: (target: "overview" | "planner" | "shifts" | "check" | "leave") => void;
}) {
  const items = [
    { id: "overview", icon: "⊕", label: "Tổng quan", active: true },
    { id: "planner", icon: "▣", label: "Phân lịch ca" },
    { id: "shifts", icon: "◷", label: "Ca làm" },
    { id: "check", icon: "◔", label: "Mở ca / Đóng ca" },
    { id: "leave", icon: "⌁", label: "Nghỉ phép" },
  ];

  return (
    <div className="rounded-[28px] border border-neutral-200 bg-white p-3 shadow-sm">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onJump(item.id as "overview" | "planner" | "shifts" | "check" | "leave")}
          className={`mb-1 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
            item.active
              ? "bg-rose-50 font-semibold text-[var(--color-primary)]"
              : "font-medium text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          <span className="text-base">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
      <Link
        href="/manage/team"
        className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
      >
        <span className="text-base">◌</span>
        <span>Nhân sự</span>
      </Link>
    </div>
  );
}

function MiniCalendar({
  weekStart,
  visibleMonth,
  onJumpToWeek,
  onChangeVisibleMonth,
}: {
  weekStart: string;
  visibleMonth: Date;
  onJumpToWeek: (dateKey: string) => void;
  onChangeVisibleMonth: (nextMonth: Date) => void;
}) {
  const current = visibleMonth;
  const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
  const startGrid = new Date(monthStart);
  const startGridOffset = (monthStart.getDay() + 6) % 7;
  startGrid.setDate(monthStart.getDate() - startGridOffset);
  const activeWeekDates = generateWeekDates(weekStart);

  return (
    <div className="rounded-[28px] border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" onClick={() => onChangeVisibleMonth(addMonths(visibleMonth, -1))} className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100">
          ‹
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-neutral-900">
            {new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(current)}
          </p>
        </div>
        <button type="button" onClick={() => onChangeVisibleMonth(addMonths(visibleMonth, 1))} className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-neutral-400">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }, (_, index) => {
          const day = new Date(startGrid);
          day.setDate(startGrid.getDate() + index);
          const dateKey = toDateKey(day);
          const isCurrentMonth = day.getMonth() === current.getMonth();
          const isActive = activeWeekDates.includes(dateKey);
          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onJumpToWeek(dateKey)}
              className={`h-9 rounded-2xl text-xs font-medium transition ${
                isActive
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : isCurrentMonth
                    ? "text-neutral-700 hover:bg-neutral-100"
                    : "text-neutral-300"
              }`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekNavigator({
  weekStart,
  onChangeWeek,
}: {
  weekStart: string;
  onChangeWeek: (nextWeekStart: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="rounded-full border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-900">
        {formatWeekRange(weekStart)}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const next = new Date(`${weekStart}T00:00:00`);
            next.setDate(next.getDate() - 7);
            onChangeWeek(toDateKey(next));
          }}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 text-lg text-neutral-700"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => {
            const next = new Date(`${weekStart}T00:00:00`);
            next.setDate(next.getDate() + 7);
            onChangeWeek(toDateKey(next));
          }}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 text-lg text-neutral-700"
        >
          ›
        </button>
        <button
          type="button"
          onClick={() => onChangeWeek(toDateKey(getStartOfWeek(new Date())))}
          className="rounded-full border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-900"
        >
          Hôm nay
        </button>
      </div>
    </div>
  );
}

function ShiftLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {DEFAULT_SHIFT_DEFINITIONS.map((definition) => (
        <span
          key={definition.type}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${shiftThemeClasses(definition.theme)}`}
        >
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/80 px-2 text-[11px] font-bold">
            {definition.shortCode}
          </span>
          <span>
            {definition.label}
            {definition.startTime && definition.endTime ? ` (${definition.startTime} - ${definition.endTime})` : ""}
          </span>
        </span>
      ))}
    </div>
  );
}

function QuickShiftEditor({
  employee,
  assignment,
  options,
  overridesProfile,
  onPick,
  onClose,
}: {
  employee: AutoScheduleEmployee;
  assignment: AutoScheduleAssignment;
  options: ShiftDefinition[];
  overridesProfile: boolean;
  onPick: (shiftType: ShiftType) => void | Promise<void>;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-neutral-950/30 backdrop-blur-[2px] lg:hidden" onClick={onClose}>
      <div
        data-shift-editor-modal="true"
        className="absolute inset-x-4 bottom-24 rounded-[28px] border border-neutral-200 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.16)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">Chọn lịch sửa thủ công</p>
            <p className="mt-2 text-sm font-semibold text-neutral-900">{employee.name}</p>
            <p className="mt-1 text-xs text-neutral-500">
              {formatDateLabel(assignment.dateKey)} · {assignment.shiftLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-sm text-neutral-500"
          >
            ×
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {options.map((definition) => {
            const active = assignment.shiftType === definition.type;
            return (
              <button
                key={definition.type}
                type="button"
                onClick={() => void onPick(definition.type)}
                className={`rounded-2xl border px-3 py-3 text-left transition ${
                  active ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/15" : "border-neutral-200"
                } ${shiftThemeClasses(definition.theme)}`}
              >
                <p className="text-sm font-semibold">{definition.label}</p>
                <p className="mt-1 text-xs">
                  {definition.startTime && definition.endTime
                    ? `${definition.startTime} - ${definition.endTime}`
                    : "Không xếp ca"}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl bg-neutral-50 px-3 py-3 text-xs text-neutral-600">
          {overridesProfile
            ? "Đây là ca override so với khung giờ cố định, nên kiểm tra trước khi publish."
            : "Danh sách ca đã được lọc theo availability để bạn sửa nhanh ngay tại chỗ."}
        </div>
      </div>
    </div>
  );
}

function MobilePlannerCards({
  employees,
  weekDates,
  selectedDateKey,
  onSelectDate,
  getAssignment,
  onOpenEditor,
  daySummaryMap,
}: {
  employees: AutoScheduleEmployee[];
  weekDates: string[];
  selectedDateKey: string;
  onSelectDate: (dateKey: string) => void;
  getAssignment: (employeeId: string, dateKey: string) => AutoScheduleAssignment | null;
  onOpenEditor: (employeeId: string, dateKey: string) => void;
  daySummaryMap: Map<string, AutoScheduleDaySummary>;
}) {
  return (
    <div className="space-y-4 md:hidden">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {weekDates.map((dateKey) => {
          const summary = daySummaryMap.get(dateKey);
          const active = selectedDateKey === dateKey;
          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDate(dateKey)}
              className={`min-w-[96px] rounded-2xl border px-3 py-3 text-left transition ${
                active
                  ? "border-[var(--color-primary)] bg-rose-50 text-[var(--color-primary)]"
                  : "border-neutral-200 bg-white text-neutral-700"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">{getWeekdayLabel(dateKey)}</p>
              <p className="mt-1 text-sm font-semibold">{formatDateLabel(dateKey)}</p>
              <p className={`mt-2 text-xs ${summary ? summaryTone(summary.status) : "text-neutral-400"}`}>
                {summary ? `${summary.scheduledCount}/${summary.requiredCount}` : "--"}
              </p>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {employees.map((employee) => {
          const assignment = getAssignment(employee.id, selectedDateKey);
          const { definition, classes } = getAssignmentTheme(assignment);
          return (
            <button
              key={`${employee.id}-${selectedDateKey}`}
              type="button"
              onClick={() => onOpenEditor(employee.id, selectedDateKey)}
              className="block w-full rounded-[24px] border border-neutral-200 bg-white p-4 text-left shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{employee.name}</p>
                  <p className="mt-1 text-xs text-neutral-500">{getRoleLabel(employee.role)}</p>
                </div>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${classes}`}>
                  {assignment?.shortCode ?? definition.shortCode}
                </span>
              </div>
              <div className={`mt-4 rounded-2xl border px-3 py-3 ${classes}`}>
                <p className="text-sm font-semibold">{assignment?.shiftLabel ?? definition.label}</p>
                <p className="mt-1 text-xs">
                  {assignment?.startTime && assignment?.endTime ? `${assignment.startTime} - ${assignment.endTime}` : "Nghỉ"}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ManageShiftsPage() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => toDateKey(getStartOfWeek(new Date())));
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [rawTeamRows, setRawTeamRows] = useState<TeamRoleRow[]>([]);
  const [draft, setDraft] = useState<AutoScheduleResult | null>(null);
  const [status, setStatus] = useState<ShiftPlanStatus>("draft");
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ employeeId: string; dateKey: string } | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>(FILTER_ALL);
  const [skillFilter, setSkillFilter] = useState<string>(FILTER_ALL);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [openEntry, setOpenEntry] = useState<ShiftTimeEntryRecord | null>(null);
  const [recentEntries, setRecentEntries] = useState<ShiftTimeEntryRecord[]>([]);
  const [personalBusy, setPersonalBusy] = useState(false);
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [scheduleSchemaMissing, setScheduleSchemaMissing] = useState(false);
  const [profilesSchemaMissing, setProfilesSchemaMissing] = useState(false);
  const [publishedPlan, setPublishedPlan] = useState<ShiftPlanRecord | null>(null);
  const [staffProfiles, setStaffProfiles] = useState<StaffShiftProfileRecord[]>([]);
  const [forecast, setForecast] = useState<Record<string, number>>(() => createEmptyForecast(weekStart));
  const [selectedDayDetail, setSelectedDayDetail] = useState<string | null>(null);
  const [ownerAttendanceEntries, setOwnerAttendanceEntries] = useState<ShiftTimeEntryRecord[]>([]);
  const [shiftWindow, setShiftWindow] = useState<ShiftWindow | null>(null);
  const [personalLeaveRequests, setPersonalLeaveRequests] = useState<ShiftLeaveRequestRecord[]>([]);
  const [ownerLeaveRequests, setOwnerLeaveRequests] = useState<ShiftLeaveRequestRecord[]>([]);
  const [dayOffNote, setDayOffNote] = useState("");
  const [earlyLeaveNote, setEarlyLeaveNote] = useState("");
  const [earlyLeaveTime, setEarlyLeaveTime] = useState("");
  const [now, setNow] = useState(() => new Date());
  const weekLoadingRef = useRef(0);
  const overviewSectionRef = useRef<HTMLDivElement | null>(null);
  const plannerSectionRef = useRef<HTMLDivElement | null>(null);
  const shiftsSectionRef = useRef<HTMLDivElement | null>(null);
  const attendanceSectionRef = useRef<HTMLDivElement | null>(null);
  const leaveSectionRef = useRef<HTMLDivElement | null>(null);

  const ownerEmployees = useMemo(() => createOwnerEmployees(rawTeamRows, staffProfiles), [rawTeamRows, staffProfiles]);
  const allSkills = useMemo(() => getAllSkills(ownerEmployees), [ownerEmployees]);
  const teamNameMap = useMemo(
    () =>
      new Map(
        rawTeamRows.map((row) => [
          row.user_id,
          row.display_name?.trim() || row.email?.split("@")[0] || row.user_id,
        ]),
      ),
    [rawTeamRows],
  );
  const demands = useMemo(
    () => buildDefaultWeekDemands({ weekStart, employees: ownerEmployees, forecast }),
    [forecast, ownerEmployees, weekStart],
  );
  const employeeProfileIssues = useMemo(
    () =>
      ownerEmployees.map((employee) => ({
        employeeId: employee.id,
        employeeName: employee.name,
        missingAvailability: employee.availability.length === 0,
        missingSkills: employee.role === "TECH" && employee.skills.length === 0,
      })),
    [ownerEmployees],
  );
  const incompleteProfiles = useMemo(
    () => employeeProfileIssues.filter((item) => item.missingAvailability || item.missingSkills),
    [employeeProfileIssues],
  );
  const canRunAutoSchedule = ownerEmployees.length > 0 && incompleteProfiles.length === 0;
  const defaultDraft = useMemo(
    () =>
      canRunAutoSchedule
        ? generateDraftSchedule({
            weekStart,
            employees: ownerEmployees,
            demands,
          })
        : null,
    [canRunAutoSchedule, demands, ownerEmployees, weekStart],
  );

  const draftMatrix = useMemo(() => buildMatrix(draft?.assignments ?? []), [draft]);
  const filteredEmployees = useMemo(
    () =>
      ownerEmployees.filter((employee) => {
        const roleMatched = roleFilter === FILTER_ALL || employee.role === roleFilter;
        const skillMatched = skillFilter === FILTER_ALL || employee.skills.includes(skillFilter as ServiceSkill);
        return roleMatched && skillMatched;
      }),
    [ownerEmployees, roleFilter, skillFilter],
  );

  const employeeSummaries = useMemo(
    () =>
      ownerEmployees.map((employee) => {
        const summary = draft?.employeeSummaries.find((item) => item.employeeId === employee.id);
        return (
          summary ?? {
            employeeId: employee.id,
            employeeName: employee.name,
            role: employee.role,
            assignedHours: 0,
            maxWeeklyHours: employee.maxWeeklyHours,
            overtimeHours: 0,
            totalShifts: 0,
            skillsCovered: [],
          }
        );
      }),
    [draft?.employeeSummaries, ownerEmployees],
  );

  const selectedAssignment = useMemo(() => {
    if (!selectedCell) return null;
    return draftMatrix.get(`${selectedCell.employeeId}:${selectedCell.dateKey}`) ?? null;
  }, [draftMatrix, selectedCell]);

  const selectedEmployee = useMemo(() => {
    if (!selectedCell) return null;
    return ownerEmployees.find((employee) => employee.id === selectedCell.employeeId) ?? null;
  }, [ownerEmployees, selectedCell]);
  const selectedProfile = useMemo(() => {
    if (!selectedEmployee) return null;
    return staffProfiles.find((profile) => profile.userId === selectedEmployee.id)
      ?? createEmptyStaffShiftProfile(selectedEmployee.id, selectedEmployee.role);
  }, [selectedEmployee, staffProfiles]);
  const recommendedShiftTypes = useMemo(() => {
    if (!selectedEmployee || !selectedAssignment) return DEFAULT_SHIFT_DEFINITIONS.map((definition) => definition.type);
    return getRecommendedShiftTypesForDate(selectedEmployee, selectedAssignment.dateKey);
  }, [selectedAssignment, selectedEmployee]);
  const manualShiftOptions = useMemo(() => {
    if (!selectedAssignment) return DEFAULT_SHIFT_DEFINITIONS;
    const visibleShiftTypes = new Set<ShiftType>(recommendedShiftTypes);
    visibleShiftTypes.add(selectedAssignment.shiftType);
    return DEFAULT_SHIFT_DEFINITIONS.filter((definition) => visibleShiftTypes.has(definition.type));
  }, [recommendedShiftTypes, selectedAssignment]);
  const selectedAssignmentOverridesProfile = useMemo(() => {
    if (!selectedAssignment) return false;
    return !recommendedShiftTypes.includes(selectedAssignment.shiftType);
  }, [recommendedShiftTypes, selectedAssignment]);

  const personalAssignments = useMemo(() => {
    if (!publishedPlan?.result.weekDates?.length || !currentUserId) return [];
    return applyApprovedDayOffToAssignments(
      publishedPlan.result.weekDates.map((dateKey) => {
        const assignment =
          publishedPlan.result.assignments.find(
            (item) => item.employeeId === currentUserId && item.dateKey === dateKey,
          ) ?? createOffAssignment(dateKey);
        return assignment;
      }),
      personalLeaveRequests,
    );
  }, [currentUserId, personalLeaveRequests, publishedPlan]);

  const todayDateKey = useMemo(() => toDateKey(now), [now]);
  const todayAssignment = useMemo(() => {
    if (!currentUserId) return null;
    return getTodayAssignmentFromPlan(publishedPlan, currentUserId, todayDateKey);
  }, [currentUserId, publishedPlan, todayDateKey]);

  const shiftWindowState = useMemo(() => describeShiftWindow(shiftWindow, now), [now, shiftWindow]);

  const pendingAttendanceApprovals = useMemo(
    () => ownerAttendanceEntries.filter((entry) => entry.approval_status === "PENDING"),
    [ownerAttendanceEntries],
  );

  const pendingLeaveApprovals = useMemo(
    () => ownerLeaveRequests.filter((request) => request.status === "PENDING"),
    [ownerLeaveRequests],
  );

  const approvedDayOffToday = useMemo(
    () =>
      personalLeaveRequests.some(
        (request) =>
          request.request_type === "DAY_OFF" &&
          request.status === "APPROVED" &&
          request.scheduled_date === todayDateKey,
      ),
    [personalLeaveRequests, todayDateKey],
  );

  const todayPendingDayOff = useMemo(
    () =>
      personalLeaveRequests.find(
        (request) =>
          request.request_type === "DAY_OFF" &&
          request.status === "PENDING" &&
          request.scheduled_date === todayDateKey,
      ) ?? null,
    [personalLeaveRequests, todayDateKey],
  );

  const pendingEarlyLeaveRequest = useMemo(
    () =>
      openEntry
        ? personalLeaveRequests.find(
            (request) =>
              request.request_type === "EARLY_LEAVE" &&
              request.status === "PENDING" &&
              request.time_entry_id === openEntry.id,
          ) ?? null
        : null,
    [openEntry, personalLeaveRequests],
  );

  const totalDemand = useMemo(
    () => draft?.daySummaries.reduce((sum, item) => sum + item.requiredCount, 0) ?? 0,
    [draft],
  );

  const totalAssigned = useMemo(
    () => draft?.daySummaries.reduce((sum, item) => sum + item.scheduledCount, 0) ?? 0,
    [draft],
  );
  const daySummaryMap = useMemo(
    () => new Map((draft?.daySummaries ?? []).map((summary) => [summary.dateKey, summary])),
    [draft?.daySummaries],
  );
  const activePlannerDate = useMemo(
    () => selectedDayDetail ?? draft?.weekDates[0] ?? weekStart,
    [draft?.weekDates, selectedDayDetail, weekStart],
  );
  const activeDaySummary = useMemo(
    () => draft?.daySummaries.find((summary) => summary.dateKey === selectedDayDetail) ?? null,
    [draft?.daySummaries, selectedDayDetail],
  );
  const attendanceSummary = useMemo(() => {
    const openCount = ownerAttendanceEntries.filter((entry) => entry.clock_out === null).length;
    return {
      openCount,
      totalCount: ownerAttendanceEntries.length,
    };
  }, [ownerAttendanceEntries]);

  const persistOwnerPlan = useCallback(
    async (nextDraft: AutoScheduleResult, nextStatus: ShiftPlanStatus) => {
      try {
        setOwnerSaving(true);
        const saved = await saveShiftPlanWeek({
          weekStart,
          status: nextStatus,
          result: nextDraft,
          demands,
          forecast,
        });
        setScheduleSchemaMissing(false);
        setStatus(saved.status);
        setLastPublishedAt(saved.publishedAt);
      } catch (nextError) {
        if (isMissingShiftPlansSchema(nextError)) {
          setScheduleSchemaMissing(true);
          return;
        }
        setError(nextError instanceof Error ? nextError.message : "Không thể lưu lịch ca.");
      } finally {
        setOwnerSaving(false);
      }
    },
    [demands, forecast, weekStart],
  );

  const updateLocalProfile = useCallback((userId: string, updater: (current: StaffShiftProfileRecord) => StaffShiftProfileRecord) => {
    setStaffProfiles((current) => {
      const existing = current.find((profile) => profile.userId === userId)
        ?? createEmptyStaffShiftProfile(
          userId,
          (rawTeamRows.find((row) => row.user_id === userId)?.role as StaffRole | undefined) ?? "TECH",
        );
      const nextProfile = updater(existing);
      const remaining = current.filter((profile) => profile.userId !== userId);
      return [...remaining, nextProfile];
    });
  }, [rawTeamRows]);

  const toggleSelectedLeaveDate = useCallback((dateKey: string) => {
    if (!selectedProfile) return;
    updateLocalProfile(selectedProfile.userId, (current) => ({
      ...current,
      leaveDateKeys: current.leaveDateKeys.includes(dateKey)
        ? current.leaveDateKeys.filter((item) => item !== dateKey)
        : [...current.leaveDateKeys, dateKey].sort(),
    }));
  }, [selectedProfile, updateLocalProfile]);

  const saveSelectedProfile = useCallback(async () => {
    if (!selectedProfile) return;
    try {
      setProfileSaving(true);
      const saved = await saveStaffShiftProfile(selectedProfile);
      setProfilesSchemaMissing(false);
      setStaffProfiles((current) => [...current.filter((profile) => profile.userId !== saved.userId), saved]);
    } catch (nextError) {
      if (isMissingStaffShiftProfilesSchema(nextError)) {
        setProfilesSchemaMissing(true);
        return;
      }
      setError(nextError instanceof Error ? nextError.message : "Không thể lưu hồ sơ phân ca.");
    } finally {
      setProfileSaving(false);
    }
  }, [selectedProfile]);

  const updateWeek = useCallback((nextWeekStart: string) => {
    setWeekStart(nextWeekStart);
    setVisibleMonth(new Date(`${nextWeekStart}T00:00:00`));
    setSelectedCell(null);
    setSelectedDayDetail(null);
    setError(null);
  }, []);

  const runAutoSchedule = useCallback(async () => {
    if (!canRunAutoSchedule) return;
    const nextDraft = generateDraftSchedule({
      weekStart,
      employees: ownerEmployees,
      demands,
    });
    setDraft(nextDraft);
    setStatus("draft");
    setLastPublishedAt(null);
    await persistOwnerPlan(nextDraft, "draft");
  }, [canRunAutoSchedule, demands, ownerEmployees, persistOwnerPlan, weekStart]);

  const handleManualShiftChange = useCallback(
    async (nextShiftType: ShiftType) => {
      if (!draft || !selectedCell) return;
      const nextDraft = buildManualDraft(
        draft,
        ownerEmployees,
        demands,
        selectedCell.employeeId,
        selectedCell.dateKey,
        nextShiftType,
      );
      setDraft(nextDraft);
      setStatus("draft");
      setLastPublishedAt(null);
      await persistOwnerPlan(nextDraft, "draft");
    },
    [demands, draft, ownerEmployees, persistOwnerPlan, selectedCell],
  );

  const handlePublish = useCallback(async () => {
    if (!draft) return;
    await persistOwnerPlan(draft, "published");
    setStatus("published");
  }, [draft, persistOwnerPlan]);

  const handleDayDetail = useCallback((dateKey: string) => {
    setSelectedDayDetail(dateKey);
    const firstEmployee = filteredEmployees[0];
    if (firstEmployee) {
      setSelectedCell({ employeeId: firstEmployee.id, dateKey });
    }
  }, [filteredEmployees]);

  const handleSuggestionFocus = useCallback((employeeId: string, dateKey: string) => {
    setSelectedDayDetail(dateKey);
    setSelectedCell({ employeeId, dateKey });
  }, []);
  const handleOpenPlannerEditor = useCallback((employeeId: string, dateKey: string) => {
    setSelectedDayDetail(dateKey);
    setSelectedCell({ employeeId, dateKey });
  }, []);

  const handleSidebarJump = useCallback((target: "overview" | "planner" | "shifts" | "check" | "leave") => {
    const sectionMap = {
      overview: overviewSectionRef,
      planner: plannerSectionRef,
      shifts: shiftsSectionRef,
      check: attendanceSectionRef,
      leave: leaveSectionRef,
    } as const;

    sectionMap[target].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const refreshPersonalShiftState = useCallback(async (userId: string) => {
    await syncExpiredShiftEntries();
    const [entries, requests, nextWindow] = await Promise.all([
      listPersonalShiftEntries(userId),
      listShiftLeaveRequests({ userId }),
      loadPublishedShiftWindowForUser(userId, new Date()),
    ]);

    setRecentEntries(entries);
    setOpenEntry(entries.find((entry) => entry.clock_out === null && entry.approval_status !== "REJECTED") ?? null);
    setPersonalLeaveRequests(requests);
    setShiftWindow(nextWindow);
  }, []);

  const refreshOwnerApprovals = useCallback(async () => {
    await syncExpiredShiftEntries();
    const [entries, requests] = await Promise.all([listOwnerShiftEntries(), listShiftLeaveRequests()]);
    setOwnerAttendanceEntries(entries);
    setOwnerLeaveRequests(requests);
  }, []);

  const handlePersonalClockIn = useCallback(async () => {
    try {
      setPersonalBusy(true);
      const nextEntry = await createShiftCheckIn();
      setOpenEntry(nextEntry);
      if (currentUserId) {
        await refreshPersonalShiftState(currentUserId);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Mở ca thất bại.");
    } finally {
      setPersonalBusy(false);
    }
  }, [currentUserId, refreshPersonalShiftState]);

  const handlePersonalClockOut = useCallback(async () => {
    if (!openEntry) return;
    try {
      setPersonalBusy(true);
      const nextEntry = await closeShiftEntryIfAllowed(openEntry);
      setOpenEntry(nextEntry.clock_out === null ? nextEntry : null);
      if (currentUserId) {
        await refreshPersonalShiftState(currentUserId);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Đóng ca thất bại.");
    } finally {
      setPersonalBusy(false);
    }
  }, [currentUserId, openEntry, refreshPersonalShiftState]);

  const handleSubmitDayOff = useCallback(async (dateKey: string) => {
    try {
      setPersonalBusy(true);
      await submitDayOffRequest(dateKey, dayOffNote.trim() || undefined);
      setDayOffNote("");
      if (currentUserId) {
        await refreshPersonalShiftState(currentUserId);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không thể gửi xin nghỉ.");
    } finally {
      setPersonalBusy(false);
    }
  }, [currentUserId, dayOffNote, refreshPersonalShiftState]);

  const handleSubmitEarlyLeave = useCallback(async () => {
    if (!openEntry || !earlyLeaveTime || !openEntry.scheduled_date) return;
    try {
      setPersonalBusy(true);
      await submitEarlyLeaveRequest(
        openEntry,
        new Date(`${openEntry.scheduled_date}T${earlyLeaveTime}:00`).toISOString(),
        earlyLeaveNote.trim() || undefined,
      );
      setEarlyLeaveNote("");
      setEarlyLeaveTime("");
      if (currentUserId) {
        await refreshPersonalShiftState(currentUserId);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không thể gửi xin về sớm.");
    } finally {
      setPersonalBusy(false);
    }
  }, [currentUserId, earlyLeaveNote, earlyLeaveTime, openEntry, refreshPersonalShiftState]);

  const handleReviewAttendance = useCallback(async (entryId: string, approve: boolean) => {
    try {
      setOwnerSaving(true);
      await reviewShiftCheckIn(entryId, approve);
      await refreshOwnerApprovals();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không thể cập nhật yêu cầu mở ca.");
    } finally {
      setOwnerSaving(false);
    }
  }, [refreshOwnerApprovals]);

  const handleReviewLeaveRequest = useCallback(async (requestId: string, approve: boolean) => {
    try {
      setOwnerSaving(true);
      await reviewShiftLeaveRequest(requestId, approve);
      await refreshOwnerApprovals();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không thể cập nhật yêu cầu nghỉ.");
    } finally {
      setOwnerSaving(false);
    }
  }, [refreshOwnerApprovals]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!selectedCell) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedCell(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [selectedCell]);

  useEffect(() => {
    if (!selectedCell) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-shift-editor-modal="true"]')) return;
      if (shiftsSectionRef.current?.contains(target)) return;
      if (leaveSectionRef.current?.contains(target)) return;
      setSelectedCell(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [selectedCell]);

  useEffect(() => {
    let mounted = true;

    async function loadInitial() {
      try {
        setLoading(true);
        setError(null);
        const currentRole = await getCurrentSessionRole();
        if (!mounted) return;
        setRole(currentRole);

        if (supabase) {
          const { data } = await supabase.auth.getSession();
          const userId = data.session?.user?.id ?? null;
          if (mounted) setCurrentUserId(userId);

          if (userId && currentRole !== "OWNER") {
            await refreshPersonalShiftState(userId);
            if (!mounted) return;
          }
        }

        if (currentRole === "OWNER") {
          const rows = (await listUserRoles()) as TeamRoleRow[];
          if (mounted) {
            setRawTeamRows(rows);
          }

          try {
            const fallbackRoles = new Map(
              rows
                .filter((row) => row.role && row.role !== "OWNER" && row.role !== "USER")
                .map((row) => [row.user_id, row.role as StaffRole]),
            );
            const profiles = normalizeStaffShiftProfiles(await loadStaffShiftProfiles(), fallbackRoles);
            if (mounted) {
              setStaffProfiles(profiles);
              setProfilesSchemaMissing(false);
              await refreshOwnerApprovals();
            }
          } catch (nextError) {
            if (mounted && isMissingStaffShiftProfilesSchema(nextError)) {
              setProfilesSchemaMissing(true);
            } else if (mounted) {
              setError(nextError instanceof Error ? nextError.message : "Không thể tải hồ sơ phân ca.");
            }
          }
        }
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : "Không thể tải Shifts.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadInitial();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (role !== "OWNER") return;
    let mounted = true;

    async function loadForecast() {
      try {
        const nextForecast = await loadWeeklyShiftForecast(weekStart);
        if (!mounted) return;
        setForecast(nextForecast);
      } catch {
        if (!mounted) return;
        setForecast(createEmptyForecast(weekStart));
      }
    }

    void loadForecast();
    return () => {
      mounted = false;
    };
  }, [role, weekStart]);

  useEffect(() => {
    if (role !== "OWNER" || !ownerEmployees.length) return;
    let mounted = true;
    const requestId = ++weekLoadingRef.current;

    async function loadOwnerWeek() {
      try {
        const savedPlan = await loadShiftPlanWeek(weekStart);
        if (!mounted || requestId !== weekLoadingRef.current) return;

        if (savedPlan) {
          setDraft(savedPlan.result);
          setStatus(savedPlan.status);
          setLastPublishedAt(savedPlan.publishedAt);
          setScheduleSchemaMissing(false);
          return;
        }

        setDraft(defaultDraft);
        setStatus("draft");
        setLastPublishedAt(null);
      } catch (nextError) {
        if (!mounted || requestId !== weekLoadingRef.current) return;
        if (isMissingShiftPlansSchema(nextError)) {
          setScheduleSchemaMissing(true);
          setDraft(defaultDraft);
          setStatus("draft");
          setLastPublishedAt(null);
          return;
        }
        setError(nextError instanceof Error ? nextError.message : "Không thể tải lịch tuần.");
        setDraft(defaultDraft);
      }
    }

    void loadOwnerWeek();
    return () => {
      mounted = false;
    };
  }, [defaultDraft, ownerEmployees.length, role, weekStart]);

  useEffect(() => {
    if (!role || role === "OWNER") return;
    let mounted = true;

    async function loadPublishedWeek() {
      try {
        const savedPlan = await loadShiftPlanWeek(weekStart, { publishedOnly: true });
        if (!mounted) return;
        setPublishedPlan(savedPlan);
        setScheduleSchemaMissing(false);
        if (currentUserId) {
          await refreshPersonalShiftState(currentUserId);
        }
      } catch (nextError) {
        if (!mounted) return;
        if (isMissingShiftPlansSchema(nextError)) {
          setScheduleSchemaMissing(true);
          setPublishedPlan(null);
          return;
        }
        setError(nextError instanceof Error ? nextError.message : "Không thể tải lịch đã publish.");
      }
    }

    void loadPublishedWeek();
    return () => {
      mounted = false;
    };
  }, [currentUserId, refreshPersonalShiftState, role, weekStart]);

  useEffect(() => {
    if (role !== "OWNER") return;
    let mounted = true;

    async function loadOwnerQueues() {
      try {
        await refreshOwnerApprovals();
      } catch (nextError) {
        if (!mounted) return;
        setError(nextError instanceof Error ? nextError.message : "Không thể tải bảng công hôm nay.");
      }
    }

    void loadOwnerQueues();
    const intervalId = window.setInterval(() => {
      void loadOwnerQueues();
    }, 60_000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [refreshOwnerApprovals, role]);

  if (loading) {
    return (
      <AppShell>
        <div className="rounded-[32px] border border-neutral-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-neutral-500">Đang tải shifts...</p>
        </div>
      </AppShell>
    );
  }

  if (role !== "OWNER") {
    const scheduledHours = personalAssignments.reduce((sum, item) => sum + item.hours, 0);

    return (
      <AppShell>
        <div className="manage-shifts-page space-y-6">
          <ManageQuickNav items={operationsQuickNav("/manage/shifts")} />
          <MobileSectionHeader
            title="Ca làm của tôi"
            description="Nhân sự xem đúng lịch OWNER đã publish, sau đó mở ca / đóng ca theo khung đã được phân."
          />

          {error ? <ManageAlert tone="error">{error}</ManageAlert> : null}
          {scheduleSchemaMissing ? (
            <ManageAlert tone="warn">
              Bảng `shift_plans` chưa có trên Supabase. Cần chạy file `supabase/shift_plans_2026_04.sql` để nhân sự xem được lịch đã publish.
            </ManageAlert>
          ) : null}

          <section className="rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-neutral-400">Lịch đã publish</p>
                <h2 className="mt-2 text-3xl font-semibold text-neutral-950">Ca làm</h2>
              </div>
              <WeekNavigator weekStart={weekStart} onChangeWeek={updateWeek} />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <ShiftLegend />
              <div className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-700">
                {publishedPlan ? `${scheduledHours}h / tuần đã phân` : "Chưa có lịch được publish"}
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-7">
              {(publishedPlan?.result.weekDates ?? generateWeekDates(weekStart)).map((dateKey) => {
                const assignment =
                  personalAssignments.find((item) => item.dateKey === dateKey) ?? createOffAssignment(dateKey);
                const definition =
                  DEFAULT_SHIFT_DEFINITIONS.find((item) => item.type === assignment.shiftType) ?? DEFAULT_SHIFT_DEFINITIONS[3];
                const isToday = dateKey === todayDateKey;
                return (
                  <div
                    key={dateKey}
                    className={`rounded-[28px] border p-4 shadow-sm ${shiftThemeClasses(definition.theme)} ${isToday ? "ring-2 ring-[var(--color-primary)]/25" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">{getWeekdayLabel(dateKey)}</p>
                        <p className="mt-1 text-sm font-semibold">{formatDateLabel(dateKey)}</p>
                      </div>
                      <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-white/80 px-2 text-[11px] font-bold">
                        {assignment.shortCode}
                      </span>
                    </div>
                    <div className="mt-8">
                      <p className="text-base font-semibold">{assignment.shiftLabel}</p>
                      <p className="mt-1 text-sm">
                        {assignment.startTime && assignment.endTime
                          ? `${assignment.startTime} - ${assignment.endTime}`
                          : "Nghỉ"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-3">
            <section className="rounded-[32px] border border-neutral-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-neutral-900">Trạng thái hôm nay</h3>
              <div className="mt-4 space-y-3">
                {todayAssignment ? (
                  <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Ca đã publish</p>
                    <p className="mt-2 text-lg font-semibold text-neutral-900">{todayAssignment.shiftLabel}</p>
                    <p className="mt-1 text-sm text-neutral-600">{todayAssignment.startTime} - {todayAssignment.endTime}</p>
                    <p className="mt-2 text-sm text-neutral-500">
                      {shiftWindowState.canCheckIn
                        ? shiftWindowState.withinGrace
                          ? "Đang trong khung mở ca. Trễ tối đa 10 phút vẫn được tính đủ ca sau khi OWNER xác nhận."
                          : "Bạn vẫn có thể mở ca trong khung này, nhưng giờ tính công sẽ bắt đầu từ thời điểm thực tế."
                        : shiftWindowState.reason ?? "Chỉ được mở ca trong đúng khung ca đã được xếp."}
                    </p>
                  </div>
                ) : (
                  <ManageAlert tone="info">Hôm nay bạn không có ca được publish.</ManageAlert>
                )}
                {approvedDayOffToday ? <ManageAlert tone="warn">Ca hôm nay đã được OWNER duyệt nghỉ.</ManageAlert> : null}
                {todayPendingDayOff ? <ManageAlert tone="info">Yêu cầu nghỉ ca hôm nay đang chờ OWNER xác nhận.</ManageAlert> : null}
                {openEntry ? (
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                    <p className="text-xs uppercase tracking-[0.2em]">
                      {openEntry.approval_status === "PENDING" ? "Chờ OWNER xác nhận mở ca" : "Đang trong ca"}
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      Mở ca lúc {formatTime(openEntry.clock_in)}
                      {openEntry.effective_clock_in ? ` • tính công từ ${formatTime(openEntry.effective_clock_in)}` : ""}
                    </p>
                    <p className="mt-1 text-sm">Đã làm {formatEntryDuration(openEntry.effective_clock_in ?? openEntry.clock_in, openEntry.clock_out)}</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={openEntry ? handlePersonalClockOut : handlePersonalClockIn}
                    disabled={personalBusy || approvedDayOffToday || (!openEntry && !shiftWindowState.canCheckIn)}
                    className="inline-flex rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {openEntry ? "Đóng ca" : "Mở ca"}
                  </button>
                  {todayAssignment && !openEntry && !approvedDayOffToday && !todayPendingDayOff ? (
                    <button
                      type="button"
                      onClick={() => void handleSubmitDayOff(todayDateKey)}
                      disabled={personalBusy}
                      className="inline-flex rounded-full border border-neutral-200 px-5 py-3 text-sm font-semibold text-neutral-900"
                    >
                      Xin nghỉ ca hôm nay
                    </button>
                  ) : null}
                </div>
                {todayAssignment && !openEntry && !approvedDayOffToday && !todayPendingDayOff ? (
                  <textarea
                    value={dayOffNote}
                    onChange={(event) => setDayOffNote(event.target.value)}
                    placeholder="Lý do xin nghỉ (tùy chọn)"
                    className="min-h-[96px] w-full rounded-3xl border border-neutral-200 px-4 py-3 text-sm outline-none"
                  />
                ) : null}
              </div>
            </section>

            <section className="rounded-[32px] border border-neutral-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-neutral-900">Xin về sớm / lịch sử</h3>
              <div className="mt-4 space-y-3">
                {openEntry && openEntry.scheduled_end && !pendingEarlyLeaveRequest ? (
                  <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
                    <p className="text-sm font-semibold text-neutral-900">Muốn về trước khi hết ca?</p>
                    <p className="mt-1 text-sm text-neutral-500">Bạn phải gửi yêu cầu để OWNER xác nhận trước khi đóng ca.</p>
                    <div className="mt-3 flex flex-col gap-3">
                      <input
                        type="time"
                        value={earlyLeaveTime}
                        onChange={(event) => setEarlyLeaveTime(event.target.value)}
                        className="rounded-2xl border border-neutral-200 px-3 py-2 text-sm outline-none"
                      />
                      <textarea
                        value={earlyLeaveNote}
                        onChange={(event) => setEarlyLeaveNote(event.target.value)}
                        placeholder="Lý do xin về sớm"
                        className="min-h-[88px] rounded-3xl border border-neutral-200 px-4 py-3 text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSubmitEarlyLeave()}
                        disabled={personalBusy || !earlyLeaveTime}
                        className="inline-flex rounded-full border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Gửi xin về sớm
                      </button>
                    </div>
                  </div>
                ) : pendingEarlyLeaveRequest ? (
                  <ManageAlert tone="info">Yêu cầu về sớm đang chờ OWNER xác nhận.</ManageAlert>
                ) : null}
                {recentEntries.length ? (
                  recentEntries.map((entry) => (
                    <div key={entry.id} className="rounded-3xl border border-neutral-200 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-neutral-900">
                          {new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date(entry.clock_in))}
                        </p>
                        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">{entry.approval_status}</span>
                      </div>
                      <p className="mt-1 text-sm text-neutral-500">
                        {formatTime(entry.effective_clock_in ?? entry.clock_in)} - {entry.effective_clock_out ? formatTime(entry.effective_clock_out) : "Đang mở"}
                      </p>
                    </div>
                  ))
                ) : (
                  <ManageAlert tone="info">Chưa có lịch sử chấm công.</ManageAlert>
                )}
              </div>
            </section>

            <section className="rounded-[32px] border border-neutral-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-neutral-900">Yêu cầu của tôi</h3>
              <div className="mt-4 space-y-3">
                {personalLeaveRequests.length ? (
                  personalLeaveRequests.map((request) => (
                    <div key={request.id} className="rounded-3xl border border-neutral-200 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-neutral-900">
                          {request.request_type === "DAY_OFF" ? "Xin nghỉ ca" : "Xin về sớm"}
                        </p>
                        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">{request.status}</span>
                      </div>
                      <p className="mt-1 text-sm text-neutral-500">
                        {request.scheduled_date ?? "Không rõ ngày"}
                        {request.requested_end_at ? ` • ${formatTime(request.requested_end_at)}` : ""}
                      </p>
                      {request.note ? <p className="mt-2 text-sm text-neutral-600">{request.note}</p> : null}
                    </div>
                  ))
                ) : (
                  <ManageAlert tone="info">Chưa có yêu cầu nào gửi cho OWNER.</ManageAlert>
                )}
              </div>
            </section>
          </div>
        </div>

        <MobileStickyActions>
          <button
            type="button"
            onClick={openEntry ? handlePersonalClockOut : handlePersonalClockIn}
            disabled={personalBusy || approvedDayOffToday || (!openEntry && !shiftWindowState.canCheckIn)}
            className="flex-1 rounded-full bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white"
          >
            {openEntry ? "Đóng ca" : "Mở ca"}
          </button>
        </MobileStickyActions>
        <style jsx global>{`
          .manage-shifts-page button:not(:disabled) {
            cursor: pointer;
          }
        `}</style>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="manage-shifts-page space-y-6">
        <ManageQuickNav items={operationsQuickNav("/manage/shifts")} />

        {error ? <ManageAlert tone="error">{error}</ManageAlert> : null}
        {scheduleSchemaMissing ? (
          <ManageAlert tone="warn">
            Chưa có bảng `shift_plans` trong Supabase. Hãy chạy file `supabase/shift_plans_2026_04.sql` để lưu draft/publish thật cho OWNER và chia lịch ra cho nhân sự.
          </ManageAlert>
        ) : null}
        {profilesSchemaMissing ? (
          <ManageAlert tone="warn">
            Bảng `staff_shift_profiles` chưa có trên Supabase. Cần chạy file `supabase/staff_shift_profiles_2026_04.sql` để lưu skill, availability, nghỉ phép và max hours thật cho nhân sự.
          </ManageAlert>
        ) : null}
        {!profilesSchemaMissing && incompleteProfiles.length ? (
          <ManageAlert tone="warn">
            Còn {incompleteProfiles.length} nhân sự thiếu hồ sơ phân ca thật. Hoàn thiện `khung giờ làm` và `kỹ năng` trước khi chạy `Tự động xếp ca`.
          </ManageAlert>
        ) : null}
        {status === "published" && lastPublishedAt ? (
          <ManageAlert tone="info">
            Lịch đã xuất bản lúc {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(lastPublishedAt))}. Nhân sự sẽ nhìn thấy đúng lịch này ở màn Shifts.
          </ManageAlert>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <SidebarMenu onJump={handleSidebarJump} />
            <MiniCalendar
              weekStart={weekStart}
              visibleMonth={visibleMonth}
              onJumpToWeek={(dateKey) =>
                updateWeek(toDateKey(getStartOfWeek(new Date(`${dateKey}T00:00:00`))))
              }
              onChangeVisibleMonth={setVisibleMonth}
            />
            <div className="rounded-[28px] border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">Rule áp dụng</p>
              <div className="mt-4 space-y-3 text-sm text-neutral-600">
                <div className="rounded-2xl border border-neutral-200 px-4 py-3">
                  Không xếp người đã xin nghỉ, ngoài availability hoặc vượt max hours.
                </div>
                <div className="rounded-2xl border border-neutral-200 px-4 py-3">
                  Ưu tiên đúng skill, đủ người khung giờ cao điểm và công bằng tổng giờ trong tuần.
                </div>
              </div>
            </div>
          </aside>

          <main className="flex flex-col gap-5">
            <div ref={plannerSectionRef} className="order-1">
            <section className="rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-neutral-400">Shifts / Owner</p>
                  <h1 className="mt-2 text-4xl font-semibold tracking-[-0.03em] text-neutral-950">Phân lịch ca</h1>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void runAutoSchedule()}
                    disabled={ownerSaving || !canRunAutoSchedule || profilesSchemaMissing}
                    className="rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 shadow-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {ownerSaving && status === "draft" ? "Đang lưu..." : "Tự động xếp ca"}
                  </button>
                  <div className="rounded-full border border-neutral-200 bg-white px-3 py-3 text-sm font-semibold text-neutral-700">
                    {status === "published" ? "Đã xuất bản" : "Nháp"}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handlePublish()}
                    disabled={ownerSaving || !draft}
                    className="rounded-full bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {ownerSaving && status === "published" ? "Đang xuất bản..." : "Xuất bản"}
                  </button>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-4 border-t border-neutral-200 pt-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <WeekNavigator weekStart={weekStart} onChangeWeek={updateWeek} />
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((current) => !current)}
                    className="inline-flex items-center gap-2 self-start rounded-full border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700"
                  >
                    ⌕ {filtersOpen ? "Ẩn lọc" : "Bộ lọc"}
                  </button>
                </div>

                <div className={`${filtersOpen ? "grid" : "hidden"} gap-3 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start`}>
                  <ShiftLegend />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-700">
                      <span className="whitespace-nowrap">Vai trò</span>
                      <select
                        value={roleFilter}
                        onChange={(event) => setRoleFilter(event.target.value)}
                        className="min-w-0 bg-transparent text-sm outline-none"
                      >
                        <option value={FILTER_ALL}>Tất cả</option>
                        {[...new Set(ownerEmployees.map((employee) => employee.role))].map((entry) => (
                          <option key={entry} value={entry}>
                            {getRoleLabel(entry)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-700">
                      <span className="whitespace-nowrap">Kỹ năng</span>
                      <select
                        value={skillFilter}
                        onChange={(event) => setSkillFilter(event.target.value)}
                        className="min-w-0 bg-transparent text-sm outline-none"
                      >
                        <option value={FILTER_ALL}>Tất cả</option>
                        {allSkills.map((skill) => (
                          <option key={skill} value={skill}>
                            {skill}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[28px] border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
                {selectedEmployee && selectedAssignment
                  ? `Đang sửa nhanh: ${selectedEmployee.name} · ${formatDateLabel(selectedAssignment.dateKey)}. Panel "Chọn lịch sửa thủ công" đang mở ngay cạnh bảng lịch.`
                  : 'Chạm vào một ô trong bảng để mở panel "Chọn lịch sửa thủ công" ngay cạnh khu phân lịch.'}
              </div>

              <div ref={shiftsSectionRef} className="mt-5">
                <MobilePlannerCards
                  employees={filteredEmployees}
                  weekDates={draft?.weekDates ?? generateWeekDates(weekStart)}
                  selectedDateKey={activePlannerDate}
                  onSelectDate={setSelectedDayDetail}
                  getAssignment={(employeeId, dateKey) => draftMatrix.get(`${employeeId}:${dateKey}`) ?? null}
                  onOpenEditor={handleOpenPlannerEditor}
                  daySummaryMap={daySummaryMap}
                />
                <div className="hidden overflow-x-auto md:block 2xl:overflow-visible">
                  <div className="min-w-[840px] 2xl:min-w-0">
                  <div className="grid grid-cols-[148px_repeat(7,minmax(92px,1fr))] rounded-t-[28px] border border-neutral-200 bg-white">
                    <div className="sticky left-0 z-10 border-r border-neutral-200 bg-white px-3 py-3 text-sm font-semibold text-neutral-700">
                      Nhân viên
                    </div>
                    {(draft?.weekDates ?? generateWeekDates(weekStart)).map((dateKey) => {
                      const date = new Date(`${dateKey}T00:00:00`);
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      return (
                        <div
                          key={dateKey}
                          className={`border-r border-neutral-200 px-2 py-3 text-center last:border-r-0 ${
                            isWeekend ? "text-[var(--color-primary)]" : "text-neutral-800"
                          }`}
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.14em]">{getWeekdayLabel(dateKey)}</p>
                          <p className="mt-1 text-lg font-semibold xl:text-xl">
                            {String(date.getDate()).padStart(2, "0")}/{String(date.getMonth() + 1).padStart(2, "0")}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {filteredEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      className="grid grid-cols-[148px_repeat(7,minmax(92px,1fr))] border-x border-b border-neutral-200 bg-white"
                    >
                      <div className="sticky left-0 z-10 border-r border-neutral-200 bg-white px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-neutral-100 to-neutral-200" />
                          <div>
                            <p className="text-sm font-semibold text-neutral-900">{employee.name}</p>
                            <p className="mt-1 text-xs text-neutral-500">{getRoleLabel(employee.role)}</p>
                          </div>
                        </div>
                      </div>

                      {(draft?.weekDates ?? generateWeekDates(weekStart)).map((dateKey) => {
                        const assignment = draftMatrix.get(`${employee.id}:${dateKey}`);
                        const definition =
                          DEFAULT_SHIFT_DEFINITIONS.find((item) => item.type === assignment?.shiftType) ??
                          DEFAULT_SHIFT_DEFINITIONS[3];
                        const selected = selectedCell?.employeeId === employee.id && selectedCell?.dateKey === dateKey;
                        return (
                          <div key={`${employee.id}-${dateKey}`} className="border-r border-neutral-200 p-1.5 xl:p-2 last:border-r-0">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCell({ employeeId: employee.id, dateKey });
                                setSelectedDayDetail(dateKey);
                              }}
                              className={`flex min-h-[72px] w-full flex-col items-start justify-between rounded-[18px] border px-2.5 py-2 text-left shadow-sm transition ${
                                selected ? "ring-2 ring-[var(--color-primary)]/30" : ""
                              } ${shiftThemeClasses(definition.theme)}`}
                            >
                              <div className="flex w-full items-start justify-between gap-3">
                                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/80 px-2 text-[11px] font-bold">
                                  {assignment?.shortCode ?? definition.shortCode}
                                </span>
                                <span className="text-sm leading-none text-neutral-500">⋮</span>
                              </div>
                              <div>
                                <p className="text-sm font-semibold leading-tight">{assignment?.shiftLabel ?? definition.label}</p>
                                <p className="mt-1 text-xs xl:text-sm">
                                  {assignment?.startTime && assignment?.endTime
                                    ? `${assignment.startTime} - ${assignment.endTime}`
                                    : "Nghỉ"}
                                </p>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  <div className="grid grid-cols-[148px_repeat(7,minmax(92px,1fr))] rounded-b-[28px] border-x border-b border-neutral-200 bg-white">
                    <div className="sticky left-0 z-10 border-r border-neutral-200 bg-white px-4 py-3">
                      <p className="text-sm font-semibold text-neutral-900">Tổng quan</p>
                      <p className="mt-1 text-xs text-neutral-500">Nhu cầu / ca</p>
                    </div>
                    {draft?.daySummaries.map((summary) => (
                      <div key={summary.dateKey} className="border-r border-neutral-200 px-2 py-3 text-center last:border-r-0">
                        <p className={`text-sm font-semibold ${summaryTone(summary.status)}`}>
                          {summary.scheduledCount} / {summary.requiredCount}
                        </p>
                        <p className="mt-2 text-xs text-neutral-500">
                          {summary.shortageCount > 0
                            ? `Thiếu ${summary.shortageCount}`
                            : summary.missingSkills.length
                              ? `Thiếu kỹ năng`
                              : "Đạt mục tiêu"}
                        </p>
                        <button type="button" onClick={() => handleDayDetail(summary.dateKey)} className="mt-2 text-xs font-medium text-neutral-700">
                          Xem chi tiết
                        </button>
                      </div>
                    ))}
                  </div>
                  </div>
                </div>
              </div>
            </section>
            </div>

            {selectedEmployee && selectedAssignment ? (
              <QuickShiftEditor
                employee={selectedEmployee}
                assignment={selectedAssignment}
                options={manualShiftOptions}
                overridesProfile={selectedAssignmentOverridesProfile}
                onPick={handleManualShiftChange}
                onClose={() => setSelectedCell(null)}
              />
            ) : null}

            <div ref={attendanceSectionRef} className="order-3">
            <section className="rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">Mở ca / Đóng ca</p>
                  <h3 className="mt-2 text-lg font-semibold text-neutral-900">Bảng công hôm nay</h3>
                </div>
                <div className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-700">
                  {attendanceSummary.openCount}/{attendanceSummary.totalCount} đang mở ca
                </div>
              </div>

              {pendingAttendanceApprovals.length ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {pendingAttendanceApprovals.map((entry) => (
                    <div key={entry.id} className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Chờ OWNER xác nhận mở ca</p>
                      <p className="mt-2 text-sm font-semibold text-neutral-900">
                        {entry.staff_user_id ? teamNameMap.get(entry.staff_user_id) ?? entry.staff_user_id : "Nhân sự"}
                      </p>
                      <p className="mt-1 text-sm text-neutral-600">
                        Mở ca {formatTime(entry.clock_in)}
                        {entry.scheduled_start ? ` • ca ${formatTime(entry.scheduled_start)} - ${formatTime(entry.scheduled_end ?? entry.scheduled_start)}` : ""}
                      </p>
                      <div className="mt-4 flex gap-3">
                        <button type="button" onClick={() => void handleReviewAttendance(entry.id, true)} disabled={ownerSaving} className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                          Duyệt
                        </button>
                        <button type="button" onClick={() => void handleReviewAttendance(entry.id, false)} disabled={ownerSaving} className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-900 disabled:opacity-60">
                          Từ chối
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {ownerAttendanceEntries.length ? (
                  ownerAttendanceEntries.map((entry) => (
                    <div key={entry.id} className="rounded-3xl border border-neutral-200 bg-neutral-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-neutral-900">
                            {entry.staff_user_id ? teamNameMap.get(entry.staff_user_id) ?? entry.staff_user_id : "Nhân sự"}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500">
                            {new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(entry.clock_in))}
                          </p>
                        </div>
                        <span className="rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-700">{entry.approval_status}</span>
                      </div>
                      <p className="mt-3 text-sm text-neutral-600">Thực tế: {formatTime(entry.clock_in)} - {entry.clock_out ? formatTime(entry.clock_out) : "Đang mở"}</p>
                      <p className="mt-1 text-sm text-neutral-500">Tính công: {formatTime(entry.effective_clock_in ?? entry.clock_in)} - {entry.effective_clock_out ? formatTime(entry.effective_clock_out) : "Đang chờ / tự động đóng ca"}</p>
                    </div>
                  ))
                ) : (
                  <ManageAlert tone="info">Hôm nay chưa có bản ghi mở ca/đóng ca nào.</ManageAlert>
                )}
              </div>
            </section>
            </div>

            <div className="order-2 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <div ref={overviewSectionRef}>
              <section className="rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">Tổng quan điều phối</p>
                    <h3 className="mt-2 text-lg font-semibold text-neutral-900">Cảnh báo và gợi ý điều chỉnh</h3>
                  </div>
                  <div className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-700">
                    {totalAssigned}/{totalDemand} slot
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {activeDaySummary ? (
                    <div className="rounded-3xl border border-neutral-200 bg-neutral-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-neutral-900">Chi tiết ngày {formatDateLabel(activeDaySummary.dateKey)}</p>
                          <p className="mt-1 text-sm text-neutral-600">
                            Đã xếp {activeDaySummary.scheduledCount}/{activeDaySummary.requiredCount} người
                          </p>
                        </div>
                        <span className={`text-sm font-semibold ${summaryTone(activeDaySummary.status)}`}>
                          {activeDaySummary.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-3 text-sm text-neutral-600">
                        <p>Thiếu người: {activeDaySummary.shortageCount}</p>
                        <p>
                          Kỹ năng còn thiếu: {activeDaySummary.missingSkills.length ? activeDaySummary.missingSkills.join(", ") : "Không có"}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {draft?.conflicts.length ? (
                    draft.conflicts.slice(0, 6).map((conflict) => (
                      <div
                        key={conflict.id}
                        className={`rounded-3xl border px-4 py-4 ${
                          conflict.severity === "high"
                            ? "border-rose-200 bg-rose-50"
                            : conflict.severity === "medium"
                              ? "border-amber-200 bg-amber-50"
                              : "border-neutral-200 bg-neutral-50"
                        }`}
                      >
                        <p className="text-sm font-semibold text-neutral-900">{conflict.title}</p>
                        <p className="mt-1 text-sm text-neutral-600">{conflict.message}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-neutral-400">
                          {conflict.dateKey} {conflict.shiftType ? `· ${conflict.shiftType}` : ""}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleDayDetail(conflict.dateKey)}
                          className="mt-3 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700"
                        >
                          Mở ngày này
                        </button>
                      </div>
                    ))
                  ) : (
                    <ManageAlert tone="info">Không có xung đột nghiêm trọng. Draft sẵn sàng để publish.</ManageAlert>
                  )}
                </div>

                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-neutral-900">Gợi ý thay thế</h4>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {draft?.suggestions.length ? (
                      draft.suggestions.slice(0, 4).map((suggestion) => (
                        <div key={suggestion.id} className="rounded-3xl border border-neutral-200 bg-neutral-50 px-4 py-4">
                          <p className="text-sm font-semibold text-neutral-900">{suggestion.employeeName}</p>
                          <p className="mt-1 text-sm text-neutral-600">{suggestion.reason}</p>
                          <p className="mt-2 text-xs text-neutral-400">
                            {formatDateLabel(suggestion.dateKey)} · {suggestion.shiftType} · Score {suggestion.score}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleSuggestionFocus(suggestion.employeeId, suggestion.dateKey)}
                            className="mt-3 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700"
                          >
                            Mở ô gợi ý
                          </button>
                        </div>
                      ))
                    ) : (
                      <ManageAlert tone="info">Chưa cần đề xuất thay thế cho tuần này.</ManageAlert>
                    )}
                  </div>
                </div>
              </section>
              </div>

              <div ref={leaveSectionRef} className="xl:sticky xl:top-24 xl:self-start">
              <section className="rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">Chỉnh tay trước khi publish</p>
                  </div>
                  {selectedCell ? (
                    <button
                      type="button"
                      onClick={() => setSelectedCell(null)}
                      className="hidden rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 lg:inline-flex"
                    >
                      Bá» chá»n
                    </button>
                  ) : null}
                </div>

                {pendingLeaveApprovals.length ? (
                  <div className="mt-5 space-y-3">
                    {pendingLeaveApprovals.map((request) => (
                      <div key={request.id} className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-neutral-900">{teamNameMap.get(request.staff_user_id) ?? request.staff_user_id}</p>
                            <p className="mt-1 text-sm text-neutral-600">
                              {request.request_type === "DAY_OFF" ? "Xin nghỉ ca" : "Xin về sớm"} • {request.scheduled_date ?? "Không rõ ngày"}
                              {request.requested_end_at ? ` • ${formatTime(request.requested_end_at)}` : ""}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700">PENDING</span>
                        </div>
                        {request.note ? <p className="mt-3 text-sm text-neutral-700">{request.note}</p> : null}
                        <div className="mt-4 flex gap-3">
                          <button type="button" onClick={() => void handleReviewLeaveRequest(request.id, true)} disabled={ownerSaving} className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                            Duyệt
                          </button>
                          <button type="button" onClick={() => void handleReviewLeaveRequest(request.id, false)} disabled={ownerSaving} className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-900 disabled:opacity-60">
                            Từ chối
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ManageAlert tone="info">Không có yêu cầu nghỉ đang chờ duyệt.</ManageAlert>
                )}

                {selectedEmployee && selectedAssignment ? (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
                      <p className="text-sm font-semibold text-neutral-900">{getRoleLabel(selectedEmployee.role)}</p>
                      <p className="mt-1 text-sm text-neutral-600">
                        Kỹ năng: {selectedEmployee.skills.length ? selectedEmployee.skills.join(", ") : "Vận hành / hỗ trợ"}
                      </p>
                      <p className="mt-1 text-sm text-neutral-600">Giờ tối đa / tuần: {selectedEmployee.maxWeeklyHours}h</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {manualShiftOptions.map((definition) => {
                        const active = selectedAssignment.shiftType === definition.type;
                        return (
                          <button
                            key={definition.type}
                            type="button"
                            onClick={() => void handleManualShiftChange(definition.type)}
                            className={`rounded-3xl border px-4 py-4 text-left transition ${
                              active ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/15" : "border-neutral-200"
                            } ${shiftThemeClasses(definition.theme)}`}
                          >
                            <p className="text-sm font-semibold">{definition.label}</p>
                            <p className="mt-1 text-xs">
                              {definition.startTime && definition.endTime
                                ? `${definition.startTime} - ${definition.endTime}`
                                : "Không xếp ca"}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    {selectedAssignmentOverridesProfile ? (
                      <ManageAlert tone="warn">
                        Ca hiện tại đang là ngoại lệ so với khung giờ cố định của nhân sự này. Nếu đây là đổi ca riêng cho ngày này thì vẫn có thể giữ lịch tuần, còn nếu là lịch cố định mới thì nên cập nhật lại ở màn `Team`.
                      </ManageAlert>
                    ) : null}
                    {selectedEmployee.leaveDateKeys.includes(selectedAssignment.dateKey) ? (
                      <ManageAlert tone="warn">
                        Nhân viên này đang có ngày xin nghỉ vào {formatDateLabel(selectedAssignment.dateKey)}. Hãy kiểm tra thủ công trước khi publish.
                      </ManageAlert>
                    ) : null}
                    {selectedProfile ? (
                      <ManageAlert tone="info">
                        Hồ sơ kỹ năng và khung giờ làm của nhân sự được quản lý ở màn `Team`. Màn `Shifts` chỉ dùng dữ liệu đó để tự động phân ca và hỗ trợ điều chỉnh lịch tuần.
                      </ManageAlert>
                    ) : null}

                    {selectedProfile ? (
                      <div className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold text-neutral-900">Nghỉ phép / override theo ngày</h4>
                            <p className="mt-1 text-xs text-neutral-500">
                              Lịch cố định từ `Team` là nền. Chỉ các ngày được chọn ở đây mới đè lên lịch cố định của nhân sự.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void saveSelectedProfile()}
                            disabled={profileSaving || profilesSchemaMissing}
                            className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {profileSaving ? "Đang lưu..." : "Lưu nghỉ phép"}
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {(draft?.weekDates ?? generateWeekDates(weekStart)).map((dateKey) => {
                            const active = selectedProfile.leaveDateKeys.includes(dateKey);
                            return (
                              <button
                                key={dateKey}
                                type="button"
                                onClick={() => toggleSelectedLeaveDate(dateKey)}
                                className={`rounded-full border px-3 py-2 text-xs font-semibold ${
                                  active
                                    ? "border-rose-300 bg-rose-50 text-rose-700"
                                    : "border-neutral-200 text-neutral-600"
                                }`}
                              >
                                {formatDateLabel(dateKey)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <ManageAlert tone="info">
                    Chọn một ô bất kỳ trên bảng để điều chỉnh lịch tuần. Hồ sơ kỹ năng và khung giờ làm của nhân sự được quản lý ở màn `Team`.
                  </ManageAlert>
                )}

                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-neutral-900">Tổng giờ dự kiến theo nhân viên</h4>
                  <div className="mt-3 space-y-3">
                    {employeeSummaries.map((summary) => (
                      <div key={summary.employeeId} className="rounded-3xl border border-neutral-200 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-neutral-900">{summary.employeeName}</p>
                            <p className="mt-1 text-xs text-neutral-500">{getRoleLabel(summary.role)}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${summary.overtimeHours > 0 ? "text-rose-600" : "text-neutral-900"}`}>
                              {summary.assignedHours}h / {summary.maxWeeklyHours}h
                            </p>
                            <p className="mt-1 text-xs text-neutral-500">{summary.totalShifts} ca</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
              </div>
            </div>
          </main>
        </div>
      </div>

      <MobileStickyActions>
        <button
          type="button"
          onClick={() => void runAutoSchedule()}
          disabled={ownerSaving || !canRunAutoSchedule || profilesSchemaMissing}
          className="flex-1 rounded-full border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900"
        >
          Tự động xếp ca
        </button>
        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={ownerSaving || !draft}
          className="flex-1 rounded-full bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white"
        >
          Xuất bản
        </button>
      </MobileStickyActions>
      <style jsx global>{`
        .manage-shifts-page button:not(:disabled) {
          cursor: pointer;
        }
      `}</style>
    </AppShell>
  );
}



