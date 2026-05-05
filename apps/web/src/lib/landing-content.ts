import {
  buildExploreStats,
  normalizeLookbookRows,
  type CustomerContentPost,
  type CustomerExplorePayload,
  type ExploreGalleryItem,
  type ExploreMapCard,
  type ExploreProduct,
  type ExploreStorefront,
  type ExploreTeamMember,
  type LookbookItem,
  type LookbookRow,
  type MarketingOfferCard,
} from "@nails/shared";
import { createServiceRoleClient } from "@/lib/supabase";

export type HomeFeedPayload = {
  lookbook: LookbookItem[];
  contentPosts: CustomerContentPost[];
  offers: MarketingOfferCard[];
};

export type LandingPagePayload = {
  homeFeed: HomeFeedPayload;
  explore: CustomerExplorePayload;
};

function asMetadata(value: unknown) {
  return typeof value === "object" && value ? (value as Record<string, unknown>) : {};
}

function normalizeContentPosts(rows: Array<Record<string, unknown>>): CustomerContentPost[] {
  return rows.map((row, index) => ({
    id: String(row.id ?? `post-${index}`),
    title: String(row.title ?? "Cập nhật mới"),
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
    metadata: asMetadata(row.metadata),
  }));
}

function normalizeOffers(rows: Array<Record<string, unknown>>): MarketingOfferCard[] {
  return rows.map((row, index) => ({
    id: String(row.id ?? `offer-${index}`),
    title: String(row.title ?? "Ưu đãi mới"),
    description: String(row.description ?? ""),
    imageUrl: typeof row.image_url === "string" ? row.image_url : null,
    badge: typeof row.badge === "string" ? row.badge : null,
    startsAt: typeof row.starts_at === "string" ? row.starts_at : null,
    endsAt: typeof row.ends_at === "string" ? row.ends_at : null,
    metadata: asMetadata(row.offer_metadata),
  }));
}

function isOfferActiveNow(offer: MarketingOfferCard, nowMs: number) {
  const startsAtMs = offer.startsAt ? Date.parse(offer.startsAt) : Number.NaN;
  const endsAtMs = offer.endsAt ? Date.parse(offer.endsAt) : Number.NaN;

  if (Number.isFinite(startsAtMs) && startsAtMs > nowMs) return false;
  if (Number.isFinite(endsAtMs) && endsAtMs < nowMs) return false;
  return true;
}

function normalizeStorefront(row?: Record<string, unknown> | null): ExploreStorefront | null {
  if (!row?.id || !row?.slug || !row?.name) return null;

  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    category: typeof row.category === "string" ? row.category : null,
    description: typeof row.description === "string" ? row.description : null,
    coverImageUrl: typeof row.cover_image_url === "string" ? row.cover_image_url : null,
    logoImageUrl: typeof row.logo_image_url === "string" ? row.logo_image_url : null,
    rating: typeof row.rating === "number" ? row.rating : row.rating ? Number(row.rating) : null,
    reviewsLabel: typeof row.reviews_label === "string" ? row.reviews_label : null,
    addressLine: typeof row.address_line === "string" ? row.address_line : null,
    mapUrl: typeof row.map_url === "string" ? row.map_url : null,
    openingHours: typeof row.opening_hours === "string" ? row.opening_hours : null,
    phone: typeof row.phone === "string" ? row.phone : null,
    messengerUrl: typeof row.messenger_url === "string" ? row.messenger_url : null,
    instagramUrl: typeof row.instagram_url === "string" ? row.instagram_url : null,
    highlights: Array.isArray(row.highlights) ? row.highlights.filter((item): item is string => typeof item === "string") : [],
  };
}

function normalizeProducts(rows: Array<Record<string, unknown>>): ExploreProduct[] {
  return rows.map((row, index) => ({
    id: String(row.id ?? `product-${index}`),
    name: String(row.name ?? "Sản phẩm"),
    subtitle: typeof row.subtitle === "string" ? row.subtitle : null,
    priceLabel: typeof row.price_label === "string" ? row.price_label : null,
    imageUrl: typeof row.image_url === "string" ? row.image_url : null,
    productType: typeof row.product_type === "string" ? row.product_type : null,
    isFeatured: Boolean(row.is_featured),
  }));
}

function normalizeTeam(rows: Array<Record<string, unknown>>): ExploreTeamMember[] {
  return rows.map((row, index) => ({
    id: String(row.id ?? `team-${index}`),
    displayName: String(row.display_name ?? `Nhân sự ${index + 1}`),
    roleLabel: typeof row.role_label === "string" ? row.role_label : null,
    avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
    bio: typeof row.bio === "string" ? row.bio : null,
  }));
}

function normalizeGallery(rows: Array<Record<string, unknown>>): ExploreGalleryItem[] {
  return rows
    .filter((row) => typeof row.image_url === "string" && row.image_url.trim())
    .map((row, index) => ({
      id: String(row.id ?? `gallery-${index}`),
      title: typeof row.title === "string" ? row.title : null,
      imageUrl: String(row.image_url),
      kind: typeof row.kind === "string" ? row.kind : null,
    }));
}

