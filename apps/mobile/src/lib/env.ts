import Constants from "expo-constants";

function canonicalizePublicHostname(hostname: string) {
  if (hostname === "chambeauty.io.vn" || hostname === "cham.beauty.io.vn") {
    return "www.chambeauty.io.vn";
  }
  return hostname;
}

function readRequiredValue(name: string, rawValue: string | undefined) {
  const value = rawValue?.trim() ?? "";
  if (!value) {
    throw new Error(`[mobile-env] Missing required environment variable: ${name}`);
  }
  return value;
}

function readLegacyDebuggerHost() {
  const manifest = Constants.manifest;
  if (!manifest || typeof manifest !== "object") {
    return "";
  }

  const debuggerHost = Reflect.get(manifest, "debuggerHost");
  return typeof debuggerHost === "string" ? debuggerHost : "";
}

function normalizeApiBaseUrl(rawValue: string | undefined) {
  const value = rawValue?.trim() ?? "";
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);
    parsed.hostname = canonicalizePublicHostname(parsed.hostname);
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

function normalizePublicUrl(rawValue: string | undefined) {
  const value = rawValue?.trim() ?? "";
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);
    parsed.hostname = canonicalizePublicHostname(parsed.hostname);
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
}

function deriveLocalApiBaseUrl() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    readLegacyDebuggerHost() ||
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

if (!resolvedApiBaseUrl) {
  throw new Error(
    "[mobile-env] Missing API base URL. Set EXPO_PUBLIC_API_BASE_URL or NEXT_PUBLIC_APP_URL, or run the app from an Expo local dev session that exposes hostUri.",
  );
}

export const mobileEnv = {
  supabaseUrl: readRequiredValue("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: readRequiredValue("EXPO_PUBLIC_SUPABASE_ANON_KEY", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  apiBaseUrl: resolvedApiBaseUrl,
  webApiBaseUrl:
    normalizeApiBaseUrl(process.env.EXPO_PUBLIC_WEB_API_BASE_URL) ||
    normalizeApiBaseUrl(process.env.EXPO_PUBLIC_BOOKING_API_BASE_URL) ||
    normalizeApiBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    "",
  passwordResetUrl: normalizePublicUrl(process.env.EXPO_PUBLIC_PASSWORD_RESET_URL),
  defaultOrgId: process.env.EXPO_PUBLIC_DEFAULT_ORG_ID?.trim() ?? "",
  defaultBranchId: process.env.EXPO_PUBLIC_DEFAULT_BRANCH_ID?.trim() ?? "",
};

export function hasMobileBackendConfig() {
  return Boolean(mobileEnv.supabaseUrl && mobileEnv.supabaseAnonKey);
}

export function hasDefaultOrgConfig() {
  return Boolean(mobileEnv.defaultOrgId);
}
