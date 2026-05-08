import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ensureOrgContext } from "@nails/shared";
import { canSelectAdminBranch, getAdminNavHref, getAdminProfileDestination } from "@/src/features/admin/navigation";
import { AdminBottomNavDock, AdminHeaderActions, getAdminBottomBarPadding, getAdminHeaderTopPadding } from "@/src/features/admin/ui";
import { upsertAndVerifyProfile } from "@/src/lib/profile-upsert";
import { mobileSupabase } from "@/src/lib/supabase";
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
type BranchOption = { id: string; name: string };
type ProfileData = {
  phone: string;
  address: string;
  fullName: string;
  branchId: string | null;
};

export default function AdminSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut, role, refreshSession } = useSession();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState<EditField>(null);
  const [editValue, setEditValue] = useState("");
  const [branchModalOpen, setBranchModalOpen] = useState(false);

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
          const { data: branches } = await mobileSupabase
            .from("branches")
            .select("id,name")
            .eq("org_id", orgId)
            .order("created_at", { ascending: true });

          setBranchOptions(
            (branches ?? []).map((branch) => ({
              id: String(branch.id ?? ""),
              name: typeof branch.name === "string" && branch.name.trim() ? branch.name.trim() : "Chi nhánh",
            })),
          );
        }
      } catch (error) {
        console.error("Failed to load admin profile", error);
      }
    }

    void loadProfileData();
  }, [role, user?.displayName, user?.id]);

  const displayName = profileData?.fullName || user?.displayName?.trim() || "User";
  const displayEmail = user?.email || "Chưa cập nhật";
  const displayPhone = profileData?.phone || "Chưa cập nhật";
  const displayAddress = profileData?.address || "Chưa cập nhật";
  const selectedBranchName = useMemo(
    () => branchOptions.find((branch) => branch.id === profileData?.branchId)?.name || "Chưa chọn chi nhánh",
    [branchOptions, profileData?.branchId],
  );

  function openEdit(field: EditField, currentValue: string) {
    setEditingField(field);
    setEditValue(currentValue === "Chưa cập nhật" ? "" : currentValue);
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

      const verifiedProfile = await upsertAndVerifyProfile({
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
      Alert.alert("Đã lưu", "Thông tin đã được cập nhật.");
    } catch (error) {
      Alert.alert("Lỗi", error instanceof Error ? error.message : "Không thể lưu thông tin. Vui lòng thử lại.");
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
      const verifiedProfile = await upsertAndVerifyProfile({
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
      Alert.alert("Đã đổi chi nhánh", "Ứng dụng sẽ dùng chi nhánh mới cho dữ liệu quản trị.");
    } catch (error) {
      Alert.alert("Lỗi", error instanceof Error ? error.message : "Không thể đổi chi nhánh.");
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    Alert.alert("Đăng xuất", "Bạn có chắc chắn muốn đăng xuất không?", [
      { text: "Hủy", style: "cancel" },
      { text: "Đăng xuất", style: "destructive", onPress: () => void signOut() },
    ]);
  }

  function getEditLabel(field: EditField) {
    switch (field) {
      case "fullName":
        return "họ và tên";
      case "phone":
        return "số điện thoại";
      case "address":
        return "địa chỉ";
      default:
        return "";
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.screen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={8}
          style={styles.screen}
        >
          <ScrollView
            contentContainerStyle={[
              styles.content,
              {
                paddingTop: getAdminHeaderTopPadding(insets.top),
                paddingBottom: 84 + getAdminBottomBarPadding(insets.bottom),
              },
            ]}
            contentInsetAdjustmentBehavior="always"
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.header}>
            <Pressable style={styles.headerButton} onPress={() => router.replace(getAdminProfileDestination(role))}>
              <Feather name="chevron-left" size={24} color={palette.textPrimary} />
            </Pressable>
            <Text style={styles.headerTitle}>Cài đặt cá nhân</Text>
            <AdminHeaderActions onSettingsPress={() => undefined} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Thông tin cá nhân</Text>
            <InfoRow icon="user" label="Họ và tên" value={displayName} onPress={() => openEdit("fullName", displayName)} />
            <InfoRow icon="mail" label="Email" value={displayEmail} onPress={null} />
            <InfoRow icon="phone" label="Số điện thoại" value={displayPhone} onPress={() => openEdit("phone", displayPhone)} />
            <InfoRow icon="map-pin" label="Địa chỉ" value={displayAddress} onPress={() => openEdit("address", displayAddress)} isLast />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bảo mật tài khoản</Text>
            <SecurityRow icon="lock" title="Đổi mật khẩu" subtitle="Cập nhật mật khẩu để bảo vệ tài khoản" onPress={() => router.push("/(admin)/change-password")} />
            <SecurityRow icon="shield" title="Xác thực 2 lớp" subtitle="Tính năng sẽ sớm được bổ sung" onPress={() => Alert.alert("Đang phát triển", "Tính năng xác thực 2 lớp sẽ sớm được bổ sung.")} />
            <SecurityRow icon="smartphone" title="Thiết bị đăng nhập" subtitle="Tính năng sẽ sớm được bổ sung" onPress={() => Alert.alert("Đang phát triển", "Tính năng quản lý thiết bị sẽ sớm được bổ sung.")} isLast />
          </View>

          {canSelectAdminBranch(role) ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Chi nhánh quản trị</Text>
              <SecurityRow icon="map" title="Chi nhánh hiện tại" subtitle={selectedBranchName} onPress={() => setBranchModalOpen(true)} isLast />
            </View>
          ) : null}

          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Feather name="log-out" size={18} color={palette.danger} />
            <Text style={styles.logoutButtonText}>Đăng xuất</Text>
          </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal visible={editingField !== null} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setEditingField(null)}>
            <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
              <Text style={styles.modalTitle}>Chỉnh sửa {getEditLabel(editingField)}</Text>
              <View style={styles.modalInputWrapper}>
                <TextInput
                  style={styles.modalInput}
                  value={editValue}
                  onChangeText={setEditValue}
                  placeholder={`Nhập ${getEditLabel(editingField)}`}
                  placeholderTextColor={palette.textMuted}
                  autoFocus
                />
              </View>
              <View style={styles.modalButtons}>
                <Pressable style={styles.modalCancelButton} onPress={() => setEditingField(null)}>
                  <Text style={styles.modalCancelText}>Hủy</Text>
                </Pressable>
                <Pressable style={styles.modalSaveButton} onPress={() => void saveEdit()} disabled={saving}>
                  <Text style={styles.modalSaveText}>{saving ? "Đang lưu..." : "Lưu"}</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={branchModalOpen} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setBranchModalOpen(false)}>
            <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
              <Text style={styles.modalTitle}>Chọn chi nhánh</Text>
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
                          {active ? "Đang sử dụng" : "Chuyển dữ liệu quản trị sang chi nhánh này"}
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

        <AdminBottomNavDock current="profile" role={role} insetBottom={insets.bottom} onNavigate={(target) => void router.replace(getAdminNavHref(target, role))} />
      </View>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  onPress,
  isLast = false,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  onPress: (() => void) | null;
  isLast?: boolean;
}) {
  return (
    <Pressable style={[styles.infoRow, !isLast && styles.infoRowBorder]} onPress={onPress} disabled={!onPress}>
      <View style={styles.infoIconCircle}>
        <Feather name={icon} size={16} color={palette.primary} />
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
  title,
  subtitle,
  onPress,
  isLast = false,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  subtitle: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable style={[styles.securityRow, !isLast && styles.securityRowBorder]} onPress={onPress}>
      <View style={styles.securityIconCircle}>
        <Feather name={icon} size={18} color={palette.primary} />
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
  safeArea: { flex: 1, backgroundColor: palette.bg },
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingVertical: 8, marginBottom: 8 },
  headerButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: "800", color: palette.textPrimary, textAlign: "center", letterSpacing: -0.4 },
  card: { backgroundColor: palette.card, borderRadius: 20, borderWidth: 1, borderColor: palette.border, padding: 20, gap: 0 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: palette.textPrimary, marginBottom: 16 },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 16, gap: 14 },
  infoRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  infoIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.beige, alignItems: "center", justifyContent: "center" },
  infoContent: { flex: 1, gap: 2 },
  infoLabel: { fontSize: 12, color: palette.textMuted, fontWeight: "500" },
  infoValue: { fontSize: 15, color: palette.textPrimary, fontWeight: "600" },
  securityRow: { flexDirection: "row", alignItems: "center", paddingVertical: 16, gap: 14 },
  securityRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  securityIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.beige, alignItems: "center", justifyContent: "center" },
  securityContent: { flex: 1, gap: 4 },
  securityTitle: { fontSize: 15, fontWeight: "700", color: palette.textPrimary },
  securitySubtitle: { fontSize: 13, color: palette.textMuted },
  logoutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 52, borderRadius: 16, borderWidth: 1, borderColor: palette.danger, backgroundColor: palette.card },
  logoutButtonText: { fontSize: 15, fontWeight: "700", color: palette.danger },
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
  branchOptionList: { gap: 10 },
  branchOptionRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: palette.beigeLight },
  branchOptionRowActive: { borderColor: palette.primary, backgroundColor: palette.beige },
  branchOptionCopy: { flex: 1, gap: 3 },
  branchOptionTitle: { fontSize: 15, fontWeight: "700", color: palette.textPrimary },
  branchOptionSubtitle: { fontSize: 12, color: palette.textSecondary },
});
