import type { User } from "@supabase/supabase-js";
import type { AppRole } from "./auth";
import type { SharedSupabaseClient } from "./org";

export type AuthenticatedUserSummary = {
  id: string;
  email: string | null;
  displayName: string | null;
  role: AppRole;
};

export type AppSessionResult = {
  success: boolean;
  token?: string;
  error?: string;
  message?: string;
  replacedUserId?: string | null;
  replacedOwnerName?: string | null;
};

export type AppSessionValidation = {
  valid: boolean;
  reason?: "INVALID_TOKEN" | "SESSION_REPLACED" | "DEVICE_TAKEN" | "USER_SWITCHED";
  message?: string;
  ownerName?: string | null;
  userId?: string;
  deviceFingerprint?: string;
  deviceInfo?: unknown;
};

export type InviteCodeConsumptionResult = {
  inviteId: string;
  orgId: string;
  role: AppRole;
  expiresAt: string;
};

function mapSessionUser(user: User, role: AppRole): AuthenticatedUserSummary {
  return {
    id: user.id,
    email: user.email ?? null,
    displayName: typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : null,
    role,
  };
}

function isMissingEnsureProfileFunctionError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return (
    error?.code === "42883" ||
    message.includes("ensure_current_user_profile") ||
    message.includes("ensure_default_workspace") ||
    (message.includes("does not exist") && message.includes("function public."))
  );
}

function isMissingAppSessionFunctionError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return (
    error?.code === "42883" ||
    message.includes("create_app_session") ||
    message.includes("validate_app_session") ||
    message.includes("heartbeat_online_user") ||
    message.includes("revoke_app_session") ||
    message.includes("ensure_default_workspace") ||
    (message.includes("does not exist") && message.includes("function public."))
  );
}

function isMissingCustomerAccountLinkInfraError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return (
    error?.code === "42883" ||
    error?.code === "42P01" ||
    error?.code === "42703" ||
    message.includes("link_customer_account_by_phone") ||
    message.includes("customer_accounts") ||
    message.includes("merged_into_customer_id") ||
    (message.includes("does not exist") && message.includes("public."))
  );
}

function buildProfileDisplayName(user: User) {
  const metadataDisplayName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
        : null;

  return metadataDisplayName?.trim() || user.email?.split("@")[0] || "User";
}

async function fallbackEnsureCurrentUserProfile(client: SharedSupabaseClient, user: User) {
  const { data: currentProfile, error: currentProfileErr } = await client
    .from("profiles")
    .select("user_id,org_id,default_branch_id,display_name,email,phone")
    .eq("user_id", user.id)
    .maybeSingle();

  if (currentProfileErr) {
    throw currentProfileErr;
  }

  const profileDisplayName = buildProfileDisplayName(user);
  const profilePhone =
    typeof user.phone === "string" && user.phone.trim()
      ? user.phone.trim()
      : typeof user.user_metadata?.phone === "string" && user.user_metadata.phone.trim()
        ? user.user_metadata.phone.trim()
        : null;

  let orgId = typeof currentProfile?.org_id === "string" ? currentProfile.org_id : undefined;
  if (!orgId) {
    const { data: fallbackRole, error: fallbackRoleErr } = await client
      .from("user_roles")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (fallbackRoleErr) {
      throw fallbackRoleErr;
    }

    orgId = typeof fallbackRole?.org_id === "string" ? fallbackRole.org_id : undefined;
  }

  let branchId = typeof currentProfile?.default_branch_id === "string" ? currentProfile.default_branch_id : undefined;
  if (!branchId && orgId) {
    const { data: branch, error: branchErr } = await client
      .from("branches")
      .select("id")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (branchErr) {
      throw branchErr;
    }

    branchId = typeof branch?.id === "string" ? branch.id : undefined;
  }

  if (!currentProfile) {
    if (!orgId || !branchId) {
      return;
    }

    const { error: insertProfileErr } = await client.from("profiles").insert({
      user_id: user.id,
      org_id: orgId,
      default_branch_id: branchId,
      display_name: profileDisplayName,
      email: user.email ?? null,
      phone: profilePhone,
    });

    if (insertProfileErr) {
      throw insertProfileErr;
    }

    return;
  }

  const needsUpdate =
    (!currentProfile.display_name && profileDisplayName) ||
    currentProfile.email !== (user.email ?? null) ||
    currentProfile.phone !== profilePhone ||
    (!currentProfile.default_branch_id && branchId);

  if (!needsUpdate) {
    return;
  }

  const { error: updateProfileErr } = await client
    .from("profiles")
    .update({
      display_name: currentProfile.display_name || profileDisplayName,
      email: user.email ?? null,
      phone: profilePhone,
      default_branch_id: currentProfile.default_branch_id ?? branchId ?? null,
    })
    .eq("user_id", user.id);

  if (updateProfileErr) {
    throw updateProfileErr;
  }
}

async function ensureCurrentUserProfile(client: SharedSupabaseClient, userId?: string) {
  const {
    data: { session },
  } = await client.auth.getSession();

  const currentUser = session?.user;
  if (!currentUser) {
    throw new Error("Chua dang nhap");
  }

  const targetUserId = userId ?? currentUser.id;
  if (targetUserId !== currentUser.id) {
    throw new Error("UNAUTHORIZED_PROFILE_BOOTSTRAP");
  }

  const { error } = await client.rpc("ensure_current_user_profile", {
    p_user_id: targetUserId,
  });

  if (error) {
    if (isMissingEnsureProfileFunctionError(error)) {
      await fallbackEnsureCurrentUserProfile(client, currentUser);
      return;
    }

    throw error;
  }
}

