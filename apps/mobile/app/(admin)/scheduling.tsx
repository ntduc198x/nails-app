import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { useAdminOperations } from "@/src/hooks/use-admin-operations";
import {
  type AppointmentFilter,
  AdminScreen,
  formatDateTime,
  fromDateTimeInputValue,
  InfoTile,
  MetricCard,
  SectionTitleRow,
  StatusBadge,
  styles,
  toDateTimeInputValue,
} from "@/src/features/admin/ui";

function normalizeFilter(value: string | string[] | undefined): AppointmentFilter {
  const next = Array.isArray(value) ? value[0] : value;
  if (next === "BOOKED" || next === "CHECKED_IN" || next === "DONE" || next === "NO_SHOW" || next === "CANCELLED") {
    return next;
  }
  return "ALL";
}

export default function AdminSchedulingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const {
    appointments,
    resourceOptions,
    role,
    staffOptions,
    user,
    busyTargetId,
    error,
    loading,
    mutating,
    reload,
    saveAppointment,
    updateAppointmentStatus,
  } = useAdminOperations();
  const [filterOverride, setFilterOverride] = useState<AppointmentFilter | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [appointmentCustomerName, setAppointmentCustomerName] = useState("");
  const [appointmentStartInput, setAppointmentStartInput] = useState("");
  const [appointmentDurationMinutes, setAppointmentDurationMinutes] = useState("60");
  const [appointmentStaffUserId, setAppointmentStaffUserId] = useState("");
  const [appointmentResourceId, setAppointmentResourceId] = useState("");
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const requestedFilter = normalizeFilter(params.filter);
  const appointmentFilter = filterOverride ?? requestedFilter;

  const filteredAppointments = useMemo(() => {
    if (appointmentFilter === "ALL") {
      return appointments;
    }
    return appointments.filter((item) => item.status === appointmentFilter);
  }, [appointmentFilter, appointments]);
  const effectiveSelectedAppointmentId = useMemo(() => {
    if (selectedAppointmentId && filteredAppointments.some((item) => item.id === selectedAppointmentId)) {
      return selectedAppointmentId;
    }
    return filteredAppointments[0]?.id ?? null;
  }, [filteredAppointments, selectedAppointmentId]);
  const selectedAppointment = useMemo(
    () => appointments.find((item) => item.id === effectiveSelectedAppointmentId) ?? null,
    [appointments, effectiveSelectedAppointmentId],
  );
  const staffNameById = useMemo(() => new Map(staffOptions.map((staff) => [staff.userId, staff.name])), [staffOptions]);
  const resourceNameById = useMemo(
    () => new Map(resourceOptions.map((resource) => [resource.id, resource.name])),
    [resourceOptions],
  );
  const bookedAppointments = useMemo(() => appointments.filter((item) => item.status === "BOOKED").length, [appointments]);
  const checkedInAppointments = useMemo(
    () => appointments.filter((item) => item.status === "CHECKED_IN").length,
    [appointments],
  );
  const overdueBooked = useMemo(
    () => appointments.filter((item) => item.status === "BOOKED" && new Date(item.startAt).getTime() < nowTs).length,
    [appointments, nowTs],
  );
  const staleCheckedIn = useMemo(
    () =>
      appointments.filter((item) => {
        if (item.status !== "CHECKED_IN" || !item.checkedInAt) {
          return false;
        }
        return nowTs - new Date(item.checkedInAt).getTime() > 2 * 60 * 60 * 1000;
      }).length,
    [appointments, nowTs],
  );

  function resetAppointmentForm() {
    setEditingAppointmentId(null);
    setAppointmentCustomerName("");
    setAppointmentStartInput("");
    setAppointmentDurationMinutes("60");
    setAppointmentStaffUserId(role === "TECH" ? user?.id ?? "" : "");
    setAppointmentResourceId("");
  }

  function startEditingAppointment() {
    if (!selectedAppointment) {
      return;
    }

    setEditingAppointmentId(selectedAppointment.id);
    setAppointmentCustomerName(selectedAppointment.customerName);
    setAppointmentStartInput(toDateTimeInputValue(selectedAppointment.startAt));
    setAppointmentDurationMinutes(
      String(
        Math.max(
          15,
          Math.round((new Date(selectedAppointment.endAt).getTime() - new Date(selectedAppointment.startAt).getTime()) / 60000),
        ),
      ),
    );
    setAppointmentStaffUserId(selectedAppointment.staffUserId ?? (role === "TECH" ? user?.id ?? "" : ""));
    setAppointmentResourceId(selectedAppointment.resourceId ?? "");
  }

  async function handleSaveAppointment() {
    const normalizedStart = fromDateTimeInputValue(appointmentStartInput);
    const durationMinutes = Number(appointmentDurationMinutes);
    if (!appointmentCustomerName.trim() || !normalizedStart || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return;
    }

    const endAt = new Date(normalizedStart);
    endAt.setMinutes(endAt.getMinutes() + durationMinutes);

    await saveAppointment({
      appointmentId: editingAppointmentId,
      customerName: appointmentCustomerName.trim(),
      startAt: normalizedStart,
      endAt: endAt.toISOString(),
      staffUserId: appointmentStaffUserId || (role === "TECH" ? user?.id ?? "" : "") || null,
      resourceId: appointmentResourceId || null,
    });

    resetAppointmentForm();
  }

  return (
    <AdminScreen
      title="Dieu phoi lich"
      subtitle="Mang man appointments tu web sang mobile de le tan va ky thuat vien theo doi lich BOOKED, CHECKED_IN, no-show va checkout theo tung ca."
      role={role}
      userEmail={user?.email}
    >
      <View style={styles.metrics}>
        <MetricCard label="Tong lich hen" value={String(appointments.length)} />
        <MetricCard label="Cho check-in" value={String(bookedAppointments)} />
        <MetricCard label="Da check-in" value={String(checkedInAppointments)} />
      </View>

      <View style={styles.quickGrid}>
        <MetricCard label="Qua gio BOOKED" value={String(overdueBooked)} />
        <MetricCard label="Check-in lau" value={String(staleCheckedIn)} />
      </View>

      <View style={styles.section}>
        <SectionTitleRow
          title="Trang thai dieu phoi"
          actionLabel={loading || mutating ? "Dang tai..." : "Tai lai"}
          onActionPress={() => void reload()}
          actionDisabled={loading || mutating}
        />
        <Text style={styles.sectionBody}>{error ?? "Loc theo trang thai roi mo tung lich hen de check-in, doi lich hoac chuyen qua thanh toan."}</Text>
        {overdueBooked > 0 ? <Text style={styles.warningText}>{overdueBooked} lich BOOKED da qua gio bat dau.</Text> : null}
        {staleCheckedIn > 0 ? <Text style={styles.warningText}>{staleCheckedIn} lich CHECKED_IN dang mo kha lau, nen checkout hoac dong trang thai.</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Loc lich hen</Text>
        <View style={styles.inlineWrap}>
          {([
            ["ALL", "Tat ca"],
            ["BOOKED", "Cho check-in"],
            ["CHECKED_IN", "Dang phuc vu"],
            ["DONE", "Hoan tat"],
            ["NO_SHOW", "No-show"],
            ["CANCELLED", "Da huy"],
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
        <Text style={styles.sectionTitle}>Danh sach lich hen</Text>
        {filteredAppointments.map((item) => {
          const isLate = item.status === "BOOKED" && new Date(item.startAt).getTime() < nowTs;
          const isStale = item.status === "CHECKED_IN" && item.checkedInAt
            ? nowTs - new Date(item.checkedInAt).getTime() > 2 * 60 * 60 * 1000
            : false;
          return (
            <Pressable
              key={item.id}
              style={[styles.listRow, item.id === effectiveSelectedAppointmentId ? styles.listRowActive : null]}
              onPress={() => setSelectedAppointmentId(item.id)}
            >
              <View style={styles.rowHeader}>
                <Text style={styles.rowTitle}>{item.customerName}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.rowMeta}>{formatDateTime(item.startAt)}</Text>
              <Text style={styles.rowMeta}>{item.customerPhone ?? "-"}</Text>
              {isLate ? <Text style={styles.warningText}>Qua gio check-in</Text> : null}
              {isStale ? <Text style={styles.warningText}>Dang CHECKED_IN lau</Text> : null}
            </Pressable>
          );
        })}
        {filteredAppointments.length === 0 ? <Text style={styles.sectionBody}>Khong co lich hen theo bo loc nay.</Text> : null}
      </View>

      {selectedAppointment ? (
        <View style={styles.section}>
          <View style={styles.rowHeader}>
            <Text style={styles.sectionTitle}>Chi tiet lich hen</Text>
            <StatusBadge status={selectedAppointment.status} />
          </View>

          <View style={styles.infoGrid}>
            <InfoTile label="Khach" value={selectedAppointment.customerName} />
            <InfoTile label="So dien thoai" value={selectedAppointment.customerPhone ?? "-"} />
            <InfoTile label="Bat dau" value={formatDateTime(selectedAppointment.startAt)} />
            <InfoTile label="Ket thuc" value={formatDateTime(selectedAppointment.endAt)} />
            <InfoTile label="Nhan vien" value={staffNameById.get(selectedAppointment.staffUserId ?? "") ?? "-"} />
            <InfoTile label="Tai nguyen" value={resourceNameById.get(selectedAppointment.resourceId ?? "") ?? "-"} />
            {selectedAppointment.checkedInAt ? (
              <InfoTile label="Check-in" value={formatDateTime(selectedAppointment.checkedInAt)} />
            ) : null}
          </View>

          <View style={styles.actionColumn}>
            {selectedAppointment.status === "BOOKED" ? (
              <>
                <Pressable style={styles.secondaryButton} onPress={startEditingAppointment}>
                  <Text style={styles.secondaryButtonText}>Sua lich da chon</Text>
                </Pressable>
                <Pressable
                  style={styles.primaryButton}
                  disabled={mutating || busyTargetId === selectedAppointment.id}
                  onPress={() => void updateAppointmentStatus(selectedAppointment.id, "CHECKED_IN")}
                >
                  <Text style={styles.primaryButtonText}>
                    {busyTargetId === selectedAppointment.id ? "Dang xu ly..." : "Check-in nhanh"}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  disabled={mutating || busyTargetId === selectedAppointment.id}
                  onPress={() => void updateAppointmentStatus(selectedAppointment.id, "NO_SHOW")}
                >
                  <Text style={styles.secondaryButtonText}>Danh dau no-show</Text>
                </Pressable>
                <Pressable
                  style={styles.ghostDangerButton}
                  disabled={mutating || busyTargetId === selectedAppointment.id}
                  onPress={() => void updateAppointmentStatus(selectedAppointment.id, "CANCELLED")}
                >
                  <Text style={styles.ghostDangerButtonText}>Huy lich hen</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => void router.push("/(admin)/booking")}>
                  <Text style={styles.secondaryButtonText}>Quay lai Web Booking</Text>
                </Pressable>
              </>
            ) : null}

            {selectedAppointment.status === "CHECKED_IN" ? (
              <>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => router.push({ pathname: "/(admin)/checkout", params: { appointmentId: selectedAppointment.id } })}
                >
                  <Text style={styles.primaryButtonText}>Mo Thanh toan cho lich nay</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  disabled={mutating || busyTargetId === selectedAppointment.id}
                  onPress={() => void updateAppointmentStatus(selectedAppointment.id, "DONE")}
                >
                  <Text style={styles.secondaryButtonText}>Danh dau hoan tat nhanh</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{editingAppointmentId ? "Sua lich hen" : "Tao lich hen nhanh"}</Text>

        <Text style={styles.fieldTitle}>Ten khach</Text>
        <TextInput style={styles.input} value={appointmentCustomerName} onChangeText={setAppointmentCustomerName} />

        <Text style={styles.fieldTitle}>Bat dau</Text>
        <TextInput
          style={styles.input}
          value={appointmentStartInput}
          onChangeText={setAppointmentStartInput}
          placeholder="2026-04-21T10:00"
          placeholderTextColor="#9d8a79"
        />

        <Text style={styles.fieldTitle}>So phut</Text>
        <TextInput
          style={styles.input}
          value={appointmentDurationMinutes}
          onChangeText={setAppointmentDurationMinutes}
          keyboardType="number-pad"
          placeholder="60"
          placeholderTextColor="#9d8a79"
        />

        <Text style={styles.fieldTitle}>Nhan vien</Text>
        <View style={styles.inlineWrap}>
          {staffOptions.map((staff) => (
            <Pressable
              key={staff.userId}
              style={[
                styles.inlineChipSelectable,
                appointmentStaffUserId === staff.userId ? styles.inlineChipSelectableActive : null,
              ]}
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

        <Text style={styles.fieldTitle}>Tai nguyen</Text>
        <View style={styles.inlineWrap}>
          {resourceOptions.map((resource) => (
            <Pressable
              key={resource.id}
              style={[
                styles.inlineChipSelectable,
                appointmentResourceId === resource.id ? styles.inlineChipSelectableActive : null,
              ]}
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

        <View style={styles.actionColumn}>
          <Pressable style={styles.primaryButton} disabled={mutating} onPress={() => void handleSaveAppointment()}>
            <Text style={styles.primaryButtonText}>{editingAppointmentId ? "Luu cap nhat" : "Tao lich hen"}</Text>
          </Pressable>
          {editingAppointmentId ? (
            <Pressable style={styles.secondaryButton} onPress={resetAppointmentForm}>
              <Text style={styles.secondaryButtonText}>Huy sua</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </AdminScreen>
  );
}
