import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { isCustomerRole } from "@nails/shared";
import { useSession } from "@/src/providers/session-provider";

export default function IndexScreen() {
  const { error, isHydrated, role } = useSession();

  if (!isHydrated) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#2f241d" />
        <Text style={styles.label}>Đang khởi tạo mobile session...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>Mobile session gặp lỗi</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.label}>Vui lòng đăng nhập lại để tiếp tục.</Text>
        <Redirect href="/sign-in" />
      </View>
    );
  }

  if (!role) {
    return <Redirect href="/sign-in" />;
  }

  if (isCustomerRole(role)) {
    return <Redirect href="/(customer)/(tabs)" />;
  }

  return <Redirect href="/(admin)/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff8f0",
    gap: 12,
    padding: 24,
  },
  label: {
    color: "#5d4f46",
    fontSize: 14,
    textAlign: "center",
  },
  errorTitle: {
    color: "#7f221e",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  errorText: {
    color: "#9f2d2d",
    lineHeight: 20,
    textAlign: "center",
  },
});
