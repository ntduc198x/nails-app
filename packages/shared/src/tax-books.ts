import type { SharedSupabaseClient } from "./org";

export type TaxBookType = "S1A_HKD" | "S2A_HKD" | "S3A_HKD";

export type MobileTaxBookRow = {
  date: string;
  description: string;
  amount: number;
};

function buildServiceCustomerDescription(serviceNames: string[], customerName?: string | null) {
  const serviceLabel = serviceNames.length > 0 ? serviceNames.join(" + ") : "Dich vu";
  const customerLabel = customerName?.trim() ? customerName.trim() : "khach le";
  return `${serviceLabel} - ${customerLabel}`;
}

export async function buildTaxBookForMobile(
  client: SharedSupabaseClient,
  type: TaxBookType,
  fromIso: string,
  toIso: string,
): Promise<MobileTaxBookRow[]> {
  const { data, error } = await client.rpc("list_tax_book_rows_secure", {
    p_type: type,
    p_from: fromIso,
    p_to: toIso,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{ date?: string | null; description?: string | null; amount?: number | null }>).map((row) => ({
    date: typeof row.date === "string" ? row.date : new Date().toISOString(),
    description:
      typeof row.description === "string" && row.description.trim().length > 0
        ? row.description
        : buildServiceCustomerDescription([], null),
    amount: Number(row.amount ?? 0),
  }));
}
