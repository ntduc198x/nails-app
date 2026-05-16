import type { SharedSupabaseClient } from "./org";
import { ensureOrgContext } from "./org";

type UnknownRow = Record<string, unknown>;

export type MobileAdminMerchService = {
  id: string;
  name: string;
  shortDescription: string | null;
  imageUrl: string | null;
  priceLabel: string | null;
  durationLabel: string | null;
  featuredInLookbook: boolean;
  featuredInHome: boolean;
  featuredInExplore: boolean;
  displayOrderHome: number;
  displayOrderExplore: number;
  lookbookCategory: string | null;
  lookbookBadge: string | null;
  lookbookTone: string | null;
  durationMin: number;
  basePrice: number;
  active: boolean;
};

export type MobileAdminMerchServiceUpdate = {
  id: string;
  shortDescription?: string | null;
  imageUrl?: string | null;
  durationLabel?: string | null;
  featuredInLookbook?: boolean;
  featuredInHome?: boolean;
  featuredInExplore?: boolean;
  displayOrderHome?: number;
  displayOrderExplore?: number;
  lookbookCategory?: string | null;
  lookbookBadge?: string | null;
  lookbookTone?: string | null;
};

export type MobileAdminOffer = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  badge: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
};

export type MobileAdminOfferInput = {
  title: string;
  description: string;
  imageUrl?: string | null;
  badge?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
  metadata?: Record<string, unknown>;
};

export type MobileAdminContentPost = {
  id: string;
  title: string;
  summary: string;
  body: string;
  coverImageUrl: string | null;
  contentType: "trend" | "care" | "news" | "offer_hint";
  status: "draft" | "approved" | "published" | "archived";
  publishedAt: string | null;
  priority: number;
  metadata: Record<string, unknown>;
  sourcePlatform: string;
  sourceMessageId: string | null;
};

export type MobileAdminContentPostInput = {
  title: string;
  summary: string;
  body: string;
  coverImageUrl?: string | null;
  contentType?: "trend" | "care" | "news" | "offer_hint";
  status?: "draft" | "approved" | "published" | "archived";
  priority?: number;
  metadata?: Record<string, unknown>;
};

export type MobileAdminStorefrontProfile = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  description: string | null;
  coverImageUrl: string | null;
  logoImageUrl: string | null;
  rating: number | null;
  reviewsLabel: string | null;
  addressLine: string | null;
  mapUrl: string | null;
  openingHours: string | null;
  phone: string | null;
  messengerUrl: string | null;
  instagramUrl: string | null;
  highlights: string[];
  isActive: boolean;
};

export type MobileAdminStorefrontProfileInput = {
  id?: string | null;
  slug: string;
  name: string;
  category?: string | null;
  description?: string | null;
  coverImageUrl?: string | null;
  logoImageUrl?: string | null;
  rating?: number | null;
  reviewsLabel?: string | null;
  addressLine?: string | null;
  mapUrl?: string | null;
  openingHours?: string | null;
  phone?: string | null;
  messengerUrl?: string | null;
  instagramUrl?: string | null;
  highlights?: string[];
  isActive?: boolean;
};

export type MobileAdminStorefrontTeamMember = {
  id: string;
  displayName: string;
  roleLabel: string | null;
  avatarUrl: string | null;
  bio: string | null;
  displayOrder: number;
  isVisible: boolean;
};

export type MobileAdminStorefrontTeamMemberInput = {
  displayName: string;
  roleLabel?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  displayOrder?: number;
  isVisible?: boolean;
};

export type MobileAdminStorefrontProduct = {
  id: string;
  name: string;
  subtitle: string | null;
  priceLabel: string | null;
  imageUrl: string | null;
  productType: string | null;
  displayOrder: number;
  isActive: boolean;
  isFeatured: boolean;
};

export type MobileAdminStorefrontProductInput = {
  name: string;
  subtitle?: string | null;
  priceLabel?: string | null;
  imageUrl?: string | null;
  productType?: string | null;
  displayOrder?: number;
  isActive?: boolean;
  isFeatured?: boolean;
};

