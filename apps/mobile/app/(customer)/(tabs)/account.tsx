import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { listCustomerFavoriteServices, type CustomerFavoriteService } from "@nails/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { uploadPickedAdminContentImage } from "@/src/features/admin/content-images";
import { resizeAvatarImage } from "@/src/features/admin/content-images";
import { FALLBACK_SERVICES } from "@/src/features/customer/data";
import { CustomerImagePreviewModal } from "@/src/features/customer/image-preview-modal";
import { useCustomerStrings } from "@/src/features/customer/strings";
import { CustomerScreen, CustomerTopActions, SurfaceCard } from "@/src/features/customer/ui";
import { CustomerCachedImage } from "@/src/features/customer/cached-image";
import { useCustomerFavorites } from "@/src/hooks/use-customer-favorites";
import { useCustomerBookingTimeline } from "@/src/hooks/use-customer-booking-timeline";
import { mobileSupabase } from "@/src/lib/supabase";
import { useCustomerMembership } from "@/src/hooks/use-customer-membership";
import { useLookbookServices } from "@/src/hooks/use-lookbook-services";
import { prefetchCustomerImagesForIntent } from "@/src/lib/customer-image-cache";
import { upsertAndVerifyCustomerProfile } from "@/src/lib/customer-profile";
import { readCustomerProfileCache, writeCustomerProfileCache } from "@/src/lib/customer-profile-cache";
import { useSession } from "@/src/providers/session-provider";
import { useCustomerTheme } from "@/src/providers/customer-preferences-provider";

type TabKey = "history" | "favorites" | "info";

function parseTabKey(value?: string | string[]): TabKey | null {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (rawValue === "history" || rawValue === "favorites" || rawValue === "info") {
    return rawValue;
  }

  return null;
}

