import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
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

      <SurfaceCard style={styles.emptyCard}>
        <View style={styles.iconWrap}>
          <Feather color={colors.textSoft} name="message-square" size={20} />
        </View>
        <Text style={styles.title}>Chưa có đánh giá nào được đồng bộ</Text>
        <Text style={styles.subtitle}>
          Màn này đã bỏ toàn bộ review mock. Khi hệ thống review thật được nối, dữ liệu sẽ hiển thị theo bộ lọc dịch vụ hoặc kỹ thuật viên.
        </Text>
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
