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
