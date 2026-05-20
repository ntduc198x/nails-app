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
  title: string;
  subtitle: string;
  route: string;
  group: "insights" | "setup";
  icon: "layout" | "user-plus" | "bar-chart-2" | "book-open" | "clock" | "package" | "grid" | "users";
};

export const MANAGE_SCREEN_ITEMS: ManageScreenItem[] = [
  {
    key: "customers",
    title: "CRM khách",
    subtitle: "Khách mới, quay lại, nguy cơ rời bỏ và tệp VIP.",
    route: "/manage-customers",
    group: "insights",
    icon: "user-plus",
  },
  {
    key: "reports",
    title: "Báo cáo",
    subtitle: "Theo dõi bill, doanh thu, lọc nhân viên và phân tích.",
    route: "/manage-reports",
    group: "insights",
    icon: "bar-chart-2",
  },
  {
    key: "tax-books",
    title: "Sổ thuế",
    subtitle: "Mẫu S1a-HKD, kỳ kê khai và xuất file phục vụ nộp thuế.",
    route: "/manage-tax-books",
    group: "insights",
    icon: "book-open",
  },
  {
    key: "shifts",
    title: "Quản lý ca",
    subtitle: "Lịch tuần, chấm công và điều chỉnh ca làm cho nhân sự.",
    route: "/shifts",
    group: "insights",
    icon: "clock",
  },
  {
    key: "services",
    title: "Dịch vụ",
    subtitle: "Quản lý danh mục dịch vụ, lookbook và thùng rác.",
    route: "/manage-services",
    group: "setup",
    icon: "package",
  },
  {
    key: "resources",
    title: "Tài nguyên",
    subtitle: "Ghế, bàn và trạng thái tài nguyên dùng trong cửa hàng.",
    route: "/manage-resources",
    group: "setup",
    icon: "grid",
  },
  {
    key: "team",
    title: "Nhân sự",
    subtitle: "Vai trò, danh sách nhân sự và quyền truy cập nội bộ.",
    route: "/manage-team",
    group: "setup",
    icon: "users",
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
