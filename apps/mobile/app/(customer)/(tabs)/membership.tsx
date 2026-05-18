import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
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
  hasTierData: boolean;
  currentTierName: string | null;
  nextTierName: string | null;
  pointsBalance: number;
  totalSpent: number;
  totalVisits: number;
  eligibleVisitsMinSpend: number;
  remainingSpentToNext: number;
  remainingVisitsToNext: number;
  expiresAt: string | null;
}) {
  if (!input.hasTierData) {
    return "Bạn đang là thành viên thường. Dữ liệu quyền lợi đang được đồng bộ thêm.";
  }

  if (!input.hasMembership && input.nextTierName) {
    const parts: string[] = [];
    if (input.remainingSpentToNext > 0) {
      parts.push(`${formatNumber(input.remainingSpentToNext)}đ chi tiêu`);
    }
    if (input.remainingVisitsToNext > 0) {
      parts.push(`${formatNumber(input.remainingVisitsToNext)} lượt hẹn chuẩn`);
    }

    const guidance = parts.length ? `Còn ${parts.join(" hoặc ")} để lên ${input.nextTierName}.` : `Mục tiêu tiếp theo là ${input.nextTierName}.`;
    return `Bạn đang ở hạng thành viên thường và có thể bắt đầu tích lũy để lên ${input.nextTierName}. ${guidance}`;
  }

  if (input.nextTierName) {
    const parts: string[] = [];
    if (input.remainingSpentToNext > 0) {
      parts.push(`${formatNumber(input.remainingSpentToNext)}đ chi tiêu`);
    }
    if (input.remainingVisitsToNext > 0) {
      parts.push(`${formatNumber(input.remainingVisitsToNext)} lượt hẹn chuẩn`);
    }

    const guidance = parts.length ? `Còn ${parts.join(" hoặc ")} để lên ${input.nextTierName}.` : `Mục tiêu tiếp theo là ${input.nextTierName}.`;
    return `Bạn đang ở hạng ${input.currentTierName ?? "hiện tại"}, có ${formatNumber(input.pointsBalance)} điểm, ${formatNumber(input.eligibleVisitsMinSpend)}/${formatNumber(input.totalVisits)} lượt hẹn chuẩn và ${formatNumber(input.totalSpent)}đ chi tiêu. ${guidance}`;
  }

  const expiresText = formatDate(input.expiresAt);
  if (expiresText) {
    return `Bạn đang ở hạng cao nhất. Quyền lợi hiện tại có hiệu lực đến ${expiresText}.`;
  }

  return `Bạn đang là thành viên và có thể tiếp tục tích lũy để mở thêm quyền lợi.`;
}

function describeTierRequirements(tier: {
  spendingThreshold: number;
  visitThreshold: number;
  visitMinSpend?: number;
}) {
  const parts: string[] = [];

  if (tier.spendingThreshold > 0) {
    parts.push(`${formatNumber(tier.spendingThreshold)} chi tiêu`);
  }

  if (tier.visitThreshold > 0) {
    const visitMinSpend = Math.max(0, tier.visitMinSpend ?? 300000);
    parts.push(`${formatNumber(tier.visitThreshold)} lượt hẹn chuẩn (bill từ ${formatNumber(visitMinSpend)}đ)`);
  }

  return parts.length ? parts.join(" hoặc ") : "điều kiện linh hoạt theo cửa hàng";
}

function getTierGradient(tier: CustomerMembershipTier | null) {
  switch ((tier?.themeKey || tier?.code || "bronze").toLowerCase()) {
    case "silver":
      return ["#CDD5DE", "#8A95A3"] as const;
    case "gold":
      return ["#D7B372", "#9A6B2F"] as const;
    case "platinum":
      return ["#C8D2DA", "#6A7887"] as const;
    case "diamond":
      return ["#2D3E69", "#141B2A"] as const;
    case "bronze":
    default:
      return ["#B6865B", "#684123"] as const;
  }
}

function getTierIconName(tier: CustomerMembershipTier | null): React.ComponentProps<typeof Feather>["name"] {
  switch ((tier?.badgeIcon || tier?.themeKey || tier?.code || "bronze").toLowerCase()) {
    case "shield":
    case "silver":
      return "shield";
    case "star":
    case "gold":
      return "star";
    case "zap":
    case "platinum":
      return "zap";
    case "gem":
    case "diamond":
      return "hexagon";
    case "award":
    case "bronze":
    default:
      return "award";
  }
}

