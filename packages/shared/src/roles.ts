import type { AppRole } from "./auth";

export const ROLE_LABELS: Record<AppRole, string> = {
  USER: "Khách hàng",
  OWNER: "BOSS",
  PARTNER: "Chủ tiệm",
  MANAGER: "Quản lý",
  RECEPTION: "Lễ tân",
  ACCOUNTANT: "Kế toán",
  TECH: "Kỹ thuật viên",
};

export function getRoleLabel(role: AppRole | string | null | undefined) {
  if (!role) return "-";
  return ROLE_LABELS[role as AppRole] ?? String(role);
}
