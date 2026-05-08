import { useCallback, useEffect, useMemo, useState } from "react";
import { listCustomerFavoriteServiceIds, setCustomerFavoriteService } from "@nails/shared";
import { mobileSupabase } from "@/src/lib/supabase";
import { useSession } from "@/src/providers/session-provider";

export function useCustomerFavorites() {
  const { isHydrated: sessionHydrated, user } = useSession();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
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
      setFavoriteIds(nextIds);
    } catch (error) {
      setFavoriteIds([]);
      setLastError(error instanceof Error ? error.message : "Khong tai duoc danh sach yeu thich");
    } finally {
      setIsHydrated(true);
      setIsSyncing(false);
    }
  }, [sessionHydrated, user]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void refresh();
    }, 0);

    return () => clearTimeout(handle);
  }, [refresh]);

  const toggleFavorite = useCallback(
    async (serviceId: string) => {
      if (!mobileSupabase || !user) {
        return;
      }

      const nextFavoriteState = !favoriteIds.includes(serviceId);
      const optimisticIds = nextFavoriteState
        ? [...favoriteIds, serviceId]
        : favoriteIds.filter((id) => id !== serviceId);

      setFavoriteIds(optimisticIds);

      try {
        setLastError(null);
        await setCustomerFavoriteService(mobileSupabase, {
          serviceId,
          isFavorite: nextFavoriteState,
        });
      } catch (error) {
        setFavoriteIds(favoriteIds);
        setLastError(error instanceof Error ? error.message : "Khong the luu yeu thich");
        throw error;
      }
    },
    [favoriteIds, user],
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
