import { Tabs } from "expo-router";

export default function AdminTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2b241f",
        tabBarInactiveTintColor: "#8a7869",
        tabBarStyle: {
          backgroundColor: "#fffaf5",
          borderTopColor: "#eadbc8",
          height: 64,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="overview" options={{ href: null }} />
      <Tabs.Screen name="queue" options={{ href: null }} />
      <Tabs.Screen name="appointments" options={{ href: null }} />
      <Tabs.Screen name="booking" options={{ title: "Web Booking" }} />
      <Tabs.Screen name="scheduling" options={{ title: "Dieu phoi lich" }} />
      <Tabs.Screen name="checkout" options={{ title: "Thanh toan" }} />
      <Tabs.Screen name="shifts" options={{ title: "Ca lam" }} />
    </Tabs>
  );
}
