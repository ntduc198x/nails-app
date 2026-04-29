import { Tabs } from "expo-router";

export default function AdminTabsLayout() {
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
      <Tabs.Screen name="booking" options={{ title: "Booking" }} />
      <Tabs.Screen name="scheduling" options={{ title: "\u0110i\u1ec1u ph\u1ed1i" }} />
      <Tabs.Screen name="scheduling/[appointmentId]" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="checkout" options={{ title: "Thu ti\u1ec1n" }} />
      <Tabs.Screen name="shifts" options={{ title: "C\u00e1 nh\u00e2n" }} />
      <Tabs.Screen name="manage" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="manage-customers" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="manage-reports" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="manage-tax-books" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="manage-services" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="manage-resources" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="manage-team" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="settings" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="change-password" options={{ tabBarButton: () => null }} />
    </Tabs>
  );
}
