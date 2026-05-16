import Feather from "@expo/vector-icons/Feather";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { Href } from "expo-router";
import type { MobileAdminMerchService } from "@nails/shared";
import { listAdminMerchServicesForMobile, updateAdminMerchServiceForMobile } from "@nails/shared";
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

type MerchFormState = {
  id: string;
  name: string;
  shortDescription: string;
  imageUrl: string;
  durationLabel: string;
  featuredInHome: boolean;
  featuredInExplore: boolean;
  displayOrderHome: string;
  displayOrderExplore: string;
  lookbookCategory: string;
  lookbookBadge: string;
  lookbookTone: string;
};

function parseNumberInput(value: string) {
  return Number(value.replace(/[^\d.-]/g, "") || 0);
}

function buildMerchForm(service: MobileAdminMerchService): MerchFormState {
  return {
    id: service.id,
    name: service.name,
    shortDescription: service.shortDescription ?? "",
    imageUrl: service.imageUrl ?? "",
    durationLabel: service.durationLabel ?? "",
    featuredInHome: service.featuredInHome,
    featuredInExplore: service.featuredInExplore,
    displayOrderHome: String(service.displayOrderHome ?? 0),
    displayOrderExplore: String(service.displayOrderExplore ?? 0),
    lookbookCategory: service.lookbookCategory ?? "",
    lookbookBadge: service.lookbookBadge ?? "",
    lookbookTone: service.lookbookTone ?? "",
  };
}

