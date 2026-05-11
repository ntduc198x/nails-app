import { createAppSession, recoverFromInvalidAuthState } from "@/lib/app-session";
import { getDeviceFingerprint, getDeviceInfo } from "@/lib/device-fingerprint";
import { supabase } from "@/lib/supabase";
import {
  consumeInviteCodeWithClient,
  getAuthenticatedUserSummary,
  isCustomerRole,
  type AuthenticatedUserSummary,
} from "@nails/shared";

export function buildAuthCallbackUrl(next = "/") {
  if (typeof window === "undefined") {
    return undefined;
  }

  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("next", next);
  return url.toString();
}

export async function ensureCustomerMetadata() {
  if (!supabase) {
    throw new Error("Thiếu cấu hình Supabase.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const displayName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name.trim()
        : typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name.trim()
          : "";

  const nextData = {
    registration_mode: "USER",
    ...(displayName
      ? {
          display_name: displayName,
          full_name: displayName,
        }
      : {}),
  };

  const alreadyHasMode = user.user_metadata?.registration_mode === "USER";
  const alreadyHasDisplayName = !displayName || user.user_metadata?.display_name === displayName;
  if (alreadyHasMode && alreadyHasDisplayName) {
    return;
  }

  const { error } = await supabase.auth.updateUser({ data: nextData });
  if (error) {
    throw error;
  }
}

export async function bootstrapAuthenticatedBrowserUser(): Promise<AuthenticatedUserSummary> {
  if (!supabase) {
    throw new Error("Thiếu cấu hình Supabase.");
  }

  const summary = await getAuthenticatedUserSummary(supabase);
  if (!summary) {
    throw new Error("Không tìm thấy tài khoản sau khi xác thực.");
  }

  const sessionResult = await createAppSession();
  if (!sessionResult.success && sessionResult.error !== "APP_SESSION_RPC_UNAVAILABLE") {
    throw new Error(sessionResult.message || sessionResult.error || "Không tạo được app session.");
  }

  return summary;
}

export function getPostAuthRedirectPath(summary: AuthenticatedUserSummary, nextPath?: string | null) {
  if (!isCustomerRole(summary.role)) {
    return "/manage";
  }

  if (nextPath && nextPath.startsWith("/")) {
    return nextPath;
  }

  return "/";
}

export async function signInWithEmailPassword(input: { email: string; password: string }) {
  if (!supabase) {
    throw new Error("Thiếu cấu hình Supabase.");
  }

  await recoverFromInvalidAuthState();

  const { error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });

  if (error) {
    throw error;
  }

  return bootstrapAuthenticatedBrowserUser();
}

export async function signUpWithRole(input: {
  email: string;
  password: string;
  name: string;
  inviteCode?: string;
  registrationMode: "USER" | "ADMIN";
}) {
  if (!supabase) {
    throw new Error("Thiếu cấu hình Supabase.");
  }

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        display_name: input.name.trim(),
        registration_mode: input.registrationMode,
      },
    },
  });

  if (error) {
    throw error;
  }

  const userId = data.user?.id;
  if (!userId) {
    throw new Error("Không tạo được tài khoản mới.");
  }

  if (input.registrationMode === "ADMIN") {
    const inviteCode = input.inviteCode?.trim().toUpperCase();
    if (!inviteCode) {
      await supabase.auth.signOut();
      throw new Error("Vui lòng nhập mã mời quản trị.");
    }

    try {
      await consumeInviteCodeWithClient(supabase, {
        code: inviteCode,
        userId,
        displayName: input.name.trim(),
      });
    } catch (error) {
      await supabase.auth.signOut();
      throw error;
    }
  }

  if (data.session?.user) {
    return bootstrapAuthenticatedBrowserUser();
  }

  return null;
}

export async function signInWithGoogleCustomer(nextPath = "/") {
  if (!supabase) {
    throw new Error("Thiếu cấu hình Supabase.");
  }

  const redirectTo = buildAuthCallbackUrl(nextPath);
  console.log("[Auth] signInWithGoogleCustomer redirectTo:", redirectTo);

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    console.error("[Auth] signInWithOAuth error:", error);
    throw error;
  }
}

export async function completeGoogleAuthFromCode(nextPath?: string | null) {
  if (!supabase) {
    throw new Error("Thiếu cấu hình Supabase.");
  }

  const currentUrl = typeof window !== "undefined" ? window.location.href : undefined;
  if (!currentUrl) {
    throw new Error("Không xác định được URL callback.");
  }

  console.log("[Auth] Callback URL:", currentUrl);
  console.log("[Auth] Search:", window.location.search);
  console.log("[Auth] Hash:", window.location.hash);

  const url = new URL(currentUrl);

  // Check for error from OAuth provider
  const errorParam = url.searchParams.get("error");
  if (errorParam) {
    const errorDesc = url.searchParams.get("error_description") || errorParam;
    console.error("[Auth] OAuth error:", errorParam, errorDesc);
    throw new Error(`Lỗi OAuth: ${errorDesc}`);
  }

  // Try to find code in query params first
  let code = url.searchParams.get("code");
  let accessToken = url.hash.includes("access_token=") ? 
    url.hash.split("access_token=")[1]?.split("&")[0] : null;

  console.log("[Auth] Found code:", code ? "yes: " + code.substring(0, 20) + "..." : "no");
  console.log("[Auth] Found fragment token:", accessToken ? "yes: " + accessToken.substring(0, 20) + "..." : "no");

  if (!code && !accessToken) {
    // Check if Supabase stored the session via detectSessionInUrl
    console.log("[Auth] No code/token found, checking Supabase session...");
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      console.log("[Auth] Session found in storage:", sessionData.session.user?.email);
      await ensureCustomerMetadata();
      const summary = await bootstrapAuthenticatedBrowserUser();
      return {
        summary,
        redirectPath: getPostAuthRedirectPath(summary, nextPath),
      };
    }
    throw new Error("Thiếu mã xác thực từ Google.");
  }

  // For code-based flow, exchange code for session
  if (code) {
    console.log("[Auth] Exchanging code for session...");
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[Auth] Code exchange error:", error);
      throw error;
    }
    console.log("[Auth] Code exchange successful");
  }

  await ensureCustomerMetadata();
  const summary = await bootstrapAuthenticatedBrowserUser();
  return {
    summary,
    redirectPath: getPostAuthRedirectPath(summary, nextPath),
  };
}

export async function requestBrowserPasswordReset(email: string) {
  if (!supabase) {
    throw new Error("Thiếu cấu hình Supabase.");
  }

  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) {
    throw error;
  }
}

export async function getCurrentAuthenticatedSummary() {
  if (!supabase) {
    return null;
  }

  try {
    return await getAuthenticatedUserSummary(supabase);
  } catch {
    return null;
  }
}

export async function createBrowserSessionPreview() {
  if (!supabase) {
    return null;
  }

  const fingerprint = await getDeviceFingerprint();
  const deviceInfo = await getDeviceInfo();

  return {
    fingerprint,
    deviceInfo,
  };
}
