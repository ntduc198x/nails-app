import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatDateTimeLabel, type CustomerHistoryItem } from "@nails/shared";
import { CachedAppImage } from "@/src/components/cached-app-image";
import { localizeDynamicServiceText } from "@/src/features/customer/localize";
import { CustomerScreen, SegmentedTabs, StatusTag, SurfaceCard } from "@/src/features/customer/ui";
import { getCustomerStatusLabel, useCustomerStrings } from "@/src/features/customer/strings";
import { premiumTheme } from "@/src/design/premium-theme";
import { useCustomerHistory } from "@/src/hooks/use-customer-history";
import { useCustomerPreferences } from "@/src/providers/customer-preferences-provider";

const { colors, spacing } = premiumTheme;

type FilterKey = "all" | "recent";

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

export default function HistoryScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const strings = useCustomerStrings();
  const { locale } = useCustomerPreferences();
  const { historyItems, isHydrated, isLoading, refresh } = useCustomerHistory();
  const filters = useMemo(
    () => [
      { key: "all" as const, label: strings.all },
      { key: "recent" as const, label: strings.recent },
    ],
    [strings],
  );

  const items = useMemo(() => {
    if (activeFilter === "recent") {
      return historyItems.slice(0, 8);
    }
    return historyItems;
  }, [activeFilter, historyItems]);

  return (
    <CustomerScreen title={strings.historyTitle} onRefresh={() => void refresh()} refreshing={isLoading}>
      <SegmentedTabs activeKey={activeFilter} items={filters} onChange={setActiveFilter} />

      <View style={styles.list}>
        {items.map((item) => {
          const serviceName = localizeDynamicServiceText(locale, item.serviceName, item.serviceTranslations, "name") ?? item.serviceName;
          const serviceSummary = item.serviceSummary
            ? localizeDynamicServiceText(locale, item.serviceSummary, item.serviceTranslations, "short_description")
            : null;

          return (
          <Pressable
            key={item.id}
            onPress={() =>
              router.push({
                pathname: "/(customer)/(tabs)/booking",
                params: { service: serviceName },
              })
            }
          >
            <SurfaceCard style={styles.card}>
              {item.serviceImageUrl ? <CachedAppImage alt={serviceName} source={{ uri: item.serviceImageUrl }} style={styles.image} /> : null}

              <View style={styles.row}>
                <View style={styles.copy}>
                  <Text style={styles.time}>{formatDateTimeLabel(item.occurredAt, locale)}</Text>
                  <Text style={styles.staff}>{serviceName}</Text>
                  <Text style={styles.service}>
                    {item.source === "appointment" ? strings.historyAppointment : strings.historyBookingRequest}
                    {item.preferredStaff ? ` · ${item.preferredStaff}` : ""}
                    {item.servicePriceLabel ? ` · ${item.servicePriceLabel}` : ""}
                    {serviceSummary ? ` · ${serviceSummary}` : ""}
                  </Text>
                </View>
                <View style={styles.aside}>
                  <StatusTag label={getCustomerStatusLabel(locale, item.status)} tone={getStatusTone(item)} />
                </View>
              </View>
            </SurfaceCard>
          </Pressable>
          );
        })}

        {isHydrated && !items.length ? (
          <SurfaceCard>
            <Text style={styles.emptyTitle}>{strings.historyEmptyTitle}</Text>
            <Text style={styles.emptyText}>{strings.historyEmptyBody}</Text>
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
