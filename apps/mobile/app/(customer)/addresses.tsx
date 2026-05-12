import { StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { CustomerScreen, SurfaceCard } from "@/src/features/customer/ui";
import { premiumTheme } from "@/src/design/premium-theme";

const { colors, spacing } = premiumTheme;

export default function AddressesScreen() {
  return (
    <CustomerScreen title="Địa chỉ">
      <SurfaceCard>
        <Text style={styles.sectionTitle}>Địa chỉ của tôi</Text>

        <View style={styles.emptyState}>
          <View style={styles.iconWrap}>
            <Feather color={colors.textSoft} name="map-pin" size={20} />
          </View>
          <Text style={styles.title}>Chưa có địa chỉ nào được lưu</Text>
          <Text style={styles.detail}>
            Màn địa chỉ sẽ dùng dữ liệu thật khi backend customer addresses được nối hoàn chỉnh. Hiện tại em đã bỏ toàn bộ địa chỉ mock.
          </Text>
        </View>
      </SurfaceCard>
    </CustomerScreen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  emptyState: {
    alignItems: "center",
    gap: 10,
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
  detail: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
});
