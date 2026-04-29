import type { AppRole } from "./auth";

export type StaffRole = Exclude<AppRole, "OWNER" | "PARTNER" | "USER">;
export type ShiftType = "MORNING" | "AFTERNOON" | "FULL_DAY" | "OFF";
export type ServiceSkill =
  | "Làm móng cơ bản"
  | "Chăm sóc chân"
  | "Đắp bột"
  | "Vẽ design"
  | "Nối mi"
  | "Wax lông";

const LEGACY_SERVICE_SKILL_MAP = {
  "Basic manicure": "Làm móng cơ bản",
  Pedicure: "Chăm sóc chân",
  Acrylic: "Đắp bột",
  Design: "Vẽ design",
  Eyelash: "Nối mi",
  Waxing: "Wax lông",
} as const satisfies Record<string, ServiceSkill>;

export const SERVICE_SKILL_OPTIONS: ServiceSkill[] = [
  "Làm móng cơ bản",
  "Chăm sóc chân",
  "Đắp bột",
  "Vẽ design",
  "Nối mi",
  "Wax lông",
];

export function normalizeServiceSkill(value: string): ServiceSkill | null {
  if ((SERVICE_SKILL_OPTIONS as string[]).includes(value)) {
    return value as ServiceSkill;
  }
  return LEGACY_SERVICE_SKILL_MAP[value as keyof typeof LEGACY_SERVICE_SKILL_MAP] ?? null;
}

export type ShiftDefinition = {
  type: ShiftType;
  label: string;
  shortCode: string;
  startTime: string;
  endTime: string;
  hours: number;
  theme: "morning" | "afternoon" | "full" | "off";
};

export type AvailabilityRule = {
  weekday: number;
  shiftTypes: ShiftType[];
};

export type AutoScheduleEmployee = {
  id: string;
  name: string;
  role: StaffRole;
  skills: ServiceSkill[];
  availability: AvailabilityRule[];
  leaveDateKeys: string[];
  maxWeeklyHours: number;
  fairnessOffsetHours: number;
  performanceScore: number;
};

export type AutoScheduleDemand = {
  id: string;
  dateKey: string;
  shiftType: Exclude<ShiftType, "OFF">;
  requiredHeadcount: number;
  requiredRoles: StaffRole[];
  requiredSkills: ServiceSkill[];
  forecastBookings: number;
  peak: boolean;
  label?: string;
};

export type AutoScheduleAssignment = {
  employeeId: string;
  employeeName: string;
  role: StaffRole;
  dateKey: string;
  shiftType: ShiftType;
  shiftLabel: string;
  shortCode: string;
  startTime: string;
  endTime: string;
  hours: number;
  source: "auto" | "manual" | "system";
  score: number;
  matchedSkills: ServiceSkill[];
};

export type AutoScheduleConflict = {
  id: string;
  type: "STAFFING_GAP" | "SKILL_GAP" | "OVERTIME" | "LEAVE_CONFLICT" | "AVAILABILITY_GAP";
  severity: "low" | "medium" | "high";
  dateKey: string;
  shiftType?: ShiftType;
  title: string;
  message: string;
  employeeId?: string;
};

export type AutoScheduleSuggestion = {
  id: string;
  dateKey: string;
  shiftType: Exclude<ShiftType, "OFF">;
  employeeId: string;
  employeeName: string;
  reason: string;
  score: number;
};

export type AutoScheduleEmployeeSummary = {
  employeeId: string;
  employeeName: string;
  role: StaffRole;
  assignedHours: number;
  maxWeeklyHours: number;
  overtimeHours: number;
  totalShifts: number;
  skillsCovered: ServiceSkill[];
};

export type AutoScheduleDaySummary = {
  dateKey: string;
  scheduledCount: number;
  requiredCount: number;
  shortageCount: number;
  missingSkills: ServiceSkill[];
  status: "ok" | "warn" | "critical";
};

export type AutoScheduleResult = {
  weekStart: string;
  weekDates: string[];
  assignments: AutoScheduleAssignment[];
  conflicts: AutoScheduleConflict[];
  suggestions: AutoScheduleSuggestion[];
  employeeSummaries: AutoScheduleEmployeeSummary[];
  daySummaries: AutoScheduleDaySummary[];
};

export type AutoScheduleInput = {
  weekStart: string;
  employees: AutoScheduleEmployee[];
  demands: AutoScheduleDemand[];
  shiftDefinitions?: ShiftDefinition[];
};

export const DEFAULT_SHIFT_DEFINITIONS: ShiftDefinition[] = [
  {
    type: "MORNING",
    label: "Ca sáng",
    shortCode: "S",
    startTime: "09:00",
    endTime: "15:00",
    hours: 6,
    theme: "morning",
  },
  {
    type: "AFTERNOON",
    label: "Ca chiều",
    shortCode: "C",
    startTime: "15:00",
    endTime: "21:00",
    hours: 6,
    theme: "afternoon",
  },
  {
    type: "FULL_DAY",
    label: "Ca full",
    shortCode: "F",
    startTime: "09:00",
    endTime: "21:00",
    hours: 12,
    theme: "full",
  },
  {
    type: "OFF",
    label: "Nghỉ",
    shortCode: "OFF",
    startTime: "",
    endTime: "",
    hours: 0,
    theme: "off",
  },
];

const SHIFT_PRIORITY: Record<ShiftType, number> = {
  FULL_DAY: 0,
  MORNING: 1,
  AFTERNOON: 2,
  OFF: 3,
};

function shiftMapFromDefinitions(definitions: ShiftDefinition[]) {
  return new Map(definitions.map((definition) => [definition.type, definition]));
}

