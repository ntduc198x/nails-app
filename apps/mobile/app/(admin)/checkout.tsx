import { Feather } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  Linking,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AdminBottomNav, AdminHeaderActions, createCheckoutKey, formatVnd, getAdminBottomBarPadding, getAdminHeaderTopPadding } from "@/src/features/admin/ui";
import { getAdminNavHref } from "@/src/features/admin/navigation";
import { useAdminOperations } from "@/src/hooks/use-admin-operations";
import { mobileEnv } from "@/src/lib/env";
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

export default function AdminCheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ appointmentId?: string }>();
  const insets = useSafeAreaInsets();
  const { signOut, isBusy: sessionBusy } = useSession();
  const { appointments, checkoutServices, createCheckout, reload, loading, role, techShiftOpen, user, busyTargetId, error, mutating } =
    useAdminOperations();
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [checkoutCustomerName] = useState("");
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [checkoutLines, setCheckoutLines] = useState<Array<{ serviceId: string; qty: number }>>([{ serviceId: "", qty: 1 }]);
  const [serviceQueries, setServiceQueries] = useState<string[]>([""]);
  const [openServicePickerIndex, setOpenServicePickerIndex] = useState<number | null>(0);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const [lastReceiptToken, setLastReceiptToken] = useState<string | null>(null);
  const requestedAppointmentId = Array.isArray(params.appointmentId) ? params.appointmentId[0] : params.appointmentId;

  useFocusEffect(
    useCallback(
      () => () => {
        void reload();
      },
      [reload],
    ),
  );

  const checkedInAppointments = useMemo(() => appointments.filter((item) => item.status === "CHECKED_IN"), [appointments]);
  const selectedAppointment = useMemo(
    () =>
      checkedInAppointments.find((item) => item.id === selectedAppointmentId) ??
      checkedInAppointments.find((item) => item.id === requestedAppointmentId) ??
      checkedInAppointments[0] ??
      null,
    [checkedInAppointments, requestedAppointmentId, selectedAppointmentId],
  );
  const activeCheckoutServices = useMemo(() => checkoutServices.filter((item) => item.active), [checkoutServices]);
  const checkoutSummary = useMemo(() => {
    const selectedLines = checkoutLines
      .map((line) => ({ ...line, service: activeCheckoutServices.find((service) => service.id === line.serviceId) ?? null }))
      .filter((line) => line.service && line.qty > 0);
    const serviceCount = selectedLines.reduce((sum, line) => sum + line.qty, 0);
    const total = selectedLines.reduce((sum, line) => {
      if (!line.service) return sum;
      return sum + line.service.basePrice * line.qty * (1 + line.service.vatRate);
    }, 0);
    return { selectedLines, serviceCount, total };
  }, [activeCheckoutServices, checkoutLines]);
  const effectiveCheckoutCustomerName = checkoutCustomerName.trim() || selectedAppointment?.customerName || "";

  function addCheckoutLine() {
    setCheckoutLines((current) => [...current, { serviceId: "", qty: 1 }]);
    setServiceQueries((current) => [...current, ""]);
    setOpenServicePickerIndex(checkoutLines.length);
  }

  function updateCheckoutLine(index: number, patch: Partial<{ serviceId: string; qty: number }>) {
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
    const result = await createCheckout({
      customerName: effectiveCheckoutCustomerName.trim(),
      paymentMethod: checkoutPaymentMethod,
      lines: validLines,
      appointmentId: selectedAppointment.id,
      idempotencyKey: createCheckoutKey(),
    });
    await reload();
    setCheckoutNotice("Đã thanh toán.");
    setLastReceiptToken(result?.receiptToken ?? null);
    setCheckoutLines([{ serviceId: "", qty: 1 }]);
    setServiceQueries([""]);
    setOpenServicePickerIndex(0);
    setSelectedAppointmentId(null);
  }

  async function openReceipt() {
    if (!lastReceiptToken || !mobileEnv.apiBaseUrl) return;
    const receiptUrl = new URL(`/receipt/${lastReceiptToken}`, mobileEnv.apiBaseUrl).toString();
    await Linking.openURL(receiptUrl);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: getAdminHeaderTopPadding(insets.top), paddingBottom: 112 + getAdminBottomBarPadding(insets.bottom) }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} tintColor={palette.brown} colors={[palette.brown]} />}
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Thanh toán</Text>
              <Text style={styles.headerSubtitle}>Quản lý thanh toán cho khách hàng</Text>
            </View>
            <AdminHeaderActions onSettingsPress={() => void router.push("/(admin)/settings")} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Khách đang phục vụ</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              {checkedInAppointments.map((item) => {
                const [avatarStrong, avatarSoft] = buildAvatarTone(item.customerName);
                const active = item.id === selectedAppointment?.id;
                return (
                  <Pressable key={item.id} style={[styles.customerPill, active && styles.customerPillActive]} onPress={() => setSelectedAppointmentId(item.id)}>
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
            {checkedInAppointments.length === 0 ? <Text style={styles.emptyText}>Chưa có khách đang phục vụ</Text> : null}
          </View>

          {selectedAppointment ? (
            <View style={styles.card}>
              <View style={styles.profileRow}>
                <View style={styles.heroAvatarOuter}>
                  <View style={styles.heroAvatarInner}>
                    <Text style={styles.heroAvatarText}>{getInitials(selectedAppointment.customerName)}</Text>
                  </View>
                </View>
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={styles.profileTop}>
                    <Text style={styles.profileName}>{selectedAppointment.customerName}</Text>
                    <View style={styles.badge}><Text style={styles.badgeText}>Đang phục vụ</Text></View>
                  </View>
                  <View style={styles.timeRow}>
                    <View style={styles.timePill}><Feather name="clock" size={13} color={palette.muted} /><Text style={styles.timeText}>{formatShortDateTime(selectedAppointment.startAt)}</Text></View>
                    <View style={styles.timePill}><Feather name="clock" size={13} color={palette.muted} /><Text style={styles.timeText}>{formatShortDateTime(selectedAppointment.checkedInAt)}</Text></View>
                  </View>
                </View>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {role === "TECH" && techShiftOpen === false ? <Text style={styles.errorText}>Chưa mở ca. Mở ca trước khi thanh toán.</Text> : null}
              {checkoutNotice ? <Text style={styles.successText}>{checkoutNotice}</Text> : null}

              <View style={styles.methodRow}>
                {(["CASH", "TRANSFER"] as const).map((method) => {
                  const active = checkoutPaymentMethod === method;
                  return (
                    <Pressable key={method} style={[styles.methodButton, active && styles.methodButtonActive]} onPress={() => setCheckoutPaymentMethod(method)}>
                      <Feather name={method === "CASH" ? "credit-card" : "home"} size={16} color={active ? palette.text : "#7D7066"} />
                      <Text style={[styles.methodText, active && styles.methodTextActive]}>{method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.serviceCard}>
                <Text style={styles.serviceTitle}>Dịch vụ</Text>
                {checkoutLines.map((line, index) => {
                  const filteredServices = activeCheckoutServices.filter((service) => {
                    const query = (serviceQueries[index] ?? "").trim().toLowerCase();
                    return !query || service.name.toLowerCase().includes(query);
                  });
                  return (
                    <View key={`checkout-line-${index}`} style={{ gap: 10 }}>
                      <Pressable style={styles.field} onPress={() => setOpenServicePickerIndex((current) => (current === index ? null : index))}>
                        <Text style={line.serviceId ? styles.fieldValue : styles.fieldPlaceholder}>
                          {activeCheckoutServices.find((service) => service.id === line.serviceId)?.name ?? "Chọn dịch vụ"}
                        </Text>
                        <Feather name="chevron-down" size={18} color={palette.muted} />
                      </Pressable>

                      {openServicePickerIndex === index ? (
                        <View style={{ gap: 8 }}>
                          <View style={styles.searchShell}>
                            <Feather name="search" size={17} color="#A69789" />
                            <TextInput
                              style={styles.searchInput}
                              value={serviceQueries[index] ?? ""}
                              onChangeText={(value) => updateServiceQuery(index, value)}
                              placeholder="Tìm dịch vụ"
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
                              {filteredServices.length === 0 ? <Text style={styles.emptyText}>Không tìm thấy dịch vụ</Text> : null}
                            </View>
                          </ScrollView>
                        </View>
                      ) : null}

                      <View style={styles.quantityBar}>
                        <View style={styles.quantityLeft}>
                          <Text style={styles.quantityLabel}>SL</Text>
                          <View style={styles.quantityControls}>
                            <Pressable style={styles.qtyButton} onPress={() => updateCheckoutQty(index, line.qty - 1)}><Text style={styles.qtyButtonText}>-</Text></Pressable>
                            <View style={styles.qtyValueShell}>
                              <TextInput
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
                          <Text style={styles.addLineText}>Thêm dòng</Text>
                          <Feather name="plus-circle" size={18} color="#8B7C70" />
                        </Pressable>
                      </View>

                      {line.serviceId ? (
                        <View style={styles.selectedRow}>
                          <Text style={styles.selectedName}>{activeCheckoutServices.find((service) => service.id === line.serviceId)?.name ?? "-"}</Text>
                          <Text style={styles.selectedPrice}>{formatVnd((activeCheckoutServices.find((service) => service.id === line.serviceId)?.basePrice ?? 0) * (1 + (activeCheckoutServices.find((service) => service.id === line.serviceId)?.vatRate ?? 0)))}</Text>
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
                    <Text style={styles.totalLabel}>Tổng cộng</Text>
                    <Text style={styles.totalValue}>{checkoutSummary.serviceCount} dịch vụ • {formatVnd(checkoutSummary.total)}</Text>
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
                  style={[styles.primaryButton, (mutating || busyTargetId === selectedAppointment.id || (role === "TECH" && techShiftOpen === false) || !effectiveCheckoutCustomerName.trim() || checkoutSummary.selectedLines.length === 0) && styles.primaryButtonDisabled]}
                  disabled={mutating || busyTargetId === selectedAppointment.id || (role === "TECH" && techShiftOpen === false) || !effectiveCheckoutCustomerName.trim() || checkoutSummary.selectedLines.length === 0}
                  onPress={() => void handleCreateCheckout()}
                >
                  <Text style={styles.primaryButtonText}>{busyTargetId === selectedAppointment.id ? "Đang thanh toán..." : "Thanh toán"}</Text>
                </Pressable>

                <Pressable style={styles.secondaryButton} onPress={() => void router.replace("/(admin)/scheduling")}>
                  <Text style={styles.secondaryButtonText}>Về lịch</Text>
                </Pressable>
                {lastReceiptToken && mobileEnv.apiBaseUrl ? <Pressable style={styles.linkButton} onPress={() => void openReceipt()}><Text style={styles.linkText}>Mở hóa đơn</Text></Pressable> : null}
                {role === "TECH" && techShiftOpen === false ? <Pressable style={styles.linkButton} onPress={() => void router.push("/(admin)/shifts")}><Text style={styles.linkText}>Mở ca</Text></Pressable> : null}
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: getAdminBottomBarPadding(insets.bottom) }]}>
          <AdminBottomNav current="checkout" role={role} onNavigate={(target) => void router.replace(getAdminNavHref(target, role))} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.screen },
  screen: { flex: 1, backgroundColor: palette.screen },
  content: { paddingHorizontal: 22, gap: 16 },
  header: { flexDirection: "row", alignItems: "flex-start" },
  headerTitle: { fontSize: 28, lineHeight: 32, fontWeight: "800", color: palette.text, letterSpacing: -0.6 },
  headerSubtitle: { marginTop: 4, fontSize: 13, lineHeight: 18, color: palette.muted },
  card: { backgroundColor: palette.white, borderRadius: 20, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 14, paddingVertical: 15, gap: 12 },
  cardTitle: { fontSize: 15, lineHeight: 19, fontWeight: "700", color: palette.text },
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
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(255,255,255,0.98)", borderTopWidth: 1, borderTopColor: palette.border, paddingHorizontal: 14, paddingTop: 8 },
});
