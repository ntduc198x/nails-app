import { useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { useAdminOperations } from "@/src/hooks/use-admin-operations";
import { type AppointmentFilter, AdminBottomNav, AdminScreen, formatDateTime, StatusBadge, styles } from "@/src/features/admin/ui";

type SchedulingFilter = AppointmentFilter | "OTHER";

function normalizeFilter(value: string | string[] | undefined): SchedulingFilter {
  const next = Array.isArray(value) ? value[0] : value;
  if (
    next === "BOOKED" ||
    next === "CHECKED_IN" ||
    next === "DONE" ||
    next === "NO_SHOW" ||
    next === "CANCELLED" ||
    next === "OTHER"
  ) {
    return next;
  }
  return "ALL";
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

function createDefaultStartAt() {
  const now = new Date();
  now.setMinutes(now.getMinutes() < 30 ? 30 : 60, 0, 0);
  return now.toISOString();
}

const STATUS_WEIGHT: Record<string, number> = {
  BOOKED: 0,
  CHECKED_IN: 1,
  DONE: 2,
  NO_SHOW: 3,
  CANCELLED: 4,
};

export default function AdminSchedulingScreen() {
  const router = useRouter();
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
  const [appointmentCustomerName, setAppointmentCustomerName] = useState("");
  const defaultStartAt = useMemo(() => createDefaultStartAt(), []);
  const [appointmentDateInput, setAppointmentDateInput] = useState(() => toLocalDateInput(defaultStartAt));
  const [appointmentTimeInput, setAppointmentTimeInput] = useState(() => toLocalTimeInput(defaultStartAt));
  const [appointmentDurationMinutes, setAppointmentDurationMinutes] = useState("60");
  const [appointmentStaffUserId, setAppointmentStaffUserId] = useState(role === "TECH" ? user?.id ?? "" : "");
  const [appointmentResourceId, setAppointmentResourceId] = useState("");

  const requestedFilter = normalizeFilter(params.filter);
  const appointmentFilter = filterOverride ?? requestedFilter;

  const filteredAppointments = useMemo(() => {
    const rows =
      appointmentFilter === "ALL"
        ? appointments.filter((item) => item.status === "BOOKED" || item.status === "CHECKED_IN" || item.status === "DONE")
        : appointmentFilter === "OTHER"
          ? appointments.filter((item) => item.status === "NO_SHOW" || item.status === "CANCELLED")
          : appointments.filter((item) => item.status === appointmentFilter);

    return [...rows].sort((left, right) => {
      const statusDelta = (STATUS_WEIGHT[left.status] ?? 99) - (STATUS_WEIGHT[right.status] ?? 99);
      if (statusDelta !== 0) {
        return statusDelta;
      }
      return new Date(left.startAt).getTime() - new Date(right.startAt).getTime();
    });
  }, [appointmentFilter, appointments]);

  async function handleCreateAppointment() {
    const normalizedStart = combineDateAndTimeToIso(appointmentDateInput, appointmentTimeInput);
    const durationMinutes = Number(appointmentDurationMinutes);
    if (!appointmentCustomerName.trim() || !normalizedStart || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return;
    }

    const endAt = new Date(normalizedStart);
    endAt.setMinutes(endAt.getMinutes() + durationMinutes);

    await saveAppointment({
      customerName: appointmentCustomerName.trim(),
      startAt: normalizedStart,
      endAt: endAt.toISOString(),
      staffUserId: appointmentStaffUserId || (role === "TECH" ? user?.id ?? "" : "") || null,
      resourceId: appointmentResourceId || null,
    });

    setAppointmentCustomerName("");
    setAppointmentDurationMinutes("60");
  }

  return (
    <AdminScreen
      title="Dieu phoi lich"
      subtitle=""
      role={role}
      userEmail={user?.email}
      compactHeader
      onRefresh={() => void reload()}
      refreshing={loading}
      footer={
        <AdminBottomNav
          current="scheduling"
          onNavigate={(target) => {
            void router.replace(`/(admin)/${target}`);
          }}
        />
      }
    >
      <View style={styles.section}>
        <TextInput
          style={styles.input}
          value={appointmentCustomerName}
          onChangeText={setAppointmentCustomerName}
          placeholder="Ten khach"
          placeholderTextColor="#9d8a79"
        />
        <View style={styles.quickRow}>
          <View style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              value={appointmentDateInput}
              onChangeText={setAppointmentDateInput}
              placeholder="2026-04-21"
              placeholderTextColor="#9d8a79"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              value={appointmentTimeInput}
              onChangeText={setAppointmentTimeInput}
              placeholder="10:00"
              placeholderTextColor="#9d8a79"
            />
          </View>
        </View>
        <View style={[styles.quickRow, { alignItems: "center" }]}>
          <Text style={styles.rowMeta}>Thoi luong</Text>
          <View style={{ width: 112 }}>
            <TextInput
              style={styles.input}
              value={appointmentDurationMinutes}
              onChangeText={setAppointmentDurationMinutes}
              keyboardType="number-pad"
              placeholder="60"
              placeholderTextColor="#9d8a79"
            />
          </View>
        </View>
        <Text style={styles.fieldTitle}>Chon tho</Text>
        <View style={styles.inlineWrap}>
          {staffOptions.map((staff) => (
            <Pressable
              key={staff.userId}
              style={[styles.inlineChipSelectable, appointmentStaffUserId === staff.userId ? styles.inlineChipSelectableActive : null]}
              onPress={() => setAppointmentStaffUserId(staff.userId)}
            >
              <Text
                style={[
                  styles.inlineChipSelectableText,
                  appointmentStaffUserId === staff.userId ? styles.inlineChipSelectableTextActive : null,
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
              style={[styles.inlineChipSelectable, appointmentResourceId === resource.id ? styles.inlineChipSelectableActive : null]}
              onPress={() => setAppointmentResourceId(resource.id)}
            >
              <Text
                style={[
                  styles.inlineChipSelectableText,
                  appointmentResourceId === resource.id ? styles.inlineChipSelectableTextActive : null,
                ]}
              >
                {resource.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.primaryButton} disabled={mutating} onPress={() => void handleCreateAppointment()}>
          <Text style={styles.primaryButtonText}>{mutating ? "Dang tao..." : "Tao lich nhanh"}</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.inlineWrap}>
          {([
            ["ALL", "Tat ca"],
            ["BOOKED", "Cho check-in"],
            ["CHECKED_IN", "Dang phuc vu"],
            ["DONE", "Hoan tat"],
            ["OTHER", "Khac"],
          ] as const).map(([filter, label]) => (
            <Pressable
              key={filter}
              style={[styles.inlineChipSelectable, appointmentFilter === filter ? styles.inlineChipSelectableActive : null]}
              onPress={() => setFilterOverride(filter)}
            >
              <Text
                style={[
                  styles.inlineChipSelectableText,
                  appointmentFilter === filter ? styles.inlineChipSelectableTextActive : null,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        {filteredAppointments.length === 0 ? <Text style={styles.rowMeta}>Khong co lich</Text> : null}
        {filteredAppointments.map((item) => {
          const actionable = item.status === "BOOKED" || item.status === "CHECKED_IN";
          return (
            <Pressable
              key={item.id}
              style={styles.listRow}
              onPress={() => {
                if (!actionable) {
                  return;
                }
                void router.push({
                  pathname: "/(admin)/scheduling/[appointmentId]",
                  params: { appointmentId: item.id },
                });
              }}
            >
              <View style={styles.rowHeader}>
                <Text style={styles.rowTitle}>{item.customerName}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.rowMeta}>{formatDateTime(item.startAt)}</Text>
              <Text style={styles.rowMeta}>{item.customerPhone ?? "-"}</Text>
            </Pressable>
          );
        })}
      </View>
    </AdminScreen>
  );
}