function toAssignmentKey(employeeId: string, dateKey: string) {
  return `${employeeId}::${dateKey}`;
}

function uniqueSkills(skills: ServiceSkill[]) {
  return [...new Set(skills)];
}

function getAvailabilityRuleForDate(employee: AutoScheduleEmployee, dateKey: string) {
  const weekday = new Date(`${dateKey}T00:00:00`).getDay();
  return employee.availability.find((entry) => entry.weekday === weekday);
}

function ruleSupportsShift(rule: AvailabilityRule | undefined, shiftType: ShiftType) {
  if (!rule) return false;
  if (shiftType === "OFF") return true;
  if (rule.shiftTypes.includes("FULL_DAY")) return true;
  if (shiftType === "FULL_DAY") {
    return rule.shiftTypes.includes("MORNING") && rule.shiftTypes.includes("AFTERNOON");
  }
  return rule.shiftTypes.includes(shiftType);
}

function assignmentCoversDemandShift(assignmentShiftType: ShiftType, demandShiftType: ShiftType) {
  if (assignmentShiftType === "FULL_DAY") {
    return demandShiftType === "FULL_DAY" || demandShiftType === "MORNING" || demandShiftType === "AFTERNOON";
  }
  return assignmentShiftType === demandShiftType;
}

function assignmentMatchesDemand(assignment: AutoScheduleAssignment, demand: AutoScheduleDemand) {
  return (
    assignment.dateKey === demand.dateKey &&
    demand.requiredRoles.includes(assignment.role) &&
    assignmentCoversDemandShift(assignment.shiftType, demand.shiftType)
  );
}

function getDefaultShiftTypeForDate(employee: AutoScheduleEmployee, dateKey: string): ShiftType {
  if (employee.leaveDateKeys.includes(dateKey)) return "OFF";

  const rule = getAvailabilityRuleForDate(employee, dateKey);
  if (!rule) return "OFF";
  if (rule.shiftTypes.includes("FULL_DAY")) return "FULL_DAY";

  const hasMorning = rule.shiftTypes.includes("MORNING");
  const hasAfternoon = rule.shiftTypes.includes("AFTERNOON");
  if (hasMorning && hasAfternoon) return "FULL_DAY";
  if (hasMorning) return "MORNING";
  if (hasAfternoon) return "AFTERNOON";
  return "OFF";
}

function calculateConsecutiveDays(
  employeeId: string,
  dateKey: string,
  assignments: Map<string, AutoScheduleAssignment>,
  weekDates: string[],
) {
  const currentIndex = weekDates.indexOf(dateKey);
  let consecutive = 0;

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const previousAssignment = assignments.get(toAssignmentKey(employeeId, weekDates[index]));
    if (!previousAssignment || previousAssignment.shiftType === "OFF") {
      break;
    }
    consecutive += 1;
  }

  return consecutive;
}

function matchesRole(employee: AutoScheduleEmployee, demand: AutoScheduleDemand) {
  return demand.requiredRoles.includes(employee.role);
}

function matchesSkill(employee: AutoScheduleEmployee, demand: AutoScheduleDemand) {
  if (!demand.requiredSkills.length) return true;
  return demand.requiredSkills.every((skill) => employee.skills.includes(skill));
}

function withinAvailability(employee: AutoScheduleEmployee, demand: AutoScheduleDemand) {
  return ruleSupportsShift(getAvailabilityRuleForDate(employee, demand.dateKey), demand.shiftType);
}

function computeScore(
  employee: AutoScheduleEmployee,
  demand: AutoScheduleDemand,
  currentHours: number,
  consecutiveDays: number,
  assignedShiftType: ShiftType = demand.shiftType,
) {
  const exactSkillHits = demand.requiredSkills.filter((skill) => employee.skills.includes(skill)).length;
  const skillMatchScore = demand.requiredSkills.length
    ? (exactSkillHits / demand.requiredSkills.length) * 40
    : employee.role === "RECEPTION" || employee.role === "MANAGER"
      ? 20
      : 30;
  const availabilityFitScore = withinAvailability(employee, demand) ? 25 : 0;
  const lowerLoadBonus = Math.max(0, 18 - currentHours / 3);
  const performanceScore = Math.max(0, Math.min(10, employee.performanceScore));
  const peakPriorityScore = demand.peak ? 14 : 6;
  const workingCoverageBonus = assignedShiftType === "FULL_DAY" ? 16 : 10;
  const consecutiveShiftPenalty = consecutiveDays >= 3 ? 15 : consecutiveDays >= 2 ? 8 : 0;

  return (
    skillMatchScore +
    availabilityFitScore +
    lowerLoadBonus +
    performanceScore +
    peakPriorityScore +
    workingCoverageBonus -
    consecutiveShiftPenalty
  );
}

function getShiftDuration(shiftType: ShiftType, definitions = DEFAULT_SHIFT_DEFINITIONS) {
  return definitions.find((definition) => definition.type === shiftType)?.hours ?? 0;
}

function getWeeklySoftHourLimit(employee: AutoScheduleEmployee) {
  return Math.max(employee.maxWeeklyHours, TARGET_WEEKLY_HOURS);
}

function countEligibleEmployeesForDemand(demand: AutoScheduleDemand, employees: AutoScheduleEmployee[]) {
  return employees.filter((employee) => {
    return (
      matchesRole(employee, demand) &&
      !employee.leaveDateKeys.includes(demand.dateKey) &&
      withinAvailability(employee, demand)
    );
  }).length;
}

