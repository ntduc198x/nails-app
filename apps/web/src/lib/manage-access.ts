import type { AppRole } from "@/lib/auth";

export const MANAGE_SERVICE_ROLES = ["OWNER", "PARTNER", "MANAGER"] as const;
export const MANAGE_REPORT_ROLES = ["OWNER", "PARTNER", "MANAGER", "ACCOUNTANT"] as const;
export const MANAGE_TAX_BOOK_ROLES = ["OWNER", "PARTNER", "ACCOUNTANT"] as const;

export type ManageServiceRole = (typeof MANAGE_SERVICE_ROLES)[number];
export type ManageReportRole = (typeof MANAGE_REPORT_ROLES)[number];
export type ManageTaxBookRole = (typeof MANAGE_TAX_BOOK_ROLES)[number];

export function canAccessManageServices(role: AppRole | null | undefined): role is ManageServiceRole {
  return role === "OWNER" || role === "PARTNER" || role === "MANAGER";
}

export function canAccessManageReports(role: AppRole | null | undefined): role is ManageReportRole {
  return role === "OWNER" || role === "PARTNER" || role === "MANAGER" || role === "ACCOUNTANT";
}

export function canAccessManageCustomers(role: AppRole | null | undefined): role is ManageReportRole {
  return canAccessManageReports(role);
}

export function canAccessManageTaxBooks(role: AppRole | null | undefined): role is ManageTaxBookRole {
  return role === "OWNER" || role === "PARTNER" || role === "ACCOUNTANT";
}
