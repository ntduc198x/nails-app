import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useMemo, useState } from "react";
import { CustomerScreen, CustomerTopActions, SurfaceCard } from "@/src/features/customer/ui";
import { premiumTheme } from "@/src/design/premium-theme";
import { useCustomerMembership } from "@/src/hooks/use-customer-membership";
import { useCustomerStrings } from "@/src/features/customer/strings";
import type { CustomerMembershipTier } from "@nails/shared";

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
  eligibleVisitsMinSpend: number;
  expiresAt: string | null;
}) {
  if (!input.hasMembership) {
    return "Đang sẵn sàng kích hoạt thẻ thành viên thật từ dữ liệu của cửa hàng.";
  }

  if (input.nextTierName) {
    return `Đang tích lũy ${formatNumber(input.pointsBalance)} điểm. Mức chi tiêu hiện tại ${formatNumber(input.totalSpent)} và ${formatNumber(input.eligibleVisitsMinSpend)}/${formatNumber(input.totalVisits)} lượt hẹn chuẩn, mục tiêu tiếp theo là ${input.nextTierName}.`;
  }

  const expiresText = formatDate(input.expiresAt);
  if (expiresText) {
    return `Bạn đang ở hạng cao nhất. Quyền lợi hiện tại có hiệu lực đến ${expiresText}.`;
  }

  return "Bạn đang ở hạng cao nhất và có thể tiếp tục sử dụng các quyền lợi hiện có.";
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

function getTierGradient(tier: CustomerMembershipTier | null) {
  switch ((tier?.themeKey || tier?.code || "bronze").toLowerCase()) {
    case "silver":
      return ["#E7EBF0", "#98A2B3"] as const;
    case "gold":
      return ["#F6D48B", "#B9852F"] as const;
    case "platinum":
      return ["#DDE4EA", "#6E7C8C"] as const;
    case "diamond":
      return ["#344A7A", "#111827"] as const;
    case "bronze":
    default:
      return ["#C18A57", "#5D3B22"] as const;
  }
}

function getTierBadgeLabel(input: {
  tier: CustomerMembershipTier;
  currentTier: CustomerMembershipTier | null;
  nextTier: CustomerMembershipTier | null;
}) {
  if (input.currentTier?.id === input.tier.id) return "Hạng hiện tại";
  if (input.nextTier?.id === input.tier.id) return "Mục tiêu tiếp theo";
  if (input.currentTier && input.tier.sortOrder < input.currentTier.sortOrder) return "Đã mở khóa";
  return "Chưa mở";
}

function buildNextTierGuidance(input: {
  nextTier: {
    name: string;
    spendingThreshold: number;
    visitThreshold: number;
  } | null;
  totalSpent: number;
  eligibleVisitsMinSpend: number;
  pointsBalance: number;
}) {
  if (!input.nextTier) {
    return `Bạn đang có ${formatNumber(input.pointsBalance)} điểm và đã ở hạng cao nhất.`;
  }

  const remainingSpend = Math.max(0, input.nextTier.spendingThreshold - input.totalSpent);
  const remainingVisits = Math.max(0, input.nextTier.visitThreshold - input.eligibleVisitsMinSpend);
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
  const [selectedTier, setSelectedTier] = useState<CustomerMembershipTier | null>(null);
  const {
    currentTier,
    expiresAt,
    hasMembership,
    isRefreshing,
    offers,
    perks,
    pointsBalance,
    progress,
    progressSpent,
    progressVisits,
    refresh,
    tiers,
    totalSpent,
    totalVisits,
    eligibleVisitsMinSpend,
    nextTier,
    remainingSpentToNext,
    remainingVisitsToNext,
  } = useCustomerMembership();

  const tierName = currentTier?.name || "Thành viên";
  const tierAccent = currentTier?.accentColor || "#efc26d";
  const helperText = buildHelperText({
    hasMembership,
    nextTierName: nextTier?.name ?? null,
    pointsBalance,
    totalSpent,
    totalVisits,
    eligibleVisitsMinSpend,
    expiresAt,
  });
  const progressWidth = `${Math.max(0, Math.min(progress, 1)) * 100}%` as `${number}%`;
  const nextTierGuidance = buildNextTierGuidance({
    nextTier,
    totalSpent,
    eligibleVisitsMinSpend,
    pointsBalance,
  });
  const heroGradient = getTierGradient(currentTier);
  const selectedTierBadge = selectedTier ? getTierBadgeLabel({ tier: selectedTier, currentTier, nextTier }) : null;
  const selectedTierRemainingSpend = selectedTier ? Math.max(0, selectedTier.spendingThreshold - totalSpent) : 0;
  const selectedTierRemainingVisits = selectedTier ? Math.max(0, selectedTier.visitThreshold - eligibleVisitsMinSpend) : 0;

  return (
    <CustomerScreen hideHeader title={strings.membershipTitle} contentContainerStyle={styles.content} onRefresh={() => void refresh()} refreshing={isRefreshing}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{strings.membershipTitle}</Text>
        <CustomerTopActions />
      </View>

      <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
        <View style={styles.patternLarge} />
        <View style={styles.patternSmall} />

        <Text style={styles.brand}>CHẠM BEAUTY</Text>
        <Text style={styles.tier}>
          Member <Text style={[styles.tierAccent, { color: tierAccent }]}>{tierName}</Text>
        </Text>

        <Text style={styles.pointsLabel}>Điểm hiện tại</Text>
        <Text style={styles.points}>{formatNumber(pointsBalance)} điểm</Text>

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
      </LinearGradient>

      <SurfaceCard style={styles.progressSummaryCard}>
        <View style={styles.progressMetricBlock}>
          <Text style={styles.progressMetricLabel}>Chi tiêu hiện tại</Text>
          <Text style={styles.progressMetricValue}>{formatNumber(totalSpent)}đ</Text>
          <Text style={styles.progressMetricHint}>
            {nextTier ? `Còn ${formatNumber(remainingSpentToNext)}đ để lên ${nextTier.name}` : "Đã đạt hạng cao nhất"}
          </Text>
        </View>
        <View style={styles.progressMetricDivider} />
        <View style={styles.progressMetricBlock}>
          <Text style={styles.progressMetricLabel}>Lượt hẹn chuẩn</Text>
          <Text style={styles.progressMetricValue}>{formatNumber(eligibleVisitsMinSpend)}/{formatNumber(totalVisits)}</Text>
          <Text style={styles.progressMetricHint}>
            Chỉ tính bill từ {formatNumber(300000)}đ. {nextTier ? `Còn ${formatNumber(remainingVisitsToNext)} lượt để lên ${nextTier.name}` : ""}
          </Text>
        </View>
      </SurfaceCard>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>Quyền lợi của bạn</Text>

        <View style={styles.perkList}>
          {(perks.length ? perks : ["Không có quyền lợi nào được cấu hình cho hạng hiện tại."]).map((perk) => (
            <SurfaceCard key={perk} style={styles.perkCard}>
              <View style={styles.perkIcon}>
                <Feather color={colors.text} name="star" size={18} />
              </View>

              <View style={styles.perkCopy}>
                <Text style={styles.perkTitle}>{perk}</Text>
                <Text style={styles.perkDetail}>Dữ liệu quyền lợi đang đọc trực tiếp từ hạng thành viên thật.</Text>
              </View>
            </SurfaceCard>
          ))}
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>Các hạng thành viên</Text>

        <View style={styles.perkList}>
          {tiers.map((tier) => {
            const badgeLabel = getTierBadgeLabel({ tier, currentTier, nextTier });
            const tierGradient = getTierGradient(tier);
            return (
              <Pressable key={tier.id} onPress={() => setSelectedTier(tier)}>
                <LinearGradient colors={tierGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tierCard}>
                  <View style={styles.tierCardHeader}>
                    <Text style={styles.tierCardTitle}>{tier.name}</Text>
                    <Text style={[styles.tierCardBadge, tier.id === currentTier?.id ? styles.tierCardBadgeActive : null]}>
                      {badgeLabel}
                    </Text>
                  </View>
                  <Text style={styles.tierCardRule}>Điều kiện: {describeTierRequirements(tier)}</Text>
                  <Text style={styles.tierCardRule}>
                    Ưu đãi: {tier.perks.length ? tier.perks.join(", ") : "Chưa có mô tả ưu đãi cho hạng này."}
                  </Text>
                </LinearGradient>
              </Pressable>
            );
          })}
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
              <Text style={styles.ctaTitle}>Chưa có ưu đãi đang bật</Text>
              <Text style={styles.ctaText}>Khi admin cập nhật Landing Feed, ưu đãi sẽ tự động hiển thị đầy đủ.</Text>
            </SurfaceCard>
          )}
        </View>
      </View>

      <Modal visible={Boolean(selectedTier)} transparent animationType="fade" onRequestClose={() => setSelectedTier(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedTier(null)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>{selectedTier?.name}</Text>
            <Text style={styles.modalBody}>{selectedTier?.description?.trim() || "Thông tin hạng thành viên đang được cập nhật."}</Text>
            <Text style={styles.modalSectionTitle}>{selectedTierBadge}</Text>
            <Text style={styles.modalBody}>Điều kiện: {selectedTier ? describeTierRequirements(selectedTier) : "-"}</Text>
            <Text style={styles.modalBody}>
              {selectedTier?.perks.length ? `Ưu đãi: ${selectedTier.perks.join(", ")}` : "Chưa có mô tả ưu đãi cho hạng này."}
            </Text>
            <Text style={styles.modalSectionTitle}>Tiến độ của bạn</Text>
            <Text style={styles.modalBody}>Chi tiêu hiện tại: {formatNumber(totalSpent)}đ</Text>
            <Text style={styles.modalBody}>Lượt hẹn chuẩn: {formatNumber(eligibleVisitsMinSpend)}/{formatNumber(totalVisits)} (chỉ tính bill từ 300.000đ)</Text>
            {selectedTier && selectedTier.id !== currentTier?.id ? (
              <>
                <Text style={styles.modalBody}>Cần thêm {formatNumber(selectedTierRemainingSpend)}đ chi tiêu.</Text>
                <Text style={styles.modalBody}>Cần thêm {formatNumber(selectedTierRemainingVisits)} lượt hẹn chuẩn.</Text>
              </>
            ) : null}
            <Pressable style={styles.modalCloseButton} onPress={() => setSelectedTier(null)}>
              <Text style={styles.modalCloseText}>Đã hiểu</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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
  progressSummaryCard: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  progressMetricBlock: {
    flex: 1,
    gap: 4,
  },
  progressMetricDivider: {
    backgroundColor: colors.border,
    width: 1,
  },
  progressMetricLabel: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  progressMetricValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  progressMetricHint: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 17,
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
    borderRadius: 20,
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
