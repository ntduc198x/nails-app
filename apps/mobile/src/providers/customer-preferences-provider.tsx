import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPremiumTheme, type PremiumThemeMode } from "@/src/design/premium-theme";
import { mobileSupabase } from "@/src/lib/supabase";
import { useSession } from "@/src/providers/session-provider";

export type CustomerLocale = "vi" | "en";

type CustomerPreferencesContextValue = {
  colorScheme: PremiumThemeMode;
  locale: CustomerLocale;
  isReady: boolean;
  setColorScheme: (next: PremiumThemeMode) => Promise<void>;
  setLocale: (next: CustomerLocale) => Promise<void>;
};

const STORAGE_THEME_KEY = "customer-preferences:theme";
const STORAGE_LOCALE_KEY = "customer-preferences:locale";

const CustomerPreferencesContext = createContext<CustomerPreferencesContextValue | null>(null);

async function readStoredPreference<T extends string>(key: string, fallbackValue: T): Promise<T> {
  try {
    const value = await AsyncStorage.getItem(key);
    return typeof value === "string" && value.trim() ? (value as T) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

async function writeStoredPreference(key: string, value: string) {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Ignore local persistence failures and keep in-memory preference alive.
  }
}

export function CustomerPreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [isReady, setIsReady] = useState(false);
  const [colorScheme, setColorSchemeState] = useState<PremiumThemeMode>("light");
  const [locale, setLocaleState] = useState<CustomerLocale>("vi");

  const persistRemotePreferences = useCallback(
    async (next: { colorScheme?: PremiumThemeMode; locale?: CustomerLocale }) => {
      if (!mobileSupabase || !user?.id) {
        return;
      }

      const accountRes = await mobileSupabase
        .from("customer_accounts")
        .select("org_id,customer_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (next.colorScheme) {
        const {
          data: { user: authUser },
        } = await mobileSupabase.auth.getUser();

        if (!accountRes.error && accountRes.data?.org_id && accountRes.data?.customer_id) {
          const existingPrefRes = await mobileSupabase
            .from("customer_notification_preferences")
            .select("id")
            .eq("customer_id", accountRes.data.customer_id)
            .eq("org_id", accountRes.data.org_id)
            .maybeSingle();

          if (!existingPrefRes.error && existingPrefRes.data?.id) {
            await mobileSupabase
              .from("customer_notification_preferences")
              .update({ dark_mode_enabled: next.colorScheme === "dark" })
              .eq("id", existingPrefRes.data.id);
          } else {
            await mobileSupabase.from("customer_notification_preferences").insert({
              customer_id: accountRes.data.customer_id,
              org_id: accountRes.data.org_id,
              dark_mode_enabled: next.colorScheme === "dark",
            });
          }
        }

        if (authUser?.id) {
          await mobileSupabase.auth.updateUser({
            data: {
              customer_theme: next.colorScheme,
            },
          });
        }
      }

      if (next.locale) {
        if (!accountRes.error && accountRes.data?.org_id && accountRes.data?.customer_id) {
          const existingLocalePref = await mobileSupabase
            .from("customer_notification_preferences")
            .select("id")
            .eq("customer_id", accountRes.data.customer_id)
            .eq("org_id", accountRes.data.org_id)
            .maybeSingle();

          if (!existingLocalePref.error && existingLocalePref.data?.id) {
            await mobileSupabase
              .from("customer_notification_preferences")
              .update({ language: next.locale, updated_at: new Date().toISOString() })
              .eq("id", existingLocalePref.data.id);
          } else {
            await mobileSupabase.from("customer_notification_preferences").insert({
              customer_id: accountRes.data.customer_id,
              org_id: accountRes.data.org_id,
              language: next.locale,
            });
          }
        }
      }
    },
    [user],
  );

  const setColorScheme = useCallback(
    async (next: PremiumThemeMode) => {
      setColorSchemeState(next);
      await writeStoredPreference(STORAGE_THEME_KEY, next);
      await persistRemotePreferences({ colorScheme: next });
    },
    [persistRemotePreferences],
  );

  const setLocale = useCallback(
    async (next: CustomerLocale) => {
      setLocaleState(next);
      await writeStoredPreference(STORAGE_LOCALE_KEY, next);
      await persistRemotePreferences({ locale: next });
    },
    [persistRemotePreferences],
  );

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const [storedTheme, storedLocale] = await Promise.all([
        readStoredPreference<PremiumThemeMode>(STORAGE_THEME_KEY, "light"),
        readStoredPreference<CustomerLocale>(STORAGE_LOCALE_KEY, "vi"),
      ]);

      if (cancelled) return;

      setColorSchemeState(storedTheme);
      setLocaleState(storedLocale);

      if (mobileSupabase && user?.id) {
        const accountRes = await mobileSupabase
          .from("customer_accounts")
          .select("org_id,customer_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!accountRes.error && accountRes.data?.org_id && accountRes.data?.customer_id) {
          const prefsRes = await mobileSupabase
            .from("customer_notification_preferences")
            .select("dark_mode_enabled,language")
            .eq("customer_id", accountRes.data.customer_id)
            .eq("org_id", accountRes.data.org_id)
            .maybeSingle();

          if (!cancelled) {
            if (!prefsRes.error && typeof prefsRes.data?.dark_mode_enabled === "boolean") {
              const nextTheme: PremiumThemeMode = prefsRes.data.dark_mode_enabled ? "dark" : "light";
              setColorSchemeState(nextTheme);
              void writeStoredPreference(STORAGE_THEME_KEY, nextTheme);
            }

            if (!prefsRes.error && (prefsRes.data?.language === "vi" || prefsRes.data?.language === "en")) {
              const nextLocale = prefsRes.data.language;
              setLocaleState(nextLocale);
              void writeStoredPreference(STORAGE_LOCALE_KEY, nextLocale);
            }
          }
        }
      }

      if (!cancelled) {
        setIsReady(true);
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const value = useMemo<CustomerPreferencesContextValue>(
    () => ({
      colorScheme,
      locale,
      isReady,
      setColorScheme,
      setLocale,
    }),
    [colorScheme, isReady, locale, setColorScheme, setLocale],
  );

  return <CustomerPreferencesContext.Provider value={value}>{children}</CustomerPreferencesContext.Provider>;
}

export function useCustomerPreferences() {
  const context = useContext(CustomerPreferencesContext);
  if (!context) {
    throw new Error("useCustomerPreferences must be used within CustomerPreferencesProvider");
  }

  return context;
}

export function useCustomerTheme() {
  const { colorScheme } = useCustomerPreferences();
  return useMemo(() => createPremiumTheme(colorScheme), [colorScheme]);
}
