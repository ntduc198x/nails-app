export type CustomerPriceParts = {
  amount: string;
  unit: string | null;
};

function normalizeAmountSeparators(value: string) {
  const trimmed = value.trim();
  if (/^\d{1,3}(?:\.\d{3})+$/.test(trimmed)) {
    return trimmed.replace(/\./g, ",");
  }
  return trimmed;
}

export function splitCustomerPriceLabel(value: string | null | undefined): CustomerPriceParts {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!text) return { amount: "", unit: null };

  const upperText = text.toUpperCase();
  if (upperText.endsWith(" VND")) {
    return {
      amount: normalizeAmountSeparators(text.slice(0, -4)),
      unit: "VND",
    };
  }

  if (upperText.endsWith("VND")) {
    return {
      amount: normalizeAmountSeparators(text.slice(0, -3)),
      unit: "VND",
    };
  }

  if (/^\d[\d.,]*D$/i.test(text)) {
    return {
      amount: normalizeAmountSeparators(text.slice(0, -1)),
      unit: "VND",
    };
  }

  return { amount: text, unit: null };
}
