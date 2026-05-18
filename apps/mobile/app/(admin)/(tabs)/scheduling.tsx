import Feather from "@expo/vector-icons/Feather";
import { useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AdminBottomNavDock, AdminHeaderActions, AdminKeyboardAwareScrollView, AdminKeyboardTextInput, AdminTopSafeArea, ADMIN_CONTENT_BOTTOM_NAV_CLEARANCE, ADMIN_KEYBOARD_ACTIVE_FIELD_CLEARANCE, useKeyboardVisible } from "@/src/features/admin/ui";
import { getAdminNavHref } from "@/src/features/admin/navigation";
import { useAdminOperations } from "@/src/hooks/use-admin-operations";

const palette = {
  screen: "#FCFAF8",
  white: "#FFFFFF",
  brown: "#2F241D",
  text: "#2F241D",
  muted: "#8D7E72",
  mutedSoft: "#A6988B",
  border: "rgba(47, 36, 29, 0.07)",
  borderStrong: "rgba(47, 36, 29, 0.1)",
  beige: "#F4ECE2",
  beigeSoft: "#FBF6F1",
  avatar: "#F1E2D3",
};

type SchedulingFilter = "ALL" | "BOOKED" | "CHECKED_IN" | "DONE" | "OTHER";
type SchedulingTab = "appointments" | "bookings";
type BookingStatusGroup = "NEW" | "NEEDS_RESCHEDULE" | "EXPIRED_UNCONFIRMED";

const FILTER_OPTIONS = [
  { value: "ALL" as const, label: "Tất cả", icon: "grid" as const, accent: "#8a6346", accentSoft: "#f7ece2" },
  { value: "BOOKED" as const, label: "Chờ check-in", icon: "clock" as const, accent: "#d6a243", accentSoft: "#fff4de" },
  { value: "CHECKED_IN" as const, label: "Đang phục vụ", icon: "users" as const, accent: "#55a973", accentSoft: "#e8f8ee" },
  { value: "DONE" as const, label: "Hoàn tất", icon: "check-circle" as const, accent: "#55a973", accentSoft: "#eaf7ed" },
  { value: "OTHER" as const, label: "Khác", icon: "more-horizontal" as const, accent: "#8b97ad", accentSoft: "#eff3fa" },
];

const TAB_OPTIONS: Array<{
  key: SchedulingTab;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  accent: string;
  accentSoft: string;
}> = [
  { key: "appointments", label: "Lịch hẹn", icon: "calendar", accent: "#936347", accentSoft: "#f7f3ef" },
  { key: "bookings", label: "Booking web", icon: "globe", accent: "#6f98dc", accentSoft: "#eef4ff" },
];

const STATUS_META = {
  BOOKED: { label: "Chờ check-in", bg: "#e9f4ff", fg: "#2d95df" },
  CHECKED_IN: { label: "Đang phục vụ", bg: "#e9f4ff", fg: "#2d95df" },
  DONE: { label: "Hoàn tất", bg: "#eef6e8", fg: "#729952" },
  CANCELLED: { label: "Đã hủy", bg: "#ffeceb", fg: "#df6f61" },
  NO_SHOW: { label: "Không đến", bg: "#f4efea", fg: "#8b7c71" },
} as const;

const STATUS_WEIGHT: Record<string, number> = {
  CHECKED_IN: 0,
  BOOKED: 1,
  DONE: 2,
  NO_SHOW: 3,
  CANCELLED: 4,
};

const BOOKING_STATUS_WEIGHT: Record<BookingStatusGroup, number> = {
  NEEDS_RESCHEDULE: 0,
  NEW: 1,
  EXPIRED_UNCONFIRMED: 2,
};

function normalizeFilter(value: string | string[] | undefined): SchedulingFilter {
  const next = Array.isArray(value) ? value[0] : value;
  if (next === "BOOKED" || next === "CHECKED_IN" || next === "DONE" || next === "OTHER") {
    return next;
  }
  return "ALL";
}

function createDefaultStartAt() {
  const now = new Date();
  now.setMinutes(now.getMinutes() < 30 ? 30 : 60, 0, 0);
  return now.toISOString();
}

