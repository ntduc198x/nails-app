export type AppRole = "OWNER" | "MANAGER" | "RECEPTION" | "ACCOUNTANT" | "TECH";

export function isPrivilegedRole(role: AppRole | null | undefined) {
  return role === "OWNER" || role === "MANAGER" || role === "RECEPTION" || role === "ACCOUNTANT";
}

export function isAdminRole(role: AppRole | null | undefined) {
  return role === "OWNER" || role === "MANAGER";
}
