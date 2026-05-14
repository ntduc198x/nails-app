import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CustomerHistoryItem } from "@nails/shared";
import { CachedAppImage } from "@/src/components/cached-app-image";
import { CustomerScreen, SegmentedTabs, StatusTag, SurfaceCard } from "@/src/features/customer/ui";
import { premiumTheme } from "@/src/design/premium-theme";
import { useCustomerHistory } from "@/src/hooks/use-customer-history";

const { colors, spacing } = premiumTheme;

const FILTERS = [
  { key: "all", label: "Tất cả" },
  { key: "recent", label: "Gần đây" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function getStatusTone(item: CustomerHistoryItem): "success" | "warning" | "danger" | "default" {
  switch (item.status) {
    case "DONE":
      return "success";
    case "CANCELLED":
    case "NO_SHOW":
    case "NEEDS_RESCHEDULE":
      return "warning";
    case "BOOKED":
    case "CHECKED_IN":
    case "IN_SERVICE":
    case "CONFIRMED":
    case "NEW":
      return "default";
    default:
      return "default";
  }
}

function formatOccurredAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--/--/----";
  }

  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const { historyItems, isHydrated, isLoading, refresh } = useCustomerHistory();

  const items = useMemo(() => {
    if (activeFilter === "recent") {
      return historyItems.slice(0, 8);
    }
    return historyItems;
  }, [activeFilter, historyItems]);

  return (
    <CustomerScreen title="Lịch sử đặt lịch" onRefresh={() => void refresh()} refreshing={isLoading}>
      <SegmentedTabs activeKey={activeFilter} items={FILTERS} onChange={setActiveFilter} />

      <View style={styles.list}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() =>
              router.push({
                pathname: "/(customer)/booking",
                params: { service: item.serviceName },
              })
            }
          >
            <SurfaceCard style={styles.card}>
              {item.serviceImageUrl ? <CachedAppImage alt={item.serviceName} source={{ uri: item.serviceImageUrl }} style={styles.image} /> : null}

              <View style={styles.row}>
                <View style={styles.copy}>
                  <Text style={styles.time}>{formatOccurredAt(item.occurredAt)}</Text>
                  <Text style={styles.staff}>{item.serviceName}</Text>
                  <Text style={styles.service}>
                    {item.source === "appointment" ? "Lịch hẹn" : "Yêu cầu đặt lịch"}
                    {item.preferredStaff ? ` · ${item.preferredStaff}` : ""}
                    {item.servicePriceLabel ? ` · ${item.servicePriceLabel}` : ""}
                    {item.serviceSummary ? ` · ${item.serviceSummary}` : ""}
                  </Text>
                </View>
                <View style={styles.aside}>
                  <StatusTag label={item.statusLabel} tone={getStatusTone(item)} />
                </View>
              </View>
            </SurfaceCard>
          </Pressable>
        ))}

        {isHydrated && !items.length ? (
          <SurfaceCard>
            <Text style={styles.emptyTitle}>Chưa có lịch sử hẹn</Text>
            <Text style={styles.emptyText}>Lịch sử sẽ hiển thị các lịch hẹn và yêu cầu đặt lịch của khách theo thời gian.</Text>
          </SurfaceCard>
        ) : null}
      </View>
    </CustomerScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  card: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  image: {
    borderRadius: 16,
    height: 168,
    width: "100%",
  },
  row: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  time: {
    color: colors.textSoft,
    fontSize: 14,
  },
  staff: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  service: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 21,
  },
  aside: {
    paddingTop: 2,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  emptyText: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 20,
  },
});
