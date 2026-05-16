import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { MobileAdminContentSnapshot } from "@nails/shared";
import { listAdminContentSnapshotForMobile } from "@nails/shared";
import { CachedAppImage } from "@/src/components/cached-app-image";
import { ManageScreenShell } from "@/src/features/admin/manage-ui";
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

function ItemThumbnail({ uri, label }: { uri: string | null; label: string }) {
  if (uri) {
    return <CachedAppImage source={{ uri }} style={styles.thumbImage} alt={label} />;
  }

  return (
    <View style={styles.thumbPlaceholder}>
      <Text style={styles.thumbPlaceholderText}>{label.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

export default function AdminManageContentTeamScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [snapshot, setSnapshot] = useState<MobileAdminContentSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không tải được nhân sự.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadSnapshot();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [loadSnapshot]);

  const members = useMemo(() => {
    const list = snapshot?.team ?? [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return list;
    return list.filter((member) => `${member.displayName} ${member.roleLabel ?? ""}`.toLowerCase().includes(normalizedQuery));
  }, [query, snapshot?.team]);

  return (
    <ManageScreenShell
      title="Nhân sự tiệm"
      subtitle="Mở người cần sửa ở màn riêng để vuốt quay lại mượt hơn."
      currentKey="content"
      group="setup"
      backHref="/(admin)/manage-content"
      showTabs={false}
      showBottomDock={false}
      onRefresh={() => void loadSnapshot()}
      refreshing={isLoading}
    >
      <View style={styles.sectionCard}>
        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            void router.push({
              pathname: "/(admin)/manage-content-team-member/[memberId]",
              params: { memberId: "new", backHref: "/(admin)/manage-content-team" },
            })
          }
        >
          <Text style={styles.primaryButtonText}>Thêm nhân sự</Text>
        </Pressable>

        <View style={styles.searchShell}>
          <Feather name="search" size={18} color={palette.sub} />
          <AdminKeyboardTextInput placeholder="Tìm nhân sự..." placeholderTextColor="#B4A89C" style={styles.searchInput} value={query} onChangeText={setQuery} />
        </View>

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
          <View style={styles.listColumn}>
            {members.map((member) => (
              <Pressable
                key={member.id}
                style={styles.rowCard}
                onPress={() =>
                  void router.push({
                    pathname: "/(admin)/manage-content-team-member/[memberId]",
                    params: { memberId: member.id, backHref: "/(admin)/manage-content-team" },
                  })
                }
              >
                <ItemThumbnail uri={member.avatarUrl} label={member.displayName} />
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{member.displayName}</Text>
                  <Text numberOfLines={2} style={styles.rowSubtitle}>{member.roleLabel || "Chưa có chức danh"} · Thứ tự {member.displayOrder} · {member.isVisible ? "Đang hiển thị" : "Đang ẩn"}</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#A7988A" />
              </Pressable>
            ))}
            {!members.length ? <Text style={styles.emptyText}>Chưa có nhân sự nào.</Text> : null}
          </View>
        )}
      </View>
    </ManageScreenShell>
  );
}

const styles = StyleSheet.create({
  sectionCard: { borderRadius: 24, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, padding: 16, gap: 14 },
  primaryButton: { minHeight: 48, borderRadius: 18, backgroundColor: palette.accent, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  searchShell: { minHeight: 52, borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: "#FFFFFF", paddingLeft: 16, paddingRight: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  searchInput: { flex: 1, minHeight: 50, color: palette.text, fontSize: 14, paddingHorizontal: 0, paddingVertical: 0 },
  listColumn: { gap: 12 },
  rowCard: { borderRadius: 20, borderWidth: 1, borderColor: palette.border, backgroundColor: "#FFFCF9", paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "flex-start", gap: 14 },
  rowCopy: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { fontSize: 15, lineHeight: 21, fontWeight: "800", color: palette.text },
  rowSubtitle: { fontSize: 12, lineHeight: 18, color: palette.sub },
  thumbPlaceholder: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: palette.accentSoft, borderWidth: 1, borderColor: "#E7D6C1", overflow: "hidden" },
  thumbPlaceholderText: { fontSize: 18, fontWeight: "800", color: palette.accent },
  thumbImage: { width: 58, height: 58, borderRadius: 18, backgroundColor: "#F4ECE2" },
  stateCard: { borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: "#FFFCF9", padding: 16, alignItems: "center", gap: 10 },
  stateText: { fontSize: 13, lineHeight: 18, color: palette.sub },
  errorText: { fontSize: 13, lineHeight: 18, color: "#C25A43", textAlign: "center" },
  retryButton: { minHeight: 40, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: palette.border, alignItems: "center", justifyContent: "center" },
  retryButtonText: { color: palette.accent, fontSize: 13, fontWeight: "700" },
  emptyText: { fontSize: 13, lineHeight: 20, color: palette.sub, textAlign: "center", paddingVertical: 8 },
});
