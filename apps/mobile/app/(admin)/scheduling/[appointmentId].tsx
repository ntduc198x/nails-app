import { useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { useAdminOperations } from "@/src/hooks/use-admin-operations";
import { AdminBottomNav, AdminScreen, formatDateTime, StatusBadge, styles } from "@/src/features/admin/ui";

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

type AppointmentEditorProps = ReturnType<typeof useAdminOperations>["appointments"][number];

function AppointmentEditor({ appointment }: { appointment: AppointmentEditorProps }) {
  const router = useRouter();
  const {
    resourceOptions,
    role,
    staffOptions,
    user,
    busyTargetId,
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
    String(
      Math.max(15, Math.round((new Date(appointment.endAt).getTime() - new Date(appointment.startAt).getTime()) / 60000)),
    ),
  );
  const [staffUserId, setStaffUserId] = useState(appointment.staffUserId ?? (role === "TECH" ? user?.id ?? "" : ""));
  const [resourceId, setResourceId] = useState(appointment.resourceId ?? "");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

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
    <>
      <View style={styles.section}>
        <Pressable style={styles.secondaryButton} onPress={() => router.replace("/(admin)/scheduling")}>
          <Text style={styles.secondaryButtonText}>Quay lai</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.rowHeader}>
          <Text style={styles.sectionTitle}>{appointment.customerName}</Text>
          <StatusBadge status={appointment.status} />
        </View>
        <View style={styles.inlineWrap}>
          {appointment.customerPhone ? (
            <View style={styles.inlineChip}>
              <Text style={styles.inlineChipText}>{appointment.customerPhone}</Text>
            </View>
          ) : null}
          <View style={styles.inlineChip}>
            <Text style={styles.inlineChipText}>{formatDateTime(appointment.startAt)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.rowMeta}>Thong tin khach</Text>
        <TextInput
          style={styles.input}
          value={customerName}
          onChangeText={setCustomerName}
          placeholder="Ten khach"
          placeholderTextColor="#9d8a79"
        />
        <TextInput
          style={styles.input}
          value={customerPhone}
          onChangeText={setCustomerPhone}
          keyboardType="phone-pad"
          placeholder="So dien thoai"
          placeholderTextColor="#9d8a79"
        />

        <View style={styles.quickRow}>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={styles.rowMeta}>Ngay</Text>
            <TextInput
              style={styles.input}
              value={dateInput}
              onChangeText={setDateInput}
              placeholder="2026-04-21"
              placeholderTextColor="#9d8a79"
            />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={styles.rowMeta}>Gio</Text>
            <TextInput
              style={styles.input}
              value={timeInput}
              onChangeText={setTimeInput}
              placeholder="10:00"
              placeholderTextColor="#9d8a79"
            />
          </View>
        </View>

        <Text style={styles.rowMeta}>Thoi luong</Text>
        <TextInput
          style={styles.input}
          value={durationMinutes}
          onChangeText={setDurationMinutes}
          keyboardType="number-pad"
          placeholder="60 phut"
          placeholderTextColor="#9d8a79"
        />

        <Text style={styles.fieldTitle}>Chon tho</Text>
        <View style={styles.inlineWrap}>
          {staffOptions.map((staff) => (
            <Pressable
              key={staff.userId}
              style={[styles.inlineChipSelectable, staffUserId === staff.userId ? styles.inlineChipSelectableActive : null]}
              onPress={() => setStaffUserId(staff.userId)}
            >
              <Text
                style={[
                  styles.inlineChipSelectableText,
                  staffUserId === staff.userId ? styles.inlineChipSelectableTextActive : null,
                ]}
              >
                {staff.name}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldTitle}>Chon tai nguyen</Text>
        <View style={styles.inlineWrap}>
          {resourceOptions.map((resource) => (
            <Pressable
              key={resource.id}
              style={[styles.inlineChipSelectable, resourceId === resource.id ? styles.inlineChipSelectableActive : null]}
              onPress={() => setResourceId(resource.id)}
            >
              <Text
                style={[
                  styles.inlineChipSelectableText,
                  resourceId === resource.id ? styles.inlineChipSelectableTextActive : null,
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
            disabled={mutating || busyTargetId === appointment.id}
            onPress={() => void handleSave()}
          >
            <Text style={styles.primaryButtonText}>{busyTargetId === appointment.id ? "Dang luu..." : "Luu"}</Text>
          </Pressable>

          {appointment.status === "BOOKED" ? (
            <Pressable
              style={styles.secondaryButton}
              disabled={mutating || busyTargetId === appointment.id}
              onPress={() => void updateAppointmentStatus(appointment.id, "CHECKED_IN")}
            >
              <Text style={styles.secondaryButtonText}>Check-in</Text>
            </Pressable>
          ) : null}

          {appointment.status === "CHECKED_IN" ? (
            <Pressable
              style={styles.secondaryButton}
              onPress={() => void router.push({ pathname: "/(admin)/checkout", params: { appointmentId: appointment.id } })}
            >
              <Text style={styles.secondaryButtonText}>Check-out</Text>
            </Pressable>
          ) : null}

          {deleteConfirm ? (
            <Pressable
              style={styles.ghostDangerButton}
              disabled={mutating || busyTargetId === appointment.id}
              onPress={() => void handleDelete()}
            >
              <Text style={styles.ghostDangerButtonText}>Xac nhan xoa lich</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.ghostDangerButton} onPress={() => setDeleteConfirm(true)}>
              <Text style={styles.ghostDangerButtonText}>Xoa lich</Text>
            </Pressable>
          )}
        </View>
      </View>
    </>
  );
}

export default function AdminAppointmentDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ appointmentId?: string }>();
  const appointmentId = Array.isArray(params.appointmentId) ? params.appointmentId[0] : params.appointmentId;
  const { appointments, role, user } = useAdminOperations();
  const appointment = useMemo(
    () => appointments.find((item) => item.id === appointmentId) ?? null,
    [appointmentId, appointments],
  );

  if (!appointment) {
    return (
      <AdminScreen title="Lich hen" subtitle="" role={role} userEmail={user?.email} compactHeader>
        <View style={styles.section}>
          <Text style={styles.rowMeta}>Khong tim thay lich</Text>
        </View>
      </AdminScreen>
    );
  }

  return (
    <AdminScreen
      title={appointment.customerName}
      subtitle=""
      role={role}
      userEmail={user?.email}
      compactHeader
      footer={
        <AdminBottomNav
          current="scheduling"
          onNavigate={(target) => {
            void router.replace(`/(admin)/${target}`);
          }}
        />
      }
    >
      <AppointmentEditor key={appointment.id} appointment={appointment} />
    </AdminScreen>
  );
}
