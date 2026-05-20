import AsyncStorage from "@react-native-async-storage/async-storage";
import Feather from "@expo/vector-icons/Feather";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { CustomerScreen, CustomerTopActions, SurfaceCard } from "@/src/features/customer/ui";
import { useCustomerStrings } from "@/src/features/customer/strings";
import { mobileSupabase } from "@/src/lib/supabase";
import { useCustomerPreferences, useCustomerTheme } from "@/src/providers/customer-preferences-provider";
import {
  clearCustomerFeedCache,
  getCustomerFeedCacheSizeBytes,
} from "@/src/lib/customer-feed-cache";
import {
  clearCustomerImageCacheManifest,
  getCustomerImageCacheManifestSizeBytes,
} from "@/src/lib/customer-image-cache";
import { useSession } from "@/src/providers/session-provider";

const SETTINGS_BOOL_KEYS = {
  notifications: "customer-settings:notifications",
  sound: "customer-settings:sound",
  vibration: "customer-settings:vibration",
} as const;

function formatCacheSize(bytes: number) {
  if (bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SettingsScreen() {
  const strings = useCustomerStrings();
  const theme = useCustomerTheme();
  const { user, signOut } = useSession();
  const { colorScheme, locale } = useCustomerPreferences();
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [cacheSize, setCacheSize] = useState("0 KB");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    password: "",
    confirmPassword: "",
  });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const loadCacheSize = useCallback(async () => {
    const [feedBytes, imageBytes] = await Promise.all([
      getCustomerFeedCacheSizeBytes(),
      getCustomerImageCacheManifestSizeBytes(),
    ]);
    setCacheSize(formatCacheSize(feedBytes + imageBytes));
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadCacheSize();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [loadCacheSize]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const [soundValue, vibrationValue, notificationsValue] = await Promise.all([
        AsyncStorage.getItem(SETTINGS_BOOL_KEYS.sound),
        AsyncStorage.getItem(SETTINGS_BOOL_KEYS.vibration),
        AsyncStorage.getItem(SETTINGS_BOOL_KEYS.notifications),
      ]);

      if (cancelled) return;
      setSoundEnabled(soundValue !== "false");
      setVibrationEnabled(vibrationValue !== "false");
      setNotificationsEnabled(notificationsValue !== "false");
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, []);

  async function persistBooleanSetting(
    key: string,
    nextValue: boolean,
    updater: (value: boolean) => void,
  ) {
    updater(nextValue);
    try {
      await AsyncStorage.setItem(key, String(nextValue));
    } catch {
      updater(!nextValue);
      Alert.alert(strings.cacheClearFailedTitle, strings.saveFailed);
    }
  }

  function showUpgradeLaterAlert(featureName: string) {
    Alert.alert("Tính năng đang nâng cấp", `${featureName} sẽ được nâng cấp ở bản cập nhật sau. Hiện tại ứng dụng đang dùng chế độ sáng và tiếng Việt.`);
  }

  function handleChangeLanguage() {
    setShowLanguageModal(false);
    showUpgradeLaterAlert("Chuyển ngôn ngữ");
  }

  function handleToggleTheme() {
    showUpgradeLaterAlert("Chế độ tối");
  }

  function handleClearCache() {
    Alert.alert("Xác nhận xóa cache", "Bạn có chắc muốn xóa toàn bộ cache cục bộ của ứng dụng không?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa cache",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await Promise.all([clearCustomerFeedCache(), clearCustomerImageCacheManifest()]);
              await loadCacheSize();
              Alert.alert(strings.cacheClearedTitle, strings.cacheClearedBody);
            } catch {
              Alert.alert(strings.cacheClearFailedTitle, strings.cacheClearFailedBody);
            }
          })();
        },
      },
    ]);
  }

  async function handleChangePassword() {
    if (!passwordForm.oldPassword.trim()) {
      Alert.alert(strings.cacheClearFailedTitle, "Vui lòng nhập mật khẩu hiện tại.");
      return;
    }

    if (!passwordForm.password.trim() || !passwordForm.confirmPassword.trim()) {
      Alert.alert(strings.cacheClearFailedTitle, "Vui lòng nhập đầy đủ mật khẩu mới và xác nhận mật khẩu.");
      return;
    }

    if (passwordForm.password.trim().length < 6) {
      Alert.alert(strings.cacheClearFailedTitle, "Mật khẩu mới cần có ít nhất 6 ký tự.");
      return;
    }

    if (passwordForm.password !== passwordForm.confirmPassword) {
      Alert.alert(strings.cacheClearFailedTitle, "Xác nhận mật khẩu chưa khớp.");
      return;
    }

    if (!user?.email) {
      Alert.alert(strings.cacheClearFailedTitle, strings.commonError);
      return;
    }

    if (!user) {
      Alert.alert(strings.cacheClearFailedTitle, strings.commonError);
      return;
    }

    try {
      setIsUpdatingPassword(true);

      if (!mobileSupabase) {
        throw new Error(strings.commonError);
      }

      const { error: signInError } = await mobileSupabase.auth.signInWithPassword({
        email: user.email,
        password: passwordForm.oldPassword,
      });

      if (signInError) {
        throw new Error("Mật khẩu hiện tại không đúng.");
      }

      const { error } = await mobileSupabase.auth.updateUser({
        password: passwordForm.password.trim(),
      });

      if (error) {
        throw error;
      }

      setPasswordForm({ oldPassword: "", password: "", confirmPassword: "" });
      Alert.alert(strings.saveSuccess, "Mật khẩu đã được cập nhật.");
    } catch (error) {
      Alert.alert(strings.cacheClearFailedTitle, error instanceof Error ? error.message : strings.commonError);
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  return (
    <CustomerScreen
      title={strings.settingsTitle}
      hideHeader
      contentContainerStyle={styles.content}
      keyboardAware
      keyboardVerticalOffset={12}
    >
      <View style={styles.headerRow}>
        <Pressable
          hitSlop={10}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(customer)/(tabs)");
            }
          }}
          style={styles.backButton}
        >
          <Feather color={theme.colors.text} name="chevron-left" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>{strings.settingsTitle}</Text>
        <CustomerTopActions />
      </View>

      <SurfaceCard style={styles.groupCard}>
        <ToggleRow
          icon="moon"
          label={strings.darkMode}
          value={colorScheme === "dark"}
          onValueChange={() => handleToggleTheme()}
          styles={styles}
          theme={theme}
        />
        <ToggleRow
          icon="volume-2"
          label={strings.sound}
          value={soundEnabled}
          onValueChange={(value) => void persistBooleanSetting(SETTINGS_BOOL_KEYS.sound, value, setSoundEnabled)}
          styles={styles}
          theme={theme}
        />
        <ToggleRow
          icon="smartphone"
          label={strings.vibration}
          value={vibrationEnabled}
          onValueChange={(value) =>
            void persistBooleanSetting(SETTINGS_BOOL_KEYS.vibration, value, setVibrationEnabled)
          }
          styles={styles}
          theme={theme}
        />
        <ToggleRow
          icon="bell"
          label={strings.pushNotifications}
          value={notificationsEnabled}
          onValueChange={(value) =>
            void persistBooleanSetting(SETTINGS_BOOL_KEYS.notifications, value, setNotificationsEnabled)
          }
          last
          styles={styles}
          theme={theme}
        />
      </SurfaceCard>

      <SurfaceCard style={styles.groupCard}>
        <ActionRow
          icon="globe"
          label={strings.language}
          value="Tiếng Việt"
          onPress={() => setShowLanguageModal(true)}
          styles={styles}
          theme={theme}
        />
        <ActionRow
          icon="trash-2"
          label={strings.cache}
          value={cacheSize}
          onPress={handleClearCache}
          styles={styles}
          theme={theme}
          last
        />
      </SurfaceCard>

      <SurfaceCard style={styles.groupCard}>
        <View style={styles.passwordBlock}>
          <View style={styles.passwordHeader}>
            <Feather color={theme.colors.textSoft} name="lock" size={18} />
            <Text style={styles.rowLabel}>Đổi mật khẩu</Text>
          </View>
          <TextInput
            secureTextEntry
            placeholder="Mật khẩu hiện tại"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.passwordInput}
            value={passwordForm.oldPassword}
            onChangeText={(value) => setPasswordForm((current) => ({ ...current, oldPassword: value }))}
          />
          <TextInput
            secureTextEntry
            placeholder="Mật khẩu mới"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.passwordInput}
            value={passwordForm.password}
            onChangeText={(value) => setPasswordForm((current) => ({ ...current, password: value }))}
          />
          <TextInput
            secureTextEntry
            placeholder="Nhập lại mật khẩu mới"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.passwordInput}
            value={passwordForm.confirmPassword}
            onChangeText={(value) => setPasswordForm((current) => ({ ...current, confirmPassword: value }))}
          />
          <Pressable style={styles.passwordButton} onPress={() => void handleChangePassword()} disabled={isUpdatingPassword}>
            <Text style={styles.passwordButtonText}>{isUpdatingPassword ? "Đang cập nhật..." : "Cập nhật mật khẩu"}</Text>
          </Pressable>
        </View>
      </SurfaceCard>

      <Pressable style={styles.signOutButton} onPress={() => void signOut()}>
        <Feather color={theme.colors.dangerText} name="log-out" size={18} />
        <Text style={styles.signOutButtonText}>Đăng xuất</Text>
      </Pressable>

      <Modal visible={showLanguageModal} transparent animationType="fade" onRequestClose={() => setShowLanguageModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowLanguageModal(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>{strings.language}</Text>
            <Pressable style={styles.modalOption} onPress={handleChangeLanguage}>
              <Text style={[styles.modalOptionText, locale === "vi" ? styles.modalOptionTextActive : null]}>
                {strings.languageVi}
              </Text>
            </Pressable>
            <Pressable style={styles.modalOption} onPress={handleChangeLanguage}>
              <Text style={[styles.modalOptionText, locale === "en" ? styles.modalOptionTextActive : null]}>
                {strings.languageEn}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </CustomerScreen>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onValueChange,
  last = false,
  styles,
  theme,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  last?: boolean;
  styles: ReturnType<typeof createStyles>;
  theme: ReturnType<typeof useCustomerTheme>;
}) {
  return (
    <View style={[styles.row, !last ? styles.rowDivider : null]}>
      <View style={styles.rowCopy}>
        <Feather color={theme.colors.textSoft} name={icon} size={18} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Switch
        ios_backgroundColor={theme.colors.border}
        onValueChange={onValueChange}
        thumbColor="#fffdfa"
        trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
        value={value}
      />
    </View>
  );
}

