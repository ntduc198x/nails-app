export const mobileEnv = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
  apiBaseUrl:
    process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ??
    process.env.NEXT_PUBLIC_APP_URL?.trim() ??
    "",
  passwordResetUrl: process.env.EXPO_PUBLIC_PASSWORD_RESET_URL?.trim() ?? "",
  defaultOrgId: process.env.EXPO_PUBLIC_DEFAULT_ORG_ID?.trim() ?? "",
  defaultBranchId: process.env.EXPO_PUBLIC_DEFAULT_BRANCH_ID?.trim() ?? "",
};

export function hasMobileBackendConfig() {
  return Boolean(mobileEnv.supabaseUrl && mobileEnv.supabaseAnonKey);
}

export function hasDefaultOrgConfig() {
  return Boolean(mobileEnv.defaultOrgId);
}
