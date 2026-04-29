import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mobileSupabase } from "@/src/lib/supabase";
import { AdminHeaderActions } from "@/src/features/admin/ui";
import { useSession } from "@/src/providers/session-provider";

const TOKENS = {
  screen: "#FCFAF8",
  card: "#FFFFFF",
  primaryBrown: "#2F241D",
  border: "#E8DDD6",
  textPrimary: "#1F1A17",
  textSecondary: "#7D716B",
  textMuted: "#A0928A",
  iconMuted: "#9B8D84",
  shadow: "rgba(47, 36, 29, 0.08)",
};

type PasswordFormState = {
  currentPassword: string;
  nextPassword: string;
  confirmPassword: string;
};

export default function AdminChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>({
    currentPassword: "",
    nextPassword: "",
    confirmPassword: "",
  });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  async function handlePasswordSubmit() {
    if (!mobileSupabase) {
      Alert.alert("Chưa cấu hình", "Ứng dụng chưa kết nối được Supabase để cập nhật mật khẩu.");
      return;
    }

    const email = user?.email?.trim();
    if (!email) {
      Alert.alert("Thiếu tài khoản", "Không tìm thấy email tài khoản để đổi mật khẩu.");
      return;
    }

    if (!passwordForm.currentPassword.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập mật khẩu cũ.");
      return;
    }

    if (passwordForm.nextPassword.length < 6) {
      Alert.alert("Mật khẩu chưa hợp lệ", "Mật khẩu mới cần có ít nhất 6 ký tự.");
      return;
    }

    if (passwordForm.nextPassword !== passwordForm.confirmPassword) {
      Alert.alert("Không khớp", "Xác nhận mật khẩu mới chưa trùng khớp.");
      return;
    }

    if (passwordForm.currentPassword === passwordForm.nextPassword) {
      Alert.alert("Chưa thay đổi", "Mật khẩu mới cần khác mật khẩu cũ.");
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const { error: signInError } = await mobileSupabase.auth.signInWithPassword({
        email,
        password: passwordForm.currentPassword,
      });

      if (signInError) {
        throw new Error("Mật khẩu cũ không đúng.");
      }

      const { error: updateError } = await mobileSupabase.auth.updateUser({
        password: passwordForm.nextPassword,
      });

      if (updateError) {
        throw updateError;
      }

Alert.alert("Đã cập nhật", "Mật khẩu của bạn đã được thay đổi thành công.", [
          {
            text: "OK",
            onPress: () => router.replace("/(admin)/settings"),
          },
        ]);
    } catch (error) {
      Alert.alert(
        "Không thể thực hiện",
        error instanceof Error ? error.message : "Không thể đổi mật khẩu lúc này.",
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.screen, { paddingTop: Math.max(insets.top, 12) + 12 }]}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Pressable hitSlop={10} onPress={() => router.replace("/(admin)/settings")} style={styles.headerBackButton}>
              <Feather color={TOKENS.textPrimary} name="chevron-left" size={21} />
            </Pressable>
            <AdminHeaderActions onSettingsPress={() => void router.replace("/(admin)/settings")} />
          </View>

          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Đổi mật khẩu</Text>
            <Text style={styles.headerSubtitle}>
              Nhập mật khẩu cũ và mật khẩu mới để cập nhật trực tiếp trong ứng dụng.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Thông tin bảo mật</Text>

          <PasswordInputField
            icon="lock"
            label="Mật khẩu cũ"
            value={passwordForm.currentPassword}
            onChangeText={(value) => setPasswordForm((current) => ({ ...current, currentPassword: value }))}
          />
          <PasswordInputField
            icon="key"
            label="Mật khẩu mới"
            value={passwordForm.nextPassword}
            onChangeText={(value) => setPasswordForm((current) => ({ ...current, nextPassword: value }))}
          />
          <PasswordInputField
            icon="check-circle"
            label="Xác nhận mật khẩu mới"
            value={passwordForm.confirmPassword}
            onChangeText={(value) => setPasswordForm((current) => ({ ...current, confirmPassword: value }))}
          />

          <View style={styles.passwordActions}>
            <Pressable onPress={() => router.replace("/(admin)/settings")} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Hủy</Text>
            </Pressable>

            <Pressable onPress={() => void handlePasswordSubmit()} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>
                {isUpdatingPassword ? "Đang cập nhật..." : "Lưu mật khẩu mới"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function PasswordInputField({
  icon,
  label,
  onChangeText,
  value,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <View style={styles.passwordFieldGroup}>
      <Text style={styles.passwordFieldLabel}>{label}</Text>
      <View style={styles.passwordInputShell}>
        <Feather color={TOKENS.iconMuted} name={icon} size={18} />
        <TextInput
          onChangeText={onChangeText}
          placeholderTextColor={TOKENS.textMuted}
          secureTextEntry
          style={styles.passwordInput}
          value={value}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: TOKENS.screen,
  },
  screen: {
    flex: 1,
    backgroundColor: TOKENS.screen,
    paddingHorizontal: 24,
    gap: 22,
  },
  header: {
    gap: 14,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerBackButton: {
    width: 28,
    height: 28,
    alignItems: "flex-start",
    justifyContent: "center",
    marginLeft: -2,
  },
  headerCopy: {
    gap: 10,
  },
  headerTitle: {
    color: TOKENS.textPrimary,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -0.9,
  },
  headerSubtitle: {
    color: TOKENS.textSecondary,
    fontSize: 15,
    lineHeight: 24,
    maxWidth: "96%",
  },
  card: {
    backgroundColor: TOKENS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: TOKENS.border,
    paddingHorizontal: 20,
    paddingVertical: 20,
    shadowColor: TOKENS.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardTitle: {
    color: TOKENS.textPrimary,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    marginBottom: 18,
    letterSpacing: -0.4,
  },
  passwordFieldGroup: {
    gap: 8,
    marginBottom: 18,
  },
  passwordFieldLabel: {
    color: TOKENS.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  passwordInputShell: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    backgroundColor: TOKENS.card,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  passwordInput: {
    flex: 1,
    color: TOKENS.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 0,
  },
  passwordActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 2,
  },
  primaryButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: TOKENS.primaryBrown,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    backgroundColor: TOKENS.card,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: TOKENS.textPrimary,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
  },
});
