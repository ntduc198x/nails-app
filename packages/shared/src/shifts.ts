import type { AutoScheduleAssignment, ShiftType } from "./auto-schedule";

export type ShiftRequestKind = "SWAP" | "PICKUP";
export type ShiftChangeRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ShiftOverrideAction = "ADD" | "REMOVE";
export type ShiftOverrideSourceKind = "REQUEST_APPROVAL" | "MANUAL_SETUP";

export type ShiftSlotSnapshot = {
  weekStart: string;
  dateKey: string;
  shiftType: Exclude<ShiftType, "OFF">;
  shiftLabel: string;
  startTime: string;
  endTime: string;
  holderUserId: string;
  holderName?: string | null;
};

export type EffectiveShiftSlot = ShiftSlotSnapshot & {
  source: "PUBLISHED" | "OVERRIDE_ADD";
  sourceAssignmentUserId: string;
  requestId?: string | null;
  overrideId?: string | null;
};

export type ShiftChangeRequestRecord = {
  id: string;
  org_id?: string;
  branch_id?: string | null;
  requester_user_id: string;
  request_kind: ShiftRequestKind;
  status: ShiftChangeRequestStatus;
  source_slot_json: ShiftSlotSnapshot | null;
  target_slot_json: ShiftSlotSnapshot;
  note: string | null;
  owner_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ShiftOverrideRecord = {
  id: string;
  org_id?: string;
  branch_id?: string | null;
  staff_user_id: string;
  date_key: string;
  shift_type: Exclude<ShiftType, "OFF">;
  shift_label: string;
  start_time: string;
  end_time: string;
  action: ShiftOverrideAction;
  source_kind: ShiftOverrideSourceKind;
  request_id: string | null;
  created_by: string | null;
  created_at: string;
  cancelled_at: string | null;
};

export function isWorkingShiftType(shiftType: ShiftType): shiftType is Exclude<ShiftType, "OFF"> {
  return shiftType === "MORNING" || shiftType === "AFTERNOON" || shiftType === "FULL_DAY";
}

export function createShiftSlotSnapshot(assignment: AutoScheduleAssignment, weekStart: string): ShiftSlotSnapshot | null {
  if (!isWorkingShiftType(assignment.shiftType) || !assignment.startTime || !assignment.endTime) {
    return null;
  }

  return {
    weekStart,
    dateKey: assignment.dateKey,
    shiftType: assignment.shiftType,
    shiftLabel: assignment.shiftLabel,
    startTime: assignment.startTime,
    endTime: assignment.endTime,
    holderUserId: assignment.employeeId,
    holderName: assignment.employeeName,
  };
}

export function createEffectiveShiftSlotFromAssignment(
  assignment: AutoScheduleAssignment,
  weekStart: string,
): EffectiveShiftSlot | null {
  const snapshot = createShiftSlotSnapshot(assignment, weekStart);
  if (!snapshot) return null;

  return {
    ...snapshot,
    source: "PUBLISHED",
    sourceAssignmentUserId: assignment.employeeId,
  };
}

export function createEffectiveShiftSlotFromOverride(
  override: ShiftOverrideRecord,
  weekStart: string,
): EffectiveShiftSlot {
  return {
    weekStart,
    dateKey: override.date_key,
    shiftType: override.shift_type,
    shiftLabel: override.shift_label,
    startTime: override.start_time,
    endTime: override.end_time,
    holderUserId: override.staff_user_id,
    source: "OVERRIDE_ADD",
    sourceAssignmentUserId: override.staff_user_id,
    requestId: override.request_id,
    overrideId: override.id,
  };
}

export function toShiftSlotKey(slot: Pick<ShiftSlotSnapshot, "holderUserId" | "dateKey" | "shiftType">) {
  return `${slot.holderUserId}::${slot.dateKey}::${slot.shiftType}`;
}

export function toShiftCoverageKey(slot: Pick<ShiftSlotSnapshot, "dateKey" | "shiftType">) {
  return `${slot.dateKey}::${slot.shiftType}`;
}

export function mergeEffectiveShiftSlots(input: {
  weekStart: string;
  assignments: AutoScheduleAssignment[];
  overrides: ShiftOverrideRecord[];
}) {
  const baseSlots = input.assignments
    .map((assignment) => createEffectiveShiftSlotFromAssignment(assignment, input.weekStart))
    .filter((slot): slot is EffectiveShiftSlot => !!slot);
  const activeOverrides = input.overrides.filter((override) => !override.cancelled_at);
  const removeKeys = new Set(
    activeOverrides
      .filter((override) => override.action === "REMOVE")
      .map((override) =>
        toShiftSlotKey({
          holderUserId: override.staff_user_id,
          dateKey: override.date_key,
          shiftType: override.shift_type,
        }),
      ),
  );

  const merged = baseSlots.filter((slot) => !removeKeys.has(toShiftSlotKey(slot)));
  for (const override of activeOverrides) {
    if (override.action !== "ADD") continue;
    merged.push(createEffectiveShiftSlotFromOverride(override, input.weekStart));
  }

  return merged.sort((left, right) => {
    if (left.dateKey !== right.dateKey) return left.dateKey.localeCompare(right.dateKey);
    if (left.holderUserId !== right.holderUserId) return left.holderUserId.localeCompare(right.holderUserId);
    if (left.startTime !== right.startTime) return left.startTime.localeCompare(right.startTime);
    return left.shiftType.localeCompare(right.shiftType);
  });
}

export function getEffectiveShiftSlotsForDate(
  slots: EffectiveShiftSlot[],
  userId: string,
  dateKey: string,
) {
  return slots.filter((slot) => slot.holderUserId === userId && slot.dateKey === dateKey);
}

export function validateEffectiveDaySlots(slots: Array<Pick<EffectiveShiftSlot, "dateKey" | "shiftType">>) {
  const grouped = new Map<string, Exclude<ShiftType, "OFF">[]>();
  for (const slot of slots) {
    const next = grouped.get(slot.dateKey) ?? [];
    next.push(slot.shiftType);
    grouped.set(slot.dateKey, next);
  }

  for (const [dateKey, shiftTypes] of grouped) {
    if (shiftTypes.length > 2) {
      return `Một người không được có quá 2 ca trong ngày ${dateKey}.`;
    }

    const uniqueShiftTypes = [...new Set(shiftTypes)];
    if (uniqueShiftTypes.length !== shiftTypes.length) {
      return `Không thể có 2 ca trùng loại trong ngày ${dateKey}.`;
    }

    if (uniqueShiftTypes.includes("FULL_DAY") && uniqueShiftTypes.length > 1) {
      return `Ca FULL_DAY phải đứng riêng trong ngày ${dateKey}.`;
    }

    if (
      uniqueShiftTypes.length === 2 &&
      !(uniqueShiftTypes.includes("MORNING") && uniqueShiftTypes.includes("AFTERNOON"))
    ) {
      return `Chỉ được phép ghép MORNING + AFTERNOON trong ngày ${dateKey}.`;
    }
  }

  return null;
}
