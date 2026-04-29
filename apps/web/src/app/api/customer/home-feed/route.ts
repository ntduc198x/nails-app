import { NextResponse } from "next/server";
import {
  normalizeLookbookRows,
  type CustomerContentPost,
  type LookbookItem,
  type LookbookRow,
  type MarketingOfferCard,
} from "@nails/shared";
import { createServiceRoleClient } from "@/lib/supabase";

function asMetadata(value: unknown) {
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
    metadata: asMetadata(row.metadata),
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
    metadata: asMetadata(row.offer_metadata),
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

export async function GET() {
  try {
    const supabase = createServiceRoleClient();
    const nowMs = Date.now();

    const [lookbookResult, contentResult, offersResult] = await Promise.all([
      supabase
        .from("services")
        .select("id,name,short_description,image_url,duration_min,base_price,lookbook_category,lookbook_badge,lookbook_tone,duration_label,display_order_home,display_order_explore,created_at")
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

    const lookbook =
      !lookbookResult.error && lookbookResult.data
        ? normalizeLookbookRows(lookbookResult.data as LookbookRow[], { context: "home" })
        : [];

    const contentPosts =
      !contentResult.error && contentResult.data
        ? normalizeContentPosts(contentResult.data as Array<Record<string, unknown>>)
        : [];

    const offers =
      !offersResult.error && offersResult.data
        ? normalizeOffers(offersResult.data as Array<Record<string, unknown>>)
            .filter((offer) => isOfferActiveNow(offer, nowMs))
            .slice(0, 4)
        : [];

    return NextResponse.json({
      ok: true,
      data: {
        lookbook: lookbook satisfies LookbookItem[],
        contentPosts,
        offers,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Khong tai duoc customer home feed" },
      { status: 500 },
    );
  }
}
