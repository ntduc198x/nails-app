import type { SharedSupabaseClient } from "./org";
import { ensureOrgContext } from "./org";

export type MobileAdminService = {
  id: string;
  name: string;
  shortDescription: string | null;
  imageUrl: string | null;
  featuredInLookbook: boolean;
  durationMin: number;
  basePrice: number;
  vatRate: number;
  active: boolean;
  branchId: string | null;  // Added: branch association
};

export type MobileAdminServiceInput = {
  name: string;
  shortDescription?: string | null;
  imageUrl?: string | null;
  featuredInLookbook?: boolean;
  durationMin: number;
  basePrice: number;
  vatPercent: number;
  active?: boolean;
  branchId?: string | null;  // Added: branch association
};

function normalizeServiceRow(row: Record<string, unknown>): MobileAdminService {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? "-"),
    shortDescription: typeof row.short_description === "string" ? row.short_description : null,
    imageUrl: typeof row.image_url === "string" ? row.image_url : null,
    featuredInLookbook: Boolean(row.featured_in_lookbook),
    durationMin: Number(row.duration_min ?? 0),
    basePrice: Number(row.base_price ?? 0),
    vatRate: Number(row.vat_rate ?? 0),
    active: row.active !== false,
    branchId: typeof row.branch_id === "string" ? row.branch_id : null,
  };
}

export async function listAdminServicesForMobile(
  client: SharedSupabaseClient,
  branchId?: string,
): Promise<MobileAdminService[]> {
  const { orgId, branchId: profileBranchId } = await ensureOrgContext(client);

  // Use profile's branch as default if not specified
  const targetBranchId = branchId ?? profileBranchId;

  let query = client
    .from("services")
    .select("id,name,short_description,image_url,featured_in_lookbook,duration_min,base_price,vat_rate,active,branch_id")
    .eq("org_id", orgId);

  // Filter by branch_id if provided (nullable to include org-wide services)
  // Default: use profile's branch_id, show services of current branch + org-wide (null)
  if (targetBranchId) {
    query = query.or(`branch_id.eq.${targetBranchId},branch_id.is.null`);
  }

  const response = await query.order("name", { ascending: true });

  if (response.error) {
    const message = response.error.message || "";
    const missingNewFields =
      message.includes("short_description") ||
      message.includes("image_url") ||
      message.includes("featured_in_lookbook");

    if (!missingNewFields) {
      throw response.error;
    }

    // Fallback query without new columns
    let fallbackQuery = client
      .from("services")
      .select("id,name,duration_min,base_price,vat_rate,active,branch_id")
      .eq("org_id", orgId);

    if (targetBranchId) {
      fallbackQuery = fallbackQuery.or(`branch_id.eq.${targetBranchId},branch_id.is.null`);
    }

    const fallback = await fallbackQuery.order("name", { ascending: true });

    if (fallback.error) {
      throw fallback.error;
    }

    return (fallback.data ?? []).map((row) => normalizeServiceRow({
      ...row,
      short_description: null,
      image_url: null,
      featured_in_lookbook: false,
    }));
  }

  return (response.data ?? []).map((row) => normalizeServiceRow(row as Record<string, unknown>));
}

export async function createAdminServiceForMobile(
  client: SharedSupabaseClient,
  input: MobileAdminServiceInput,
): Promise<MobileAdminService> {
  const { orgId } = await ensureOrgContext(client);

  const { data, error } = await client
    .from("services")
    .insert({
      org_id: orgId,
      branch_id: input.branchId ?? null,
      name: input.name,
      short_description: input.shortDescription ?? null,
      image_url: input.imageUrl ?? null,
      featured_in_lookbook: input.featuredInLookbook ?? false,
      duration_min: input.durationMin,
      base_price: input.basePrice,
      vat_rate: input.vatPercent / 100,
      active: input.active ?? true,
    })
    .select("id,name,short_description,image_url,featured_in_lookbook,duration_min,base_price,vat_rate,active,branch_id")
    .single();

  if (error) {
    throw error;
  }

  return normalizeServiceRow((data ?? {}) as Record<string, unknown>);
}

export async function updateAdminServiceForMobile(
  client: SharedSupabaseClient,
  input: MobileAdminServiceInput & { id: string },
): Promise<MobileAdminService> {
  const { orgId } = await ensureOrgContext(client);

  const { data, error } = await client
    .from("services")
    .update({
      branch_id: input.branchId ?? null,
      name: input.name,
      short_description: input.shortDescription ?? null,
      image_url: input.imageUrl ?? null,
      featured_in_lookbook: input.featuredInLookbook ?? false,
      duration_min: input.durationMin,
      base_price: input.basePrice,
      vat_rate: input.vatPercent / 100,
      active: input.active ?? true,
    })
    .eq("id", input.id)
    .eq("org_id", orgId)
    .select("id,name,short_description,image_url,featured_in_lookbook,duration_min,base_price,vat_rate,active,branch_id")
    .single();

  if (error) {
    throw error;
  }

  return normalizeServiceRow((data ?? {}) as Record<string, unknown>);
}

export async function deleteAdminServiceForMobile(
  client: SharedSupabaseClient,
  id: string,
) {
  const { orgId } = await ensureOrgContext(client);

  const { data, error } = await client
    .from("services")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId)
    .select();

  if (error) {
    if (error.code === "23503") {
      const detach = await client
        .from("ticket_items")
        .update({ service_id: null })
        .eq("org_id", orgId)
        .eq("service_id", id);

      if (detach.error) {
        throw new Error(`Xóa thất bại: ${detach.error.message} (code: ${detach.error.code})`);
      }

      const retry = await client
        .from("services")
        .delete()
        .eq("id", id)
        .eq("org_id", orgId)
        .select();

      if (retry.error) {
        throw new Error(`Xóa thất bại: ${retry.error.message} (code: ${retry.error.code})`);
      }

      return retry.data ?? [];
    }

    throw new Error(`Xóa thất bại: ${error.message} (code: ${error.code})`);
  }

  return data ?? [];
}
