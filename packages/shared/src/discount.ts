export type StoredCheckoutDiscountType = "amount" | "percent";

export type StoredCheckoutTotals = {
  subtotal?: number;
  discount_total?: number;
  discount_type?: string;
  discount_value?: number;
  vat_total?: number;
  grand_total?: number;
};

export function getStoredDiscountDetails(totals: StoredCheckoutTotals | null | undefined): {
  total: number;
  type: StoredCheckoutDiscountType | null;
  value: number | null;
} {
  const total = Number(totals?.discount_total ?? 0);
  const rawType = typeof totals?.discount_type === "string" ? totals.discount_type.toLowerCase() : null;
  const type = rawType === "amount" || rawType === "percent" ? rawType : null;
  const rawValue = Number(totals?.discount_value ?? 0);
  const value = Number.isFinite(rawValue) ? rawValue : null;

  return {
    total: Number.isFinite(total) ? total : 0,
    type,
    value,
  };
}

