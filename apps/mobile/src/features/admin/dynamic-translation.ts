import {
  buildTranslationFieldMetaRecord,
  type TranslationMetaValue,
} from "@nails/shared";

type FieldModeInput = Record<string, string | string[] | null | undefined>;

function hasManualValue(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return value.some((item) => typeof item === "string" && item.trim());
  }
  return typeof value === "string" && value.trim().length > 0;
}

export function buildManualAwareTranslationMeta(
  previous: TranslationMetaValue | null | undefined,
  enFields: FieldModeInput,
) {
  const fieldModes = Object.fromEntries(
    Object.entries(enFields).map(([field, value]) => [field, hasManualValue(value) ? "manual" : "auto"]),
  ) as Record<string, "auto" | "manual">;

  return buildTranslationFieldMetaRecord(fieldModes, previous ?? null);
}
