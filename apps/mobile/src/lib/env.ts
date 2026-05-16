import Constants from "expo-constants";

function normalizeApiBaseUrl(rawValue: string | undefined) {
  const value = rawValue?.trim() ?? "";
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);
    const isExpoScheme = parsed.protocol === "exp:" || parsed.protocol === "exps:";
    const isMetroPort = parsed.port === "8081";

    if (!isExpoScheme && !isMetroPort) {
      return parsed.origin;
    }

    const nextProtocol = parsed.protocol === "exps:" ? "https:" : "http:";
    const nextHost = parsed.hostname || "localhost";
    return `${nextProtocol}//${nextHost}:3000`;
  } catch {
    return value;
  }
}

function deriveLocalApiBaseUrl() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    Constants.manifest?.debuggerHost ||
    "";

  if (!hostUri) {
    return "";
  }

  const [hostname] = hostUri.split(":");
  if (!hostname) {
    return "";
  }

  const protocol = hostUri.startsWith("https") ? "https" : "http";
  return `${protocol}://${hostname}:3000`;
}

const resolvedApiBaseUrl =
  normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL) ||
  normalizeApiBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
  deriveLocalApiBaseUrl();

export const mobileEnv = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
  apiBaseUrl: resolvedApiBaseUrl,
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
