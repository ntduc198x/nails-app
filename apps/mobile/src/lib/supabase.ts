import { createClient } from "@supabase/supabase-js";
import { AppState, type AppStateStatus } from "react-native";
import { mobileEnv } from "./env";
import { safeStorage } from "./safe-storage";

const hasSupabaseConfig = Boolean(mobileEnv.supabaseUrl && mobileEnv.supabaseAnonKey);

export const mobileSupabase = hasSupabaseConfig
  ? createClient(mobileEnv.supabaseUrl, mobileEnv.supabaseAnonKey, {
      auth: {
        storage: safeStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

let currentAppState: AppStateStatus = AppState.currentState;

if (mobileSupabase) {
  AppState.addEventListener("change", (nextAppState) => {
    if (currentAppState !== "active" && nextAppState === "active") {
      mobileSupabase.auth.startAutoRefresh();
    }

    if (currentAppState === "active" && nextAppState !== "active") {
      mobileSupabase.auth.stopAutoRefresh();
    }

    currentAppState = nextAppState;
  });
}
