import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import * as Linking from "expo-linking";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { premiumTheme } from "@/src/design/premium-theme";
import { mobileSupabase } from "@/src/lib/supabase";

const { colors } = premiumTheme;

function readAuthParams(url: string) {
  const parsed = new URL(url);
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  return {
    code: parsed.searchParams.get("code"),
    accessToken: parsed.searchParams.get("access_token") || hash.get("access_token"),
    refreshToken: parsed.searchParams.get("refresh_token") || hash.get("refresh_token"),
    type: parsed.searchParams.get("type") || hash.get("type"),
    error: parsed.searchParams.get("error") || hash.get("error"),
    errorDescription: parsed.searchParams.get("error_description") || hash.get("error_description"),
  };
}

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPreparing, setIsPreparing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("Đang xác thực link đổi mật khẩu...");
  const [isReady, setIsReady] = useState(false);

  const submitLabel = useMemo(() => {
    if (isSubmitting) return "Đang cập nhật...";
    return "Đổi mật khẩu";
  }, [isSubmitting]);

  useEffect(() => {
    let mounted = true;

    async function prepareRecoverySession() {
      if (!mobileSupabase) {
        if (mounted) {
          setError("Thiếu cấu hình Supabase mobile.");
          setMessage("");
          setIsPreparing(false);
        }
        return;
      }

      try {
        const initialUrl = await Linking.getInitialURL();
        if (!initialUrl) {
          throw new Error("Không tìm thấy link đổi mật khẩu hợp lệ.");
        }

        const params = readAuthParams(initialUrl);
        if (params.error) {
          throw new Error(params.errorDescription || params.error || "Link đổi mật khẩu không hợp lệ.");
        }

        if (params.type === "recovery" && params.accessToken && params.refreshToken) {
          const { error: setSessionError } = await mobileSupabase.auth.setSession({
            access_token: params.accessToken,
            refresh_token: params.refreshToken,
          });
          if (setSessionError) {
            throw setSessionError;
          }
        } else if (params.code) {
          const { error: exchangeError } = await mobileSupabase.auth.exchangeCodeForSession(params.code);
          if (exchangeError) {
            throw exchangeError;
          }
        } else {
          const {
            data: { session },
          } = await mobileSupabase.auth.getSession();

          if (!session) {
            throw new Error("Link đổi mật khẩu không hợp lệ hoặc đã hết hạn.");
          }
        }

        if (mounted) {
          setIsReady(true);
          setMessage("Nhập mật khẩu mới cho tài khoản của anh.");
          setError(null);
        }
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : "Không xác thực được link đổi mật khẩu.");
          setMessage("");
        }
      } finally {
        if (mounted) {
          setIsPreparing(false);
        }
      }
    }

    void prepareRecoverySession();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit() {
    if (!mobileSupabase) {
      setError("Thiếu cấu hình Supabase mobile.");
      return;
    }

    if (!password || password.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: updateError } = await mobileSupabase.auth.updateUser({ password });
      if (updateError) {
        throw updateError;
      }

      setMessage("Đổi mật khẩu thành công. Đang quay về đăng nhập...");
      await mobileSupabase.auth.signOut();
      Alert.alert("Đổi mật khẩu thành công", "Bây giờ anh có thể đăng nhập bằng mật khẩu mới.", [
        {
          text: "Về đăng nhập",
          onPress: () => router.replace("/(auth)/sign-in"),
        },
      ]);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không đổi được mật khẩu.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
        style={styles.keyboardShell}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>C</Text>
          </View>
          <Text style={styles.brand}>CHAM BEAUTY</Text>
          <Text style={styles.brandSub}>RESET PASSWORD</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Đặt lại mật khẩu</Text>
            {message ? <Text style={styles.helper}>{message}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <InputField
              icon="lock"
              placeholder="Mật khẩu mới"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={isReady && !isPreparing && !isSubmitting}
              rightAction={
                <Pressable onPress={() => setShowPassword((current) => !current)} hitSlop={10}>
                  <Feather color="#7B6D63" name={showPassword ? "eye-off" : "eye"} size={18} />
                </Pressable>
              }
            />

            <InputField
              icon="shield"
              placeholder="Nhập lại mật khẩu mới"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              editable={isReady && !isPreparing && !isSubmitting}
              rightAction={
                <Pressable onPress={() => setShowConfirmPassword((current) => !current)} hitSlop={10}>
                  <Feather color="#7B6D63" name={showConfirmPassword ? "eye-off" : "eye"} size={18} />
                </Pressable>
              }
            />

            <Pressable
              style={[styles.primaryButton, (!isReady || isPreparing || isSubmitting) ? styles.primaryButtonDisabled : null]}
              disabled={!isReady || isPreparing || isSubmitting}
              onPress={() => void handleSubmit()}
            >
              <Text style={styles.primaryButtonText}>{submitLabel}</Text>
            </Pressable>

            <Pressable onPress={() => router.replace("/(auth)/sign-in")} style={styles.secondaryAction}>
              <Text style={styles.secondaryActionText}>Quay về đăng nhập</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InputField({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  editable = true,
  rightAction,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  editable?: boolean;
  rightAction?: React.ReactNode;
}) {
  return (
    <View style={[styles.inputShell, !editable ? styles.inputShellDisabled : null]}>
      <Feather color="#7B6D63" name={icon} size={18} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#9E9085"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        editable={editable}
        autoCapitalize="none"
      />
      {rightAction ? <View style={styles.inputAction}>{rightAction}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF9F6",
  },
  keyboardShell: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 28,
    justifyContent: "center",
    gap: 18,
  },
  brandMark: {
    alignSelf: "center",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#231815",
    alignItems: "center",
    justifyContent: "center",
  },
  brandMarkText: {
    color: "#F8E3D0",
    fontSize: 26,
    fontWeight: "800",
  },
  brand: {
    textAlign: "center",
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  brandSub: {
    textAlign: "center",
    color: "#8A7B6F",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2.2,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: "#EFE5DB",
    gap: 14,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  helper: {
    color: "#7B6D63",
    fontSize: 14,
    lineHeight: 21,
  },
  error: {
    color: "#B43A3A",
    fontSize: 13,
    lineHeight: 20,
    backgroundColor: "#FFF1F1",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputShell: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E7DDD2",
    backgroundColor: "#FFFDFB",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  inputShellDisabled: {
    opacity: 0.75,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 12,
  },
  inputAction: {
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryAction: {
    alignSelf: "center",
    paddingVertical: 4,
  },
  secondaryActionText: {
    color: "#7B6D63",
    fontSize: 14,
    fontWeight: "700",
  },
});
