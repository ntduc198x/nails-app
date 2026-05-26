import type { Href } from "expo-router";
import type { AppRole } from "@nails/shared";

export type AdminNavTarget = "booking" | "scheduling" | "checkout" | "profile";

type DismissibleRouter = {
  dismissTo: (href: Href) => void;
  replace: (href: Href) => void;
};

export function isOwnerRole(role: AppRole | null | undefined) {
  return role === "OWNER" || role === "PARTNER";
}

export function canSelectAdminBranch(role: AppRole | null | undefined) {
  return role === "OWNER";
}

export function canAccessManage(role: AppRole | null | undefined) {
  return isOwnerRole(role);
}

export function canAccessLandingFeed(role: AppRole | null | undefined) {
  return isOwnerRole(role) || role === "MANAGER";
}

export function getAdminProfileDestination(role: AppRole | null | undefined): Href {
  return isOwnerRole(role) ? "/manage" : "/settings";
}

export function getAdminNavHref(target: AdminNavTarget, role: AppRole | null | undefined): Href {
  switch (target) {
    case "booking":
      return canAccessLandingFeed(role) ? "/booking" : "/shifts";
    case "scheduling":
      return "/scheduling";
    case "checkout":
      return "/checkout";
    case "profile":
      return isOwnerRole(role) ? "/manage" : "/settings";
    default:
      return canAccessLandingFeed(role) ? "/booking" : "/shifts";
  }
}

export function dismissToHref(
  router: DismissibleRouter,
  href: Href,
) {
  try {
    router.dismissTo(href);
  } catch {
    router.replace(href);
  }
}
