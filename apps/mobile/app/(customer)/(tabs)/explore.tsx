import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { ExploreGalleryItem, ExploreProduct, ExploreTeamMember, LookbookItem, MarketingOfferCard } from "@nails/shared";
import { CustomerCachedImage } from "@/src/features/customer/cached-image";
import { CustomerImagePreviewModal } from "@/src/features/customer/image-preview-modal";
import { CATEGORY_ITEMS, matchesCategory } from "@/src/features/customer/data";
import {
  localizeGalleryItem,
  localizeLookbookItem,
  localizeOfferCard,
  localizeOpeningHours,
  localizeProduct,
  localizeStorefront,
  localizeTeamMember,
} from "@/src/features/customer/localize";
import { useCustomerStrings } from "@/src/features/customer/strings";
import { CustomerScreen, CustomerTopActions, SurfaceCard } from "@/src/features/customer/ui";
import { premiumTheme } from "@/src/design/premium-theme";
import { useCustomerExplore } from "@/src/hooks/use-customer-explore";
import { useCustomerFavorites } from "@/src/hooks/use-customer-favorites";
import { useCustomerPreferences } from "@/src/providers/customer-preferences-provider";

const { colors, radius, shadow, spacing } = premiumTheme;

type CategoryKey = (typeof CATEGORY_ITEMS)[number]["key"];

const SERVICE_CARD_WIDTH = 182;
const SERVICE_CARD_GAP = 14;
const SERVICE_AUTO_SCROLL_INTERVAL = 4000;

function getLocalizedCategoryLabel(key: CategoryKey, strings: ReturnType<typeof useCustomerStrings>) {
  switch (key) {
    case "all":
      return strings.all;
    case "don-gian":
      return strings.exploreCategoryMinimal;
    case "sang-trong":
      return strings.exploreCategoryLuxury;
    case "ca-tinh":
      return strings.exploreCategoryEdgy;
    case "noi-bat":
      return strings.exploreCategoryStandout;
    default:
      return strings.all;
  }
}

