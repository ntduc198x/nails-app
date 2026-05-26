import { supabase } from "@/lib/supabase";
import { getDeviceFingerprint, getDeviceInfo } from "@/lib/device-fingerprint";

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

type AppSessionRouteOptions = RequestInit & {
  includeAuth?: boolean;
};

type AppSessionValidationResponse = {
  valid: boolean;
  reason?: "INVALID_TOKEN" | "SESSION_REPLACED" | "DEVICE_TAKEN" | "USER_SWITCHED";
  message?: string;
  owner_name?: string | null;
  user_id?: string;
  device_fingerprint?: string;
  device_info?: unknown;
};

async function getCurrentAccessToken() {
  const { session } = await getSafeSupabaseSession();
  return session?.access_token ?? null;
}

async function callAppSessionRoute(path: string, init?: AppSessionRouteOptions) {
  const headers = new Headers(init?.headers ?? {});

  if (init?.includeAuth !== false) {
    const accessToken = await getCurrentAccessToken();
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  return fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
}

export async function recoverFromInvalidAuthState() {
  await callAppSessionRoute("/api/app-session", { method: "DELETE", includeAuth: false }).catch(() => undefined);
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
  const { session } = await getSafeSupabaseSession();
  const user = session?.user;
  if (!user) return { success: false, error: "Not authenticated" };

  const fingerprint = await getDeviceFingerprint();
  const deviceInfo = await getDeviceInfo();

  try {
    const response = await callAppSessionRoute("/api/app-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deviceFingerprint: fingerprint,
        deviceInfo,
      }),
    });
    const data = (await response.json().catch(() => null)) as
      | (AppSessionResult & { success?: boolean; replacedUserId?: string | null; replacedOwnerName?: string | null })
      | null;

    if (!response.ok || !data?.success) {
      const nextError = data?.error || "Không tạo được app session.";
      if (isInvalidRefreshTokenMessage(nextError)) {
        await recoverFromInvalidAuthState();
        return { success: false, error: nextError, message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };
      }
      return {
        success: false,
        error: nextError,
        message: data?.message,
        replacedUserId: data?.replacedUserId ?? null,
        replacedOwnerName: data?.replacedOwnerName ?? null,
      };
    }

    return {
      success: true,
      message: data.message,
      replacedUserId: data.replacedUserId ?? null,
      replacedOwnerName: data.replacedOwnerName ?? null,
    };
  } catch (error) {
    if (error instanceof Error && isInvalidRefreshTokenMessage(error.message)) {
      await recoverFromInvalidAuthState();
      return { success: false, error: error.message, message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };
    }
    return { success: false, error: "Không tạo được app session." };
  }
}

export async function validateAppSession(): Promise<AppSessionValidation> {
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
    return { valid: false, reason: "INVALID_TOKEN" };
  }

  const response = await callAppSessionRoute("/api/app-session/validate", {
    method: "POST",
  });
  const data = (await response.json().catch(() => null)) as AppSessionValidationResponse | null;
  if (!response.ok || !data) {
    return { valid: false, reason: "INVALID_TOKEN" };
  }

  if (!data.valid) {
    return {
      valid: false,
      reason: data.reason,
      message: data.message,
      ownerName: data.owner_name ?? null,
    };
  }

  if (data.user_id) {
    await supabase.rpc("heartbeat_online_user", { p_user_id: data.user_id });
  }

  return {
    valid: true,
    userId: data.user_id,
    deviceFingerprint: data.device_fingerprint,
    deviceInfo: data.device_info,
    ownerName: data.owner_name,
  };
}

export async function revokeAppSession(): Promise<boolean> {
  await callAppSessionRoute("/api/app-session", { method: "DELETE", includeAuth: false }).catch(() => undefined);
  return true;
}

export async function logoutWithSessionCleanup(): Promise<void> {
  const { session } = await getSafeSupabaseSession();
  const userId = session?.user?.id;

  if (userId) {
    await supabase.from("device_sessions").delete().eq("user_id", userId);
  }

  await callAppSessionRoute("/api/app-session", { method: "DELETE", includeAuth: false }).catch(() => undefined);
  await clearSupabaseBrowserSession();
}

export function clearStoredSessionToken(): void {}
