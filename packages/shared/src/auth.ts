export type AppRole = "USER" | "OWNER" | "PARTNER" | "MANAGER" | "RECEPTION" | "ACCOUNTANT" | "TECH";
export type RegistrationMode = "USER" | "ADMIN";

export function normalizeInviteCode(inviteCode?: string | null) {
  return inviteCode?.trim().toUpperCase() ?? "";
}

export function buildRoleSignUpAuthData(name: string) {
  return {
    display_name: name.trim(),
    registration_mode: "USER" as const,
  };
}

export function isPrivilegedRole(role: AppRole | null | undefined) {
  return role === "OWNER" || role === "PARTNER" || role === "MANAGER" || role === "RECEPTION" || role === "ACCOUNTANT" || role === "TECH";
}

export function isAdminRole(role: AppRole | null | undefined) {
  return role === "OWNER" || role === "PARTNER" || role === "MANAGER" || role === "RECEPTION" || role === "ACCOUNTANT" || role === "TECH";
}

export function isCustomerRole(role: AppRole | null | undefined) {
  return role === "USER";
}
