import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { uploadPickedAdminContentImage } from "@/src/features/admin/content-images";
import { resizeAvatarImage } from "@/src/features/admin/content-images";
import { FALLBACK_SERVICES } from "@/src/features/customer/data";
import { CustomerImagePreviewModal } from "@/src/features/customer/image-preview-modal";
import { useCustomerStrings } from "@/src/features/customer/strings";
import { CustomerScreen, CustomerTopActions, SurfaceCard } from "@/src/features/customer/ui";
import { CustomerCachedImage } from "@/src/features/customer/cached-image";
import { useCustomerFavorites } from "@/src/hooks/use-customer-favorites";
import { useCustomerHistory } from "@/src/hooks/use-customer-history";
import { useCustomerMembership } from "@/src/hooks/use-customer-membership";
import { useLookbookServices } from "@/src/hooks/use-lookbook-services";
import { prefetchCustomerImagesForIntent } from "@/src/lib/customer-image-cache";
import { upsertAndVerifyProfile } from "@/src/lib/profile-upsert";
import { readProfileCache, writeProfileCache } from "@/src/lib/profile-cache";
import { mobileSupabase } from "@/src/lib/supabase";
import { useSession } from "@/src/providers/session-provider";
import { useCustomerTheme } from "@/src/providers/customer-preferences-provider";

type TabKey = "history" | "favorites" | "info";

