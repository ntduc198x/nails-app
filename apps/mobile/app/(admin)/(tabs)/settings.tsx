import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ensureOrgContext, localizeAdminBranchName, translate, type Locale, type LocalizedTextValue } from "@nails/shared";
import { canSelectAdminBranch, getAdminNavHref } from "@/src/features/admin/navigation";
import {
  AdminBottomNavDock,
  AdminHeaderActions,
  AdminKeyboardAwareScrollView,
  AdminKeyboardTextInput,
  AdminTopSafeArea,
  ADMIN_CONTENT_BOTTOM_NAV_CLEARANCE,
  ADMIN_KEYBOARD_ACTIVE_FIELD_CLEARANCE,
  useKeyboardVisible,
} from "@/src/features/admin/ui";
import { useAdminStrings } from "@/src/features/admin/strings";
import { clearAdminAppCache, getAdminAppCacheSizeBytes } from "@/src/lib/admin-app-cache";
import { upsertAndVerifyAdminProfile } from "@/src/lib/admin-profile";
import { mobileSupabase } from "@/src/lib/supabase";
import { useAdminPreferences } from "@/src/providers/admin-preferences-provider";
import { useSession } from "@/src/providers/session-provider";

const palette = {
  bg: "#FCFAF8",
  card: "#FFFFFF",
  primary: "#2F241D",
  beige: "#F3EDE7",
  beigeLight: "#F9F6F2",
  border: "#E8DDD6",
  textPrimary: "#1F1A17",
  textSecondary: "#7D716B",
  textMuted: "#A0928A",
  danger: "#EF4444",
};

type EditField = "fullName" | "phone" | "address" | null;
type BranchOption = { id: string; name: string; priority: number; translations: LocalizedTextValue | null };
type ProfileData = {
  phone: string;
  address: string;
  fullName: string;
  branchId: string | null;
};

