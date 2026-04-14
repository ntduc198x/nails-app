import Link from "next/link";

export type ManageQuickNavItem = {
  href: string;
  label: string;
  accent?: boolean;
};

export const operationsQuickNav = (activeHref: string): ManageQuickNavItem[] => [
  { href: "/manage/booking-requests", label: "Booking online", accent: activeHref === "/manage/booking-requests" },
  { href: "/manage/appointments", label: "Điều phối lịch", accent: activeHref === "/manage/appointments" },
  { href: "/manage/checkout", label: "Thanh toán", accent: activeHref === "/manage/checkout" },
  { href: "/manage/shifts", label: "Ca làm", accent: activeHref === "/manage/shifts" },
];

export const setupQuickNav = (activeHref: string): ManageQuickNavItem[] => [
  { href: "/manage/services", label: "Dịch vụ", accent: activeHref === "/manage/services" },
  { href: "/manage/resources", label: "Ghế/Bàn", accent: activeHref === "/manage/resources" },
  { href: "/manage/team", label: "Nhân sự", accent: activeHref === "/manage/team" },
];

export const reportsQuickNav = (activeHref: string): ManageQuickNavItem[] => [
  { href: "/manage/reports", label: "Báo cáo", accent: activeHref === "/manage/reports" },
  { href: "/manage/tax-books", label: "Sổ thuế", accent: activeHref === "/manage/tax-books" },
];

export function ManageQuickNav({ items, className = "" }: { items: ManageQuickNavItem[]; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {items.map((item) => (
        <Link key={`${item.href}-${item.label}`} href={item.href} className={item.accent ? "manage-quick-link-accent" : "manage-quick-link"}>
          {item.label}
        </Link>
      ))}
    </div>
  );
}
