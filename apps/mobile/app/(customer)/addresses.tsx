import { StyleSheet, Text, View } from "react-native";
import { ADDRESSES } from "@/src/features/customer/data";
import { CustomerScreen, SurfaceCard } from "@/src/features/customer/ui";
import { premiumTheme } from "@/src/design/premium-theme";

const { colors, spacing } = premiumTheme;

export default function AddressesScreen() {
  return (
    <CustomerScreen title="Địa chỉ">
      <SurfaceCard>
        <Text style={styles.sectionTitle}>Địa chỉ của tôi</Text>

        <View style={styles.list}>
          {ADDRESSES.map((item) => (
            <View key={item.id} style={styles.addressCard}>
              <View style={styles.copy}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.detail}>{item.detail}</Text>
              </View>
              <View style={[styles.radio, item.selected ? styles.radioActive : null]}>
                {item.selected ? <Text style={styles.check}>✓</Text> : null}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.addRow}>
          <Text style={styles.plus}>＋</Text>
          <Text style={styles.addText}>Thêm địa chỉ mới</Text>
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
  list: {
    gap: spacing.md,
  },
  addressCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
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
  detail: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 21,
  },
  radio: {
    alignItems: "center",
    borderColor: colors.textMuted,
    borderRadius: 999,
    borderWidth: 1.5,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  radioActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  check: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: "800",
  },
  addRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  plus: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 22,
  },
  addText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "500",
  },
});
