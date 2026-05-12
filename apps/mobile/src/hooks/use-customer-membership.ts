import { useCallback, useEffect, useState } from "react";
import { listCustomerMembershipSummary, type CustomerMembershipSummary } from "@nails/shared";
import { hydrateCachedValue, isCacheFresh, writeCachedValue } from "@/src/lib/customer-feed-cache";
import { mobileSupabase } from "@/src/lib/supabase";

const EMPTY_MEMBERSHIP: CustomerMembershipSummary = {
  hasMembership: false,
  membershipId: null,
  currentTier: null,
  nextTier: null,
  tiers: [],
  pointsBalance: 0,
  lifetimePoints: 0,
  totalSpent: 0,
  totalVisits: 0,
  eligibleVisitsMinSpend: 0,
  joinedAt: null,
  expiresAt: null,
  progress: 0,
  progressSpent: 0,
  progressVisits: 0,
  remainingSpentToNext: 0,
  remainingVisitsToNext: 0,
  isTopTier: false,
  perks: [],
  offers: [],
};

function normalizeMembershipSummary(
  value: Partial<CustomerMembershipSummary> | null | undefined,
): CustomerMembershipSummary {
  return {
    ...EMPTY_MEMBERSHIP,
    ...value,
    tiers: Array.isArray(value?.tiers) ? value.tiers : [],
    perks: Array.isArray(value?.perks) ? value.perks : [],
    offers: Array.isArray(value?.offers) ? value.offers : [],
  };
}
const MEMBERSHIP_CACHE_KEY = "membership-summary";
const MEMBERSHIP_FRESH_MS = 2 * 60 * 1000;
const MEMBERSHIP_MAX_STALE_MS = 10 * 60 * 1000;

export function useCustomerMembership() {
  const [summary, setSummary] = useState<CustomerMembershipSummary>(EMPTY_MEMBERSHIP);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const refresh = useCallback(async (options: { force?: boolean; silent?: boolean } = {}) => {
    if (!options.force && isCacheFresh(MEMBERSHIP_CACHE_KEY, MEMBERSHIP_FRESH_MS)) {
      return;
    }

    if (options.silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setLastError(null);

    try {
      if (!mobileSupabase) {
        setSummary(EMPTY_MEMBERSHIP);
        return;
      }

      const nextSummary = await listCustomerMembershipSummary(mobileSupabase);
      const normalized = normalizeMembershipSummary(nextSummary);
      setSummary(normalized);
      await writeCachedValue(MEMBERSHIP_CACHE_KEY, normalized);
    } catch (error) {
      setLastError(error instanceof Error ? error.message : "Khong tai duoc the thanh vien");
      setSummary(EMPTY_MEMBERSHIP);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const cached = await hydrateCachedValue<CustomerMembershipSummary>(MEMBERSHIP_CACHE_KEY);
      if (cancelled) return;

      if (cached) {
        setSummary(normalizeMembershipSummary(cached.value));
        setIsLoading(false);
        if (Date.now() - cached.updatedAt <= MEMBERSHIP_MAX_STALE_MS) {
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
  }, [refresh]);

  return {
    ...summary,
    isLoading,
    isRefreshing,
    lastError,
    refresh: () => refresh({ silent: true, force: true }),
  };
}