async function ensureCustomerAccountLink(client: SharedSupabaseClient, user: User) {
  const existingLink = await client
    .from("customer_accounts")
    .select("customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existingLink.error && existingLink.data?.customer_id) {
    return existingLink.data.customer_id as string;
  }

  if (existingLink.error && !isMissingCustomerAccountLinkInfraError(existingLink.error)) {
    throw existingLink.error;
  }

  const { data, error } = await client.rpc("link_customer_account_by_phone");
  if (error) {
    if (isMissingCustomerAccountLinkInfraError(error)) {
      return null;
    }

    throw error;
  }

  return typeof data === "string" ? data : null;
}

export async function getOrCreateRole(client: SharedSupabaseClient, userId: string): Promise<AppRole> {
  const { data: existing, error: readErr } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .limit(1);

  if (readErr) {
    throw readErr;
  }

  const currentRole = existing?.[0]?.role as AppRole | undefined;
  if (currentRole) {
    return currentRole;
  }

  const { data: profile, error: profileErr } = await client
    .from("profiles")
    .select("user_id,org_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileErr) {
    throw profileErr;
  }

  const orgId = typeof profile?.org_id === "string" ? profile.org_id : undefined;
  if (!orgId) {
    return "USER";
  }

  const { count: ownerCount, error: ownerCountErr } = await client
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("role", "OWNER");

  if (ownerCountErr) {
    throw ownerCountErr;
  }

  const nextRole: AppRole = (ownerCount ?? 0) === 0 ? "OWNER" : "RECEPTION";

  const { error: insertErr } = await client.from("user_roles").insert({
    user_id: userId,
    org_id: orgId,
    role: nextRole,
  });

  if (insertErr) {
    throw insertErr;
  }

  return nextRole;
}

export async function getAuthenticatedUserSummary(
  client: SharedSupabaseClient,
): Promise<AuthenticatedUserSummary | null> {
  const {
    data: { session },
  } = await client.auth.getSession();

  const user = session?.user;
  if (!user) {
    return null;
  }

  await ensureCurrentUserProfile(client, user.id);
  const role = await getOrCreateRole(client, user.id);
  if (role === "USER") {
    await ensureCustomerAccountLink(client, user);
  }
  return mapSessionUser(user, role);
}

export async function createAppSessionWithDevice(
  client: SharedSupabaseClient,
  input: {
    userId: string;
    deviceFingerprint: string;
    deviceInfo?: unknown;
  },
): Promise<AppSessionResult> {
  await ensureCurrentUserProfile(client, input.userId);

  const { data, error } = await client.rpc("create_app_session", {
    p_user_id: input.userId,
    p_device_fingerprint: input.deviceFingerprint,
    p_device_info: input.deviceInfo ?? null,
  });

  if (error) {
    if (isMissingAppSessionFunctionError(error)) {
      return {
        success: false,
        error: "APP_SESSION_RPC_UNAVAILABLE",
        message: error.message,
      };
    }

    return { success: false, error: error.message };
  }

  return {
    success: Boolean(data?.success),
    token: typeof data?.token === "string" ? data.token : undefined,
    message: typeof data?.message === "string" ? data.message : undefined,
    replacedUserId: typeof data?.replaced_user_id === "string" ? data.replaced_user_id : null,
    replacedOwnerName: typeof data?.replaced_owner_name === "string" ? data.replaced_owner_name : null,
  };
}

export async function validateAppSessionToken(
  client: SharedSupabaseClient,
  token: string,
): Promise<AppSessionValidation> {
  const { data, error } = await client.rpc("validate_app_session", {
    p_token: token,
  });

  if (error || !data) {
    if (isMissingAppSessionFunctionError(error)) {
      return {
        valid: false,
        reason: "INVALID_TOKEN",
        message: error?.message ?? "APP_SESSION_RPC_UNAVAILABLE",
      };
    }

    return { valid: false, reason: "INVALID_TOKEN" };
  }

  if (!data.valid) {
    return {
      valid: false,
      reason: data.reason,
      message: data.message,
      ownerName: data.owner_name,
    };
  }

  const { error: heartbeatErr } = await client.rpc("heartbeat_online_user", { p_user_id: data.user_id });
  if (heartbeatErr && !isMissingAppSessionFunctionError(heartbeatErr)) {
    throw heartbeatErr;
  }

  return {
    valid: true,
    userId: data.user_id,
    deviceFingerprint: data.device_fingerprint,
    deviceInfo: data.device_info,
    ownerName: data.owner_name,
  };
}

export async function revokeAppSessionToken(client: SharedSupabaseClient, token: string | null | undefined) {
  if (!token) {
    return;
  }

  const { error } = await client.rpc("revoke_app_session", { p_token: token });
  if (error && !isMissingAppSessionFunctionError(error)) {
    throw error;
  }
}

export async function consumeInviteCodeWithClient(
  client: SharedSupabaseClient,
  input: {
    code: string;
    userId: string;
    displayName?: string | null;
  },
): Promise<InviteCodeConsumptionResult> {
  const { data, error } = await client.rpc("consume_invite_code_secure", {
    p_code: input.code,
    p_user_id: input.userId,
    p_display_name: input.displayName ?? null,
  });

  if (error) {
    throw error;
  }

  return {
    inviteId: String(data?.inviteId ?? ""),
    orgId: String(data?.orgId ?? ""),
    role: String(data?.role ?? "TECH") as AppRole,
    expiresAt: String(data?.expiresAt ?? ""),
  };
}
