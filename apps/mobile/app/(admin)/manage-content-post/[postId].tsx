import Feather from "@expo/vector-icons/Feather";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { MobileAdminContentPost, MobileAdminContentPostInput } from "@nails/shared";
import {
  archiveAdminContentPostForMobile,
  createAdminContentPostForMobile,
  getAdminContentPostForMobile,
  updateAdminContentPostForMobile,
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
  danger: "#E06754",
};
const POST_DETAIL_CACHE_PREFIX = "admin-content-post-detail:";
const DETAIL_FRESH_MS = 2 * 60 * 1000;
const DETAIL_MAX_STALE_MS = 5 * 60 * 1000;
const CONTENT_TYPES = ["trend", "care", "news", "offer_hint"] as const;
const POST_STATUSES = ["draft", "approved", "published", "archived"] as const;
const SOURCE_PLATFORMS = ["Cham Beauty", "mobile_admin", "telegram", "dummy_seed"] as const;

type PostFormState = {
  id?: string;
  title: string;
  summary: string;
  body: string;
  coverImageUrl: string;
  contentType: MobileAdminContentPost["contentType"];
  status: MobileAdminContentPost["status"];
  priority: string;
  metadataText: string;
  publishedAt?: string | null;
  sourcePlatform?: string;
  sourceMessageId?: string | null;
};

function emptyPostForm(): PostFormState {
  return {
    title: "",
    summary: "",
    body: "",
    coverImageUrl: "",
    contentType: "trend",
    status: "published",
    priority: "100",
    metadataText: "",
  };
}

function stringifyMetadata(metadata: Record<string, unknown>) {
  return Object.keys(metadata).length ? JSON.stringify(metadata, null, 2) : "";
}

function buildPostForm(post: MobileAdminContentPost): PostFormState {
  return {
    id: post.id,
    title: post.title,
    summary: post.summary,
    body: post.body,
    coverImageUrl: post.coverImageUrl ?? "",
    contentType: post.contentType,
    status: post.status,
    priority: String(post.priority),
    metadataText: stringifyMetadata(post.metadata),
    publishedAt: post.publishedAt,
    sourcePlatform: post.sourcePlatform,
    sourceMessageId: post.sourceMessageId,
  };
}

function parseMetadata(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return {};
  return JSON.parse(trimmed) as Record<string, unknown>;
}

function parseNumberInput(value: string) {
  return Number(value.replace(/[^\d.-]/g, "") || 0);
}

