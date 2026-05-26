import type { AppRole } from "@/lib/auth";
import { canAccessManageServices } from "@/lib/manage-access";

export const LANDING_MANAGER_ROLES = ["OWNER", "PARTNER", "MANAGER"] as const;

export type LandingManagerRole = (typeof LANDING_MANAGER_ROLES)[number];

export function canAccessManageLanding(role: AppRole | null | undefined): role is LandingManagerRole {
  return role === "OWNER" || role === "PARTNER" || role === "MANAGER";
}

export function getDefaultManageHref(role: AppRole | null | undefined) {
  if (!role) return "/manage/services";
  if (canAccessManageLanding(role)) return "/manage/landing";
  if (role === "ACCOUNTANT") return "/manage/checkout";
  if (role === "RECEPTION") return "/manage/appointments";
  if (role === "TECH") return "/manage/appointments";
  if (canAccessManageServices(role)) return "/manage/services";
  return "/manage/services";
}
