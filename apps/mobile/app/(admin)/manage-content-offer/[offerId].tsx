import Feather from "@expo/vector-icons/Feather";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { MobileAdminOffer, MobileAdminOfferInput } from "@nails/shared";
import {
  archiveAdminOfferForMobile,
  createAdminOfferForMobile,
  getAdminOfferForMobile,
  updateAdminOfferForMobile,
} from "@nails/shared";
import { CachedAppImage } from "@/src/components/cached-app-image";
import { uploadPickedAdminContentImage } from "@/src/features/admin/content-images";
import { ManageScreenShell } from "@/src/features/admin/manage-ui";
import { dismissToHref } from "@/src/features/admin/navigation";
import { AdminKeyboardTextInput } from "@/src/features/admin/ui";
import { hydrateCachedValue, isCacheFresh, writeCachedValue } from "@/src/lib/admin-services-cache";
import { mobileSupabase } from "@/src/lib/supabase";

const palette = {
  border: "#EADFD3",
  card: "#FFFFFF",
  text: "#2F241D",
  sub: "#84776C",
  accent: "#A56D3D",
  accentSoft: "#F5E9DD",
  danger: "#C25A43",
};
const OFFER_DETAIL_CACHE_PREFIX = "admin-offer-detail:";
const DETAIL_FRESH_MS = 2 * 60 * 1000;
const DETAIL_MAX_STALE_MS = 5 * 60 * 1000;
const OFFER_PACKAGE_TIERS = ["REGULAR", "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"] as const;
const OFFER_TIER_BADGES: Record<(typeof OFFER_PACKAGE_TIERS)[number], string> = {
  REGULAR: "Hạng thường",
  BRONZE: "Hạng đồng",
  SILVER: "Hạng bạc",
  GOLD: "Hạng vàng",
  PLATINUM: "Hạng bạch kim",
  DIAMOND: "Hạng kim cương",
};

type OfferDateField = "startsAt" | "endsAt";

type OfferFormState = {
  id?: string;
  title: string;
  description: string;
  imageUrl: string;
  badge: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  packageTier: (typeof OFFER_PACKAGE_TIERS)[number];
  packageOrder: string;
  metadataText: string;
};

function emptyOfferForm(): OfferFormState {
  return {
    title: "",
    description: "",
    imageUrl: "",
    badge: OFFER_TIER_BADGES.REGULAR,
    startsAt: "",
    endsAt: "",
    isActive: true,
    packageTier: "REGULAR",
    packageOrder: "0",
    metadataText: "",
  };
}

function stringifyMetadata(metadata: Record<string, unknown>) {
  return Object.keys(metadata).length ? JSON.stringify(metadata, null, 2) : "";
}

function getOfferTierBadge(packageTier: (typeof OFFER_PACKAGE_TIERS)[number]) {
  return OFFER_TIER_BADGES[packageTier];
}

function buildTierLinkedFormPatch(packageTier: (typeof OFFER_PACKAGE_TIERS)[number]) {
  return {
    packageTier,
    badge: getOfferTierBadge(packageTier),
  };
}

