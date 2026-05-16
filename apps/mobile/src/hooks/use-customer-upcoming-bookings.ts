import { useCallback, useEffect, useState } from "react";
import { listCustomerUpcomingBookings, type CustomerUpcomingBookingItem } from "@nails/shared";
import { mobileSupabase } from "@/src/lib/supabase";
import { useSession } from "@/src/providers/session-provider";

export function useCustomerUpcomingBookings(limit = 8) {
  const { isHydrated, user } = useSession();
  const [items, setItems] = useState<CustomerUpcomingBookingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
        setItems(nextItems);
      } catch (error) {
        setItems([]);
        setLastError(error instanceof Error ? error.message : "Khong tai duoc lich da giu");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isHydrated, limit, user],
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void refresh();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [refresh]);
  return {
    items,
    isLoading,
    isRefreshing,
    lastError,
    refresh: () => refresh({ silent: true }),
  };
}
