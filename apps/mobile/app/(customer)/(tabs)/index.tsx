import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CustomerContentPost, LookbookItem, MarketingOfferCard } from "@nails/shared";
import { CustomerCachedImage } from "@/src/features/customer/cached-image";
import { CustomerImagePreviewModal } from "@/src/features/customer/image-preview-modal";
import { useCustomerStrings } from "@/src/features/customer/strings";
import { CustomerScreen, CustomerTopActions, PrimaryButton, SectionTitle, SurfaceCard } from "@/src/features/customer/ui";
import { useCustomerHomeFeed } from "@/src/hooks/use-customer-home-feed";
import { useCustomerFavorites } from "@/src/hooks/use-customer-favorites";
import { prefetchCustomerImagesForIntent } from "@/src/lib/customer-image-cache";
import { getCustomerImageUri } from "@/src/lib/customer-image-url";
import { premiumTheme } from "@/src/design/premium-theme";

const { colors, radius, shadow } = premiumTheme;

const HOME_FILTERS = [
  { key: "all", label: "Tất cả", icon: "clock" },
  { key: "hot", label: "Mẫu hot", icon: "star" },
  { key: "trend", label: "Xu hướng", icon: "trending-up" },
  { key: "offers", label: "Ưu đãi", icon: "tag" },
] as const;