function formatOfferDateLabel(value: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function parseOfferDateValue(value: string) {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
}

function toOfferDateIso(value: Date, field: OfferDateField) {
  const year = value.getFullYear();
  const month = value.getMonth();
  const day = value.getDate();

  return new Date(
    Date.UTC(
      year,
      month,
      day,
      field === "endsAt" ? 23 : 0,
      field === "endsAt" ? 59 : 0,
      field === "endsAt" ? 59 : 0,
      field === "endsAt" ? 999 : 0,
    ),
  ).toISOString();
}

function buildOfferForm(offer: MobileAdminOffer): OfferFormState {
  const packageTier =
    typeof offer.metadata.packageTier === "string" &&
    OFFER_PACKAGE_TIERS.includes(offer.metadata.packageTier.toUpperCase() as (typeof OFFER_PACKAGE_TIERS)[number])
      ? (offer.metadata.packageTier.toUpperCase() as (typeof OFFER_PACKAGE_TIERS)[number])
      : "REGULAR";
  const packageOrder = Number(offer.metadata.packageOrder ?? offer.metadata.displayOrder ?? 0);

  return {
    id: offer.id,
    title: offer.title,
    description: offer.description,
    imageUrl: offer.imageUrl ?? "",
    badge: getOfferTierBadge(packageTier),
    startsAt: offer.startsAt ?? "",
    endsAt: offer.endsAt ?? "",
    isActive: offer.isActive,
    packageTier,
    packageOrder: String(Number.isFinite(packageOrder) ? packageOrder : 0),
    metadataText: stringifyMetadata(offer.metadata),
  };
}

function parseMetadata(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return {};
  return JSON.parse(trimmed) as Record<string, unknown>;
}

function toOfferInput(form: OfferFormState): MobileAdminOfferInput {
  const metadata = parseMetadata(form.metadataText);
  metadata.packageTier = form.packageTier;
  metadata.packageOrder = Number(form.packageOrder || 0);

  return {
    title: form.title.trim(),
    description: form.description.trim(),
    imageUrl: form.imageUrl.trim() || null,
    badge: getOfferTierBadge(form.packageTier),
    startsAt: form.startsAt.trim() || null,
    endsAt: form.endsAt.trim() || null,
    isActive: form.isActive,
    metadata,
  };
}

function DetailFieldLabel({
  icon,
  children,
}: {
  icon: keyof typeof Feather.glyphMap;
  children: ReactNode;
}) {
  return (
    <View style={styles.labelRow}>
      <Feather color={palette.accent} name={icon} size={18} />
      <Text style={styles.label}>{children}</Text>
    </View>
  );
}

export default function AdminManageContentOfferDetailScreen() {
  const params = useLocalSearchParams<{ offerId?: string }>();
  const router = useRouter();
  const offerId = typeof params.offerId === "string" ? params.offerId : "new";
  const isCreate = offerId === "new";

  const [form, setForm] = useState<OfferFormState>(emptyOfferForm());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [activeDateField, setActiveDateField] = useState<OfferDateField | null>(null);
  const [dateDraft, setDateDraft] = useState<Date>(new Date());

  function closeDetail() {
    dismissToHref(router, "/manage-content");
  }

  function openDatePicker(field: OfferDateField) {
    setDateDraft(parseOfferDateValue(form[field]));
    setActiveDateField(field);
  }

  function closeDatePicker() {
    setActiveDateField(null);
  }

  function applyDateDraft() {
    if (!activeDateField) return;
    setForm((current) => ({
      ...current,
      [activeDateField]: toOfferDateIso(dateDraft, activeDateField),
    }));
    setActiveDateField(null);
  }

  function handleDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (event.type === "dismissed") {
      if (Platform.OS === "android") {
        setActiveDateField(null);
      }
      return;
    }

    if (!selectedDate || !activeDateField) {
      return;
    }

    if (Platform.OS === "android") {
      setForm((current) => ({
        ...current,
        [activeDateField]: toOfferDateIso(selectedDate, activeDateField),
      }));
      setActiveDateField(null);
      return;
    }

    setDateDraft(selectedDate);
  }

  const loadOffer = useCallback(async () => {
    const client = mobileSupabase;
    if (!client) {
      setLastError("Thiếu cấu hình Database mobile.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLastError(null);

    try {
      if (isCreate) {
        setForm(emptyOfferForm());
        return;
      }

      const cacheKey = `${OFFER_DETAIL_CACHE_PREFIX}${offerId}`;
      const cached = await hydrateCachedValue<MobileAdminOffer>(cacheKey);
      if (cached && isCacheFresh(cacheKey, DETAIL_MAX_STALE_MS)) {
        setForm(buildOfferForm(cached.value));
        setIsLoading(false);
        if (isCacheFresh(cacheKey, DETAIL_FRESH_MS)) {
          return;
        }
      }

      const offer = await getAdminOfferForMobile(client, offerId);
      if (!offer) throw new Error("Không tìm thấy ưu đãi cần chỉnh sửa.");
      setForm(buildOfferForm(offer));
      await writeCachedValue(cacheKey, offer);
    } catch (error) {
      setLastError(error instanceof Error ? error.message : "Không tải được ưu đãi.");
    } finally {
      setIsLoading(false);
    }
  }, [isCreate, offerId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadOffer();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [loadOffer]);

  const canArchive = useMemo(() => Boolean(form.id), [form.id]);

  async function pickAndUploadImage() {
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
        folder: "offers",
        baseName: form.title || "offer",
      });
      setForm((current) => ({ ...current, imageUrl: uploaded.publicUrl }));
    } catch (error) {
      Alert.alert("Không tải được ảnh", error instanceof Error ? error.message : "Thử lại sau.");
    }
  }

  async function handleSave() {
    const client = mobileSupabase;
    if (!client) return;
    if (!form.title.trim() || !form.description.trim()) {
      Alert.alert("Thiếu dữ liệu", "Cần nhập tiêu đề và mô tả ưu đãi.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = toOfferInput(form);
      if (form.id) {
        const next = await updateAdminOfferForMobile(client, form.id, payload);
        await writeCachedValue(`${OFFER_DETAIL_CACHE_PREFIX}${form.id}`, next);
      } else {
        const next = await createAdminOfferForMobile(client, payload);
        await writeCachedValue(`${OFFER_DETAIL_CACHE_PREFIX}${next.id}`, next);
      }
      closeDetail();
    } catch (error) {
      Alert.alert("Không lưu được ưu đãi", error instanceof Error ? error.message : "Thử lại sau.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchive() {
    const client = mobileSupabase;
    if (!client || !form.id) return;

    Alert.alert("Ẩn ưu đãi", "Ưu đãi này sẽ được tắt cho khách hàng. Tiếp tục?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Ẩn ưu đãi",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setIsSaving(true);
            try {
              await archiveAdminOfferForMobile(client, form.id!);
              closeDetail();
            } catch (error) {
              Alert.alert("Không ẩn được ưu đãi", error instanceof Error ? error.message : "Thử lại sau.");
            } finally {
              setIsSaving(false);
            }
          })();
        },
      },
    ]);
  }

  return (
    <ManageScreenShell
      title={isCreate ? "Thêm ưu đãi" : "Chi tiết ưu đãi"}
      subtitle="Chỉnh sửa dữ liệu hiển thị cho Home, Explore và Thẻ thành viên."
      currentKey="content"
      group="setup"
      backHref="/manage-content"
      showTabs={false}
      showBottomDock={false}
    >
      <View style={styles.sectionCard}>
        {isLoading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={palette.accent} />
            <Text style={styles.stateText}>Đang tải ưu đãi...</Text>
          </View>
        ) : lastError ? (
          <View style={styles.stateCard}>
            <Text style={styles.errorText}>{lastError}</Text>
            <Pressable style={styles.retryButton} onPress={() => void loadOffer()}>
              <Text style={styles.secondaryButtonText}>Tải lại</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.formColumn}>
            <View style={styles.fieldBlock}>
              <DetailFieldLabel icon="tag">Tiêu đề</DetailFieldLabel>
              <AdminKeyboardTextInput placeholder="Add-on mini cho thành viên" placeholderTextColor="#B4A89C" style={styles.input} value={form.title} onChangeText={(value) => setForm((current) => ({ ...current, title: value }))} />
            </View>
            <View style={styles.fieldBlock}>
              <DetailFieldLabel icon="file-text">Mô tả</DetailFieldLabel>
              <AdminKeyboardTextInput multiline scrollEnabled={false} placeholder="Mô tả ngắn gọn cho khách hàng" placeholderTextColor="#B4A89C" style={[styles.input, styles.textarea]} textAlignVertical="top" value={form.description} onChangeText={(value) => setForm((current) => ({ ...current, description: value }))} />
            </View>
            <View style={styles.fieldBlock}>
              <DetailFieldLabel icon="image">Ảnh ưu đãi (URL)</DetailFieldLabel>
              {form.imageUrl ? <CachedAppImage source={{ uri: form.imageUrl }} style={styles.previewImage} alt={form.title || "offer"} /> : null}
              <View style={styles.urlComposerRow}>
                <View style={[styles.inputShell, styles.urlInputShell]}>
                  <AdminKeyboardTextInput placeholder="https://..." placeholderTextColor="#B4A89C" style={[styles.input, styles.embeddedInput]} value={form.imageUrl} onChangeText={(value) => setForm((current) => ({ ...current, imageUrl: value }))} />
                </View>
                <Pressable style={styles.uploadButton} onPress={() => void pickAndUploadImage()}>
                  <Feather color={palette.accent} name="upload" size={18} />
                  <Text style={styles.secondaryButtonText}>Tải ảnh</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.splitRow}>
              <View style={[styles.fieldBlock, styles.splitItem]}>
                <DetailFieldLabel icon="star">Badge</DetailFieldLabel>
                <View style={styles.readOnlyValueShell}>
                  <Text style={styles.readOnlyValueText}>{form.badge}</Text>
                </View>
              </View>
              <View style={[styles.fieldBlock, styles.splitItem]}>
                <DetailFieldLabel icon="power">Trạng thái</DetailFieldLabel>
                <View style={styles.segmentedStatusRow}>
                  <Pressable style={[styles.statusSegment, form.isActive ? styles.statusSegmentActive : null]} onPress={() => setForm((current) => ({ ...current, isActive: true }))}>
                    <Text style={[styles.statusSegmentText, form.isActive ? styles.statusSegmentTextActive : null]}>Active</Text>
                  </Pressable>
                  <Pressable style={[styles.statusSegment, !form.isActive ? styles.statusSegmentActive : null]} onPress={() => setForm((current) => ({ ...current, isActive: false }))}>
                    <Text style={[styles.statusSegmentText, !form.isActive ? styles.statusSegmentTextActive : null]}>Non active</Text>
                  </Pressable>
                </View>
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <DetailFieldLabel icon="calendar">Ngày hiệu lực</DetailFieldLabel>
              <View style={styles.splitRow}>
                <Pressable style={[styles.inputShell, styles.splitItem]} onPress={() => openDatePicker("startsAt")}>
                  <Text style={[styles.dateFieldText, !form.startsAt ? styles.dateFieldPlaceholder : null]}>
                    {form.startsAt ? formatOfferDateLabel(form.startsAt) : "Từ ngày"}
                  </Text>
                  <Feather color={palette.accent} name="calendar" size={18} />
                </Pressable>
                <Pressable style={[styles.inputShell, styles.splitItem]} onPress={() => openDatePicker("endsAt")}>
                  <Text style={[styles.dateFieldText, !form.endsAt ? styles.dateFieldPlaceholder : null]}>
                    {form.endsAt ? formatOfferDateLabel(form.endsAt) : "Đến ngày"}
                  </Text>
                  <Feather color={palette.accent} name="calendar" size={18} />
                </Pressable>
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <DetailFieldLabel icon="award">Gói ưu đãi theo hạng</DetailFieldLabel>
              <View style={styles.chipRow}>
                {OFFER_PACKAGE_TIERS.map((tier) => (
                  <Pressable key={tier} style={[styles.chip, form.packageTier === tier ? styles.chipActive : null]} onPress={() => setForm((current) => ({ ...current, ...buildTierLinkedFormPatch(tier) }))}>
                    <Text style={[styles.chipText, form.packageTier === tier ? styles.chipTextActive : null]}>{tier}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldHint}>Badge sẽ tự đồng bộ theo gói ưu đãi đã chọn.</Text>
            </View>
            <View style={styles.fieldBlock}>
              <DetailFieldLabel icon="list">Thứ tự hiển thị trong gói</DetailFieldLabel>
              <View style={styles.inputShell}>
                <AdminKeyboardTextInput keyboardType="number-pad" placeholder="0" placeholderTextColor="#B4A89C" style={[styles.input, styles.embeddedInput]} value={form.packageOrder} onChangeText={(value) => setForm((current) => ({ ...current, packageOrder: value }))} />
                <Feather color={palette.sub} name="chevrons-up" size={18} />
              </View>
            </View>
            <View style={styles.actionRow}>
              <Pressable style={[styles.primaryButton, styles.actionButton]} disabled={isSaving} onPress={() => void handleSave()}>
                <Feather color="#FFFFFF" name="save" size={18} />
                <Text style={styles.primaryButtonText}>{isSaving ? "Đang lưu..." : "Lưu ưu đãi"}</Text>
              </Pressable>
              {canArchive ? (
                <Pressable style={[styles.archiveButton, styles.actionButton]} disabled={isSaving} onPress={() => void handleArchive()}>
                  <Feather color={palette.danger} name="trash-2" size={18} />
                  <Text style={styles.archiveButtonText}>Xóa ưu đãi</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      </View>
      <Modal transparent animationType="fade" visible={Boolean(activeDateField)} onRequestClose={closeDatePicker}>
        <View style={styles.datePickerOverlay}>
          <View style={styles.datePickerModal}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>
                {activeDateField === "startsAt" ? "Chọn ngày bắt đầu" : "Chọn ngày kết thúc"}
              </Text>
              <Pressable onPress={closeDatePicker} style={styles.datePickerCloseButton}>
                <Feather color={palette.text} name="x" size={18} />
              </Pressable>
            </View>
            <DateTimePicker
              value={Platform.OS === "ios" ? dateDraft : parseOfferDateValue(activeDateField ? form[activeDateField] : "")}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={handleDateChange}
            />
            {Platform.OS === "ios" ? (
              <View style={styles.datePickerActions}>
                <Pressable onPress={closeDatePicker} style={styles.datePickerGhostButton}>
                  <Text style={styles.datePickerGhostLabel}>Hủy</Text>
                </Pressable>
                <Pressable onPress={applyDateDraft} style={styles.datePickerPrimaryButton}>
                  <Text style={styles.datePickerPrimaryLabel}>Chọn ngày</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </ManageScreenShell>
  );
}

const styles = StyleSheet.create({
  sectionCard: { backgroundColor: palette.card, borderColor: palette.border, borderRadius: 24, borderWidth: 1, padding: 16 },
  stateCard: { alignItems: "center", gap: 10, paddingVertical: 28 },
  stateText: { color: palette.sub, fontSize: 13 },
  errorText: { color: palette.danger, fontSize: 13, lineHeight: 18, textAlign: "center" },
  retryButton: { alignItems: "center", backgroundColor: "#FFF9F3", borderColor: "#E4D7C8", borderRadius: 14, borderWidth: 1, justifyContent: "center", minHeight: 42, paddingHorizontal: 16 },
  formColumn: { gap: 18 },
  fieldBlock: { gap: 10 },
  splitRow: { flexDirection: "row", gap: 12 },
  splitItem: { flex: 1 },
  labelRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  label: { color: palette.text, fontSize: 15, fontWeight: "700" },
  fieldHint: { color: palette.sub, fontSize: 12, lineHeight: 18 },
  input: { backgroundColor: "#FFFFFF", borderColor: palette.border, borderRadius: 14, borderWidth: 1, color: palette.text, fontSize: 14, minHeight: 52, paddingHorizontal: 14, paddingVertical: 12 },
  inputShell: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: palette.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", minHeight: 52, paddingHorizontal: 14 },
  embeddedInput: { backgroundColor: "transparent", borderWidth: 0, flex: 1, minHeight: 0, paddingHorizontal: 0, paddingVertical: 0 },
  readOnlyValueShell: { alignItems: "center", backgroundColor: "#FAF6F1", borderColor: palette.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", minHeight: 52, paddingHorizontal: 14 },
  readOnlyValueText: { color: palette.text, flex: 1, fontSize: 14, fontWeight: "600" },
  dateFieldText: { color: palette.text, flex: 1, fontSize: 14, fontWeight: "600" },
  dateFieldPlaceholder: { color: "#B4A89C", fontWeight: "500" },
  textarea: { minHeight: 104 },
  previewImage: { aspectRatio: 16 / 9, backgroundColor: "#F4ECE2", borderRadius: 16, width: "100%" },
  urlComposerRow: { alignItems: "stretch", flexDirection: "row", gap: 12 },
  urlInputShell: { flex: 1 },
  uploadButton: { alignItems: "center", backgroundColor: "#FFF9F3", borderColor: "#E4D7C8", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 52, paddingHorizontal: 18 },
  secondaryButtonText: { color: palette.accent, fontSize: 13, fontWeight: "700" },
  segmentedStatusRow: { backgroundColor: "#FFF9F3", borderColor: palette.border, borderRadius: 16, borderWidth: 1, flexDirection: "row", padding: 4 },
  statusSegment: { alignItems: "center", borderRadius: 12, flex: 1, justifyContent: "center", minHeight: 42, paddingHorizontal: 8 },
  statusSegmentActive: { backgroundColor: palette.accent },
  statusSegmentText: { color: palette.sub, fontSize: 13, fontWeight: "700" },
  statusSegmentTextActive: { color: "#FFFFFF" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: "#FFFFFF", borderColor: palette.border, borderRadius: 999, borderWidth: 1, minHeight: 38, paddingHorizontal: 18, paddingVertical: 9 },
  chipActive: { backgroundColor: palette.accentSoft, borderColor: "#E8C7AA" },
  chipText: { color: palette.text, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: palette.accent },
  metadataShell: { backgroundColor: "#FFFFFF", borderColor: palette.border, borderRadius: 16, borderWidth: 1, minHeight: 170, paddingBottom: 12, paddingHorizontal: 14, paddingTop: 14 },
  metadataInput: { minHeight: 130, paddingRight: 28, paddingTop: 0 },
  metadataIconWrap: { alignItems: "flex-end" },
  datePickerOverlay: { alignItems: "center", backgroundColor: "rgba(31, 26, 23, 0.28)", flex: 1, justifyContent: "center", padding: 20 },
  datePickerModal: { backgroundColor: palette.card, borderRadius: 20, padding: 16, width: "100%" },
  datePickerHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  datePickerTitle: { color: palette.text, fontSize: 16, fontWeight: "800" },
  datePickerCloseButton: { alignItems: "center", height: 32, justifyContent: "center", width: 32 },
  datePickerActions: { flexDirection: "row", gap: 12, marginTop: 12 },
  datePickerGhostButton: { alignItems: "center", backgroundColor: "#FFF9F3", borderColor: "#E4D7C8", borderRadius: 14, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 46, paddingHorizontal: 12 },
  datePickerGhostLabel: { color: palette.accent, fontSize: 13, fontWeight: "700" },
  datePickerPrimaryButton: { alignItems: "center", backgroundColor: palette.accent, borderRadius: 14, flex: 1, justifyContent: "center", minHeight: 46, paddingHorizontal: 12 },
  datePickerPrimaryLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  actionRow: { flexDirection: "row", gap: 12, paddingTop: 4 },
  actionButton: { flex: 1, minHeight: 54 },
  primaryButton: { alignItems: "center", backgroundColor: palette.accent, borderRadius: 14, flexDirection: "row", gap: 8, justifyContent: "center", paddingHorizontal: 16 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  archiveButton: { alignItems: "center", backgroundColor: "#FFF6F2", borderColor: "#F3DFD7", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingHorizontal: 14 },
  archiveButtonText: { color: palette.danger, fontSize: 13, fontWeight: "800" },
});
