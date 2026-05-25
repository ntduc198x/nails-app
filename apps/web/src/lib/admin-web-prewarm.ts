import type { AppRole } from "@/lib/auth";
import { countNewBookingRequests, listBookingRequests, type BookingRequestRow } from "@/lib/booking-requests";
import { listResources, listStaffMembers } from "@/lib/domain";
import { loadManageNotifications, type ManageNotificationItem } from "@/lib/manage-notifications";
import { supabase } from "@/lib/supabase";
import { getAdminWebCacheKeys, readAdminWebCache, writeAdminWebCache } from "@/lib/admin-web-cache";
import type { ResourceOption, StaffOption } from "@/components/manage-booking-requests.types";

const LOOKUP_TTL_MS = 5 * 60 * 1000;
const BOOKING_REQUESTS_TTL_MS = 15 * 1000;
const BOOKING_REQUEST_COUNT_TTL_MS = 15 * 1000;
const NOTIFICATIONS_TTL_MS = 15 * 1000;

type BookingLookupsSnapshot = {
  staffOptions: StaffOption[];
  resourceOptions: ResourceOption[];
};

function getSessionStorageCacheKey(scopeKey: string) {
  return `nails.admin.prewarm.${scopeKey}`;
}

async function getAdminScopeKey(role?: AppRole | null) {
  if (!supabase) return `anonymous:${role ?? "unknown"}`;
  const [{ data: sessionData }, orgContextModule] = await Promise.all([
    supabase.auth.getSession(),
    import("@/lib/domain"),
  ]);
  const userId = sessionData.session?.user?.id ?? "anonymous";
  const orgContext = await orgContextModule.ensureOrgContext();
  return `${userId}:${orgContext.orgId}:${role ?? "unknown"}`;
}

function readSessionLookups(scopeKey: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(getSessionStorageCacheKey(scopeKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; value: BookingLookupsSnapshot };
    if (Date.now() - parsed.at > LOOKUP_TTL_MS) {
      window.sessionStorage.removeItem(getSessionStorageCacheKey(scopeKey));
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

function writeSessionLookups(scopeKey: string, value: BookingLookupsSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(getSessionStorageCacheKey(scopeKey), JSON.stringify({ at: Date.now(), value }));
  } catch {}
}

export async function getBookingLookupsSnapshot(opts?: { force?: boolean }) {
  const scopeKey = await getAdminScopeKey();
  const cacheKey = `${getAdminWebCacheKeys().bookingLookups}:${scopeKey}`;

  if (!opts?.force) {
    const memorySnapshot = readAdminWebCache<BookingLookupsSnapshot>(cacheKey, LOOKUP_TTL_MS);
    if (memorySnapshot) return memorySnapshot;

    const sessionSnapshot = readSessionLookups(scopeKey);
    if (sessionSnapshot) {
      writeAdminWebCache(cacheKey, sessionSnapshot);
      return sessionSnapshot;
    }
  }

  const [staffOptions, resourceOptions] = await Promise.all([
    listStaffMembers(),
    listResources({ activeOnly: true }),
  ]);
  const snapshot = {
    staffOptions: staffOptions as StaffOption[],
    resourceOptions: resourceOptions as ResourceOption[],
  };
  writeAdminWebCache(cacheKey, snapshot);
  writeSessionLookups(scopeKey, snapshot);
  return snapshot;
}

export async function getBookingRequestsSnapshot(opts?: { force?: boolean }) {
  const scopeKey = await getAdminScopeKey();
  const cacheKey = `${getAdminWebCacheKeys().bookingRequests}:${scopeKey}`;

  if (!opts?.force) {
    const cached = readAdminWebCache<BookingRequestRow[]>(cacheKey, BOOKING_REQUESTS_TTL_MS);
    if (cached) return cached;
  }

  const bookingRequests = await listBookingRequests();
  return writeAdminWebCache(cacheKey, bookingRequests as BookingRequestRow[]);
}

export async function getBookingRequestCountSnapshot(opts?: { force?: boolean }) {
  const scopeKey = await getAdminScopeKey();
  const cacheKey = `${getAdminWebCacheKeys().bookingRequestCount}:${scopeKey}`;

  if (!opts?.force) {
    const cached = readAdminWebCache<number>(cacheKey, BOOKING_REQUEST_COUNT_TTL_MS);
    if (cached !== null) return cached;
  }

  const bookingRequestCount = await countNewBookingRequests();
  return writeAdminWebCache(cacheKey, bookingRequestCount);
}

export async function getManageNotificationsSnapshot(role: AppRole, opts?: { force?: boolean }) {
  const scopeKey = await getAdminScopeKey(role);
  const cacheKey = `${getAdminWebCacheKeys().manageNotifications}:${scopeKey}`;

  if (!opts?.force) {
    const cached = readAdminWebCache<ManageNotificationItem[]>(cacheKey, NOTIFICATIONS_TTL_MS);
    if (cached) return cached;
  }

  const notifications = await loadManageNotifications(role);
  return writeAdminWebCache(cacheKey, notifications);
}

export async function prewarmBookingServicesData() {
  await Promise.all([
    getBookingLookupsSnapshot(),
    getBookingRequestsSnapshot(),
    getBookingRequestCountSnapshot(),
  ]);
}

export async function prewarmManageShellData(role: AppRole) {
  await Promise.all([
    getManageNotificationsSnapshot(role),
    prewarmBookingServicesData(),
  ]);
}
