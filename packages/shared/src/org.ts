import type { SupabaseClient } from "@supabase/supabase-js";

export type SharedSupabaseClient = SupabaseClient<any, "public", any>;

export type OrgContext = {
  orgId: string;
  branchId: string;
};

async function getCustomerBranchContext(client: SharedSupabaseClient, userId: string) {
  const { data: customerAccount, error: customerAccountErr } = await client
    .from("customer_accounts")
    .select("org_id,customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (customerAccountErr && customerAccountErr.code !== "PGRST116") {
    throw customerAccountErr;
  }

  const orgId = typeof customerAccount?.org_id === "string" ? customerAccount.org_id : undefined;
  const customerId = typeof customerAccount?.customer_id === "string" ? customerAccount.customer_id : undefined;

  if (!orgId || !customerId) {
    return { orgId, branchId: undefined as string | undefined };
  }

  const { data: customerBranch, error: customerBranchErr } = await client
    .from("customer_branches")
    .select("branch_id,last_seen_at,created_at")
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (customerBranchErr && customerBranchErr.code !== "PGRST116") {
    throw customerBranchErr;
  }

  return {
    orgId,
    branchId: typeof customerBranch?.branch_id === "string" ? customerBranch.branch_id : undefined,
  };
}

function getRegistrationMode(user: { app_metadata?: Record<string, unknown> | null; user_metadata?: Record<string, unknown> | null }) {
  const provider =
    typeof user.app_metadata?.provider === "string" && user.app_metadata.provider.trim()
      ? user.app_metadata.provider.trim().toLowerCase()
      : "email";

  const rawMode =
    typeof user.user_metadata?.registration_mode === "string" && user.user_metadata.registration_mode.trim()
      ? user.user_metadata.registration_mode.trim().toUpperCase()
      : provider === "google" || provider === "apple"
        ? "USER"
        : "ADMIN";

  return rawMode === "USER" ? "USER" : "ADMIN";
}

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
  let branchId =
    typeof currentProfile?.default_branch_id === "string" ? currentProfile.default_branch_id : undefined;

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

  if (!orgId || !branchId) {
    const customerContext = await getCustomerBranchContext(client, currentUser.id);
    orgId = orgId ?? customerContext.orgId;
    branchId = branchId ?? customerContext.branchId;
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

  branchId = branchId ?? (typeof currentBranches?.[0]?.id === "string" ? currentBranches[0].id : undefined);

  if (!branchId) {
    throw new Error("ORG_HAS_NO_BRANCH");
  }

  if (!currentProfile) {
    if (getRegistrationMode(currentUser) === "USER") {
      return { orgId, branchId };
    }

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
        org_id: currentProfile.org_id ?? orgId,
        default_branch_id: branchId,
        email: currentUser.email ?? null,
      })
      .eq("user_id", currentUser.id);

    if (updateProfileErr) {
      throw updateProfileErr;
    }
  }

  return { orgId, branchId };
}
