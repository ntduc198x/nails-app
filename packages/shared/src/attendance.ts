export const ATTENDANCE_FRACTIONS = [1, 0.75, 0.5, 0] as const;

export type AttendanceFraction = (typeof ATTENDANCE_FRACTIONS)[number];

export function normalizeAttendanceFraction(value: unknown, fallback: AttendanceFraction = 0): AttendanceFraction {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;

  if (numeric === 1 || numeric === 0.75 || numeric === 0.5 || numeric === 0) {
    return numeric;
  }

  return fallback;
}

export function formatAttendanceFraction(value: number) {
  if (value === 1) return "1 ngày công";
  if (value === 0.75) return "0.75 ngày công";
  if (value === 0.5) return "0.5 ngày công";
  if (value === 0) return "0 ngày công";
  return `${value.toFixed(2)} ngày công`;
}
