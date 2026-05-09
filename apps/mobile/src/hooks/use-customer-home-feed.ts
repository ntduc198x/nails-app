import { useCallback, useEffect, useState } from "react";
import {
  getCustomerScopedContext,
  getCustomerScopedContextForGuest,
  listCustomerHomeFeedForContext,
  type CustomerHomeFeedPayload,
} from "@nails/shared";
import { mobileEnv } from "@/src/lib/env";
import { hydrateCachedValue, isCacheFresh, writeCachedValue } from "@/src/lib/customer-feed-cache";
import { prefetchCustomerImagesForIntent } from "@/src/lib/customer-image-cache";
import { mobileSupabase } from "@/src/lib/supabase";

const FALLBACK_HOME_FEED: CustomerHomeFeedPayload = {
  lookbook: [],
  contentPosts: [],
  offers: [],
};
const HOME_FEED_CACHE_KEY = "home-feed";
const HOME_FEED_FRESH_MS = 2 * 60 * 1000;
const HOME_FEED_MAX_STALE_MS = 10 * 60 * 1000;

function normalizeHomeFeed(feed: Partial<CustomerHomeFeedPayload> | null | undefined): CustomerHomeFeedPayload {
  return {
    lookbook: Array.isArray(feed?.lookbook) ? feed.lookbook : [],
    contentPosts: Array.isArray(feed?.contentPosts) ? feed.contentPosts : [],
    offers: Array.isArray(feed?.offers) ? feed.offers : [],
  };
}

function hasRealHomeFeedData(feed: CustomerHomeFeedPayload | null | undefined) {
  return Boolean(feed && (feed.lookbook.length || feed.contentPosts.length || feed.offers.length));
}

export function useCustomerHomeFeed() {
  const [feed, setFeed] = useState<CustomerHomeFeedPayload>(FALLBACK_HOME_FEED);
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

      const response = await fetch(`${mobileEnv.apiBaseUrl.replace(/\/$/, "")}/api/customer/home-feed`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const json = (await response.json()) as {
        ok?: boolean;
        data?: CustomerHomeFeedPayload;
      };

      if (!response.ok || !json.ok || !json.data) {
        return null;
      }

      return {
        lookbook: json.data.lookbook ?? [],
        contentPosts: json.data.contentPosts ?? [],
        offers: json.data.offers ?? [],
      } satisfies CustomerHomeFeedPayload;
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
    return listCustomerHomeFeedForContext(mobileSupabase, scope);
  }, []);

  const refresh = useCallback(async (options: { silent?: boolean; force?: boolean } = {}) => {
    const shouldUseFreshCache = !options.force && isCacheFresh(HOME_FEED_CACHE_KEY, HOME_FEED_FRESH_MS);
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
      const apiFeed = await loadFromApi();
      if (apiFeed && hasRealHomeFeedData(apiFeed)) {
        const normalized = normalizeHomeFeed(apiFeed);
        setFeed(normalized);
        await writeCachedValue(HOME_FEED_CACHE_KEY, normalized);
        await Promise.all([
          prefetchCustomerImagesForIntent(normalized.lookbook.slice(0, 4).map((item) => item.image), "card"),
          prefetchCustomerImagesForIntent(normalized.contentPosts.slice(0, 2).map((item) => item.coverImageUrl), "card"),
          prefetchCustomerImagesForIntent(normalized.offers.slice(0, 2).map((item) => item.imageUrl), "card"),
        ]);
        return;
      }

      const supabaseFeed = await loadFromSupabase();
      if (supabaseFeed) {
        const normalized = normalizeHomeFeed(supabaseFeed);
        setFeed(normalized);
        await writeCachedValue(HOME_FEED_CACHE_KEY, normalized);
        await Promise.all([
          prefetchCustomerImagesForIntent(normalized.lookbook.slice(0, 4).map((item) => item.image), "card"),
          prefetchCustomerImagesForIntent(normalized.contentPosts.slice(0, 2).map((item) => item.coverImageUrl), "card"),
          prefetchCustomerImagesForIntent(normalized.offers.slice(0, 2).map((item) => item.imageUrl), "card"),
        ]);
        return;
      }

      setFeed(FALLBACK_HOME_FEED);
      setLastError("Khong tim thay du lieu customer cho org hien tai.");
    } catch (error) {
      setLastError(error instanceof Error ? error.message : "Khong tai duoc home feed");
      setFeed(FALLBACK_HOME_FEED);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [loadFromApi, loadFromSupabase]);

useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const cached = await hydrateCachedValue<CustomerHomeFeedPayload>(HOME_FEED_CACHE_KEY);
      if (cancelled) return;

      if (cached && hasRealHomeFeedData(cached.value)) {
        setFeed(normalizeHomeFeed(cached.value));
        setIsLoading(false);
        const cacheAge = Date.now() - cached.updatedAt;
        
        if (cacheAge > HOME_FEED_FRESH_MS && cacheAge <= HOME_FEED_MAX_STALE_MS) {
          void refresh({ silent: true });
          return;
        }
        
        if (cacheAge > HOME_FEED_MAX_STALE_MS) {
          void refresh();
          return;
        }
        
        return;
      }

      void refresh();
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return {
    ...feed,
    isLoading,
    isRefreshing,
    lastError,
    refresh: () => refresh({ silent: true, force: true }),
  };
}
