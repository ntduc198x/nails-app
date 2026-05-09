import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function AuthCallbackScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color="#4a3424" />
      <Text style={styles.title}>Đang hoàn tất đăng nhập...</Text>
      <Text style={styles.subtitle}>Ứng dụng sẽ tự động quay lại trang phù hợp sau khi đồng bộ session.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff8f0",
    gap: 12,
    paddingHorizontal: 24,
  },
  title: {
    color: "#3d3027",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: "#74665b",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
