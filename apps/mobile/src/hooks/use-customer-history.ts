import { useCallback, useEffect, useState } from "react";
import { listCustomerHistory, type CustomerHistoryItem } from "@nails/shared";
import { hydrateCachedValue, isCacheFresh, writeCachedValue } from "@/src/lib/customer-feed-cache";
import { mobileSupabase } from "@/src/lib/supabase";
import { useSession } from "@/src/providers/session-provider";

const HISTORY_FRESH_MS = 90 * 1000;
const HISTORY_MAX_STALE_MS = 10 * 60 * 1000;

export function useCustomerHistory(limit = 24) {
  const { isHydrated: sessionHydrated, user } = useSession();
  const [historyItems, setHistoryItems] = useState<CustomerHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const cacheKey = user?.id ? `customer-history:${user.id}:${limit}` : `customer-history:guest:${limit}`;

  const refresh = useCallback(async (options: { force?: boolean; silent?: boolean } = {}) => {
    if (!sessionHydrated) {
      return;
    }

    if (!mobileSupabase || !user) {
      setHistoryItems([]);
      setIsHydrated(true);
      return;
    }

    if (!options.force && isCacheFresh(cacheKey, HISTORY_FRESH_MS)) {
      setIsHydrated(true);
      return;
    }

    setIsLoading(true);

    try {
      const nextItems = await listCustomerHistory(mobileSupabase, { limit });
      setHistoryItems(nextItems);
      await writeCachedValue(cacheKey, nextItems);
    } catch {
      if (options.force) {
        setHistoryItems([]);
      }
    } finally {
      setIsHydrated(true);
      setIsLoading(false);
    }
  }, [cacheKey, limit, sessionHydrated, user]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (!user?.id) {
        setIsHydrated(true);
        return;
      }

      const cached = await hydrateCachedValue<CustomerHistoryItem[]>(cacheKey);
      if (cancelled) return;

      if (cached) {
        setHistoryItems(Array.isArray(cached.value) ? cached.value : []);
        setIsHydrated(true);
        setIsLoading(false);

        if (Date.now() - cached.updatedAt <= HISTORY_MAX_STALE_MS) {
          void refresh({ silent: true });
          return;
        }
      }

      void refresh();
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, refresh, user?.id]);

  return {
    historyItems,
    isHydrated,
    isLoading,
    refresh: () => refresh({ force: true }),
  };
}
