import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase";

type LandingManagerRole = "OWNER" | "MANAGER" | "RECEPTION" | "TECH";

type ContentPostInput = {
  id?: string;
  title?: string;
  summary?: string;
  body?: string;
  coverImageUrl?: string | null;
  contentType?: "trend" | "care" | "news" | "offer_hint";
  status?: "draft" | "approved" | "published" | "archived";
  priority?: number;
};

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

async function requireLandingManager(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Missing bearer token" }, { status: 401 }) };
  }

  const supabase = createServiceRoleClient();
  const userRes = await supabase.auth.getUser(token);
  const user = userRes.data.user;
  if (userRes.error || !user) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: userRes.error?.message ?? "Invalid session" }, { status: 401 }) };
  }

  const roleRes = await supabase
    .from("user_roles")
    .select("org_id,role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (roleRes.error || !roleRes.data?.org_id || !roleRes.data?.role) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: roleRes.error?.message ?? "Missing role context" }, { status: 403 }) };
  }

  const role = String(roleRes.data.role) as LandingManagerRole | string;
  if (!["OWNER", "MANAGER", "RECEPTION", "TECH"].includes(role)) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }

  return {
    ok: true as const,
    supabase,
    userId: user.id,
    orgId: String(roleRes.data.org_id),
    role: role as LandingManagerRole,
  };
}

function normalizeStatus(status?: string) {
  if (status === "approved" || status === "published" || status === "archived") return status;
  return "draft";
}

function normalizeContentType(contentType?: string) {
  if (contentType === "care" || contentType === "news" || contentType === "offer_hint") return contentType;
  return "trend";
}

function toPublishedAt(status: string) {
  return status === "published" ? new Date().toISOString() : null;
}

export async function GET(req: Request) {
  const auth = await requireLandingManager(req);
  if (!auth.ok) return auth.response;

  try {
    const { supabase, orgId } = auth;

    const [postsRes, servicesRes, offersRes, storefrontRes] = await Promise.all([
      supabase
        .from("customer_content_posts")
        .select("id,title,summary,body,cover_image_url,content_type,status,published_at,priority,source_platform,created_at,updated_at")
        .eq("org_id", orgId)
        .order("priority", { ascending: true })
        .order("published_at", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("services")
        .select("id,active,featured_in_home,featured_in_explore")
        .eq("org_id", orgId),
      supabase
        .from("marketing_offers")
        .select("id,is_active,starts_at,ends_at")
        .eq("org_id", orgId),
      supabase
        .from("storefront_profile")
        .select("id,name,slug,phone,address_line,opening_hours,updated_at,is_active")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (postsRes.error) throw postsRes.error;

    const postRows = postsRes.data ?? [];
    const publishedPosts = postRows.filter((row) => row.status === "published").length;
    const serviceRows = servicesRes.error ? [] : servicesRes.data ?? [];
    const nowMs = Date.now();
    const offerRows = offersRes.error ? [] : offersRes.data ?? [];
    const activeOffers = offerRows.filter((row) => {
      if (!row.is_active) return false;
      const startsAtMs = row.starts_at ? Date.parse(String(row.starts_at)) : Number.NaN;
      const endsAtMs = row.ends_at ? Date.parse(String(row.ends_at)) : Number.NaN;
      if (Number.isFinite(startsAtMs) && startsAtMs > nowMs) return false;
      if (Number.isFinite(endsAtMs) && endsAtMs < nowMs) return false;
      return true;
    }).length;

    return NextResponse.json({
      ok: true,
      data: {
        posts: postRows,
        summary: {
          publishedPosts,
          totalPosts: postRows.length,
          featuredInHome: serviceRows.filter((row) => Boolean(row.active) && Boolean(row.featured_in_home)).length,
          featuredInExplore: serviceRows.filter((row) => Boolean(row.active) && Boolean(row.featured_in_explore)).length,
          activeOffers,
          storefront: storefrontRes.error ? null : storefrontRes.data ?? null,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không tải được dữ liệu landing page" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireLandingManager(req);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json()) as ContentPostInput;
    const status = normalizeStatus(body.status);
    const payload = {
      org_id: auth.orgId,
      source_platform: "manage",
      title: body.title?.trim() || "Bài viết mới",
      summary: body.summary?.trim() || "",
      body: body.body?.trim() || "",
      cover_image_url: body.coverImageUrl?.trim() || null,
      content_type: normalizeContentType(body.contentType),
      status,
      published_at: toPublishedAt(status),
      priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : 100,
    };

    const result = await auth.supabase
      .from("customer_content_posts")
      .insert(payload)
      .select("id,title,summary,body,cover_image_url,content_type,status,published_at,priority,source_platform,created_at,updated_at")
      .single();

    if (result.error) throw result.error;
    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không tạo được content post" },
      { status: 400 },
    );
  }
}

export async function PATCH(req: Request) {
  const auth = await requireLandingManager(req);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json()) as ContentPostInput;
    if (!body.id) {
      return NextResponse.json({ ok: false, error: "Thiếu id bài viết" }, { status: 400 });
    }

    const status = normalizeStatus(body.status);
    const payload = {
      title: body.title?.trim() || "Bài viết",
      summary: body.summary?.trim() || "",
      body: body.body?.trim() || "",
      cover_image_url: body.coverImageUrl?.trim() || null,
      content_type: normalizeContentType(body.contentType),
      status,
      published_at: toPublishedAt(status),
      priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : 100,
    };

    const result = await auth.supabase
      .from("customer_content_posts")
      .update(payload)
      .eq("id", body.id)
      .eq("org_id", auth.orgId)
      .select("id,title,summary,body,cover_image_url,content_type,status,published_at,priority,source_platform,created_at,updated_at")
      .single();

    if (result.error) throw result.error;
    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không cập nhật được content post" },
      { status: 400 },
    );
  }
}
