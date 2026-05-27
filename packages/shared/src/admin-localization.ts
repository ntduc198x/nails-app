import { type Locale } from "./i18n";
import {
  formatLocalizedDurationLabel,
  parseLocalizedTextValue,
  resolveLocalizedField,
} from "./localization";
import type { MobileAdminMerchService } from "./admin-content";
import type { MobileAdminResource } from "./resources";
import type { MobileAdminService } from "./services";

const LOOKBOOK_TONE_DICTIONARY: Record<string, string> = {
  "nhe nhang": "Soft",
  "don gian": "Minimal",
  "sang trong": "Luxury",
  "ca tinh": "Edgy",
  "noi bat": "Standout",
  "cham soc": "Care",
};

const LOOKBOOK_BADGE_DICTIONARY: Record<string, string> = {
  hot: "Hot",
  trend: "Trend",
  "noi bat": "Featured",
  lookbook: "Lookbook",
};

function normalizeVietnamese(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function localizeDictionaryValue(
  locale: Locale,
  value: string | null | undefined,
  dictionary: Record<string, string>,
) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return text || null;
  if (locale !== "en") return text;
  return dictionary[normalizeVietnamese(text)] ?? text;
}

function resolveAdminLocalizedField<T extends string | string[] | null>(
  locale: Locale,
  baseValue: T,
  translations: unknown,
  field: string,
) {
  if (locale === "vi") {
    return baseValue;
  }
  return resolveLocalizedField(locale, baseValue, translations, field);
}

function localizeBranchNameFallback(locale: Locale, branchName: string | null | undefined) {
  const text = typeof branchName === "string" ? branchName.trim() : "";
  if (!text || locale !== "en") return text || null;

  const normalized = normalizeVietnamese(text);
  if (normalized === "chi nhanh chinh") {
    return "Main Branch";
  }

  const match = normalized.match(/^chi nhanh\s+(.+)$/);
  if (!match) {
    return text;
  }

  const suffix = text.replace(/^chi\s*nh[aáạảãăâ]nh\s*/i, "").trim();
  if (!suffix) {
    return "Branch";
  }

  return `Branch ${suffix}`;
}

export function localizeAdminBranchName(
  locale: Locale,
  branchName: string,
  translations: unknown,
) {
  if (locale === "vi") {
    return branchName;
  }

  const explicitEnglish = parseLocalizedTextValue(translations)?.en?.name;
  return (
    (typeof explicitEnglish === "string" && explicitEnglish.trim() ? explicitEnglish : null) ??
    localizeBranchNameFallback(locale, branchName) ??
    branchName
  );
}

export function localizeAdminService(
  locale: Locale,
  service: MobileAdminService,
): MobileAdminService {
  return {
    ...service,
    name:
      resolveAdminLocalizedField(locale, service.name, service.translations, "name") ??
      service.name,
    shortDescription: resolveAdminLocalizedField(
      locale,
      service.shortDescription,
      service.translations,
      "short_description",
    ),
  };
}

export function localizeAdminResource(
  locale: Locale,
  resource: MobileAdminResource,
): MobileAdminResource {
  return {
    ...resource,
    name:
      resolveAdminLocalizedField(locale, resource.name, resource.translations, "name") ??
      resource.name,
  };
}

export function localizeAdminMerchService(
  locale: Locale,
  service: MobileAdminMerchService,
): MobileAdminMerchService {
  return {
    ...service,
    name:
      resolveAdminLocalizedField(locale, service.name, service.translations, "name") ??
      service.name,
    shortDescription: resolveAdminLocalizedField(
      locale,
      service.shortDescription,
      service.translations,
      "short_description",
    ),
    durationLabel:
      resolveAdminLocalizedField(
        locale,
        service.durationLabel ?? formatLocalizedDurationLabel(locale, service.durationMin),
        service.translations,
        "duration_label",
      ) ?? formatLocalizedDurationLabel(locale, service.durationMin),
    lookbookBadge: resolveAdminLocalizedField(
      locale,
      localizeDictionaryValue(locale, service.lookbookBadge, LOOKBOOK_BADGE_DICTIONARY),
      service.translations,
      "lookbook_badge",
    ),
    lookbookTone: resolveAdminLocalizedField(
      locale,
      localizeDictionaryValue(locale, service.lookbookTone, LOOKBOOK_TONE_DICTIONARY),
      service.translations,
      "lookbook_tone",
    ),
  };
}
