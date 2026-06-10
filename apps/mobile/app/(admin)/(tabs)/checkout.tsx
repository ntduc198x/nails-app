import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getTicketDetailForMobile, type MobileCheckoutService, type MobileTicketDetail } from "@nails/shared";
import { useAdminStrings } from "@/src/features/admin/strings";
import { AdminBottomNavDock, AdminHeaderActions, AdminKeyboardAwareScrollView, AdminKeyboardTextInput, AdminTopSafeArea, ADMIN_CONTENT_BOTTOM_NAV_CLEARANCE, ADMIN_CONTENT_TOP_GAP, ADMIN_KEYBOARD_ACTIVE_FIELD_CLEARANCE, createCheckoutKey, formatVnd, useKeyboardVisible } from "@/src/features/admin/ui";
import { getAdminNavHref } from "@/src/features/admin/navigation";
import { useAdminOperations } from "@/src/hooks/use-admin-operations";
import { mobileEnv } from "@/src/lib/env";
import { mobileSupabase } from "@/src/lib/supabase";
import { useSession } from "@/src/providers/session-provider";

const palette = {
  screen: "#FCFAF8",
  white: "#FFFFFF",
  text: "#2F241D",
  muted: "#9A8E84",
  border: "#EFE4D8",
  beige: "#F4ECE2",
  beigeStrong: "#EEE3D6",
  beigeSoft: "#FFF9F3",
  badge: "#DFF3EA",
  badgeText: "#4B8D72",
  brown: "#2F241D",
};

