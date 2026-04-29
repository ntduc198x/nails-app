import type { SharedSupabaseClient } from "./org";
import { ensureOrgContext } from "./org";

export type MobileAdminResourceType = "CHAIR" | "TABLE" | "ROOM";

export type MobileAdminResource = {
  id: string;
  name: string;
  type: MobileAdminResourceType;
  active: boolean;
};

function normalizeResourceRow(row: Record<string, unknown>): MobileAdminResource {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? "-"),
    type: (String(row.type ?? "CHAIR") as MobileAdminResourceType),
    active: row.active !== false,
  };
}

export async function listResourcesForMobile(
  client: SharedSupabaseClient,
  options?: { activeOnly?: boolean },
): Promise<MobileAdminResource[]> {
  const { orgId } = await ensureOrgContext(client);

  let query = client
    .from("resources")
    .select("id,name,type,active")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (options?.activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;
  if (error) {
    const message = error.message || "";
    if (message.includes("resources") || message.includes("resource_id")) {
      return [];
    }
    throw error;
  }

  return (data ?? []).map((row) => normalizeResourceRow(row as Record<string, unknown>));
}

export async function createResourceForMobile(
  client: SharedSupabaseClient,
  input: { name: string; type: MobileAdminResourceType },
): Promise<MobileAdminResource> {
  const { orgId, branchId } = await ensureOrgContext(client);

  const { data, error } = await client
    .from("resources")
    .insert({
      org_id: orgId,
      branch_id: branchId,
      name: input.name,
      type: input.type,
      active: true,
    })
    .select("id,name,type,active")
    .single();

  if (error) {
    throw error;
  }

  return normalizeResourceRow((data ?? {}) as Record<string, unknown>);
}

export async function updateResourceForMobile(
  client: SharedSupabaseClient,
  input: { id: string; name: string; type: MobileAdminResourceType; active: boolean },
): Promise<MobileAdminResource> {
  const { orgId } = await ensureOrgContext(client);

  const { data, error } = await client
    .from("resources")
    .update({
      name: input.name,
      type: input.type,
      active: input.active,
    })
    .eq("id", input.id)
    .eq("org_id", orgId)
    .select("id,name,type,active")
    .single();

  if (error) {
    throw error;
  }

  return normalizeResourceRow((data ?? {}) as Record<string, unknown>);
}
