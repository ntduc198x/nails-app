import type { AppRole } from "@nails/shared";

export type ManageScreenKey =
  | "content"
  | "customers"
  | "reports"
  | "tax-books"
  | "shifts"
  | "services"
  | "resources"
  | "team";

export type ManageScreenItem = {
  key: ManageScreenKey;
  titleKey:
    | "manageCustomersTitle"
    | "manageReportsTitle"
    | "manageTaxBooksTitle"
    | "manageServicesTitle"
    | "manageResourcesTitle"
    | "manageTeamTitle"
    | "manageShiftsTitle";
  subtitleKey:
    | "manageCustomersSubtitle"
    | "manageReportsSubtitle"
    | "manageTaxBooksSubtitle"
    | "manageServicesSubtitle"
    | "manageResourcesSubtitle"
    | "manageTeamSubtitle"
    | "manageShiftsSubtitle";
  route: string;
  group: "insights" | "setup";
  icon: "layout" | "user-plus" | "bar-chart-2" | "book-open" | "clock" | "package" | "grid" | "users";
};

export const MANAGE_SCREEN_ITEMS: ManageScreenItem[] = [
  {
    key: "customers",
    titleKey: "manageCustomersTitle",
    subtitleKey: "manageCustomersSubtitle",
    route: "/manage-customers",
    group: "insights",
    icon: "user-plus",
  },
  {
    key: "reports",
    titleKey: "manageReportsTitle",
    subtitleKey: "manageReportsSubtitle",
    route: "/manage-reports",
    group: "insights",
    icon: "bar-chart-2",
  },
  {
    key: "tax-books",
    titleKey: "manageTaxBooksTitle",
    subtitleKey: "manageTaxBooksSubtitle",
    route: "/manage-tax-books",
    group: "insights",
    icon: "book-open",
  },
  {
    key: "services",
    titleKey: "manageServicesTitle",
    subtitleKey: "manageServicesSubtitle",
    route: "/manage-services",
    group: "setup",
    icon: "package",
  },
  {
    key: "resources",
    titleKey: "manageResourcesTitle",
    subtitleKey: "manageResourcesSubtitle",
    route: "/manage-resources",
    group: "setup",
    icon: "grid",
  },
  {
    key: "team",
    titleKey: "manageTeamTitle",
    subtitleKey: "manageTeamSubtitle",
    route: "/manage-team",
    group: "setup",
    icon: "users",
  },
  {
    key: "shifts",
    titleKey: "manageShiftsTitle",
    subtitleKey: "manageShiftsSubtitle",
    route: "/shifts",
    group: "setup",
    icon: "clock",
  },
];

export function getManageScreenItem(key: ManageScreenKey) {
  return MANAGE_SCREEN_ITEMS.find((item) => item.key === key) ?? null;
}

export function canViewManageScreenItem(role: AppRole | null | undefined, key: ManageScreenKey) {
  switch (key) {
    case "customers":
      return role === "OWNER" || role === "PARTNER" || role === "RECEPTION";
    case "reports":
      return role === "OWNER" || role === "PARTNER" || role === "ACCOUNTANT";
    case "tax-books":
      return role === "OWNER" || role === "PARTNER" || role === "ACCOUNTANT";
    case "shifts":
      return role === "OWNER" || role === "PARTNER" || role === "RECEPTION";
    case "services":
    case "resources":
    case "team":
    case "content":
      return role === "OWNER" || role === "PARTNER";
    default:
      return false;
  }
}

export function filterManageScreenItemsForRole(
  role: AppRole | null | undefined,
  items: ManageScreenItem[] = MANAGE_SCREEN_ITEMS,
) {
  return items.filter((item) => canViewManageScreenItem(role, item.key));
}
