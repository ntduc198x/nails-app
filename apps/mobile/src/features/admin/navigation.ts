import type { Href } from "expo-router";
import type { AppRole } from "@nails/shared";

export type AdminNavTarget = "booking" | "scheduling" | "checkout" | "profile";

export function isOwnerRole(role: AppRole | null | undefined) {
  return role === "OWNER";
}

export function canAccessManage(role: AppRole | null | undefined) {
  return isOwnerRole(role);
}

export function getAdminProfileDestination(role: AppRole | null | undefined): Href {
  return isOwnerRole(role) ? "/(admin)/manage" : "/(admin)/shifts";
}

export function getAdminNavHref(target: AdminNavTarget, role: AppRole | null | undefined): Href {
  switch (target) {
    case "booking":
      return "/(admin)/booking";
    case "scheduling":
      return "/(admin)/scheduling";
    case "checkout":
      return "/(admin)/checkout";
    case "profile":
      return getAdminProfileDestination(role);
    default:
      return "/(admin)/booking";
  }
}
