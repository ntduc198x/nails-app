import { useMemo } from "react";
import { translations } from "@nails/shared";
import type { AdminLocale } from "@/src/providers/admin-preferences-provider";
import { useAdminPreferences } from "@/src/providers/admin-preferences-provider";

const strings = {
  vi: translations.vi.admin,
  en: translations.en.admin,
} as const;

export type AdminStringKey = keyof typeof strings.vi;

export function getAdminString(locale: AdminLocale, key: AdminStringKey) {
  return strings[locale][key];
}

export function useAdminStrings() {
  const { locale } = useAdminPreferences();
  return useMemo(() => strings[locale], [locale]);
}
