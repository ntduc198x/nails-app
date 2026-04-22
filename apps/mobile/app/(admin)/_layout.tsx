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
      <Tabs.Screen name="scheduling" options={{ title: "Điều phối" }} />
      <Tabs.Screen name="scheduling/[appointmentId]" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="checkout" options={{ title: "Thu tiền" }} />
      <Tabs.Screen name="shifts" options={{ title: "Ca làm" }} />
    </Tabs>
  );
}
