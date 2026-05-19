import type { SupabaseClient } from "@supabase/supabase-js";

const REQUEST_WINDOW_MS = 10 * 60 * 1000;
const REQUEST_BURST_WINDOW_MS = 60 * 1000;
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_IP = 8;
const MAX_REQUESTS_PER_PHONE = 4;
const MAX_PHONE_BURST = 2;
const ACTIVE_BOOKING_STATUSES = ["NEW", "CONFIRMED", "NEEDS_RESCHEDULE", "CONVERTED"] as const;

type PublicBookingRateLimitState = {
  byKey: Map<string, number[]>;
};

type PublicBookingGuardResult =
  | { allowed: true }
  | { allowed: false; status: number; error: string };

function getRateLimitState() {
  const globalState = globalThis as typeof globalThis & {
    __publicBookingRateLimitState?: PublicBookingRateLimitState;
  };

  if (!globalState.__publicBookingRateLimitState) {
    globalState.__publicBookingRateLimitState = {
      byKey: new Map<string, number[]>(),
    };
  }

  return globalState.__publicBookingRateLimitState;
}

function normalizePhone(raw: string | null | undefined) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("84") && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

function resolveClientIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  return forwardedFor || realIp || "unknown";
}

function touchRateLimitBucket(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const state = getRateLimitState();
  const entries = state.byKey.get(key) ?? [];
  const nextEntries = entries.filter((value) => now - value < windowMs);

  if (nextEntries.length >= limit) {
    state.byKey.set(key, nextEntries);
    return false;
  }

  nextEntries.push(now);
  state.byKey.set(key, nextEntries);
  return true;
}

export async function assertPublicBookingRequestAllowed(input: {
  req: Request;
  client: SupabaseClient | null;
  customerPhone: string;
  requestedStartAt: string;
}): Promise<PublicBookingGuardResult> {
  const ip = resolveClientIp(input.req);
  const normalizedPhone = normalizePhone(input.customerPhone);

  if (!touchRateLimitBucket(`ip:${ip}`, MAX_REQUESTS_PER_IP, REQUEST_WINDOW_MS)) {
    return {
      allowed: false,
      status: 429,
      error: "Bạn gửi yêu cầu quá nhanh. Vui lòng chờ ít phút rồi thử lại.",
    };
  }

  if (normalizedPhone && !touchRateLimitBucket(`phone:${normalizedPhone}`, MAX_REQUESTS_PER_PHONE, REQUEST_WINDOW_MS)) {
    return {
      allowed: false,
      status: 429,
      error: "Số điện thoại này vừa gửi quá nhiều yêu cầu. Vui lòng thử lại sau.",
    };
  }

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
