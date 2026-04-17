import type { AppRole } from "@/lib/auth";

export const ROLE_LABELS: Record<AppRole, string> = {
  OWNER: "BOSS",
  MANAGER: "Quản lý",
  RECEPTION: "Lễ tân",
  ACCOUNTANT: "Kế toán",
  TECH: "Kỹ thuật viên",
};

export function getRoleLabel(role: AppRole | string | null | undefined) {
  if (!role) return "-";
  return ROLE_LABELS[role as AppRole] ?? String(role);
}
