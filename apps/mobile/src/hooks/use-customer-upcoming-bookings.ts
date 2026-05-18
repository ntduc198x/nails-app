import { useCallback, useEffect, useMemo, useState } from "react";
import { listCustomerUpcomingBookings, type CustomerUpcomingBookingItem } from "@nails/shared";
import { hydrateCachedValue, peekCachedValue, writeCachedValue } from "@/src/lib/customer-feed-cache";
import { mobileSupabase } from "@/src/lib/supabase";
import { useSession } from "@/src/providers/session-provider";

export function useCustomerUpcomingBookings(limit = 8) {
  const { isHydrated, user } = useSession();
  const cacheKey = useMemo(() => (user?.id ? `customer-upcoming-bookings:${user.id}:${limit}` : `customer-upcoming-bookings:guest:${limit}`), [limit, user?.id]);
  const initialCached = useMemo(() => peekCachedValue<CustomerUpcomingBookingItem[]>(cacheKey), [cacheKey]);
  const [items, setItems] = useState<CustomerUpcomingBookingItem[]>(() => Array.isArray(initialCached?.value) ? initialCached.value : []);
  const [isLoading, setIsLoading] = useState(!initialCached);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const refresh = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!isHydrated) return;

      if (!mobileSupabase || !user) {
        setItems([]);
        setLastError(null);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (options.silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        setLastError(null);
        const nextItems = await listCustomerUpcomingBookings(mobileSupabase, { limit });
        await writeCachedValue(cacheKey, nextItems);
        setItems(nextItems);
      } catch (error) {
        setItems([]);
        setLastError(error instanceof Error ? error.message : "Khong tai duoc lich da giu");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [cacheKey, isHydrated, limit, user],
  );

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const cached = await hydrateCachedValue<CustomerUpcomingBookingItem[]>(cacheKey);
      if (cancelled) return;
      if (cached) {
        setItems(Array.isArray(cached.value) ? cached.value : []);
        setIsLoading(false);
        return;
      }
      void refresh();
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, refresh]);

  const syncFromCache = useCallback(async () => {
    const syncCached = peekCachedValue<CustomerUpcomingBookingItem[]>(cacheKey);
    if (syncCached) {
      setItems(Array.isArray(syncCached.value) ? syncCached.value : []);
      setIsLoading(false);
      return;
    }

    const cached = await hydrateCachedValue<CustomerUpcomingBookingItem[]>(cacheKey);
    if (cached) {
      setItems(Array.isArray(cached.value) ? cached.value : []);
      setIsLoading(false);
    }
  }, [cacheKey]);

  return {
    items,
    isLoading,
    isRefreshing,
    lastError,
    refresh: () => refresh({ silent: true }),
    syncFromCache,
  };
}