function sortDemands(demands: AutoScheduleDemand[], employees: AutoScheduleEmployee[] = []) {
  return [...demands].sort((left, right) => {
    const leftEligible = employees.length ? countEligibleEmployeesForDemand(left, employees) : Number.MAX_SAFE_INTEGER;
    const rightEligible = employees.length ? countEligibleEmployeesForDemand(right, employees) : Number.MAX_SAFE_INTEGER;
    if (leftEligible !== rightEligible) return leftEligible - rightEligible;
    if (left.peak !== right.peak) return left.peak ? -1 : 1;
    if (left.dateKey !== right.dateKey) return left.dateKey.localeCompare(right.dateKey);
    if (left.forecastBookings !== right.forecastBookings) return right.forecastBookings - left.forecastBookings;
    if (SHIFT_PRIORITY[left.shiftType] !== SHIFT_PRIORITY[right.shiftType]) {
      return SHIFT_PRIORITY[left.shiftType] - SHIFT_PRIORITY[right.shiftType];
    }
    return left.id.localeCompare(right.id);
  });
}

function buildOffAssignment(
  employee: AutoScheduleEmployee,
  dateKey: string,
  definitions: ShiftDefinition[],
): AutoScheduleAssignment {
  const offDefinition = definitions.find((definition) => definition.type === "OFF") ?? DEFAULT_SHIFT_DEFINITIONS[3];
  return {
    employeeId: employee.id,
    employeeName: employee.name,
    role: employee.role,
    dateKey,
    shiftType: "OFF",
    shiftLabel: offDefinition.label,
    shortCode: offDefinition.shortCode,
    startTime: offDefinition.startTime,
    endTime: offDefinition.endTime,
    hours: offDefinition.hours,
    source: "system",
    score: 0,
    matchedSkills: [],
  };
}

function buildSuggestionsForDemand(
  demand: AutoScheduleDemand,
  employees: AutoScheduleEmployee[],
  assignments: Map<string, AutoScheduleAssignment>,
  employeeHours: Map<string, number>,
  weekDates: string[],
) {
  return employees
    .filter((employee) => !assignments.has(toAssignmentKey(employee.id, demand.dateKey)))
    .map((employee) => {
      const currentHours = employeeHours.get(employee.id) ?? 0;
      const consecutiveDays = calculateConsecutiveDays(employee.id, demand.dateKey, assignments, weekDates);
      return {
        employee,
        currentHours,
        eligible:
          matchesRole(employee, demand) &&
          !employee.leaveDateKeys.includes(demand.dateKey) &&
          withinAvailability(employee, demand),
        skillMatch: matchesSkill(employee, demand),
        score: computeScore(employee, demand, currentHours, consecutiveDays),
      };
    })
    .filter((candidate) => candidate.eligible)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map<AutoScheduleSuggestion>((candidate) => ({
      id: `${demand.id}-${candidate.employee.id}`,
      dateKey: demand.dateKey,
      shiftType: demand.shiftType,
      employeeId: candidate.employee.id,
      employeeName: candidate.employee.name,
      reason: candidate.skillMatch
        ? "Phu hop khung gio va co the trám ca ngay"
        : "Dung role nhung can bo sung skill khi dieu chinh tay",
      score: Math.round(candidate.score),
    }));
}

function wouldCreateShortageForCoveredDemand(
  employee: AutoScheduleEmployee,
  currentAssignment: AutoScheduleAssignment,
  nextShiftType: ShiftType,
  demands: AutoScheduleDemand[],
  assignmentsByKey: Map<string, AutoScheduleAssignment>,
) {
  if (currentAssignment.shiftType === "OFF" || currentAssignment.shiftType === nextShiftType) {
    return false;
  }

  return demands.some((dayDemand) => {
    if (dayDemand.dateKey !== currentAssignment.dateKey) return false;
    if (!matchesRole(employee, dayDemand)) return false;
    if (!assignmentCoversDemandShift(currentAssignment.shiftType, dayDemand.shiftType)) return false;
    if (assignmentCoversDemandShift(nextShiftType, dayDemand.shiftType)) return false;

    const coveredCount = [...assignmentsByKey.values()].filter((assignment) => assignmentMatchesDemand(assignment, dayDemand)).length;
    return coveredCount <= dayDemand.requiredHeadcount;
  });
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function generateWeekDates(weekStart: string) {
  const start = new Date(`${weekStart}T00:00:00`);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return toLocalDateKey(next);
  });
}

export function buildDefaultForecast(weekStart: string) {
  const dates = generateWeekDates(weekStart);
  const baseline = [8, 9, 10, 9, 10, 12, 8];
  return dates.reduce<Record<string, number>>((result, dateKey, index) => {
    result[dateKey] = baseline[index] ?? 8;
    return result;
  }, {});
}

export function getRecommendedShiftTypesForDate(employee: AutoScheduleEmployee, dateKey: string) {
  if (employee.leaveDateKeys.includes(dateKey)) {
    return ["OFF"] as ShiftType[];
  }

  const rule = getAvailabilityRuleForDate(employee, dateKey);
  if (!rule) {
    return ["OFF"] as ShiftType[];
  }

  return DEFAULT_SHIFT_DEFINITIONS
    .map((definition) => definition.type)
    .filter((shiftType) => shiftType === "OFF" || ruleSupportsShift(rule, shiftType));
}

function isSchedulableEmployee(employee: AutoScheduleEmployee) {
  // FIX RANDOM ROLES: OWNER không tham gia chia ca / random.
  // Các role còn lại như MANAGER, TECH, RECEPTION... nếu có availability thì đều được đưa vào thuật toán.
  return (employee.role as AppRole) !== "OWNER" && (employee.role as AppRole) !== "PARTNER";
}

