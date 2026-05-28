import type { AppRole } from "./auth";
import type { ObserverScopeInput, SharedSupabaseClient } from "./org";
import { ensureOrgContext, resolveMobileAdminViewContext } from "./org";
import { getOrCreateRole } from "./session";

export type TeamMemberRow = {
  id: string;
  userId: string;
  role: AppRole;
  displayName: string;
  email: string | null;
  phone: string | null;
  branchId: string | null;
};

export type InviteCodeRole = "PARTNER" | "MANAGER" | "RECEPTION" | "ACCOUNTANT" | "TECH";

export type TeamInviteCodeRow = {
  id: string;
  code: string;
  allowedRole: InviteCodeRole;
  branchId: string | null;
  expiresAt: string;
  usedCount: number;
  maxUses: number;
  usedAt: string | null;
  revokedAt: string | null;
  note: string | null;
  createdAt: string;
};

type TeamMemberProfileRow = {
  displayName: string;
  email: string | null;
  phone: string | null;
};

function fallbackTeamMemberName(userId: string, email: string | null | undefined) {
  const emailName = typeof email === "string" ? email.split("@")[0]?.trim() : "";
  return emailName || userId.slice(0, 8);
}

function looksLikePlaceholderName(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return /^nhân sự\s+\d+$/i.test(normalized) || /^staff\s+\d+$/i.test(normalized);
}

function looksLikeUserId(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized) ||
    /^[0-9a-f]{8}$/i.test(normalized)
  );
}

function looksLikeGenericTeamName(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return (
    looksLikePlaceholderName(normalized) ||
    /^(nh\u00e2n s\u1ef1|nhan su|staff)\s+\d+$/i.test(normalized) ||
    /^user$/i.test(normalized)
  );
}

function hasUsableTeamMemberName(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 && !looksLikeUserId(normalized) && !looksLikeGenericTeamName(normalized);
}

function normalizeTeamMemberRow(row: Record<string, unknown>): TeamMemberRow {
  const userId = String(row.user_id ?? "");
  const email = typeof row.email === "string" ? row.email : null;
  return {
    id: String(row.id ?? ""),
    userId,
    role: String(row.role ?? "TECH") as AppRole,
    displayName: hasUsableTeamMemberName(typeof row.display_name === "string" ? row.display_name : null)
      ? String(row.display_name).trim()
      : fallbackTeamMemberName(userId, email),
    email,
    phone: typeof row.phone === "string" ? row.phone : null,
    branchId: typeof row.branch_id === "string" ? row.branch_id : null,
  };
}

function normalizeInviteCodeRow(row: Record<string, unknown>): TeamInviteCodeRow {
  return {
    id: String(row.id ?? ""),
    code: String(row.code ?? ""),
    allowedRole: String(row.allowed_role ?? "TECH") as InviteCodeRole,
    branchId: typeof row.branch_id === "string" ? row.branch_id : null,
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
    throw new Error("Chưa đăng nhập");
  }

  const currentRole = await getOrCreateRole(client, currentUser.id);
  if (currentRole !== "OWNER" && currentRole !== "PARTNER") {
    throw new Error("Chỉ chủ sở hữu hoặc chủ tiệm mới có quyền quản lý nhân sự.");
  }

  return currentUser.id;
}

async function loadTeamMemberProfileMap(
  client: SharedSupabaseClient,
  userIds: string[],
): Promise<Map<string, TeamMemberProfileRow>> {
  if (!userIds.length) {
    return new Map();
  }

  const profiles = await client
    .from("profiles")
    .select("user_id,display_name,email,phone")
    .in("user_id", userIds);

  if (profiles.error) {
    return new Map();
  }

  return new Map(
    (profiles.data ?? []).map((profile) => [
      String(profile.user_id ?? ""),
      {
        displayName: typeof profile.display_name === "string" ? profile.display_name.trim() : "",
        email: typeof profile.email === "string" ? profile.email : null,
        phone: typeof profile.phone === "string" ? profile.phone : null,
      },
    ]),
  );
}

function mergeProfileIntoTeamRow(
  row: TeamMemberRow,
  profileMap: Map<string, TeamMemberProfileRow>,
): TeamMemberRow {
  const profile = profileMap.get(row.userId);
  const profileName = profile?.displayName ?? "";

  return {
    ...row,
    displayName: hasUsableTeamMemberName(profileName) ? profileName : row.displayName,
    email: profile?.email ?? row.email,
    phone: profile?.phone ?? row.phone,
  };
}

function applyRoleMetadataToTeamRows(
  rows: TeamMemberRow[],
  roleRows: Array<Record<string, unknown>>,
): TeamMemberRow[] {
  const roleRowById = new Map(roleRows.map((row) => [String(row.id ?? ""), row]));
  const roleRowByUserId = new Map(roleRows.map((row) => [String(row.user_id ?? ""), row]));

  return rows.map((row) => {
    const roleRow = roleRowById.get(row.id) ?? roleRowByUserId.get(row.userId);
    const branchId =
      typeof roleRow?.branch_id === "string" && roleRow.branch_id.length > 0
        ? roleRow.branch_id
        : row.branchId;

    return {
      ...row,
      branchId,
    };
  });
}

