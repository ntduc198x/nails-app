import { useMemo } from "react";
import { translations } from "@nails/shared";
import type { CustomerLocale } from "@/src/providers/customer-preferences-provider";
import { useCustomerPreferences } from "@/src/providers/customer-preferences-provider";

const strings = {
  vi: translations.vi.customer,
  en: translations.en.customer,
} as const;

export type CustomerStringKey = keyof typeof strings.vi;
export type CustomerStatusCode =
  | "BOOKED"
  | "CHECKED_IN"
  | "IN_SERVICE"
  | "DONE"
  | "CANCELLED"
  | "NO_SHOW"
  | "NEW"
  | "CONFIRMED"
  | "NEEDS_RESCHEDULE"
  | "CONVERTED"
  | "EXPIRED_UNCONFIRMED"
  | "RESERVED"
  | "REDEEMED"
  | "EXPIRED";

export function getCustomerString(locale: CustomerLocale, key: CustomerStringKey) {
  return strings[locale][key];
}

export function getCustomerStatusLabel(locale: CustomerLocale, status: string) {
  const normalizedStatus = status.toUpperCase() as CustomerStatusCode;
  switch (normalizedStatus) {
    case "BOOKED":
      return strings[locale].statusBooked;
    case "CHECKED_IN":
      return strings[locale].statusCheckedIn;
    case "IN_SERVICE":
      return strings[locale].statusInService;
    case "DONE":
      return strings[locale].statusCompleted;
    case "CANCELLED":
      return strings[locale].statusCancelled;
    case "NO_SHOW":
      return strings[locale].statusNoShow;
    case "NEW":
      return strings[locale].statusNewRequest;
    case "CONFIRMED":
      return strings[locale].statusConfirmed;
    case "NEEDS_RESCHEDULE":
      return strings[locale].statusNeedsReschedule;
    case "CONVERTED":
      return strings[locale].statusConverted;
    case "EXPIRED_UNCONFIRMED":
      return strings[locale].statusExpiredUnconfirmed;
    case "RESERVED":
      return strings[locale].statusReserved;
    case "REDEEMED":
      return strings[locale].statusUsed;
    case "EXPIRED":
      return strings[locale].statusExpired;
    default:
      return status;
  }
}

export function useCustomerStrings() {
  const { locale } = useCustomerPreferences();
  return useMemo(() => strings[locale], [locale]);
}
