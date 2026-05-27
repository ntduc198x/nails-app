import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { CustomerScreen, SegmentedTabs, SurfaceCard } from "@/src/features/customer/ui";
import { useCustomerStrings } from "@/src/features/customer/strings";
import { premiumTheme } from "@/src/design/premium-theme";

const { colors, spacing } = premiumTheme;
type FilterKey = "service" | "staff";

export default function ReviewsScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("service");
  const strings = useCustomerStrings();
  const filters = [
    { key: "service" as const, label: strings.reviewsFilterService },
    { key: "staff" as const, label: strings.reviewsFilterStaff },
  ];

  return (
    <CustomerScreen title={strings.reviewsTitle}>
      <SegmentedTabs activeKey={activeFilter} items={filters} onChange={setActiveFilter} />

      <SurfaceCard style={styles.emptyCard}>
        <View style={styles.iconWrap}>
          <Feather color={colors.textSoft} name="message-square" size={20} />
        </View>
        <Text style={styles.title}>{strings.reviewsEmptyTitle}</Text>
        <Text style={styles.subtitle}>{strings.reviewsEmptyBody}</Text>
      </SurfaceCard>
    </CustomerScreen>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: "#f7f1ea",
    borderRadius: 18,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
