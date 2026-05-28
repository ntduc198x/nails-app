import { DEFAULT_LOCALE, type Locale } from "./i18n";
import type { SharedSupabaseClient } from "./org";

export type LocalizedFieldValue = string | string[] | null;
export type LocalizedFields = Record<string, LocalizedFieldValue | undefined>;
export type LocalizedTextValue = Partial<Record<Locale, LocalizedFields>>;
export type TranslationTargetLocale = "en";
export type TranslationFieldMode = "auto" | "manual";
export type TranslationFieldStatus = "clean" | "pending" | "translated" | "error";
export type TranslationRecordStatus = "idle" | "pending" | "in_progress" | "translated" | "error";

export type TranslationFieldMeta = {
  mode?: TranslationFieldMode;
  status?: TranslationFieldStatus;
  sourceHash?: string | null;
  updatedAt?: string | null;
  error?: string | null;
};

export type TranslationTargetMeta = {
  status?: TranslationRecordStatus;
  approvalStatus?: "idle" | "pending_owner" | "approved";
  lastJobId?: string | null;
  lastTranslatedAt?: string | null;
  updatedAt?: string | null;
  error?: string | null;
};

export type TranslationMetaValue = {
  sourceLocale?: Locale;
  targets?: Partial<Record<TranslationTargetLocale, TranslationTargetMeta>>;
  fields?: Record<string, TranslationFieldMeta | undefined>;
};

export type ManualLocalizedTextResult = {
  value: string | null;
  missing: boolean;
};

export type ManualLocalizedArrayResult = {
  value: string[];
  missing: boolean;
};

export type DynamicTranslationRequestInput = {
  tableName: string;
  recordId: string;
  targetLocale?: TranslationTargetLocale;
  forceOverwrite?: boolean;
  fields?: string[] | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return null;
  const list = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length ? list : [];
}

function normalizeFieldValue(value: unknown): LocalizedFieldValue | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (Array.isArray(value)) {
    return normalizeStringArray(value);
  }

  if (value == null) {
    return null;
  }

  return undefined;
}

export function parseLocalizedTextValue(value: unknown): LocalizedTextValue | null {
  if (!isRecord(value)) return null;

  const result: LocalizedTextValue = {};
  for (const locale of [DEFAULT_LOCALE, "en"] as const) {
    const localeFields = value[locale];
    if (!isRecord(localeFields)) continue;

    const normalizedFields: LocalizedFields = {};
    for (const [field, fieldValue] of Object.entries(localeFields)) {
      const normalized = normalizeFieldValue(fieldValue);
      if (normalized !== undefined) {
        normalizedFields[field] = normalized;
      }
    }

    if (Object.keys(normalizedFields).length > 0) {
      result[locale] = normalizedFields;
    }
  }

  return Object.keys(result).length ? result : null;
}

function parseTranslationFieldMeta(value: unknown): TranslationFieldMeta | null {
  if (!isRecord(value)) return null;

  const result: TranslationFieldMeta = {};
  if (value.mode === "auto" || value.mode === "manual") {
    result.mode = value.mode;
  }
  if (
    value.status === "clean" ||
    value.status === "pending" ||
    value.status === "translated" ||
    value.status === "error"
  ) {
    result.status = value.status;
  }
  if (typeof value.sourceHash === "string" || value.sourceHash === null) {
    result.sourceHash = value.sourceHash;
  }
  if (typeof value.updatedAt === "string" || value.updatedAt === null) {
    result.updatedAt = value.updatedAt;
  }
  if (typeof value.error === "string" || value.error === null) {
    result.error = value.error;
  }

  return Object.keys(result).length ? result : null;
}

function parseTranslationTargetMeta(value: unknown): TranslationTargetMeta | null {
  if (!isRecord(value)) return null;

  const result: TranslationTargetMeta = {};
  if (
    value.status === "idle" ||
    value.status === "pending" ||
    value.status === "in_progress" ||
    value.status === "translated" ||
    value.status === "error"
  ) {
    result.status = value.status;
  }
  if (
    value.approvalStatus === "idle" ||
    value.approvalStatus === "pending_owner" ||
    value.approvalStatus === "approved"
  ) {
    result.approvalStatus = value.approvalStatus;
  }
  if (typeof value.lastJobId === "string" || value.lastJobId === null) {
    result.lastJobId = value.lastJobId;
  }
  if (typeof value.lastTranslatedAt === "string" || value.lastTranslatedAt === null) {
    result.lastTranslatedAt = value.lastTranslatedAt;
  }
  if (typeof value.updatedAt === "string" || value.updatedAt === null) {
    result.updatedAt = value.updatedAt;
  }
  if (typeof value.error === "string" || value.error === null) {
    result.error = value.error;
  }

  return Object.keys(result).length ? result : null;
}

export function parseTranslationMetaValue(value: unknown): TranslationMetaValue | null {
  if (!isRecord(value)) return null;

  const result: TranslationMetaValue = {};
  if (value.sourceLocale === "vi" || value.sourceLocale === "en") {
    result.sourceLocale = value.sourceLocale;
  }

  if (isRecord(value.targets)) {
    const targets: Partial<Record<TranslationTargetLocale, TranslationTargetMeta>> = {};
    const enTarget = parseTranslationTargetMeta(value.targets.en);
    if (enTarget) {
      targets.en = enTarget;
    }
    if (Object.keys(targets).length) {
      result.targets = targets;
    }
  }

  if (isRecord(value.fields)) {
    const fields: Record<string, TranslationFieldMeta> = {};
    for (const [field, meta] of Object.entries(value.fields)) {
      const parsed = parseTranslationFieldMeta(meta);
      if (parsed) {
        fields[field] = parsed;
      }
    }
    if (Object.keys(fields).length) {
      result.fields = fields;
    }
  }

  return Object.keys(result).length ? result : null;
}

