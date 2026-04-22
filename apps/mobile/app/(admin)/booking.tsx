import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useAdminOperations } from "@/src/hooks/use-admin-operations";
import { AdminBottomNav, AdminScreen, formatDateTime, styles } from "@/src/features/admin/ui";

function resolveStaffName(
  rawValue: string | null | undefined,
  staffOptions: Array<{ roleId?: string; userId: string; name: string }>,
) {
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

export default function AdminBookingScreen() {
  const router = useRouter();
  const { bookingRequests, role, user, error, loading, reload, staffOptions } = useAdminOperations();
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [activeBucket, setActiveBucket] = useState<"NEW" | "NEEDS_RESCHEDULE">("NEW");

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const newBookingRows = useMemo(() => bookingRequests.filter((item) => item.status === "NEW"), [bookingRequests]);
  const rescheduleBookingRows = useMemo(
    () => bookingRequests.filter((item) => item.status === "NEEDS_RESCHEDULE"),
    [bookingRequests],
  );
  const overdueRows = useMemo(
    () =>
      bookingRequests.filter(
        (item) => item.status === "NEW" && new Date(item.requestedStartAt).getTime() < nowTs,
      ),
    [bookingRequests, nowTs],
  );
  const visibleRows = activeBucket === "NEW" ? newBookingRows : rescheduleBookingRows;

  function renderSummaryCard(
    status: "NEW" | "NEEDS_RESCHEDULE",
    title: string,
    rows: typeof bookingRequests,
    secondary: string,
  ) {
    const active = activeBucket === status;
    return (
      <Pressable
        style={[styles.quickCard, active ? styles.listRowActive : null]}
        onPress={() => setActiveBucket(status)}
      >
        <Text style={styles.quickLabel}>{title}</Text>
        <Text style={styles.quickValue}>{rows.length}</Text>
        <Text style={styles.rowMeta}>{secondary}</Text>
      </Pressable>
    );
  }

  return (
    <AdminScreen
      title="Booking"
      subtitle=""
      role={role}
      userEmail={user?.email}
      compactHeader
      onRefresh={() => void reload()}
      refreshing={loading}
      footer={
        <AdminBottomNav
          current="booking"
          onNavigate={(target) => {
            void router.replace(`/(admin)/${target}`);
          }}
        />
      }
    >
      <View style={styles.section}>
        <View style={styles.quickRow}>
          {renderSummaryCard(
            "NEW",
            "Booking mới",
            newBookingRows,
            overdueRows.length > 0 ? `${overdueRows.length} quá giờ` : "Khách mới",
          )}
          {renderSummaryCard(
            "NEEDS_RESCHEDULE",
            "Booking cần dời",
            rescheduleBookingRows,
            rescheduleBookingRows[0] ? formatDateTime(rescheduleBookingRows[0].requestedStartAt) : "Chờ xử lý",
          )}
        </View>
        {error ? <Text style={styles.warningText}>{error}</Text> : null}
      </View>

      <View style={styles.section}>
        {visibleRows.length === 0 ? <Text style={styles.rowMeta}>Không có khách</Text> : null}
        {visibleRows.map((item) => (
          <Pressable
            key={item.id}
            style={styles.listRow}
            onPress={() =>
              void router.push({
                pathname: "/booking-request/[bookingRequestId]",
                params: { bookingRequestId: item.id },
              })
            }
          >
            <View style={styles.rowHeader}>
              <Text style={styles.rowTitle}>{item.customerName}</Text>
              <Text style={styles.rowMeta}>{formatDateTime(item.requestedStartAt)}</Text>
            </View>
            <Text style={styles.rowMeta}>
              {item.requestedService ?? "Chưa chốt dịch vụ"} • {item.customerPhone ?? "-"}
            </Text>
            {item.preferredStaff ? (
              <Text style={styles.rowMeta}>{resolveStaffName(item.preferredStaff, staffOptions) ?? item.preferredStaff}</Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </AdminScreen>
  );
}
