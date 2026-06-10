import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCustomerScopedContext,
  getCustomerScopedContextForGuest,
  listCustomerExploreForContext,
  type CustomerScopedContext,
  type OrgBranchSummary,
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
const EXPLORE_FRESH_MS = 2 * 60 * 1000;
const EXPLORE_MAX_STALE_MS = 10 * 60 * 1000;
const BRANCH_SELECTION_STORAGE_PREFIX = "customer-explore:selected-branch";

export type CustomerExploreBranchOption = OrgBranchSummary & {
  hasActiveStorefront: boolean;
};

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

function getExploreCacheKey(branchId: string | null) {
  return `explore:${branchId ?? "default"}`;
}

function getBranchSelectionStorageKey(userId: string, orgId: string) {
  return `${BRANCH_SELECTION_STORAGE_PREFIX}:${userId}:${orgId}`;
}

async function readStoredBranchSelection(userId: string, orgId: string) {
  try {
    const value = await AsyncStorage.getItem(getBranchSelectionStorageKey(userId, orgId));
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

async function writeStoredBranchSelection(userId: string, orgId: string, branchId: string) {
  try {
    await AsyncStorage.setItem(getBranchSelectionStorageKey(userId, orgId), branchId);
  } catch {
    // Ignore local persistence failure and keep in-memory selection.
  }
}

async function listExploreBranches(orgId: string) {
  if (!mobileSupabase) {
    return [] as CustomerExploreBranchOption[];
  }

  const branchResponse = await mobileSupabase
    .from("branches")
    .select("id,name,translations,translation_meta,created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  let branches = (branchResponse.data ?? null) as Array<Record<string, unknown>> | null;
  if (branchResponse.error) {
    const message = branchResponse.error.message || "";
    const missingTranslationsColumn =
      branchResponse.error.code === "42703" ||
      message.includes("branches.translations") ||
      message.includes("column translations does not exist");

    if (!missingTranslationsColumn) {
      throw branchResponse.error;
    }

    const fallbackResponse = await mobileSupabase
      .from("branches")
      .select("id,name,created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });

    if (fallbackResponse.error) {
      throw fallbackResponse.error;
    }

    branches = (fallbackResponse.data ?? null) as Array<Record<string, unknown>> | null;
  }

  const storefrontResponse = await mobileSupabase
    .from("storefront_profile")
    .select("branch_id")
    .eq("org_id", orgId)
    .eq("is_active", true);

  if (storefrontResponse.error) {
    throw storefrontResponse.error;
  }

  const activeBranchIds = new Set(
    (storefrontResponse.data ?? [])
      .map((row) => (typeof row.branch_id === "string" ? row.branch_id : null))
      .filter((value): value is string => Boolean(value)),
  );

  const normalizedBranches: CustomerExploreBranchOption[] = (branches ?? []).map((branch) => ({
    id: String(branch.id ?? ""),
    name: typeof branch.name === "string" && branch.name.trim() ? branch.name.trim() : "Branch",
    translations: "translations" in branch ? (branch.translations ?? null) : null,
    translationMeta: "translation_meta" in branch ? (branch.translation_meta ?? null) : null,
    hasActiveStorefront: activeBranchIds.has(String(branch.id ?? "")),
  }));

  const branchesWithStorefront = normalizedBranches.filter((branch) => branch.hasActiveStorefront);
  return branchesWithStorefront.length > 0 ? branchesWithStorefront : normalizedBranches;
}

async function loadExploreBranchesFromApi() {
  if (!mobileEnv.apiBaseUrl || !mobileSupabase) return null;

  try {
    const {
      data: { session },
    } = await mobileSupabase.auth.getSession();

    if (!session?.access_token) {
      return null;
    }

    const response = await fetch(`${mobileEnv.apiBaseUrl.replace(/\/$/, "")}/api/customer/explore/branches`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const json = (await response.json()) as {
      ok?: boolean;
      data?: CustomerExploreBranchOption[];
    };

    if (!response.ok || !json.ok || !Array.isArray(json.data)) {
      return null;
    }

    return json.data;
  } catch {
    return null;
  }
}

export function useCustomerExplore() {
  const [payload, setPayload] = useState<CustomerExplorePayload>(EMPTY_EXPLORE_PAYLOAD);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [scope, setScope] = useState<CustomerScopedContext | null>(null);
  const [branchOptions, setBranchOptions] = useState<CustomerExploreBranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const activeBranchId = selectedBranchId ?? scope?.branchId ?? null;
  const cacheKey = useMemo(() => getExploreCacheKey(activeBranchId), [activeBranchId]);

  const loadFromApi = useCallback(async () => {
    if (!mobileEnv.apiBaseUrl || !mobileSupabase) return null;

    try {
      const {
        data: { session },
      } = await mobileSupabase.auth.getSession();

      if (!session?.access_token) {
        return null;
      }

      const url = new URL(`${mobileEnv.apiBaseUrl.replace(/\/$/, "")}/api/customer/explore`);
      if (activeBranchId) {
        url.searchParams.set("branchId", activeBranchId);
      }

      const response = await fetch(url.toString(), {
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
  }, [activeBranchId]);

  const loadFromSupabase = useCallback(async () => {
    if (!mobileSupabase) return null;

    let nextScope = scope;
    if (!nextScope) {
      nextScope = await getCustomerScopedContext(mobileSupabase);
    }
    if (!nextScope && mobileEnv.defaultOrgId) {
      nextScope = getCustomerScopedContextForGuest(mobileEnv.defaultOrgId, mobileEnv.defaultBranchId || null);
    }
    if (!nextScope) return null;

    const scopedBranchId = activeBranchId ?? nextScope.branchId ?? null;
    return listCustomerExploreForContext(mobileSupabase, {
      ...nextScope,
      branchId: scopedBranchId,
    });
  }, [activeBranchId, scope]);

  const refresh = useCallback(
    async (options: { silent?: boolean; force?: boolean } = {}) => {
      const shouldUseFreshCache = !options.force && isCacheFresh(cacheKey, EXPLORE_FRESH_MS);
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
          await writeCachedValue(cacheKey, apiPayload);
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
          await writeCachedValue(cacheKey, supabasePayload);
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
    [cacheKey, loadFromApi, loadFromSupabase],
  );

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (!mobileSupabase) {
        setIsLoading(false);
        return;
      }

      let nextScope = await getCustomerScopedContext(mobileSupabase);
      if (!nextScope && mobileEnv.defaultOrgId) {
        nextScope = getCustomerScopedContextForGuest(mobileEnv.defaultOrgId, mobileEnv.defaultBranchId || null);
      }

      if (cancelled || !nextScope) {
        if (!cancelled) {
          setIsLoading(false);
        }
        return;
      }

      setScope(nextScope);

      const [apiOptions, storedBranchId] = await Promise.all([
        loadExploreBranchesFromApi(),
        readStoredBranchSelection(nextScope.userId, nextScope.orgId),
      ]);

      if (cancelled) return;

      let options = apiOptions ?? [];
      if (options.length === 0) {
        try {
          options = await listExploreBranches(nextScope.orgId);
        } catch {
          options = [];
        }
      }

      if (cancelled) return;

      setBranchOptions(options);

      const optionIds = new Set(options.map((branch) => branch.id));
      const resolvedBranchId =
        (storedBranchId && optionIds.has(storedBranchId) ? storedBranchId : null) ??
        (nextScope.branchId && (optionIds.size === 0 || optionIds.has(nextScope.branchId)) ? nextScope.branchId : null) ??
        options[0]?.id ??
        nextScope.branchId ??
        null;

      setSelectedBranchId(resolvedBranchId);
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootBranchPayload = async () => {
      if (!scope) {
        return;
      }

      if (selectedBranchId && selectedBranchId !== scope.branchId) {
        await writeStoredBranchSelection(scope.userId, scope.orgId, selectedBranchId);
      }

      const cached = await hydrateCachedValue<CustomerExplorePayload>(cacheKey);
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

    void bootBranchPayload();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, refresh, scope, selectedBranchId]);

  return {
    ...payload,
    activeBranchId,
    branchOptions,
    isLoading,
    isRefreshing,
    lastError,
    setActiveBranchId: setSelectedBranchId,
    refresh: () => refresh({ silent: true, force: true }),
  };
}