async function loadTeamRoleRows(
  client: SharedSupabaseClient,
  orgId: string,
  viewContext: Awaited<ReturnType<typeof resolveMobileAdminViewContext>> | null,
  options?: { includeLegacyOrgWide?: boolean },
) {
  let roleQuery = client
    .from("user_roles")
    .select("id,user_id,role,branch_id")
    .eq("org_id", orgId)
    .order("role", { ascending: true });

  if (viewContext?.observerScope.mode === "branch" && viewContext.viewBranchId) {
    roleQuery = options?.includeLegacyOrgWide
      ? roleQuery.or(`branch_id.eq.${viewContext.viewBranchId},branch_id.is.null`)
      : roleQuery.eq("branch_id", viewContext.viewBranchId);
  }

  return roleQuery;
}

export async function listTeamMembersForMobile(
  client: SharedSupabaseClient,
  options?: { observerScope?: ObserverScopeInput | null },
): Promise<TeamMemberRow[]> {
  const {
    data: { session },
  } = await client.auth.getSession();

  if (!session?.user) {
    return [];
  }

  const { orgId } = await ensureOrgContext(client);
  const viewContext = options?.observerScope
    ? await resolveMobileAdminViewContext(client, options.observerScope)
    : null;

  async function loadFromUserRoles() {
    let { data, error } = await loadTeamRoleRows(client, orgId, viewContext);

    if (error) {
      throw error;
    }

    const branchScoped = viewContext?.observerScope.mode === "branch" && viewContext.viewBranchId;
    if (branchScoped && (!data || data.length === 0)) {
      const fallback = await loadTeamRoleRows(client, orgId, viewContext, { includeLegacyOrgWide: true });
      data = fallback.data;
      error = fallback.error;
      if (error) {
        throw error;
      }
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const userIds = [...new Set(rows.map((row) => String(row.user_id ?? "")).filter(Boolean))];
    const profileMap = await loadTeamMemberProfileMap(client, userIds);
    return rows.map((row) => {
      const userId = String(row.user_id ?? "");
      const profile = profileMap.get(userId);
      const profileName = profile?.displayName ?? "";

      return {
        id: String(row.id ?? ""),
        userId,
        role: String(row.role ?? "TECH") as AppRole,
        displayName:
          hasUsableTeamMemberName(profileName)
            ? profileName
            : fallbackTeamMemberName(userId, profile?.email ?? null),
        email: profile?.email ?? null,
        phone: profile?.phone ?? null,
        branchId: typeof row.branch_id === "string" ? row.branch_id : null,
      };
    });
  }

  const rpc = await client.rpc("list_team_members_secure_v2");
  if (!rpc.error && rpc.data) {
    const rpcRows = rpc.data as Array<Record<string, unknown>>;
    const normalizedRows = rpcRows.map((row) => normalizeTeamMemberRow(row));
    const userIds = [...new Set(normalizedRows.map((row) => row.userId).filter(Boolean))];
    const profileMap = await loadTeamMemberProfileMap(client, userIds);
    const enrichedRows = normalizedRows.map((row) => mergeProfileIntoTeamRow(row, profileMap));

    if (viewContext?.observerScope.mode === "branch" && viewContext.viewBranchId) {
      const scopedRows = enrichedRows.filter((row) => row.branchId === viewContext.viewBranchId);
      const rpcHasBranchMetadata = enrichedRows.some((row) => typeof row.branchId === "string" && row.branchId.length > 0);
      if (scopedRows.length > 0 || rpcHasBranchMetadata) {
        return scopedRows;
      }

      const roleRowsRes = await loadTeamRoleRows(client, orgId, viewContext, { includeLegacyOrgWide: true });
      if (!roleRowsRes.error && roleRowsRes.data) {
        const roleRows = roleRowsRes.data as Array<Record<string, unknown>>;
        const rowsWithRoleMetadata = applyRoleMetadataToTeamRows(enrichedRows, roleRows);
        const scopedRowsFromRoleMetadata = rowsWithRoleMetadata.filter((row) => row.branchId === viewContext.viewBranchId);

        if (scopedRowsFromRoleMetadata.length > 0) {
          return scopedRowsFromRoleMetadata;
        }
      }

      return loadFromUserRoles();
    }
    return enrichedRows;
  }

  return loadFromUserRoles();
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
    throw new Error("Không thể tự đổi vai trò của chính minh.");
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
  options?: { observerScope?: ObserverScopeInput | null },
): Promise<TeamInviteCodeRow[]> {
  await requireOwner(client);
  const viewContext = options?.observerScope
    ? await resolveMobileAdminViewContext(client, options.observerScope)
    : null;

  let query = client
    .from("invite_codes")
    .select("id,code,allowed_role,branch_id,expires_at,used_count,max_uses,used_at,revoked_at,note,created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (viewContext?.observerScope.mode === "branch" && viewContext.viewBranchId) {
    query = query.eq("branch_id", viewContext.viewBranchId);
  }

  const { data, error } = await query;

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
  const { branchId } = await ensureOrgContext(client);

  const { data, error } = await client.rpc("generate_invite_code_secure", {
    p_branch_id: branchId,
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
