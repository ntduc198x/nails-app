import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { MobileAdminMerchService } from "@nails/shared";
import { listAdminMerchServicesForMobile } from "@nails/shared";
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

export default function AdminManageContentExploreServicesScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [services, setServices] = useState<MobileAdminMerchService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    if (!mobileSupabase) {
      setError("Thiếu cấu hình Database mobile.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const next = await listAdminMerchServicesForMobile(mobileSupabase);
      setServices(next);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không tải được dịch vụ.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadServices();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [loadServices]);

  const filteredServices = useMemo(() => {
    const regular = services.filter((service) => service.active && !service.featuredInExplore);
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return regular.sort((left, right) => left.name.localeCompare(right.name, "vi"));
    return regular
      .filter((service) => `${service.name} ${service.shortDescription ?? ""}`.toLowerCase().includes(normalizedQuery))
      .sort((left, right) => left.name.localeCompare(right.name, "vi"));
  }, [query, services]);

  return (
    <ManageScreenShell
      title="Dịch vụ thường dự phòng"
      subtitle="Dùng khi khu sản phẩm và phụ kiện chưa có dữ liệu."
      currentKey="content"
      group="setup"
      backHref="/(admin)/(tabs)/manage-content"
      showTabs={false}
      showBottomDock={false}
      onRefresh={() => void loadServices()}
      refreshing={isLoading}
    >
      <View style={styles.sectionCard}>
        <View style={styles.searchShell}>
          <Feather name="search" size={18} color={palette.sub} />
          <AdminKeyboardTextInput
            placeholder="Tìm dịch vụ thường cho Khám phá..."
            placeholderTextColor="#B4A89C"
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        {isLoading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={palette.accent} />
            <Text style={styles.stateText}>Đang tải dịch vụ...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => void loadServices()}>
              <Text style={styles.retryButtonText}>Tải lại</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.listColumn}>
            {filteredServices.map((service) => (
              <Pressable
                key={service.id}
                style={styles.rowCard}
                onPress={() =>
                  void router.push({
                    pathname: "/(admin)/manage-content-service/[serviceId]",
                    params: {
                      serviceId: service.id,
                      context: "explore",
                      backHref: "/(admin)/manage-content-explore-services",
                    },
                  })
                }
              >
                <ItemThumbnail uri={service.imageUrl} label={service.name} />
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{service.name}</Text>
                  <Text numberOfLines={2} style={styles.rowSubtitle}>
                    {service.priceLabel || "Chưa có giá"} · {service.durationLabel || "Chưa có thời lượng"}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="#A7988A" />
              </Pressable>
            ))}
            {!filteredServices.length ? <Text style={styles.emptyText}>Không có dịch vụ phù hợp.</Text> : null}
          </View>
        )}
      </View>
    </ManageScreenShell>
  );
}

const styles = StyleSheet.create({
  sectionCard: { borderRadius: 24, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, padding: 16, gap: 14 },
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