export function listMissingLocalizedFields(
  locale: Locale,
  translations: unknown,
  requiredFields: string[],
) {
  const parsed = parseLocalizedTextValue(translations);
  return requiredFields.filter((field) => {
    const localized = parsed?.[locale]?.[field];
    if (typeof localized === "string") return !localized.trim();
    if (Array.isArray(localized)) return localized.length === 0;
    return true;
  });
}

export function resolveLocalizedField<T extends LocalizedFieldValue>(
  locale: Locale,
  baseValue: T,
  translations: unknown,
  field: string,
): T {
  const parsed = parseLocalizedTextValue(translations);
  if (!parsed) return baseValue;

  const localized = parsed[locale]?.[field];
  if (localized !== undefined && localized !== null) {
    return localized as T;
  }

  const fallback = parsed[DEFAULT_LOCALE]?.[field];
  if (fallback !== undefined && fallback !== null) {
    return fallback as T;
  }

  return baseValue;
}

export function resolveManualLocalizedText(
  locale: Locale,
  baseValue: string | null | undefined,
  translations: unknown,
  field: string,
): ManualLocalizedTextResult {
  const parsed = parseLocalizedTextValue(translations);

  if (locale === "en") {
    const localized = parsed?.en?.[field];
    if (typeof localized === "string" && localized.trim()) {
      return { value: localized, missing: false };
    }
    return { value: null, missing: true };
  }

  const localized = parsed?.[DEFAULT_LOCALE]?.[field];
  if (typeof localized === "string" && localized.trim()) {
    return { value: localized, missing: false };
  }

  const fallback = typeof baseValue === "string" ? baseValue.trim() : "";
  return { value: fallback || null, missing: false };
}

export function resolveManualLocalizedArray(
  locale: Locale,
  baseValue: string[] | null | undefined,
  translations: unknown,
  field: string,
): ManualLocalizedArrayResult {
  const parsed = parseLocalizedTextValue(translations);

  if (locale === "en") {
    const localized = parsed?.en?.[field];
    if (Array.isArray(localized) && localized.length) {
      return { value: localized, missing: false };
    }
    return { value: [], missing: true };
  }

  const localized = parsed?.[DEFAULT_LOCALE]?.[field];
  if (Array.isArray(localized) && localized.length) {
    return { value: localized, missing: false };
  }

  return { value: Array.isArray(baseValue) ? baseValue : [], missing: false };
}

export function formatLocalizedDurationLabel(locale: Locale, minutes: number | null | undefined) {
  if (!Number.isFinite(minutes) || Number(minutes) <= 0) return null;
  const safeMinutes = Math.round(Number(minutes));
  return locale === "en" ? `${safeMinutes} min` : `${safeMinutes} phút`;
}

export function getTranslationFieldMode(
  translationMeta: TranslationMetaValue | null | undefined,
  field: string,
): TranslationFieldMode {
  return translationMeta?.fields?.[field]?.mode === "manual" ? "manual" : "auto";
}

export function buildTranslationFieldMetaRecord(
  fieldModes: Record<string, TranslationFieldMode | undefined>,
  previous?: TranslationMetaValue | null,
): TranslationMetaValue | null {
  const fields: Record<string, TranslationFieldMeta> = {};
  let hasManualField = false;

  for (const [field, mode] of Object.entries(fieldModes)) {
    if (!mode) continue;
    const previousField = previous?.fields?.[field];
    if (mode === "manual") {
      hasManualField = true;
    }
    fields[field] = {
      mode,
      status: mode === "manual" ? "translated" : (previousField?.status ?? "clean"),
      sourceHash: previousField?.sourceHash ?? null,
      updatedAt: previousField?.updatedAt ?? null,
      error: previousField?.error ?? null,
    };
  }

  if (!Object.keys(fields).length && !previous) {
    return null;
  }

  return {
    sourceLocale: previous?.sourceLocale ?? "vi",
    targets: {
      ...(previous?.targets ?? {}),
      en: {
        ...(previous?.targets?.en ?? {}),
        status: hasManualField ? "translated" : (previous?.targets?.en?.status ?? "idle"),
        approvalStatus: previous?.targets?.en?.approvalStatus ?? "idle",
      },
    },
    fields: {
      ...(previous?.fields ?? {}),
      ...fields,
    },
  };
}

export async function requestDynamicTranslation(
  client: SharedSupabaseClient,
  input: DynamicTranslationRequestInput,
): Promise<string | null> {
  const { data, error } = await client.rpc("request_dynamic_translation", {
    p_table_name: input.tableName,
    p_record_id: input.recordId,
    p_target_locale: input.targetLocale ?? "en",
    p_force_overwrite: input.forceOverwrite ?? false,
    p_fields: input.fields ?? null,
  });

  if (error) throw error;
  return typeof data === "string" ? data : null;
}

export async function kickDynamicTranslationWorker(client: SharedSupabaseClient) {
  try {
    await client.functions.invoke("dynamic-content-translate", {
      body: { limit: 8 },
    });
  } catch {
    // Background kick is best-effort. Jobs stay queued if the invoke fails.
  }
}