type HomeFilterKey = (typeof HOME_FILTERS)[number]["key"];

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
  const [activeFilter, setActiveFilter] = useState<HomeFilterKey>("all");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const { contentPosts, isLoading, isRefreshing, lastError, lookbook, offers, refresh } = useCustomerHomeFeed();
  const { isFavorite, lastError: favoriteError, toggleFavorite } = useCustomerFavorites();

  const heroImage = lookbook[1]?.image ?? lookbook[0]?.image ?? null;

  const visibleLookbook = useMemo(() => {
    if (activeFilter === "all") return lookbook.slice(0, 6);
    return lookbook.filter((item) => getLookbookTags(item).includes(activeFilter)).slice(0, 6);
  }, [activeFilter, lookbook]);

  const visiblePosts = useMemo(() => {
    if (activeFilter === "all") return contentPosts.slice(0, 4);
    return contentPosts.filter((post) => getPostTags(post).includes(activeFilter)).slice(0, 4);
  }, [activeFilter, contentPosts]);

  const visibleOffers = useMemo(() => {
    if (activeFilter === "all" || activeFilter === "offers") return offers.slice(0, 2);
    return [];
  }, [activeFilter, offers]);

  const hasAnyHomeContent = visibleLookbook.length > 0 || visiblePosts.length > 0 || visibleOffers.length > 0;

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
      <View style={styles.topBar}>
        <View>
          <Text style={styles.brand}>CHAM BEAUTY</Text>
        </View>

        <CustomerTopActions />
      </View>

      <SurfaceCard style={styles.heroCard}>
        <View style={styles.heroTextColumn}>
          <View style={styles.heroMiniBadge}>
            <Feather color="#b98258" name="briefcase" size={12} />
          </View>
          <Text style={styles.heroTitle}>Đẹp mỗi ngày, đặt lịch nhanh và xem ngay các mẫu đang nổi bật.</Text>
          <Text style={styles.heroSubtitle}>
            {isLoading
              ? "Đang cập nhật nội dung mới nhất..."
              : "Tổng hợp các mẫu đang hot, xu hướng làm đẹp và ưu đãi mới của cửa hàng dành cho khách hàng."}
          </Text>

          <View style={styles.heroActions}>
            <PrimaryButton label="Đặt lịch ngay" onPress={() => router.push("/(customer)/(tabs)/booking")} />
            <PrimaryButton label="Khám phá" subtle onPress={() => router.push("/(customer)/(tabs)/explore")} />
          </View>
        </View>

        {heroImage ? (
          <CustomerCachedImage alt="Hero nail design" source={{ uri: heroImage }} intent="hero" style={styles.heroImage} />
        ) : null}
      </SurfaceCard>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
        {HOME_FILTERS.map((item) => {
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
          <Text style={styles.stateTitle}>Dang tai home feed...</Text>
          <Text style={styles.stateDescription}>Noi dung customer dang duoc dong bo tu he thong.</Text>
        </SurfaceCard>
      ) : null}

      {!isLoading && !hasAnyHomeContent ? (
        <SurfaceCard style={styles.stateCard}>
          <Text style={styles.stateTitle}>Chua co du lieu hien thi</Text>
          <Text style={styles.stateDescription}>
            {lastError ? `Khong tai duoc home feed. ${lastError}` : "Khong tim thay lookbook, bai viet hoac uu dai cho tai khoan nay."}
          </Text>
          <Pressable style={styles.retryButton} onPress={() => void refresh()}>
            <Text style={styles.retryButtonText}>{strings.retry}</Text>
          </Pressable>
        </SurfaceCard>
      ) : null}

      <View style={styles.sectionBlock}>
        <SectionTitle
          title={strings.homeHotLooks}
          subtitle="Lookbook đồng bộ với landing page, ưu tiên mẫu nổi bật và dễ đặt lịch."
          actionLabel="Xem tất cả"
          onPress={() => router.push("/(customer)/(tabs)/explore")}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsRow}>
          {visibleLookbook.map((item) => (
            <LookbookCard
              key={item.id}
              item={item}
              favorite={isFavorite(item.id)}
              onToggleFavorite={() => void toggleFavorite(item.id)}
              onPreviewImage={setPreviewImage}
              bookingLabel={strings.bookingCta}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.sectionBlock}>
        <SectionTitle
          title={strings.homeTrends}
          subtitle="Nội dung ngắn gọn từ beauty feed, ưu tiên bài đã publish."
          actionLabel="Xem thêm"
          onPress={() => router.push("/(customer)/(tabs)/explore")}
        />

      <View style={styles.postList}>
        {visiblePosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </View>
      </View>

      {visibleOffers.length ? (
        <View style={styles.sectionBlock}>
          <SectionTitle
            title={strings.homeMembershipOffers}
            subtitle="Ưu đãi hiện có được xem và sử dụng trong Thẻ thành viên."
            actionLabel={strings.homeOpenMembership}
            onPress={() => router.replace("/(customer)/(tabs)/membership")}
          />

          <View style={styles.offerList}>
            {visibleOffers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </View>
        </View>
      ) : null}

      <CustomerImagePreviewModal imageUrl={previewImage} visible={Boolean(previewImage)} onClose={() => setPreviewImage(null)} />
    </CustomerScreen>
  );
}

function LookbookCard({
  item,
  favorite,
  onToggleFavorite,
  onPreviewImage,
  bookingLabel,
}: {
  item: LookbookItem;
  favorite: boolean;
  onToggleFavorite: () => void;
  onPreviewImage: (imageUrl: string) => void;
  bookingLabel: string;
}) {
  return (
    <View style={styles.lookbookCard}>
      <Pressable onPress={() => onPreviewImage(item.image)}>
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
      </Pressable>

      <View style={styles.lookbookBody}>
        <Text style={styles.lookbookTone}>{item.tone}</Text>
        <Text numberOfLines={1} style={styles.lookbookTitle}>{item.title}</Text>
        <Text numberOfLines={2} style={styles.lookbookBlurb}>{item.blurb}</Text>

        <View style={styles.lookbookFooter}>
          <Text style={styles.lookbookPrice}>{item.price}</Text>
          <Pressable
            style={styles.bookButton}
            onPress={() =>
              router.push({
                pathname: "/(customer)/(tabs)/booking",
                params: { service: item.title },
              })
            }
          >
            <Text style={styles.bookButtonText}>{bookingLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
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
    paddingTop: 4,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  brand: {
    color: "#b27d58",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 3,
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
    justifyContent: "space-between",
  },
  lookbookPrice: {
    color: "#3a2d23",
    fontSize: 14,
    fontWeight: "800",
  },
  bookButton: {
    backgroundColor: "#fff7ef",
    borderColor: "#eadccf",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
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
