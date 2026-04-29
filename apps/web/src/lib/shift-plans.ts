import { ensureOrgContext } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import {
  normalizeServiceSkill,
  type AutoScheduleAssignment,
  type AutoScheduleConflict,
  type AutoScheduleDaySummary,
  type AutoScheduleDemand,
  type AutoScheduleEmployeeSummary,
  type AutoScheduleResult,
  type AutoScheduleSuggestion,
  type ServiceSkill,
} from "@nails/shared";

export type ShiftPlanStatus = "draft" | "published";

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

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, amount: number) {
  const next = new Date(`${dateKey}T00:00:00`);
  next.setDate(next.getDate() + amount);
  return toLocalDateKey(next);
}

export type ShiftPlanRecord = {
  id: string;
  weekStart: string;
  status: ShiftPlanStatus;
  publishedAt: string | null;
  result: AutoScheduleResult;
  demands: AutoScheduleDemand[];
  forecast: Record<string, number>;
};

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

function normalizeShiftPlan(row: ShiftPlanRow): ShiftPlanRecord {
  const normalizeSkills = (skills: ServiceSkill[] | null | undefined) =>
    (skills ?? []).map((skill) => normalizeServiceSkill(String(skill))).filter((skill): skill is ServiceSkill => !!skill);
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
      : assignments.map((assignment) => ({
          ...assignment,
          dateKey: addDays(assignment.dateKey, legacyOffsetDays),
        }));
  const normalizedDemands =
    legacyOffsetDays === 0
      ? demands
      : demands.map((demand) => ({
          ...demand,
          dateKey: addDays(demand.dateKey, legacyOffsetDays),
        }));
  const daySummaries =
    legacyOffsetDays === 0
      ? rawDaySummaries
      : rawDaySummaries.map((summary) => ({
          ...summary,
          dateKey: addDays(summary.dateKey, legacyOffsetDays),
        }));
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
      weekDates: daySummaries.map((item) => item.dateKey) ??
        [...new Set(normalizedAssignments.map((item) => item.dateKey))].sort(),
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

async function getCurrentUserId() {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const userId = data.session?.user?.id;
  if (!userId) throw new Error("Chưa đăng nhập");
  return userId;
}

export async function loadShiftPlanWeek(
  weekStart: string,
  opts?: { publishedOnly?: boolean },
): Promise<ShiftPlanRecord | null> {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { orgId, branchId } = await ensureOrgContext();

  let query = supabase
    .from("shift_plans")
    .select(
      "id,week_start,status,assignments_json,demands_json,forecast_json,employee_summaries_json,day_summaries_json,conflicts_json,suggestions_json,published_at",
    )
    .eq("org_id", orgId)
    .eq("branch_id", branchId)
    .eq("week_start", weekStart);

  if (opts?.publishedOnly) {
    query = query.eq("status", "published");
  }

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
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { orgId, branchId } = await ensureOrgContext();
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
    notes_json: {
      source: "web-owner-shifts",
    },
    published_at: input.status === "published" ? new Date().toISOString() : null,
    created_by: userId,
    updated_by: userId,
  };

  const { data, error } = await supabase
    .from("shift_plans")
    .upsert(payload, { onConflict: "org_id,branch_id,week_start" })
    .select(
      "id,week_start,status,assignments_json,demands_json,forecast_json,employee_summaries_json,day_summaries_json,conflicts_json,suggestions_json,published_at",
    )
    .single();

  if (error) throw error;
  return normalizeShiftPlan(data as ShiftPlanRow);
}
