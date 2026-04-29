import { useCallback, useEffect, useState } from "react";
import {
  normalizeLookbookRows,
  type CustomerContentPost,
  type LookbookItem,
  type LookbookRow,
  type MarketingOfferCard,
} from "@nails/shared";
import { FALLBACK_SERVICES, NEWS_ITEMS, OFFERS } from "@/src/features/customer/data";
import { mobileEnv } from "@/src/lib/env";
import { mobileSupabase } from "@/src/lib/supabase";
import type { LookbookService } from "./use-lookbook-services";

type HomeFeedPayload = {
  lookbook: LookbookItem[];
  contentPosts: CustomerContentPost[];
  offers: MarketingOfferCard[];
};

function normalizeFallbackLookbook(items: LookbookService[]): LookbookItem[] {
  return items.map((item, index) => ({
    id: item.id,
    title: item.title,
    blurb: item.blurb,
    category: item.category,
    tone: item.tone,
    badge: item.badge ?? "Featured",
    price: item.price,
    image: item.image,
    aspectRatio: item.aspectRatio,
    durationMin: item.durationMin ?? null,
    durationLabel: item.durationLabel ?? null,
    displayOrder: item.displayOrder ?? index + 1,
    createdAt: item.createdAt ?? null,
  }));
}

const FALLBACK_CONTENT_POSTS: CustomerContentPost[] = NEWS_ITEMS.map((item, index) => ({
  id: item.id,
  title: item.title,
  summary: item.body,
  body: item.body,
  coverImageUrl: FALLBACK_SERVICES[index % FALLBACK_SERVICES.length]?.image ?? null,
  contentType: item.tag.toLowerCase().includes("uu dai")
    ? "offer_hint"
    : item.tag.toLowerCase().includes("cap nhat")
      ? "news"
      : "trend",
  sourcePlatform: "seed",
  publishedAt: null,
  priority: index,
  metadata: { tag: item.tag },
}));

const FALLBACK_OFFERS: MarketingOfferCard[] = OFFERS.map((offer) => ({
  id: offer.id,
  title: offer.title,
  description: `${offer.detail} • ${offer.expiry}`,
  imageUrl: null,
  badge: "Uu dai",
  startsAt: null,
  endsAt: null,
  metadata: { expiry: offer.expiry },
}));

const FALLBACK_HOME_FEED: HomeFeedPayload = {
  lookbook: normalizeFallbackLookbook(FALLBACK_SERVICES),
  contentPosts: FALLBACK_CONTENT_POSTS,
  offers: FALLBACK_OFFERS,
};

function normalizeContentPosts(rows: Array<Record<string, unknown>>): CustomerContentPost[] {
  return rows.map((row, index) => ({
    id: String(row.id ?? `post-${index}`),
    title: String(row.title ?? "Cap nhat moi"),
    summary: String(row.summary ?? row.body ?? ""),
    body: String(row.body ?? row.summary ?? ""),
    coverImageUrl: typeof row.cover_image_url === "string" ? row.cover_image_url : null,
    contentType:
      row.content_type === "care" || row.content_type === "news" || row.content_type === "offer_hint"
        ? row.content_type
        : "trend",
    sourcePlatform: typeof row.source_platform === "string" ? row.source_platform : "telegram",
    publishedAt: typeof row.published_at === "string" ? row.published_at : null,
    priority: Number(row.priority ?? index),
    metadata: typeof row.metadata === "object" && row.metadata ? (row.metadata as Record<string, unknown>) : {},
  }));
}

function normalizeOffers(rows: Array<Record<string, unknown>>): MarketingOfferCard[] {
  return rows.map((row, index) => ({
    id: String(row.id ?? `offer-${index}`),
    title: String(row.title ?? "Uu dai moi"),
    description: String(row.description ?? ""),
    imageUrl: typeof row.image_url === "string" ? row.image_url : null,
    badge: typeof row.badge === "string" ? row.badge : null,
    startsAt: typeof row.starts_at === "string" ? row.starts_at : null,
    endsAt: typeof row.ends_at === "string" ? row.ends_at : null,
    metadata:
      typeof row.offer_metadata === "object" && row.offer_metadata
        ? (row.offer_metadata as Record<string, unknown>)
        : {},
  }));
}

