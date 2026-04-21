import { useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { useAdminOperations } from "@/src/hooks/use-admin-operations";
import {
  addMinutesToIso,
  AdminScreen,
  formatDateTime,
  StatusBadge,
  styles,
} from "@/src/features/admin/ui";

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
};

function resolveStaffName(rawValue: string | null | undefined, staffOptions: BookingRequestDetailProps["staffOptions"]) {
  if (!rawValue) {
    return null;
  }

  const normalized = rawValue.trim();
  if (!normalized) {
    return null;
  }

  const exact = staffOptions.find(
    (staff) =>
      staff.userId === normalized ||
      staff.roleId === normalized ||
      staff.name.toLowerCase() === normalized.toLowerCase(),
  );
  if (exact) {
    return exact.name;
  }

  const prefix = staffOptions.find(
    (staff) =>
      staff.userId.startsWith(normalized) ||
      normalized.startsWith(staff.userId) ||
      (staff.roleId ? staff.roleId.startsWith(normalized) || normalized.startsWith(staff.roleId) : false),
  );
  if (prefix) {
    return prefix.name;
  }

  return normalized;
}

function toLocalDateInput(isoValue: string) {
  const date = new Date(isoValue);
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toLocalTimeInput(isoValue: string) {
  const date = new Date(isoValue);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function combineDateAndTimeToIso(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) {
    return null;
  }

  const parsed = new Date(`${dateValue}T${timeValue}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
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
}: BookingRequestDetailProps) {
  const [scheduledDateInput, setScheduledDateInput] = useState(() => toLocalDateInput(booking.requestedStartAt));
  const [scheduledTimeInput, setScheduledTimeInput] = useState(() => toLocalTimeInput(booking.requestedStartAt));
  const [selectedStaffUserId, setSelectedStaffUserId] = useState("");
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [bookingCancelConfirmId, setBookingCancelConfirmId] = useState<string | null>(null);
  const effectiveScheduledStartAt =
    combineDateAndTimeToIso(scheduledDateInput, scheduledTimeInput) ?? booking.requestedStartAt ?? null;
  const effectiveSelectedStaffUserId = selectedStaffUserId || (role === "TECH" ? user?.id ?? "" : "");
  const preferredStaffName = resolveStaffName(booking.preferredStaff, staffOptions);

  async function handleConvertBooking() {
    if (!booking || !effectiveScheduledStartAt) {
      return;
    }

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

  return (
    <View style={styles.section}>
      <View style={styles.rowHeader}>
        <Text style={styles.sectionTitle}>{booking.customerName}</Text>
        <StatusBadge status={booking.status} />
      </View>

      <View style={styles.inlineWrap}>
        {booking.customerPhone ? (
          <View style={styles.inlineChip}>
            <Text style={styles.inlineChipText}>{booking.customerPhone}</Text>
          </View>
        ) : null}
        {booking.requestedService ? (
          <View style={styles.inlineChip}>
            <Text style={styles.inlineChipText}>{booking.requestedService}</Text>
          </View>
        ) : null}
        {preferredStaffName ? (
          <View style={styles.inlineChip}>
            <Text style={styles.inlineChipText}>{preferredStaffName}</Text>
          </View>
        ) : null}
        <View style={styles.inlineChip}>
          <Text style={styles.inlineChipText}>{booking.source ?? "web"}</Text>
        </View>
      </View>

      <Text style={styles.detailLine}>{formatDateTime(booking.requestedStartAt)}</Text>
      {booking.note ? <Text style={styles.detailLine}>{booking.note}</Text> : null}
      {error ? <Text style={styles.warningText}>{error}</Text> : null}

      <View style={styles.sectionSubCard}>
        <Text style={styles.fieldTitle}>Ngày giờ mong muốn</Text>
        <Text style={styles.detailLine}>
          {effectiveScheduledStartAt ? formatDateTime(effectiveScheduledStartAt) : "Chưa chọn giờ"}
        </Text>
        <View style={styles.quickRow}>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={styles.rowMeta}>Ngày</Text>
            <TextInput
              style={styles.input}
              value={scheduledDateInput}
              onChangeText={setScheduledDateInput}
              placeholder="2026-04-21"
              placeholderTextColor="#9d8a79"
            />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={styles.rowMeta}>Giờ</Text>
            <TextInput
              style={styles.input}
              value={scheduledTimeInput}
              onChangeText={setScheduledTimeInput}
              placeholder="10:00"
              placeholderTextColor="#9d8a79"
            />
          </View>
        </View>
        <View style={styles.inlineWrap}>
          {[0, 30, 60, 90].map((offset) => (
            <Pressable
              key={offset}
              style={styles.inlineAction}
              onPress={() => {
                const nextIso = addMinutesToIso(effectiveScheduledStartAt ?? booking.requestedStartAt, offset);
                setScheduledDateInput(toLocalDateInput(nextIso));
                setScheduledTimeInput(toLocalTimeInput(nextIso));
              }}
            >
              <Text style={styles.inlineActionText}>{offset === 0 ? "Giữ giờ" : `+${offset}p`}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={styles.fieldTitle}>Chọn thợ</Text>
      <View style={styles.inlineWrap}>
        {staffOptions.map((staff) => {
          const active = (selectedStaffUserId || effectiveSelectedStaffUserId) === staff.userId;
          return (
            <Pressable
              key={staff.userId}
              style={[styles.inlineChipSelectable, active ? styles.inlineChipSelectableActive : null]}
              onPress={() => setSelectedStaffUserId(staff.userId)}
            >
              <Text style={[styles.inlineChipSelectableText, active ? styles.inlineChipSelectableTextActive : null]}>
                {staff.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.fieldTitle}>Chọn tài nguyên</Text>
      <View style={styles.inlineWrap}>
        {resourceOptions.map((resource) => (
          <Pressable
            key={resource.id}
            style={[styles.inlineChipSelectable, selectedResourceId === resource.id ? styles.inlineChipSelectableActive : null]}
            onPress={() => setSelectedResourceId(resource.id)}
          >
            <Text
              style={[
                styles.inlineChipSelectableText,
                selectedResourceId === resource.id ? styles.inlineChipSelectableTextActive : null,
              ]}
            >
              {resource.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actionColumn}>
        <Pressable
          style={styles.primaryButton}
          disabled={mutating || busyTargetId === booking.id || !effectiveScheduledStartAt}
          onPress={() => void handleConvertBooking()}
        >
          <Text style={styles.primaryButtonText}>
            {busyTargetId === booking.id ? "Đang xử lý..." : "Chốt lịch"}
          </Text>
        </Pressable>

        {bookingCancelConfirmId === booking.id ? (
          <Pressable
            style={styles.ghostDangerButton}
            disabled={mutating || busyTargetId === booking.id}
            onPress={() => void handleCancelBooking()}
          >
            <Text style={styles.ghostDangerButtonText}>Xác nhận khách hủy booking</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.ghostDangerButton} onPress={() => setBookingCancelConfirmId(booking.id)}>
            <Text style={styles.ghostDangerButtonText}>Khách hủy booking</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function BookingRequestDetailScreen() {
  const router = useRouter();
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

  return (
    <AdminScreen
      title={booking?.customerName ?? "Booking"}
      subtitle=""
      role={role}
      userEmail={user?.email}
      compactHeader
    >
      <View style={styles.section}>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Quay lại</Text>
        </Pressable>
      </View>

      {!booking ? (
        <View style={styles.section}>
          <Text style={styles.rowMeta}>Không tìm thấy booking</Text>
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
        />
      )}
    </AdminScreen>
  );
}
