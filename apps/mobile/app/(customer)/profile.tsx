import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { uploadPickedAdminContentImage } from "@/src/features/admin/content-images";
import { resizeAvatarImage } from "@/src/features/admin/content-images";
import { FALLBACK_SERVICES, OFFERS, PROFILE_SUMMARY } from "@/src/features/customer/data";
import { CustomerImagePreviewModal } from "@/src/features/customer/image-preview-modal";
import { useCustomerStrings } from "@/src/features/customer/strings";
import { CustomerScreen, CustomerTopActions, SurfaceCard } from "@/src/features/customer/ui";
import { CustomerCachedImage } from "@/src/features/customer/cached-image";
import { useCustomerFavorites } from "@/src/hooks/use-customer-favorites";
import { useCustomerHistory } from "@/src/hooks/use-customer-history";
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
  const { refresh: refreshLookbook, services } = useLookbookServices(FALLBACK_SERVICES);
  const [activeTab, setActiveTab] = useState<TabKey>("history");
  const [avatarUri, setAvatarUri] = useState(PROFILE_SUMMARY.avatar);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [form, setForm] = useState({
    name: user?.displayName?.trim() || user?.email?.split("@")[0] || PROFILE_SUMMARY.name,
    birthDate: PROFILE_SUMMARY.birthDate,
    phone: PROFILE_SUMMARY.phone,
    email: user?.email ?? PROFILE_SUMMARY.email,
    address: PROFILE_SUMMARY.address,
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

  const summary = useMemo(() => {
    const totalSpent = historyItems.reduce((sum, item) => {
      const numericPrice = Number((item.servicePriceLabel ?? "0").replace(/[^\d]/g, ""));
      return sum + numericPrice;
    }, 0);

    return {
      totalSpent: `${totalSpent.toLocaleString("vi-VN")}d`,
      totalVisits: String(historyItems.length),
      offerWallet: String(Math.max(1, OFFERS.length - 1)),
    };
  }, [historyItems]);

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
        : PROFILE_SUMMARY.avatar;

    setAvatarUri(avatarFromMetadata);
    void prefetchCustomerImagesForIntent([avatarFromMetadata], "avatar");

    if (!user?.id) {
      setForm((current) => ({ ...current, email: user?.email ?? PROFILE_SUMMARY.email }));
      return;
    }

    if (cached) {
      setForm({
        name: cached.displayName || user.displayName?.trim() || user.email?.split("@")[0] || PROFILE_SUMMARY.name,
        birthDate: cached.birthDate || "",
        phone: cached.phone || "",
        email: user.email ?? PROFILE_SUMMARY.email,
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
        name: data?.display_name?.trim() || user.displayName?.trim() || user.email?.split("@")[0] || PROFILE_SUMMARY.name,
        birthDate: data?.birth_date?.trim() || "",
        phone: data?.phone?.trim() || "",
        email: user.email ?? PROFILE_SUMMARY.email,
        address: data?.address?.trim() || "",
      };

      setForm(newForm);

      await writeProfileCache(user.id, {
        displayName: newForm.name,
        birthDate: newForm.birthDate,
        phone: newForm.phone,
        address: newForm.address,
        avatarUrl: avatarFromMetadata,
      });
    } catch {
      if (!cached) {
        setForm((current) => ({ ...current, email: user?.email ?? PROFILE_SUMMARY.email }));
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
        email: user.email ?? PROFILE_SUMMARY.email,
        address: verifiedProfile.address?.trim() || "",
      };

      setForm(newForm);

      await writeProfileCache(user.id, {
        displayName: newForm.name,
        birthDate: newForm.birthDate,
        phone: newForm.phone,
        address: newForm.address,
        avatarUrl: avatarUri,
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
        maxSize: 96,
        quality: 0.42,
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
          <CustomerCachedImage alt="Ảnh đại diện khách hàng" source={{ uri: avatarUri }} intent="avatar" style={styles.avatar} />
          <View style={styles.cameraBadge}>
            <Feather color={theme.colors.textSoft} name="camera" size={15} />
          </View>
        </Pressable>

        <Text style={styles.name}>{form.name}</Text>
        <Text style={styles.contact}>{form.phone || form.email}</Text>
      </View>

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
              <CustomerCachedImage alt={item.serviceName} source={{ uri: item.serviceImageUrl ?? PROFILE_SUMMARY.avatar }} intent="thumbnail" style={styles.rowImage} />
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
      paddingTop: 2,
    },
    topBar: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    topBarSpacer: {
      flex: 1,
    },
    membershipCard: {
      alignItems: "center",
      borderRadius: theme.radius.xl,
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.lg,
    },
    membershipCopy: {
      flex: 1,
      gap: 4,
      paddingRight: theme.spacing.md,
    },
    membershipEyebrow: {
      color: theme.colors.textSoft,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    membershipTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "800",
      lineHeight: 22,
    },
    profileHero: {
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
      paddingTop: 6,
    },
    avatarWrap: {
      position: "relative",
    },
    avatar: {
      borderRadius: 43,
      height: 86,
      width: 86,
    },
    cameraBadge: {
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      bottom: -4,
      height: 32,
      justifyContent: "center",
      position: "absolute",
      right: -10,
      width: 32,
    },
    name: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "700",
      textAlign: "center",
    },
    contact: {
      color: theme.colors.textSoft,
      fontSize: 12,
      fontWeight: "500",
    },
    avatarHint: {
      color: theme.colors.textSoft,
      fontSize: 12,
      textAlign: "center",
    },
    metricsCard: {
      alignItems: "stretch",
      flexDirection: "row",
      minHeight: 88,
      paddingHorizontal: 8,
      paddingVertical: 8,
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
      backgroundColor: theme.colors.border,
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
      flexDirection: "row",
      gap: 6,
      padding: 6,
    },
    tabButton: {
      alignItems: "center",
      borderRadius: 13,
      flex: 1,
      flexDirection: "row",
      gap: 6,
      justifyContent: "center",
      minHeight: 37,
      paddingHorizontal: 5,
    },
    tabButtonActive: {
      backgroundColor: theme.colors.accentSoft,
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
      gap: 8,
      padding: 18,
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
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      justifyContent: "center",
      marginTop: 2,
      minHeight: 52,
      paddingHorizontal: theme.spacing.lg,
    },
    logoutLabel: {
      color: theme.colors.dangerText,
      fontSize: 14,
      fontWeight: "800",
    },
  });
}
