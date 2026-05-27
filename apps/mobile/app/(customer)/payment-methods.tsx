import Feather from "@expo/vector-icons/Feather";
import { StyleSheet, Text, View } from "react-native";
import { CustomerScreen, SectionTitle, SurfaceCard } from "@/src/features/customer/ui";
import { useCustomerStrings } from "@/src/features/customer/strings";
import { premiumTheme } from "@/src/design/premium-theme";

const { colors } = premiumTheme;

export default function PaymentMethodsScreen() {
  const strings = useCustomerStrings();

  return (
    <CustomerScreen title={strings.paymentMethodsTitle} subtitle={strings.paymentMethodsSubtitle}>
      <SurfaceCard>
        <SectionTitle title={strings.paymentMethodsSectionTitle} subtitle={strings.paymentMethodsSectionSubtitle} />
        <View style={styles.emptyState}>
          <View style={styles.iconWrap}>
            <Feather color={colors.textSoft} name="credit-card" size={20} />
          </View>
          <Text style={styles.title}>{strings.paymentMethodsEmptyTitle}</Text>
          <Text style={styles.detail}>{strings.paymentMethodsEmptyBody}</Text>
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