function getAvailableSchedulableRolesForDate(
  employees: AutoScheduleEmployee[],
  dateKey: string,
  shiftType: Exclude<ShiftType, "OFF">,
): StaffRole[] {
  return [
    ...new Set(
      employees
        .filter((employee) => {
          if (!isSchedulableEmployee(employee)) return false;
          if (employee.leaveDateKeys.includes(dateKey)) return false;
          return ruleSupportsShift(getAvailabilityRuleForDate(employee, dateKey), shiftType);
        })
        .map((employee) => employee.role),
    ),
  ];
}

export function buildDefaultWeekDemands({
  weekStart,
  employees,
  forecast = buildDefaultForecast(weekStart),
}: {
  weekStart: string;
  employees: AutoScheduleEmployee[];
  forecast?: Record<string, number>;
}) {
  const dates = generateWeekDates(weekStart);
  const schedulableEmployees = employees.filter(isSchedulableEmployee);

  return dates.flatMap<AutoScheduleDemand>((dateKey, index) => {
    const bookingLoad = forecast[dateKey] ?? 8;
    const weekend = index >= 5;
    const peak = bookingLoad >= 10 || weekend;

    const morningRoles = getAvailableSchedulableRolesForDate(schedulableEmployees, dateKey, "MORNING");
    const afternoonRoles = getAvailableSchedulableRolesForDate(schedulableEmployees, dateKey, "AFTERNOON");
    const fullDayRoles = getAvailableSchedulableRolesForDate(schedulableEmployees, dateKey, "FULL_DAY");

    const countAvailable = (roles: StaffRole[], shiftType: Exclude<ShiftType, "OFF">) =>
      schedulableEmployees.filter((employee) => {
        if (!roles.includes(employee.role)) return false;
        if (employee.leaveDateKeys.includes(dateKey)) return false;
        return ruleSupportsShift(getAvailabilityRuleForDate(employee, dateKey), shiftType);
      }).length;

    const morningStaffAvailable = countAvailable(morningRoles, "MORNING");
    const afternoonStaffAvailable = countAvailable(afternoonRoles, "AFTERNOON");
    const fullDayStaffAvailable = countAvailable(fullDayRoles, "FULL_DAY");

    // FIX RANDOM ROLES: dùng tổng nhân sự có chia ca, không khóa theo riêng TECH.
    // Nếu team nhỏ thì mỗi buổi chỉ yêu cầu 1 người để các role có cơ hội đổi ca/nghỉ khi bấm random.
    const compactSchedulableTeam = schedulableEmployees.length <= 3;

    const morningStaffTarget = compactSchedulableTeam
      ? 1
      : bookingLoad >= 11
        ? 3
        : bookingLoad >= 7
          ? 2
          : 1;

    const afternoonStaffTarget = compactSchedulableTeam
      ? 1
      : bookingLoad >= 10
        ? 3
        : bookingLoad >= 6
          ? 2
          : 1;

    const morningStaffCount = Math.min(morningStaffTarget, morningStaffAvailable);
    const afternoonStaffCount = Math.min(afternoonStaffTarget, afternoonStaffAvailable);
    const demands: AutoScheduleDemand[] = [];

    if (morningStaffCount > 0 && morningRoles.length > 0) {
      demands.push({
        id: `${dateKey}-morning-staff`,
        dateKey,
        shiftType: "MORNING",
        requiredHeadcount: morningStaffCount,
        requiredRoles: morningRoles,
        // FIX RANDOM ROLES: không khóa skill ở default demand để MANAGER/RECEPTION/TECH đều có thể được random.
        // Nếu muốn bắt buộc kỹ năng, hãy tạo demand riêng từ màn hình cấu hình dịch vụ.
        requiredSkills: [],
        forecastBookings: bookingLoad,
        peak,
        label: "Nhan su ca sang",
      });
    }

    if (afternoonStaffCount > 0 && afternoonRoles.length > 0) {
      demands.push({
        id: `${dateKey}-afternoon-staff`,
        dateKey,
        shiftType: "AFTERNOON",
        requiredHeadcount: afternoonStaffCount,
        requiredRoles: afternoonRoles,
        // FIX RANDOM ROLES: không khóa skill ở default demand để mọi role không phải OWNER đều có thể đảo lịch.
        requiredSkills: [],
        forecastBookings: bookingLoad,
        peak,
        label: "Nhan su ca chieu",
      });
    }

    // Ngày cao điểm: nếu có đủ người làm full-day thì thêm 1 nhu cầu phủ sàn.
    // requiredRoles vẫn là toàn bộ role có thể chia ca, không riêng MANAGER.
    if (peak && fullDayStaffAvailable > Math.max(morningStaffCount, afternoonStaffCount) && fullDayRoles.length > 0) {
      demands.push({
        id: `${dateKey}-floor-support`,
        dateKey,
        shiftType: "FULL_DAY",
        requiredHeadcount: 1,
        requiredRoles: fullDayRoles,
        requiredSkills: [],
        forecastBookings: bookingLoad,
        peak: true,
        label: "Ho tro san",
      });
    }

    return demands;
  });
}

