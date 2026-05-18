import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { PropsWithChildren, useEffect } from "react";
import { Platform } from "react-native";
import { mobileSupabase } from "@/src/lib/supabase";
import { useSession } from "@/src/providers/session-provider";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function registerPushToken() {
  const permissions = await Notifications.getPermissionsAsync();
  let finalStatus = permissions.status;
  if (finalStatus !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return token.data;
}

export function CustomerPushProvider({ children }: PropsWithChildren) {
  const { user } = useSession();

  useEffect(() => {
    if (!user?.id || !mobileSupabase) return;

    let cancelled = false;
    const run = async () => {
      try {
        const expoPushToken = await registerPushToken();
        if (!expoPushToken || cancelled) return;

        await mobileSupabase.rpc("register_customer_push_device", {
          p_platform: Platform.OS,
          p_expo_push_token: expoPushToken,
          p_device_label: Constants.deviceName ?? null,
          p_app_build: Constants.expoConfig?.version ?? null,
        });
      } catch {
        // best effort only
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return children;
}
