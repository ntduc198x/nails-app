import {
  type LocalizedTextValue,
  type TranslationMetaValue,
} from "./localization";
import type { ObserverScopeInput, SharedSupabaseClient } from "./org";
import { ensureOrgContext, resolveMobileAdminViewContext } from "./org";

export type MobileAdminResourceType = "CHAIR" | "TABLE" | "ROOM";

export type MobileAdminResource = {
  id: string;
  name: string;
  type: MobileAdminResourceType;
  active: boolean;
  branchId: string | null;
  translations: LocalizedTextValue | null;
  translationMeta: TranslationMetaValue | null;
};

export type MobileAdminResourceListOptions = {
  activeOnly?: boolean;
  observerScope?: ObserverScopeInput | null;
};

export type MobileAdminResourceInput = {
  name: string;
  type: MobileAdminResourceType;
  active?: boolean;
  translations?: LocalizedTextValue | null;
  translationMeta?: TranslationMetaValue | null;
};

function normalizeResourceRow(row: Record<string, unknown>): MobileAdminResource {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? "-"),
    type: (String(row.type ?? "CHAIR") as MobileAdminResourceType),
    active: row.active !== false,
    branchId: typeof row.branch_id === "string" ? row.branch_id : null,
    translations: (row.translations as LocalizedTextValue | null | undefined) ?? null,
    translationMeta: (row.translation_meta as TranslationMetaValue | null | undefined) ?? null,
  };
}

export async function listResourcesForMobile(
  client: SharedSupabaseClient,
  options?: MobileAdminResourceListOptions,
): Promise<MobileAdminResource[]> {
  const { orgId } = await ensureOrgContext(client);
  const viewContext = options?.observerScope
    ? await resolveMobileAdminViewContext(client, options.observerScope)
    : null;

  let query = client
    .from("resources")
    .select("id,name,type,active,branch_id,translations,translation_meta")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (viewContext?.observerScope.mode === "branch" && viewContext.viewBranchId) {
    query = query.eq("branch_id", viewContext.viewBranchId);
  }

  if (options?.activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;
  if (error) {
    const message = error.message || "";
    const missingTranslations = message.includes("translations");
    if (missingTranslations) {
      let fallbackQuery = client
        .from("resources")
        .select("id,name,type,active,branch_id,translation_meta")
        .eq("org_id", orgId)
        .order("created_at", { ascending: true });

      if (viewContext?.observerScope.mode === "branch" && viewContext.viewBranchId) {
        fallbackQuery = fallbackQuery.eq("branch_id", viewContext.viewBranchId);
      }

      if (options?.activeOnly) {
        fallbackQuery = fallbackQuery.eq("active", true);
      }

      const fallback = await fallbackQuery;

      if (fallback.error) {
        throw fallback.error;
      }

      return (fallback.data ?? []).map((row) =>
        normalizeResourceRow({ ...row, translations: null } as Record<string, unknown>),
      );
    }

    if (message.includes("resources") || message.includes("resource_id")) {
      return [];
    }
    throw error;
  }

  return (data ?? []).map((row) => normalizeResourceRow(row as Record<string, unknown>));
}

export async function createResourceForMobile(
  client: SharedSupabaseClient,
  input: MobileAdminResourceInput,
): Promise<MobileAdminResource> {
  const { orgId, branchId } = await ensureOrgContext(client);

  const { data, error } = await client
    .from("resources")
    .insert({
      org_id: orgId,
      branch_id: branchId,
      name: input.name,
      type: input.type,
      active: input.active ?? true,
      translations: input.translations ?? null,
      translation_meta: input.translationMeta ?? null,
    })
    .select("id,name,type,active,branch_id,translations,translation_meta")
    .single();

  if (error) {
    const message = error.message || "";
    if (message.includes("translations")) {
      const fallback = await client
        .from("resources")
        .insert({
          org_id: orgId,
          branch_id: branchId,
          name: input.name,
          type: input.type,
          active: input.active ?? true,
        })
        .select("id,name,type,active,branch_id,translation_meta")
        .single();

      if (fallback.error) {
        throw fallback.error;
      }

      return normalizeResourceRow({
        ...(fallback.data ?? {}),
        translations: null,
      } as Record<string, unknown>);
    }

    throw error;
  }

  const resource = normalizeResourceRow((data ?? {}) as Record<string, unknown>);
  return resource;
}

export async function updateResourceForMobile(
  client: SharedSupabaseClient,
  input: MobileAdminResourceInput & { id: string },
): Promise<MobileAdminResource> {
  const { orgId } = await ensureOrgContext(client);

  const { data, error } = await client
    .from("resources")
    .update({
      name: input.name,
      type: input.type,
      active: input.active,
      translations: input.translations ?? null,
      translation_meta: input.translationMeta ?? null,
    })
    .eq("id", input.id)
    .eq("org_id", orgId)
    .select("id,name,type,active,branch_id,translations,translation_meta")
    .single();

  if (error) {
    const message = error.message || "";
    if (message.includes("translations")) {
      const fallback = await client
        .from("resources")
        .update({
          name: input.name,
          type: input.type,
          active: input.active,
        })
        .eq("id", input.id)
        .eq("org_id", orgId)
        .select("id,name,type,active,branch_id,translation_meta")
        .single();

      if (fallback.error) {
        throw fallback.error;
      }

      return normalizeResourceRow({
        ...(fallback.data ?? {}),
        translations: null,
      } as Record<string, unknown>);
    }

    throw error;
  }

  const resource = normalizeResourceRow((data ?? {}) as Record<string, unknown>);
  return resource;
}