function toDateInput(isoValue: string) {
  const date = new Date(isoValue);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function toTimeInput(isoValue: string) {
  const date = new Date(isoValue);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function toHumanDateTime(isoValue: string) {
  const date = new Date(isoValue);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return { date: `${dd}/${mm}/${yyyy}`, time: `${hh}:${min}` };
}

function combineDateAndTimeToIso(dateValue: string, timeValue: string) {
  const [day, month, year] = dateValue.split("/");
  if (!day || !month || !year || !timeValue) return null;
  const parsed = new Date(`${year}-${month}-${day}T${timeValue}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function getBookingStatusLabel(status: BookingStatusGroup) {
  return status === "NEW" ? "Mới" : "Cần dời lịch";
}

function getBookingSourceLabel(source: string | null) {
  if (!source) return "Khách tự do";
  if (source === "landing_page") return "Landing web";
  if (source === "mobile_guest") return "Mobile guest";
  return source.replace(/_/g, " ");
}

function normalizePhone(raw: string | null | undefined) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("84") && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

function getStaffAccent(index: number) {
  const accents = [
    { bg: "#ffe9de", fg: "#d98962" },
    { bg: "#e6f0ff", fg: "#6d95d6" },
    { bg: "#f2e9ff", fg: "#9a78d6" },
    { bg: "#e5f6ea", fg: "#69ae83" },
  ];
  return accents[index % accents.length];
}

function getResourceAccent(index: number) {
  const accents = [
    { bg: "#edf8f1", fg: "#69ae83" },
    { bg: "#fff3ea", fg: "#dc9362" },
    { bg: "#f4edff", fg: "#9a78d6" },
    { bg: "#edf3ff", fg: "#6d95d6" },
  ];
  return accents[index % accents.length];
}

export default function AdminSchedulingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string; tab?: string; focusBookingId?: string; status?: string }>();
  const {
    appointments,
    bookingRequests,
    resourceOptions,
    role,
    staffOptions,
    user,
    customerCrmByPhone,
    loading,
    mutating,
    reload,
    saveAppointment,
  } = useAdminOperations();

  const [filterOverride, setFilterOverride] = useState<SchedulingFilter | null>(null);
  const activeTab: SchedulingTab = params.tab === "bookings" ? "bookings" : "appointments";
  const focusedBookingId = Array.isArray(params.focusBookingId) ? params.focusBookingId[0] : params.focusBookingId;
  const [customerName, setCustomerName] = useState("");
  const defaultStartAt = useMemo(() => createDefaultStartAt(), []);
  const [dateInput, setDateInput] = useState(() => toDateInput(defaultStartAt));
  const [timeInput, setTimeInput] = useState(() => toTimeInput(defaultStartAt));
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [staffUserId, setStaffUserId] = useState(role === "TECH" ? user?.id ?? "" : "");
  const [resourceId, setResourceId] = useState("");
  
  // Date/Time picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(() => new Date().getMonth() + 1);
  const [pickerDay, setPickerDay] = useState(() => new Date().getDate());
  const [pickerHour, setPickerHour] = useState(() => 9);
  const [pickerMinute, setPickerMinute] = useState(() => 0);
  const keyboardVisible = useKeyboardVisible();
  // Parse date input (dd/mm/yyyy)
  function parseDateInput(value: string) {
    const [dd, mm, yyyy] = value.split("/");
    if (!dd || !mm || !yyyy) return null;
    return { day: parseInt(dd, 10), month: parseInt(mm, 10), year: parseInt(yyyy, 10) };
  }

  // Parse time input (HH:mm)
  function parseTimeInput(value: string) {
    const [hh, mm] = value.split(":");
    if (!hh || !mm) return null;
    return { hour: parseInt(hh, 10), minute: parseInt(mm, 10) };
  }

  // Open date picker with current value
  function openDatePicker() {
    const parsed = parseDateInput(dateInput);
    if (parsed) {
      setPickerYear(parsed.year);
      setPickerMonth(parsed.month);
      setPickerDay(parsed.day);
    }
    setShowDatePicker(true);
  }

  // Open time picker with current value
  function openTimePicker() {
    const parsed = parseTimeInput(timeInput);
    if (parsed) {
      setPickerHour(parsed.hour);
      setPickerMinute(parsed.minute);
    }
    setShowTimePicker(true);
  }

  // Confirm date selection
  function confirmDatePicker() {
    const daysInMonth = new Date(pickerYear, pickerMonth, 0).getDate();
    const validDay = Math.min(pickerDay, daysInMonth);
    const formatted = `${String(validDay).padStart(2, "0")}/${String(pickerMonth).padStart(2, "0")}/${pickerYear}`;
    setDateInput(formatted);
    setShowDatePicker(false);
  }

  // Confirm time selection
  function confirmTimePicker() {
    const formatted = `${String(pickerHour).padStart(2, "0")}:${String(pickerMinute).padStart(2, "0")}`;
    setTimeInput(formatted);
    setShowTimePicker(false);
  }

  const activeFilter = filterOverride ?? normalizeFilter(params.filter);

  const filteredAppointments = useMemo(() => {
    const rows =
      activeFilter === "ALL"
        ? appointments.filter((item) => item.status === "BOOKED" || item.status === "CHECKED_IN" || item.status === "DONE")
        : activeFilter === "OTHER"
          ? appointments.filter((item) => item.status === "NO_SHOW" || item.status === "CANCELLED")
          : appointments.filter((item) => item.status === activeFilter);

    return [...rows].sort((left, right) => {
      const statusDelta = (STATUS_WEIGHT[left.status] ?? 99) - (STATUS_WEIGHT[right.status] ?? 99);
      if (statusDelta !== 0) return statusDelta;
      return new Date(left.startAt).getTime() - new Date(right.startAt).getTime();
    });
  }, [activeFilter, appointments]);

  const visibleBookingRequests = useMemo(
    () =>
      [...bookingRequests]
        .filter(
          (item): item is typeof item & { status: BookingStatusGroup } =>
            item.status === "NEW" || item.status === "NEEDS_RESCHEDULE" || item.status === "EXPIRED_UNCONFIRMED",
        )
        .sort((left, right) => {
          if (focusedBookingId && left.id === focusedBookingId) return -1;
          if (focusedBookingId && right.id === focusedBookingId) return 1;
          const statusDelta = BOOKING_STATUS_WEIGHT[left.status] - BOOKING_STATUS_WEIGHT[right.status];
          if (statusDelta !== 0) return statusDelta;
          return new Date(left.requestedStartAt).getTime() - new Date(right.requestedStartAt).getTime();
        }),
    [bookingRequests, focusedBookingId],
  );

  const groupedBookingRequests = useMemo(
    () => ({
      NEEDS_RESCHEDULE: visibleBookingRequests.filter((item) => item.status === "NEEDS_RESCHEDULE"),
      NEW: visibleBookingRequests.filter((item) => item.status === "NEW"),
      EXPIRED_UNCONFIRMED: visibleBookingRequests.filter((item) => item.status === "EXPIRED_UNCONFIRMED"),
    }),
    [visibleBookingRequests],
  );

  const orderedBookingGroupKeys = useMemo(() => {
    const focused = visibleBookingRequests.find((item) => item.id === focusedBookingId) ?? null;
    const base: BookingStatusGroup[] = ["NEEDS_RESCHEDULE", "NEW", "EXPIRED_UNCONFIRMED"];
    if (!focused) return base;
    return [focused.status, ...base.filter((key) => key !== focused.status)];
  }, [focusedBookingId, visibleBookingRequests]);

  async function handleCreateAppointment() {
    const startAt = combineDateAndTimeToIso(dateInput, timeInput);
    const duration = Number(durationMinutes);
    if (!customerName.trim() || !startAt || !Number.isFinite(duration) || duration <= 0) return;

    const endAt = new Date(startAt);
    endAt.setMinutes(endAt.getMinutes() + duration);

    await saveAppointment({
      customerName: customerName.trim(),
      startAt,
      endAt: endAt.toISOString(),
      staffUserId: staffUserId || (role === "TECH" ? user?.id ?? "" : "") || null,
      resourceId: resourceId || null,
    });

    setCustomerName("");
    setDurationMinutes("60");
  }

  return (
    <View style={styles.screen}>
      <AdminTopSafeArea style={styles.topChrome}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Điều phối lịch</Text>
            <Text style={styles.subtitle}>Quản lý và điều phối lịch thợ dễ dàng</Text>
          </View>

          <AdminHeaderActions onSettingsPress={() => void router.push("/(admin)/settings")} />
        </View>
      </AdminTopSafeArea>

      <KeyboardAvoidingView
        style={styles.scrollRegion}
        enabled={Platform.OS === "android"}
        behavior="height"
      >
      <AdminKeyboardAwareScrollView
        contentContainerStyle={[
          styles.content,
          keyboardVisible ? { paddingBottom: ADMIN_CONTENT_BOTTOM_NAV_CLEARANCE + ADMIN_KEYBOARD_ACTIVE_FIELD_CLEARANCE } : null,
        ]}
        onScrollBeginDrag={() => Keyboard.dismiss()}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="always"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void reload()}
            tintColor={palette.brown}
            colors={[palette.brown]}
          />
        }
      >

        <View style={[styles.header, styles.hiddenHeader]}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Điều phối lịch</Text>
            <Text style={styles.subtitle}>Quản lý và điều phối lịch thợ dễ dàng</Text>
          </View>

          <AdminHeaderActions onSettingsPress={() => void router.push("/(admin)/settings")} />
        </View>

        <View style={styles.card}>
          <Field
            icon="user"
            iconColor="#6f98dc"
            placeholder="Nhập tên khách hàng"
            shellStyle={styles.fieldFull}
            value={customerName}
            onChangeText={setCustomerName}
          />

          <View style={styles.formGrid}>
            <Pressable style={[styles.field, styles.fieldWide]} onPress={openDatePicker}>
              <View style={[styles.leadingIconBadge, styles.blueIconBadge]}>
                <Feather color="#6f98dc" name="calendar" size={16} />
              </View>
              <Text style={styles.fieldText}>{dateInput}</Text>
              <Feather color="#A6988B" name="chevron-down" size={14} />
            </Pressable>
            <Pressable style={[styles.field, styles.fieldHalf]} onPress={openTimePicker}>
              <View style={[styles.leadingIconBadge, styles.greenIconBadge]}>
                <Feather color="#69ae83" name="clock" size={16} />
              </View>
              <Text style={styles.fieldText}>{timeInput}</Text>
              <Feather color="#A6988B" name="chevron-down" size={14} />
            </Pressable>
          </View>

          <Field
            chevron
            icon="users"
            iconColor="#9a78d6"
            keyboardType="number-pad"
            placeholder="60 phút"
            shellStyle={styles.fieldDuration}
            value={durationMinutes}
            onChangeText={setDurationMinutes}
          />

          <View style={styles.sectionBlock}>
            <Text style={styles.blockLabel}>Chọn thợ</Text>
            <View style={styles.optionWrap}>
              {staffOptions.map((staff, index) => {
                const active = staffUserId === staff.userId;
                const accent = getStaffAccent(index);
                return (
                  <Pressable
                    key={staff.userId}
                    onPress={() => setStaffUserId(staff.userId)}
                    style={[styles.personChip, active ? styles.personChipActive : null]}
                  >
                    <View style={[styles.avatarPlaceholder, { backgroundColor: accent.bg }]}>
                      <Text style={[styles.avatarText, { color: accent.fg }]}>{staff.name.slice(0, 1)}</Text>
                    </View>
                    <Text style={[styles.personChipText, active ? styles.personChipTextActive : null]}>
                      {staff.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.blockLabel}>Chọn tài nguyên</Text>
            <View style={styles.optionWrap}>
              {resourceOptions.map((resource, index) => {
                const active = resourceId === resource.id;
                const accent = getResourceAccent(index);
                return (
                  <Pressable
                    key={resource.id}
                    onPress={() => setResourceId(resource.id)}
                    style={[styles.resourceChip, active ? styles.resourceChipActive : null]}
                  >
                    <View style={[styles.resourceIconBadge, { backgroundColor: accent.bg }]}>
                      <Feather color={accent.fg} name="briefcase" size={14} />
                    </View>
                    <Text style={[styles.resourceChipText, active ? styles.resourceChipTextActive : null]}>
                      {resource.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable disabled={mutating} onPress={() => void handleCreateAppointment()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{mutating ? "Đang tạo..." : "Tạo lịch nhanh"}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.tabWrap}>
            {TAB_OPTIONS.map((option) => {
              const active = activeTab === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() =>
                    void router.replace({
                      pathname: "/(admin)/scheduling",
                      params: option.key === "bookings" ? { tab: "bookings" } : {},
                    })
                  }
                  style={[styles.tabChip, active ? styles.tabChipActive : null]}
                >
                  <View
                    style={[
                      styles.tabIconBadge,
                      active ? styles.tabIconBadgeActive : { backgroundColor: option.accentSoft },
                    ]}
                  >
                    <Feather color={active ? "#ffffff" : option.accent} name={option.icon} size={15} />
                  </View>
                  <Text style={[styles.tabChipText, active ? styles.tabChipTextActive : null]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {activeTab === "appointments" ? (
          <View style={styles.card}>
            <View style={styles.filterWrap}>
              {FILTER_OPTIONS.map((option) => {
                const active = activeFilter === option.value;
                return (
                <Pressable
                  key={option.value}
                  onPress={() => setFilterOverride(option.value)}
                  style={[styles.filterChip, active ? styles.filterChipActive : null]}
                >
                  <View
                    style={[
                      styles.filterIconBadge,
                      active ? styles.filterIconBadgeActive : { backgroundColor: option.accentSoft },
                    ]}
                  >
                    <Feather color={active ? "#ffffff" : option.accent} name={option.icon} size={14} />
                  </View>
                  <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.listWrap}>
            {activeTab === "appointments" && filteredAppointments.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{loading ? "Đang tải lịch..." : "Chưa có lịch phù hợp"}</Text>
              </View>
            ) : null}

            {activeTab === "bookings" && visibleBookingRequests.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{loading ? "Đang tải booking..." : "Chưa có booking web cần xử lý"}</Text>
              </View>
            ) : null}

            {activeTab === "appointments"
              ? filteredAppointments.map((item) => {
                  const meta = STATUS_META[item.status as keyof typeof STATUS_META] ?? STATUS_META.NO_SHOW;
                  const dateTime = toHumanDateTime(item.startAt);
                  const actionable = item.status === "BOOKED" || item.status === "CHECKED_IN";

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        if (!actionable) return;
                        void router.push({
                          pathname: "/(admin)/scheduling/[appointmentId]",
                          params: { appointmentId: item.id },
                        });
                      }}
                      style={styles.appointmentCard}
                    >
                      <View style={styles.appointmentAvatar}>
                        <Text style={styles.appointmentAvatarText}>{item.customerName.slice(0, 1)}</Text>
                      </View>

                      <View style={styles.appointmentCopy}>
                        <View style={styles.appointmentHeaderRow}>
                          <Text numberOfLines={1} style={styles.appointmentName}>
                            {item.customerName}
                          </Text>
                          <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                            <Text style={[styles.statusPillText, { color: meta.fg }]}>{meta.label}</Text>
                          </View>
                        </View>
                        <Text style={styles.appointmentMeta}>
                          {dateTime.time} • {dateTime.date}
                        </Text>
                        <Text style={styles.appointmentPhone}>{item.customerPhone ?? "-"}</Text>
                      </View>

                      <Feather color={palette.mutedSoft} name="chevron-right" size={20} />
                    </Pressable>
                  );
                })
              : orderedBookingGroupKeys.map((groupKey) => {
                  const rows = groupedBookingRequests[groupKey];
                  if (!rows.length) return null;

                  return (
                    <View key={groupKey} style={styles.bookingSection}>
                      <View style={styles.bookingSectionHeader}>
                        <Text style={styles.bookingSectionTitle}>
                          {groupKey === "NEEDS_RESCHEDULE"
                            ? "Cần dời lịch"
                            : groupKey === "EXPIRED_UNCONFIRMED"
                              ? "Không được xác nhận"
                              : "Booking mới"}
                        </Text>
                        <Text style={styles.bookingSectionCount}>{rows.length}</Text>
                      </View>

                      {rows.map((item) => {
                        const dateTime = toHumanDateTime(item.requestedStartAt);
                        const crm = customerCrmByPhone[normalizePhone(item.customerPhone) ?? ""] ?? null;
                        const isFocusedBooking = focusedBookingId === item.id;

                        return (
                          <Pressable
                            key={item.id}
                            onPress={() =>
                              void router.push({
                                pathname: "/booking-request/[bookingRequestId]",
                                params: { bookingRequestId: item.id },
                              })
                            }
                            style={[styles.appointmentCard, isFocusedBooking ? styles.appointmentCardFocused : null]}
                          >
                            <View style={[styles.appointmentAvatar, isFocusedBooking ? styles.appointmentAvatarFocused : null]}>
                              <Text style={styles.appointmentAvatarText}>{item.customerName.slice(0, 1)}</Text>
                            </View>

                            <View style={styles.appointmentCopy}>
                              <View style={styles.appointmentHeaderRow}>
                                <Text numberOfLines={1} style={styles.appointmentName}>
                                  {item.customerName}
                                </Text>
                                <View
                                  style={[
                                    styles.statusPill,
                                    {
                                      backgroundColor: groupKey === "NEW" ? "#fff2e7" : "#f7efe8",
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.statusPillText,
                                      {
                                        color: groupKey === "NEW" ? "#d97706" : "#8b5e34",
                                      },
                                    ]}
                                  >
                                    {getBookingStatusLabel(groupKey)}
                                  </Text>
                                </View>
                              </View>
                              <Text style={[styles.appointmentMeta, isFocusedBooking ? styles.appointmentMetaFocused : null]}>
                                {dateTime.time} • {dateTime.date} • {getBookingSourceLabel(item.source)}
                              </Text>
                              <Text style={styles.bookingDetailLine}>{item.requestedService ?? "Chua chon dich vu"}</Text>
                              <Text style={styles.bookingDetailLine}>
                                {item.customerPhone ?? "-"}
                                {item.preferredStaff ? ` • Uu tien: ${item.preferredStaff}` : ""}
                              </Text>
                              {crm ? (
                                <Text style={styles.bookingCrmLine}>
                                  CRM: {crm.customerStatus} • {crm.totalVisits} luot • {crm.totalSpend.toLocaleString("vi-VN")} VND
                                </Text>
                              ) : null}
                              {item.note ? (
                                <Text numberOfLines={2} style={styles.bookingNoteLine}>
                                  Ghi chu: {item.note}
                                </Text>
                              ) : null}
                            </View>

                            <Feather color={palette.mutedSoft} name="chevron-right" size={20} />
                          </Pressable>
                        );
                      })}
                    </View>
                  );
                })}
          </View>
        </View>
      </AdminKeyboardAwareScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
          <Pressable style={styles.pickerCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>Chọn ngày</Text>
            <View style={styles.pickerRow}>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Ngày</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <Pressable key={day} style={[styles.pickerItem, pickerDay === day && styles.pickerItemActive]} onPress={() => setPickerDay(day)}>
                      <Text style={[styles.pickerItemText, pickerDay === day && styles.pickerItemTextActive]}>{day}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Tháng</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <Pressable key={month} style={[styles.pickerItem, pickerMonth === month && styles.pickerItemActive]} onPress={() => setPickerMonth(month)}>
                      <Text style={[styles.pickerItemText, pickerMonth === month && styles.pickerItemTextActive]}>{month}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Năm</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                    <Pressable key={year} style={[styles.pickerItem, pickerYear === year && styles.pickerItemActive]} onPress={() => setPickerYear(year)}>
                      <Text style={[styles.pickerItemText, pickerYear === year && styles.pickerItemTextActive]}>{year}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
            <Pressable style={styles.pickerConfirmButton} onPress={confirmDatePicker}>
              <Text style={styles.pickerConfirmText}>Xác nhận</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Time Picker Modal */}
      <Modal visible={showTimePicker} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowTimePicker(false)}>
          <Pressable style={styles.pickerCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>Chọn giờ</Text>
            <View style={styles.pickerRow}>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Giờ</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                    <Pressable key={hour} style={[styles.pickerItem, pickerHour === hour && styles.pickerItemActive]} onPress={() => setPickerHour(hour)}>
                      <Text style={[styles.pickerItemText, pickerHour === hour && styles.pickerItemTextActive]}>{String(hour).padStart(2, "0")}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Phút</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {[0, 15, 30, 45].map((minute) => (
                    <Pressable key={minute} style={[styles.pickerItem, pickerMinute === minute && styles.pickerItemActive]} onPress={() => setPickerMinute(minute)}>
                      <Text style={[styles.pickerItemText, pickerMinute === minute && styles.pickerItemTextActive]}>{String(minute).padStart(2, "0")}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
            <Pressable style={styles.pickerConfirmButton} onPress={confirmTimePicker}>
              <Text style={styles.pickerConfirmText}>Xác nhận</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <AdminBottomNavDock current="scheduling" role={role} onNavigate={(target) => void router.replace(getAdminNavHref(target, role))} />
    </View>
  );
}

function Field({
  chevron = false,
  icon,
  iconColor = "#7d6e63",
  keyboardType,
  onChangeText,
  placeholder,
  shellStyle,
  value,
}: {
  chevron?: boolean;
  icon: React.ComponentProps<typeof Feather>["name"];
  iconColor?: string;
  keyboardType?: "default" | "number-pad";
  onChangeText: (value: string) => void;
  placeholder: string;
  shellStyle?: object;
  value: string;
}) {
  return (
    <View style={[styles.fieldShell, shellStyle]}>
      <View style={styles.leadingIconBadge}>
        <Feather color={iconColor} name={icon} size={16} />
      </View>
      <AdminKeyboardTextInput
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.mutedSoft}
        style={styles.fieldInput}
        value={value}
      />
      {chevron ? <Feather color={palette.mutedSoft} name="chevron-down" size={14} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f7f2ec" },
  scrollRegion: { flex: 1 },
  topChrome: { paddingHorizontal: 16, paddingBottom: 12 },
  content: {
    gap: 12,
    paddingBottom: ADMIN_CONTENT_BOTTOM_NAV_CLEARANCE,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 2,
  },
  hiddenHeader: {
    display: "none",
  },
  headerCopy: {
    flex: 1,
    gap: 1,
  },
  title: {
    color: "#2b241f",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  subtitle: {
    color: "#7f7064",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  headerIconButton: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 26,
  },
  headerSquareButton: {
    alignItems: "center",
    backgroundColor: "#fffdfa",
    borderColor: "#eaded3",
    borderRadius: 12,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  card: {
    backgroundColor: "#fffdfa",
    borderColor: "#ece0d5",
    borderRadius: 18,
    borderWidth: 1,
    gap: 13,
    padding: 14,
  },
  fieldShell: {
    alignItems: "center",
    backgroundColor: "#fffdfa",
    borderColor: "#ece0d5",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  leadingIconBadge: {
    alignItems: "center",
    backgroundColor: "#f4f7ff",
    borderRadius: 999,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  blueIconBadge: {
    backgroundColor: "#eef4ff",
  },
  greenIconBadge: {
    backgroundColor: "#eaf8ef",
  },
  fieldFull: {
    width: "100%",
  },
  formGrid: {
    flexDirection: "row",
    gap: 8,
  },
  fieldWide: {
    flex: 1.1,
  },
  fieldHalf: {
    flex: 0.9,
  },
  fieldDuration: {
    maxWidth: 156,
  },
  fieldInput: {
    color: "#2b241f",
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    paddingVertical: 13,
  },
  sectionBlock: {
    gap: 9,
  },
  blockLabel: {
    color: "#5f534c",
    fontSize: 13,
    fontWeight: "700",
  },
  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  personChip: {
    alignItems: "center",
    backgroundColor: "#fffdfa",
    borderColor: "#ece0d5",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  personChipActive: {
    backgroundColor: "#f4ece2",
    borderColor: "#d9c3ae",
  },
  avatarPlaceholder: {
    alignItems: "center",
    backgroundColor: "#ead9ca",
    borderRadius: 999,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  avatarText: {
    color: "#5d4c3f",
    fontSize: 12,
    fontWeight: "800",
  },
  personChipText: {
    color: "#5d4c3f",
    fontSize: 12,
    fontWeight: "600",
  },
  personChipTextActive: {
    color: "#2b241f",
  },
  resourceChip: {
    alignItems: "center",
    backgroundColor: "#fffdfa",
    borderColor: "#ece0d5",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 40,
    minWidth: "47%",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  resourceIconBadge: {
    alignItems: "center",
    borderRadius: 999,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  resourceChipActive: {
    backgroundColor: "#f4ece2",
    borderColor: "#d9c3ae",
  },
  resourceChipText: {
    color: "#6c5d52",
    fontSize: 12,
    fontWeight: "600",
  },
  resourceChipTextActive: {
    color: "#2b241f",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#3c2c22",
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 46,
    marginTop: 2,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  tabWrap: {
    flexDirection: "row",
    gap: 8,
  },
  tabChip: {
    alignItems: "center",
    backgroundColor: "#fffdfa",
    borderColor: "#ece0d5",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 14,
  },
  tabChipActive: {
    backgroundColor: "#4a3528",
    borderColor: "#4a3528",
  },
  tabChipText: {
    color: "#6c5d52",
    fontSize: 13,
    fontWeight: "700",
  },
  tabChipTextActive: {
    color: "#fff",
  },
  tabIconBadge: {
    alignItems: "center",
    borderRadius: 999,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  tabIconBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  filterWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: "#fffdfa",
    borderColor: "#ece0d5",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 16,
  },
  filterChipActive: {
    backgroundColor: "#4a3528",
    borderColor: "#4a3528",
  },
  filterChipText: {
    color: "#6c5d52",
    fontSize: 12,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#fff",
  },
  filterIconBadge: {
    alignItems: "center",
    borderRadius: 999,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  filterIconBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  listWrap: {
    gap: 10,
  },
  bookingSection: {
    gap: 8,
  },
  bookingSectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  bookingSectionTitle: {
    color: "#2b241f",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  bookingSectionCount: {
    color: "#7f7064",
    fontSize: 12,
    fontWeight: "700",
  },
  appointmentCard: {
    alignItems: "center",
    backgroundColor: "#fffdfa",
    borderColor: "#ece0d5",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 78,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  appointmentCardFocused: {
    backgroundColor: "#F8F3FF",
    borderColor: "#8A63D2",
    shadowColor: "#8A63D2",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  appointmentAvatar: {
    alignItems: "center",
    backgroundColor: "#ead9ca",
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  appointmentAvatarFocused: {
    backgroundColor: "#E7DBFF",
  },
  appointmentAvatarText: {
    color: "#5d4c3f",
    fontSize: 14,
    fontWeight: "800",
  },
  appointmentCopy: {
    flex: 1,
    gap: 3,
  },
  appointmentHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  appointmentName: {
    color: "#2b241f",
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  appointmentMeta: {
    color: "#7f7064",
    fontSize: 12,
    fontWeight: "500",
  },
  appointmentPhone: {
    color: "#9b8a7d",
    fontSize: 12,
    fontWeight: "500",
  },
  bookingDetailLine: {
    color: "#6f6155",
    fontSize: 12,
    fontWeight: "500",
  },
  bookingCrmLine: {
    color: "#6b4db5",
    fontSize: 11,
    fontWeight: "600",
  },
  bookingNoteLine: {
    color: "#8b5e34",
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 16,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: "#fffdfa",
    borderColor: "#ece0d5",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  emptyText: {
    color: "#7f7064",
    fontSize: 13,
    fontWeight: "500",
  },
  footerShell: {
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  field: {
    alignItems: "center",
    backgroundColor: "#fffdfa",
    borderColor: "#ece0d5",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  fieldText: {
    color: "#2b241f",
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerCard: {
    backgroundColor: palette.white,
    borderRadius: 24,
    padding: 20,
    width: "85%",
    maxHeight: "70%",
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.text,
    textAlign: "center",
    marginBottom: 16,
  },
  pickerRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  pickerColumn: {
    flex: 1,
    gap: 8,
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: palette.muted,
    textAlign: "center",
  },
  pickerScroll: {
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ece0d5",
  },
  pickerItem: {
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ece0d5",
  },
  pickerItemActive: {
    backgroundColor: palette.beige,
  },
  pickerItemText: {
    fontSize: 15,
    color: palette.muted,
    fontWeight: "500",
  },
  pickerItemTextActive: {
    color: palette.text,
    fontWeight: "700",
  },
  pickerConfirmButton: {
    height: 48,
    borderRadius: 16,
    backgroundColor: palette.text,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerConfirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

