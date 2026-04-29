import Feather from "@expo/vector-icons/Feather";
import { useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AdminBottomNav, getAdminBottomBarPadding, getAdminHeaderTopPadding } from "@/src/features/admin/ui";
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

const FILTER_OPTIONS = [
  { value: "ALL" as const, label: "Tất cả" },
  { value: "BOOKED" as const, label: "Chờ check-in" },
  { value: "CHECKED_IN" as const, label: "Đang phục vụ" },
  { value: "DONE" as const, label: "Hoàn tất" },
  { value: "OTHER" as const, label: "Khác" },
];

const STATUS_META = {
  BOOKED: { label: "Chờ check-in", bg: "#e9f4ff", fg: "#2d95df" },
  CHECKED_IN: { label: "Đang phục vụ", bg: "#e9f4ff", fg: "#2d95df" },
  DONE: { label: "Hoàn tất", bg: "#eef6e8", fg: "#729952" },
  CANCELLED: { label: "Đã hủy", bg: "#ffeceb", fg: "#df6f61" },
  NO_SHOW: { label: "Khác", bg: "#f4efea", fg: "#8b7c71" },
} as const;

const STATUS_WEIGHT: Record<string, number> = {
  CHECKED_IN: 0,
  BOOKED: 1,
  DONE: 2,
  NO_SHOW: 3,
  CANCELLED: 4,
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

export default function AdminSchedulingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ filter?: string }>();
  const {
    appointments,
    resourceOptions,
    role,
    staffOptions,
    user,
    loading,
    mutating,
    reload,
    saveAppointment,
  } = useAdminOperations();

  const [filterOverride, setFilterOverride] = useState<SchedulingFilter | null>(null);
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
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: getAdminHeaderTopPadding(insets.top), paddingBottom: 112 + Math.max(insets.bottom, 8) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Điều phối lịch</Text>
            <Text style={styles.subtitle}>Quản lý và điều phối lịch thợ dễ dàng</Text>
          </View>

          <Pressable hitSlop={12} onPress={() => void reload()} style={styles.headerSquareButton}>
            <Feather color="#6b5c50" name="calendar" size={18} />
          </Pressable>
        </View>

        <View style={styles.card}>
          <Field
            icon="user"
            placeholder="Nhập tên khách hàng"
            shellStyle={styles.fieldFull}
            value={customerName}
            onChangeText={setCustomerName}
          />

          <View style={styles.formGrid}>
            <Pressable style={[styles.field, styles.fieldWide]} onPress={openDatePicker}>
              <Feather color="#7d6e63" name="calendar" size={15} />
              <Text style={styles.fieldText}>{dateInput}</Text>
              <Feather color="#A6988B" name="chevron-down" size={14} />
            </Pressable>
            <Pressable style={[styles.field, styles.fieldHalf]} onPress={openTimePicker}>
              <Feather color="#7d6e63" name="clock" size={15} />
              <Text style={styles.fieldText}>{timeInput}</Text>
              <Feather color="#A6988B" name="chevron-down" size={14} />
            </Pressable>
          </View>

          <Field
            chevron
            icon="watch"
            keyboardType="number-pad"
            placeholder="60 phút"
            shellStyle={styles.fieldDuration}
            value={durationMinutes}
            onChangeText={setDurationMinutes}
          />

          <View style={styles.sectionBlock}>
            <Text style={styles.blockLabel}>Chọn thợ</Text>
            <View style={styles.optionWrap}>
              {staffOptions.map((staff) => {
                const active = staffUserId === staff.userId;
                return (
                  <Pressable
                    key={staff.userId}
                    onPress={() => setStaffUserId(staff.userId)}
                    style={[styles.personChip, active ? styles.personChipActive : null]}
                  >
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>{staff.name.slice(0, 1)}</Text>
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
              {resourceOptions.map((resource) => {
                const active = resourceId === resource.id;
                return (
                  <Pressable
                    key={resource.id}
                    onPress={() => setResourceId(resource.id)}
                    style={[styles.resourceChip, active ? styles.resourceChipActive : null]}
                  >
                    <Feather color={active ? "#2b241f" : "#7f7064"} name="briefcase" size={14} />
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
          <View style={styles.filterWrap}>
            {FILTER_OPTIONS.map((option) => {
              const active = activeFilter === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setFilterOverride(option.value)}
                  style={[styles.filterChip, active ? styles.filterChipActive : null]}
                >
                  <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.listWrap}>
          {filteredAppointments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>{loading ? "Đang tải lịch..." : "Chưa có lịch phù hợp"}</Text>
            </View>
          ) : null}

          {filteredAppointments.map((item) => {
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
          })}
          </View>
        </View>
      </ScrollView>

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

      <View style={[styles.footerShell, { paddingBottom: getAdminBottomBarPadding(insets.bottom) }]}>
        <AdminBottomNav current="scheduling" role={role} onNavigate={(target) => void router.replace(getAdminNavHref(target, role))} />
      </View>
    </SafeAreaView>
  );
}

function Field({
  chevron = false,
  icon,
  keyboardType,
  onChangeText,
  placeholder,
  shellStyle,
  value,
}: {
  chevron?: boolean;
  icon: React.ComponentProps<typeof Feather>["name"];
  keyboardType?: "default" | "number-pad";
  onChangeText: (value: string) => void;
  placeholder: string;
  shellStyle?: object;
  value: string;
}) {
  return (
    <View style={[styles.fieldShell, shellStyle]}>
      <Feather color="#7d6e63" name={icon} size={15} />
      <TextInput
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
  screen: {
    backgroundColor: "#f7f2ec",
    flex: 1,
  },
  content: {
    gap: 12,
    paddingBottom: 128,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 2,
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
  listWrap: {
    gap: 10,
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
  appointmentAvatar: {
    alignItems: "center",
    backgroundColor: "#ead9ca",
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
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
    backgroundColor: "#fffaf5",
    borderTopColor: "#eadbc8",
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
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