function ActionRow({
  icon,
  label,
  value,
  onPress,
  last = false,
  styles,
  theme,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  onPress: () => void;
  last?: boolean;
  styles: ReturnType<typeof createStyles>;
  theme: ReturnType<typeof useCustomerTheme>;
}) {
  return (
    <Pressable onPress={onPress}>
      <View style={[styles.row, !last ? styles.rowDivider : null]}>
        <View style={styles.rowCopy}>
          <Feather color={theme.colors.textSoft} name={icon} size={18} />
          <Text style={styles.rowLabel}>{label}</Text>
        </View>
        <View style={styles.rowTrailing}>
          <Text style={styles.rowValue}>{value}</Text>
          <Feather color={theme.colors.textSoft} name="chevron-right" size={18} />
        </View>
      </View>
    </Pressable>
  );
}

function createStyles(theme: ReturnType<typeof useCustomerTheme>) {
  return StyleSheet.create({
    content: {
      gap: 12,
      paddingBottom: 136,
      paddingTop: 0,
    },
    headerRow: {
      alignItems: "center",
      flexDirection: "row",
      marginBottom: 12,
      paddingHorizontal: 4,
    },
    backButton: {
      alignItems: "center",
      height: 44,
      justifyContent: "center",
      marginLeft: -8,
      width: 44,
    },
    headerTitle: {
      color: theme.colors.text,
      flex: 1,
      fontSize: 22,
      fontWeight: "800",
    },
    groupCard: {
      gap: 0,
      paddingHorizontal: 12,
      paddingVertical: 0,
    },
    row: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 64,
    },
    rowDivider: {
      borderBottomColor: theme.colors.border,
      borderBottomWidth: 1,
    },
    rowCopy: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
    },
    rowLabel: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    rowTrailing: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
      maxWidth: "52%",
    },
    rowValue: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "600",
      textAlign: "right",
    },
    passwordBlock: {
      gap: 12,
      paddingVertical: 14,
    },
    passwordHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
    },
    passwordInput: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: 16,
      borderWidth: 1,
      color: theme.colors.text,
      fontSize: 14,
      minHeight: 52,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    passwordButton: {
      alignItems: "center",
      backgroundColor: theme.colors.accent,
      borderRadius: 16,
      justifyContent: "center",
      minHeight: 52,
    },
    passwordButtonText: {
      color: theme.colors.surface,
      fontSize: 14,
      fontWeight: "800",
    },
    signOutButton: {
      alignItems: "center",
      backgroundColor: "#FFFDFB",
      borderColor: "#F1E7DE",
      borderRadius: 22,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      justifyContent: "center",
      marginTop: 4,
      minHeight: 56,
      paddingHorizontal: theme.spacing.lg,
    },
    signOutButtonText: {
      color: theme.colors.dangerText,
      fontSize: 14,
      fontWeight: "800",
    },
    modalOverlay: {
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.5)",
      flex: 1,
      justifyContent: "center",
    },
    modalCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      maxWidth: 300,
      padding: 24,
      width: "80%",
    },
    modalTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "800",
      marginBottom: 16,
      textAlign: "center",
    },
    modalOption: {
      borderBottomColor: theme.colors.border,
      borderBottomWidth: 1,
      paddingVertical: 14,
    },
    modalOptionText: {
      color: theme.colors.textSoft,
      fontSize: 16,
      textAlign: "center",
    },
    modalOptionTextActive: {
      color: theme.colors.accent,
      fontWeight: "700",
    },
  });
}
