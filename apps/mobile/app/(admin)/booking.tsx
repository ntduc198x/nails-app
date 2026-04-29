import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AdminBottomNav, AdminHeaderActions, getAdminBottomBarPadding, getAdminHeaderTopPadding } from "@/src/features/admin/ui";
import { useAdminOperations } from "@/src/hooks/use-admin-operations";
import { getAdminNavHref } from "@/src/features/admin/navigation";

const PALETTE = {
  screen: "#fbf6f0",
  white: "#ffffff",
  text: "#2b231e",
  muted: "#9e9083",
  soft: "#f4ece3",
  softAlt: "#f8f1ea",
  border: "#efe4d7",
  shadow: "rgba(103, 74, 50, 0.08)",
  brown: "#a56d3d",
  brownDark: "#8b5b33",
  brownSoft: "#f3e8dd",
  orange: "#ee8762",
  orangeSoft: "#fff2eb",
};

type BookingBucket = "NEW" | "NEEDS_RESCHEDULE";

function formatCardDateTime(value: string | null | undefined) {
  if (!value) {
    return "--:--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatListTime(value: string | null | undefined) {
  if (!value) {
    return { time: "--:--", day: "--.--" };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { time: "--:--", day: "--.--" };
  }

  return {
    time: date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    day: date.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit" }).replace("/", "-"),
  };
}

function buildAvatarTone(name: string) {
  const tones = [
    ["#f4b08c", "#fbe6d7"],
    ["#f0c2a1", "#fcebdc"],
    ["#ebb38b", "#fde8db"],
    ["#e6a57d", "#fae2d3"],
  ] as const;
  const seed = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return tones[seed % tones.length];
}

function getRoleLabel(role: string | null | undefined) {
  switch (role) {
    case "TECH": return "Thợ/Kỹ thuật viên";
    case "OWNER": return "Chủ tiệm";
    case "MANAGER": return "Quản lý";
    case "RECEPTION": return "Lễ tân/Thu ngân";
    case "ACCOUNTING": return "Kế toán";
    default: return role ?? "OWNER";
  }
}

export default function AdminBookingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bookingRequests, role, user, loading, reload } = useAdminOperations();
  const [activeBucket, setActiveBucket] = useState<BookingBucket>("NEW");

  const newRows = useMemo(() => bookingRequests.filter((item) => item.status === "NEW"), [bookingRequests]);
  const rescheduleRows = useMemo(
    () => bookingRequests.filter((item) => item.status === "NEEDS_RESCHEDULE"),
    [bookingRequests],
  );
  const visibleRows = useMemo(
    () => (activeBucket === "NEW" ? newRows : rescheduleRows).slice(0, 4),
    [activeBucket, newRows, rescheduleRows],
  );

  const firstRescheduleLabel = rescheduleRows[0]
    ? formatCardDateTime(rescheduleRows[0].requestedStartAt).replace(",", " ·")
    : "19:00 · 18-04";
  const activeSectionTitle = activeBucket === "NEW" ? "Lịch hẹn mới" : "Lịch hẹn cần dời";
  const activeEmptyText = activeBucket === "NEW" ? "Chưa có booking mới" : "Chưa có lịch hẹn cần dời";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: getAdminHeaderTopPadding(insets.top), paddingBottom: 112 + getAdminBottomBarPadding(insets.bottom) }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void reload()}
              tintColor={PALETTE.brownDark}
              colors={[PALETTE.brownDark]}
            />
          }
        >
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Booking</Text>
              <Text style={styles.subtitle}>Quản lý lịch hẹn và khách hàng</Text>
            </View>

            <AdminHeaderActions onSettingsPress={() => void router.push("/(admin)/settings")} />
          </View>

          <View style={styles.metricRow}>
            <Pressable
              style={[styles.metricCard, activeBucket === "NEW" ? styles.metricCardActive : null]}
              onPress={() => setActiveBucket("NEW")}
            >
              <View style={[styles.metricIconShell, styles.metricIconShellSoft]}>
                <Feather name="calendar" size={16} color={PALETTE.text} />
              </View>
              <Text style={styles.metricTitle}>Booking mới</Text>
              <Text style={styles.metricValue}>{newRows.length}</Text>
              <Text style={styles.metricMeta}>Khách mới</Text>
              <View style={styles.metricFooter}>
                <View style={styles.metricChip}>
                  <Feather name="user" size={12} color={PALETTE.muted} />
                  <Text style={styles.metricChipText}>{newRows.length}</Text>
                </View>
                <View style={styles.metricArrowShell}>
                  <Feather name="chevron-right" size={16} color={PALETTE.brownDark} />
                </View>
              </View>
            </Pressable>

            <Pressable
              style={[
                styles.metricCard,
                styles.metricCardWarm,
                activeBucket === "NEEDS_RESCHEDULE" ? styles.metricCardActive : null,
              ]}
              onPress={() => setActiveBucket("NEEDS_RESCHEDULE")}
            >
              <View style={[styles.metricIconShell, styles.metricIconShellWarm]}>
                <Feather name="calendar" size={16} color={PALETTE.white} />
              </View>
              <Text style={styles.metricTitle}>Booking cần dời</Text>
              <Text style={styles.metricValue}>{rescheduleRows.length}</Text>
              <Text style={styles.metricMeta}>Lịch cần điều chỉnh</Text>
              <View style={styles.metricFooter}>
                <View style={styles.metricTimePill}>
                  <Text style={styles.metricTimePillText}>{firstRescheduleLabel}</Text>
                </View>
                <View style={styles.metricArrowShell}>
                  <Feather name="chevron-right" size={16} color={PALETTE.brownDark} />
                </View>
              </View>
            </Pressable>
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Feather name="calendar" size={16} color={PALETTE.text} />
              <Text style={styles.sectionTitle}>{activeSectionTitle}</Text>
            </View>
            <Pressable style={styles.sectionAction}>
              <Text style={styles.sectionActionText}>Xem tất cả</Text>
              <Feather name="chevron-right" size={14} color={PALETTE.text} />
            </Pressable>
          </View>

          <View style={styles.listCard}>
            {visibleRows.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>{activeEmptyText}</Text>
              </View>
            ) : null}
            {visibleRows.map((item) => {
              const [avatarStrong, avatarSoft] = buildAvatarTone(item.customerName);
              const { time, day } = formatListTime(item.requestedStartAt);
              return (
                <Pressable
                  key={item.id}
                  style={styles.bookingRow}
                  onPress={() =>
                    void router.push({
                      pathname: "/booking-request/[bookingRequestId]",
                      params: { bookingRequestId: item.id },
                    })
                  }
                >
                  <View style={[styles.avatarOuter, { backgroundColor: avatarSoft }]}>
                    <View style={[styles.avatarInner, { backgroundColor: avatarStrong }]}>
                      <Text style={styles.avatarText}>
                        {item.customerName
                          .split(" ")
                          .slice(0, 2)
                          .map((part) => part.charAt(0).toUpperCase())
                          .join("")}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bookingMeta}>
                    <View style={styles.bookingNameRow}>
                      <Text style={styles.bookingName} numberOfLines={1}>
                        {item.customerName}
                      </Text>
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>{item.status === "NEW" ? "Mới" : "Dời"}</Text>
                      </View>
                    </View>
                    <Text style={styles.bookingService} numberOfLines={1}>
                      {item.requestedService ?? "M?u nail chrome"}
                    </Text>
                    <Text style={styles.bookingPhone} numberOfLines={1}>
                      {item.customerPhone ?? "0936223341"}
                    </Text>
                  </View>

                  <View style={styles.bookingAside}>
                    <Text style={styles.bookingTime}>{time}</Text>
                    <Text style={styles.bookingDay}>{day}</Text>
                    <Feather name="chevron-right" size={15} color="#a8998c" />
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.accountCard}>
            <Text style={styles.accountLabel}>TÀI KHOẢN HIỆN TẠI</Text>

            <View style={styles.accountRow}>
              <View style={styles.accountInfo}>
                <Feather name="mail" size={15} color={PALETTE.muted} />
                <Text style={styles.accountInfoText}>{user?.email ?? "duct198x@gmail.com"}</Text>
              </View>
            </View>

            <View style={styles.accountRow}>
              <View style={styles.accountInfo}>
                <Feather name="shield" size={15} color={PALETTE.muted} />
                <Text style={styles.accountInfoText}>Vai trò: {getRoleLabel(role)}</Text>
              </View>
              <Pressable style={styles.accountButton} onPress={() => router.push({ pathname: "/(admin)/settings", params: { from: "/(admin)/booking" } })}>
                <Text style={styles.accountButtonText}>Quản lý tài khoản</Text>
              </Pressable>
            </View>

            <View style={styles.accountRow}>
              <View style={styles.accountInfo}>
                <Feather name="clock" size={15} color={PALETTE.muted} />
                <Text style={styles.accountInfoText}>App session: OK</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: getAdminBottomBarPadding(insets.bottom) }]}>
          <AdminBottomNav current="booking" role={role} onNavigate={(target) => void router.replace(getAdminNavHref(target, role))} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PALETTE.screen,
  },
  screen: {
    flex: 1,
    backgroundColor: PALETTE.screen,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 19,
  },
  headerCopy: {
    gap: 5,
    paddingTop: 4,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: PALETTE.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: PALETTE.muted,
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: PALETTE.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PALETTE.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  badgeBubble: {
    position: "absolute",
    top: -2,
    right: -1,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#f16452",
    borderWidth: 2,
    borderColor: PALETTE.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  badgeBubbleText: {
    color: PALETTE.white,
    fontSize: 9,
    lineHeight: 10,
    fontWeight: "700",
  },
  metricRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    minHeight: 166,
    borderRadius: 20,
    backgroundColor: PALETTE.white,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    shadowColor: PALETTE.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  metricCardWarm: {
    backgroundColor: PALETTE.softAlt,
  },
  metricCardActive: {
    borderWidth: 1,
    borderColor: "#ead9c8",
  },
  metricIconShell: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  metricIconShellSoft: {
    backgroundColor: PALETTE.brownSoft,
  },
  metricIconShellWarm: {
    backgroundColor: PALETTE.brown,
  },
  metricTitle: {
    fontSize: 13,
    lineHeight: 18,
    color: "#4a3d34",
    marginBottom: 7,
  },
  metricValue: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
    letterSpacing: -0.3,
    color: PALETTE.text,
    marginBottom: 7,
  },
  metricMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: "#7d7065",
  },
  metricFooter: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 14,
  },
  metricChip: {
    minWidth: 41,
    height: 24,
    borderRadius: 12,
    backgroundColor: PALETTE.soft,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricChipText: {
    fontSize: 11,
    lineHeight: 13,
    color: PALETTE.muted,
    fontWeight: "600",
  },
  metricTimePill: {
    minHeight: 24,
    borderRadius: 12,
    backgroundColor: "#efe3d6",
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  metricTimePillText: {
    fontSize: 11,
    lineHeight: 13,
    color: "#6c5e51",
    fontWeight: "600",
  },
  metricArrowShell: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    letterSpacing: -0.2,
    color: PALETTE.text,
  },
  sectionAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  sectionActionText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#5c5046",
  },
  listCard: {
    borderRadius: 18,
    backgroundColor: PALETTE.white,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 18,
    shadowColor: PALETTE.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  emptyState: {
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  emptyStateText: {
    fontSize: 13,
    lineHeight: 18,
    color: PALETTE.muted,
  },
  bookingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f2e9e0",
  },
  avatarOuter: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: PALETTE.white,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  bookingMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  bookingNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bookingName: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: PALETTE.text,
  },
  newBadge: {
    minWidth: 28,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 7,
    backgroundColor: PALETTE.orangeSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  newBadgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "700",
    color: PALETTE.orange,
  },
  bookingService: {
    fontSize: 12,
    lineHeight: 16,
    color: "#64584f",
  },
  bookingPhone: {
    fontSize: 12,
    lineHeight: 16,
    color: "#918579",
  },
  bookingAside: {
    width: 52,
    alignItems: "flex-end",
    gap: 2,
  },
  bookingTime: {
    fontSize: 13,
    lineHeight: 16,
    color: "#564a40",
    fontWeight: "500",
  },
  bookingDay: {
    fontSize: 12,
    lineHeight: 15,
    color: "#918579",
    marginBottom: 1,
  },
  accountCard: {
    borderRadius: 18,
    backgroundColor: PALETTE.white,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 9,
    shadowColor: PALETTE.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  accountLabel: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#8b6c55",
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  accountInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  accountInfoText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#4f4339",
  },
  accountButton: {
    borderRadius: 16,
    minHeight: 32,
    paddingHorizontal: 14,
    backgroundColor: PALETTE.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  accountButtonText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "600",
    color: "#6a594b",
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderTopWidth: 1,
    borderTopColor: "#efe4d7",
    paddingHorizontal: 14,
    paddingTop: 8,
  },
});
