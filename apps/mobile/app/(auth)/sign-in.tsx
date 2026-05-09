import Feather from "@expo/vector-icons/Feather";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { CachedAppImage } from "@/src/components/cached-app-image";
import {
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
import { useSession } from "@/src/providers/session-provider";

const { colors } = premiumTheme;

const HERO_IMAGE_URI =
  "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1200&auto=format&fit=crop";

type AuthMode = "login" | "signup";
type RegistrationMode = "USER" | "ADMIN";

export default function SignInScreen() {
  const {
    clearError,
    error,
    isBusy,
    isHydrated,
    role,
    requestPasswordReset,
    signIn,
    signInWithApple,
    signInWithGoogle,
    signUp,
  } = useSession();
  const [mode, setMode] = useState<AuthMode>("login");
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>("USER");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailFallback, setShowEmailFallback] = useState(false);

  const isSignup = mode === "signup";
  const isRegisterAdmin = isSignup && registrationMode === "ADMIN";
  const showRoleToggle = isSignup;
  const showSocialSection = !isRegisterAdmin;
  const showManualForm = mode === "login" || isRegisterAdmin || showEmailFallback;

  const heroTitle = useMemo(() => {
    if (isRegisterAdmin) {
      return "Đăng ký tài khoản quản trị để quản lý lịch hẹn, nhân sự và các hoạt động vận hành của tiệm.";
    }

    return "Đăng nhập để quản lý lịch hẹn, ưu đãi và thông tin cá nhân.";
  }, [isRegisterAdmin]);

  const formTitle = useMemo(() => {
    if (mode === "login") return "Đăng nhập bằng email";
    if (isRegisterAdmin) return "Đăng ký tài khoản quản trị";
    return "Đăng ký bằng email";
  }, [isRegisterAdmin, mode]);

  const submitLabel = useMemo(() => {
    if (isBusy) return "Đang xử lý...";
    if (mode === "login") return "Đăng nhập";
    if (isRegisterAdmin) return "Tạo tài khoản quản trị";
    return "Tạo tài khoản";
  }, [isBusy, isRegisterAdmin, mode]);

  if (isHydrated && role) {
    return <Redirect href="/" />;
  }

  async function handleSubmit() {
    setMessage(null);
    clearError();

    if (isSignup) {
      await signUp({
        email: email.trim(),
        password,
        name: name.trim(),
        inviteCode,
        registrationMode,
      });

      setMessage(
        registrationMode === "USER"
          ? "Tài khoản khách hàng đã được tạo. Bạn có thể tiếp tục đăng nhập ngay."
          : "Tài khoản quản trị đã được tạo thành công.",
      );
      return;
    }

    await signIn({ email: email.trim(), password });
  }

  async function handlePasswordReset() {
    if (!email.trim()) {
      setMessage("Nhập email trước khi gửi yêu cầu đặt lại mật khẩu.");
      return;
    }

    await requestPasswordReset(email.trim());
    setMessage("Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư đến của bạn.");
  }

  async function handleGooglePress() {
    setMessage(null);
    clearError();
    await signInWithGoogle();
  }

  async function handleApplePress() {
    setMessage(null);
    clearError();
    await signInWithApple();
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
        style={styles.keyboardShell}
      >
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>C</Text>
        </View>
        <Text style={styles.brand}>CHAM BEAUTY</Text>
        <Text style={styles.brandSub}>ACCOUNT</Text>

        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            {mode === "signup" ? (
              <Pressable
                style={styles.backButton}
                onPress={() => {
                  setMode("login");
                  setRegistrationMode("USER");
                  setShowEmailFallback(false);
                  setMessage(null);
                  clearError();
                }}
              >
                <Feather color="#3F342D" name="arrow-left" size={18} />
              </Pressable>
            ) : (
              <View style={styles.backSpacer} />
            )}

            <Text style={styles.heroTitle}>{heroTitle}</Text>
          </View>

          <View style={styles.heroImageShell}>
            <CachedAppImage accessibilityLabel="Cham Beauty hero" alt="Cham Beauty hero" source={{ uri: HERO_IMAGE_URI }} style={styles.heroImage} />
          </View>
        </View>

        <View style={styles.switchWrap}>
          <Pressable
            style={[styles.switchItem, mode === "login" ? styles.switchItemActive : null]}
            onPress={() => {
              setMode("login");
              setRegistrationMode("USER");
              setShowEmailFallback(false);
              setMessage(null);
              clearError();
            }}
          >
            <Text style={[styles.switchText, mode === "login" ? styles.switchTextActive : null]}>Đăng nhập</Text>
          </Pressable>

          <Pressable
            style={[styles.switchItem, mode === "signup" ? styles.switchItemActive : null]}
            onPress={() => {
              setMode("signup");
              setRegistrationMode("USER");
              setShowEmailFallback(false);
              setMessage(null);
              clearError();
            }}
          >
            <Text style={[styles.switchText, mode === "signup" ? styles.switchTextActive : null]}>Đăng ký</Text>
          </Pressable>
        </View>

        {showRoleToggle ? (
          <View style={styles.roleWrap}>
            <RoleButton
              active={registrationMode === "USER"}
              icon="user"
              label="Khách hàng"
              onPress={() => {
                setRegistrationMode("USER");
                setShowEmailFallback(false);
              }}
            />
            <RoleButton
              active={registrationMode === "ADMIN"}
              icon="shield"
              label="Quản trị"
              onPress={() => {
                setRegistrationMode("ADMIN");
                setShowEmailFallback(true);
              }}
            />
          </View>
        ) : null}

        <View style={styles.card}>
          {showSocialSection ? (
            <>
              <Text style={styles.cardTitle}>{mode === "login" ? "Đăng nhập nhanh" : "Tạo tài khoản nhanh"}</Text>

              <SocialButton
                icon="chrome"
                label="Tiếp tục với Google"
                onPress={() => void handleGooglePress()}
                disabled={isBusy}
              />

              {Platform.OS === "ios" ? (
                <SocialButton
                  icon="smartphone"
                  label="Tiếp tục với Apple"
                  onPress={() => void handleApplePress()}
                  disabled={isBusy}
                />
              ) : null}

              <Separator label="HOẶC" />
            </>
          ) : null}

          {showManualForm ? (
            <>
              <Text style={styles.formTitle}>{formTitle}</Text>

              {isSignup ? (
                <InputField
                  icon="user"
                  placeholder="Họ và tên"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              ) : null}

              {isRegisterAdmin ? (
                <InputField
                  icon="tag"
                  placeholder="Mã mời quản trị"
                  value={inviteCode}
                  onChangeText={(value) => setInviteCode(value.toUpperCase())}
                  autoCapitalize="characters"
                />
              ) : null}

              <InputField
                icon="mail"
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <InputField
                icon="lock"
                placeholder="Mật khẩu"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                rightSlot={
                  <Pressable hitSlop={10} onPress={() => setShowPassword((current) => !current)}>
                    <Feather color="#A89484" name={showPassword ? "eye" : "eye-off"} size={17} />
                  </Pressable>
                }
              />

              {mode === "login" ? (
                <Pressable style={styles.forgotWrap} onPress={() => void handlePasswordReset()}>
                  <Text style={styles.forgotText}>Quên mật khẩu?</Text>
                </Pressable>
              ) : null}

              <GradientButton label={submitLabel} onPress={() => void handleSubmit()} disabled={isBusy} />
            </>
          ) : (
            <Pressable style={styles.emailFallbackWrap} onPress={() => setShowEmailFallback(true)}>
              <Text style={styles.emailFallbackText}>Dùng email thay thế</Text>
            </Pressable>
          )}

          {message ? <Text style={styles.notice}>{message}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.securityCard}>
          <View style={styles.securityIcon}>
            <Feather color="#B67C53" name="shield" size={16} />
          </View>
          <Text style={styles.securityText}>Bảo mật & an toàn</Text>
          <View style={styles.securityMiniBadge}>
            <Feather color="#B67C53" name="check" size={14} />
          </View>
        </View>

        <View style={styles.supportRow}>
          <Text style={styles.supportLabel}>Cần hỗ trợ?</Text>
          <Pressable>
            <Text style={styles.supportLink}>Liên hệ chúng tôi</Text>
          </Pressable>
          <Feather color="#C08A63" name="message-circle" size={14} />
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RoleButton({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.roleItem, active ? styles.roleItemActive : null]} onPress={onPress}>
      <Feather color={active ? "#3F342D" : "#B6A496"} name={icon} size={15} />
      <Text style={[styles.roleText, active ? styles.roleTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function SocialButton({
  disabled,
  icon,
  label,
  onPress,
}: {
  disabled?: boolean;
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable disabled={disabled} style={styles.socialButton} onPress={onPress}>
      <View style={styles.socialLeft}>
        <View style={styles.socialIconBadge}>
          <Feather color="#B67C53" name={icon} size={17} />
        </View>
        <Text style={styles.socialLabel}>{label}</Text>
      </View>
      <Feather color="#A89484" name="chevron-right" size={18} />
    </Pressable>
  );
}

function Separator({ label }: { label: string }) {
  return (
    <View style={styles.separatorRow}>
      <View style={styles.separatorLine} />
      <Text style={styles.separatorText}>{label}</Text>
      <View style={styles.separatorLine} />
    </View>
  );
}

function GradientButton({
  disabled,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={styles.buttonWrap}>
      <View style={[styles.buttonGradient, disabled ? styles.buttonDisabled : null]}>
        <View style={styles.buttonGloss} />
        <Text style={styles.buttonText}>{label}</Text>
      </View>
    </Pressable>
  );
}

function InputField({
  icon,
  placeholder,
  rightSlot,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  icon: React.ComponentProps<typeof Feather>["name"];
  rightSlot?: React.ReactNode;
}) {
  return (
    <View style={styles.inputRow}>
      <Feather color="#C0AE9F" name={icon} size={16} />
      <TextInput placeholder={placeholder} placeholderTextColor="#B7A89B" style={styles.input} {...props} />
      {rightSlot ? <View style={styles.inputRight}>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FCFAF8",
  },
  keyboardShell: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  brandMark: {
    alignItems: "center",
    alignSelf: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1.25,
    borderColor: "#B67C53",
  },
  brandMarkText: {
    color: "#B67C53",
    fontSize: 22,
    fontWeight: "400",
    lineHeight: 24,
    marginTop: -2,
  },
  brand: {
    alignSelf: "center",
    marginTop: 8,
    color: "#A66F4A",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 2.8,
  },
  brandSub: {
    alignSelf: "center",
    marginTop: 4,
    color: "#7F6F63",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2.1,
  },
  heroRow: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  heroCopy: {
    flex: 1,
    gap: 16,
    paddingTop: 6,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7E6452",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  backSpacer: {
    width: 34,
    height: 34,
  },
  heroTitle: {
    color: "#352E29",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  heroImageShell: {
    width: 126,
    height: 158,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#F6EEE8",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  switchWrap: {
    marginTop: 24,
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#F4ECE5",
    borderRadius: 22,
    padding: 4,
  },
  switchItem: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  switchItemActive: {
    backgroundColor: "#5A3923",
    shadowColor: "#5A3923",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },
  switchText: {
    color: "#85786E",
    fontSize: 14,
    fontWeight: "700",
  },
  switchTextActive: {
    color: "#FFFFFF",
  },
  roleWrap: {
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
  },
  roleItem: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEE5DE",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  roleItemActive: {
    borderColor: "#47382E",
    borderWidth: 1.2,
  },
  roleText: {
    color: "#8D8075",
    fontSize: 14,
    fontWeight: "700",
  },
  roleTextActive: {
    color: "#3F342D",
  },
  card: {
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 16,
    gap: 16,
    shadowColor: "#7E6452",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  cardTitle: {
    color: "#382E28",
    fontSize: 14,
    fontWeight: "800",
  },
  socialButton: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EFE6DF",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  socialLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  socialIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FBF6F1",
    alignItems: "center",
    justifyContent: "center",
  },
  socialLabel: {
    color: "#41362F",
    fontSize: 15,
    fontWeight: "700",
  },
  separatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#EFE6DF",
  },
  separatorText: {
    color: "#A18F82",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  formTitle: {
    color: "#382E28",
    fontSize: 14,
    fontWeight: "800",
  },
  inputRow: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EFE6DF",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 44,
  },
  inputRight: {
    minWidth: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  forgotWrap: {
    alignSelf: "flex-end",
    marginTop: -8,
  },
  forgotText: {
    color: "#8A603F",
    fontSize: 13,
    fontWeight: "700",
  },
  buttonWrap: {
    marginTop: 4,
  },
  buttonGradient: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#4C2F1D",
  },
  buttonDisabled: {
    backgroundColor: "#B8A292",
  },
  buttonGloss: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#A56F47",
    opacity: 0.34,
    transform: [{ translateX: -48 }],
    borderTopRightRadius: 40,
    borderBottomRightRadius: 40,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  emailFallbackWrap: {
    paddingVertical: 4,
    alignItems: "center",
  },
  emailFallbackText: {
    color: "#8A603F",
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  notice: {
    backgroundColor: colors.successBg,
    borderRadius: 16,
    color: colors.successText,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  error: {
    backgroundColor: colors.dangerBg,
    borderRadius: 16,
    color: colors.dangerText,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  securityCard: {
    marginTop: 16,
    minHeight: 76,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#7E6452",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
  },
  securityIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FBF6F1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  securityText: {
    flex: 1,
    color: "#40352E",
    fontSize: 15,
    fontWeight: "700",
  },
  securityMiniBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FBF6F1",
    alignItems: "center",
    justifyContent: "center",
  },
  supportRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  supportLabel: {
    color: "#918278",
    fontSize: 13,
  },
  supportLink: {
    color: "#B67C53",
    fontSize: 13,
    fontWeight: "700",
  },
});
