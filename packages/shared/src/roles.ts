import type { AppRole } from "./auth";

export const ROLE_LABELS: Record<AppRole, string> = {
  USER: "Khach hang",
  OWNER: "BOSS",
  PARTNER: "Partner",
  MANAGER: "Quan ly",
  RECEPTION: "Le tan",
  ACCOUNTANT: "Ke toan",
  TECH: "Ky thuat vien",
};

export function getRoleLabel(role: AppRole | string | null | undefined) {
  if (!role) return "-";
  return ROLE_LABELS[role as AppRole] ?? String(role);
}
