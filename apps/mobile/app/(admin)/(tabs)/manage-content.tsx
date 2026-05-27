import Feather from "@expo/vector-icons/Feather";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CachedAppImage } from "@/src/components/cached-app-image";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type {
  MobileAdminContentBranchOverview,
  MobileAdminContentPost,
  MobileAdminContentPostInput,
  MobileAdminContentSnapshot,
  MobileAdminMerchService,
  MobileAdminOfferPackageTier,
  MobileAdminStorefrontGalleryItem,
  MobileAdminStorefrontGalleryItemInput,
  MobileAdminStorefrontProduct,
  MobileAdminStorefrontProductInput,
  MobileAdminStorefrontProfileInput,
  MobileAdminStorefrontTeamMember,
  MobileAdminStorefrontTeamMemberInput,
  LocalizedTextValue,
} from "@nails/shared";
import {
  archiveAdminContentPostForMobile,
  archiveAdminOfferForMobile,
  createAdminContentPostForMobile,
  createAdminStorefrontGalleryItemForMobile,
  createAdminStorefrontProductForMobile,
  createAdminStorefrontTeamMemberForMobile,
  deleteAdminStorefrontProfileForMobile,
  deleteAdminStorefrontProductForMobile,
  listAdminContentSnapshotForMobile,
  localizeAdminBranchName,
  listAdminMerchServicesForMobile,
  localizeAdminMerchService,
  MOBILE_ADMIN_OFFER_PACKAGE_TIERS,
  setActiveAdminStorefrontProfileForMobile,
  updateAdminContentPostForMobile,
  updateAdminMerchServiceForMobile,
  updateAdminStorefrontGalleryItemForMobile,
  updateAdminStorefrontProductForMobile,
  updateAdminStorefrontTeamMemberForMobile,
  upsertAdminStorefrontProfileForMobile,
} from "@nails/shared";
import { buildManualAwareTranslationMeta } from "@/src/features/admin/dynamic-translation";
import { useAdminStrings } from "@/src/features/admin/strings";
import { AdminKeyboardAwareScrollView, ADMIN_KEYBOARD_ACTIVE_FIELD_CLEARANCE, getAdminHeaderTopPadding, useAdminKeyboardFieldFocus, useKeyboardVisible } from "@/src/features/admin/ui";
import { ManageScreenShell } from "@/src/features/admin/manage-ui";
import { useAdminObserverScope } from "@/src/hooks/use-admin-observer-scope";
import { uploadPickedAdminContentImage } from "@/src/features/admin/content-images";
import { clearCustomerFeedCache } from "@/src/lib/customer-feed-cache";
import { useAdminPreferences } from "@/src/providers/admin-preferences-provider";
import { mobileSupabase } from "@/src/lib/supabase";
import { ADMIN_CONTENT_REFRESH_SIGNAL_KEY, hydrateCachedValue, isCacheFresh, writeCachedValue } from "@/src/lib/admin-services-cache";

const palette = {
  border: "#EADFD3",
  card: "#FFFFFF",
  text: "#2F241D",
  sub: "#84776C",
  accent: "#A56D3D",
  accentSoft: "#F5E9DD",
  danger: "#C25A43",
  mutedSoft: "#F7F3EE",
};

const SERVICES_CACHE_KEY = "admin-services";
const SERVICES_FRESH_MS = 2 * 60 * 1000;
const SERVICES_MAX_STALE_MS = 10 * 60 * 1000;
const OFFER_DETAIL_CACHE_PREFIX = "admin-offer-detail:";
const POST_DETAIL_CACHE_PREFIX = "admin-content-post-detail:";
const SERVICE_DETAIL_CACHE_PREFIX = "admin-merch-service-detail:";
const TEAM_MEMBER_DETAIL_CACHE_PREFIX = "admin-team-member-detail:";
const EXPLORE_FEATURED_PREVIEW_COUNT = 3;
const EXPLORE_PRODUCTS_PREVIEW_COUNT = 4;
const LEGACY_CHAM_BEAUTY_SOURCE = String.fromCharCode(67, 104, 97, 109, 32, 66, 101, 97, 117, 116, 121);

type ContentTab = "home" | "explore";
type MerchContext = "home" | "explore";

type MerchFormState = {
  id: string;
  name: string;
  nameEn: string;
  shortDescription: string;
  shortDescriptionEn: string;
  imageUrl: string;
  durationLabel: string;
  durationLabelEn: string;
  featuredInHome: boolean;
  featuredInExplore: boolean;
  displayOrderHome: string;
  displayOrderExplore: string;
  lookbookCategory: string;
  lookbookBadge: string;
  lookbookBadgeEn: string;
  lookbookTone: string;
  lookbookToneEn: string;
};

const OFFER_PACKAGE_TIERS = MOBILE_ADMIN_OFFER_PACKAGE_TIERS;
type OfferPackageTier = MobileAdminOfferPackageTier;

type PostFormState = {
  id?: string;
  title: string;
  titleEn: string;
  summary: string;
  summaryEn: string;
  body: string;
  bodyEn: string;
  coverImageUrl: string;
  contentType: MobileAdminContentPost["contentType"];
  status: MobileAdminContentPost["status"];
  priority: string;
  metadataText: string;
  publishedAt?: string | null;
  sourcePlatform?: string;
  sourceMessageId?: string | null;
};

type StorefrontFormState = {
  id?: string;
  slug: string;
  name: string;
  nameEn: string;
  category: string;
  categoryEn: string;
  description: string;
  descriptionEn: string;
  coverImageUrl: string;
  logoImageUrl: string;
  rating: string;
  reviewsLabel: string;
  reviewsLabelEn: string;
  addressLine: string;
  addressLineEn: string;
  mapUrl: string;
  openingHours: string;
  openingHoursEn: string;
  phone: string;
  messengerUrl: string;
  instagramUrl: string;
  highlightsText: string;
  highlightsTextEn: string;
  isActive: boolean;
};

type TeamFormState = {
  id?: string;
  displayName: string;
  displayNameEn: string;
  roleLabel: string;
  roleLabelEn: string;
  avatarUrl: string;
  bio: string;
  bioEn: string;
  displayOrder: string;
  isVisible: boolean;
};

type ProductFormState = {
  id?: string;
  name: string;
  nameEn: string;
  subtitle: string;
  subtitleEn: string;
  priceLabel: string;
  priceLabelEn: string;
  imageUrl: string;
  productType: string;
  productTypeEn: string;
  displayOrder: string;
  isActive: boolean;
  isFeatured: boolean;
};

type GalleryFormState = {
  id?: string;
  title: string;
  titleEn: string;
  imageUrl: string;
  kind: string;
  displayOrder: string;
  isActive: boolean;
};

function parseNumberInput(value: string) {
  return Number(value.replace(/[^\d.-]/g, "") || 0);
}

function parseMetadata(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return {};
  return JSON.parse(trimmed) as Record<string, unknown>;
}

function getLocalizedText(translations: LocalizedTextValue | null | undefined, locale: "vi" | "en", field: string) {
  const value = translations?.[locale]?.[field];
  return typeof value === "string" ? value : "";
}

function getLocalizedArrayText(translations: LocalizedTextValue | null | undefined, locale: "vi" | "en", field: string) {
  const value = translations?.[locale]?.[field];
  return Array.isArray(value) ? value.join("\n") : "";
}

function putTextField(target: Record<string, string | string[]>, field: string, value: string | null | undefined) {
  const trimmed = value?.trim();
  if (trimmed) {
    target[field] = trimmed;
  }
}

function buildTranslations(
  viFields: Record<string, string | string[] | null | undefined>,
  enFields: Record<string, string | string[] | null | undefined>,
): LocalizedTextValue | null {
  const vi: Record<string, string | string[]> = {};
  const en: Record<string, string | string[]> = {};

  for (const [field, value] of Object.entries(viFields)) {
    if (Array.isArray(value)) {
      if (value.length) vi[field] = value;
      continue;
    }
    putTextField(vi, field, value);
  }

  for (const [field, value] of Object.entries(enFields)) {
    if (Array.isArray(value)) {
      if (value.length) en[field] = value;
      continue;
    }
    putTextField(en, field, value);
  }

  return Object.keys(vi).length || Object.keys(en).length ? { vi, en } : null;
}

function getOfferPackageTier(metadata: Record<string, unknown>) {
  const raw = typeof metadata.packageTier === "string" ? metadata.packageTier.trim().toUpperCase() : "REGULAR";
  return (OFFER_PACKAGE_TIERS as readonly string[]).includes(raw) ? (raw as OfferPackageTier) : "REGULAR";
}

function getOfferPackageOrder(metadata: Record<string, unknown>) {
  const raw = Number(metadata.packageOrder ?? metadata.displayOrder ?? 0);
  return Number.isFinite(raw) ? raw : 0;
}

function getOfferPackageTierLabel(
  strings: ReturnType<typeof useAdminStrings>,
  packageTier: OfferPackageTier,
) {
  switch (packageTier) {
    case "BRONZE":
      return strings.offerTierBronze;
    case "SILVER":
      return strings.offerTierSilver;
    case "GOLD":
      return strings.offerTierGold;
    case "PLATINUM":
      return strings.offerTierPlatinum;
    case "DIAMOND":
      return strings.offerTierDiamond;
    case "REGULAR":
    default:
      return strings.offerTierRegular;
  }
}

function getPostContentTypeLabel(
  strings: ReturnType<typeof useAdminStrings>,
  contentType: MobileAdminContentPost["contentType"],
) {
  switch (contentType) {
    case "trend":
      return strings.postContentTypeTrend;
    case "care":
      return strings.postContentTypeCare;
    case "news":
      return strings.postContentTypeNews;
    case "offer_hint":
    default:
      return strings.postContentTypeOfferHint;
  }
}

function getPostStatusLabel(
  strings: ReturnType<typeof useAdminStrings>,
  status: MobileAdminContentPost["status"],
) {
  switch (status) {
    case "draft":
      return strings.postStatusDraft;
    case "approved":
      return strings.postStatusApproved;
    case "published":
      return strings.postStatusPublished;
    case "archived":
    default:
      return strings.postStatusArchived;
  }
}

function getPostSourceLabel(strings: ReturnType<typeof useAdminStrings>, sourcePlatform?: string | null) {
  switch (sourcePlatform) {
    case LEGACY_CHAM_BEAUTY_SOURCE:
    case "cham_beauty":
      return strings.postSourceChamBeauty;
    case "mobile_admin":
      return strings.postSourceMobileAdmin;
    case "telegram":
      return strings.postSourceTelegram;
    case "dummy_seed":
      return strings.postSourceDummySeed;
    default:
      return sourcePlatform || strings.postSourceMobileAdmin;
  }
}

function compareOffersByPackageOrder(
  left: MobileAdminContentSnapshot["offers"][number],
  right: MobileAdminContentSnapshot["offers"][number],
) {
  const orderDifference = getOfferPackageOrder(left.metadata) - getOfferPackageOrder(right.metadata);
  if (orderDifference !== 0) {
    return orderDifference;
  }

  return left.title.localeCompare(right.title, "vi");
}

function isLandingService(service: MobileAdminMerchService) {
  return service.active && service.featuredInLookbook;
}

function buildMerchForm(service: MobileAdminMerchService): MerchFormState {
  return {
    id: service.id,
    name: service.name,
    nameEn: getLocalizedText(service.translations, "en", "name"),
    shortDescription: service.shortDescription ?? "",
    shortDescriptionEn: getLocalizedText(service.translations, "en", "short_description"),
    imageUrl: service.imageUrl ?? "",
    durationLabel: service.durationLabel ?? "",
    durationLabelEn: getLocalizedText(service.translations, "en", "duration_label"),
    featuredInHome: service.featuredInHome,
    featuredInExplore: service.featuredInExplore,
    displayOrderHome: String(service.displayOrderHome ?? 0),
    displayOrderExplore: String(service.displayOrderExplore ?? 0),
    lookbookCategory: service.lookbookCategory ?? "",
    lookbookBadge: service.lookbookBadge ?? "",
    lookbookBadgeEn: getLocalizedText(service.translations, "en", "lookbook_badge"),
    lookbookTone: service.lookbookTone ?? "",
    lookbookToneEn: getLocalizedText(service.translations, "en", "lookbook_tone"),
  };
}

function syncMerchLookbookState(next: MerchFormState): MerchFormState {
  if (!next.featuredInHome && !next.featuredInExplore) {
    return next;
  }

  return {
    ...next,
    lookbookBadge: next.lookbookBadge,
    lookbookCategory: next.lookbookCategory,
    lookbookTone: next.lookbookTone,
  };
}

async function prewarmContentDetailCache(snapshot: MobileAdminContentSnapshot) {
  await Promise.all([
    ...snapshot.offers.map((offer) => writeCachedValue(`${OFFER_DETAIL_CACHE_PREFIX}${offer.id}`, offer)),
    ...snapshot.posts.map((post) => writeCachedValue(`${POST_DETAIL_CACHE_PREFIX}${post.id}`, post)),
    ...snapshot.team.map((member) => writeCachedValue(`${TEAM_MEMBER_DETAIL_CACHE_PREFIX}${member.id}`, member)),
  ]);
}

async function prewarmServiceDetailCache(services: MobileAdminMerchService[]) {
  await Promise.all(services.map((service) => writeCachedValue(`${SERVICE_DETAIL_CACHE_PREFIX}${service.id}`, service)));
}

function buildStorefrontForm(snapshot: MobileAdminContentSnapshot | null): StorefrontFormState {
  const storefront = snapshot?.storefront;
  return {
    id: storefront?.id,
    slug: storefront?.slug ?? "",
    name: storefront?.name ?? "",
    nameEn: getLocalizedText(storefront?.translations, "en", "name"),
    category: storefront?.category ?? "",
    categoryEn: getLocalizedText(storefront?.translations, "en", "category"),
    description: storefront?.description ?? "",
    descriptionEn: getLocalizedText(storefront?.translations, "en", "description"),
    coverImageUrl: storefront?.coverImageUrl ?? "",
    logoImageUrl: storefront?.logoImageUrl ?? "",
    rating: storefront?.rating != null ? String(storefront.rating) : "",
    reviewsLabel: storefront?.reviewsLabel ?? "",
    reviewsLabelEn: getLocalizedText(storefront?.translations, "en", "reviews_label"),
    addressLine: storefront?.addressLine ?? "",
    addressLineEn: getLocalizedText(storefront?.translations, "en", "address_line"),
    mapUrl: storefront?.mapUrl ?? "",
    openingHours: storefront?.openingHours ?? "",
    openingHoursEn: getLocalizedText(storefront?.translations, "en", "opening_hours"),
    phone: storefront?.phone ?? "",
    messengerUrl: storefront?.messengerUrl ?? "",
    instagramUrl: storefront?.instagramUrl ?? "",
    highlightsText: storefront?.highlights.join("\n") ?? "",
    highlightsTextEn: getLocalizedArrayText(storefront?.translations, "en", "highlights"),
    isActive: storefront?.isActive ?? false,
  };
}

