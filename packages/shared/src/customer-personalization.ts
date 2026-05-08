import {
  formatLookbookPrice,
  normalizeLookbookRows,
  type CustomerContentPost,
  type LookbookRow,
  type MarketingOfferCard,
} from "./customer-feed";
import {
  buildExploreStats,
  type CustomerExplorePayload,
  type ExploreGalleryItem,
  type ExploreMapCard,
  type ExploreProduct,
  type ExploreStorefront,
  type ExploreTeamMember,
} from "./customer-explore";
import type { SharedSupabaseClient } from "./org";

type CustomerAccountContext = {
  orgId: string;
  customerId: string;
  userId: string;
};

export type CustomerScopedContext = {
  orgId: string;
  branchId: string | null;
  customerId: string | null;
  userId: string;
};

type FavoriteRow = {
  service_id?: string | null;
};

type TicketHistoryRow = {
  id?: string | null;
  created_at?: string | null;
  ticket_items?:
    | Array<{
        service_id?: string | null;
        unit_price?: number | null;
        services?: {
          id?: string | null;
          name?: string | null;
          image_url?: string | null;
          short_description?: string | null;
          base_price?: number | null;
        } | null;
      }>
    | null;
};

type OfferRow = Record<string, unknown>;
type StorefrontRow = Record<string, unknown>;
type ProductRow = Record<string, unknown>;
type TeamRow = Record<string, unknown>;
type GalleryRow = Record<string, unknown>;

export type CustomerHomeFeedPayload = {
  lookbook: ReturnType<typeof normalizeLookbookRows>;
  contentPosts: CustomerContentPost[];
  offers: MarketingOfferCard[];
};

export type CustomerMembershipTier = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  spendingThreshold: number;
  visitThreshold: number;
  accentColor: string | null;
  perks: string[];
  isActive: boolean;
};

export type CustomerMembershipOffer = MarketingOfferCard;

export type CustomerMembershipSummary = {
  hasMembership: boolean;
  membershipId: string | null;
  currentTier: CustomerMembershipTier | null;
  nextTier: CustomerMembershipTier | null;
  tiers: CustomerMembershipTier[];
  pointsBalance: number;
  lifetimePoints: number;
  totalSpent: number;
  totalVisits: number;
  joinedAt: string | null;
  expiresAt: string | null;
  progress: number;
  perks: string[];
  offers: CustomerMembershipOffer[];
};

export type CustomerHistoryItem = {
  id: string;
  ticketId: string;
  serviceId: string | null;
  serviceName: string;
  serviceImageUrl: string | null;
  servicePriceLabel: string | null;
  serviceSummary: string | null;
  occurredAt: string;
};

export type CustomerUpcomingBookingItem = {
  id: string;
  requestedService: string;
  preferredStaff: string | null;
  requestedStartAt: string;
  requestedEndAt: string | null;
  status: string;
  appointmentId: string | null;
};

async function getCustomerAccountContext(client: SharedSupabaseClient): Promise<CustomerAccountContext | null> {
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await client
    .from("customer_accounts")
    .select("org_id,customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.org_id || !data?.customer_id) {
    return null;
  }

  return {
    orgId: String(data.org_id),
    customerId: String(data.customer_id),
    userId: user.id,
  };
}

async function ensureCustomerAccountContext(client: SharedSupabaseClient): Promise<CustomerAccountContext | null> {
  const current = await getCustomerAccountContext(client);
  if (current) {
    return current;
  }

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return null;
  }

  const { error, data } = await client.rpc("link_customer_account_by_phone");
  if (error) {
    const errorMsg = error.message || "";
    if (errorMsg.includes("PROFILE_NOT_FOUND") || errorMsg.includes("profile") || errorMsg.includes("not exist")) {
      throw new Error("PROFILE_NOT_FOUND:Vui lòng cập nhật số điện thoại trong hồ sơ để lưu yêu thích.");
    }
    if (errorMsg.includes("phone") || errorMsg.includes("null")) {
      throw new Error("PHONE_NOT_SET:Không tìm thấy số điện thoại. Vui lòng cập nhật hồ sơ.");
    }
    return null;
  }

  if (data === null || data === false) {
    return null;
  }

  return getCustomerAccountContext(client);
}

function normalizePhone(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/[^\d]/g, "");
}

