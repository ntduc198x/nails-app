import { Tabs } from "expo-router";

export default function CustomerTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="membership" />
      <Tabs.Screen name="account" />
      <Tabs.Screen name="booking" />
    </Tabs>
  );
}
