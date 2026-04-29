import type { AppRole } from "./auth";
import type { SharedSupabaseClient } from "./org";
import { ensureOrgContext } from "./org";
import { getOrCreateRole } from "./session";

export type TeamMemberRow = {
  id: string;
  userId: string;
  role: AppRole;
  displayName: string;
  email: string | null;
  phone: string | null;
};

export type InviteCodeRole = "MANAGER" | "RECEPTION" | "ACCOUNTANT" | "TECH";

export type TeamInviteCodeRow = {
  id: string;
  code: string;
  allowedRole: InviteCodeRole;
  expiresAt: string;
  usedCount: number;
  maxUses: number;
  usedAt: string | null;
  revokedAt: string | null;
  note: string | null;
  createdAt: string;
};

function normalizeTeamMemberRow(row: Record<string, unknown>): TeamMemberRow {
  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? ""),
    role: String(row.role ?? "TECH") as AppRole,
    displayName: typeof row.display_name === "string" && row.display_name.trim().length > 0
      ? row.display_name.trim()
      : String(row.user_id ?? "").slice(0, 8),
    email: typeof row.email === "string" ? row.email : null,
    phone: typeof row.phone === "string" ? row.phone : null,
  };
}

function normalizeInviteCodeRow(row: Record<string, unknown>): TeamInviteCodeRow {
  return {
    id: String(row.id ?? ""),
    code: String(row.code ?? ""),
    allowedRole: String(row.allowed_role ?? "TECH") as InviteCodeRole,
    expiresAt: String(row.expires_at ?? ""),
    usedCount: Number(row.used_count ?? 0),
    maxUses: Number(row.max_uses ?? 0),
    usedAt: typeof row.used_at === "string" ? row.used_at : null,
    revokedAt: typeof row.revoked_at === "string" ? row.revoked_at : null,
    note: typeof row.note === "string" ? row.note : null,
    createdAt: String(row.created_at ?? ""),
  };
}

async function requireOwner(client: SharedSupabaseClient) {
  const {
    data: { session },
  } = await client.auth.getSession();

  const currentUser = session?.user;
  if (!currentUser) {
    throw new Error("Chua dang nhap");
  }

  const currentRole = await getOrCreateRole(client, currentUser.id);
  if (currentRole !== "OWNER") {
    throw new Error("Chi BOSS moi co quyen quan ly nhan su.");
  }

  return currentUser.id;
}

export async function listTeamMembersForMobile(
  client: SharedSupabaseClient,
): Promise<TeamMemberRow[]> {
  const rpc = await client.rpc("list_team_members_secure_v2");
  if (!rpc.error && rpc.data) {
    return (rpc.data as Array<Record<string, unknown>>).map(normalizeTeamMemberRow);
  }

  const { orgId } = await ensureOrgContext(client);
  const { data, error } = await client
    .from("user_roles")
    .select("id,user_id,role")
    .eq("org_id", orgId)
    .order("role", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const userIds = [...new Set(rows.map((row) => String(row.user_id ?? "")).filter(Boolean))];
  let profileMap = new Map<string, { displayName: string; email: string | null; phone: string | null }>();

  if (userIds.length) {
    const profiles = await client
      .from("profiles")
      .select("user_id,display_name,email,phone")
      .in("user_id", userIds);

    if (!profiles.error) {
      profileMap = new Map(
        (profiles.data ?? []).map((profile) => [
          String(profile.user_id ?? ""),
          {
            displayName:
              typeof profile.display_name === "string" && profile.display_name.trim().length > 0
                ? profile.display_name.trim()
                : String(profile.user_id ?? "").slice(0, 8),
            email: typeof profile.email === "string" ? profile.email : null,
            phone: typeof profile.phone === "string" ? profile.phone : null,
          },
        ]),
      );
    }
  }

  return rows.map((row) => ({
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? ""),
    role: String(row.role ?? "TECH") as AppRole,
    displayName: profileMap.get(String(row.user_id ?? ""))?.displayName ?? String(row.user_id ?? "").slice(0, 8),
    email: profileMap.get(String(row.user_id ?? ""))?.email ?? null,
    phone: profileMap.get(String(row.user_id ?? ""))?.phone ?? null,
  }));
}

export async function updateTeamMemberRoleForMobile(
  client: SharedSupabaseClient,
  input: { id: string; role: AppRole },
) {
  const currentUserId = await requireOwner(client);

  const target = await client
    .from("user_roles")
    .select("user_id,role")
    .eq("id", input.id)
    .single();

  if (target.error) {
    throw target.error;
  }

  if (String(target.data?.user_id ?? "") === currentUserId) {
    throw new Error("Khong the tu doi vai tro cua chinh minh.");
  }

  const { error } = await client
    .from("user_roles")
    .update({ role: input.role })
    .eq("id", input.id);

  if (error) {
    throw error;
  }
}

export async function updateTeamMemberDisplayNameForMobile(
  client: SharedSupabaseClient,
  input: { userId: string; displayName: string },
) {
  await requireOwner(client);

  const { error } = await client.rpc("update_staff_display_name_secure", {
    p_user_id: input.userId,
    p_display_name: input.displayName,
  });

  if (error) {
    const message = [error.message, (error as { details?: string }).details, (error as { hint?: string }).hint]
      .filter(Boolean)
      .join(" | ");
    throw new Error(message || "Update display name failed");
  }
}

export async function listTeamInviteCodesForMobile(
  client: SharedSupabaseClient,
): Promise<TeamInviteCodeRow[]> {
  await requireOwner(client);

  const { data, error } = await client
    .from("invite_codes")
    .select("id,code,allowed_role,expires_at,used_count,max_uses,used_at,revoked_at,note,created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => normalizeInviteCodeRow(row as Record<string, unknown>));
}

export async function generateTeamInviteCodeForMobile(
  client: SharedSupabaseClient,
  allowedRole: InviteCodeRole,
) {
  await requireOwner(client);

  const { data, error } = await client.rpc("generate_invite_code_secure", {
    p_allowed_role: allowedRole,
    p_note: null,
  });

  if (error) {
    throw error;
  }

  return normalizeInviteCodeRow((data ?? {}) as Record<string, unknown>);
}

export async function revokeTeamInviteCodeForMobile(
  client: SharedSupabaseClient,
  inviteId: string,
) {
  await requireOwner(client);

  const { data, error } = await client.rpc("revoke_invite_code_secure", {
    p_invite_id: inviteId,
  });

  if (error) {
    throw error;
  }

  return normalizeInviteCodeRow((data ?? {}) as Record<string, unknown>);
}