function getTierBadgeLabel(input: {
  tier: CustomerMembershipTier;
  currentTier: CustomerMembershipTier | null;
  nextTier: CustomerMembershipTier | null;
}) {
  if (input.currentTier?.id === input.tier.id) return "Hiện tại";
  if (input.nextTier?.id === input.tier.id) return "Tiếp theo";
  if (input.currentTier && input.tier.sortOrder < input.currentTier.sortOrder) return "Đã đạt";
  return "Khóa";
}

function buildNextTierGuidance(input: {
  hasTierData: boolean;
  nextTier: {
    name: string;
    spendingThreshold: number;
    visitThreshold: number;
    visitMinSpend?: number;
  } | null;
  totalSpent: number;
  eligibleVisitsMinSpend: number;
  pointsBalance: number;
}) {
  if (!input.hasTierData) {
    return "Chưa có dữ liệu tier để tính mốc nâng hạng.";
  }

  if (!input.nextTier) {
    return `Bạn đang có ${formatNumber(input.pointsBalance)} điểm và đã ở hạng cao nhất.`;
  }

  const remainingSpend = Math.max(0, input.nextTier.spendingThreshold - input.totalSpent);
  const remainingVisits = Math.max(0, input.nextTier.visitThreshold - input.eligibleVisitsMinSpend);
  const milestones: string[] = [];

  if (input.nextTier.spendingThreshold > 0) {
    milestones.push(`Chi tiêu tối thiểu ${formatNumber(input.nextTier.spendingThreshold)}đ`);
  }

  if (input.nextTier.visitThreshold > 0) {
    milestones.push(`${formatNumber(input.nextTier.visitThreshold)} lượt hẹn chuẩn (bill từ ${formatNumber(input.nextTier.visitMinSpend ?? 300000)}đ)`);
  }

  const remainingParts: string[] = [];
  if (remainingSpend > 0) {
    remainingParts.push(`${formatNumber(remainingSpend)}đ chi tiêu`);
  }
  if (remainingVisits > 0) {
    remainingParts.push(`${formatNumber(remainingVisits)} lượt hẹn chuẩn`);
  }

  return `Mốc ${input.nextTier.name}: ${milestones.join(" hoặc ")}. Hiện tại bạn có ${formatNumber(input.pointsBalance)} điểm và còn thiếu ${remainingParts.join(" hoặc ")}.`;
}

function buildTierMomentLine(tier: {
  name: string;
  code?: string;
}) {
  switch ((tier.code || tier.name).toLowerCase()) {
    case "bronze":
      return "Hạng khởi đầu dành cho khách mới bắt đầu tích lũy quyền lợi thành viên.";
    case "silver":
      return "Phù hợp với khách quay lại đều và bắt đầu nhận thêm ưu tiên.";
    case "gold":
      return "Dành cho khách thân thiết với quyền lợi rõ ràng và trải nghiệm tốt hơn.";
    case "platinum":
      return "Hạng cao cấp với nhiều ưu tiên hơn trong lịch hẹn và quà tặng.";
    case "diamond":
      return "Hạng cao nhất với đặc quyền nổi bật và trải nghiệm chăm sóc ưu tiên.";
    default:
      return "Mỗi hạng thành viên sẽ có quyền lợi và mức ưu tiên khác nhau.";
  }
}

function buildTierPrivilegeLine(tier: {
  name: string;
  code?: string;
  perks: string[];
}) {
  if (tier.perks.length) {
    return tier.perks.join(", ");
  }

  return "Ưu đãi của hạng này đang được hoàn thiện thêm.";
}

