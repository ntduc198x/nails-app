import type { AppRole } from "@/lib/auth";

export const MANAGE_SETUP_ROLES = ["OWNER", "PARTNER", "MANAGER", "RECEPTION"] as const;

export function canAccessManageSetup(role: AppRole | null | undefined) {
  return role === "OWNER" || role === "PARTNER" || role === "MANAGER" || role === "RECEPTION";
}
