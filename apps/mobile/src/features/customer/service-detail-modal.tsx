import Feather from "@expo/vector-icons/Feather";
import type { LookbookItem } from "@nails/shared";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CustomerCachedImage } from "@/src/features/customer/cached-image";
import { splitCustomerPriceLabel } from "@/src/features/customer/price-label";
import { useCustomerTheme } from "@/src/providers/customer-preferences-provider";

type CustomerServiceDetailModalProps = {
  bookingLabel: string;
  favorite: boolean;
  onBook: () => void;
  onClose: () => void;
  onToggleFavorite: () => void;
  service: LookbookItem | null;
  visible: boolean;
};

export function CustomerServiceDetailModal({
  bookingLabel,
  favorite,
  onBook,
  onClose,
  onToggleFavorite,
  service,
  visible,
}: CustomerServiceDetailModalProps) {
  const theme = useCustomerTheme();
  const styles = createStyles(theme);
  const priceParts = splitCustomerPriceLabel(service?.price);

  if (!service) {
    return null;
  }

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Feather color={theme.colors.text} name="x" size={18} />
            </Pressable>

            <View style={styles.imageWrap}>
              <CustomerCachedImage alt={service.title} source={{ uri: service.image }} intent="preview" style={styles.image} />
              <View style={styles.imageTopRow}>
                <View style={styles.badgeChip}>
                  <Text style={styles.badgeChipText}>{service.badge}</Text>
                </View>
                <Pressable
                  style={[styles.favoriteButton, favorite ? styles.favoriteButtonActive : null]}
                  onPress={onToggleFavorite}
                >
                  <Feather color={favorite ? "#fff7ef" : theme.colors.textSoft} name="heart" size={15} />
                </Pressable>
              </View>
            </View>

            <View style={styles.body}>
              <View style={styles.metaRow}>
                <View style={styles.toneChip}>
                  <Text style={styles.toneChipText}>{service.tone}</Text>
                </View>
                {service.durationLabel ? (
                  <View style={styles.infoChip}>
                    <Feather color={theme.colors.accentWarm} name="clock" size={13} />
                    <Text style={styles.infoChipText}>{service.durationLabel}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.title}>{service.title}</Text>
              <Text style={styles.description}>{service.blurb}</Text>

              <View style={styles.priceCard}>
                <Text style={styles.priceLabel}>Price</Text>
                <View style={styles.priceValueRow}>
                  <Text style={styles.priceValue}>{priceParts.amount}</Text>
                  {priceParts.unit ? <Text style={styles.priceUnit}>{priceParts.unit}</Text> : null}
                </View>
                {service.durationMin ? (
                  <Text style={styles.priceHint}>{service.durationMin} min</Text>
                ) : null}
              </View>

              <Pressable style={styles.ctaButton} onPress={onBook}>
                <Text style={styles.ctaButtonText}>{bookingLabel}</Text>
                <Feather color={theme.colors.surface} name="arrow-right" size={16} />
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme: ReturnType<typeof useCustomerTheme>) {
  return StyleSheet.create({
    overlay: {
      alignItems: "center",
      backgroundColor: "rgba(35, 27, 21, 0.45)",
      flex: 1,
      justifyContent: "center",
      padding: 20,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: 28,
      borderWidth: 1,
      maxHeight: "88%",
      overflow: "hidden",
      width: "100%",
    },
    scrollContent: {
      paddingBottom: 20,
    },
    closeButton: {
      alignItems: "center",
      alignSelf: "flex-end",
      backgroundColor: "rgba(255,255,255,0.92)",
      borderRadius: 18,
      height: 36,
      justifyContent: "center",
      marginRight: 14,
      marginTop: 14,
      position: "absolute",
      right: 0,
      top: 0,
      width: 36,
      zIndex: 2,
    },
    imageWrap: {
      position: "relative",
    },
    image: {
      aspectRatio: 1.05,
      backgroundColor: theme.colors.surfaceMuted,
      width: "100%",
    },
    imageTopRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      justifyContent: "space-between",
      left: 14,
      position: "absolute",
      right: 14,
      top: 14,
    },
    badgeChip: {
      backgroundColor: "rgba(255, 248, 239, 0.96)",
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    badgeChipText: {
      color: theme.colors.accentWarm,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    favoriteButton: {
      alignItems: "center",
      backgroundColor: "rgba(255,250,245,0.96)",
      borderColor: "#ebdfd3",
      borderRadius: 999,
      borderWidth: 1,
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    favoriteButtonActive: {
      backgroundColor: "#f97316",
      borderColor: "#f97316",
    },
    body: {
      gap: 14,
      paddingHorizontal: 18,
      paddingTop: 16,
    },
    metaRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    toneChip: {
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    toneChipText: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: "800",
    },
    infoChip: {
      alignItems: "center",
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 999,
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 11,
      paddingVertical: 7,
    },
    infoChipText: {
      color: theme.colors.textSoft,
      fontSize: 12,
      fontWeight: "700",
    },
    title: {
      color: theme.colors.text,
      fontSize: 24,
      fontWeight: "900",
      letterSpacing: -0.6,
      lineHeight: 30,
    },
    description: {
      color: theme.colors.textSoft,
      fontSize: 14,
      lineHeight: 21,
    },
    priceCard: {
      backgroundColor: "#fff7ef",
      borderColor: theme.colors.border,
      borderRadius: 20,
      borderWidth: 1,
      gap: 4,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    priceLabel: {
      color: theme.colors.textSoft,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    priceValue: {
      color: theme.colors.text,
      fontSize: 22,
      fontWeight: "900",
    },
    priceValueRow: {
      alignItems: "flex-end",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
    },
    priceUnit: {
      color: theme.colors.textSoft,
      fontSize: 12,
      fontWeight: "800",
      lineHeight: 20,
      textTransform: "uppercase",
    },
    priceHint: {
      color: theme.colors.textSoft,
      fontSize: 12,
      lineHeight: 18,
    },
    ctaButton: {
      alignItems: "center",
      backgroundColor: theme.colors.accent,
      borderRadius: 18,
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
      minHeight: 54,
      marginBottom: 4,
    },
    ctaButtonText: {
      color: theme.colors.surface,
      fontSize: 15,
      fontWeight: "800",
    },
  });
}
