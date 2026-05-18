import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CustomerScreen, CustomerTopActions } from "@/src/features/customer/ui";
import { premiumTheme } from "@/src/design/premium-theme";
import { useCustomerNotifications } from "@/src/hooks/use-customer-notifications";

const { colors, radius } = premiumTheme;

const FILTERS = [
  { key: "Tất cả", label: "Tất cả", icon: "bell" },
  { key: "Lịch hẹn", label: "Lịch hẹn", icon: "calendar" },
  { key: "Thành viên", label: "Thành viên", icon: "award" },
  { key: "Hệ thống", label: "Hệ thống", icon: "message-square" },
  { key: "Khuyến mãi", label: "Khuyến mãi", icon: "gift" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];
type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  type: string;
  is_read: boolean;
};

function normalizeVietnamese(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function normalizeGroup(value: string): FilterKey {
  const normalized = normalizeVietnamese(value);
  if (normalized.includes("booking") || normalized.includes("lich")) return "Lịch hẹn";
  if (normalized.includes("membership") || normalized.includes("thanh vien") || normalized.includes("tier") || normalized.includes("len hang")) return "Thành viên";
  if (normalized.includes("he thong")) return "Hệ thống";
  if (normalized.includes("khuyen mai") || normalized.includes("promotion") || normalized.includes("promo")) return "Khuyến mãi";
  return "Tất cả";
}

function formatTime(isoString: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return "Vừa xong";
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  return date.toLocaleDateString("vi-VN");
}

function getVisualFromType(type: string): { accent: string; icon: FeatherIconName; surface: string } {
  const normalized = normalizeVietnamese(type);
  if (normalized.includes("khuyen mai") || normalized.includes("promo")) {
    return { accent: "#f39a24", icon: "gift", surface: "#fdf2e5" };
  }
  if (normalized.includes("membership") || normalized.includes("thanh vien") || normalized.includes("tier")) {
    return { accent: "#B8860B", icon: "award", surface: "#FFF7DF" };
  }
  if (normalized.includes("booking") || normalized.includes("lich")) {
    return { accent: "#6F52D9", icon: "calendar", surface: "#F2EEFF" };
  }
  if (normalized.includes("thanh toan") || normalized.includes("payment")) {
    return { accent: "#4287c8", icon: "credit-card", surface: "#eef5fb" };
  }
  return { accent: "#78a541", icon: "bell", surface: "#eef5e7" };
}

export default function NotificationsScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("Tất cả");
  const { items: rawItems, isLoading, isRefreshing, refresh, markAsRead, markAllAsRead } = useCustomerNotifications(50);

  const notifications: NotificationItem[] = useMemo(
    () => rawItems.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      created_at: item.createdAt,
      type: item.type,
      is_read: item.isRead,
    })),
    [rawItems],
  );

  const items = useMemo(() => {
    if (notifications.length > 0) {
      if (activeFilter === "Tất cả") return notifications;
      return notifications.filter((item) => normalizeGroup(item.type) === activeFilter);
    }
    return [];
  }, [activeFilter, notifications]);

  return (
    <CustomerScreen
      hideHeader
      title="Thông báo"
      contentContainerStyle={styles.content}
      onRefresh={() => void refresh()}
      refreshing={isRefreshing || isLoading}
    >
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/(customer)");
          }
        }}>
          <Feather color={colors.text} name="chevron-left" size={22} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>CHAM BEAUTY</Text>
          <Text style={styles.pageTitle}>Thông báo</Text>
        </View>

        <CustomerTopActions />
      </View>

      <View style={styles.segmentWrap}>
        {FILTERS.map((item) => {
          const active = activeFilter === item.key;

          return (
            <Pressable
              key={item.key}
              onPress={() => setActiveFilter(item.key)}
              style={[styles.segmentItem, active ? styles.segmentItemActive : null]}
            >
              <Feather color={active ? "#fffaf5" : "#857568"} name={item.icon} size={14} />
              <Text style={[styles.segmentLabel, active ? styles.segmentLabelActive : null]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.list}>
        {isLoading ? (
          <Text style={styles.emptyText}>Đang tải...</Text>
        ) : items.length === 0 ? (
          <Text style={styles.emptyText}>Không có thông báo nào</Text>
        ) : (
          items.map((item) => {
            const visual = getVisualFromType(item.type);
            const content = { title: item.title, body: item.body, time: formatTime(item.created_at) };

            return (
              <Pressable
                key={item.id}
                style={[styles.card, !item.is_read && styles.cardUnread]}
                onPress={() => void markAsRead(item.id)}
              >
                <View style={[styles.notificationIconWrap, { backgroundColor: visual.surface }]}>
                  <Feather color={visual.accent} name={visual.icon} size={16} />
                </View>

                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{content.title}</Text>
                  <Text style={styles.cardBody} numberOfLines={2}>{content.body}</Text>
                </View>

                <Text style={styles.cardTime}>{content.time}</Text>
              </Pressable>
            );
          })
        )}
      </View>

      <Pressable style={styles.readAllButton} onPress={() => void markAllAsRead()}>
        <View style={styles.readAllCopy}>
          <Feather color="#8d7d6f" name="inbox" size={15} />
          <Text style={styles.readAllText}>Đánh dấu tất cả đã đọc</Text>
        </View>
        <Feather color="#9c8c7d" name="chevron-right" size={18} />
      </Pressable>
    </CustomerScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 11,
    paddingTop: 6,
  },
  headerRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  backButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  headerCopy: {
    gap: 4,
  },
  eyebrow: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 29,
    fontWeight: "800",
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  segmentWrap: {
    alignItems: "center",
    backgroundColor: "#fffaf5",
    borderColor: colors.border,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    minHeight: 43,
    padding: 4,
  },
  segmentItem: {
    alignItems: "center",
    borderRadius: 13,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 35,
    paddingHorizontal: 7,
  },
  segmentItemActive: {
    backgroundColor: colors.accent,
  },
  segmentLabel: {
    color: "#857568",
    fontSize: 13,
    fontWeight: "600",
  },
  segmentLabelActive: {
    color: "#fffaf5",
  },
  list: {
    gap: 8,
  },
  card: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  notificationIconWrap: {
    alignItems: "center",
    borderRadius: 14,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  cardContent: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  cardBody: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  cardTime: {
    color: colors.textSoft,
    fontSize: 11,
  },
  emptyText: {
    color: colors.textSoft,
    fontSize: 15,
    textAlign: "center",
    paddingVertical: 40,
  },
  readAllButton: {
    alignItems: "center",
    backgroundColor: "#fffaf5",
    borderColor: colors.border,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 50,
    paddingHorizontal: 16,
  },
  readAllCopy: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  readAllText: {
    color: "#7b6c60",
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: -0.14,
  },
});
