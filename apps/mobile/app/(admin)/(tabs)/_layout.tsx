import { Tabs } from "expo-router";
import { useAdminStrings } from "@/src/features/admin/strings";

export default function AdminTabsLayout() {
  const strings = useAdminStrings();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          display: "none",
        },
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="overview" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="queue" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="booking" options={{ title: strings.navStore }} />
      <Tabs.Screen name="manage-content" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="scheduling" options={{ title: strings.navScheduling }} />
      <Tabs.Screen name="checkout" options={{ title: strings.navCheckout }} />
      <Tabs.Screen name="shifts" options={{ title: strings.navShifts }} />
      <Tabs.Screen name="manage" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="manage-customers" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="manage-reports" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="manage-tax-books" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="manage-services" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="manage-resources" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="manage-team" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="settings" options={{ tabBarButton: () => null }} />
    </Tabs>
  );
}
