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
  MobileAdminContentPost,
  MobileAdminContentPostInput,
  MobileAdminContentSnapshot,
  MobileAdminMerchService,
  MobileAdminOffer,
  MobileAdminOfferInput,
  MobileAdminStorefrontGalleryItem,
  MobileAdminStorefrontGalleryItemInput,
  MobileAdminStorefrontProduct,
  MobileAdminStorefrontProductInput,
  MobileAdminStorefrontProfileInput,
  MobileAdminStorefrontTeamMember,
  MobileAdminStorefrontTeamMemberInput,
} from "@nails/shared";
import {
  archiveAdminContentPostForMobile,
  archiveAdminOfferForMobile,
  createAdminContentPostForMobile,
  createAdminOfferForMobile,
  createAdminStorefrontGalleryItemForMobile,
  createAdminStorefrontProductForMobile,
  createAdminStorefrontTeamMemberForMobile,
  deleteAdminStorefrontGalleryItemForMobile,
  deleteAdminStorefrontProductForMobile,
  deleteAdminStorefrontTeamMemberForMobile,
  ensureOrgContext,
  listAdminContentSnapshotForMobile,
  listAdminMerchServicesForMobile,
  setActiveAdminStorefrontProfileForMobile,
  updateAdminContentPostForMobile,
  updateAdminMerchServiceForMobile,
  updateAdminOfferForMobile,
  updateAdminStorefrontGalleryItemForMobile,
  updateAdminStorefrontProductForMobile,
  updateAdminStorefrontTeamMemberForMobile,
  upsertAdminStorefrontProfileForMobile,
} from "@nails/shared";
import { AdminKeyboardAwareScrollView, ADMIN_KEYBOARD_ACTIVE_FIELD_CLEARANCE, getAdminHeaderTopPadding, useAdminKeyboardFieldFocus, useKeyboardVisible } from "@/src/features/admin/ui";
import { ManageScreenShell } from "@/src/features/admin/manage-ui";
import { uploadPickedAdminContentImage } from "@/src/features/admin/content-images";
import { mobileSupabase } from "@/src/lib/supabase";
import { getCacheAgeMs, hydrateCachedValue, isCacheFresh, writeCachedValue } from "@/src/lib/admin-services-cache";

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

type ContentTab = "home" | "explore";
type MerchContext = "home" | "explore";
type BranchOption = { id: string; name: string };

type MerchFormState = {
  id: string;
  name: string;
  shortDescription: string;
  imageUrl: string;
  durationLabel: string;
  featuredInHome: boolean;
  featuredInExplore: boolean;
  displayOrderHome: string;
  displayOrderExplore: string;
  lookbookCategory: string;
  lookbookBadge: string;
  lookbookTone: string;
};

const OFFER_PACKAGE_TIERS = ["REGULAR", "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"] as const;

type OfferFormState = {
  id?: string;
  title: string;
  description: string;
  imageUrl: string;
  badge: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  packageTier: (typeof OFFER_PACKAGE_TIERS)[number];
  packageOrder: string;
  metadataText: string;
};

type PostFormState = {
  id?: string;
  title: string;
  summary: string;
  body: string;
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
  category: string;
  description: string;
  coverImageUrl: string;
  logoImageUrl: string;
  rating: string;
  reviewsLabel: string;
  addressLine: string;
  mapUrl: string;
  openingHours: string;
  phone: string;
  messengerUrl: string;
  instagramUrl: string;
  highlightsText: string;
  isActive: boolean;
};

type TeamFormState = {
  id?: string;
  displayName: string;
  roleLabel: string;
  avatarUrl: string;
  bio: string;
  displayOrder: string;
  isVisible: boolean;
};

type ProductFormState = {
  id?: string;
  name: string;
  subtitle: string;
  priceLabel: string;
  imageUrl: string;
  productType: string;
  displayOrder: string;
  isActive: boolean;
  isFeatured: boolean;
};

type GalleryFormState = {
  id?: string;
  title: string;
  imageUrl: string;
  kind: string;
  displayOrder: string;
  isActive: boolean;
};

const DUMMY_FEED_POSTS: MobileAdminContentPostInput[] = [
  {
    title: "3 mẫu nail pastel đang được khách đặt nhiều tuần này",
    summary: "Tổng hợp nhanh các tone sữa, hồng nude và pastel trong veo để đi học, đi làm và chụp ảnh đẹp.",
    body: "Nếu anh thích form gọn, sạch và sáng tay thì pastel sữa, hồng nude và beige bóng nhẹ là lựa chọn an toàn mà vẫn có gu. Tiệm ưu tiên form bền, màu lên da và dễ refill.",
    coverImageUrl: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=1200&q=80",
    contentType: "trend",
    status: "published",
    priority: 101,
    metadata: { source: "seed", section: "home_feed" },
  },
  {
    title: "Chăm móng sau dịp gel: 4 bước đơn giản để móng đẹp và ít gãy",
    summary: "Lưu ý dưỡng ẩm, tránh bóc gel tại nhà và đặt lịch chăm sóc định kỳ để móng khỏe hơn.",
    body: "Sau mỗi đợt làm gel, móng cần được nghỉ và dưỡng đúng cách. Nên bổ sung dầu dưỡng móng, hạn chế tiếp xúc hóa chất mạnh và tránh tự bóc lớp cũ.",
    coverImageUrl: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80",
    contentType: "care",
    status: "published",
    priority: 102,
    metadata: { source: "seed", section: "home_feed" },
  },
  {
    title: "Đặt lịch sớm cuối tuần để giữ slot đẹp và tránh đợi lâu",
    summary: "Khung giờ tối thứ 6 đến chủ nhật thường hết slot sớm. Đặt trước sẽ dễ chọn nhân sự và mẫu yêu thích hơn.",
    body: "Nếu anh đã có mẫu và giờ mong muốn, hãy đặt lịch trước để hệ thống giữ slot phù hợp. Các khung sau 17h và cuối tuần thường được book nhanh nhất.",
    coverImageUrl: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80",
    contentType: "offer_hint",
    status: "published",
    priority: 103,
    metadata: { source: "seed", section: "home_feed" },
  },
];

function parseNumberInput(value: string) {
  return Number(value.replace(/[^\d.-]/g, "") || 0);
}

function parseMetadata(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return {};
  return JSON.parse(trimmed) as Record<string, unknown>;
}

function stringifyMetadata(metadata: Record<string, unknown>) {
  return Object.keys(metadata).length ? JSON.stringify(metadata, null, 2) : "";
}

function isLandingService(service: MobileAdminMerchService) {
  return service.active && service.featuredInLookbook;
}