export async function getCustomerScopedContextForUser(
  client: SharedSupabaseClient,
  userId: string,
): Promise<CustomerScopedContext | null> {
  const [profileResult, accountResult] = await Promise.all([
    client
      .from("profiles")
      .select("org_id,default_branch_id")
      .eq("user_id", userId)
      .maybeSingle(),
    client
      .from("customer_accounts")
      .select("org_id,customer_id")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (accountResult.error) {
    throw accountResult.error;
  }

  // Customer-facing data should follow the CRM/customer mapping first.
  const orgId =
    (typeof accountResult.data?.org_id === "string" && accountResult.data.org_id) ||
    (typeof profileResult.data?.org_id === "string" && profileResult.data.org_id) ||
    null;

  if (!orgId) {
    return null;
  }

  return {
    orgId,
    branchId: typeof profileResult.data?.default_branch_id === "string" ? profileResult.data.default_branch_id : null,
    customerId: typeof accountResult.data?.customer_id === "string" ? accountResult.data.customer_id : null,
    userId,
  };
}

export async function getCustomerScopedContext(client: SharedSupabaseClient): Promise<CustomerScopedContext | null> {
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return null;
  }

  return getCustomerScopedContextForUser(client, user.id);
}

export function getCustomerScopedContextForGuest(orgId: string, branchId: string | null = null): CustomerScopedContext {
  return {
    orgId,
    branchId,
    customerId: null,
    userId: "guest",
  };
}

function asRecord(value: unknown) {
  return typeof value === "object" && value ? (value as Record<string, unknown>) : {};
}

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
    metadata: asRecord(row.metadata),
  }));
}

function normalizeOffers(rows: OfferRow[]): MarketingOfferCard[] {
  return rows.map((row, index) => ({
    id: String(row.id ?? `offer-${index}`),
    title: String(row.title ?? "Uu dai moi"),
    description: String(row.description ?? ""),
    imageUrl: typeof row.image_url === "string" ? row.image_url : null,
    badge: typeof row.badge === "string" ? row.badge : null,
    startsAt: typeof row.starts_at === "string" ? row.starts_at : null,
    endsAt: typeof row.ends_at === "string" ? row.ends_at : null,
    metadata: asRecord(row.offer_metadata),
  }));
}

function isOfferActiveNow(offer: MarketingOfferCard, nowMs: number) {
  const startsAtMs = offer.startsAt ? Date.parse(offer.startsAt) : Number.NaN;
  const endsAtMs = offer.endsAt ? Date.parse(offer.endsAt) : Number.NaN;

  if (Number.isFinite(startsAtMs) && startsAtMs > nowMs) return false;
  if (Number.isFinite(endsAtMs) && endsAtMs < nowMs) return false;
  return true;
}

function normalizeStorefront(row?: StorefrontRow | null): ExploreStorefront | null {
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

function normalizeProducts(rows: ProductRow[]): ExploreProduct[] {
  return rows.map((row, index) => ({
    id: String(row.id ?? `product-${index}`),
    name: String(row.name ?? "San pham"),
    subtitle: typeof row.subtitle === "string" ? row.subtitle : null,
    priceLabel: typeof row.price_label === "string" ? row.price_label : null,
    imageUrl: typeof row.image_url === "string" ? row.image_url : null,
    productType: typeof row.product_type === "string" ? row.product_type : null,
    isFeatured: Boolean(row.is_featured),
  }));
}

function normalizeTeam(rows: TeamRow[]): ExploreTeamMember[] {
  return rows.map((row, index) => ({
    id: String(row.id ?? `team-${index}`),
    displayName: String(row.display_name ?? `Nhan su ${index + 1}`),
    roleLabel: typeof row.role_label === "string" ? row.role_label : null,
    avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
    bio: typeof row.bio === "string" ? row.bio : null,
  }));
}

function normalizeGallery(rows: GalleryRow[]): ExploreGalleryItem[] {
  return rows
    .filter((row) => typeof row.image_url === "string" && row.image_url.trim())
    .map((row, index) => ({
      id: String(row.id ?? `gallery-${index}`),
      title: typeof row.title === "string" ? row.title : null,
      imageUrl: String(row.image_url),
      kind: typeof row.kind === "string" ? row.kind : null,
    }));
}

function normalizeTier(row: Record<string, unknown>): CustomerMembershipTier {
  return {
    id: String(row.id ?? ""),
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    description: typeof row.description === "string" ? row.description : null,
    spendingThreshold: Number(row.spending_threshold ?? 0),
    visitThreshold: Number(row.visit_threshold ?? 0),
    accentColor: typeof row.accent_color === "string" ? row.accent_color : null,
    perks: Array.isArray(row.perks) ? row.perks.filter((item): item is string => typeof item === "string") : [],
    isActive: row.is_active !== false,
  };
}

function getMembershipTierRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "object" && first ? (first as Record<string, unknown>) : null;
  }

  return typeof value === "object" && value ? (value as Record<string, unknown>) : null;
}

