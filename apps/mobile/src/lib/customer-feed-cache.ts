import AsyncStorage from "@react-native-async-storage/async-storage";

type CacheEnvelope<T> = {
  updatedAt: number;
  value: T;
};

const memoryCache = new Map<string, CacheEnvelope<unknown>>();
const STORAGE_PREFIX = "customer-feed-cache:";

function getStorageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

export function peekCachedValue<T>(key: string): CacheEnvelope<T> | null {
  const entry = memoryCache.get(key);
  return entry ? (entry as CacheEnvelope<T>) : null;
}

export function getCacheAgeMs(key: string) {
  const entry = peekCachedValue(key);
  if (!entry) return Number.POSITIVE_INFINITY;
  return Date.now() - entry.updatedAt;
}

export function isCacheFresh(key: string, maxAgeMs: number) {
  return getCacheAgeMs(key) <= maxAgeMs;
}

export async function hydrateCachedValue<T>(key: string): Promise<CacheEnvelope<T> | null> {
  const memoryEntry = peekCachedValue<T>(key);
  if (memoryEntry) {
    return memoryEntry;
  }

  try {
    const raw = await AsyncStorage.getItem(getStorageKey(key));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed.updatedAt !== "number" || parsed.value == null) {
      return null;
    }

    memoryCache.set(key, parsed as CacheEnvelope<unknown>);
    return parsed;
  } catch {
    return null;
  }
}

export async function writeCachedValue<T>(key: string, value: T) {
  const nextEntry: CacheEnvelope<T> = {
    updatedAt: Date.now(),
    value,
  };

  memoryCache.set(key, nextEntry as CacheEnvelope<unknown>);

  try {
    await AsyncStorage.setItem(getStorageKey(key), JSON.stringify(nextEntry));
  } catch {
    // Ignore storage write failures and keep memory cache alive for this session.
  }
}

export async function clearCustomerFeedCache() {
  memoryCache.clear();

  try {
    const keys = await AsyncStorage.getAllKeys();
    const targetKeys = keys.filter((key) => key.startsWith(STORAGE_PREFIX));
    if (targetKeys.length) {
      await AsyncStorage.multiRemove(targetKeys);
    }
  } catch {
    // Ignore cache clear failures; callers surface user-friendly errors.
  }
}

export async function getCustomerFeedCacheSizeBytes() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const targetKeys = keys.filter((key) => key.startsWith(STORAGE_PREFIX));
    if (!targetKeys.length) return 0;

    const entries = await AsyncStorage.multiGet(targetKeys);
    return entries.reduce((sum, [key, value]) => sum + key.length + (value?.length ?? 0), 0);
  } catch {
    return 0;
  }
}
