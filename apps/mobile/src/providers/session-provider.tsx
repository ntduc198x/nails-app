import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Platform } from "react-native";
import { router } from "expo-router";
import type {
  AppRole,
  AppSessionResult,
  AppSessionValidation,
  AuthenticatedUserSummary,
  InviteCodeConsumptionResult,
} from "@nails/shared";
import {
  consumeInviteCodeWithClient,
  createAppSessionWithDevice,
  getAuthenticatedUserSummary,
  isCustomerRole,
  revokeAppSessionToken,
  validateAppSessionToken,
} from "@nails/shared";
import { clearStoredAppSessionToken, getStoredAppSessionToken, setStoredAppSessionToken } from "@/src/lib/app-session";
import { premiumTheme } from "@/src/design/premium-theme";
import { getMobileDeviceFingerprint, getMobileDeviceInfo } from "@/src/lib/device";
import { mobileEnv } from "@/src/lib/env";
import { mobileSupabase } from "@/src/lib/supabase";

const SESSION_BOOT_TIMEOUT_MS = 3000;
const OAUTH_CALLBACK_PATH = "auth/callback";
const { colors, radius, spacing, shadow } = premiumTheme;

WebBrowser.maybeCompleteAuthSession();

type SessionContextValue = {
  isHydrated: boolean;
  isBusy: boolean;
  role: AppRole | null;
  user: AuthenticatedUserSummary | null;
  appSession: AppSessionValidation | null;
  error: string | null;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signUp: (input: {
    email: string;
    password: string;
    name: string;
    inviteCode?: string;
    registrationMode: "USER" | "ADMIN";
  }) => Promise<InviteCodeConsumptionResult | null>;
  requestPasswordReset: (email: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

const defaultSessionContextValue: SessionContextValue = {
  isHydrated: false,
  isBusy: false,
  role: null,
  user: null,
  appSession: null,
  error: null,
  async signIn() {
    throw new Error("Mobile session provider chua san sang.");
  },
  async signInWithGoogle() {
    throw new Error("Mobile session provider chua san sang.");
  },
  async signInWithApple() {
    throw new Error("Mobile session provider chua san sang.");
  },
  async signUp() {
    throw new Error("Mobile session provider chua san sang.");
  },
  async requestPasswordReset() {
    throw new Error("Mobile session provider chua san sang.");
  },
  async refreshSession() {
    throw new Error("Mobile session provider chua san sang.");
  },
  async signOut() {
    return;
  },
  clearError() {},
};

const SessionContext = createContext<SessionContextValue>(defaultSessionContextValue);

function getPostAuthHref(role: AppRole | null | undefined) {
  return isCustomerRole(role) ? "/(customer)" : "/(admin)";
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T) {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(fallbackValue), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function withSessionTimeout<T>(promise: Promise<T>, fallbackValue: T) {
  return withTimeout(promise, SESSION_BOOT_TIMEOUT_MS, fallbackValue);
}

function buildAuthRedirectUrl() {
  return AuthSession.makeRedirectUri({
    path: OAUTH_CALLBACK_PATH,
  });
}

function buildNativeAppRedirectUrl() {
  return Linking.createURL(OAUTH_CALLBACK_PATH, { scheme: "nails-app" });
}

function shouldUseNativeOAuthRedirect() {
  return Constants.executionEnvironment !== "storeClient";
}

function buildGoogleOAuthRedirectUrl() {
  return shouldUseNativeOAuthRedirect() ? buildNativeAppRedirectUrl() : buildAuthRedirectUrl();
}

function getGoogleOAuthModeLabel() {
  return shouldUseNativeOAuthRedirect() ? "native-dev-build" : "expo-go";
}

function buildSupabaseCallbackUrl() {
  if (mobileEnv.supabaseUrl) {
    const baseUrl = mobileEnv.supabaseUrl.replace(/\/$/, "");
    return `${baseUrl}/auth/v1/callback`;
  }
  return buildAuthRedirectUrl();
}

function readAuthParams(url: string) {
  const queryStart = url.indexOf("?");
  const hashStart = url.indexOf("#");
  const query = queryStart === -1 ? "" : url.substring(queryStart + 1, hashStart === -1 ? undefined : hashStart);
  const hash = hashStart === -1 ? "" : url.substring(hashStart + 1);
  const queryParams = new URLSearchParams(query);
  const hashParams = new URLSearchParams(hash);

  return {
    code: queryParams.get("code"),
    accessToken: hashParams.get("access_token") ?? queryParams.get("access_token"),
    refreshToken: hashParams.get("refresh_token") ?? queryParams.get("refresh_token"),
    expiresIn: hashParams.get("expires_in") ?? queryParams.get("expires_in"),
    expiresAt: hashParams.get("expires_at") ?? queryParams.get("expires_at"),
    providerToken: hashParams.get("provider_token") ?? queryParams.get("provider_token"),
    providerRefreshToken: hashParams.get("provider_refresh_token") ?? queryParams.get("provider_refresh_token"),
  };
}

function isWebOAuthFallbackUrl(url: string | null | undefined) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

function isOAuthCallbackUrl(url: string | null | undefined) {
  if (!url) return false;
  if (isWebOAuthFallbackUrl(url)) {
    return false;
  }
  const redirectCandidates = [buildAuthRedirectUrl(), buildNativeAppRedirectUrl()];
  if (
    redirectCandidates.some(
      (candidate) => url.startsWith(candidate.split(OAUTH_CALLBACK_PATH)[0]) && url.includes(OAUTH_CALLBACK_PATH),
    )
  ) {
    return true;
  }
  const hasAccessToken = url.includes("access_token=");
  const hasRefreshToken = url.includes("refresh_token=");
  const hasCode = url.includes("code=");
  const hasError = url.includes("error=");
  if ((hasAccessToken && hasRefreshToken) || (hasCode && !hasError)) {
    return true;
  }
  if (url.includes("/auth/callback")) {
    return true;
  }
  return false;
}

function buildDisplayNameFromApple(credential: AppleAuthentication.AppleAuthenticationCredential) {
  const givenName = credential.fullName?.givenName?.trim();
  const familyName = credential.fullName?.familyName?.trim();
  return [givenName, familyName].filter(Boolean).join(" ").trim();
}

async function ensureCustomerUserMetadata() {
  if (!mobileSupabase) {
    return;
  }

  const {
    data: { user },
  } = await mobileSupabase.auth.getUser();

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

  const hasRegistrationMode = user.user_metadata?.registration_mode === "USER";
  const hasDisplayName = !displayName || user.user_metadata?.display_name === displayName;

  if (hasRegistrationMode && hasDisplayName) {
    return;
  }

  const { error } = await mobileSupabase.auth.updateUser({ data: nextData });
  if (error) {
    throw error;
  }
}

function isRecoverableMobileSessionErrorMessage(message: string | null | undefined) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("app_session_rpc_unavailable") ||
    normalized.includes("ensure_default_workspace") ||
    normalized.includes("ensure_current_user_profile") ||
    normalized.includes("create_app_session") ||
    normalized.includes("validate_app_session") ||
    normalized.includes("heartbeat_online_user") ||
    normalized.includes("user_not_bound_to_org") ||
    normalized.includes("customer_account") ||
    (normalized.includes("does not exist") && normalized.includes("function public."))
  );
}

function buildBasicMobileAppSession(userId: string): AppSessionValidation {
  return {
    valid: true,
    userId,
    message: "APP_SESSION_FALLBACK",
  };
}

async function getMobileAuthenticatedUserSummary(): Promise<AuthenticatedUserSummary | null> {
  if (!mobileSupabase) {
    return null;
  }

  try {
    const summary = await getAuthenticatedUserSummary(mobileSupabase);
    if (summary) {
      return summary;
    }
  } catch {
    // Customer users should resolve primarily through customer_accounts.
    // profiles is reserved for internal/admin/staff and only used as legacy fallback data.
  }

  const {
    data: { user: authUser },
    error: authError,
  } = await mobileSupabase.auth.getUser();

  if (authError || !authUser) {
    return null;
  }

  const { data: customerAccount, error: customerAccountError } = await mobileSupabase
    .from("customer_accounts")
    .select("id, customer_id, org_id")
    .eq("user_id", authUser.id)
    .maybeSingle();

  const profile = null as { display_name?: string | null; email?: string | null; phone?: string | null } | null;

  let customer: { full_name?: string | null; name?: string | null; email?: string | null; phone?: string | null } | null = null;
  if (customerAccount?.customer_id) {
    const { data: customerData } = await mobileSupabase
      .from("customers")
      .select("full_name,name,email,phone")
      .eq("id", customerAccount.customer_id)
      .eq("org_id", customerAccount.org_id)
      .maybeSingle();
    customer = customerData ?? null;
  }

  if (customerAccountError && customerAccountError.code !== "PGRST116") {
    return {
      id: authUser.id,
      email: customer?.email || profile?.email || authUser.email || "",
      displayName:
        (typeof customer?.full_name === "string" && customer.full_name.trim()) ||
        (typeof customer?.name === "string" && customer.name.trim()) ||
        (typeof profile?.display_name === "string" && profile.display_name.trim()) ||
        (typeof authUser.user_metadata?.display_name === "string" && authUser.user_metadata.display_name.trim()) ||
        (typeof authUser.user_metadata?.full_name === "string" && authUser.user_metadata.full_name.trim()) ||
        authUser.email?.split("@")[0] ||
        "Khách hàng",
      role: "USER" as AppRole,
    } satisfies AuthenticatedUserSummary;
  }

  if (!customerAccount) {
    return {
      id: authUser.id,
      email: customer?.email || profile?.email || authUser.email || "",
      displayName:
        (typeof customer?.full_name === "string" && customer.full_name.trim()) ||
        (typeof customer?.name === "string" && customer.name.trim()) ||
        (typeof profile?.display_name === "string" && profile.display_name.trim()) ||
        (typeof authUser.user_metadata?.display_name === "string" && authUser.user_metadata.display_name.trim()) ||
        (typeof authUser.user_metadata?.full_name === "string" && authUser.user_metadata.full_name.trim()) ||
        authUser.email?.split("@")[0] ||
        "Khách hàng",
      role: "USER" as AppRole,
    } satisfies AuthenticatedUserSummary;
  }

  const displayName =
    typeof customer?.full_name === "string" && customer.full_name.trim()
      ? customer.full_name.trim()
      : typeof customer?.name === "string" && customer.name.trim()
        ? customer.name.trim()
        : typeof profile?.display_name === "string" && profile.display_name.trim()
          ? profile.display_name.trim()
          : typeof authUser.user_metadata?.display_name === "string" && authUser.user_metadata.display_name.trim()
            ? authUser.user_metadata.display_name.trim()
            : typeof authUser.user_metadata?.full_name === "string" && authUser.user_metadata.full_name.trim()
              ? authUser.user_metadata.full_name.trim()
              : authUser.email?.split("@")[0] ?? "Khách hàng";

  return {
    id: authUser.id,
    email: customer?.email || profile?.email || authUser.email || "",
    displayName,
    role: "USER" as AppRole,
  } satisfies AuthenticatedUserSummary;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [role, setRoleState] = useState<AppRole | null>(null);
  const [user, setUser] = useState<AuthenticatedUserSummary | null>(null);
  const [appSession, setAppSession] = useState<AppSessionValidation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const authFinalizePromiseRef = useRef<Promise<AuthenticatedUserSummary | null> | null>(null);
  const handledOAuthUrlsRef = useRef<Set<string>>(new Set());
  const lastPostAuthHrefRef = useRef<string | null>(null);
  const isSigningOutRef = useRef(false);

  const hydrateAfterAuth = useCallback(async () => {
    if (!mobileSupabase) {
      throw new Error("Thieu cau hinh Supabase mobile.");
    }

    const summary = await getMobileAuthenticatedUserSummary();
    if (!summary) {
      throw new Error("Khong tim thay user sau khi dang nhap.");
    }

    setUser(summary);
    setRoleState(summary.role);

    const sessionResult = await withSessionTimeout(
      createAppSessionWithDevice(mobileSupabase, {
        userId: summary.id,
        deviceFingerprint: await getMobileDeviceFingerprint(),
        deviceInfo: await getMobileDeviceInfo(),
      }),
      {
        success: false,
        error: "App session mobile dang khoi tao cham. Tiep tuc vao app voi che do co ban.",
      } satisfies AppSessionResult,
    );

    if (!sessionResult.success || !sessionResult.token) {
      if (isRecoverableMobileSessionErrorMessage(sessionResult.message || sessionResult.error)) {
        setAppSession(buildBasicMobileAppSession(summary.id));
        setError(null);
        return;
      }

      setAppSession({
        valid: false,
        reason: "INVALID_TOKEN",
        message: sessionResult.message || sessionResult.error || "Khong tao duoc app session tren mobile.",
      });
      setError(sessionResult.message || sessionResult.error || "Khong tao duoc app session tren mobile.");
      return;
    }

    await setStoredAppSessionToken(sessionResult.token);
    const validation = await withSessionTimeout(validateAppSessionToken(mobileSupabase, sessionResult.token), {
      valid: true,
      userId: summary.id,
    } satisfies AppSessionValidation);

    if (!validation.valid && isRecoverableMobileSessionErrorMessage(validation.message)) {
      setAppSession(buildBasicMobileAppSession(summary.id));
      setError(null);
      return;
    }

    setAppSession(validation);
    setError(null);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!mobileSupabase) {
      throw new Error("Thieu cau hinh Supabase mobile.");
    }

    const summary = await getMobileAuthenticatedUserSummary();
    setUser(summary);
    setRoleState(summary?.role ?? null);
    setError(null);
  }, []);

  const finalizePostAuthRedirect = useCallback(async (fallbackRole: AppRole = "USER") => {
    if (isSigningOutRef.current) {
      return null;
    }

    if (authFinalizePromiseRef.current) {
      return authFinalizePromiseRef.current;
    }

    const finalizePromise = (async () => {
      try {
        await ensureCustomerUserMetadata();
      } catch (metadataError) {
      }

      await hydrateAfterAuth();
      const summary = await getMobileAuthenticatedUserSummary();
      const nextRole = summary?.role ?? fallbackRole;
      lastPostAuthHrefRef.current = getPostAuthHref(nextRole);
      return summary;
    })();

    authFinalizePromiseRef.current = finalizePromise;

    try {
      return await finalizePromise;
    } finally {
      authFinalizePromiseRef.current = null;
    }
  }, [hydrateAfterAuth]);

  const completeOAuthUrl = useCallback(
    async (url: string) => {
      console.log("[Auth] completeOAuthUrl received:", url);

      if (handledOAuthUrlsRef.current.has(url)) {
        console.log("[Auth] completeOAuthUrl skipped duplicate callback");
        return true;
      }

      if (!mobileSupabase) {
        return false;
      }

      if (isWebOAuthFallbackUrl(url)) {
        console.warn("[Auth] OAuth callback fell back to web URL:", url);
        throw new Error(
          "Google dang tra callback ve web URL thay vi mobile app. Kiem tra Supabase Redirect URLs cho mode Expo hien tai.",
        );
      }

      if (!isOAuthCallbackUrl(url)) {
        console.warn("[Auth] URL is not recognized as a mobile OAuth callback");
        return false;
      }

      const { code, accessToken, refreshToken } = readAuthParams(url);
      console.log("[Auth] OAuth params detected:", {
        hasCode: Boolean(code),
        hasAccessToken: Boolean(accessToken),
        hasRefreshToken: Boolean(refreshToken),
      });

      if (code) {
        const { error: exchangeError } = await mobileSupabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          throw exchangeError;
        }
      } else if (accessToken && refreshToken) {
        const { error: setSessionError } = await mobileSupabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (setSessionError) {
          throw setSessionError;
        }
      } else {
        const { data: sessionData } = await mobileSupabase.auth.getSession();
        if (sessionData?.session) {
        } else {
          return false;
        }
      }

      await finalizePostAuthRedirect("USER");
      handledOAuthUrlsRef.current.add(url);
      console.log("[Auth] OAuth callback finalized successfully");
      return true;
    },
    [finalizePostAuthRedirect],
  );

  useEffect(() => {
    let mounted = true;

    async function hydrateSession() {
      if (!mobileSupabase) {
        if (mounted) {
          setError("Thieu cau hinh Supabase mobile.");
          setIsHydrated(true);
        }
        return;
      }

      setIsBusy(true);

      try {
        const summary = await withTimeout(
          getMobileAuthenticatedUserSummary(),
          SESSION_BOOT_TIMEOUT_MS,
          null,
        );
        if (!mounted) return;

        if (!summary) {
          setUser(null);
          setRoleState(null);
          setAppSession(null);
          await clearStoredAppSessionToken();
          setError(null);
          return;
        }

        setUser(summary);
        setRoleState(summary.role);

        const existingToken = await getStoredAppSessionToken();
        let nextValidation: AppSessionValidation | null = null;

        if (existingToken) {
          nextValidation = await withSessionTimeout(
            validateAppSessionToken(mobileSupabase, existingToken),
            { valid: false, reason: "INVALID_TOKEN" } satisfies AppSessionValidation,
          );
          if (!nextValidation.valid && !isRecoverableMobileSessionErrorMessage(nextValidation.message)) {
            await clearStoredAppSessionToken();
          }
        }

        if (!nextValidation?.valid) {
          const sessionResult = await withSessionTimeout(
            createAppSessionWithDevice(mobileSupabase, {
              userId: summary.id,
              deviceFingerprint: await getMobileDeviceFingerprint(),
              deviceInfo: await getMobileDeviceInfo(),
            }),
            {
              success: false,
              error: "App session mobile dang khoi tao cham. Tiep tuc vao app voi che do co ban.",
            } satisfies AppSessionResult,
          );

          if (sessionResult.success && sessionResult.token) {
            await setStoredAppSessionToken(sessionResult.token);
            nextValidation = await withSessionTimeout(
              validateAppSessionToken(mobileSupabase, sessionResult.token),
              {
                valid: true,
                userId: summary.id,
              } satisfies AppSessionValidation,
            );
          } else if (isRecoverableMobileSessionErrorMessage(sessionResult.message || sessionResult.error)) {
            nextValidation = buildBasicMobileAppSession(summary.id);
          } else {
            nextValidation = {
              valid: false,
              reason: "INVALID_TOKEN",
              message: sessionResult.message || sessionResult.error || "Khong tao duoc app session tren mobile.",
            };
          }
        }

        if (!mounted) return;
        if (!nextValidation.valid && isRecoverableMobileSessionErrorMessage(nextValidation.message)) {
          nextValidation = buildBasicMobileAppSession(summary.id);
        }
        setAppSession(nextValidation);
        setError(nextValidation.valid ? null : nextValidation.message ?? null);
      } catch (nextError) {
        if (!mounted) return;
        setUser(null);
        setRoleState(null);
        setAppSession(null);
        setError(nextError instanceof Error ? nextError.message : "Khoi tao session mobile that bai.");
      } finally {
        if (mounted) {
          setIsBusy(false);
          setIsHydrated(true);
        }
      }
    }

    void hydrateSession();
    void Linking.getInitialURL()
      .then((initialUrl) => {
        if (!mounted || !initialUrl) return;
        return completeOAuthUrl(initialUrl).catch((nextError) => {
          if (!mounted) return;
          setError(nextError instanceof Error ? nextError.message : "Hoan tat dang nhap mang xa hoi that bai.");
        });
      })
      .catch(() => undefined);

    const authListener = mobileSupabase?.auth.onAuthStateChange((_event, session) => {
      if (!mounted || session?.user) return;
      setUser(null);
      setRoleState(null);
      setAppSession(null);
    });

    const linkingSubscription = Linking.addEventListener("url", ({ url }) => {
      void completeOAuthUrl(url).catch((nextError) => {
        if (!mounted) return;
        setError(nextError instanceof Error ? nextError.message : "Hoan tat dang nhap mang xa hoi that bai.");
      });
    });

    return () => {
      mounted = false;
      authListener?.data.subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, [completeOAuthUrl]);

  async function signIn(input: { email: string; password: string }) {
    if (!mobileSupabase) {
      throw new Error("Thieu cau hinh Supabase mobile.");
    }

    isSigningOutRef.current = false;
    setIsBusy(true);
    setError(null);

    try {
      const { error: signInError } = await mobileSupabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

      if (signInError) {
        throw signInError;
      }

      await finalizePostAuthRedirect("USER");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Dang nhap that bai.");
      throw nextError;
    } finally {
      setIsBusy(false);
    }
  }

  async function signInWithGoogle() {
    if (!mobileSupabase) {
      throw new Error("Thieu cau hinh Supabase mobile.");
    }

    isSigningOutRef.current = false;
    setIsBusy(true);
    setError(null);

    try {
      const appCallbackUrl = buildGoogleOAuthRedirectUrl();
      console.log("[Auth] Google OAuth mode:", getGoogleOAuthModeLabel());
      console.log("[Auth] Google OAuth redirectTo:", appCallbackUrl);

      const { data, error: oauthError } = await mobileSupabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: appCallbackUrl,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (oauthError) {
        throw oauthError;
      }

      if (!data?.url) {
        throw new Error("Khong tao duoc duong dan dang nhap Google.");
      }

      console.log("[Auth] Google OAuth authorize URL:", data.url);
      const result = await WebBrowser.openAuthSessionAsync(data.url, appCallbackUrl);
      console.log("[Auth] Google OAuth browser result:", result.type);

      if (result.type === "cancel" || result.type === "dismiss") {
        console.warn("[Auth] Google OAuth was cancelled or dismissed by the user");
        return;
      }

      if (result.type !== "success" || !result.url) {
        throw new Error("Khong hoan tat duoc dang nhap Google.");
      }

      const resultUrl = (result as { url: string }).url;
      console.log("[Auth] Google OAuth callback URL:", resultUrl);

      if (isWebOAuthFallbackUrl(resultUrl)) {
        throw new Error(
          "Google dang quay ve web URL thay vi mobile callback. Kiem tra Supabase Redirect URLs cho Expo Go va dev build.",
        );
      }

      if (resultUrl.includes("#access_token=")) {
        const params = readAuthParams(resultUrl);
        if (params.accessToken && params.refreshToken) {
          const { error: setError } = await mobileSupabase.auth.setSession({
            access_token: params.accessToken,
            refresh_token: params.refreshToken,
          });
          if (setError) {
            throw setError;
          }
          await finalizePostAuthRedirect("USER");
        }
      } else {
        const completed = await completeOAuthUrl(resultUrl);
        if (!completed) {
          const { data: sessionData } = await mobileSupabase.auth.getSession();
          if (sessionData?.session) {
            await finalizePostAuthRedirect("USER");
          } else {
            throw new Error("Google da xac thuc nhung app chua nhan duoc callback hop le.");
          }
        }
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Dang nhap Google that bai.");
      throw nextError;
    } finally {
      setIsBusy(false);
    }
  }

  async function signInWithApple() {
    if (!mobileSupabase) {
      throw new Error("Thieu cau hinh Supabase mobile.");
    }

    if (Platform.OS !== "ios") {
      throw new Error("Apple ID chi ho tro tren iOS.");
    }

    isSigningOutRef.current = false;
    setIsBusy(true);
    setError(null);

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error("Apple khong tra ve identity token.");
      }

      const { error: authError } = await mobileSupabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });

      if (authError) {
        throw authError;
      }

      const displayName = buildDisplayNameFromApple(credential);
      const { error: updateError } = await mobileSupabase.auth.updateUser({
        data: {
          registration_mode: "USER",
          ...(displayName
            ? {
                display_name: displayName,
                full_name: displayName,
                given_name: credential.fullName?.givenName ?? null,
                family_name: credential.fullName?.familyName ?? null,
              }
            : {}),
        },
      });

      if (updateError) {
        throw updateError;
      }

      await finalizePostAuthRedirect("USER");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Dang nhap Apple that bai.");
      throw nextError;
    } finally {
      setIsBusy(false);
    }
  }

  async function signUp(input: {
    email: string;
    password: string;
    name: string;
    inviteCode?: string;
    registrationMode: "USER" | "ADMIN";
  }) {
    if (!mobileSupabase) {
      throw new Error("Thieu cau hinh Supabase mobile.");
    }

    isSigningOutRef.current = false;
    setIsBusy(true);
    setError(null);

    try {
      const { data, error: signUpError } = await mobileSupabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            display_name: input.name.trim(),
            registration_mode: input.registrationMode,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      const userId = data.user?.id;
      if (!userId) {
        throw new Error("Khong tao duoc tai khoan moi.");
      }

      let inviteResult: InviteCodeConsumptionResult | null = null;

      if (input.registrationMode === "ADMIN") {
        const nextInviteCode = input.inviteCode?.trim().toUpperCase();
        if (!nextInviteCode) {
          throw new Error("Nhap ma moi de tao tai khoan quan tri.");
        }

        inviteResult = await consumeInviteCodeWithClient(mobileSupabase, {
          code: nextInviteCode,
          userId,
          displayName: input.name.trim(),
        });
      }

      if (data.session?.user) {
        await hydrateAfterAuth();
        router.replace(input.registrationMode === "USER" ? "/(customer)/(tabs)" : "/(admin)/(tabs)");
      }
      return inviteResult;
    } catch (nextError) {
      await mobileSupabase.auth.signOut();
      setError(nextError instanceof Error ? nextError.message : "Dang ky that bai.");
      throw nextError;
    } finally {
      setIsBusy(false);
    }
  }

  async function requestPasswordReset(email: string) {
    if (!mobileSupabase) {
      throw new Error("Thieu cau hinh Supabase mobile.");
    }

    setIsBusy(true);
    setError(null);

    try {
      const resetRedirectUrl =
        mobileEnv.passwordResetUrl ||
        (mobileEnv.apiBaseUrl ? `${mobileEnv.apiBaseUrl.replace(/\/$/, "")}/reset-password` : buildNativeAppRedirectUrl());
      const { error: resetError } = await mobileSupabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: resetRedirectUrl,
      });

      if (resetError) {
        throw resetError;
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Gui reset password that bai.");
      throw nextError;
    } finally {
      setIsBusy(false);
    }
  }

  async function signOut() {
    if (!mobileSupabase) {
      return;
    }

    isSigningOutRef.current = true;
    authFinalizePromiseRef.current = null;
    setIsBusy(true);

    try {
      await revokeAppSessionToken(mobileSupabase, await getStoredAppSessionToken());
      await clearStoredAppSessionToken();
      await mobileSupabase.auth.signOut();
      lastPostAuthHrefRef.current = null;
      handledOAuthUrlsRef.current.clear();
      setUser(null);
      setRoleState(null);
      setAppSession(null);
      setError(null);
      router.replace("/(auth)/sign-in");
    } finally {
      setIsBusy(false);
    }
  }

  function clearError() {
    setError(null);
  }

  const value = {
    isHydrated,
    isBusy,
    role,
    user,
    appSession,
    error,
    signIn,
    signInWithGoogle,
    signInWithApple,
    signUp,
    requestPasswordReset,
    refreshSession,
    signOut,
    clearError,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

export function SessionActions() {
  const { appSession, isBusy, role, signOut, user } = useSession();

  async function handleReset() {
    await signOut();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.caption}>Tai khoan hien tai</Text>
      <Text style={styles.value}>{user?.email ?? "Chua co session"}</Text>
      <Text style={styles.value}>
        {role ? `Vai tro: ${role}${isCustomerRole(role) ? " (customer)" : " (admin)"}` : "Vai tro chua san sang"}
      </Text>
      <Text style={styles.value}>{appSession?.valid ? "App session: OK" : "App session: chua co"}</Text>
      <Pressable style={styles.button} disabled={isBusy} onPress={handleReset}>
        <Text style={styles.buttonText}>{isBusy ? "Dang xu ly..." : "Dang xuat"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  caption: {
    color: colors.accentWarm,
    fontSize: 12,
    textTransform: "uppercase",
    fontWeight: "800",
    letterSpacing: 1,
  },
  value: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  button: {
    marginTop: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "800",
  },
});
