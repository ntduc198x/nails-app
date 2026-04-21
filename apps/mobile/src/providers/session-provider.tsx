import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import type {
  AppRole,
  AppSessionValidation,
  AuthenticatedUserSummary,
  InviteCodeConsumptionResult,
} from "@nails/shared";
import {
  consumeInviteCodeWithClient,
  createAppSessionWithDevice,
  getAuthenticatedUserSummary,
  revokeAppSessionToken,
  validateAppSessionToken,
} from "@nails/shared";
import { clearStoredAppSessionToken, getStoredAppSessionToken, setStoredAppSessionToken } from "@/src/lib/app-session";
import { getMobileDeviceFingerprint, getMobileDeviceInfo } from "@/src/lib/device";
import { mobileEnv } from "@/src/lib/env";
import { mobileSupabase } from "@/src/lib/supabase";

const SESSION_BOOT_TIMEOUT_MS = 3000;

type SessionContextValue = {
  isHydrated: boolean;
  isBusy: boolean;
  role: AppRole | null;
  user: AuthenticatedUserSummary | null;
  appSession: AppSessionValidation | null;
  error: string | null;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signUp: (input: { email: string; password: string; name: string; inviteCode: string }) => Promise<InviteCodeConsumptionResult>;
  requestPasswordReset: (email: string) => Promise<void>;
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
  async signUp() {
    throw new Error("Mobile session provider chua san sang.");
  },
  async requestPasswordReset() {
    throw new Error("Mobile session provider chua san sang.");
  },
  async signOut() {
    return;
  },
  clearError() {},
};

const SessionContext = createContext<SessionContextValue>(defaultSessionContextValue);

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

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [role, setRoleState] = useState<AppRole | null>(null);
  const [user, setUser] = useState<AuthenticatedUserSummary | null>(null);
  const [appSession, setAppSession] = useState<AppSessionValidation | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          getAuthenticatedUserSummary(mobileSupabase),
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
          nextValidation = await validateAppSessionToken(mobileSupabase, existingToken);
          if (!nextValidation.valid) {
            await clearStoredAppSessionToken();
          }
        }

        if (!nextValidation?.valid) {
          const sessionResult = await createAppSessionWithDevice(mobileSupabase, {
            userId: summary.id,
            deviceFingerprint: await getMobileDeviceFingerprint(),
            deviceInfo: await getMobileDeviceInfo(),
          });

          if (!sessionResult.success || !sessionResult.token) {
            throw new Error(sessionResult.message || sessionResult.error || "Khong tao duoc app session tren mobile.");
          }

          await setStoredAppSessionToken(sessionResult.token);
          nextValidation = await validateAppSessionToken(mobileSupabase, sessionResult.token);
        }

        if (!mounted) return;
        setAppSession(nextValidation);
        setError(null);
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

    const authListener = mobileSupabase?.auth.onAuthStateChange((_event, session) => {
      if (!mounted || session?.user) return;
      setUser(null);
      setRoleState(null);
      setAppSession(null);
    });

    return () => {
      mounted = false;
      authListener?.data.subscription.unsubscribe();
    };
  }, []);

  async function hydrateAfterAuth() {
    if (!mobileSupabase) {
      throw new Error("Thieu cau hinh Supabase mobile.");
    }

    const summary = await getAuthenticatedUserSummary(mobileSupabase);
    if (!summary) {
      throw new Error("Khong tim thay user sau khi dang nhap.");
    }

    setUser(summary);
    setRoleState(summary.role);

    const sessionResult = await createAppSessionWithDevice(mobileSupabase, {
      userId: summary.id,
      deviceFingerprint: await getMobileDeviceFingerprint(),
      deviceInfo: await getMobileDeviceInfo(),
    });

    if (!sessionResult.success || !sessionResult.token) {
      throw new Error(sessionResult.message || sessionResult.error || "Khong tao duoc app session tren mobile.");
    }

    await setStoredAppSessionToken(sessionResult.token);
    const validation = await validateAppSessionToken(mobileSupabase, sessionResult.token);
    setAppSession(validation);
    setError(null);
  }

  async function signIn(input: { email: string; password: string }) {
    if (!mobileSupabase) {
      throw new Error("Thieu cau hinh Supabase mobile.");
    }

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

      await hydrateAfterAuth();
      router.replace("/");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Dang nhap that bai.");
      throw nextError;
    } finally {
      setIsBusy(false);
    }
  }

  async function signUp(input: { email: string; password: string; name: string; inviteCode: string }) {
    if (!mobileSupabase) {
      throw new Error("Thieu cau hinh Supabase mobile.");
    }

    setIsBusy(true);
    setError(null);

    try {
      const { data, error: signUpError } = await mobileSupabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            display_name: input.name.trim(),
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

      const inviteResult = await consumeInviteCodeWithClient(mobileSupabase, {
        code: input.inviteCode.trim().toUpperCase(),
        userId,
        displayName: input.name.trim(),
      });

      if (data.session?.user) {
        await hydrateAfterAuth();
        router.replace("/");
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
      const { error: resetError } = await mobileSupabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: mobileEnv.passwordResetUrl || undefined,
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

    setIsBusy(true);

    try {
      await revokeAppSessionToken(mobileSupabase, await getStoredAppSessionToken());
      await clearStoredAppSessionToken();
      await mobileSupabase.auth.signOut();
      setUser(null);
      setRoleState(null);
      setAppSession(null);
      setError(null);
      router.replace("/(customer)");
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
    signUp,
    requestPasswordReset,
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
      <Text style={styles.caption}>Mobile session</Text>
      <Text style={styles.value}>{user?.email ?? "Chua co session"}</Text>
      <Text style={styles.value}>{role ? `Role: ${role}` : "Role chua san sang"}</Text>
      <Text style={styles.value}>{appSession?.valid ? "App session: OK" : "App session: chua co"}</Text>
      <Pressable style={styles.button} disabled={isBusy} onPress={handleReset}>
        <Text style={styles.buttonText}>{isBusy ? "Dang xu ly..." : "Dang xuat"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: "#e7ddd3",
  },
  caption: {
    color: "#8a7460",
    fontSize: 12,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  value: {
    color: "#2b241f",
    fontSize: 15,
  },
  button: {
    marginTop: 8,
    backgroundColor: "#2b241f",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },
});