function buildMerchForm(service: MobileAdminMerchService): MerchFormState {
  return {
    id: service.id,
    name: service.name,
    shortDescription: service.shortDescription ?? "",
    imageUrl: service.imageUrl ?? "",
    durationLabel: service.durationLabel ?? "",
    featuredInHome: service.featuredInHome,
    featuredInExplore: service.featuredInExplore,
    displayOrderHome: String(service.displayOrderHome ?? 0),
    displayOrderExplore: String(service.displayOrderExplore ?? 0),
    lookbookCategory: service.lookbookCategory ?? "",
    lookbookBadge: service.lookbookBadge ?? "",
    lookbookTone: service.lookbookTone ?? "",
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

function emptyOfferForm(): OfferFormState {
  return {
    title: "",
    description: "",
    imageUrl: "",
    badge: "",
    startsAt: "",
    endsAt: "",
    isActive: true,
    packageTier: "REGULAR",
    packageOrder: "0",
    metadataText: "",
  };
}

function buildOfferForm(offer: MobileAdminOffer): OfferFormState {
  const packageTier = typeof offer.metadata.packageTier === "string" && OFFER_PACKAGE_TIERS.includes(offer.metadata.packageTier.toUpperCase() as (typeof OFFER_PACKAGE_TIERS)[number])
    ? offer.metadata.packageTier.toUpperCase() as (typeof OFFER_PACKAGE_TIERS)[number]
    : "REGULAR";
  const packageOrder = Number(offer.metadata.packageOrder ?? offer.metadata.displayOrder ?? 0);

  return {
    id: offer.id,
    title: offer.title,
    description: offer.description,
    imageUrl: offer.imageUrl ?? "",
    badge: offer.badge ?? "",
    startsAt: offer.startsAt ?? "",
    endsAt: offer.endsAt ?? "",
    isActive: offer.isActive,
    packageTier,
    packageOrder: String(Number.isFinite(packageOrder) ? packageOrder : 0),
    metadataText: stringifyMetadata(offer.metadata),
  };
}

function emptyPostForm(): PostFormState {
  return {
    title: "",
    summary: "",
    body: "",
    coverImageUrl: "",
    contentType: "trend",
    status: "draft",
    priority: "100",
    metadataText: "",
  };
}

function buildPostForm(post: MobileAdminContentPost): PostFormState {
  return {
    id: post.id,
    title: post.title,
    summary: post.summary,
    body: post.body,
    coverImageUrl: post.coverImageUrl ?? "",
    contentType: post.contentType,
    status: post.status,
    priority: String(post.priority),
    metadataText: stringifyMetadata(post.metadata),
    publishedAt: post.publishedAt,
    sourcePlatform: post.sourcePlatform,
    sourceMessageId: post.sourceMessageId,
  };
}

function buildStorefrontForm(snapshot: MobileAdminContentSnapshot | null): StorefrontFormState {
  const storefront = snapshot?.storefront;
  return {
    id: storefront?.id,
    slug: storefront?.slug ?? "",
    name: storefront?.name ?? "",
    category: storefront?.category ?? "",
    description: storefront?.description ?? "",
    coverImageUrl: storefront?.coverImageUrl ?? "",
    logoImageUrl: storefront?.logoImageUrl ?? "",
    rating: storefront?.rating != null ? String(storefront.rating) : "",
    reviewsLabel: storefront?.reviewsLabel ?? "",
    addressLine: storefront?.addressLine ?? "",
    mapUrl: storefront?.mapUrl ?? "",
    openingHours: storefront?.openingHours ?? "",
    phone: storefront?.phone ?? "",
    messengerUrl: storefront?.messengerUrl ?? "",
    instagramUrl: storefront?.instagramUrl ?? "",
    highlightsText: storefront?.highlights.join("\n") ?? "",
    isActive: storefront?.isActive ?? false,
  };
}

function emptyTeamForm(): TeamFormState {
  return {
    displayName: "",
    roleLabel: "",
    avatarUrl: "",
    bio: "",
    displayOrder: "0",
    isVisible: true,
  };
}

function buildTeamForm(member: MobileAdminStorefrontTeamMember): TeamFormState {
  return {
    id: member.id,
    displayName: member.displayName,
    roleLabel: member.roleLabel ?? "",
    avatarUrl: member.avatarUrl ?? "",
    bio: member.bio ?? "",
    displayOrder: String(member.displayOrder),
    isVisible: member.isVisible,
  };
}

function emptyProductForm(): ProductFormState {
  return {
    name: "",
    subtitle: "",
    priceLabel: "",
    imageUrl: "",
    productType: "",
    displayOrder: "0",
    isActive: true,
    isFeatured: false,
  };
}

function buildProductForm(product: MobileAdminStorefrontProduct): ProductFormState {
  return {
    id: product.id,
    name: product.name,
    subtitle: product.subtitle ?? "",
    priceLabel: product.priceLabel ?? "",
    imageUrl: product.imageUrl ?? "",
    productType: product.productType ?? "",
    displayOrder: String(product.displayOrder),
    isActive: product.isActive,
    isFeatured: product.isFeatured,
  };
}

function emptyGalleryForm(): GalleryFormState {
  return {
    title: "",
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
  const [activeTab, setActiveTab] = useState<ContentTab>("home");
  const [snapshot, setSnapshot] = useState<MobileAdminContentSnapshot | null>(null);
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [defaultBranchId, setDefaultBranchId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<MobileAdminMerchService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [homeServiceQuery, setHomeServiceQuery] = useState("");
  const [exploreFeaturedQuery, setExploreFeaturedQuery] = useState("");
  const [exploreRegularQuery, setExploreRegularQuery] = useState("");
  const [homeServicesExpanded, setHomeServicesExpanded] = useState(true);
  const [exploreFeaturedExpanded, setExploreFeaturedExpanded] = useState(false);

  const [merchContext, setMerchContext] = useState<MerchContext>("home");
  const [merchForm, setMerchForm] = useState<MerchFormState | null>(null);
  const [offerForm, setOfferForm] = useState<OfferFormState | null>(null);
  const [postForm, setPostForm] = useState<PostFormState | null>(null);
  const [storefrontForm, setStorefrontForm] = useState<StorefrontFormState>(buildStorefrontForm(null));
  const [storefrontEditorOpen, setStorefrontEditorOpen] = useState(false);
  const [exploreRegularEditorOpen, setExploreRegularEditorOpen] = useState(false);
  const [productsExpanded, setProductsExpanded] = useState(false);
  const [teamListOpen, setTeamListOpen] = useState(false);
  const [teamForm, setTeamForm] = useState<TeamFormState | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState | null>(null);
  const [galleryForm, setGalleryForm] = useState<GalleryFormState | null>(null);
  const hasFocusedOnceRef = useRef(false);
  const loadSnapshotRef = useRef<() => Promise<void>>(async () => {});
  const loadServicesRef = useRef<(force?: boolean) => Promise<void>>(async () => {});
  const loadBranchOptionsRef = useRef<() => Promise<void>>(async () => {});

  const loadBranchOptions = useCallback(async () => {
    if (!mobileSupabase) return;

    const { orgId, branchId } = await ensureOrgContext(mobileSupabase);
    setDefaultBranchId(branchId);
    setSelectedBranchId((current) => current ?? branchId);

    const { data, error: branchesError } = await mobileSupabase
      .from("branches")
      .select("id, name")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });

    if (branchesError) {
      throw branchesError;
    }

    setBranchOptions(
      (data ?? []).map((branch) => ({
        id: String(branch.id ?? ""),
        name: typeof branch.name === "string" && branch.name.trim() ? branch.name.trim() : "Chi nhánh",
      })),
    );
  }, []);

  const loadSnapshot = useCallback(async (branchIdOverride?: string) => {
    if (!mobileSupabase) {
      setError("Thiếu cấu hình Database mobile.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { branchId } = await ensureOrgContext(mobileSupabase);
      const effectiveBranchId = branchIdOverride ?? selectedBranchId ?? branchId;

      setDefaultBranchId(branchId);
      setSelectedBranchId((current) => current ?? branchId);

      const next = await listAdminContentSnapshotForMobile(mobileSupabase, {
        includeServices: false,
        branchId: effectiveBranchId,
      });
      await prewarmContentDetailCache(next);
      setSnapshot(next);
      setStorefrontForm(buildStorefrontForm(next));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không tải được nội dung khách.");
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  const loadServices = useCallback(
    async (force = false, branchIdOverride?: string) => {
      if (!mobileSupabase) {
        setError("Thiếu cấu hình Database mobile.");
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
        const { branchId } = await ensureOrgContext(mobileSupabase);
        const effectiveBranchId = branchIdOverride ?? selectedBranchId ?? branchId;
        
        // Try to load from cache first
        if (!force) {
          const cached = await hydrateCachedValue<MobileAdminMerchService[]>(SERVICES_CACHE_KEY);
          if (cached && isCacheFresh(SERVICES_CACHE_KEY, SERVICES_MAX_STALE_MS)) {
            setServices(cached.value);
            setServicesLoaded(true);
            
            // If cache is stale but still usable, refresh in background
            if (!isCacheFresh(SERVICES_CACHE_KEY, SERVICES_FRESH_MS)) {
              // Background refresh
              listAdminMerchServicesForMobile(mobileSupabase, { branchId: effectiveBranchId })
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
        const next = await listAdminMerchServicesForMobile(mobileSupabase, { branchId: effectiveBranchId });
        setServices(next);
        setServicesLoaded(true);
        await writeCachedValue(SERVICES_CACHE_KEY, next);
        await prewarmServiceDetailCache(next);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Không tải được danh sách dịch vụ.");
      } finally {
        setServicesLoading(false);
      }
    },
    [selectedBranchId, servicesLoaded, servicesLoading, services.length],
  );

  useEffect(() => {
    loadSnapshotRef.current = loadSnapshot;
  }, [loadSnapshot]);

  useEffect(() => {
    loadServicesRef.current = loadServices;
  }, [loadServices]);

  useEffect(() => {
    loadBranchOptionsRef.current = loadBranchOptions;
  }, [loadBranchOptions]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void (async () => {
        await loadBranchOptions();
        await loadSnapshot();
      })();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [loadBranchOptions, loadSnapshot]);

  useEffect(() => {
    if (!snapshot) return;
    const timeoutId = setTimeout(() => {
      void loadServices();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [loadServices, snapshot]);

  // Removed useFocusEffect to prevent layout shift when returning to screen
  // Data is loaded on mount via useEffect below

  const lookbookServices = useMemo(
    () =>
      services
        .filter((item) => isLandingService(item))
        .sort((left, right) => left.name.localeCompare(right.name, "vi")),
    [services],
  );

  const regularServices = useMemo(
    () =>
      services
        .filter((item) => item.active && !item.featuredInLookbook)
        .sort((left, right) => left.name.localeCompare(right.name, "vi")),
    [services],
  );

  const homeServices = useMemo(
    () =>
      lookbookServices
        .filter((item) => item.featuredInHome)
        .sort((left, right) => left.displayOrderHome - right.displayOrderHome || left.name.localeCompare(right.name, "vi")),
    [lookbookServices],
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

        return left.name.localeCompare(right.name, "vi");
      });
  }, [homeServiceQuery, lookbookServices]);

  const exploreServices = useMemo(
    () =>
      lookbookServices
        .filter((item) => item.featuredInExplore)
        .sort((left, right) => left.displayOrderExplore - right.displayOrderExplore || left.name.localeCompare(right.name, "vi")),
    [lookbookServices],
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

        return left.name.localeCompare(right.name, "vi");
      });
  }, [exploreFeaturedQuery, lookbookServices]);

  const exploreRegularServices = useMemo(() => {
    const query = exploreRegularQuery.trim().toLowerCase();
    return regularServices
      .filter((item) => {
        if (!query) return true;
        const haystack = `${item.name} ${item.shortDescription ?? ""} ${item.durationLabel ?? ""}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((left, right) => left.name.localeCompare(right.name, "vi"));
  }, [exploreRegularQuery, regularServices]);

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

  async function pickAndUploadImage(
    folder: "offers" | "posts" | "storefront" | "gallery" | "products",
    baseName: string,
    onSuccess: (publicUrl: string) => void,
  ) {
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
      const uploaded = await uploadPickedAdminContentImage(result.assets[0], { folder, baseName });
      onSuccess(uploaded.publicUrl);
    } catch (uploadError) {
      Alert.alert("Lỗi upload", uploadError instanceof Error ? uploadError.message : "Không thể upload ảnh.");
    } finally {
      setSaving(false);
    }
  }

  async function saveMerchService() {
    if (!mobileSupabase || !merchForm) return;
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
      });
      setMerchForm(null);
      await loadServices(true);
    } catch (nextError) {
      Alert.alert("Không lưu được", nextError instanceof Error ? nextError.message : "Thử lại sau.");
    } finally {
      setSaving(false);
    }
  }

  function toOfferInput(form: OfferFormState): MobileAdminOfferInput {
    const metadata = parseMetadata(form.metadataText);
    metadata.packageTier = form.packageTier;
    metadata.packageOrder = Number(form.packageOrder || 0);

    return {
      title: form.title.trim(),
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim() || null,
      badge: form.badge.trim() || null,
      startsAt: form.startsAt.trim() || null,
      endsAt: form.endsAt.trim() || null,
      isActive: form.isActive,
      metadata,
    };
  }

  async function saveOffer() {
    if (!mobileSupabase || !offerForm) return;
    setSaving(true);
    try {
      const payload = toOfferInput(offerForm);
      if (offerForm.id) {
        await updateAdminOfferForMobile(mobileSupabase, offerForm.id, payload);
      } else {
        await createAdminOfferForMobile(mobileSupabase, payload);
      }
      setOfferForm(null);
      await loadSnapshot();
    } catch (nextError) {
      Alert.alert("Không lưu ưu đãi", nextError instanceof Error ? nextError.message : "Thử lại sau.");
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
    };
  }

  async function savePost() {
    if (!mobileSupabase || !postForm) return;
    setSaving(true);
    try {
      const payload = toPostInput(postForm);
      if (postForm.id) {
        await updateAdminContentPostForMobile(mobileSupabase, postForm.id, payload, postForm.publishedAt ?? null);
      } else {
        await createAdminContentPostForMobile(mobileSupabase, payload);
      }
      setPostForm(null);
      await loadSnapshot();
    } catch (nextError) {
      Alert.alert("Không lưu bài viết", nextError instanceof Error ? nextError.message : "Thử lại sau.");
    } finally {
      setSaving(false);
    }
  }

  async function seedDummyPosts() {
    if (!mobileSupabase) return;
    const client = mobileSupabase;
    setSaving(true);
    try {
      const existingTitles = new Set((snapshot?.posts ?? []).map((post) => post.title.trim().toLowerCase()));
      const missingPosts = DUMMY_FEED_POSTS.filter((post) => !existingTitles.has(post.title.trim().toLowerCase()));

      if (!missingPosts.length) {
        Alert.alert("Đã có dữ liệu mẫu", "Các bài mẫu cho feed đã tồn tại sẵn trong hệ thống.");
        return;
      }

      await Promise.all(missingPosts.map((post) => createAdminContentPostForMobile(client, post)));
      await loadSnapshot();
      Alert.alert("Đã tạo dữ liệu mẫu", `Đã thêm ${missingPosts.length} bài feed vào Home.`);
    } catch (nextError) {
      Alert.alert("Không tạo được dữ liệu mẫu", nextError instanceof Error ? nextError.message : "Thử lại sau.");
    } finally {
      setSaving(false);
    }
  }

  async function saveStorefront() {
    if (!mobileSupabase) return;
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
      };
      await upsertAdminStorefrontProfileForMobile(mobileSupabase, payload);
      await loadSnapshot();
      Alert.alert("Đã lưu", "Tiệm của chi nhánh này đã được cập nhật.");
    } catch (nextError) {
      Alert.alert("Không lưu tiệm", nextError instanceof Error ? nextError.message : "Thử lại sau.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTeamMember() {
    if (!mobileSupabase || !teamForm || !snapshot?.storefront?.id) return;
    setSaving(true);
    try {
      const payload: MobileAdminStorefrontTeamMemberInput = {
        displayName: teamForm.displayName.trim(),
        roleLabel: teamForm.roleLabel.trim() || null,
        avatarUrl: teamForm.avatarUrl.trim() || null,
        bio: teamForm.bio.trim() || null,
        displayOrder: parseNumberInput(teamForm.displayOrder),
        isVisible: teamForm.isVisible,
      };
      if (teamForm.id) {
        await updateAdminStorefrontTeamMemberForMobile(mobileSupabase, teamForm.id, payload);
      } else {
        await createAdminStorefrontTeamMemberForMobile(mobileSupabase, snapshot.storefront.id, payload);
      }
      setTeamForm(null);
      await loadSnapshot();
    } catch (nextError) {
      Alert.alert("Không lưu nhân sự", nextError instanceof Error ? nextError.message : "Thử lại sau.");
    } finally {
      setSaving(false);
    }
  }

  async function saveProduct() {
    if (!mobileSupabase || !productForm || !snapshot?.storefront?.id) return;
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
      };
      if (productForm.id) {
        await updateAdminStorefrontProductForMobile(mobileSupabase, productForm.id, payload);
      } else {
        await createAdminStorefrontProductForMobile(mobileSupabase, snapshot.storefront.id, payload);
      }
      setProductForm(null);
      await loadSnapshot();
    } catch (nextError) {
      Alert.alert("Không lưu sản phẩm", nextError instanceof Error ? nextError.message : "Thử lại sau.");
    } finally {
      setSaving(false);
    }
  }

  async function saveGalleryItem() {
    if (!mobileSupabase || !galleryForm || !snapshot?.storefront?.id) return;
    setSaving(true);
    try {
      const payload: MobileAdminStorefrontGalleryItemInput = {
        title: galleryForm.title.trim() || null,
        imageUrl: galleryForm.imageUrl.trim(),
        kind: galleryForm.kind.trim() || null,
        displayOrder: parseNumberInput(galleryForm.displayOrder),
        isActive: galleryForm.isActive,
      };
      if (galleryForm.id) {
        await updateAdminStorefrontGalleryItemForMobile(mobileSupabase, galleryForm.id, payload);
      } else {
        await createAdminStorefrontGalleryItemForMobile(mobileSupabase, snapshot.storefront.id, payload);
      }
      setGalleryForm(null);
      await loadSnapshot();
    } catch (nextError) {
      Alert.alert("Không lưu gallery", nextError instanceof Error ? nextError.message : "Thử lại sau.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmTask(title: string, message: string, task: () => Promise<void>) {
    Alert.alert(title, message, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xác nhận",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setSaving(true);
            try {
              await task();
              await loadSnapshot();
            } catch (nextError) {
              Alert.alert("Không thực hiện được", nextError instanceof Error ? nextError.message : "Thử lại sau.");
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
      <ManageScreenShell title="Cửa tiệm" subtitle="Đang tải dữ liệu Home và Explore..." currentKey="content" group="setup" activeTab="booking" showTabs={false} showBottomDock={true} showBackButton={false}>
        <View style={styles.stateCard}>
          <ActivityIndicator color={palette.accent} />
          <Text style={styles.stateTitle}>Đang đồng bộ nội dung hiển thị cho khách hàng...</Text>
        </View>
      </ManageScreenShell>
    );
  }

  return (
    <ManageScreenShell
      title="Cửa tiệm"
      subtitle="Quản lý nội dung Home và Explore"
      currentKey="content"
      group="setup"
      activeTab="booking"
      showTabs={false}
      showBottomDock={true}
      showBackButton={false}
      onRefresh={() => void Promise.all([loadBranchOptions(), loadSnapshot(), loadServices(true)])}
      refreshing={loading || servicesLoading}
    >
      <View style={styles.heroRow}>
        <Chip active={activeTab === "home"} icon="home" label="Home" onPress={() => setActiveTab("home")} />
        <Chip active={activeTab === "explore"} icon="compass" label="Explore" onPress={() => setActiveTab("explore")} />
      </View>

      {servicesLoading ? (
        <View style={styles.inlineNotice}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.inlineNoticeText}>Đang tải danh sách dịch vụ...</Text>
        </View>
      ) : null}

      {saving ? (
        <View style={styles.inlineNotice}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.inlineNoticeText}>Đang lưu dữ liệu...</Text>
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
            title="Lookbook Home"
            titleBadge={`${homeServices.length}/${lookbookServices.length}`}
            subtitle="Chỉ hiển thị dịch vụ có metadata lookbook."
            actionLabel={homeServicesExpanded ? "Thu gọn ˄" : "Mở rộng ˅"}
            onActionPress={() => setHomeServicesExpanded((current) => !current)}
          >
            {homeServicesExpanded ? (
              <>
            <Text style={styles.helperText}>Dịch vụ thường sẽ không nằm ở khu này.</Text>
            <SearchInput placeholder="Tìm dịch vụ lookbook cho Home..." value={homeServiceQuery} onChangeText={setHomeServiceQuery} />
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
                      Home · {service.featuredInHome ? "Bật" : "Tắt"} · thứ tự {service.displayOrderHome} · {service.lookbookBadge || service.lookbookCategory || "Lookbook"}
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
            title="Ưu đãi"
            titleBadge={String(snapshot?.offers.length ?? 0)}
            subtitle="Ưu đãi dùng chung cho Home và Explore."
            actionLabel="Thêm ưu đãi"
            onActionPress={() => void router.push("/(admin)/manage-content-offer/new" as never)}
          >
            <View style={styles.listColumn}>
              {(snapshot?.offers ?? []).map((offer) => (
                <View key={offer.id} style={styles.rowCard}>
                  <ItemThumbnail uri={offer.imageUrl} label={offer.title} />
                  <Pressable style={styles.rowCopy} onPress={() => void router.push(`/(admin)/manage-content-offer/${offer.id}` as never)}>
                    <Text style={styles.rowTitle}>{offer.title}</Text>
                    <Text style={styles.rowSubtitle}>{offer.isActive ? "Đang bật" : "Đang tắt"} · {offer.badge || "Không có badge"}</Text>
                  </Pressable>
                  <Pressable style={styles.iconButton} onPress={() => void confirmTask("Ẩn ưu đãi", "Ưu đãi này sẽ được tắt cho khách hàng.", async () => {
                    if (!mobileSupabase) return;
                    await archiveAdminOfferForMobile(mobileSupabase, offer.id);
                  })}>
                    <Feather name="archive" size={16} color={palette.accent} />
                  </Pressable>
                </View>
              ))}
            </View>
          </SectionCard>

          <SectionCard
            title="Bài feed"
            titleBadge={String(snapshot?.posts.length ?? 0)}
            subtitle="Tạo, sửa và xuất bản bài hiển thị ở Home."
            actionLabel="Thêm bài"
            onActionPress={() => void router.push("/(admin)/manage-content-post/new" as never)}
          >
            <View style={styles.inlineButtons}>
              <Pressable style={styles.secondaryButton} onPress={() => void seedDummyPosts()}>
                <Text style={styles.secondaryButtonText}>Tạo 3 bài mẫu</Text>
              </Pressable>
            </View>
            <View style={styles.listColumn}>
              {(snapshot?.posts ?? []).map((post) => (
                <View key={post.id} style={styles.rowCard}>
                  <ItemThumbnail uri={post.coverImageUrl} label={post.title} />
                  <Pressable style={styles.rowCopy} onPress={() => void router.push(`/(admin)/manage-content-post/${post.id}` as never)}>
                    <Text style={styles.rowTitle}>{post.title}</Text>
                    <Text style={styles.rowSubtitle}>{post.status} · {post.contentType} · nguồn {post.sourcePlatform}</Text>
                  </Pressable>
                  <Pressable style={styles.iconButton} onPress={() => void confirmTask("Ẩn bài viết", "Bài này sẽ được gỡ khỏi Home.", async () => {
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
          <SectionCard title="Hồ sơ tiệm" subtitle={`Đang chỉnh cho ${snapshot?.branchName ?? "hiện tại"}.`} actionLabel={snapshot?.storefront?.isActive ? "Đang hiển thị" : "Bật hiển thị"} onActionPress={snapshot?.storefront ? () => {
            if (!mobileSupabase) return;
            void (async () => {
              setSaving(true);
              try {
                await setActiveAdminStorefrontProfileForMobile(mobileSupabase, snapshot.storefront!.id);
                await loadSnapshot();
              } catch (nextError) {
                Alert.alert("Không kích hoạt được", nextError instanceof Error ? nextError.message : "Thử lại sau.");
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
                    <Text style={styles.storefrontInfoLabel}>Tài khoản</Text>
                  </View>
                  <Text style={styles.storefrontInfoValue}>{storefrontForm.slug || "cham-beauty"}</Text>
                </View>
                <View style={styles.storefrontDivider} />
                <View style={styles.storefrontInfoCell}>
                  <View style={styles.storefrontLabelRow}>
                    <Feather name="tag" size={18} color={palette.accent} />
                    <Text style={styles.storefrontInfoLabel}>Tên hiển thị</Text>
                  </View>
                  <Text style={styles.storefrontInfoValue}>{storefrontForm.name || "CHẤM BEAUTY"}</Text>
                </View>
              </View>
              <Pressable style={styles.storefrontWideRow} onPress={() => setStorefrontEditorOpen(true)}>
                <View style={styles.storefrontLabelRow}>
                  <Feather name="file-text" size={18} color={palette.accent} />
                  <Text style={styles.storefrontInfoLabel}>Mô tả</Text>
                </View>
                <View style={styles.storefrontWideContent}>
                  <Text numberOfLines={2} style={styles.storefrontWideValue}>{storefrontForm.description || "Chấm Beauty mang đến vẻ đẹp tinh tế, giúp bạn tự tin tỏa sáng trong mọi khoảnh khắc."}</Text>
                  <Feather name="chevron-right" size={18} color="#A7988A" />
                </View>
              </Pressable>
              <View style={styles.storefrontInfoRow}>
                <View style={styles.storefrontInfoCell}>
                  <View style={styles.storefrontLabelRow}>
                    <Feather name="link" size={18} color={palette.accent} />
                    <Text style={styles.storefrontInfoLabel}>Link ảnh bìa</Text>
                  </View>
                  <Text numberOfLines={1} style={styles.storefrontLinkValue}>{storefrontForm.coverImageUrl || "i.ibb.co/..."}</Text>
                </View>
                <View style={styles.storefrontDivider} />
                <View style={styles.storefrontInfoCell}>
                  <View style={styles.storefrontLabelRow}>
                    <Feather name="link" size={18} color={palette.accent} />
                    <Text style={styles.storefrontInfoLabel}>Link logo</Text>
                  </View>
                  <Text numberOfLines={1} style={styles.storefrontLinkValue}>{storefrontForm.logoImageUrl || "i.ibb.co/..."}</Text>
                </View>
              </View>
            </View>

            <View style={styles.storefrontActionRow}>
              <Pressable style={styles.storefrontGhostButton} onPress={() => void pickAndUploadImage("storefront", storefrontForm.name || "storefront-cover", (publicUrl) => setStorefrontForm((prev) => ({ ...prev, coverImageUrl: publicUrl })))}><Feather name="upload-cloud" size={18} color={palette.accent} /><Text style={styles.storefrontGhostText}>Tải ảnh bìa</Text></Pressable>
              <Pressable style={styles.storefrontGhostButton} onPress={() => void pickAndUploadImage("storefront", storefrontForm.name || "storefront-logo", (publicUrl) => setStorefrontForm((prev) => ({ ...prev, logoImageUrl: publicUrl })))}><Feather name="upload-cloud" size={18} color={palette.accent} /><Text style={styles.storefrontGhostText}>Tải logo</Text></Pressable>
            <Pressable style={styles.storefrontSaveButton} onPress={() => setStorefrontEditorOpen(true)}><Text style={styles.storefrontSaveText}>Sửa hồ sơ tiệm</Text></Pressable>
            </View>

            <View style={styles.storefrontPreviewRow}>
              <View style={styles.storefrontPreviewCard}>
                <Text style={styles.previewLabel}>Ảnh bìa hiện tại</Text>
                {storefrontForm.coverImageUrl ? <CachedAppImage source={{ uri: storefrontForm.coverImageUrl }} style={styles.storefrontCoverPreview} alt="cover" /> : null}
              </View>
              <View style={styles.storefrontPreviewCard}>
                <Text style={styles.previewLabel}>Logo hiện tại</Text>
                {storefrontForm.logoImageUrl ? <CachedAppImage source={{ uri: storefrontForm.logoImageUrl }} style={styles.storefrontLogoPreview} alt="logo" /> : null}
              </View>
            </View>

            <View style={styles.storefrontFactsCard}>
              {[
                { icon: "star", label: "Đánh giá", value: storefrontForm.rating || "4.9" },
                { icon: "message-circle", label: "Số đánh giá", value: storefrontForm.reviewsLabel || "128 đánh giá" },
                { icon: "map-pin", label: "Địa chỉ", value: storefrontForm.addressLine || "Chưa có địa chỉ" },
                { icon: "link", label: "Google Maps", value: storefrontForm.mapUrl || "Chưa có link map" },
                { icon: "clock", label: "Giờ mở cửa", value: storefrontForm.openingHours || "Chưa có thông tin" },
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

          <SectionCard title="Dịch vụ nổi bật" titleBadge={String(exploreServices.length)} subtitle="Hiển thị dịch vụ có metadata lookbook" actionLabel={exploreFeaturedServices.length > EXPLORE_FEATURED_PREVIEW_COUNT ? (exploreFeaturedExpanded ? "Thu gọn" : "Mở rộng") : undefined} onActionPress={exploreFeaturedServices.length > EXPLORE_FEATURED_PREVIEW_COUNT ? () => setExploreFeaturedExpanded((current) => !current) : undefined}>
            <View style={styles.exploreFeatureShell}>
              {visibleExploreFeaturedServices.map((service, index) => (
                <Pressable key={service.id} style={[styles.exploreFeatureRow, index < visibleExploreFeaturedServices.length - 1 ? styles.exploreFeatureBorder : null]} onPress={() => {
                  setMerchContext("explore");
                  setMerchForm(buildMerchForm(service));
                }}>
                  <ItemThumbnail uri={service.imageUrl} label={service.name} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{service.name}</Text>
                    <Text numberOfLines={2} style={styles.rowSubtitle}>Explore · Thứ tự {service.displayOrderExplore} · {service.lookbookBadge || "Lookbook"}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#A7988A" />
                </Pressable>
              ))}
              {!exploreFeaturedExpanded && exploreFeaturedServices.length > EXPLORE_FEATURED_PREVIEW_COUNT ? (
                <Pressable style={styles.exploreFooterAction} onPress={() => setExploreFeaturedExpanded(true)}>
                  <Text style={styles.exploreFooterActionText}>Xem tất cả ({exploreServices.length})</Text>
                  <Feather name="chevron-right" size={18} color={palette.accent} />
                </Pressable>
              ) : null}
            </View>
          </SectionCard>

          <SectionCard title="Sản phẩm & phụ kiện" titleBadge={String(snapshot?.products.length ?? 0)} subtitle="Quản lý ảnh trong landing feed" actionLabel="Thêm ảnh" onActionPress={() => setProductForm(emptyProductForm())}>
            <View style={styles.listColumn}>
              {visibleProducts.map((product) => (
                <View key={product.id} style={styles.rowCard}>
                  <ItemThumbnail uri={product.imageUrl} label={product.name} />
                  <Pressable style={styles.rowCopy} onPress={() => setProductForm(buildProductForm(product))}>
                    <Text style={styles.rowTitle}>{product.name}</Text>
                    <Text numberOfLines={2} style={styles.rowSubtitle}>{product.productType || "Không có loại"} · {product.priceLabel || "Không có giá"} · {product.isActive ? "Đang hiển thị" : "Đang ẩn"}</Text>
                  </Pressable>
                  <Pressable style={styles.iconButton} onPress={() => void confirmTask("Xóa sản phẩm", "Sản phẩm này sẽ bị gỡ khỏi tiệm.", async () => {
                    if (!mobileSupabase) return;
                    await deleteAdminStorefrontProductForMobile(mobileSupabase, product.id);
                  })}>
                    <Feather name="trash-2" size={16} color={palette.danger} />
                  </Pressable>
                </View>
              ))}
              {(snapshot?.products.length ?? 0) > EXPLORE_PRODUCTS_PREVIEW_COUNT ? (
                <Pressable style={styles.exploreFooterAction} onPress={() => setProductsExpanded((current) => !current)}>
                  <Text style={styles.exploreFooterActionText}>{productsExpanded ? "Thu gọn" : `Xem tất cả (${snapshot?.products.length ?? 0})`}</Text>
                  <Feather name={productsExpanded ? "chevron-up" : "chevron-right"} size={18} color={palette.accent} />
                </Pressable>
              ) : null}
            </View>
          </SectionCard>

          <SectionCard title="Thư viện ảnh" titleBadge={String(snapshot?.gallery.length ?? 0)} actionLabel="Thêm ảnh" onActionPress={() => setGalleryForm(emptyGalleryForm())}>
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
                  <Text style={styles.exploreSummaryTitle}>Dịch vụ thường</Text>
                  <CountBadge value={String(exploreRegularServices.length)} />
                </View>
                <Text style={styles.exploreSummaryTitle}>Dự phòng</Text>
                <Text style={styles.exploreSummarySubtitle}>Dùng khi sản phẩm & phụ kiện chưa có dữ liệu.</Text>
              </View>
              <Feather name="chevron-right" size={20} color="#A7988A" />
            </Pressable>

            <Pressable style={styles.exploreSummaryCard} onPress={() => void router.push("/(admin)/manage-content-team" as never)}>
              <View style={[styles.exploreSummaryIcon, { backgroundColor: "#EAF2FF" }]}>
                <Feather name="users" size={22} color="#2B7FFF" />
              </View>
              <View style={styles.exploreSummaryCopy}>
                <View style={styles.exploreSummaryTitleRow}>
                  <Text style={styles.exploreSummaryTitle}>Nhân sự</Text>
                  <CountBadge value={String(snapshot?.team.length ?? 0)} />
                </View>
                <Text style={styles.exploreSummaryTitle}>tiệm</Text>
                <Text style={styles.exploreSummarySubtitle}>Quản lý thông tin nhân sự của tiệm.</Text>
              </View>
              <Feather name="chevron-right" size={20} color="#A7988A" />
            </Pressable>
          </View>
        </>
      )}

      <ModalShell title="Sửa hồ sơ tiệm" visible={storefrontEditorOpen} onClose={() => setStorefrontEditorOpen(false)}>
        <View style={styles.formColumn}>
          <ModalFormHeader icon="home" title="Sửa hồ sơ tiệm" subtitle="Cập nhật thông tin hiển thị của cửa tiệm trên landing và explore." />
          <ModalInputField icon="at-sign" label="Slug hiển thị" placeholder="cham-beauty" value={storefrontForm.slug} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, slug: value }))} />
          <ModalInputField icon="home" label="Tên tiệm" placeholder="CHẠM BEAUTY" value={storefrontForm.name} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, name: value }))} />
          <ModalInputField icon="grid" label="Nhóm tiệm" placeholder="Nail studio" value={storefrontForm.category} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, category: value }))} />
          <ModalTextAreaField icon="file-text" label="Mô tả" placeholder="Mô tả ngắn về cửa tiệm" value={storefrontForm.description} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, description: value }))} />
          <ModalInputField icon="image" label="URL ảnh bìa" placeholder="https://..." value={storefrontForm.coverImageUrl} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, coverImageUrl: value }))} />
          <ModalInputField icon="aperture" label="URL logo" placeholder="https://..." value={storefrontForm.logoImageUrl} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, logoImageUrl: value }))} />
          <View style={styles.inlineButtons}>
            <Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage("storefront", storefrontForm.name || "storefront-cover", (publicUrl) => setStorefrontForm((prev) => ({ ...prev, coverImageUrl: publicUrl })))}><Text style={styles.secondaryButtonText}>Tải ảnh bìa</Text></Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage("storefront", storefrontForm.name || "storefront-logo", (publicUrl) => setStorefrontForm((prev) => ({ ...prev, logoImageUrl: publicUrl })))}><Text style={styles.secondaryButtonText}>Tải logo</Text></Pressable>
          </View>
          <ImagePreview uri={storefrontForm.coverImageUrl} label="Ảnh bìa hiện tại" />
          <ImagePreview uri={storefrontForm.logoImageUrl} label="Logo hiện tại" />
          <ModalInputField icon="star" label="Điểm đánh giá" placeholder="4.9" value={storefrontForm.rating} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, rating: value }))} keyboardType="decimal-pad" />
          <ModalInputField icon="message-circle" label="Nhãn đánh giá" placeholder="128 đánh giá" value={storefrontForm.reviewsLabel} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, reviewsLabel: value }))} />
          <ModalInputField icon="map-pin" label="Địa chỉ hiển thị" placeholder="38A Bài Xương Trạch..." value={storefrontForm.addressLine} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, addressLine: value }))} />
          <ModalInputField icon="navigation" label="URL bản đồ" placeholder="https://maps..." value={storefrontForm.mapUrl} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, mapUrl: value }))} />
          <ModalInputField icon="clock" label="Giờ mở cửa" placeholder="09:00 - 21:00" value={storefrontForm.openingHours} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, openingHours: value }))} />
          <ModalInputField icon="phone" label="Số điện thoại" placeholder="09xxxxxxxx" value={storefrontForm.phone} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, phone: value }))} />
          <ModalInputField icon="message-square" label="URL Messenger" placeholder="https://m.me/..." value={storefrontForm.messengerUrl} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, messengerUrl: value }))} />
          <ModalInputField icon="instagram" label="URL Instagram" placeholder="https://instagram.com/..." value={storefrontForm.instagramUrl} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, instagramUrl: value }))} />
          <ModalTextAreaField icon="award" label="Điểm nổi bật" placeholder="Mỗi dòng 1 ý nổi bật" value={storefrontForm.highlightsText} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, highlightsText: value }))} />
          <View style={styles.inlineButtons}>
            <Chip active={storefrontForm.isActive} label={storefrontForm.isActive ? "Đang hiển thị" : "Đang ẩn"} onPress={() => setStorefrontForm((prev) => ({ ...prev, isActive: !prev.isActive }))} />
            <Pressable style={styles.primaryButton} onPress={() => void saveStorefront()}><Text style={styles.primaryButtonText}>Lưu hồ sơ tiệm</Text></Pressable>
          </View>
        </View>
      </ModalShell>

      <ModalShell title="Dịch vụ thường dự phòng" visible={exploreRegularEditorOpen} onClose={() => setExploreRegularEditorOpen(false)}>
        <View style={styles.formColumn}>
          <Input placeholder="Tìm dịch vụ thường cho Khám phá..." value={exploreRegularQuery} onChangeText={setExploreRegularQuery} />
          <View style={styles.listColumn}>
            {exploreRegularServices.map((service) => (
              <Pressable
                key={service.id}
                style={styles.rowCard}
                onPress={() => {
                  setExploreRegularEditorOpen(false);
                  setMerchContext("explore");
                  setMerchForm(buildMerchForm(service));
                }}
              >
                <ItemThumbnail uri={service.imageUrl} label={service.name} />
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{service.name}</Text>
                  <Text numberOfLines={2} style={styles.rowSubtitle}>{service.priceLabel} · {service.durationLabel || "Chưa có thời lượng"}</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#A7988A" />
              </Pressable>
            ))}
          </View>
        </View>
      </ModalShell>

      <ModalShell title="Nhân sự tiệm" visible={teamListOpen} onClose={() => setTeamListOpen(false)}>
        <View style={styles.formColumn}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              setTeamListOpen(false);
              setTeamForm(emptyTeamForm());
            }}
          >
            <Text style={styles.primaryButtonText}>Thêm nhân sự</Text>
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
                    {member.roleLabel || "Chưa có chức danh"} · Thứ tự {member.displayOrder} · {member.isVisible ? "Đang hiển thị" : "Đang ẩn"}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="#A7988A" />
              </Pressable>
            ))}
            {(snapshot?.team.length ?? 0) === 0 ? <Text style={styles.helperText}>Chưa có nhân sự nào. Hãy thêm nhân sự mới cho tiệm.</Text> : null}
          </View>
        </View>
      </ModalShell>


      <ModalShell title={`Thiết lập hiển thị dịch vụ · ${merchContext === "home" ? "Home" : "Explore"}`} visible={Boolean(merchForm)} onClose={() => setMerchForm(null)}>
        {merchForm ? (
          <View style={styles.formColumn}>
            <View style={styles.detailPanel}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailEyebrow}>Mẫu dịch vụ</Text>
                <Text style={styles.detailTitle}>{merchForm.name}</Text>
              </View>

              <View style={styles.detailImageCard}>
                <Text style={styles.previewLabel}>Ảnh hiện tại</Text>
                {merchForm.imageUrl ? (
                  <CachedAppImage source={{ uri: merchForm.imageUrl }} style={styles.detailHeroImage} alt={merchForm.name} />
                ) : (
                  <View style={styles.detailHeroPlaceholder}>
                    <Text style={styles.thumbPlaceholderText}>{merchForm.name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}
              </View>

              <View style={styles.detailFieldBlock}>
                <Text style={styles.detailFieldLabel}>Mô tả dịch vụ</Text>
                <TextArea
                  placeholder="Thiết kế đính charm nhỏ gọn, hợp chụp ảnh và đi tiệc."
                  value={merchForm.shortDescription}
                  onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, shortDescription: value } : prev))}
                  style={styles.detailTextarea}
                />
              </View>

              <View style={styles.detailFieldBlock}>
                <View style={styles.detailLabelRow}>
                  <Feather name="link-2" size={18} color={palette.accent} />
                  <Text style={styles.detailFieldLabel}>Link ảnh (URL)</Text>
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
                    <Text style={styles.uploadButtonText}>Tải ảnh khác</Text>
                  </Pressable>
                </View>
                <View style={styles.detailSplitItem}>
                  <Text style={styles.detailFieldLabel}>Thời gian thực hiện</Text>
                  <View style={styles.durationShell}>
                    <Feather name="clock" size={18} color={palette.sub} />
                    <Input
                      placeholder="95 phút"
                      value={merchForm.durationLabel}
                      onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, durationLabel: value } : prev))}
                      style={styles.durationInput}
                    />
                    <Feather name="chevron-down" size={18} color={palette.sub} />
                  </View>
                </View>
              </View>

              <View style={styles.detailFieldBlock}>
                <Text style={styles.detailFieldLabel}>Nổi bật tại</Text>
                <View style={styles.inlineButtons}>
                  <Chip
                    active={merchForm.featuredInHome}
                    icon="home"
                    label="Home"
                    onPress={() =>
                      setMerchForm((prev) =>
                        prev ? syncMerchLookbookState({ ...prev, featuredInHome: !prev.featuredInHome }) : prev,
                      )
                    }
                  />
                  <Chip
                    active={merchForm.featuredInExplore}
                    icon="compass"
                    label="Explore"
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
                  Bật Home hoặc Explore sẽ tự đồng bộ dịch vụ này vào lookbook để customer feed không bị rỗng sai logic.
                </Text>
              </View>

              <View style={styles.detailSplitRow}>
                <View style={styles.detailSplitItem}>
                  <View style={styles.detailLabelRow}>
                    <Feather name="home" size={18} color={palette.accent} />
                    <Text style={styles.detailFieldLabel}>Thứ tự tại Home</Text>
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
                    <Text style={styles.detailFieldLabel}>Thứ tự tại Explore</Text>
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
                <Text style={styles.detailFieldLabel}>Metadata lookbook</Text>
                <View style={styles.formColumn}>
                  <View style={styles.metadataInputShell}>
                    <Feather name="tag" size={18} color={palette.accent} />
                    <Input
                      placeholder="Nhóm lookbook"
                      value={merchForm.lookbookCategory}
                      onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, lookbookCategory: value } : prev))}
                      style={styles.metadataInput}
                    />
                  </View>
                  <View style={styles.metadataInputShell}>
                    <Feather name="bookmark" size={18} color={palette.accent} />
                    <Input
                      placeholder="Nhãn lookbook"
                      value={merchForm.lookbookBadge}
                      onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, lookbookBadge: value } : prev))}
                      style={styles.metadataInput}
                    />
                  </View>
                  <View style={styles.metadataInputShell}>
                    <Feather name="star" size={18} color={palette.accent} />
                    <Input
                      placeholder="Tone lookbook"
                      value={merchForm.lookbookTone}
                      onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, lookbookTone: value } : prev))}
                      style={styles.metadataInput}
                    />
                  </View>
                </View>
              </View>

              <Pressable style={styles.detailSaveButton} onPress={() => void saveMerchService()}>
                <Feather name="save" size={18} color="#FFFFFF" />
                <Text style={styles.detailSaveButtonText}>Lưu thay đổi</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ModalShell>

      <ModalShell title={offerForm?.id ? "Sửa ưu đãi" : "Thêm ưu đãi"} visible={Boolean(offerForm)} onClose={() => setOfferForm(null)}>
        {offerForm ? <View style={styles.formColumn}><ImagePreview uri={offerForm.imageUrl} label="Ảnh ưu đãi hiện tại" /><Input placeholder="Tiêu đề" value={offerForm.title} onChangeText={(value) => setOfferForm((prev) => (prev ? { ...prev, title: value } : prev))} /><TextArea placeholder="Mô tả" value={offerForm.description} onChangeText={(value) => setOfferForm((prev) => (prev ? { ...prev, description: value } : prev))} /><Input placeholder="URL ảnh" value={offerForm.imageUrl} onChangeText={(value) => setOfferForm((prev) => (prev ? { ...prev, imageUrl: value } : prev))} /><Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage("offers", offerForm.title || "offer", (publicUrl) => setOfferForm((prev) => (prev ? { ...prev, imageUrl: publicUrl } : prev)))}><Text style={styles.secondaryButtonText}>Tải ảnh</Text></Pressable><Input placeholder="Nhãn" value={offerForm.badge} onChangeText={(value) => setOfferForm((prev) => (prev ? { ...prev, badge: value } : prev))} /><Input placeholder="Thời gian bắt đầu (ISO)" value={offerForm.startsAt} onChangeText={(value) => setOfferForm((prev) => (prev ? { ...prev, startsAt: value } : prev))} /><Input placeholder="Thời gian kết thúc (ISO)" value={offerForm.endsAt} onChangeText={(value) => setOfferForm((prev) => (prev ? { ...prev, endsAt: value } : prev))} /><Text style={styles.rowSubtitle}>Gói ưu đãi theo hạng</Text><View style={styles.inlineButtons}>{OFFER_PACKAGE_TIERS.map((tier) => <Chip key={tier} active={offerForm.packageTier === tier} label={tier} onPress={() => setOfferForm((prev) => (prev ? { ...prev, packageTier: tier } : prev))} />)}</View><Input placeholder="Thứ tự hiển thị trong gói" keyboardType="number-pad" value={offerForm.packageOrder} onChangeText={(value) => setOfferForm((prev) => (prev ? { ...prev, packageOrder: value } : prev))} /><TextArea placeholder='Metadata JSON' value={offerForm.metadataText} onChangeText={(value) => setOfferForm((prev) => (prev ? { ...prev, metadataText: value } : prev))} /><Chip active={offerForm.isActive} label={offerForm.isActive ? "Đang bật" : "Đang tắt"} onPress={() => setOfferForm((prev) => (prev ? { ...prev, isActive: !prev.isActive } : prev))} /><Pressable style={styles.primaryButton} onPress={() => void saveOffer()}><Text style={styles.primaryButtonText}>Lưu ưu đãi</Text></Pressable></View> : null}
      </ModalShell>

      <ModalShell title={postForm?.id ? "Sửa bài feed" : "Thêm bài feed"} visible={Boolean(postForm)} onClose={() => setPostForm(null)}>
        {postForm ? <View style={styles.formColumn}><ImagePreview uri={postForm.coverImageUrl} label="Ảnh bài viết hiện tại" /><Input placeholder="Tiêu đề" value={postForm.title} onChangeText={(value) => setPostForm((prev) => (prev ? { ...prev, title: value } : prev))} /><TextArea placeholder="Tóm tắt" value={postForm.summary} onChangeText={(value) => setPostForm((prev) => (prev ? { ...prev, summary: value } : prev))} /><TextArea placeholder="Nội dung" value={postForm.body} onChangeText={(value) => setPostForm((prev) => (prev ? { ...prev, body: value } : prev))} /><Input placeholder="URL ảnh bìa" value={postForm.coverImageUrl} onChangeText={(value) => setPostForm((prev) => (prev ? { ...prev, coverImageUrl: value } : prev))} /><Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage("posts", postForm.title || "post", (publicUrl) => setPostForm((prev) => (prev ? { ...prev, coverImageUrl: publicUrl } : prev)))}><Text style={styles.secondaryButtonText}>Tải ảnh bìa</Text></Pressable><Input placeholder="Độ ưu tiên" keyboardType="number-pad" value={postForm.priority} onChangeText={(value) => setPostForm((prev) => (prev ? { ...prev, priority: value } : prev))} /><View style={styles.inlineButtons}>{(["trend", "care", "news", "offer_hint"] as const).map((item) => <Chip key={item} active={postForm.contentType === item} label={item} onPress={() => setPostForm((prev) => (prev ? { ...prev, contentType: item } : prev))} />)}</View><View style={styles.inlineButtons}>{(["draft", "approved", "published", "archived"] as const).map((item) => <Chip key={item} active={postForm.status === item} label={item} onPress={() => setPostForm((prev) => (prev ? { ...prev, status: item } : prev))} />)}</View>{postForm.id ? <Text style={styles.rowSubtitle}>Nguồn: {postForm.sourcePlatform || "mobile_admin"} {postForm.sourceMessageId ? `· msg ${postForm.sourceMessageId}` : ""}</Text> : null}<TextArea placeholder='Metadata JSON' value={postForm.metadataText} onChangeText={(value) => setPostForm((prev) => (prev ? { ...prev, metadataText: value } : prev))} /><Pressable style={styles.primaryButton} onPress={() => void savePost()}><Text style={styles.primaryButtonText}>Lưu bài viết</Text></Pressable></View> : null}
      </ModalShell>

      <ModalShell title={teamForm?.id ? "Sửa nhân sự" : "Thêm nhân sự"} visible={Boolean(teamForm)} onClose={() => setTeamForm(null)}>
        {teamForm ? <View style={styles.formColumn}><ImagePreview uri={teamForm.avatarUrl} label="Ảnh đại diện hiện tại" /><Input placeholder="Tên hiển thị" value={teamForm.displayName} onChangeText={(value) => setTeamForm((prev) => (prev ? { ...prev, displayName: value } : prev))} /><Input placeholder="Chức danh hiển thị" value={teamForm.roleLabel} onChangeText={(value) => setTeamForm((prev) => (prev ? { ...prev, roleLabel: value } : prev))} /><Input placeholder="URL ảnh đại diện" value={teamForm.avatarUrl} onChangeText={(value) => setTeamForm((prev) => (prev ? { ...prev, avatarUrl: value } : prev))} /><Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage("storefront", teamForm.displayName || "team-member", (publicUrl) => setTeamForm((prev) => (prev ? { ...prev, avatarUrl: publicUrl } : prev)))}><Text style={styles.secondaryButtonText}>Tải ảnh đại diện</Text></Pressable><TextArea placeholder="Giới thiệu ngắn" value={teamForm.bio} onChangeText={(value) => setTeamForm((prev) => (prev ? { ...prev, bio: value } : prev))} /><Input placeholder="Thứ tự hiển thị" keyboardType="number-pad" value={teamForm.displayOrder} onChangeText={(value) => setTeamForm((prev) => (prev ? { ...prev, displayOrder: value } : prev))} /><Chip active={teamForm.isVisible} label={teamForm.isVisible ? "Đang hiển thị" : "Đang ẩn"} onPress={() => setTeamForm((prev) => (prev ? { ...prev, isVisible: !prev.isVisible } : prev))} /><Pressable style={styles.primaryButton} onPress={() => void saveTeamMember()}><Text style={styles.primaryButtonText}>Lưu nhân sự</Text></Pressable></View> : null}
      </ModalShell>

      <ModalShell title={productForm?.id ? "Sửa sản phẩm" : "Thêm sản phẩm"} visible={Boolean(productForm)} onClose={() => setProductForm(null)}>
        {productForm ? <View style={styles.formColumn}><ModalFormHeader icon="shopping-bag" title={productForm.id ? "Sửa sản phẩm" : "Thêm sản phẩm"} subtitle="Điều chỉnh ảnh, giá, loại và trạng thái hiển thị của sản phẩm." /><ImagePreview uri={productForm.imageUrl} label="Ảnh sản phẩm hiện tại" /><ModalInputField icon="shopping-bag" label="Tên sản phẩm" placeholder="Combo dưỡng móng" value={productForm.name} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, name: value } : prev))} /><ModalInputField icon="align-left" label="Dòng mô tả ngắn" placeholder="Mô tả ngắn cho sản phẩm" value={productForm.subtitle} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, subtitle: value } : prev))} /><ModalInputField icon="tag" label="Nhãn giá" placeholder="299.000đ" value={productForm.priceLabel} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, priceLabel: value } : prev))} /><ModalInputField icon="image" label="URL ảnh" placeholder="https://..." value={productForm.imageUrl} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, imageUrl: value } : prev))} /><Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage("products", productForm.name || "product", (publicUrl) => setProductForm((prev) => (prev ? { ...prev, imageUrl: publicUrl } : prev)))}><Text style={styles.secondaryButtonText}>Tải ảnh</Text></Pressable><ModalInputField icon="layers" label="Loại sản phẩm" placeholder="Dưỡng móng / phụ kiện" value={productForm.productType} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, productType: value } : prev))} /><ModalInputField icon="list" label="Thứ tự hiển thị" placeholder="0" keyboardType="number-pad" value={productForm.displayOrder} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, displayOrder: value } : prev))} /><View style={styles.inlineButtons}><Chip active={productForm.isActive} label={productForm.isActive ? "Đang bật" : "Đang tắt"} onPress={() => setProductForm((prev) => (prev ? { ...prev, isActive: !prev.isActive } : prev))} /><Chip active={productForm.isFeatured} label={productForm.isFeatured ? "Nổi bật" : "Thường"} onPress={() => setProductForm((prev) => (prev ? { ...prev, isFeatured: !prev.isFeatured } : prev))} /></View><Pressable style={styles.primaryButton} onPress={() => void saveProduct()}><Text style={styles.primaryButtonText}>Lưu sản phẩm</Text></Pressable></View> : null}
      </ModalShell>

      <ModalShell title={galleryForm?.id ? "Sửa gallery" : "Thêm gallery"} visible={Boolean(galleryForm)} onClose={() => setGalleryForm(null)}>
        {galleryForm ? <View style={styles.formColumn}><ModalFormHeader icon="image" title={galleryForm.id ? "Sửa gallery" : "Thêm gallery"} subtitle="Cập nhật ảnh, loại ảnh và thứ tự hiển thị của gallery cửa tiệm." /><ImagePreview uri={galleryForm.imageUrl} label="Ảnh gallery hiện tại" /><ModalInputField icon="type" label="Tiêu đề" placeholder="Không gian nail studio" value={galleryForm.title} onChangeText={(value) => setGalleryForm((prev) => (prev ? { ...prev, title: value } : prev))} /><ModalInputField icon="image" label="URL ảnh" placeholder="https://..." value={galleryForm.imageUrl} onChangeText={(value) => setGalleryForm((prev) => (prev ? { ...prev, imageUrl: value } : prev))} /><Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage("gallery", galleryForm.title || "gallery", (publicUrl) => setGalleryForm((prev) => (prev ? { ...prev, imageUrl: publicUrl } : prev)))}><Text style={styles.secondaryButtonText}>Tải ảnh</Text></Pressable><ModalInputField icon="grid" label="Loại ảnh" placeholder="Không gian / tác phẩm / khách" value={galleryForm.kind} onChangeText={(value) => setGalleryForm((prev) => (prev ? { ...prev, kind: value } : prev))} /><ModalInputField icon="list" label="Thứ tự hiển thị" placeholder="0" keyboardType="number-pad" value={galleryForm.displayOrder} onChangeText={(value) => setGalleryForm((prev) => (prev ? { ...prev, displayOrder: value } : prev))} /><Chip active={galleryForm.isActive} label={galleryForm.isActive ? "Đang hiển thị" : "Đang ẩn"} onPress={() => setGalleryForm((prev) => (prev ? { ...prev, isActive: !prev.isActive } : prev))} /><Pressable style={styles.primaryButton} onPress={() => void saveGalleryItem()}><Text style={styles.primaryButtonText}>Lưu ảnh gallery</Text></Pressable></View> : null}
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
  rowCard: { borderRadius: 20, borderWidth: 1, borderColor: palette.border, backgroundColor: "#FFFCF9", paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "flex-start", gap: 14 },
  thumbPlaceholder: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: palette.accentSoft, borderWidth: 1, borderColor: "#E7D6C1", overflow: "hidden" },
  thumbPlaceholderText: { fontSize: 18, fontWeight: "800", color: palette.accent },
  thumbImage: { width: 58, height: 58, borderRadius: 18, backgroundColor: "#F4ECE2" },
  rowCopy: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { fontSize: 15, lineHeight: 21, fontWeight: "800", color: palette.text },
  rowSubtitle: { flexShrink: 1, fontSize: 12, lineHeight: 18, color: palette.sub },
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
  helperTitle: { fontSize: 16, lineHeight: 20, fontWeight: "800", color: palette.text },
  helperText: { fontSize: 12, lineHeight: 18, color: palette.sub },
});

