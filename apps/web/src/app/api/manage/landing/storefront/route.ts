import { NextResponse } from "next/server";
import { z } from "zod";
import type { AppRole } from "@/lib/auth";
import { canAccessManageLanding, type LandingManagerRole } from "@/lib/manage-landing-auth";
import { createServiceRoleClient } from "@/lib/supabase";

type StorefrontInput = {
  id?: string | null;
  name?: string;
  slug?: string;
  category?: string | null;
  description?: string | null;
  phone?: string | null;
  addressLine?: string | null;
  openingHours?: string | null;
  coverImageUrl?: string | null;
  logoImageUrl?: string | null;
  rating?: number | null;
  reviewsLabel?: string | null;
  mapUrl?: string | null;
  messengerUrl?: string | null;
  instagramUrl?: string | null;
  highlights?: string[] | null;
  isActive?: boolean;
};

const nullableTrimmedString = z.preprocess((value) => {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}, z.string().max(500).nullable());

const nullableUrlString = z.preprocess((value) => {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}, z.string().url().max(500).nullable());

const storefrontInputSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  slug: z.string().trim().min(1).max(120).optional(),
  category: nullableTrimmedString.optional(),
  description: z.preprocess((value) => {
    if (value == null) return null;
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }, z.string().max(2000).nullable()).optional(),
  phone: nullableTrimmedString.optional(),
  addressLine: nullableTrimmedString.optional(),
  openingHours: nullableTrimmedString.optional(),
  coverImageUrl: nullableUrlString.optional(),
  logoImageUrl: nullableUrlString.optional(),
  rating: z.coerce.number().min(0).max(5).nullable().optional(),
  reviewsLabel: nullableTrimmedString.optional(),
  mapUrl: nullableUrlString.optional(),
  messengerUrl: nullableUrlString.optional(),
  instagramUrl: nullableUrlString.optional(),
  highlights: z.array(z.string().trim().min(1).max(140)).max(20).nullable().optional(),
  isActive: z.boolean().optional(),
});

const STOREFRONT_SELECT =
  "id,name,slug,category,description,phone,address_line,opening_hours,cover_image_url,logo_image_url,rating,reviews_label,map_url,messenger_url,instagram_url,highlights,is_active,updated_at";
const DEFAULT_STOREFRONT_NAME = "Cham Beauty";
const AUTH_ERRORS = {
  missingBearerToken: "Missing bearer token",
  invalidSession: "Invalid session",
  missingRoleContext: "Missing role context",
  forbidden: "Forbidden",
} as const;
const STOREFRONT_ERRORS = {
  missingBranch: "Chưa có chi nhánh mặc định để lưu storefront.",
  saveFailed: "Không lưu được storefront.",
  notFound: "Không tìm thấy storefront để xóa.",
  deleteFailed: "Không xóa được storefront.",
} as const;

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

const ROLE_PRIORITY: Record<AppRole, number> = {
  OWNER: 0,
  PARTNER: 1,
  MANAGER: 2,
  RECEPTION: 3,
  ACCOUNTANT: 4,
  TECH: 5,
  USER: 6,
};

function pickHighestPriorityRole(rows: Array<{ role?: string | null }>) {
  return [...rows]
    .filter((row): row is { role: AppRole } => Boolean(row.role))
    .sort((left, right) => (ROLE_PRIORITY[left.role] ?? 99) - (ROLE_PRIORITY[right.role] ?? 99))[0]?.role;
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function storefrontPayload(body: StorefrontInput, orgId: string, branchId: string) {
  return {
    org_id: orgId,
    branch_id: branchId,
    name: body.name?.trim() || DEFAULT_STOREFRONT_NAME,
    slug: normalizeSlug(body.slug, body.name),
    category: body.category?.trim() || null,
    description: body.description?.trim() || null,
    phone: body.phone?.trim() || null,
    address_line: body.addressLine?.trim() || null,
    opening_hours: body.openingHours?.trim() || null,
    cover_image_url: body.coverImageUrl?.trim() || null,
    logo_image_url: body.logoImageUrl?.trim() || null,
    rating: body.rating == null ? null : Number(body.rating),
    reviews_label: body.reviewsLabel?.trim() || null,
    map_url: body.mapUrl?.trim() || null,
    messenger_url: body.messengerUrl?.trim() || null,
    instagram_url: body.instagramUrl?.trim() || null,
    highlights: Array.isArray(body.highlights) ? body.highlights.filter((item) => typeof item === "string") : [],
    is_active: body.isActive ?? true,
  };
}

async function requireLandingManager(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false as const, response: errorResponse(AUTH_ERRORS.missingBearerToken, 401) };
  }

  const supabase = createServiceRoleClient();
  const userRes = await supabase.auth.getUser(token);
  const user = userRes.data.user;
  if (userRes.error || !user) {
    return { ok: false as const, response: errorResponse(AUTH_ERRORS.invalidSession, 401) };
  }

  const roleRes = await supabase.from("user_roles").select("org_id,role").eq("user_id", user.id);
  if (roleRes.error || !roleRes.data?.length) {
    return { ok: false as const, response: errorResponse(AUTH_ERRORS.missingRoleContext, 403) };
  }

  const orgId = String(roleRes.data[0]?.org_id ?? "");
  const role = pickHighestPriorityRole(roleRes.data) as AppRole | undefined;
  if (!orgId || !role) {
    return { ok: false as const, response: errorResponse(AUTH_ERRORS.missingRoleContext, 403) };
  }

  if (!canAccessManageLanding(role)) {
    return { ok: false as const, response: errorResponse(AUTH_ERRORS.forbidden, 403) };
  }

  return { ok: true as const, supabase, orgId, role: role as LandingManagerRole };
}

