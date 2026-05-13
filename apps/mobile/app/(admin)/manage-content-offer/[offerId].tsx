import Feather from "@expo/vector-icons/Feather";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CachedAppImage } from "@/src/components/cached-app-image";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { MobileAdminOffer, MobileAdminOfferInput } from "@nails/shared";
import {
  archiveAdminOfferForMobile,
  createAdminOfferForMobile,
  listAdminContentSnapshotForMobile,
  updateAdminOfferForMobile,
} from "@nails/shared";
import { uploadPickedAdminContentImage } from "@/src/features/admin/content-images";
import { ManageScreenShell } from "@/src/features/admin/manage-ui";
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

const OFFER_PACKAGE_TIERS = ["REGULAR", "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"] as const;

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
    badge: "",
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

function buildOfferForm(offer: MobileAdminOffer): OfferFormState {
  const packageTier = typeof offer.metadata.packageTier === "string" && OFFER_PACKAGE_TIERS.includes(offer.metadata.packageTier.toUpperCase() as (typeof OFFER_PACKAGE_TIERS)[number])
    ? offer.metadata.packageTier.toUpperCase() as (typeof OFFER_PACKAGE_TIERS)[number]
    : "REGULAR";
  const packageOrder = Number(offer.metadata.packageOrder ?? offer.metadata.displayOrder ?? 0);

  return {
    id: offer.id,
    title: offer.title,
    description: offer.description,
    imageUrl: offer.imageUrl ?? "",
    badge: offer.badge ?? "",
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
    badge: form.badge.trim() || null,
    startsAt: form.startsAt.trim() || null,
    endsAt: form.endsAt.trim() || null,
    isActive: form.isActive,
    metadata,
  };
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

      const snapshot = await listAdminContentSnapshotForMobile(client, { includeServices: false });
      const offer = snapshot.offers.find((item) => item.id === offerId);

      if (!offer) {
        throw new Error("Không tìm thấy ưu đãi cần chỉnh sửa.");
      }

      setForm(buildOfferForm(offer));
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

    if (result.canceled || !result.assets[0]) {
      return;
    }

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
        await updateAdminOfferForMobile(client, form.id, payload);
      } else {
        await createAdminOfferForMobile(client, payload);
      }

      void router.replace("/(admin)/manage-content" as never);
    } catch (error) {
      Alert.alert("Không lưu ưu đãi", error instanceof Error ? error.message : "Thử lại sau.");
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
              void router.replace("/(admin)/manage-content" as never);
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
      backHref="/(admin)/manage-content"
      showTabs={false}
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
            <Pressable style={styles.secondaryButton} onPress={() => void loadOffer()}>
              <Text style={styles.secondaryButtonText}>Tai lai</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.formColumn} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Tieu de</Text>
            <TextInput
              placeholder="Nhập tiêu đề ưu đãi"
              placeholderTextColor="#B4A89C"
              style={styles.input}
              value={form.title}
              onChangeText={(value) => setForm((current) => ({ ...current, title: value }))}
            />

            <Text style={styles.label}>Mo ta</Text>
            <TextInput
              multiline
              placeholder="Mô tả ngắn gọn cho khách hàng"
              placeholderTextColor="#B4A89C"
              style={[styles.input, styles.textarea]}
              textAlignVertical="top"
              value={form.description}
              onChangeText={(value) => setForm((current) => ({ ...current, description: value }))}
            />

            <Text style={styles.label}>Anh uu dai</Text>
            {form.imageUrl ? <CachedAppImage source={{ uri: form.imageUrl }} style={styles.previewImage} alt={form.title || "offer"} /> : null}
            <TextInput
              placeholder="https://..."
              placeholderTextColor="#B4A89C"
              style={styles.input}
              value={form.imageUrl}
              onChangeText={(value) => setForm((current) => ({ ...current, imageUrl: value }))}
            />
            <Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage()}>
              <Text style={styles.secondaryButtonText}>Tai anh</Text>
            </Pressable>

            <Text style={styles.label}>Badge</Text>
            <TextInput
              placeholder="Ví dụ: Hot"
              placeholderTextColor="#B4A89C"
              style={styles.input}
              value={form.badge}
              onChangeText={(value) => setForm((current) => ({ ...current, badge: value }))}
            />

            <Text style={styles.label}>Starts At (ISO)</Text>
            <TextInput
              placeholder="2026-05-06T08:00:00.000Z"
              placeholderTextColor="#B4A89C"
              style={styles.input}
              value={form.startsAt}
              onChangeText={(value) => setForm((current) => ({ ...current, startsAt: value }))}
            />

            <Text style={styles.label}>Ends At (ISO)</Text>
            <TextInput
              placeholder="2026-05-20T23:59:59.000Z"
              placeholderTextColor="#B4A89C"
              style={styles.input}
              value={form.endsAt}
              onChangeText={(value) => setForm((current) => ({ ...current, endsAt: value }))}
            />

            <Pressable
              style={[styles.toggleRow, form.isActive ? styles.toggleRowActive : null]}
              onPress={() => setForm((current) => ({ ...current, isActive: !current.isActive }))}
            >
              <Feather color={form.isActive ? "#FFFFFF" : palette.accent} name="power" size={16} />
              <Text style={[styles.toggleText, form.isActive ? styles.toggleTextActive : null]}>
                {form.isActive ? "Đang bật" : "Đang tắt"}
              </Text>
            </Pressable>

            <Text style={styles.label}>Gói ưu đãi theo hạng</Text>
            <View style={styles.chipRow}>
              {OFFER_PACKAGE_TIERS.map((tier) => (
                <Pressable
                  key={tier}
                  style={[styles.chip, form.packageTier === tier ? styles.chipActive : null]}
                  onPress={() => setForm((current) => ({ ...current, packageTier: tier }))}
                >
                  <Text style={[styles.chipText, form.packageTier === tier ? styles.chipTextActive : null]}>{tier}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Thứ tự hiển thị trong gói</Text>
            <TextInput
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#B4A89C"
              style={styles.input}
              value={form.packageOrder}
              onChangeText={(value) => setForm((current) => ({ ...current, packageOrder: value }))}
            />

            <Text style={styles.label}>Metadata JSON</Text>
            <TextInput
              multiline
              placeholder="{ }"
              placeholderTextColor="#B4A89C"
              style={[styles.input, styles.textarea]}
              textAlignVertical="top"
              value={form.metadataText}
              onChangeText={(value) => setForm((current) => ({ ...current, metadataText: value }))}
            />

            <Pressable style={styles.primaryButton} disabled={isSaving} onPress={() => void handleSave()}>
              <Text style={styles.primaryButtonText}>{isSaving ? "Đang lưu..." : "Lưu ưu đãi"}</Text>
            </Pressable>

            {canArchive ? (
              <Pressable style={styles.archiveButton} disabled={isSaving} onPress={() => void handleArchive()}>
                <Text style={styles.archiveButtonText}>An uu dai</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        )}
      </View>
    </ManageScreenShell>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  stateCard: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 28,
  },
  stateText: {
    color: palette.sub,
    fontSize: 13,
  },
  errorText: {
    color: palette.danger,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  formColumn: {
    gap: 12,
  },
  label: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: palette.border,
    borderRadius: 14,
    borderWidth: 1,
    color: palette.text,
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textarea: {
    minHeight: 104,
  },
  previewImage: {
    aspectRatio: 16 / 9,
    backgroundColor: "#F4ECE2",
    borderRadius: 14,
    width: "100%",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: palette.accent,
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#FFF9F3",
    borderColor: "#E4D7C8",
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  archiveButton: {
    alignItems: "center",
    backgroundColor: "#FFF6F2",
    borderColor: "#F3DFD7",
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 14,
  },
  archiveButtonText: {
    color: palette.danger,
    fontSize: 13,
    fontWeight: "800",
  },
  toggleRow: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: palette.accentSoft,
    borderColor: palette.border,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 34,
    paddingHorizontal: 12,
  },
  toggleRowActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  toggleText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  toggleTextActive: {
    color: "#FFFFFF",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderColor: palette.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  chipText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
});
