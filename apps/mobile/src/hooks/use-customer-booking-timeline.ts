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
  const { isHydrated: sessionHydrated, user } = useSession();
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
    if (!sessionHydrated) {
      return;
    }
    void bootCustomerBookingTimeline(config);
  }, [config, sessionHydrated]);

  const refresh = useCallback(() => {
    if (!sessionHydrated) {
      return Promise.resolve();
    }
    return refreshCustomerBookingTimeline(config, { silent: true });
  }, [config, sessionHydrated]);
  const syncFromCache = useCallback(() => {
    if (!sessionHydrated && config.userId) {
      return Promise.resolve();
    }
    return syncCustomerBookingTimelineFromCache(config);
  }, [config, sessionHydrated]);

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