function isOfferActiveNow(offer: MarketingOfferCard, nowMs: number) {
  const startsAtMs = offer.startsAt ? Date.parse(offer.startsAt) : Number.NaN;
  const endsAtMs = offer.endsAt ? Date.parse(offer.endsAt) : Number.NaN;

  if (Number.isFinite(startsAtMs) && startsAtMs > nowMs) {
    return false;
  }

  if (Number.isFinite(endsAtMs) && endsAtMs < nowMs) {
    return false;
  }

  return true;
}

export function useCustomerHomeFeed() {
  const [feed, setFeed] = useState<HomeFeedPayload>(FALLBACK_HOME_FEED);
  const [isLoading, setIsLoading] = useState(true);

  const loadFromApi = useCallback(async () => {
    if (!mobileEnv.apiBaseUrl) return null;

    const response = await fetch(`${mobileEnv.apiBaseUrl.replace(/\/$/, "")}/api/customer/home-feed`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const json = (await response.json()) as {
      ok?: boolean;
      data?: {
        lookbook?: LookbookItem[];
        contentPosts?: CustomerContentPost[];
        offers?: MarketingOfferCard[];
      };
    };

    if (!response.ok || !json.ok || !json.data) {
      return null;
    }

    return {
      lookbook: json.data.lookbook?.length ? json.data.lookbook : FALLBACK_HOME_FEED.lookbook,
      contentPosts: json.data.contentPosts?.length ? json.data.contentPosts : FALLBACK_HOME_FEED.contentPosts,
      offers: json.data.offers?.length ? json.data.offers : FALLBACK_HOME_FEED.offers,
    } satisfies HomeFeedPayload;
  }, []);

  const loadFromSupabase = useCallback(async () => {
    if (!mobileSupabase) return null;
    const nowMs = Date.now();

    const [lookbookResult, contentResult, offersResult] = await Promise.all([
      mobileSupabase
        .from("services")
        .select("id,name,short_description,image_url,duration_min,base_price,lookbook_category,lookbook_badge,lookbook_tone,duration_label,display_order_home,display_order_explore,created_at")
        .eq("active", true)
        .eq("featured_in_home", true)
        .order("display_order_home", { ascending: true })
        .order("name", { ascending: true })
        .limit(6),
      mobileSupabase
        .from("customer_content_posts")
        .select("id,title,summary,body,cover_image_url,content_type,source_platform,published_at,priority,metadata")
        .eq("status", "published")
        .order("priority", { ascending: true })
        .order("published_at", { ascending: false })
        .limit(4),
      mobileSupabase
        .from("marketing_offers")
        .select("id,title,description,image_url,badge,starts_at,ends_at,offer_metadata")
        .eq("is_active", true)
        .order("starts_at", { ascending: false })
        .limit(12),
    ]);

    const lookbook =
      !lookbookResult.error && lookbookResult.data?.length
        ? normalizeLookbookRows(lookbookResult.data as LookbookRow[], { context: "home" })
        : FALLBACK_HOME_FEED.lookbook;

    const contentPosts =
      !contentResult.error && contentResult.data?.length
        ? normalizeContentPosts(contentResult.data as Array<Record<string, unknown>>)
        : FALLBACK_HOME_FEED.contentPosts;

    const offers =
      !offersResult.error && offersResult.data?.length
        ? normalizeOffers(offersResult.data as Array<Record<string, unknown>>)
            .filter((offer) => isOfferActiveNow(offer, nowMs))
            .slice(0, 4)
        : FALLBACK_HOME_FEED.offers;

    return {
      lookbook,
      contentPosts,
      offers,
    } satisfies HomeFeedPayload;
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);

    try {
      const apiFeed = await loadFromApi();
      if (apiFeed) {
        setFeed(apiFeed);
        return;
      }

      const supabaseFeed = await loadFromSupabase();
      if (supabaseFeed) {
        setFeed(supabaseFeed);
        return;
      }

      setFeed(FALLBACK_HOME_FEED);
    } catch {
      setFeed(FALLBACK_HOME_FEED);
    } finally {
      setIsLoading(false);
    }
  }, [loadFromApi, loadFromSupabase]);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        void refresh();
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [refresh]);

  return {
    ...feed,
    isLoading,
    refresh,
  };
}