export async function getCustomerHomeFeedPayload(): Promise<HomeFeedPayload> {
  const supabase = createServiceRoleClient();
  const nowMs = Date.now();

  const [lookbookResult, contentResult, offersResult] = await Promise.all([
    supabase
      .from("services")
      .select(
        "id,name,short_description,image_url,duration_min,base_price,lookbook_category,lookbook_badge,lookbook_tone,duration_label,display_order_home,display_order_explore,created_at",
      )
      .eq("active", true)
      .eq("featured_in_home", true)
      .order("display_order_home", { ascending: true })
      .order("name", { ascending: true })
      .limit(6),
    supabase
      .from("customer_content_posts")
      .select("id,title,summary,body,cover_image_url,content_type,source_platform,published_at,priority,metadata")
      .eq("status", "published")
      .order("priority", { ascending: true })
      .order("published_at", { ascending: false })
      .limit(4),
    supabase
      .from("marketing_offers")
      .select("id,title,description,image_url,badge,starts_at,ends_at,offer_metadata")
      .eq("is_active", true)
      .order("starts_at", { ascending: false })
      .limit(12),
  ]);

  return {
    lookbook:
      !lookbookResult.error && lookbookResult.data
        ? normalizeLookbookRows(lookbookResult.data as LookbookRow[], { context: "home" })
        : [],
    contentPosts:
      !contentResult.error && contentResult.data
        ? normalizeContentPosts(contentResult.data as Array<Record<string, unknown>>)
        : [],
    offers:
      !offersResult.error && offersResult.data
        ? normalizeOffers(offersResult.data as Array<Record<string, unknown>>)
            .filter((offer) => isOfferActiveNow(offer, nowMs))
            .slice(0, 4)
        : [],
  };
}

export async function getCustomerExplorePayload(): Promise<CustomerExplorePayload> {
  const supabase = createServiceRoleClient();
  const nowMs = Date.now();

  const storefrontResult = await supabase
    .from("storefront_profile")
    .select(
      "id,slug,name,category,description,cover_image_url,logo_image_url,rating,reviews_label,address_line,map_url,opening_hours,phone,messenger_url,instagram_url,highlights",
    )
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const storefront = !storefrontResult.error
    ? normalizeStorefront(storefrontResult.data as Record<string, unknown> | null)
    : null;
  const storefrontId = storefrontResult.data?.id as string | undefined;

  const [servicesResult, productsResult, teamResult, galleryResult, offersResult] = storefrontId
    ? await Promise.all([
        supabase
          .from("services")
          .select(
            "id,name,short_description,image_url,duration_min,base_price,lookbook_category,lookbook_badge,lookbook_tone,duration_label,display_order_home,display_order_explore,created_at",
          )
          .eq("active", true)
          .eq("featured_in_explore", true)
          .order("display_order_explore", { ascending: true })
          .order("name", { ascending: true })
          .limit(8),
        supabase
          .from("storefront_products")
          .select("id,name,subtitle,price_label,image_url,product_type,is_featured")
          .eq("storefront_id", storefrontId)
          .eq("is_active", true)
          .order("display_order", { ascending: true })
          .limit(8),
        supabase
          .from("storefront_team_members")
          .select("id,display_name,role_label,avatar_url,bio")
          .eq("storefront_id", storefrontId)
          .eq("is_visible", true)
          .order("display_order", { ascending: true })
          .limit(8),
        supabase
          .from("storefront_gallery")
          .select("id,title,image_url,kind")
          .eq("storefront_id", storefrontId)
          .eq("is_active", true)
          .order("display_order", { ascending: true })
          .limit(12),
        supabase
          .from("marketing_offers")
          .select("id,title,description,image_url,badge,starts_at,ends_at,offer_metadata")
          .eq("is_active", true)
          .order("starts_at", { ascending: false })
          .limit(12),
      ])
    : [null, null, null, null, null];

  const featuredServices =
    servicesResult && !servicesResult.error && servicesResult.data?.length
      ? normalizeLookbookRows(servicesResult.data as LookbookRow[], { context: "explore" })
      : [];
  const products =
    productsResult && !productsResult.error && productsResult.data?.length
      ? normalizeProducts(productsResult.data as Array<Record<string, unknown>>)
      : [];
  const team =
    teamResult && !teamResult.error && teamResult.data?.length
      ? normalizeTeam(teamResult.data as Array<Record<string, unknown>>)
      : [];
  const gallery =
    galleryResult && !galleryResult.error && galleryResult.data?.length
      ? normalizeGallery(galleryResult.data as Array<Record<string, unknown>>)
      : [];
  const offers =
    offersResult && !offersResult.error && offersResult.data?.length
      ? normalizeOffers(offersResult.data as Array<Record<string, unknown>>)
          .filter((offer) => isOfferActiveNow(offer, nowMs))
          .slice(0, 4)
      : [];

  const map: ExploreMapCard | null = storefront
    ? {
        addressLine: storefront.addressLine,
        openingHours: storefront.openingHours,
        mapUrl: storefront.mapUrl,
        imageUrl: gallery.find((item) => item.kind === "salon")?.imageUrl ?? storefront.coverImageUrl,
      }
    : null;

  return {
    storefront,
    stats: buildExploreStats({
      featuredServicesCount: featuredServices.length,
      teamCount: team.length,
      galleryCount: gallery.length,
      offersCount: offers.length,
    }),
    featuredServices,
    products,
    team,
    gallery,
    offers,
    map,
  };
}

export async function getLandingPagePayload(): Promise<LandingPagePayload> {
  const [homeFeed, explore] = await Promise.all([getCustomerHomeFeedPayload(), getCustomerExplorePayload()]);
  return { homeFeed, explore };
}