function formatOverviewMetric(value: number, singular: string, plural = singular) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function buildBranchOverviewSubtitle(
  strings: ReturnType<typeof useAdminStrings>,
  branch: MobileAdminContentBranchOverview,
) {
  if (!branch.storefrontId) {
    return strings.manageContentNoStorefrontForBranch;
  }

  if (branch.storefrontActive) {
    return `${branch.storefrontName ?? strings.manageContentStorefrontSectionTitle} ${strings.manageContentStorefrontVisibleForCustomers}`;
  }

  return `${branch.storefrontName ?? strings.manageContentStorefrontSectionTitle} ${strings.manageContentStorefrontCreatedButHidden}`;
}

function getLocalizedBranchName(
  locale: string,
  branchName: string,
  translations: MobileAdminContentBranchOverview["branchTranslations"],
) {
  return localizeAdminBranchName(locale === "en" ? "en" : "vi", branchName, translations) ?? branchName;
}

function buildDummyFeedPosts(strings: ReturnType<typeof useAdminStrings>): MobileAdminContentPostInput[] {
  return [
    {
      title: strings.manageContentDummyPostOneTitle,
      summary: strings.manageContentDummyPostOneSummary,
      body: strings.manageContentDummyPostOneBody,
      coverImageUrl: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=1200&q=80",
      contentType: "trend",
      status: "published",
      priority: 101,
      metadata: { source: "seed", section: "home_feed" },
      translations: buildTranslations(
        {
          title: "3 mẫu nail hợp đầu tuần",
          summary: "Gợi ý nhanh các tone dễ đi làm và đi chơi.",
          body: "Gợi ý nhanh các tone dễ đi làm và đi chơi.",
          source_platform: "Beauty feed",
        },
        {
          title: "3 nail looks for the start of the week",
          summary: "Quick shade ideas for workdays and casual plans.",
          body: "Quick shade ideas for workdays and casual plans.",
          source_platform: "Beauty feed",
        },
      ),
    },
    {
      title: strings.manageContentDummyPostTwoTitle,
      summary: strings.manageContentDummyPostTwoSummary,
      body: strings.manageContentDummyPostTwoBody,
      coverImageUrl: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80",
      contentType: "care",
      status: "published",
      priority: 102,
      metadata: { source: "seed", section: "home_feed" },
      translations: buildTranslations(
        {
          title: "Giữ màu gel bền hơn",
          summary: "Những cách chăm sóc đơn giản sau khi làm móng.",
          body: "Những cách chăm sóc đơn giản sau khi làm móng.",
          source_platform: "Care guide",
        },
        {
          title: "How to keep gel color fresh longer",
          summary: "Simple aftercare tips after your nail appointment.",
          body: "Simple aftercare tips after your nail appointment.",
          source_platform: "Care guide",
        },
      ),
    },
    {
      title: strings.manageContentDummyPostThreeTitle,
      summary: strings.manageContentDummyPostThreeSummary,
      body: strings.manageContentDummyPostThreeBody,
      coverImageUrl: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80",
      contentType: "offer_hint",
      status: "published",
      priority: 103,
      metadata: { source: "seed", section: "home_feed" },
      translations: buildTranslations(
        {
          title: "Ưu đãi thành viên trong tháng",
          summary: "Kiểm tra hạng thành viên để nhận ưu đãi phù hợp.",
          body: "Kiểm tra hạng thành viên để nhận ưu đãi phù hợp.",
          source_platform: "Offers",
        },
        {
          title: "Monthly member offers",
          summary: "Check your membership tier for matching offers.",
          body: "Check your membership tier for matching offers.",
          source_platform: "Offers",
        },
      ),
    },
  ];
}

function emptyTeamForm(): TeamFormState {
  return {
    displayName: "",
    displayNameEn: "",
    roleLabel: "",
    roleLabelEn: "",
    avatarUrl: "",
    bio: "",
    bioEn: "",
    displayOrder: "0",
    isVisible: true,
  };
}

function buildTeamForm(member: MobileAdminStorefrontTeamMember): TeamFormState {
  return {
    id: member.id,
    displayName: member.displayName,
    displayNameEn: getLocalizedText(member.translations, "en", "display_name"),
    roleLabel: member.roleLabel ?? "",
    roleLabelEn: getLocalizedText(member.translations, "en", "role_label"),
    avatarUrl: member.avatarUrl ?? "",
    bio: member.bio ?? "",
    bioEn: getLocalizedText(member.translations, "en", "bio"),
    displayOrder: String(member.displayOrder),
    isVisible: member.isVisible,
  };
}

function emptyProductForm(): ProductFormState {
  return {
    name: "",
    nameEn: "",
    subtitle: "",
    subtitleEn: "",
    priceLabel: "",
    priceLabelEn: "",
    imageUrl: "",
    productType: "",
    productTypeEn: "",
    displayOrder: "0",
    isActive: true,
    isFeatured: false,
  };
}

function buildProductForm(product: MobileAdminStorefrontProduct): ProductFormState {
  return {
    id: product.id,
    name: product.name,
    nameEn: getLocalizedText(product.translations, "en", "name"),
    subtitle: product.subtitle ?? "",
    subtitleEn: getLocalizedText(product.translations, "en", "subtitle"),
    priceLabel: product.priceLabel ?? "",
    priceLabelEn: getLocalizedText(product.translations, "en", "price_label"),
    imageUrl: product.imageUrl ?? "",
    productType: product.productType ?? "",
    productTypeEn: getLocalizedText(product.translations, "en", "product_type"),
    displayOrder: String(product.displayOrder),
    isActive: product.isActive,
    isFeatured: product.isFeatured,
  };
}

function emptyGalleryForm(): GalleryFormState {
  return {
    title: "",
    titleEn: "",
    imageUrl: "",
    kind: "",
    displayOrder: "0",
    isActive: true,
  };
}

function buildGalleryForm(item: MobileAdminStorefrontGalleryItem): GalleryFormState {
  return {
    id: item.id,
    title: item.title ?? "",
    titleEn: getLocalizedText(item.translations, "en", "title"),
    imageUrl: item.imageUrl,
    kind: item.kind ?? "",
    displayOrder: String(item.displayOrder),
    isActive: item.isActive,
  };
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  const {
    style,
    onFocus,
    ...restProps
  } = props;
  const handleFieldFocus = useAdminKeyboardFieldFocus();

  return (
    <TextInput
      {...restProps}
      onFocus={(event) => {
        handleFieldFocus(event);
        onFocus?.(event);
      }}
      placeholderTextColor="#B4A89C"
      style={[styles.input, style]}
    />
  );
}

function TextArea(props: React.ComponentProps<typeof TextInput>) {
  return <Input {...props} multiline scrollEnabled={false} style={[styles.input, styles.textarea, props.style]} textAlignVertical="top" />;
}

function Chip({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon?: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, active ? styles.chipActive : null]} onPress={onPress}>
      {icon ? <Feather name={icon} size={16} color={active ? palette.accent : palette.sub} /> : null}
      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function SearchInput({
  placeholder,
  value,
  onChangeText,
}: {
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.searchShell}>
      <Feather name="search" size={18} color={palette.sub} />
      <Input
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        style={styles.searchInput}
      />
    </View>
  );
}

function ItemThumbnail({
  uri,
  label,
}: {
  uri?: string | null;
  label: string;
}) {
  if (!uri) {
    return (
      <View style={styles.thumbPlaceholder}>
        <Text style={styles.thumbPlaceholderText}>{label.slice(0, 1).toUpperCase()}</Text>
      </View>
    );
  }

  return <CachedAppImage source={{ uri }} style={styles.thumbImage} alt={label} />;
}

function ImagePreview({
  uri,
  label,
}: {
  uri?: string | null;
  label: string;
}) {
  if (!uri) return null;

  return (
    <View style={styles.previewCard}>
      <Text style={styles.previewLabel}>{label}</Text>
      <CachedAppImage source={{ uri }} style={styles.previewImage} alt={label} />
    </View>
  );
}

function ModalFormHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.modalFormHeader}>
      <View style={styles.modalFormHeaderIcon}>
        <Feather name={icon} size={18} color={palette.accent} />
      </View>
      <View style={styles.modalFormHeaderCopy}>
        <Text style={styles.modalFormHeaderTitle}>{title}</Text>
        <Text style={styles.modalFormHeaderSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function ModalInputField({
  icon,
  label,
  ...inputProps
}: React.ComponentProps<typeof TextInput> & {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
}) {
  return (
    <View style={styles.modalInputGroup}>
      <View style={styles.modalInputLabelRow}>
        <Text style={styles.modalInputLabel}>{label}</Text>
      </View>
      <View style={styles.modalInputShell}>
        <Feather name={icon} size={16} color={palette.sub} />
        <Input {...inputProps} style={styles.modalEmbeddedInput} />
      </View>
    </View>
  );
}

function ModalTextAreaField({
  icon,
  label,
  ...inputProps
}: React.ComponentProps<typeof TextInput> & {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
}) {
  return (
    <View style={styles.modalInputGroup}>
      <View style={styles.modalInputLabelRow}>
        <Feather name={icon} size={16} color={palette.accent} />
        <Text style={styles.modalInputLabel}>{label}</Text>
      </View>
      <View style={styles.modalTextAreaShell}>
        <TextArea {...inputProps} style={styles.modalTextAreaInput} />
      </View>
    </View>
  );
}

function CountBadge({ value }: { value: string }) {
  return (
    <View style={styles.countBadge}>
      <Text style={styles.countBadgeText}>{value}</Text>
    </View>
  );
}

function SectionCard({
  title,
  subtitle,
  titleBadge,
  actionLabel,
  onActionPress,
  children,
}: {
  title: string;
  subtitle?: string;
  titleBadge?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {titleBadge ? <CountBadge value={titleBadge} /> : null}
          </View>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        {actionLabel && onActionPress ? (
          <Pressable style={styles.actionButton} onPress={onActionPress}>
            <Text style={styles.actionButtonText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function ModalShell({
  title,
  visible,
  onClose,
  children,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalScreen} edges={["bottom"]}>
        <View style={[styles.modalHeader, { paddingTop: getAdminHeaderTopPadding(insets.top) }]}>
          <Pressable style={styles.headerIconButton} onPress={onClose}>
            <Feather name="chevron-left" size={22} color={palette.text} />
          </Pressable>
          <Text style={styles.modalTitle}>{title}</Text>
          <View style={styles.headerIconButton} />
        </View>
        <KeyboardAvoidingView
          style={styles.modalBody}
          enabled={Platform.OS === "android"}
          behavior="height"
        >
          <AdminKeyboardAwareScrollView
            contentContainerStyle={[
              styles.modalContent,
              keyboardVisible ? { paddingBottom: 28 + ADMIN_KEYBOARD_ACTIVE_FIELD_CLEARANCE } : null,
            ]}
            onScrollBeginDrag={() => Keyboard.dismiss()}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            contentInsetAdjustmentBehavior="always"
            automaticallyAdjustKeyboardInsets={false}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </AdminKeyboardAwareScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export default function AdminManageContentScreen() {
  const router = useRouter();
  const strings = useAdminStrings();
  const { locale } = useAdminPreferences();
  const observer = useAdminObserverScope();
  const [activeTab, setActiveTab] = useState<ContentTab>("home");
  const [snapshot, setSnapshot] = useState<MobileAdminContentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<MobileAdminMerchService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [homeServiceQuery, setHomeServiceQuery] = useState("");
  const [exploreFeaturedQuery] = useState("");
  const [exploreRegularQuery, setExploreRegularQuery] = useState("");
  const [homeServicesExpanded, setHomeServicesExpanded] = useState(true);
  const [exploreFeaturedExpanded, setExploreFeaturedExpanded] = useState(false);

  const [merchContext, setMerchContext] = useState<MerchContext>("home");
  const [merchForm, setMerchForm] = useState<MerchFormState | null>(null);
  const [postForm, setPostForm] = useState<PostFormState | null>(null);
  const [storefrontForm, setStorefrontForm] = useState<StorefrontFormState>(buildStorefrontForm(null));
  const [storefrontEditorOpen, setStorefrontEditorOpen] = useState(false);
  const [exploreRegularEditorOpen, setExploreRegularEditorOpen] = useState(false);
  const [productsExpanded, setProductsExpanded] = useState(false);
  const [offersExpanded, setOffersExpanded] = useState(true);
  const [teamListOpen, setTeamListOpen] = useState(false);
  const [teamForm, setTeamForm] = useState<TeamFormState | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState | null>(null);
  const [galleryForm, setGalleryForm] = useState<GalleryFormState | null>(null);
  const hasFocusedOnceRef = useRef(false);
  const lastHandledContentRefreshRef = useRef(0);
  const observerReadOnly =
    observer.viewContext?.observerScope.mode === "org" ||
    (observer.viewContext?.observerScope.mode === "branch"
      && observer.viewContext.observerScope.branchId !== observer.viewContext.workingBranchId);
  const isOrgOverview = snapshot?.viewMode === "org";
  const orgOverview = snapshot?.orgOverview ?? null;
  const groupedOffers = useMemo(
    () =>
      OFFER_PACKAGE_TIERS.map((tier) => ({
        tier,
        label: getOfferPackageTierLabel(strings, tier),
        offers: (snapshot?.offers ?? [])
          .filter((offer) => getOfferPackageTier(offer.metadata) === tier)
          .sort(compareOffersByPackageOrder),
      })).filter((group) => group.offers.length > 0),
    [snapshot?.offers, strings],
  );

  const dummyFeedPosts = useMemo(() => buildDummyFeedPosts(strings), [strings]);
  const servicesById = useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services],
  );

  function guardObserverWrite(actionLabel: string) {
    if (!observerReadOnly) {
      return false;
    }

    Alert.alert(strings.manageContentObserverTitle, strings.manageContentObserverActionUnavailable.replace("{action}", actionLabel));
    return true;
  }

  const loadSnapshot = useCallback(async () => {
    if (!mobileSupabase) {
      setError(strings.manageContentMissingSupabase);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const next = await listAdminContentSnapshotForMobile(mobileSupabase, {
        includeServices: false,
        observerScope: observer.observerScope,
      });
      await prewarmContentDetailCache(next);
      setSnapshot(next);
      setStorefrontForm(buildStorefrontForm(next));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : strings.manageContentLoadFailed);
    } finally {
      setLoading(false);
    }
  }, [observer.observerScope, strings.manageContentLoadFailed, strings.manageContentMissingSupabase]);

  const loadServices = useCallback(
    async (force = false) => {
      if (!mobileSupabase) {
        setError(strings.manageContentMissingSupabase);
        return;
      }
      if (servicesLoading) return;
      
      // Check cache first if not forcing reload
      if (!force && servicesLoaded) {
        const cacheAge = Date.now() - (services.length > 0 ? Date.now() : Number.POSITIVE_INFINITY);
        if (cacheAge <= SERVICES_FRESH_MS) {
          return;
        }
      }

      setServicesLoading(true);
      try {
        // Try to load from cache first
        if (!force) {
          const cached = await hydrateCachedValue<MobileAdminMerchService[]>(SERVICES_CACHE_KEY);
          if (cached && isCacheFresh(SERVICES_CACHE_KEY, SERVICES_MAX_STALE_MS)) {
            setServices(cached.value);
            setServicesLoaded(true);
            
            // If cache is stale but still usable, refresh in background
            if (!isCacheFresh(SERVICES_CACHE_KEY, SERVICES_FRESH_MS)) {
              // Background refresh
              listAdminMerchServicesForMobile(mobileSupabase, { observerScope: observer.observerScope })
                .then((next) => {
                  setServices(next);
                  setServicesLoaded(true);
                  void writeCachedValue(SERVICES_CACHE_KEY, next);
                  void prewarmServiceDetailCache(next);
                })
                .catch(() => {
                  // Ignore background refresh errors
                });
            }
            return;
          }
        }
        
        // Load from server
        const next = await listAdminMerchServicesForMobile(mobileSupabase, { observerScope: observer.observerScope });
        setServices(next);
        setServicesLoaded(true);
        await writeCachedValue(SERVICES_CACHE_KEY, next);
        await prewarmServiceDetailCache(next);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : strings.manageContentServicesLoadFailed);
      } finally {
        setServicesLoading(false);
      }
    },
    [observer.observerScope, servicesLoaded, servicesLoading, services.length, strings.manageContentMissingSupabase, strings.manageContentServicesLoadFailed],
  );

  useEffect(() => {
    if (!observer.isReady) return;
    const timeoutId = setTimeout(() => {
      void (async () => {
        await loadSnapshot();
      })();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [loadSnapshot, observer.isReady]);

  useEffect(() => {
    if (!snapshot) return;
    const timeoutId = setTimeout(() => {
      void loadServices();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [loadServices, snapshot]);

  useEffect(() => {
    void (async () => {
      const signal = await hydrateCachedValue<{ reason: string }>(ADMIN_CONTENT_REFRESH_SIGNAL_KEY);
      lastHandledContentRefreshRef.current = signal?.updatedAt ?? 0;
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!observer.isReady) {
        return undefined;
      }

      if (!hasFocusedOnceRef.current) {
        hasFocusedOnceRef.current = true;
        return undefined;
      }

      let cancelled = false;

      void (async () => {
        const signal = await hydrateCachedValue<{ reason: string }>(ADMIN_CONTENT_REFRESH_SIGNAL_KEY);
        if (cancelled || !signal) return;
        if (signal.updatedAt <= lastHandledContentRefreshRef.current) return;
        lastHandledContentRefreshRef.current = signal.updatedAt;
        await loadSnapshot();
      })();

      return () => {
        cancelled = true;
      };
    }, [loadSnapshot, observer.isReady]),
  );

  const localizedServices = useMemo(
    () => services.map((service) => localizeAdminMerchService(locale, service)),
    [locale, services],
  );
  const lookbookServices = useMemo(
    () =>
      localizedServices
        .filter((item) => isLandingService(item))
        .sort((left, right) => left.name.localeCompare(right.name, locale)),
    [locale, localizedServices],
  );

  const regularServices = useMemo(
    () =>
      localizedServices
        .filter((item) => item.active && !item.featuredInLookbook)
        .sort((left, right) => left.name.localeCompare(right.name, locale)),
    [locale, localizedServices],
  );

  const homeServices = useMemo(
    () =>
      lookbookServices
        .filter((item) => item.featuredInHome)
        .sort((left, right) => left.displayOrderHome - right.displayOrderHome || left.name.localeCompare(right.name, locale)),
    [locale, lookbookServices],
  );

  const homeLookbookServices = useMemo(() => {
    const query = homeServiceQuery.trim().toLowerCase();
    return lookbookServices
      .filter((item) => {
        if (!query) return true;
        const haystack = `${item.name} ${item.shortDescription ?? ""} ${item.lookbookCategory ?? ""} ${item.lookbookBadge ?? ""} ${item.lookbookTone ?? ""}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((left, right) => {
        if (Number(left.featuredInHome) !== Number(right.featuredInHome)) {
          return Number(right.featuredInHome) - Number(left.featuredInHome);
        }

        if (left.displayOrderHome !== right.displayOrderHome) {
          return left.displayOrderHome - right.displayOrderHome;
        }

        return left.name.localeCompare(right.name, locale);
      });
  }, [homeServiceQuery, locale, lookbookServices]);

  const exploreServices = useMemo(
    () =>
      lookbookServices
        .filter((item) => item.featuredInExplore)
        .sort((left, right) => left.displayOrderExplore - right.displayOrderExplore || left.name.localeCompare(right.name, locale)),
    [locale, lookbookServices],
  );

  const exploreFeaturedServices = useMemo(() => {
    const query = exploreFeaturedQuery.trim().toLowerCase();
    return lookbookServices
      .filter((item) => {
        if (!query) return true;
        const haystack = `${item.name} ${item.shortDescription ?? ""} ${item.lookbookCategory ?? ""} ${item.lookbookBadge ?? ""} ${item.lookbookTone ?? ""}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((left, right) => {
        if (Number(left.featuredInExplore) !== Number(right.featuredInExplore)) {
          return Number(right.featuredInExplore) - Number(left.featuredInExplore);
        }

        if (left.displayOrderExplore !== right.displayOrderExplore) {
          return left.displayOrderExplore - right.displayOrderExplore;
        }

        return left.name.localeCompare(right.name, locale);
      });
  }, [exploreFeaturedQuery, locale, lookbookServices]);

  const exploreRegularServices = useMemo(() => {
    const query = exploreRegularQuery.trim().toLowerCase();
    return regularServices
      .filter((item) => {
        if (!query) return true;
        const haystack = `${item.name} ${item.shortDescription ?? ""} ${item.durationLabel ?? ""}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((left, right) => left.name.localeCompare(right.name, locale));
  }, [exploreRegularQuery, locale, regularServices]);

  const visibleExploreFeaturedServices = useMemo(
    () =>
      exploreFeaturedExpanded
        ? exploreFeaturedServices
        : exploreFeaturedServices.slice(0, EXPLORE_FEATURED_PREVIEW_COUNT),
    [exploreFeaturedExpanded, exploreFeaturedServices],
  );

  const visibleProducts = useMemo(() => {
    const products = snapshot?.products ?? [];
    return productsExpanded ? products : products.slice(0, EXPLORE_PRODUCTS_PREVIEW_COUNT);
  }, [productsExpanded, snapshot?.products]);

  const overviewBranches = useMemo(() => {
    const workingBranchId = observer.viewContext?.workingBranchId ?? null;
    return [...(orgOverview?.branches ?? [])].sort((left, right) => {
      const leftPriority = left.branchId === workingBranchId ? 0 : 1;
      const rightPriority = right.branchId === workingBranchId ? 0 : 1;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return getLocalizedBranchName(locale, left.branchName, left.branchTranslations).localeCompare(
        getLocalizedBranchName(locale, right.branchName, right.branchTranslations),
        locale,
      );
    });
  }, [locale, observer.viewContext?.workingBranchId, orgOverview?.branches]);
  const currentBranchDisplayName = useMemo(() => {
    const activeBranch = observer.viewContext?.branches.find((branch) => branch.id === snapshot?.branchId);
    if (activeBranch) {
      return localizeAdminBranchName(locale, activeBranch.name, activeBranch.translations) ?? activeBranch.name;
    }

    return snapshot?.branchName ?? strings.manageContentCurrentBranchSuffix;
  }, [locale, observer.viewContext?.branches, snapshot?.branchId, snapshot?.branchName, strings.manageContentCurrentBranchSuffix]);

  async function pickAndUploadImage(
    folder: "offers" | "posts" | "storefront" | "gallery" | "products",
    baseName: string,
    onSuccess: (publicUrl: string) => void,
  ) {
    if (guardObserverWrite(strings.manageContentUploadTitle)) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: true,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    setSaving(true);
    try {
      const uploaded = await uploadPickedAdminContentImage(result.assets[0], { folder, baseName }, locale);
      onSuccess(uploaded.publicUrl);
    } catch (uploadError) {
      Alert.alert(strings.manageContentUploadErrorTitle, uploadError instanceof Error ? uploadError.message : strings.manageContentUploadErrorBody);
    } finally {
      setSaving(false);
    }
  }

  async function saveMerchService() {
    if (!mobileSupabase || !merchForm) return;
    if (guardObserverWrite(strings.manageContentSaveServiceAction)) return;
    setSaving(true);
    try {
      const featuredInLookbook = merchForm.featuredInHome || merchForm.featuredInExplore;
      await updateAdminMerchServiceForMobile(mobileSupabase, {
        id: merchForm.id,
        shortDescription: merchForm.shortDescription,
        imageUrl: merchForm.imageUrl,
        durationLabel: merchForm.durationLabel,
        featuredInLookbook,
        featuredInHome: merchForm.featuredInHome,
        featuredInExplore: merchForm.featuredInExplore,
        displayOrderHome: parseNumberInput(merchForm.displayOrderHome),
        displayOrderExplore: parseNumberInput(merchForm.displayOrderExplore),
        lookbookCategory: merchForm.lookbookCategory,
        lookbookBadge: merchForm.lookbookBadge,
        lookbookTone: merchForm.lookbookTone,
        translations: buildTranslations(
          {
            name: merchForm.name,
            short_description: merchForm.shortDescription,
            duration_label: merchForm.durationLabel,
            lookbook_badge: merchForm.lookbookBadge,
            lookbook_tone: merchForm.lookbookTone,
          },
          {
            name: merchForm.nameEn,
            short_description: merchForm.shortDescriptionEn,
            duration_label: merchForm.durationLabelEn,
            lookbook_badge: merchForm.lookbookBadgeEn,
            lookbook_tone: merchForm.lookbookToneEn,
          },
        ),
        translationMeta: buildManualAwareTranslationMeta(
          services.find((item) => item.id === merchForm.id)?.translationMeta ?? null,
          {
            name: merchForm.nameEn,
            short_description: merchForm.shortDescriptionEn,
            duration_label: merchForm.durationLabelEn,
            lookbook_badge: merchForm.lookbookBadgeEn,
            lookbook_tone: merchForm.lookbookToneEn,
          },
        ),
      });
      setMerchForm(null);
      await clearCustomerFeedCache();
      await loadServices(true);
    } catch (nextError) {
      Alert.alert(strings.manageContentGenericSaveFailedTitle, nextError instanceof Error ? nextError.message : strings.offerDetailFallbackTryLater);
    } finally {
      setSaving(false);
    }
  }
  function toPostInput(form: PostFormState): MobileAdminContentPostInput {
    return {
      title: form.title.trim(),
      summary: form.summary.trim(),
      body: form.body.trim(),
      coverImageUrl: form.coverImageUrl.trim() || null,
      contentType: form.contentType,
      status: form.status,
      priority: parseNumberInput(form.priority),
      metadata: parseMetadata(form.metadataText),
      translations: buildTranslations(
        {
          title: form.title,
          summary: form.summary,
          body: form.body,
          source_platform: form.sourcePlatform ?? null,
        },
        {
          title: form.titleEn,
          summary: form.summaryEn,
          body: form.bodyEn,
        },
      ),
      translationMeta: buildManualAwareTranslationMeta(
        snapshot?.posts.find((item) => item.id === form.id)?.translationMeta ?? null,
        {
          title: form.titleEn,
          summary: form.summaryEn,
          body: form.bodyEn,
        },
      ),
    };
  }

  async function savePost() {
    if (!mobileSupabase || !postForm) return;
    if (guardObserverWrite(strings.manageContentSavePostAction)) return;
    setSaving(true);
    try {
      const payload = toPostInput(postForm);
      if (postForm.id) {
        await updateAdminContentPostForMobile(mobileSupabase, postForm.id, payload, postForm.publishedAt ?? null);
      } else {
        await createAdminContentPostForMobile(mobileSupabase, payload);
      }
      await clearCustomerFeedCache();
      setPostForm(null);
      await loadSnapshot();
    } catch (nextError) {
      Alert.alert(strings.postDetailSaveFailedTitle, nextError instanceof Error ? nextError.message : strings.offerDetailFallbackTryLater);
    } finally {
      setSaving(false);
    }
  }

  async function seedDummyPosts() {
    if (!mobileSupabase) return;
    if (guardObserverWrite(strings.manageContentSeedAction)) return;
    const client = mobileSupabase;
    setSaving(true);
    try {
      const existingTitles = new Set((snapshot?.posts ?? []).map((post) => post.title.trim().toLowerCase()));
      const missingPosts = dummyFeedPosts.filter((post) => !existingTitles.has(post.title.trim().toLowerCase()));

      if (!missingPosts.length) {
        Alert.alert(strings.manageContentSeedExistsTitle, strings.manageContentSeedExistsBody);
        return;
      }

      await Promise.all(missingPosts.map((post) => createAdminContentPostForMobile(client, post)));
      await loadSnapshot();
      Alert.alert(strings.manageContentSeedCreatedTitle, `${strings.manageContentSeedCreatedBodyPrefix} ${missingPosts.length} ${strings.manageContentSeedCreatedBodySuffix}`);
    } catch (nextError) {
      Alert.alert(strings.manageContentSeedFailedTitle, nextError instanceof Error ? nextError.message : strings.offerDetailFallbackTryLater);
    } finally {
      setSaving(false);
    }
  }

  async function saveStorefront() {
    if (!mobileSupabase) return;
    if (guardObserverWrite(strings.manageContentSaveStorefrontAction)) return;
    setSaving(true);
    try {
      const payload: MobileAdminStorefrontProfileInput & { id?: string | null } = {
        id: storefrontForm.id,
        slug: storefrontForm.slug.trim(),
        name: storefrontForm.name.trim(),
        category: storefrontForm.category.trim() || null,
        description: storefrontForm.description.trim() || null,
        coverImageUrl: storefrontForm.coverImageUrl.trim() || null,
        logoImageUrl: storefrontForm.logoImageUrl.trim() || null,
        rating: storefrontForm.rating.trim() ? Number(storefrontForm.rating) : null,
        reviewsLabel: storefrontForm.reviewsLabel.trim() || null,
        addressLine: storefrontForm.addressLine.trim() || null,
        mapUrl: storefrontForm.mapUrl.trim() || null,
        openingHours: storefrontForm.openingHours.trim() || null,
        phone: storefrontForm.phone.trim() || null,
        messengerUrl: storefrontForm.messengerUrl.trim() || null,
        instagramUrl: storefrontForm.instagramUrl.trim() || null,
        highlights: storefrontForm.highlightsText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
        isActive: storefrontForm.isActive,
        translations: buildTranslations(
          {
            name: storefrontForm.name,
            category: storefrontForm.category,
            description: storefrontForm.description,
            reviews_label: storefrontForm.reviewsLabel,
            address_line: storefrontForm.addressLine,
            opening_hours: storefrontForm.openingHours,
            highlights: storefrontForm.highlightsText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
          },
          {
            name: storefrontForm.nameEn,
            category: storefrontForm.categoryEn,
            description: storefrontForm.descriptionEn,
            reviews_label: storefrontForm.reviewsLabelEn,
            address_line: storefrontForm.addressLineEn,
            opening_hours: storefrontForm.openingHoursEn,
            highlights: storefrontForm.highlightsTextEn.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
          },
        ),
        translationMeta: buildManualAwareTranslationMeta(snapshot?.storefront?.translationMeta ?? null, {
          name: storefrontForm.nameEn,
          category: storefrontForm.categoryEn,
          description: storefrontForm.descriptionEn,
          reviews_label: storefrontForm.reviewsLabelEn,
          address_line: storefrontForm.addressLineEn,
          opening_hours: storefrontForm.openingHoursEn,
          highlights: storefrontForm.highlightsTextEn.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
        }),
      };
      await upsertAdminStorefrontProfileForMobile(mobileSupabase, payload);
      await clearCustomerFeedCache();
      await loadSnapshot();
      Alert.alert(strings.manageContentStorefrontSavedTitle, strings.manageContentStorefrontSavedBody);
    } catch (nextError) {
      Alert.alert(strings.manageContentStorefrontSaveFailedTitle, nextError instanceof Error ? nextError.message : strings.offerDetailFallbackTryLater);
    } finally {
      setSaving(false);
    }
  }

  async function deleteStorefront() {
    if (!mobileSupabase || !snapshot?.storefront?.id) return;

    await deleteAdminStorefrontProfileForMobile(mobileSupabase, snapshot.storefront.id);
    setStorefrontEditorOpen(false);
    setStorefrontForm(buildStorefrontForm(null));
  }

  function confirmDeleteStorefront() {
    return confirmTask(
      strings.manageContentDeleteStorefrontTitle,
      strings.manageContentDeleteStorefrontBody,
      deleteStorefront,
    );
  }

  async function saveTeamMember() {
    if (!mobileSupabase || !teamForm || !snapshot?.storefront?.id) return;
    if (guardObserverWrite(strings.manageContentSaveTeamAction)) return;
    setSaving(true);
    try {
      const payload: MobileAdminStorefrontTeamMemberInput = {
        displayName: teamForm.displayName.trim(),
        roleLabel: teamForm.roleLabel.trim() || null,
        avatarUrl: teamForm.avatarUrl.trim() || null,
        bio: teamForm.bio.trim() || null,
        displayOrder: parseNumberInput(teamForm.displayOrder),
        isVisible: teamForm.isVisible,
        translations: buildTranslations(
          {
            display_name: teamForm.displayName,
            role_label: teamForm.roleLabel,
            bio: teamForm.bio,
          },
          {
            display_name: teamForm.displayNameEn,
            role_label: teamForm.roleLabelEn,
            bio: teamForm.bioEn,
          },
        ),
        translationMeta: buildManualAwareTranslationMeta(
          snapshot?.team.find((item) => item.id === teamForm.id)?.translationMeta ?? null,
          {
            display_name: teamForm.displayNameEn,
            role_label: teamForm.roleLabelEn,
            bio: teamForm.bioEn,
          },
        ),
      };
      if (teamForm.id) {
        await updateAdminStorefrontTeamMemberForMobile(mobileSupabase, teamForm.id, payload);
      } else {
        await createAdminStorefrontTeamMemberForMobile(mobileSupabase, snapshot.storefront.id, payload);
      }
      await clearCustomerFeedCache();
      setTeamForm(null);
      await loadSnapshot();
    } catch (nextError) {
      Alert.alert(strings.teamMemberDetailSaveFailedTitle, nextError instanceof Error ? nextError.message : strings.offerDetailFallbackTryLater);
    } finally {
      setSaving(false);
    }
  }

  async function saveProduct() {
    if (!mobileSupabase || !productForm || !snapshot?.storefront?.id) return;
    if (guardObserverWrite(strings.manageContentSaveProductAction)) return;
    setSaving(true);
    try {
      const payload: MobileAdminStorefrontProductInput = {
        name: productForm.name.trim(),
        subtitle: productForm.subtitle.trim() || null,
        priceLabel: productForm.priceLabel.trim() || null,
        imageUrl: productForm.imageUrl.trim() || null,
        productType: productForm.productType.trim() || null,
        displayOrder: parseNumberInput(productForm.displayOrder),
        isActive: productForm.isActive,
        isFeatured: productForm.isFeatured,
        translations: buildTranslations(
          {
            name: productForm.name,
            subtitle: productForm.subtitle,
            price_label: productForm.priceLabel,
            product_type: productForm.productType,
          },
          {
            name: productForm.nameEn,
            subtitle: productForm.subtitleEn,
            price_label: productForm.priceLabelEn,
            product_type: productForm.productTypeEn,
          },
        ),
        translationMeta: buildManualAwareTranslationMeta(
          snapshot?.products.find((item) => item.id === productForm.id)?.translationMeta ?? null,
          {
            name: productForm.nameEn,
            subtitle: productForm.subtitleEn,
            price_label: productForm.priceLabelEn,
            product_type: productForm.productTypeEn,
          },
        ),
      };
      if (productForm.id) {
        await updateAdminStorefrontProductForMobile(mobileSupabase, productForm.id, payload);
      } else {
        await createAdminStorefrontProductForMobile(mobileSupabase, snapshot.storefront.id, payload);
      }
      await clearCustomerFeedCache();
      setProductForm(null);
      await loadSnapshot();
    } catch (nextError) {
      Alert.alert(strings.manageContentGenericSaveFailedTitle, nextError instanceof Error ? nextError.message : strings.offerDetailFallbackTryLater);
    } finally {
      setSaving(false);
    }
  }

  async function saveGalleryItem() {
    if (!mobileSupabase || !galleryForm || !snapshot?.storefront?.id) return;
    if (guardObserverWrite(strings.manageContentSaveGalleryAction)) return;
    setSaving(true);
    try {
      const payload: MobileAdminStorefrontGalleryItemInput = {
        title: galleryForm.title.trim() || null,
        imageUrl: galleryForm.imageUrl.trim(),
        kind: galleryForm.kind.trim() || null,
        displayOrder: parseNumberInput(galleryForm.displayOrder),
        isActive: galleryForm.isActive,
        translations: buildTranslations(
          {
            title: galleryForm.title,
          },
          {
            title: galleryForm.titleEn,
          },
        ),
        translationMeta: buildManualAwareTranslationMeta(
          snapshot?.gallery.find((item) => item.id === galleryForm.id)?.translationMeta ?? null,
          { title: galleryForm.titleEn },
        ),
      };
      if (galleryForm.id) {
        await updateAdminStorefrontGalleryItemForMobile(mobileSupabase, galleryForm.id, payload);
      } else {
        await createAdminStorefrontGalleryItemForMobile(mobileSupabase, snapshot.storefront.id, payload);
      }
      await clearCustomerFeedCache();
      setGalleryForm(null);
      await loadSnapshot();
    } catch (nextError) {
      Alert.alert(strings.manageContentGenericSaveFailedTitle, nextError instanceof Error ? nextError.message : strings.offerDetailFallbackTryLater);
    } finally {
      setSaving(false);
    }
  }

  async function confirmTask(title: string, message: string, task: () => Promise<void>) {
    if (guardObserverWrite(title)) return;
    Alert.alert(title, message, [
      { text: strings.manageContentCancel, style: "cancel" },
      {
        text: strings.manageContentConfirm,
        style: "destructive",
        onPress: () => {
          void (async () => {
            setSaving(true);
            try {
              await task();
              await loadSnapshot();
            } catch (nextError) {
              Alert.alert(strings.manageContentCannotPerformTitle, nextError instanceof Error ? nextError.message : strings.offerDetailFallbackTryLater);
            } finally {
              setSaving(false);
            }
          })();
        },
      },
    ]);
  }

  if (loading && !snapshot) {
    return (
      <ManageScreenShell
        title={strings.manageContentLoadingScreenTitle}
        subtitle={strings.manageContentLoadingScreenSubtitle}
        currentKey="content"
        group="setup"
        activeTab="booking"
        showTabs={false}
        showBottomDock={true}
        showBackButton={false}
        observerReadOnly={observerReadOnly}
        observerReadOnlyMessage={strings.manageContentObserverMessage}
      >
        <View style={styles.stateCard}>
          <ActivityIndicator color={palette.accent} />
          <Text style={styles.stateTitle}>{strings.manageContentLoadingStateBody}</Text>
        </View>
      </ManageScreenShell>
    );
  }

  return (
    <ManageScreenShell
      title={strings.manageContentScreenTitle}
      subtitle={strings.manageContentScreenSubtitle}
      currentKey="content"
      group="setup"
      activeTab="booking"
      showTabs={false}
      showBottomDock={true}
      showBackButton={false}
      onRefresh={() => void Promise.all([loadSnapshot(), loadServices(true)])}
      refreshing={loading || servicesLoading}
      observerReadOnly={observerReadOnly}
      observerReadOnlyMessage={strings.manageContentObserverMessage}
    >
      <View style={styles.heroRow}>
        <Chip active={activeTab === "home"} icon="home" label={strings.manageContentHomeTab} onPress={() => setActiveTab("home")} />
        <Chip active={activeTab === "explore"} icon="compass" label={strings.manageContentExploreTab} onPress={() => setActiveTab("explore")} />
      </View>

      {servicesLoading ? (
        <View style={styles.inlineNotice}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.inlineNoticeText}>{strings.manageContentLoadingServices}</Text>
        </View>
      ) : null}

      {saving ? (
        <View style={styles.inlineNotice}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.inlineNoticeText}>{strings.manageContentSavingState}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.inlineNotice}>
          <Feather name="alert-circle" size={14} color={palette.danger} />
          <Text style={styles.inlineNoticeText}>{error}</Text>
        </View>
      ) : null}

      {activeTab === "home" ? (
        <>
          <SectionCard
            title={strings.manageContentLookbookTitle}
            titleBadge={`${homeServices.length}/${lookbookServices.length}`}
            subtitle={strings.manageContentLookbookSubtitle}
            actionLabel={homeServicesExpanded ? strings.manageContentCollapseChevron : strings.manageContentExpandChevron}
            onActionPress={() => setHomeServicesExpanded((current) => !current)}
          >
            {homeServicesExpanded ? (
              <>
            <Text style={styles.helperText}>{strings.manageContentFeaturedServicesSubtitle}</Text>
            <SearchInput placeholder={strings.manageContentLookbookSearchPlaceholder} value={homeServiceQuery} onChangeText={setHomeServiceQuery} />
            <View style={styles.listColumn}>
              {homeLookbookServices.map((service) => (
                <Pressable
                  key={service.id}
                  style={styles.rowCard}
                  onPress={() =>
                    void router.push({
                      pathname: "/(admin)/manage-content-service/[serviceId]",
                      params: {
                        serviceId: service.id,
                        context: "home",
                        backHref: "/(admin)/manage-content",
                      },
                    })
                  }
                >
                  <ItemThumbnail uri={service.imageUrl} label={service.name} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{service.name}</Text>
                    <Text style={styles.rowSubtitle}>
                      {`${strings.manageContentHomeTab} · ${service.featuredInHome ? strings.manageContentStatusOn : strings.manageContentStatusOff} · ${strings.manageContentOfferOrderPrefix} ${service.displayOrderHome} · ${service.lookbookBadge || service.lookbookCategory || strings.manageContentLookbookFallback}`}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#A7988A" />
                </Pressable>
              ))}
            </View>
              </>
            ) : null}
          </SectionCard>

          <SectionCard
            title={strings.manageContentOffersTitle}
            titleBadge={String(snapshot?.offers.length ?? 0)}
            subtitle={strings.manageContentOffersSubtitle}
            actionLabel={offersExpanded ? strings.manageContentCollapseChevron : strings.manageContentExpandChevron}
            onActionPress={() => setOffersExpanded((current) => !current)}
          >
            {offersExpanded ? (
              <View style={styles.listColumn}>
                {groupedOffers.length ? groupedOffers.map((group) => (
                  <View key={group.tier} style={styles.offerTierGroup}>
                    <View style={styles.offerTierHeader}>
                      <View style={styles.offerTierCopy}>
                        <Text style={styles.offerTierTitle}>{group.label}</Text>
                        <Text style={styles.offerTierSubtitle}>{`${group.offers.length} ${strings.manageContentOfferTierCountSuffix}`}</Text>
                      </View>
                      <Pressable
                        style={styles.offerTierAction}
                        onPress={() =>
                          void router.push({
                            pathname: "/(admin)/manage-content-offer/[offerId]",
                            params: { offerId: "new", tier: group.tier, backHref: "/(admin)/manage-content" },
                          })
                        }
                      >
                        <Feather name="plus" size={14} color={palette.accent} />
                        <Text style={styles.offerTierActionText}>{strings.manageContentAddShort}</Text>
                      </Pressable>
                    </View>

                    <View style={styles.listColumn}>
                      {group.offers.map((offer) => (
                        <View key={offer.id} style={styles.rowCard}>
                          <ItemThumbnail uri={offer.imageUrl} label={offer.title} />
                          <Pressable style={styles.rowCopy} onPress={() => void router.push(`/(admin)/manage-content-offer/${offer.id}` as never)}>
                            <Text style={styles.rowTitle}>{offer.title}</Text>
                            <Text style={styles.rowSubtitle}>
                              {`${offer.isActive ? strings.manageContentOfferActive : strings.manageContentOfferInactive} · ${offer.badge || group.label} · ${strings.manageContentOfferOrderPrefix} ${offer.packageOrder}`}
                            </Text>
                          </Pressable>
                          <Pressable style={styles.iconButton} onPress={() => void confirmTask(strings.manageContentArchiveOfferTitle, strings.manageContentArchiveOfferBody, async () => {
                            if (!mobileSupabase) return;
                            await archiveAdminOfferForMobile(mobileSupabase, offer.id);
                          })}>
                            <Feather name="archive" size={16} color={palette.accent} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </View>
                )) : (
                  <>
                    <Pressable style={styles.secondaryButton} onPress={() => void router.push("/(admin)/manage-content-offer/new" as never)}>
                      <Text style={styles.secondaryButtonText}>{strings.manageContentAddOffer}</Text>
                    </Pressable>
                    <Text style={styles.emptyText}>{strings.manageContentNoOffers}</Text>
                  </>
                )}
              </View>
            ) : null}
          </SectionCard>

          <SectionCard
            title={strings.manageContentFeedTitle}
            titleBadge={String(snapshot?.posts.length ?? 0)}
            subtitle={strings.manageContentFeedSubtitle}
            actionLabel={strings.manageContentAddPost}
            onActionPress={() => void router.push("/(admin)/manage-content-post/new" as never)}
          >
            <View style={styles.inlineButtons}>
              <Pressable style={styles.secondaryButton} onPress={() => void seedDummyPosts()}>
                <Text style={styles.secondaryButtonText}>{strings.manageContentSeedPostsButton}</Text>
              </Pressable>
            </View>
            <View style={styles.listColumn}>
              {(snapshot?.posts ?? []).map((post) => (
                <View key={post.id} style={styles.rowCard}>
                  <ItemThumbnail uri={post.coverImageUrl} label={post.title} />
                  <Pressable style={styles.rowCopy} onPress={() => void router.push(`/(admin)/manage-content-post/${post.id}` as never)}>
                    <Text style={styles.rowTitle}>{post.title}</Text>
                    <Text style={styles.rowSubtitle}>{`${post.status} · ${post.contentType} · ${strings.manageContentSourcePrefix} ${post.sourcePlatform}`}</Text>
                  </Pressable>
                  <Pressable style={styles.iconButton} onPress={() => void confirmTask(strings.manageContentArchivePostTitle, strings.manageContentArchivePostBody, async () => {
                    if (!mobileSupabase) return;
                    await archiveAdminContentPostForMobile(mobileSupabase, post.id);
                  })}>
                    <Feather name="archive" size={16} color={palette.accent} />
                  </Pressable>
                </View>
              ))}
            </View>
          </SectionCard>
        </>
      ) : (
        <>
          {isOrgOverview ? (
            <>
              <SectionCard
                title={strings.manageContentOrgOverviewTitle}
                titleBadge={String(orgOverview?.totalBranches ?? 0)}
                subtitle={strings.manageContentOrgOverviewSubtitle}
              >
                <View style={styles.inlineNotice}>
                  <Feather name="eye" size={16} color={palette.accent} />
                  <Text style={styles.inlineNoticeText}>
                    {strings.manageContentOrgOverviewNotice}
                  </Text>
                </View>

                <View style={styles.exploreBottomGrid}>
                  <View style={styles.exploreSummaryCard}>
                    <View style={[styles.exploreSummaryIcon, { backgroundColor: "#FFF2D9" }]}>
                      <Feather name="grid" size={22} color="#F2A300" />
                    </View>
                    <View style={styles.exploreSummaryCopy}>
                      <View style={styles.exploreSummaryTitleRow}>
                        <Text style={styles.exploreSummaryTitle}>{strings.manageContentBranchesWithStorefront}</Text>
                        <CountBadge value={`${orgOverview?.activeStorefrontCount ?? 0}/${orgOverview?.totalBranches ?? 0}`} />
                      </View>
                      <Text style={styles.exploreSummarySubtitle}>
                        {`${formatOverviewMetric(orgOverview?.storefrontCount ?? 0, strings.manageContentStorefrontUnit)} ${strings.manageContentOrgOverviewStorefrontSummaryPrefix} ${formatOverviewMetric(orgOverview?.activeStorefrontCount ?? 0, strings.manageContentBranchUnit)} ${strings.manageContentStorefrontShowing.toLowerCase()}.`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.exploreSummaryCard}>
                    <View style={[styles.exploreSummaryIcon, { backgroundColor: "#EAF2FF" }]}>
                      <Feather name="package" size={22} color="#2B7FFF" />
                    </View>
                    <View style={styles.exploreSummaryCopy}>
                      <View style={styles.exploreSummaryTitleRow}>
                        <Text style={styles.exploreSummaryTitle}>{strings.manageContentServicesScoped}</Text>
                        <CountBadge value={String(orgOverview?.serviceCount ?? 0)} />
                      </View>
                      <Text style={styles.exploreSummarySubtitle}>
                        {`${formatOverviewMetric(orgOverview?.featuredServiceCount ?? 0, strings.manageContentFeaturedServiceUnit)} ${strings.manageContentAndConnector} ${formatOverviewMetric(orgOverview?.sharedServiceCount ?? 0, strings.manageContentSharedServiceUnit)} ${strings.manageContentOrgOverviewServicesSummarySuffix}`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.exploreSummaryCard}>
                    <View style={[styles.exploreSummaryIcon, { backgroundColor: "#FDEEEE" }]}>
                      <Feather name="shopping-bag" size={22} color={palette.danger} />
                    </View>
                    <View style={styles.exploreSummaryCopy}>
                      <View style={styles.exploreSummaryTitleRow}>
                        <Text style={styles.exploreSummaryTitle}>{strings.manageContentProductsAndGallery}</Text>
                        <CountBadge value={String(orgOverview?.productCount ?? 0)} />
                      </View>
                      <Text style={styles.exploreSummarySubtitle}>
                        {`${formatOverviewMetric(orgOverview?.featuredProductCount ?? 0, strings.manageContentFeaturedProductUnit)} ${strings.manageContentAndConnector} ${formatOverviewMetric(orgOverview?.galleryCount ?? 0, strings.manageContentGalleryUnit)} ${strings.manageContentOrgOverviewProductsSummarySuffix}`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.exploreSummaryCard}>
                    <View style={[styles.exploreSummaryIcon, { backgroundColor: "#EEF8F1" }]}>
                      <Feather name="users" size={22} color="#2C9B5F" />
                    </View>
                    <View style={styles.exploreSummaryCopy}>
                      <View style={styles.exploreSummaryTitleRow}>
                        <Text style={styles.exploreSummaryTitle}>{strings.manageContentVisibleTeam}</Text>
                        <CountBadge value={String(orgOverview?.visibleTeamCount ?? 0)} />
                      </View>
                      <Text style={styles.exploreSummarySubtitle}>
                        {`${strings.manageContentOrgOverviewSharedSummaryPrefix} ${formatOverviewMetric(orgOverview?.visibleTeamCount ?? 0, strings.manageContentVisibleTeam.toLowerCase())}, ${strings.manageContentOrgOverviewSharedSummaryMiddle} ${formatOverviewMetric(orgOverview?.offerCount ?? 0, strings.manageContentOfferUnit)} ${strings.manageContentAndConnector} ${formatOverviewMetric(orgOverview?.postCount ?? 0, strings.manageContentPostUnit)} ${strings.manageContentOrgOverviewSharedSummarySuffix}`}
                      </Text>
                    </View>
                  </View>
                </View>
              </SectionCard>

              <SectionCard
                title={strings.manageContentPerBranchTitle}
                titleBadge={String(overviewBranches.length)}
                subtitle={strings.manageContentPerBranchSubtitle}
              >
                <View style={styles.listColumn}>
                  {overviewBranches.map((branch) => {
                    const isWorkingBranch = branch.branchId === observer.viewContext?.workingBranchId;
                    return (
                      <View key={branch.branchId} style={styles.branchCard}>
                        <View style={styles.branchHeader}>
                          <View style={styles.exploreSummaryIcon}>
                            <Feather name={branch.storefrontActive ? "home" : "alert-circle"} size={22} color={branch.storefrontActive ? palette.accent : palette.danger} />
                          </View>
                          <View style={styles.branchCopy}>
                            <Text style={styles.branchTitle}>
                              {getLocalizedBranchName(locale, branch.branchName, branch.branchTranslations)}
                              {isWorkingBranch ? ` ${strings.manageContentMainBranchSuffix}` : ""}
                            </Text>
                            <Text style={styles.branchSubtitle}>{buildBranchOverviewSubtitle(strings, branch)}</Text>
                          </View>
                        </View>
                        <View style={styles.branchMetricsRow}>
                          <View style={styles.branchMetricPill}>
                            <Text style={styles.branchMetricValue}>{branch.serviceCount}</Text>
                            <Text style={styles.branchMetricLabel}>{strings.manageContentMetricsServices}</Text>
                          </View>
                          <View style={styles.branchMetricPill}>
                            <Text style={styles.branchMetricValue}>{branch.productCount}</Text>
                            <Text style={styles.branchMetricLabel}>{strings.manageContentMetricsProducts}</Text>
                          </View>
                          <View style={styles.branchMetricPill}>
                            <Text style={styles.branchMetricValue}>{branch.galleryCount}</Text>
                            <Text style={styles.branchMetricLabel}>{strings.manageContentMetricsGallery}</Text>
                          </View>
                          <View style={styles.branchMetricPill}>
                            <Text style={styles.branchMetricValue}>{branch.visibleTeamCount}</Text>
                            <Text style={styles.branchMetricLabel}>{strings.manageContentMetricsTeam}</Text>
                          </View>
                        </View>
                        <Text style={styles.helperText}>
                          {`${formatOverviewMetric(branch.featuredServiceCount, strings.manageContentFeaturedServiceUnit)} ${strings.manageContentAndConnector} ${formatOverviewMetric(branch.featuredProductCount, strings.manageContentFeaturedProductUnit)} ${strings.manageContentPerBranchSummarySuffix}`}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </SectionCard>
            </>
          ) : (
            <>
              <SectionCard title={strings.manageContentStorefrontSectionTitle} subtitle={`${strings.manageContentEditingForPrefix} ${currentBranchDisplayName}.`} actionLabel={snapshot?.storefront?.isActive ? strings.manageContentStorefrontShowing : strings.manageContentStorefrontEnableDisplay} onActionPress={snapshot?.storefront ? () => {
            if (!mobileSupabase) return;
            void (async () => {
              setSaving(true);
              try {
                await setActiveAdminStorefrontProfileForMobile(mobileSupabase, snapshot.storefront!.id);
                await loadSnapshot();
              } catch (nextError) {
                Alert.alert(strings.manageContentStorefrontActivateFailedTitle, nextError instanceof Error ? nextError.message : strings.offerDetailFallbackTryLater);
              } finally {
                setSaving(false);
              }
            })();
          } : undefined}>
            <View style={styles.storefrontInfoPanel}>
              <View style={styles.storefrontInfoRow}>
                <View style={styles.storefrontInfoCell}>
                  <View style={styles.storefrontLabelRow}>
                    <Feather name="shopping-bag" size={18} color={palette.accent} />
                    <Text style={styles.storefrontInfoLabel}>{strings.manageContentAccountLabel}</Text>
                  </View>
                  <Text style={styles.storefrontInfoValue}>{storefrontForm.slug || "cham-beauty"}</Text>
                </View>
                <View style={styles.storefrontDivider} />
                <View style={styles.storefrontInfoCell}>
                  <View style={styles.storefrontLabelRow}>
                    <Feather name="tag" size={18} color={palette.accent} />
                    <Text style={styles.storefrontInfoLabel}>{strings.manageContentDisplayNameLabel}</Text>
                  </View>
                  <Text style={styles.storefrontInfoValue}>{storefrontForm.name || strings.manageContentDefaultStorefrontName}</Text>
                </View>
              </View>
              <Pressable style={styles.storefrontWideRow} onPress={() => setStorefrontEditorOpen(true)}>
                <View style={styles.storefrontLabelRow}>
                  <Feather name="file-text" size={18} color={palette.accent} />
                  <Text style={styles.storefrontInfoLabel}>{strings.manageContentDescriptionLabel}</Text>
                </View>
                <View style={styles.storefrontWideContent}>
                  <Text numberOfLines={2} style={styles.storefrontWideValue}>{storefrontForm.description || strings.manageContentDefaultStorefrontDescription}</Text>
                  <Feather name="chevron-right" size={18} color="#A7988A" />
                </View>
              </Pressable>
              <View style={styles.storefrontInfoRow}>
                <View style={styles.storefrontInfoCell}>
                  <View style={styles.storefrontLabelRow}>
                    <Feather name="link" size={18} color={palette.accent} />
                    <Text style={styles.storefrontInfoLabel}>{strings.manageContentCoverLinkLabel}</Text>
                  </View>
                  <Text numberOfLines={1} style={styles.storefrontLinkValue}>{storefrontForm.coverImageUrl || "i.ibb.co/..."}</Text>
                </View>
                <View style={styles.storefrontDivider} />
                <View style={styles.storefrontInfoCell}>
                  <View style={styles.storefrontLabelRow}>
                    <Feather name="link" size={18} color={palette.accent} />
                    <Text style={styles.storefrontInfoLabel}>{strings.manageContentLogoLinkLabel}</Text>
                  </View>
                  <Text numberOfLines={1} style={styles.storefrontLinkValue}>{storefrontForm.logoImageUrl || "i.ibb.co/..."}</Text>
                </View>
              </View>
            </View>

            <View style={styles.storefrontActionRow}>
              <Pressable style={styles.storefrontGhostButton} onPress={() => void pickAndUploadImage("storefront", storefrontForm.name || "storefront-cover", (publicUrl) => setStorefrontForm((prev) => ({ ...prev, coverImageUrl: publicUrl })))}><Feather name="upload-cloud" size={18} color={palette.accent} /><Text style={styles.storefrontGhostText}>{strings.manageContentUploadCover}</Text></Pressable>
              <Pressable style={styles.storefrontGhostButton} onPress={() => void pickAndUploadImage("storefront", storefrontForm.name || "storefront-logo", (publicUrl) => setStorefrontForm((prev) => ({ ...prev, logoImageUrl: publicUrl })))}><Feather name="upload-cloud" size={18} color={palette.accent} /><Text style={styles.storefrontGhostText}>{strings.manageContentUploadLogo}</Text></Pressable>
              {snapshot?.storefront?.id ? (
                <Pressable
                  style={[styles.storefrontGhostButton, styles.storefrontDangerButton]}
                  onPress={() => void confirmDeleteStorefront()}
                >
                  <Feather name="trash-2" size={18} color={palette.danger} />
                  <Text style={[styles.storefrontGhostText, styles.storefrontDangerText]}>{strings.manageContentDeleteShort}</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.storefrontSaveButton} onPress={() => setStorefrontEditorOpen(true)}><Text style={styles.storefrontSaveText}>{strings.manageContentEditStorefront}</Text></Pressable>
            </View>

            <View style={styles.storefrontPreviewRow}>
              <View style={styles.storefrontPreviewCard}>
                <Text style={styles.previewLabel}>{strings.manageContentCurrentCover}</Text>
                {storefrontForm.coverImageUrl ? <CachedAppImage source={{ uri: storefrontForm.coverImageUrl }} style={styles.storefrontCoverPreview} alt="cover" /> : null}
              </View>
              <View style={styles.storefrontPreviewCard}>
                <Text style={styles.previewLabel}>{strings.manageContentCurrentLogo}</Text>
                {storefrontForm.logoImageUrl ? <CachedAppImage source={{ uri: storefrontForm.logoImageUrl }} style={styles.storefrontLogoPreview} alt="logo" /> : null}
              </View>
            </View>

            <View style={styles.storefrontFactsCard}>
              {[
                { icon: "star", label: strings.manageContentRatingLabel, value: storefrontForm.rating || strings.manageContentDefaultRating },
                { icon: "message-circle", label: strings.manageContentReviewsLabel, value: storefrontForm.reviewsLabel || strings.manageContentDefaultReviews },
                { icon: "map-pin", label: strings.manageContentAddressLabel, value: storefrontForm.addressLine || strings.manageContentMissingAddress },
                { icon: "link", label: strings.manageContentGoogleMapsLabel, value: storefrontForm.mapUrl || strings.manageContentMissingMap },
                { icon: "clock", label: strings.manageContentOpeningHoursLabel, value: storefrontForm.openingHours || strings.manageContentMissingOpeningHours },
              ].map((item, index, source) => (
                <View key={item.label} style={[styles.storefrontFactRow, index < source.length - 1 ? styles.storefrontFactBorder : null]}>
                  <View style={styles.storefrontFactCopy}>
                    <View style={styles.storefrontLabelRow}>
                      <Feather name={item.icon as React.ComponentProps<typeof Feather>["name"]} size={18} color={palette.text} />
                      <Text style={styles.storefrontFactLabel}>{item.label}</Text>
                    </View>
                    <Text numberOfLines={1} style={styles.storefrontFactValue}>{item.value}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#A7988A" />
                </View>
              ))}
            </View>
          </SectionCard>

          <SectionCard title={strings.manageContentFeaturedServicesTitle} titleBadge={String(exploreServices.length)} subtitle={strings.manageContentFeaturedServicesSubtitle} actionLabel={exploreFeaturedServices.length > EXPLORE_FEATURED_PREVIEW_COUNT ? (exploreFeaturedExpanded ? strings.manageContentCollapse : strings.manageContentExpand) : undefined} onActionPress={exploreFeaturedServices.length > EXPLORE_FEATURED_PREVIEW_COUNT ? () => setExploreFeaturedExpanded((current) => !current) : undefined}>
            <View style={styles.exploreFeatureShell}>
              {visibleExploreFeaturedServices.map((service, index) => (
                <Pressable key={service.id} style={[styles.exploreFeatureRow, index < visibleExploreFeaturedServices.length - 1 ? styles.exploreFeatureBorder : null]} onPress={() => {
                  setMerchContext("explore");
                  setMerchForm(buildMerchForm(servicesById.get(service.id) ?? service));
                }}>
                  <ItemThumbnail uri={service.imageUrl} label={service.name} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{service.name}</Text>
                    <Text numberOfLines={2} style={styles.rowSubtitle}>{`${strings.manageContentExploreTab} · ${strings.manageContentOfferOrderPrefix} ${service.displayOrderExplore} · ${service.lookbookBadge || strings.manageContentLookbookFallback}`}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#A7988A" />
                </Pressable>
              ))}
              {!exploreFeaturedExpanded && exploreFeaturedServices.length > EXPLORE_FEATURED_PREVIEW_COUNT ? (
                <Pressable style={styles.exploreFooterAction} onPress={() => setExploreFeaturedExpanded(true)}>
                  <Text style={styles.exploreFooterActionText}>{`${strings.manageContentViewAllPrefix} (${exploreServices.length})`}</Text>
                  <Feather name="chevron-right" size={18} color={palette.accent} />
                </Pressable>
              ) : null}
            </View>
          </SectionCard>

          <SectionCard title={strings.manageContentProductsTitle} titleBadge={String(snapshot?.products.length ?? 0)} subtitle={strings.manageContentProductsSubtitle} actionLabel={strings.manageContentAddImage} onActionPress={() => setProductForm(emptyProductForm())}>
            <View style={styles.listColumn}>
              {visibleProducts.map((product) => (
                <View key={product.id} style={styles.rowCard}>
                  <ItemThumbnail uri={product.imageUrl} label={product.name} />
                  <Pressable style={styles.rowCopy} onPress={() => setProductForm(buildProductForm(product))}>
                    <Text style={styles.rowTitle}>{product.name}</Text>
                    <Text numberOfLines={2} style={styles.rowSubtitle}>{`${product.productType || strings.manageContentNoProductType} · ${product.priceLabel || strings.manageContentNoPrice} · ${product.isActive ? strings.manageContentVisibleNow : strings.manageContentHiddenNow}`}</Text>
                  </Pressable>
                  <Pressable style={styles.iconButton} onPress={() => void confirmTask(strings.manageContentDeleteProductTitle, strings.manageContentDeleteProductBody, async () => {
                    if (!mobileSupabase) return;
                    await deleteAdminStorefrontProductForMobile(mobileSupabase, product.id);
                  })}>
                    <Feather name="trash-2" size={16} color={palette.danger} />
                  </Pressable>
                </View>
              ))}
              {(snapshot?.products.length ?? 0) > EXPLORE_PRODUCTS_PREVIEW_COUNT ? (
                <Pressable style={styles.exploreFooterAction} onPress={() => setProductsExpanded((current) => !current)}>
                  <Text style={styles.exploreFooterActionText}>{productsExpanded ? strings.manageContentCollapse : `${strings.manageContentViewAllPrefix} (${snapshot?.products.length ?? 0})`}</Text>
                  <Feather name={productsExpanded ? "chevron-up" : "chevron-right"} size={18} color={palette.accent} />
                </Pressable>
              ) : null}
            </View>
          </SectionCard>

          <SectionCard title={strings.manageContentGalleryTitle} titleBadge={String(snapshot?.gallery.length ?? 0)} actionLabel={strings.manageContentAddImage} onActionPress={() => setGalleryForm(emptyGalleryForm())}>
            <View style={styles.galleryStrip}>
              {(snapshot?.gallery ?? []).slice(0, 6).map((item) => (
                <Pressable key={item.id} style={styles.galleryThumbWrap} onPress={() => setGalleryForm(buildGalleryForm(item))}>
                  {item.imageUrl ? <CachedAppImage source={{ uri: item.imageUrl }} style={styles.galleryThumb} alt={item.title || "gallery"} /> : null}
                </Pressable>
              ))}
            </View>
          </SectionCard>

          <View style={styles.exploreBottomGrid}>
            <Pressable style={styles.exploreSummaryCard} onPress={() => void router.push("/(admin)/manage-content-explore-services" as never)}>
              <View style={[styles.exploreSummaryIcon, { backgroundColor: "#FFF2D9" }]}>
                <Feather name="package" size={22} color="#F2A300" />
              </View>
              <View style={styles.exploreSummaryCopy}>
                <View style={styles.exploreSummaryTitleRow}>
                  <Text style={styles.exploreSummaryTitle}>{strings.manageContentRegularServicesCardTitle}</Text>
                  <CountBadge value={String(exploreRegularServices.length)} />
                </View>
                <Text style={styles.exploreSummarySubtitle}>{strings.manageContentRegularServicesCardSubtitle}</Text>
              </View>
              <Feather name="chevron-right" size={20} color="#A7988A" />
            </Pressable>

            <Pressable style={styles.exploreSummaryCard} onPress={() => void router.push("/(admin)/manage-content-team" as never)}>
              <View style={[styles.exploreSummaryIcon, { backgroundColor: "#EAF2FF" }]}>
                <Feather name="users" size={22} color="#2B7FFF" />
              </View>
              <View style={styles.exploreSummaryCopy}>
                <View style={styles.exploreSummaryTitleRow}>
                  <Text style={styles.exploreSummaryTitle}>{strings.manageContentTeamTitle}</Text>
                  <CountBadge value={String(snapshot?.team.length ?? 0)} />
                </View>
                <Text style={styles.exploreSummarySubtitle}>{strings.manageContentTeamCardSubtitle}</Text>
              </View>
              <Feather name="chevron-right" size={20} color="#A7988A" />
            </Pressable>
          </View>
            </>
          )}
        </>
      )}

      <ModalShell title={strings.manageContentStorefrontEditorTitle} visible={storefrontEditorOpen} onClose={() => setStorefrontEditorOpen(false)}>
        <View style={styles.formColumn}>
          <ModalFormHeader icon="home" title={strings.manageContentStorefrontEditorTitle} subtitle={strings.manageContentStorefrontEditorSubtitle} />
          <ModalInputField icon="at-sign" label={strings.manageContentStorefrontSlugPlaceholder} placeholder={strings.manageContentDefaultStorefrontSlug} value={storefrontForm.slug} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, slug: value }))} />
          <ModalInputField icon="home" label={strings.manageContentStorefrontNamePlaceholder} placeholder={strings.manageContentStorefrontNameDefault} value={storefrontForm.name} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, name: value }))} />
          <ModalInputField icon="home" label="Storefront name (EN)" placeholder="CHAM BEAUTY" value={storefrontForm.nameEn} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, nameEn: value }))} />
          <ModalInputField icon="grid" label={strings.manageContentStorefrontCategoryLabel} placeholder={strings.manageContentStorefrontCategoryPlaceholder} value={storefrontForm.category} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, category: value }))} />
          <ModalInputField icon="grid" label="Category (EN)" placeholder="Nail & Beauty" value={storefrontForm.categoryEn} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, categoryEn: value }))} />
          <ModalTextAreaField icon="file-text" label={strings.manageContentDescriptionLabel} placeholder={strings.manageContentStorefrontDescriptionPlaceholder} value={storefrontForm.description} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, description: value }))} />
          <ModalTextAreaField icon="file-text" label="Description (EN)" placeholder="English storefront description" value={storefrontForm.descriptionEn} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, descriptionEn: value }))} />
          <ModalInputField icon="image" label={strings.manageContentStorefrontCoverUrlLabel} placeholder={strings.postDetailImagePlaceholder} value={storefrontForm.coverImageUrl} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, coverImageUrl: value }))} />
          <ModalInputField icon="aperture" label={strings.manageContentStorefrontLogoUrlLabel} placeholder={strings.postDetailImagePlaceholder} value={storefrontForm.logoImageUrl} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, logoImageUrl: value }))} />
          <View style={styles.inlineButtons}>
            <Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage("storefront", storefrontForm.name || "storefront-cover", (publicUrl) => setStorefrontForm((prev) => ({ ...prev, coverImageUrl: publicUrl })))}><Text style={styles.secondaryButtonText}>{strings.manageContentUploadCover}</Text></Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage("storefront", storefrontForm.name || "storefront-logo", (publicUrl) => setStorefrontForm((prev) => ({ ...prev, logoImageUrl: publicUrl })))}><Text style={styles.secondaryButtonText}>{strings.manageContentUploadLogo}</Text></Pressable>
          </View>
          <ImagePreview uri={storefrontForm.coverImageUrl} label={strings.manageContentStorefrontCurrentCoverLabel} />
          <ImagePreview uri={storefrontForm.logoImageUrl} label={strings.manageContentStorefrontCurrentLogoLabel} />
          <ModalInputField icon="star" label={strings.manageContentStorefrontRatingLabel} placeholder={strings.manageContentDefaultRating} value={storefrontForm.rating} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, rating: value }))} keyboardType="decimal-pad" />
          <ModalInputField icon="message-circle" label={strings.manageContentStorefrontReviewsTextLabel} placeholder={strings.manageContentDefaultReviews} value={storefrontForm.reviewsLabel} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, reviewsLabel: value }))} />
          <ModalInputField icon="message-circle" label="Reviews text (EN)" placeholder="128 reviews" value={storefrontForm.reviewsLabelEn} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, reviewsLabelEn: value }))} />
          <ModalInputField icon="map-pin" label={strings.manageContentAddressLabel} placeholder={strings.manageContentStorefrontAddressPlaceholder} value={storefrontForm.addressLine} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, addressLine: value }))} />
          <ModalInputField icon="map-pin" label="Address (EN)" placeholder="38A, Alley 358/40 Bui Xuong Trach, Hanoi" value={storefrontForm.addressLineEn} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, addressLineEn: value }))} />
          <ModalInputField icon="navigation" label={strings.manageContentStorefrontMapUrlLabel} placeholder="https://maps..." value={storefrontForm.mapUrl} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, mapUrl: value }))} />
          <ModalInputField icon="clock" label={strings.manageContentStorefrontHoursLabel} placeholder="09:00 - 21:00" value={storefrontForm.openingHours} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, openingHours: value }))} />
          <ModalInputField icon="clock" label="Opening hours (EN)" placeholder="Open: 09:00 - 21:00 (Every day)" value={storefrontForm.openingHoursEn} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, openingHoursEn: value }))} />
          <ModalInputField icon="phone" label={strings.manageContentStorefrontPhoneLabel} placeholder="09xxxxxxxx" value={storefrontForm.phone} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, phone: value }))} />
          <ModalInputField icon="message-square" label={strings.manageContentStorefrontMessengerUrlLabel} placeholder="https://m.me/..." value={storefrontForm.messengerUrl} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, messengerUrl: value }))} />
          <ModalInputField icon="instagram" label={strings.manageContentStorefrontInstagramUrlLabel} placeholder="https://instagram.com/..." value={storefrontForm.instagramUrl} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, instagramUrl: value }))} />
          <ModalTextAreaField icon="award" label={strings.manageContentStorefrontHighlightsLabel} placeholder={strings.manageContentStorefrontHighlightsPlaceholder} value={storefrontForm.highlightsText} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, highlightsText: value }))} />
          <ModalTextAreaField icon="award" label="Highlights (EN, one per line)" placeholder="Trusted studio" value={storefrontForm.highlightsTextEn} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, highlightsTextEn: value }))} />
          <View style={styles.inlineButtons}>
            <Chip active={storefrontForm.isActive} label={storefrontForm.isActive ? strings.manageContentVisibleNow : strings.manageContentHiddenNow} onPress={() => setStorefrontForm((prev) => ({ ...prev, isActive: !prev.isActive }))} />
            {snapshot?.storefront?.id ? (
              <Pressable
                style={[styles.secondaryButton, styles.modalDeleteButton]}
                onPress={() => void confirmDeleteStorefront()}
              >
                <Text style={[styles.secondaryButtonText, styles.modalDeleteButtonText]}>{strings.manageContentStorefrontDeleteButton}</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.primaryButton} onPress={() => void saveStorefront()}><Text style={styles.primaryButtonText}>{strings.manageContentSaveStorefrontButton}</Text></Pressable>
          </View>
        </View>
      </ModalShell>

      <ModalShell title={strings.manageContentRegularServicesTitle} visible={exploreRegularEditorOpen} onClose={() => setExploreRegularEditorOpen(false)}>
        <View style={styles.formColumn}>
          <Input placeholder={strings.manageContentRegularServicesSearchPlaceholder} value={exploreRegularQuery} onChangeText={setExploreRegularQuery} />
          <View style={styles.listColumn}>
            {exploreRegularServices.map((service) => (
              <Pressable
                key={service.id}
                style={styles.rowCard}
                onPress={() => {
                  setExploreRegularEditorOpen(false);
                  setMerchContext("explore");
                  setMerchForm(buildMerchForm(servicesById.get(service.id) ?? service));
                }}
              >
                <ItemThumbnail uri={service.imageUrl} label={service.name} />
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{service.name}</Text>
                  <Text numberOfLines={2} style={styles.rowSubtitle}>{`${service.priceLabel} · ${service.durationLabel || strings.manageContentNoDuration}`}</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#A7988A" />
              </Pressable>
            ))}
          </View>
        </View>
      </ModalShell>

      <ModalShell title={strings.manageContentTeamTitle} visible={teamListOpen} onClose={() => setTeamListOpen(false)}>
        <View style={styles.formColumn}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              setTeamListOpen(false);
              setTeamForm(emptyTeamForm());
            }}
          >
            <Text style={styles.primaryButtonText}>{strings.teamListAddButton}</Text>
          </Pressable>
          <View style={styles.listColumn}>
            {(snapshot?.team ?? []).map((member) => (
              <Pressable
                key={member.id}
                style={styles.rowCard}
                onPress={() => {
                  setTeamListOpen(false);
                  setTeamForm(buildTeamForm(member));
                }}
              >
                <ItemThumbnail uri={member.avatarUrl} label={member.displayName} />
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{member.displayName}</Text>
                  <Text numberOfLines={2} style={styles.rowSubtitle}>
                    {`${member.roleLabel || strings.teamListNoRole} · ${strings.teamListDisplayOrderPrefix} ${member.displayOrder} · ${member.isVisible ? strings.teamMemberDetailVisible : strings.teamMemberDetailHidden}`}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="#A7988A" />
              </Pressable>
            ))}
            {(snapshot?.team.length ?? 0) === 0 ? <Text style={styles.helperText}>{strings.manageContentTeamEmptyHelp}</Text> : null}
          </View>
        </View>
      </ModalShell>


      <ModalShell title={merchContext === "home" ? strings.serviceDetailHomeTitle : strings.serviceDetailExploreTitle} visible={Boolean(merchForm)} onClose={() => setMerchForm(null)}>
        {merchForm ? (
          <View style={styles.formColumn}>
            <View style={styles.detailPanel}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailEyebrow}>{strings.manageContentServiceTemplateEyebrow}</Text>
                <Text style={styles.detailTitle}>{merchForm.name}</Text>
              </View>

              <View style={styles.detailFieldBlock}>
                <Text style={styles.detailFieldLabel}>English service name</Text>
                <Input
                  placeholder="e.g. Korean Clean Nude"
                  value={merchForm.nameEn}
                  onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, nameEn: value } : prev))}
                />
              </View>

              <View style={styles.detailImageCard}>
                <Text style={styles.previewLabel}>{strings.manageContentCurrentServiceImage}</Text>
                {merchForm.imageUrl ? (
                  <CachedAppImage source={{ uri: merchForm.imageUrl }} style={styles.detailHeroImage} alt={merchForm.name} />
                ) : (
                  <View style={styles.detailHeroPlaceholder}>
                    <Text style={styles.thumbPlaceholderText}>{merchForm.name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}
              </View>

              <View style={styles.detailFieldBlock}>
                <Text style={styles.detailFieldLabel}>{strings.manageContentServiceDescriptionLabel}</Text>
                <TextArea
                  placeholder={strings.manageContentDefaultServiceDescription}
                  value={merchForm.shortDescription}
                  onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, shortDescription: value } : prev))}
                  style={styles.detailTextarea}
                />
                <TextArea
                  placeholder="English description shown to customers"
                  value={merchForm.shortDescriptionEn}
                  onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, shortDescriptionEn: value } : prev))}
                  style={styles.detailTextarea}
                />
              </View>

              <View style={styles.detailFieldBlock}>
                <View style={styles.detailLabelRow}>
                  <Feather name="link-2" size={18} color={palette.accent} />
                  <Text style={styles.detailFieldLabel}>{strings.manageContentServiceImageUrlLabel}</Text>
                </View>
                <View style={styles.linkInputShell}>
                  <Feather name="link-2" size={18} color={palette.sub} />
                  <Input
                    placeholder="https://..."
                    value={merchForm.imageUrl}
                    onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, imageUrl: value } : prev))}
                    style={styles.linkInput}
                  />
                  <Feather name="copy" size={18} color={palette.sub} />
                </View>
              </View>

              <View style={styles.detailSplitRow}>
                <View style={styles.detailSplitItem}>
                  <Pressable
                    style={styles.uploadButton}
                    onPress={() =>
                      void pickAndUploadImage("storefront", merchForm.name, (publicUrl) =>
                        setMerchForm((prev) => (prev ? { ...prev, imageUrl: publicUrl } : prev)),
                      )
                    }
                  >
                    <Feather name="upload" size={18} color={palette.text} />
                    <Text style={styles.uploadButtonText}>{strings.manageContentUploadDifferentImage}</Text>
                  </Pressable>
                </View>
                <View style={styles.detailSplitItem}>
                  <Text style={styles.detailFieldLabel}>{strings.serviceDetailDurationLabel}</Text>
                  <View style={styles.durationShell}>
                    <Feather name="clock" size={18} color={palette.sub} />
                  <Input
                    placeholder={strings.manageContentDefaultServiceDuration}
                    value={merchForm.durationLabel}
                    onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, durationLabel: value } : prev))}
                    style={styles.durationInput}
                  />
                    <Feather name="chevron-down" size={18} color={palette.sub} />
                  </View>
                  <Input
                    placeholder="English duration label, e.g. 90 min"
                    value={merchForm.durationLabelEn}
                    onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, durationLabelEn: value } : prev))}
                  />
                </View>
              </View>

              <View style={styles.detailFieldBlock}>
                <Text style={styles.detailFieldLabel}>{strings.manageContentServiceFeaturedAtLabel}</Text>
                <View style={styles.inlineButtons}>
                  <Chip
                    active={merchForm.featuredInHome}
                    icon="home"
                    label={strings.serviceDetailFeaturedHome}
                    onPress={() =>
                      setMerchForm((prev) =>
                        prev ? syncMerchLookbookState({ ...prev, featuredInHome: !prev.featuredInHome }) : prev,
                      )
                    }
                  />
                  <Chip
                    active={merchForm.featuredInExplore}
                    icon="compass"
                    label={strings.serviceDetailFeaturedExplore}
                    onPress={() =>
                      setMerchForm((prev) =>
                        prev ? syncMerchLookbookState({ ...prev, featuredInExplore: !prev.featuredInExplore }) : prev,
                      )
                    }
                  />
                </View>
              </View>

              <View style={styles.merchNotice}>
                <Feather name="alert-circle" size={18} color={palette.accent} />
                <Text style={styles.merchNoticeText}>
                  {strings.manageContentServiceVisibilityNotice}
                </Text>
              </View>

              <View style={styles.detailSplitRow}>
                <View style={styles.detailSplitItem}>
                  <View style={styles.detailLabelRow}>
                    <Feather name="home" size={18} color={palette.accent} />
                    <Text style={styles.detailFieldLabel}>{strings.manageContentDisplayOrderHomeLabel}</Text>
                  </View>
                  <Input
                    placeholder="0"
                    keyboardType="number-pad"
                    value={merchForm.displayOrderHome}
                    onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, displayOrderHome: value } : prev))}
                  />
                </View>
                <View style={styles.detailSplitItem}>
                  <View style={styles.detailLabelRow}>
                    <Feather name="compass" size={18} color={palette.accent} />
                    <Text style={styles.detailFieldLabel}>{strings.manageContentDisplayOrderExploreLabel}</Text>
                  </View>
                  <Input
                    placeholder="0"
                    keyboardType="number-pad"
                    value={merchForm.displayOrderExplore}
                    onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, displayOrderExplore: value } : prev))}
                  />
                </View>
              </View>

              <View style={styles.detailFieldBlock}>
                <Text style={styles.detailFieldLabel}>{strings.manageContentLookbookMetadataLabel}</Text>
                <View style={styles.formColumn}>
                  <View style={styles.metadataInputShell}>
                    <Feather name="tag" size={18} color={palette.accent} />
                    <Input
                      placeholder={strings.manageContentLookbookCategoryPlaceholder}
                      value={merchForm.lookbookCategory}
                      onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, lookbookCategory: value } : prev))}
                      style={styles.metadataInput}
                    />
                  </View>
                  <View style={styles.metadataInputShell}>
                    <Feather name="bookmark" size={18} color={palette.accent} />
                    <Input
                      placeholder={strings.manageContentLookbookBadgePlaceholder}
                      value={merchForm.lookbookBadge}
                      onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, lookbookBadge: value } : prev))}
                      style={styles.metadataInput}
                    />
                  </View>
                  <View style={styles.metadataInputShell}>
                    <Feather name="bookmark" size={18} color={palette.accent} />
                    <Input
                      placeholder="English badge, e.g. Featured"
                      value={merchForm.lookbookBadgeEn}
                      onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, lookbookBadgeEn: value } : prev))}
                      style={styles.metadataInput}
                    />
                  </View>
                  <View style={styles.metadataInputShell}>
                    <Feather name="star" size={18} color={palette.accent} />
                    <Input
                      placeholder={strings.manageContentLookbookTonePlaceholder}
                      value={merchForm.lookbookTone}
                      onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, lookbookTone: value } : prev))}
                      style={styles.metadataInput}
                    />
                  </View>
                  <View style={styles.metadataInputShell}>
                    <Feather name="star" size={18} color={palette.accent} />
                    <Input
                      placeholder="English tone, e.g. Luxury"
                      value={merchForm.lookbookToneEn}
                      onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, lookbookToneEn: value } : prev))}
                      style={styles.metadataInput}
                    />
                  </View>
                </View>
              </View>

              <Pressable style={styles.detailSaveButton} onPress={() => void saveMerchService()}>
                <Feather name="save" size={18} color="#FFFFFF" />
                <Text style={styles.detailSaveButtonText}>{strings.serviceDetailSaveButton}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ModalShell>

      <ModalShell title={postForm?.id ? strings.manageContentEditPostTitle : strings.manageContentAddPostTitle} visible={Boolean(postForm)} onClose={() => setPostForm(null)}>
        {postForm ? <View style={styles.formColumn}><ImagePreview uri={postForm.coverImageUrl} label={strings.manageContentCurrentPostImage} /><Input placeholder={strings.postDetailTitleLabel} value={postForm.title} onChangeText={(value) => setPostForm((prev) => (prev ? { ...prev, title: value } : prev))} /><TextArea placeholder={strings.postDetailSummaryLabel} value={postForm.summary} onChangeText={(value) => setPostForm((prev) => (prev ? { ...prev, summary: value } : prev))} /><TextArea placeholder={strings.postDetailBodyLabel} value={postForm.body} onChangeText={(value) => setPostForm((prev) => (prev ? { ...prev, body: value } : prev))} /><Input placeholder={strings.postDetailImageLabel} value={postForm.coverImageUrl} onChangeText={(value) => setPostForm((prev) => (prev ? { ...prev, coverImageUrl: value } : prev))} /><Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage("posts", postForm.title || "post", (publicUrl) => setPostForm((prev) => (prev ? { ...prev, coverImageUrl: publicUrl } : prev)))}><Text style={styles.secondaryButtonText}>{strings.postDetailImageUploadButton}</Text></Pressable><Input placeholder={strings.postDetailPriorityLabel} keyboardType="number-pad" value={postForm.priority} onChangeText={(value) => setPostForm((prev) => (prev ? { ...prev, priority: value } : prev))} /><View style={styles.inlineButtons}>{(["trend", "care", "news", "offer_hint"] as const).map((item) => <Chip key={item} active={postForm.contentType === item} label={getPostContentTypeLabel(strings, item)} onPress={() => setPostForm((prev) => (prev ? { ...prev, contentType: item } : prev))} />)}</View><View style={styles.inlineButtons}>{(["draft", "approved", "published", "archived"] as const).map((item) => <Chip key={item} active={postForm.status === item} label={getPostStatusLabel(strings, item)} onPress={() => setPostForm((prev) => (prev ? { ...prev, status: item } : prev))} />)}</View>{postForm.id ? <Text style={styles.rowSubtitle}>{`${strings.postDetailSourceLabel}: ${getPostSourceLabel(strings, postForm.sourcePlatform)}${postForm.sourceMessageId ? ` (${postForm.sourceMessageId})` : ""}`}</Text> : null}<TextArea placeholder={strings.postDetailMetadataLabel} value={postForm.metadataText} onChangeText={(value) => setPostForm((prev) => (prev ? { ...prev, metadataText: value } : prev))} /><Pressable style={styles.primaryButton} onPress={() => void savePost()}><Text style={styles.primaryButtonText}>{strings.postDetailSaveButton}</Text></Pressable></View> : null}
      </ModalShell>

      <ModalShell title={teamForm?.id ? strings.manageContentEditTeamTitle : strings.manageContentAddTeamTitle} visible={Boolean(teamForm)} onClose={() => setTeamForm(null)}>
        {teamForm ? <View style={styles.formColumn}><ImagePreview uri={teamForm.avatarUrl} label={strings.manageContentCurrentAvatar} /><Input placeholder={strings.teamMemberDetailDisplayNameLabel} value={teamForm.displayName} onChangeText={(value) => setTeamForm((prev) => (prev ? { ...prev, displayName: value } : prev))} /><Input placeholder="Display name (EN)" value={teamForm.displayNameEn} onChangeText={(value) => setTeamForm((prev) => (prev ? { ...prev, displayNameEn: value } : prev))} /><Input placeholder={strings.manageContentTeamDisplayRolePlaceholder} value={teamForm.roleLabel} onChangeText={(value) => setTeamForm((prev) => (prev ? { ...prev, roleLabel: value } : prev))} /><Input placeholder="Role label (EN)" value={teamForm.roleLabelEn} onChangeText={(value) => setTeamForm((prev) => (prev ? { ...prev, roleLabelEn: value } : prev))} /><Input placeholder={strings.teamMemberDetailAvatarLabel} value={teamForm.avatarUrl} onChangeText={(value) => setTeamForm((prev) => (prev ? { ...prev, avatarUrl: value } : prev))} /><Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage("storefront", teamForm.displayName || "team-member", (publicUrl) => setTeamForm((prev) => (prev ? { ...prev, avatarUrl: publicUrl } : prev)))}><Text style={styles.secondaryButtonText}>{strings.manageContentUploadAvatar}</Text></Pressable><TextArea placeholder={strings.teamMemberDetailBioLabel} value={teamForm.bio} onChangeText={(value) => setTeamForm((prev) => (prev ? { ...prev, bio: value } : prev))} /><TextArea placeholder="Bio (EN)" value={teamForm.bioEn} onChangeText={(value) => setTeamForm((prev) => (prev ? { ...prev, bioEn: value } : prev))} /><Input placeholder={strings.teamMemberDetailDisplayOrderLabel} keyboardType="number-pad" value={teamForm.displayOrder} onChangeText={(value) => setTeamForm((prev) => (prev ? { ...prev, displayOrder: value } : prev))} /><Chip active={teamForm.isVisible} label={teamForm.isVisible ? strings.teamMemberDetailVisible : strings.teamMemberDetailHidden} onPress={() => setTeamForm((prev) => (prev ? { ...prev, isVisible: !prev.isVisible } : prev))} /><Pressable style={styles.primaryButton} onPress={() => void saveTeamMember()}><Text style={styles.primaryButtonText}>{strings.teamMemberDetailSaveButton}</Text></Pressable></View> : null}
      </ModalShell>

      <ModalShell title={productForm?.id ? strings.manageContentEditProductTitle : strings.manageContentAddProductTitle} visible={Boolean(productForm)} onClose={() => setProductForm(null)}>
        {productForm ? <View style={styles.formColumn}><ModalFormHeader icon="shopping-bag" title={productForm.id ? strings.manageContentEditProductTitle : strings.manageContentAddProductTitle} subtitle={strings.manageContentProductEditorSubtitle} /><ImagePreview uri={productForm.imageUrl} label={strings.manageContentCurrentProductImage} /><ModalInputField icon="shopping-bag" label={strings.manageContentProductNameLabel} placeholder={strings.manageContentProductNamePlaceholder} value={productForm.name} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, name: value } : prev))} /><ModalInputField icon="shopping-bag" label="Product name (EN)" placeholder="Premium Gel Polish" value={productForm.nameEn} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, nameEn: value } : prev))} /><ModalInputField icon="align-left" label={strings.manageContentProductSubtitleLabel} placeholder={strings.manageContentProductSubtitlePlaceholder} value={productForm.subtitle} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, subtitle: value } : prev))} /><ModalInputField icon="align-left" label="Subtitle (EN)" placeholder="Long-lasting salon finish" value={productForm.subtitleEn} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, subtitleEn: value } : prev))} /><ModalInputField icon="tag" label={strings.manageContentProductPriceLabel} placeholder={strings.manageContentProductPricePlaceholder} value={productForm.priceLabel} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, priceLabel: value } : prev))} /><ModalInputField icon="tag" label="Price label (EN)" placeholder="200,000 VND" value={productForm.priceLabelEn} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, priceLabelEn: value } : prev))} /><ModalInputField icon="image" label={strings.manageContentProductImageUrlLabel} placeholder={strings.postDetailImagePlaceholder} value={productForm.imageUrl} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, imageUrl: value } : prev))} /><Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage("products", productForm.name || "product", (publicUrl) => setProductForm((prev) => (prev ? { ...prev, imageUrl: publicUrl } : prev)))}><Text style={styles.secondaryButtonText}>{strings.serviceDetailUploadButton}</Text></Pressable><ModalInputField icon="layers" label={strings.manageContentProductTypeLabel} placeholder={strings.manageContentProductTypePlaceholder} value={productForm.productType} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, productType: value } : prev))} /><ModalInputField icon="layers" label="Product type (EN)" placeholder="Care" value={productForm.productTypeEn} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, productTypeEn: value } : prev))} /><ModalInputField icon="list" label={strings.manageContentProductDisplayOrderLabel} placeholder={strings.serviceDetailDisplayOrderPlaceholder} keyboardType="number-pad" value={productForm.displayOrder} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, displayOrder: value } : prev))} /><View style={styles.inlineButtons}><Chip active={productForm.isActive} label={productForm.isActive ? strings.manageContentProductActive : strings.manageContentProductInactive} onPress={() => setProductForm((prev) => (prev ? { ...prev, isActive: !prev.isActive } : prev))} /><Chip active={productForm.isFeatured} label={productForm.isFeatured ? strings.manageContentProductFeatured : strings.manageContentProductRegular} onPress={() => setProductForm((prev) => (prev ? { ...prev, isFeatured: !prev.isFeatured } : prev))} /></View><Pressable style={styles.primaryButton} onPress={() => void saveProduct()}><Text style={styles.primaryButtonText}>{strings.manageContentSaveProductAction}</Text></Pressable></View> : null}
      </ModalShell>

      <ModalShell title={galleryForm?.id ? strings.manageContentEditGalleryTitle : strings.manageContentAddGalleryTitle} visible={Boolean(galleryForm)} onClose={() => setGalleryForm(null)}>
        {galleryForm ? <View style={styles.formColumn}><ModalFormHeader icon="image" title={galleryForm.id ? strings.manageContentEditGalleryTitle : strings.manageContentAddGalleryTitle} subtitle={strings.manageContentGalleryEditorSubtitle} /><ImagePreview uri={galleryForm.imageUrl} label={strings.manageContentCurrentGalleryImage} /><ModalInputField icon="type" label={strings.manageContentGalleryTitleLabel} placeholder={strings.manageContentGalleryTitlePlaceholder} value={galleryForm.title} onChangeText={(value) => setGalleryForm((prev) => (prev ? { ...prev, title: value } : prev))} /><ModalInputField icon="type" label="Gallery title (EN)" placeholder="Salon space" value={galleryForm.titleEn} onChangeText={(value) => setGalleryForm((prev) => (prev ? { ...prev, titleEn: value } : prev))} /><ModalInputField icon="image" label={strings.manageContentGalleryImageUrlLabel} placeholder={strings.postDetailImagePlaceholder} value={galleryForm.imageUrl} onChangeText={(value) => setGalleryForm((prev) => (prev ? { ...prev, imageUrl: value } : prev))} /><Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage("gallery", galleryForm.title || "gallery", (publicUrl) => setGalleryForm((prev) => (prev ? { ...prev, imageUrl: publicUrl } : prev)))}><Text style={styles.secondaryButtonText}>{strings.serviceDetailUploadButton}</Text></Pressable><ModalInputField icon="grid" label={strings.manageContentGalleryKindLabel} placeholder={strings.manageContentGalleryKindPlaceholder} value={galleryForm.kind} onChangeText={(value) => setGalleryForm((prev) => (prev ? { ...prev, kind: value } : prev))} /><ModalInputField icon="list" label={strings.manageContentGalleryDisplayOrderLabel} placeholder={strings.serviceDetailDisplayOrderPlaceholder} keyboardType="number-pad" value={galleryForm.displayOrder} onChangeText={(value) => setGalleryForm((prev) => (prev ? { ...prev, displayOrder: value } : prev))} /><Chip active={galleryForm.isActive} label={galleryForm.isActive ? strings.manageContentVisibleNow : strings.manageContentHiddenNow} onPress={() => setGalleryForm((prev) => (prev ? { ...prev, isActive: !prev.isActive } : prev))} /><Pressable style={styles.primaryButton} onPress={() => void saveGalleryItem()}><Text style={styles.primaryButtonText}>{strings.manageContentSaveGalleryButton}</Text></Pressable></View> : null}
      </ModalShell>
    </ManageScreenShell>
  );
}

const styles = StyleSheet.create({
  modalFormHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  modalFormHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFF4E7",
    alignItems: "center",
    justifyContent: "center",
  },
  modalFormHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  modalFormHeaderTitle: {
    color: palette.text,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  modalFormHeaderSubtitle: {
    color: palette.sub,
    fontSize: 12,
    lineHeight: 18,
  },
  modalInputGroup: {
    gap: 8,
  },
  modalInputLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 2,
  },
  modalInputLabel: {
    color: palette.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  modalInputShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    minHeight: 52,
  },
  modalEmbeddedInput: {
    flex: 1,
    minHeight: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  modalTextAreaShell: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalTextAreaInput: {
    minHeight: 104,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginTop: -2,
    marginBottom: 2,
  },
  exploreStack: {
    gap: 16,
  },
  branchCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 16,
    shadowColor: "#2A1E14",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  branchHeader: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  branchCopy: { flex: 1, gap: 4 },
  branchTitle: { fontSize: 17, lineHeight: 24, fontWeight: "800", color: palette.text },
  branchSubtitle: { fontSize: 14, lineHeight: 22, color: palette.sub },
  branchMetricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  branchMetricPill: {
    minWidth: 88,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFCF9",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  branchMetricValue: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    color: palette.text,
  },
  branchMetricLabel: {
    fontSize: 12,
    lineHeight: 17,
    color: palette.sub,
  },
  chip: {
    minHeight: 44,
    minWidth: 132,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  chipActive: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
  chipText: { fontSize: 13, fontWeight: "700", color: palette.sub },
  chipTextActive: { color: palette.accent, fontWeight: "800" },
  inlineNotice: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: palette.mutedSoft, borderWidth: 1, borderColor: palette.border },
  inlineNoticeText: { flex: 1, color: palette.sub, fontSize: 12, lineHeight: 17 },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
    shadowColor: "#2A1E14",
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  sectionHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  sectionCopy: { flex: 1, gap: 4 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  sectionTitle: { fontSize: 19, lineHeight: 26, fontWeight: "800", color: palette.text },
  sectionSubtitle: { fontSize: 13, lineHeight: 20, color: palette.sub },
  countBadge: {
    minHeight: 24,
    borderRadius: 12,
    paddingHorizontal: 8,
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: "#E7D6C1",
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "800",
    color: palette.accent,
  },
  actionButton: { minHeight: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: palette.accentSoft, justifyContent: "center", alignItems: "center" },
  actionButtonText: { fontSize: 12, fontWeight: "800", color: palette.accent },
  listColumn: { gap: 12 },
  offerTierGroup: { gap: 12 },
  offerTierHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  offerTierCopy: { flex: 1, gap: 2 },
  offerTierTitle: { fontSize: 14, lineHeight: 20, fontWeight: "800", color: palette.text },
  offerTierSubtitle: { fontSize: 12, lineHeight: 17, color: palette.sub },
  offerTierAction: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E7D6C1",
    backgroundColor: palette.accentSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  offerTierActionText: { fontSize: 12, fontWeight: "800", color: palette.accent },
  rowCard: { borderRadius: 20, borderWidth: 1, borderColor: palette.border, backgroundColor: "#FFFCF9", paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "flex-start", gap: 14 },
  thumbPlaceholder: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: palette.accentSoft, borderWidth: 1, borderColor: "#E7D6C1", overflow: "hidden" },
  thumbPlaceholderText: { fontSize: 18, fontWeight: "800", color: palette.accent },
  thumbImage: { width: 58, height: 58, borderRadius: 18, backgroundColor: "#F4ECE2" },
  rowCopy: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { fontSize: 15, lineHeight: 21, fontWeight: "800", color: palette.text },
  rowSubtitle: { flexShrink: 1, fontSize: 12, lineHeight: 18, color: palette.sub },
  emptyText: { fontSize: 13, lineHeight: 19, color: palette.sub },
  storefrontInfoPanel: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFCF9",
    overflow: "hidden",
  },
  storefrontInfoRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  storefrontInfoCell: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  storefrontDivider: {
    width: 1,
    backgroundColor: palette.border,
  },
  storefrontLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  storefrontInfoLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.sub,
  },
  storefrontInfoValue: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: palette.text,
  },
  storefrontWideRow: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  storefrontWideContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  storefrontWideValue: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: palette.text,
  },
  storefrontLinkValue: {
    fontSize: 13,
    lineHeight: 20,
    color: palette.text,
  },
  storefrontActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  storefrontGhostButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFDFB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  storefrontGhostText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "800",
  },
  storefrontDangerButton: {
    borderColor: "#F1CFC7",
    backgroundColor: "#FFF7F5",
  },
  storefrontDangerText: {
    color: palette.danger,
  },
  storefrontSaveButton: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  storefrontSaveText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  storefrontPreviewRow: {
    flexDirection: "row",
    gap: 12,
  },
  storefrontPreviewCard: {
    flex: 1,
    gap: 8,
  },
  storefrontCoverPreview: {
    width: "100%",
    aspectRatio: 16 / 8,
    borderRadius: 18,
    backgroundColor: "#F4ECE2",
  },
  storefrontLogoPreview: {
    width: "100%",
    aspectRatio: 1.45,
    borderRadius: 18,
    backgroundColor: "#F4ECE2",
  },
  storefrontFactsCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  storefrontFactRow: {
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  storefrontFactBorder: {
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  storefrontFactCopy: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  storefrontFactLabel: {
    width: 86,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: palette.text,
  },
  storefrontFactValue: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: palette.text,
  },
  exploreFeatureShell: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFCF9",
    overflow: "hidden",
  },
  exploreFeatureRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  exploreFeatureBorder: {
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  exploreFooterAction: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  exploreFooterActionText: {
    fontSize: 14,
    fontWeight: "800",
    color: palette.accent,
  },
  galleryStrip: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  galleryThumbWrap: {
    width: 92,
    height: 92,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#F4ECE2",
  },
  galleryThumb: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F4ECE2",
  },
  exploreBottomGrid: {
    flexDirection: "column",
    gap: 12,
  },
  exploreSummaryCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    shadowColor: "#2A1E14",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  exploreSummaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  exploreSummaryCopy: {
    flex: 1,
    gap: 6,
  },
  exploreSummaryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  exploreSummaryTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: palette.text,
  },
  exploreSummarySubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: palette.sub,
  },
  iconButton: { width: 34, height: 34, borderRadius: 17, alignSelf: "center", alignItems: "center", justifyContent: "center", backgroundColor: "#FFF6F2", borderWidth: 1, borderColor: "#F3DFD7" },
  stateCard: { borderRadius: 18, paddingVertical: 20, paddingHorizontal: 16, alignItems: "center", gap: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  stateTitle: { color: palette.sub, fontSize: 13, lineHeight: 18, textAlign: "center" },
  modalScreen: { flex: 1, backgroundColor: "#FCFAF8" },
  modalBody: { flex: 1 },
  modalHeader: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: palette.border },
  headerIconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  modalTitle: { flex: 1, textAlign: "center", fontSize: 18, lineHeight: 22, fontWeight: "800", color: palette.text },
  modalContent: { padding: 16, gap: 12 },
  formColumn: { gap: 12 },
  input: { minHeight: 52, borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingVertical: 13, color: palette.text, fontSize: 14 },
  detailPanel: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFCFA",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
  },
  detailHeader: {
    gap: 2,
  },
  detailEyebrow: {
    fontSize: 12,
    lineHeight: 18,
    color: palette.sub,
    fontWeight: "600",
  },
  detailTitle: {
    fontSize: 17,
    lineHeight: 24,
    color: palette.text,
    fontWeight: "800",
  },
  detailImageCard: {
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    padding: 12,
  },
  detailHeroImage: {
    width: "100%",
    aspectRatio: 1.58,
    borderRadius: 18,
    backgroundColor: "#F4ECE2",
  },
  detailHeroPlaceholder: {
    width: "100%",
    aspectRatio: 1.58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: "#E7D6C1",
  },
  detailFieldBlock: {
    gap: 8,
  },
  detailLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  detailFieldLabel: {
    fontSize: 12,
    lineHeight: 18,
    color: palette.text,
    fontWeight: "600",
  },
  detailTextarea: {
    minHeight: 76,
  },
  linkInputShell: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingLeft: 14,
    paddingRight: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  linkInput: {
    flex: 1,
    minHeight: 50,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
  },
  metadataInputShell: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingLeft: 14,
    paddingRight: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metadataInput: {
    flex: 1,
    minHeight: 50,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
  },
  detailSplitRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-end",
  },
  detailSplitItem: {
    flex: 1,
    gap: 8,
  },
  uploadButton: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 14,
  },
  uploadButtonText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "700",
  },
  durationShell: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingLeft: 14,
    paddingRight: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  durationInput: {
    flex: 1,
    minHeight: 50,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
  },
  merchNotice: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.mutedSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  merchNoticeText: {
    flex: 1,
    color: palette.text,
    fontSize: 12,
    lineHeight: 18,
  },
  detailSaveButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: palette.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 18,
  },
  detailSaveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  searchShell: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingLeft: 16,
    paddingRight: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    minHeight: 50,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
  },
  textarea: { minHeight: 104 },
  inlineButtons: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  previewCard: { gap: 8, borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: "#FFFCF9", padding: 12 },
  previewLabel: { fontSize: 12, lineHeight: 17, fontWeight: "700", color: palette.sub },
  previewImage: { width: "100%", aspectRatio: 16 / 9, borderRadius: 14, backgroundColor: "#F4ECE2" },
  primaryButton: { minHeight: 46, borderRadius: 14, backgroundColor: palette.accent, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  secondaryButton: { minHeight: 42, borderRadius: 14, borderWidth: 1, borderColor: "#E4D7C8", backgroundColor: "#FFF9F3", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  secondaryButtonText: { color: palette.accent, fontSize: 13, fontWeight: "700" },
  modalDeleteButton: { borderColor: "#F1CFC7", backgroundColor: "#FFF7F5" },
  modalDeleteButtonText: { color: palette.danger },
  helperTitle: { fontSize: 16, lineHeight: 20, fontWeight: "800", color: palette.text },
  helperText: { fontSize: 12, lineHeight: 18, color: palette.sub },
});