function buildAvatarTone(name: string) {
  const tones = [
    ["#D6B198", "#F6E7D8"],
    ["#CFA689", "#F6E6D7"],
    ["#C59B7F", "#F3E1D1"],
    ["#B98A69", "#EFDDCD"],
  ] as const;
  const seed = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return tones[seed % tones.length];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatShortDateTime(value: string | null | undefined) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatStaleDays(value: string | null | undefined, fallback: string, fallbackLabel: string) {
  const reference = value ?? fallback;
  const diffMs = Date.now() - new Date(reference).getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return fallbackLabel;
  const days = Math.max(1, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
  return `${fallbackLabel} ${days}d`;
}

type RangeMode = "day" | "week" | "month" | "custom";
type HistoryRange = { from: Date; to: Date };
type CheckoutLineDraft = { serviceId: string; qty: number };
type EditableTicketLine = CheckoutLineDraft & { serviceName: string };

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function startOfWeek(date: Date) {
  const value = startOfDay(date);
  const day = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - day);
  return value;
}

function endOfWeek(date: Date) {
  const value = startOfWeek(date);
  value.setDate(value.getDate() + 6);
  value.setHours(23, 59, 59, 999);
  return value;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function buildHistoryRange(mode: RangeMode, customFrom: string, customTo: string): HistoryRange {
  const today = new Date();
  if (mode === "day") return { from: startOfDay(today), to: endOfDay(today) };
  if (mode === "week") return { from: startOfWeek(today), to: endOfWeek(today) };
  if (mode === "month") return { from: startOfMonth(today), to: endOfMonth(today) };

  const from = new Date(`${customFrom}T00:00:00`);
  const to = new Date(`${customTo}T23:59:59`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { from: startOfDay(today), to: endOfDay(today) };
  }
  return from.getTime() <= to.getTime()
    ? { from, to }
    : { from: new Date(`${customTo}T00:00:00`), to: new Date(`${customFrom}T23:59:59`) };
}

function createEmptyCheckoutLine(): CheckoutLineDraft {
  return { serviceId: "", qty: 1 };
}

function normalizeServiceName(name: string) {
  return name.trim().toLowerCase();
}

function buildCheckoutServiceLookups(services: MobileCheckoutService[]) {
  return {
    byId: new Map(services.map((service) => [service.id, service])),
    byName: new Map(services.map((service) => [normalizeServiceName(service.name), service])),
  };
}

function resolveEditableTicketLines(
  items: MobileTicketDetail["items"],
  serviceById: Map<string, MobileCheckoutService>,
  serviceByName: Map<string, MobileCheckoutService>,
): EditableTicketLine[] {
  return items
    .map((item) => {
      if (item.qty <= 0) return null;

      const resolvedService =
        (typeof item.serviceId === "string" && item.serviceId.length > 0 ? serviceById.get(item.serviceId) : undefined)
        ?? serviceByName.get(normalizeServiceName(item.serviceName));

      if (!resolvedService) return null;
      return {
        serviceId: resolvedService.id,
        qty: item.qty,
        serviceName: resolvedService.name,
      };
    })
    .filter((line): line is EditableTicketLine => Boolean(line));
}

function formatDateRangeLabel(mode: RangeMode, customFrom: string, customTo: string) {
  const today = new Date();
  if (mode === "day") {
    return today.toLocaleDateString("vi-VN");
  }
  if (mode === "week") {
    return `${startOfWeek(today).toLocaleDateString("vi-VN")} - ${endOfWeek(today).toLocaleDateString("vi-VN")}`;
  }
  if (mode === "month") {
    return `${today.getMonth() + 1}/${today.getFullYear()}`;
  }
  return `${new Date(`${customFrom}T00:00:00`).toLocaleDateString("vi-VN")} - ${new Date(`${customTo}T00:00:00`).toLocaleDateString("vi-VN")}`;
}

type CheckoutSuccessState = {
  mode: "create" | "update";
  ticketId: string;
  receiptToken: string;
  grandTotal: number;
  customerName: string;
  paymentMethod: "CASH" | "TRANSFER";
};

type EditingClosedTicketState = {
  ticketId: string;
  customerName: string;
  receiptToken: string | null;
  createdAt: string;
};

export default function AdminCheckoutScreen() {
  const router = useRouter();
  const strings = useAdminStrings();
  const params = useLocalSearchParams<{ appointmentId?: string }>();
  useSession();
  const {
    checkoutCheckedInAppointments,
    staleCheckedInAppointments,
    staleCheckInAutoCancelledCount,
    staleCheckInCleanupError,
    checkoutServices,
    recentTickets,
    createCheckout,
    updateClosedTicket,
    loadRecentTickets,
    reload,
    loading,
    observerViewContext,
    role,
    techShiftOpen,
    busyTargetId,
    error,
    mutating,
  } =
    useAdminOperations();
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [checkoutCustomerName] = useState("");
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [checkoutLines, setCheckoutLines] = useState<CheckoutLineDraft[]>([createEmptyCheckoutLine()]);
  const [serviceQueries, setServiceQueries] = useState<string[]>([""]);
  const [openServicePickerIndex, setOpenServicePickerIndex] = useState<number | null>(0);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<CheckoutSuccessState | null>(null);
  const [editingClosedTicket, setEditingClosedTicket] = useState<EditingClosedTicketState | null>(null);
  const [loadingHistoryTicketId, setLoadingHistoryTicketId] = useState<string | null>(null);
  const [historyRangeMode, setHistoryRangeMode] = useState<RangeMode>("day");
  const [historyCustomFrom, setHistoryCustomFrom] = useState(() => toDateInput(new Date()));
  const [historyCustomTo, setHistoryCustomTo] = useState(() => toDateInput(new Date()));
  const [historyTickets, setHistoryTickets] = useState(() => recentTickets.filter((ticket) => ticket.status === "CLOSED"));
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const keyboardVisible = useKeyboardVisible();
  const requestedAppointmentId = Array.isArray(params.appointmentId) ? params.appointmentId[0] : params.appointmentId;
  const observerReadOnly =
    observerViewContext?.observerScope.mode === "org" ||
    (observerViewContext?.viewBranchId != null && observerViewContext.viewBranchId !== observerViewContext.workingBranchId);

  // Removed useFocusEffect to prevent layout shift when returning to screen
  // Data is loaded via useAdminOperations hook

  const checkoutAppointments = useMemo(() => checkoutCheckedInAppointments, [checkoutCheckedInAppointments]);
  const selectedAppointment = useMemo(
    () =>
      checkoutAppointments.find((item) => item.id === selectedAppointmentId) ??
      checkoutAppointments.find((item) => item.id === requestedAppointmentId) ??
      checkoutAppointments[0] ??
      null,
    [checkoutAppointments, requestedAppointmentId, selectedAppointmentId],
  );
  const checkedInAppointments = checkoutAppointments;
  const { byId: checkoutServiceById, byName: checkoutServiceByName } = useMemo(
    () => buildCheckoutServiceLookups(checkoutServices),
    [checkoutServices],
  );
  const activeCheckoutServices = useMemo(() => checkoutServices.filter((item) => item.active), [checkoutServices]);
  const canEditClosedTickets = role === "OWNER" || role === "PARTNER";
  const selectableCheckoutServices = useMemo(() => {
    if (!editingClosedTicket) {
      return activeCheckoutServices;
    }

    const selectedIds = new Set(checkoutLines.map((line) => line.serviceId).filter(Boolean));
    const preservedInactive = checkoutServices.filter((service) => !service.active && selectedIds.has(service.id));
    return [...activeCheckoutServices, ...preservedInactive];
  }, [activeCheckoutServices, checkoutLines, checkoutServices, editingClosedTicket]);
  const historyRange = useMemo(
    () => buildHistoryRange(historyRangeMode, historyCustomFrom, historyCustomTo),
    [historyCustomFrom, historyCustomTo, historyRangeMode],
  );
  const historyRangeLabel = useMemo(
    () => formatDateRangeLabel(historyRangeMode, historyCustomFrom, historyCustomTo),
    [historyCustomFrom, historyCustomTo, historyRangeMode],
  );
  const historyRangeOptions = useMemo(
    () => [
      { value: "day" as const, label: strings.manageReportsModeDay },
      { value: "week" as const, label: strings.manageReportsModeWeek },
      { value: "month" as const, label: strings.manageReportsModeMonth },
      { value: "custom" as const, label: strings.manageReportsModeCustom },
    ],
    [strings.manageReportsModeCustom, strings.manageReportsModeDay, strings.manageReportsModeMonth, strings.manageReportsModeWeek],
  );
  const checkoutSummary = useMemo(() => {
    const selectedLines = checkoutLines
      .map((line) => ({ ...line, service: checkoutServiceById.get(line.serviceId) ?? null }))
      .filter((line) => line.service && line.qty > 0);
    const serviceCount = selectedLines.reduce((sum, line) => sum + line.qty, 0);
    const total = selectedLines.reduce((sum, line) => {
      if (!line.service) return sum;
      return sum + line.service.basePrice * line.qty * (1 + line.service.vatRate);
    }, 0);
    return { selectedLines, serviceCount, total };
  }, [checkoutLines, checkoutServiceById]);
  const effectiveCheckoutCustomerName = editingClosedTicket?.customerName
    ?? (checkoutCustomerName.trim() || selectedAppointment?.customerName || "");
  const activeMutationTargetId = editingClosedTicket?.ticketId ?? selectedAppointment?.id ?? null;
  const receiptUrl =
    checkoutSuccess?.receiptToken && mobileEnv.apiBaseUrl
      ? new URL(`/receipt/${checkoutSuccess.receiptToken}`, mobileEnv.apiBaseUrl).toString()
      : null;
  const checkoutPaymentMethodLabel =
    checkoutSuccess?.paymentMethod === "TRANSFER" ? strings.checkoutMethodTransfer : strings.checkoutMethodCash;

  function buildReceiptUrl(receiptToken: string | null | undefined) {
    if (!receiptToken || !mobileEnv.apiBaseUrl) return null;
    return new URL(`/receipt/${receiptToken}`, mobileEnv.apiBaseUrl).toString();
  }

  function resetCheckoutComposer() {
    setCheckoutPaymentMethod("CASH");
    setCheckoutLines([createEmptyCheckoutLine()]);
    setServiceQueries([""]);
    setOpenServicePickerIndex(0);
  }

  function clearClosedTicketEdit() {
    setEditingClosedTicket(null);
    setCheckoutNotice(null);
    resetCheckoutComposer();
  }

  const loadHistoryTickets = useCallback(async () => {
    if (!observerViewContext || !role) {
      setHistoryTickets([]);
      setHistoryError(null);
      return [] as typeof historyTickets;
    }

    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const tickets = await loadRecentTickets({
        fromIso: historyRange.from.toISOString(),
        toIso: historyRange.to.toISOString(),
        limit: 100,
      });
      const closedTickets = tickets.filter((ticket) => ticket.status === "CLOSED");
      setHistoryTickets(closedTickets);
      return closedTickets;
    } catch (nextError) {
      setHistoryError(nextError instanceof Error ? nextError.message : strings.checkoutNoPaidHistory);
      return [] as typeof historyTickets;
    } finally {
      setHistoryLoading(false);
    }
  }, [historyRange.from, historyRange.to, loadRecentTickets, observerViewContext, role, strings.checkoutNoPaidHistory]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadHistoryTickets();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [loadHistoryTickets]);

  function addCheckoutLine() {
    setCheckoutLines((current) => [...current, createEmptyCheckoutLine()]);
    setServiceQueries((current) => [...current, ""]);
    setOpenServicePickerIndex(checkoutLines.length);
  }

  function updateCheckoutLine(index: number, patch: Partial<CheckoutLineDraft>) {
    setCheckoutLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }

  function removeCheckoutLine(index: number) {
    if (checkoutLines.length === 1) return;
    setCheckoutLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
    setServiceQueries((current) => current.filter((_, lineIndex) => lineIndex !== index));
    setOpenServicePickerIndex((current) => (current == null ? current : current === index ? null : current > index ? current - 1 : current));
  }

  function updateServiceQuery(index: number, value: string) {
    setServiceQueries((current) => current.map((query, lineIndex) => (lineIndex === index ? value : query)));
  }

  function updateCheckoutQty(index: number, nextQty: number) {
    const safeQty = Number.isFinite(nextQty) ? Math.max(1, Math.floor(nextQty)) : 1;
    updateCheckoutLine(index, { qty: safeQty });
  }

  async function handleCreateCheckout() {
    if (!selectedAppointment) return;
    const validLines = checkoutLines.filter((line) => line.serviceId && line.qty > 0);
    if (!effectiveCheckoutCustomerName.trim() || validLines.length === 0) return;
    setCheckoutNotice(null);
    const result = await createCheckout({
      customerName: effectiveCheckoutCustomerName.trim(),
      paymentMethod: checkoutPaymentMethod,
      lines: validLines,
      appointmentId: selectedAppointment.id,
      idempotencyKey: createCheckoutKey(),
    });
    if (!result) return;
    setCheckoutSuccess({
      mode: "create",
      ticketId: result.ticketId,
      receiptToken: result.receiptToken,
      grandTotal: result.grandTotal,
      customerName: effectiveCheckoutCustomerName.trim(),
      paymentMethod: checkoutPaymentMethod,
    });
    resetCheckoutComposer();
    setSelectedAppointmentId(null);
    await loadHistoryTickets();
  }

  async function handleUpdateClosedTicket() {
    if (!editingClosedTicket) return;
    const validLines = checkoutLines.filter((line) => line.serviceId && line.qty > 0);
    if (!effectiveCheckoutCustomerName.trim() || validLines.length === 0) return;

    setCheckoutNotice(null);
    const result = await updateClosedTicket({
      ticketId: editingClosedTicket.ticketId,
      paymentMethod: checkoutPaymentMethod,
      lines: validLines,
    });
    if (!result) return;

    setCheckoutSuccess({
      mode: "update",
      ticketId: result.ticketId,
      receiptToken: result.receiptToken,
      grandTotal: result.grandTotal,
      customerName: effectiveCheckoutCustomerName.trim(),
      paymentMethod: checkoutPaymentMethod,
    });
    clearClosedTicketEdit();
    await loadHistoryTickets();
  }

  async function openReceiptByToken(receiptToken: string | null | undefined) {
    const nextReceiptUrl = buildReceiptUrl(receiptToken);
    if (!nextReceiptUrl) return;
    await Linking.openURL(nextReceiptUrl);
  }

  async function handleStartEditClosedTicket(ticket: (typeof historyTickets)[number]) {
    if (!mobileSupabase || !canEditClosedTickets) return;

    try {
      setLoadingHistoryTicketId(ticket.id);
      setCheckoutNotice(null);
      setSelectedAppointmentId(null);
      const detail = await getTicketDetailForMobile(mobileSupabase, ticket.id);
      const editableLines = resolveEditableTicketLines(detail.items, checkoutServiceById, checkoutServiceByName);

      if (!editableLines.length) {
        setCheckoutNotice(strings.checkoutServiceNotFound);
        return;
      }

      setEditingClosedTicket({
        ticketId: detail.ticket.id,
        customerName: detail.customer?.name ?? ticket.customerName ?? strings.checkoutHistoryBadge,
        receiptToken: detail.receipt?.publicToken ?? ticket.receiptToken ?? null,
        createdAt: detail.ticket.createdAt,
      });
      setCheckoutPaymentMethod(detail.payment?.method === "TRANSFER" ? "TRANSFER" : "CASH");
      setCheckoutLines(editableLines.map((line) => ({ serviceId: line.serviceId, qty: line.qty })));
      setServiceQueries(editableLines.map((line) => line.serviceName));
      setOpenServicePickerIndex(null);
    } catch (nextError) {
      setCheckoutNotice(nextError instanceof Error ? nextError.message : strings.checkoutServiceNotFound);
    } finally {
      setLoadingHistoryTicketId(null);
    }
  }

  async function openReceipt() {
    await openReceiptByToken(checkoutSuccess?.receiptToken);
  }

  async function shareReceipt() {
    if (!checkoutSuccess) return;
    if (!receiptUrl) {
      setCheckoutNotice(strings.checkoutShareReceiptFailed);
      return;
    }

    try {
      await Share.share({
        message: `${strings.checkoutPaidNotice}\n${checkoutSuccess.customerName}\n${formatVnd(checkoutSuccess.grandTotal)}\n${receiptUrl}`,
      });
      setCheckoutNotice(null);
    } catch {
      setCheckoutNotice(strings.checkoutShareReceiptFailed);
    }
  }

  function closeCheckoutSuccess() {
    setCheckoutSuccess(null);
    setCheckoutNotice(null);
  }

  return (
    <View style={styles.screen}>
      <Modal visible={checkoutSuccess != null} transparent animationType="fade" onRequestClose={closeCheckoutSuccess}>
        <View style={styles.successOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeCheckoutSuccess} />
          <View style={styles.successSheet}>
            <Pressable style={styles.successCloseButton} onPress={closeCheckoutSuccess}>
              <Feather name="x" size={18} color={palette.muted} />
            </Pressable>
            <View style={styles.successBadge}>
              <Feather name="check" size={18} color="#2B7A56" />
            </View>
            <Text style={styles.successTitle}>
              {checkoutSuccess?.mode === "update" ? strings.checkoutUpdateBillSuccessTitle : strings.checkoutSuccessTitle}
            </Text>
            <Text style={styles.successBody}>
              {checkoutSuccess?.mode === "update" ? strings.checkoutUpdateBillSuccessBody : strings.checkoutSuccessBody}
            </Text>

            {checkoutSuccess ? (
              <View style={styles.successDetails}>
                <View style={styles.successDetailRow}>
                  <Text style={styles.successDetailLabel}>{strings.checkoutSuccessCustomerLabel}</Text>
                  <Text style={styles.successDetailValue}>{checkoutSuccess.customerName}</Text>
                </View>
                <View style={styles.successDetailRow}>
                  <Text style={styles.successDetailLabel}>{strings.checkoutSuccessAmountLabel}</Text>
                  <Text style={styles.successDetailValue}>{formatVnd(checkoutSuccess.grandTotal)}</Text>
                </View>
                <View style={styles.successDetailRow}>
                  <Text style={styles.successDetailLabel}>{strings.checkoutSuccessMethodLabel}</Text>
                  <Text style={styles.successDetailValue}>{checkoutPaymentMethodLabel}</Text>
                </View>
                <View style={styles.successDetailRow}>
                  <Text style={styles.successDetailLabel}>{strings.checkoutSuccessTicketLabel}</Text>
                  <Text style={styles.successDetailValue} numberOfLines={1}>{checkoutSuccess.ticketId}</Text>
                </View>
              </View>
            ) : null}
            {checkoutNotice ? <Text style={styles.noticeTextInline}>{checkoutNotice}</Text> : null}

            <View style={styles.successActions}>
              <Pressable style={styles.primaryButton} onPress={() => void shareReceipt()}>
                <Text style={styles.primaryButtonText}>{strings.checkoutShareReceipt}</Text>
              </Pressable>
              {receiptUrl ? (
                <Pressable style={styles.secondaryButton} onPress={() => void openReceipt()}>
                  <Text style={styles.secondaryButtonText}>{strings.checkoutOpenReceipt}</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  closeCheckoutSuccess();
                  void router.replace("/scheduling");
                }}
              >
                <Text style={styles.secondaryButtonText}>{strings.checkoutBackToScheduling}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <AdminTopSafeArea style={styles.topChrome}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{strings.checkoutTitle}</Text>
            <Text style={styles.headerSubtitle}>{strings.checkoutSubtitle}</Text>
          </View>
          <AdminHeaderActions onSettingsPress={() => void router.push("/settings")} />
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
          onScrollBeginDrag={() => Keyboard.dismiss()}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          contentInsetAdjustmentBehavior="always"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading || historyLoading}
              onRefresh={() => void Promise.all([reload(), loadHistoryTickets()])}
              tintColor={palette.brown}
              colors={[palette.brown]}
            />
          }
        >
          {observerReadOnly ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeText}>{strings.checkoutObserverReadOnly}</Text>
            </View>
          ) : null}

          <View style={[styles.header, styles.hiddenHeader]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{strings.checkoutTitle}</Text>
              <Text style={styles.headerSubtitle}>{strings.checkoutSubtitle}</Text>
            </View>
            <AdminHeaderActions onSettingsPress={() => void router.push("/settings")} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{strings.checkoutServingCustomersTitle}</Text>
            {staleCheckInAutoCancelledCount > 0 ? <Text style={styles.successText}>{strings.checkoutAutoCancelledPrefix} {staleCheckInAutoCancelledCount} {strings.checkoutAutoCancelledSuffix}</Text> : null}
            {staleCheckInCleanupError ? <Text style={styles.errorText}>{staleCheckInCleanupError}</Text> : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              {checkoutAppointments.map((item) => {
                const [avatarStrong, avatarSoft] = buildAvatarTone(item.customerName);
                const active = item.id === selectedAppointment?.id;
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.customerPill, active && styles.customerPillActive]}
                    onPress={() => {
                      clearClosedTicketEdit();
                      setSelectedAppointmentId(item.id);
                    }}
                  >
                    <View style={[styles.smallAvatarOuter, { backgroundColor: avatarSoft }]}>
                      <View style={[styles.smallAvatarInner, { backgroundColor: avatarStrong }]}>
                        <Text style={styles.smallAvatarText}>{getInitials(item.customerName)}</Text>
                      </View>
                    </View>
                    <Text style={[styles.customerPillText, active && styles.customerPillTextActive]} numberOfLines={1}>{item.customerName}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {checkedInAppointments.length === 0 ? <Text style={styles.emptyText}>{strings.checkoutNoServingCustomers}</Text> : null}
          </View>

          {staleCheckedInAppointments.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{strings.checkoutStaleTitle}</Text>
              <View style={{ gap: 10 }}>
                {staleCheckedInAppointments.map((item) => (
                  <View key={`stale-${item.id}`} style={styles.staleRow}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.staleName}>{item.customerName}</Text>
                        <Text style={styles.staleMeta}>
                        {formatShortDateTime(item.checkedInAt ?? item.startAt)} · {formatStaleDays(item.checkedInAt, item.startAt, strings.checkoutStaleFallback)}
                      </Text>
                    </View>
                    <View style={styles.staleBadge}>
                      <Text style={styles.staleBadgeText}>{strings.checkoutCancellingBadge}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.historyHeader}>
              <Text style={styles.cardTitle}>{strings.checkoutPaidHistoryTitle}</Text>
              <View style={styles.historyCountBadge}>
                <Text style={styles.historyCountBadgeText}>{historyTickets.length}</Text>
              </View>
            </View>
            <View style={styles.historyFilterRow}>
              {historyRangeOptions.map((option) => {
                const active = historyRangeMode === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.historyFilterButton, active && styles.historyFilterButtonActive]}
                    onPress={() => setHistoryRangeMode(option.value)}
                  >
                    <Text style={[styles.historyFilterButtonText, active && styles.historyFilterButtonTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.historyRangeLabel}>{historyRangeLabel}</Text>
            {historyRangeMode === "custom" ? (
              <View style={styles.historyCustomRow}>
                <View style={styles.historyCustomField}>
                  <Text style={styles.historyCustomLabel}>{strings.manageReportsFromLabel}</Text>
                  <AdminKeyboardTextInput
                    style={styles.historyCustomInput}
                    value={historyCustomFrom}
                    onChangeText={setHistoryCustomFrom}
                    placeholder="YYYY-MM-DD"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholderTextColor="#A69789"
                  />
                </View>
                <View style={styles.historyCustomField}>
                  <Text style={styles.historyCustomLabel}>{strings.manageReportsToLabel}</Text>
                  <AdminKeyboardTextInput
                    style={styles.historyCustomInput}
                    value={historyCustomTo}
                    onChangeText={setHistoryCustomTo}
                    placeholder="YYYY-MM-DD"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholderTextColor="#A69789"
                  />
                </View>
              </View>
            ) : null}
            {historyError ? <Text style={styles.errorText}>{historyError}</Text> : null}
            {historyLoading ? (
              <View style={styles.historyLoadingRow}>
                <ActivityIndicator size="small" color={palette.brown} />
              </View>
            ) : null}
            {historyTickets.length === 0 ? (
              <Text style={styles.emptyText}>{strings.checkoutNoPaidHistory}</Text>
            ) : (
              <View style={styles.historyList}>
                {historyTickets.map((ticket) => (
                  <View key={ticket.id} style={styles.historyCard}>
                    <View style={styles.historyTopRow}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.historyTitle} numberOfLines={1}>
                          {ticket.customerName ?? strings.checkoutHistoryBadge}
                        </Text>
                        <Text style={styles.historyMeta}>{formatShortDateTime(ticket.createdAt)}</Text>
                      </View>
                      <View style={styles.historyAmountWrap}>
                        <View style={styles.historyBadge}>
                          <Text style={styles.historyBadgeText}>{strings.checkoutHistoryBadge}</Text>
                        </View>
                        <Text style={styles.historyAmount}>{formatVnd(ticket.grandTotal)}</Text>
                      </View>
                    </View>
                    <View style={styles.historyActions}>
                      {ticket.receiptToken ? (
                        <Pressable style={styles.historyActionButton} onPress={() => void openReceiptByToken(ticket.receiptToken)}>
                          <Text style={styles.historyActionButtonText}>{strings.checkoutOpenReceipt}</Text>
                        </Pressable>
                      ) : null}
                      {canEditClosedTickets ? (
                        <Pressable
                          style={styles.historyActionButton}
                          disabled={loadingHistoryTicketId === ticket.id}
                          onPress={() => void handleStartEditClosedTicket(ticket)}
                        >
                          {loadingHistoryTicketId === ticket.id ? (
                            <ActivityIndicator size="small" color="#6A5848" />
                          ) : (
                            <Text style={styles.historyActionButtonText}>{strings.checkoutEditPaidBill}</Text>
                          )}
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {(selectedAppointment || editingClosedTicket) ? (
            <View style={styles.card}>
              <View style={styles.profileRow}>
                <View style={styles.heroAvatarOuter}>
                  <View style={styles.heroAvatarInner}>
                    <Text style={styles.heroAvatarText}>{getInitials(effectiveCheckoutCustomerName || strings.checkoutTitle)}</Text>
                  </View>
                </View>
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={styles.profileTop}>
                    <Text style={styles.profileName}>{effectiveCheckoutCustomerName}</Text>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {editingClosedTicket ? strings.checkoutHistoryBadge : strings.checkoutServingBadge}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.timeRow}>
                    {editingClosedTicket ? (
                      <>
                        <View style={styles.timePill}>
                          <Feather name="clock" size={13} color={palette.muted} />
                          <Text style={styles.timeText}>{formatShortDateTime(editingClosedTicket.createdAt)}</Text>
                        </View>
                        {editingClosedTicket.receiptToken ? (
                          <View style={styles.timePill}>
                            <Feather name="file-text" size={13} color={palette.muted} />
                            <Text style={styles.timeText} numberOfLines={1}>{editingClosedTicket.receiptToken.slice(0, 8)}</Text>
                          </View>
                        ) : null}
                      </>
                    ) : selectedAppointment ? (
                      <>
                        <View style={styles.timePill}><Feather name="clock" size={13} color={palette.muted} /><Text style={styles.timeText}>{formatShortDateTime(selectedAppointment.startAt)}</Text></View>
                        <View style={styles.timePill}><Feather name="clock" size={13} color={palette.muted} /><Text style={styles.timeText}>{formatShortDateTime(selectedAppointment.checkedInAt)}</Text></View>
                      </>
                    ) : null}
                  </View>
                </View>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {role === "TECH" && techShiftOpen === false ? <Text style={styles.errorText}>{strings.checkoutShiftNotOpen}</Text> : null}
              {checkoutNotice ? <Text style={styles.errorText}>{checkoutNotice}</Text> : null}

              <View style={styles.methodRow}>
                {(["CASH", "TRANSFER"] as const).map((method) => {
                  const active = checkoutPaymentMethod === method;
                  return (
                    <Pressable key={method} style={[styles.methodButton, active && styles.methodButtonActive]} onPress={() => setCheckoutPaymentMethod(method)}>
                      <Feather name={method === "CASH" ? "credit-card" : "home"} size={16} color={active ? palette.text : "#7D7066"} />
                      <Text style={[styles.methodText, active && styles.methodTextActive]}>{method === "CASH" ? strings.checkoutMethodCash : strings.checkoutMethodTransfer}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.serviceCard}>
                <Text style={styles.serviceTitle}>{strings.checkoutServicesTitle}</Text>
                {checkoutLines.map((line, index) => {
                  const selectedService = checkoutServiceById.get(line.serviceId) ?? null;
                  const filteredServices = selectableCheckoutServices.filter((service) => {
                    const query = (serviceQueries[index] ?? "").trim().toLowerCase();
                    return !query || service.name.toLowerCase().includes(query);
                  });
                  return (
                    <View key={`checkout-line-${index}`} style={{ gap: 10 }}>
                      <Pressable style={styles.field} onPress={() => setOpenServicePickerIndex((current) => (current === index ? null : index))}>
                        <Text style={line.serviceId ? styles.fieldValue : styles.fieldPlaceholder}>
                          {selectedService?.name ?? strings.checkoutServicePlaceholder}
                        </Text>
                        <Feather name="chevron-down" size={18} color={palette.muted} />
                      </Pressable>

                      {openServicePickerIndex === index ? (
                        <View style={{ gap: 8 }}>
                          <View style={styles.searchShell}>
                            <Feather name="search" size={17} color="#A69789" />
                            <AdminKeyboardTextInput
                              style={styles.searchInput}
                              value={serviceQueries[index] ?? ""}
                              onChangeText={(value) => updateServiceQuery(index, value)}
                              placeholder={strings.checkoutServiceSearchPlaceholder}
                              placeholderTextColor="#A69789"
                            />
                          </View>
                          <ScrollView style={styles.dropdownList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                            <View style={{ gap: 8 }}>
                              {filteredServices.map((service) => {
                                const active = line.serviceId === service.id;
                                return (
                                  <Pressable
                                    key={`${index}-${service.id}`}
                                    style={[styles.serviceRow, active && styles.serviceRowActive]}
                                    onPress={() => {
                                      updateCheckoutLine(index, { serviceId: service.id });
                                      updateServiceQuery(index, service.name);
                                      setOpenServicePickerIndex(null);
                                    }}
                                  >
                                    <Text style={[styles.serviceRowName, active && styles.serviceRowTextActive]}>{service.name}</Text>
                                    <Text style={[styles.serviceRowPrice, active && styles.serviceRowTextActive]}>{formatVnd(service.basePrice * (1 + service.vatRate))}</Text>
                                  </Pressable>
                                );
                              })}
                              {filteredServices.length === 0 ? <Text style={styles.emptyText}>{strings.checkoutServiceNotFound}</Text> : null}
                            </View>
                          </ScrollView>
                        </View>
                      ) : null}

                      <View style={styles.quantityBar}>
                        <View style={styles.quantityLeft}>
                          <Text style={styles.quantityLabel}>{strings.checkoutQtyShort}</Text>
                          <View style={styles.quantityControls}>
                            <Pressable style={styles.qtyButton} onPress={() => updateCheckoutQty(index, line.qty - 1)}><Text style={styles.qtyButtonText}>-</Text></Pressable>
                            <View style={styles.qtyValueShell}>
                              <AdminKeyboardTextInput
                                style={styles.qtyInput}
                                value={String(line.qty || 1)}
                                onChangeText={(value) => updateCheckoutQty(index, Number(value || "1"))}
                                keyboardType="number-pad"
                                placeholder="1"
                                placeholderTextColor="#A69789"
                              />
                            </View>
                            <Pressable style={styles.qtyButton} onPress={() => updateCheckoutQty(index, line.qty + 1)}><Text style={styles.qtyButtonText}>+</Text></Pressable>
                          </View>
                        </View>
                        <View style={styles.quantityDivider} />
                        <Pressable style={styles.addLineButton} onPress={addCheckoutLine}>
                          <Text style={styles.addLineText}>{strings.checkoutAddLine}</Text>
                          <Feather name="plus-circle" size={18} color="#8B7C70" />
                        </Pressable>
                      </View>

                      {line.serviceId ? (
                        <View style={styles.selectedRow}>
                          <Text style={styles.selectedName}>{selectedService?.name ?? "-"}</Text>
                          <Text style={styles.selectedPrice}>{formatVnd((selectedService?.basePrice ?? 0) * (1 + (selectedService?.vatRate ?? 0)))}</Text>
                          <Pressable style={styles.trashButton} onPress={() => removeCheckoutLine(index)} disabled={checkoutLines.length === 1}>
                            <Feather name="trash-2" size={15} color={checkoutLines.length === 1 ? "#D0C5BB" : "#7C6F63"} />
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  );
                })}

                <View style={styles.totalCard}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>{strings.checkoutTotalLabel}</Text>
                    <Text style={styles.totalValue}>{checkoutSummary.serviceCount} {strings.checkoutServiceCountUnit} • {formatVnd(checkoutSummary.total)}</Text>
                  </View>
                  {checkoutSummary.selectedLines.length > 0 ? (
                    <View style={styles.totalBreakdown}>
                      {checkoutSummary.selectedLines.map((line, index) => {
                        if (!line.service) return null;
                        const lineTotal = line.service.basePrice * line.qty * (1 + line.service.vatRate);
                        return (
                          <View key={`summary-line-${index}-${line.service.id}`} style={styles.totalBreakdownRow}>
                            <Text style={styles.totalBreakdownName} numberOfLines={1}>
                              {line.service.name} x {line.qty}
                            </Text>
                            <Text style={styles.totalBreakdownPrice}>{formatVnd(lineTotal)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>

                <Pressable
                  style={[styles.primaryButton, (observerReadOnly || mutating || (activeMutationTargetId != null && busyTargetId === activeMutationTargetId) || (!editingClosedTicket && role === "TECH" && techShiftOpen === false) || !effectiveCheckoutCustomerName.trim() || checkoutSummary.selectedLines.length === 0) && styles.primaryButtonDisabled]}
                  disabled={observerReadOnly || mutating || (activeMutationTargetId != null && busyTargetId === activeMutationTargetId) || (!editingClosedTicket && role === "TECH" && techShiftOpen === false) || !effectiveCheckoutCustomerName.trim() || checkoutSummary.selectedLines.length === 0}
                  onPress={() => void (editingClosedTicket ? handleUpdateClosedTicket() : handleCreateCheckout())}
                >
                  <Text style={styles.primaryButtonText}>
                    {activeMutationTargetId != null && busyTargetId === activeMutationTargetId
                      ? editingClosedTicket
                        ? strings.checkoutUpdatingBillButton
                        : strings.checkoutProcessingButton
                      : editingClosedTicket
                        ? strings.checkoutUpdateBillButton
                        : strings.checkoutPayButton}
                  </Text>
                </Pressable>

                <Pressable style={styles.secondaryButton} onPress={() => void router.replace("/scheduling")}>
                  <Text style={styles.secondaryButtonText}>{strings.checkoutBackToScheduling}</Text>
                </Pressable>
                {editingClosedTicket ? (
                  <Pressable style={styles.linkButton} onPress={clearClosedTicketEdit}>
                    <Text style={styles.linkText}>{strings.checkoutCancelEditBill}</Text>
                  </Pressable>
                ) : null}
                {role === "TECH" && techShiftOpen === false ? <Pressable style={styles.linkButton} onPress={() => void router.push("/shifts")}><Text style={styles.linkText}>{strings.checkoutOpenShift}</Text></Pressable> : null}
              </View>
            </View>
          ) : null}
        </AdminKeyboardAwareScrollView>
      </KeyboardAvoidingView>

      <AdminBottomNavDock current="checkout" role={role} onNavigate={(target) => void router.replace(getAdminNavHref(target, role))} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.screen },
  scrollRegion: { flex: 1 },
  topChrome: { paddingHorizontal: 22, paddingBottom: 12 },
  content: { paddingHorizontal: 22, paddingTop: ADMIN_CONTENT_TOP_GAP, paddingBottom: ADMIN_CONTENT_BOTTOM_NAV_CLEARANCE, gap: 16 },
  header: { flexDirection: "row", alignItems: "flex-start" },
  hiddenHeader: { display: "none" },
  headerTitle: { fontSize: 28, lineHeight: 32, fontWeight: "800", color: palette.text, letterSpacing: -0.6 },
  headerSubtitle: { marginTop: 4, fontSize: 13, lineHeight: 18, color: palette.muted },
  successOverlay: { flex: 1, backgroundColor: "rgba(28, 20, 14, 0.36)", alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
  successSheet: { width: "100%", maxWidth: 420, borderRadius: 24, backgroundColor: palette.white, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16, gap: 14 },
  successCloseButton: { alignSelf: "flex-end", width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#F6F1EB" },
  successBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#E5F4EC", alignItems: "center", justifyContent: "center", alignSelf: "center" },
  successTitle: { fontSize: 22, lineHeight: 26, fontWeight: "800", color: palette.text, textAlign: "center" },
  successBody: { fontSize: 13, lineHeight: 18, color: palette.muted, textAlign: "center" },
  successDetails: { borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.beigeSoft, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  successDetailRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  successDetailLabel: { fontSize: 12, lineHeight: 15, color: palette.muted, flexShrink: 0 },
  successDetailValue: { flex: 1, fontSize: 13, lineHeight: 17, fontWeight: "700", color: palette.text, textAlign: "right" },
  noticeTextInline: { fontSize: 12, lineHeight: 17, color: "#B64747", fontWeight: "600", textAlign: "center" },
  successActions: { gap: 10 },
  card: { backgroundColor: palette.white, borderRadius: 20, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 14, paddingVertical: 15, gap: 12 },
  noticeCard: { backgroundColor: "#FFF5E7", borderColor: "#F0D9B7", borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  noticeText: { color: "#8A5B21", fontSize: 12, lineHeight: 18, fontWeight: "600" },
  cardTitle: { fontSize: 15, lineHeight: 19, fontWeight: "700", color: palette.text },
  historyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  historyCountBadge: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, backgroundColor: "#FBF2E6", alignItems: "center", justifyContent: "center" },
  historyCountBadgeText: { fontSize: 10, lineHeight: 12, fontWeight: "800", color: "#8A5530" },
  historyFilterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  historyFilterButton: { minHeight: 32, borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.white, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  historyFilterButtonActive: { backgroundColor: palette.beige, borderColor: palette.beigeStrong },
  historyFilterButtonText: { fontSize: 12, lineHeight: 15, color: "#6A5848", fontWeight: "600" },
  historyFilterButtonTextActive: { color: palette.text, fontWeight: "700" },
  historyRangeLabel: { fontSize: 12, lineHeight: 16, color: palette.muted },
  historyCustomRow: { flexDirection: "row", gap: 10 },
  historyCustomField: { flex: 1, gap: 6 },
  historyCustomLabel: { fontSize: 12, lineHeight: 15, color: "#6A5848", fontWeight: "700" },
  historyCustomInput: { minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.white, paddingHorizontal: 12, fontSize: 13, lineHeight: 16, color: palette.text },
  historyLoadingRow: { minHeight: 22, alignItems: "flex-start", justifyContent: "center" },
  historyList: { gap: 10 },
  historyCard: { borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.beigeSoft, paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
  historyTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  historyTitle: { fontSize: 14, lineHeight: 18, fontWeight: "700", color: palette.text },
  historyMeta: { fontSize: 12, lineHeight: 16, color: palette.muted },
  historyAmountWrap: { alignItems: "flex-end", gap: 6 },
  historyAmount: { fontSize: 13, lineHeight: 16, fontWeight: "800", color: palette.text },
  historyBadge: { minHeight: 22, borderRadius: 11, paddingHorizontal: 8, backgroundColor: "#EAF7EE", alignItems: "center", justifyContent: "center" },
  historyBadgeText: { fontSize: 10, lineHeight: 12, fontWeight: "700", color: "#2B7A56" },
  historyActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  historyActionButton: { minHeight: 34, minWidth: 110, borderRadius: 17, borderWidth: 1, borderColor: "#D8C8BA", backgroundColor: palette.white, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  historyActionButtonText: { fontSize: 12, lineHeight: 15, color: "#6A5848", fontWeight: "700" },
  pillRow: { gap: 10, paddingRight: 6 },
  customerPill: { minWidth: 108, maxWidth: 150, height: 42, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.white, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, gap: 8 },
  customerPillActive: { backgroundColor: palette.beige, borderColor: palette.beigeStrong },
  customerPillText: { flex: 1, fontSize: 12, lineHeight: 15, color: "#65584D" },
  customerPillTextActive: { color: palette.text, fontWeight: "600" },
  smallAvatarOuter: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  smallAvatarInner: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  smallAvatarText: { color: "#FFF", fontSize: 8, lineHeight: 10, fontWeight: "800" },
  emptyText: { fontSize: 13, lineHeight: 18, color: palette.muted },
  profileRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  profileTop: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  profileName: { fontSize: 22, lineHeight: 26, fontWeight: "800", color: palette.text, letterSpacing: -0.4 },
  heroAvatarOuter: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#F1E3D5", alignItems: "center", justifyContent: "center" },
  heroAvatarInner: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#B78A69", alignItems: "center", justifyContent: "center" },
  heroAvatarText: { color: "#FFF", fontSize: 16, lineHeight: 20, fontWeight: "800" },
  badge: { minHeight: 22, borderRadius: 11, paddingHorizontal: 8, backgroundColor: palette.badge, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 11, lineHeight: 13, fontWeight: "700", color: palette.badgeText },
  timeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timePill: { minHeight: 30, borderRadius: 15, backgroundColor: "#F7F2EC", paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  timeText: { fontSize: 12, lineHeight: 15, color: "#6D6055" },
  errorText: { fontSize: 13, lineHeight: 18, color: "#B64747", fontWeight: "600" },
  successText: { fontSize: 13, lineHeight: 18, color: "#2B7A56", fontWeight: "600" },
  staleRow: { minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: "#FFF8F1", paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  staleName: { fontSize: 14, lineHeight: 18, color: palette.text, fontWeight: "700" },
  staleMeta: { fontSize: 12, lineHeight: 16, color: palette.muted },
  staleBadge: { minHeight: 24, borderRadius: 12, backgroundColor: "#F5D7BA", paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  staleBadgeText: { fontSize: 11, lineHeight: 13, color: "#8A5530", fontWeight: "700" },
  methodRow: { flexDirection: "row", gap: 10 },
  methodButton: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  methodButtonActive: { backgroundColor: palette.beige, borderColor: palette.beigeStrong },
  methodText: { fontSize: 13, lineHeight: 16, color: "#706257", fontWeight: "500" },
  methodTextActive: { color: palette.text, fontWeight: "700" },
  serviceCard: { borderRadius: 18, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 12, paddingVertical: 14, gap: 12 },
  serviceTitle: { fontSize: 18, lineHeight: 22, fontWeight: "800", color: palette.text },
  field: { minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.white, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fieldPlaceholder: { fontSize: 13, lineHeight: 16, color: "#A7988A" },
  fieldValue: { fontSize: 13, lineHeight: 16, color: palette.text },
  searchShell: { minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.white, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, fontSize: 13, lineHeight: 16, color: palette.text, paddingVertical: 0 },
  dropdownList: { maxHeight: 220 },
  serviceRow: { minHeight: 40, borderRadius: 13, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.white, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  serviceRowActive: { backgroundColor: palette.beige, borderColor: palette.beigeStrong },
  serviceRowName: { flex: 1, fontSize: 13, lineHeight: 16, color: palette.text },
  serviceRowPrice: { fontSize: 12, lineHeight: 15, color: "#8A7D72" },
  serviceRowTextActive: { color: palette.text, fontWeight: "700" },
  quantityBar: { minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.beigeSoft, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  quantityLeft: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  quantityLabel: { fontSize: 12, lineHeight: 14, fontWeight: "700", color: palette.text, minWidth: 18 },
  quantityControls: { flexDirection: "row", alignItems: "center", gap: 6 },
  qtyButton: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.white, alignItems: "center", justifyContent: "center" },
  qtyButtonText: { fontSize: 18, lineHeight: 20, color: "#6C5D50", fontWeight: "500" },
  qtyValueShell: { width: 36, height: 32, borderRadius: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.white, justifyContent: "center" },
  qtyInput: { textAlign: "center", fontSize: 14, lineHeight: 16, color: palette.text, paddingVertical: 0 },
  quantityDivider: { width: 1, alignSelf: "stretch", backgroundColor: palette.border },
  addLineButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, minWidth: 88 },
  addLineText: { fontSize: 12, lineHeight: 14, color: "#6B5949", fontWeight: "700" },
  selectedRow: { minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.white, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  selectedName: { flex: 1, fontSize: 13, lineHeight: 16, color: palette.text, fontWeight: "500" },
  selectedPrice: { fontSize: 13, lineHeight: 16, color: "#8A7D72" },
  trashButton: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  totalCard: { gap: 8, marginTop: 2, paddingTop: 2 },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  totalLabel: { fontSize: 14, lineHeight: 18, fontWeight: "800", color: palette.text },
  totalValue: { fontSize: 13, lineHeight: 16, color: "#8A7D72", textAlign: "right" },
  totalBreakdown: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.beigeSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  totalBreakdownRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  totalBreakdownName: { flex: 1, fontSize: 13, lineHeight: 16, color: palette.text, fontWeight: "500" },
  totalBreakdownPrice: { fontSize: 13, lineHeight: 16, color: "#7C6B5C", fontWeight: "600", textAlign: "right" },
  primaryButton: { marginTop: 4, height: 44, borderRadius: 13, backgroundColor: palette.brown, alignItems: "center", justifyContent: "center" },
  primaryButtonDisabled: { opacity: 0.55 },
  primaryButtonText: { fontSize: 15, lineHeight: 18, color: "#FFF", fontWeight: "800" },
  secondaryButton: { height: 44, borderRadius: 13, borderWidth: 1, borderColor: "#D8C8BA", backgroundColor: palette.white, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontSize: 15, lineHeight: 18, color: "#6A5848", fontWeight: "700" },
  linkButton: { minHeight: 26, alignItems: "center", justifyContent: "center" },
  linkText: { fontSize: 13, lineHeight: 16, color: "#7C6B5C", fontWeight: "600" },
  accountLabel: { fontSize: 12, lineHeight: 15, fontWeight: "800", color: "#B17E56", letterSpacing: 1.4 },
  accountRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  accountSplit: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  accountText: { fontSize: 14, lineHeight: 18, color: "#4F443A", flex: 1 },
  signOutButton: { minHeight: 34, borderRadius: 17, backgroundColor: palette.beige, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  signOutText: { fontSize: 13, lineHeight: 16, color: palette.brown, fontWeight: "700" },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "transparent", paddingHorizontal: 16, paddingTop: 6 },
});
