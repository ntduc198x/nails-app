import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AdminBottomNav, getAdminBottomBarPadding, getAdminHeaderTopPadding } from "@/src/features/admin/ui";
import { useAdminOperations } from "@/src/hooks/use-admin-operations";
import { mobileSupabase } from "@/src/lib/supabase";
import { useSession } from "@/src/providers/session-provider";
import { ensureOrgContext } from "@nails/shared";
import { getAdminNavHref, getAdminProfileDestination } from "@/src/features/admin/navigation";

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
  dangerSoft: "#FEE2E2",
};

type EditField = "fullName" | "phone" | "address" | null;

export default function AdminSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut, role } = useSession();

  const [profileData, setProfileData] = useState<{ phone: string; address: string; fullName: string } | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Edit state
  const [editingField, setEditingField] = useState<EditField>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    async function loadProfileData() {
      if (!mobileSupabase || !user?.id) {
        return;
      }

      try {
        const { orgId } = await ensureOrgContext(mobileSupabase);
        
        const { data, error } = await mobileSupabase
          .from("profiles")
          .select("phone, address, display_name")
          .eq("user_id", user.id)
          .eq("org_id", orgId)
          .single();

        if (!error && data) {
          setProfileData({
            phone: typeof data.phone === "string" ? data.phone : "",
            address: typeof data.address === "string" ? data.address : "",
            fullName: typeof data.display_name === "string" ? data.display_name : "",
          });
        }
      } catch (error) {
        console.error("Failed to load profile data:", error);
      }
    }

    void loadProfileData();
  }, [user?.id]);

  const displayName = profileData?.fullName || user?.displayName?.trim() || "Nguyen Thuy Linh";
  const displayEmail = user?.email || "newupchance@gmail.com";
  const displayPhone = profileData?.phone || "Chưa cập nhật";
  const displayAddress = profileData?.address || "Chưa cập nhật";

  const { bookingRequests } = useAdminOperations();
  const newBookingCount = useMemo(
    () => bookingRequests.filter((item) => item.status === "NEW").length,
    [bookingRequests],
  );

  function openEdit(field: EditField, currentValue: string) {
    setEditingField(field);
    setEditValue(currentValue === "Chưa cập nhật" ? "" : currentValue);
  }

  async function saveEdit() {
    if (!editingField || !mobileSupabase || !user?.id) return;

    setSaving(true);
    try {
      const { orgId } = await ensureOrgContext(mobileSupabase);
      
      const updateData: Record<string, string> = {};
      
      if (editingField === "fullName") {
        updateData.display_name = editValue.trim();
      } else if (editingField === "phone") {
        updateData.phone = editValue.trim();
      } else if (editingField === "address") {
        updateData.address = editValue.trim();
      }

      updateData.updated_at = new Date().toISOString();

      const { error } = await mobileSupabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", user.id)
        .eq("org_id", orgId);

      if (error) throw error;

      setProfileData(prev => prev ? { ...prev, [editingField]: editValue.trim() } : null);
      setEditingField(null);
      Alert.alert("Đã lưu", "Thông tin đã được cập nhật.");
    } catch {
      Alert.alert("Lỗi", "Không thể lưu thông tin. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  function handlePasswordPress() {
    router.push("/(admin)/change-password");
  }

  function handleTwoFactorPress() {
    Alert.alert("Tính năng đang phát triển", "Chức năng xác thực 2 lớp sẽ được ra mắt sớm.");
  }

  function handleDevicesPress() {
    Alert.alert("Tính năng đang phát triển", "Chức năng quản lý thiết bị đăng nhập sẽ được ra mắt sớm.");
  }

  async function handleLogout() {
    Alert.alert(
      "Đăng xuất",
      "Bạn có chắc chắn muốn đăng xuất không?",
      [
        { text: "Hủy", style: "cancel" },
        { text: "Đăng xuất", style: "destructive", onPress: () => void signOut() },
      ]
    );
  }

  const getEditLabel = (field: EditField) => {
    switch (field) {
      case "fullName": return "Họ và tên";
      case "phone": return "Số điện thoại";
      case "address": return "Địa chỉ";
      default: return "";
    }
  };

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
          {/* Header */}
          <View style={styles.header}>
            <Pressable style={styles.headerButton} onPress={() => router.replace(getAdminProfileDestination(role))}>
              <Feather name="chevron-left" size={24} color={palette.textPrimary} />
            </Pressable>
            <Text style={styles.headerTitle}>Cài đặt cá nhân</Text>
            <View style={styles.headerActions}>
              <Pressable style={styles.headerIconButton}>
                <View>
                  <Feather name="bell" size={22} color={palette.textPrimary} />
                  {newBookingCount > 0 && (
                    <View style={styles.bellBadge}>
                      <Text style={styles.bellBadgeText}>{Math.min(newBookingCount, 9)}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
              <Pressable style={styles.headerIconButton}>
                <Feather name="settings" size={22} color={palette.textPrimary} />
              </Pressable>
            </View>
          </View>

          {/* Personal Info Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Thông tin cá nhân</Text>

            <InfoRow
              icon="user"
              label="Họ và tên"
              value={displayName}
              onPress={() => openEdit("fullName", displayName)}
            />
            <InfoRow
              icon="mail"
              label="Email"
              value={displayEmail}
              onPress={null}
            />
            <InfoRow
              icon="phone"
              label="Số điện thoại"
              value={displayPhone}
              onPress={() => openEdit("phone", displayPhone)}
            />
            <InfoRow
              icon="map-pin"
              label="Địa chỉ"
              value={displayAddress}
              onPress={() => openEdit("address", displayAddress)}
              isLast
            />
          </View>

          {/* Security Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bảo mật tài khoản</Text>

            <SecurityRow
              icon="lock"
              title="Đổi mật khẩu"
              subtitle="Cập nhật mật khẩu để bảo vệ tài khoản"
              onPress={handlePasswordPress}
            />
            <SecurityRow
              icon="shield"
              title="Xác thực 2 lớp"
              subtitle="Tăng cường bảo mật cho tài khoản"
              onPress={handleTwoFactorPress}
            />
            <SecurityRow
              icon="smartphone"
              title="Thiết bị đăng nhập"
              subtitle="Quản lý các thiết bị đã đăng nhập"
              onPress={handleDevicesPress}
              isLast
            />
          </View>

          {/* Logout Button */}
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Feather name="log-out" size={18} color={palette.danger} />
            <Text style={styles.logoutButtonText}>Đăng xuất</Text>
          </Pressable>
        </ScrollView>

        {/* Edit Modal */}
        <Modal visible={editingField !== null} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setEditingField(null)}>
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
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
                <Pressable style={styles.modalSaveButton} onPress={saveEdit} disabled={saving}>
                  <Text style={styles.modalSaveText}>{saving ? "Đang lưu..." : "Lưu"}</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Bottom Navigation */}
        <View style={[styles.bottomBar, { paddingBottom: getAdminBottomBarPadding(insets.bottom) }]}>
          <AdminBottomNav current="profile" role={role} onNavigate={(target) => void router.replace(getAdminNavHref(target, role))} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value, onPress, isLast = false }: { icon: React.ComponentProps<typeof Feather>["name"]; label: string; value: string; onPress: (() => void) | null; isLast?: boolean }) {
  return (
    <Pressable style={[styles.infoRow, !isLast && styles.infoRowBorder]} onPress={onPress} disabled={!onPress}>
      <View style={styles.infoIconCircle}>
        <Feather name={icon} size={16} color={palette.primary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
      </View>
      {onPress && <Feather name="chevron-right" size={20} color={palette.textMuted} />}
    </Pressable>
  );
}

function SecurityRow({ icon, title, subtitle, onPress, isLast = false }: { icon: React.ComponentProps<typeof Feather>["name"]; title: string; subtitle: string; onPress: () => void; isLast?: boolean }) {
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
  headerActions: { flexDirection: "row", gap: 4 },
  headerIconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  bellBadge: { position: "absolute", top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: palette.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  bellBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
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
  modalCard: { backgroundColor: palette.card, borderRadius: 24, padding: 24, width: "85%" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: palette.textPrimary, textAlign: "center", marginBottom: 20 },
  modalInputWrapper: { borderWidth: 1, borderColor: palette.border, borderRadius: 14, backgroundColor: palette.beigeLight, marginBottom: 20 },
  modalInput: { fontSize: 16, color: palette.textPrimary, padding: 16 },
  modalButtons: { flexDirection: "row", gap: 12 },
  modalCancelButton: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: palette.border, alignItems: "center", justifyContent: "center" },
  modalCancelText: { fontSize: 15, fontWeight: "600", color: palette.textSecondary },
  modalSaveButton: { flex: 1, height: 48, borderRadius: 14, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  modalSaveText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
});