function buildMembershipProgress(input: {
  nextTier: CustomerMembershipTier | null;
  totalSpent: number;
  totalVisits: number;
}) {
  if (!input.nextTier) {
    return 1;
  }

  const progressParts: number[] = [];

  if (input.nextTier.spendingThreshold > 0) {
    progressParts.push(input.totalSpent / input.nextTier.spendingThreshold);
  }

  if (input.nextTier.visitThreshold > 0) {
    progressParts.push(input.totalVisits / input.nextTier.visitThreshold);
  }

  if (!progressParts.length) {
    return 0;
  }

  return Math.max(0, Math.min(Math.max(...progressParts), 1));
}

export async function listCustomerHomeFeedForContext(
  client: SharedSupabaseClient,
  context: CustomerScopedContext,
): Promise<CustomerHomeFeedPayload> {
  const nowMs = Date.now();

  const [lookbookResult, contentResult, offersResult] = await Promise.all([
    client
      .from("services")
      .select(
        "id,name,short_description,image_url,featured_in_lookbook,duration_min,base_price,lookbook_category,lookbook_badge,lookbook_tone,duration_label,display_order_home,display_order_explore,created_at",
      )
      .eq("org_id", context.orgId)
      .eq("active", true)
      .eq("featured_in_lookbook", true)
      .eq("featured_in_home", true)
      .order("display_order_home", { ascending: true })
      .order("name", { ascending: true })
      .limit(6),
    client
      .from("customer_content_posts")
      .select("id,title,summary,body,cover_image_url,content_type,source_platform,published_at,priority,metadata")
      .eq("org_id", context.orgId)
      .eq("status", "published")
      .order("priority", { ascending: true })
      .order("published_at", { ascending: false })
      .limit(4),
    client
      .from("marketing_offers")
      .select("id,title,description,image_url,badge,starts_at,ends_at,offer_metadata")
      .eq("org_id", context.orgId)
      .eq("is_active", true)
      .order("starts_at", { ascending: false })
      .limit(12),
  ]);

  if (lookbookResult.error) {
    throw lookbookResult.error;
  }

  if (contentResult.error) {
    throw contentResult.error;
  }

  if (offersResult.error) {
    throw offersResult.error;
  }

  return {
    lookbook: normalizeLookbookRows((lookbookResult.data ?? []) as LookbookRow[], { context: "home" }),
    contentPosts: normalizeContentPosts((contentResult.data ?? []) as Array<Record<string, unknown>>),
    offers: normalizeOffers((offersResult.data ?? []) as OfferRow[])
      .filter((offer) => isOfferActiveNow(offer, nowMs))
      .slice(0, 4),
  };
}

