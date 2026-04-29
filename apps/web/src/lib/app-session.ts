import { supabase } from "@/lib/supabase";
import { getDeviceFingerprint, getDeviceInfo } from "@/lib/device-fingerprint";

const SESSION_TOKEN_KEY = "nails_session_token";

function isInvalidRefreshTokenMessage(message: string | undefined) {
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("invalid refresh token") || normalized.includes("refresh token not found");
}

async function clearSupabaseBrowserSession() {
  if (!supabase) return;
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Best effort: we only need browser storage cleared.
  }
}

export interface AppSessionResult {
  success: boolean;
  token?: string;
  error?: string;
  message?: string;
  replacedUserId?: string | null;
  replacedOwnerName?: string | null;
}

export interface AppSessionValidation {
  valid: boolean;
  reason?: "INVALID_TOKEN" | "SESSION_REPLACED" | "DEVICE_TAKEN" | "USER_SWITCHED";
  message?: string;
  ownerName?: string | null;
  userId?: string;
  deviceFingerprint?: string;
  deviceInfo?: unknown;
}

export function getStoredSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

export function setStoredSessionToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearStoredSessionToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_TOKEN_KEY);
}

export async function recoverFromInvalidAuthState() {
  clearStoredSessionToken();
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("nails.auth.cache");
  }
  await clearSupabaseBrowserSession();
}

export async function getSafeSupabaseSession() {
  if (!supabase) return { session: null, invalidRefreshToken: false };

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error && isInvalidRefreshTokenMessage(error.message)) {
      await recoverFromInvalidAuthState();
      return { session: null, invalidRefreshToken: true };
    }
    return { session: data.session, invalidRefreshToken: false };
  } catch (error) {
    if (error instanceof Error && isInvalidRefreshTokenMessage(error.message)) {
      await recoverFromInvalidAuthState();
      return { session: null, invalidRefreshToken: true };
    }
    throw error;
  }
}

export async function createAppSession(): Promise<AppSessionResult> {
  if (!supabase) return { success: false, error: "Supabase not configured" };

  const { session } = await getSafeSupabaseSession();
  const user = session?.user;
  if (!user) return { success: false, error: "Not authenticated" };

  const fingerprint = await getDeviceFingerprint();
  const deviceInfo = await getDeviceInfo();

  const { data, error } = await supabase.rpc("create_app_session", {
    p_user_id: user.id,
    p_device_fingerprint: fingerprint,
    p_device_info: deviceInfo,
  });

  if (error) {
    if (isInvalidRefreshTokenMessage(error.message)) {
      await recoverFromInvalidAuthState();
      return { success: false, error: error.message, message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };
    }
    return { success: false, error: error.message };
  }

  if (data?.token) {
    setStoredSessionToken(data.token);
  }

  return {
    success: Boolean(data?.success),
    token: data?.token,
    message: data?.message,
    replacedUserId: data?.replaced_user_id,
    replacedOwnerName: data?.replaced_owner_name,
  };
}

export async function validateAppSession(): Promise<AppSessionValidation> {
  if (!supabase) return { valid: false, reason: "INVALID_TOKEN" };

  const { session, invalidRefreshToken } = await getSafeSupabaseSession();
  if (invalidRefreshToken) {
    return {
      valid: false,
      reason: "INVALID_TOKEN",
      message: "Supabase refresh token is invalid.",
    };
  }

  const currentUser = session?.user;
  if (!currentUser) {
    clearStoredSessionToken();
    return { valid: false, reason: "INVALID_TOKEN" };
  }

  const token = getStoredSessionToken();
  if (!token) {
    return { valid: false, reason: "INVALID_TOKEN" };
  }

  const { data, error } = await supabase.rpc("validate_app_session", {
    p_token: token,
  });

  if (error || !data) {
    clearStoredSessionToken();
    return { valid: false, reason: "INVALID_TOKEN" };
  }

  if (!data.valid) {
    clearStoredSessionToken();
    return {
      valid: false,
      reason: data.reason,
      message: data.message,
      ownerName: data.owner_name,
    };
  }

  await supabase.rpc("heartbeat_online_user", { p_user_id: data.user_id });

  return {
    valid: true,
    userId: data.user_id,
    deviceFingerprint: data.device_fingerprint,
    deviceInfo: data.device_info,
    ownerName: data.owner_name,
  };
}

export async function revokeAppSession(): Promise<boolean> {
  if (!supabase) return false;

  const token = getStoredSessionToken();
  if (token) {
    await supabase.rpc("revoke_app_session", { p_token: token });
  }
  clearStoredSessionToken();
  return true;
}

export async function logoutWithSessionCleanup(): Promise<void> {
  if (!supabase) return;

  const { session } = await getSafeSupabaseSession();
  const userId = session?.user?.id;

  const token = getStoredSessionToken();
  if (token) {
    await supabase.rpc("revoke_app_session", { p_token: token });
  }

  if (userId) {
    await supabase.from("device_sessions").delete().eq("user_id", userId);
  }

  clearStoredSessionToken();
  await clearSupabaseBrowserSession();
}
