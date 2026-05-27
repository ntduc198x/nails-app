import { DEFAULT_LOCALE, type Locale } from "./i18n";

export type LocalizedFieldValue = string | string[] | null;
export type LocalizedFields = Record<string, LocalizedFieldValue | undefined>;
export type LocalizedTextValue = Partial<Record<Locale, LocalizedFields>>;

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

export function formatLocalizedDurationLabel(locale: Locale, minutes: number | null | undefined) {
  if (!Number.isFinite(minutes) || Number(minutes) <= 0) return null;
  const safeMinutes = Math.round(Number(minutes));
  return locale === "en" ? `${safeMinutes} min` : `${safeMinutes} phút`;
}
