import { Stack } from "expo-router";

const detailScreenOptions = {
  headerShown: false,
  animation: "default" as const,
  presentation: "card" as const,
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
  gestureResponseDistance: { start: 120 } as const,
};

export default function AdminStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: true, fullScreenGestureEnabled: true }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="change-password" options={detailScreenOptions} />
      <Stack.Screen name="manage-content-explore-services" options={detailScreenOptions} />
      <Stack.Screen name="manage-content-team" options={detailScreenOptions} />
      <Stack.Screen name="manage-content-service/[serviceId]" options={detailScreenOptions} />
      <Stack.Screen name="manage-content-team-member/[memberId]" options={detailScreenOptions} />
      <Stack.Screen name="manage-content-offer/[offerId]" options={detailScreenOptions} />
      <Stack.Screen name="manage-content-post/[postId]" options={detailScreenOptions} />
      <Stack.Screen name="scheduling/[appointmentId]" options={detailScreenOptions} />
    </Stack>
  );
}
