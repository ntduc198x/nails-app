import type { SupabaseClient } from "@supabase/supabase-js";

export type SharedSupabaseClient = SupabaseClient<any, "public", any>;

export type OrgContext = {
  orgId: string;
  branchId: string;
};

export async function ensureOrgContext(client: SharedSupabaseClient): Promise<OrgContext> {
  const {
    data: { session },
  } = await client.auth.getSession();

  const currentUser = session?.user;
  if (!currentUser) {
    throw new Error("Chua dang nhap");
  }

  const { data: currentProfile, error: currentProfileErr } = await client
    .from("profiles")
    .select("user_id,org_id,default_branch_id")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (currentProfileErr) {
    throw currentProfileErr;
  }

  let orgId = typeof currentProfile?.org_id === "string" ? currentProfile.org_id : undefined;

  if (!orgId) {
    const { data: fallbackRole, error: fallbackRoleErr } = await client
      .from("user_roles")
      .select("org_id")
      .eq("user_id", currentUser.id)
      .limit(1)
      .maybeSingle();

    if (fallbackRoleErr) {
      throw fallbackRoleErr;
    }

    orgId = typeof fallbackRole?.org_id === "string" ? fallbackRole.org_id : undefined;
  }

  if (!orgId) {
    throw new Error("USER_NOT_BOUND_TO_ORG");
  }

  const { data: currentBranches, error: currentBranchErr } = await client
    .from("branches")
    .select("id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (currentBranchErr) {
    throw currentBranchErr;
  }

  const branchId =
    (typeof currentProfile?.default_branch_id === "string" ? currentProfile.default_branch_id : undefined) ??
    (typeof currentBranches?.[0]?.id === "string" ? currentBranches[0].id : undefined);

  if (!branchId) {
    throw new Error("ORG_HAS_NO_BRANCH");
  }

  if (!currentProfile) {
    const { error: insertProfileErr } = await client.from("profiles").insert({
      user_id: currentUser.id,
      org_id: orgId,
      default_branch_id: branchId,
      display_name: (currentUser.user_metadata?.display_name as string | undefined)?.trim() ||
        currentUser.email?.split("@")[0] ||
        "User",
      email: currentUser.email ?? null,
    });

    if (insertProfileErr) {
      throw insertProfileErr;
    }
  } else if (currentProfile.default_branch_id !== branchId) {
    const { error: updateProfileErr } = await client
      .from("profiles")
      .update({
        default_branch_id: branchId,
        email: currentUser.email ?? null,
      })
      .eq("user_id", currentUser.id)
      .eq("org_id", orgId);

    if (updateProfileErr) {
      throw updateProfileErr;
    }
  }

  return { orgId, branchId };
}