export type MobileAdminStorefrontGalleryItem = {
  id: string;
  title: string | null;
  imageUrl: string;
  kind: string | null;
  displayOrder: number;
  isActive: boolean;
};

export type MobileAdminStorefrontGalleryItemInput = {
  title?: string | null;
  imageUrl: string;
  kind?: string | null;
  displayOrder?: number;
  isActive?: boolean;
};

export type MobileAdminContentSnapshot = {
  branchId: string;
  branchName: string;
  isDefaultBranchView: boolean;
  storefront: MobileAdminStorefrontProfile | null;
  posts: MobileAdminContentPost[];
  offers: MobileAdminOffer[];
  products: MobileAdminStorefrontProduct[];
  team: MobileAdminStorefrontTeamMember[];
  gallery: MobileAdminStorefrontGalleryItem[];
  services: MobileAdminMerchService[];
};

function asRecord(value: unknown) {
  return typeof value === "object" && value ? (value as Record<string, unknown>) : {};
}

function normalizeBranchName(row: UnknownRow | null | undefined) {
  return typeof row?.name === "string" && row.name.trim() ? row.name.trim() : "chi nhánh hiện tại";
}

function normalizeMerchService(row: UnknownRow): MobileAdminMerchService {
  const basePrice = Number(row.base_price ?? 0);

  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    shortDescription: typeof row.short_description === "string" ? row.short_description : null,
    imageUrl: typeof row.image_url === "string" ? row.image_url : null,
    priceLabel: basePrice > 0 ? new Intl.NumberFormat("vi-VN").format(basePrice) : null,
    durationLabel: typeof row.duration_label === "string" ? row.duration_label : null,
    featuredInLookbook: Boolean(row.featured_in_lookbook),
    featuredInHome: Boolean(row.featured_in_home),
    featuredInExplore: Boolean(row.featured_in_explore),
    displayOrderHome: Number(row.display_order_home ?? 0),
    displayOrderExplore: Number(row.display_order_explore ?? 0),
    lookbookCategory: typeof row.lookbook_category === "string" ? row.lookbook_category : null,
    lookbookBadge: typeof row.lookbook_badge === "string" ? row.lookbook_badge : null,
    lookbookTone: typeof row.lookbook_tone === "string" ? row.lookbook_tone : null,
    durationMin: Number(row.duration_min ?? 0),
    basePrice,
    active: row.active !== false,
  };
}

const OFFER_PACKAGE_TIERS = ["REGULAR", "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"] as const;

function getOfferPackageTier(metadata: Record<string, unknown>) {
  const raw = typeof metadata.packageTier === "string" ? metadata.packageTier.trim().toUpperCase() : "REGULAR";
  return (OFFER_PACKAGE_TIERS as readonly string[]).includes(raw) ? raw : "REGULAR";
}

function getOfferPackageOrder(metadata: Record<string, unknown>) {
  const raw = Number(metadata.packageOrder ?? metadata.displayOrder ?? 0);
  return Number.isFinite(raw) ? raw : 0;
}

function normalizeOffer(row: UnknownRow): MobileAdminOffer {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    imageUrl: typeof row.image_url === "string" ? row.image_url : null,
    badge: typeof row.badge === "string" ? row.badge : null,
    startsAt: typeof row.starts_at === "string" ? row.starts_at : null,
    endsAt: typeof row.ends_at === "string" ? row.ends_at : null,
    isActive: row.is_active !== false,
    metadata: asRecord(row.offer_metadata),
  };
}

function normalizePost(row: UnknownRow): MobileAdminContentPost {
  const contentType =
    row.content_type === "care" || row.content_type === "news" || row.content_type === "offer_hint"
      ? row.content_type
      : "trend";
  const status =
    row.status === "approved" || row.status === "published" || row.status === "archived"
      ? row.status
      : "draft";

  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    body: String(row.body ?? ""),
    coverImageUrl: typeof row.cover_image_url === "string" ? row.cover_image_url : null,
    contentType,
    status,
    publishedAt: typeof row.published_at === "string" ? row.published_at : null,
    priority: Number(row.priority ?? 0),
    metadata: asRecord(row.metadata),
    sourcePlatform: typeof row.source_platform === "string" ? row.source_platform : "mobile_admin",
    sourceMessageId: typeof row.source_message_id === "string" ? row.source_message_id : null,
  };
}

