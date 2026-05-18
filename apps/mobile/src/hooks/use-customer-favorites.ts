import { useCallback, useEffect, useMemo, useState } from "react";
import { listCustomerFavoriteServiceIds, setCustomerFavoriteService } from "@nails/shared";
import { hydrateCachedValue, peekCachedValue, writeCachedValue } from "@/src/lib/customer-feed-cache";
import { mobileSupabase } from "@/src/lib/supabase";
import { useSession } from "@/src/providers/session-provider";

export function useCustomerFavorites(options: { autoRefreshOnMount?: boolean } = {}) {
  const { isHydrated: sessionHydrated, user } = useSession();
  const autoRefreshOnMount = options.autoRefreshOnMount ?? true;
  const favoriteCacheKey = user?.id ? `favorites:${user.id}` : "favorites:guest";
  const initialCached = peekCachedValue<string[]>(favoriteCacheKey);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    Array.isArray(initialCached?.value) ? initialCached.value : [],
  );
  const [isHydrated, setIsHydrated] = useState(() => Boolean(initialCached) || !user);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionHydrated) {
      return;
    }

    if (!mobileSupabase || !user) {
      setFavoriteIds([]);
      setIsHydrated(true);
      return;
    }

    setIsSyncing(true);

    try {
      setLastError(null);
      const nextIds = await listCustomerFavoriteServiceIds(mobileSupabase);
      await writeCachedValue(favoriteCacheKey, nextIds);
      setFavoriteIds(nextIds);
    } catch (error) {
      setFavoriteIds([]);
      setLastError(error instanceof Error ? error.message : "Khong tai duoc danh sach yeu thich");
    } finally {
      setIsHydrated(true);
      setIsSyncing(false);
    }
  }, [favoriteCacheKey, sessionHydrated, user]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const cached = await hydrateCachedValue<string[]>(favoriteCacheKey);
      if (cancelled) return;

      if (cached) {
        setFavoriteIds(Array.isArray(cached.value) ? cached.value : []);
        setIsHydrated(true);
        if (!autoRefreshOnMount) {
          return;
        }
      }

      if (autoRefreshOnMount || !cached) {
        void refresh();
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [autoRefreshOnMount, favoriteCacheKey, refresh]);

  const toggleFavorite = useCallback(
    async (serviceId: string) => {
      if (!mobileSupabase || !user) {
        return;
      }

      const nextFavoriteState = !favoriteIds.includes(serviceId);
      const optimisticIds = nextFavoriteState
        ? [...favoriteIds, serviceId]
        : favoriteIds.filter((id) => id !== serviceId);

      void writeCachedValue(favoriteCacheKey, optimisticIds);
      setFavoriteIds(optimisticIds);

      try {
        setLastError(null);
        await setCustomerFavoriteService(mobileSupabase, {
          serviceId,
          isFavorite: nextFavoriteState,
        });
      } catch (error) {
        void writeCachedValue(favoriteCacheKey, favoriteIds);
        setFavoriteIds(favoriteIds);
        setLastError(error instanceof Error ? error.message : "Khong the luu yeu thich");
        throw error;
      }
    },
    [favoriteCacheKey, favoriteIds, user],
  );

  const favoritesSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  return {
    favoriteIds,
    favoritesSet,
    isFavorite: (serviceId: string) => favoritesSet.has(serviceId),
    isHydrated,
    isSyncing,
    lastError,
    refresh,
    toggleFavorite,
  };
}
