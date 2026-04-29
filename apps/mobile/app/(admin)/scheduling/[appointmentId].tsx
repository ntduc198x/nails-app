import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdminOperations } from "@/src/hooks/use-admin-operations";
import { AdminBottomNav, getAdminBottomBarPadding, getAdminHeaderTopPadding } from "@/src/features/admin/ui";
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
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
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
  return `${dd}/${mm}`;
}

function formatDisplayTime(isoValue: string) {
  const date = new Date(isoValue);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

type AppointmentEditorProps = ReturnType<typeof useAdminOperations>["appointments"][number];

function AppointmentEditor({ appointment, onBack }: { appointment: AppointmentEditorProps; onBack: () => void }) {
  const router = useRouter();
  const {
    resourceOptions,
    role,
    staffOptions,
    user,
    busyTargetId,
    error,
    mutating,
    saveAppointment,
    updateAppointmentStatus,
    deleteAppointment,
  } = useAdminOperations();

  const [customerName, setCustomerName] = useState(appointment.customerName);
  const [customerPhone, setCustomerPhone] = useState(appointment.customerPhone ?? "");
  const [dateInput, setDateInput] = useState(() => toLocalDateInput(appointment.startAt));
  const [timeInput, setTimeInput] = useState(() => toLocalTimeInput(appointment.startAt));
  const [durationMinutes, setDurationMinutes] = useState(() =>
    String(Math.max(15, Math.round((new Date(appointment.endAt).getTime() - new Date(appointment.startAt).getTime()) / 60000))),
  );
  const [staffUserId, setStaffUserId] = useState(appointment.staffUserId ?? (role === "TECH" ? user?.id ?? "" : ""));
  const [resourceId, setResourceId] = useState(appointment.resourceId ?? "");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(() => new Date().getMonth() + 1);
  const [pickerDay, setPickerDay] = useState(() => new Date().getDate());
  const [pickerHour, setPickerHour] = useState(() => 9);
  const [pickerMinute, setPickerMinute] = useState(() => 0);

  function openDatePicker() {
    const parsed = fromLocalDateInput(dateInput);
    if (parsed) {
      const d = new Date(parsed);
      setPickerYear(d.getFullYear());
      setPickerMonth(d.getMonth() + 1);
      setPickerDay(d.getDate());
    }
    setShowDatePicker(true);
  }

  function openTimePicker() {
    const [hh, mm] = timeInput.split(":").map(Number);
    setPickerHour(isNaN(hh) ? 9 : hh);
    setPickerMinute(isNaN(mm) ? 0 : mm);
    setShowTimePicker(true);
  }

  function confirmDatePicker() {
    const daysInMonth = new Date(pickerYear, pickerMonth, 0).getDate();
    const validDay = Math.min(pickerDay, daysInMonth);
    setDateInput(`${String(validDay).padStart(2, "0")}/${String(pickerMonth).padStart(2, "0")}/${pickerYear}`);
    setShowDatePicker(false);
  }

  function confirmTimePicker() {
    setTimeInput(`${String(pickerHour).padStart(2, "0")}:${String(pickerMinute).padStart(2, "0")}`);
    setShowTimePicker(false);
  }

  async function handleSave() {
    const normalizedStart = combineDateAndTimeToIso(dateInput, timeInput);
    const duration = Number(durationMinutes);
    if (!customerName.trim() || !normalizedStart || !Number.isFinite(duration) || duration <= 0) {
      return;
    }

    const endAt = new Date(normalizedStart);
    endAt.setMinutes(endAt.getMinutes() + duration);

    await saveAppointment({
      appointmentId: appointment.id,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || null,
      startAt: normalizedStart,
      endAt: endAt.toISOString(),
      staffUserId: staffUserId || null,
      resourceId: resourceId || null,
    });
    router.replace("/(admin)/scheduling");
  }

  async function handleDelete() {
    await deleteAppointment(appointment.id);
    router.replace("/(admin)/scheduling");
  }

  return (
    <View style={styles.page}>
      {/* Booking Info Card */}
      <View style={styles.card}>
        <View style={styles.bookingHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(appointment.customerName)}</Text>
            </View>
          </View>
          <View style={styles.bookingInfo}>
            <View style={styles.bookingNameRow}>
              <Text style={styles.bookingName}>{appointment.customerName}</Text>
              <View style={[styles.statusBadge, appointment.status === "BOOKED" && styles.statusBadgeBooked]}>
                <Text style={[styles.statusBadgeText, appointment.status === "BOOKED" && styles.statusBadgeTextBooked]}>
                  {appointment.status === "BOOKED" ? "Chờ check-in" : "Đang phục vụ"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.infoPillsRow}>
          <View style={styles.infoPill}>
            <Feather name="clock" size={12} color={palette.textSecondary} />
            <Text style={styles.infoPillText}>
              {formatDisplayTime(appointment.startAt)} - {formatDisplayDate(appointment.startAt)}
            </Text>
          </View>
          <View style={styles.infoPill}>
            <Feather name="map-pin" size={12} color={palette.textSecondary} />
            <Text style={styles.infoPillText}>Chi nhánh Hà Nội</Text>
          </View>
        </View>
      </View>

      {/* Customer Form Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Thông tin khách</Text>

        <View style={styles.inputGroup}>
          <View style={styles.inputWrapper}>
            <Feather name="user" size={14} color={palette.textMuted} />
            <TextInput
              style={styles.inputText}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Tên khách"
              placeholderTextColor={palette.textMuted}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.inputWrapper}>
            <Feather name="phone" size={14} color={palette.textMuted} />
            <TextInput
              style={styles.inputText}
              value={customerPhone}
              onChangeText={setCustomerPhone}
              keyboardType="phone-pad"
              placeholder="Số điện thoại"
              placeholderTextColor={palette.textMuted}
            />
          </View>
        </View>

        <View style={styles.formRow}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.inputLabel}>Ngày</Text>
            <Pressable style={styles.inputWrapper} onPress={openDatePicker}>
              <Feather name="calendar" size={14} color={palette.textMuted} />
              <Text style={styles.inputText}>{dateInput}</Text>
              <Feather name="chevron-down" size={14} color={palette.textMuted} />
            </Pressable>
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.inputLabel}>Giờ</Text>
            <Pressable style={styles.inputWrapper} onPress={openTimePicker}>
              <Feather name="clock" size={14} color={palette.textMuted} />
              <Text style={styles.inputText}>{timeInput}</Text>
              <Feather name="chevron-down" size={14} color={palette.textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Thời lượng (phút)</Text>
          <View style={styles.inputWrapper}>
            <Feather name="watch" size={14} color={palette.textMuted} />
            <TextInput
              style={styles.inputText}
              value={durationMinutes}
              onChangeText={setDurationMinutes}
              keyboardType="number-pad"
              placeholder="60"
              placeholderTextColor={palette.textMuted}
            />
          </View>
        </View>
      </View>

      {/* Staff Selector */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Feather name="user" size={16} color={palette.primary} />
          <Text style={styles.cardTitle}>Chọn thợ</Text>
        </View>
        <View style={styles.pillsRow}>
          {staffOptions.map((staff) => {
            const active = staffUserId === staff.userId;
            return (
              <Pressable
                key={staff.userId}
                style={[styles.selectPill, active && styles.selectPillActive]}
                onPress={() => setStaffUserId(staff.userId)}
              >
                <Text style={[styles.selectPillText, active && styles.selectPillTextActive]}>{staff.name}</Text>
                {active && <Feather name="check" size={14} color={palette.primary} />}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Resource Selector */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Feather name="grid" size={16} color={palette.primary} />
          <Text style={styles.cardTitle}>Chọn tài nguyên</Text>
        </View>
        <View style={styles.resourceGrid}>
          {resourceOptions.map((resource) => {
            const active = resourceId === resource.id;
            return (
              <Pressable
                key={resource.id}
                style={[styles.resourcePill, active && styles.selectPillActive]}
                onPress={() => setResourceId(resource.id)}
              >
                <Text style={[styles.selectPillText, active && styles.selectPillTextActive]}>{resource.name}</Text>
                {active && <Feather name="check" size={14} color={palette.primary} />}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Action Buttons */}
      <Pressable
        style={[styles.primaryButton, (mutating || busyTargetId === appointment.id) && styles.primaryButtonDisabled]}
        disabled={mutating || busyTargetId === appointment.id}
        onPress={() => void handleSave()}
      >
        <Feather name="save" size={18} color="#FFFFFF" />
        <Text style={styles.primaryButtonText}>{busyTargetId === appointment.id ? "Đang lưu..." : "Lưu"}</Text>
      </Pressable>

      {appointment.status === "BOOKED" && (
        <Pressable
          style={styles.checkinButton}
          disabled={mutating || busyTargetId === appointment.id}
          onPress={() => void updateAppointmentStatus(appointment.id, "CHECKED_IN")}
        >
          <Feather name="user-check" size={16} color={palette.success} />
          <Text style={styles.checkinButtonText}>Check-in</Text>
        </Pressable>
      )}

      {appointment.status === "CHECKED_IN" && (
        <Pressable style={styles.secondaryButton} onPress={() => router.push({ pathname: "/(admin)/checkout", params: { appointmentId: appointment.id } })}>
          <Feather name="credit-card" size={16} color={palette.textPrimary} />
          <Text style={styles.secondaryButtonText}>Check-out</Text>
        </Pressable>
      )}

      {deleteConfirm ? (
        <Pressable style={styles.dangerButton} disabled={mutating || busyTargetId === appointment.id} onPress={() => void handleDelete()}>
          <Feather name="trash-2" size={16} color={palette.danger} />
          <Text style={styles.dangerButtonText}>Xác nhận xóa lịch</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.dangerButton} onPress={() => setDeleteConfirm(true)}>
          <Feather name="trash-2" size={16} color={palette.danger} />
          <Text style={styles.dangerButtonText}>Xóa lịch</Text>
        </Pressable>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

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
    </View>
  );
}

export default function AdminAppointmentDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ appointmentId?: string }>();
  const appointmentId = Array.isArray(params.appointmentId) ? params.appointmentId[0] : params.appointmentId;

  const { appointments, bookingRequests, role, user } = useAdminOperations();

  const appointment = useMemo(
    () => appointments.find((item) => item.id === appointmentId) ?? null,
    [appointmentId, appointments],
  );

  const newBookingCount = useMemo(
    () => bookingRequests.filter((item) => item.status === "NEW").length,
    [bookingRequests],
  );

  if (!appointment) {
    return (
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: getAdminHeaderTopPadding(insets.top) + 8 }]}>
          <Pressable style={styles.headerButton} onPress={() => router.back()}>
            <Feather name="chevron-left" size={24} color={palette.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Không tìm thấy lịch</Text>
          <View style={styles.headerActions} />
        </View>
        <View style={[styles.bottomBar, { paddingBottom: getAdminBottomBarPadding(insets.bottom) }]}>
          <AdminBottomNav current="scheduling" role={role} onNavigate={(target) => void router.replace(getAdminNavHref(target, role))} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: getAdminHeaderTopPadding(insets.top) + 8, paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={() => router.replace("/(admin)/scheduling")}>
            <Feather name="chevron-left" size={24} color={palette.textPrimary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerSubtitle}>Điều phối</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{appointment.customerName}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.headerIconButton}>
              <View>
                <Feather name="bell" size={22} color={palette.textPrimary} />
                {newBookingCount > 0 && <View style={styles.bellBadge}><Text style={styles.bellBadgeText}>{Math.min(newBookingCount, 9)}</Text></View>}
              </View>
            </Pressable>
            <Pressable style={styles.headerIconButton} onPress={() => router.push({ pathname: "/(admin)/settings", params: { from: "/(admin)/scheduling/[appointmentId]" } })}>
              <Feather name="settings" size={22} color={palette.textPrimary} />
            </Pressable>
          </View>
        </View>

        <AppointmentEditor appointment={appointment} onBack={() => router.replace("/(admin)/scheduling")} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={[styles.bottomBar, { paddingBottom: getAdminBottomBarPadding(insets.bottom) }]}>
        <AdminBottomNav current="scheduling" role={role} onNavigate={(target) => void router.replace(getAdminNavHref(target, role))} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingBottom: 12 },
  headerButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, marginLeft: 8 },
  headerSubtitle: { fontSize: 12, color: palette.textMuted, fontWeight: "500" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: palette.textPrimary, letterSpacing: -0.4 },
  headerActions: { flexDirection: "row", gap: 4 },
  headerIconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  bellBadge: { position: "absolute", top: -2, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: palette.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  bellBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  page: { gap: 16 },
  backButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  backButtonText: { fontSize: 14, fontWeight: "600", color: palette.textSecondary },
  card: { backgroundColor: palette.card, borderRadius: 20, borderWidth: 1, borderColor: palette.border, padding: 16, gap: 12 },
  bookingHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarContainer: {},
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: palette.beige, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "800", color: palette.primary },
  bookingInfo: { flex: 1 },
  bookingNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bookingName: { fontSize: 20, fontWeight: "800", color: palette.textPrimary, letterSpacing: -0.4 },
  statusBadge: { minHeight: 24, borderRadius: 12, paddingHorizontal: 10, backgroundColor: palette.successSoft, alignItems: "center", justifyContent: "center" },
  statusBadgeText: { fontSize: 11, fontWeight: "700", color: palette.success },
  statusBadgeBooked: { backgroundColor: "#E0F2FE" },
  statusBadgeTextBooked: { color: "#0284C7" },
  infoPillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: palette.beigeLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  infoPillText: { fontSize: 13, color: palette.textSecondary, fontWeight: "500" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: palette.textPrimary },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: palette.textSecondary },
  inputWrapper: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: palette.beigeLight, borderRadius: 14, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 12, height: 48 },
  inputText: { flex: 1, fontSize: 14, color: palette.textPrimary, fontWeight: "500" },
  formRow: { flexDirection: "row", gap: 12 },
  pillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  selectPill: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, borderRadius: 20, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, paddingHorizontal: 16 },
  selectPillActive: { backgroundColor: palette.beige, borderColor: palette.beige },
  selectPillText: { fontSize: 14, color: palette.textSecondary, fontWeight: "500" },
  selectPillTextActive: { color: palette.primary, fontWeight: "700" },
  resourceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  resourcePill: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, width: "48%", borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, paddingHorizontal: 12 },
  primaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 56, borderRadius: 20, backgroundColor: palette.primary },
  primaryButtonDisabled: { opacity: 0.55 },
  primaryButtonText: { fontSize: 17, fontWeight: "800", color: "#FFFFFF", letterSpacing: -0.2 },
  checkinButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 18, borderWidth: 1, borderColor: palette.success, backgroundColor: palette.successSoft },
  checkinButtonText: { fontSize: 15, fontWeight: "700", color: palette.success },
  secondaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  secondaryButtonText: { fontSize: 15, fontWeight: "700", color: palette.textPrimary },
  dangerButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 18, borderWidth: 1, borderColor: palette.danger, backgroundColor: palette.card },
  dangerButtonText: { fontSize: 15, fontWeight: "700", color: palette.danger },
  errorText: { fontSize: 13, color: palette.danger, fontWeight: "600", textAlign: "center" },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(255,255,255,0.98)", borderTopWidth: 1, borderTopColor: palette.border, paddingHorizontal: 14, paddingTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  pickerCard: { backgroundColor: palette.card, borderRadius: 24, padding: 20, width: "85%", maxHeight: "70%" },
  pickerTitle: { fontSize: 18, fontWeight: "800", color: palette.textPrimary, textAlign: "center", marginBottom: 16 },
  pickerRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  pickerColumn: { flex: 1, gap: 8 },
  pickerLabel: { fontSize: 13, fontWeight: "600", color: palette.textSecondary, textAlign: "center" },
  pickerScroll: { height: 180, borderRadius: 12, borderWidth: 1, borderColor: palette.border },
  pickerItem: { paddingVertical: 10, alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  pickerItemActive: { backgroundColor: palette.beige },
  pickerItemText: { fontSize: 15, color: palette.textSecondary, fontWeight: "500" },
  pickerItemTextActive: { color: palette.primary, fontWeight: "700" },
  pickerConfirmButton: { height: 48, borderRadius: 16, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  pickerConfirmText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
});
