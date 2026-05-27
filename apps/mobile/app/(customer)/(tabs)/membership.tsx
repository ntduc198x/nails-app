import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { CustomerScreen, CustomerTopActions, SurfaceCard } from "@/src/features/customer/ui";
import { premiumTheme } from "@/src/design/premium-theme";
import { useCustomerMembership } from "@/src/hooks/use-customer-membership";
import {
  localizeMembershipTier,
  localizeOfferCard,
  localizeUsageHint,
} from "@/src/features/customer/localize";
import { type CustomerStringKey, useCustomerStrings } from "@/src/features/customer/strings";
import { formatDateLabel, formatMoneyVnd, translate, type CustomerMembershipTier, type Locale } from "@nails/shared";
import { useCustomerPreferences } from "@/src/providers/customer-preferences-provider";

const { colors, radius } = premiumTheme;

function formatNumber(value: number, locale: Locale) {
  return value.toLocaleString(locale === "en" ? "en-US" : "vi-VN");
}

function formatDate(value: string | null, locale: Locale) {
  return formatDateLabel(value, locale) || null;
}

function t(locale: Locale, key: CustomerStringKey, params?: Record<string, string | number | null | undefined>) {
  return translate(locale, "customer", key, params);
}

function buildHelperText(input: {
  locale: Locale;
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
  const orWord = t(input.locale, "conjunctionOr");
  const spendLabel = (value: number) =>
    t(input.locale, "membershipRequirementSpending", { amount: formatMoneyVnd(value, input.locale) });
  const visitLabel = (value: number) =>
    t(input.locale, "membershipRequirementQualifiedVisits", { count: formatNumber(value, input.locale) });

  if (!input.hasTierData) {
    return t(input.locale, "membershipHelperNoTierData");
  }

  if (!input.hasMembership && input.nextTierName) {
    const parts: string[] = [];
    if (input.remainingSpentToNext > 0) {
      parts.push(spendLabel(input.remainingSpentToNext));
    }
    if (input.remainingVisitsToNext > 0) {
      parts.push(visitLabel(input.remainingVisitsToNext));
    }

    const guidance = parts.length
      ? t(input.locale, "membershipGuidanceRemainingToTier", {
          requirements: parts.join(` ${orWord} `),
          tierName: input.nextTierName,
        })
      : t(input.locale, "membershipGuidanceNextTarget", { tierName: input.nextTierName });
    return t(input.locale, "membershipHelperStandardTarget", {
      tierName: input.nextTierName,
      guidance,
    });
  }

  if (input.nextTierName) {
    const parts: string[] = [];
    if (input.remainingSpentToNext > 0) {
      parts.push(spendLabel(input.remainingSpentToNext));
    }
    if (input.remainingVisitsToNext > 0) {
      parts.push(visitLabel(input.remainingVisitsToNext));
    }

    const guidance = parts.length
      ? t(input.locale, "membershipGuidanceRemainingToTier", {
          requirements: parts.join(` ${orWord} `),
          tierName: input.nextTierName,
        })
      : t(input.locale, "membershipGuidanceNextTarget", { tierName: input.nextTierName });
    return t(input.locale, "membershipHelperCurrentProgress", {
      tierName: input.currentTierName ?? t(input.locale, "membershipBadgeCurrent").toLowerCase(),
      points: formatNumber(input.pointsBalance, input.locale),
      eligibleVisits: formatNumber(input.eligibleVisitsMinSpend, input.locale),
      totalVisits: formatNumber(input.totalVisits, input.locale),
      totalSpent: formatMoneyVnd(input.totalSpent, input.locale),
      guidance,
    });
  }

  const expiresText = formatDate(input.expiresAt, input.locale);
  if (expiresText) {
    return t(input.locale, "membershipHelperHighestUntil", { expiresAt: expiresText });
  }

  return t(input.locale, "membershipHelperKeepAccumulating");
}

function describeTierRequirements(tier: {
  locale: Locale;
  spendingThreshold: number;
  visitThreshold: number;
  visitMinSpend?: number;
}) {
  const parts: string[] = [];

  if (tier.spendingThreshold > 0) {
    parts.push(t(tier.locale, "membershipRequirementThresholdSpending", { amount: formatMoneyVnd(tier.spendingThreshold, tier.locale) }));
  }

  if (tier.visitThreshold > 0) {
    const visitMinSpend = Math.max(0, tier.visitMinSpend ?? 300000);
    parts.push(
      t(tier.locale, "membershipRequirementThresholdVisits", {
        count: formatNumber(tier.visitThreshold, tier.locale),
        amount: formatMoneyVnd(visitMinSpend, tier.locale),
      }),
    );
  }

  return parts.length
    ? parts.join(` ${t(tier.locale, "conjunctionOr")} `)
    : t(tier.locale, "membershipFlexibleRequirements");
}

function getTierGradient(tier: CustomerMembershipTier | null) {
  switch ((tier?.themeKey || tier?.code || "bronze").toLowerCase()) {
    case "silver":
      return ["#F3F5F7", "#C9D1DA", "#8A97A6"] as const;
    case "gold":
      return ["#FFF3C9", "#E7C86D", "#B8862F"] as const;
    case "platinum":
      return ["#FEFEFF", "#DDE3EA", "#AEB8C4"] as const;
    case "diamond":
      return ["#E8F7FF", "#86D7F7", "#2E7FBF"] as const;
    case "bronze":
    default:
      return ["#E6B17E", "#C98652", "#8A532C"] as const;
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
  locale: Locale;
  tier: CustomerMembershipTier;
  currentTier: CustomerMembershipTier | null;
  nextTier: CustomerMembershipTier | null;
}) {
  if (input.currentTier?.id === input.tier.id) return t(input.locale, "membershipBadgeCurrent");
  if (input.nextTier?.id === input.tier.id) return t(input.locale, "membershipBadgeNext");
  if (input.currentTier && input.tier.sortOrder < input.currentTier.sortOrder) return t(input.locale, "membershipBadgeCompleted");
  return t(input.locale, "membershipBadgeLocked");
}

function buildNextTierGuidance(input: {
  locale: Locale;
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
    return t(input.locale, "membershipNextGuidanceNoTierData");
  }

  if (!input.nextTier) {
    return t(input.locale, "membershipNextGuidanceHighest", {
      points: formatNumber(input.pointsBalance, input.locale),
    });
  }

  const remainingSpend = Math.max(0, input.nextTier.spendingThreshold - input.totalSpent);
  const remainingVisits = Math.max(0, input.nextTier.visitThreshold - input.eligibleVisitsMinSpend);
  const milestones: string[] = [];

  if (input.nextTier.spendingThreshold > 0) {
    milestones.push(
      t(input.locale, "membershipRequirementThresholdSpending", {
        amount: formatMoneyVnd(input.nextTier.spendingThreshold, input.locale),
      }),
    );
  }

  if (input.nextTier.visitThreshold > 0) {
    milestones.push(
      t(input.locale, "membershipRequirementThresholdVisits", {
        count: formatNumber(input.nextTier.visitThreshold, input.locale),
        amount: formatMoneyVnd(input.nextTier.visitMinSpend ?? 300000, input.locale),
      }),
    );
  }

  const remainingParts: string[] = [];
  if (remainingSpend > 0) {
    remainingParts.push(t(input.locale, "membershipRequirementSpending", { amount: formatMoneyVnd(remainingSpend, input.locale) }));
  }
  if (remainingVisits > 0) {
    remainingParts.push(t(input.locale, "membershipRequirementQualifiedVisits", { count: formatNumber(remainingVisits, input.locale) }));
  }

  return t(input.locale, "membershipNextGuidanceWithTarget", {
    tierName: input.nextTier.name,
    milestones: milestones.join(` ${t(input.locale, "conjunctionOr")} `),
    points: formatNumber(input.pointsBalance, input.locale),
    requirements: remainingParts.join(` ${t(input.locale, "conjunctionOr")} `),
  });
}

function buildTierMomentLine(tier: {
  locale: Locale;
  name: string;
  code?: string;
}) {
  switch ((tier.code || tier.name).toLowerCase()) {
    case "bronze":
      return t(tier.locale, "membershipTierMomentBronze");
    case "silver":
      return t(tier.locale, "membershipTierMomentSilver");
    case "gold":
      return t(tier.locale, "membershipTierMomentGold");
    case "platinum":
      return t(tier.locale, "membershipTierMomentPlatinum");
    case "diamond":
      return t(tier.locale, "membershipTierMomentDiamond");
    default:
      return t(tier.locale, "membershipTierMomentDefault");
  }
}

function buildTierPrivilegeLine(tier: {
  locale: Locale;
  name: string;
  code?: string;
  perks: string[];
}) {
  if (tier.perks.length) {
    return tier.perks.join(", ");
  }

  return t(tier.locale, "membershipTierPerksUpdating");
}

function getOfferCode(offer: { metadata?: Record<string, unknown> }) {
  const value = offer.metadata?.code;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getOfferUsageHint(offer: { metadata?: Record<string, unknown> }, locale: Locale) {
  const value = offer.metadata?.usageHint;
  return typeof value === "string" && value.trim()
    ? localizeUsageHint(locale, value.trim()) ?? value.trim()
    : t(locale, "membershipOfferUsageHintDefault");
}

function getOfferRedeemLabel(offer: { metadata?: Record<string, unknown> }) {
  const value = offer.metadata?.redeemLabel;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isOfferDisabled(offer: { claimStatus?: string | null }) {
  return offer.claimStatus === "RESERVED" || offer.claimStatus === "REDEEMED" || offer.claimStatus === "EXPIRED";
}

function getOfferStatusLabel(offer: { claimStatus?: string | null }, locale: Locale) {
  switch (offer.claimStatus) {
    case "RESERVED":
      return t(locale, "statusReserved");
    case "REDEEMED":
      return t(locale, "statusUsed");
    case "EXPIRED":
      return t(locale, "statusExpired");
    case "CANCELLED":
      return t(locale, "statusCancelled");
    default:
      return t(locale, "statusReadyToUse");
  }
}

function getOfferBookingCtaLabel(offer: { metadata?: Record<string, unknown> }, locale: Locale) {
  const value = offer.metadata?.bookingCtaLabel;
  return typeof value === "string" && value.trim()
    ? localizeUsageHint(locale, value.trim()) ?? value.trim()
    : t(locale, "membershipOfferBookingCtaDefault");
}

function getOfferPackageLabel(offer: { metadata?: Record<string, unknown> }, locale: Locale) {
  const packageTier = typeof offer.metadata?.packageTier === "string" ? offer.metadata.packageTier.trim().toUpperCase() : "REGULAR";
  switch (packageTier) {
    case "BRONZE":
      return t(locale, "membershipOfferPackageBronze");
    case "SILVER":
      return t(locale, "membershipOfferPackageSilver");
    case "GOLD":
      return t(locale, "membershipOfferPackageGold");
    case "PLATINUM":
      return t(locale, "membershipOfferPackagePlatinum");
    case "DIAMOND":
      return t(locale, "membershipOfferPackageDiamond");
    case "REGULAR":
    default:
      return t(locale, "membershipOfferPackageRegular");
  }
}

export default function MembershipScreen() {
  const strings = useCustomerStrings();
  const { locale } = useCustomerPreferences();
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
  const currentTierLocalized = localizeMembershipTier(locale, currentTier);
  const nextTierLocalized = localizeMembershipTier(locale, nextTier);
  const tiersLocalized = tiers
    .map((tier) => localizeMembershipTier(locale, tier))
    .filter((tier): tier is CustomerMembershipTier => Boolean(tier));
  const offersLocalized = offers.map((offer) => localizeOfferCard(locale, offer));

  const hasTierData = tiersLocalized.length > 0;
  const hasCurrentTierBadge = Boolean(currentTierLocalized);
  const tierAccent = currentTierLocalized?.accentColor || "#efc26d";
  const helperText = buildHelperText({
    locale,
    hasMembership,
    hasTierData,
    currentTierName: currentTierLocalized?.name ?? null,
    nextTierName: nextTierLocalized?.name ?? null,
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
    locale,
    hasTierData,
    nextTier: nextTierLocalized,
    totalSpent,
    eligibleVisitsMinSpend,
    pointsBalance,
  });
  const milestoneSummary = !hasTierData
    ? t(locale, "membershipMilestoneNoTierData")
    : nextTierLocalized
      ? t(locale, "membershipMilestoneNext", {
          tierName: nextTierLocalized.name,
          requirements: describeTierRequirements({ ...nextTierLocalized, locale }),
        })
      : t(locale, "membershipMilestoneHighest");
  const heroGradient = getTierGradient(currentTierLocalized);
  const selectedTierLocalized = selectedTier ? localizeMembershipTier(locale, selectedTier) : null;
  const selectedTierBadge = selectedTierLocalized ? getTierBadgeLabel({ locale, tier: selectedTierLocalized, currentTier: currentTierLocalized, nextTier: nextTierLocalized }) : null;
  const selectedTierRemainingSpend = selectedTier ? Math.max(0, selectedTier.spendingThreshold - totalSpent) : 0;
  const selectedTierEligibleVisits = selectedTierLocalized ? (eligibleVisitsByTierCode[selectedTierLocalized.code] ?? eligibleVisitsMinSpend) : 0;
  const selectedTierRemainingVisits = selectedTier ? Math.max(0, selectedTier.visitThreshold - selectedTierEligibleVisits) : 0;
  const selectedTierState = selectedTierLocalized
    ? currentTierLocalized?.id === selectedTierLocalized.id
      ? "current"
      : nextTierLocalized?.id === selectedTierLocalized.id
        ? "next"
        : currentTierLocalized && selectedTierLocalized.sortOrder < currentTierLocalized.sortOrder
          ? "completed"
          : "locked"
    : null;
  const selectedTierIndex = selectedTierLocalized ? tiersLocalized.findIndex((tier) => tier.id === selectedTierLocalized.id) : -1;
  const selectedTierPrevious = selectedTierIndex > 0 ? tiersLocalized[selectedTierIndex - 1] ?? null : null;

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
          <Text style={styles.brand}>{strings.membershipBrandName}</Text>
          {hasCurrentTierBadge ? (
            <View style={[styles.tierBadge, { borderColor: tierAccent }]}>
              <Feather color={tierAccent} name={getTierIconName(currentTierLocalized)} size={14} />
              <Text style={[styles.tierBadgeText, { color: tierAccent }]}>{currentTierLocalized?.name}</Text>
            </View>
          ) : (
            <Text style={styles.tier}>{strings.profileMemberLabel}</Text>
          )}
        </View>
        <Text style={styles.tierEyebrow}>{strings.membershipTitle.toUpperCase()}</Text>

        <Text style={styles.pointsLabel}>{strings.membershipCurrentPointsLabel}</Text>
        <Text style={styles.points}>
          {formatNumber(pointsBalance, locale)} {strings.membershipPointsUnit}
        </Text>

        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressWidth }]} />
          </View>

          <Pressable
            style={[styles.heroBadge, !hasTierData ? styles.heroBadgeDisabled : null]}
            disabled={!hasTierData}
            onPress={() => setSelectedTier(currentTier ?? nextTier ?? tiers[0] ?? null)}
          >
            <Feather color="#f1c56d" name={getTierIconName(nextTierLocalized ?? currentTierLocalized)} size={14} />
            <Text style={styles.heroBadgeText}>
              {nextTierLocalized?.name
                ? t(locale, "membershipMoveToTier", { tierName: nextTierLocalized.name })
                : strings.membershipBenefitsTitle}
            </Text>
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
                <Feather color="#bb7723" name={getTierIconName(currentTierLocalized)} size={26} />
              </View>
            </View>
          </View>
        ) : null}
      </LinearGradient>

      <View style={styles.progressSummaryWrap}>
        <SurfaceCard style={styles.progressMetricCard}>
          <Text style={styles.progressMetricLabel}>{strings.profileTotalSpent}</Text>
          <Text style={styles.progressMetricValue}>{formatMoneyVnd(totalSpent, locale)}</Text>
          <View style={styles.inlineTrack}>
            <View style={[styles.inlineFill, { width: `${Math.max(0, Math.min(progressSpent, 1)) * 100}%` }]} />
          </View>
          <Text style={styles.progressMetricHint}>
            {nextTierLocalized
              ? t(locale, "membershipSpentHintNext", {
                  tierName: nextTierLocalized.name,
                  amount: formatMoneyVnd(remainingSpentToNext, locale),
                })
              : currentTierLocalized
                ? t(locale, "membershipSpentHintCurrent", { tierName: currentTierLocalized.name })
                : t(locale, "membershipSpentHintSyncing")}
          </Text>
        </SurfaceCard>
        <SurfaceCard style={styles.progressMetricCard}>
          <Text style={styles.progressMetricLabel}>{strings.membershipQualifiedVisitsLabel}</Text>
          <Text style={styles.progressMetricValue}>
            {formatNumber(eligibleVisitsMinSpend, locale)}/{formatNumber(totalVisits, locale)}
          </Text>
          <View style={styles.inlineTrack}>
            <View style={[styles.inlineFill, { width: `${Math.max(0, Math.min(progressVisits, 1)) * 100}%` }]} />
          </View>
          <Text style={styles.progressMetricHint}>
            {nextTierLocalized
              ? t(locale, "membershipVisitsHintNext", {
                  tierName: nextTierLocalized.name,
                  count: formatNumber(remainingVisitsToNext, locale),
                  amount: formatMoneyVnd(nextTierLocalized.visitMinSpend ?? 300000, locale),
                })
              : t(locale, "membershipVisitsHintCurrent", {
                  amount: formatMoneyVnd(currentTierLocalized?.visitMinSpend ?? 300000, locale),
                })}
          </Text>
        </SurfaceCard>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>{strings.membershipBenefitsTitle}</Text>

        <View style={styles.perkList}>
          {((currentTierLocalized?.perks ?? perks).length
            ? (currentTierLocalized?.perks ?? perks)
            : [strings.membershipNoCurrentTierPerks]).map((perk) => (
            <SurfaceCard key={perk} style={styles.perkCard}>
              <View style={styles.perkIcon}>
                <Feather color={colors.text} name="star" size={18} />
              </View>

              <View style={styles.perkCopy}>
                <Text style={styles.perkTitle}>{perk}</Text>
                <Text style={styles.perkDetail}>{strings.membershipCurrentTierPerksSource}</Text>
              </View>
            </SurfaceCard>
          ))}
        </View>
      </View>


      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{strings.membershipActiveOffersTitle}</Text>
          <Pressable style={styles.inlineActionButton} onPress={() => setShowUsageModal(true)}>
            <Feather color={colors.text} name="help-circle" size={14} />
            <Text style={styles.inlineActionText}>{strings.membershipHowToUseOffers}</Text>
          </Pressable>
        </View>

        <View style={styles.perkList}>
          {offersLocalized.length ? (
            offersLocalized.map((offer) => {
              const offerCode = getOfferCode(offer);
              const offerUsageHint = getOfferUsageHint(offer, locale);
              const redeemLabel = getOfferRedeemLabel(offer);
              const offerBookingCtaLabel = getOfferBookingCtaLabel(offer, locale);
              const disabled = isOfferDisabled(offer);
              const offerStatusLabel = getOfferStatusLabel(offer, locale);
              void redeemLabel;
              void offerBookingCtaLabel;

              return (
                <Pressable
                  key={offer.id}
                  onPress={() =>
                    disabled
                      ? undefined
                      : offerCode
                        ? router.push({
                            pathname: "/(customer)/(tabs)/booking",
                            params: {
                              offerId: offer.id,
                              offerClaimId: offer.claimId ?? undefined,
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
                          <Text style={styles.offerTierChipText}>{getOfferPackageLabel(offer, locale)}</Text>
                        </View>
                        <View style={styles.offerTierChip}>
                          <Feather color={disabled ? colors.textSoft : colors.text} name={disabled ? "lock" : "check-circle"} size={12} />
                          <Text style={styles.offerTierChipText}>{offerStatusLabel}</Text>
                        </View>
                      </View>

                      <Feather color={colors.textSoft} name="chevron-right" size={18} />
                    </View>

                    <View style={styles.offerBottomRow}>
                      {offerCode ? (
                        <Pressable
                          style={styles.offerCodeBox}
                          disabled={disabled}
                          onPress={() =>
                            disabled
                              ? undefined
                              : router.push({
                                  pathname: "/(customer)/(tabs)/booking",
                                  params: {
                                    offerId: offer.id,
                                    offerClaimId: offer.claimId ?? undefined,
                                    offerCode,
                                    offerTitle: offer.title,
                                  },
                                })
                          }
                        >
                          <Text style={styles.offerMetaLabel}>{strings.membershipOfferCodeLabel}</Text>
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
                <Text style={styles.offerEmptyTitle}>
                  {strings.membershipNoActiveOffersTitle}
                </Text>
                <Text style={styles.offerEmptyText}>{strings.membershipNoActiveOffersBody}</Text>
              </View>
            </SurfaceCard>
          )}
        </View>
      </View>

      <Modal
        visible={Boolean(selectedTier)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTier(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSelectedTier(null)}
          />
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.modalTierHero}>
                <LinearGradient colors={getTierGradient(selectedTier)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modalTierBadge}>
                  <Feather color="#fffaf5" name={getTierIconName(selectedTierLocalized)} size={18} />
                </LinearGradient>
                <View style={styles.modalTierHeroCopy}>
                  <Text style={styles.modalTitle}>{selectedTierLocalized?.name}</Text>
                  <Text style={styles.modalBody}>
                    {selectedTierLocalized?.description?.trim() ||
                      strings.membershipTierDetailsUpdating}
                  </Text>
                </View>
              </View>

              <Text style={styles.modalSectionTitle}>{selectedTierBadge}</Text>

              {selectedTierState === "current" ? (
                <>
                  <Text style={styles.modalBody}>• {strings.membershipModalCurrentTierIntro}</Text>
                  <Text style={styles.modalBody}>• {strings.membershipModalSummary}: {selectedTierLocalized ? buildTierMomentLine({ ...selectedTierLocalized, locale }) : "-"}</Text>
                  <Text style={styles.modalBody}>• {strings.membershipModalCurrentPerks}: {selectedTierLocalized ? buildTierPrivilegeLine({ ...selectedTierLocalized, locale }) : strings.membershipModalUpdatingShort}</Text>
                  <Text style={styles.modalBody}>
                    • {strings.membershipModalNextTierProgress}: {nextTierLocalized
                      ? t(locale, "membershipGuidanceRemainingToTier", {
                          requirements: [
                            t(locale, "membershipRequirementSpending", { amount: formatMoneyVnd(remainingSpentToNext, locale) }),
                            t(locale, "membershipRequirementQualifiedVisits", { count: formatNumber(remainingVisitsToNext, locale) }),
                          ].join(` ${strings.conjunctionOr} `),
                          tierName: nextTierLocalized.name,
                        })
                      : strings.membershipModalHighestTierShort}
                  </Text>
                  <Text style={styles.modalBody}>• {strings.membershipModalNextTier}: {nextTierLocalized ? nextTierLocalized.name : strings.membershipModalNoNextTier}</Text>
                </>
              ) : null}

              {selectedTierState === "next" ? (
                <>
                  <Text style={styles.modalBody}>• {strings.membershipModalSummary}: {selectedTierLocalized ? buildTierMomentLine({ ...selectedTierLocalized, locale }) : "-"}</Text>
                  <Text style={styles.modalBody}>• {strings.membershipModalRequirementsNeeded}: {selectedTierLocalized ? describeTierRequirements({ ...selectedTierLocalized, locale }) : "-"}</Text>
                  <Text style={styles.modalBody}>• {strings.membershipModalCurrentProgress}: {formatMoneyVnd(totalSpent, locale)}, {formatNumber(selectedTierEligibleVisits, locale)}/{formatNumber(totalVisits, locale)}.</Text>
                  <Text style={styles.modalBody}>• {strings.membershipModalStillNeeded}: {[
                    t(locale, "membershipRequirementSpending", { amount: formatMoneyVnd(selectedTierRemainingSpend, locale) }),
                    t(locale, "membershipRequirementQualifiedVisits", { count: formatNumber(selectedTierRemainingVisits, locale) }),
                  ].join(` ${strings.conjunctionOr} `)}</Text>
                  <Text style={styles.modalBody}>• {strings.membershipModalPerksAfterUpgrade}: {selectedTierLocalized ? buildTierPrivilegeLine({ ...selectedTierLocalized, locale }) : strings.membershipModalUpdatingShort}</Text>
                </>
              ) : null}

              {selectedTierState === "locked" ? (
                <>
                  <Text style={styles.modalBody}>• {strings.membershipModalSummary}: {selectedTierLocalized ? buildTierMomentLine({ ...selectedTierLocalized, locale }) : "-"}</Text>
                  <Text style={styles.modalBody}>• {strings.membershipModalRequirements}: {selectedTierLocalized ? describeTierRequirements({ ...selectedTierLocalized, locale }) : "-"}</Text>
                  <Text style={styles.modalBody}>• {strings.membershipModalStillNeeded}: {[
                    t(locale, "membershipRequirementSpending", { amount: formatMoneyVnd(selectedTierRemainingSpend, locale) }),
                    t(locale, "membershipRequirementQualifiedVisits", { count: formatNumber(selectedTierRemainingVisits, locale) }),
                  ].join(` ${strings.conjunctionOr} `)}</Text>
                  <Text style={styles.modalBody}>• {strings.membershipModalPath}: {selectedTierPrevious ? t(locale, "membershipModalPathFinishFirst", { tierName: selectedTierPrevious.name }) : t(locale, "membershipModalPathNextTarget", { tierName: selectedTierLocalized?.name ?? "" })}</Text>
                  <Text style={styles.modalBody}>• {strings.membershipModalTierPerks}: {selectedTierLocalized ? buildTierPrivilegeLine({ ...selectedTierLocalized, locale }) : strings.membershipModalUpdatingShort}</Text>
                </>
              ) : null}

              {selectedTierState === "completed" ? (
                <>
                  <Text style={styles.modalBody}>• {strings.membershipModalCompletedIntro}</Text>
                  <Text style={styles.modalBody}>• {strings.membershipModalSummary}: {selectedTierLocalized ? buildTierMomentLine({ ...selectedTierLocalized, locale }) : "-"}</Text>
                  <Text style={styles.modalBody}>• {strings.membershipModalTierRequirements}: {selectedTierLocalized ? describeTierRequirements({ ...selectedTierLocalized, locale }) : "-"}</Text>
                  <Text style={styles.modalBody}>• {strings.membershipModalTierPerks}: {selectedTierLocalized ? buildTierPrivilegeLine({ ...selectedTierLocalized, locale }) : strings.membershipModalUpdatingShort}</Text>
                </>
              ) : null}

              <Pressable style={styles.modalCloseButton} onPress={() => setSelectedTier(null)}>
                <Text style={styles.modalCloseText}>{strings.membershipModalGotIt}</Text>
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
              <Text style={styles.modalBody}>{currentTierLocalized?.description?.trim() || strings.membershipBenefitsBody}</Text>
              <Text style={styles.modalSectionTitle}>{strings.membershipModalHowToLevelUp}</Text>
              <Text style={styles.modalBody}>{nextTierGuidance}</Text>
              <Text style={styles.modalBody}>{strings.membershipHowToUpgrade}</Text>
              <Text style={styles.modalSectionTitle}>{strings.membershipModalHowToUnlockPerks}</Text>
              <Text style={styles.modalBody}>{strings.membershipHowToBoost}</Text>
              <Text style={styles.modalSectionTitle}>{strings.membershipModalRewardPointsPurposeTitle}</Text>
              <Text style={styles.modalBody}>{strings.membershipModalRewardPointsPurposeBody1}</Text>
              <Text style={styles.modalBody}>{strings.membershipModalRewardPointsPurposeBody2}</Text>
              <Text style={styles.modalSectionTitle}>{strings.membershipModalPerksByTier}</Text>
              {tiersLocalized.map((tier) => (
                <View key={tier.id} style={styles.modalTierBlock}>
                  <View style={styles.modalTierRow}>
                    <LinearGradient colors={getTierGradient(tier)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modalTierListBadge}>
                      <Feather color="#fffaf5" name={getTierIconName(tier)} size={14} />
                    </LinearGradient>
                    <Text style={styles.modalTierTitle}>{tier.name}</Text>
                  </View>
                  <Text style={styles.modalBody}>{strings.membershipModalRequirements}: {describeTierRequirements({ ...tier, locale })}</Text>
                  <Text style={styles.modalBody}>
                    {strings.membershipModalPerksLabel}: {tier.perks.length ? tier.perks.join(", ") : strings.membershipModalNoPerkDescription}
                  </Text>
                </View>
              ))}
              <Pressable style={styles.modalCloseButton} onPress={() => setShowBenefitsModal(false)}>
                <Text style={styles.modalCloseText}>{strings.membershipModalGotIt}</Text>
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
              <Text style={styles.modalTitle}>{strings.membershipHowToUseOffers}</Text>
              <Text style={styles.modalBody}>{strings.membershipModalHowToUseOffersIntro}</Text>
              <Text style={styles.modalSectionTitle}>{strings.membershipModalHowToApply}</Text>
              <Text style={styles.modalBody}>• {strings.membershipModalApplyStep1}</Text>
              <Text style={styles.modalBody}>• {strings.membershipModalApplyStep2}</Text>
              <Text style={styles.modalBody}>• {strings.membershipModalApplyStep3}</Text>
              <Text style={styles.modalSectionTitle}>{strings.membershipModalPointsUsedForTitle}</Text>
              <Text style={styles.modalBody}>• {strings.membershipModalPointsStep1}</Text>
              <Text style={styles.modalBody}>• {strings.membershipModalPointsStep2}</Text>
              <Text style={styles.modalBody}>• {strings.membershipModalPointsStep3}</Text>
              <Pressable style={styles.modalCloseButton} onPress={() => setShowUsageModal(false)}>
                <Text style={styles.modalCloseText}>{strings.membershipModalGotIt}</Text>
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
