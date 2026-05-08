import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { CustomerScreen, CustomerTopActions, SurfaceCard } from "@/src/features/customer/ui";
import { premiumTheme } from "@/src/design/premium-theme";
import { useCustomerMembership } from "@/src/hooks/use-customer-membership";
import { useCustomerStrings } from "@/src/features/customer/strings";

const { colors, radius } = premiumTheme;

function formatNumber(value: number) {
  return value.toLocaleString("vi-VN");
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("vi-VN");
}

function buildHelperText(input: {
  hasMembership: boolean;
  nextTierName: string | null;
  pointsBalance: number;
  totalSpent: number;
  totalVisits: number;
  expiresAt: string | null;
}) {
  if (!input.hasMembership) {
    return "Dang san sang kich hoat the thanh vien that tu du lieu cua cua hang.";
  }

  if (input.nextTierName) {
    return `Dang tich luy ${formatNumber(input.pointsBalance)} diem. Muc chi tieu hien tai ${formatNumber(input.totalSpent)} va ${formatNumber(input.totalVisits)} luot hen, muc tieu tiep theo la ${input.nextTierName}.`;
  }

  const expiresText = formatDate(input.expiresAt);
  if (expiresText) {
    return `Ban dang o hang cao nhat. Quyen loi hien tai co hieu luc den ${expiresText}.`;
  }

  return "Ban dang o hang cao nhat va co the tiep tuc su dung cac quyen loi hien co.";
}

function describeTierRequirements(tier: {
  spendingThreshold: number;
  visitThreshold: number;
}) {
  const parts: string[] = [];

  if (tier.spendingThreshold > 0) {
    parts.push(`${formatNumber(tier.spendingThreshold)} chi tiêu`);
  }

  if (tier.visitThreshold > 0) {
    parts.push(`${formatNumber(tier.visitThreshold)} lượt hẹn`);
  }

  return parts.length ? parts.join(" hoặc ") : "điều kiện linh hoạt theo cửa hàng";
}

function buildNextTierGuidance(input: {
  nextTier: {
    name: string;
    spendingThreshold: number;
    visitThreshold: number;
  } | null;
  totalSpent: number;
  totalVisits: number;
  pointsBalance: number;
}) {
  if (!input.nextTier) {
    return `Bạn đang có ${formatNumber(input.pointsBalance)} điểm và đã ở hạng cao nhất.`;
  }

  const remainingSpend = Math.max(0, input.nextTier.spendingThreshold - input.totalSpent);
  const remainingVisits = Math.max(0, input.nextTier.visitThreshold - input.totalVisits);
  const parts: string[] = [`Bạn đang có ${formatNumber(input.pointsBalance)} điểm.`];

  if (input.nextTier.spendingThreshold > 0) {
    parts.push(`Cần thêm ${formatNumber(remainingSpend)} chi tiêu để lên ${input.nextTier.name}.`);
  }

  if (input.nextTier.visitThreshold > 0) {
    parts.push(`Cần thêm ${formatNumber(remainingVisits)} lượt hẹn để lên ${input.nextTier.name}.`);
  }

  if (input.nextTier.spendingThreshold <= 0 && input.nextTier.visitThreshold <= 0) {
    parts.push(`Mục tiêu tiếp theo là ${input.nextTier.name}.`);
  }

  return parts.join(" ");
}

