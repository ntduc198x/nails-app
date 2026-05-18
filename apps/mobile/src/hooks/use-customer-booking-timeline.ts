import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useSession } from "@/src/providers/session-provider";
import {
  bootCustomerBookingTimeline,
  getCustomerBookingTimelineState,
  refreshCustomerBookingTimeline,
  subscribeCustomerBookingTimeline,
  syncCustomerBookingTimelineFromCache,
} from "@/src/lib/customer-booking-timeline-store";

export function useCustomerBookingTimeline(options: { historyLimit?: number; upcomingLimit?: number } = {}) {
  const { user } = useSession();
  const config = useMemo(
    () => ({
      userId: user?.id ?? null,
      historyLimit: options.historyLimit ?? 8,
      upcomingLimit: options.upcomingLimit ?? 6,
    }),
    [options.historyLimit, options.upcomingLimit, user?.id],
  );

  const state = useSyncExternalStore(
    (listener) => subscribeCustomerBookingTimeline(config, listener),
    () => getCustomerBookingTimelineState(config),
    () => getCustomerBookingTimelineState(config),
  );

  useEffect(() => {
    void bootCustomerBookingTimeline(config);
  }, [config]);

  const refresh = useCallback(() => refreshCustomerBookingTimeline(config, { silent: true }), [config]);
  const syncFromCache = useCallback(() => syncCustomerBookingTimelineFromCache(config), [config]);

  return {
    historyItems: state.historyItems,
    upcomingItems: state.upcomingItems,
    isHydrated: state.isHydrated,
    isLoading: state.isLoading,
    isRefreshing: state.isRefreshing,
    lastError: state.lastError,
    refresh,
    syncFromCache,
  };
}
