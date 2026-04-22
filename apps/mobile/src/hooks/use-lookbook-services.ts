import { useCallback, useEffect, useState } from "react";
import { mobileEnv } from "@/src/lib/env";
import { mobileSupabase } from "@/src/lib/supabase";

export type LookbookService = {
  id: string;
  title: string;
  blurb: string;
  tone: string;
  price: string;
  image: string;
  aspectRatio?: number;
};

type LookbookSource = "api" | "supabase" | "fallback";

type ApiLookbookRow = {
  id?: string | null;
  name?: string | null;
  short_description?: string | null;
  image_url?: string | null;
  duration_min?: number | null;
  base_price?: number | null;
};

function inferTone(text: string) {
  const value = text.toLowerCase();

  if (value.includes("ombre") || value.includes("ve") || value.includes("art") || value.includes("design")) {
    return "Noi bat";
  }

  if (value.includes("spa") || value.includes("care") || value.includes("duong") || value.includes("phuc hoi")) {
    return "Thu gian";
  }

  if (value.includes("go mong")) {
    return "Phuc hoi";
  }

  return "Nhe nhang";
}

function formatPrice(value?: number | null) {
  return `${new Intl.NumberFormat("vi-VN").format(Number(value ?? 0))}d`;
}

function normalizeLookbookRows(rows: ApiLookbookRow[]): LookbookService[] {
  return rows
    .filter((row) => row.name && row.image_url)
    .map((row) => ({
      id: String(row.id ?? row.name),
      title: String(row.name ?? ""),
      blurb:
        row.short_description?.trim() ||
        `Thoi gian ${Number(row.duration_min ?? 0)} phut, len form gon va dung chat lookbook cua tiem.`,
      tone: inferTone(`${row.name ?? ""} ${row.short_description ?? ""}`),
      price: formatPrice(row.base_price),
      image: String(row.image_url ?? ""),
      aspectRatio: 1.2,
    }));
}

export function useLookbookServices(fallbackServices: LookbookService[]) {
  const [services, setServices] = useState<LookbookService[]>(fallbackServices);
  const [source, setSource] = useState<LookbookSource>("fallback");
  const [isLoading, setIsLoading] = useState(true);

  const loadServices = useCallback(async (isActive: () => boolean = () => true) => {
    async function loadFromApi() {
      if (!mobileEnv.apiBaseUrl) return false;

      const response = await fetch(`${mobileEnv.apiBaseUrl.replace(/\/$/, "")}/api/lookbook`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      const json = (await response.json()) as { ok?: boolean; data?: ApiLookbookRow[] };
      if (!response.ok || !json?.ok || !json.data?.length) return false;

      const normalized = normalizeLookbookRows(json.data);
      if (!normalized.length) return false;

      if (isActive()) {
        setServices(normalized);
        setSource("api");
      }
      return true;
    }

    async function loadFromSupabase() {
      if (!mobileSupabase) return false;

      const { data, error } = await mobileSupabase
        .from("services")
        .select("id,name,short_description,image_url,duration_min,base_price")
        .eq("active", true)
        .eq("featured_in_lookbook", true)
        .order("created_at", { ascending: true })
        .limit(6);

      if (error || !data?.length) return false;

      const normalized = normalizeLookbookRows(data);
      if (!normalized.length) return false;

      if (isActive()) {
        setServices(normalized);
        setSource("supabase");
      }
      return true;
    }

    setIsLoading(true);

    try {
      const loadedFromApi = await loadFromApi();
      if (loadedFromApi) return;

      const loadedFromSupabase = await loadFromSupabase();
      if (loadedFromSupabase) return;

      if (isActive()) {
        setServices(fallbackServices);
        setSource("fallback");
      }
    } catch {
      if (isActive()) {
        setServices(fallbackServices);
        setSource("fallback");
      }
    } finally {
      if (isActive()) {
        setIsLoading(false);
      }
    }
  }, [fallbackServices]);

  const refresh = useCallback(async () => {
    await loadServices();
  }, [loadServices]);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      void loadServices(() => !cancelled);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      cancelled = true;
    };
  }, [loadServices]);

  return {
    refresh,
    isLoading,
    services,
    source,
  };
}