export function buildAutoScheduleResult({
  weekStart,
  employees,
  demands,
  assignments,
}: AutoScheduleInput & { assignments: AutoScheduleAssignment[] }) {
  const weekDates = generateWeekDates(weekStart);
  const employeeHours = new Map<string, number>();
  const assignmentsByKey = new Map<string, AutoScheduleAssignment>();
  const employeeSkillsById = new Map(employees.map((employee) => [employee.id, employee.skills]));
  const conflicts: AutoScheduleConflict[] = [];
  const daySummariesMap = new Map<string, AutoScheduleDaySummary>();

  for (const assignment of assignments) {
    assignmentsByKey.set(toAssignmentKey(assignment.employeeId, assignment.dateKey), assignment);
    employeeHours.set(assignment.employeeId, (employeeHours.get(assignment.employeeId) ?? 0) + assignment.hours);
  }

  for (const dateKey of weekDates) {
    daySummariesMap.set(dateKey, {
      dateKey,
      scheduledCount: 0,
      requiredCount: 0,
      shortageCount: 0,
      missingSkills: [],
      status: "ok",
    });
  }

  const suggestions: AutoScheduleSuggestion[] = [];

  for (const demand of demands) {
    const matchedAssignments = assignments.filter((assignment) => assignmentMatchesDemand(assignment, demand));
    const coveredSkills = uniqueSkills(
      matchedAssignments.flatMap((assignment) =>
        demand.requiredSkills.filter((skill) => employeeSkillsById.get(assignment.employeeId)?.includes(skill)),
      ),
    );
    const matchedSkillCount = demand.requiredSkills.filter((skill) => coveredSkills.includes(skill)).length;
    const shortageCount = Math.max(0, demand.requiredHeadcount - matchedAssignments.length);
    const missingSkills = demand.requiredSkills.filter((skill) => !coveredSkills.includes(skill));
    const daySummary = daySummariesMap.get(demand.dateKey);

    if (daySummary) {
      daySummary.requiredCount += demand.requiredHeadcount;
      daySummary.scheduledCount += matchedAssignments.length;
      daySummary.shortageCount += shortageCount;
      daySummary.missingSkills = uniqueSkills([...daySummary.missingSkills, ...missingSkills]);
    }

    if (shortageCount > 0) {
      conflicts.push({
        id: `${demand.id}-staff-gap`,
        type: "STAFFING_GAP",
        severity: demand.peak ? "high" : "medium",
        dateKey: demand.dateKey,
        shiftType: demand.shiftType,
        title: `Thiếu ${shortageCount} người cho ${demand.label ?? demand.shiftType.toLowerCase()}`,
        message: `Ca ${demand.shiftType.toLowerCase()} ngày ${demand.dateKey} cần ${demand.requiredHeadcount} người nhưng mới có ${matchedAssignments.length}.`,
      });
      suggestions.push(...buildSuggestionsForDemand(demand, employees, assignmentsByKey, employeeHours, weekDates));
    }

    if (demand.requiredSkills.length > 0 && matchedSkillCount < demand.requiredSkills.length) {
      conflicts.push({
        id: `${demand.id}-skill-gap`,
        type: "SKILL_GAP",
        severity: demand.peak ? "high" : "medium",
        dateKey: demand.dateKey,
        shiftType: demand.shiftType,
        title: `Ca thiếu kỹ năng ${missingSkills.join(", ")}`,
        message: `Ca ${demand.shiftType.toLowerCase()} ngày ${demand.dateKey} chưa đủ kỹ năng yêu cầu.`,
      });
    }
  }

  const employeeSummaries = employees.map<AutoScheduleEmployeeSummary>((employee) => {
    const employeeAssignments = assignments.filter(
      (assignment) => assignment.employeeId === employee.id && assignment.shiftType !== "OFF",
    );
    const assignedHours = employeeHours.get(employee.id) ?? 0;
    const weeklySoftLimit = getWeeklySoftHourLimit(employee);
    const overtimeHours = Math.max(0, assignedHours - weeklySoftLimit);

    if (overtimeHours > 0) {
      conflicts.push({
        id: `${employee.id}-overtime`,
        type: "OVERTIME",
        severity: overtimeHours >= 6 ? "high" : "medium",
        dateKey: weekStart,
        employeeId: employee.id,
        title: `${employee.name} vượt giờ tuần`,
        message: `${employee.name} đang được xếp ${assignedHours}h / ${weeklySoftLimit}h.`,
      });
    }

    return {
      employeeId: employee.id,
      employeeName: employee.name,
      role: employee.role,
      assignedHours,
      maxWeeklyHours: weeklySoftLimit,
      overtimeHours,
      totalShifts: employeeAssignments.length,
      skillsCovered: uniqueSkills(employeeAssignments.flatMap((assignment) => assignment.matchedSkills)),
    };
  });

  const daySummaries = weekDates.map<AutoScheduleDaySummary>((dateKey) => {
    const summary = daySummariesMap.get(dateKey)!;
    const status: AutoScheduleDaySummary["status"] =
      summary.shortageCount > 1 || summary.missingSkills.length > 1
        ? "critical"
        : summary.shortageCount > 0 || summary.missingSkills.length > 0
          ? "warn"
          : "ok";
    return {
      ...summary,
      status,
    };
  });

  return {
    weekStart,
    weekDates,
    assignments: assignments
      .slice()
      .sort((left, right) => left.dateKey.localeCompare(right.dateKey) || left.employeeName.localeCompare(right.employeeName)),
    conflicts,
    suggestions: suggestions.filter(
      (suggestion, index, list) =>
        list.findIndex(
          (item) =>
            item.dateKey === suggestion.dateKey &&
            item.shiftType === suggestion.shiftType &&
            item.employeeId === suggestion.employeeId,
        ) === index,
    ),
    employeeSummaries,
    daySummaries,
  };
}

// ============================================================
// AUTO SCHEDULE - DAILY PLAN OPTIMIZER REWRITE
// ============================================================
// Cách làm mới:
// - Không assign OFF trước.
// - Không fill từng demand kiểu greedy nữa.
// - Mỗi ngày sinh tất cả phương án hợp lệ: mỗi nhân viên là OFF / MORNING / AFTERNOON / FULL_DAY.
// - Chọn phương án ngày nào cover đủ demand.
// - Sau đó dùng DP chọn tổ hợp 7 ngày sao cho:
//   1) Ưu tiên đủ người theo demand.
//   2) Mỗi nhân viên gần đúng 2 OFF / tuần.
//   3) Hạn chế vượt 40h nhưng vẫn cho vượt nếu cần.
//   4) Không dồn manager làm 7/7.
//
// Thay toàn bộ generateDraftSchedule(...) và các helper tạm trước đó bằng block này.

