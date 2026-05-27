import {
  buildTranslationFieldMetaRecord,
  kickDynamicTranslationWorker,
  parseTranslationMetaValue,
  requestDynamicTranslation,
  type AppRole,
  type SharedSupabaseClient,
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

export function getTranslationStatusLabel(
  translationMeta: TranslationMetaValue | null | undefined,
) {
  const meta = parseTranslationMetaValue(translationMeta ?? null);
  return meta?.targets?.en?.status ?? "idle";
}

export async function requestRetranslateAndKick(
  client: SharedSupabaseClient,
  tableName: string,
  recordId: string,
  currentRole: AppRole | null | undefined,
  forceOverwrite = false,
) {
  if (currentRole !== "OWNER") {
    throw new Error("Only OWNER can approve automatic translation.");
  }
  await requestDynamicTranslation(client, {
    tableName,
    recordId,
    forceOverwrite,
    targetLocale: "en",
  });
  await kickDynamicTranslationWorker(client);
}
