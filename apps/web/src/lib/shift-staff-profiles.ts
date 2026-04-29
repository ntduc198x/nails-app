import { ensureOrgContext } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import {
  normalizeServiceSkill,
  type AvailabilityRule,
  type ServiceSkill,
  type ShiftType,
  type StaffRole,
} from "@nails/shared";

const SHIFT_TYPE_OPTIONS: ShiftType[] = ["MORNING", "AFTERNOON", "FULL_DAY"];
const STAFF_ROLE_OPTIONS: StaffRole[] = ["MANAGER", "RECEPTION", "TECH", "ACCOUNTANT"];

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

function clampInteger(value: number | null | undefined, min: number, max: number, fallback: number) {
  const numeric = Number.isFinite(value) ? Number(value) : fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function normalizeSkills(value: ServiceSkill[] | null | undefined) {
  return [...new Set((value ?? []).map((skill) => normalizeServiceSkill(String(skill))).filter((skill): skill is ServiceSkill => !!skill))];
}

function normalizeAvailability(value: AvailabilityRule[] | null | undefined) {
  return (value ?? [])
    .filter((rule): rule is AvailabilityRule => Number.isInteger(rule?.weekday) && rule.weekday >= 0 && rule.weekday <= 6)
    .map((rule) => ({
      weekday: rule.weekday,
      shiftTypes: [...new Set((rule.shiftTypes ?? []).filter((shiftType): shiftType is ShiftType => SHIFT_TYPE_OPTIONS.includes(shiftType)))],
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

export async function loadStaffShiftProfiles() {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { orgId, branchId } = await ensureOrgContext();

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
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { orgId, branchId } = await ensureOrgContext();

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
    notes_json: {
      source: "web-owner-shifts",
    },
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

export function normalizeStaffShiftProfiles(
  rows: StaffShiftProfileRow[],
  fallbackRoles: Map<string, StaffRole>,
) {
  return rows.map((row) => normalizeStaffShiftProfile(row, fallbackRoles.get(row.user_id) ?? "TECH"));
}
