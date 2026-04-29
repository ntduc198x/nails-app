import { useEffect, useState, type ReactNode } from "react";
import Feather from "@expo/vector-icons/Feather";
import { formatViDate, formatVnd, type AppRole } from "@nails/shared";
import { Modal, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { useAdminNotifications, type ManageNotificationItem } from "@/src/features/admin/notifications";
import { SessionActions, useSession } from "@/src/providers/session-provider";
import { getAdminProfileDestination, isOwnerRole, type AdminNavTarget } from "@/src/features/admin/navigation";

export type AppointmentFilter = "ALL" | "BOOKED" | "CHECKED_IN" | "DONE" | "NO_SHOW" | "CANCELLED";
export const ADMIN_HEADER_TOP_OFFSET = 12;
export const ADMIN_BOTTOM_BAR_BOTTOM_OFFSET = 0;

export function getAdminBottomBarPadding(insetBottom: number) {
  return ADMIN_BOTTOM_BAR_BOTTOM_OFFSET + Math.max(insetBottom, 6);
}

export function getAdminHeaderTopPadding(insetTop: number) {
  return Math.max(insetTop, 10) + ADMIN_HEADER_TOP_OFFSET;
}

const ADMIN_NAV_ITEMS: Array<{
  key: AdminNavTarget;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
}> = [
  { key: "booking", label: "Booking", icon: "calendar" },
  { key: "scheduling", label: "\u0110i\u1ec1u ph\u1ed1i", icon: "users" },
  { key: "checkout", label: "Thu ti\u1ec1n", icon: "briefcase" },
  { key: "profile", label: "C\u00e1 nh\u00e2n", icon: "user" },
];

function getStatusLabel(status: string) {
  if (status === "NEEDS_RESCHEDULE") return "C\u1ea7n d\u1eddi l\u1ecbch";
  if (status === "BOOKED") return "Ch\u1edd check-in";
  if (status === "CHECKED_IN") return "\u0110ang ph\u1ee5c v\u1ee5";
  if (status === "DONE") return "\u0110\u00e3 xong";
  if (status === "NO_SHOW") return "Kh\u00f4ng t\u1edbi";
  if (status === "CANCELLED") return "H\u1ee7y l\u1ecbch";
  if (status === "NEW") return "M\u1edbi";
  if (status === "CONVERTED") return "\u0110\u00e3 ch\u1ed1t";
  return status;
}

export function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoTile}>
      <Text style={styles.infoTileLabel}>{label}</Text>
      <Text style={styles.infoTileValue}>{value}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <View style={[styles.statusBadge, getStatusToneStyle(status)]}>
      <Text style={styles.statusBadgeText}>{getStatusLabel(status)}</Text>
    </View>
  );
}

