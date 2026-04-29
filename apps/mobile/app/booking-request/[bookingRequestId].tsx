import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdminOperations } from "@/src/hooks/use-admin-operations";
import { addMinutesToIso, AdminBottomNav } from "@/src/features/admin/ui";
import { getAdminNavHref } from "@/src/features/admin/navigation";

const palette = {
  bg: "#FCFAF8",
  card: "#FFFFFF",
  primary: "#2F241D",
  beige: "#F3EDE7",
  beigeLight: "#F9F6F2",
  border: "#E8DDD6",
  textPrimary: "#1F1A17",
  textSecondary: "#7D716B",
  textMuted: "#A0928A",
  success: "#22C55E",
  successSoft: "#DCFCE7",
  danger: "#EF4444",
  dangerSoft: "#FEE2E2",
  shadow: "rgba(47, 36, 29, 0.08)",
};

type BookingRequestDetailProps = {
  booking: NonNullable<ReturnType<typeof useAdminOperations>["bookingRequests"][number] | null>;
  busyTargetId: string | null;
  error: string | null;
  mutating: boolean;
  resourceOptions: ReturnType<typeof useAdminOperations>["resourceOptions"];
  role: ReturnType<typeof useAdminOperations>["role"];
  router: ReturnType<typeof useRouter>;
  saveBookingRequest: ReturnType<typeof useAdminOperations>["saveBookingRequest"];
  staffOptions: ReturnType<typeof useAdminOperations>["staffOptions"];
  user: ReturnType<typeof useAdminOperations>["user"];
  convertBookingRequest: ReturnType<typeof useAdminOperations>["convertBookingRequest"];
  newBookingCount: number;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function resolveStaffName(rawValue: string | null | undefined, staffOptions: BookingRequestDetailProps["staffOptions"]) {
  if (!rawValue) return null;
  const normalized = rawValue.trim();
  if (!normalized) return null;

  const exact = staffOptions.find(
    (staff) =>
      staff.userId === normalized ||
      staff.roleId === normalized ||
      staff.name.toLowerCase() === normalized.toLowerCase(),
  );
  if (exact) return exact.name;

  const prefix = staffOptions.find(
    (staff) =>
      staff.userId.startsWith(normalized) ||
      normalized.startsWith(staff.userId) ||
      (staff.roleId ? staff.roleId.startsWith(normalized) || normalized.startsWith(staff.roleId) : false),
  );
  if (prefix) return prefix.name;

  return normalized;
}

function toLocalDateInput(isoValue: string) {
  const date = new Date(isoValue);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function fromLocalDateInput(dateValue: string) {
  const parts = dateValue.split("/");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy) return null;
  const parsed = new Date(`${yyyy}-${mm}-${dd}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toLocalTimeInput(isoValue: string) {
  const date = new Date(isoValue);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function combineDateAndTimeToIso(dateValue: string, timeValue: string) {
  const dateIso = fromLocalDateInput(dateValue);
  if (!dateIso) return null;
  
  const [hh, mm] = timeValue.split(":");
  if (!hh || !mm) return null;
  
  const parsed = new Date(dateIso);
  parsed.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function formatDisplayDate(isoValue: string) {
  const date = new Date(isoValue);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  const weekday = date.toLocaleDateString("vi-VN", { weekday: "short" });
  return `${dd}/${mm}/${yyyy} (${weekday})`;
}

function formatDisplayTime(isoValue: string) {
  const date = new Date(isoValue);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function BookingRequestEditor({
  booking,
  busyTargetId,
  error,
  mutating,
  resourceOptions,
  role,
  router,
  saveBookingRequest,
  staffOptions,
  user,
  convertBookingRequest,
  newBookingCount,
}: BookingRequestDetailProps) {
  const [scheduledDateInput, setScheduledDateInput] = useState(() => toLocalDateInput(booking.requestedStartAt));
  const [scheduledTimeInput, setScheduledTimeInput] = useState(() => toLocalTimeInput(booking.requestedStartAt));
  const [selectedStaffUserId, setSelectedStaffUserId] = useState("");
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [bookingCancelConfirmId, setBookingCancelConfirmId] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Date picker state
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(() => new Date().getMonth() + 1);
  const [pickerDay, setPickerDay] = useState(() => new Date().getDate());

  // Time picker state
  const [pickerHour, setPickerHour] = useState(() => new Date().getHours());
  const [pickerMinute, setPickerMinute] = useState(() => new Date().getMinutes());

  const effectiveScheduledStartAt =
    combineDateAndTimeToIso(scheduledDateInput, scheduledTimeInput) ?? booking.requestedStartAt ?? null;
  const effectiveSelectedStaffUserId = selectedStaffUserId || (role === "TECH" ? user?.id ?? "" : "");
  const preferredStaffName = resolveStaffName(booking.preferredStaff, staffOptions);

  async function handleConvertBooking() {
    if (!effectiveScheduledStartAt) return;
    await convertBookingRequest({
      bookingRequestId: booking.id,
      startAt: effectiveScheduledStartAt,
      staffUserId: effectiveSelectedStaffUserId || null,
      resourceId: selectedResourceId || null,
    });
    router.replace("/(admin)/scheduling");
  }

  async function handleCancelBooking() {
    await saveBookingRequest({
      bookingRequestId: booking.id,
      status: "CANCELLED",
      requestedStartAt: effectiveScheduledStartAt,
      preferredStaff: resolveStaffName(effectiveSelectedStaffUserId, staffOptions) ?? preferredStaffName ?? null,
    });
    router.replace("/(admin)/booking");
  }

  const activeStaffId = selectedStaffUserId || effectiveSelectedStaffUserId;

  return (
    <View style={styles.page}>
      {/* Customer Info Card */}
      <View style={styles.card}>
        <View style={styles.customerHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(booking.customerName)}</Text>
            </View>
          </View>
          <View style={styles.customerInfo}>
            <View style={styles.customerNameRow}>
              <Text style={styles.customerName}>{booking.customerName}</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>Mới</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.infoPillsRow}>
          <View style={styles.infoPill}>
            <Feather name="phone" size={12} color={palette.textSecondary} />
            <Text style={styles.infoPillText}>{booking.customerPhone ?? "Chưa có"}</Text>
          </View>
          <View style={styles.infoPill}>
            <Feather name="tag" size={12} color={palette.textSecondary} />
            <Text style={styles.infoPillText}>{booking.requestedService ?? "Chưa chọn"}</Text>
          </View>
        </View>

        <View style={styles.datetimeRow}>
          <Feather name="calendar" size={14} color={palette.textSecondary} />
          <Text style={styles.datetimeText}>
            {formatDisplayTime(booking.requestedStartAt)} • {formatDisplayDate(booking.requestedStartAt)}
          </Text>
        </View>

        {booking.note ? (
          <View style={styles.noteRow}>
            <Feather name="globe" size={12} color={palette.textMuted} />
            <Text style={styles.noteText}>{booking.note}</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      {/* Date Time Selector */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderIcon}>
            <Feather name="calendar" size={16} color={palette.primary} />
          </View>
          <View>
            <Text style={styles.cardTitle}>Ngày giờ mong muốn</Text>
            <Text style={styles.cardSubtitle}>{formatDisplayTime(booking.requestedStartAt)} • {formatDisplayDate(booking.requestedStartAt)}</Text>
          </View>
        </View>

        <View style={styles.datetimeInputs}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Ngày</Text>
            <Pressable
              style={styles.inputWrapper}
              onPress={() => {
                const current = fromLocalDateInput(scheduledDateInput);
                if (current) {
                  const d = new Date(current);
                  setPickerYear(d.getFullYear());
                  setPickerMonth(d.getMonth() + 1);
                  setPickerDay(d.getDate());
                }
                setShowDatePicker(true);
              }}
            >
              <Feather name="calendar" size={14} color={palette.textMuted} />
              <Text style={styles.datetimeInputText}>{scheduledDateInput}</Text>
            </Pressable>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Giờ</Text>
            <Pressable
              style={styles.inputWrapper}
              onPress={() => {
                const [hh, mm] = scheduledTimeInput.split(":").map(Number);
                setPickerHour(isNaN(hh) ? 9 : hh);
                setPickerMinute(isNaN(mm) ? 0 : mm);
                setShowTimePicker(true);
              }}
            >
              <Feather name="clock" size={14} color={palette.textMuted} />
              <Text style={styles.datetimeInputText}>{scheduledTimeInput}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.offsetRow}>
          {[
            { offset: 0, label: "Giữ giờ" },
            { offset: 30, label: "+30p" },
            { offset: 60, label: "+60p" },
            { offset: 90, label: "+90p" },
          ].map((item, index) => (
            <Pressable
              key={item.offset}
              style={[
                styles.offsetPill,
                index === 0 && styles.offsetPillActive,
              ]}
              onPress={() => {
                const nextIso = addMinutesToIso(effectiveScheduledStartAt ?? booking.requestedStartAt, item.offset);
                setScheduledDateInput(toLocalDateInput(nextIso));
                setScheduledTimeInput(toLocalTimeInput(nextIso));
              }}
            >
              <Text
                style={[
                  styles.offsetPillText,
                  index === 0 && styles.offsetPillTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

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
                    <Pressable
                      key={day}
                      style={[styles.pickerItem, pickerDay === day && styles.pickerItemActive]}
                      onPress={() => setPickerDay(day)}
                    >
                      <Text style={[styles.pickerItemText, pickerDay === day && styles.pickerItemTextActive]}>{day}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Tháng</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <Pressable
                      key={month}
                      style={[styles.pickerItem, pickerMonth === month && styles.pickerItemActive]}
                      onPress={() => setPickerMonth(month)}
                    >
                      <Text style={[styles.pickerItemText, pickerMonth === month && styles.pickerItemTextActive]}>{month}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Năm</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                    <Pressable
                      key={year}
                      style={[styles.pickerItem, pickerYear === year && styles.pickerItemActive]}
                      onPress={() => setPickerYear(year)}
                    >
                      <Text style={[styles.pickerItemText, pickerYear === year && styles.pickerItemTextActive]}>{year}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
            <Pressable style={styles.pickerConfirmButton} onPress={() => {
              const daysInMonth = new Date(pickerYear, pickerMonth, 0).getDate();
              const validDay = Math.min(pickerDay, daysInMonth);
              const date = new Date(pickerYear, pickerMonth - 1, validDay);
              setScheduledDateInput(toLocalDateInput(date.toISOString()));
              setShowDatePicker(false);
            }}>
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
                    <Pressable
                      key={hour}
                      style={[styles.pickerItem, pickerHour === hour && styles.pickerItemActive]}
                      onPress={() => setPickerHour(hour)}
                    >
                      <Text style={[styles.pickerItemText, pickerHour === hour && styles.pickerItemTextActive]}>{String(hour).padStart(2, "0")}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Phút</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {[0, 15, 30, 45].map((minute) => (
                    <Pressable
                      key={minute}
                      style={[styles.pickerItem, pickerMinute === minute && styles.pickerItemActive]}
                      onPress={() => setPickerMinute(minute)}
                    >
                      <Text style={[styles.pickerItemText, pickerMinute === minute && styles.pickerItemTextActive]}>{String(minute).padStart(2, "0")}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
            <Pressable style={styles.pickerConfirmButton} onPress={() => {
              const time = `${String(pickerHour).padStart(2, "0")}:${String(pickerMinute).padStart(2, "0")}`;
              setScheduledTimeInput(time);
              setShowTimePicker(false);
            }}>
              <Text style={styles.pickerConfirmText}>Xác nhận</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Staff Selector */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderIcon}>
            <Feather name="user" size={16} color={palette.primary} />
          </View>
          <Text style={styles.cardTitle}>Chọn thợ</Text>
        </View>

        <View style={styles.pillsRow}>
          {staffOptions.map((staff) => {
            const active = activeStaffId === staff.userId;
            return (
              <Pressable
                key={staff.userId}
                style={[styles.selectPill, active && styles.selectPillActive]}
                onPress={() => setSelectedStaffUserId(staff.userId)}
              >
                <Text style={[styles.selectPillText, active && styles.selectPillTextActive]}>
                  {staff.name}
                </Text>
                {active && (
                  <Feather name="check" size={14} color={palette.primary} />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Resource Selector */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderIcon}>
            <Feather name="grid" size={16} color={palette.primary} />
          </View>
          <Text style={styles.cardTitle}>Chọn tài nguyên</Text>
        </View>

        <View style={styles.resourceGrid}>
          {resourceOptions.map((resource) => {
            const active = selectedResourceId === resource.id;
            return (
              <Pressable
                key={resource.id}
                style={[styles.resourcePill, active && styles.selectPillActive]}
                onPress={() => setSelectedResourceId(resource.id)}
              >
                <Text style={[styles.selectPillText, active && styles.selectPillTextActive]}>
                  {resource.name}
                </Text>
                {active && (
                  <Feather name="check" size={14} color={palette.primary} />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Primary Button - Chốt lịch */}
      <Pressable
        style={[
          styles.primaryButton,
          (mutating || busyTargetId === booking.id || !effectiveScheduledStartAt) && styles.primaryButtonDisabled,
        ]}
        disabled={mutating || busyTargetId === booking.id || !effectiveScheduledStartAt}
        onPress={() => void handleConvertBooking()}
      >
        <Feather name="calendar" size={18} color="#FFFFFF" />
        <Text style={styles.primaryButtonText}>
          {busyTargetId === booking.id ? "Đang xử lý..." : "Chốt lịch"}
        </Text>
      </Pressable>

      {/* Danger Button - Khách hủy booking */}
      {bookingCancelConfirmId === booking.id ? (
        <Pressable
          style={styles.dangerButton}
          disabled={mutating || busyTargetId === booking.id}
          onPress={() => void handleCancelBooking()}
        >
          <Feather name="trash-2" size={16} color={palette.danger} />
          <Text style={styles.dangerButtonText}>Xác nhận khách hủy booking</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.dangerButton} onPress={() => setBookingCancelConfirmId(booking.id)}>
          <Feather name="trash-2" size={16} color={palette.danger} />
          <Text style={styles.dangerButtonText}>Khách hủy booking</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function BookingRequestDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ bookingRequestId?: string }>();
  const bookingRequestId = Array.isArray(params.bookingRequestId) ? params.bookingRequestId[0] : params.bookingRequestId;

  const {
    bookingRequests,
    convertBookingRequest,
    resourceOptions,
    role,
    saveBookingRequest,
    staffOptions,
    user,
    busyTargetId,
    error,
    mutating,
  } = useAdminOperations();

  const booking = useMemo(
    () => bookingRequests.find((item) => item.id === bookingRequestId) ?? null,
    [bookingRequestId, bookingRequests],
  );

  const newBookingCount = useMemo(
    () => bookingRequests.filter((item) => item.status === "NEW").length,
    [bookingRequests],
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: 100 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={() => router.back()}>
            <Feather name="chevron-left" size={24} color={palette.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {booking?.customerName ?? "Chi tiết booking"}
          </Text>
          <View style={styles.headerActions}>
            <Pressable style={styles.headerButton}>
              <View>
                <Feather name="bell" size={22} color={palette.textPrimary} />
                {newBookingCount > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>{Math.min(newBookingCount, 9)}</Text>
                  </View>
                )}
              </View>
            </Pressable>
            <Pressable style={styles.headerButton} onPress={() => router.push({ pathname: "/(admin)/settings", params: { from: "/booking-request/[bookingRequestId]" } })}>
              <Feather name="settings" size={22} color={palette.textPrimary} />
            </Pressable>
          </View>
        </View>

        {!booking ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Không tìm thấy booking</Text>
          </View>
        ) : (
          <BookingRequestEditor
            key={booking.id}
            booking={booking}
            busyTargetId={busyTargetId}
            error={error}
            mutating={mutating}
            resourceOptions={resourceOptions}
            role={role}
            router={router}
            saveBookingRequest={saveBookingRequest}
            staffOptions={staffOptions}
            user={user}
            convertBookingRequest={convertBookingRequest}
            newBookingCount={newBookingCount}
          />
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        <AdminBottomNav
          current="booking"
          role={role}
          onNavigate={(target) => {
            void router.replace(getAdminNavHref(target, role));
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginBottom: 8,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
    color: palette.textPrimary,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  headerActions: {
    flexDirection: "row",
    gap: 4,
  },
  bellBadge: {
    position: "absolute",
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: palette.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  page: {
    gap: 16,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.beige,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 2,
  },
  customerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: palette.beige,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.primary,
  },
  customerInfo: {
    flex: 1,
  },
  customerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  customerName: {
    fontSize: 20,
    fontWeight: "800",
    color: palette.textPrimary,
    letterSpacing: -0.4,
  },
  statusBadge: {
    minHeight: 22,
    borderRadius: 11,
    paddingHorizontal: 8,
    backgroundColor: palette.successSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.success,
  },
  infoPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: palette.beigeLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  infoPillText: {
    fontSize: 13,
    color: palette.textSecondary,
    fontWeight: "500",
  },
  datetimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  datetimeText: {
    fontSize: 14,
    color: palette.textSecondary,
    fontWeight: "500",
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  noteText: {
    fontSize: 12,
    color: palette.textMuted,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.danger,
    fontWeight: "600",
  },
  datetimeInputs: {
    flexDirection: "row",
    gap: 12,
  },
  inputGroup: {
    flex: 1,
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: palette.textSecondary,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: palette.beigeLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
    height: 48,
  },
  datetimeInputText: {
    flex: 1,
    fontSize: 14,
    color: palette.textPrimary,
    fontWeight: "500",
  },
  offsetRow: {
    flexDirection: "row",
    gap: 8,
  },
  offsetPill: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    alignItems: "center",
    justifyContent: "center",
  },
  offsetPillActive: {
    backgroundColor: palette.beige,
    borderColor: palette.beige,
  },
  offsetPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: palette.textSecondary,
  },
  offsetPillTextActive: {
    color: palette.primary,
    fontWeight: "700",
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  selectPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    paddingHorizontal: 16,
  },
  selectPillActive: {
    backgroundColor: palette.beige,
    borderColor: palette.beige,
  },
  selectPillText: {
    fontSize: 14,
    color: palette.textSecondary,
    fontWeight: "500",
  },
  selectPillTextActive: {
    color: palette.primary,
    fontWeight: "700",
  },
  resourceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  resourcePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    width: "48%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    paddingHorizontal: 12,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 56,
    borderRadius: 20,
    backgroundColor: palette.primary,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.danger,
    backgroundColor: palette.card,
  },
  dangerButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.danger,
  },
  emptyCard: {
    backgroundColor: palette.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 18,
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: palette.textMuted,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerCard: {
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 20,
    width: "85%",
    maxHeight: "70%",
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.textPrimary,
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
    color: palette.textSecondary,
    textAlign: "center",
  },
  pickerScroll: {
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  pickerItem: {
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  pickerItemActive: {
    backgroundColor: palette.beige,
  },
  pickerItemText: {
    fontSize: 15,
    color: palette.textSecondary,
    fontWeight: "500",
  },
  pickerItemTextActive: {
    color: palette.primary,
    fontWeight: "700",
  },
  pickerConfirmButton: {
    height: 48,
    borderRadius: 16,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerConfirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
