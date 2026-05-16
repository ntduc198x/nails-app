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
      <Tabs.Screen name="booking" options={{ title: "Cửa hàng" }} />
      <Tabs.Screen name="manage-content" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="scheduling" options={{ title: "Điều phối" }} />
      <Tabs.Screen name="checkout" options={{ title: "Thu tiền" }} />
      <Tabs.Screen name="shifts" options={{ title: "Lịch làm việc" }} />
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