export async function listCustomerExploreForContext(
  client: SharedSupabaseClient,
  context: CustomerScopedContext,
): Promise<CustomerExplorePayload> {
  const nowMs = Date.now();

  const storefrontSelect =
    "id,slug,name,category,description,cover_image_url,logo_image_url,rating,reviews_label,address_line,map_url,opening_hours,phone,messenger_url,instagram_url,highlights,branch_id,updated_at";

  const loadStorefront = async (branchId?: string | null) => {
    const query = client
      .from("storefront_profile")
      .select(storefrontSelect)
      .eq("org_id", context.orgId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1);

    return branchId ? query.eq("branch_id", branchId).maybeSingle() : query.maybeSingle();
  };

  const storefrontByBranchResult = context.branchId ? await loadStorefront(context.branchId) : null;

  if (storefrontByBranchResult?.error) {
    throw storefrontByBranchResult.error;
  }

  const storefrontResult =
    storefrontByBranchResult?.data || !context.branchId
      ? storefrontByBranchResult ?? (await loadStorefront(null))
      : await loadStorefront(null);

  if (storefrontResult.error) {
    throw storefrontResult.error;
  }

  const storefront = normalizeStorefront(storefrontResult.data as StorefrontRow | null | undefined);
  const storefrontId = typeof storefrontResult.data?.id === "string" ? storefrontResult.data.id : null;

  const [servicesResult, productsResult, teamResult, galleryResult, offersResult] = storefrontId
    ? await Promise.all([
        client
          .from("services")
          .select(
            "id,name,short_description,image_url,featured_in_lookbook,duration_min,base_price,lookbook_category,lookbook_badge,lookbook_tone,duration_label,display_order_home,display_order_explore,created_at",
          )
          .eq("org_id", context.orgId)
          .eq("active", true)
          .eq("featured_in_lookbook", true)
          .eq("featured_in_explore", true)
          .order("display_order_explore", { ascending: true })
          .order("name", { ascending: true })
          .limit(8),
        client
          .from("storefront_products")
          .select("id,name,subtitle,price_label,image_url,product_type,is_featured")
          .eq("org_id", context.orgId)
          .eq("storefront_id", storefrontId)
          .eq("is_active", true)
          .order("display_order", { ascending: true })
          .limit(8),
        client
          .from("storefront_team_members")
          .select("id,display_name,role_label,avatar_url,bio")
          .eq("org_id", context.orgId)
          .eq("storefront_id", storefrontId)
          .eq("is_visible", true)
          .order("display_order", { ascending: true })
          .limit(8),
        client
          .from("storefront_gallery")
          .select("id,title,image_url,kind")
          .eq("org_id", context.orgId)
          .eq("storefront_id", storefrontId)
          .eq("is_active", true)
          .order("display_order", { ascending: true })
          .limit(12),
        client
          .from("marketing_offers")
          .select("id,title,description,image_url,badge,starts_at,ends_at,offer_metadata")
          .eq("org_id", context.orgId)
          .eq("is_active", true)
          .order("starts_at", { ascending: false })
          .limit(12),
      ])
    : [null, null, null, null, null];

  if (servicesResult?.error) throw servicesResult.error;
  if (productsResult?.error) throw productsResult.error;
  if (teamResult?.error) throw teamResult.error;
  if (galleryResult?.error) throw galleryResult.error;
  if (offersResult?.error) throw offersResult.error;

  const featuredServices = normalizeLookbookRows((servicesResult?.data ?? []) as LookbookRow[], { context: "explore" });
  const products = normalizeProducts((productsResult?.data ?? []) as ProductRow[]);
  const team = normalizeTeam((teamResult?.data ?? []) as TeamRow[]);
  const gallery = normalizeGallery((galleryResult?.data ?? []) as GalleryRow[]);
  const offers = normalizeOffers((offersResult?.data ?? []) as OfferRow[])
    .filter((offer) => isOfferActiveNow(offer, nowMs))
    .slice(0, 4);

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

export async function listCustomerMembershipSummary(
  client: SharedSupabaseClient,
): Promise<CustomerMembershipSummary> {
  const context = await getCustomerScopedContext(client);

  if (!context) {
    return {
      hasMembership: false,
      membershipId: null,
      currentTier: null,
      nextTier: null,
      tiers: [],
      pointsBalance: 0,
      lifetimePoints: 0,
      totalSpent: 0,
      totalVisits: 0,
      joinedAt: null,
      expiresAt: null,
      progress: 0,
      perks: [],
      offers: [],
    };
  }

  const nowMs = Date.now();
  const [membershipResult, tiersResult, offersResult] = await Promise.all([
    client
      .from("customer_memberships")
      .select(
        "id,tier_id,points_balance,lifetime_points,total_spent,total_visits,joined_at,expires_at,membership_tiers(id,code,name,description,spending_threshold,visit_threshold,accent_color,perks,is_active)",
      )
      .eq("org_id", context.orgId)
      .eq("user_id", context.userId)
      .maybeSingle(),
    client
      .from("membership_tiers")
      .select("id,code,name,description,spending_threshold,visit_threshold,accent_color,perks,is_active")
      .eq("org_id", context.orgId)
      .eq("is_active", true)
      .order("spending_threshold", { ascending: true })
      .order("visit_threshold", { ascending: true }),
    client
      .from("marketing_offers")
      .select("id,title,description,image_url,badge,starts_at,ends_at,offer_metadata")
      .eq("org_id", context.orgId)
      .eq("is_active", true)
      .order("starts_at", { ascending: false })
      .limit(12),
  ]);

  if (membershipResult.error) {
    throw membershipResult.error;
  }

  if (tiersResult.error) {
    throw tiersResult.error;
  }

  if (offersResult.error) {
    throw offersResult.error;
  }

  const tiers = ((tiersResult.data ?? []) as Array<Record<string, unknown>>).map(normalizeTier);
  const currentTierRecord = getMembershipTierRecord(membershipResult.data?.membership_tiers);
  const currentTier = currentTierRecord ? normalizeTier(currentTierRecord) : null;
  const currentTierIndex = currentTier ? tiers.findIndex((tier) => tier.id === currentTier.id) : -1;
  const nextTier = currentTierIndex >= 0 ? tiers[currentTierIndex + 1] ?? null : tiers[0] ?? null;
  const totalSpent = Number(membershipResult.data?.total_spent ?? 0);
  const totalVisits = Number(membershipResult.data?.total_visits ?? 0);

  return {
    hasMembership: Boolean(membershipResult.data),
    membershipId: typeof membershipResult.data?.id === "string" ? membershipResult.data.id : null,
    currentTier,
    nextTier,
    tiers,
    pointsBalance: Number(membershipResult.data?.points_balance ?? 0),
    lifetimePoints: Number(membershipResult.data?.lifetime_points ?? 0),
    totalSpent,
    totalVisits,
    joinedAt: typeof membershipResult.data?.joined_at === "string" ? membershipResult.data.joined_at : null,
    expiresAt: typeof membershipResult.data?.expires_at === "string" ? membershipResult.data.expires_at : null,
    progress: buildMembershipProgress({ nextTier, totalSpent, totalVisits }),
    perks: currentTier?.perks ?? [],
    offers: normalizeOffers((offersResult.data ?? []) as OfferRow[])
      .filter((offer) => isOfferActiveNow(offer, nowMs))
      .slice(0, 6),
  };
}

export async function listCustomerFavoriteServiceIds(client: SharedSupabaseClient): Promise<string[]> {
  const context = await getCustomerAccountContext(client);
  if (!context) {
    return [];
  }

  const { data, error } = await client
    .from("customer_favorite_services")
    .select("service_id")
    .eq("org_id", context.orgId)
    .eq("user_id", context.userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as FavoriteRow[])
    .map((row) => (typeof row.service_id === "string" ? row.service_id : null))
    .filter((value): value is string => Boolean(value));
}

export async function setCustomerFavoriteService(
  client: SharedSupabaseClient,
  input: { serviceId: string; isFavorite: boolean },
): Promise<void> {
  const context = await ensureCustomerAccountContext(client);
  if (!context) {
    throw new Error("CUSTOMER_ACCOUNT_NOT_LINKED");
  }

  if (input.isFavorite) {
    const { data: existingFavorite, error: existingFavoriteError } = await client
      .from("customer_favorite_services")
      .select("user_id")
      .eq("org_id", context.orgId)
      .eq("user_id", context.userId)
      .eq("service_id", input.serviceId)
      .maybeSingle();

    if (existingFavoriteError) {
      throw existingFavoriteError;
    }

    if (!existingFavorite?.user_id) {
      const { error: insertError } = await client.from("customer_favorite_services").insert({
        user_id: context.userId,
        org_id: context.orgId,
        service_id: input.serviceId,
      });

      if (insertError) {
        throw insertError;
      }
    }

    return;
  }

  const { error } = await client
    .from("customer_favorite_services")
    .delete()
    .eq("org_id", context.orgId)
    .eq("user_id", context.userId)
    .eq("service_id", input.serviceId);

  if (error) {
    throw error;
  }
}

export async function listCustomerHistory(
  client: SharedSupabaseClient,
  options: { limit?: number } = {},
): Promise<CustomerHistoryItem[]> {
  const context = await getCustomerAccountContext(client);
  if (!context) {
    return [];
  }

  const { data, error } = await client
    .from("tickets")
    .select("id,created_at,ticket_items(service_id,unit_price,services(id,name,image_url,short_description,base_price))")
    .eq("org_id", context.orgId)
    .eq("customer_id", context.customerId)
    .eq("status", "CLOSED")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 24);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as TicketHistoryRow[];
  const history: CustomerHistoryItem[] = [];

  for (const row of rows) {
    const ticketId = typeof row.id === "string" ? row.id : null;
    const occurredAt = typeof row.created_at === "string" ? row.created_at : null;

    if (!ticketId || !occurredAt) {
      continue;
    }

    const items = Array.isArray(row.ticket_items) ? row.ticket_items : [];

    for (const item of items) {
      const serviceId =
        typeof item.service_id === "string"
          ? item.service_id
          : typeof item.services?.id === "string"
            ? item.services.id
            : null;

      const serviceName = item.services?.name?.trim() || "Dịch vụ tại tiệm";
      const priceValue =
        typeof item.unit_price === "number"
          ? item.unit_price
          : typeof item.services?.base_price === "number"
            ? item.services.base_price
            : null;

      history.push({
        id: `${ticketId}:${serviceId ?? serviceName}`,
        ticketId,
        serviceId,
        serviceName,
        serviceImageUrl: item.services?.image_url?.trim() || null,
        servicePriceLabel: priceValue === null ? null : formatLookbookPrice(priceValue),
        serviceSummary: item.services?.short_description?.trim() || null,
        occurredAt,
      });
    }
  }

  return history;
}