export default function ProfileScreen() {
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
  const { favoriteIds, refresh: refreshFavorites } = useCustomerFavorites();
  const { historyItems, isHydrated: historyHydrated, isLoading: historyLoading, refresh: refreshHistory } =
    useCustomerHistory(8);
  const { currentTier, nextTier, pointsBalance, remainingSpentToNext, remainingVisitsToNext, eligibleVisitsMinSpend, offers } = useCustomerMembership();
  const { refresh: refreshLookbook, services } = useLookbookServices(FALLBACK_SERVICES);
  const [activeTab, setActiveTab] = useState<TabKey>("history");
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

  const favoriteServices = useMemo(
    () => services.filter((service) => favoriteIds.includes(service.id)),
    [favoriteIds, services],
  );

  useEffect(() => {
    const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    if (rawTab === "history" || rawTab === "favorites" || rawTab === "info") {
      setActiveTab(rawTab);
    }
  }, [params.tab]);

  const displayAvatar = useMemo(() => {
    if (avatarUri?.trim()) {
      return avatarUri.trim();
    }

    const seed = encodeURIComponent(form.name.trim() || user?.email?.trim() || "Customer");
    return `https://ui-avatars.com/api/?name=${seed}&background=B4937D&color=FFFFFF&size=256`;
  }, [avatarUri, form.name, user?.email]);

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
        ? `Anh đang là thành viên thường. Còn ${parts.join(" hoặc ")} để lên ${nextTier.name}.`
        : `Anh đang là thành viên thường. Mục tiêu tiếp theo là ${nextTier.name}.`;
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
  }, [currentTier?.name, nextTier, pointsBalance, remainingSpentToNext, remainingVisitsToNext]);

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

  const loadProfile = useCallback(async () => {
    const cached = user?.id ? await readProfileCache(user.id) : null;
    if (cached?.avatarUrl) {
      setAvatarUri(cached.avatarUrl);
      void prefetchCustomerImagesForIntent([cached.avatarUrl], "avatar");
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
    }

    if (!mobileSupabase) {
      return;
    }

    try {
      const { data, error } = await mobileSupabase
        .from("profiles")
        .select("display_name,phone,birth_date,address")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      const newForm = {
        name: data?.display_name?.trim() || user.displayName?.trim() || user.email?.split("@")[0] || "",
        birthDate: data?.birth_date?.trim() || "",
        phone: data?.phone?.trim() || "",
        email: user.email ?? "",
        address: data?.address?.trim() || "",
      };

      setForm(newForm);

      await writeProfileCache(user.id, {
        displayName: newForm.name,
        birthDate: newForm.birthDate,
        phone: newForm.phone,
        address: newForm.address,
        avatarUrl: avatarFromMetadata ?? "",
      });
    } catch {
      if (!cached) {
        setForm((current) => ({ ...current, email: user?.email ?? "" }));
      }
    }
  }, [user?.displayName, user?.email, user?.id]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadProfile(), refreshFavorites(), refreshHistory(), refreshLookbook()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadProfile, refreshFavorites, refreshHistory, refreshLookbook]);

  async function handleSaveProfile() {
    if (!mobileSupabase || !user?.id) {
      Alert.alert(strings.cacheClearFailedTitle, strings.commonError);
      return;
    }

    setIsSavingProfile(true);
    try {
      const verifiedProfile = await upsertAndVerifyProfile({
        userId: user.id,
        displayName: form.name,
        phone: form.phone,
        birthDate: form.birthDate,
        address: form.address,
      });

      const { error: authError } = await mobileSupabase.auth.updateUser({
        data: { display_name: form.name.trim() },
      });

      if (authError) throw authError;

      const newForm = {
        name: verifiedProfile.display_name?.trim() || form.name.trim(),
        birthDate: verifiedProfile.birth_date?.trim() || "",
        phone: verifiedProfile.phone?.trim() || "",
        email: user.email ?? "",
        address: verifiedProfile.address?.trim() || "",
      };

      setForm(newForm);

      await writeProfileCache(user.id, {
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
        await writeProfileCache(user.id, {
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
      keyboardVerticalOffset={12}
      contentContainerStyle={styles.content}
      title={strings.profileTitle}
      onRefresh={() => void handleRefresh()}
      refreshing={isRefreshing}
    >
      <View style={styles.topBar}>
        <View style={styles.topBarSpacer} />
        <CustomerTopActions />
      </View>

      <View style={styles.profileHero}>
        <Pressable style={styles.avatarWrap} onPress={() => void handlePickAvatar()}>
          <CustomerCachedImage alt="Ảnh đại diện khách hàng" source={{ uri: displayAvatar }} intent="avatar" contentFit="cover" transparent style={styles.avatar} containerStyle={styles.avatarContainer} />
          <View style={styles.cameraBadge}>
            <Feather color={theme.colors.textSoft} name="camera" size={15} />
          </View>
        </Pressable>

        <Text style={styles.name}>{form.name}</Text>
        <Text style={styles.contact}>{form.phone || form.email}</Text>
      </View>

      <LinearGradient
        colors={["#FAEEDF", "#F4E0C8"]}
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
          <LinearGradient colors={["#C89B76", "#9F7453"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.membershipAwardCircle}>
            <Feather color="#FFF7F0" name="award" size={18} />
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
          const active = tab.key === activeTab;
          return (
            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={[styles.tabButton, active ? styles.tabButtonActive : null]}>
              <Feather color={active ? theme.colors.text : theme.colors.textSoft} name={tab.icon} size={14} />
              <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </SurfaceCard>

      {activeTab === "history" ? (
        <View style={styles.cardList}>
          {historyItems.map((item) => (
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
                <Text style={styles.rowMeta}>{item.servicePriceLabel ?? "0d"}</Text>
              </View>
            </SurfaceCard>
          ))}

          {historyHydrated && !historyLoading && !historyItems.length ? (
            <SurfaceCard style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Feather color="#D8B892" name="calendar" size={22} />
              </View>
              <Text style={styles.emptyTitle}>Chưa có lịch sử dịch vụ</Text>
              <Text style={styles.emptyText}>Lịch sử sẽ tự cập nhật từ các dịch vụ khách đã hoàn tất tại tiệm.</Text>
            </SurfaceCard>
          ) : null}
        </View>
      ) : null}

      {activeTab === "favorites" ? (
        <View style={styles.cardList}>
          {favoriteServices.map((service) => (
            <Pressable
              key={service.id}
              onPress={() =>
                router.push({
                  pathname: "/(customer)/booking",
                  params: { service: service.title },
                })
              }
            >
              <SurfaceCard style={styles.rowCard}>
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    setPreviewImage(service.image);
                  }}
                >
                  <CustomerCachedImage alt={service.title} source={{ uri: service.image }} intent="thumbnail" style={styles.rowImage} />
                </Pressable>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{service.title}</Text>
                  <Text style={styles.rowSubtitle}>{service.blurb}</Text>
                  <Text style={styles.rowMeta}>{service.price}</Text>
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

      {activeTab === "info" ? (
        <SurfaceCard style={styles.formCard}>
          <EditableField styles={styles} label={strings.profileName} value={form.name} onChangeText={(value) => setForm((current) => ({ ...current, name: value }))} />
          <EditableField styles={styles} label={strings.profileBirthDate} value={form.birthDate} onChangeText={(value) => setForm((current) => ({ ...current, birthDate: value }))} />
          <EditableField styles={styles} label={strings.profilePhone} value={form.phone} onChangeText={(value) => setForm((current) => ({ ...current, phone: value }))} />
          <EditableField styles={styles} label={strings.profileEmail} value={form.email} editable={false} />
          <EditableField styles={styles} label={strings.profileAddress} value={form.address} onChangeText={(value) => setForm((current) => ({ ...current, address: value }))} />

          <Pressable onPress={() => void handleSaveProfile()} style={[styles.primaryButton, isSavingProfile ? styles.primaryButtonDisabled : null]} disabled={isSavingProfile}>
            <Text style={styles.primaryButtonText}>{isSavingProfile ? strings.profileSaving : strings.profileSave}</Text>
          </Pressable>
        </SurfaceCard>
      ) : null}

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

function EditableField({
  label,
  value,
  onChangeText,
  editable = true,
  styles,
}: {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  editable?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, !editable ? styles.inputDisabled : null]}
        value={value}
        editable={editable}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="#9c8f84"
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
    topBar: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 18,
      minHeight: 40,
    },
    topBarSpacer: {
      flex: 1,
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
    rowMeta: {
      color: theme.colors.accentWarm,
      fontSize: 12,
      fontWeight: "600",
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
    inputDisabled: {
      color: theme.colors.textSoft,
      opacity: 0.78,
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
