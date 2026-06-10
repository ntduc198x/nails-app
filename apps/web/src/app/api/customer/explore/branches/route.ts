import { NextResponse } from "next/server";
import { getCustomerScopedContextForUser } from "@nails/shared";
import { createServiceRoleClient } from "@/lib/supabase";

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

export async function GET(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing bearer token" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();
    const userResult = await supabase.auth.getUser(token);
    if (userResult.error || !userResult.data.user) {
      return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
    }

    const scope = await getCustomerScopedContextForUser(supabase, userResult.data.user.id);
    if (!scope?.orgId) {
      return NextResponse.json({ ok: false, error: "Customer scope not found" }, { status: 403 });
    }

    const branchResponse = await supabase
      .from("branches")
      .select("id,name,translations,translation_meta,created_at")
      .eq("org_id", scope.orgId)
      .order("created_at", { ascending: true });

    let branches = (branchResponse.data ?? null) as Array<Record<string, unknown>> | null;
    if (branchResponse.error) {
      const message = branchResponse.error.message || "";
      const missingTranslationsColumn =
        branchResponse.error.code === "42703" ||
        message.includes("branches.translations") ||
        message.includes("column translations does not exist");

      if (!missingTranslationsColumn) {
        throw branchResponse.error;
      }

      const fallbackResponse = await supabase
        .from("branches")
        .select("id,name,created_at")
        .eq("org_id", scope.orgId)
        .order("created_at", { ascending: true });

      if (fallbackResponse.error) {
        throw fallbackResponse.error;
      }

      branches = (fallbackResponse.data ?? null) as Array<Record<string, unknown>> | null;
    }

    const storefrontResponse = await supabase
      .from("storefront_profile")
      .select("branch_id")
      .eq("org_id", scope.orgId)
      .eq("is_active", true);

    if (storefrontResponse.error) {
      throw storefrontResponse.error;
    }

    const activeBranchIds = new Set(
      (storefrontResponse.data ?? [])
        .map((row) => (typeof row.branch_id === "string" ? row.branch_id : null))
        .filter((value): value is string => Boolean(value)),
    );

    const normalizedBranches = (branches ?? []).map((branch) => ({
      id: String(branch.id ?? ""),
      name: typeof branch.name === "string" && branch.name.trim() ? branch.name.trim() : "Branch",
      translations: "translations" in branch ? (branch.translations ?? null) : null,
      translationMeta: "translation_meta" in branch ? (branch.translation_meta ?? null) : null,
      hasActiveStorefront: activeBranchIds.has(String(branch.id ?? "")),
    }));

    const visibleBranches = normalizedBranches.filter((branch) => branch.hasActiveStorefront);
    return NextResponse.json({
      ok: true,
      data: visibleBranches.length > 0 ? visibleBranches : normalizedBranches,
    });
  } catch (error) {
    console.error("customer explore branches GET failed", error);
    return NextResponse.json(
      { ok: false, error: "Không tải được danh sách chi nhánh" },
      { status: 500 },
    );
  }
}