function normalizeStorefront(row: UnknownRow | null | undefined): MobileAdminStorefrontProfile | null {
  if (!row?.id) return null;

  return {
    id: String(row.id),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    category: typeof row.category === "string" ? row.category : null,
    description: typeof row.description === "string" ? row.description : null,
    coverImageUrl: typeof row.cover_image_url === "string" ? row.cover_image_url : null,
    logoImageUrl: typeof row.logo_image_url === "string" ? row.logo_image_url : null,
    rating: row.rating == null ? null : Number(row.rating),
    reviewsLabel: typeof row.reviews_label === "string" ? row.reviews_label : null,
    addressLine: typeof row.address_line === "string" ? row.address_line : null,
    mapUrl: typeof row.map_url === "string" ? row.map_url : null,
    openingHours: typeof row.opening_hours === "string" ? row.opening_hours : null,
    phone: typeof row.phone === "string" ? row.phone : null,
    messengerUrl: typeof row.messenger_url === "string" ? row.messenger_url : null,
    instagramUrl: typeof row.instagram_url === "string" ? row.instagram_url : null,
    highlights: Array.isArray(row.highlights) ? row.highlights.filter((item): item is string => typeof item === "string") : [],
    isActive: row.is_active !== false,
  };
}

function normalizeTeamMember(row: UnknownRow): MobileAdminStorefrontTeamMember {
  return {
    id: String(row.id ?? ""),
    displayName: String(row.display_name ?? ""),
    roleLabel: typeof row.role_label === "string" ? row.role_label : null,
    avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
    bio: typeof row.bio === "string" ? row.bio : null,
    displayOrder: Number(row.display_order ?? 0),
    isVisible: row.is_visible !== false,
  };
}

function normalizeProduct(row: UnknownRow): MobileAdminStorefrontProduct {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    subtitle: typeof row.subtitle === "string" ? row.subtitle : null,
    priceLabel: typeof row.price_label === "string" ? row.price_label : null,
    imageUrl: typeof row.image_url === "string" ? row.image_url : null,
    productType: typeof row.product_type === "string" ? row.product_type : null,
    displayOrder: Number(row.display_order ?? 0),
    isActive: row.is_active !== false,
    isFeatured: Boolean(row.is_featured),
  };
}

