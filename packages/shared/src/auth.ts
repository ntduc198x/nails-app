export type AppRole = "USER" | "OWNER" | "PARTNER" | "MANAGER" | "RECEPTION" | "ACCOUNTANT" | "TECH";

export function isPrivilegedRole(role: AppRole | null | undefined) {
  return role === "OWNER" || role === "PARTNER" || role === "MANAGER" || role === "RECEPTION" || role === "ACCOUNTANT" || role === "TECH";
}

export function isAdminRole(role: AppRole | null | undefined) {
  return role === "OWNER" || role === "PARTNER" || role === "MANAGER" || role === "RECEPTION" || role === "ACCOUNTANT" || role === "TECH";
}

export function isCustomerRole(role: AppRole | null | undefined) {
  return role === "USER";
}
