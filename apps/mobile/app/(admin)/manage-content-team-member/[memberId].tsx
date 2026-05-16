import Feather from "@expo/vector-icons/Feather";
import * as ImagePicker from "expo-image-picker";
import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { MobileAdminContentSnapshot, MobileAdminStorefrontTeamMemberInput } from "@nails/shared";
import { createAdminStorefrontTeamMemberForMobile, listAdminContentSnapshotForMobile, updateAdminStorefrontTeamMemberForMobile } from "@nails/shared";
import { CachedAppImage } from "@/src/components/cached-app-image";
import { uploadPickedAdminContentImage } from "@/src/features/admin/content-images";
import { ManageScreenShell } from "@/src/features/admin/manage-ui";
import { dismissToHref } from "@/src/features/admin/navigation";
import { AdminKeyboardTextInput } from "@/src/features/admin/ui";
import { mobileSupabase } from "@/src/lib/supabase";

const palette = {
  border: "#EADFD3",
  card: "#FFFFFF",
  text: "#2F241D",
  sub: "#84776C",
  accent: "#A56D3D",
  accentSoft: "#F5E9DD",
};

type TeamFormState = {
  id?: string;
  displayName: string;
  roleLabel: string;
  avatarUrl: string;
  bio: string;
  displayOrder: string;
  isVisible: boolean;
};

function emptyTeamForm(): TeamFormState {
  return { displayName: "", roleLabel: "", avatarUrl: "", bio: "", displayOrder: "0", isVisible: true };
}

function parseNumberInput(value: string) {
  return Number(value.replace(/[^\d.-]/g, "") || 0);
}

export default function AdminManageContentTeamMemberDetailScreen() {
  const params = useLocalSearchParams<{ memberId?: string; backHref?: string }>();
  const router = useRouter();
  const memberId = typeof params.memberId === "string" ? params.memberId : "new";
  const isCreate = memberId === "new";
  const backHref = (typeof params.backHref === "string" ? params.backHref : "/(admin)/manage-content-team") as Href;

  const [snapshot, setSnapshot] = useState<MobileAdminContentSnapshot | null>(null);
  const [form, setForm] = useState<TeamFormState>(emptyTeamForm());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    if (!mobileSupabase) {
      setError("Thiếu cấu hình Database mobile.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const next = await listAdminContentSnapshotForMobile(mobileSupabase, { includeServices: false });
      setSnapshot(next);
      if (isCreate) {
        setForm(emptyTeamForm());
      } else {
        const member = next.team.find((item) => item.id === memberId);
        if (!member) throw new Error("Không tìm thấy nhân sự cần chỉnh sửa.");
        setForm({ id: member.id, displayName: member.displayName, roleLabel: member.roleLabel ?? "", avatarUrl: member.avatarUrl ?? "", bio: member.bio ?? "", displayOrder: String(member.displayOrder), isVisible: member.isVisible });
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không tải được nhân sự.");
    } finally {
      setIsLoading(false);
    }
  }, [isCreate, memberId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadSnapshot();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [loadSnapshot]);

  async function pickAndUploadImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Cần cấp quyền", "Hãy cấp quyền thư viện ảnh để tải ảnh đại diện.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;

    try {
      const uploaded = await uploadPickedAdminContentImage(result.assets[0], { folder: "storefront", baseName: form.displayName || "team-member" });
      setForm((current) => ({ ...current, avatarUrl: uploaded.publicUrl }));
    } catch (nextError) {
      Alert.alert("Không tải được ảnh", nextError instanceof Error ? nextError.message : "Thử lại sau.");
    }
  }

  async function handleSave() {
    if (!mobileSupabase || !snapshot?.storefront?.id) return;
    if (!form.displayName.trim()) {
      Alert.alert("Thiếu dữ liệu", "Cần nhập tên hiển thị của nhân sự.");
      return;
    }

    setIsSaving(true);
    try {
      const payload: MobileAdminStorefrontTeamMemberInput = {
        displayName: form.displayName.trim(),
        roleLabel: form.roleLabel.trim() || null,
        avatarUrl: form.avatarUrl.trim() || null,
        bio: form.bio.trim() || null,
        displayOrder: parseNumberInput(form.displayOrder),
        isVisible: form.isVisible,
      };
      if (form.id) {
        await updateAdminStorefrontTeamMemberForMobile(mobileSupabase, form.id, payload);
      } else {
        await createAdminStorefrontTeamMemberForMobile(mobileSupabase, snapshot.storefront.id, payload);
      }
      dismissToHref(router, backHref);
    } catch (nextError) {
      Alert.alert("Không lưu nhân sự", nextError instanceof Error ? nextError.message : "Thử lại sau.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ManageScreenShell title={isCreate ? "Thêm nhân sự" : "Sửa nhân sự"} subtitle="Màn chỉnh sửa riêng để quay lại danh sách bằng gesture." currentKey="content" group="setup" backHref={backHref} showTabs={false} showBottomDock={false}>
      <View style={styles.sectionCard}>
        {isLoading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={palette.accent} />
            <Text style={styles.stateText}>Đang tải nhân sự...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => void loadSnapshot()}>
              <Text style={styles.retryButtonText}>Tải lại</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.formColumn}>
            {form.avatarUrl ? <CachedAppImage source={{ uri: form.avatarUrl }} style={styles.previewImage} alt={form.displayName || "member"} /> : null}
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Tên hiển thị</Text>
              <AdminKeyboardTextInput placeholder="Ngọc Anh" placeholderTextColor="#B4A89C" style={styles.input} value={form.displayName} onChangeText={(value) => setForm((current) => ({ ...current, displayName: value }))} />
            </View>
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Chức danh</Text>
              <AdminKeyboardTextInput placeholder="Nail artist" placeholderTextColor="#B4A89C" style={styles.input} value={form.roleLabel} onChangeText={(value) => setForm((current) => ({ ...current, roleLabel: value }))} />
            </View>
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Ảnh đại diện</Text>
              <View style={styles.inlineRow}>
                <AdminKeyboardTextInput placeholder="https://..." placeholderTextColor="#B4A89C" style={[styles.input, styles.flexInput]} value={form.avatarUrl} onChangeText={(value) => setForm((current) => ({ ...current, avatarUrl: value }))} />
                <Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage()}>
                  <Feather name="upload" size={18} color={palette.accent} />
                  <Text style={styles.secondaryButtonText}>Tải ảnh</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Giới thiệu ngắn</Text>
              <AdminKeyboardTextInput multiline scrollEnabled={false} placeholder="Mô tả ngắn về nhân sự." placeholderTextColor="#B4A89C" style={[styles.input, styles.textarea]} textAlignVertical="top" value={form.bio} onChangeText={(value) => setForm((current) => ({ ...current, bio: value }))} />
            </View>
            <View style={styles.inlineRow}>
              <View style={[styles.fieldBlock, styles.flexBlock]}>
                <Text style={styles.label}>Thứ tự hiển thị</Text>
                <AdminKeyboardTextInput placeholder="0" placeholderTextColor="#B4A89C" keyboardType="number-pad" style={styles.input} value={form.displayOrder} onChangeText={(value) => setForm((current) => ({ ...current, displayOrder: value }))} />
              </View>
              <Pressable style={[styles.toggleChip, form.isVisible ? styles.toggleChipActive : null]} onPress={() => setForm((current) => ({ ...current, isVisible: !current.isVisible }))}>
                <Text style={[styles.toggleText, form.isVisible ? styles.toggleTextActive : null]}>{form.isVisible ? "Đang hiển thị" : "Đang ẩn"}</Text>
              </Pressable>
            </View>
            <Pressable style={styles.primaryButton} onPress={() => void handleSave()} disabled={isSaving}>
              <Text style={styles.primaryButtonText}>{isSaving ? "Đang lưu..." : "Lưu nhân sự"}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ManageScreenShell>
  );
}

