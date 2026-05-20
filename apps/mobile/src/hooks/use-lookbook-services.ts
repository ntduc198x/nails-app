import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeLookbookRows, type LookbookRow } from "@nails/shared";
import { mobileEnv } from "@/src/lib/env";
import { mobileSupabase } from "@/src/lib/supabase";

export type LookbookService = {
  id: string;
  title: string;
  blurb: string;
  category: string | null;
  tone: string;
  price: string;
  image: string;
  aspectRatio: number;
  badge?: string | null;
  durationMin?: number | null;
  durationLabel?: string | null;
  displayOrder?: number | null;
  createdAt?: string | null;
};

type LookbookSource = "api" | "supabase" | "fallback" | "empty";

type UseLookbookServicesOptions = {
  allowFallback?: boolean;
  preferApi?: boolean;
  autoRefreshOnMount?: boolean;
};

const lookbookMemoryCache = new Map<string, { services: LookbookService[]; source: LookbookSource }>();

export function useLookbookServices(
  fallbackServices: LookbookService[] = [],
  options: UseLookbookServicesOptions = {},
) {
  const allowFallback = options.allowFallback ?? true;
  const preferApi = options.preferApi ?? false;
  const autoRefreshOnMount = options.autoRefreshOnMount ?? true;
  const cacheKey = useMemo(() => `lookbook:${preferApi ? "api" : "supabase"}:${allowFallback ? "fallback" : "strict"}`, [allowFallback, preferApi]);
  const initialCached = useMemo(() => lookbookMemoryCache.get(cacheKey) ?? null, [cacheKey]);
  const [services, setServices] = useState<LookbookService[]>(
    initialCached?.services ?? (allowFallback ? fallbackServices : []),
  );
  const [source, setSource] = useState<LookbookSource>(
    initialCached?.source ?? (allowFallback && fallbackServices.length ? "fallback" : "empty"),
  );
  const [isLoading, setIsLoading] = useState(autoRefreshOnMount);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const loadServices = useCallback(async (
    isActive: () => boolean = () => true,
    options: { silent?: boolean } = {},
  ) => {
    async function loadFromApi() {
      if (!mobileEnv.apiBaseUrl) return false;

      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = setTimeout(() => controller?.abort(), 5000);

      try {
        const response = await fetch(`${mobileEnv.apiBaseUrl.replace(/\/$/, "")}/api/lookbook`, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller?.signal,
        });

        const json = (await response.json()) as { ok?: boolean; data?: LookbookRow[]; error?: string };
        if (!response.ok || !json?.ok || !json.data?.length) {
          if (isActive()) setLastError(json?.error ?? `API lookbook failed (${response.status})`);
          return false;
        }

        const normalized = normalizeLookbookRows(json.data, { context: "explore" });
        if (!normalized.length) {
          if (isActive()) setLastError("API lookbook returned rows but no usable images/titles");
          return false;
        }

        if (isActive()) {
          lookbookMemoryCache.set(cacheKey, { services: normalized, source: "api" });
          setServices(normalized);
          setSource("api");
        }
        return true;
      } catch (error) {
        if (isActive()) {
          setLastError(error instanceof Error ? error.message : "API lookbook request failed");
        }
        return false;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    async function loadFromSupabase() {
      if (!mobileSupabase) return false;

      try {
        const { data, error } = await mobileSupabase
          .from("services")
          .select("id,name,short_description,image_url,featured_in_lookbook,duration_min,base_price,lookbook_category,lookbook_badge,lookbook_tone,duration_label,display_order_home,display_order_explore,created_at")
          .eq("active", true)
          .eq("featured_in_lookbook", true)
          .eq("featured_in_explore", true)
          .order("display_order_explore", { ascending: true })
          .order("name", { ascending: true })
          .limit(6);

        if (error || !data?.length) {
          if (isActive()) setLastError(error?.message ?? "Supabase lookbook returned no rows");
          return false;
        }

        const normalized = normalizeLookbookRows(data, { context: "explore" });
        if (!normalized.length) {
          if (isActive()) setLastError("Supabase rows exist but missing usable name/image_url");
          return false;
        }

        if (isActive()) {
          lookbookMemoryCache.set(cacheKey, { services: normalized, source: "supabase" });
          setServices(normalized);
          setSource("supabase");
        }
        return true;
      } catch (error) {
        if (isActive()) {
          setLastError(error instanceof Error ? error.message : "Supabase lookbook request failed");
        }
        return false;
      }
    }

    if (isActive()) {
      setLastError(null);
      if (options.silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
    }

    try {
      const loadedPrimary = preferApi ? await loadFromApi() : await loadFromSupabase();
      if (loadedPrimary) return;

      const loadedSecondary = preferApi ? await loadFromSupabase() : await loadFromApi();
      if (loadedSecondary) return;

      if (isActive()) {
        if (allowFallback) {
          lookbookMemoryCache.set(cacheKey, { services: fallbackServices, source: "fallback" });
          setServices(fallbackServices);
          setSource("fallback");
        } else {
          lookbookMemoryCache.set(cacheKey, { services: [], source: "empty" });
          setServices([]);
          setSource("empty");
        }
      }
    } catch (error) {
      if (isActive()) {
        setLastError(error instanceof Error ? error.message : "Unknown lookbook error");
        if (allowFallback) {
          lookbookMemoryCache.set(cacheKey, { services: fallbackServices, source: "fallback" });
          setServices(fallbackServices);
          setSource("fallback");
        } else {
          lookbookMemoryCache.set(cacheKey, { services: [], source: "empty" });
          setServices([]);
          setSource("empty");
        }
      }
    } finally {
      if (isActive()) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [allowFallback, cacheKey, fallbackServices, preferApi]);

  const refresh = useCallback(async () => {
    await loadServices(() => true, { silent: true });
  }, [loadServices]);

  useEffect(() => {
    if (!autoRefreshOnMount) return;

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      void loadServices(() => !cancelled);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      cancelled = true;
    };
  }, [autoRefreshOnMount, loadServices]);

  const syncFromCache = useCallback(() => {
    const cached = lookbookMemoryCache.get(cacheKey) ?? null;
    if (!cached) return;
    setServices(cached.services);
    setSource(cached.source);
    setIsLoading(false);
  }, [cacheKey]);

  return {
    refresh,
    isLoading,
    isRefreshing,
    lastError,
    services,
    source,
    syncFromCache,
  };
}