export default function MembershipScreen() {
  const strings = useCustomerStrings();
  const [showBenefitsModal, setShowBenefitsModal] = useState(false);
  const {
    currentTier,
    expiresAt,
    hasMembership,
    isRefreshing,
    offers,
    perks,
    pointsBalance,
    progress,
    refresh,
    tiers,
    totalSpent,
    totalVisits,
    nextTier,
  } = useCustomerMembership();

  const tierName = currentTier?.name || "Thanh vien";
  const tierAccent = currentTier?.accentColor || "#efc26d";
  const helperText = buildHelperText({
    hasMembership,
    nextTierName: nextTier?.name ?? null,
    pointsBalance,
    totalSpent,
    totalVisits,
    expiresAt,
  });
  const progressWidth = `${Math.max(0, Math.min(progress, 1)) * 100}%` as `${number}%`;
  const nextTierGuidance = buildNextTierGuidance({
    nextTier,
    totalSpent,
    totalVisits,
    pointsBalance,
  });

  return (
    <CustomerScreen hideHeader title={strings.membershipTitle} contentContainerStyle={styles.content} onRefresh={() => void refresh()} refreshing={isRefreshing}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{strings.membershipTitle}</Text>
        <CustomerTopActions />
      </View>

      <View style={styles.heroCard}>
        <View style={styles.patternLarge} />
        <View style={styles.patternSmall} />

        <Text style={styles.brand}>CHAM BEAUTY</Text>
        <Text style={styles.tier}>
          Member <Text style={[styles.tierAccent, { color: tierAccent }]}>{tierName}</Text>
        </Text>

        <Text style={styles.pointsLabel}>Diem hien tai</Text>
        <Text style={styles.points}>{formatNumber(pointsBalance)} diem</Text>

        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressWidth }]} />
          </View>

          <View style={styles.heroBadge}>
            <Feather color="#f1c56d" name="award" size={14} />
            <Text style={styles.heroBadgeText}>{nextTier?.name ? `Lên ${nextTier.name}` : "Quyền lợi"}</Text>
          </View>
        </View>

        <Text style={styles.helper}>{helperText}</Text>

        <Pressable style={styles.benefitButton} onPress={() => setShowBenefitsModal(true)}>
          <Text style={styles.benefitButtonText}>{strings.membershipBenefitsTitle}</Text>
        </Pressable>

        <View style={styles.medalShell}>
          <View style={styles.medalOuter}>
            <View style={styles.medalInner}>
              <Feather color="#bb7723" name="award" size={26} />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>Quyền lợi của bạn</Text>

        <View style={styles.perkList}>
          {(perks.length ? perks : ["Khong co quyen loi nao duoc cau hinh cho hang hien tai."]).map((perk) => (
            <SurfaceCard key={perk} style={styles.perkCard}>
              <View style={styles.perkIcon}>
                <Feather color={colors.text} name="star" size={18} />
              </View>

              <View style={styles.perkCopy}>
                <Text style={styles.perkTitle}>{perk}</Text>
                <Text style={styles.perkDetail}>Du lieu quyen loi dang doc truc tiep tu hang thanh vien that.</Text>
              </View>
            </SurfaceCard>
          ))}
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>Các hạng thành viên</Text>

        <View style={styles.perkList}>
          {tiers.map((tier) => (
            <SurfaceCard key={tier.id} style={styles.tierCard}>
              <View style={styles.tierCardHeader}>
                <Text style={styles.tierCardTitle}>{tier.name}</Text>
                <Text style={[styles.tierCardBadge, tier.id === currentTier?.id ? styles.tierCardBadgeActive : null]}>
                  {tier.id === currentTier?.id ? "Hạng hiện tại" : "Mục tiêu"}
                </Text>
              </View>
              <Text style={styles.tierCardRule}>Điều kiện: {describeTierRequirements(tier)}</Text>
              <Text style={styles.tierCardRule}>
                Ưu đãi: {tier.perks.length ? tier.perks.join(", ") : "Chưa có mô tả ưu đãi cho hạng này."}
              </Text>
            </SurfaceCard>
          ))}
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>Ưu đãi đang áp dụng</Text>

        <View style={styles.perkList}>
          {offers.length ? (
            offers.map((offer) => (
              <SurfaceCard key={offer.id} style={styles.perkCard}>
                <View style={styles.perkIcon}>
                  <Feather color={colors.text} name="tag" size={18} />
                </View>

                <View style={styles.perkCopy}>
                  <Text style={styles.perkTitle}>{offer.title}</Text>
                  <Text style={styles.perkDetail}>{offer.description}</Text>
                </View>
              </SurfaceCard>
            ))
          ) : (
            <SurfaceCard style={styles.ctaCard}>
              <Text style={styles.ctaTitle}>Chua co uu dai dang bat</Text>
              <Text style={styles.ctaText}>Khi admin cap nhat Landing Feed, uu dai se tu dong hien tai day.</Text>
            </SurfaceCard>
          )}
        </View>
      </View>

      <Modal visible={showBenefitsModal} transparent animationType="fade" onRequestClose={() => setShowBenefitsModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowBenefitsModal(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>{strings.membershipBenefitsTitle}</Text>
            <Text style={styles.modalBody}>{currentTier?.description?.trim() || strings.membershipBenefitsBody}</Text>
            <Text style={styles.modalSectionTitle}>Cách nâng hạng</Text>
            <Text style={styles.modalBody}>{nextTierGuidance}</Text>
            <Text style={styles.modalBody}>{strings.membershipHowToUpgrade}</Text>
            <Text style={styles.modalSectionTitle}>Cách tăng ưu đãi</Text>
            <Text style={styles.modalBody}>{strings.membershipHowToBoost}</Text>
            <Text style={styles.modalSectionTitle}>Ưu đãi theo từng hạng</Text>
            {tiers.map((tier) => (
              <View key={tier.id} style={styles.modalTierBlock}>
                <Text style={styles.modalTierTitle}>{tier.name}</Text>
                <Text style={styles.modalBody}>Điều kiện: {describeTierRequirements(tier)}</Text>
                <Text style={styles.modalBody}>
                  Ưu đãi: {tier.perks.length ? tier.perks.join(", ") : "Chưa có mô tả ưu đãi cho hạng này."}
                </Text>
              </View>
            ))}
            <Pressable style={styles.modalCloseButton} onPress={() => setShowBenefitsModal(false)}>
              <Text style={styles.modalCloseText}>Đã hiểu</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </CustomerScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
    paddingTop: 4,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  backButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  title: {
    color: colors.text,
    flex: 1,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
    textAlign: "center",
  },
  heroCard: {
    backgroundColor: "#34291d",
    borderRadius: 24,
    minHeight: 238,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingVertical: 18,
    position: "relative",
  },
  patternLarge: {
    borderColor: "rgba(236, 180, 93, 0.08)",
    borderRadius: 52,
    borderWidth: 1,
    height: 210,
    position: "absolute",
    right: 28,
    top: -30,
    transform: [{ rotate: "18deg" }],
    width: 210,
  },
  patternSmall: {
    borderColor: "rgba(236, 180, 93, 0.08)",
    borderRadius: 42,
    borderWidth: 1,
    height: 160,
    position: "absolute",
    right: -12,
    top: -12,
    transform: [{ rotate: "18deg" }],
    width: 160,
  },
  brand: {
    color: "#efc26d",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 14,
  },
  tier: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 35,
    marginBottom: 14,
  },
  tierAccent: {
    color: "#efc26d",
  },
  pointsLabel: {
    color: "#e7dcd1",
    fontSize: 14,
    marginBottom: 6,
  },
  points: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 14,
  },
  progressRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  progressTrack: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: radius.pill,
    flex: 1,
    height: 9,
    overflow: "hidden",
  },
  progressFill: {
    backgroundColor: "#f4c56f",
    borderRadius: radius.pill,
    height: "100%",
  },
  heroBadge: {
    alignItems: "center",
    backgroundColor: "rgba(111, 81, 44, 0.76)",
    borderColor: "#d1a45d",
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 12,
  },
  heroBadgeText: {
    color: "#fff4e5",
    fontSize: 14,
    fontWeight: "700",
  },
  helper: {
    color: "#eadfd1",
    fontSize: 13,
    lineHeight: 18,
    maxWidth: "82%",
  },
  benefitButton: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  benefitButtonText: {
    color: "#fff4e5",
    fontSize: 13,
    fontWeight: "800",
  },
  medalShell: {
    position: "absolute",
    right: 18,
    top: 18,
  },
  medalOuter: {
    alignItems: "center",
    backgroundColor: "#eea848",
    borderRadius: radius.pill,
    height: 78,
    justifyContent: "center",
    width: 78,
  },
  medalInner: {
    alignItems: "center",
    backgroundColor: "#ffd58e",
    borderColor: "#f5b557",
    borderRadius: radius.pill,
    borderWidth: 5,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  sectionBlock: {
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  perkList: {
    gap: 10,
  },
  perkCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  tierCard: {
    gap: 8,
    padding: 14,
  },
  tierCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  tierCardTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  tierCardBadge: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "800",
  },
  tierCardBadgeActive: {
    color: colors.accent,
  },
  tierCardRule: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  perkIcon: {
    alignItems: "center",
    backgroundColor: "#f6efe7",
    borderRadius: 18,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  perkCopy: {
    flex: 1,
    gap: 2,
  },
  perkTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  perkDetail: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  ctaCard: {
    backgroundColor: "#fff7ef",
    borderColor: "#eaded1",
    gap: 8,
  },
  ctaTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  ctaText: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  modalOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    width: "100%",
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12,
  },
  modalSectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6,
    marginTop: 10,
  },
  modalBody: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  modalTierBlock: {
    gap: 4,
    marginTop: 10,
  },
  modalTierTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  modalCloseButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 16,
    marginTop: 18,
    paddingVertical: 12,
  },
  modalCloseText: {
    color: "#fffaf5",
    fontSize: 14,
    fontWeight: "800",
  },
});
