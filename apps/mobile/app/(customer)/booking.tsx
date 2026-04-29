import Feather from "@expo/vector-icons/Feather";
import { useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { CustomerScreen, CustomerTopActions, Pill, PrimaryButton, SurfaceCard } from "@/src/features/customer/ui";
import { QUICK_CONTACTS_CARD, UPCOMING_BOOKING_CARDS } from "@/src/features/customer/data";
import { premiumTheme } from "@/src/design/premium-theme";
import { useGuestBooking } from "@/src/hooks/use-guest-booking";

const { colors, radius, spacing } = premiumTheme;

export default function BookingScreen() {
  const params = useLocalSearchParams<{ service?: string }>();
  const { dateOptions, fieldErrors, isSubmitting, submit, submitError, successResult, timeSlots, updateValue, values } =
    useGuestBooking();

  useEffect(() => {
    if (params.service && typeof params.service === "string" && params.service !== values.requestedService) {
      updateValue("requestedService", params.service);
    }
  }, [params.service, updateValue, values.requestedService]);

  return (
    <CustomerScreen title="" hideHeader contentContainerStyle={styles.content} onRefresh={() => {}} refreshing={false}>
      <View style={styles.topBar}>
        <View style={styles.topBarSpacer} />
        <CustomerTopActions />
      </View>

      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>CHAM BEAUTY</Text>
        <Text style={styles.pageTitle}>Đặt lịch</Text>
        <Text style={styles.pageSubtitle}>
          Chọn mẫu nail, thời gian và thông tin liên hệ theo phong cách đồng nhất của customer flow.
        </Text>
      </View>

      <SurfaceCard style={styles.formCard}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Thông tin yêu cầu</Text>
          <Text style={styles.sectionSubtitle}>Điền nhanh để salon giữ chỗ chính xác hơn.</Text>
        </View>

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
            <Text style={styles.sectionTitle}>Lịch đã giữ cho bạn</Text>
            <Text style={styles.sectionSubtitle}>Các lịch gần nhất đang được hiển thị cùng phong cách với toàn app.</Text>
          </View>
        </View>

        <View style={styles.bookingList}>
          {UPCOMING_BOOKING_CARDS.map((item) => (
            <View key={item.id} style={styles.bookingRow}>
              <Image alt={item.title} source={{ uri: item.image }} style={styles.bookingThumb} />

              <View style={styles.bookingCopy}>
                <Text style={styles.bookingTitle}>{item.title}</Text>

                <View style={styles.bookingMetaRow}>
                  <Feather color={colors.textSoft} name="calendar" size={15} />
                  <Text style={styles.bookingMeta}>{item.slot}</Text>
                </View>

                <View style={styles.bookingMetaRow}>
                  <Feather color={colors.textSoft} name="user" size={15} />
                  <Text style={styles.bookingMeta}>{item.staff}</Text>
                </View>
              </View>

              <Pressable style={styles.trailingPill}>
                <Feather color={colors.accentWarm} name="edit-3" size={16} />
                <Text style={styles.contactAction}>Sửa</Text>
              </Pressable>
            </View>
          ))}
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
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  bookingThumb: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    height: 68,
    width: 68,
  },
  bookingCopy: {
    flex: 1,
    gap: 3,
  },
  bookingTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  bookingMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  bookingMeta: {
    color: colors.textSoft,
    fontSize: 12,
  },
});
