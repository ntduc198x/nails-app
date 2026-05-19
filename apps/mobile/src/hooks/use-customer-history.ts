import { useCallback, useEffect, useMemo, useState } from "react";
import { listCustomerHistory, type CustomerHistoryItem } from "@nails/shared";
import { hydrateCachedValue, isCacheFresh, peekCachedValue, writeCachedValue } from "@/src/lib/customer-feed-cache";
import { mobileSupabase } from "@/src/lib/supabase";
import { useSession } from "@/src/providers/session-provider";

const HISTORY_FRESH_MS = 90 * 1000;
const HISTORY_MAX_STALE_MS = 10 * 60 * 1000;
export const CUSTOMER_HISTORY_LIMITS_TO_PREWARM = [8, 24] as const;

type UseCustomerHistoryOptions = {
  enabled?: boolean;
  revalidateOnMount?: boolean;
};

export function useCustomerHistory(limit = 24, options: UseCustomerHistoryOptions = {}) {
  const { isHydrated: sessionHydrated, user } = useSession();
  const userId = user?.id ?? null;
  const enabled = options.enabled ?? true;
  const revalidateOnMount = options.revalidateOnMount ?? true;

  const cacheKey = useMemo(
    () => (userId ? `customer-history:${userId}:${limit}` : `customer-history:guest:${limit}`),
    [limit, userId],
  );
  const initialCached = useMemo(() => peekCachedValue<CustomerHistoryItem[]>(cacheKey), [cacheKey]);
  const [historyItems, setHistoryItems] = useState<CustomerHistoryItem[]>(() =>
    Array.isArray(initialCached?.value) ? initialCached.value : [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(() => Boolean(initialCached) || !userId);

  const fetchRemote = useCallback(async () => {
    if (!mobileSupabase || !userId) {
      return [] as CustomerHistoryItem[];
    }

    const nextItems = await listCustomerHistory(mobileSupabase, { limit });
    await writeCachedValue(cacheKey, nextItems);
    return nextItems;
  }, [cacheKey, limit, userId]);

  const refresh = useCallback(async (options: { force?: boolean; silent?: boolean; skipFreshCheck?: boolean } = {}) => {
    if (!enabled || !sessionHydrated) {
      return;
    }

    if (!mobileSupabase || !userId) {
      setHistoryItems([]);
      setIsHydrated(true);
      setIsLoading(false);
      return;
    }

    if (!options.force && !options.skipFreshCheck && isCacheFresh(cacheKey, HISTORY_FRESH_MS)) {
      setIsHydrated(true);
      return;
    }

    if (!options.silent) {
      setIsLoading(true);
    }

    try {
      const nextItems = await fetchRemote();
      setHistoryItems(nextItems);
    } catch {
      if (options.force) {
        setHistoryItems([]);
      }
    } finally {
      setIsHydrated(true);
      if (!options.silent) {
        setIsLoading(false);
      }
    }
  }, [cacheKey, enabled, fetchRemote, sessionHydrated, userId]);

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !userId) return;

    const syncCached = peekCachedValue<CustomerHistoryItem[]>(cacheKey);
    if (syncCached) {
      const timeoutId = setTimeout(() => {
        if (cancelled) return;
        setHistoryItems(Array.isArray(syncCached.value) ? syncCached.value : []);
        setIsHydrated(true);
        setIsLoading(false);
      }, 0);

      if (
        revalidateOnMount &&
        Date.now() - syncCached.updatedAt > HISTORY_FRESH_MS &&
        Date.now() - syncCached.updatedAt <= HISTORY_MAX_STALE_MS
      ) {
        setTimeout(() => {
          void refresh({ silent: true, skipFreshCheck: true });
        }, 0);
      }
      return () => {
        clearTimeout(timeoutId);
      };
    }

    const boot = async () => {
      const cached = await hydrateCachedValue<CustomerHistoryItem[]>(cacheKey);
      if (cancelled) return;

      if (cached) {
        setHistoryItems(Array.isArray(cached.value) ? cached.value : []);
        setIsHydrated(true);
        setIsLoading(false);

        if (
          revalidateOnMount &&
          Date.now() - cached.updatedAt > HISTORY_FRESH_MS &&
          Date.now() - cached.updatedAt <= HISTORY_MAX_STALE_MS
        ) {
          void refresh({ silent: true, skipFreshCheck: true });
        }
        return;
      }

      void refresh();
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, enabled, refresh, revalidateOnMount, userId]);

  const resolvedHistoryItems = enabled && userId ? historyItems : [];
  const resolvedIsHydrated = enabled && userId ? isHydrated : true;
  const resolvedIsLoading = enabled && userId ? isLoading : false;

  const syncFromCache = useCallback(async () => {
    const syncCached = peekCachedValue<CustomerHistoryItem[]>(cacheKey);
    if (syncCached) {
      setHistoryItems(Array.isArray(syncCached.value) ? syncCached.value : []);
      setIsHydrated(true);
      return;
    }

    const cached = await hydrateCachedValue<CustomerHistoryItem[]>(cacheKey);
    if (cached) {
      setHistoryItems(Array.isArray(cached.value) ? cached.value : []);
      setIsHydrated(true);
    }
  }, [cacheKey]);

  return {
    historyItems: resolvedHistoryItems,
    isHydrated: resolvedIsHydrated,
    isLoading: resolvedIsLoading,
    refresh: () => refresh({ force: true }),
    syncFromCache,
  };
}
