import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { type Locale, translate } from "@nails/shared";
import {
  canNavigateNotification,
  getNotificationDestination,
  normalizeNotificationType,
  type CustomerNotificationRouteItem,
} from "@/src/features/customer/notification-navigation";
import { localizeNotificationItem } from "@/src/features/customer/localize";
import { CustomerScreen, CustomerTopActions } from "@/src/features/customer/ui";
import { useCustomerStrings } from "@/src/features/customer/strings";
import { premiumTheme } from "@/src/design/premium-theme";
import { useCustomerBookingTimeline } from "@/src/hooks/use-customer-booking-timeline";
import { useCustomerMembership } from "@/src/hooks/use-customer-membership";
import { useCustomerNotifications } from "@/src/hooks/use-customer-notifications";
import { useCustomerPreferences } from "@/src/providers/customer-preferences-provider";

const { colors, radius } = premiumTheme;

type FilterKey = "all" | "appointments" | "updates";
type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

function normalizeGroup(value: string): FilterKey {
  const normalized = normalizeNotificationType(value);
  if (normalized.includes("booking") || normalized.includes("lich")) return "appointments";
  return "updates";
}

function formatTime(isoString: string, locale: Locale): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return translate(locale, "customer", "notificationsLoadingNow");
  if (diffMins < 60) return translate(locale, "customer", "minutesAgo", { count: diffMins });
  if (diffHours < 24) return translate(locale, "customer", "hoursAgo", { count: diffHours });
  return date.toLocaleDateString(locale === "en" ? "en-US" : "vi-VN");
}

function getVisualFromType(type: string): { accent: string; icon: FeatherIconName; surface: string } {
  const normalized = normalizeNotificationType(type);
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
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [visibleCount, setVisibleCount] = useState(4);
  const strings = useCustomerStrings();
  const { locale } = useCustomerPreferences();
  const { items: rawItems, isLoading, isRefreshing, refresh, markAsRead, markAllAsRead } = useCustomerNotifications(50);
  const { historyItems, upcomingItems } = useCustomerBookingTimeline({ historyLimit: 24, upcomingLimit: 6 });
  const { offers } = useCustomerMembership({ autoRefreshOnMount: false });
  const filters = useMemo(
    () => [
      { key: "all" as const, label: strings.notificationsFilterAll, icon: "bell" as const },
      { key: "appointments" as const, label: strings.notificationsFilterAppointments, icon: "calendar" as const },
      { key: "updates" as const, label: strings.notificationsFilterUpdates, icon: "layers" as const },
    ],
    [strings],
  );

  const notifications: CustomerNotificationRouteItem[] = useMemo(
    () => rawItems.map((item) => {
      const localized = localizeNotificationItem(locale, item);
      return {
        id: item.id,
        title: localized.title,
        body: localized.body,
        created_at: item.createdAt,
        type: item.type,
        is_read: item.isRead,
        relatedAppointmentId: item.relatedAppointmentId,
        relatedBookingRequestId: item.relatedBookingRequestId,
        relatedOfferId: item.relatedOfferId,
      };
    }),
    [locale, rawItems],
  );

  const items = useMemo(() => {
    if (notifications.length > 0) {
      if (activeFilter === "all") return notifications;
      return notifications.filter((item) => normalizeGroup(item.type) === activeFilter);
    }
    return [];
  }, [activeFilter, notifications]);

  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);

  async function handleNotificationPress(item: CustomerNotificationRouteItem) {
    const destination = getNotificationDestination({
      item,
      historyItems,
      upcomingItems,
      offers,
    });

    if (!destination) {
      return;
    }

    await markAsRead(item.id);
    router.push(destination);
  }

  return (
    <CustomerScreen
      hideHeader
      title={strings.notificationsTitle}
      contentContainerStyle={styles.content}
      onRefresh={() => void refresh()}
      refreshing={isRefreshing || isLoading}
    >
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/(customer)/(tabs)");
          }
        }}>
          <Feather color={colors.text} name="chevron-left" size={22} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>CHAM BEAUTY</Text>
          <Text style={styles.pageTitle}>{strings.notificationsTitle}</Text>
        </View>

        <CustomerTopActions />
      </View>

      <View style={styles.segmentWrap}>
        {filters.map((item) => {
          const active = activeFilter === item.key;

          return (
            <Pressable
              key={item.key}
              onPress={() => {
                setActiveFilter(item.key);
                setVisibleCount(4);
              }}
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
          <Text style={styles.emptyText}>{strings.loading}</Text>
        ) : items.length === 0 ? (
          <Text style={styles.emptyText}>{strings.noNotifications}</Text>
        ) : (
          visibleItems.map((item) => {
            const visual = getVisualFromType(item.type);
            const content = { title: item.title, body: item.body, time: formatTime(item.created_at, locale) };
            const canNavigate = canNavigateNotification({ item, historyItems, upcomingItems, offers });

            return (
              <Pressable
                key={item.id}
                style={[
                  styles.card,
                  !item.is_read && styles.cardUnread,
                  !canNavigate ? styles.cardUnavailable : null,
                ]}
                disabled={!canNavigate}
                onPress={canNavigate ? () => void handleNotificationPress(item) : undefined}
              >
                <View style={[styles.notificationIconWrap, { backgroundColor: visual.surface }]}>
                  <Feather color={visual.accent} name={visual.icon} size={16} />
                </View>

                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{content.title}</Text>
                  <Text style={styles.cardBody} numberOfLines={2}>{content.body}</Text>
                </View>

                <View style={styles.cardMeta}>
                  <Text style={styles.cardTime}>{content.time}</Text>
                  <Feather color={canNavigate ? colors.textSoft : colors.textMuted} name={canNavigate ? "chevron-right" : "minus"} size={14} />
                </View>
              </Pressable>
            );
          })
        )}

        {items.length > visibleItems.length ? (
          <Pressable
            style={styles.viewMoreButton}
            onPress={() => setVisibleCount((current) => Math.min(current + 4, items.length))}
          >
            <Text style={styles.viewMoreText}>{strings.homeViewMore}</Text>
            <Feather color={colors.accent} name="chevron-down" size={16} />
          </Pressable>
        ) : null}
      </View>

      <Pressable style={styles.readAllButton} onPress={() => void markAllAsRead()}>
        <View style={styles.readAllCopy}>
          <Feather color="#8d7d6f" name="inbox" size={15} />
          <Text style={styles.readAllText}>{strings.markAllRead}</Text>
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
  cardUnavailable: {
    opacity: 0.7,
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
  cardMeta: {
    alignItems: "center",
    gap: 6,
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
  viewMoreButton: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
  },
  viewMoreText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
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
