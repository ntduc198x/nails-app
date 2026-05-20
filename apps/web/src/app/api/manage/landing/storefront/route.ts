import { NextResponse } from "next/server";
import type { AppRole } from "@/lib/auth";
import { canAccessManageLanding, type LandingManagerRole } from "@/lib/manage-landing-auth";
import { createServiceRoleClient } from "@/lib/supabase";

type StorefrontInput = {
  id?: string | null;
  name?: string;
  slug?: string;
  description?: string | null;
  phone?: string | null;
  addressLine?: string | null;
  openingHours?: string | null;
  coverImageUrl?: string | null;
  logoImageUrl?: string | null;
  mapUrl?: string | null;
  messengerUrl?: string | null;
  instagramUrl?: string | null;
  isActive?: boolean;
};

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

  const roleRes = await supabase.from("user_roles").select("org_id,role").eq("user_id", user.id);
  if (roleRes.error || !roleRes.data?.length) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: roleRes.error?.message ?? "Missing role context" }, { status: 403 }) };
  }

  const orgId = String(roleRes.data[0]?.org_id ?? "");
  const role = pickHighestPriorityRole(roleRes.data) as AppRole | undefined;
  if (!orgId || !role) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Missing role context" }, { status: 403 }) };
  }

  if (!canAccessManageLanding(role)) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
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

export async function GET(req: Request) {
  const auth = await requireLandingManager(req);
  if (!auth.ok) return auth.response;

  const result = await auth.supabase
    .from("storefront_profile")
    .select("id,name,slug,description,phone,address_line,opening_hours,cover_image_url,logo_image_url,map_url,messenger_url,instagram_url,is_active,updated_at")
    .eq("org_id", auth.orgId)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: result.data ?? null });
}

export async function PUT(req: Request) {
  const auth = await requireLandingManager(req);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json()) as StorefrontInput;

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
      throw new Error("Chưa có chi nhánh mặc định để lưu storefront.");
    }

    const payload = {
      org_id: auth.orgId,
      branch_id: resolvedBranchId,
      name: body.name?.trim() || "Chạm Beauty",
      slug: normalizeSlug(body.slug, body.name),
      description: body.description?.trim() || null,
      phone: body.phone?.trim() || null,
      address_line: body.addressLine?.trim() || null,
      opening_hours: body.openingHours?.trim() || null,
      cover_image_url: body.coverImageUrl?.trim() || null,
      logo_image_url: body.logoImageUrl?.trim() || null,
      map_url: body.mapUrl?.trim() || null,
      messenger_url: body.messengerUrl?.trim() || null,
      instagram_url: body.instagramUrl?.trim() || null,
      is_active: body.isActive ?? true,
    };

    const existing = await auth.supabase
      .from("storefront_profile")
      .select("id")
      .eq("org_id", auth.orgId)
      .order("is_active", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing.error) throw existing.error;

    const query = existing.data?.id
      ? auth.supabase.from("storefront_profile").update(payload).eq("id", existing.data.id).eq("org_id", auth.orgId)
      : auth.supabase.from("storefront_profile").insert(payload);

    const result = await query
      .select("id,name,slug,description,phone,address_line,opening_hours,cover_image_url,logo_image_url,map_url,messenger_url,instagram_url,is_active,updated_at")
      .single();

    if (result.error) throw result.error;
    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Không lưu được storefront" }, { status: 400 });
  }
}