export default function ExploreScreen() {
  const strings = useCustomerStrings();
  const { locale } = useCustomerPreferences();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [activeServiceIndex, setActiveServiceIndex] = useState(0);
  const servicesScrollerRef = useRef<ScrollView>(null);
  const filteredServicesLengthRef = useRef(0);
  const activeServiceIndexRef = useRef(0);
  const {
    storefront,
    featuredServices,
    products,
    team,
    gallery,
    offers,
    map,
    isLoading,
    isRefreshing,
    lastError,
    refresh,
  } = useCustomerExplore();
  const { isFavorite, lastError: favoriteError, toggleFavorite } = useCustomerFavorites();

  const localizedFeaturedServices = useMemo(
    () => featuredServices.map((service) => localizeLookbookItem(locale, service)),
    [featuredServices, locale],
  );

  const filteredServices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return localizedFeaturedServices.filter((service) => {
      const haystack = `${service.title} ${service.blurb} ${service.tone} ${service.badge}`.toLowerCase();
      return (!query || haystack.includes(query)) && matchesCategory(service, activeCategory);
    });
  }, [activeCategory, localizedFeaturedServices, searchQuery]);

  const localizedCategories = useMemo(
    () =>
      CATEGORY_ITEMS.map((item) => ({
        ...item,
        label: getLocalizedCategoryLabel(item.key, strings),
      })),
    [strings],
  );
  const localizedStorefront = useMemo(() => localizeStorefront(locale, storefront), [locale, storefront]);
  const localizedProducts = useMemo(() => products.map((item) => localizeProduct(locale, item)), [locale, products]);
  const localizedTeam = useMemo(() => team.map((member) => localizeTeamMember(locale, member)), [locale, team]);
  const localizedGallery = useMemo(() => gallery.map((item) => localizeGalleryItem(locale, item)), [locale, gallery]);
  const localizedOffers = useMemo(() => offers.map((offer) => localizeOfferCard(locale, offer)), [locale, offers]);

  useEffect(() => {
    filteredServicesLengthRef.current = filteredServices.length;

    setActiveServiceIndex((currentIndex) => {
      const nextIndex = Math.min(currentIndex, Math.max(0, filteredServices.length - 1));
      activeServiceIndexRef.current = nextIndex;
      return nextIndex;
    });
  }, [filteredServices.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentLength = filteredServicesLengthRef.current;
      if (currentLength <= 1) return;

      const nextIndex = (activeServiceIndexRef.current + 1) % currentLength;
      activeServiceIndexRef.current = nextIndex;
      setActiveServiceIndex(nextIndex);

      servicesScrollerRef.current?.scrollTo({
        x: nextIndex * (SERVICE_CARD_WIDTH + SERVICE_CARD_GAP),
        animated: true,
      });
    }, SERVICE_AUTO_SCROLL_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  const handleToggleFavorite = useCallback(
    async (serviceId: string) => {
      try {
        await toggleFavorite(serviceId);
      } catch {
        // Error alert is handled by the favorites hook effect above.
      }
    },
    [toggleFavorite],
  );

  const onServicesScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const scrollX = event.nativeEvent.contentOffset.x;
      const currentLength = filteredServicesLengthRef.current;
      if (currentLength <= 0) return;

      const nextIndex = Math.max(
        0,
        Math.min(currentLength - 1, Math.round(scrollX / (SERVICE_CARD_WIDTH + SERVICE_CARD_GAP))),
      );

      if (nextIndex !== activeServiceIndexRef.current) {
        activeServiceIndexRef.current = nextIndex;
        setActiveServiceIndex(nextIndex);
      }
    },
    [],
  );

  useEffect(() => {
    if (!favoriteError) return;

    if (favoriteError.includes("PROFILE_NOT_FOUND") || favoriteError.includes("PHONE_NOT_SET")) {
      const actionLabel = favoriteError.includes("PROFILE_NOT_FOUND")
        ? strings.exploreUpdateProfile
        : strings.exploreUpdatePhone;
      Alert.alert(
        strings.exploreFavoriteNeedsInfoTitle,
        favoriteError.split(":")[1] || strings.exploreFavoriteNeedsInfoBody,
        [
          { text: strings.cancel, style: "cancel" },
          { text: actionLabel, onPress: () => router.navigate("/(customer)/(tabs)/account") },
        ],
      );
      return;
    }

    if (favoriteError.includes("CUSTOMER_ACCOUNT_NOT_LINKED")) {
      Alert.alert(strings.favoriteSaveBlockedTitle, strings.favoriteSaveBlockedBody);
      return;
    }

    Alert.alert(strings.favoriteSaveFailedTitle, favoriteError);
  }, [
    favoriteError,
    strings.cancel,
    strings.exploreFavoriteNeedsInfoBody,
    strings.exploreFavoriteNeedsInfoTitle,
    strings.exploreUpdatePhone,
    strings.exploreUpdateProfile,
    strings.favoriteSaveBlockedBody,
    strings.favoriteSaveBlockedTitle,
    strings.favoriteSaveFailedTitle,
  ]);

  async function openMap() {
    if (map?.mapUrl) {
      await Linking.openURL(map.mapUrl);
    }
  }

  return (
    <CustomerScreen
      title={strings.exploreTitle}
      hideHeader
      keyboardAware
      keyboardVerticalOffset={12}
      contentContainerStyle={styles.content}
      onRefresh={() => void refresh()}
      refreshing={isRefreshing}
    >
      <View style={styles.topBar}>
        <View style={styles.topBarSpacer} />
        <CustomerTopActions />
      </View>

      {localizedStorefront ? (
        <View style={styles.storeHero}>
          {localizedStorefront.coverImageUrl ? (
            <CustomerCachedImage alt={localizedStorefront.name} source={{ uri: localizedStorefront.coverImageUrl }} intent="hero" style={styles.storeImage} />
          ) : null}

          <View style={styles.storeCopy}>
            <Text style={styles.storeName}>{localizedStorefront.name}</Text>
            {localizedStorefront.category ? <Text style={styles.storeCategory}>{localizedStorefront.category}</Text> : null}
            {localizedStorefront.description ? <Text style={styles.storeDescription}>{localizedStorefront.description}</Text> : null}

            {(localizedStorefront.rating || localizedStorefront.reviewsLabel) ? (
              <View style={styles.ratingRow}>
                <Feather color="#d7a24c" name="star" size={15} />
                <Text style={styles.ratingText}>
                  {localizedStorefront.rating ? localizedStorefront.rating.toFixed(1) : "4.9"}
                  {localizedStorefront.reviewsLabel ? ` (${localizedStorefront.reviewsLabel})` : ""}
                </Text>
              </View>
            ) : null}

            <View style={styles.highlightRow}>
              {localizedStorefront.highlights.map((item) => (
                <View key={item} style={styles.highlightItem}>
                  <Feather color={colors.textSoft} name="shield" size={13} />
                  <Text style={styles.highlightText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.searchBar}>
        <Feather color="#8f8174" name="search" size={16} />
        <TextInput
          placeholder={strings.exploreSearchPlaceholder}
          placeholderTextColor="#b7aa9d"
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {localizedCategories.map((item) => {
          const active = item.key === activeCategory;

          return (
            <Pressable key={item.key} style={[styles.chip, active ? styles.chipActive : null]} onPress={() => setActiveCategory(item.key)}>
              <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <SectionHeader title={strings.exploreFeaturedServices} actionLabel={strings.exploreBookAction} />

      {isLoading && filteredServices.length === 0 ? (
        <SurfaceCard style={styles.stateCard}>
          <Text style={styles.stateTitle}>{strings.exploreLoadingTitle}</Text>
          <Text style={styles.stateDescription}>{strings.exploreLoadingBody}</Text>
        </SurfaceCard>
      ) : null}

      {!isLoading && filteredServices.length === 0 ? (
        <SurfaceCard style={styles.stateCard}>
          <Text style={styles.stateTitle}>{strings.exploreEmptyTitle}</Text>
          <Text style={styles.stateDescription}>
            {lastError ? lastError : strings.exploreEmptyBody}
          </Text>
          <Pressable style={styles.retryButton} onPress={() => void refresh()}>
            <Text style={styles.retryButtonText}>{strings.retry}</Text>
          </Pressable>
        </SurfaceCard>
      ) : null}

      {filteredServices.length ? (
        <>
          <ScrollView
            ref={servicesScrollerRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.lookbookRow}
            onScroll={onServicesScroll}
            scrollEventThrottle={16}
          >
            {filteredServices.map((service) => (
              <MemoExploreServiceCard
                key={service.id}
                service={service}
                favorite={isFavorite(service.id)}
                onToggleFavorite={handleToggleFavorite}
                onPreviewImage={setPreviewImage}
                bookingLabel={strings.bookingCta}
              />
            ))}
          </ScrollView>

          <View style={styles.serviceDots}>
            {filteredServices.map((service, index) => (
              <View
                key={service.id}
                style={[styles.serviceDot, index === activeServiceIndex ? styles.serviceDotActive : null]}
              />
            ))}
          </View>
        </>
      ) : null}

      <SectionHeader title={strings.exploreProducts} actionLabel={strings.exploreViewMore} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productRow}>
        {localizedProducts.map((item) => (
          <ProductCard key={item.id} item={item} strings={strings} />
        ))}
      </ScrollView>

      <SectionHeader title={strings.exploreTeam} actionLabel={`${team.length}`} />
      <View style={styles.teamRow}>
        {localizedTeam.map((member) => (
          <TeamCard key={member.id} member={member} />
        ))}
      </View>

      <SectionHeader title={strings.exploreGallery} actionLabel={`${localizedGallery.length}`} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
        {localizedGallery.map((item) => (
          <GalleryCard key={item.id} item={item} strings={strings} />
        ))}
      </ScrollView>

      {localizedOffers.length ? (
        <>
          <SectionHeader title={strings.exploreOffers} actionLabel={strings.exploreOpenMembership} />
          <View style={styles.offerList}>
            {localizedOffers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </View>
        </>
      ) : null}

      <SectionHeader title={strings.exploreMap} />
      <SurfaceCard style={styles.mapCard}>
        {map?.imageUrl ? <CustomerCachedImage alt={strings.exploreMapAlt} source={{ uri: map.imageUrl }} style={styles.mapImage} /> : null}
        <View style={styles.mapCopy}>
          {map?.addressLine ? <Text style={styles.mapAddress}>{map.addressLine}</Text> : null}
          {map?.openingHours ? (
            <View style={styles.mapMetaRow}>
              <Feather color={colors.textSoft} name="clock" size={14} />
              <Text style={styles.mapMetaText}>{localizeOpeningHours(locale, map.openingHours) ?? map.openingHours}</Text>
            </View>
          ) : null}
        </View>
        {map?.mapUrl ? (
          <Pressable style={styles.directionButton} onPress={() => void openMap()}>
            <Feather color={colors.accent} name="navigation" size={15} />
            <Text style={styles.directionButtonText}>{strings.exploreDirections}</Text>
          </Pressable>
        ) : null}
      </SurfaceCard>

      <CustomerImagePreviewModal imageUrl={previewImage} visible={Boolean(previewImage)} onClose={() => setPreviewImage(null)} />
    </CustomerScreen>
  );
}

function SectionHeader({ title, actionLabel }: { title: string; actionLabel?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel ? (
        <View style={styles.sectionActionWrap}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
          <Feather color={colors.textSoft} name="chevron-right" size={16} />
        </View>
      ) : null}
    </View>
  );
}

function ExploreServiceCard({
  service,
  favorite,
  onToggleFavorite,
  onPreviewImage,
  bookingLabel,
}: {
  service: LookbookItem;
  favorite: boolean;
  onToggleFavorite: (serviceId: string) => void;
  onPreviewImage: (imageUrl: string) => void;
  bookingLabel: string;
}) {
  return (
    <View style={styles.serviceCard}>
      <Pressable onPress={() => onPreviewImage(service.image)}>
        <CustomerCachedImage alt={service.title} source={{ uri: service.image }} intent="card" style={styles.serviceImage} />
        <View style={styles.serviceToneBadge}>
          <Text style={styles.serviceToneText}>{service.tone.toUpperCase()}</Text>
        </View>
        <Pressable
          style={[styles.favoriteButton, favorite ? styles.favoriteButtonActive : null]}
          onPress={(event) => {
            event.stopPropagation();
            onToggleFavorite(service.id);
          }}
        >
          <Feather color={favorite ? "#fff7ef" : colors.textSoft} name="heart" size={14} />
        </Pressable>
      </Pressable>

      <View style={styles.serviceBody}>
        <Text numberOfLines={1} style={styles.serviceTitle}>{service.title}</Text>
        <Text numberOfLines={2} style={styles.serviceBlurb}>{service.blurb}</Text>
        <View style={styles.serviceMetaRow}>
          <Text style={styles.servicePrice}>{service.price}</Text>
          <Pressable
            style={styles.bookButton}
            onPress={(event) => {
              event.stopPropagation();
              router.push({
                pathname: "/(customer)/(tabs)/booking",
                params: { service: service.title },
              });
            }}
          >
            <Text style={styles.bookButtonText}>{bookingLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const MemoExploreServiceCard = memo(
  ExploreServiceCard,
  (previous, next) =>
    previous.favorite === next.favorite &&
    previous.bookingLabel === next.bookingLabel &&
    previous.service.id === next.service.id &&
    previous.service.image === next.service.image &&
    previous.service.title === next.service.title &&
    previous.service.blurb === next.service.blurb &&
    previous.service.tone === next.service.tone &&
    previous.service.price === next.service.price,
);

function ProductCard({ item, strings }: { item: ExploreProduct; strings: ReturnType<typeof useCustomerStrings> }) {
  return (
    <SurfaceCard style={styles.productCard}>
      {item.imageUrl ? <CustomerCachedImage alt={item.name} source={{ uri: item.imageUrl }} style={styles.productImage} /> : null}
      <Text numberOfLines={2} style={styles.productTitle}>{item.name}</Text>
      {item.subtitle ? <Text style={styles.productSubLabel}>{item.subtitle}</Text> : null}
      <View style={styles.productFooter}>
        <Text style={styles.productPrice}>{item.priceLabel ?? strings.exploreContactPrice}</Text>
        <View style={styles.productTag}>
          <Text style={styles.productTagText}>
            {item.isFeatured ? strings.exploreFeaturedTag : item.productType ?? strings.exploreItemTag}
          </Text>
        </View>
      </View>
    </SurfaceCard>
  );
}

function TeamCard({ member }: { member: ExploreTeamMember }) {
  return (
    <View style={styles.teamCard}>
      {member.avatarUrl ? <CustomerCachedImage alt={member.displayName} source={{ uri: member.avatarUrl }} intent="thumbnail" style={styles.teamAvatar} /> : null}
      <Text style={styles.teamName}>{member.displayName}</Text>
      {member.roleLabel ? <Text style={styles.teamRole}>{member.roleLabel}</Text> : null}
    </View>
  );
}

function GalleryCard({ item, strings }: { item: ExploreGalleryItem; strings: ReturnType<typeof useCustomerStrings> }) {
  return (
    <View style={styles.galleryCard}>
      <CustomerCachedImage alt={item.title ?? strings.exploreGalleryFallback} source={{ uri: item.imageUrl }} style={styles.galleryImage} />
      {item.title ? <Text style={styles.galleryTitle}>{item.title}</Text> : null}
    </View>
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
    gap: 14,
    paddingTop: 0,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  topBarSpacer: {
    flex: 1,
  },
  storeHero: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  storeImage: {
    width: 112,
    height: 112,
    borderRadius: 24,
  },
  storeCopy: {
    flex: 1,
    gap: 7,
    paddingTop: 4,
  },
  storeName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.35,
    lineHeight: 27,
  },
  storeCategory: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  storeDescription: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  ratingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  ratingText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  highlightRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 2,
  },
  highlightItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  highlightText: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  statCard: {
    width: "23.5%",
    minHeight: 78,
    justifyContent: "space-between",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 11,
    borderRadius: 20,
    backgroundColor: "#fffaf4",
  },
  statLabel: {
    color: "#9d8a79",
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 13,
  },
  statValue: {
    color: "#2e241d",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.25,
    lineHeight: 19,
  },
  searchBar: {
    alignItems: "center",
    backgroundColor: "#fbf4ec",
    borderColor: "#e7d9ca",
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 15,
  },
  searchInput: {
    color: "#40342b",
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    minHeight: 40,
    paddingVertical: 0,
  },
  filterRow: {
    gap: 8,
    paddingRight: spacing.lg,
  },
  chip: {
    alignItems: "center",
    backgroundColor: "#fbf4ec",
    borderColor: "#eadfd3",
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 15,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: "#69594c",
    fontSize: 12,
    fontWeight: "700",
  },
  chipTextActive: {
    color: colors.surface,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.25,
    lineHeight: 24,
  },
  sectionActionWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
  },
  sectionAction: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "700",
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
  lookbookRow: {
    gap: 14,
    paddingRight: 8,
  },
  serviceDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
    marginTop: -2,
  },
  serviceDot: {
    backgroundColor: "#e2d4c6",
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  serviceDotActive: {
    backgroundColor: colors.accent,
    width: 20,
  },
  serviceCard: {
    ...shadow.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    width: 182,
  },
  serviceImage: {
    width: "100%",
    height: 168,
  },
  serviceToneBadge: {
    position: "absolute",
    left: 10,
    bottom: 10,
    backgroundColor: "rgba(255,250,245,0.92)",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  serviceToneText: {
    color: colors.accentWarm,
    fontSize: 10,
    fontWeight: "800",
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
  serviceBody: {
    gap: 8,
    padding: 12,
  },
  serviceTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
  },
  serviceBlurb: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 18,
    minHeight: 36,
  },
  serviceMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  servicePrice: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  bookButton: {
    backgroundColor: "#fff7ef",
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  bookButtonText: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "800",
  },
  productRow: {
    gap: 12,
    paddingRight: 8,
  },
  productCard: {
    width: 148,
    gap: 9,
    padding: 10,
  },
  productImage: {
    width: "100%",
    height: 110,
    borderRadius: 16,
  },
  productTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    minHeight: 34,
  },
  productSubLabel: {
    color: colors.textSoft,
    fontSize: 11,
    lineHeight: 15,
    marginTop: -3,
  },
  productFooter: {
    gap: 8,
  },
  productPrice: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  productTag: {
    alignSelf: "flex-start",
    backgroundColor: "#fff7ef",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  productTagText: {
    color: colors.accentWarm,
    fontSize: 10,
    fontWeight: "800",
  },
  teamRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  teamCard: {
    width: "22%",
    alignItems: "center",
    gap: 6,
  },
  teamAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  teamName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 16,
  },
  teamRole: {
    color: colors.textSoft,
    fontSize: 11,
    textAlign: "center",
  },
  galleryRow: {
    gap: 12,
    paddingRight: 8,
  },
  galleryCard: {
    width: 172,
    gap: 8,
  },
  galleryImage: {
    width: 172,
    height: 116,
    borderRadius: 18,
  },
  galleryTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
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
  mapCard: {
    gap: 12,
    padding: 10,
  },
  mapImage: {
    width: "100%",
    height: 120,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
  },
  mapCopy: {
    gap: 6,
  },
  mapAddress: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  mapMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  mapMetaText: {
    color: colors.textSoft,
    fontSize: 12,
  },
  directionButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  directionButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "800",
  },
});
