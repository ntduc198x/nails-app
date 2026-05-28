import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CustomerContentPost, LookbookItem, MarketingOfferCard } from "@nails/shared";
import { CustomerCachedImage } from "@/src/features/customer/cached-image";
import {
  collectHomeFeedLocalizationWarnings,
  localizeContentPost,
  localizeLookbookItem,
  localizeOfferCard,
} from "@/src/features/customer/localize";
import { CustomerServiceDetailModal } from "@/src/features/customer/service-detail-modal";
import { splitCustomerPriceLabel } from "@/src/features/customer/price-label";
import { useCustomerStrings } from "@/src/features/customer/strings";
import { CustomerBrandTopBar, CustomerScreen, PrimaryButton, SectionTitle, SurfaceCard } from "@/src/features/customer/ui";
import { useCustomerHomeFeed } from "@/src/hooks/use-customer-home-feed";
import { useCustomerFavorites } from "@/src/hooks/use-customer-favorites";
import { prefetchCustomerImagesForIntent } from "@/src/lib/customer-image-cache";
import { getCustomerImageUri } from "@/src/lib/customer-image-url";
import { premiumTheme } from "@/src/design/premium-theme";
import { useCustomerPreferences } from "@/src/providers/customer-preferences-provider";

const { colors, radius, shadow } = premiumTheme;
type HomeFilterKey = "all" | "hot" | "trend" | "offers";

function getLookbookTags(item: LookbookItem): HomeFilterKey[] {
  const tags: HomeFilterKey[] = ["hot"];
  const badge = item.badge.toLowerCase();
  const category = item.category?.toLowerCase() ?? "";

  if (badge.includes("trend") || badge.includes("hot") || category === "sang-trong" || category === "noi-bat") {
    tags.push("trend");
  }

  return tags;
}

function getPostTags(post: CustomerContentPost): HomeFilterKey[] {
  if (post.contentType === "offer_hint") return ["offers"];
  return ["trend"];
}

