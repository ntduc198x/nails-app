import { useCallback, useEffect, useState } from "react";
import { listCustomerHistory, type CustomerHistoryItem } from "@nails/shared";
import { hydrateCachedValue, isCacheFresh, writeCachedValue } from "@/src/lib/customer-feed-cache";
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
  const [historyItems, setHistoryItems] = useState<CustomerHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const enabled = options.enabled ?? true;
  const revalidateOnMount = options.revalidateOnMount ?? true;

  const cacheKey = userId ? `customer-history:${userId}:${limit}` : `customer-history:guest:${limit}`;

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

    const boot = async () => {
      if (!userId) {
        setHistoryItems([]);
        setIsHydrated(true);
        setIsLoading(false);
        return;
      }

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

    if (!enabled) {
      setIsLoading(false);
      return;
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, enabled, refresh, revalidateOnMount, userId]);

  return {
    historyItems,
    isHydrated,
    isLoading,
    refresh: () => refresh({ force: true }),
  };
}