export async function listCustomerUpcomingBookings(
  client: SharedSupabaseClient,
  options: { limit?: number } = {},
): Promise<CustomerUpcomingBookingItem[]> {
  const context = await getCustomerAccountContext(client);
  if (!context) {
    return [];
  }

  const [profileResult, customerResult, bookingRequestsResult] = await Promise.all([
    client
      .from("profiles")
      .select("phone")
      .eq("user_id", context.userId)
      .maybeSingle(),
    client
      .from("customers")
      .select("phone")
      .eq("id", context.customerId)
      .maybeSingle(),
    client
      .from("booking_requests")
      .select("id,customer_phone,requested_service,preferred_staff,requested_start_at,requested_end_at,status,appointment_id")
      .eq("org_id", context.orgId)
      .gte("requested_start_at", new Date().toISOString())
      .in("status", ["NEW", "CONFIRMED", "NEEDS_RESCHEDULE", "CONVERTED"])
      .order("requested_start_at", { ascending: true })
      .limit(Math.max(options.limit ?? 12, 48)),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }
  if (customerResult.error) {
    throw customerResult.error;
  }
  if (bookingRequestsResult.error) {
    throw bookingRequestsResult.error;
  }

  const phoneCandidates = new Set(
    [profileResult.data?.phone, customerResult.data?.phone]
      .map((value) => normalizePhone(typeof value === "string" ? value : null))
      .filter(Boolean),
  );

  if (!phoneCandidates.size) {
    return [];
  }

  const rows = ((bookingRequestsResult.data ?? []) as Array<Record<string, unknown>>).filter((row) =>
    phoneCandidates.has(normalizePhone(typeof row.customer_phone === "string" ? row.customer_phone : null)),
  );

  const appointmentIds = rows
    .map((row) => (typeof row.appointment_id === "string" ? row.appointment_id : null))
    .filter((value): value is string => Boolean(value));

  const appointmentStatusMap = new Map<string, { status: string; startAt: string }>();
  if (appointmentIds.length) {
    const appointmentsResult = await client
      .from("appointments")
      .select("id,status,start_at")
      .in("id", appointmentIds);

    if (appointmentsResult.error) {
      throw appointmentsResult.error;
    }

    for (const appointment of appointmentsResult.data ?? []) {
      if (typeof appointment.id === "string" && typeof appointment.status === "string" && typeof appointment.start_at === "string") {
        appointmentStatusMap.set(appointment.id, {
          status: appointment.status,
          startAt: appointment.start_at,
        });
      }
    }
  }

  return rows
    .filter((row) => {
      const appointmentId = typeof row.appointment_id === "string" ? row.appointment_id : null;
      if (!appointmentId) {
        return true;
      }

      const appointment = appointmentStatusMap.get(appointmentId);
      if (!appointment) {
        return true;
      }

      return appointment.status === "BOOKED" || appointment.status === "CHECKED_IN";
    })
    .map((row) => ({
      id: String(row.id ?? ""),
      requestedService:
        typeof row.requested_service === "string" && row.requested_service.trim()
          ? row.requested_service.trim()
          : "Lịch dịch vụ đã đặt",
      preferredStaff: typeof row.preferred_staff === "string" ? row.preferred_staff : null,
      requestedStartAt: String(row.requested_start_at ?? ""),
      requestedEndAt: typeof row.requested_end_at === "string" ? row.requested_end_at : null,
      status: String(row.status ?? "NEW"),
      appointmentId: typeof row.appointment_id === "string" ? row.appointment_id : null,
    }))
    .slice(0, options.limit ?? 12);
}