function formatCacheSize(bytes: number) {
  if (bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminSettingsScreen() {
  const { user, signOut, role, refreshSession } = useSession();
  const { locale, setLocale } = useAdminPreferences();
  const strings = useAdminStrings();
  const keyboardVisible = useKeyboardVisible();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [cacheSize, setCacheSize] = useState("0 KB");
  const [saving, setSaving] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [editingField, setEditingField] = useState<EditField>(null);
  const [editValue, setEditValue] = useState("");
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);

  const languageOptions = useMemo(
    () => [
      { value: "vi" as const, label: strings.settingsLanguageVietnamese, shortLabel: strings.settingsLanguageVietnameseShort },
      { value: "en" as const, label: strings.settingsLanguageEnglish, shortLabel: strings.settingsLanguageEnglishShort },
    ],
    [strings.settingsLanguageEnglish, strings.settingsLanguageEnglishShort, strings.settingsLanguageVietnamese, strings.settingsLanguageVietnameseShort],
  );

  const loadCacheSize = useCallback(async () => {
    const cacheBytes = await getAdminAppCacheSizeBytes();
    setCacheSize(formatCacheSize(cacheBytes));
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadCacheSize();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [loadCacheSize]);

  useEffect(() => {
    async function loadProfileData() {
      if (!mobileSupabase || !user?.id) return;

      try {
        const { orgId, branchId } = await ensureOrgContext(mobileSupabase);
        const { data } = await mobileSupabase
          .from("profiles")
          .select("phone,address,display_name,default_branch_id")
          .eq("user_id", user.id)
          .eq("org_id", orgId)
          .maybeSingle();

        setProfileData({
          phone: typeof data?.phone === "string" ? data.phone : "",
          address: typeof data?.address === "string" ? data.address : "",
          fullName: typeof data?.display_name === "string" ? data.display_name : user.displayName?.trim() || "",
          branchId: typeof data?.default_branch_id === "string" ? data.default_branch_id : branchId,
        });

        if (canSelectAdminBranch(role)) {
          const branchResponse = await mobileSupabase
            .from("branches")
            .select("id,name,translations")
            .eq("org_id", orgId)
            .order("created_at", { ascending: true });

          const branches =
            branchResponse.error && (
              branchResponse.error.code === "42703" ||
              (branchResponse.error.message || "").includes("branches.translations") ||
              (branchResponse.error.message || "").includes("column translations does not exist")
            )
              ? (
                  await mobileSupabase
                    .from("branches")
                    .select("id,name")
                    .eq("org_id", orgId)
                    .order("created_at", { ascending: true })
                ).data
              : branchResponse.data;

          setBranchOptions(
            (branches ?? [])
              .map((branch, index) => {
                const baseBranchName =
                  typeof branch.name === "string" && branch.name.trim() ? branch.name.trim() : strings.settingsBranchFallback;
                const branchTranslations =
                  "translations" in branch ? ((branch.translations as LocalizedTextValue | null | undefined) ?? null) : null;
                const branchName =
                  localizeAdminBranchName(locale, baseBranchName, branchTranslations) ?? baseBranchName;
                const isPrimaryBranch = String(branch.id ?? "") === branchId;

                return {
                  id: String(branch.id ?? ""),
                  name: branchName,
                  priority: isPrimaryBranch ? 0 : index + 1,
                  translations: branchTranslations,
                };
              })
              .sort((left, right) => left.priority - right.priority || left.name.localeCompare(right.name, locale)),
          );
        }
      } catch (error) {
        console.error("Failed to load admin profile", error);
      }
    }

    void loadProfileData();
  }, [locale, role, strings.settingsBranchFallback, user?.displayName, user?.id]);

  const displayName = profileData?.fullName || user?.displayName?.trim() || strings.settingsDefaultUserName;
  const displayEmail = user?.email || strings.settingsNotUpdated;
  const displayPhone = profileData?.phone || strings.settingsNotUpdated;
  const displayAddress = profileData?.address || strings.settingsNotUpdated;
  const selectedBranchName = useMemo(
    () => branchOptions.find((branch) => branch.id === profileData?.branchId)?.name || strings.settingsNoBranchSelected,
    [branchOptions, profileData?.branchId, strings.settingsNoBranchSelected],
  );
  const currentLanguageName =
    locale === "vi" ? strings.settingsLanguageVietnamese : strings.settingsLanguageEnglish;
  const cacheText = locale === "vi"
    ? {
        cardTitle: "Bộ nhớ đệm cục bộ",
        actionLabel: "Xóa cache",
        actionBusyLabel: "Đang xóa...",
        confirmTitle: "Xác nhận xóa cache",
        confirmBody: "Thao tác này sẽ xóa dữ liệu cache cục bộ do ứng dụng quản lý. Tài khoản và cài đặt của bạn sẽ không bị thay đổi.",
        successTitle: "Đã xóa",
        successBody: "Dữ liệu cache cục bộ đã được xóa.",
        errorTitle: "Lỗi",
        errorBody: "Không thể xóa dữ liệu cache cục bộ.",
      }
    : {
        cardTitle: "Local cache",
        actionLabel: "Clear cache",
        actionBusyLabel: "Clearing...",
        confirmTitle: "Clear cache",
        confirmBody: "This clears app-managed local cache data. Your account and preferences will not be changed.",
        successTitle: "Cleared",
        successBody: "Local cache data has been cleared.",
        errorTitle: "Error",
        errorBody: "Unable to clear local cache data.",
      };

  function getEditFieldLabel(field: EditField) {
    switch (field) {
      case "fullName":
        return strings.settingsEditFieldFullName;
      case "phone":
        return strings.settingsEditFieldPhone;
      case "address":
        return strings.settingsEditFieldAddress;
      default:
        return "";
    }
  }

  function openEdit(field: EditField, currentValue: string) {
    setEditingField(field);
    setEditValue(currentValue === strings.settingsNotUpdated ? "" : currentValue);
  }

  async function saveEdit() {
    if (!editingField || !user?.id) return;

    setSaving(true);
    try {
      const nextPayload =
        editingField === "fullName"
          ? { displayName: editValue, phone: profileData?.phone, address: profileData?.address }
          : editingField === "phone"
            ? { displayName: profileData?.fullName, phone: editValue, address: profileData?.address }
            : { displayName: profileData?.fullName, phone: profileData?.phone, address: editValue };

      const verifiedProfile = await upsertAndVerifyAdminProfile({
        userId: user.id,
        displayName: nextPayload.displayName ?? "",
        phone: nextPayload.phone ?? "",
        address: nextPayload.address ?? "",
        defaultBranchId: profileData?.branchId ?? null,
      });

      if (editingField === "fullName" && mobileSupabase) {
        const { error: authError } = await mobileSupabase.auth.updateUser({
          data: { display_name: editValue.trim() },
        });
        if (authError) throw authError;
      }

      setProfileData({
        fullName: verifiedProfile.display_name?.trim() || "",
        phone: verifiedProfile.phone?.trim() || "",
        address: verifiedProfile.address?.trim() || "",
        branchId: typeof verifiedProfile.default_branch_id === "string" ? verifiedProfile.default_branch_id : profileData?.branchId ?? null,
      });
      await refreshSession();
      setEditingField(null);
      Alert.alert(strings.settingsSaveSuccessTitle, strings.settingsSaveSuccessBody);
    } catch (error) {
      Alert.alert(strings.settingsErrorTitle, error instanceof Error ? error.message : strings.settingsSaveErrorBody);
    } finally {
      setSaving(false);
    }
  }

  async function handleBranchChange(branchId: string) {
    if (!user?.id || !canSelectAdminBranch(role) || branchId === profileData?.branchId) {
      setBranchModalOpen(false);
      return;
    }

    setSaving(true);
    try {
      const verifiedProfile = await upsertAndVerifyAdminProfile({
        userId: user.id,
        displayName: profileData?.fullName ?? "",
        phone: profileData?.phone ?? "",
        address: profileData?.address ?? "",
        defaultBranchId: branchId,
      });

      setProfileData((current) =>
        current
          ? {
              ...current,
              branchId: typeof verifiedProfile.default_branch_id === "string" ? verifiedProfile.default_branch_id : branchId,
            }
          : current,
      );
      await refreshSession();
      setBranchModalOpen(false);
      Alert.alert(strings.settingsBranchChangedTitle, strings.settingsBranchChangedBody);
    } catch (error) {
      Alert.alert(strings.settingsErrorTitle, error instanceof Error ? error.message : strings.settingsBranchChangeErrorBody);
    } finally {
      setSaving(false);
    }
  }

  async function handleLanguageChange(nextLocale: Locale) {
    if (nextLocale === locale) {
      setLanguageModalOpen(false);
      return;
    }

    await setLocale(nextLocale);
    setLanguageModalOpen(false);
    Alert.alert(
      translate(nextLocale, "admin", "settingsLanguageUpdatedTitle"),
      translate(nextLocale, "admin", "settingsLanguageUpdatedBody"),
    );
  }

  function handleLogout() {
    Alert.alert(strings.settingsLogoutTitle, strings.settingsLogoutBody, [
      { text: strings.settingsCancelButton, style: "cancel" },
      { text: strings.settingsLogout, style: "destructive", onPress: () => void signOut() },
    ]);
  }

  const clearCache = useCallback(async () => {
    if (clearingCache) {
      return;
    }

    setClearingCache(true);
    try {
      await clearAdminAppCache();
      await loadCacheSize();
      Alert.alert(cacheText.successTitle, cacheText.successBody);
    } catch {
      Alert.alert(cacheText.errorTitle, cacheText.errorBody);
    } finally {
      setClearingCache(false);
    }
  }, [cacheText.errorBody, cacheText.errorTitle, cacheText.successBody, cacheText.successTitle, clearingCache, loadCacheSize]);

  function handleClearCache() {
    Alert.alert(cacheText.confirmTitle, cacheText.confirmBody, [
      { text: strings.settingsCancelButton, style: "cancel" },
      {
        text: clearingCache ? cacheText.actionBusyLabel : cacheText.actionLabel,
        style: "destructive",
        onPress: () => {
          void clearCache();
        },
      },
    ]);
  }

  const editFieldLabel = getEditFieldLabel(editingField);

  return (
    <View style={styles.screen}>
      <AdminTopSafeArea style={styles.topChrome}>
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={() => router.replace(role === "OWNER" || role === "PARTNER" ? "/manage" : "/shifts")}>
            <Feather name="chevron-left" size={24} color={palette.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{strings.settingsTitle}</Text>
          <AdminHeaderActions onSettingsPress={() => undefined} />
        </View>
      </AdminTopSafeArea>
      <KeyboardAvoidingView
        enabled={Platform.OS === "android"}
        behavior="height"
        keyboardVerticalOffset={8}
        style={styles.screen}
      >
        <AdminKeyboardAwareScrollView
          contentContainerStyle={[
            styles.content,
            keyboardVisible ? { paddingBottom: ADMIN_CONTENT_BOTTOM_NAV_CLEARANCE + ADMIN_KEYBOARD_ACTIVE_FIELD_CLEARANCE } : null,
          ]}
          onScrollBeginDrag={() => Keyboard.dismiss()}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{strings.settingsPersonalInfoTitle}</Text>
            <InfoRow icon="user" iconColor="#7B5C47" label={strings.settingsFullNameLabel} value={displayName} onPress={() => openEdit("fullName", displayName)} />
            <InfoRow icon="mail" iconColor="#7B5C47" label={strings.settingsEmailLabel} value={displayEmail} onPress={null} />
            <InfoRow icon="phone" iconColor="#7B5C47" label={strings.settingsPhoneLabel} value={displayPhone} onPress={() => openEdit("phone", displayPhone)} />
            <InfoRow icon="map-pin" iconColor="#D4A437" label={strings.settingsAddressLabel} value={displayAddress} onPress={() => openEdit("address", displayAddress)} isLast />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{strings.settingsSecurityTitle}</Text>
            <SecurityRow icon="lock" iconColor="#7D5BA6" title={strings.settingsChangePasswordTitle} subtitle={strings.settingsChangePasswordSubtitle} onPress={() => router.push("/change-password")} />
            <SecurityRow
              icon="shield"
              iconColor="#7D5BA6"
              title={strings.settingsTwoFactorTitle}
              subtitle={strings.settingsTwoFactorSubtitle}
              onPress={() => Alert.alert(strings.settingsComingSoonTitle, strings.settingsTwoFactorSoonBody)}
            />
            <SecurityRow
              icon="smartphone"
              iconColor="#7D5BA6"
              title={strings.settingsDevicesTitle}
              subtitle={strings.settingsDevicesSubtitle}
              onPress={() => Alert.alert(strings.settingsComingSoonTitle, strings.settingsDevicesSoonBody)}
              isLast
            />
          </View>

          {canSelectAdminBranch(role) ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{strings.settingsBranchTitle}</Text>
              <SecurityRow icon="map" iconColor="#D4A437" title={strings.settingsCurrentBranchLabel} subtitle={selectedBranchName} onPress={() => setBranchModalOpen(true)} isLast />
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{strings.settingsLanguageTitle}</Text>
            <SecurityRow icon="globe" iconColor="#2563EB" title={strings.settingsCurrentLanguageLabel} subtitle={currentLanguageName} onPress={() => setLanguageModalOpen(true)} isLast />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{cacheText.cardTitle}</Text>
            <SecurityRow
              icon="database"
              iconColor="#2C9B5F"
              title={clearingCache ? cacheText.actionBusyLabel : cacheText.actionLabel}
              subtitle={cacheSize}
              onPress={handleClearCache}
              disabled={clearingCache}
              isLast
            />
          </View>

          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Feather name="log-out" size={18} color={palette.danger} />
            <Text style={styles.logoutButtonText}>{strings.settingsLogout}</Text>
          </Pressable>
        </AdminKeyboardAwareScrollView>
      </KeyboardAvoidingView>

      <Modal visible={editingField !== null} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setEditingField(null)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>{translate(locale, "admin", "settingsEditFieldTitle", { field: editFieldLabel })}</Text>
            <View style={styles.modalInputWrapper}>
              <AdminKeyboardTextInput
                style={styles.modalInput}
                value={editValue}
                onChangeText={setEditValue}
                placeholder={translate(locale, "admin", "settingsEditFieldPlaceholder", { field: editFieldLabel })}
                placeholderTextColor={palette.textMuted}
                autoFocus
              />
            </View>
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancelButton} onPress={() => setEditingField(null)}>
                <Text style={styles.modalCancelText}>{strings.settingsCancelButton}</Text>
              </Pressable>
              <Pressable style={styles.modalSaveButton} onPress={() => void saveEdit()} disabled={saving}>
                <Text style={styles.modalSaveText}>{saving ? strings.settingsSavingButton : strings.settingsSaveButton}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={branchModalOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setBranchModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>{strings.settingsBranchModalTitle}</Text>
            <View style={styles.branchOptionList}>
              {branchOptions.map((branch) => {
                const active = branch.id === profileData?.branchId;
                return (
                  <Pressable
                    key={branch.id}
                    style={[styles.branchOptionRow, active ? styles.branchOptionRowActive : null]}
                    onPress={() => void handleBranchChange(branch.id)}
                    disabled={saving}
                  >
                    <View style={styles.branchOptionCopy}>
                      <Text style={styles.branchOptionTitle}>{branch.name}</Text>
                      <Text style={styles.branchOptionSubtitle}>
                        {active ? strings.settingsBranchActiveSubtitle : strings.settingsBranchSwitchSubtitle}
                      </Text>
                    </View>
                    {active ? <Feather name="check-circle" size={20} color={palette.primary} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={languageModalOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setLanguageModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>{strings.settingsLanguageModalTitle}</Text>
            <View style={styles.branchOptionList}>
              {languageOptions.map((option) => {
                const active = option.value === locale;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.branchOptionRow, active ? styles.branchOptionRowActive : null]}
                    onPress={() => void handleLanguageChange(option.value)}
                    disabled={saving}
                  >
                    <View style={styles.branchOptionCopy}>
                      <Text style={styles.branchOptionTitle}>{option.label}</Text>
                      <Text style={styles.branchOptionSubtitle}>{option.shortLabel}</Text>
                    </View>
                    {active ? <Feather name="check-circle" size={20} color={palette.primary} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <AdminBottomNavDock current="profile" role={role} onNavigate={(target) => void router.replace(getAdminNavHref(target, role))} />
    </View>
  );
}

function InfoRow({
  icon,
  iconColor,
  label,
  value,
  onPress,
  isLast = false,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  iconColor?: string;
  label: string;
  value: string;
  onPress: (() => void) | null;
  isLast?: boolean;
}) {
  return (
    <Pressable style={[styles.infoRow, !isLast && styles.infoRowBorder]} onPress={onPress} disabled={!onPress}>
      <View style={styles.infoIconCircle}>
        <Feather name={icon} size={16} color={iconColor ?? palette.primary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {onPress ? <Feather name="chevron-right" size={20} color={palette.textMuted} /> : null}
    </Pressable>
  );
}

function SecurityRow({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  disabled = false,
  isLast = false,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  iconColor?: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
  isLast?: boolean;
}) {
  return (
    <Pressable style={[styles.securityRow, !isLast && styles.securityRowBorder, disabled ? styles.rowDisabled : null]} onPress={onPress} disabled={disabled}>
      <View style={styles.securityIconCircle}>
        <Feather name={icon} size={18} color={iconColor ?? palette.primary} />
      </View>
      <View style={styles.securityContent}>
        <Text style={styles.securityTitle}>{title}</Text>
        <Text style={styles.securitySubtitle}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={palette.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  topChrome: { paddingHorizontal: 18, paddingBottom: 8 },
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: ADMIN_CONTENT_BOTTOM_NAV_CLEARANCE, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 2, paddingVertical: 4, marginBottom: 4 },
  headerButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: "800", color: palette.textPrimary, textAlign: "center", letterSpacing: -0.4 },
  card: { backgroundColor: palette.card, borderRadius: 18, borderWidth: 1, borderColor: palette.border, padding: 16, gap: 0 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: palette.textPrimary, marginBottom: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
  infoRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  infoIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: palette.beige, alignItems: "center", justifyContent: "center" },
  infoContent: { flex: 1, gap: 2 },
  infoLabel: { fontSize: 12, color: palette.textMuted, fontWeight: "500" },
  infoValue: { fontSize: 14, color: palette.textPrimary, fontWeight: "600" },
  securityRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
  securityRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  rowDisabled: { opacity: 0.55 },
  securityIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.beige, alignItems: "center", justifyContent: "center" },
  securityContent: { flex: 1, gap: 2 },
  securityTitle: { fontSize: 14, fontWeight: "700", color: palette.textPrimary },
  securitySubtitle: { fontSize: 12, color: palette.textMuted },
  logoutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 48, borderRadius: 14, borderWidth: 1, borderColor: palette.danger, backgroundColor: palette.card },
  logoutButtonText: { fontSize: 14, fontWeight: "700", color: palette.danger },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalCard: { backgroundColor: palette.card, borderRadius: 24, padding: 24, width: "85%", maxWidth: 420 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: palette.textPrimary, textAlign: "center", marginBottom: 20 },
  modalInputWrapper: { borderWidth: 1, borderColor: palette.border, borderRadius: 14, backgroundColor: palette.beigeLight, marginBottom: 20 },
  modalInput: { fontSize: 16, color: palette.textPrimary, padding: 16 },
  modalButtons: { flexDirection: "row", gap: 12 },
  modalCancelButton: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: palette.border, alignItems: "center", justifyContent: "center" },
  modalCancelText: { fontSize: 15, fontWeight: "600", color: palette.textSecondary },
  modalSaveButton: { flex: 1, height: 48, borderRadius: 14, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  modalSaveText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  branchOptionList: { gap: 8 },
  branchOptionRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: palette.beigeLight },
  branchOptionRowActive: { borderColor: palette.primary, backgroundColor: palette.beige },
  branchOptionCopy: { flex: 1, gap: 3 },
  branchOptionTitle: { fontSize: 14, fontWeight: "700", color: palette.textPrimary },
  branchOptionSubtitle: { fontSize: 12, color: palette.textSecondary },
});
