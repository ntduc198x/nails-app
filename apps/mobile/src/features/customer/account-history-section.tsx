import Feather from "@expo/vector-icons/Feather";
import { formatDateTimeLabel, type CustomerHistoryItem } from "@nails/shared";
import { useMemo, type MutableRefObject } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CustomerCachedImage } from "@/src/features/customer/cached-image";
import { localizeDynamicServiceText } from "@/src/features/customer/localize";
import { getCustomerStatusLabel } from "@/src/features/customer/strings";
import { SurfaceCard } from "@/src/features/customer/ui";
import { useCustomerTheme } from "@/src/providers/customer-preferences-provider";

type AccountHistorySectionProps = {
  displayAvatar: string;
  emptyBody: string;
  emptyTitle: string;
  historyItems: CustomerHistoryItem[];
  isHydrated: boolean;
  isLoading: boolean;
  itemYRef: MutableRefObject<Record<string, number>>;
  locale: "vi" | "en";
  onViewMore: () => void;
  sectionYRef: MutableRefObject<number>;
  viewMoreLabel: string;
  visibleHistoryItems: CustomerHistoryItem[];
};

function getHistoryStatusBadgeStyle(status: string, colors: ReturnType<typeof useCustomerTheme>["colors"]) {
  switch (status) {
    case "DONE":
      return {
        backgroundColor: colors.successBg,
        borderColor: "#CFEED9",
        textColor: colors.successText,
      };
    case "CONFIRMED":
    case "BOOKED":
    case "CHECKED_IN":
    case "IN_SERVICE":
      return {
        backgroundColor: "#F2EEFF",
        borderColor: "#DDD3FF",
        textColor: "#6F52D9",
      };
    case "NEW":
    case "NEEDS_RESCHEDULE":
    case "CONVERTED":
      return {
        backgroundColor: colors.warningBg,
        borderColor: "#F0D8B3",
        textColor: colors.warningText,
      };
    case "CANCELLED":
    case "NO_SHOW":
    case "EXPIRED_UNCONFIRMED":
      return {
        backgroundColor: colors.dangerBg,
        borderColor: "#F3C8C1",
        textColor: colors.dangerText,
      };
    default:
      return {
        backgroundColor: colors.accentSoft,
        borderColor: colors.border,
        textColor: colors.textSoft,
      };
  }
}

export function AccountHistorySection({
  displayAvatar,
  emptyBody,
  emptyTitle,
  historyItems,
  isHydrated,
  isLoading,
  itemYRef,
  locale,
  onViewMore,
  sectionYRef,
  viewMoreLabel,
  visibleHistoryItems,
}: AccountHistorySectionProps) {
  const theme = useCustomerTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View
      style={styles.cardList}
      onLayout={(event) => {
        sectionYRef.current = event.nativeEvent.layout.y;
      }}
    >
      {visibleHistoryItems.map((item) => {
        const badgeStyle = getHistoryStatusBadgeStyle(item.status, theme.colors);
        const serviceName = localizeDynamicServiceText(locale, item.serviceName, item.serviceTranslations, "name") ?? item.serviceName;
        const serviceSummary = item.serviceSummary
          ? localizeDynamicServiceText(locale, item.serviceSummary, item.serviceTranslations, "short_description")
          : null;

        return (
          <View
            key={item.id}
            onLayout={(event) => {
              itemYRef.current[item.id] = event.nativeEvent.layout.y + sectionYRef.current;
            }}
          >
            <SurfaceCard style={styles.rowCard}>
              <CustomerCachedImage alt={serviceName} source={{ uri: item.serviceImageUrl ?? displayAvatar }} intent="thumbnail" style={styles.rowImage} />
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{serviceName}</Text>
                <Text style={styles.rowSubtitle}>
                  {formatDateTimeLabel(item.occurredAt, locale)}
                </Text>
                <View style={styles.rowMetaWrap}>
                  <View style={[styles.historyBadge, { backgroundColor: badgeStyle.backgroundColor, borderColor: badgeStyle.borderColor }]}>
                    <Text style={[styles.historyBadgeText, { color: badgeStyle.textColor }]}>{getCustomerStatusLabel(locale, item.status)}</Text>
                  </View>
                  {item.servicePriceLabel ? <Text style={styles.rowMeta}>• {item.servicePriceLabel}</Text> : null}
                  {item.preferredStaff ? <Text style={styles.rowMeta}>• {item.preferredStaff}</Text> : null}
                  {serviceSummary ? <Text style={styles.rowMeta}>• {serviceSummary}</Text> : null}
                </View>
              </View>
            </SurfaceCard>
          </View>
        );
      })}

      {historyItems.length > visibleHistoryItems.length ? (
        <Pressable onPress={onViewMore} style={styles.viewMoreButton}>
          <Text style={styles.viewMoreText}>{viewMoreLabel}</Text>
          <Feather color={theme.colors.accent} name="chevron-down" size={16} />
        </Pressable>
      ) : null}

      {isHydrated && !isLoading && !historyItems.length ? (
        <SurfaceCard style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Feather color="#D8B892" name="calendar" size={22} />
          </View>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyText}>{emptyBody}</Text>
        </SurfaceCard>
      ) : null}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useCustomerTheme>) {
  return StyleSheet.create({
    cardList: {
      gap: 11,
    },
    rowCard: {
      alignItems: "center",
      flexDirection: "row",
      gap: 11,
      minHeight: 90,
      padding: 10,
    },
    rowImage: {
      borderRadius: 14,
      height: 62,
      width: 62,
    },
    rowCopy: {
      flex: 1,
      gap: 3,
      minWidth: 0,
    },
    rowTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    rowSubtitle: {
      color: theme.colors.textSoft,
      fontSize: 12,
      lineHeight: 16,
    },
    rowMetaWrap: {
      alignItems: "center",
      columnGap: 8,
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: 6,
    },
    rowMeta: {
      color: theme.colors.textSoft,
      fontSize: 12,
      fontWeight: "600",
    },
    historyBadge: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    historyBadgeText: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.1,
    },
    emptyCard: {
      alignItems: "center",
      borderRadius: 28,
      gap: 10,
      padding: 24,
    },
    emptyIconWrap: {
      alignItems: "center",
      backgroundColor: "#FFF8F1",
      borderRadius: 28,
      height: 56,
      justifyContent: "center",
      width: 56,
    },
    emptyTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "800",
    },
    emptyText: {
      color: theme.colors.textSoft,
      fontSize: 13,
      lineHeight: 18,
      textAlign: "center",
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
      color: theme.colors.accent,
      fontSize: 14,
      fontWeight: "700",
    },
  });
}