export default function AdminManageContentServiceDetailScreen() {
  const params = useLocalSearchParams<{ serviceId?: string; context?: string; backHref?: string }>();
  const router = useRouter();
  const serviceId = typeof params.serviceId === "string" ? params.serviceId : "";
  const context = params.context === "home" ? "home" : "explore";
  const backHref = (typeof params.backHref === "string" ? params.backHref : "/(admin)/manage-content") as Href;

  const [form, setForm] = useState<MerchFormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadService = useCallback(async () => {
    if (!mobileSupabase) {
      setError("Thiếu cấu hình Database mobile.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const services = await listAdminMerchServicesForMobile(mobileSupabase);
      const service = services.find((item) => item.id === serviceId);
      if (!service) throw new Error("Không tìm thấy dịch vụ cần chỉnh sửa.");
      setForm(buildMerchForm(service));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không tải được dịch vụ.");
    } finally {
      setIsLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadService();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [loadService]);

  const title = useMemo(() => (context === "home" ? "Thiết lập dịch vụ Home" : "Thiết lập dịch vụ Explore"), [context]);

  async function pickAndUploadImage() {
    if (!form) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Cần cấp quyền", "Hãy cấp quyền thư viện ảnh để tải ảnh.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) return;

    try {
      const uploaded = await uploadPickedAdminContentImage(result.assets[0], {
        folder: "storefront",
        baseName: form.name || "service",
      });
      setForm((current) => (current ? { ...current, imageUrl: uploaded.publicUrl } : current));
    } catch (nextError) {
      Alert.alert("Không tải được ảnh", nextError instanceof Error ? nextError.message : "Thử lại sau.");
    }
  }

  async function handleSave() {
    if (!mobileSupabase || !form) return;
    setIsSaving(true);
    try {
      await updateAdminMerchServiceForMobile(mobileSupabase, {
        id: form.id,
        shortDescription: form.shortDescription,
        imageUrl: form.imageUrl,
        durationLabel: form.durationLabel,
        featuredInLookbook: form.featuredInHome || form.featuredInExplore,
        featuredInHome: form.featuredInHome,
        featuredInExplore: form.featuredInExplore,
        displayOrderHome: parseNumberInput(form.displayOrderHome),
        displayOrderExplore: parseNumberInput(form.displayOrderExplore),
        lookbookCategory: form.lookbookCategory,
        lookbookBadge: form.lookbookBadge,
        lookbookTone: form.lookbookTone,
      });
      dismissToHref(router, backHref);
    } catch (nextError) {
      Alert.alert("Không lưu được dịch vụ", nextError instanceof Error ? nextError.message : "Thử lại sau.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ManageScreenShell title={title} subtitle="Mở từ màn trước và có thể vuốt để quay lại." currentKey="content" group="setup" backHref={backHref} showTabs={false} showBottomDock={false}>
      <View style={styles.sectionCard}>
        {isLoading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={palette.accent} />
            <Text style={styles.stateText}>Đang tải dịch vụ...</Text>
          </View>
        ) : error || !form ? (
          <View style={styles.stateCard}>
            <Text style={styles.errorText}>{error ?? "Không có dữ liệu dịch vụ."}</Text>
            <Pressable style={styles.retryButton} onPress={() => void loadService()}>
              <Text style={styles.retryButtonText}>Tải lại</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.formColumn}>
            <View style={styles.headerBlock}>
              <Text style={styles.eyebrow}>Mẫu dịch vụ</Text>
              <Text style={styles.serviceName}>{form.name}</Text>
            </View>
            {form.imageUrl ? <CachedAppImage source={{ uri: form.imageUrl }} style={styles.previewImage} alt={form.name} /> : null}
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Mô tả ngắn</Text>
              <AdminKeyboardTextInput multiline scrollEnabled={false} placeholder="Thiết kế đính charm nhỏ gọn, hợp chụp ảnh." placeholderTextColor="#B4A89C" style={[styles.input, styles.textarea]} textAlignVertical="top" value={form.shortDescription} onChangeText={(value) => setForm((current) => (current ? { ...current, shortDescription: value } : current))} />
            </View>
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Ảnh dịch vụ</Text>
              <View style={styles.inlineRow}>
                <AdminKeyboardTextInput placeholder="https://..." placeholderTextColor="#B4A89C" style={[styles.input, styles.flexInput]} value={form.imageUrl} onChangeText={(value) => setForm((current) => (current ? { ...current, imageUrl: value } : current))} />
                <Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage()}>
                  <Feather name="upload" size={18} color={palette.accent} />
                  <Text style={styles.secondaryButtonText}>Tải ảnh</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.inlineRow}>
              <View style={[styles.fieldBlock, styles.flexBlock]}>
                <Text style={styles.label}>Nhãn thời lượng</Text>
                <AdminKeyboardTextInput placeholder="75 phút" placeholderTextColor="#B4A89C" style={styles.input} value={form.durationLabel} onChangeText={(value) => setForm((current) => (current ? { ...current, durationLabel: value } : current))} />
              </View>
              <View style={[styles.fieldBlock, styles.flexBlock]}>
                <Text style={styles.label}>Thứ tự Explore</Text>
                <AdminKeyboardTextInput placeholder="0" placeholderTextColor="#B4A89C" keyboardType="number-pad" style={styles.input} value={form.displayOrderExplore} onChangeText={(value) => setForm((current) => (current ? { ...current, displayOrderExplore: value } : current))} />
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Metadata lookbook</Text>
              <AdminKeyboardTextInput placeholder="Nhóm lookbook" placeholderTextColor="#B4A89C" style={styles.input} value={form.lookbookCategory} onChangeText={(value) => setForm((current) => (current ? { ...current, lookbookCategory: value } : current))} />
              <AdminKeyboardTextInput placeholder="Nhãn lookbook" placeholderTextColor="#B4A89C" style={styles.input} value={form.lookbookBadge} onChangeText={(value) => setForm((current) => (current ? { ...current, lookbookBadge: value } : current))} />
              <AdminKeyboardTextInput placeholder="Tone lookbook" placeholderTextColor="#B4A89C" style={styles.input} value={form.lookbookTone} onChangeText={(value) => setForm((current) => (current ? { ...current, lookbookTone: value } : current))} />
            </View>
            <View style={styles.toggleRow}>
              <Pressable style={[styles.toggleChip, form.featuredInExplore ? styles.toggleChipActive : null]} onPress={() => setForm((current) => (current ? { ...current, featuredInExplore: !current.featuredInExplore } : current))}>
                <Text style={[styles.toggleText, form.featuredInExplore ? styles.toggleTextActive : null]}>Nổi bật ở Explore</Text>
              </Pressable>
              <Pressable style={[styles.toggleChip, form.featuredInHome ? styles.toggleChipActive : null]} onPress={() => setForm((current) => (current ? { ...current, featuredInHome: !current.featuredInHome } : current))}>
                <Text style={[styles.toggleText, form.featuredInHome ? styles.toggleTextActive : null]}>Nổi bật ở Home</Text>
              </Pressable>
            </View>
            <Pressable style={styles.primaryButton} onPress={() => void handleSave()} disabled={isSaving}>
              <Text style={styles.primaryButtonText}>{isSaving ? "Đang lưu..." : "Lưu thay đổi"}</Text>
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
  headerBlock: { gap: 4 },
  eyebrow: { fontSize: 12, lineHeight: 18, color: palette.sub, fontWeight: "600" },
  serviceName: { fontSize: 18, lineHeight: 24, color: palette.text, fontWeight: "800" },
  previewImage: { width: "100%", aspectRatio: 1.58, borderRadius: 18, backgroundColor: "#F4ECE2" },
  fieldBlock: { gap: 8 },
  label: { fontSize: 13, lineHeight: 18, color: palette.text, fontWeight: "700" },
  input: { minHeight: 52, borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingVertical: 13, color: palette.text, fontSize: 14 },
  textarea: { minHeight: 88 },
  inlineRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  flexInput: { flex: 1 },
  flexBlock: { flex: 1 },
  secondaryButton: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FFF9F3" },
  secondaryButtonText: { color: palette.accent, fontSize: 13, fontWeight: "700" },
  toggleRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  toggleChip: { minHeight: 42, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: "#FFFCF9", alignItems: "center", justifyContent: "center" },
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
