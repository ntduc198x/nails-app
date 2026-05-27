import Feather from "@expo/vector-icons/Feather";
import { Alert, Modal } from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ManageScreenShell } from "@/src/features/admin/manage-ui";
import { useAdminStrings } from "@/src/features/admin/strings";
import { ADMIN_CONTENT_BOTTOM_NAV_CLEARANCE } from "@/src/features/admin/ui";
import { useAdminObserverScope } from "@/src/hooks/use-admin-observer-scope";
import { useAdminPreferences } from "@/src/providers/admin-preferences-provider";
import { useSession } from "@/src/providers/session-provider";
import { mobileSupabase } from "@/src/lib/supabase";
import {
  buildAutoScheduleResult,
  createShiftSlotSnapshot,
  buildDefaultWeekDemands,
  DEFAULT_SHIFT_DEFINITIONS,
  formatAttendanceFraction,
  generateDraftSchedule,
  generateWeekDates,
  getRecommendedShiftTypesForDate,
  getRoleLabel,
  listTeamMembersForMobile,
  type AutoScheduleAssignment,
  type AutoScheduleDemand,
  type AutoScheduleEmployee,
  type AutoScheduleResult,
  type EffectiveShiftSlot,
  type ShiftChangeRequestRecord,
  type ShiftDefinition,
  type ShiftRequestKind,
  type ShiftType,
  type StaffRole,
  type TeamMemberRow,
  translations,
} from "@nails/shared";
import {
  applyApprovedDayOffToAssignments,
  canManageShiftPlans,
  closeShiftEntryIfAllowed,
  createManualShiftOverride,
  createEmptyStaffShiftProfile,
  createShiftCheckIn,
  getEffectiveShiftSlotsForDate,
  isMissingShiftPlansSchema,
  isMissingStaffShiftProfilesSchema,
  listEffectiveShiftSlots,
  listOwnerShiftEntries,
  listPersonalShiftEntries,
  listShiftChangeRequests,
  listShiftLeaveRequests,
  loadShiftPlanWeek,
  loadStaffShiftProfiles,
  loadWeeklyShiftForecast,
  normalizeStaffShiftProfiles,
  removeManualShiftOverride,
  reviewShiftChangeRequest,
  reviewShiftCheckIn,
  reviewShiftLeaveRequest,
  saveShiftPlanWeek,
  saveStaffShiftProfile,
  submitShiftChangeRequest,
  submitDayOffRequest,
  type ShiftLeaveRequestRecord,
  type ShiftPlanRecord,
  type ShiftTimeEntryRecord,
  type StaffShiftProfileRecord,
} from "@/src/features/admin/shifts/data";

const c = {
  bg: "#FCFAF8",
  white: "#FFFFFF",
  text: "#2F241D",
  sub: "#7F7267",
  border: "rgba(47, 36, 29, 0.08)",
  soft: "#F6F1EC",
  softStrong: "#EFE6DD",
  primary: "#B56A3A",
  primarySoft: "#F5E7DD",
  success: "#2B9E5F",
  successSoft: "#E8F6ED",
  warn: "#E38B28",
  danger: "#D8574B",
  dangerSoft: "#FDEBE8",
};

