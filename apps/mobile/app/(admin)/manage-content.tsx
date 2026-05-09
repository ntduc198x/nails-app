import Feather from "@expo/vector-icons/Feather";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CachedAppImage } from "@/src/components/cached-app-image";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
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
import { getAdminHeaderTopPadding } from "@/src/features/admin/ui";
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

type OfferFormState = {
  id?: string;
  title: string;
  description: string;
  imageUrl: string;
  badge: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
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

function emptyOfferForm(): OfferFormState {
  return {
    title: "",
    description: "",
    imageUrl: "",
    badge: "",
    startsAt: "",
    endsAt: "",
    isActive: true,
    metadataText: "",
  };
}

function buildOfferForm(offer: MobileAdminOffer): OfferFormState {
  return {
    id: offer.id,
    title: offer.title,
    description: offer.description,
    imageUrl: offer.imageUrl ?? "",
    badge: offer.badge ?? "",
    startsAt: offer.startsAt ?? "",
    endsAt: offer.endsAt ?? "",
    isActive: offer.isActive,
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
  return <TextInput {...props} placeholderTextColor="#B4A89C" style={[styles.input, props.style]} />;
}

function TextArea(props: React.ComponentProps<typeof TextInput>) {
  return <Input {...props} multiline style={[styles.input, styles.textarea, props.style]} textAlignVertical="top" />;
}

function Chip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, active ? styles.chipActive : null]} onPress={onPress}>
      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
    </Pressable>
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

