import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CachedAppImage } from "@/src/components/cached-app-image";
import { REVIEWS } from "@/src/features/customer/data";
import { CustomerScreen, SegmentedTabs, SurfaceCard } from "@/src/features/customer/ui";
import { premiumTheme } from "@/src/design/premium-theme";

const { colors, spacing } = premiumTheme;

const FILTERS = [
  { key: "service", label: "Dịch vụ" },
  { key: "staff", label: "Kỹ thuật viên" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export default function ReviewsScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("service");

  return (
    <CustomerScreen title="Đánh giá của tôi">
      <SegmentedTabs activeKey={activeFilter} items={FILTERS} onChange={setActiveFilter} />

      <View style={styles.list}>
        {REVIEWS.map((review) => (
          <SurfaceCard key={review.id} style={styles.card}>
            <CachedAppImage alt={review.service} source={{ uri: review.image }} style={styles.image} />

            <View style={styles.copy}>
              <Text style={styles.title}>{activeFilter === "service" ? review.service : review.staff}</Text>
              <Text style={styles.subtitle}>{activeFilter === "service" ? review.staff : review.service}</Text>
              <Text style={styles.stars}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</Text>
              <Text style={styles.date}>{review.date}</Text>
            </View>
          </SurfaceCard>
        ))}
      </View>
    </CustomerScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  card: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  image: {
    borderRadius: 16,
    height: 88,
    width: 88,
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSoft,
    fontSize: 15,
  },
  stars: {
    color: "#d79856",
    fontSize: 16,
    letterSpacing: 1,
  },
  date: {
    color: colors.textSoft,
    fontSize: 14,
  },
});