export function AdminScreen({
  title,
  subtitle,
  role,
  userEmail,
  compactHeader,
  onRefresh,
  refreshing,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  role: string | null | undefined;
  userEmail: string | null | undefined;
  compactHeader?: boolean;
  onRefresh?: (() => void) | null;
  refreshing?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={Boolean(refreshing)}
              onRefresh={onRefresh}
              tintColor="#2b241f"
              colors={["#2b241f"]}
            />
          ) : undefined
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {!compactHeader ? (
            <>
              <Text style={styles.eyebrow}>Week 4 Admin Core Flows</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
              <Text style={styles.date}>H\u00f4m nay: {formatViDate(new Date())}</Text>
              <Text style={styles.date}>Role: {role ?? "-"}</Text>
              <Text style={styles.date}>User: {userEmail ?? "-"}</Text>
            </>
          ) : null}
        </View>

        {children}

        <SessionActions />
      </ScrollView>
      {footer ? <View style={styles.footerShell}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function SectionTitleRow({
  title,
  actionLabel,
  onActionPress,
  actionDisabled,
}: {
  title: string;
  actionLabel?: string;
  onActionPress?: (() => void) | null;
  actionDisabled?: boolean;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onActionPress ? (
        <Pressable style={styles.refreshButton} disabled={actionDisabled} onPress={onActionPress}>
          <Text style={styles.refreshButtonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function QuickStatCard({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string | number;
  onPress?: (() => void) | null;
}) {
  const content = (
    <>
      <Text style={styles.quickLabel}>{label}</Text>
      <Text style={styles.quickValue}>{value}</Text>
    </>
  );

  if (!onPress) {
    return <View style={styles.quickCard}>{content}</View>;
  }

  return (
    <Pressable style={styles.quickCard} onPress={onPress}>
      {content}
    </Pressable>
  );
}

export function AdminNavLinks({
  current,
  role,
  onNavigate,
}: {
  current: AdminNavTarget | null;
  role: string | null | undefined;
  onNavigate: (target: AdminNavTarget) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>\u0110i\u1ec1u h\u01b0\u1edbng nhanh</Text>
      <View style={styles.inlineWrap}>
        {ADMIN_NAV_ITEMS.map(({ key, label, icon }) => {
          const isProfile = key === "profile";
          const resolvedLabel = isProfile && isOwnerRole(role as AppRole | null | undefined) ? "Manage" : label;
          const resolvedIcon = isProfile && isOwnerRole(role as AppRole | null | undefined) ? "grid" : icon;

          return (
            <Pressable
              key={`${key}-${resolvedLabel}`}
              style={[styles.inlineChipSelectable, current === key ? styles.inlineChipSelectableActive : null]}
              onPress={() => onNavigate(key)}
            >
              <View style={styles.inlineChipInner}>
                <Feather
                  name={resolvedIcon}
                  size={14}
                  color={current === key ? "#fff" : "#5d4f46"}
                />
                <Text
                  style={[
                    styles.inlineChipSelectableText,
                    current === key ? styles.inlineChipSelectableTextActive : null,
                  ]}
                >
                  {resolvedLabel}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function AdminBottomNav({
  current,
  role,
  onNavigate,
}: {
  current: AdminNavTarget | null;
  role: string | null | undefined;
  onNavigate: (target: AdminNavTarget) => void;
}) {
  return (
    <View style={styles.bottomNav}>
      {ADMIN_NAV_ITEMS.map(({ key, label, icon }) => {
        const isProfile = key === "profile";
        const active = current === key;
        const resolvedLabel = isProfile && isOwnerRole(role as AppRole | null | undefined) ? "Manage" : label;
        const resolvedIcon = isProfile && isOwnerRole(role as AppRole | null | undefined) ? "grid" : icon;
        const targetHref = isProfile ? getAdminProfileDestination(role as AppRole | null | undefined) : null;
        return (
          <Pressable
            key={`${key}-${resolvedLabel}`}
            style={styles.bottomNavItem}
            accessibilityHint={targetHref ? `M\u1edf ${targetHref}` : undefined}
            onPress={() => onNavigate(key)}
          >
            <View style={[styles.bottomNavPill, active ? styles.bottomNavPillActive : null]}>
              <Feather name={resolvedIcon} size={19} color={active ? "#2b241f" : "#9e9184"} />
              <Text style={[styles.bottomNavText, active ? styles.bottomNavTextActive : null]}>{resolvedLabel}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AdminHeaderActions({
  onSettingsPress,
}: {
  onSettingsPress?: (() => void) | null;
}) {
  const router = useRouter();
  const { role, user } = useSession();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationTab, setNotificationTab] = useState<"action" | "feed">("action");
  const {
    actionNotifications,
    feedNotifications,
    unreadCount,
    markSeen,
  } = useAdminNotifications(role as AppRole | null | undefined, user?.email, user?.id);

  useEffect(() => {
    if (!notificationsOpen) return;
    void markSeen();
    setNotificationTab(actionNotifications.length ? "action" : "feed");
  }, [actionNotifications.length, markSeen, notificationsOpen]);

  const visibleNotifications = notificationTab === "action" ? actionNotifications : feedNotifications;

  function renderNotificationTone(item: ManageNotificationItem) {
    if (item.actionRequired) return styles.notificationCardAction;
    if (item.kind === "customer_checked_in") return styles.notificationCardInfo;
    if (item.kind === "customer_checked_out") return styles.notificationCardSuccess;
    return styles.notificationCardDefault;
  }

  return (
    <>
      <View style={styles.headerActions}>
        <Pressable style={styles.headerIconButton} onPress={() => setNotificationsOpen(true)}>
          <View>
            <Feather name="bell" size={20} color="#2b241f" />
            {unreadCount > 0 ? (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
        <Pressable style={styles.headerIconButton} onPress={onSettingsPress ?? undefined} disabled={!onSettingsPress}>
          <Feather name="settings" size={20} color="#2b241f" />
        </Pressable>
      </View>

      <Modal visible={notificationsOpen} transparent animationType="fade" onRequestClose={() => setNotificationsOpen(false)}>
        <Pressable style={styles.notificationsOverlay} onPress={() => setNotificationsOpen(false)}>
          <Pressable style={styles.notificationsSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.notificationsHeader}>
              <View style={styles.notificationsHeaderCopy}>
                <Text style={styles.notificationsTitle}>Thông báo</Text>
                <Text style={styles.notificationsSubtitle}>
                  {unreadCount > 0 ? `${unreadCount} mục cần chú ý` : "Chưa có mục mới"}
                </Text>
              </View>
              <Pressable style={styles.notificationsClose} onPress={() => setNotificationsOpen(false)}>
                <Feather name="x" size={18} color="#6b7280" />
              </Pressable>
            </View>

            <View style={styles.notificationsTabs}>
              <Pressable
                style={[styles.notificationsTab, notificationTab === "action" ? styles.notificationsTabActive : null]}
                onPress={() => setNotificationTab("action")}
              >
                <Text style={[styles.notificationsTabText, notificationTab === "action" ? styles.notificationsTabTextActive : null]}>
                  Cần xử lý{actionNotifications.length ? ` (${actionNotifications.length})` : ""}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.notificationsTab, notificationTab === "feed" ? styles.notificationsTabActive : null]}
                onPress={() => setNotificationTab("feed")}
              >
                <Text style={[styles.notificationsTabText, notificationTab === "feed" ? styles.notificationsTabTextActive : null]}>
                  Dòng sự kiện{feedNotifications.length ? ` (${feedNotifications.length})` : ""}
                </Text>
              </Pressable>
            </View>

            <ScrollView style={styles.notificationsList} contentContainerStyle={styles.notificationsListContent} showsVerticalScrollIndicator={false}>
              {visibleNotifications.length ? (
                visibleNotifications.map((item) => (
                  <Pressable
                    key={item.id}
                    style={[styles.notificationCard, renderNotificationTone(item)]}
                    onPress={() => {
                      setNotificationsOpen(false);
                      void router.push(item.href);
                    }}
                  >
                    <View style={styles.notificationCardRow}>
                      <View style={styles.notificationCardCopy}>
                        <Text style={styles.notificationCardTitle}>{item.title}</Text>
                        <Text style={styles.notificationCardMessage}>{item.message}</Text>
                      </View>
                      {item.actionRequired ? (
                        <View style={styles.notificationActionBadge}>
                          <Text style={styles.notificationActionBadgeText}>Cần xử lý</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.notificationCardDate}>
                      {new Intl.DateTimeFormat("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(item.createdAt))}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <View style={styles.notificationsEmpty}>
                  <Text style={styles.notificationsEmptyText}>
                    {notificationTab === "action"
                      ? "Hiện không có mục nào cần xử lý."
                      : "Chưa có sự kiện nào gần đây."}
                  </Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function addMinutesToIso(value: string, minutes: number) {
  const next = new Date(value);
  next.setMinutes(next.getMinutes() + minutes);
  return next.toISOString();
}

export function toDateTimeInputValue(value: string) {
  const date = new Date(value);
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function fromDateTimeInputValue(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function createCheckoutKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getStatusToneStyle(status: string): ViewStyle {
  if (status === "NEW") return styles.statusNew;
  if (status === "NEEDS_RESCHEDULE") return styles.statusNeedsReschedule;
  if (status === "CONVERTED" || status === "DONE") return styles.statusDone;
  if (status === "CHECKED_IN") return styles.statusCheckedIn;
  if (status === "NO_SHOW" || status === "CANCELLED") return styles.statusCancelled;
  return styles.statusNeutral;
}

export { formatVnd };

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f1ea",
  },
  content: {
    padding: 24,
    gap: 20,
    paddingBottom: 28,
  },
  header: {
    marginTop: 24,
    gap: 10,
  },
  eyebrow: {
    color: "#8b5a2b",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#1f1b18",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#5f534c",
  },
  date: {
    fontSize: 14,
    color: "#7b6d63",
  },
  metrics: {
    gap: 12,
  },
  quickGrid: {
    gap: 12,
  },
  quickRow: {
    flexDirection: "row",
    gap: 12,
  },
  quickCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e6ddd2",
    gap: 6,
    flex: 1,
  },
  quickLabel: {
    fontSize: 13,
    color: "#7b6d63",
  },
  quickValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#2b241f",
  },
  metricCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e6ddd2",
    gap: 8,
  },
  metricLabel: {
    fontSize: 13,
    color: "#7b6d63",
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2b241f",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e6ddd2",
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2b241f",
    flex: 1,
  },
  sectionBody: {
    color: "#5f534c",
    lineHeight: 20,
  },
  sectionSubtitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2b241f",
  },
  sectionSubCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#f0e7dc",
    backgroundColor: "#fffaf5",
    padding: 12,
    gap: 8,
  },
  refreshButton: {
    backgroundColor: "#2b241f",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refreshButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  listRow: {
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#f0e7dc",
    borderRadius: 14,
    backgroundColor: "#fffaf5",
  },
  listRowActive: {
    borderColor: "#2b241f",
    backgroundColor: "#f6eee5",
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  rowTitle: {
    color: "#2b241f",
    fontWeight: "600",
    flex: 1,
  },
  rowMeta: {
    color: "#7b6d63",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 11,
  },
  statusNew: {
    backgroundColor: "#2563eb",
  },
  statusNeedsReschedule: {
    backgroundColor: "#d97706",
  },
  statusCheckedIn: {
    backgroundColor: "#0284c7",
  },
  statusDone: {
    backgroundColor: "#059669",
  },
  statusCancelled: {
    backgroundColor: "#dc2626",
  },
  statusNeutral: {
    backgroundColor: "#6b7280",
  },
  detailLine: {
    color: "#4f433b",
    lineHeight: 21,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  infoTile: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#f0e7dc",
    backgroundColor: "#fffaf5",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  infoTileLabel: {
    color: "#8a7869",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  infoTileValue: {
    color: "#2b241f",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  fieldTitle: {
    marginTop: 8,
    color: "#2b241f",
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eadbc8",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#2b1d12",
  },
  inlineWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  warningText: {
    color: "#a16207",
    lineHeight: 20,
    fontWeight: "600",
  },
  successText: {
    color: "#047857",
    lineHeight: 20,
    fontWeight: "600",
  },
  inlineChip: {
    borderRadius: 999,
    backgroundColor: "#f0e7dc",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineChipText: {
    color: "#5d4f46",
    fontWeight: "600",
  },
  inlineAction: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d5c3b1",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineActionText: {
    color: "#5d4f46",
    fontWeight: "600",
  },
  inlineChipSelectable: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d5c3b1",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  inlineChipSelectableActive: {
    backgroundColor: "#2b241f",
    borderColor: "#2b241f",
  },
  inlineChipSelectableText: {
    color: "#5d4f46",
    fontWeight: "600",
  },
  inlineChipSelectableTextActive: {
    color: "#fff",
  },
  inlineChipInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionColumn: {
    gap: 10,
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: "#2f241d",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#d5c3b1",
    backgroundColor: "#fff",
  },
  secondaryButtonText: {
    color: "#5d4f46",
    textAlign: "center",
    fontWeight: "600",
  },
  ghostDangerButton: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#f0b7b7",
    backgroundColor: "#fff5f5",
  },
  ghostDangerButtonText: {
    color: "#a32d2d",
    textAlign: "center",
    fontWeight: "700",
  },
  footerShell: {
    backgroundColor: "transparent",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
  },
  bottomNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#efe4d8",
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: "#2a1e14",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e6ddd2",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadge: {
    position: "absolute",
    top: -5,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ef4444",
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  headerBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 10,
  },
  notificationsOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.22)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 72,
    paddingHorizontal: 12,
  },
  notificationsSheet: {
    width: 360,
    maxWidth: "100%",
    maxHeight: "78%",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#e6ddd2",
    backgroundColor: "#fff",
    padding: 12,
    shadowColor: "#2a1e14",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  notificationsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  notificationsHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  notificationsTitle: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "700",
    color: "#111827",
  },
  notificationsSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: "#6b7280",
  },
  notificationsClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationsTabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 6,
    marginTop: 6,
  },
  notificationsTab: {
    flex: 1,
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  notificationsTabActive: {
    backgroundColor: "#2b241f",
    borderColor: "#2b241f",
  },
  notificationsTabText: {
    fontSize: 12,
    lineHeight: 15,
    color: "#374151",
    fontWeight: "700",
    textAlign: "center",
  },
  notificationsTabTextActive: {
    color: "#fff",
  },
  notificationsList: {
    marginTop: 10,
  },
  notificationsListContent: {
    gap: 8,
    paddingHorizontal: 2,
    paddingBottom: 6,
  },
  notificationCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  notificationCardDefault: {
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  notificationCardAction: {
    borderColor: "#f59e0b",
    backgroundColor: "#fff7ed",
  },
  notificationCardInfo: {
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  notificationCardSuccess: {
    borderColor: "#bbf7d0",
    backgroundColor: "#ecfdf5",
  },
  notificationCardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  notificationCardCopy: {
    flex: 1,
    gap: 4,
  },
  notificationCardTitle: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
    color: "#111827",
  },
  notificationCardMessage: {
    fontSize: 13,
    lineHeight: 18,
    color: "#4b5563",
  },
  notificationCardDate: {
    fontSize: 11,
    lineHeight: 14,
    color: "#9ca3af",
  },
  notificationActionBadge: {
    borderRadius: 999,
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  notificationActionBadgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    color: "#b45309",
  },
  notificationsEmpty: {
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d1d5db",
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationsEmptyText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#6b7280",
    textAlign: "center",
  },
  bottomNavPill: {
    minWidth: 76,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bottomNavPillActive: {
    backgroundColor: "#f4ece3",
  },
  bottomNavText: {
    textAlign: "center",
    color: "#9e9184",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  bottomNavTextActive: {
    color: "#2b241f",
    fontWeight: "600",
  },
  ticketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eadbc8",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  ticketMeta: {
    flex: 1,
    gap: 2,
  },
  ticketCustomer: {
    color: "#2b241f",
    fontWeight: "600",
  },
  ticketDate: {
    color: "#7b6d63",
    fontSize: 12,
  },
  ticketTotal: {
    color: "#2b241f",
    fontWeight: "700",
  },
});