function formatBirthDateLabel(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function parseBirthDateValue(value: string) {
  if (!value) {
    return new Date(2000, 0, 1);
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(2000, 0, 1);
  }

  return parsed;
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTierGradient(tierKey: string | null | undefined) {
  switch ((tierKey || "bronze").toLowerCase()) {
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

function getTierIconName(tierKey: string | null | undefined): React.ComponentProps<typeof Feather>["name"] {
  switch ((tierKey || "bronze").toLowerCase()) {
    case "silver":
      return "shield";
    case "gold":
      return "star";
    case "platinum":
      return "zap";
    case "diamond":
      return "hexagon";
    case "bronze":
    default:
      return "award";
  }
}

function getHistoryStatusBadgeStyle(status: string, theme: ReturnType<typeof useCustomerTheme>) {
  switch (status) {
    case "DONE":
      return {
        backgroundColor: theme.colors.successBg,
        borderColor: "#CFEED9",
        textColor: theme.colors.successText,
      };
    case "CONFIRMED":
    case "BOOKED":
    case "CHECKED_IN":
    case "IN_SERVICE":
      return {
        backgroundColor: "#F2EEFF",
        borderColor: "#DDD3FF",
        textColor: "#6F52D9",
      };
    case "NEW":
    case "NEEDS_RESCHEDULE":
    case "CONVERTED":
      return {
        backgroundColor: theme.colors.warningBg,
        borderColor: "#F0D8B3",
        textColor: theme.colors.warningText,
      };
    case "CANCELLED":
    case "NO_SHOW":
    case "EXPIRED_UNCONFIRMED":
      return {
        backgroundColor: theme.colors.dangerBg,
        borderColor: "#F3C8C1",
        textColor: theme.colors.dangerText,
      };
    default:
      return {
        backgroundColor: theme.colors.accentSoft,
        borderColor: theme.colors.border,
        textColor: theme.colors.textSoft,
      };
  }
}

export default function AccountScreen() {
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const theme = useCustomerTheme();
  const strings = useCustomerStrings();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const TABS = useMemo(
    () =>
      [
        { key: "history", label: strings.profileHistory, icon: "calendar" },
        { key: "favorites", label: strings.profileFavorites, icon: "heart" },
        { key: "info", label: strings.profileInfo, icon: "file-text" },
      ] as const,
    [strings.profileFavorites, strings.profileHistory, strings.profileInfo],
  );
  const { isBusy, signOut, user } = useSession();
  const { favoriteIds, refresh: refreshFavorites, isHydrated: favoritesHydrated } = useCustomerFavorites({ autoRefreshOnMount: false });
  const { historyItems, isHydrated: historyHydrated, isLoading: historyLoading, refresh: refreshTimeline, syncFromCache: syncTimelineFromCache } =
    useCustomerBookingTimeline({ historyLimit: 8, upcomingLimit: 6 });
  const { currentTier, nextTier, pointsBalance, remainingSpentToNext, remainingVisitsToNext, eligibleVisitsMinSpend, offers } = useCustomerMembership({ autoRefreshOnMount: false });
  const { refresh: refreshLookbook, services, syncFromCache: syncLookbookFromCache } = useLookbookServices(FALLBACK_SERVICES, { autoRefreshOnMount: false });
  const [manualTab, setManualTab] = useState<TabKey | null>(null);
  const routeTab = parseTabKey(params.tab);
  const currentTab = manualTab ?? routeTab ?? "history";
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [form, setForm] = useState({
    name: user?.displayName?.trim() || user?.email?.split("@")[0] || "",
    birthDate: "",
    phone: "",
    email: user?.email ?? "",
    address: "",
  });
  const [isBirthDatePickerOpen, setIsBirthDatePickerOpen] = useState(false);
  const [birthDateDraft, setBirthDateDraft] = useState<Date>(parseBirthDateValue(""));
  const [favoriteServices, setFavoriteServices] = useState<CustomerFavoriteService[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadFavoriteServices() {
      if (!mobileSupabase || !favoriteIds.length) {
        if (!cancelled) setFavoriteServices([]);
        return;
      }

      try {
        const mapped = await listCustomerFavoriteServices(mobileSupabase);
        if (!cancelled) {
          setFavoriteServices(mapped);
        }
      } catch {
        if (!cancelled) {
          setFavoriteServices([]);
        }
      }
    }

    void loadFavoriteServices();
    return () => {
      cancelled = true;
    };
  }, [favoriteIds]);

  const displayAvatar = useMemo(() => {
    if (avatarUri?.trim()) {
      return avatarUri.trim();
    }

    const seed = encodeURIComponent(form.name.trim() || user?.email?.trim() || "Customer");
    return `https://ui-avatars.com/api/?name=${seed}&background=B4937D&color=FFFFFF&size=256`;
  }, [avatarUri, form.name, user?.email]);

  const membershipThemeKey = currentTier?.themeKey || currentTier?.code || "bronze";
  const membershipCardGradient = getTierGradient(membershipThemeKey);
  const membershipIconName = getTierIconName(membershipThemeKey);

  const membershipBlurb = useMemo(() => {
    if (!currentTier && nextTier) {
      const parts: string[] = [];
      if (remainingSpentToNext > 0) {
        parts.push(`${remainingSpentToNext.toLocaleString("vi-VN")}đ chi tiêu`);
      }
      if (remainingVisitsToNext > 0) {
        parts.push(`${remainingVisitsToNext.toLocaleString("vi-VN")} lượt hẹn chuẩn`);
      }

      return parts.length
        ? `Bạn đang là thành viên thường. Còn ${parts.join(" hoặc ")} để lên ${nextTier.name}.`
        : `Bạn đang là thành viên thường. Mục tiêu tiếp theo là ${nextTier.name}.`;
    }

    if (!nextTier) {
      return `Đang ở hạng ${currentTier?.name ?? "cao nhất"} với ${pointsBalance.toLocaleString("vi-VN")} điểm.`;
    }

    const parts: string[] = [];
    if (remainingSpentToNext > 0) {
      parts.push(`${remainingSpentToNext.toLocaleString("vi-VN")}đ chi tiêu`);
    }
    if (remainingVisitsToNext > 0) {
      parts.push(`${remainingVisitsToNext.toLocaleString("vi-VN")} lượt hẹn chuẩn`);
    }

    return parts.length
      ? `Còn ${parts.join(" hoặc ")} để lên ${nextTier.name}.`
      : `Mục tiêu tiếp theo là ${nextTier.name}.`;
  }, [currentTier, nextTier, pointsBalance, remainingSpentToNext, remainingVisitsToNext]);

  const summary = useMemo(() => {
    const totalSpent = historyItems.reduce((sum, item) => {
      const numericPrice = Number((item.servicePriceLabel ?? "0").replace(/[^\d]/g, ""));
      return sum + numericPrice;
    }, 0);

    return {
      totalSpent: `${totalSpent.toLocaleString("vi-VN")}đ`,
      totalVisits: String(eligibleVisitsMinSpend),
      offerWallet: String(offers.length),
    };
  }, [eligibleVisitsMinSpend, historyItems, offers.length]);

  const loadProfile = useCallback(async (options: { forceRemote?: boolean } = {}) => {
    const cached = user?.id ? await readCustomerProfileCache(user.id) : null;
    if (cached?.avatarUrl) {
      setAvatarUri(cached.avatarUrl);
      void prefetchCustomerImagesForIntent([cached.avatarUrl], "avatar");
    }

    if (!user?.id) {
      setForm((current) => ({ ...current, email: user?.email ?? "" }));
      return;
    }

    if (cached) {
      setForm({
        name: cached.displayName || user.displayName?.trim() || user.email?.split("@")[0] || "",
        birthDate: cached.birthDate || "",
        phone: cached.phone || "",
        email: user.email ?? "",
        address: cached.address || "",
      });

      if (!options.forceRemote) {
        return;
      }
    }

    const {
      data: { user: authUser },
    } = mobileSupabase ? await mobileSupabase.auth.getUser() : { data: { user: null } };
    const avatarFromMetadata =
      typeof authUser?.user_metadata?.avatar_url === "string" && authUser.user_metadata.avatar_url.trim()
        ? authUser.user_metadata.avatar_url.trim()
        : null;

    setAvatarUri(avatarFromMetadata);
    if (avatarFromMetadata) {
      void prefetchCustomerImagesForIntent([avatarFromMetadata], "avatar");
    }

    if (!mobileSupabase) {
      return;
    }

    try {
      const customerAccountResult = await mobileSupabase
        .from("customer_accounts")
        .select("org_id,customer_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (customerAccountResult.error) throw customerAccountResult.error;

      let customerData: { full_name?: string | null; name?: string | null; email?: string | null; phone?: string | null; birthday?: string | null; address?: string | null } | null = null;

      if (customerAccountResult.data?.customer_id) {
        const customerResult = await mobileSupabase
          .from("customers")
          .select("full_name,name,email,phone,birthday,address")
          .eq("id", customerAccountResult.data.customer_id)
          .eq("org_id", customerAccountResult.data.org_id)
          .maybeSingle();

        if (customerResult.error) throw customerResult.error;
        customerData = customerResult.data ?? null;
      }

      const newForm = {
        name:
          customerData?.full_name?.trim() ||
          customerData?.name?.trim() ||
          user.displayName?.trim() ||
          user.email?.split("@")[0] ||
          "",
        birthDate: customerData?.birthday?.trim() || "",
        phone: customerData?.phone?.trim() || "",
        email: customerData?.email?.trim() || user.email || "",
        address: customerData?.address?.trim() || "",
      };

      setForm(newForm);

      await writeCustomerProfileCache(user.id, {
        displayName: newForm.name,
        birthDate: newForm.birthDate,
        phone: newForm.phone,
        address: newForm.address,
        avatarUrl: avatarFromMetadata ?? cached?.avatarUrl ?? "",
      });
    } catch {
      if (!cached) {
        setForm((current) => ({ ...current, email: user?.email ?? "" }));
      }
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile({ forceRemote: false });
      void syncTimelineFromCache();
      void refreshTimeline();
      syncLookbookFromCache();
      if (!favoritesHydrated) {
        void refreshFavorites();
      }
      if (!services.length) {
        void refreshLookbook();
      }
    }, [favoritesHydrated, loadProfile, refreshFavorites, refreshLookbook, refreshTimeline, services.length, syncLookbookFromCache, syncTimelineFromCache]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadProfile({ forceRemote: true }), refreshFavorites(), refreshTimeline(), refreshLookbook()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadProfile, refreshFavorites, refreshLookbook, refreshTimeline]);

  function openBirthDatePicker() {
    setBirthDateDraft(parseBirthDateValue(form.birthDate));
    setIsBirthDatePickerOpen(true);
  }

  function handleBirthDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (event.type === "dismissed") {
      if (Platform.OS === "android") {
        setIsBirthDatePickerOpen(false);
      }
      return;
    }

    if (!selectedDate) {
      return;
    }

    if (Platform.OS === "android") {
      setForm((current) => ({
        ...current,
        birthDate: toDateInputValue(selectedDate),
      }));
      setIsBirthDatePickerOpen(false);
      return;
    }

    setBirthDateDraft(selectedDate);
  }

  function applyBirthDateDraft() {
    setForm((current) => ({
      ...current,
      birthDate: toDateInputValue(birthDateDraft),
    }));
    setIsBirthDatePickerOpen(false);
  }

  async function handleSaveProfile() {
    if (!mobileSupabase || !user?.id) {
      Alert.alert(strings.cacheClearFailedTitle, strings.commonError);
      return;
    }

    setIsSavingProfile(true);
    try {
      const trimmedForm = {
        name: form.name.trim(),
        email: form.email.trim(),
        birthDate: form.birthDate.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      };

      const verifiedProfile = await upsertAndVerifyCustomerProfile({
        userId: user.id,
        displayName: trimmedForm.name,
        email: trimmedForm.email,
        phone: trimmedForm.phone,
        birthDate: trimmedForm.birthDate,
        address: trimmedForm.address,
      });

      const { error: authError } = await mobileSupabase.auth.updateUser({
        data: {
          display_name: trimmedForm.name,
          full_name: trimmedForm.name,
          name: trimmedForm.name,
          phone: trimmedForm.phone,
          birth_date: trimmedForm.birthDate,
          address: trimmedForm.address,
        },
      });

      if (authError) throw authError;

      const newForm = {
        name: verifiedProfile?.display_name?.trim() || trimmedForm.name,
        birthDate: verifiedProfile?.birth_date?.trim() || trimmedForm.birthDate,
        phone: verifiedProfile?.phone?.trim() || trimmedForm.phone,
        email: trimmedForm.email || user.email || "",
        address: verifiedProfile?.address?.trim() || trimmedForm.address,
      };

      setForm(newForm);

      await writeCustomerProfileCache(user.id, {
        displayName: newForm.name,
        birthDate: newForm.birthDate,
        phone: newForm.phone,
        address: newForm.address,
        avatarUrl: avatarUri ?? "",
      });

      Alert.alert(strings.saveSuccess, strings.saveSuccess);
    } catch (error) {
      Alert.alert(
        strings.cacheClearFailedTitle,
        error instanceof Error ? error.message : strings.commonError,
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      Alert.alert(strings.cacheClearFailedTitle, error instanceof Error ? error.message : strings.commonError);
    }
  }

  async function handlePickAvatar() {
    if (!mobileSupabase || !user?.id) {
      Alert.alert(strings.cacheClearFailedTitle, strings.commonError);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Chưa có quyền truy cập ảnh", "Vui lòng cho phép truy cập thư viện ảnh để đổi avatar.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.35,
      base64: false,
    });

    if (result.canceled || !result.assets.length) {
      return;
    }

    setIsUploadingAvatar(true);

    try {
      let nextAvatarUrl: string | null = null;

      const resizedAsset = await resizeAvatarImage(result.assets[0], {
        size: 1024,
      });

      try {
        const uploaded = await uploadPickedAdminContentImage(resizedAsset, {
          folder: "avatars",
          baseName: form.name || user.email || "customer-avatar",
        });
        nextAvatarUrl = uploaded.publicUrl;
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : "";
        if (message.toLowerCase().includes("bucket") && message.toLowerCase().includes("not found")) {
          const inlineAvatar = await ImageManipulator.manipulateAsync(
            resizedAsset.uri,
            [{ resize: { width: 72 } }],
            { compress: 0.28, format: ImageManipulator.SaveFormat.JPEG, base64: true },
          );
          if (!inlineAvatar.base64) {
            throw uploadError;
          }
          nextAvatarUrl = `data:image/jpeg;base64,${inlineAvatar.base64}`;
        } else {
          const errMsg = uploadError instanceof Error ? uploadError.message : strings.commonError;
          Alert.alert("Lỗi upload ảnh", `Không thể upload ảnh: ${errMsg}`);
          throw uploadError;
        }
      }

      if (!nextAvatarUrl) {
        throw new Error("Không thể xử lý ảnh đại diện đã chọn.");
      }

      const { error: authError } = await mobileSupabase.auth.updateUser({
        data: {
          avatar_url: nextAvatarUrl,
        },
      });

      if (authError) {
        const errMsg = authError.message || strings.commonError;
        Alert.alert("Lỗi cập nhật avatar", `Không thể cập nhật avatar: ${errMsg}`);
        throw authError;
      }

      setAvatarUri(nextAvatarUrl);
      void prefetchCustomerImagesForIntent([nextAvatarUrl], "avatar");

      if (user?.id) {
        await writeCustomerProfileCache(user.id, {
          displayName: form.name,
          birthDate: form.birthDate,
          phone: form.phone,
          address: form.address,
          avatarUrl: nextAvatarUrl,
        });
      }

      Alert.alert(strings.saveSuccess, "Ảnh đại diện đã được cập nhật.");
    } catch (error) {
      if (error instanceof Error && error.message.includes("Lỗi")) {
        // Already showed alert
      } else {
        Alert.alert(
          strings.cacheClearFailedTitle,
          error instanceof Error ? error.message : strings.commonError,
        );
      }
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  return (
    <CustomerScreen
      hideHeader
      scroll
      keyboardAware
      keyboardVerticalOffset={Platform.OS === "ios" ? 96 : 32}
      contentContainerStyle={[styles.content, styles.keyboardSafeContent]}
      title={strings.profileTitle}
      onRefresh={() => void handleRefresh()}
      refreshing={isRefreshing}
    >
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>{strings.profileTitle}</Text>
        <CustomerTopActions />
      </View>

      <View style={styles.profileHero}>
        <Pressable style={styles.avatarWrap} onPress={() => void handlePickAvatar()} disabled={isUploadingAvatar}>
          <CustomerCachedImage alt="Ảnh đại diện khách hàng" source={{ uri: displayAvatar }} intent="avatar" contentFit="cover" transparent style={styles.avatar} containerStyle={styles.avatarContainer} />
          <View style={styles.cameraBadge}>
            <Feather color={theme.colors.textSoft} name="camera" size={15} />
          </View>
        </Pressable>

        <Text style={styles.name}>{form.name}</Text>
        <Text style={styles.contact}>{form.phone || form.email}</Text>
      </View>

      <LinearGradient
        colors={membershipCardGradient}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.membershipCard}
      >
        <View style={styles.membershipCopy}>
          <Text style={styles.membershipEyebrow}>MEMBERSHIP</Text>
          <Text style={styles.membershipTitle}>{currentTier?.name || "Thành viên"}</Text>
          <Text style={styles.membershipHint}>{membershipBlurb}</Text>
        </View>
        <View style={styles.membershipAwardWrap}>
          <LinearGradient colors={membershipCardGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.membershipAwardCircle}>
            <Feather color="#FFF7F0" name={membershipIconName} size={18} />
          </LinearGradient>
        </View>
      </LinearGradient>

      <SurfaceCard style={styles.metricsCard}>
        <ProfileMetric styles={styles} icon="credit-card" label="Tổng chi tiêu" value={summary.totalSpent} />
        <View style={styles.metricDivider} />
        <ProfileMetric styles={styles} icon="calendar" label="Tổng lượt hẹn" value={summary.totalVisits} />
        <View style={styles.metricDivider} />
        <ProfileMetric styles={styles} icon="gift" label="Ưu đãi" value={summary.offerWallet} />
      </SurfaceCard>

      <SurfaceCard style={styles.tabsCard}>
        {TABS.map((tab) => {
          const active = tab.key === currentTab;
          return (
            <Pressable key={tab.key} onPress={() => setManualTab(tab.key)} style={[styles.tabButton, active ? styles.tabButtonActive : null]}>
              <Feather color={active ? theme.colors.text : theme.colors.textSoft} name={tab.icon} size={14} />
              <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </SurfaceCard>

      {currentTab === "history" ? (
        <View style={styles.cardList}>
          {historyItems.map((item) => {
            const badgeStyle = getHistoryStatusBadgeStyle(item.status, theme);
            return (
              <SurfaceCard key={item.id} style={styles.rowCard}>
                <CustomerCachedImage alt={item.serviceName} source={{ uri: item.serviceImageUrl ?? displayAvatar }} intent="thumbnail" style={styles.rowImage} />
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{item.serviceName}</Text>
                  <Text style={styles.rowSubtitle}>
                    {new Date(item.occurredAt).toLocaleString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                  <View style={styles.rowMetaWrap}>
                    <View style={[styles.historyBadge, { backgroundColor: badgeStyle.backgroundColor, borderColor: badgeStyle.borderColor }]}>
                      <Text style={[styles.historyBadgeText, { color: badgeStyle.textColor }]}>{item.statusLabel}</Text>
                    </View>
                    {item.servicePriceLabel ? <Text style={styles.rowMeta}>• {item.servicePriceLabel}</Text> : null}
                    {item.preferredStaff ? <Text style={styles.rowMeta}>• {item.preferredStaff}</Text> : null}
                  </View>
                </View>
              </SurfaceCard>
            );
          })}

          {historyHydrated && !historyLoading && !historyItems.length ? (
            <SurfaceCard style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Feather color="#D8B892" name="calendar" size={22} />
              </View>
              <Text style={styles.emptyTitle}>Chưa có lịch sử hẹn</Text>
              <Text style={styles.emptyText}>Lịch sử sẽ tự cập nhật từ lịch hẹn và yêu cầu đặt lịch của khách.</Text>
            </SurfaceCard>
          ) : null}
        </View>
      ) : null}

      {currentTab === "favorites" ? (
        <View style={styles.cardList}>
          {favoriteServices.map((service) => (
            <Pressable
              key={service.id}
              onPress={() =>
                router.push({
                  pathname: "/(customer)/(tabs)/booking",
                  params: { service: service.name },
                })
              }
            >
              <SurfaceCard style={styles.rowCard}>
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    setPreviewImage(service.imageUrl);
                  }}
                >
                  <CustomerCachedImage alt={service.name} source={{ uri: service.imageUrl ?? "" }} intent="thumbnail" style={styles.rowImage} />
                </Pressable>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{service.name}</Text>
                  <Text style={styles.rowSubtitle}>{service.summary ?? "Dịch vụ đã lưu trong mục yêu thích."}</Text>
                  <Text style={styles.rowMeta}>{service.priceLabel ?? service.durationLabel ?? ""}</Text>
                </View>
              </SurfaceCard>
            </Pressable>
          ))}

          {!favoriteServices.length ? (
            <SurfaceCard style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Chưa có mẫu yêu thích</Text>
              <Text style={styles.emptyText}>Lưu các mẫu bạn thích ở màn Khám phá để xem lại nhanh tại đây.</Text>
            </SurfaceCard>
          ) : null}
        </View>
      ) : null}

      {currentTab === "info" ? (
        <SurfaceCard style={styles.formCard}>
          <EditableField styles={styles} label={strings.profileName} value={form.name} onChangeText={(value) => setForm((current) => ({ ...current, name: value }))} />
          <DatePickerField
            styles={styles}
            label={strings.profileBirthDate}
            value={form.birthDate}
            onPress={openBirthDatePicker}
          />
          <EditableField styles={styles} label={strings.profilePhone} value={form.phone} keyboardType="phone-pad" onChangeText={(value) => setForm((current) => ({ ...current, phone: value }))} />
          <EditableField styles={styles} label={strings.profileEmail} value={form.email} editable={false} keyboardType="email-address" />
          <EditableField styles={styles} label={strings.profileAddress} value={form.address} multiline onChangeText={(value) => setForm((current) => ({ ...current, address: value }))} />

          <Pressable onPress={() => void handleSaveProfile()} style={[styles.primaryButton, isSavingProfile ? styles.primaryButtonDisabled : null]} disabled={isSavingProfile}>
            <Text style={styles.primaryButtonText}>{isSavingProfile ? strings.profileSaving : strings.profileSave}</Text>
          </Pressable>
        </SurfaceCard>
      ) : null}

      <Modal transparent animationType="fade" visible={isBirthDatePickerOpen} onRequestClose={() => setIsBirthDatePickerOpen(false)}>
        <View style={styles.datePickerOverlay}>
          <View style={styles.datePickerModal}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>{strings.profileBirthDate}</Text>
              <Pressable onPress={() => setIsBirthDatePickerOpen(false)} style={styles.datePickerCloseButton}>
                <Feather color={theme.colors.text} name="x" size={18} />
              </Pressable>
            </View>
            <DateTimePicker
              value={Platform.OS === "ios" ? birthDateDraft : parseBirthDateValue(form.birthDate)}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              maximumDate={new Date()}
              onChange={handleBirthDateChange}
            />
            {Platform.OS === "ios" ? (
              <View style={styles.datePickerActions}>
                <Pressable onPress={() => setIsBirthDatePickerOpen(false)} style={styles.datePickerGhostButton}>
                  <Text style={styles.datePickerGhostLabel}>Hủy</Text>
                </Pressable>
                <Pressable onPress={applyBirthDateDraft} style={styles.datePickerPrimaryButton}>
                  <Text style={styles.datePickerPrimaryLabel}>Chọn ngày</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      <Pressable disabled={isBusy} onPress={() => void handleSignOut()} style={styles.logoutButton}>
        <Feather color={theme.colors.dangerText} name="log-out" size={18} />
        <Text style={styles.logoutLabel}>{isBusy ? "Đang đăng xuất..." : "Đăng xuất"}</Text>
      </Pressable>

      <CustomerImagePreviewModal imageUrl={previewImage} visible={Boolean(previewImage)} onClose={() => setPreviewImage(null)} />
    </CustomerScreen>
  );
}

function ProfileMetric({
  icon,
  label,
  value,
  styles,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.metricItem}>
      <Feather color="#8f7c6e" name={icon} size={15} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function DatePickerField({
  label,
  value,
  onPress,
  styles,
}: {
  label: string;
  value: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable onPress={onPress} style={styles.dateInputButton}>
        <Text style={[styles.dateInputText, !value ? styles.dateInputPlaceholder : null]}>
          {value ? formatBirthDateLabel(value) : label}
        </Text>
        <Feather color="#9c8f84" name="calendar" size={16} />
      </Pressable>
    </View>
  );
}

function EditableField({
  label,
  value,
  onChangeText,
  editable = true,
  keyboardType,
  multiline = false,
  styles,
}: {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  editable?: boolean;
  keyboardType?: React.ComponentProps<typeof TextInput>["keyboardType"];
  multiline?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline ? styles.inputMultiline : null, !editable ? styles.inputDisabled : null]}
        value={value}
        editable={editable}
        keyboardType={keyboardType}
        multiline={multiline}
        scrollEnabled={multiline ? false : undefined}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="#9c8f84"
        textAlignVertical={multiline ? "top" : "center"}
        autoCapitalize={label.toLowerCase().includes("email") ? "none" : "sentences"}
      />
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useCustomerTheme>) {
  return StyleSheet.create({
    content: {
      paddingBottom: 148,
      paddingTop: 8,
    },
    keyboardSafeContent: {
      paddingBottom: 220,
    },
    topBar: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 18,
      minHeight: 40,
    },
    topBarTitle: {
      color: theme.colors.text,
      flex: 1,
      fontSize: 30,
      fontWeight: "800",
      letterSpacing: -0.8,
    },
    membershipCard: {
      alignItems: "center",
      borderRadius: 24,
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 14,
      minHeight: 138,
      overflow: "hidden",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.lg,
      position: "relative",
    },
    membershipCopy: {
      flex: 1,
      gap: 6,
      maxWidth: "72%",
      paddingRight: theme.spacing.md,
      zIndex: 2,
    },
    membershipEyebrow: {
      color: "#B99773",
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    membershipTitle: {
      color: "#171311",
      fontSize: 18,
      fontWeight: "900",
      lineHeight: 24,
    },
    membershipHint: {
      color: "#6E5B4C",
      fontSize: 13,
      lineHeight: 19,
      maxWidth: "100%",
    },
    membershipAwardWrap: {
      alignItems: "center",
      justifyContent: "center",
      width: 58,
      zIndex: 2,
    },
    membershipAwardCircle: {
      alignItems: "center",
      borderRadius: 22,
      height: 42,
      justifyContent: "center",
      shadowColor: "#8B6444",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 12,
      width: 42,
    },
    profileHero: {
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
      paddingTop: 10,
    },
    avatarWrap: {
      position: "relative",
    },
    avatarContainer: {
      borderRadius: 48,
    },
    avatar: {
      borderRadius: 48,
      height: 96,
      width: 96,
    },
    cameraBadge: {
      alignItems: "center",
      backgroundColor: "#FFFDFB",
      borderColor: "#F1E5D8",
      borderRadius: theme.radius.pill,
      borderWidth: 2,
      bottom: 0,
      height: 34,
      justifyContent: "center",
      position: "absolute",
      right: -4,
      width: 34,
    },
    name: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "800",
      textAlign: "center",
    },
    contact: {
      color: theme.colors.textSoft,
      fontSize: 13,
      fontWeight: "500",
      textAlign: "center",
    },
    avatarHint: {
      color: theme.colors.textSoft,
      fontSize: 12,
      textAlign: "center",
    },
    metricsCard: {
      alignItems: "stretch",
      borderRadius: 24,
      flexDirection: "row",
      minHeight: 100,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    metricItem: {
      flex: 1,
      gap: 4,
      justifyContent: "center",
      minWidth: 0,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    metricDivider: {
      backgroundColor: "#F1E7DE",
      marginVertical: 10,
      width: 1,
    },
    metricLabel: {
      color: theme.colors.textSoft,
      fontSize: 10,
      fontWeight: "500",
    },
    metricValue: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    tabsCard: {
      borderRadius: 24,
      flexDirection: "row",
      gap: 6,
      padding: 6,
    },
    tabButton: {
      alignItems: "center",
      borderRadius: 16,
      flex: 1,
      flexDirection: "row",
      gap: 6,
      justifyContent: "center",
      minHeight: 42,
      paddingHorizontal: 5,
    },
    tabButtonActive: {
      backgroundColor: "#FFF7EF",
    },
    tabLabel: {
      color: theme.colors.textSoft,
      fontSize: 12,
      fontWeight: "600",
    },
    tabLabelActive: {
      color: theme.colors.text,
      fontWeight: "700",
    },
    cardList: {
      gap: 11,
    },
    rowCard: {
      alignItems: "center",
      flexDirection: "row",
      gap: 11,
      minHeight: 90,
      padding: 10,
    },
    rowImage: {
      borderRadius: 14,
      height: 62,
      width: 62,
    },
    rowCopy: {
      flex: 1,
      gap: 3,
      minWidth: 0,
    },
    rowTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    rowSubtitle: {
      color: theme.colors.textSoft,
      fontSize: 12,
      lineHeight: 16,
    },
    rowMetaWrap: {
      alignItems: "center",
      columnGap: 8,
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: 6,
    },
    rowMeta: {
      color: theme.colors.textSoft,
      fontSize: 12,
      fontWeight: "600",
    },
    historyBadge: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    historyBadgeText: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.1,
    },
    emptyCard: {
      alignItems: "center",
      borderRadius: 28,
      gap: 10,
      padding: 24,
    },
    emptyIconWrap: {
      alignItems: "center",
      backgroundColor: "#FFF8F1",
      borderRadius: 28,
      height: 56,
      justifyContent: "center",
      width: 56,
    },
    emptyTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "800",
    },
    emptyText: {
      color: theme.colors.textSoft,
      fontSize: 13,
      lineHeight: 18,
      textAlign: "center",
    },
    formCard: {
      gap: 14,
      paddingHorizontal: 14,
      paddingVertical: 16,
    },
    fieldGroup: {
      gap: 8,
    },
    fieldLabel: {
      color: theme.colors.textSoft,
      fontSize: 12,
      fontWeight: "700",
    },
    input: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: 18,
      borderWidth: 1,
      color: theme.colors.text,
      fontSize: 14,
      minHeight: 52,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    inputMultiline: {
      minHeight: 92,
    },
    inputDisabled: {
      color: theme.colors.textSoft,
      opacity: 0.78,
    },
    dateInputButton: {
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 52,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    dateInputText: {
      color: theme.colors.text,
      flex: 1,
      fontSize: 14,
    },
    dateInputPlaceholder: {
      color: "#9c8f84",
    },
    datePickerOverlay: {
      flex: 1,
      backgroundColor: "rgba(47,36,29,0.28)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    datePickerModal: {
      width: "100%",
      maxWidth: 360,
      borderRadius: 24,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      gap: 12,
    },
    datePickerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    datePickerTitle: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: "800",
    },
    datePickerCloseButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    datePickerActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 10,
      marginTop: 4,
    },
    datePickerGhostButton: {
      minHeight: 40,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    datePickerGhostLabel: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    datePickerPrimaryButton: {
      minHeight: 40,
      borderRadius: 14,
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    datePickerPrimaryLabel: {
      color: theme.colors.surface,
      fontSize: 14,
      fontWeight: "800",
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: theme.colors.accent,
      borderRadius: 18,
      justifyContent: "center",
      marginTop: 6,
      minHeight: 56,
      paddingHorizontal: 14,
    },
    primaryButtonDisabled: {
      opacity: 0.7,
    },
    primaryButtonText: {
      color: theme.colors.surface,
      fontSize: 14,
      fontWeight: "800",
    },
    logoutButton: {
      alignItems: "center",
      backgroundColor: "#FFFDFB",
      borderColor: "#F1E7DE",
      borderRadius: 22,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      justifyContent: "center",
      marginTop: 4,
      minHeight: 56,
      paddingHorizontal: theme.spacing.lg,
    },
    logoutLabel: {
      color: theme.colors.dangerText,
      fontSize: 14,
      fontWeight: "800",
    },
  });
}