function getOfferCode(offer: { metadata?: Record<string, unknown> }) {
  const value = offer.metadata?.code;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getOfferUsageHint(offer: { metadata?: Record<string, unknown> }) {
  const value = offer.metadata?.usageHint;
  return typeof value === "string" && value.trim() ? value.trim() : "Dùng khi đặt lịch hoặc báo trực tiếp cho cửa hàng để được áp dụng.";
}

function getOfferRedeemLabel(offer: { metadata?: Record<string, unknown> }) {
  const value = offer.metadata?.redeemLabel;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getOfferBookingCtaLabel(offer: { metadata?: Record<string, unknown> }) {
  const value = offer.metadata?.bookingCtaLabel;
  return typeof value === "string" && value.trim() ? value.trim() : "Dùng khi đặt lịch";
}

function getOfferPackageLabel(offer: { metadata?: Record<string, unknown> }) {
  const packageTier = typeof offer.metadata?.packageTier === "string" ? offer.metadata.packageTier.trim().toUpperCase() : "REGULAR";
  switch (packageTier) {
    case "BRONZE":
      return "Gói Bronze";
    case "SILVER":
      return "Gói Silver";
    case "GOLD":
      return "Gói Gold";
    case "PLATINUM":
      return "Gói Platinum";
    case "DIAMOND":
      return "Gói Diamond";
    case "REGULAR":
    default:
      return "Gói thành viên thường";
  }
}

export default function MembershipScreen() {
  const strings = useCustomerStrings();
  const [showBenefitsModal, setShowBenefitsModal] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
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
    eligibleVisitsByTierCode,
    nextTier,
    remainingSpentToNext,
    remainingVisitsToNext,
  } = useCustomerMembership();

  const hasTierData = tiers.length > 0;
  const hasCurrentTierBadge = Boolean(currentTier);
  const tierAccent = currentTier?.accentColor || "#efc26d";
  const helperText = buildHelperText({
    hasMembership,
    hasTierData,
    currentTierName: currentTier?.name ?? null,
    nextTierName: nextTier?.name ?? null,
    pointsBalance,
    totalSpent,
    totalVisits,
    eligibleVisitsMinSpend,
    remainingSpentToNext,
    remainingVisitsToNext,
    expiresAt,
  });
  const progressWidth = `${Math.max(0, Math.min(progress, 1)) * 100}%` as `${number}%`;
  const nextTierGuidance = buildNextTierGuidance({
    hasTierData,
    nextTier,
    totalSpent,
    eligibleVisitsMinSpend,
    pointsBalance,
  });
  const milestoneSummary = !hasTierData
    ? "Chưa có dữ liệu tier để hiển thị lộ trình nâng hạng."
    : nextTier
      ? `Mốc ${nextTier.name}: cần ${describeTierRequirements(nextTier)}.`
      : "Bạn đang ở hạng cao nhất.";
  const heroGradient = getTierGradient(currentTier);
  const selectedTierBadge = selectedTier ? getTierBadgeLabel({ tier: selectedTier, currentTier, nextTier }) : null;
  const selectedTierRemainingSpend = selectedTier ? Math.max(0, selectedTier.spendingThreshold - totalSpent) : 0;
  const selectedTierEligibleVisits = selectedTier ? (eligibleVisitsByTierCode[selectedTier.code] ?? eligibleVisitsMinSpend) : 0;
  const selectedTierRemainingVisits = selectedTier ? Math.max(0, selectedTier.visitThreshold - selectedTierEligibleVisits) : 0;
  const selectedTierState = selectedTier
    ? currentTier?.id === selectedTier.id
      ? "current"
      : nextTier?.id === selectedTier.id
        ? "next"
        : currentTier && selectedTier.sortOrder < currentTier.sortOrder
          ? "completed"
          : "locked"
    : null;
  const selectedTierIndex = selectedTier ? tiers.findIndex((tier) => tier.id === selectedTier.id) : -1;
  const selectedTierPrevious = selectedTierIndex > 0 ? tiers[selectedTierIndex - 1] ?? null : null;

  useEffect(() => {
    console.log("[membership] tiers loaded", {
      count: tiers.length,
      tierIds: tiers.map((tier) => tier.id),
      currentTierId: currentTier?.id ?? null,
      nextTierId: nextTier?.id ?? null,
    });
  }, [currentTier?.id, nextTier?.id, tiers]);

  useEffect(() => {
    console.log("[membership] selectedTier changed", {
      selectedTierId: selectedTier?.id ?? null,
      selectedTierName: selectedTier?.name ?? null,
      modalVisible: Boolean(selectedTier),
      state: selectedTierState,
    });
  }, [selectedTier, selectedTierState]);

  return (
    <CustomerScreen hideHeader title={strings.membershipTitle} contentContainerStyle={styles.content} onRefresh={() => void refresh()} refreshing={isRefreshing}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{strings.membershipTitle}</Text>
        <CustomerTopActions />
      </View>

      <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
        <View style={styles.patternLarge} />
        <View style={styles.patternSmall} />

        <View style={styles.heroHeadingRow}>
          <Text style={styles.brand}>CHẠM BEAUTY</Text>
          {hasCurrentTierBadge ? (
            <View style={[styles.tierBadge, { borderColor: tierAccent }]}> 
              <Feather color={tierAccent} name={getTierIconName(currentTier)} size={14} />
              <Text style={[styles.tierBadgeText, { color: tierAccent }]}>{currentTier?.name}</Text>
            </View>
          ) : (
            <Text style={styles.tier}>Member</Text>
          )}
        </View>
        <Text style={styles.tierEyebrow}>MEMBERSHIP CARD</Text>

        <Text style={styles.pointsLabel}>Điểm hiện tại</Text>
        <Text style={styles.points}>{formatNumber(pointsBalance)} điểm</Text>

        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressWidth }]} />
          </View>

          <Pressable
            style={[styles.heroBadge, !hasTierData ? styles.heroBadgeDisabled : null]}
            disabled={!hasTierData}
            onPress={() => {
              console.log("[membership] hero benefits button pressed", {
                currentTierId: currentTier?.id ?? null,
                currentTierName: currentTier?.name ?? null,
              });
              setSelectedTier(currentTier ?? nextTier ?? tiers[0] ?? null);
            }}
          >
            <Feather color="#f1c56d" name={getTierIconName(nextTier ?? currentTier)} size={14} />
            <Text style={styles.heroBadgeText}>{nextTier?.name ? `Lên ${nextTier.name}` : "Quyền lợi"}</Text>
          </Pressable>
        </View>

        <Text style={styles.helper}>{helperText}</Text>
        <Text style={styles.milestoneText}>{milestoneSummary}</Text>

        <Pressable hitSlop={10} style={styles.benefitButton} onPress={() => setShowBenefitsModal(true)}>
          <Feather color="#fff4e5" name="gift" size={14} />
          <Text style={styles.benefitButtonText}>{strings.membershipBenefitsTitle}</Text>
          <Feather color="#fff4e5" name="chevron-right" size={14} />
        </Pressable>

        {hasCurrentTierBadge ? (
          <View style={styles.medalShell}>
            <View style={styles.medalOuter}>
              <View style={styles.medalInner}>
                <Feather color="#bb7723" name={getTierIconName(currentTier)} size={26} />
              </View>
            </View>
          </View>
        ) : null}
      </LinearGradient>

      <View style={styles.progressSummaryWrap}>
        <SurfaceCard style={styles.progressMetricCard}>
          <Text style={styles.progressMetricLabel}>Chi tiêu hiện tại</Text>
          <Text style={styles.progressMetricValue}>{formatNumber(totalSpent)}đ</Text>
          <View style={styles.inlineTrack}>
            <View style={[styles.inlineFill, { width: `${Math.max(0, Math.min(progressSpent, 1)) * 100}%` }]} />
          </View>
          <Text style={styles.progressMetricHint}>
            {nextTier
              ? `Mốc ${nextTier.name}: còn ${formatNumber(remainingSpentToNext)}đ chi tiêu.`
              : currentTier
                ? `Bạn đang ở hạng ${currentTier.name}.`
                : "Đang đồng bộ hạng thành viên."}
          </Text>
        </SurfaceCard>
        <SurfaceCard style={styles.progressMetricCard}>
          <Text style={styles.progressMetricLabel}>Lượt hẹn chuẩn</Text>
          <Text style={styles.progressMetricValue}>{formatNumber(eligibleVisitsMinSpend)}/{formatNumber(totalVisits)}</Text>
          <View style={styles.inlineTrack}>
            <View style={[styles.inlineFill, { width: `${Math.max(0, Math.min(progressVisits, 1)) * 100}%` }]} />
          </View>
          <Text style={styles.progressMetricHint}>
            {nextTier
              ? `Mốc ${nextTier.name}: còn ${formatNumber(remainingVisitsToNext)} lượt chuẩn. Chỉ tính bill từ ${formatNumber(nextTier.visitMinSpend ?? 300000)}đ.`
              : `Hiện đang tính lượt chuẩn từ bill ${formatNumber(currentTier?.visitMinSpend ?? 300000)}đ.`}
          </Text>
        </SurfaceCard>
      </View>

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
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Ưu đãi đang áp dụng</Text>
          <Pressable style={styles.inlineActionButton} onPress={() => setShowUsageModal(true)}>
            <Feather color={colors.text} name="help-circle" size={14} />
            <Text style={styles.inlineActionText}>Cách dùng ưu đãi</Text>
          </Pressable>
        </View>

        <View style={styles.perkList}>
          {offers.length ? (
            offers.map((offer) => {
              const offerCode = getOfferCode(offer);
              const offerUsageHint = getOfferUsageHint(offer);
              const redeemLabel = getOfferRedeemLabel(offer);

              return (
                <Pressable
                  key={offer.id}
                  onPress={() =>
                    offerCode
                      ? router.push({
                          pathname: "/(customer)/booking",
                          params: {
                            offerCode,
                            offerTitle: offer.title,
                          },
                        })
                      : setShowUsageModal(true)
                  }
                >
                  <SurfaceCard style={styles.offerCard}>
                    <View style={styles.offerTopRow}>
                      <View style={styles.perkIcon}>
                        <Feather color={colors.text} name="tag" size={18} />
                      </View>

                      <View style={styles.perkCopy}>
                        <Text style={styles.perkTitle}>{offer.title}</Text>
                        <Text numberOfLines={2} style={styles.perkDetail}>{offer.description}</Text>
                        <View style={styles.offerTierChip}>
                          <Feather color={colors.accentWarm} name="award" size={12} />
                          <Text style={styles.offerTierChipText}>{getOfferPackageLabel(offer)}</Text>
                        </View>
                      </View>

                      <Feather color={colors.textSoft} name="chevron-right" size={18} />
                    </View>

                    <View style={styles.offerBottomRow}>
                      {offerCode ? (
                        <Pressable
                          style={styles.offerCodeBox}
                          onPress={() =>
                            router.push({
                              pathname: "/(customer)/booking",
                              params: {
                                offerCode,
                                offerTitle: offer.title,
                              },
                            })
                          }
                        >
                          <Text style={styles.offerMetaLabel}>Mã ưu đãi</Text>
                          <Text style={styles.offerCodeText}>{offerCode}</Text>
                        </Pressable>
                      ) : null}

                      <View style={styles.offerUsageBox}>
                        <Feather color={colors.text} name="calendar" size={16} />
                        <Text numberOfLines={2} style={styles.offerUsageText}>{offerUsageHint}</Text>
                      </View>
                    </View>
                  </SurfaceCard>
                </Pressable>
              );
            })
          ) : (
            <SurfaceCard style={styles.offerEmptyCard}>
              <View style={styles.offerEmptyBadge}>
                <Feather color={colors.textSoft} name="gift" size={18} />
              </View>
              <View style={styles.perkCopy}>
                <Text style={styles.offerEmptyTitle}>Chưa có ưu đãi đang bật</Text>
                <Text style={styles.offerEmptyText}>Khi admin cập nhật Landing Feed, ưu đãi sẽ tự động hiển thị tại đây.</Text>
              </View>
            </SurfaceCard>
          )}
        </View>
      </View>

      <Modal
        visible={Boolean(selectedTier)}
        transparent
        animationType="fade"
        onShow={() => {
          console.log("[membership] tier modal shown", {
            selectedTierId: selectedTier?.id ?? null,
            selectedTierName: selectedTier?.name ?? null,
          });
        }}
        onRequestClose={() => {
          console.log("[membership] tier modal request close", {
            selectedTierId: selectedTier?.id ?? null,
            selectedTierName: selectedTier?.name ?? null,
          });
          setSelectedTier(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              console.log("[membership] tier modal backdrop pressed", {
                selectedTierId: selectedTier?.id ?? null,
                selectedTierName: selectedTier?.name ?? null,
              });
              setSelectedTier(null);
            }}
          />
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.modalTierHero}>
                <LinearGradient colors={getTierGradient(selectedTier)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modalTierBadge}>
                  <Feather color="#fffaf5" name={getTierIconName(selectedTier)} size={18} />
                </LinearGradient>
                <View style={styles.modalTierHeroCopy}>
                  <Text style={styles.modalTitle}>{selectedTier?.name}</Text>
                  <Text style={styles.modalBody}>{selectedTier?.description?.trim() || "Thông tin hạng thành viên đang được cập nhật."}</Text>
                </View>
              </View>

              <Text style={styles.modalSectionTitle}>{selectedTierBadge}</Text>

              {selectedTierState === "current" ? (
                <>
                  <Text style={styles.modalBody}>• Bạn đang ở hạng này.</Text>
                  <Text style={styles.modalBody}>• Mô tả: {selectedTier ? buildTierMomentLine(selectedTier) : "-"}</Text>
                  <Text style={styles.modalBody}>• Quyền lợi hiện có: {selectedTier ? buildTierPrivilegeLine(selectedTier) : "Đang cập nhật."}</Text>
                  <Text style={styles.modalBody}>
                    • Tiến độ lên hạng tiếp theo: {nextTier ? `còn ${formatNumber(remainingSpentToNext)}đ chi tiêu hoặc ${formatNumber(remainingVisitsToNext)} lượt hẹn chuẩn.` : "bạn đang ở hạng cao nhất."}
                  </Text>
                  <Text style={styles.modalBody}>• Hạng tiếp theo: {nextTier ? nextTier.name : "Chưa có hạng tiếp theo"}</Text>
                </>
              ) : null}

              {selectedTierState === "next" ? (
                <>
                  <Text style={styles.modalBody}>• Mô tả: {selectedTier ? buildTierMomentLine(selectedTier) : "-"}</Text>
                  <Text style={styles.modalBody}>• Điều kiện cần: {selectedTier ? describeTierRequirements(selectedTier) : "-"}</Text>
                  <Text style={styles.modalBody}>• Hiện tại bạn có: {formatNumber(totalSpent)}đ chi tiêu và {formatNumber(selectedTierEligibleVisits)}/{formatNumber(totalVisits)} lượt hẹn chuẩn cho mốc này.</Text>
                  <Text style={styles.modalBody}>• Còn thiếu: {formatNumber(selectedTierRemainingSpend)}đ chi tiêu hoặc {formatNumber(selectedTierRemainingVisits)} lượt hẹn chuẩn.</Text>
                  <Text style={styles.modalBody}>• Quyền lợi khi lên hạng: {selectedTier ? buildTierPrivilegeLine(selectedTier) : "Đang cập nhật."}</Text>
                </>
              ) : null}

              {selectedTierState === "locked" ? (
                <>
                  <Text style={styles.modalBody}>• Mô tả: {selectedTier ? buildTierMomentLine(selectedTier) : "-"}</Text>
                  <Text style={styles.modalBody}>• Điều kiện: {selectedTier ? describeTierRequirements(selectedTier) : "-"}</Text>
                  <Text style={styles.modalBody}>• Còn thiếu: {formatNumber(selectedTierRemainingSpend)}đ chi tiêu hoặc {formatNumber(selectedTierRemainingVisits)} lượt hẹn chuẩn.</Text>
                  <Text style={styles.modalBody}>• Lộ trình: {selectedTierPrevious ? `hãy hoàn thành ${selectedTierPrevious.name} trước.` : `mục tiêu tiếp theo là ${selectedTier?.name}.`}</Text>
                  <Text style={styles.modalBody}>• Quyền lợi của hạng này: {selectedTier ? buildTierPrivilegeLine(selectedTier) : "Đang cập nhật."}</Text>
                </>
              ) : null}

              {selectedTierState === "completed" ? (
                <>
                  <Text style={styles.modalBody}>• Bạn đã vượt qua hạng này.</Text>
                  <Text style={styles.modalBody}>• Mô tả: {selectedTier ? buildTierMomentLine(selectedTier) : "-"}</Text>
                  <Text style={styles.modalBody}>• Điều kiện của hạng: {selectedTier ? describeTierRequirements(selectedTier) : "-"}</Text>
                  <Text style={styles.modalBody}>• Quyền lợi của hạng: {selectedTier ? buildTierPrivilegeLine(selectedTier) : "Đang cập nhật."}</Text>
                </>
              ) : null}

              <Pressable
                style={styles.modalCloseButton}
                onPress={() => {
                  console.log("[membership] tier modal close button pressed", {
                    selectedTierId: selectedTier?.id ?? null,
                    selectedTierName: selectedTier?.name ?? null,
                  });
                  setSelectedTier(null);
                }}
              >
                <Text style={styles.modalCloseText}>Đã hiểu</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showBenefitsModal} transparent animationType="fade" onRequestClose={() => setShowBenefitsModal(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowBenefitsModal(false)} />
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              <Text style={styles.modalTitle}>{strings.membershipBenefitsTitle}</Text>
              <Text style={styles.modalBody}>{currentTier?.description?.trim() || strings.membershipBenefitsBody}</Text>
              <Text style={styles.modalSectionTitle}>Cách nâng hạng</Text>
              <Text style={styles.modalBody}>{nextTierGuidance}</Text>
              <Text style={styles.modalBody}>{strings.membershipHowToUpgrade}</Text>
              <Text style={styles.modalSectionTitle}>Cách tăng ưu đãi</Text>
              <Text style={styles.modalBody}>{strings.membershipHowToBoost}</Text>
              <Text style={styles.modalSectionTitle}>Điểm thưởng có ý nghĩa gì?</Text>
              <Text style={styles.modalBody}>Điểm thưởng là chỉ số tích lũy dành cho thành viên và sẽ là nền cho rule đổi quà / voucher / add-on theo từng mốc.</Text>
              <Text style={styles.modalBody}>Ở giai đoạn hiện tại, điểm đang hiển thị để theo dõi tiến trình thành viên. Khi rule đổi điểm được bật đầy đủ, cửa hàng có thể áp dụng các mốc như đổi add-on, voucher hoặc quà riêng cho từng hạng.</Text>
              <Text style={styles.modalSectionTitle}>Ưu đãi theo từng hạng</Text>
              {tiers.map((tier) => (
                <View key={tier.id} style={styles.modalTierBlock}>
                  <View style={styles.modalTierRow}>
                    <LinearGradient colors={getTierGradient(tier)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modalTierListBadge}>
                      <Feather color="#fffaf5" name={getTierIconName(tier)} size={14} />
                    </LinearGradient>
                    <Text style={styles.modalTierTitle}>{tier.name}</Text>
                  </View>
                  <Text style={styles.modalBody}>Điều kiện: {describeTierRequirements(tier)}</Text>
                  <Text style={styles.modalBody}>
                    Ưu đãi: {tier.perks.length ? tier.perks.join(", ") : "Chưa có mô tả ưu đãi cho hạng này."}
                  </Text>
                </View>
              ))}
              <Pressable style={styles.modalCloseButton} onPress={() => setShowBenefitsModal(false)}>
                <Text style={styles.modalCloseText}>Đã hiểu</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showUsageModal} transparent animationType="fade" onRequestClose={() => setShowUsageModal(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowUsageModal(false)} />
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              <Text style={styles.modalTitle}>Cách dùng ưu đãi</Text>
              <Text style={styles.modalBody}>Ưu đãi trong thẻ thành viên là các quyền lợi bạn có thể dùng khi đặt lịch hoặc sử dụng dịch vụ tại cửa hàng.</Text>
              <Text style={styles.modalSectionTitle}>Cách áp dụng</Text>
              <Text style={styles.modalBody}>• Xem tên ưu đãi trong danh sách ưu đãi đang áp dụng.</Text>
              <Text style={styles.modalBody}>• Khi đặt lịch hoặc đến cửa hàng, bạn chỉ cần báo tên ưu đãi hoặc mã ưu đãi cho nhân viên.</Text>
              <Text style={styles.modalBody}>• Nếu app chưa có nút áp trực tiếp, cửa hàng sẽ hỗ trợ xác nhận và áp dụng ưu đãi trong quá trình đặt lịch hoặc thanh toán.</Text>
              <Text style={styles.modalSectionTitle}>Điểm thưởng dùng để làm gì?</Text>
              <Text style={styles.modalBody}>• Điểm thưởng dùng để theo dõi tích lũy thành viên.</Text>
              <Text style={styles.modalBody}>• Theo hướng rule hiện tại, điểm sẽ phù hợp nhất với các mốc đổi quà, đổi voucher hoặc đổi add-on thay vì quy đổi thẳng ra tiền.</Text>
              <Text style={styles.modalBody}>• Khi cửa hàng bật chính sách đổi điểm cụ thể, bạn sẽ thấy các mốc và phần quà tương ứng rõ hơn trong app.</Text>
              <Pressable style={styles.modalCloseButton} onPress={() => setShowUsageModal(false)}>
                <Text style={styles.modalCloseText}>Đã hiểu</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </CustomerScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
    paddingTop: 4,
    paddingBottom: 144,
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
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  heroCard: {
    backgroundColor: "#34291d",
    borderRadius: 28,
    minHeight: 238,
    overflow: "hidden",
    paddingHorizontal: 20,
    paddingVertical: 18,
    position: "relative",
    shadowColor: "#8A5A16",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
  },
  patternLarge: {
    borderColor: "rgba(255, 235, 210, 0.06)",
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
    borderColor: "rgba(255, 235, 210, 0.06)",
    borderRadius: 42,
    borderWidth: 1,
    height: 160,
    position: "absolute",
    right: -12,
    top: -12,
    transform: [{ rotate: "18deg" }],
    width: 160,
  },
  heroHeadingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 6,
  },
  brand: {
    color: "#E8C28E",
    fontSize: 14,
    fontWeight: "800",
  },
  tierEyebrow: {
    color: "rgba(255,244,229,0.72)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  tier: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 26,
    textAlign: "right",
  },
  tierBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tierBadgeText: {
    fontSize: 14,
    fontWeight: "800",
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
    color: "#FFF8F0",
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
    backgroundColor: "#E3B76F",
    borderRadius: radius.pill,
    height: "100%",
  },
  heroBadge: {
    alignItems: "center",
    backgroundColor: "rgba(91, 63, 35, 0.72)",
    borderColor: "#B88A51",
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 12,
  },
  heroBadgeDisabled: {
    opacity: 0.45,
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
    marginTop: 2,
    maxWidth: "82%",
  },
  milestoneText: {
    color: "rgba(255, 244, 229, 0.82)",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 8,
    maxWidth: "82%",
  },
  benefitButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  benefitButtonText: {
    color: "#fff4e5",
    fontSize: 13,
    fontWeight: "800",
  },
  inlineActionButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineActionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
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
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  progressSummaryWrap: {
    flexDirection: "row",
    gap: 12,
  },
  progressMetricCard: {
    flex: 1,
    gap: 6,
    minHeight: 110,
    padding: 16,
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
  inlineTrack: {
    backgroundColor: colors.borderStrong,
    borderRadius: radius.pill,
    height: 6,
    overflow: "hidden",
  },
  inlineFill: {
    backgroundColor: colors.accentWarm,
    borderRadius: radius.pill,
    height: "100%",
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
  offerCard: {
    gap: 14,
    padding: 16,
  },
  offerTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  offerBottomRow: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: 12,
  },
  tierListCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  tierIconBadge: {
    alignItems: "center",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  tierCardCopy: {
    flex: 1,
    gap: 4,
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
    color: colors.accentWarm,
  },
  tierCardRule: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  tierCardSubtle: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 17,
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
  perkFootnote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  offerTierChip: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#fbf5ee",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  offerTierChipText: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  offerCodeBox: {
    backgroundColor: "#fbf5ee",
    borderRadius: 16,
    flex: 0.95,
    gap: 4,
    justifyContent: "center",
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  offerMetaLabel: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "700",
  },
  offerCodeText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  offerUsageBox: {
    alignItems: "center",
    borderColor: colors.border,
    borderLeftWidth: 1,
    flex: 1.25,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 68,
    paddingLeft: 12,
    paddingRight: 4,
  },
  offerUsageText: {
    color: colors.text,
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
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
  offerEmptyCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  emptyStateCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  emptyStateIcon: {
    alignItems: "center",
    backgroundColor: "#f6efe7",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  emptyStateTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  emptyStateText: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  offerEmptyBadge: {
    alignItems: "center",
    backgroundColor: "#f6efe7",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  offerEmptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  offerEmptyText: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 18,
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
    maxHeight: "84%",
    padding: 20,
    width: "100%",
  },
  modalScrollContent: {
    paddingBottom: 4,
  },
  modalTierHero: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  modalTierBadge: {
    alignItems: "center",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  modalTierHeroCopy: {
    flex: 1,
    gap: 2,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
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
  modalTierRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  modalTierListBadge: {
    alignItems: "center",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28,
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
