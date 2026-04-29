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
  };
}

export async function listAdminServicesForMobile(
  client: SharedSupabaseClient,
): Promise<MobileAdminService[]> {
  const { orgId } = await ensureOrgContext(client);

  const response = await client
    .from("services")
    .select("id,name,short_description,image_url,featured_in_lookbook,duration_min,base_price,vat_rate,active")
    .eq("org_id", orgId)
    .order("name", { ascending: true });

  if (response.error) {
    const message = response.error.message || "";
    const missingNewFields =
      message.includes("short_description") ||
      message.includes("image_url") ||
      message.includes("featured_in_lookbook");

    if (!missingNewFields) {
      throw response.error;
    }

    const fallback = await client
      .from("services")
      .select("id,name,duration_min,base_price,vat_rate,active")
      .eq("org_id", orgId)
      .order("name", { ascending: true });

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
      name: input.name,
      short_description: input.shortDescription ?? null,
      image_url: input.imageUrl ?? null,
      featured_in_lookbook: input.featuredInLookbook ?? false,
      duration_min: input.durationMin,
      base_price: input.basePrice,
      vat_rate: input.vatPercent / 100,
      active: input.active ?? true,
    })
    .select("id,name,short_description,image_url,featured_in_lookbook,duration_min,base_price,vat_rate,active")
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
    .select("id,name,short_description,image_url,featured_in_lookbook,duration_min,base_price,vat_rate,active")
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
        throw new Error(`Xoa that bai: ${detach.error.message} (code: ${detach.error.code})`);
      }

      const retry = await client
        .from("services")
        .delete()
        .eq("id", id)
        .eq("org_id", orgId)
        .select();

      if (retry.error) {
        throw new Error(`Xoa that bai: ${retry.error.message} (code: ${retry.error.code})`);
      }

      return retry.data ?? [];
    }

    throw new Error(`Xoa that bai: ${error.message} (code: ${error.code})`);
  }

  return data ?? [];
}
