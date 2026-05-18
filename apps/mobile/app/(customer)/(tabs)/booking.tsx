import Feather from "@expo/vector-icons/Feather";
import { useCallback, useEffect } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { CustomerScreen, CustomerTopActions, Pill, PrimaryButton, SurfaceCard } from "@/src/features/customer/ui";
import { QUICK_CONTACTS_CARD } from "@/src/features/customer/data";
import { premiumTheme } from "@/src/design/premium-theme";
import { useCustomerStrings } from "@/src/features/customer/strings";
import { useCustomerBookingTimeline } from "@/src/hooks/use-customer-booking-timeline";
import { useGuestBooking } from "@/src/hooks/use-guest-booking";
import { readCustomerProfileCache } from "@/src/lib/customer-profile-cache";
import { mobileSupabase } from "@/src/lib/supabase";
import { useSession } from "@/src/providers/session-provider";

const { colors, radius, spacing } = premiumTheme;

export default function BookingScreen() {
  const params = useLocalSearchParams<{ service?: string; offerId?: string; offerClaimId?: string; offerCode?: string; offerTitle?: string }>();
  const strings = useCustomerStrings();
  const { user } = useSession();
  const { dateOptions, fieldErrors, isSubmitting, submit, submitError, successResult, timeSlots, updateValue, values } =
    useGuestBooking();
  const { upcomingItems: upcomingBookings, isRefreshing, refresh: refreshUpcomingBookings, syncFromCache: syncTimelineFromCache } = useCustomerBookingTimeline({ historyLimit: 8, upcomingLimit: 6 });

  useEffect(() => {
    if (params.service && typeof params.service === "string" && params.service !== values.requestedService) {
      updateValue("requestedService", params.service);
    }
  }, [params.service, updateValue, values.requestedService]);

  useEffect(() => {
    if (values.customerName.trim()) return;

    const nextName = user?.displayName?.trim() || user?.email?.split("@")[0]?.trim() || "";
    if (!nextName) return;

    updateValue("customerName", nextName);
  }, [updateValue, user?.displayName, user?.email, values.customerName]);

  useEffect(() => {
    if (values.customerPhone.trim()) return;

    let active = true;

    async function hydratePhoneFromProfile() {
      if (!user?.id) return;

      const cachedProfile = await readCustomerProfileCache(user.id);
      const cachedPhone = typeof cachedProfile?.phone === "string" ? cachedProfile.phone.trim() : "";
      if (active && cachedPhone) {
        updateValue("customerPhone", cachedPhone);
        return;
      }

      if (!mobileSupabase) return;

      const {
        data: { user: authUser },
      } = await mobileSupabase.auth.getUser();

      const authPhone = typeof authUser?.user_metadata?.phone === "string" ? authUser.user_metadata.phone.trim() : "";
      if (authPhone) {
        if (active) updateValue("customerPhone", authPhone);
        return;
      }

      const accountResult = await mobileSupabase
        .from("customer_accounts")
        .select("org_id,customer_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (accountResult.error || !accountResult.data?.customer_id) return;

      const customerResult = await mobileSupabase
        .from("customers")
        .select("phone")
        .eq("id", accountResult.data.customer_id)
        .eq("org_id", accountResult.data.org_id)
        .maybeSingle();

      if (customerResult.error) return;

      const customerPhone = typeof customerResult.data?.phone === "string" ? customerResult.data.phone.trim() : "";
      if (active && customerPhone) {
        updateValue("customerPhone", customerPhone);
      }
    }

    void hydratePhoneFromProfile();

    return () => {
      active = false;
    };
  }, [updateValue, user?.id, values.customerPhone]);

  useFocusEffect(
    useCallback(() => {
      void syncTimelineFromCache();
    }, [syncTimelineFromCache]),
  );

  useEffect(() => {
    if (!successResult?.bookingRequestId) return;
    void syncTimelineFromCache();
  }, [successResult?.bookingRequestId, syncTimelineFromCache]);

  useEffect(() => {
    if (typeof params.offerId === "string" && params.offerId && values.appliedOfferId !== params.offerId) {
      updateValue("appliedOfferId", params.offerId);
    }
    if (typeof params.offerClaimId === "string" && params.offerClaimId && values.appliedOfferClaimId !== params.offerClaimId) {
      updateValue("appliedOfferClaimId", params.offerClaimId);
    }
    if (typeof params.offerCode === "string" && params.offerCode && values.appliedOfferCode !== params.offerCode) {
      updateValue("appliedOfferCode", params.offerCode);
    }

    if (!params.offerCode || typeof params.offerCode !== "string") return;
    if (values.note.includes(params.offerCode)) return;

    const nextOfferNote = [
      values.note.trim(),
      `Ưu đãi áp dụng: ${params.offerCode}${params.offerTitle && typeof params.offerTitle === "string" ? ` - ${params.offerTitle}` : ""}`,
    ]
      .filter(Boolean)
      .join("\n");

    updateValue("note", nextOfferNote);
  }, [params.offerClaimId, params.offerCode, params.offerId, params.offerTitle, updateValue, values.appliedOfferClaimId, values.appliedOfferCode, values.appliedOfferId, values.note]);

  return (
    <CustomerScreen
      title=""
      hideHeader
      keyboardAware
      keyboardVerticalOffset={12}
      contentContainerStyle={styles.content}
      onRefresh={() => void refreshUpcomingBookings()}
      refreshing={isRefreshing}
    >
      <View style={styles.topBar}>
        <View style={styles.topBarSpacer} />
        <CustomerTopActions />
      </View>

      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>CHAM BEAUTY</Text>
        <Text style={styles.pageTitle}>Đặt lịch</Text>
        <Text style={styles.pageSubtitle}>
          Chọn mẫu nail, thời gian và thông tin liên hệ để salon giữ lịch chính xác hơn.
        </Text>
      </View>

      <SurfaceCard style={styles.formCard}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Thông tin yêu cầu</Text>
          <Text style={styles.sectionSubtitle}>Điền nhanh để salon giữ chỗ chính xác hơn.</Text>
        </View>

        {params.offerCode && typeof params.offerCode === "string" ? (
          <View style={styles.offerBadgeRow}>
            <View style={styles.offerBadgeIcon}>
              <Feather color={colors.accentWarm} name="tag" size={16} />
            </View>
            <View style={styles.offerBadgeCopy}>
              <Text style={styles.offerBadgeLabel}>Mã ưu đãi đang áp dụng</Text>
              <Text style={styles.offerBadgeCode}>{params.offerCode}</Text>
              {params.offerTitle && typeof params.offerTitle === "string" ? <Text style={styles.offerBadgeHint}>{params.offerTitle}</Text> : null}
            </View>
          </View>
        ) : null}

        <FieldBlock label="Mẫu nail" error={fieldErrors.requestedService}>
          <TextInput
            placeholder="Luxury Gel, French Chic..."
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={values.requestedService}
            onChangeText={(value) => updateValue("requestedService", value)}
          />
        </FieldBlock>

        <FieldBlock label="Ngày hẹn" error={fieldErrors.selectedDate}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {dateOptions.map((option) => (
              <Pill
                key={option.value}
                label={option.label}
                active={option.value === values.selectedDate}
                onPress={() => updateValue("selectedDate", option.value)}
              />
            ))}
          </ScrollView>
        </FieldBlock>

        <FieldBlock label="Khung giờ" error={fieldErrors.selectedTime}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {timeSlots.map((slot) => (
              <Pill
                key={slot}
                label={slot}
                active={slot === values.selectedTime}
                onPress={() => updateValue("selectedTime", slot)}
              />
            ))}
          </ScrollView>
        </FieldBlock>

        <FieldBlock label="Tên khách hàng" error={fieldErrors.customerName}>
          <TextInput
            placeholder="Nguyễn Khánh Ly"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={values.customerName}
            onChangeText={(value) => updateValue("customerName", value)}
          />
        </FieldBlock>

        <FieldBlock label="Số điện thoại" error={fieldErrors.customerPhone}>
          <TextInput
            keyboardType="phone-pad"
            placeholder="0916 080 398"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={values.customerPhone}
            onChangeText={(value) => updateValue("customerPhone", value)}
          />
        </FieldBlock>

        <FieldBlock label="Kỹ thuật viên ưu tiên">
          <TextInput
            placeholder="Ví dụ: Bùi Thị Tuyết"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={values.preferredStaff}
            onChangeText={(value) => updateValue("preferredStaff", value)}
          />
        </FieldBlock>

        <FieldBlock label="Ghi chú">
          <TextInput
            multiline
            numberOfLines={4}
            scrollEnabled={false}
            placeholder="Màu sắc, nail art, lưu ý đặc biệt..."
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.noteInput]}
            textAlignVertical="top"
            value={values.note}
            onChangeText={(value) => updateValue("note", value)}
          />
        </FieldBlock>

        {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
        {successResult ? (
          <SurfaceCard style={styles.successCard}>
            <Text style={styles.successTitle}>Đã gửi yêu cầu thành công</Text>
            <Text style={styles.successText}>{successResult.bookingRequestId ?? "Đang đồng bộ mã booking"}</Text>
          </SurfaceCard>
        ) : null}

        <PrimaryButton label={isSubmitting ? "Đang gửi..." : "Gửi yêu cầu"} onPress={() => void submit()} />
      </SurfaceCard>

      <SurfaceCard style={styles.utilityCard}>
        <View style={styles.utilityHeader}>
          <View style={styles.utilityHeaderIcon}>
            <Feather color={colors.accentWarm} name="headphones" size={22} />
          </View>
          <View style={styles.utilityHeaderCopy}>
            <Text style={styles.sectionTitle}>Liên hệ nhanh</Text>
            <Text style={styles.sectionSubtitle}>Khi bạn cần tư vấn mẫu hoặc giữ chỗ gấp.</Text>
          </View>
        </View>

        <View style={styles.contactList}>
          {QUICK_CONTACTS_CARD.map((item, index) => (
            <Pressable
              key={item.label}
              style={[styles.contactRow, index < QUICK_CONTACTS_CARD.length - 1 ? styles.utilityRowDivider : null]}
              onPress={() => void Linking.openURL(item.href)}
            >
              <View style={styles.leadingVisual}>
                <Feather color={colors.accentWarm} name={item.icon} size={22} />
              </View>

              <View style={styles.contactCopy}>
                <Text style={styles.contactLabel}>{item.label}</Text>
                <Text style={styles.contactValue}>{item.value}</Text>
              </View>

              <View style={styles.trailingPill}>
                <Feather color={colors.accentWarm} name={item.actionIcon} size={17} />
                <Text style={styles.contactAction}>{item.actionLabel}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.utilityCard}>
        <View style={styles.utilityHeader}>
          <View style={styles.utilityHeaderIcon}>
            <Feather color={colors.accentWarm} name="calendar" size={22} />
          </View>
          <View style={styles.utilityHeaderCopy}>
            <Text style={styles.sectionTitle}>{strings.upcomingBookingsTitle}</Text>
            <Text style={styles.sectionSubtitle}>Chỉ các lịch sắp tới và chưa hoàn thành mới hiển thị ở đây. Các lịch cũ hoặc đã hoàn tất sẽ nằm trong Lịch sử hẹn.</Text>
          </View>
        </View>

        <View style={styles.bookingList}>
          {!user ? (
            <Text style={styles.bookingEmptyText}>{strings.upcomingBookingsSignedOut}</Text>
          ) : !upcomingBookings.length ? (
            <Text style={styles.bookingEmptyText}>{strings.upcomingBookingsEmpty}</Text>
          ) : (
            upcomingBookings.map((item) => (
              <View key={item.id} style={styles.bookingRow}>
                <View style={styles.bookingThumbPlaceholder}>
                  <Feather color={colors.accentWarm} name="calendar" size={20} />
                </View>

                <View style={styles.bookingCopy}>
                  <Text style={styles.bookingTitle}>{item.requestedService}</Text>

                  <View style={styles.bookingMetaRow}>
                    <Feather color={colors.textSoft} name="calendar" size={15} />
                    <Text style={styles.bookingMeta}>
                      {new Date(item.requestedStartAt).toLocaleString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>

                  {item.preferredStaff ? (
                    <View style={styles.bookingMetaRow}>
                      <Feather color={colors.textSoft} name="user" size={15} />
                      <Text style={styles.bookingMeta}>{item.preferredStaff}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.trailingPill}>
                  <Feather color={colors.accentWarm} name="clock" size={16} />
                  <Text style={styles.contactAction}>{item.status}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </SurfaceCard>
    </CustomerScreen>
  );
}

function FieldBlock({
  children,
  error,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingTop: 2,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  topBarSpacer: {
    flex: 1,
  },
  headerBlock: {
    gap: 6,
  },
  eyebrow: {
    color: "#544335",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  pageSubtitle: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 21,
  },
  formCard: {
    gap: 18,
  },
  offerBadgeRow: {
    alignItems: "center",
    backgroundColor: "#fff6ea",
    borderColor: "#ecd9c2",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  offerBadgeIcon: {
    alignItems: "center",
    backgroundColor: "#f7ead7",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  offerBadgeCopy: {
    flex: 1,
    gap: 2,
  },
  offerBadgeLabel: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  offerBadgeCode: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  offerBadgeHint: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 17,
  },
  utilityCard: {
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  utilityHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  utilityHeaderIcon: {
    alignItems: "center",
    backgroundColor: "#fbf4ec",
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  utilityHeaderCopy: {
    flex: 1,
    gap: 2,
    paddingTop: 1,
  },
  sectionHead: {
    gap: 4,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noteInput: {
    minHeight: 112,
  },
  chipRow: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  errorText: {
    color: colors.dangerText,
    fontSize: 13,
    lineHeight: 19,
  },
  successCard: {
    backgroundColor: colors.successBg,
    borderColor: colors.successBg,
    gap: 4,
  },
  successTitle: {
    color: colors.successText,
    fontSize: 16,
    fontWeight: "800",
  },
  successText: {
    color: colors.successText,
    fontSize: 13,
  },
  contactList: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
  },
  contactRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  utilityRowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  leadingVisual: {
    alignItems: "center",
    backgroundColor: "#fdf1e4",
    borderRadius: 16,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  contactCopy: {
    flex: 1,
    gap: 2,
  },
  contactLabel: {
    color: "#6f6051",
    fontSize: 12,
    fontWeight: "500",
  },
  contactValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  trailingPill: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 42,
    minWidth: 92,
    paddingHorizontal: 14,
  },
  contactAction: {
    color: colors.accentWarm,
    fontSize: 13,
    fontWeight: "800",
  },
  bookingList: {
    gap: 12,
  },
  bookingRow: {
    alignItems: "center",
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  bookingThumbPlaceholder: {
    alignItems: "center",
    backgroundColor: "#fdf1e4",
    borderRadius: 18,
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  bookingCopy: {
    flex: 1,
    gap: 5,
  },
  bookingTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  bookingMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  bookingMeta: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  bookingEmptyText: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 20,
  },
});