function toPostInput(form: PostFormState): MobileAdminContentPostInput {
  return {
    title: form.title.trim(),
    summary: form.summary.trim(),
    body: form.body.trim(),
    coverImageUrl: form.coverImageUrl.trim() || null,
    contentType: form.contentType,
    status: form.status,
    priority: parseNumberInput(form.priority),
    metadata: parseMetadata(form.metadataText),
    sourcePlatform: form.sourcePlatform?.trim() || "mobile_admin",
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

export default function AdminManageContentPostDetailScreen() {
  const params = useLocalSearchParams<{ postId?: string }>();
  const router = useRouter();
  const postId = typeof params.postId === "string" ? params.postId : "new";
  const isCreate = postId === "new";

  const [form, setForm] = useState<PostFormState>(emptyPostForm());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  function closeDetail() {
    dismissToHref(router, "/manage-content");
  }

  const loadPost = useCallback(async () => {
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
        setForm(emptyPostForm());
        return;
      }

      const cacheKey = `${POST_DETAIL_CACHE_PREFIX}${postId}`;
      const cached = await hydrateCachedValue<MobileAdminContentPost>(cacheKey);
      if (cached && isCacheFresh(cacheKey, DETAIL_MAX_STALE_MS)) {
        setForm(buildPostForm(cached.value));
        setIsLoading(false);
        if (isCacheFresh(cacheKey, DETAIL_FRESH_MS)) {
          return;
        }
      }

      const post = await getAdminContentPostForMobile(client, postId);
      if (!post) throw new Error("Không tìm thấy bài feed cần chỉnh sửa.");
      setForm(buildPostForm(post));
      await writeCachedValue(cacheKey, post);
    } catch (error) {
      setLastError(error instanceof Error ? error.message : "Không tải được bài feed.");
    } finally {
      setIsLoading(false);
    }
  }, [isCreate, postId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadPost();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [loadPost]);

  const canArchive = useMemo(() => Boolean(form.id), [form.id]);

  async function pickAndUploadImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Cần cấp quyền", "Hãy cấp quyền thư viện để tải ảnh bài feed.");
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
        folder: "posts",
        baseName: form.title || "post",
      });
      setForm((current) => ({ ...current, coverImageUrl: uploaded.publicUrl }));
    } catch (error) {
      Alert.alert("Không tải được ảnh", error instanceof Error ? error.message : "Thử lại sau.");
    }
  }

  async function handleSave() {
    const client = mobileSupabase;
    if (!client) return;
    if (!form.title.trim() || !form.summary.trim() || !form.body.trim()) {
      Alert.alert("Thiếu dữ liệu", "Cần nhập tiêu đề, tóm tắt và nội dung bài feed.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = toPostInput(form);
      if (form.id) {
        const next = await updateAdminContentPostForMobile(client, form.id, payload, form.publishedAt ?? null);
        await writeCachedValue(`${POST_DETAIL_CACHE_PREFIX}${form.id}`, next);
      } else {
        const next = await createAdminContentPostForMobile(client, payload);
        await writeCachedValue(`${POST_DETAIL_CACHE_PREFIX}${next.id}`, next);
      }
      closeDetail();
    } catch (error) {
      Alert.alert("Không lưu bài viết", error instanceof Error ? error.message : "Thử lại sau.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchive() {
    const client = mobileSupabase;
    if (!client || !form.id) return;

    Alert.alert("Ẩn bài viết", "Bài này sẽ được gỡ khỏi Home. Tiếp tục?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Ẩn bài",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setIsSaving(true);
            try {
              await archiveAdminContentPostForMobile(client, form.id!);
              closeDetail();
            } catch (error) {
              Alert.alert("Không ẩn được bài viết", error instanceof Error ? error.message : "Thử lại sau.");
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
      title={isCreate ? "Thêm bài feed" : "Chi tiết bài feed"}
      subtitle="Chỉnh sửa nội dung Home và đồng bộ dữ liệu Landing Feed."
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
            <Text style={styles.stateText}>Đang tải bài feed...</Text>
          </View>
        ) : lastError ? (
          <View style={styles.stateCard}>
            <Text style={styles.errorText}>{lastError}</Text>
            <Pressable style={styles.retryButton} onPress={() => void loadPost()}>
              <Text style={styles.secondaryButtonText}>Tải lại</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.formColumn}>
            <View style={styles.fieldBlock}>
              <DetailFieldLabel icon="tag">Tiêu đề</DetailFieldLabel>
              <AdminKeyboardTextInput placeholder="Nhập tiêu đề bài feed" placeholderTextColor="#B4A89C" style={styles.input} value={form.title} onChangeText={(value) => setForm((current) => ({ ...current, title: value }))} />
            </View>
            <View style={styles.fieldBlock}>
              <DetailFieldLabel icon="file-text">Tóm tắt</DetailFieldLabel>
              <AdminKeyboardTextInput multiline scrollEnabled={false} placeholder="Tóm tắt ngắn gọn hiển thị trên Home" placeholderTextColor="#B4A89C" style={[styles.input, styles.textarea]} textAlignVertical="top" value={form.summary} onChangeText={(value) => setForm((current) => ({ ...current, summary: value }))} />
            </View>
            <View style={styles.fieldBlock}>
              <DetailFieldLabel icon="message-circle">Nội dung</DetailFieldLabel>
              <AdminKeyboardTextInput multiline scrollEnabled={false} placeholder="Nội dung chi tiết" placeholderTextColor="#B4A89C" style={[styles.input, styles.bodyTextarea]} textAlignVertical="top" value={form.body} onChangeText={(value) => setForm((current) => ({ ...current, body: value }))} />
            </View>
            <View style={styles.fieldBlock}>
              <DetailFieldLabel icon="image">Ảnh bìa</DetailFieldLabel>
              {form.coverImageUrl ? <CachedAppImage source={{ uri: form.coverImageUrl }} style={styles.previewImage} alt={form.title || "post"} /> : null}
              <View style={styles.inputShell}>
                <Feather color={palette.accent} name="link" size={18} />
                <AdminKeyboardTextInput placeholder="https://..." placeholderTextColor="#B4A89C" style={[styles.input, styles.embeddedInput]} value={form.coverImageUrl} onChangeText={(value) => setForm((current) => ({ ...current, coverImageUrl: value }))} />
                <Feather color={palette.sub} name="copy" size={18} />
              </View>
              <Pressable style={styles.uploadButton} onPress={() => void pickAndUploadImage()}>
                <Feather color={palette.accent} name="upload" size={18} />
                <Text style={styles.secondaryButtonText}>Tải ảnh bìa</Text>
              </Pressable>
            </View>
            <View style={styles.splitRow}>
              <View style={[styles.fieldBlock, styles.priorityColumn]}>
                <DetailFieldLabel icon="star">Độ ưu tiên</DetailFieldLabel>
                <AdminKeyboardTextInput keyboardType="number-pad" placeholder="100" placeholderTextColor="#B4A89C" style={styles.input} value={form.priority} onChangeText={(value) => setForm((current) => ({ ...current, priority: value }))} />
              </View>
              <View style={[styles.fieldBlock, styles.flexColumn]}>
                <DetailFieldLabel icon="folder">Loại nội dung</DetailFieldLabel>
                <View style={styles.chipRow}>
                  {CONTENT_TYPES.map((item) => (
                    <Pressable key={item} style={[styles.chip, form.contentType === item ? styles.chipActive : null]} onPress={() => setForm((current) => ({ ...current, contentType: item }))}>
                      <Text style={[styles.chipText, form.contentType === item ? styles.chipTextActive : null]}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
            <View style={styles.splitRow}>
              <View style={[styles.fieldBlock, styles.flexColumn]}>
                <DetailFieldLabel icon="flag">Trạng thái</DetailFieldLabel>
                <View style={styles.chipRow}>
                  {POST_STATUSES.map((item) => (
                    <Pressable key={item} style={[styles.chip, form.status === item ? styles.chipActive : null]} onPress={() => setForm((current) => ({ ...current, status: item }))}>
                      <Text style={[styles.chipText, form.status === item ? styles.chipTextActive : null]}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={[styles.fieldBlock, styles.sourceColumn]}>
                <DetailFieldLabel icon="user">Nguồn</DetailFieldLabel>
                <AdminKeyboardTextInput
                  placeholder="Nhập nguồn bài feed"
                  placeholderTextColor="#B4A89C"
                  style={styles.input}
                  value={form.sourcePlatform || ""}
                  onChangeText={(value) => setForm((current) => ({ ...current, sourcePlatform: value }))}
                />
                <View style={styles.sourceChipRow}>
                  {SOURCE_PLATFORMS.map((item) => (
                    <Pressable
                      key={item}
                      style={[styles.sourceChip, (form.sourcePlatform || "mobile_admin") === item ? styles.sourceChipActive : null]}
                      onPress={() => setForm((current) => ({ ...current, sourcePlatform: item }))}
                    >
                      <Text style={[styles.sourceChipText, (form.sourcePlatform || "mobile_admin") === item ? styles.sourceChipTextActive : null]}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <DetailFieldLabel icon="code">Metadata JSON</DetailFieldLabel>
              <View style={styles.metadataShell}>
                <AdminKeyboardTextInput multiline scrollEnabled={false} placeholder="{ }" placeholderTextColor="#B4A89C" style={[styles.input, styles.embeddedInput, styles.metadataInput]} textAlignVertical="top" value={form.metadataText} onChangeText={(value) => setForm((current) => ({ ...current, metadataText: value }))} />
                <View style={styles.metadataIconWrap}>
                  <Feather color={palette.sub} name="copy" size={18} />
                </View>
              </View>
            </View>
            <View style={styles.actionRow}>
              <Pressable style={[styles.primaryButton, styles.actionButton]} disabled={isSaving} onPress={() => void handleSave()}>
                <Feather color="#FFFFFF" name="save" size={18} />
                <Text style={styles.primaryButtonText}>{isSaving ? "Đang lưu..." : "Lưu bài viết"}</Text>
              </Pressable>
              {canArchive ? (
                <Pressable style={[styles.archiveButton, styles.actionButton]} disabled={isSaving} onPress={() => void handleArchive()}>
                  <Feather color={palette.danger} name="trash-2" size={18} />
                  <Text style={styles.archiveButtonText}>Ẩn bài feed</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      </View>
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
  priorityColumn: { width: 132 },
  flexColumn: { flex: 1 },
  sourceColumn: { width: 156 },
  labelRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  label: { color: palette.text, fontSize: 15, fontWeight: "700" },
  input: { backgroundColor: "#FFFFFF", borderColor: palette.border, borderRadius: 14, borderWidth: 1, color: palette.text, fontSize: 14, minHeight: 52, paddingHorizontal: 14, paddingVertical: 12 },
  embeddedInput: { backgroundColor: "transparent", borderWidth: 0, flex: 1, minHeight: 0, paddingHorizontal: 0, paddingVertical: 0 },
  textarea: { minHeight: 104 },
  bodyTextarea: { minHeight: 142 },
  previewImage: { aspectRatio: 16 / 7.7, backgroundColor: "#F4ECE2", borderRadius: 16, width: "100%" },
  inputShell: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: palette.border, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 52, paddingHorizontal: 14 },
  uploadButton: { alignItems: "center", backgroundColor: "#FFF9F3", borderColor: "#E4D7C8", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 50, paddingHorizontal: 18 },
  secondaryButtonText: { color: palette.accent, fontSize: 13, fontWeight: "700" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: "#FFFFFF", borderColor: palette.border, borderRadius: 999, borderWidth: 1, minHeight: 38, paddingHorizontal: 16, paddingVertical: 9 },
  chipActive: { backgroundColor: palette.accentSoft, borderColor: palette.accent },
  chipText: { color: palette.sub, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: palette.accent },
  sourceChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sourceChip: { backgroundColor: "#FFFFFF", borderColor: palette.border, borderRadius: 999, borderWidth: 1, minHeight: 34, paddingHorizontal: 12, paddingVertical: 7 },
  sourceChipActive: { backgroundColor: palette.accentSoft, borderColor: palette.accent },
  sourceChipText: { color: palette.sub, fontSize: 12, fontWeight: "700" },
  sourceChipTextActive: { color: palette.accent },
  metadataShell: { backgroundColor: "#FFFFFF", borderColor: palette.border, borderRadius: 16, borderWidth: 1, minHeight: 168, paddingBottom: 12, paddingHorizontal: 14, paddingTop: 14 },
  metadataInput: { minHeight: 126, paddingRight: 28, paddingTop: 0 },
  metadataIconWrap: { alignItems: "flex-end" },
  actionRow: { flexDirection: "row", gap: 12, paddingTop: 4 },
  actionButton: { flex: 1, minHeight: 54 },
  primaryButton: { alignItems: "center", backgroundColor: palette.accent, borderRadius: 14, flexDirection: "row", gap: 8, justifyContent: "center", paddingHorizontal: 16 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  archiveButton: { alignItems: "center", backgroundColor: "#FFF6F2", borderColor: "#F7D9D3", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingHorizontal: 14 },
  archiveButtonText: { color: palette.danger, fontSize: 13, fontWeight: "800" },
});
