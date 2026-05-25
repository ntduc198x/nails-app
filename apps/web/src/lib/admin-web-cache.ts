type CacheEntry<T> = {
  value: T;
  at: number;
};

const adminWebCache = new Map<string, CacheEntry<unknown>>();

export function readAdminWebCache<T>(cacheKey: string, ttlMs: number) {
  const entry = adminWebCache.get(cacheKey) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.at > ttlMs) {
    adminWebCache.delete(cacheKey);
    return null;
  }
  return entry.value;
}

export function writeAdminWebCache<T>(cacheKey: string, value: T) {
  adminWebCache.set(cacheKey, { value, at: Date.now() });
  return value;
}

export function invalidateAdminWebCache(prefix: string) {
  for (const cacheKey of adminWebCache.keys()) {
    if (cacheKey.startsWith(prefix)) adminWebCache.delete(cacheKey);
  }
}

export function getAdminWebCacheKeys() {
  return {
    bookingRequests: "booking-requests",
    bookingRequestCount: "booking-request-count",
    bookingLookups: "booking-lookups",
    manageNotifications: "manage-notifications",
  } as const;
}
