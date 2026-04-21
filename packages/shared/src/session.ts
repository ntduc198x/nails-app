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
    throw new Error("USER_NOT_BOUND_TO_ORG");
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

  const role = await getOrCreateRole(client, user.id);
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
  const { data, error } = await client.rpc("create_app_session", {
    p_user_id: input.userId,
    p_device_fingerprint: input.deviceFingerprint,
    p_device_info: input.deviceInfo ?? null,
  });

  if (error) {
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

  await client.rpc("heartbeat_online_user", { p_user_id: data.user_id });

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

  await client.rpc("revoke_app_session", { p_token: token });
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
