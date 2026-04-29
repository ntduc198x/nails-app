import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ensureOrgContext } from "@nails/shared";
import { canSelectAdminBranch, getAdminNavHref, getAdminProfileDestination } from "@/src/features/admin/navigation";
import { AdminBottomNav, AdminHeaderActions, getAdminBottomBarPadding, getAdminHeaderTopPadding } from "@/src/features/admin/ui";
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
type BranchOption = {
  id: string;
  name: string;
};

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

        const { data, error } = await mobileSupabase
          .from("profiles")
          .select("phone, address, display_name, default_branch_id")
          .eq("user_id", user.id)
          .eq("org_id", orgId)
          .single();

        if (!error && data) {
          setProfileData({
            phone: typeof data.phone === "string" ? data.phone : "",
            address: typeof data.address === "string" ? data.address : "",
            fullName: typeof data.display_name === "string" ? data.display_name : "",
            branchId: typeof data.default_branch_id === "string" ? data.default_branch_id : branchId,
          });
        }

        if (canSelectAdminBranch(role)) {
          const { data: branches, error: branchesError } = await mobileSupabase
            .from("branches")
            .select("id, name")
            .eq("org_id", orgId)
            .order("created_at", { ascending: true });

          if (!branchesError) {
            setBranchOptions(
              (branches ?? []).map((branch) => ({
                id: String(branch.id ?? ""),
                name: typeof branch.name === "string" && branch.name.trim() ? branch.name.trim() : "Chi nhanh",
              })),
            );
          }
        }
      } catch (error) {
        console.error("Failed to load profile data:", error);
      }
    }

    void loadProfileData();
  }, [role, user?.id]);

  const displayName = profileData?.fullName || user?.displayName?.trim() || "User";
  const displayEmail = user?.email || "Chua cap nhat";
  const displayPhone = profileData?.phone || "Chua cap nhat";
  const displayAddress = profileData?.address || "Chua cap nhat";
  const selectedBranchName =
    branchOptions.find((branch) => branch.id === profileData?.branchId)?.name || "Chua chon chi nhanh";

  function openEdit(field: EditField, currentValue: string) {
    setEditingField(field);
    setEditValue(currentValue === "Chua cap nhat" ? "" : currentValue);
  }

  async function saveEdit() {
    if (!editingField || !mobileSupabase || !user?.id) return;

    setSaving(true);
    try {
      const { orgId } = await ensureOrgContext(mobileSupabase);
      const updateData: Record<string, string> = {};

      if (editingField === "fullName") updateData.display_name = editValue.trim();
      if (editingField === "phone") updateData.phone = editValue.trim();
      if (editingField === "address") updateData.address = editValue.trim();
      updateData.updated_at = new Date().toISOString();

      const { error } = await mobileSupabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", user.id)
        .eq("org_id", orgId);

      if (error) throw error;

      setProfileData((prev) => (prev ? { ...prev, [editingField]: editValue.trim() } : prev));
      setEditingField(null);
      Alert.alert("Da luu", "Thong tin da duoc cap nhat.");
    } catch {
      Alert.alert("Loi", "Khong the luu thong tin. Vui long thu lai.");
    } finally {
      setSaving(false);
    }
  }

  async function handleBranchChange(branchId: string) {
    if (!mobileSupabase || !user?.id || !canSelectAdminBranch(role) || branchId === profileData?.branchId) {
      setBranchModalOpen(false);
      return;
    }

    setSaving(true);
    try {
      const { orgId } = await ensureOrgContext(mobileSupabase);
      const { error } = await mobileSupabase
        .from("profiles")
        .update({
          default_branch_id: branchId,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("org_id", orgId);

      if (error) throw error;

      setProfileData((prev) => (prev ? { ...prev, branchId } : prev));
      await refreshSession();
      setBranchModalOpen(false);
      Alert.alert("Da doi chi nhanh", "Ung dung se dung chi nhanh moi cho du lieu quan tri.");
    } catch {
      Alert.alert("Loi", "Khong the doi chi nhanh. Vui long thu lai.");
    } finally {
      setSaving(false);
    }
  }

  function handlePasswordPress() {
    router.push("/(admin)/change-password");
  }

  function handleTwoFactorPress() {
    Alert.alert("Dang phat trien", "Tinh nang xac thuc 2 lop se som duoc bo sung.");
  }

  function handleDevicesPress() {
    Alert.alert("Dang phat trien", "Tinh nang quan ly thiet bi dang nhap se som duoc bo sung.");
  }

  function handleLogout() {
    Alert.alert("Dang xuat", "Ban co chac chan muon dang xuat khong?", [
      { text: "Huy", style: "cancel" },
      { text: "Dang xuat", style: "destructive", onPress: () => void signOut() },
    ]);
  }

  function getEditLabel(field: EditField) {
    switch (field) {
      case "fullName":
        return "ho va ten";
      case "phone":
        return "so dien thoai";
      case "address":
        return "dia chi";
      default:
        return "";
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: getAdminHeaderTopPadding(insets.top) + 8,
              paddingBottom: 120 + insets.bottom,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable style={styles.headerButton} onPress={() => router.replace(getAdminProfileDestination(role))}>
              <Feather name="chevron-left" size={24} color={palette.textPrimary} />
            </Pressable>
            <Text style={styles.headerTitle}>Cai dat ca nhan</Text>
            <AdminHeaderActions onSettingsPress={() => undefined} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Thong tin ca nhan</Text>
            <InfoRow icon="user" label="Ho va ten" value={displayName} onPress={() => openEdit("fullName", displayName)} />
            <InfoRow icon="mail" label="Email" value={displayEmail} onPress={null} />
            <InfoRow icon="phone" label="So dien thoai" value={displayPhone} onPress={() => openEdit("phone", displayPhone)} />
            <InfoRow icon="map-pin" label="Dia chi" value={displayAddress} onPress={() => openEdit("address", displayAddress)} isLast />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bao mat tai khoan</Text>
            <SecurityRow
              icon="lock"
              title="Doi mat khau"
              subtitle="Cap nhat mat khau de bao ve tai khoan"
              onPress={handlePasswordPress}
            />
            <SecurityRow
              icon="shield"
              title="Xac thuc 2 lop"
              subtitle="Tang cuong bao mat cho tai khoan"
              onPress={handleTwoFactorPress}
            />
            <SecurityRow
              icon="smartphone"
              title="Thiet bi dang nhap"
              subtitle="Quan ly cac thiet bi da dang nhap"
              onPress={handleDevicesPress}
              isLast
            />
          </View>

          {canSelectAdminBranch(role) ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Chi nhanh quan tri</Text>
              <SecurityRow
                icon="map"
                title="Chi nhanh hien tai"
                subtitle={selectedBranchName}
                onPress={() => setBranchModalOpen(true)}
                isLast
              />
            </View>
          ) : null}

          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Feather name="log-out" size={18} color={palette.danger} />
            <Text style={styles.logoutButtonText}>Dang xuat</Text>
          </Pressable>
        </ScrollView>

        <Modal visible={editingField !== null} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setEditingField(null)}>
            <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
              <Text style={styles.modalTitle}>Chinh sua {getEditLabel(editingField)}</Text>
              <View style={styles.modalInputWrapper}>
                <TextInput
                  style={styles.modalInput}
                  value={editValue}
                  onChangeText={setEditValue}
                  placeholder={`Nhap ${getEditLabel(editingField)}`}
                  placeholderTextColor={palette.textMuted}
                  autoFocus
                />
              </View>
              <View style={styles.modalButtons}>
                <Pressable style={styles.modalCancelButton} onPress={() => setEditingField(null)}>
                  <Text style={styles.modalCancelText}>Huy</Text>
                </Pressable>
                <Pressable style={styles.modalSaveButton} onPress={saveEdit} disabled={saving}>
                  <Text style={styles.modalSaveText}>{saving ? "Dang luu..." : "Luu"}</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={branchModalOpen} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setBranchModalOpen(false)}>
            <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
              <Text style={styles.modalTitle}>Chon chi nhanh</Text>
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
                          {active ? "Dang su dung" : "Chuyen du lieu quan tri sang chi nhanh nay"}
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

        <View style={[styles.bottomBar, { paddingBottom: getAdminBottomBarPadding(insets.bottom) }]}>
          <AdminBottomNav current="profile" role={role} onNavigate={(target) => void router.replace(getAdminNavHref(target, role))} />
        </View>
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
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(255,255,255,0.98)", borderTopWidth: 1, borderTopColor: palette.border, paddingHorizontal: 14, paddingTop: 8 },
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
