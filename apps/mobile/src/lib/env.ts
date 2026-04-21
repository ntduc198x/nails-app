export const mobileEnv = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  passwordResetUrl: process.env.EXPO_PUBLIC_PASSWORD_RESET_URL ?? "",
};

export function hasMobileBackendConfig() {
  return Boolean(mobileEnv.supabaseUrl && mobileEnv.supabaseAnonKey);
}