type SelectedCell = {
  employeeId: string;
  dateKey: string;
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const weekday = next.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(dateKey: string, amount: number) {
  const next = new Date(`${dateKey}T00:00:00`);
  next.setDate(next.getDate() + amount);
  return toDateKey(next);
}

function getLocaleTag(locale: "vi" | "en") {
  return locale === "en" ? "en-US" : "vi-VN";
}

function getWeekLabel(weekStart: string, locale: "vi" | "en") {
  const dates = generateWeekDates(weekStart);
  const start = new Date(`${dates[0]}T00:00:00`);
  const end = new Date(`${dates[6]}T00:00:00`);
  const localeTag = getLocaleTag(locale);
  return `${start.toLocaleDateString(localeTag, { day: "2-digit", month: "2-digit" })} - ${end.toLocaleDateString(localeTag, { day: "2-digit", month: "2-digit" })}`;
}

function formatDayChip(dateKey: string, locale: "vi" | "en") {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(getLocaleTag(locale), {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatTime(value: string | null | undefined, locale: "vi" | "en") {
  if (!value) return "--:--";
  return new Date(value).toLocaleTimeString(getLocaleTag(locale), { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getShiftDefinition(type: ShiftType) {
  return DEFAULT_SHIFT_DEFINITIONS.find((item) => item.type === type) ?? DEFAULT_SHIFT_DEFINITIONS[3];
}

function getShiftColors(definition: ShiftDefinition) {
  if (definition.theme === "morning") return { bg: "#E8F6ED", text: "#237A4C", border: "#BDE3C8" };
  if (definition.theme === "afternoon") return { bg: "#FFF3E4", text: "#B96C12", border: "#F3D09F" };
  if (definition.theme === "full") return { bg: "#F0ECFF", text: "#6849B8", border: "#D2C5FF" };
  return { bg: "#F5F1EC", text: "#73665C", border: "#E3D8CC" };
}

function looksLikeUserId(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized) ||
    /^[0-9a-f]{8}$/i.test(normalized)
  );
}

function looksLikeGenericTeamName(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return (
    looksLikePlaceholderName(normalized) ||
    /^(nh\u00e2n s\u1ef1|nhan su|staff)\s+\d+$/i.test(normalized) ||
    /^user$/i.test(normalized)
  );
}

function looksLikePlaceholderName(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return /^nhân sự\s+\d+$/i.test(normalized) || /^staff\s+\d+$/i.test(normalized);
}

function resolveTeamMemberName(row: TeamMemberRow, index: number, fallbackStaffName: string) {
  const displayName = row.displayName?.trim() ?? "";
  if (displayName && !looksLikeUserId(displayName) && !looksLikeGenericTeamName(displayName)) return displayName;
  const emailName = row.email?.split("@")[0]?.trim() ?? "";
  if (emailName) return emailName;
  const phoneName = row.phone?.trim() ?? "";
  if (phoneName) return phoneName;
  return `${fallbackStaffName} ${index + 1}`;
}

function getPersonDisplayName(
  userId: string,
  namesByUserId: Map<string, string>,
  fallbackName?: string | null,
) {
  const mappedName = namesByUserId.get(userId)?.trim();
  const normalizedFallback = fallbackName?.trim() ?? "";
  const fallbackLooksLikeId =
    !normalizedFallback ||
    normalizedFallback === userId ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedFallback) ||
    looksLikeGenericTeamName(normalizedFallback);

  if (mappedName) return mappedName;
  if (!fallbackLooksLikeId) return normalizedFallback;
  return userId;
}

function resolvePlannerDisplayName(row: TeamMemberRow, index: number, fallbackStaffName: string) {
  const baseName = resolveTeamMemberName(row, index, fallbackStaffName);
  if (baseName && !looksLikeGenericTeamName(baseName) && !/^user$/i.test(baseName.trim())) {
    return baseName;
  }

  const phoneName = row.phone?.trim() ?? "";
  if (phoneName) return phoneName;

  const emailName = row.email?.split("@")[0]?.trim() ?? "";
  if (emailName) return emailName;

  return baseName;
}

type AdminStringsShape = Record<keyof typeof translations.vi.admin, string>;

function localizeAdminLiteral(
  strings: AdminStringsShape,
  value: string | null | undefined,
) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return normalized;

  for (const key of Object.keys(translations.vi.admin) as Array<keyof typeof translations.vi.admin>) {
    if (translations.vi.admin[key] === normalized || translations.en.admin[key] === normalized) {
      return strings[key];
    }
  }

  return normalized;
}

function getLocalizedShiftLabel(
  strings: AdminStringsShape,
  shiftType: ShiftType,
  fallbackLabel?: string | null,
) {
  switch (shiftType) {
    case "MORNING":
      return strings.manageTeamShiftMorning;
    case "AFTERNOON":
      return strings.manageTeamShiftAfternoon;
    case "FULL_DAY":
      return strings.manageTeamShiftFullDay;
    case "OFF":
      return strings.manageShiftsOffLabel;
    default:
      return localizeAdminLiteral(strings, fallbackLabel);
  }
}

function hydrateSlotNames(slots: EffectiveShiftSlot[], namesByUserId: Map<string, string>) {
  return slots.map((slot) => ({
    ...slot,
    holderName: getPersonDisplayName(slot.holderUserId, namesByUserId, slot.holderName),
  }));
}

function hydrateSlotSnapshotNames<T extends { holderUserId: string; holderName?: string | null }>(
  slots: T[],
  namesByUserId: Map<string, string>,
) {
  return slots.map((slot) => ({
    ...slot,
    holderName: getPersonDisplayName(slot.holderUserId, namesByUserId, slot.holderName),
  }));
}

function isSchedulableTeamRole(role: TeamMemberRow["role"]) {
  return role !== "OWNER" && role !== "PARTNER" && role !== "USER";
}

function augmentTeamDirectoryRows(
  rows: TeamMemberRow[],
  options: {
    currentUserId: string | null;
    currentRole: TeamMemberRow["role"] | null | undefined;
    currentUserEmail: string | null | undefined;
    currentUserDisplayName: string | null | undefined;
    branchId: string | null;
  },
) {
  if (!options.currentUserId || rows.some((row) => row.userId === options.currentUserId)) {
    return rows;
  }

  const fallbackDisplayName = options.currentUserDisplayName?.trim()
    || options.currentUserEmail?.split("@")[0]?.trim()
    || options.currentUserId.slice(0, 8);

  return [
    {
      id: `session:${options.currentUserId}`,
      userId: options.currentUserId,
      role: (options.currentRole ?? "USER") as TeamMemberRow["role"],
      displayName: fallbackDisplayName,
      email: options.currentUserEmail ?? null,
      phone: null,
      branchId: options.branchId,
    },
    ...rows,
  ];
}

function buildEmployeeList(
  rows: TeamMemberRow[],
  profiles: StaffShiftProfileRecord[],
  fallbackStaffName: string,
) {
  const profileMap = new Map(profiles.map((item) => [item.userId, item]));
  return rows
    .filter((row) => isSchedulableTeamRole(row.role))
    .map<AutoScheduleEmployee>((row, index) => {
      const role = row.role as StaffRole;
      const profile = profileMap.get(row.userId) ?? createEmptyStaffShiftProfile(row.userId, role);
      return {
        id: row.userId,
        name: resolvePlannerDisplayName(row, index, fallbackStaffName),
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

function createOffAssignment(dateKey: string, employee: AutoScheduleEmployee): AutoScheduleAssignment {
  const off = getShiftDefinition("OFF");
  return {
    employeeId: employee.id,
    employeeName: employee.name,
    role: employee.role,
    dateKey,
    shiftType: "OFF",
    shiftLabel: off.label,
    shortCode: off.shortCode,
    startTime: off.startTime,
    endTime: off.endTime,
    hours: 0,
    source: "system",
    score: 0,
    matchedSkills: [],
  };
}

function createAssignmentFromEffectiveSlot(slot: EffectiveShiftSlot): AutoScheduleAssignment {
  return {
    employeeId: slot.holderUserId,
    employeeName: slot.holderName?.trim() || slot.holderUserId,
    role: "TECH",
    dateKey: slot.dateKey,
    shiftType: slot.shiftType,
    shiftLabel: slot.shiftLabel,
    shortCode: getShiftDefinition(slot.shiftType).shortCode,
    startTime: slot.startTime,
    endTime: slot.endTime,
    hours: getShiftDefinition(slot.shiftType).hours,
    source: slot.source === "OVERRIDE_ADD" ? "manual" : "auto",
    score: 100,
    matchedSkills: [],
  };
}

function buildManualDraft(
  currentDraft: AutoScheduleResult,
  employees: AutoScheduleEmployee[],
  demands: AutoScheduleDemand[],
  employeeId: string,
  dateKey: string,
  shiftType: ShiftType,
) {
  const employee = employees.find((item) => item.id === employeeId);
  if (!employee) return currentDraft;

  const definition = getShiftDefinition(shiftType);
  const assignments = currentDraft.assignments.map((assignment) => {
    if (assignment.employeeId !== employeeId || assignment.dateKey !== dateKey) return assignment;
    const matchedDemand = demands.find((item) => item.dateKey === dateKey && item.shiftType === shiftType);
    return {
      ...assignment,
      role: employee.role,
      shiftType,
      shiftLabel: definition.label,
      shortCode: definition.shortCode,
      startTime: definition.startTime,
      endTime: definition.endTime,
      hours: definition.hours,
      source: "manual" as const,
      score: matchedDemand ? 90 : 0,
      matchedSkills:
        matchedDemand && employee.skills.length
          ? matchedDemand.requiredSkills.filter((skill) => employee.skills.includes(skill))
          : [],
    };
  });

  return buildAutoScheduleResult({
    weekStart: currentDraft.weekStart,
    employees,
    demands,
    assignments,
  });
}

function replaceProfile(profiles: StaffShiftProfileRecord[], nextProfile: StaffShiftProfileRecord) {
  const map = new Map(profiles.map((item) => [item.userId, item]));
  map.set(nextProfile.userId, nextProfile);
  return Array.from(map.values());
}

export default function AdminShiftsScreen() {
  const strings = useAdminStrings();
  const { locale } = useAdminPreferences();
  const { isHydrated, role, user } = useSession();
  const observer = useAdminObserverScope();
  const canManage = canManageShiftPlans(role);
  const userId = user?.id ?? null;
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const observerScopeMode = observer.viewContext?.observerScope.mode ?? observer.observerScope.mode;
  const observerScopeBranchId = observer.viewContext?.observerScope.branchId ?? observer.observerScope.branchId ?? null;
  const observerScope = useMemo(
    () => ({ mode: observerScopeMode, branchId: observerScopeBranchId }),
    [observerScopeBranchId, observerScopeMode],
  );
  const currentUserEmail = user?.email ?? null;
  const currentUserDisplayName = user?.displayName ?? null;
  const observerReadOnly =
    observer.viewContext?.observerScope.mode === "org" ||
    (observer.viewContext?.observerScope.mode === "branch"
      && observer.viewContext.observerScope.branchId !== observer.viewContext.workingBranchId);
  const observerOrgMode = observer.viewContext?.observerScope.mode === "org";

  const [weekStart, setWeekStart] = useState(() => toDateKey(startOfWeek(new Date())));
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planSchemaMissing, setPlanSchemaMissing] = useState(false);
  const [profileSchemaMissing, setProfileSchemaMissing] = useState(false);
  const [teamRows, setTeamRows] = useState<TeamMemberRow[]>([]);
  const [profiles, setProfiles] = useState<StaffShiftProfileRecord[]>([]);
  const [draftPlan, setDraftPlan] = useState<ShiftPlanRecord | null>(null);
  const [publishedPlan, setPublishedPlan] = useState<ShiftPlanRecord | null>(null);
  const [draftResult, setDraftResult] = useState<AutoScheduleResult | null>(null);
  const [demands, setDemands] = useState<AutoScheduleDemand[]>([]);
  const [forecast, setForecast] = useState<Record<string, number>>({});
  const [ownerEntries, setOwnerEntries] = useState<ShiftTimeEntryRecord[]>([]);
  const [ownerLeaveRequests, setOwnerLeaveRequests] = useState<ShiftLeaveRequestRecord[]>([]);
  const [ownerShiftChangeRequests, setOwnerShiftChangeRequests] = useState<ShiftChangeRequestRecord[]>([]);
  const [personalEntries, setPersonalEntries] = useState<ShiftTimeEntryRecord[]>([]);
  const [personalEffectiveSlots, setPersonalEffectiveSlots] = useState<EffectiveShiftSlot[]>([]);
  const [ownerEffectiveSlots, setOwnerEffectiveSlots] = useState<EffectiveShiftSlot[]>([]);
  const [todayEffectiveSlots, setTodayEffectiveSlots] = useState<EffectiveShiftSlot[]>([]);
  const [selectedTodaySlotKey, setSelectedTodaySlotKey] = useState("");
  const [shiftRequestKind, setShiftRequestKind] = useState<ShiftRequestKind>("PICKUP");
  const [selectedRequestTargetKey, setSelectedRequestTargetKey] = useState("");
  const [selectedRequestSourceKey, setSelectedRequestSourceKey] = useState("");
  const [shiftRequestNote, setShiftRequestNote] = useState("");
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);

  const teamDirectoryRows = useMemo(
    () =>
      augmentTeamDirectoryRows(teamRows, {
        currentUserId: userId,
        currentRole: role,
        currentUserEmail,
        currentUserDisplayName,
        branchId: observerScope.mode === "branch" ? observerScope.branchId : null,
      }),
    [currentUserDisplayName, currentUserEmail, observerScope.branchId, observerScope.mode, role, teamRows, userId],
  );
  const schedulableTeamRows = useMemo(
    () => teamDirectoryRows.filter((row) => isSchedulableTeamRole(row.role)),
    [teamDirectoryRows],
  );
  const schedulableEmployees = useMemo(
    () => buildEmployeeList(schedulableTeamRows, profiles, strings.manageShiftsFallbackStaffName),
    [profiles, schedulableTeamRows, strings.manageShiftsFallbackStaffName],
  );
  const assignmentMap = useMemo(
    () => new Map((draftResult?.assignments ?? []).map((assignment) => [`${assignment.employeeId}:${assignment.dateKey}`, assignment])),
    [draftResult],
  );
  const teamNameMap = useMemo(
    () =>
      new Map(
        teamDirectoryRows.map((row, index) => [
          row.userId,
          resolvePlannerDisplayName(row, index, strings.manageShiftsFallbackStaffName),
        ]),
      ),
    [strings.manageShiftsFallbackStaffName, teamDirectoryRows],
  );
  const teamMemberMap = useMemo(
    () => new Map(teamDirectoryRows.map((row) => [row.userId, row])),
    [teamDirectoryRows],
  );
  const getTeamMemberInfo = useCallback(
    (userId: string | null | undefined, fallbackName?: string | null) => {
      if (!userId) {
        return {
          name: strings.manageShiftsFallbackStaffName,
          email: null as string | null,
          phone: null as string | null,
        };
      }

      const row = teamMemberMap.get(userId);
      return {
        name: getPersonDisplayName(userId, teamNameMap, fallbackName),
        email: row?.email?.trim() || null,
        phone: row?.phone?.trim() || null,
      };
    },
    [strings.manageShiftsFallbackStaffName, teamMemberMap, teamNameMap],
  );

  const localizeErrorMessage = useCallback(
    (nextError: unknown, fallback: string) =>
      nextError instanceof Error ? localizeAdminLiteral(strings, nextError.message) : fallback,
    [strings],
  );
  const localizeShiftLabel = useCallback(
    (shiftType: ShiftType, fallbackLabel?: string | null) => getLocalizedShiftLabel(strings, shiftType, fallbackLabel),
    [strings],
  );
  const localizeSavedShiftLabel = useCallback(
    (shiftType: string | null | undefined, fallbackLabel?: string | null) => {
      if (
        shiftType === "MORNING"
        || shiftType === "AFTERNOON"
        || shiftType === "FULL_DAY"
        || shiftType === "OFF"
      ) {
        return getLocalizedShiftLabel(strings, shiftType, fallbackLabel);
      }

      return localizeAdminLiteral(strings, fallbackLabel) || strings.manageShiftsFlexibleShift;
    },
    [strings],
  );

  const loadData = useCallback(
    async (force = false) => {
      if (!mobileSupabase || !isHydrated || !userId || !observer.isReady) {
        setLoading(false);
        return;
      }

      try {
        if (force) setLoading(true);
        else setRefreshing(true);

        setError(null);
        setPlanSchemaMissing(false);
        setProfileSchemaMissing(false);

        const teamPromise = listTeamMembersForMobile(mobileSupabase, { observerScope });
        const profilesPromise = loadStaffShiftProfiles(observerScope).catch((nextError) => {
          if (isMissingStaffShiftProfilesSchema(nextError)) {
            setProfileSchemaMissing(true);
            return [];
          }
          throw nextError;
        });
        const draftPromise = loadShiftPlanWeek(weekStart, { observerScope }).catch((nextError) => {
          if (isMissingShiftPlansSchema(nextError)) {
            setPlanSchemaMissing(true);
            return null;
          }
          throw nextError;
        });
        const publishedPromise = loadShiftPlanWeek(weekStart, { publishedOnly: true, observerScope }).catch((nextError) => {
          if (isMissingShiftPlansSchema(nextError)) {
            setPlanSchemaMissing(true);
            return null;
          }
          throw nextError;
        });
        const forecastPromise = loadWeeklyShiftForecast(weekStart, observerScope).catch(() => {
          return generateWeekDates(weekStart).reduce<Record<string, number>>((acc, dateKey) => {
            acc[dateKey] = 0;
            return acc;
          }, {});
        });
        const ownerEntriesPromise = canManage ? listOwnerShiftEntries(observerScope) : Promise.resolve([]);
        const ownerLeavesPromise = canManage ? listShiftLeaveRequests({ observerScope }) : Promise.resolve([]);
        const ownerShiftChangePromise = canManage ? listShiftChangeRequests({ observerScope }) : Promise.resolve([]);
        const personalEntriesPromise = listPersonalShiftEntries(userId);
        const personalLeavesPromise = listShiftLeaveRequests({ userId, observerScope });
        const personalWeekSlotsPromise = listEffectiveShiftSlots(weekStart, { userId, observerScope });
        const ownerWeekSlotsPromise = canManage
          ? listEffectiveShiftSlots(weekStart, { observerScope })
          : Promise.resolve([]);
        const todayWeekStart = toDateKey(startOfWeek(new Date(`${todayKey}T00:00:00`)));
        const personalTodaySlotsPromise =
          todayWeekStart === weekStart
            ? personalWeekSlotsPromise
            : listEffectiveShiftSlots(todayWeekStart, { userId, observerScope });

        const [
          rows,
          profileRowsRaw,
          nextDraftPlan,
          nextPublishedPlan,
          forecast,
          nextOwnerEntries,
          nextOwnerLeaves,
          nextOwnerShiftChanges,
          nextPersonalEntries,
          nextPersonalLeaves,
          nextPersonalWeekSlots,
          nextOwnerWeekSlots,
          nextPersonalTodayWeekSlots,
        ] = await Promise.all([
          teamPromise,
          profilesPromise,
          draftPromise,
          publishedPromise,
          forecastPromise,
          ownerEntriesPromise,
          ownerLeavesPromise,
          ownerShiftChangePromise,
          personalEntriesPromise,
          personalLeavesPromise,
          personalWeekSlotsPromise,
          ownerWeekSlotsPromise,
          personalTodaySlotsPromise,
        ]);

        const directoryRows = augmentTeamDirectoryRows(rows, {
          currentUserId: userId,
          currentRole: role,
          currentUserEmail,
          currentUserDisplayName,
          branchId: observerScope.mode === "branch" ? observerScope.branchId : null,
        });
        const schedulableRows = directoryRows.filter((row) => isSchedulableTeamRole(row.role));
        const nextFallbackRoles = new Map(
          schedulableRows.map((row) => [row.userId, row.role as StaffRole]),
        );
        const nextTeamNameMap = new Map(
          directoryRows.map((row, index) => [
            row.userId,
            resolvePlannerDisplayName(row, index, strings.manageShiftsFallbackStaffName),
          ]),
        );
        const normalizedProfiles = normalizeStaffShiftProfiles(profileRowsRaw as never[], nextFallbackRoles);
        const nextEmployees = buildEmployeeList(schedulableRows, normalizedProfiles, strings.manageShiftsFallbackStaffName);
        const basePlan = nextDraftPlan ?? nextPublishedPlan;
        const nextDemands = basePlan?.demands ?? buildDefaultWeekDemands({ weekStart, employees: nextEmployees, forecast });
        const baseResult = basePlan?.result ?? generateDraftSchedule({ weekStart, employees: nextEmployees, demands: nextDemands });
        const assignmentSource = canManage ? (nextOwnerLeaves as ShiftLeaveRequestRecord[]) : nextPersonalLeaves;
        const assignmentsWithApprovedLeave = applyApprovedDayOffToAssignments(baseResult.assignments, assignmentSource);
        const nextDraftResult = buildAutoScheduleResult({
          weekStart,
          employees: nextEmployees,
          demands: nextDemands,
          assignments: assignmentsWithApprovedLeave,
        });

        setTeamRows(directoryRows);
        setProfiles(normalizedProfiles);
        setDraftPlan(nextDraftPlan);
        setPublishedPlan(nextPublishedPlan);
        setDraftResult(nextDraftResult);
        setDemands(nextDemands);
        setForecast(forecast);
        setOwnerEntries(nextOwnerEntries as ShiftTimeEntryRecord[]);
        setOwnerLeaveRequests(nextOwnerLeaves as ShiftLeaveRequestRecord[]);
        setOwnerShiftChangeRequests(nextOwnerShiftChanges as ShiftChangeRequestRecord[]);
        setPersonalEntries(nextPersonalEntries);
        setPersonalEffectiveSlots(hydrateSlotNames(nextPersonalWeekSlots, nextTeamNameMap));
        setOwnerEffectiveSlots(hydrateSlotNames(nextOwnerWeekSlots, nextTeamNameMap));
        const nextTodaySlots = getEffectiveShiftSlotsForDate(
          hydrateSlotNames(nextPersonalTodayWeekSlots, nextTeamNameMap),
          userId,
          todayKey,
        );
        setTodayEffectiveSlots(nextTodaySlots);
        setSelectedTodaySlotKey((current) => {
          if (nextTodaySlots.some((slot) => `${slot.dateKey}:${slot.shiftType}` === current)) return current;
          return nextTodaySlots[0] ? `${nextTodaySlots[0].dateKey}:${nextTodaySlots[0].shiftType}` : "";
        });
      } catch (nextError) {
        setError(localizeErrorMessage(nextError, strings.manageShiftsLoadFailed));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canManage, currentUserDisplayName, currentUserEmail, isHydrated, observer.isReady, observerScope, role, todayKey, userId, weekStart],
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadData(true);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [loadData]);

  const weekDates = useMemo(() => generateWeekDates(weekStart), [weekStart]);
  const currentSelectedDateKey = weekDates.includes(selectedDateKey) ? selectedDateKey : (weekDates[0] ?? weekStart);
  const currentSelectedCell = useMemo(
    () => (selectedCell && weekDates.includes(selectedCell.dateKey) ? selectedCell : null),
    [selectedCell, weekDates],
  );
  const pendingOwnerEntries = useMemo(
    () => ownerEntries.filter((item) => item.approval_status === "PENDING"),
    [ownerEntries],
  );
  const pendingOwnerLeaves = useMemo(
    () => ownerLeaveRequests.filter((item) => item.status === "PENDING"),
    [ownerLeaveRequests],
  );
  const pendingOwnerShiftChanges = useMemo(
    () => ownerShiftChangeRequests.filter((item) => item.status === "PENDING"),
    [ownerShiftChangeRequests],
  );
  const activePersonalEntry = useMemo(
    () => personalEntries.find((item) => item.clock_out === null) ?? null,
    [personalEntries],
  );
  const selectedTodaySlot = useMemo(
    () => todayEffectiveSlots.find((slot) => `${slot.dateKey}:${slot.shiftType}` === selectedTodaySlotKey) ?? todayEffectiveSlots[0] ?? null,
    [selectedTodaySlotKey, todayEffectiveSlots],
  );
  const visibleTodayAssignment = selectedTodaySlot ? createAssignmentFromEffectiveSlot(selectedTodaySlot) : null;
  const todayPublishedAssignment = visibleTodayAssignment;
  const todayDraftAssignment = null;
  const todayShiftColors = useMemo(
    () => getShiftColors(getShiftDefinition(visibleTodayAssignment?.shiftType ?? "OFF")),
    [visibleTodayAssignment],
  );
  const todayShiftStatus = todayPublishedAssignment
    ? activePersonalEntry
      ? strings.manageShiftsTodayStatusClockingIn
      : strings.manageShiftsTodayStatusReady
    : todayDraftAssignment
      ? strings.manageShiftsTodayStatusWaitingPublish
      : strings.manageShiftsTodayStatusNoSchedule;
  const todayShiftMessage = todayPublishedAssignment
    ? activePersonalEntry
      ? strings.manageShiftsTodayMessageClockingIn
      : strings.manageShiftsTodayMessageReady
    : todayDraftAssignment
      ? strings.manageShiftsTodayMessageWaitingPublish
      : strings.manageShiftsTodayMessageNoSchedule;
  const selectedEmployee = useMemo(
    () => schedulableEmployees.find((employee) => employee.id === currentSelectedCell?.employeeId) ?? null,
    [currentSelectedCell?.employeeId, schedulableEmployees],
  );
  const selectedProfile = useMemo(
    () => (selectedEmployee ? profiles.find((item) => item.userId === selectedEmployee.id) ?? null : null),
    [profiles, selectedEmployee],
  );
  const selectedEffectiveAssignments = useMemo(() => {
    if (!currentSelectedCell) return [];
    return ownerEffectiveSlots
      .filter((slot) => slot.holderUserId === currentSelectedCell.employeeId && slot.dateKey === currentSelectedCell.dateKey)
      .map((slot) => createAssignmentFromEffectiveSlot(slot));
  }, [currentSelectedCell, ownerEffectiveSlots]);
  const selectedManualOverrides = useMemo(() => {
    if (!currentSelectedCell) return [];
    return ownerEffectiveSlots.filter(
      (slot) =>
        slot.holderUserId === currentSelectedCell.employeeId &&
        slot.dateKey === currentSelectedCell.dateKey &&
        slot.overrideId,
    );
  }, [currentSelectedCell, ownerEffectiveSlots]);
  const selectedAssignment = useMemo(() => {
    if (!currentSelectedCell || !selectedEmployee) return null;
    return (
      assignmentMap.get(`${currentSelectedCell.employeeId}:${currentSelectedCell.dateKey}`) ??
      createOffAssignment(currentSelectedCell.dateKey, selectedEmployee)
    );
  }, [assignmentMap, currentSelectedCell, selectedEmployee]);
  const manualOptions = useMemo(
    () =>
      selectedEmployee && selectedAssignment
        ? getRecommendedShiftTypesForDate(selectedEmployee, selectedAssignment.dateKey).map(getShiftDefinition)
        : [],
    [selectedAssignment, selectedEmployee],
  );
  const totalRequired = useMemo(() => demands.reduce((sum, item) => sum + item.requiredHeadcount, 0), [demands]);
  const totalAssigned = draftResult?.assignments.filter((item) => item.shiftType !== "OFF").length ?? 0;
  const totalConflicts = draftResult?.conflicts.length ?? 0;
  const selectedDayAssignments = useMemo(
    () =>
      schedulableEmployees.map((employee) => ({
        employee,
        assignment:
          assignmentMap.get(`${employee.id}:${currentSelectedDateKey}`) ??
          createOffAssignment(currentSelectedDateKey, employee),
      })),
    [assignmentMap, currentSelectedDateKey, schedulableEmployees],
  );
  const selectedDaySummary = useMemo(
    () => draftResult?.daySummaries.find((item) => item.dateKey === currentSelectedDateKey) ?? null,
    [currentSelectedDateKey, draftResult],
  );
  const selectedPersonalAssignment = useMemo(
    () => {
      const selectedSlot =
        getEffectiveShiftSlotsForDate(personalEffectiveSlots, user?.id ?? "", currentSelectedDateKey)[0] ?? null;
      return selectedSlot ? createAssignmentFromEffectiveSlot(selectedSlot) : null;
    },
    [currentSelectedDateKey, personalEffectiveSlots, user?.id],
  );
  const personalWeekAssignments = useMemo(
    () =>
      weekDates.map((dateKey) => {
        return {
          dateKey,
          assignments: getEffectiveShiftSlotsForDate(personalEffectiveSlots, user?.id ?? "", dateKey).map((slot) =>
            createAssignmentFromEffectiveSlot(slot),
          ),
        };
      }),
    [personalEffectiveSlots, user?.id, weekDates],
  );
  const hasPersonalPublishedSchedule = useMemo(
    () => personalWeekAssignments.some((entry) => entry.assignments.length > 0),
    [personalWeekAssignments],
  );
  const ownRequestSourceSlots = useMemo(
    () => personalEffectiveSlots.filter((slot) => slot.holderUserId === (user?.id ?? "")),
    [personalEffectiveSlots, user?.id],
  );
  const requestableTargetSlots = useMemo(
    () =>
      hydrateSlotSnapshotNames(
        (publishedPlan?.result.assignments ?? [])
          .map((assignment) => createShiftSlotSnapshot(assignment, weekStart))
          .filter((slot): slot is NonNullable<ReturnType<typeof createShiftSlotSnapshot>> => !!slot),
        teamNameMap,
      )
        .filter((slot) => slot.holderUserId !== (user?.id ?? "")),
    [publishedPlan, teamNameMap, user?.id, weekStart],
  );
  const personalEntriesForCurrentWeek = useMemo(
    () => personalEntries.filter((entry) => !entry.scheduled_date || weekDates.includes(entry.scheduled_date)),
    [personalEntries, weekDates],
  );
  const shouldShowManagerPersonalCard = canManage
    && (role === "OWNER" || role === "PARTNER")
    && (personalEffectiveSlots.length > 0 || personalEntriesForCurrentWeek.length > 0);

  async function persistDraft(nextDraft: AutoScheduleResult, status: "draft" | "published") {
    if (planSchemaMissing) {
      setDraftResult(nextDraft);
      return;
    }
    const saved = await saveShiftPlanWeek({
      weekStart,
      status,
      result: nextDraft,
      demands,
      forecast: Object.keys(forecast).length ? forecast : (draftPlan ?? publishedPlan)?.forecast ?? {},
    });
    if (status === "published") setPublishedPlan(saved);
    else setDraftPlan(saved);
    setDraftResult(saved.result);
  }

  async function handleAutoSchedule() {
    if (!canManage || saving) return;
    try {
      setSaving(true);
      const nextDraft = generateDraftSchedule({ weekStart, employees: schedulableEmployees, demands });
      await persistDraft(nextDraft, "draft");
    } catch (nextError) {
      Alert.alert(strings.manageShiftsAutoScheduleFailedTitle, localizeErrorMessage(nextError, strings.manageShiftsTryAgain));
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!canManage || !draftResult || saving) return;
    try {
      setSaving(true);
      await persistDraft(draftResult, "published");
      Alert.alert(strings.manageShiftsPublishSuccessTitle, strings.manageShiftsPublishSuccessBody);
    } catch (nextError) {
      Alert.alert(strings.manageShiftsPublishFailedTitle, localizeErrorMessage(nextError, strings.manageShiftsTryAgain));
    } finally {
      setSaving(false);
    }
  }

  async function handleManualChange(shiftType: ShiftType) {
    if (!selectedCell || !draftResult || saving) return;
    try {
      setSaving(true);
      const nextDraft = buildManualDraft(draftResult, schedulableEmployees, demands, selectedCell.employeeId, selectedCell.dateKey, shiftType);
      await persistDraft(nextDraft, "draft");
      setSelectedCell(null);
    } catch (nextError) {
      Alert.alert(strings.manageShiftsUpdateShiftFailedTitle, localizeErrorMessage(nextError, strings.manageShiftsTryAgain));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleLeave() {
    if (!selectedEmployee || !selectedAssignment || profileSchemaMissing || saving) return;
    try {
      setSaving(true);
      const baseProfile = selectedProfile ?? createEmptyStaffShiftProfile(selectedEmployee.id, selectedEmployee.role);
      const hasLeave = baseProfile.leaveDateKeys.includes(selectedAssignment.dateKey);
      const nextProfile = {
        ...baseProfile,
        leaveDateKeys: hasLeave
          ? baseProfile.leaveDateKeys.filter((item) => item !== selectedAssignment.dateKey)
          : [...baseProfile.leaveDateKeys, selectedAssignment.dateKey].sort(),
      };
      await saveStaffShiftProfile(nextProfile);
      setProfiles((current) => replaceProfile(current, nextProfile));
      if (!hasLeave && draftResult) {
        const nextDraft = buildManualDraft(draftResult, schedulableEmployees, demands, selectedEmployee.id, selectedAssignment.dateKey, "OFF");
        await persistDraft(nextDraft, "draft");
      }
      setSelectedCell(null);
    } catch (nextError) {
      Alert.alert(strings.manageShiftsUpdateDayOffFailedTitle, localizeErrorMessage(nextError, strings.manageShiftsTryAgain));
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveEntry(entryId: string, approve: boolean, attendanceFraction?: number) {
    try {
      setSaving(true);
      await reviewShiftCheckIn(entryId, approve, attendanceFraction);
      await loadData(true);
    } catch (nextError) {
      Alert.alert(strings.manageShiftsReviewCheckInFailedTitle, localizeErrorMessage(nextError, strings.manageShiftsTryAgain));
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveLeave(requestId: string, approve: boolean, attendanceFraction?: number) {
    try {
      setSaving(true);
      await reviewShiftLeaveRequest(requestId, approve, attendanceFraction);
      await loadData(true);
    } catch (nextError) {
      Alert.alert(strings.manageShiftsReviewLeaveFailedTitle, localizeErrorMessage(nextError, strings.manageShiftsTryAgain));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateEffectiveOverride(shiftType: ShiftType) {
    if (!selectedCell || saving) return;
    const definition = getShiftDefinition(shiftType);
    if (shiftType === "OFF" || !definition.startTime || !definition.endTime) return;

    try {
      setSaving(true);
      await createManualShiftOverride({
        weekStart,
        staffUserId: selectedCell.employeeId,
        action: "ADD",
        observerScope,
        slot: {
          weekStart,
          dateKey: selectedCell.dateKey,
          shiftType,
          shiftLabel: definition.label,
          startTime: definition.startTime,
          endTime: definition.endTime,
          holderUserId: selectedCell.employeeId,
          holderName: teamNameMap.get(selectedCell.employeeId) ?? selectedCell.employeeId,
        },
      });
      await loadData(true);
    } catch (nextError) {
      Alert.alert(strings.manageShiftsAddOverrideFailedTitle, localizeErrorMessage(nextError, strings.manageShiftsTryAgain));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveEffectiveOverride(overrideId: string) {
    try {
      setSaving(true);
      await removeManualShiftOverride(overrideId, observerScope);
      await loadData(true);
    } catch (nextError) {
      Alert.alert(strings.manageShiftsRemoveOverrideFailedTitle, localizeErrorMessage(nextError, strings.manageShiftsTryAgain));
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveShiftChange(requestId: string, approve: boolean) {
    try {
      setSaving(true);
      await reviewShiftChangeRequest(requestId, approve, undefined, observerScope);
      await loadData(true);
    } catch (nextError) {
      Alert.alert(strings.manageShiftsReviewSwapFailedTitle, localizeErrorMessage(nextError, strings.manageShiftsTryAgain));
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitShiftChange() {
    const resolvedTarget =
      requestableTargetSlots.find((slot) => `${slot.dateKey}:${slot.shiftType}:${slot.holderUserId}` === selectedRequestTargetKey) ?? null;
    const resolvedSource =
      shiftRequestKind === "SWAP"
        ? ownRequestSourceSlots.find((slot) => `${slot.dateKey}:${slot.shiftType}:${slot.holderUserId}` === selectedRequestSourceKey) ?? null
        : null;

    if (!resolvedTarget) {
      Alert.alert(strings.manageShiftsMissingTargetTitle, strings.manageShiftsMissingTargetBody);
      return;
    }
    if (shiftRequestKind === "SWAP" && !resolvedSource) {
      Alert.alert(strings.manageShiftsMissingSourceTitle, strings.manageShiftsMissingSourceBody);
      return;
    }

    try {
      setSaving(true);
      await submitShiftChangeRequest({
        requestKind: shiftRequestKind,
        targetSlot: resolvedTarget,
        sourceSlot: resolvedSource,
        note: shiftRequestNote,
        observerScope,
      });
      setShiftRequestNote("");
      setSelectedRequestTargetKey("");
      setSelectedRequestSourceKey("");
      await loadData(true);
    } catch (nextError) {
      Alert.alert(strings.manageShiftsSubmitRequestFailedTitle, localizeErrorMessage(nextError, strings.manageShiftsTryAgain));
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckIn() {
    if (!selectedTodaySlot) return;
    try {
      setSaving(true);
      await createShiftCheckIn(selectedTodaySlot);
      await loadData(true);
    } catch (nextError) {
      Alert.alert(strings.manageShiftsOpenShiftFailedTitle, localizeErrorMessage(nextError, strings.manageShiftsTryAgain));
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckOut() {
    if (!activePersonalEntry) return;
    try {
      setSaving(true);
      await closeShiftEntryIfAllowed(activePersonalEntry);
      await loadData(true);
    } catch (nextError) {
      Alert.alert(strings.manageShiftsCloseShiftFailedTitle, localizeErrorMessage(nextError, strings.manageShiftsTryAgain));
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestDayOff() {
    if (!todayPublishedAssignment || saving) return;
    try {
      setSaving(true);
      await submitDayOffRequest(todayPublishedAssignment.dateKey);
      await loadData(true);
    } catch (nextError) {
      Alert.alert(strings.manageShiftsRequestLeaveFailedTitle, localizeErrorMessage(nextError, strings.manageShiftsTryAgain));
    } finally {
      setSaving(false);
    }
  }

  function handleWeekChange(amount: number) {
    setWeekStart((current) => addDays(current, amount));
    setSelectedCell(null);
  }

  function handleSelectedDateChange(dateKey: string) {
    setSelectedDateKey(dateKey);
    setSelectedCell(null);
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={c.primary} />
          <Text style={styles.loadingText}>{strings.manageShiftsLoading}</Text>
        </View>
      </View>
    );
  }

  return (
    <ManageScreenShell
      title={strings.manageShiftsTitle}
      subtitle={canManage ? strings.manageShiftsManageSubtitle : strings.manageShiftsStaffSubtitle}
      currentKey="shifts"
      group="setup"
      showBackButton={false}
      onRefresh={() => void loadData(true)}
      refreshing={refreshing}
      observerReadOnly={observerReadOnly}
      observerReadOnlyMessage={
        observerOrgMode
          ? strings.manageShiftsObserverOrgReadonly
          : strings.manageShiftsObserverBranchReadonly
      }
    >
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {observerOrgMode ? <Text style={styles.warnText}>{strings.manageShiftsObserverOrgPlannerHint}</Text> : null}
          {planSchemaMissing ? <Text style={styles.warnText}>{strings.manageShiftsPlanSchemaMissing}</Text> : null}
          {profileSchemaMissing ? <Text style={styles.warnText}>{strings.manageShiftsProfileSchemaMissing}</Text> : null}

          <View style={styles.sectionCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>{strings.manageShiftsWorkweekTitle}</Text>
              <Text style={styles.badgeText}>
                {canManage
                  ? draftPlan?.status === "published" || publishedPlan
                    ? strings.manageShiftsWeekBadgePublished
                    : strings.manageShiftsWeekBadgeDraft
                  : hasPersonalPublishedSchedule
                    ? strings.manageShiftsWeekBadgePublished
                    : strings.manageShiftsWeekBadgeNoShift}
              </Text>
            </View>
            <View style={styles.weekNavRow}>
              <Pressable style={styles.iconRound} onPress={() => handleWeekChange(-7)}>
                <Feather name="chevron-left" size={18} color={c.text} />
              </Pressable>
              <View style={styles.weekLabelPill}>
                <Text style={styles.weekLabel}>{getWeekLabel(weekStart, locale)}</Text>
              </View>
              <Pressable style={styles.iconRound} onPress={() => handleWeekChange(7)}>
                <Feather name="chevron-right" size={18} color={c.text} />
              </Pressable>
            </View>
            <View style={styles.actionsRow}>
              {canManage ? (
                <>
                  <Pressable style={[styles.primaryButton, saving ? styles.buttonDisabled : null]} onPress={() => void handleAutoSchedule()} disabled={saving}>
                    <Feather name="shuffle" size={16} color={c.white} />
                    <Text style={styles.primaryButtonText}>{strings.manageShiftsAutoScheduleButton}</Text>
                  </Pressable>
                  <Pressable style={[styles.secondaryButton, saving ? styles.buttonDisabled : null]} onPress={() => void handlePublish()} disabled={saving || !draftResult}>
                    <Feather name="upload" size={16} color={c.text} />
                    <Text style={styles.secondaryButtonText}>{strings.manageShiftsPublishButton}</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable style={[styles.primaryButton, saving ? styles.buttonDisabled : null]} onPress={() => void handleCheckIn()} disabled={saving || !!activePersonalEntry}>
                    <Feather name="play" size={16} color={c.white} />
                    <Text style={styles.primaryButtonText}>{strings.manageShiftsCheckInButton}</Text>
                  </Pressable>
                  <Pressable style={[styles.secondaryButton, saving ? styles.buttonDisabled : null]} onPress={() => void handleCheckOut()} disabled={saving || !activePersonalEntry}>
                    <Feather name="stop-circle" size={16} color={c.text} />
                    <Text style={styles.secondaryButtonText}>{strings.manageShiftsCheckOutButton}</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{totalAssigned}</Text>
              <Text style={styles.metricLabel}>{strings.manageShiftsMetricAssigned}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{totalRequired}</Text>
              <Text style={styles.metricLabel}>{strings.manageShiftsMetricDemand}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: totalConflicts ? c.danger : c.success }]}>{totalConflicts}</Text>
              <Text style={styles.metricLabel}>{strings.manageShiftsMetricConflicts}</Text>
            </View>
          </View>

          <View style={styles.dayTabsWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabsRow}>
              {weekDates.map((dateKey) => {
                const summary = draftResult?.daySummaries.find((item) => item.dateKey === dateKey);
                const active = currentSelectedDateKey === dateKey;
                const personalAssignment = !canManage
                  ? (() => {
                      const slot = getEffectiveShiftSlotsForDate(personalEffectiveSlots, user?.id ?? "", dateKey)[0] ?? null;
                      return slot ? createAssignmentFromEffectiveSlot(slot) : null;
                    })()
                  : null;
                return (
                  <Pressable key={dateKey} style={[styles.dayChip, active ? styles.dayChipActive : null]} onPress={() => handleSelectedDateChange(dateKey)}>
                    <Text style={[styles.dayChipText, active ? styles.dayChipTextActive : null]}>{formatDayChip(dateKey, locale)}</Text>
                    <Text style={[styles.dayChipSub, active ? styles.dayChipTextActive : null]}>
                      {canManage ? `${summary?.scheduledCount ?? 0}/${summary?.requiredCount ?? 0}` : personalAssignment?.shortCode ?? "--"}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {canManage ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{strings.manageShiftsPlannerTitle}</Text>
              <Text style={styles.sectionSubtitle}>{strings.manageShiftsPlannerSubtitle}</Text>
              <View style={styles.daySummaryCard}>
                <View style={styles.daySummaryMetric}>
                  <Text style={styles.daySummaryValue}>{selectedDaySummary?.scheduledCount ?? 0}</Text>
                  <Text style={styles.daySummaryLabel}>{strings.manageShiftsDaySummaryAssigned}</Text>
                </View>
                <View style={styles.daySummaryMetric}>
                  <Text style={styles.daySummaryValue}>{selectedDaySummary?.requiredCount ?? 0}</Text>
                  <Text style={styles.daySummaryLabel}>{strings.manageShiftsDaySummaryNeeded}</Text>
                </View>
                <View style={styles.daySummaryMetric}>
                  <Text
                    style={[
                      styles.daySummaryValue,
                      { color: (selectedDaySummary?.shortageCount ?? 0) > 0 ? c.danger : c.success },
                    ]}
                  >
                    {selectedDaySummary?.shortageCount ?? 0}
                  </Text>
                  <Text style={styles.daySummaryLabel}>{strings.manageShiftsDaySummaryShortage}</Text>
                </View>
              </View>
              <View style={styles.legendRow}>
                {(["MORNING", "AFTERNOON", "FULL_DAY", "OFF"] as ShiftType[]).map((shiftType) => {
                  const definition = getShiftDefinition(shiftType);
                  const colors = getShiftColors(definition);
                  return (
                    <View key={shiftType} style={[styles.legendChip, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                      <Text style={[styles.legendChipCode, { color: colors.text }]}>{definition.shortCode}</Text>
                      <Text style={[styles.legendChipText, { color: colors.text }]}>{localizeShiftLabel(shiftType, definition.label)}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.cardStack}>
                {selectedDayAssignments.map(({ employee, assignment }) => {
                  const colors = getShiftColors(getShiftDefinition(assignment.shiftType));
                  const employeeInfo = getTeamMemberInfo(employee.id, employee.name);
                  return (
                    <Pressable
                      key={employee.id}
                      style={[styles.personCard, { backgroundColor: colors.bg, borderColor: colors.border }]}
                      onPress={() => setSelectedCell({ employeeId: employee.id, dateKey: currentSelectedDateKey })}
                    >
                      <View style={styles.personAvatar}>
                        <Text style={styles.personAvatarText}>{initials(employee.name)}</Text>
                      </View>
                      <View style={styles.personCopy}>
                        <Text style={styles.personName}>{employeeInfo.name}</Text>
                        {employeeInfo.email ? <Text style={styles.personContact}>{employeeInfo.email}</Text> : null}
                        <Text style={styles.personMeta}>{getRoleLabel(employee.role)}</Text>
                        <View style={styles.personShiftMetaRow}>
                          <Text style={[styles.personShiftLabel, { color: colors.text }]}>{localizeShiftLabel(assignment.shiftType, assignment.shiftLabel)}</Text>
                          <Text style={styles.personShiftHours}>
                            {assignment.startTime && assignment.endTime ? `${assignment.startTime} - ${assignment.endTime}` : strings.manageShiftsOffLabel}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.shiftBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                        <Text style={[styles.shiftBadgeText, { color: colors.text }]}>{assignment.shortCode}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {canManage ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{strings.manageShiftsPendingSwapTitle}</Text>
              {pendingOwnerShiftChanges.length ? (
                <View style={styles.cardStack}>
                  {pendingOwnerShiftChanges.map((request) => (
                    <View key={request.id} style={styles.reviewCard}>
                      {(() => {
                        const requesterInfo = getTeamMemberInfo(request.requester_user_id);
                        return (
                          <>
                            <Text style={styles.reviewTitle}>{requesterInfo.name}</Text>
                            {requesterInfo.email ? <Text style={styles.reviewMeta}>{requesterInfo.email}</Text> : null}
                          </>
                        );
                      })()}
                      <Text style={styles.reviewMeta}>
                        {request.request_kind === "SWAP" ? strings.manageShiftsSwapRequestLabel : strings.manageShiftsPickupRequestLabel} • {request.target_slot_json.dateKey} • {localizeAdminLiteral(strings, request.target_slot_json.shiftLabel)}
                      </Text>
                      <Text style={styles.reviewMeta}>
                        {strings.manageShiftsCurrentHolderPrefix} {getTeamMemberInfo(request.target_slot_json.holderUserId, request.target_slot_json.holderName).name}
                      </Text>
                      <View style={styles.actionsRow}>
                        <Pressable style={styles.approveButton} onPress={() => void handleApproveShiftChange(request.id, true)} disabled={saving}>
                          <Text style={styles.approveText}>{strings.manageShiftsApproveButton}</Text>
                        </Pressable>
                        <Pressable style={styles.rejectButton} onPress={() => void handleApproveShiftChange(request.id, false)} disabled={saving}>
                          <Text style={styles.rejectText}>{strings.manageShiftsRejectButton}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>{strings.manageShiftsPendingSwapEmpty}</Text>
              )}
            </View>
          ) : null}

          {!canManage ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{strings.manageShiftsMyWeekTitle}</Text>
              <Text style={styles.sectionSubtitle}>
                {selectedPersonalAssignment
                  ? strings.manageShiftsMyWeekAssignedTemplate
                    .replace("{date}", formatDayChip(selectedDateKey, locale))
                    .replace("{shift}", localizeShiftLabel(selectedPersonalAssignment.shiftType, selectedPersonalAssignment.shiftLabel).toLowerCase())
                  : strings.manageShiftsPersonalScheduleHint}
              </Text>
              <View style={styles.cardStack}>
                {personalWeekAssignments.map(({ dateKey, assignments }) => {
                  const assignment = assignments[0] ?? null;
                  const published = Boolean(assignment);
                  const definition = getShiftDefinition(assignment?.shiftType ?? "OFF");
                  const colors = getShiftColors(definition);
                  const active = currentSelectedDateKey === dateKey;
                  return (
                    <Pressable
                      key={dateKey}
                      style={[
                        styles.personalShiftDayCard,
                        {
                          borderColor: active ? c.primary : colors.border,
                          backgroundColor: assignment ? colors.bg : c.soft,
                        },
                      ]}
                      onPress={() => handleSelectedDateChange(dateKey)}
                    >
                      <View style={styles.rowBetween}>
                        <View style={styles.personalShiftDayCopy}>
                          <Text style={styles.personalShiftDayTitle}>{formatDayChip(dateKey, locale)}</Text>
                          <Text style={styles.personalShiftDayMeta}>
                            {assignment
                              ? `${localizeShiftLabel(assignment.shiftType, assignment.shiftLabel)} • ${assignment.startTime} - ${assignment.endTime}`
                              : strings.manageShiftsNoPublishedShift}
                          </Text>
                        </View>
                        <View style={[styles.todayShiftBadge, { borderColor: assignment ? colors.border : c.border }]}>
                          <Text style={[styles.todayShiftBadgeText, { color: assignment ? colors.text : c.sub }]}>
                            {assignment?.shortCode ?? "--"}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.personalShiftMetaRow}>
                        <Text style={styles.personalShiftStatus}>
                          {published ? strings.manageShiftsWorkingLabel : assignment ? strings.manageShiftsTodayStatusWaitingPublish : strings.manageShiftsOffLabel}
                        </Text>
                        {assignment ? <Text style={styles.personalShiftHours}>{assignment.startTime} - {assignment.endTime}</Text> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {canManage ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{strings.manageShiftsExceptionAttendanceTitle}</Text>
              {pendingOwnerEntries.length ? (
                <View style={styles.cardStack}>
                  {pendingOwnerEntries.map((entry) => (
                    <View key={entry.id} style={styles.reviewCard}>
                      {(() => {
                        const staffInfo = getTeamMemberInfo(entry.staff_user_id);
                        return (
                          <>
                            <Text style={styles.reviewTitle}>{staffInfo.name}</Text>
                            {staffInfo.email ? <Text style={styles.reviewMeta}>{staffInfo.email}</Text> : null}
                          </>
                        );
                      })()}
                      <Text style={styles.reviewMeta}>
                        {strings.manageShiftsCheckInPrefix} {formatTime(entry.clock_in, locale)} • {strings.manageShiftsExpectedTimePrefix} {formatTime(entry.scheduled_start, locale)} - {formatTime(entry.scheduled_end, locale)}
                      </Text>
                      <View style={styles.actionsRow}>
                        <Pressable style={styles.approveButton} onPress={() => void handleApproveEntry(entry.id, true, 1)} disabled={saving}>
                          <Text style={styles.approveText}>1.0</Text>
                        </Pressable>
                        <Pressable style={styles.approveButton} onPress={() => void handleApproveEntry(entry.id, true, 0.75)} disabled={saving}>
                          <Text style={styles.approveText}>0.75</Text>
                        </Pressable>
                        <Pressable style={styles.approveButton} onPress={() => void handleApproveEntry(entry.id, true, 0.5)} disabled={saving}>
                          <Text style={styles.approveText}>0.5</Text>
                        </Pressable>
                        <Pressable style={styles.rejectButton} onPress={() => void handleApproveEntry(entry.id, false)} disabled={saving}>
                          <Text style={styles.rejectText}>{strings.manageShiftsRejectButton}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>{strings.manageShiftsExceptionAttendanceEmpty}</Text>
              )}
            </View>
          ) : null}

          {canManage ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{strings.manageShiftsPendingLeaveTitle}</Text>
              {pendingOwnerLeaves.length ? (
                <View style={styles.cardStack}>
                  {pendingOwnerLeaves.map((request) => (
                    <View key={request.id} style={styles.reviewCard}>
                      {(() => {
                        const staffInfo = getTeamMemberInfo(request.staff_user_id);
                        return (
                          <>
                            <Text style={styles.reviewTitle}>{staffInfo.name}</Text>
                            {staffInfo.email ? <Text style={styles.reviewMeta}>{staffInfo.email}</Text> : null}
                          </>
                        );
                      })()}
                      <Text style={styles.reviewMeta}>
                        {request.request_type === "DAY_OFF" ? strings.manageShiftsLeaveRequestLabel : strings.manageShiftsEarlyLeaveRequestLabel} • {request.scheduled_date ?? strings.manageShiftsUnknownDate}
                      </Text>
                      {request.note ? <Text style={styles.reviewMeta}>{request.note}</Text> : null}
                      <View style={styles.actionsRow}>
                        {request.request_type === "EARLY_LEAVE" ? (
                          <>
                            <Pressable style={styles.approveButton} onPress={() => void handleApproveLeave(request.id, true, 1)} disabled={saving}>
                              <Text style={styles.approveText}>1.0</Text>
                            </Pressable>
                            <Pressable style={styles.approveButton} onPress={() => void handleApproveLeave(request.id, true, 0.75)} disabled={saving}>
                              <Text style={styles.approveText}>0.75</Text>
                            </Pressable>
                            <Pressable style={styles.approveButton} onPress={() => void handleApproveLeave(request.id, true, 0.5)} disabled={saving}>
                              <Text style={styles.approveText}>0.5</Text>
                            </Pressable>
                          </>
                        ) : (
                          <Pressable style={styles.approveButton} onPress={() => void handleApproveLeave(request.id, true)} disabled={saving}>
                            <Text style={styles.approveText}>{strings.manageShiftsApproveButton}</Text>
                          </Pressable>
                        )}
                        <Pressable style={styles.rejectButton} onPress={() => void handleApproveLeave(request.id, false)} disabled={saving}>
                          <Text style={styles.rejectText}>{strings.manageShiftsRejectButton}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>{strings.manageShiftsPendingLeaveEmpty}</Text>
              )}
            </View>
          ) : null}

          {shouldShowManagerPersonalCard ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{strings.manageShiftsMyShiftsAndAttendanceTitle}</Text>
              <Text style={styles.sectionSubtitle}>
                {strings.manageShiftsMyShiftsAndAttendanceSubtitle}
              </Text>
              {personalEffectiveSlots.length ? (
                <View style={styles.cardStack}>
                  {personalWeekAssignments
                    .filter((entry) => entry.assignments.length > 0)
                    .map(({ dateKey, assignments }) => {
                      const assignment = assignments[0];
                      const colors = getShiftColors(getShiftDefinition(assignment.shiftType));
                      return (
                        <View
                          key={`manager-personal-slot-${dateKey}-${assignment.shiftType}`}
                          style={[styles.personCard, { backgroundColor: colors.bg, borderColor: colors.border }]}
                        >
                          <View style={styles.personCopy}>
                            <Text style={styles.personName}>{formatDayChip(dateKey, locale)}</Text>
                            <Text style={styles.personShiftHours}>
                              {localizeShiftLabel(assignment.shiftType, assignment.shiftLabel)} • {assignment.startTime} - {assignment.endTime}
                            </Text>
                          </View>
                          <View style={[styles.shiftBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                            <Text style={[styles.shiftBadgeText, { color: colors.text }]}>{assignment.shortCode}</Text>
                          </View>
                        </View>
                      );
                    })}
                </View>
              ) : null}
              {personalEntriesForCurrentWeek.length ? (
                <View style={styles.cardStack}>
                  {personalEntriesForCurrentWeek.map((entry) => (
                    <View key={`manager-personal-entry-${entry.id}`} style={styles.reviewCard}>
                      <Text style={styles.reviewTitle}>{localizeSavedShiftLabel(entry.scheduled_shift_type, entry.scheduled_shift_label)}</Text>
                      <Text style={styles.reviewMeta}>{strings.manageShiftsActualTimePrefix} {formatTime(entry.clock_in, locale)} - {formatTime(entry.clock_out, locale)}</Text>
                      <Text style={styles.reviewMeta}>
                        {strings.manageShiftsAttendanceTimePrefix} {formatTime(entry.effective_clock_in ?? entry.clock_in, locale)} - {formatTime(entry.effective_clock_out ?? entry.clock_out, locale)}
                      </Text>
                      <Text style={styles.reviewMeta}>{strings.manageShiftsAttendanceDayPrefix} {formatAttendanceFraction(entry.attendance_fraction)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {!canManage ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{strings.manageShiftsTodayTitle}</Text>
              <Text style={styles.sectionSubtitle}>
                {todayPublishedAssignment
                  ? `${localizeShiftLabel(todayPublishedAssignment.shiftType, todayPublishedAssignment.shiftLabel)} • ${todayPublishedAssignment.startTime} - ${todayPublishedAssignment.endTime}`
                  : strings.manageShiftsTodayMessageNoSchedule}
              </Text>
              {visibleTodayAssignment ? (
                <View
                  style={[
                    styles.todayShiftCard,
                    {
                      backgroundColor: todayShiftColors.bg,
                      borderColor: todayShiftColors.border,
                    },
                  ]}
                >
                  <View style={styles.rowBetween}>
                    <View style={styles.todayShiftHeaderCopy}>
                      <Text style={[styles.todayShiftTitle, { color: todayShiftColors.text }]}>
                        {localizeShiftLabel(visibleTodayAssignment.shiftType, visibleTodayAssignment.shiftLabel)}
                      </Text>
                      <Text style={styles.todayShiftHours}>
                        {visibleTodayAssignment.startTime && visibleTodayAssignment.endTime
                          ? `${visibleTodayAssignment.startTime} - ${visibleTodayAssignment.endTime}`
                          : strings.manageShiftsRestingLabel}
                      </Text>
                    </View>
                    <View style={[styles.todayShiftBadge, { borderColor: todayShiftColors.border }]}>
                      <Text style={[styles.todayShiftBadgeText, { color: todayShiftColors.text }]}>
                        {visibleTodayAssignment.shortCode}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.todayShiftMetaGrid}>
                    <View style={styles.todayShiftMetaItem}>
                      <Text style={styles.todayShiftMetaLabel}>{strings.manageShiftsTodayShiftTypeLabel}</Text>
                      <Text style={styles.todayShiftMetaValue}>{localizeShiftLabel(visibleTodayAssignment.shiftType, visibleTodayAssignment.shiftLabel)}</Text>
                    </View>
                    <View style={styles.todayShiftMetaItem}>
                      <Text style={styles.todayShiftMetaLabel}>{strings.manageShiftsTodayStatusLabel}</Text>
                      <Text
                        style={[
                          styles.todayShiftMetaValue,
                          todayPublishedAssignment ? styles.todayShiftMetaValueSuccess : styles.todayShiftMetaValueWarn,
                        ]}
                      >
                        {todayShiftStatus}
                      </Text>
                    </View>
                    <View style={styles.todayShiftMetaItem}>
                      <Text style={styles.todayShiftMetaLabel}>{strings.manageShiftsTodayHoursLabel}</Text>
                      <Text style={styles.todayShiftMetaValue}>
                        {visibleTodayAssignment.startTime && visibleTodayAssignment.endTime
                          ? `${visibleTodayAssignment.startTime} - ${visibleTodayAssignment.endTime}`
                          : "--:--"}
                      </Text>
                    </View>
                    <View style={styles.todayShiftMetaItem}>
                      <Text style={styles.todayShiftMetaLabel}>{strings.manageShiftsTodayAttendanceLabel}</Text>
                      <Text style={styles.todayShiftMetaValue}>
                        {visibleTodayAssignment.startTime && visibleTodayAssignment.endTime
                          ? `${visibleTodayAssignment.startTime} - ${visibleTodayAssignment.endTime}`
                          : "--:--"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.todayShiftHint}>{todayShiftMessage}</Text>
                  {todayEffectiveSlots.length > 1 ? (
                    <View style={{ gap: 8 }}>
                      <Text style={styles.reviewMeta}>{strings.manageShiftsTodayPickCorrectShift}</Text>
                      <View style={styles.cardStack}>
                        {todayEffectiveSlots.map((slot) => {
                          const active = `${slot.dateKey}:${slot.shiftType}` === selectedTodaySlotKey;
                          const colors = getShiftColors(getShiftDefinition(slot.shiftType));
                          return (
                            <Pressable
                              key={`${slot.dateKey}:${slot.shiftType}`}
                              style={[
                                styles.personCard,
                                { backgroundColor: colors.bg, borderColor: active ? c.primary : colors.border },
                              ]}
                              onPress={() => setSelectedTodaySlotKey(`${slot.dateKey}:${slot.shiftType}`)}
                            >
                              <View style={styles.personCopy}>
                                <Text style={styles.personName}>{localizeShiftLabel(slot.shiftType, slot.shiftLabel)}</Text>
                                <Text style={styles.personShiftHours}>{slot.startTime} - {slot.endTime}</Text>
                              </View>
                              <View style={[styles.shiftBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                                <Text style={[styles.shiftBadgeText, { color: colors.text }]}>{slot.shiftType}</Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}
              {todayPublishedAssignment ? (
                <View style={styles.actionsRow}>
                  <Pressable style={[styles.primaryButton, saving ? styles.buttonDisabled : null]} onPress={() => void handleCheckIn()} disabled={saving || !!activePersonalEntry}>
                    <Text style={styles.primaryButtonText}>{strings.manageShiftsCheckInButton}</Text>
                  </Pressable>
                  <Pressable style={[styles.secondaryButton, saving ? styles.buttonDisabled : null]} onPress={() => void handleRequestDayOff()} disabled={saving}>
                    <Text style={styles.secondaryButtonText}>{strings.manageShiftsRequestTimeOffButton}</Text>
                  </Pressable>
                </View>
              ) : null}
              <View style={styles.reviewCard}>
                <Text style={styles.reviewTitle}>{strings.manageShiftsRequestSwapTitle}</Text>
                <Text style={styles.reviewMeta}>
                  {strings.manageShiftsRequestSwapHint}
                </Text>
                <View style={styles.actionsRow}>
                  <Pressable
                    style={shiftRequestKind === "PICKUP" ? styles.approveButton : styles.secondaryButton}
                    onPress={() => setShiftRequestKind("PICKUP")}
                  >
                    <Text style={shiftRequestKind === "PICKUP" ? styles.approveText : styles.secondaryButtonText}>{strings.manageShiftsPickupRequestLabel}</Text>
                  </Pressable>
                  <Pressable
                    style={shiftRequestKind === "SWAP" ? styles.approveButton : styles.secondaryButton}
                    onPress={() => setShiftRequestKind("SWAP")}
                  >
                    <Text style={shiftRequestKind === "SWAP" ? styles.approveText : styles.secondaryButtonText}>{strings.manageShiftsSwapRequestLabel}</Text>
                  </Pressable>
                </View>
                {shiftRequestKind === "SWAP" ? (
                  <View style={styles.cardStack}>
                    {ownRequestSourceSlots.map((slot) => {
                      const active = `${slot.dateKey}:${slot.shiftType}:${slot.holderUserId}` === selectedRequestSourceKey;
                      const holderInfo = getTeamMemberInfo(slot.holderUserId, slot.holderName);
                      return (
                        <Pressable
                          key={`${slot.dateKey}:${slot.shiftType}:${slot.holderUserId}`}
                          style={[styles.personCard, active ? { borderColor: c.primary } : null]}
                          onPress={() => setSelectedRequestSourceKey(`${slot.dateKey}:${slot.shiftType}:${slot.holderUserId}`)}
                        >
                          <View style={styles.personCopy}>
                            <Text style={styles.personName}>{strings.manageShiftsSourceShiftPrefix} {localizeShiftLabel(slot.shiftType, slot.shiftLabel)}</Text>
                            <Text style={styles.personMeta}>{holderInfo.name}</Text>
                            {holderInfo.email ? <Text style={styles.personContact}>{holderInfo.email}</Text> : null}
                            <Text style={styles.personShiftHours}>{slot.dateKey} • {slot.startTime} - {slot.endTime}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
                <View style={styles.cardStack}>
                  {requestableTargetSlots.slice(0, 6).map((slot) => {
                    const active = `${slot.dateKey}:${slot.shiftType}:${slot.holderUserId}` === selectedRequestTargetKey;
                    const holderInfo = getTeamMemberInfo(slot.holderUserId, slot.holderName);
                    return (
                      <Pressable
                        key={`${slot.dateKey}:${slot.shiftType}:${slot.holderUserId}`}
                        style={[styles.personCard, active ? { borderColor: c.primary } : null]}
                        onPress={() => setSelectedRequestTargetKey(`${slot.dateKey}:${slot.shiftType}:${slot.holderUserId}`)}
                      >
                        <View style={styles.personCopy}>
                          <Text style={styles.personName}>{localizeShiftLabel(slot.shiftType, slot.shiftLabel)}</Text>
                          <Text style={styles.personMeta}>{holderInfo.name}</Text>
                          {holderInfo.email ? <Text style={styles.personContact}>{holderInfo.email}</Text> : null}
                          <Text style={styles.personShiftHours}>{slot.dateKey} • {slot.startTime} - {slot.endTime}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable
                  style={[styles.primaryButton, saving ? styles.buttonDisabled : null]}
                  onPress={() => void handleSubmitShiftChange()}
                  disabled={saving || !selectedRequestTargetKey || (shiftRequestKind === "SWAP" && !selectedRequestSourceKey)}
                >
                  <Text style={styles.primaryButtonText}>{strings.manageShiftsSubmitRequestButton}</Text>
                </Pressable>
              </View>
              <View style={styles.cardStack}>
                {personalEntries.length ? (
                  personalEntries.map((entry) => (
                    <View key={entry.id} style={styles.reviewCard}>
                      <Text style={styles.reviewTitle}>{localizeSavedShiftLabel(entry.scheduled_shift_type, entry.scheduled_shift_label)}</Text>
                      <Text style={styles.reviewMeta}>{strings.manageShiftsActualTimePrefix} {formatTime(entry.clock_in, locale)} - {formatTime(entry.clock_out, locale)}</Text>
                      <Text style={styles.reviewMeta}>{strings.manageShiftsAttendanceTimePrefix} {formatTime(entry.effective_clock_in ?? entry.clock_in, locale)} - {formatTime(entry.effective_clock_out ?? entry.clock_out, locale)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>{strings.manageShiftsNoAttendanceHistory}</Text>
                )}
              </View>
            </View>
          ) : null}
        

        <Modal visible={!!currentSelectedCell && !!selectedEmployee && !!selectedAssignment} transparent animationType="slide" onRequestClose={() => setSelectedCell(null)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedCell(null)}>
            <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.sectionTitle}>{selectedEmployee ? getTeamMemberInfo(selectedEmployee.id, selectedEmployee.name).name : ""}</Text>
                  {selectedEmployee && getTeamMemberInfo(selectedEmployee.id, selectedEmployee.name).email ? (
                    <Text style={styles.sectionSubtitle}>{getTeamMemberInfo(selectedEmployee.id, selectedEmployee.name).email}</Text>
                  ) : null}
                  <Text style={styles.sectionSubtitle}>{selectedAssignment ? formatDayChip(selectedAssignment.dateKey, locale) : ""}</Text>
                </View>
                <Pressable style={styles.iconRound} onPress={() => setSelectedCell(null)}>
                  <Feather name="x" size={18} color={c.text} />
                </Pressable>
              </View>
              <View style={styles.optionsGrid}>
                {manualOptions.map((option) => {
                  const colors = getShiftColors(option);
                  const active = selectedAssignment?.shiftType === option.type;
                  return (
                    <Pressable
                      key={option.type}
                      style={[
                        styles.optionCard,
                        { backgroundColor: colors.bg, borderColor: active ? c.primary : colors.border },
                      ]}
                      onPress={() => void handleManualChange(option.type)}
                    >
                      <Text style={[styles.optionTitle, { color: colors.text }]}>{localizeShiftLabel(option.type, option.label)}</Text>
                      <Text style={[styles.optionSub, { color: colors.text }]}>
                        {option.startTime && option.endTime ? `${option.startTime} - ${option.endTime}` : strings.manageShiftsNoAssignmentLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {canManage ? (
                <View style={styles.cardStack}>
                  <Text style={styles.reviewTitle}>{strings.manageShiftsImmediateOverrideTitle}</Text>
                  {selectedEffectiveAssignments.length ? (
                    selectedEffectiveAssignments.map((assignment, index) => (
                      <View key={`${assignment.dateKey}:${assignment.shiftType}:${index}`} style={styles.reviewCard}>
                        <Text style={styles.reviewTitle}>{localizeShiftLabel(assignment.shiftType, assignment.shiftLabel)}</Text>
                        <Text style={styles.reviewMeta}>{assignment.startTime} - {assignment.endTime}</Text>
                        {selectedManualOverrides[index]?.overrideId ? (
                          <Pressable
                            style={styles.secondaryButton}
                            onPress={() => void handleRemoveEffectiveOverride(selectedManualOverrides[index].overrideId as string)}
                          >
                            <Text style={styles.secondaryButtonText}>{strings.manageShiftsRemoveOverrideButton}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>{strings.manageShiftsNoEffectiveAssignmentsForDate}</Text>
                  )}
                  <View style={styles.optionsGrid}>
                    {DEFAULT_SHIFT_DEFINITIONS.filter((item) => item.type !== "OFF").map((option) => {
                      const colors = getShiftColors(option);
                      return (
                        <Pressable
                          key={`effective-${option.type}`}
                          style={[styles.optionCard, { backgroundColor: colors.bg, borderColor: colors.border }]}
                          onPress={() => void handleCreateEffectiveOverride(option.type)}
                        >
                          <Text style={[styles.optionTitle, { color: colors.text }]}>{localizeShiftLabel(option.type, option.label)}</Text>
                          <Text style={[styles.optionSub, { color: colors.text }]}>{option.startTime} - {option.endTime}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
              {selectedProfile && !profileSchemaMissing ? (
                <Pressable style={styles.leaveToggle} onPress={() => void handleToggleLeave()}>
                  <Feather name="calendar" size={16} color={c.text} />
                  <Text style={styles.leaveToggleText}>
                    {selectedProfile.leaveDateKeys.includes(selectedAssignment?.dateKey ?? "")
                      ? strings.manageShiftsToggleLeaveOff
                      : strings.manageShiftsToggleLeaveOn}
                  </Text>
                </Pressable>
              ) : null}
            </Pressable>
          </Pressable>
        </Modal>

    </ManageScreenShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: c.sub, fontSize: 14, lineHeight: 20 },
  topChrome: { paddingHorizontal: 18, paddingBottom: 12 },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: ADMIN_CONTENT_BOTTOM_NAV_CLEARANCE, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  hiddenHeader: { display: "none" },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.primarySoft, alignItems: "center", justifyContent: "center" },
  avatarText: { color: c.primary, fontSize: 18, lineHeight: 22, fontWeight: "800" },
  headerCopy: { flex: 1, gap: 2 },
  title: { color: c.text, fontSize: 26, lineHeight: 30, fontWeight: "800" },
  subtitle: { color: c.sub, fontSize: 13, lineHeight: 18 },
  errorText: { color: c.danger, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  warnText: { color: c.warn, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  sectionCard: { backgroundColor: c.white, borderRadius: 22, padding: 14, gap: 12, borderWidth: 1, borderColor: c.border },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sectionTitle: { color: c.text, fontSize: 18, lineHeight: 22, fontWeight: "800" },
  sectionSubtitle: { color: c.sub, fontSize: 13, lineHeight: 18 },
  badgeText: { color: c.primary, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  weekNavRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconRound: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", backgroundColor: c.white },
  weekLabelPill: { flex: 1, minHeight: 38, borderRadius: 19, backgroundColor: c.soft, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  weekLabel: { color: c.text, fontSize: 14, lineHeight: 18, fontWeight: "700" },
  actionsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  primaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 42, borderRadius: 21, backgroundColor: c.primary, paddingHorizontal: 16, flex: 1 },
  primaryButtonText: { color: c.white, fontSize: 14, lineHeight: 18, fontWeight: "700" },
  secondaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 42, borderRadius: 21, backgroundColor: c.soft, paddingHorizontal: 16, flex: 1 },
  secondaryButtonText: { color: c.text, fontSize: 14, lineHeight: 18, fontWeight: "700" },
  buttonDisabled: { opacity: 0.6 },
  metricsRow: { flexDirection: "row", gap: 10 },
  metricCard: { flex: 1, backgroundColor: c.white, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 10, borderWidth: 1, borderColor: c.border, alignItems: "center", gap: 4 },
  metricValue: { color: c.text, fontSize: 20, lineHeight: 24, fontWeight: "800" },
  metricLabel: { color: c.sub, fontSize: 12, lineHeight: 16, textAlign: "center" },
  dayTabsWrap: { marginHorizontal: -18 },
  dayTabsRow: { paddingHorizontal: 18, gap: 10 },
  dayChip: { minWidth: 104, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.white, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  dayChipActive: { backgroundColor: c.primary, borderColor: c.primary },
  dayChipText: { color: c.text, fontSize: 13, lineHeight: 16, fontWeight: "700" },
  dayChipTextActive: { color: c.white },
  dayChipSub: { color: c.sub, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  daySummaryCard: { flexDirection: "row", gap: 10, borderRadius: 18, backgroundColor: c.soft, borderWidth: 1, borderColor: c.border, padding: 12 },
  daySummaryMetric: { flex: 1, alignItems: "center", gap: 4 },
  daySummaryValue: { color: c.text, fontSize: 18, lineHeight: 22, fontWeight: "800" },
  daySummaryLabel: { color: c.sub, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  legendChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  legendChipCode: { fontSize: 11, lineHeight: 14, fontWeight: "800" },
  legendChipText: { fontSize: 12, lineHeight: 16, fontWeight: "700" },
  cardStack: { gap: 10 },
  personCard: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 18, borderWidth: 1, padding: 12 },
  personAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.softStrong, alignItems: "center", justifyContent: "center" },
  personAvatarText: { color: c.text, fontSize: 13, lineHeight: 16, fontWeight: "800" },
  personCopy: { flex: 1, gap: 3 },
  personName: { color: c.text, fontSize: 14, lineHeight: 18, fontWeight: "700" },
  personMeta: { color: c.sub, fontSize: 12, lineHeight: 16 },
  personContact: { color: c.sub, fontSize: 11, lineHeight: 15 },
  personShiftMetaRow: { gap: 2, marginTop: 2 },
  personShiftLabel: { fontSize: 13, lineHeight: 16, fontWeight: "800" },
  personShiftHours: { color: c.sub, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  shiftBadge: { minWidth: 50, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, paddingVertical: 8 },
  shiftBadgeText: { fontSize: 12, lineHeight: 16, fontWeight: "800" },
  todayShiftCard: { borderRadius: 18, borderWidth: 1, padding: 12, gap: 12 },
  todayShiftHeaderCopy: { flex: 1, gap: 4 },
  todayShiftTitle: { fontSize: 16, lineHeight: 20, fontWeight: "800" },
  todayShiftHours: { color: c.sub, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  todayShiftBadge: {
    minWidth: 56,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  todayShiftBadgeText: { fontSize: 12, lineHeight: 16, fontWeight: "800" },
  todayShiftMetaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  todayShiftMetaItem: {
    width: "47.8%",
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.72)",
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 3,
  },
  todayShiftMetaLabel: { color: c.sub, fontSize: 11, lineHeight: 14, fontWeight: "700", textTransform: "uppercase" },
  todayShiftMetaValue: { color: c.text, fontSize: 13, lineHeight: 17, fontWeight: "800" },
  todayShiftMetaValueSuccess: { color: c.success },
  todayShiftMetaValueWarn: { color: c.warn },
  todayShiftHint: { color: c.sub, fontSize: 12, lineHeight: 17 },
  personalShiftDayCard: { borderRadius: 18, borderWidth: 1, padding: 12, gap: 8 },
  personalShiftDayCopy: { flex: 1, gap: 3 },
  personalShiftDayTitle: { color: c.text, fontSize: 14, lineHeight: 18, fontWeight: "800" },
  personalShiftDayMeta: { color: c.sub, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  personalShiftMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  personalShiftStatus: { color: c.primary, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  personalShiftHours: { color: c.sub, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  reviewCard: { borderRadius: 18, backgroundColor: c.soft, borderWidth: 1, borderColor: c.border, padding: 12, gap: 8 },
  reviewTitle: { color: c.text, fontSize: 14, lineHeight: 18, fontWeight: "700" },
  reviewMeta: { color: c.sub, fontSize: 12, lineHeight: 16 },
  approveButton: { flex: 1, minHeight: 40, borderRadius: 20, backgroundColor: c.successSoft, alignItems: "center", justifyContent: "center" },
  rejectButton: { flex: 1, minHeight: 40, borderRadius: 20, backgroundColor: c.dangerSoft, alignItems: "center", justifyContent: "center" },
  approveText: { color: c.success, fontSize: 13, lineHeight: 16, fontWeight: "800" },
  rejectText: { color: c.danger, fontSize: 13, lineHeight: 16, fontWeight: "800" },
  emptyText: { color: c.sub, fontSize: 13, lineHeight: 18 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(17, 24, 39, 0.22)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: c.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 28, gap: 14 },
  optionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  optionCard: { width: "47.8%", borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12, gap: 4 },
  optionTitle: { fontSize: 14, lineHeight: 18, fontWeight: "700" },
  optionSub: { fontSize: 12, lineHeight: 16 },
  leaveToggle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, borderRadius: 22, backgroundColor: c.soft, borderWidth: 1, borderColor: c.border },
  leaveToggleText: { color: c.text, fontSize: 14, lineHeight: 18, fontWeight: "700" },
});