const styles = StyleSheet.create({
  sectionCard: { borderRadius: 24, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, padding: 16, gap: 14 },
  formColumn: { gap: 14 },
  fieldBlock: { gap: 8 },
  label: { fontSize: 13, lineHeight: 18, color: palette.text, fontWeight: "700" },
  input: { minHeight: 52, borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingVertical: 13, color: palette.text, fontSize: 14 },
  textarea: { minHeight: 88 },
  previewImage: { width: "100%", aspectRatio: 1.1, borderRadius: 18, backgroundColor: "#F4ECE2" },
  inlineRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  flexInput: { flex: 1 },
  flexBlock: { flex: 1 },
  secondaryButton: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FFF9F3" },
  secondaryButtonText: { color: palette.accent, fontSize: 13, fontWeight: "700" },
  toggleChip: { minHeight: 52, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: "#FFFCF9", alignItems: "center", justifyContent: "center" },
  toggleChipActive: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
  toggleText: { color: palette.sub, fontSize: 13, fontWeight: "700" },
  toggleTextActive: { color: palette.accent },
  primaryButton: { minHeight: 52, borderRadius: 18, backgroundColor: palette.accent, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  stateCard: { borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: "#FFFCF9", padding: 16, alignItems: "center", gap: 10 },
  stateText: { fontSize: 13, lineHeight: 18, color: palette.sub },
  errorText: { fontSize: 13, lineHeight: 18, color: "#C25A43", textAlign: "center" },
  retryButton: { minHeight: 40, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: palette.border, alignItems: "center", justifyContent: "center" },
  retryButtonText: { color: palette.accent, fontSize: 13, fontWeight: "700" },
});
