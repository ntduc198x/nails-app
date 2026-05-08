import { useCallback, useEffect, useState } from "react";
import {
  getCustomerScopedContext,
  getCustomerScopedContextForGuest,
  listCustomerExploreForContext,
} from "@nails/shared";
import type {
  CustomerExplorePayload,
} from "@nails/shared";
import { hydrateCachedValue, isCacheFresh, writeCachedValue } from "@/src/lib/customer-feed-cache";
import { mobileEnv } from "@/src/lib/env";
import { prefetchCustomerImagesForIntent } from "@/src/lib/customer-image-cache";
import { mobileSupabase } from "@/src/lib/supabase";

const EMPTY_EXPLORE_PAYLOAD: CustomerExplorePayload = {
  storefront: null,
  stats: [],
  featuredServices: [],
  products: [],
  team: [],
  gallery: [],
  offers: [],
  map: null,
};
const EXPLORE_CACHE_KEY = "explore";
const EXPLORE_FRESH_MS = 2 * 60 * 1000;
const EXPLORE_MAX_STALE_MS = 10 * 60 * 1000;

function hasRealExploreData(payload: CustomerExplorePayload | null | undefined) {
  return Boolean(
    payload &&
      (payload.storefront ||
        payload.featuredServices.length ||
        payload.products.length ||
        payload.team.length ||
        payload.gallery.length ||
        payload.offers.length),
  );
}

export function useCustomerExplore() {
  const [payload, setPayload] = useState<CustomerExplorePayload>(EMPTY_EXPLORE_PAYLOAD);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const loadFromApi = useCallback(async () => {
    if (!mobileEnv.apiBaseUrl || !mobileSupabase) return null;

    try {
      const {
        data: { session },
      } = await mobileSupabase.auth.getSession();

      if (!session?.access_token) {
        return null;
      }

      const response = await fetch(`${mobileEnv.apiBaseUrl.replace(/\/$/, "")}/api/customer/explore`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const json = (await response.json()) as {
        ok?: boolean;
        data?: CustomerExplorePayload;
        error?: string;
      };

      if (!response.ok || !json.ok || !json.data) {
        return null;
      }

      return json.data;
    } catch {
      return null;
    }
  }, []);

  const loadFromSupabase = useCallback(async () => {
    if (!mobileSupabase) return null;
    let scope = await getCustomerScopedContext(mobileSupabase);
    if (!scope && mobileEnv.defaultOrgId) {
      scope = getCustomerScopedContextForGuest(mobileEnv.defaultOrgId, mobileEnv.defaultBranchId || null);
    }
    if (!scope) return null;
    return listCustomerExploreForContext(mobileSupabase, scope);
  }, []);

  const refresh = useCallback(
    async (options: { silent?: boolean; force?: boolean } = {}) => {
      const shouldUseFreshCache = !options.force && isCacheFresh(EXPLORE_CACHE_KEY, EXPLORE_FRESH_MS);
      if (shouldUseFreshCache) {
        return;
      }

      if (options.silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setLastError(null);

      try {
        const apiPayload = await loadFromApi();
        if (apiPayload && hasRealExploreData(apiPayload)) {
          setPayload(apiPayload);
          await writeCachedValue(EXPLORE_CACHE_KEY, apiPayload);
          await Promise.all([
            prefetchCustomerImagesForIntent([apiPayload.storefront?.coverImageUrl, apiPayload.map?.imageUrl], "hero"),
            prefetchCustomerImagesForIntent(apiPayload.featuredServices.slice(0, 4).map((item) => item.image), "card"),
            prefetchCustomerImagesForIntent(apiPayload.products.slice(0, 4).map((item) => item.imageUrl), "card"),
            prefetchCustomerImagesForIntent(apiPayload.team.slice(0, 4).map((item) => item.avatarUrl), "avatar"),
            prefetchCustomerImagesForIntent(apiPayload.gallery.slice(0, 4).map((item) => item.imageUrl), "card"),
            prefetchCustomerImagesForIntent(apiPayload.offers.slice(0, 2).map((item) => item.imageUrl), "card"),
          ]);
          return;
        }

        const supabasePayload = await loadFromSupabase();
        if (supabasePayload) {
          setPayload(supabasePayload);
          await writeCachedValue(EXPLORE_CACHE_KEY, supabasePayload);
          await Promise.all([
            prefetchCustomerImagesForIntent([supabasePayload.storefront?.coverImageUrl, supabasePayload.map?.imageUrl], "hero"),
            prefetchCustomerImagesForIntent(supabasePayload.featuredServices.slice(0, 4).map((item) => item.image), "card"),
            prefetchCustomerImagesForIntent(supabasePayload.products.slice(0, 4).map((item) => item.imageUrl), "card"),
            prefetchCustomerImagesForIntent(supabasePayload.team.slice(0, 4).map((item) => item.avatarUrl), "avatar"),
            prefetchCustomerImagesForIntent(supabasePayload.gallery.slice(0, 4).map((item) => item.imageUrl), "card"),
            prefetchCustomerImagesForIntent(supabasePayload.offers.slice(0, 2).map((item) => item.imageUrl), "card"),
          ]);
          return;
        }

        setPayload(EMPTY_EXPLORE_PAYLOAD);
      } catch (error) {
        setLastError(error instanceof Error ? error.message : "Khong tai duoc Explore");
        setPayload(EMPTY_EXPLORE_PAYLOAD);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [loadFromApi, loadFromSupabase],
  );

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const cached = await hydrateCachedValue<CustomerExplorePayload>(EXPLORE_CACHE_KEY);
      if (cancelled) return;

      if (cached && hasRealExploreData(cached.value)) {
        setPayload(cached.value);
        setIsLoading(false);
        if (Date.now() - cached.updatedAt <= EXPLORE_MAX_STALE_MS) {
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
    ...payload,
    isLoading,
    isRefreshing,
    lastError,
    refresh: () => refresh({ silent: true, force: true }),
  };
}
