import Feather from "@expo/vector-icons/Feather";
import { StyleSheet, Text, View } from "react-native";
import { CustomerScreen, SectionTitle, SurfaceCard } from "@/src/features/customer/ui";
import { premiumTheme } from "@/src/design/premium-theme";

const { colors } = premiumTheme;

export default function PaymentMethodsScreen() {
  return (
    <CustomerScreen title="Phương thức thanh toán" subtitle="Sẽ hiển thị dữ liệu thật khi flow checkout/customer wallet được nối hoàn chỉnh">
      <SurfaceCard>
        <SectionTitle title="Phương thức đã liên kết" subtitle="Hiện tại màn này không còn dùng mock cứng nữa." />
        <View style={styles.emptyState}>
          <View style={styles.iconWrap}>
            <Feather color={colors.textSoft} name="credit-card" size={20} />
          </View>
          <Text style={styles.title}>Chưa có phương thức thanh toán được lưu</Text>
          <Text style={styles.detail}>
            Khi flow thanh toán thật được bật, danh sách thẻ/ví liên kết sẽ hiện ở đây thay vì dữ liệu mẫu.
          </Text>
        </View>
      </SurfaceCard>
    </CustomerScreen>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
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
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  detail: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});
