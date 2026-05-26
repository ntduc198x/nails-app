import type { SupabaseClient } from "@supabase/supabase-js";

const REQUEST_BURST_WINDOW_MS = 60 * 1000;
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;
const MAX_PHONE_BURST = 2;
const ACTIVE_BOOKING_STATUSES = ["NEW", "CONFIRMED", "NEEDS_RESCHEDULE", "CONVERTED"] as const;

type PublicBookingGuardResult =
  | { allowed: true }
  | { allowed: false; status: number; error: string };

function normalizePhone(raw: string | null | undefined) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("84") && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

export async function assertPublicBookingRequestAllowed(input: {
  client: SupabaseClient | null;
  customerPhone: string;
  requestedStartAt: string;
}): Promise<PublicBookingGuardResult> {
  const normalizedPhone = normalizePhone(input.customerPhone);

  if (!input.client || !normalizedPhone) {
    return { allowed: true };
  }

  const duplicateCutoffIso = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const duplicateLookup = await input.client
    .from("booking_requests")
    .select("id")
    .eq("customer_phone", normalizedPhone)
    .eq("requested_start_at", input.requestedStartAt)
    .gte("created_at", duplicateCutoffIso)
    .in("status", [...ACTIVE_BOOKING_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!duplicateLookup.error && duplicateLookup.data?.id) {
    return {
      allowed: false,
      status: 409,
      error: "Yêu cầu đặt lịch trùng vừa được gửi. Vui lòng kiểm tra lại hoặc chờ ít phút rồi thử lại.",
    };
  }

  const burstCutoffIso = new Date(Date.now() - REQUEST_BURST_WINDOW_MS).toISOString();
  const burstLookup = await input.client
    .from("booking_requests")
    .select("id", { count: "exact", head: true })
    .eq("customer_phone", normalizedPhone)
    .gte("created_at", burstCutoffIso)
    .in("status", [...ACTIVE_BOOKING_STATUSES]);

  if (!burstLookup.error && (burstLookup.count ?? 0) >= MAX_PHONE_BURST) {
    return {
      allowed: false,
      status: 429,
      error: "Bạn đang gửi yêu cầu quá nhanh cho cùng một số điện thoại. Vui lòng thử lại sau.",
    };
  }

  return { allowed: true };
}
