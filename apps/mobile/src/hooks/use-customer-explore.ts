import { useCallback, useEffect, useState } from "react";
import type {
  CustomerExplorePayload,
  ExploreGalleryItem,
  ExploreMapCard,
  ExploreProduct,
  ExploreStat,
  ExploreStorefront,
  ExploreTeamMember,
  LookbookItem,
  MarketingOfferCard,
} from "@nails/shared";
import { buildExploreStats } from "@nails/shared";
import {
  EXPLORE_GALLERY,
  EXPLORE_SHOP_PRODUCTS,
  EXPLORE_STATS,
  EXPLORE_STORE_INFO,
  EXPLORE_TEAM,
  FALLBACK_SERVICES,
  OFFERS,
} from "@/src/features/customer/data";
import { mobileEnv } from "@/src/lib/env";

function normalizeFallbackLookbook(): LookbookItem[] {
  return FALLBACK_SERVICES.map((item, index) => ({
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

function normalizeFallbackOffers(): MarketingOfferCard[] {
  return OFFERS.map((offer) => ({
    id: offer.id,
    title: offer.title,
    description: `${offer.detail} • ${offer.expiry}`,
    imageUrl: null,
    badge: "Uu dai",
    startsAt: null,
    endsAt: null,
    metadata: { expiry: offer.expiry },
  }));
}

function normalizeFallbackProducts(): ExploreProduct[] {
  return EXPLORE_SHOP_PRODUCTS.map((item, index) => ({
    id: item.id,
    name: item.title,
    subtitle: "Phu kien ban tai cua hang",
    priceLabel: item.price,
    imageUrl: item.image,
    productType: index % 2 === 0 ? "accessory" : "care",
    isFeatured: index < 2,
  }));
}

function normalizeFallbackTeam(): ExploreTeamMember[] {
  return EXPLORE_TEAM.map((item) => ({
    id: item.id,
    displayName: item.name,
    roleLabel: item.role,
    avatarUrl: item.image,
    bio: null,
  }));
}

function normalizeFallbackGallery(): ExploreGalleryItem[] {
  return EXPLORE_GALLERY.map((item) => ({
    id: item.id,
    title: item.title,
    imageUrl: item.image,
    kind: item.kind,
  }));
}

const FALLBACK_STOREFRONT: ExploreStorefront = {
  id: "fallback-storefront",
  slug: "cham-beauty",
  name: EXPLORE_STORE_INFO.name,
  category: EXPLORE_STORE_INFO.category,
  description: "Storefront fallback cho Explore khi API chua san sang.",
  coverImageUrl: EXPLORE_STORE_INFO.coverImage,
  logoImageUrl: null,
  rating: Number(EXPLORE_STORE_INFO.rating),
  reviewsLabel: EXPLORE_STORE_INFO.reviews,
  addressLine: EXPLORE_STORE_INFO.address,
  mapUrl: EXPLORE_STORE_INFO.mapUrl,
  openingHours: EXPLORE_STORE_INFO.openingHours,
  phone: "0916080398",
  messengerUrl: "https://m.me/chambeautyyy",
  instagramUrl: "https://www.instagram.com/cham.beautyy",
  highlights: [...EXPLORE_STORE_INFO.highlights],
};

const FALLBACK_FEATURED_SERVICES = normalizeFallbackLookbook();
const FALLBACK_PRODUCTS = normalizeFallbackProducts();
const FALLBACK_TEAM = normalizeFallbackTeam();
const FALLBACK_GALLERY = normalizeFallbackGallery();
const FALLBACK_OFFERS = normalizeFallbackOffers();

const FALLBACK_STATS: ExploreStat[] =
  EXPLORE_STATS.map((item) => ({ ...item })) ||
  buildExploreStats({
    featuredServicesCount: FALLBACK_FEATURED_SERVICES.length,
    teamCount: FALLBACK_TEAM.length,
    galleryCount: FALLBACK_GALLERY.length,
    offersCount: FALLBACK_OFFERS.length,
  });

const FALLBACK_MAP: ExploreMapCard = {
  addressLine: EXPLORE_STORE_INFO.address,
  openingHours: EXPLORE_STORE_INFO.openingHours,
  mapUrl: EXPLORE_STORE_INFO.mapUrl,
  imageUrl: EXPLORE_STORE_INFO.mapImage,
};

const FALLBACK_EXPLORE_PAYLOAD: CustomerExplorePayload = {
  storefront: FALLBACK_STOREFRONT,
  stats: FALLBACK_STATS,
  featuredServices: FALLBACK_FEATURED_SERVICES,
  products: FALLBACK_PRODUCTS,
  team: FALLBACK_TEAM,
  gallery: FALLBACK_GALLERY,
  offers: FALLBACK_OFFERS,
  map: FALLBACK_MAP,
};

function ensureExplorePayload(data?: Partial<CustomerExplorePayload> | null): CustomerExplorePayload {
  return {
    storefront: data?.storefront ?? FALLBACK_EXPLORE_PAYLOAD.storefront,
    stats: data?.stats?.length ? data.stats : FALLBACK_EXPLORE_PAYLOAD.stats,
    featuredServices: data?.featuredServices?.length ? data.featuredServices : FALLBACK_EXPLORE_PAYLOAD.featuredServices,
    products: data?.products?.length ? data.products : FALLBACK_EXPLORE_PAYLOAD.products,
    team: data?.team?.length ? data.team : FALLBACK_EXPLORE_PAYLOAD.team,
    gallery: data?.gallery?.length ? data.gallery : FALLBACK_EXPLORE_PAYLOAD.gallery,
    offers: data?.offers?.length ? data.offers : FALLBACK_EXPLORE_PAYLOAD.offers,
    map: data?.map ?? FALLBACK_EXPLORE_PAYLOAD.map,
  };
}

export function useCustomerExplore() {
  const [payload, setPayload] = useState<CustomerExplorePayload>(FALLBACK_EXPLORE_PAYLOAD);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const loadFromApi = useCallback(async () => {
    if (!mobileEnv.apiBaseUrl) return null;

    const response = await fetch(`${mobileEnv.apiBaseUrl.replace(/\/$/, "")}/api/customer/explore`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const json = (await response.json()) as {
      ok?: boolean;
      data?: CustomerExplorePayload;
      error?: string;
    };

    if (!response.ok || !json.ok || !json.data) {
      throw new Error(json.error ?? `Explore API failed (${response.status})`);
    }

    return ensureExplorePayload(json.data);
  }, []);

  const refresh = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (options.silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setLastError(null);

      try {
        const apiPayload = await loadFromApi();
        if (apiPayload) {
          setPayload(apiPayload);
          return;
        }

        setPayload(FALLBACK_EXPLORE_PAYLOAD);
      } catch (error) {
        setLastError(error instanceof Error ? error.message : "Khong tai duoc Explore");
        setPayload(FALLBACK_EXPLORE_PAYLOAD);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [loadFromApi],
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void refresh();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [refresh]);

  return {
    ...payload,
    isLoading,
    isRefreshing,
    lastError,
    refresh: () => refresh({ silent: true }),
  };
}
