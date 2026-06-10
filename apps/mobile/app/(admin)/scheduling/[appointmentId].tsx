import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  buildAppointmentWindow,
  findAvailableFootHandCombo,
  getFootHandComboCopy,
  getOccupiedResourceIdsForWindow,
} from "@/src/features/admin/resource-combo";
import {
  canCheckInAppointmentAt,
  deleteAppointmentForMobile,
  getAppointmentForMobile,
  isAppointmentArrivalOverdue,
  listAppointmentsForMobile,
  listBookingRequestsForMobile,
  saveAppointmentForMobile,
  translate,
  updateAppointmentStatusForMobile,
  type AppRole,
  type MobileAppointmentSummary,
} from "@nails/shared";
import { useAdminStrings } from "@/src/features/admin/strings";
import {
  normalizeAdminObserverScope,
  listResourceOptions,
  listStaffOptions,
  removeAppointmentFromAdminOperationsCache,
  upsertAppointmentInAdminOperationsCache,
  type ResourceOption,
  type StaffOption,
} from "@/src/hooks/use-admin-operations";
import { AdminBottomNavDock, AdminDetailLoadingScreen, AdminKeyboardAwareScrollView, AdminTopSafeArea, ADMIN_CONTENT_BOTTOM_NAV_CLEARANCE, ADMIN_KEYBOARD_ACTIVE_FIELD_CLEARANCE, useAdminKeyboardFieldFocus, useKeyboardVisible } from "@/src/features/admin/ui";
import { dismissToHref, getAdminNavHref } from "@/src/features/admin/navigation";
import { useAdminObserverScope } from "@/src/hooks/use-admin-observer-scope";
import { mobileSupabase } from "@/src/lib/supabase";
import { useAdminPreferences } from "@/src/providers/admin-preferences-provider";
import { useSession } from "@/src/providers/session-provider";

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

function getAppointmentDetailStatusCopy(
  appointment: Pick<MobileAppointmentSummary, "startAt" | "status">,
  strings: ReturnType<typeof useAdminStrings>,
) {
  const isArrivalOverdue = isAppointmentArrivalOverdue(appointment);

  if (appointment.status === "BOOKED") {
    return {
      isArrivalOverdue,
      label: isArrivalOverdue ? strings.manageSchedulingStatusOverdue : strings.manageSchedulingStatusBooked,
    };
  }

  if (appointment.status === "CHECKED_IN") {
    return { isArrivalOverdue: false, label: strings.manageSchedulingStatusCheckedIn };
  }

  if (appointment.status === "DONE") {
    return { isArrivalOverdue: false, label: strings.manageSchedulingStatusDone };
  }

  if (appointment.status === "CANCELLED") {
    return { isArrivalOverdue: false, label: strings.manageSchedulingStatusCancelled };
  }

  return { isArrivalOverdue: false, label: strings.manageSchedulingStatusNoShow };
}

type AppointmentEditorProps = {
  appointment: MobileAppointmentSummary;
  appointments: MobileAppointmentSummary[];
  resourceOptions: ResourceOption[];
  role: AppRole | null;
  staffOptions: StaffOption[];
  userId: string | null;
  busyTargetId: string | null;
  error: string | null;
  mutating: boolean;
  saveAppointment: (input: {
    appointmentId: string;
    customerName: string;
    customerPhone?: string | null;
    startAt: string;
    endAt: string;
    staffUserId?: string | null;
    resourceId?: string | null;
    secondaryResourceId?: string | null;
  }) => Promise<void>;
  updateAppointmentStatus: (appointmentId: string, status: "BOOKED" | "CHECKED_IN" | "DONE" | "CANCELLED" | "NO_SHOW") => Promise<void>;
  deleteAppointment: (appointmentId: string) => Promise<void>;
};

