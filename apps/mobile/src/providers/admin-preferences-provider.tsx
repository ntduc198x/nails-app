import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Locale } from "@nails/shared";

export type AdminLocale = Locale;

type AdminPreferencesContextValue = {
  locale: AdminLocale;
  isReady: boolean;
  setLocale: (next: AdminLocale) => Promise<void>;
};

const STORAGE_LOCALE_KEY = "admin-preferences:locale";

const AdminPreferencesContext = createContext<AdminPreferencesContextValue | null>(null);

async function readStoredLocale(): Promise<AdminLocale> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_LOCALE_KEY);
    return value === "en" || value === "vi" ? value : "vi";
  } catch {
    return "vi";
  }
}

async function writeStoredLocale(value: AdminLocale) {
  try {
    await AsyncStorage.setItem(STORAGE_LOCALE_KEY, value);
  } catch {
    // Ignore local persistence failures and keep the in-memory preference alive.
  }
}

export function AdminPreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AdminLocale>("vi");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const storedLocale = await readStoredLocale();
      if (cancelled) {
        return;
      }

      setLocaleState(storedLocale);
      setIsReady(true);
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback(async (next: AdminLocale) => {
    setLocaleState(next);
    await writeStoredLocale(next);
  }, []);

  const value = useMemo<AdminPreferencesContextValue>(
    () => ({
      locale,
      isReady,
      setLocale,
    }),
    [isReady, locale, setLocale],
  );

  return <AdminPreferencesContext.Provider value={value}>{children}</AdminPreferencesContext.Provider>;
}

export function useAdminPreferences() {
  const context = useContext(AdminPreferencesContext);
  if (!context) {
    throw new Error("useAdminPreferences must be used within AdminPreferencesProvider");
  }

  return context;
}
