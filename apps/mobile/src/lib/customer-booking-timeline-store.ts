import { listCustomerHistory, listCustomerUpcomingBookings, type CustomerHistoryItem, type CustomerUpcomingBookingItem } from "@nails/shared";
import { hydrateCachedValue, isCacheFresh, peekCachedValue, writeCachedValue } from "@/src/lib/customer-feed-cache";
import { mobileSupabase } from "@/src/lib/supabase";

type TimelineState = {
  historyItems: CustomerHistoryItem[];
  upcomingItems: CustomerUpcomingBookingItem[];
  isHydrated: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  lastError: string | null;
};

type TimelineConfig = {
  userId: string | null;
  historyLimit: number;
  upcomingLimit: number;
};

const store = new Map<string, TimelineState>();
const listeners = new Map<string, Set<() => void>>();
const inflight = new Map<string, Promise<void>>();
const EMPTY_TIMELINE_STATE: TimelineState = {
  historyItems: [],
  upcomingItems: [],
  isHydrated: false,
  isLoading: false,
  isRefreshing: false,
  lastError: null,
};
const TIMELINE_FRESH_MS = 90 * 1000;

function makeStoreKey(config: TimelineConfig) {
  return `${config.userId ?? "guest"}:${config.historyLimit}:${config.upcomingLimit}`;
}

function getHistoryCacheKey(userId: string, limit: number) {
  return `customer-history:${userId}:${limit}`;
}

function getUpcomingCacheKey(userId: string, limit: number) {
  return `customer-upcoming-bookings:${userId}:${limit}`;
}

function getDefaultState(): TimelineState {
  return EMPTY_TIMELINE_STATE;
}

function emit(storeKey: string) {
  const subs = listeners.get(storeKey);
  if (!subs) return;
  subs.forEach((listener) => listener());
}

function setState(storeKey: string, nextState: TimelineState | ((prev: TimelineState) => TimelineState)) {
  const prev = store.get(storeKey) ?? getDefaultState();
  const resolved = typeof nextState === "function" ? nextState(prev) : nextState;
  store.set(storeKey, resolved);
  emit(storeKey);
}

export function getCustomerBookingTimelineState(config: TimelineConfig): TimelineState {
  return store.get(makeStoreKey(config)) ?? getDefaultState();
}

export function subscribeCustomerBookingTimeline(config: TimelineConfig, listener: () => void) {
  const storeKey = makeStoreKey(config);
  const subs = listeners.get(storeKey) ?? new Set<() => void>();
  subs.add(listener);
  listeners.set(storeKey, subs);
  return () => {
    const current = listeners.get(storeKey);
    if (!current) return;
    current.delete(listener);
    if (!current.size) {
      listeners.delete(storeKey);
    }
  };
}

export async function syncCustomerBookingTimelineFromCache(config: TimelineConfig) {
  if (!config.userId) {
    setState(makeStoreKey(config), { ...getDefaultState(), isHydrated: true });
    return;
  }

  const storeKey = makeStoreKey(config);
  const historyKey = getHistoryCacheKey(config.userId, config.historyLimit);
  const upcomingKey = getUpcomingCacheKey(config.userId, config.upcomingLimit);

  const historyPeek = peekCachedValue<CustomerHistoryItem[]>(historyKey);
  const upcomingPeek = peekCachedValue<CustomerUpcomingBookingItem[]>(upcomingKey);
  if (historyPeek || upcomingPeek) {
    setState(storeKey, (prev) => ({
      ...prev,
      historyItems: Array.isArray(historyPeek?.value) ? historyPeek!.value : prev.historyItems,
      upcomingItems: Array.isArray(upcomingPeek?.value) ? upcomingPeek!.value : prev.upcomingItems,
      isHydrated: true,
      isLoading: false,
    }));
    return;
  }

  const [historyCached, upcomingCached] = await Promise.all([
    hydrateCachedValue<CustomerHistoryItem[]>(historyKey),
    hydrateCachedValue<CustomerUpcomingBookingItem[]>(upcomingKey),
  ]);

  setState(storeKey, (prev) => ({
    ...prev,
    historyItems: Array.isArray(historyCached?.value) ? historyCached!.value : prev.historyItems,
    upcomingItems: Array.isArray(upcomingCached?.value) ? upcomingCached!.value : prev.upcomingItems,
    isHydrated: true,
    isLoading: false,
  }));
}

export async function refreshCustomerBookingTimeline(config: TimelineConfig, options: { silent?: boolean } = {}) {
  const storeKey = makeStoreKey(config);
  if (!config.userId || !mobileSupabase) {
    setState(storeKey, { ...getDefaultState(), isHydrated: true });
    return;
  }

  const existing = inflight.get(storeKey);
  if (existing) {
    await existing;
    return;
  }

  const run = (async () => {
    setState(storeKey, (prev) => ({
      ...prev,
      isHydrated: true,
      isLoading: options.silent ? prev.isLoading : true,
      isRefreshing: options.silent ? true : prev.isRefreshing,
      lastError: null,
    }));

    try {
      try {
        await mobileSupabase.rpc("link_customer_account_for_current_user");
      } catch {
        // Best-effort relink before timeline fetch.
      }
      try {
        await mobileSupabase.rpc("link_customer_account_by_phone");
      } catch {
        // Best-effort relink before timeline fetch.
      }

      const [historyItems, upcomingItems] = await Promise.all([
        listCustomerHistory(mobileSupabase, { limit: config.historyLimit }),
        listCustomerUpcomingBookings(mobileSupabase, { limit: config.upcomingLimit }),
      ]);

      await Promise.all([
        writeCachedValue(getHistoryCacheKey(config.userId!, config.historyLimit), historyItems),
        writeCachedValue(getUpcomingCacheKey(config.userId!, config.upcomingLimit), upcomingItems),
      ]);

      setState(storeKey, {
        historyItems,
        upcomingItems,
        isHydrated: true,
        isLoading: false,
        isRefreshing: false,
        lastError: null,
      });
    } catch (error) {
      setState(storeKey, (prev) => ({
        ...prev,
        isHydrated: true,
        isLoading: false,
        isRefreshing: false,
        lastError: error instanceof Error ? error.message : "Khong tai duoc timeline dat lich",
      }));
    } finally {
      inflight.delete(storeKey);
    }
  })();

  inflight.set(storeKey, run);
  await run;
}

export async function bootCustomerBookingTimeline(config: TimelineConfig) {
  const storeKey = makeStoreKey(config);
  if (!config.userId) {
    setState(storeKey, { ...getDefaultState(), isHydrated: true });
    return;
  }

  const currentState = store.get(storeKey);
  if (!currentState?.isHydrated && !currentState?.isLoading) {
    setState(storeKey, (prev) => ({ ...prev, isLoading: true }));
  }

  await syncCustomerBookingTimelineFromCache(config);

  const current = store.get(storeKey) ?? getDefaultState();
  const historyFresh = isCacheFresh(getHistoryCacheKey(config.userId, config.historyLimit), TIMELINE_FRESH_MS);
  const upcomingFresh = isCacheFresh(getUpcomingCacheKey(config.userId, config.upcomingLimit), TIMELINE_FRESH_MS);

  if (!current.historyItems.length && !current.upcomingItems.length) {
    await refreshCustomerBookingTimeline(config);
    return;
  }

  if (!historyFresh || !upcomingFresh) {
    await refreshCustomerBookingTimeline(config, { silent: true });
  }
}
