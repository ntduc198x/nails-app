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
import type { MobileAdminContentPost, MobileAdminContentPostInput } from "@nails/shared";
import {
  archiveAdminContentPostForMobile,
  createAdminContentPostForMobile,
  listAdminContentSnapshotForMobile,
  updateAdminContentPostForMobile,
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
  };
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

      const snapshot = await listAdminContentSnapshotForMobile(client, { includeServices: false });
      const post = snapshot.posts.find((item) => item.id === postId);

      if (!post) {
        throw new Error("Không tìm thấy bài feed cần chỉnh sửa.");
      }

      setForm(buildPostForm(post));
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

    if (result.canceled || !result.assets[0]) {
      return;
    }

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
        await updateAdminContentPostForMobile(client, form.id, payload, form.publishedAt ?? null);
      } else {
        await createAdminContentPostForMobile(client, payload);
      }

      void router.replace("/(admin)/manage-content" as never);
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
              void router.replace("/(admin)/manage-content" as never);
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
      backHref="/(admin)/manage-content"
      showTabs={false}
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
            <Pressable style={styles.secondaryButton} onPress={() => void loadPost()}>
              <Text style={styles.secondaryButtonText}>Tải lại</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.formColumn} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Tieu de</Text>
            <TextInput
              placeholder="Nhập tiêu đề bài feed"
              placeholderTextColor="#B4A89C"
              style={styles.input}
              value={form.title}
              onChangeText={(value) => setForm((current) => ({ ...current, title: value }))}
            />

            <Text style={styles.label}>Tom tat</Text>
            <TextInput
              multiline
              placeholder="Tóm tắt ngắn gọn hiển thị trên Home"
              placeholderTextColor="#B4A89C"
              style={[styles.input, styles.textarea]}
              textAlignVertical="top"
              value={form.summary}
              onChangeText={(value) => setForm((current) => ({ ...current, summary: value }))}
            />

            <Text style={styles.label}>Nội dung</Text>
            <TextInput
              multiline
              placeholder="Nội dung chi tiết"
              placeholderTextColor="#B4A89C"
              style={[styles.input, styles.bodyTextarea]}
              textAlignVertical="top"
              value={form.body}
              onChangeText={(value) => setForm((current) => ({ ...current, body: value }))}
            />

            <Text style={styles.label}>Ảnh bìa</Text>
            {form.coverImageUrl ? <CachedAppImage source={{ uri: form.coverImageUrl }} style={styles.previewImage} alt={form.title || "post"} /> : null}
            <TextInput
              placeholder="https://..."
              placeholderTextColor="#B4A89C"
              style={styles.input}
              value={form.coverImageUrl}
              onChangeText={(value) => setForm((current) => ({ ...current, coverImageUrl: value }))}
            />
            <Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage()}>
              <Text style={styles.secondaryButtonText}>Tải ảnh bìa</Text>
            </Pressable>

            <Text style={styles.label}>Độ ưu tiên</Text>
            <TextInput
              keyboardType="number-pad"
              placeholder="100"
              placeholderTextColor="#B4A89C"
              style={styles.input}
              value={form.priority}
              onChangeText={(value) => setForm((current) => ({ ...current, priority: value }))}
            />

            <Text style={styles.label}>Loại nội dung</Text>
            <View style={styles.chipRow}>
              {(["trend", "care", "news", "offer_hint"] as const).map((item) => (
                <Pressable
                  key={item}
                  style={[styles.chip, form.contentType === item ? styles.chipActive : null]}
                  onPress={() => setForm((current) => ({ ...current, contentType: item }))}
                >
                  <Text style={[styles.chipText, form.contentType === item ? styles.chipTextActive : null]}>{item}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Trạng thái</Text>
            <View style={styles.chipRow}>
              {(["draft", "approved", "published", "archived"] as const).map((item) => (
                <Pressable
                  key={item}
                  style={[styles.chip, form.status === item ? styles.chipActive : null]}
                  onPress={() => setForm((current) => ({ ...current, status: item }))}
                >
                  <Text style={[styles.chipText, form.status === item ? styles.chipTextActive : null]}>{item}</Text>
                </Pressable>
              ))}
            </View>

            {form.id ? (
              <Text style={styles.metaText}>
                Nguon: {form.sourcePlatform || "mobile_admin"}
                {form.sourceMessageId ? ` · msg ${form.sourceMessageId}` : ""}
              </Text>
            ) : null}

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
              <Text style={styles.primaryButtonText}>{isSaving ? "Đang lưu..." : "Lưu bài viết"}</Text>
            </Pressable>

            {canArchive ? (
              <Pressable style={styles.archiveButton} disabled={isSaving} onPress={() => void handleArchive()}>
                <Text style={styles.archiveButtonText}>Ẩn bài feed</Text>
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
  bodyTextarea: {
    minHeight: 148,
  },
  previewImage: {
    aspectRatio: 16 / 9,
    backgroundColor: "#F4ECE2",
    borderRadius: 14,
    width: "100%",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    alignItems: "center",
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.accent,
  },
  chipText: {
    color: palette.sub,
    fontSize: 12,
    fontWeight: "700",
  },
  chipTextActive: {
    color: palette.accent,
  },
  metaText: {
    color: palette.sub,
    fontSize: 12,
    lineHeight: 18,
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
});
