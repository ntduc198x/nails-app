import type { ReactNode } from "react";
import { formatViDate, formatVnd } from "@nails/shared";
import { Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { SessionActions } from "@/src/providers/session-provider";

export type AppointmentFilter = "ALL" | "BOOKED" | "CHECKED_IN" | "DONE" | "NO_SHOW" | "CANCELLED";

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
      <Text style={styles.statusBadgeText}>{status}</Text>
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
  children,
}: {
  title: string;
  subtitle: string;
  role: string | null | undefined;
  userEmail: string | null | undefined;
  compactHeader?: boolean;
  onRefresh?: (() => void) | null;
  refreshing?: boolean;
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
              <Text style={styles.date}>Hom nay: {formatViDate(new Date())}</Text>
              <Text style={styles.date}>Role: {role ?? "-"}</Text>
              <Text style={styles.date}>User: {userEmail ?? "-"}</Text>
            </>
          ) : null}
        </View>

        {children}

        <SessionActions />
      </ScrollView>
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
  onNavigate,
}: {
  current: "booking" | "scheduling" | "checkout" | "shifts";
  onNavigate: (target: "booking" | "scheduling" | "checkout" | "shifts") => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Dieu huong nhanh</Text>
      <View style={styles.inlineWrap}>
        {([
          ["booking", "Web Booking"],
          ["scheduling", "Dieu phoi lich"],
          ["checkout", "Thanh toan"],
          ["shifts", "Ca lam"],
        ] as const).map(([value, label]) => (
          <Pressable
            key={value}
            style={[styles.inlineChipSelectable, current === value ? styles.inlineChipSelectableActive : null]}
            onPress={() => onNavigate(value)}
          >
            <Text
              style={[
                styles.inlineChipSelectableText,
                current === value ? styles.inlineChipSelectableTextActive : null,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
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