export default function CustomerHomeScreen() {
  const strings = useCustomerStrings();
  const { locale } = useCustomerPreferences();
  const homeFilters = useMemo(
    () => [
      { key: "all" as const, label: strings.all, icon: "clock" as const },
      { key: "hot" as const, label: strings.homeHotLooks, icon: "star" as const },
      { key: "trend" as const, label: strings.homeTrends, icon: "trending-up" as const },
      { key: "offers" as const, label: strings.profileOffers, icon: "tag" as const },
    ],
    [strings.all, strings.homeHotLooks, strings.homeTrends, strings.profileOffers],
  );
  const [activeFilter, setActiveFilter] = useState<HomeFilterKey>("all");
  const [selectedService, setSelectedService] = useState<LookbookItem | null>(null);
  const { contentPosts, isLoading, isRefreshing, lastError, lookbook, offers, refresh } = useCustomerHomeFeed();
  const { isFavorite, lastError: favoriteError, toggleFavorite } = useCustomerFavorites();

  const heroImage = lookbook[1]?.image ?? lookbook[0]?.image ?? null;
  const localizedLookbook = useMemo(() => lookbook.map((item) => localizeLookbookItem(locale, item)), [locale, lookbook]);
  const localizedContentPosts = useMemo(() => contentPosts.map((post) => localizeContentPost(locale, post)), [contentPosts, locale]);

  const visibleLookbook = useMemo(() => {
    if (activeFilter === "all") return localizedLookbook.slice(0, 6);
    return localizedLookbook.filter((item) => getLookbookTags(item).includes(activeFilter)).slice(0, 6);
  }, [activeFilter, localizedLookbook]);

  const visiblePosts = useMemo(() => {
    if (activeFilter === "all") return localizedContentPosts.slice(0, 4);
    return localizedContentPosts.filter((post) => getPostTags(post).includes(activeFilter)).slice(0, 4);
  }, [activeFilter, localizedContentPosts]);

  const visibleOffers = useMemo(() => {
    if (activeFilter === "all" || activeFilter === "offers") return offers.slice(0, 2);
    return [];
  }, [activeFilter, offers]);
  const localizedVisibleOffers = useMemo(
    () => visibleOffers.map((offer) => localizeOfferCard(locale, offer)),
    [locale, visibleOffers],
  );

  useEffect(() => {
    if (!__DEV__) return;
    const warnings = collectHomeFeedLocalizationWarnings(locale, { lookbook, contentPosts, offers });
    if (!warnings.length) return;
    console.warn("[customer-i18n][home]", warnings);
  }, [contentPosts, locale, lookbook, offers]);

  const hasAnyHomeContent = visibleLookbook.length > 0 || visiblePosts.length > 0 || localizedVisibleOffers.length > 0;

  useEffect(() => {
    if (!favoriteError) return;

    if (favoriteError.includes("CUSTOMER_ACCOUNT_NOT_LINKED")) {
      Alert.alert(strings.favoriteSaveBlockedTitle, strings.favoriteSaveBlockedBody);
      return;
    }

    Alert.alert(strings.favoriteSaveFailedTitle, favoriteError);
  }, [favoriteError, strings.favoriteSaveBlockedBody, strings.favoriteSaveBlockedTitle, strings.favoriteSaveFailedTitle]);

  return (
    <CustomerScreen
      hideHeader
      title={strings.homeTitle}
      contentContainerStyle={styles.content}
      onRefresh={() => void refresh()}
      refreshing={isRefreshing}
    >
      <CustomerBrandTopBar />

      <SurfaceCard style={styles.heroCard}>
        <View style={styles.heroTextColumn}>
          <View style={styles.heroMiniBadge}>
            <Feather color="#b98258" name="briefcase" size={12} />
          </View>
          <Text style={styles.heroTitle}>{strings.homeHeroTitle}</Text>
          <Text style={styles.heroSubtitle}>
            {isLoading ? strings.homeHeroLoading : strings.homeHeroBody}
          </Text>

          <View style={styles.heroActions}>
            <PrimaryButton label={strings.homeBookNow} onPress={() => router.push("/(customer)/(tabs)/booking")} />
            <PrimaryButton label={strings.homeExploreNow} subtle onPress={() => router.push("/(customer)/(tabs)/explore")} />
          </View>
        </View>

        {heroImage ? (
          <CustomerCachedImage alt={locale === "en" ? "Hero nail design" : "Mau nail noi bat"} source={{ uri: heroImage }} intent="hero" style={styles.heroImage} />
        ) : null}
      </SurfaceCard>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
        {homeFilters.map((item) => {
          const active = item.key === activeFilter;
          return (
            <Pressable
              key={item.key}
              style={[styles.filterChip, active ? styles.filterChipActive : null]}
              onPress={() => setActiveFilter(item.key)}
            >
              <Feather color={active ? colors.surface : "#9f8d7c"} name={item.icon} size={14} />
              <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading && !hasAnyHomeContent ? (
        <SurfaceCard style={styles.stateCard}>
          <Text style={styles.stateTitle}>{strings.homeLoadingTitle}</Text>
          <Text style={styles.stateDescription}>{strings.homeLoadingBody}</Text>
        </SurfaceCard>
      ) : null}

      {!isLoading && !hasAnyHomeContent ? (
        <SurfaceCard style={styles.stateCard}>
          <Text style={styles.stateTitle}>{strings.homeEmptyTitle}</Text>
          <Text style={styles.stateDescription}>
            {lastError && locale !== "en" ? `${lastError}` : strings.homeEmptyBody}
          </Text>
          <Pressable style={styles.retryButton} onPress={() => void refresh()}>
            <Text style={styles.retryButtonText}>{strings.retry}</Text>
          </Pressable>
        </SurfaceCard>
      ) : null}

      <View style={styles.sectionBlock}>
        <SectionTitle
          title={strings.homeHotLooks}
          subtitle={strings.homeHotLooksSubtitle}
          actionLabel={strings.homeViewAll}
          onPress={() => router.push("/(customer)/(tabs)/explore")}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsRow}>
          {visibleLookbook.map((item) => (
            <LookbookCard
              key={item.id}
              item={item}
              favorite={isFavorite(item.id)}
              onToggleFavorite={() => void toggleFavorite(item.id)}
              onOpenDetail={setSelectedService}
              bookingLabel={strings.bookingCta}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.sectionBlock}>
        <SectionTitle
          title={strings.homeTrends}
          subtitle={strings.homeTrendsSubtitle}
          actionLabel={strings.homeViewMore}
          onPress={() => router.push("/(customer)/(tabs)/explore")}
        />

      <View style={styles.postList}>
        {visiblePosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </View>
      </View>

      {localizedVisibleOffers.length ? (
        <View style={styles.sectionBlock}>
          <SectionTitle
            title={strings.homeMembershipOffers}
            subtitle={strings.homeOffersSubtitle}
            actionLabel={strings.homeOpenMembership}
            onPress={() => router.replace("/(customer)/(tabs)/membership")}
          />

          <View style={styles.offerList}>
            {localizedVisibleOffers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </View>
        </View>
      ) : null}

      <CustomerServiceDetailModal
        bookingLabel={strings.bookingCta}
        favorite={selectedService ? isFavorite(selectedService.id) : false}
        onBook={() => {
          if (!selectedService) return;
          router.push({
            pathname: "/(customer)/(tabs)/booking",
            params: { service: selectedService.title },
          });
          setSelectedService(null);
        }}
        onClose={() => setSelectedService(null)}
        onToggleFavorite={() => {
          if (!selectedService) return;
          void toggleFavorite(selectedService.id);
        }}
        service={selectedService}
        visible={Boolean(selectedService)}
      />
    </CustomerScreen>
  );
}

function LookbookCard({
  item,
  favorite,
  onToggleFavorite,
  onOpenDetail,
  bookingLabel,
}: {
  item: LookbookItem;
  favorite: boolean;
  onToggleFavorite: () => void;
  onOpenDetail: (item: LookbookItem) => void;
  bookingLabel: string;
}) {
  const priceParts = splitCustomerPriceLabel(item.price);

  return (
    <Pressable style={styles.lookbookCard} onPress={() => onOpenDetail(item)}>
      <View>
        <CustomerCachedImage alt={item.title} source={{ uri: item.image }} intent="card" style={styles.lookbookImage} />
        <Pressable
          style={[styles.favoriteButton, favorite ? styles.favoriteButtonActive : null]}
          onPress={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
        >
          <Feather color={favorite ? "#fff7ef" : colors.textSoft} name="heart" size={14} />
        </Pressable>
      </View>

      <View style={styles.lookbookBody}>
        <Text style={styles.lookbookTone}>{item.tone}</Text>
        <Text numberOfLines={1} style={styles.lookbookTitle}>{item.title}</Text>
        <Text numberOfLines={2} style={styles.lookbookBlurb}>{item.blurb}</Text>

        <View style={styles.lookbookFooter}>
          <View style={styles.lookbookPriceBlock}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.lookbookPriceAmount}>
              {priceParts.amount}
            </Text>
            {priceParts.unit ? <Text style={styles.lookbookPriceUnit}>{priceParts.unit}</Text> : null}
          </View>
          <Pressable
            style={styles.bookButton}
            onPress={(event) => {
              event.stopPropagation();
              router.push({
                pathname: "/(customer)/(tabs)/booking",
                params: { service: item.title },
              });
            }}
          >
            <Text style={styles.bookButtonText}>{bookingLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

function PostCard({ post }: { post: CustomerContentPost }) {
  async function openPostDetail() {
    const previewImageUrl = post.coverImageUrl ? getCustomerImageUri(post.coverImageUrl, "preview") : "";
    if (post.coverImageUrl) {
      await prefetchCustomerImagesForIntent([post.coverImageUrl], "preview");
    }

    router.push({
      pathname: "/(customer)/feed/[postId]",
      params: {
        postId: post.id,
        title: post.title,
        summary: post.summary,
        body: post.body,
        coverImageUrl: post.coverImageUrl ?? "",
        coverImagePreviewUrl: previewImageUrl,
        sourcePlatform: post.sourcePlatform,
      },
    });
  }

  return (
    <Pressable onPress={() => void openPostDetail()}>
      <SurfaceCard style={styles.postCard}>
        {post.coverImageUrl ? (
          <CustomerCachedImage alt={post.title} source={{ uri: post.coverImageUrl }} intent="card" style={styles.postImage} />
        ) : null}

        <View style={styles.postCopy}>
          <View style={styles.postMetaRow}>
            <Text style={styles.postTag}>{post.sourcePlatform}</Text>
            <Pressable>
              <Feather color="#ae9d8d" name="bookmark" size={15} />
            </Pressable>
          </View>
          <Text style={styles.postTitle}>{post.title}</Text>
          <Text numberOfLines={3} style={styles.postSummary}>{post.summary}</Text>
        </View>
      </SurfaceCard>
    </Pressable>
  );
}

function OfferCard({ offer }: { offer: MarketingOfferCard }) {
  return (
    <Pressable style={styles.offerCard} onPress={() => router.replace("/(customer)/(tabs)/membership")}>
      <View style={styles.offerIcon}>
        <Feather color="#a7744d" name="percent" size={16} />
      </View>
      <View style={styles.offerCopy}>
        <Text style={styles.offerTitle}>{offer.title}</Text>
        <Text style={styles.offerDescription}>{offer.description}</Text>
      </View>
      <Feather color="#aa9785" name="chevron-right" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
    paddingTop: 0,
  },
  heroCard: {
    backgroundColor: "#fdf2e8",
    flexDirection: "row",
    gap: 10,
    overflow: "hidden",
    padding: 14,
  },
  heroTextColumn: {
    flex: 1,
    gap: 10,
    justifyContent: "space-between",
    paddingRight: 4,
    paddingVertical: 4,
    zIndex: 2,
  },
  heroMiniBadge: {
    alignItems: "center",
    backgroundColor: "#fff7f0",
    borderRadius: 10,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  heroTitle: {
    color: "#3b2d23",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.4,
    lineHeight: 26,
    maxWidth: 180,
  },
  heroSubtitle: {
    color: "#8c7b6d",
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 178,
  },
  heroActions: {
    alignItems: "flex-start",
    flexDirection: "column",
    gap: 8,
    marginTop: 2,
  },
  heroImage: {
    alignSelf: "flex-end",
    borderRadius: 24,
    height: 178,
    marginLeft: -4,
    width: 138,
  },
  filtersRow: {
    gap: 10,
    paddingRight: 12,
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: "#fffdf9",
    borderColor: "#efe2d6",
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    minHeight: 38,
    paddingHorizontal: 14,
  },
  filterChipActive: {
    backgroundColor: "#4a3424",
    borderColor: "#4a3424",
  },
  filterChipText: {
    color: "#8c7c6e",
    fontSize: 12,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: colors.surface,
  },
  sectionBlock: {
    gap: 12,
  },
  stateCard: {
    borderRadius: 22,
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  stateTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  stateDescription: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "800",
  },
  cardsRow: {
    gap: 12,
    paddingRight: 8,
  },
  lookbookCard: {
    ...shadow.card,
    backgroundColor: "#fffdfa",
    borderColor: "#ebdfd3",
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    width: 152,
  },
  lookbookImage: {
    height: 148,
    width: "100%",
  },
  favoriteButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,250,245,0.96)",
    borderColor: "#ebdfd3",
    borderWidth: 1,
    borderRadius: radius.pill,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: 10,
    top: 10,
    width: 28,
  },
  favoriteButtonActive: {
    backgroundColor: "#f97316",
    borderColor: "#f97316",
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    transform: [{ scale: 1.08 }],
  },
  lookbookBody: {
    gap: 8,
    padding: 10,
  },
  lookbookTone: {
    color: "#be8a63",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  lookbookTitle: {
    color: "#3d3027",
    fontSize: 16,
    fontWeight: "800",
  },
  lookbookBlurb: {
    color: "#877668",
    fontSize: 12,
    lineHeight: 18,
    minHeight: 36,
  },
  lookbookFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  lookbookPriceBlock: {
    flex: 1,
    minWidth: 0,
  },
  lookbookPriceAmount: {
    color: "#3a2d23",
    fontSize: 13,
    fontWeight: "800",
  },
  lookbookPriceUnit: {
    color: "#8c7b6d",
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 11,
    marginTop: 1,
    textTransform: "uppercase",
  },
  bookButton: {
    alignItems: "center",
    backgroundColor: "#fff7ef",
    borderColor: "#eadccf",
    borderRadius: radius.pill,
    borderWidth: 1,
    minWidth: 68,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  bookButtonText: {
    color: "#7b5f48",
    fontSize: 11,
    fontWeight: "800",
  },
  postList: {
    gap: 10,
  },
  postCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    padding: 10,
  },
  postImage: {
    borderRadius: 14,
    height: 86,
    width: 86,
  },
  postCopy: {
    flex: 1,
    gap: 4,
  },
  postMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  postTag: {
    color: "#c09167",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  postTitle: {
    color: "#3d3027",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
  },
  postSummary: {
    color: "#847366",
    fontSize: 12,
    lineHeight: 18,
  },
  offerList: {
    gap: 10,
  },
  offerCard: {
    ...shadow.card,
    alignItems: "center",
    backgroundColor: "#fff4e9",
    borderColor: "#ebdfd0",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  offerIcon: {
    alignItems: "center",
    backgroundColor: "#fffaf4",
    borderRadius: 14,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  offerCopy: {
    flex: 1,
    gap: 3,
  },
  offerTitle: {
    color: "#3c3026",
    fontSize: 14,
    fontWeight: "800",
  },
  offerDescription: {
    color: "#847265",
    fontSize: 12,
    lineHeight: 18,
  },
});
