import { ensureOrgContext } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import { generateWeekDates } from "@nails/shared";
import { OPEN_BOOKING_STATUSES } from "@/lib/booking-capacity";

function toDateKey(dateTime: string) {
  return new Date(dateTime).toISOString().slice(0, 10);
}

export async function loadWeeklyShiftForecast(weekStart: string) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { orgId } = await ensureOrgContext();
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
      .in("status", ["BOOKED", "CHECKED_IN", "DONE"]),
    supabase
      .from("booking_requests")
      .select("requested_start_at,status")
      .eq("org_id", orgId)
      .gte("requested_start_at", startAt)
      .lte("requested_start_at", endAt)
      .in("status", [...OPEN_BOOKING_STATUSES]),
  ]);

  if (appointmentsResult.error) throw appointmentsResult.error;
  if (bookingRequestsResult.error) throw bookingRequestsResult.error;

  const forecast = weekDates.reduce<Record<string, number>>((result, dateKey) => {
    result[dateKey] = 0;
    return result;
  }, {});

  for (const row of appointmentsResult.data ?? []) {
    if (!row.start_at) continue;
    const dateKey = toDateKey(row.start_at);
    if (dateKey in forecast) {
      forecast[dateKey] += 1;
    }
  }

  for (const row of bookingRequestsResult.data ?? []) {
    if (!row.requested_start_at) continue;
    const dateKey = toDateKey(row.requested_start_at);
    if (dateKey in forecast) {
      forecast[dateKey] += 1;
    }
  }

  return forecast;
}
