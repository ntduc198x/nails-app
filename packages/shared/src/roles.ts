import type { AppRole } from "./auth";
import type { Locale } from "./i18n";

export const ROLE_LABELS: Record<Locale, Record<AppRole, string>> = {
  vi: {
    USER: "Khách hàng",
    OWNER: "Chủ sở hữu",
    PARTNER: "Chủ tiệm",
    MANAGER: "Quản lý",
    RECEPTION: "Lễ tân",
    ACCOUNTANT: "Kế toán",
    TECH: "Kỹ thuật viên",
  },
  en: {
    USER: "Customer",
    OWNER: "Owner",
    PARTNER: "Partner",
    MANAGER: "Manager",
    RECEPTION: "Reception",
    ACCOUNTANT: "Accountant",
    TECH: "Technician",
  },
};

export function getRoleLabel(role: AppRole | string | null | undefined, locale: Locale = "vi") {
  if (!role) return "-";
  return ROLE_LABELS[locale][role as AppRole] ?? String(role);
}
