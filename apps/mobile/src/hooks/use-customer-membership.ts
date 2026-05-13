import { useCallback, useEffect, useMemo, useState } from "react";
import { listCustomerMembershipSummary, type CustomerMembershipSummary } from "@nails/shared";
import { hydrateCachedValue, isCacheFresh, writeCachedValue } from "@/src/lib/customer-feed-cache";
import { mobileSupabase } from "@/src/lib/supabase";
import { useSession } from "@/src/providers/session-provider";

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
  eligibleVisitsByTierCode: {},
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
const MEMBERSHIP_FRESH_MS = 2 * 60 * 1000;
const MEMBERSHIP_MAX_STALE_MS = 10 * 60 * 1000;

export function useCustomerMembership() {
  const { user, isHydrated: sessionHydrated } = useSession();
  const cacheKey = useMemo(
    () => (user?.id ? `membership-summary:${user.id}` : "membership-summary:guest"),
    [user?.id],
  );
  const [summary, setSummary] = useState<CustomerMembershipSummary>(EMPTY_MEMBERSHIP);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const refresh = useCallback(async (options: { force?: boolean; silent?: boolean } = {}) => {
    if (!sessionHydrated) {
      return;
    }

    if (!mobileSupabase || !user?.id) {
      console.log("[membership-hook] missing supabase or user", {
        hasSupabase: Boolean(mobileSupabase),
        userId: user?.id ?? null,
      });
      setSummary(EMPTY_MEMBERSHIP);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (!options.force && isCacheFresh(cacheKey, MEMBERSHIP_FRESH_MS)) {
      return;
    }

    if (options.silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setLastError(null);

    try {
      const nextSummary = await listCustomerMembershipSummary(mobileSupabase);
      const normalized = normalizeMembershipSummary(nextSummary);
      console.log("[membership-hook] summary loaded", {
        hasMembership: normalized.hasMembership,
        tiers: normalized.tiers.length,
        currentTier: normalized.currentTier?.name ?? null,
        nextTier: normalized.nextTier?.name ?? null,
        membershipId: normalized.membershipId,
      });
      setSummary(normalized);
      await writeCachedValue(cacheKey, normalized);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : JSON.stringify(error);
      console.log("[membership-hook] summary load failed", { message, error });
      setLastError(message || "Khong tai duoc the thanh vien");
      setSummary(EMPTY_MEMBERSHIP);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [cacheKey, sessionHydrated, user?.id]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (!sessionHydrated) {
        return;
      }

      if (!user?.id || !mobileSupabase) {
        console.log("[membership-hook] boot without user or supabase", {
          hasSupabase: Boolean(mobileSupabase),
          userId: user?.id ?? null,
        });
        setSummary(EMPTY_MEMBERSHIP);
        setIsLoading(false);
        return;
      }

      const cached = await hydrateCachedValue<CustomerMembershipSummary>(cacheKey);
      if (cancelled) return;

      if (cached) {
        setSummary(normalizeMembershipSummary(cached.value));
        setIsLoading(false);

        const age = Date.now() - cached.updatedAt;
        if (age <= MEMBERSHIP_FRESH_MS) {
          return;
        }

        if (age <= MEMBERSHIP_MAX_STALE_MS) {
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
  }, [cacheKey, refresh, sessionHydrated, user?.id]);

  return {
    ...summary,
    isLoading,
    isRefreshing,
    lastError,
    refresh: () => refresh({ silent: true, force: true }),
  };
}
