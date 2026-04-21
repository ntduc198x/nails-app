export type Role = "OWNER" | "MANAGER" | "RECEPTION" | "ACCOUNTANT" | "TECH";

export const me = {
  name: "Lễ tân demo",
  role: "RECEPTION" as Role,
  branch: "Chi nhánh Q1",
};

export const services = [
  { id: "s1", name: "Sơn gel cơ bản", durationMin: 45, price: 250000, vatPercent: 8, active: true },
  { id: "s2", name: "Pedicure", durationMin: 60, price: 320000, vatPercent: 8, active: true },
  { id: "s3", name: "Combo Spa", durationMin: 90, price: 550000, vatPercent: 10, active: true },
];

export const appointments = [
  {
    id: "a1",
    time: "09:00",
    customer: "Linh",
    service: "Sơn gel cơ bản",
    tech: "Hà",
    status: "CHECKED_IN",
  },
  {
    id: "a2",
    time: "10:30",
    customer: "Trang",
    service: "Pedicure",
    tech: "Mai",
    status: "IN_PROGRESS",
  },
  {
    id: "a3",
    time: "11:15",
    customer: "Nhi",
    service: "Combo Spa",
    tech: "Hà",
    status: "BOOKED",
  },
];

export const team = [
  { name: "Ngô Trung Đức", role: "OWNER" as Role },
  { name: "Lễ tân 1", role: "RECEPTION" as Role },
  { name: "Hà", role: "TECH" as Role },
  { name: "Mai", role: "TECH" as Role },
];

export function formatVnd(n: number) {
  return `${new Intl.NumberFormat("vi-VN").format(n)}đ`;
}