const TARGET_WEEKLY_OFF_DAYS = 1;
const TARGET_WEEKLY_HOURS = 48;
const MIN_WEEKLY_WORK_DAYS = 4;
const MAX_DAILY_PLAN_CANDIDATES = 200;
const DAILY_BASE_CANDIDATES = 80;

function shuffleArray<T>(arr: T[]) {
  return arr
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

type DailyPlanAssignment = {
  employee: AutoScheduleEmployee;
  shiftType: ShiftType;
  matchedSkills: ServiceSkill[];
};

type DailyPlan = {
  dateKey: string;
  assignments: DailyPlanAssignment[];
  score: number;
  coverageScore: number;
  skillGapCount: number;
};

type DpState = {
  score: number;
  plans: DailyPlan[];
  workDays: number[];
  hours: number[];
};

function normalizeScheduleDemands(demands: AutoScheduleDemand[]): AutoScheduleDemand[] {
  return demands.map((demand) => {
    const canFallbackToTech = demand.requiredSkills.length === 0 && demand.requiredRoles.includes("MANAGER");
    if (!canFallbackToTech) return demand;

    return {
      ...demand,
      requiredRoles: [...new Set([...demand.requiredRoles, "TECH" as StaffRole])],
    };
  });
}

function canEmployeeWorkShift(employee: AutoScheduleEmployee, dateKey: string, shiftType: ShiftType) {
  if (shiftType === "OFF") return true;
  if (employee.leaveDateKeys.includes(dateKey)) return false;
  return ruleSupportsShift(getAvailabilityRuleForDate(employee, dateKey), shiftType);
}

function employeeFitsDemand(employee: AutoScheduleEmployee, demand: AutoScheduleDemand) {
  return demand.requiredRoles.includes(employee.role);
}

function employeeSkillHits(employee: AutoScheduleEmployee, demand: AutoScheduleDemand) {
  return demand.requiredSkills.filter((skill) => employee.skills.includes(skill));
}

function planAssignmentCoversDemand(assignment: DailyPlanAssignment, demand: AutoScheduleDemand) {
  if (assignment.shiftType === "OFF") return false;
  if (!employeeFitsDemand(assignment.employee, demand)) return false;
  return assignmentCoversDemandShift(assignment.shiftType, demand.shiftType);
}

function countPlanCoverage(planAssignments: DailyPlanAssignment[], demand: AutoScheduleDemand) {
  return planAssignments.filter((assignment) => planAssignmentCoversDemand(assignment, demand)).length;
}

function countSkillGaps(planAssignments: DailyPlanAssignment[], dayDemands: AutoScheduleDemand[]) {
  let gaps = 0;

  for (const demand of dayDemands) {
    for (const skill of demand.requiredSkills) {
      const covered = planAssignments.some(
        (assignment) =>
          planAssignmentCoversDemand(assignment, demand) && assignment.employee.skills.includes(skill),
      );
      if (!covered) gaps += 1;
    }
  }

  return gaps;
}

function getPossibleShiftTypes(employee: AutoScheduleEmployee, dateKey: string): ShiftType[] {
  const shifts: ShiftType[] = ["OFF"];

  if (canEmployeeWorkShift(employee, dateKey, "MORNING")) shifts.push("MORNING");
  if (canEmployeeWorkShift(employee, dateKey, "AFTERNOON")) shifts.push("AFTERNOON");
  if (canEmployeeWorkShift(employee, dateKey, "FULL_DAY")) shifts.push("FULL_DAY");

  return shifts;
}

function buildDailyPlans({
  dateKey,
  employees,
  demands,
  shiftDefinitions,
}: {
  dateKey: string;
  employees: AutoScheduleEmployee[];
  demands: AutoScheduleDemand[];
  shiftDefinitions: ShiftDefinition[];
}): DailyPlan[] {
  const dayDemands = demands.filter((demand) => demand.dateKey === dateKey);
  const possibleShiftTypesByEmployee = employees.map((employee) => getPossibleShiftTypes(employee, dateKey));
  const rawPlans: DailyPlanAssignment[][] = [];

  const walk = (index: number, current: DailyPlanAssignment[]) => {
    if (index >= employees.length) {
      rawPlans.push(current);
      return;
    }

    const employee = employees[index];
    for (const shiftType of possibleShiftTypesByEmployee[index]) {
      const matchedSkills = dayDemands.flatMap((demand) => employeeSkillHits(employee, demand));
      walk(index + 1, [...current, { employee, shiftType, matchedSkills }]);
    }
  };

  walk(0, []);

  const plans = rawPlans
    .map<DailyPlan | null>((assignments) => {
      const shortageCount = dayDemands.reduce((sum, demand) => {
        return sum + Math.max(0, demand.requiredHeadcount - countPlanCoverage(assignments, demand));
      }, 0);

      // Không nhận phương án thiếu người nếu còn phương án đủ người.
      if (shortageCount > 0) return null;

      const workingAssignments = assignments.filter((assignment) => assignment.shiftType !== "OFF");
      const fullDayCount = assignments.filter((assignment) => assignment.shiftType === "FULL_DAY").length;
      const managerWorkCount = assignments.filter(
        (assignment) => assignment.employee.role === "MANAGER" && assignment.shiftType !== "OFF",
      ).length;
      const skillGapCount = countSkillGaps(assignments, dayDemands);
      const totalHours = assignments.reduce(
        (sum, assignment) => sum + getShiftDuration(assignment.shiftType, shiftDefinitions),
        0,
      );

      // Daily score càng thấp càng tốt.
      // Ưu tiên đủ demand trước, sau đó hạn chế full-day và manager nếu không cần.
      const coverageScore = dayDemands.reduce((sum, demand) => {
        const coverage = countPlanCoverage(assignments, demand);
        const extraCoverage = Math.max(0, coverage - demand.requiredHeadcount);
        return sum + extraCoverage * 15;
      }, 0);

      const score =
        coverageScore +
        skillGapCount * 120 +
        fullDayCount * 25 +
        managerWorkCount * 18 +
        Math.max(0, workingAssignments.length - 3) * 20 +
        totalHours;

      return {
        dateKey,
        assignments,
        score,
        coverageScore,
        skillGapCount,
      };
    })
    .filter((plan): plan is DailyPlan => !!plan)
    .sort((left, right) => {
      if (left.skillGapCount !== right.skillGapCount) return left.skillGapCount - right.skillGapCount;
      return left.score - right.score;
    });

  const pickDiversePlans = (candidates: DailyPlan[]) => {
    const picked = new Map<string, DailyPlan>();
    const addPlan = (plan: DailyPlan) => {
      const key = plan.assignments.map((assignment) => `${assignment.employee.id}:${assignment.shiftType}`).join("|");
      if (!picked.has(key)) picked.set(key, plan);
    };

    candidates.slice(0, DAILY_BASE_CANDIDATES).forEach(addPlan);

    for (const employee of employees) {
      candidates
        .filter((plan) =>
          plan.assignments.some(
            (assignment) => assignment.employee.id === employee.id && assignment.shiftType !== "OFF",
          ),
        )
        .slice(0, 20)
        .forEach(addPlan);
    }

    return shuffleArray([...picked.values()]).slice(0, MAX_DAILY_PLAN_CANDIDATES);
  };

  // Nếu không có plan đủ người, fallback lấy plan thiếu ít nhất để app vẫn hiển thị suggestion/conflict.
  if (!plans.length) {
    return pickDiversePlans(rawPlans
      .map<DailyPlan>((assignments) => {
        const shortageCount = dayDemands.reduce((sum, demand) => {
          return sum + Math.max(0, demand.requiredHeadcount - countPlanCoverage(assignments, demand));
        }, 0);
        const skillGapCount = countSkillGaps(assignments, dayDemands);
        const totalHours = assignments.reduce(
          (sum, assignment) => sum + getShiftDuration(assignment.shiftType, shiftDefinitions),
          0,
        );

        return {
          dateKey,
          assignments,
          coverageScore: shortageCount * 1000,
          skillGapCount,
          score: shortageCount * 1000 + skillGapCount * 120 + totalHours,
        };
      })
      .sort((left, right) => left.score - right.score)
    );
  }

  return pickDiversePlans(plans);
}

function dpKey(workDays: number[], hours: number[]) {
  return `${workDays.join(",")}|${hours.join(",")}`;
}

function hasConsecutiveOff(plans: DailyPlan[], employeeIndex: number) {
  for (let index = 1; index < plans.length; index += 1) {
    const previousOff = plans[index - 1].assignments[employeeIndex]?.shiftType === "OFF";
    const currentOff = plans[index].assignments[employeeIndex]?.shiftType === "OFF";
    if (previousOff && currentOff) return true;
  }
  return false;
}

function finalWeeklyPenalty(state: DpState, employees: AutoScheduleEmployee[]) {
  const offSpacingPenalty = (plans: DailyPlan[], employeeIndex: number) => {
    const offIndexes = plans
      .map((plan, index) => (plan.assignments[employeeIndex]?.shiftType === "OFF" ? index : -1))
      .filter((index) => index >= 0);

    if (offIndexes.length < 2) return 0;

    let penalty = 0;
    for (let index = 1; index < offIndexes.length; index += 1) {
      const distance = offIndexes[index] - offIndexes[index - 1];

      // OFF liền nhau đã bị chặn cứng trong DP.
      // Ở đây chỉ tối ưu spacing còn lại.
      if (distance === 2) penalty += 1500;
      else if (distance === 3 || distance === 4) penalty += 0;
      else if (distance === 5) penalty += 300;
      else penalty += 800;
    }

    return penalty;
  };

  return employees.reduce((sum, employee, index) => {
    const offDays = 7 - state.workDays[index];
    const workDays = state.workDays[index];
    const hours = state.hours[index];
    const targetOffPenalty = Math.abs(offDays - TARGET_WEEKLY_OFF_DAYS) * 900;
    const underWorkDayPenalty = Math.max(0, Math.min(MIN_WEEKLY_WORK_DAYS, employee.availability.length) - workDays) * 1500;
    const spacingPenalty = offSpacingPenalty(state.plans, index);
    const zeroOffManagerPenalty = employee.role === "MANAGER" && offDays === 0 ? 5000 : 0;
    const managerBelowOffPenalty = employee.role === "MANAGER" && offDays < TARGET_WEEKLY_OFF_DAYS ? 2500 : 0;
    const overtimePenalty = Math.max(0, hours - getWeeklySoftHourLimit(employee)) * 60;
    const underHourPenalty = Math.max(0, 24 - hours) * 10;

    return (
      sum +
      targetOffPenalty +
      underWorkDayPenalty +
      spacingPenalty +
      zeroOffManagerPenalty +
      managerBelowOffPenalty +
      overtimePenalty +
      underHourPenalty
    );
  }, 0);
}


export function generateDraftSchedule({
  weekStart,
  employees,
  demands,
  shiftDefinitions = DEFAULT_SHIFT_DEFINITIONS,
}: AutoScheduleInput): AutoScheduleResult {
  const weekDates = generateWeekDates(weekStart);

  // FIX RANDOM ROLES: OWNER không tham gia random / chia ca.
  // Các role còn lại vẫn giữ nguyên và đều được đưa vào daily plan nếu có availability.
  const schedulableEmployees = employees.filter(isSchedulableEmployee);
  const normalizedDemands = normalizeScheduleDemands(demands).map((demand) => ({
    ...demand,
    requiredRoles: demand.requiredRoles.filter((role) => role !== ("OWNER" as StaffRole) && role !== ("PARTNER" as StaffRole)),
  }));
  const definitions = shiftMapFromDefinitions(shiftDefinitions);

  const dailyPlansByDate = new Map(
    weekDates.map((dateKey) => [
      dateKey,
      buildDailyPlans({
        dateKey,
        employees: schedulableEmployees,
        demands: normalizedDemands,
        shiftDefinitions,
      }),
    ]),
  );

  let states = new Map<string, DpState>();
  const initialWorkDays = schedulableEmployees.map(() => 0);
  const initialHours = schedulableEmployees.map(() => 0);
  states.set(dpKey(initialWorkDays, initialHours), {
    score: 0,
    plans: [],
    workDays: initialWorkDays,
    hours: initialHours,
  });

  for (const dateKey of weekDates) {
    const dayPlans = dailyPlansByDate.get(dateKey) ?? [];
    const nextStates = new Map<string, DpState>();

    for (const state of states.values()) {
      for (const plan of dayPlans) {
        // HARD CONSTRAINT: không bao giờ OFF liền 2 ngày khi auto-schedule.
        // Nếu hôm qua employee OFF thì plan hôm nay không được OFF employee đó nữa.
        const previousPlan = state.plans[state.plans.length - 1];
        if (previousPlan) {
          const hasAdjacentOff = plan.assignments.some((assignment, employeeIndex) => {
            return (
              assignment.shiftType === "OFF" &&
              previousPlan.assignments[employeeIndex]?.shiftType === "OFF"
            );
          });
          if (hasAdjacentOff) continue;
        }

        const nextWorkDays = [...state.workDays];
        const nextHours = [...state.hours];

        plan.assignments.forEach((assignment, index) => {
          if (assignment.shiftType !== "OFF") {
            nextWorkDays[index] += 1;
            nextHours[index] += getShiftDuration(assignment.shiftType, shiftDefinitions);
          }
        });

        const balancePenalty = schedulableEmployees.reduce((sum, employee, index) => {
          const projectedOffDays = weekDates.indexOf(dateKey) + 1 - nextWorkDays[index];
          const projectedWorkDays = nextWorkDays[index];
          const projectedHours = nextHours[index];

          const managerTooManyEarlyPenalty =
            employee.role === "MANAGER" && projectedWorkDays > Math.ceil(((weekDates.indexOf(dateKey) + 1) / 7) * 5) + 1
              ? 300
              : 0;

          const overtimePenalty = Math.max(0, projectedHours - getWeeklySoftHourLimit(employee)) * 35;
          const workDayOverPenalty = Math.max(0, projectedWorkDays - 5) * 250;

          return sum + managerTooManyEarlyPenalty + overtimePenalty + workDayOverPenalty + projectedOffDays * 0;
        }, 0);

        const randomNoise = Math.random() * 20;
        const nextScore = state.score + plan.score + balancePenalty + randomNoise;
        const key = dpKey(nextWorkDays, nextHours);
        const existing = nextStates.get(key);

        if (!existing || nextScore < existing.score) {
          nextStates.set(key, {
            score: nextScore,
            plans: [...state.plans, plan],
            workDays: nextWorkDays,
            hours: nextHours,
          });
        }
      }
    }

    states = new Map(
      [...nextStates.values()]
        .sort((left, right) => left.score - right.score)
        .slice(0, 500)
        .map((state) => [dpKey(state.workDays, state.hours), state]),
    );
  }

  const bestState = [...states.values()]
    // Safety filter: loại mọi state còn OFF liền nhau.
    .filter((state) => schedulableEmployees.every((_, employeeIndex) => !hasConsecutiveOff(state.plans, employeeIndex)))
    .map((state) => ({
      ...state,
      finalScore: state.score + finalWeeklyPenalty(state, schedulableEmployees),
    }))
    .sort((left, right) => left.finalScore - right.finalScore)[0];

  const assignments: AutoScheduleAssignment[] = [];

  for (const plan of bestState?.plans ?? []) {
    for (const planAssignment of plan.assignments) {
      const definition = definitions.get(planAssignment.shiftType) ?? DEFAULT_SHIFT_DEFINITIONS[3];
      assignments.push({
        employeeId: planAssignment.employee.id,
        employeeName: planAssignment.employee.name,
        role: planAssignment.employee.role,
        dateKey: plan.dateKey,
        shiftType: planAssignment.shiftType,
        shiftLabel: definition.label,
        shortCode: definition.shortCode,
        startTime: definition.startTime,
        endTime: definition.endTime,
        hours: definition.hours,
        source: planAssignment.shiftType === "OFF" ? "system" : "auto",
        score: Math.max(0, Math.round(100 - plan.score)),
        matchedSkills: [...new Set(planAssignment.matchedSkills)],
      });
    }
  }

  return buildAutoScheduleResult({
    weekStart,
    employees: schedulableEmployees,
    demands: normalizedDemands,
    assignments,
    shiftDefinitions,
  });
}
