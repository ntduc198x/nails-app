import Feather from "@expo/vector-icons/Feather";
import { Alert, Modal } from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AdminBottomNav, AdminHeaderActions, getAdminBottomBarPadding, getAdminHeaderTopPadding } from "@/src/features/admin/ui";
import { getAdminNavHref } from "@/src/features/admin/navigation";
import { useSession } from "@/src/providers/session-provider";
import { mobileSupabase } from "@/src/lib/supabase";
import {
  buildAutoScheduleResult,
  buildDefaultWeekDemands,
  DEFAULT_SHIFT_DEFINITIONS,
  generateDraftSchedule,
  generateWeekDates,
  getRecommendedShiftTypesForDate,
  getRoleLabel,
  listTeamMembersForMobile,
  type AutoScheduleAssignment,
  type AutoScheduleDemand,
  type AutoScheduleEmployee,
  type AutoScheduleResult,
  type ShiftDefinition,
  type ShiftType,
  type StaffRole,
  type TeamMemberRow,
} from "@nails/shared";
import {
  applyApprovedDayOffToAssignments,
  canManageShiftPlans,
  closeShiftEntryIfAllowed,
  createEmptyStaffShiftProfile,
  createShiftCheckIn,
  getTodayAssignmentFromPlan,
  isMissingShiftPlansSchema,
  isMissingStaffShiftProfilesSchema,
  listOwnerShiftEntries,
  listPersonalShiftEntries,
  listShiftLeaveRequests,
  loadShiftPlanWeek,
  loadStaffShiftProfiles,
  loadWeeklyShiftForecast,
  normalizeStaffShiftProfiles,
  reviewShiftCheckIn,
  reviewShiftLeaveRequest,
  saveShiftPlanWeek,
  saveStaffShiftProfile,
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

function getWeekLabel(weekStart: string) {
  const dates = generateWeekDates(weekStart);
  const start = new Date(`${dates[0]}T00:00:00`);
  const end = new Date(`${dates[6]}T00:00:00`);
  return `${start.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} - ${end.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`;
}

function formatDayChip(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatTime(value: string | null | undefined) {
  if (!value) return "--:--";
  return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
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

function getAssignmentForUserOnDate(plan: ShiftPlanRecord | null, userId: string | null | undefined, dateKey: string) {
  if (!plan || !userId) return null;
  return (
    plan.result.assignments.find(
      (assignment) => assignment.employeeId === userId && assignment.dateKey === dateKey && assignment.shiftType !== "OFF",
    ) ?? null
  );
}

function buildEmployeeList(rows: TeamMemberRow[], profiles: StaffShiftProfileRecord[]) {
  const profileMap = new Map(profiles.map((item) => [item.userId, item]));
  return rows
    .filter((row) => row.role !== "OWNER" && row.role !== "PARTNER" && row.role !== "USER")
    .map<AutoScheduleEmployee>((row, index) => {
      const role = row.role as StaffRole;
      const profile = profileMap.get(row.userId) ?? createEmptyStaffShiftProfile(row.userId, role);
      return {
        id: row.userId,
        name: row.displayName?.trim() || row.email?.split("@")[0] || `Nhân sự ${index + 1}`,
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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isHydrated, role, user } = useSession();
  const canManage = canManageShiftPlans(role);
  const todayKey = useMemo(() => toDateKey(new Date()), []);

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
  const [personalEntries, setPersonalEntries] = useState<ShiftTimeEntryRecord[]>([]);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);

  const employees = useMemo(() => buildEmployeeList(teamRows, profiles), [teamRows, profiles]);
  const assignmentMap = useMemo(
    () => new Map((draftResult?.assignments ?? []).map((assignment) => [`${assignment.employeeId}:${assignment.dateKey}`, assignment])),
    [draftResult],
  );
  const teamNameMap = useMemo(() => new Map(teamRows.map((row) => [row.userId, row.displayName])), [teamRows]);

  const loadData = useCallback(
    async (force = false) => {
      if (!mobileSupabase || !isHydrated || !user?.id) {
        setLoading(false);
        return;
      }

      try {
        if (force) setLoading(true);
        else setRefreshing(true);

        setError(null);
        setPlanSchemaMissing(false);
        setProfileSchemaMissing(false);

        const teamPromise = listTeamMembersForMobile(mobileSupabase);
        const profilesPromise = loadStaffShiftProfiles().catch((nextError) => {
          if (isMissingStaffShiftProfilesSchema(nextError)) {
            setProfileSchemaMissing(true);
            return [];
          }
          throw nextError;
        });
        const draftPromise = loadShiftPlanWeek(weekStart).catch((nextError) => {
          if (isMissingShiftPlansSchema(nextError)) {
            setPlanSchemaMissing(true);
            return null;
          }
          throw nextError;
        });
        const publishedPromise = loadShiftPlanWeek(weekStart, { publishedOnly: true }).catch((nextError) => {
          if (isMissingShiftPlansSchema(nextError)) {
            setPlanSchemaMissing(true);
            return null;
          }
          throw nextError;
        });
        const forecastPromise = loadWeeklyShiftForecast(weekStart).catch(() => {
          return generateWeekDates(weekStart).reduce<Record<string, number>>((acc, dateKey) => {
            acc[dateKey] = 0;
            return acc;
          }, {});
        });
        const ownerEntriesPromise = canManage ? listOwnerShiftEntries() : Promise.resolve([]);
        const ownerLeavesPromise = canManage ? listShiftLeaveRequests() : Promise.resolve([]);
        const personalEntriesPromise = listPersonalShiftEntries(user.id);
        const personalLeavesPromise = listShiftLeaveRequests({ userId: user.id });

        const [
          rows,
          profileRowsRaw,
          nextDraftPlan,
          nextPublishedPlan,
          forecast,
          nextOwnerEntries,
          nextOwnerLeaves,
          nextPersonalEntries,
          nextPersonalLeaves,
        ] = await Promise.all([
          teamPromise,
          profilesPromise,
          draftPromise,
          publishedPromise,
          forecastPromise,
          ownerEntriesPromise,
          ownerLeavesPromise,
          personalEntriesPromise,
          personalLeavesPromise,
        ]);

        const nextFallbackRoles = new Map(
          rows
            .filter((row) => row.role !== "OWNER" && row.role !== "PARTNER" && row.role !== "USER")
            .map((row) => [row.userId, row.role as StaffRole]),
        );
        const normalizedProfiles = normalizeStaffShiftProfiles(profileRowsRaw as never[], nextFallbackRoles);
        const nextEmployees = buildEmployeeList(rows, normalizedProfiles);
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

        setTeamRows(rows);
        setProfiles(normalizedProfiles);
        setDraftPlan(nextDraftPlan);
        setPublishedPlan(nextPublishedPlan);
        setDraftResult(nextDraftResult);
        setDemands(nextDemands);
        setForecast(forecast);
        setOwnerEntries(nextOwnerEntries as ShiftTimeEntryRecord[]);
        setOwnerLeaveRequests(nextOwnerLeaves as ShiftLeaveRequestRecord[]);
        setPersonalEntries(nextPersonalEntries);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Không tải được dữ liệu ca làm.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canManage, isHydrated, user?.id, weekStart],
  );

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  useEffect(() => {
    const dates = generateWeekDates(weekStart);
    if (!dates.includes(selectedDateKey)) {
      setSelectedDateKey(dates[0] ?? weekStart);
    }
    setSelectedCell(null);
  }, [selectedDateKey, weekStart]);

  const weekDates = useMemo(() => generateWeekDates(weekStart), [weekStart]);
  const pendingOwnerEntries = useMemo(
    () => ownerEntries.filter((item) => item.approval_status === "PENDING"),
    [ownerEntries],
  );
  const pendingOwnerLeaves = useMemo(
    () => ownerLeaveRequests.filter((item) => item.status === "PENDING"),
    [ownerLeaveRequests],
  );
  const todayPublishedAssignment = useMemo(
    () => getTodayAssignmentFromPlan(publishedPlan, user?.id ?? "", todayKey),
    [publishedPlan, todayKey, user?.id],
  );
  const todayDraftAssignment = useMemo(
    () => getTodayAssignmentFromPlan(draftPlan, user?.id ?? "", todayKey),
    [draftPlan, todayKey, user?.id],
  );
  const activePersonalEntry = useMemo(
    () => personalEntries.find((item) => item.clock_out === null) ?? null,
    [personalEntries],
  );
  const visibleTodayAssignment = todayPublishedAssignment ?? todayDraftAssignment;
  const todayShiftColors = useMemo(
    () => getShiftColors(getShiftDefinition(visibleTodayAssignment?.shiftType ?? "OFF")),
    [visibleTodayAssignment],
  );
  const todayShiftStatus = todayPublishedAssignment
    ? activePersonalEntry
      ? "Dang mo ca"
      : "Da xuat ban"
    : todayDraftAssignment
      ? "Cho xuat ban"
      : "Chua co lich";
  const todayShiftMessage = todayPublishedAssignment
    ? activePersonalEntry
      ? "Ca hom nay dang duoc mo. Theo doi gio ra de cham cong chinh xac."
      : "Lich hom nay da duoc xuat ban. Kiem tra loai ca va khung gio ben duoi."
    : todayDraftAssignment
      ? "Ban da duoc xep lich, nhung ca nay chua duoc xuat ban chinh thuc."
      : "Hom nay chua co ca nao duoc xuat ban cho ban.";
  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedCell?.employeeId) ?? null,
    [employees, selectedCell?.employeeId],
  );
  const selectedProfile = useMemo(
    () => (selectedEmployee ? profiles.find((item) => item.userId === selectedEmployee.id) ?? null : null),
    [profiles, selectedEmployee],
  );
  const selectedAssignment = useMemo(() => {
    if (!selectedCell || !selectedEmployee) return null;
    return assignmentMap.get(`${selectedCell.employeeId}:${selectedCell.dateKey}`) ?? createOffAssignment(selectedCell.dateKey, selectedEmployee);
  }, [assignmentMap, selectedCell, selectedEmployee]);
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
      employees.map((employee) => ({
        employee,
        assignment: assignmentMap.get(`${employee.id}:${selectedDateKey}`) ?? createOffAssignment(selectedDateKey, employee),
      })),
    [assignmentMap, employees, selectedDateKey],
  );
  const selectedDaySummary = useMemo(
    () => draftResult?.daySummaries.find((item) => item.dateKey === selectedDateKey) ?? null,
    [draftResult, selectedDateKey],
  );
  const selectedPersonalAssignment = useMemo(
    () =>
      getAssignmentForUserOnDate(publishedPlan, user?.id, selectedDateKey) ??
      getAssignmentForUserOnDate(draftPlan, user?.id, selectedDateKey),
    [draftPlan, publishedPlan, selectedDateKey, user?.id],
  );
  const personalWeekAssignments = useMemo(
    () =>
      weekDates.map((dateKey) => {
        const publishedAssignment = getAssignmentForUserOnDate(publishedPlan, user?.id, dateKey);
        const draftAssignment = getAssignmentForUserOnDate(draftPlan, user?.id, dateKey);
        return {
          dateKey,
          assignment: publishedAssignment ?? draftAssignment,
          published: Boolean(publishedAssignment),
        };
      }),
    [draftPlan, publishedPlan, user?.id, weekDates],
  );

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
      const nextDraft = generateDraftSchedule({ weekStart, employees, demands });
      await persistDraft(nextDraft, "draft");
    } catch (nextError) {
      Alert.alert("Không thể tự động xếp ca", nextError instanceof Error ? nextError.message : "Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!canManage || !draftResult || saving) return;
    try {
      setSaving(true);
      await persistDraft(draftResult, "published");
      Alert.alert("Đã xuất bản", "Lịch ca tuần này đã được cập nhật cho nhân sự.");
    } catch (nextError) {
      Alert.alert("Không thể xuất bản", nextError instanceof Error ? nextError.message : "Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function handleManualChange(shiftType: ShiftType) {
    if (!selectedCell || !draftResult || saving) return;
    try {
      setSaving(true);
      const nextDraft = buildManualDraft(draftResult, employees, demands, selectedCell.employeeId, selectedCell.dateKey, shiftType);
      await persistDraft(nextDraft, "draft");
      setSelectedCell(null);
    } catch (nextError) {
      Alert.alert("Không thể cập nhật ca", nextError instanceof Error ? nextError.message : "Vui lòng thử lại.");
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
        const nextDraft = buildManualDraft(draftResult, employees, demands, selectedEmployee.id, selectedAssignment.dateKey, "OFF");
        await persistDraft(nextDraft, "draft");
      }
      setSelectedCell(null);
    } catch (nextError) {
      Alert.alert("Không thể cập nhật ngày nghỉ", nextError instanceof Error ? nextError.message : "Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveEntry(entryId: string, approve: boolean) {
    try {
      setSaving(true);
      await reviewShiftCheckIn(entryId, approve);
      await loadData(true);
    } catch (nextError) {
      Alert.alert("Không thể duyệt chấm công", nextError instanceof Error ? nextError.message : "Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveLeave(requestId: string, approve: boolean) {
    try {
      setSaving(true);
      await reviewShiftLeaveRequest(requestId, approve);
      await loadData(true);
    } catch (nextError) {
      Alert.alert("Không thể duyệt nghỉ", nextError instanceof Error ? nextError.message : "Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckIn() {
    try {
      setSaving(true);
      await createShiftCheckIn();
      await loadData(true);
    } catch (nextError) {
      Alert.alert("Không thể mở ca", nextError instanceof Error ? nextError.message : "Vui lòng thử lại.");
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
      Alert.alert("Không thể đóng ca", nextError instanceof Error ? nextError.message : "Vui lòng thử lại.");
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
      Alert.alert("Không thể gửi xin nghỉ", nextError instanceof Error ? nextError.message : "Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={c.primary} />
          <Text style={styles.loadingText}>Đang tải lịch ca...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: getAdminHeaderTopPadding(insets.top),
              paddingBottom: 120 + getAdminBottomBarPadding(insets.bottom),
            },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadData(true)}
              tintColor={c.primary}
              colors={[c.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(user?.email?.split("@")[0] || "AD")}</Text>
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{canManage ? "Quản lý ca làm" : "Ca làm"}</Text>
              <Text style={styles.subtitle}>
                {canManage ? "Quản trị ca làm, duyệt chấm công và điều chỉnh lịch tuần." : "Theo dõi ca làm đã xuất bản và chấm công cá nhân."}
              </Text>
            </View>
            <AdminHeaderActions onSettingsPress={() => void router.push("/(admin)/settings")} />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {planSchemaMissing ? <Text style={styles.warnText}>Thiếu bảng `shift_plans`, đang dùng draft tạm trên mobile.</Text> : null}
          {profileSchemaMissing ? <Text style={styles.warnText}>Thiếu bảng `staff_shift_profiles`, chức năng nghỉ theo ngày sẽ bị giới hạn.</Text> : null}

          <View style={styles.sectionCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Tuần làm việc</Text>
              <Text style={styles.badgeText}>{draftPlan?.status === "published" || publishedPlan ? "Đã có lịch" : "Chưa xuất bản"}</Text>
            </View>
            <View style={styles.weekNavRow}>
              <Pressable style={styles.iconRound} onPress={() => setWeekStart((current) => addDays(current, -7))}>
                <Feather name="chevron-left" size={18} color={c.text} />
              </Pressable>
              <View style={styles.weekLabelPill}>
                <Text style={styles.weekLabel}>{getWeekLabel(weekStart)}</Text>
              </View>
              <Pressable style={styles.iconRound} onPress={() => setWeekStart((current) => addDays(current, 7))}>
                <Feather name="chevron-right" size={18} color={c.text} />
              </Pressable>
            </View>
            <View style={styles.actionsRow}>
              {canManage ? (
                <>
                  <Pressable style={[styles.primaryButton, saving ? styles.buttonDisabled : null]} onPress={() => void handleAutoSchedule()} disabled={saving}>
                    <Feather name="shuffle" size={16} color={c.white} />
                    <Text style={styles.primaryButtonText}>Tự động xếp ca</Text>
                  </Pressable>
                  <Pressable style={[styles.secondaryButton, saving ? styles.buttonDisabled : null]} onPress={() => void handlePublish()} disabled={saving || !draftResult}>
                    <Feather name="upload" size={16} color={c.text} />
                    <Text style={styles.secondaryButtonText}>Xuất bản</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable style={[styles.primaryButton, saving ? styles.buttonDisabled : null]} onPress={() => void handleCheckIn()} disabled={saving || !!activePersonalEntry}>
                    <Feather name="play" size={16} color={c.white} />
                    <Text style={styles.primaryButtonText}>Mở ca</Text>
                  </Pressable>
                  <Pressable style={[styles.secondaryButton, saving ? styles.buttonDisabled : null]} onPress={() => void handleCheckOut()} disabled={saving || !activePersonalEntry}>
                    <Feather name="stop-circle" size={16} color={c.text} />
                    <Text style={styles.secondaryButtonText}>Đóng ca</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{totalAssigned}</Text>
              <Text style={styles.metricLabel}>Ca đã xếp</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{totalRequired}</Text>
              <Text style={styles.metricLabel}>Nhu cầu tuần</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: totalConflicts ? c.danger : c.success }]}>{totalConflicts}</Text>
              <Text style={styles.metricLabel}>Xung đột</Text>
            </View>
          </View>

          <View style={styles.dayTabsWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabsRow}>
              {weekDates.map((dateKey) => {
                const summary = draftResult?.daySummaries.find((item) => item.dateKey === dateKey);
                const active = selectedDateKey === dateKey;
                const personalAssignment = !canManage
                  ? getAssignmentForUserOnDate(publishedPlan, user?.id, dateKey) ?? getAssignmentForUserOnDate(draftPlan, user?.id, dateKey)
                  : null;
                return (
                  <Pressable key={dateKey} style={[styles.dayChip, active ? styles.dayChipActive : null]} onPress={() => setSelectedDateKey(dateKey)}>
                    <Text style={[styles.dayChipText, active ? styles.dayChipTextActive : null]}>{formatDayChip(dateKey)}</Text>
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
              <Text style={styles.sectionTitle}>Planner theo ngày</Text>
              <Text style={styles.sectionSubtitle}>Chạm vào từng nhân sự để sửa nhanh khung giờ hoặc đánh dấu nghỉ.</Text>
              <View style={styles.daySummaryCard}>
                <View style={styles.daySummaryMetric}>
                  <Text style={styles.daySummaryValue}>{selectedDaySummary?.scheduledCount ?? 0}</Text>
                  <Text style={styles.daySummaryLabel}>Đã xếp</Text>
                </View>
                <View style={styles.daySummaryMetric}>
                  <Text style={styles.daySummaryValue}>{selectedDaySummary?.requiredCount ?? 0}</Text>
                  <Text style={styles.daySummaryLabel}>Cần</Text>
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
                  <Text style={styles.daySummaryLabel}>Thiếu</Text>
                </View>
              </View>
              <View style={styles.legendRow}>
                {(["MORNING", "AFTERNOON", "FULL", "OFF"] as ShiftType[]).map((shiftType) => {
                  const definition = getShiftDefinition(shiftType);
                  const colors = getShiftColors(definition);
                  return (
                    <View key={shiftType} style={[styles.legendChip, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                      <Text style={[styles.legendChipCode, { color: colors.text }]}>{definition.shortCode}</Text>
                      <Text style={[styles.legendChipText, { color: colors.text }]}>{definition.label}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.cardStack}>
                {selectedDayAssignments.map(({ employee, assignment }) => {
                  const colors = getShiftColors(getShiftDefinition(assignment.shiftType));
                  return (
                    <Pressable
                      key={employee.id}
                      style={[styles.personCard, { backgroundColor: colors.bg, borderColor: colors.border }]}
                      onPress={() => setSelectedCell({ employeeId: employee.id, dateKey: selectedDateKey })}
                    >
                      <View style={styles.personAvatar}>
                        <Text style={styles.personAvatarText}>{initials(employee.name)}</Text>
                      </View>
                      <View style={styles.personCopy}>
                        <Text style={styles.personName}>{employee.name}</Text>
                        <Text style={styles.personMeta}>{getRoleLabel(employee.role)}</Text>
                        <View style={styles.personShiftMetaRow}>
                          <Text style={[styles.personShiftLabel, { color: colors.text }]}>{assignment.shiftLabel}</Text>
                          <Text style={styles.personShiftHours}>
                            {assignment.startTime && assignment.endTime ? `${assignment.startTime} - ${assignment.endTime}` : "Nghỉ"}
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

          {!canManage ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Lich cua toi trong tuan</Text>
              <Text style={styles.sectionSubtitle}>
                {selectedPersonalAssignment
                  ? `Ngay ${formatDayChip(selectedDateKey)} ban duoc phan ${selectedPersonalAssignment.shiftLabel.toLowerCase()}.`
                  : "Chon tung ngay de xem ro ban duoc xep ca sang, chieu hay ca ngay."}
              </Text>
              <View style={styles.cardStack}>
                {personalWeekAssignments.map(({ dateKey, assignment, published }) => {
                  const definition = getShiftDefinition(assignment?.shiftType ?? "OFF");
                  const colors = getShiftColors(definition);
                  const active = selectedDateKey === dateKey;
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
                      onPress={() => setSelectedDateKey(dateKey)}
                    >
                      <View style={styles.rowBetween}>
                        <View style={styles.personalShiftDayCopy}>
                          <Text style={styles.personalShiftDayTitle}>{formatDayChip(dateKey)}</Text>
                          <Text style={styles.personalShiftDayMeta}>
                            {assignment
                              ? `${assignment.shiftLabel} • ${assignment.startTime} - ${assignment.endTime}`
                              : "Chua co ca duoc xuat ban"}
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
                          {published ? "Da xuat ban" : assignment ? "Cho xuat ban" : "OFF"}
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
              <Text style={styles.sectionTitle}>Duyệt chấm công</Text>
              {pendingOwnerEntries.length ? (
                <View style={styles.cardStack}>
                  {pendingOwnerEntries.map((entry) => (
                    <View key={entry.id} style={styles.reviewCard}>
                      <Text style={styles.reviewTitle}>{teamNameMap.get(entry.staff_user_id ?? "") ?? "Nhân sự"}</Text>
                      <Text style={styles.reviewMeta}>
                        Mở ca {formatTime(entry.clock_in)} • Dự kiến {formatTime(entry.scheduled_start)} - {formatTime(entry.scheduled_end)}
                      </Text>
                      <View style={styles.actionsRow}>
                        <Pressable style={styles.approveButton} onPress={() => void handleApproveEntry(entry.id, true)} disabled={saving}>
                          <Text style={styles.approveText}>Duyệt</Text>
                        </Pressable>
                        <Pressable style={styles.rejectButton} onPress={() => void handleApproveEntry(entry.id, false)} disabled={saving}>
                          <Text style={styles.rejectText}>Từ chối</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>Không có bản ghi chấm công nào đang chờ duyệt.</Text>
              )}
            </View>
          ) : null}

          {canManage ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Yêu cầu nghỉ ca</Text>
              {pendingOwnerLeaves.length ? (
                <View style={styles.cardStack}>
                  {pendingOwnerLeaves.map((request) => (
                    <View key={request.id} style={styles.reviewCard}>
                      <Text style={styles.reviewTitle}>{teamNameMap.get(request.staff_user_id) ?? request.staff_user_id}</Text>
                      <Text style={styles.reviewMeta}>
                        {request.request_type === "DAY_OFF" ? "Xin nghỉ ca" : "Xin về sớm"} • {request.scheduled_date ?? "Chưa rõ ngày"}
                      </Text>
                      {request.note ? <Text style={styles.reviewMeta}>{request.note}</Text> : null}
                      <View style={styles.actionsRow}>
                        <Pressable style={styles.approveButton} onPress={() => void handleApproveLeave(request.id, true)} disabled={saving}>
                          <Text style={styles.approveText}>Duyệt</Text>
                        </Pressable>
                        <Pressable style={styles.rejectButton} onPress={() => void handleApproveLeave(request.id, false)} disabled={saving}>
                          <Text style={styles.rejectText}>Từ chối</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>Không có yêu cầu nghỉ nào đang chờ duyệt.</Text>
              )}
            </View>
          ) : null}

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Ca của tôi</Text>
            <Text style={styles.sectionSubtitle}>
              {todayPublishedAssignment
                ? `${todayPublishedAssignment.shiftLabel} • ${todayPublishedAssignment.startTime} - ${todayPublishedAssignment.endTime}`
                : "Hôm nay chưa có ca nào được xuất bản cho bạn."}
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
                      {visibleTodayAssignment.shiftLabel}
                    </Text>
                    <Text style={styles.todayShiftHours}>
                      {visibleTodayAssignment.startTime && visibleTodayAssignment.endTime
                        ? `${visibleTodayAssignment.startTime} - ${visibleTodayAssignment.endTime}`
                        : "Dang nghi"}
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
                    <Text style={styles.todayShiftMetaLabel}>Loai ca</Text>
                    <Text style={styles.todayShiftMetaValue}>{visibleTodayAssignment.shiftLabel}</Text>
                  </View>
                  <View style={styles.todayShiftMetaItem}>
                    <Text style={styles.todayShiftMetaLabel}>Trang thai</Text>
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
                    <Text style={styles.todayShiftMetaLabel}>Gio lam</Text>
                    <Text style={styles.todayShiftMetaValue}>
                      {visibleTodayAssignment.startTime && visibleTodayAssignment.endTime
                        ? `${visibleTodayAssignment.startTime} - ${visibleTodayAssignment.endTime}`
                        : "--:--"}
                    </Text>
                  </View>
                  <View style={styles.todayShiftMetaItem}>
                    <Text style={styles.todayShiftMetaLabel}>Tinh cong</Text>
                    <Text style={styles.todayShiftMetaValue}>
                      {visibleTodayAssignment.startTime && visibleTodayAssignment.endTime
                        ? `${visibleTodayAssignment.startTime} - ${visibleTodayAssignment.endTime}`
                        : "--:--"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.todayShiftHint}>{todayShiftMessage}</Text>
              </View>
            ) : null}
            {todayPublishedAssignment ? (
              <View style={styles.actionsRow}>
                <Pressable style={[styles.primaryButton, saving ? styles.buttonDisabled : null]} onPress={() => void handleCheckIn()} disabled={saving || !!activePersonalEntry}>
                  <Text style={styles.primaryButtonText}>Mở ca</Text>
                </Pressable>
                <Pressable style={[styles.secondaryButton, saving ? styles.buttonDisabled : null]} onPress={() => void handleRequestDayOff()} disabled={saving}>
                  <Text style={styles.secondaryButtonText}>Xin nghỉ</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.cardStack}>
              {personalEntries.length ? (
                personalEntries.map((entry) => (
                  <View key={entry.id} style={styles.reviewCard}>
                    <Text style={styles.reviewTitle}>{entry.scheduled_shift_label ?? "Ca linh hoạt"}</Text>
                    <Text style={styles.reviewMeta}>Thực tế {formatTime(entry.clock_in)} - {formatTime(entry.clock_out)}</Text>
                    <Text style={styles.reviewMeta}>Tính công {formatTime(entry.effective_clock_in ?? entry.clock_in)} - {formatTime(entry.effective_clock_out ?? entry.clock_out)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Chưa có lịch sử chấm công nào.</Text>
              )}
            </View>
          </View>
        </ScrollView>

        <Modal visible={!!selectedCell && !!selectedEmployee && !!selectedAssignment} transparent animationType="slide" onRequestClose={() => setSelectedCell(null)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedCell(null)}>
            <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.sectionTitle}>{selectedEmployee?.name}</Text>
                  <Text style={styles.sectionSubtitle}>{selectedAssignment ? formatDayChip(selectedAssignment.dateKey) : ""}</Text>
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
                      <Text style={[styles.optionTitle, { color: colors.text }]}>{option.label}</Text>
                      <Text style={[styles.optionSub, { color: colors.text }]}>
                        {option.startTime && option.endTime ? `${option.startTime} - ${option.endTime}` : "Không xếp ca"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {selectedProfile && !profileSchemaMissing ? (
                <Pressable style={styles.leaveToggle} onPress={() => void handleToggleLeave()}>
                  <Feather name="calendar" size={16} color={c.text} />
                  <Text style={styles.leaveToggleText}>
                    {selectedProfile.leaveDateKeys.includes(selectedAssignment?.dateKey ?? "")
                      ? "Bỏ đánh dấu nghỉ ngày này"
                      : "Đánh dấu nghỉ ngày này"}
                  </Text>
                </Pressable>
              ) : null}
            </Pressable>
          </Pressable>
        </Modal>

        <View style={[styles.navShell, { paddingBottom: getAdminBottomBarPadding(insets.bottom) }]}>
          <AdminBottomNav current="profile" role={role} onNavigate={(target) => void router.replace(getAdminNavHref(target, role))} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: c.bg },
  screen: { flex: 1, backgroundColor: c.bg },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: c.sub, fontSize: 14, lineHeight: 20 },
  content: { paddingHorizontal: 18, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
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
  navShell: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderTopWidth: 1,
    borderTopColor: "rgba(47, 36, 29, 0.05)",
    paddingTop: 8,
    paddingHorizontal: 14,
  },
});
