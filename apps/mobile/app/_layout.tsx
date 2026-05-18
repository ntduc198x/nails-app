import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CustomerPushProvider } from "@/src/providers/customer-push-provider";
import { SessionProvider } from "@/src/providers/session-provider";

export default function RootLayout() {
  return (
    <SessionProvider>
      <CustomerPushProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, gestureEnabled: true, fullScreenGestureEnabled: true }}>
          <Stack.Screen name="(auth)/callback" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/reset-password" options={{ headerShown: false }} />
        </Stack>
      </CustomerPushProvider>
    </SessionProvider>
  );
}
