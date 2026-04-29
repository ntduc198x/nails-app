import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CustomerContentPost, LookbookItem, MarketingOfferCard } from "@nails/shared";
import { CustomerScreen, CustomerTopActions, PrimaryButton, SectionTitle, SurfaceCard } from "@/src/features/customer/ui";
import { useCustomerHomeFeed } from "@/src/hooks/use-customer-home-feed";
import { premiumTheme } from "@/src/design/premium-theme";

const { colors, radius, shadow } = premiumTheme;

const HOME_FILTERS = [
  { key: "all", label: "Tat ca", icon: "clock" },
  { key: "hot", label: "Mau hot", icon: "star" },
  { key: "trend", label: "Xu huong", icon: "trending-up" },
  { key: "offers", label: "Uu dai", icon: "tag" },
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
  const [activeFilter, setActiveFilter] = useState<HomeFilterKey>("all");
  const { contentPosts, isLoading, lookbook, offers, refresh } = useCustomerHomeFeed();

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

  return (
    <CustomerScreen
      hideHeader
      title="Trang chu"
      contentContainerStyle={styles.content}
      onRefresh={() => void refresh()}
      refreshing={isLoading}
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
          <Text style={styles.heroTitle}>Dep moi ngay, dat lich nhanh, xem mau hot va uu dai ngay tai trang chu.</Text>
          <Text style={styles.heroSubtitle}>
            {isLoading
              ? "Dang cap nhat noi dung moi nhat..."
              : "Tong hop mau dang hot, xu huong lam dep va uu dai cua cua hang cho tai khoan customer."}
          </Text>

          <View style={styles.heroActions}>
            <PrimaryButton label="Dat lich ngay" onPress={() => router.push("/(customer)/booking")} />
            <PrimaryButton label="Kham pha" subtle onPress={() => router.push("/(customer)/explore")} />
          </View>
        </View>

        {heroImage ? <Image alt="Hero nail design" source={{ uri: heroImage }} style={styles.heroImage} /> : null}
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

      <View style={styles.sectionBlock}>
        <SectionTitle
          title="Mau dang hot"
          subtitle="Lookbook dong bo voi landing page, uu tien mau noi bat va de dat lich."
          actionLabel="Xem tat ca"
          onPress={() => router.push("/(customer)/explore")}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsRow}>
          {visibleLookbook.map((item) => (
            <LookbookCard key={item.id} item={item} />
          ))}
        </ScrollView>
      </View>

      <View style={styles.sectionBlock}>
        <SectionTitle
          title="Xu huong lam dep hom nay"
          subtitle="Noi dung ngan gon tu beauty feed, uu tien bai da publish."
          actionLabel="Xem them"
          onPress={() => router.push("/(customer)/favorites")}
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
            title="Quyen loi thanh vien"
            subtitle="Uu dai hien co duoc xem va su dung trong The thanh vien."
            actionLabel="Mo the"
            onPress={() => router.replace("/(customer)/membership")}
          />

          <View style={styles.offerList}>
            {visibleOffers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </View>
        </View>
      ) : null}
    </CustomerScreen>
  );
}

function LookbookCard({ item }: { item: LookbookItem }) {
  return (
    <Pressable
      style={styles.lookbookCard}
      onPress={() =>
        router.push({
          pathname: "/(customer)/booking",
          params: { service: item.title },
        })
      }
    >
      <View>
        <Image alt={item.title} source={{ uri: item.image }} style={styles.lookbookImage} />
        <Pressable style={styles.favoriteButton}>
          <Feather color="#f5f0ea" name="heart" size={14} />
        </Pressable>
      </View>

      <View style={styles.lookbookBody}>
        <Text style={styles.lookbookTone}>{item.tone}</Text>
        <Text numberOfLines={1} style={styles.lookbookTitle}>{item.title}</Text>
        <Text numberOfLines={2} style={styles.lookbookBlurb}>{item.blurb}</Text>

        <View style={styles.lookbookFooter}>
          <Text style={styles.lookbookPrice}>{item.price}</Text>
          <View style={styles.bookButton}>
            <Text style={styles.bookButtonText}>Dat lich</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function PostCard({ post }: { post: CustomerContentPost }) {
  return (
    <SurfaceCard style={styles.postCard}>
      {post.coverImageUrl ? <Image alt={post.title} source={{ uri: post.coverImageUrl }} style={styles.postImage} /> : null}

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
  );
}

function OfferCard({ offer }: { offer: MarketingOfferCard }) {
  return (
    <Pressable style={styles.offerCard} onPress={() => router.replace("/(customer)/membership")}>
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
    overflow: "hidden",
    padding: 14,
    gap: 10,
  },
  heroTextColumn: {
    flex: 1,
    gap: 10,
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingRight: 4,
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
    flexDirection: "column",
    alignItems: "flex-start",
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
    backgroundColor: "rgba(92, 70, 54, 0.42)",
    borderRadius: radius.pill,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: 10,
    top: 10,
    width: 28,
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