function normalizeGalleryItem(row: UnknownRow): MobileAdminStorefrontGalleryItem {
  return {
    id: String(row.id ?? ""),
    title: typeof row.title === "string" ? row.title : null,
    imageUrl: String(row.image_url ?? ""),
    kind: typeof row.kind === "string" ? row.kind : null,
    displayOrder: Number(row.display_order ?? 0),
    isActive: row.is_active !== false,
  };
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toPublishedAt(status: MobileAdminContentPost["status"], existingPublishedAt?: string | null) {
  if (status !== "published") return null;
  return existingPublishedAt ?? new Date().toISOString();
}

async function resolveAdminPreviewContext(
  client: SharedSupabaseClient,
  options: { branchId?: string },
): Promise<{ orgId: string; branchId: string; defaultBranchId: string }> {
  const { orgId, branchId: defaultBranchId } = await ensureOrgContext(client);
  return {
    orgId,
    branchId: options.branchId?.trim() || defaultBranchId,
    defaultBranchId,
  };
}

export async function listAdminMerchServicesForMobile(
  client: SharedSupabaseClient,
  options: { branchId?: string } = {},
): Promise<MobileAdminMerchService[]> {
  void options;
  const { orgId } = await ensureOrgContext(client);
  const response = await client
    .from("services")
    .select(
      "id,name,short_description,image_url,featured_in_lookbook,featured_in_home,featured_in_explore,duration_label,display_order_home,display_order_explore,lookbook_category,lookbook_badge,lookbook_tone,duration_min,base_price,active",
    )
    .eq("org_id", orgId)
    .order("name", { ascending: true });

  if (response.error) {
    const message = response.error.message || "";
    const hasSchemaGap =
      message.includes("short_description") ||
      message.includes("image_url") ||
      message.includes("featured_in_lookbook") ||
      message.includes("featured_in_home") ||
      message.includes("featured_in_explore") ||
      message.includes("display_order_home") ||
      message.includes("display_order_explore");

    if (!hasSchemaGap) {
      throw response.error;
    }

    const fallback = await client
      .from("services")
      .select("id,name,duration_min,base_price,active")
      .eq("org_id", orgId)
      .order("name", { ascending: true });

    if (fallback.error) {
      throw fallback.error;
    }

    return (fallback.data ?? []).map((row) =>
      normalizeMerchService({
        ...row,
        short_description: null,
        image_url: null,
        featured_in_lookbook: false,
        featured_in_home: false,
        featured_in_explore: false,
        duration_label: null,
        display_order_home: 0,
        display_order_explore: 0,
        lookbook_category: null,
        lookbook_badge: null,
        lookbook_tone: null,
      }),
    );
  }

  return (response.data ?? []).map((row) => normalizeMerchService(row as UnknownRow));
}

export async function updateAdminMerchServiceForMobile(
  client: SharedSupabaseClient,
  input: MobileAdminMerchServiceUpdate,
): Promise<MobileAdminMerchService> {
  const { orgId } = await ensureOrgContext(client);
  const featuredInHome = Boolean(input.featuredInHome);
  const featuredInExplore = Boolean(input.featuredInExplore);
  const featuredInLookbook = Boolean(input.featuredInLookbook ?? (featuredInHome || featuredInExplore));
  const { data, error } = await client
    .from("services")
    .update({
      short_description: normalizeOptionalText(input.shortDescription),
      image_url: normalizeOptionalText(input.imageUrl),
      duration_label: normalizeOptionalText(input.durationLabel),
      featured_in_lookbook: featuredInLookbook,
      featured_in_home: featuredInHome,
      featured_in_explore: featuredInExplore,
      display_order_home: Number(input.displayOrderHome ?? 0),
      display_order_explore: Number(input.displayOrderExplore ?? 0),
      lookbook_category: normalizeOptionalText(input.lookbookCategory),
      lookbook_badge: normalizeOptionalText(input.lookbookBadge),
      lookbook_tone: normalizeOptionalText(input.lookbookTone),
    })
    .eq("id", input.id)
    .eq("org_id", orgId)
    .select(
      "id,name,short_description,image_url,featured_in_lookbook,featured_in_home,featured_in_explore,duration_label,display_order_home,display_order_explore,lookbook_category,lookbook_badge,lookbook_tone,duration_min,base_price,active",
    )
    .single();

  if (error) {
    throw error;
  }

  return normalizeMerchService((data ?? {}) as UnknownRow);
}

export async function listAdminContentSnapshotForMobile(
  client: SharedSupabaseClient,
  options: { branchId?: string; includeServices?: boolean } = {},
): Promise<MobileAdminContentSnapshot> {
  const { orgId, branchId, defaultBranchId } = await resolveAdminPreviewContext(client, { branchId: options.branchId });

  const [branchRes, postsRes, offersRes, storefrontRes, services] = await Promise.all([
    client.from("branches").select("id,name").eq("id", branchId).maybeSingle(),
    client
      .from("customer_content_posts")
      .select("id,title,summary,body,cover_image_url,content_type,status,published_at,priority,metadata,source_platform,source_message_id")
      .eq("org_id", orgId)
      .neq("status", "archived")
      .order("priority", { ascending: true })
      .order("published_at", { ascending: false }),
    client
      .from("marketing_offers")
      .select("id,title,description,image_url,badge,starts_at,ends_at,is_active,offer_metadata")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("starts_at", { ascending: false }),
    client
      .from("storefront_profile")
      .select(
        "id,slug,name,category,description,cover_image_url,logo_image_url,rating,reviews_label,address_line,map_url,opening_hours,phone,messenger_url,instagram_url,highlights,is_active,updated_at",
      )
      .eq("org_id", orgId)
      .eq("branch_id", branchId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    options.includeServices ? listAdminMerchServicesForMobile(client, { branchId }) : Promise.resolve([]),
  ]);

  if (postsRes.error) throw postsRes.error;
  if (offersRes.error) throw offersRes.error;
  if (storefrontRes.error) throw storefrontRes.error;

  const storefront = normalizeStorefront(storefrontRes.data as UnknownRow | null | undefined);
  const storefrontId = storefront?.id ?? null;

  const [productsRes, teamRes, galleryRes] = storefrontId
    ? await Promise.all([
        client
          .from("storefront_products")
          .select("id,name,subtitle,price_label,image_url,product_type,display_order,is_active,is_featured")
          .eq("storefront_id", storefrontId)
          .order("display_order", { ascending: true }),
        client
          .from("storefront_team_members")
          .select("id,display_name,role_label,avatar_url,bio,display_order,is_visible")
          .eq("storefront_id", storefrontId)
          .order("display_order", { ascending: true }),
        client
          .from("storefront_gallery")
          .select("id,title,image_url,kind,display_order,is_active")
          .eq("storefront_id", storefrontId)
          .order("display_order", { ascending: true }),
      ])
    : [null, null, null];

  if (productsRes?.error) throw productsRes.error;
  if (teamRes?.error) throw teamRes.error;
  if (galleryRes?.error) throw galleryRes.error;

  return {
    branchId,
    branchName: normalizeBranchName(branchRes.data as UnknownRow | null | undefined),
    isDefaultBranchView: branchId === defaultBranchId,
    storefront,
    posts: (postsRes.data ?? []).map((row) => normalizePost(row as UnknownRow)),
    offers: (offersRes.data ?? [])
      .map((row) => normalizeOffer(row as UnknownRow))
      .sort((left, right) => {
        const leftTier = getOfferPackageTier(left.metadata);
        const rightTier = getOfferPackageTier(right.metadata);
        const leftTierIndex = OFFER_PACKAGE_TIERS.indexOf(leftTier as (typeof OFFER_PACKAGE_TIERS)[number]);
        const rightTierIndex = OFFER_PACKAGE_TIERS.indexOf(rightTier as (typeof OFFER_PACKAGE_TIERS)[number]);
        if (leftTierIndex !== rightTierIndex) return leftTierIndex - rightTierIndex;

        const orderDelta = getOfferPackageOrder(left.metadata) - getOfferPackageOrder(right.metadata);
        if (orderDelta !== 0) return orderDelta;

        return left.title.localeCompare(right.title, "vi");
      }),
    products: (productsRes?.data ?? []).map((row) => normalizeProduct(row as UnknownRow)),
    team: (teamRes?.data ?? []).map((row) => normalizeTeamMember(row as UnknownRow)),
    gallery: (galleryRes?.data ?? []).map((row) => normalizeGalleryItem(row as UnknownRow)),
    services,
  };
}

export async function createAdminOfferForMobile(
  client: SharedSupabaseClient,
  input: MobileAdminOfferInput,
): Promise<MobileAdminOffer> {
  const { orgId } = await ensureOrgContext(client);
  const { data, error } = await client
    .from("marketing_offers")
    .insert({
      org_id: orgId,
      title: input.title.trim(),
      description: input.description.trim(),
      image_url: normalizeOptionalText(input.imageUrl),
      badge: normalizeOptionalText(input.badge),
      starts_at: normalizeOptionalText(input.startsAt),
      ends_at: normalizeOptionalText(input.endsAt),
      is_active: input.isActive,
      offer_metadata: input.metadata ?? {},
    })
    .select("id,title,description,image_url,badge,starts_at,ends_at,is_active,offer_metadata")
    .single();

  if (error) throw error;
  return normalizeOffer((data ?? {}) as UnknownRow);
}

export async function updateAdminOfferForMobile(
  client: SharedSupabaseClient,
  offerId: string,
  input: MobileAdminOfferInput,
): Promise<MobileAdminOffer> {
  const { orgId } = await ensureOrgContext(client);
  const { data, error } = await client
    .from("marketing_offers")
    .update({
      title: input.title.trim(),
      description: input.description.trim(),
      image_url: normalizeOptionalText(input.imageUrl),
      badge: normalizeOptionalText(input.badge),
      starts_at: normalizeOptionalText(input.startsAt),
      ends_at: normalizeOptionalText(input.endsAt),
      is_active: input.isActive,
      offer_metadata: input.metadata ?? {},
    })
    .eq("id", offerId)
    .eq("org_id", orgId)
    .select("id,title,description,image_url,badge,starts_at,ends_at,is_active,offer_metadata")
    .single();

  if (error) throw error;
  return normalizeOffer((data ?? {}) as UnknownRow);
}

export async function archiveAdminOfferForMobile(client: SharedSupabaseClient, offerId: string) {
  const { orgId } = await ensureOrgContext(client);
  const { error } = await client
    .from("marketing_offers")
    .update({ is_active: false })
    .eq("id", offerId)
    .eq("org_id", orgId);

  if (error) throw error;
}

export async function createAdminContentPostForMobile(
  client: SharedSupabaseClient,
  input: MobileAdminContentPostInput,
): Promise<MobileAdminContentPost> {
  const { orgId } = await ensureOrgContext(client);
  const status = input.status ?? "draft";
  const { data, error } = await client
    .from("customer_content_posts")
    .insert({
      org_id: orgId,
      title: input.title.trim(),
      summary: input.summary.trim(),
      body: input.body.trim(),
      cover_image_url: normalizeOptionalText(input.coverImageUrl),
      content_type: input.contentType ?? "trend",
      status,
      published_at: toPublishedAt(status),
      priority: Number(input.priority ?? 100),
      metadata: input.metadata ?? {},
      source_platform: "mobile_admin",
    })
    .select("id,title,summary,body,cover_image_url,content_type,status,published_at,priority,metadata,source_platform,source_message_id")
    .single();

  if (error) throw error;
  return normalizePost((data ?? {}) as UnknownRow);
}

export async function updateAdminContentPostForMobile(
  client: SharedSupabaseClient,
  postId: string,
  input: MobileAdminContentPostInput,
  existingPublishedAt: string | null = null,
): Promise<MobileAdminContentPost> {
  const { orgId } = await ensureOrgContext(client);
  const status = input.status ?? "draft";
  const { data, error } = await client
    .from("customer_content_posts")
    .update({
      title: input.title.trim(),
      summary: input.summary.trim(),
      body: input.body.trim(),
      cover_image_url: normalizeOptionalText(input.coverImageUrl),
      content_type: input.contentType ?? "trend",
      status,
      published_at: toPublishedAt(status, existingPublishedAt),
      priority: Number(input.priority ?? 100),
      metadata: input.metadata ?? {},
    })
    .eq("id", postId)
    .eq("org_id", orgId)
    .select("id,title,summary,body,cover_image_url,content_type,status,published_at,priority,metadata,source_platform,source_message_id")
    .single();

  if (error) throw error;
  return normalizePost((data ?? {}) as UnknownRow);
}

export async function archiveAdminContentPostForMobile(client: SharedSupabaseClient, postId: string) {
  const { orgId } = await ensureOrgContext(client);
  const { error } = await client
    .from("customer_content_posts")
    .update({ status: "archived", published_at: null })
    .eq("id", postId)
    .eq("org_id", orgId);

  if (error) throw error;
}

export async function upsertAdminStorefrontProfileForMobile(
  client: SharedSupabaseClient,
  input: MobileAdminStorefrontProfileInput,
): Promise<MobileAdminStorefrontProfile> {
  const { orgId, branchId } = await ensureOrgContext(client);
  const payload = {
    org_id: orgId,
    branch_id: branchId,
    slug: input.slug.trim(),
    name: input.name.trim(),
    category: normalizeOptionalText(input.category),
    description: normalizeOptionalText(input.description),
    cover_image_url: normalizeOptionalText(input.coverImageUrl),
    logo_image_url: normalizeOptionalText(input.logoImageUrl),
    rating: input.rating == null ? null : Number(input.rating),
    reviews_label: normalizeOptionalText(input.reviewsLabel),
    address_line: normalizeOptionalText(input.addressLine),
    map_url: normalizeOptionalText(input.mapUrl),
    opening_hours: normalizeOptionalText(input.openingHours),
    phone: normalizeOptionalText(input.phone),
    messenger_url: normalizeOptionalText(input.messengerUrl),
    instagram_url: normalizeOptionalText(input.instagramUrl),
    highlights: input.highlights ?? [],
    is_active: input.isActive ?? false,
  };

  const query = input.id
    ? client
        .from("storefront_profile")
        .update(payload)
        .eq("id", input.id)
        .eq("org_id", orgId)
    : client.from("storefront_profile").insert(payload);

  const { data, error } = await query
    .select(
      "id,slug,name,category,description,cover_image_url,logo_image_url,rating,reviews_label,address_line,map_url,opening_hours,phone,messenger_url,instagram_url,highlights,is_active",
    )
    .single();

  if (error) throw error;
  return normalizeStorefront((data ?? {}) as UnknownRow)!;
}

export async function setActiveAdminStorefrontProfileForMobile(
  client: SharedSupabaseClient,
  storefrontId: string,
): Promise<void> {
  const { orgId, branchId } = await ensureOrgContext(client);
  const disableCurrent = await client
    .from("storefront_profile")
    .update({ is_active: false })
    .eq("org_id", orgId)
    .eq("branch_id", branchId);

  if (disableCurrent.error) throw disableCurrent.error;

  const enableTarget = await client
    .from("storefront_profile")
    .update({ is_active: true })
    .eq("id", storefrontId)
    .eq("org_id", orgId)
    .eq("branch_id", branchId);

  if (enableTarget.error) throw enableTarget.error;
}

export async function createAdminStorefrontTeamMemberForMobile(
  client: SharedSupabaseClient,
  storefrontId: string,
  input: MobileAdminStorefrontTeamMemberInput,
): Promise<MobileAdminStorefrontTeamMember> {
  const { data, error } = await client
    .from("storefront_team_members")
    .insert({
      storefront_id: storefrontId,
      display_name: input.displayName.trim(),
      role_label: normalizeOptionalText(input.roleLabel),
      avatar_url: normalizeOptionalText(input.avatarUrl),
      bio: normalizeOptionalText(input.bio),
      display_order: Number(input.displayOrder ?? 0),
      is_visible: input.isVisible ?? true,
    })
    .select("id,display_name,role_label,avatar_url,bio,display_order,is_visible")
    .single();

  if (error) throw error;
  return normalizeTeamMember((data ?? {}) as UnknownRow);
}

export async function updateAdminStorefrontTeamMemberForMobile(
  client: SharedSupabaseClient,
  memberId: string,
  input: MobileAdminStorefrontTeamMemberInput,
): Promise<MobileAdminStorefrontTeamMember> {
  const { data, error } = await client
    .from("storefront_team_members")
    .update({
      display_name: input.displayName.trim(),
      role_label: normalizeOptionalText(input.roleLabel),
      avatar_url: normalizeOptionalText(input.avatarUrl),
      bio: normalizeOptionalText(input.bio),
      display_order: Number(input.displayOrder ?? 0),
      is_visible: input.isVisible ?? true,
    })
    .eq("id", memberId)
    .select("id,display_name,role_label,avatar_url,bio,display_order,is_visible")
    .single();

  if (error) throw error;
  return normalizeTeamMember((data ?? {}) as UnknownRow);
}

export async function deleteAdminStorefrontTeamMemberForMobile(client: SharedSupabaseClient, memberId: string) {
  const { error } = await client.from("storefront_team_members").delete().eq("id", memberId);
  if (error) throw error;
}

export async function createAdminStorefrontProductForMobile(
  client: SharedSupabaseClient,
  storefrontId: string,
  input: MobileAdminStorefrontProductInput,
): Promise<MobileAdminStorefrontProduct> {
  const { data, error } = await client
    .from("storefront_products")
    .insert({
      storefront_id: storefrontId,
      name: input.name.trim(),
      subtitle: normalizeOptionalText(input.subtitle),
      price_label: normalizeOptionalText(input.priceLabel),
      image_url: normalizeOptionalText(input.imageUrl),
      product_type: normalizeOptionalText(input.productType),
      display_order: Number(input.displayOrder ?? 0),
      is_active: input.isActive ?? true,
      is_featured: input.isFeatured ?? false,
    })
    .select("id,name,subtitle,price_label,image_url,product_type,display_order,is_active,is_featured")
    .single();

  if (error) throw error;
  return normalizeProduct((data ?? {}) as UnknownRow);
}

export async function updateAdminStorefrontProductForMobile(
  client: SharedSupabaseClient,
  productId: string,
  input: MobileAdminStorefrontProductInput,
): Promise<MobileAdminStorefrontProduct> {
  const { data, error } = await client
    .from("storefront_products")
    .update({
      name: input.name.trim(),
      subtitle: normalizeOptionalText(input.subtitle),
      price_label: normalizeOptionalText(input.priceLabel),
      image_url: normalizeOptionalText(input.imageUrl),
      product_type: normalizeOptionalText(input.productType),
      display_order: Number(input.displayOrder ?? 0),
      is_active: input.isActive ?? true,
      is_featured: input.isFeatured ?? false,
    })
    .eq("id", productId)
    .select("id,name,subtitle,price_label,image_url,product_type,display_order,is_active,is_featured")
    .single();

  if (error) throw error;
  return normalizeProduct((data ?? {}) as UnknownRow);
}

export async function deleteAdminStorefrontProductForMobile(client: SharedSupabaseClient, productId: string) {
  const { error } = await client.from("storefront_products").delete().eq("id", productId);
  if (error) throw error;
}

export async function createAdminStorefrontGalleryItemForMobile(
  client: SharedSupabaseClient,
  storefrontId: string,
  input: MobileAdminStorefrontGalleryItemInput,
): Promise<MobileAdminStorefrontGalleryItem> {
  const { data, error } = await client
    .from("storefront_gallery")
    .insert({
      storefront_id: storefrontId,
      title: normalizeOptionalText(input.title),
      image_url: input.imageUrl.trim(),
      kind: normalizeOptionalText(input.kind),
      display_order: Number(input.displayOrder ?? 0),
      is_active: input.isActive ?? true,
    })
    .select("id,title,image_url,kind,display_order,is_active")
    .single();

  if (error) throw error;
  return normalizeGalleryItem((data ?? {}) as UnknownRow);
}

export async function updateAdminStorefrontGalleryItemForMobile(
  client: SharedSupabaseClient,
  galleryItemId: string,
  input: MobileAdminStorefrontGalleryItemInput,
): Promise<MobileAdminStorefrontGalleryItem> {
  const { data, error } = await client
    .from("storefront_gallery")
    .update({
      title: normalizeOptionalText(input.title),
      image_url: input.imageUrl.trim(),
      kind: normalizeOptionalText(input.kind),
      display_order: Number(input.displayOrder ?? 0),
      is_active: input.isActive ?? true,
    })
    .eq("id", galleryItemId)
    .select("id,title,image_url,kind,display_order,is_active")
    .single();

  if (error) throw error;
  return normalizeGalleryItem((data ?? {}) as UnknownRow);
}

export async function deleteAdminStorefrontGalleryItemForMobile(client: SharedSupabaseClient, galleryItemId: string) {
  const { error } = await client.from("storefront_gallery").delete().eq("id", galleryItemId);
  if (error) throw error;
}