function normalizeSlug(value?: string | null, fallbackName?: string | null) {
  const source = (value?.trim() || fallbackName?.trim() || "storefront")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const slug = source.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "storefront";
}

async function findLatestStorefrontId(supabase: ReturnType<typeof createServiceRoleClient>, orgId: string) {
  const existing = await supabase
    .from("storefront_profile")
    .select("id")
    .eq("org_id", orgId)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.error) throw existing.error;
  return existing.data?.id ?? null;
}

export async function GET(req: Request) {
  const auth = await requireLandingManager(req);
  if (!auth.ok) return auth.response;

  const result = await auth.supabase
    .from("storefront_profile")
    .select(STOREFRONT_SELECT)
    .eq("org_id", auth.orgId)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    console.error("manage landing storefront GET failed", result.error);
    return errorResponse("Không tải được storefront.", 500);
  }

  return NextResponse.json({ ok: true, data: result.data ?? null });
}

export async function PUT(req: Request) {
  const auth = await requireLandingManager(req);
  if (!auth.ok) return auth.response;

  try {
    const body = storefrontInputSchema.parse((await req.json()) as StorefrontInput);

    const [profileBranchRes, fallbackBranchRes] = await Promise.all([
      auth.supabase
        .from("profiles")
        .select("default_branch_id")
        .eq("org_id", auth.orgId)
        .not("default_branch_id", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      auth.supabase
        .from("branches")
        .select("id")
        .eq("org_id", auth.orgId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (profileBranchRes.error) throw profileBranchRes.error;
    if (fallbackBranchRes.error) throw fallbackBranchRes.error;

    const resolvedBranchId = profileBranchRes.data?.default_branch_id ?? fallbackBranchRes.data?.id ?? null;
    if (!resolvedBranchId) {
      throw new Error(STOREFRONT_ERRORS.missingBranch);
    }

    const payload = storefrontPayload(body, auth.orgId, resolvedBranchId);

    const existingId = await findLatestStorefrontId(auth.supabase, auth.orgId);
    const query = existingId
      ? auth.supabase.from("storefront_profile").update(payload).eq("id", existingId).eq("org_id", auth.orgId)
      : auth.supabase.from("storefront_profile").insert(payload);

    const result = await query.select(STOREFRONT_SELECT).single();
    if (result.error) throw result.error;

    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0]?.message ?? "Dữ liệu storefront không hợp lệ.", 400);
    }
    console.error("manage landing storefront PUT failed", error);
    return errorResponse(STOREFRONT_ERRORS.saveFailed, 400);
  }
}

export async function DELETE(req: Request) {
  const auth = await requireLandingManager(req);
  if (!auth.ok) return auth.response;

  try {
    const existingId = await findLatestStorefrontId(auth.supabase, auth.orgId);
    if (!existingId) {
      return errorResponse(STOREFRONT_ERRORS.notFound, 404);
    }

    const result = await auth.supabase
      .from("storefront_profile")
      .delete()
      .eq("id", existingId)
      .eq("org_id", auth.orgId);

    if (result.error) throw result.error;
    return NextResponse.json({ ok: true, data: null });
  } catch (error) {
    console.error("manage landing storefront DELETE failed", error);
    return errorResponse(STOREFRONT_ERRORS.deleteFailed, 400);
  }
}