function AppointmentEditor({
  appointment,
  appointments,
  resourceOptions,
  role,
  staffOptions,
  userId,
  busyTargetId,
  error,
  mutating,
  saveAppointment,
  updateAppointmentStatus,
  deleteAppointment,
}: AppointmentEditorProps) {
  const strings = useAdminStrings();
  const router = useRouter();
  const { locale } = useAdminPreferences();

  const [customerName, setCustomerName] = useState(appointment.customerName);
  const [customerPhone, setCustomerPhone] = useState(appointment.customerPhone ?? "");
  const [dateInput, setDateInput] = useState(() => toLocalDateInput(appointment.startAt));
  const [timeInput, setTimeInput] = useState(() => toLocalTimeInput(appointment.startAt));
  const [durationMinutes, setDurationMinutes] = useState(() =>
    String(Math.max(15, Math.round((new Date(appointment.endAt).getTime() - new Date(appointment.startAt).getTime()) / 60000))),
  );
  const [staffUserId, setStaffUserId] = useState(appointment.staffUserId ?? (role === "TECH" ? userId ?? "" : ""));
  const [resourceId, setResourceId] = useState(appointment.resourceId ?? "");
  const [secondaryResourceId, setSecondaryResourceId] = useState<string | null>(appointment.secondaryResourceId ?? null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const handleFieldFocus = useAdminKeyboardFieldFocus();

  // Picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(() => new Date().getMonth() + 1);
  const [pickerDay, setPickerDay] = useState(() => new Date().getDate());
  const [pickerHour, setPickerHour] = useState(() => 9);
  const [pickerMinute, setPickerMinute] = useState(() => 0);
  const { isArrivalOverdue, label: statusLabel } = getAppointmentDetailStatusCopy(appointment, strings);
  const canCheckInNow = appointment.status === "BOOKED" && canCheckInAppointmentAt(appointment.startAt);
  const cancelAppointmentCopy =
    locale === "vi"
      ? {
          button: "Hủy lịch",
          confirmTitle: "Xác nhận hủy lịch",
          confirmBody: "Bạn có chắc muốn hủy lịch hẹn này không?",
        }
      : {
          button: "Cancel appointment",
          confirmTitle: "Confirm cancellation",
          confirmBody: "Are you sure you want to cancel this appointment?",
        };
  const comboCopy = getFootHandComboCopy(locale);
  const comboActive = Boolean(resourceId && secondaryResourceId);

  function goBackToScheduling() {
    dismissToHref(router, "/(admin)/(tabs)/scheduling");
  }

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

  function handleSelectResource(nextResourceId: string) {
    setResourceId(nextResourceId);
    setSecondaryResourceId(null);
  }

  function handleSelectFootHandCombo() {
    const appointmentWindow = buildAppointmentWindow(dateInput, timeInput, durationMinutes);
    if (!appointmentWindow) {
      return;
    }

    const comboSelection = findAvailableFootHandCombo({
      appointments,
      resourceOptions,
      startAt: appointmentWindow.startAt,
      endAt: appointmentWindow.endAt,
      excludedAppointmentId: appointment.id,
    });

    if (
      !resourceOptions.some((resource) => resource.type === "CHAIR")
      || !resourceOptions.some((resource) => resource.type === "TABLE")
    ) {
      Alert.alert(comboCopy.missingPairTitle, comboCopy.missingPairBody);
      return;
    }

    if (!comboSelection) {
      setSecondaryResourceId(null);
      Alert.alert(comboCopy.unavailableTitle, comboCopy.unavailableBody);
      return;
    }

    setResourceId(comboSelection.resourceId);
    setSecondaryResourceId(comboSelection.secondaryResourceId);
  }

  async function handleSave() {
    const appointmentWindow = buildAppointmentWindow(dateInput, timeInput, durationMinutes);
    if (!customerName.trim() || !appointmentWindow) {
      return;
    }
    if (new Date(appointmentWindow.startAt).getTime() < Date.now()) {
      Alert.alert(strings.manageSchedulingDetailSave, translate(locale, "errors", "bookingTimePast"));
      return;
    }

    const requestedResourceIds = [resourceId, secondaryResourceId].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    const occupiedResourceIds = getOccupiedResourceIdsForWindow(
      appointments,
      appointmentWindow.startAt,
      appointmentWindow.endAt,
      appointment.id,
    );

    if (requestedResourceIds.some((value) => occupiedResourceIds.has(value))) {
      Alert.alert(
        comboActive ? comboCopy.unavailableTitle : comboCopy.conflictTitle,
        comboActive ? comboCopy.unavailableBody : translate(locale, "errors", "appointmentResourceConflict"),
      );
      return;
    }

    await saveAppointment({
      appointmentId: appointment.id,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || null,
      startAt: appointmentWindow.startAt,
      endAt: appointmentWindow.endAt,
      staffUserId: staffUserId || null,
      resourceId: resourceId || null,
      secondaryResourceId,
    });
    goBackToScheduling();
  }

  async function handleDelete() {
    await deleteAppointment(appointment.id);
    goBackToScheduling();
  }

  function handleCancelAppointment() {
    Alert.alert(cancelAppointmentCopy.confirmTitle, cancelAppointmentCopy.confirmBody, [
      { text: strings.settingsCancelButton, style: "cancel" },
      {
        text: cancelAppointmentCopy.button,
        style: "destructive",
        onPress: () => {
          void updateAppointmentStatus(appointment.id, "CANCELLED");
        },
      },
    ]);
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
            </View>
            <View style={styles.statusBadgeWrap}>
              <Text style={styles.statusLabel}>{strings.manageSchedulingDetailStatusLabel}</Text>
              <View
                style={[
                  styles.statusBadge,
                  appointment.status === "BOOKED" && styles.statusBadgeBooked,
                  isArrivalOverdue && styles.statusBadgeOverdue,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    appointment.status === "BOOKED" && styles.statusBadgeTextBooked,
                    isArrivalOverdue && styles.statusBadgeTextOverdue,
                  ]}
                >
                  {statusLabel}
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
            <Text style={styles.infoPillText}>{strings.manageSchedulingDetailBranchLabel}</Text>
          </View>
        </View>
      </View>

      {/* Customer Form Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{strings.manageSchedulingDetailCustomerInfo}</Text>

        <View style={styles.inputGroup}>
          <View style={styles.inputWrapper}>
            <Feather name="user" size={14} color={palette.textMuted} />
            <TextInput
              onFocus={handleFieldFocus}
              style={styles.inputText}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder={strings.manageSchedulingDetailCustomerNamePlaceholder}
              placeholderTextColor={palette.textMuted}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.inputWrapper}>
            <Feather name="phone" size={14} color={palette.textMuted} />
            <TextInput
              onFocus={handleFieldFocus}
              style={styles.inputText}
              value={customerPhone}
              onChangeText={setCustomerPhone}
              keyboardType="phone-pad"
              placeholder={strings.manageSchedulingDetailPhonePlaceholder}
              placeholderTextColor={palette.textMuted}
            />
          </View>
        </View>

        <View style={styles.formRow}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.inputLabel}>{strings.manageSchedulingDetailDateLabel}</Text>
            <Pressable style={styles.inputWrapper} onPress={openDatePicker}>
              <Feather name="calendar" size={14} color={palette.textMuted} />
              <Text style={styles.inputText}>{dateInput}</Text>
              <Feather name="chevron-down" size={14} color={palette.textMuted} />
            </Pressable>
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.inputLabel}>{strings.manageSchedulingDetailTimeLabel}</Text>
            <Pressable style={styles.inputWrapper} onPress={openTimePicker}>
              <Feather name="clock" size={14} color={palette.textMuted} />
              <Text style={styles.inputText}>{timeInput}</Text>
              <Feather name="chevron-down" size={14} color={palette.textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{strings.manageSchedulingDetailDurationLabel}</Text>
          <View style={styles.inputWrapper}>
            <Feather name="watch" size={14} color={palette.textMuted} />
            <TextInput
              onFocus={handleFieldFocus}
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
          <Text style={styles.cardTitle}>{strings.manageSchedulingDetailStaffTitle}</Text>
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
          <Text style={styles.cardTitle}>{strings.manageSchedulingDetailResourceTitle}</Text>
        </View>
        <Pressable
          style={[styles.comboButton, comboActive ? styles.comboButtonActive : null]}
          onPress={handleSelectFootHandCombo}
        >
          <Feather name="layers" size={14} color={comboActive ? "#FFFFFF" : palette.primary} />
          <Text style={[styles.comboButtonText, comboActive ? styles.comboButtonTextActive : null]}>
            {comboCopy.label}
          </Text>
        </Pressable>
        <View style={styles.resourceGrid}>
          {resourceOptions.map((resource) => {
            const active = resourceId === resource.id || secondaryResourceId === resource.id;
            return (
              <Pressable
                key={resource.id}
                style={[styles.resourcePill, active && styles.selectPillActive]}
                onPress={() => handleSelectResource(resource.id)}
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
        <Text style={styles.primaryButtonText}>{busyTargetId === appointment.id ? strings.manageSchedulingDetailSaving : strings.manageSchedulingDetailSave}</Text>
      </Pressable>

      {appointment.status === "BOOKED" && (
        <>
          <Pressable
            style={[styles.checkinButton, !canCheckInNow ? styles.checkinButtonDisabled : null]}
            disabled={mutating || busyTargetId === appointment.id || !canCheckInNow}
            onPress={() => void updateAppointmentStatus(appointment.id, "CHECKED_IN")}
          >
            <Feather name="user-check" size={16} color={palette.success} />
            <Text style={styles.checkinButtonText}>{strings.manageSchedulingDetailCheckIn}</Text>
          </Pressable>
          {!canCheckInNow ? (
            <Text style={styles.checkinHintText}>{strings.manageSchedulingDetailCheckInHint}</Text>
          ) : null}
          <Pressable
            style={styles.dangerButton}
            disabled={mutating || busyTargetId === appointment.id}
            onPress={handleCancelAppointment}
          >
            <Feather name="x-circle" size={16} color={palette.danger} />
            <Text style={styles.dangerButtonText}>{cancelAppointmentCopy.button}</Text>
          </Pressable>
        </>
      )}

      {appointment.status === "CHECKED_IN" && (
        <Pressable style={styles.secondaryButton} onPress={() => router.push({ pathname: "/checkout", params: { appointmentId: appointment.id } })}>
          <Feather name="credit-card" size={16} color={palette.textPrimary} />
          <Text style={styles.secondaryButtonText}>{strings.manageSchedulingDetailCheckOut}</Text>
        </Pressable>
      )}

      {appointment.status !== "BOOKED"
        ? deleteConfirm ? (
            <Pressable style={styles.dangerButton} disabled={mutating || busyTargetId === appointment.id} onPress={() => void handleDelete()}>
              <Feather name="trash-2" size={16} color={palette.danger} />
              <Text style={styles.dangerButtonText}>{strings.manageSchedulingDetailConfirmDelete}</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.dangerButton} onPress={() => setDeleteConfirm(true)}>
              <Feather name="trash-2" size={16} color={palette.danger} />
              <Text style={styles.dangerButtonText}>{strings.manageSchedulingDetailDelete}</Text>
            </Pressable>
          )
        : null}

      {error && <Text style={styles.errorText}>{error}</Text>}

      {showDatePicker ? (
        <Modal visible transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
            <Pressable style={styles.pickerCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.pickerTitle}>{strings.manageSchedulingPickerDateTitle}</Text>
              <View style={styles.pickerRow}>
                <View style={styles.pickerColumn}>
                  <Text style={styles.pickerLabel}>{strings.manageSchedulingPickerDay}</Text>
                  <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <Pressable key={day} style={[styles.pickerItem, pickerDay === day && styles.pickerItemActive]} onPress={() => setPickerDay(day)}>
                        <Text style={[styles.pickerItemText, pickerDay === day && styles.pickerItemTextActive]}>{day}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.pickerColumn}>
                  <Text style={styles.pickerLabel}>{strings.manageSchedulingPickerMonth}</Text>
                  <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <Pressable key={month} style={[styles.pickerItem, pickerMonth === month && styles.pickerItemActive]} onPress={() => setPickerMonth(month)}>
                        <Text style={[styles.pickerItemText, pickerMonth === month && styles.pickerItemTextActive]}>{month}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.pickerColumn}>
                  <Text style={styles.pickerLabel}>{strings.manageSchedulingPickerYear}</Text>
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
                <Text style={styles.pickerConfirmText}>{strings.manageSchedulingPickerConfirm}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {showTimePicker ? (
        <Modal visible transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setShowTimePicker(false)}>
            <Pressable style={styles.pickerCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.pickerTitle}>{strings.manageSchedulingPickerTimeTitle}</Text>
              <View style={styles.pickerRow}>
                <View style={styles.pickerColumn}>
                  <Text style={styles.pickerLabel}>{strings.manageSchedulingPickerHour}</Text>
                  <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                    {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                      <Pressable key={hour} style={[styles.pickerItem, pickerHour === hour && styles.pickerItemActive]} onPress={() => setPickerHour(hour)}>
                        <Text style={[styles.pickerItemText, pickerHour === hour && styles.pickerItemTextActive]}>{String(hour).padStart(2, "0")}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.pickerColumn}>
                  <Text style={styles.pickerLabel}>{strings.manageSchedulingPickerMinute}</Text>
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
                <Text style={styles.pickerConfirmText}>{strings.manageSchedulingPickerConfirm}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

export default function AdminAppointmentDetailScreen() {
  const router = useRouter();
  const strings = useAdminStrings();
  const { locale } = useAdminPreferences();
  const params = useLocalSearchParams<{ appointmentId?: string }>();
  const appointmentId = Array.isArray(params.appointmentId) ? params.appointmentId[0] : params.appointmentId;
  const keyboardVisible = useKeyboardVisible();
  const { role, user } = useSession();
  const observer = useAdminObserverScope();
  const rawObserverScopeMode = observer.observerScope.mode;
  const rawObserverScopeBranchId = observer.observerScope.branchId;
  const normalizedObserverScope = useMemo(
    () => normalizeAdminObserverScope({ mode: rawObserverScopeMode, branchId: rawObserverScopeBranchId }),
    [rawObserverScopeBranchId, rawObserverScopeMode],
  );
  const [appointment, setAppointment] = useState<MobileAppointmentSummary | null>(null);
  const [appointments, setAppointments] = useState<MobileAppointmentSummary[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [resourceOptions, setResourceOptions] = useState<ResourceOption[]>([]);
  const [newBookingCount, setNewBookingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [busyTargetId, setBusyTargetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function goBackToScheduling() {
    dismissToHref(router, "/scheduling");
  }

  const loadDetail = useCallback(async () => {
    if (!mobileSupabase || !appointmentId || !observer.isReady) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [nextAppointment, nextAppointments, nextStaffOptions, nextResourceOptions, bookingRequests] = await Promise.all([
        getAppointmentForMobile(mobileSupabase, appointmentId, { observerScope: normalizedObserverScope }),
        listAppointmentsForMobile(mobileSupabase, { observerScope: normalizedObserverScope }).catch(() => []),
        listStaffOptions().catch(() => []),
        listResourceOptions(locale).catch(() => []),
        listBookingRequestsForMobile(mobileSupabase, { observerScope: normalizedObserverScope }).catch(() => []),
      ]);

      setAppointment(nextAppointment);
      if (nextAppointment) {
        upsertAppointmentInAdminOperationsCache(nextAppointment);
      }
      setAppointments(nextAppointments);
      setStaffOptions(nextStaffOptions);
      setResourceOptions(nextResourceOptions);
      setNewBookingCount(bookingRequests.filter((item) => item.status === "NEW").length);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : strings.manageSchedulingDetailNotFound);
    } finally {
      setLoading(false);
    }
  }, [appointmentId, locale, normalizedObserverScope, observer.isReady, strings.manageSchedulingDetailNotFound]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadDetail();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [loadDetail]);

  const runMutation = useCallback(
    async (targetId: string, action: () => Promise<void>) => {
      setMutating(true);
      setBusyTargetId(targetId);
      setError(null);

      try {
        await action();
        await loadDetail();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : strings.manageSchedulingDetailNotFound);
        throw nextError;
      } finally {
        setMutating(false);
        setBusyTargetId(null);
      }
    },
    [loadDetail, strings.manageSchedulingDetailNotFound],
  );

  const saveAppointment = useCallback(
    async (input: {
      appointmentId: string;
      customerName: string;
      customerPhone?: string | null;
      startAt: string;
      endAt: string;
      staffUserId?: string | null;
      resourceId?: string | null;
      secondaryResourceId?: string | null;
    }) => {
      const client = mobileSupabase;
      if (!client) {
        throw new Error("Thieu cau hinh Supabase mobile.");
      }

      await runMutation(input.appointmentId, async () => {
        await saveAppointmentForMobile(client, input);
      });
    },
    [runMutation],
  );

  const updateAppointmentStatus = useCallback(
    async (targetAppointmentId: string, status: "BOOKED" | "CHECKED_IN" | "DONE" | "CANCELLED" | "NO_SHOW") => {
      const client = mobileSupabase;
      if (!client) {
        throw new Error("Thieu cau hinh Supabase mobile.");
      }

      await runMutation(targetAppointmentId, async () => {
        await updateAppointmentStatusForMobile(client, targetAppointmentId, status);
      });
    },
    [runMutation],
  );

  const deleteAppointment = useCallback(
    async (targetAppointmentId: string) => {
      const client = mobileSupabase;
      if (!client) {
        throw new Error("Thieu cau hinh Supabase mobile.");
      }

      await runMutation(targetAppointmentId, async () => {
        await deleteAppointmentForMobile(client, targetAppointmentId);
      });
      removeAppointmentFromAdminOperationsCache(targetAppointmentId);
    },
    [runMutation],
  );

  if (loading) {
    return (
      <AdminDetailLoadingScreen
        current="scheduling"
        role={role}
        subtitle={strings.manageSchedulingDetailHeaderSubtitle}
        title={strings.manageSchedulingLoadingAppointments}
        onBack={goBackToScheduling}
        onNavigate={(target) => void router.replace(getAdminNavHref(target, role))}
      />
    );
  }

  if (!appointment) {
    return (
      <View style={styles.screen}>
        <AdminTopSafeArea style={styles.topChrome}>
          <View style={styles.header}>
            <Pressable style={styles.headerButton} onPress={goBackToScheduling}>
              <Feather name="chevron-left" size={24} color={palette.textPrimary} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.headerSubtitle}>{strings.manageSchedulingDetailHeaderSubtitle}</Text>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {strings.manageSchedulingDetailNotFound}
              </Text>
            </View>
            <View style={styles.headerActions} />
          </View>
        </AdminTopSafeArea>
        <View style={styles.stateBody}>
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>{strings.manageSchedulingDetailNotFound}</Text>
          </View>
        </View>
        <AdminBottomNavDock current="scheduling" role={role} prefetchEnabled={false} onNavigate={(target) => void router.replace(getAdminNavHref(target, role))} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminTopSafeArea style={styles.topChrome}>
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={goBackToScheduling}>
            <Feather name="chevron-left" size={24} color={palette.textPrimary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerSubtitle}>{strings.manageSchedulingDetailHeaderSubtitle}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{appointment.customerName}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.headerIconButton}>
              <View>
                <Feather name="bell" size={22} color={palette.textPrimary} />
                {newBookingCount > 0 && <View style={styles.bellBadge}><Text style={styles.bellBadgeText}>{Math.min(newBookingCount, 9)}</Text></View>}
              </View>
            </Pressable>
            <Pressable style={styles.headerIconButton} onPress={() => router.push({ pathname: "/settings", params: { from: "/scheduling/[appointmentId]" } })}>
              <Feather name="settings" size={22} color={palette.textPrimary} />
            </Pressable>
          </View>
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
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => Keyboard.dismiss()}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          contentInsetAdjustmentBehavior="always"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        >
          <AppointmentEditor
            appointment={appointment}
            appointments={appointments}
            resourceOptions={resourceOptions}
            role={role as AppRole | null}
            staffOptions={staffOptions}
            userId={user?.id ?? null}
            busyTargetId={busyTargetId}
            error={error}
            mutating={mutating}
            saveAppointment={saveAppointment}
            updateAppointmentStatus={updateAppointmentStatus}
            deleteAppointment={deleteAppointment}
          />
        </AdminKeyboardAwareScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Navigation */}
      <AdminBottomNavDock current="scheduling" role={role} prefetchEnabled={false} onNavigate={(target) => void router.replace(getAdminNavHref(target, role))} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  scrollRegion: { flex: 1 },
  topChrome: { paddingHorizontal: 20, paddingBottom: 12 },
  content: { paddingHorizontal: 20, paddingTop: 0, paddingBottom: ADMIN_CONTENT_BOTTOM_NAV_CLEARANCE, gap: 16 },
  stateBody: { flex: 1, paddingHorizontal: 20, paddingBottom: ADMIN_CONTENT_BOTTOM_NAV_CLEARANCE, justifyContent: "center" },
  stateCard: { backgroundColor: palette.card, borderRadius: 20, borderWidth: 1, borderColor: palette.border, padding: 20, alignItems: "center", justifyContent: "center" },
  stateTitle: { fontSize: 16, fontWeight: "700", color: palette.textPrimary, textAlign: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingBottom: 0 },
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
  statusBadgeWrap: { alignItems: "flex-start", gap: 6, marginTop: 10 },
  statusLabel: { color: palette.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 0.2, textTransform: "uppercase" },
  statusBadge: { minHeight: 24, borderRadius: 12, paddingHorizontal: 10, backgroundColor: palette.successSoft, alignItems: "center", justifyContent: "center" },
  statusBadgeText: { fontSize: 11, fontWeight: "700", color: palette.success },
  statusBadgeBooked: { backgroundColor: "#FFF4DE" },
  statusBadgeTextBooked: { color: "#D68A1E" },
  statusBadgeOverdue: { backgroundColor: "#FFF1E6" },
  statusBadgeTextOverdue: { color: "#C96A16" },
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
  comboButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    paddingHorizontal: 14,
  },
  comboButtonActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  comboButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.primary,
  },
  comboButtonTextActive: {
    color: "#FFFFFF",
  },
  resourcePill: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, width: "48%", borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, paddingHorizontal: 12 },
  primaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 56, borderRadius: 20, backgroundColor: palette.primary },
  primaryButtonDisabled: { opacity: 0.55 },
  primaryButtonText: { fontSize: 17, fontWeight: "800", color: "#FFFFFF", letterSpacing: -0.2 },
  checkinButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 18, borderWidth: 1, borderColor: palette.success, backgroundColor: palette.successSoft },
  checkinButtonDisabled: { opacity: 0.45 },
  checkinButtonText: { fontSize: 15, fontWeight: "700", color: palette.success },
  checkinHintText: { marginTop: 8, textAlign: "center", fontSize: 12, lineHeight: 18, color: palette.textSecondary },
  overdueHintText: { color: "#A45212" },
  secondaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  secondaryButtonText: { fontSize: 15, fontWeight: "700", color: palette.textPrimary },
  dangerButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 18, borderWidth: 1, borderColor: palette.danger, backgroundColor: palette.card },
  dangerButtonText: { fontSize: 15, fontWeight: "700", color: palette.danger },
  errorText: { fontSize: 13, color: palette.danger, fontWeight: "600", textAlign: "center" },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "transparent", paddingHorizontal: 16, paddingTop: 6 },
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