function SectionCard({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  children,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
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
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalScreen} edges={["top", "bottom"]}>
        <View style={[styles.modalHeader, { paddingTop: getAdminHeaderTopPadding(insets.top) }]}>
          <Pressable style={styles.headerIconButton} onPress={onClose}>
            <Feather name="chevron-left" size={22} color={palette.text} />
          </Pressable>
          <Text style={styles.modalTitle}>{title}</Text>
          <View style={styles.headerIconButton} />
        </View>
        <ScrollView contentContainerStyle={styles.modalContent}>{children}</ScrollView>
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
  const [exploreFeaturedExpanded, setExploreFeaturedExpanded] = useState(true);
  const [exploreRegularExpanded, setExploreRegularExpanded] = useState(false);

  const [merchContext, setMerchContext] = useState<MerchContext>("home");
  const [merchForm, setMerchForm] = useState<MerchFormState | null>(null);
  const [offerForm, setOfferForm] = useState<OfferFormState | null>(null);
  const [postForm, setPostForm] = useState<PostFormState | null>(null);
  const [storefrontForm, setStorefrontForm] = useState<StorefrontFormState>(buildStorefrontForm(null));
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
    return {
      title: form.title.trim(),
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim() || null,
      badge: form.badge.trim() || null,
      startsAt: form.startsAt.trim() || null,
      endsAt: form.endsAt.trim() || null,
      isActive: form.isActive,
      metadata: parseMetadata(form.metadataText),
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
      <ManageScreenShell title="Landing Feed" subtitle="Đang tải dữ liệu Home và Explore..." currentKey="content" group="setup" activeTab="booking" showTabs={false} showBackButton={false}>
        <View style={styles.stateCard}>
          <ActivityIndicator color={palette.accent} />
          <Text style={styles.stateTitle}>Đang đồng bộ nội dung hiển thị cho khách hàng...</Text>
        </View>
      </ManageScreenShell>
    );
  }

  return (
    <ManageScreenShell
      title="Landing Feed"
      subtitle="Quản lý nội dung Home và Explore"
      currentKey="content"
      group="setup"
      activeTab="booking"
      showTabs={false}
      showBackButton={false}
      onRefresh={() => void Promise.all([loadBranchOptions(), loadSnapshot(), loadServices(true)])}
      refreshing={loading || servicesLoading}
    >
      <View style={styles.heroRow}>
        <Chip active={activeTab === "home"} label="Home" onPress={() => setActiveTab("home")} />
        <Chip active={activeTab === "explore"} label="Explore" onPress={() => setActiveTab("explore")} />
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
          <SectionCard title={`Lookbook Home (${homeServices.length} đang bật / ${lookbookServices.length} mẫu)`} subtitle="Chỉ hiển thị dịch vụ có metadata lookbook. Dịch vụ thường sẽ không nằm ở khu này." actionLabel={homeServicesExpanded ? "Thu gọn" : "Mở rộng"} onActionPress={() => setHomeServicesExpanded((current) => !current)}>
            {homeServicesExpanded ? (
              <>
            <Input placeholder="Tìm dịch vụ lookbook cho Home..." value={homeServiceQuery} onChangeText={setHomeServiceQuery} />
            <View style={styles.listColumn}>
              {homeLookbookServices.map((service) => (
                <Pressable
                  key={service.id}
                  style={styles.rowCard}
                  onPress={() => {
                    setMerchContext("home");
                    setMerchForm(buildMerchForm(service));
                  }}
                >
                  <ItemThumbnail uri={service.imageUrl} label={service.name} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{service.name}</Text>
                    <Text style={styles.rowSubtitle}>
                      Home: {service.featuredInHome ? `Bật · thứ tự ${service.displayOrderHome}` : "Tắt"} · {service.lookbookBadge || service.lookbookCategory || "Lookbook"}
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
            title={`Ưu đãi (${snapshot?.offers.length ?? 0})`}
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
            title={`Bài feed (${snapshot?.posts.length ?? 0})`}
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
            <View style={styles.formColumn}>
              <Input placeholder="Slug hiển thị" value={storefrontForm.slug} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, slug: value }))} />
              <Input placeholder="Tên tiệm" value={storefrontForm.name} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, name: value }))} />
              <Input placeholder="Nhóm tiệm" value={storefrontForm.category} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, category: value }))} />
              <TextArea placeholder="Mô tả" value={storefrontForm.description} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, description: value }))} />
              <Input placeholder="URL ảnh bìa" value={storefrontForm.coverImageUrl} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, coverImageUrl: value }))} />
              <Input placeholder="URL logo" value={storefrontForm.logoImageUrl} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, logoImageUrl: value }))} />
              <View style={styles.inlineButtons}>
                <Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage("storefront", storefrontForm.name || "storefront-cover", (publicUrl) => setStorefrontForm((prev) => ({ ...prev, coverImageUrl: publicUrl })))}><Text style={styles.secondaryButtonText}>Tải ảnh bìa</Text></Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage("storefront", storefrontForm.name || "storefront-logo", (publicUrl) => setStorefrontForm((prev) => ({ ...prev, logoImageUrl: publicUrl })))}><Text style={styles.secondaryButtonText}>Tải logo</Text></Pressable>
              </View>
              <ImagePreview uri={storefrontForm.coverImageUrl} label="Ảnh bìa hiện tại" />
              <ImagePreview uri={storefrontForm.logoImageUrl} label="Logo hiện tại" />
              <Input placeholder="Điểm đánh giá" value={storefrontForm.rating} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, rating: value }))} keyboardType="decimal-pad" />
              <Input placeholder="Nhãn đánh giá" value={storefrontForm.reviewsLabel} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, reviewsLabel: value }))} />
              <Input placeholder="Địa chỉ hiển thị" value={storefrontForm.addressLine} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, addressLine: value }))} />
              <Input placeholder="URL bản đồ" value={storefrontForm.mapUrl} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, mapUrl: value }))} />
              <Input placeholder="Giờ mở cửa" value={storefrontForm.openingHours} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, openingHours: value }))} />
              <Input placeholder="Số điện thoại" value={storefrontForm.phone} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, phone: value }))} />
              <Input placeholder="URL Messenger" value={storefrontForm.messengerUrl} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, messengerUrl: value }))} />
              <Input placeholder="URL Instagram" value={storefrontForm.instagramUrl} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, instagramUrl: value }))} />
              <TextArea placeholder="Điểm nổi bật, mỗi dòng 1 ý" value={storefrontForm.highlightsText} onChangeText={(value) => setStorefrontForm((prev) => ({ ...prev, highlightsText: value }))} />
              <View style={styles.inlineButtons}>
                <Chip active={storefrontForm.isActive} label={storefrontForm.isActive ? "Đang hiển thị" : "Đang ẩn"} onPress={() => setStorefrontForm((prev) => ({ ...prev, isActive: !prev.isActive }))} />
                <Pressable style={styles.primaryButton} onPress={() => void saveStorefront()}><Text style={styles.primaryButtonText}>Lưu hồ sơ tiệm</Text></Pressable>
              </View>
            </View>
          </SectionCard>

          <SectionCard title={`Dịch vụ nổi bật (${exploreServices.length})`} subtitle="Chỉ hiển thị dịch vụ có metadata lookbook. Dịch vụ thường nằm ở Sản phẩm & phụ kiện." actionLabel={exploreFeaturedExpanded ? "Thu gọn" : "Mở rộng"} onActionPress={() => setExploreFeaturedExpanded((current) => !current)}>
            {exploreFeaturedExpanded ? (
              <>
            <Input placeholder="Tìm dịch vụ lookbook cho Explore..." value={exploreFeaturedQuery} onChangeText={setExploreFeaturedQuery} />
            <View style={styles.listColumn}>
              {exploreFeaturedServices.map((service) => (
                <Pressable key={service.id} style={styles.rowCard} onPress={() => {
                  setMerchContext("explore");
                  setMerchForm(buildMerchForm(service));
                  }}>
                    <ItemThumbnail uri={service.imageUrl} label={service.name} />
                    <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{service.name}</Text>
                    <Text style={styles.rowSubtitle}>Explore: {service.featuredInExplore ? `Bật · thứ tự ${service.displayOrderExplore}` : "Tắt"} · {service.lookbookBadge || "Lookbook"}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#A7988A" />
                </Pressable>
              ))}
            </View>
              </>
            ) : null}
          </SectionCard>

          <SectionCard title={`Sản phẩm & phụ kiện (${snapshot?.products.length ?? 0})`} subtitle="Danh sách này đồng bộ trực tiếp với Khám phá" actionLabel="Thêm sản phẩm" onActionPress={() => setProductForm(emptyProductForm())}>
            <View style={styles.listColumn}>
              {(snapshot?.products ?? []).map((product) => (
                <View key={product.id} style={styles.rowCard}>
                  <ItemThumbnail uri={product.imageUrl} label={product.name} />
                  <Pressable style={styles.rowCopy} onPress={() => setProductForm(buildProductForm(product))}>
                    <Text style={styles.rowTitle}>{product.name}</Text>
                    <Text style={styles.rowSubtitle}>{product.productType || "Không có loại"} · {product.priceLabel || "Không có giá"} · {product.isActive ? "Đang hiển thị" : "Đang ẩn"}</Text>
                  </Pressable>
                  <Pressable style={styles.iconButton} onPress={() => void confirmTask("Xóa sản phẩm", "Sản phẩm này sẽ bị gỡ khỏi tiệm.", async () => {
                    if (!mobileSupabase) return;
                    await deleteAdminStorefrontProductForMobile(mobileSupabase, product.id);
                  })}>
                    <Feather name="trash-2" size={16} color={palette.danger} />
                  </Pressable>
                </View>
              ))}
            </View>
          </SectionCard>

          <SectionCard title={`Dịch vụ thường dự phòng (${exploreRegularServices.length})`} subtitle="Chỉ dùng khi sản phẩm & phụ kiện chưa có dữ liệu. Nguồn này lấy từ bảng services." actionLabel={exploreRegularExpanded ? "Thu gọn" : "Mở rộng"} onActionPress={() => setExploreRegularExpanded((current) => !current)}>
            {exploreRegularExpanded ? (
              <>
            <Input placeholder="Tìm dịch vụ thường cho Khám phá..." value={exploreRegularQuery} onChangeText={setExploreRegularQuery} />
            <View style={styles.listColumn}>
              {exploreRegularServices.map((service) => (
                <Pressable
                  key={service.id}
                  style={styles.rowCard}
                  onPress={() => {
                    setMerchContext("explore");
                    setMerchForm(buildMerchForm(service));
                  }}
                >
                  <ItemThumbnail uri={service.imageUrl} label={service.name} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{service.name}</Text>
                    <Text style={styles.rowSubtitle}>Explore card thường · {service.priceLabel} · {service.durationLabel || "Chưa có thời lượng"}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#A7988A" />
                </Pressable>
              ))}
            </View>
              </>
            ) : null}
          </SectionCard>

          <SectionCard title={`Nhân sự tiệm (${snapshot?.team.length ?? 0})`} actionLabel="Thêm nhân sự" onActionPress={() => setTeamForm(emptyTeamForm())}>
            <View style={styles.listColumn}>
              {(snapshot?.team ?? []).map((member) => (
                <View key={member.id} style={styles.rowCard}>
                  <ItemThumbnail uri={member.avatarUrl} label={member.displayName} />
                  <Pressable style={styles.rowCopy} onPress={() => setTeamForm(buildTeamForm(member))}>
                    <Text style={styles.rowTitle}>{member.displayName}</Text>
                    <Text style={styles.rowSubtitle}>{member.roleLabel || "Không có vai trò"} · {member.isVisible ? "Đang hiển thị" : "Đang ẩn"}</Text>
                  </Pressable>
                  <Pressable style={styles.iconButton} onPress={() => void confirmTask("Xóa nhân sự", "Nhân sự này sẽ bị gỡ khỏi tiệm.", async () => {
                    if (!mobileSupabase) return;
                    await deleteAdminStorefrontTeamMemberForMobile(mobileSupabase, member.id);
                  })}>
                    <Feather name="trash-2" size={16} color={palette.danger} />
                  </Pressable>
                </View>
              ))}
            </View>
          </SectionCard>

          <SectionCard title={`Thư viện ảnh (${snapshot?.gallery.length ?? 0})`} actionLabel="Thêm ảnh" onActionPress={() => setGalleryForm(emptyGalleryForm())}>
            <View style={styles.listColumn}>
              {(snapshot?.gallery ?? []).map((item) => (
                <View key={item.id} style={styles.rowCard}>
                  <ItemThumbnail uri={item.imageUrl} label={item.title || item.kind || "Ảnh gallery"} />
                  <Pressable style={styles.rowCopy} onPress={() => setGalleryForm(buildGalleryForm(item))}>
                    <Text style={styles.rowTitle}>{item.title || item.kind || "Ảnh trong gallery"}</Text>
                    <Text style={styles.rowSubtitle}>{item.kind || "Không có loại"} · {item.isActive ? "Đang hiển thị" : "Đang ẩn"}</Text>
                  </Pressable>
                  <Pressable style={styles.iconButton} onPress={() => void confirmTask("Xóa gallery", "Ảnh này sẽ bị gỡ khỏi tiệm.", async () => {
                    if (!mobileSupabase) return;
                    await deleteAdminStorefrontGalleryItemForMobile(mobileSupabase, item.id);
                  })}>
                    <Feather name="trash-2" size={16} color={palette.danger} />
                  </Pressable>
                </View>
              ))}
            </View>
          </SectionCard>
        </>
      )}

      <ModalShell title={`Thiết lập hiển thị dịch vụ · ${merchContext}`} visible={Boolean(merchForm)} onClose={() => setMerchForm(null)}>
        {merchForm ? <View style={styles.formColumn}><Text style={styles.helperTitle}>{merchForm.name}</Text><ImagePreview uri={merchForm.imageUrl} label="Ảnh hiện tại" /><TextArea placeholder="Mô tả ngắn" value={merchForm.shortDescription} onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, shortDescription: value } : prev))} /><Input placeholder="URL ảnh" value={merchForm.imageUrl} onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, imageUrl: value } : prev))} /><Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage("storefront", merchForm.name, (publicUrl) => setMerchForm((prev) => (prev ? { ...prev, imageUrl: publicUrl } : prev)))}><Text style={styles.secondaryButtonText}>Tải ảnh</Text></Pressable><Input placeholder="Nhãn thời lượng" value={merchForm.durationLabel} onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, durationLabel: value } : prev))} /><View style={styles.inlineButtons}><Chip active={merchForm.featuredInHome} label="Nổi bật ở Home" onPress={() => setMerchForm((prev) => (prev ? syncMerchLookbookState({ ...prev, featuredInHome: !prev.featuredInHome }) : prev))} /><Chip active={merchForm.featuredInExplore} label="Nổi bật ở Explore" onPress={() => setMerchForm((prev) => (prev ? syncMerchLookbookState({ ...prev, featuredInExplore: !prev.featuredInExplore }) : prev))} /></View><Text style={styles.helperText}>Bật Home hoặc Explore sẽ tự đồng bộ dịch vụ này vào lookbook để customer feed không bị rỗng sai logic.</Text><Input placeholder="Thứ tự ở Home" keyboardType="number-pad" value={merchForm.displayOrderHome} onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, displayOrderHome: value } : prev))} /><Input placeholder="Thứ tự ở Explore" keyboardType="number-pad" value={merchForm.displayOrderExplore} onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, displayOrderExplore: value } : prev))} /><Input placeholder="Nhóm lookbook" value={merchForm.lookbookCategory} onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, lookbookCategory: value } : prev))} /><Input placeholder="Nhãn lookbook" value={merchForm.lookbookBadge} onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, lookbookBadge: value } : prev))} /><Input placeholder="Tone lookbook" value={merchForm.lookbookTone} onChangeText={(value) => setMerchForm((prev) => (prev ? { ...prev, lookbookTone: value } : prev))} /><Pressable style={styles.primaryButton} onPress={() => void saveMerchService()}><Text style={styles.primaryButtonText}>Lưu hiển thị dịch vụ</Text></Pressable></View> : null}
      </ModalShell>

      <ModalShell title={offerForm?.id ? "Sửa ưu đãi" : "Thêm ưu đãi"} visible={Boolean(offerForm)} onClose={() => setOfferForm(null)}>
        {offerForm ? <View style={styles.formColumn}><ImagePreview uri={offerForm.imageUrl} label="Ảnh ưu đãi hiện tại" /><Input placeholder="Tiêu đề" value={offerForm.title} onChangeText={(value) => setOfferForm((prev) => (prev ? { ...prev, title: value } : prev))} /><TextArea placeholder="Mô tả" value={offerForm.description} onChangeText={(value) => setOfferForm((prev) => (prev ? { ...prev, description: value } : prev))} /><Input placeholder="URL ảnh" value={offerForm.imageUrl} onChangeText={(value) => setOfferForm((prev) => (prev ? { ...prev, imageUrl: value } : prev))} /><Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage("offers", offerForm.title || "offer", (publicUrl) => setOfferForm((prev) => (prev ? { ...prev, imageUrl: publicUrl } : prev)))}><Text style={styles.secondaryButtonText}>Tải ảnh</Text></Pressable><Input placeholder="Nhãn" value={offerForm.badge} onChangeText={(value) => setOfferForm((prev) => (prev ? { ...prev, badge: value } : prev))} /><Input placeholder="Thời gian bắt đầu (ISO)" value={offerForm.startsAt} onChangeText={(value) => setOfferForm((prev) => (prev ? { ...prev, startsAt: value } : prev))} /><Input placeholder="Thời gian kết thúc (ISO)" value={offerForm.endsAt} onChangeText={(value) => setOfferForm((prev) => (prev ? { ...prev, endsAt: value } : prev))} /><TextArea placeholder='Metadata JSON' value={offerForm.metadataText} onChangeText={(value) => setOfferForm((prev) => (prev ? { ...prev, metadataText: value } : prev))} /><Chip active={offerForm.isActive} label={offerForm.isActive ? "Đang bật" : "Đang tắt"} onPress={() => setOfferForm((prev) => (prev ? { ...prev, isActive: !prev.isActive } : prev))} /><Pressable style={styles.primaryButton} onPress={() => void saveOffer()}><Text style={styles.primaryButtonText}>Lưu ưu đãi</Text></Pressable></View> : null}
      </ModalShell>

      <ModalShell title={postForm?.id ? "Sửa bài feed" : "Thêm bài feed"} visible={Boolean(postForm)} onClose={() => setPostForm(null)}>
        {postForm ? <View style={styles.formColumn}><ImagePreview uri={postForm.coverImageUrl} label="Ảnh bài viết hiện tại" /><Input placeholder="Tiêu đề" value={postForm.title} onChangeText={(value) => setPostForm((prev) => (prev ? { ...prev, title: value } : prev))} /><TextArea placeholder="Tóm tắt" value={postForm.summary} onChangeText={(value) => setPostForm((prev) => (prev ? { ...prev, summary: value } : prev))} /><TextArea placeholder="Nội dung" value={postForm.body} onChangeText={(value) => setPostForm((prev) => (prev ? { ...prev, body: value } : prev))} /><Input placeholder="URL ảnh bìa" value={postForm.coverImageUrl} onChangeText={(value) => setPostForm((prev) => (prev ? { ...prev, coverImageUrl: value } : prev))} /><Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage("posts", postForm.title || "post", (publicUrl) => setPostForm((prev) => (prev ? { ...prev, coverImageUrl: publicUrl } : prev)))}><Text style={styles.secondaryButtonText}>Tải ảnh bìa</Text></Pressable><Input placeholder="Độ ưu tiên" keyboardType="number-pad" value={postForm.priority} onChangeText={(value) => setPostForm((prev) => (prev ? { ...prev, priority: value } : prev))} /><View style={styles.inlineButtons}>{(["trend", "care", "news", "offer_hint"] as const).map((item) => <Chip key={item} active={postForm.contentType === item} label={item} onPress={() => setPostForm((prev) => (prev ? { ...prev, contentType: item } : prev))} />)}</View><View style={styles.inlineButtons}>{(["draft", "approved", "published", "archived"] as const).map((item) => <Chip key={item} active={postForm.status === item} label={item} onPress={() => setPostForm((prev) => (prev ? { ...prev, status: item } : prev))} />)}</View>{postForm.id ? <Text style={styles.rowSubtitle}>Nguồn: {postForm.sourcePlatform || "mobile_admin"} {postForm.sourceMessageId ? `· msg ${postForm.sourceMessageId}` : ""}</Text> : null}<TextArea placeholder='Metadata JSON' value={postForm.metadataText} onChangeText={(value) => setPostForm((prev) => (prev ? { ...prev, metadataText: value } : prev))} /><Pressable style={styles.primaryButton} onPress={() => void savePost()}><Text style={styles.primaryButtonText}>Lưu bài viết</Text></Pressable></View> : null}
      </ModalShell>

      <ModalShell title={teamForm?.id ? "Sửa nhân sự" : "Thêm nhân sự"} visible={Boolean(teamForm)} onClose={() => setTeamForm(null)}>
        {teamForm ? <View style={styles.formColumn}><ImagePreview uri={teamForm.avatarUrl} label="Ảnh đại diện hiện tại" /><Input placeholder="Tên hiển thị" value={teamForm.displayName} onChangeText={(value) => setTeamForm((prev) => (prev ? { ...prev, displayName: value } : prev))} /><Input placeholder="Chức danh hiển thị" value={teamForm.roleLabel} onChangeText={(value) => setTeamForm((prev) => (prev ? { ...prev, roleLabel: value } : prev))} /><Input placeholder="URL ảnh đại diện" value={teamForm.avatarUrl} onChangeText={(value) => setTeamForm((prev) => (prev ? { ...prev, avatarUrl: value } : prev))} /><Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage("storefront", teamForm.displayName || "team-member", (publicUrl) => setTeamForm((prev) => (prev ? { ...prev, avatarUrl: publicUrl } : prev)))}><Text style={styles.secondaryButtonText}>Tải ảnh đại diện</Text></Pressable><TextArea placeholder="Giới thiệu ngắn" value={teamForm.bio} onChangeText={(value) => setTeamForm((prev) => (prev ? { ...prev, bio: value } : prev))} /><Input placeholder="Thứ tự hiển thị" keyboardType="number-pad" value={teamForm.displayOrder} onChangeText={(value) => setTeamForm((prev) => (prev ? { ...prev, displayOrder: value } : prev))} /><Chip active={teamForm.isVisible} label={teamForm.isVisible ? "Đang hiển thị" : "Đang ẩn"} onPress={() => setTeamForm((prev) => (prev ? { ...prev, isVisible: !prev.isVisible } : prev))} /><Pressable style={styles.primaryButton} onPress={() => void saveTeamMember()}><Text style={styles.primaryButtonText}>Lưu nhân sự</Text></Pressable></View> : null}
      </ModalShell>

      <ModalShell title={productForm?.id ? "Sửa sản phẩm" : "Thêm sản phẩm"} visible={Boolean(productForm)} onClose={() => setProductForm(null)}>
        {productForm ? <View style={styles.formColumn}><ImagePreview uri={productForm.imageUrl} label="Ảnh sản phẩm hiện tại" /><Input placeholder="Tên sản phẩm" value={productForm.name} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, name: value } : prev))} /><Input placeholder="Dòng mô tả ngắn" value={productForm.subtitle} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, subtitle: value } : prev))} /><Input placeholder="Nhãn giá" value={productForm.priceLabel} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, priceLabel: value } : prev))} /><Input placeholder="URL ảnh" value={productForm.imageUrl} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, imageUrl: value } : prev))} /><Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage("products", productForm.name || "product", (publicUrl) => setProductForm((prev) => (prev ? { ...prev, imageUrl: publicUrl } : prev)))}><Text style={styles.secondaryButtonText}>Tải ảnh</Text></Pressable><Input placeholder="Loại sản phẩm" value={productForm.productType} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, productType: value } : prev))} /><Input placeholder="Thứ tự hiển thị" keyboardType="number-pad" value={productForm.displayOrder} onChangeText={(value) => setProductForm((prev) => (prev ? { ...prev, displayOrder: value } : prev))} /><View style={styles.inlineButtons}><Chip active={productForm.isActive} label={productForm.isActive ? "Đang bật" : "Đang tắt"} onPress={() => setProductForm((prev) => (prev ? { ...prev, isActive: !prev.isActive } : prev))} /><Chip active={productForm.isFeatured} label={productForm.isFeatured ? "Nổi bật" : "Thường"} onPress={() => setProductForm((prev) => (prev ? { ...prev, isFeatured: !prev.isFeatured } : prev))} /></View><Pressable style={styles.primaryButton} onPress={() => void saveProduct()}><Text style={styles.primaryButtonText}>Lưu sản phẩm</Text></Pressable></View> : null}
      </ModalShell>

      <ModalShell title={galleryForm?.id ? "Sửa gallery" : "Thêm gallery"} visible={Boolean(galleryForm)} onClose={() => setGalleryForm(null)}>
        {galleryForm ? <View style={styles.formColumn}><ImagePreview uri={galleryForm.imageUrl} label="Ảnh gallery hiện tại" /><Input placeholder="Tiêu đề" value={galleryForm.title} onChangeText={(value) => setGalleryForm((prev) => (prev ? { ...prev, title: value } : prev))} /><Input placeholder="URL ảnh" value={galleryForm.imageUrl} onChangeText={(value) => setGalleryForm((prev) => (prev ? { ...prev, imageUrl: value } : prev))} /><Pressable style={styles.secondaryButton} onPress={() => void pickAndUploadImage("gallery", galleryForm.title || "gallery", (publicUrl) => setGalleryForm((prev) => (prev ? { ...prev, imageUrl: publicUrl } : prev)))}><Text style={styles.secondaryButtonText}>Tải ảnh</Text></Pressable><Input placeholder="Loại ảnh" value={galleryForm.kind} onChangeText={(value) => setGalleryForm((prev) => (prev ? { ...prev, kind: value } : prev))} /><Input placeholder="Thứ tự hiển thị" keyboardType="number-pad" value={galleryForm.displayOrder} onChangeText={(value) => setGalleryForm((prev) => (prev ? { ...prev, displayOrder: value } : prev))} /><Chip active={galleryForm.isActive} label={galleryForm.isActive ? "Đang hiển thị" : "Đang ẩn"} onPress={() => setGalleryForm((prev) => (prev ? { ...prev, isActive: !prev.isActive } : prev))} /><Pressable style={styles.primaryButton} onPress={() => void saveGalleryItem()}><Text style={styles.primaryButtonText}>Lưu ảnh gallery</Text></Pressable></View> : null}
      </ModalShell>
    </ManageScreenShell>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginTop: -8,
    marginBottom: 4,
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
    minHeight: 46,
    paddingHorizontal: 20,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    justifyContent: "center",
    alignItems: "center",
  },
  chipActive: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
  chipText: { fontSize: 13, fontWeight: "700", color: palette.sub },
  chipTextActive: { color: palette.accent, fontWeight: "800" },
  inlineNotice: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: palette.mutedSoft, borderWidth: 1, borderColor: palette.border },
  inlineNoticeText: { flex: 1, color: palette.sub, fontSize: 12, lineHeight: 17 },
  sectionCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
    shadowColor: "#2A1E14",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  sectionHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  sectionCopy: { flex: 1, gap: 4 },
  sectionTitle: { fontSize: 20, lineHeight: 28, fontWeight: "800", color: palette.text },
  sectionSubtitle: { fontSize: 14, lineHeight: 22, color: palette.sub },
  actionButton: { minHeight: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: palette.accentSoft, justifyContent: "center", alignItems: "center" },
  actionButtonText: { fontSize: 12, fontWeight: "800", color: palette.accent },
  listColumn: { gap: 10 },
  rowCard: { borderRadius: 22, borderWidth: 1, borderColor: palette.border, backgroundColor: "#FFFCF9", paddingHorizontal: 18, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  thumbPlaceholder: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: palette.accentSoft, borderWidth: 1, borderColor: "#E7D6C1", overflow: "hidden" },
  thumbPlaceholderText: { fontSize: 18, fontWeight: "800", color: palette.accent },
  thumbImage: { width: 58, height: 58, borderRadius: 18, backgroundColor: "#F4ECE2" },
  rowCopy: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 16, lineHeight: 22, fontWeight: "800", color: palette.text },
  rowSubtitle: { fontSize: 13, lineHeight: 19, color: palette.sub },
  iconButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF6F2", borderWidth: 1, borderColor: "#F3DFD7" },
  stateCard: { borderRadius: 18, paddingVertical: 20, paddingHorizontal: 16, alignItems: "center", gap: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  stateTitle: { color: palette.sub, fontSize: 13, lineHeight: 18, textAlign: "center" },
  modalScreen: { flex: 1, backgroundColor: "#FCFAF8" },
  modalHeader: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: palette.border },
  headerIconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  modalTitle: { flex: 1, textAlign: "center", fontSize: 18, lineHeight: 22, fontWeight: "800", color: palette.text },
  modalContent: { padding: 16, gap: 12 },
  formColumn: { gap: 12 },
  input: { minHeight: 52, borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingVertical: 13, color: palette.text, fontSize: 14 },
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
