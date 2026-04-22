import { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAdminOperations } from "@/src/hooks/use-admin-operations";
import { mobileEnv } from "@/src/lib/env";
import {
  AdminBottomNav,
  AdminScreen,
  createCheckoutKey,
  formatDateTime,
  formatVnd,
  StatusBadge,
  styles,
} from "@/src/features/admin/ui";

export default function AdminCheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ appointmentId?: string }>();
  const {
    appointments,
    checkoutServices,
    createCheckout,
    reload,
    loading,
    role,
    techShiftOpen,
    user,
    busyTargetId,
    error,
    mutating,
  } = useAdminOperations();
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

  const checkedInAppointments = useMemo(
    () => appointments.filter((item) => item.status === "CHECKED_IN"),
    [appointments],
  );

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
      .map((line) => ({
        ...line,
        service: activeCheckoutServices.find((service) => service.id === line.serviceId) ?? null,
      }))
      .filter((line) => line.service && line.qty > 0);

    const total = selectedLines.reduce((sum, line) => {
      const service = line.service;
      if (!service) {
        return sum;
      }
      return sum + service.basePrice * line.qty * (1 + service.vatRate);
    }, 0);

    return { selectedLines, total };
  }, [activeCheckoutServices, checkoutLines]);

  const effectiveCheckoutCustomerName = checkoutCustomerName.trim() || selectedAppointment?.customerName || "";

  function addCheckoutLine() {
    setCheckoutLines((current) => [...current, { serviceId: "", qty: 1 }]);
    setServiceQueries((current) => [...current, ""]);
    setOpenServicePickerIndex(checkoutLines.length);
  }

  function updateCheckoutLine(index: number, patch: Partial<{ serviceId: string; qty: number }>) {
    setCheckoutLines((current) =>
      current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    );
  }

  function removeCheckoutLine(index: number) {
    if (checkoutLines.length === 1) {
      return;
    }

    setCheckoutLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
    setServiceQueries((current) => current.filter((_, lineIndex) => lineIndex !== index));
    setOpenServicePickerIndex((current) => {
      if (current == null) {
        return current;
      }
      if (current === index) {
        return null;
      }
      return current > index ? current - 1 : current;
    });
  }

  function updateServiceQuery(index: number, value: string) {
    setServiceQueries((current) => current.map((query, lineIndex) => (lineIndex === index ? value : query)));
  }

  function updateCheckoutQty(index: number, nextQty: number) {
    const safeQty = Number.isFinite(nextQty) ? Math.max(1, Math.floor(nextQty)) : 1;
    updateCheckoutLine(index, { qty: safeQty });
  }

  async function handleCreateCheckout() {
    if (!selectedAppointment) {
      return;
    }

    const validLines = checkoutLines.filter((line) => line.serviceId && line.qty > 0);
    if (!effectiveCheckoutCustomerName.trim() || validLines.length === 0) {
      return;
    }

    const result = await createCheckout({
      customerName: effectiveCheckoutCustomerName.trim(),
      paymentMethod: checkoutPaymentMethod,
      lines: validLines,
      appointmentId: selectedAppointment.id,
      idempotencyKey: createCheckoutKey(),
    });

    await reload();

    setCheckoutNotice("Da thanh toan.");
    setLastReceiptToken(result?.receiptToken ?? null);
    setCheckoutLines([{ serviceId: "", qty: 1 }]);
    setServiceQueries([""]);
    setOpenServicePickerIndex(0);
    setSelectedAppointmentId(null);
  }

  async function openReceipt() {
    if (!lastReceiptToken || !mobileEnv.apiBaseUrl) {
      return;
    }

    const receiptUrl = new URL(`/receipt/${lastReceiptToken}`, mobileEnv.apiBaseUrl).toString();
    await Linking.openURL(receiptUrl);
  }

  return (
    <AdminScreen
      title="Thanh toan"
      subtitle=""
      role={role}
      userEmail={user?.email}
      compactHeader
      onRefresh={() => {
        void reload();
      }}
      refreshing={loading}
      footer={
        <AdminBottomNav
          current="checkout"
          onNavigate={(target) => {
            void router.replace(`/(admin)/${target}`);
          }}
        />
      }
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Khach dang phuc vu</Text>
        <View style={styles.inlineWrap}>
          {checkedInAppointments.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.inlineChipSelectable, item.id === selectedAppointment?.id ? styles.inlineChipSelectableActive : null]}
              onPress={() => setSelectedAppointmentId(item.id)}
            >
              <Text
                style={[
                  styles.inlineChipSelectableText,
                  item.id === selectedAppointment?.id ? styles.inlineChipSelectableTextActive : null,
                ]}
              >
                {item.customerName}
              </Text>
            </Pressable>
          ))}
        </View>
        {checkedInAppointments.length === 0 ? <Text style={styles.rowMeta}>Khong co khach dang phuc vu</Text> : null}
      </View>

      {selectedAppointment ? (
        <View style={styles.section}>
          <View style={styles.rowHeader}>
            <Text style={styles.sectionTitle}>{selectedAppointment.customerName}</Text>
            <StatusBadge status={selectedAppointment.status} />
          </View>

          <View style={styles.inlineWrap}>
            {selectedAppointment.customerPhone ? (
              <View style={styles.inlineChip}>
                <Text style={styles.inlineChipText}>{selectedAppointment.customerPhone}</Text>
              </View>
            ) : null}
            <View style={styles.inlineChip}>
              <Text style={styles.inlineChipText}>{formatDateTime(selectedAppointment.startAt)}</Text>
            </View>
            {selectedAppointment.checkedInAt ? (
              <View style={styles.inlineChip}>
                <Text style={styles.inlineChipText}>{formatDateTime(selectedAppointment.checkedInAt)}</Text>
              </View>
            ) : null}
          </View>

          {error ? <Text style={styles.warningText}>{error}</Text> : null}
          {role === "TECH" && techShiftOpen === false ? (
            <Text style={styles.warningText}>Chua mo ca. Mo ca truoc khi thanh toan.</Text>
          ) : null}
          {checkoutNotice ? <Text style={styles.successText}>{checkoutNotice}</Text> : null}

          <View style={styles.inlineWrap}>
            {(["CASH", "TRANSFER"] as const).map((method) => (
              <Pressable
                key={method}
                style={[styles.inlineChipSelectable, checkoutPaymentMethod === method ? styles.inlineChipSelectableActive : null]}
                onPress={() => setCheckoutPaymentMethod(method)}
              >
                <Text
                  style={[
                    styles.inlineChipSelectableText,
                    checkoutPaymentMethod === method ? styles.inlineChipSelectableTextActive : null,
                  ]}
                >
                  {method === "CASH" ? "Tien mat" : "Chuyen khoan"}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.sectionSubCard}>
            <Text style={styles.sectionSubtitle}>Dich vu</Text>

            {checkoutLines.map((line, index) => (
              <View key={`checkout-line-${index}`} style={styles.sectionSubCard}>
                <Pressable
                  style={[styles.input, { justifyContent: "center" }]}
                  onPress={() => setOpenServicePickerIndex((current) => (current === index ? null : index))}
                >
                  <Text style={line.serviceId ? { color: "#2b1d12" } : styles.rowMeta}>
                    {activeCheckoutServices.find((service) => service.id === line.serviceId)?.name ?? "Chon dich vu"}
                  </Text>
                </Pressable>

                {openServicePickerIndex === index ? (
                  <View style={styles.sectionSubCard}>
                    <TextInput
                      style={styles.input}
                      value={serviceQueries[index] ?? ""}
                      onChangeText={(value) => updateServiceQuery(index, value)}
                      placeholder="Tim dich vu"
                      placeholderTextColor="#9d8a79"
                    />
                    <View
                      style={{
                        maxHeight: 240,
                        borderWidth: 1,
                        borderColor: "#eadbc8",
                        borderRadius: 16,
                        overflow: "hidden",
                        backgroundColor: "#fffaf5",
                      }}
                    >
                      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                        <View style={{ gap: 8, padding: 8 }}>
                          {activeCheckoutServices.filter((service) => {
                          const query = (serviceQueries[index] ?? "").trim().toLowerCase();
                          if (!query) {
                            return true;
                          }
                          return service.name.toLowerCase().includes(query);
                        }).map((service) => (
                            <Pressable
                              key={`${index}-${service.id}`}
                              style={[
                                styles.listRow,
                                line.serviceId === service.id ? styles.inlineChipSelectableActive : null,
                              ]}
                              onPress={() => {
                                updateCheckoutLine(index, { serviceId: service.id });
                                updateServiceQuery(index, service.name);
                                setOpenServicePickerIndex(null);
                              }}
                            >
                              <View style={styles.rowHeader}>
                                <Text
                                  style={[
                                    styles.rowTitle,
                                    line.serviceId === service.id ? styles.inlineChipSelectableTextActive : null,
                                  ]}
                                >
                                  {service.name}
                                </Text>
                                <Text
                                  style={[
                                    styles.rowMeta,
                                    line.serviceId === service.id ? styles.inlineChipSelectableTextActive : null,
                                  ]}
                                >
                                  {formatVnd(service.basePrice * (1 + service.vatRate))}
                                </Text>
                              </View>
                            </Pressable>
                          ))}
                          {activeCheckoutServices.filter((service) => {
                            const query = (serviceQueries[index] ?? "").trim().toLowerCase();
                            if (!query) {
                              return true;
                            }
                            return service.name.toLowerCase().includes(query);
                          }).length === 0 ? <Text style={styles.rowMeta}>Khong tim thay dich vu</Text> : null}
                        </View>
                      </ScrollView>
                    </View>
                  </View>
                ) : null}

                <View style={[styles.quickRow, { alignItems: "center", justifyContent: "space-between" }]}>
                  <Text style={styles.fieldTitle}>So luong</Text>
                  <View style={[styles.quickRow, { alignItems: "center" }]}>
                    <Pressable style={styles.inlineAction} onPress={() => updateCheckoutQty(index, line.qty - 1)}>
                      <Text style={styles.inlineActionText}>-</Text>
                    </Pressable>
                    <View style={{ width: 72 }}>
                      <TextInput
                        style={styles.input}
                        value={String(line.qty || 1)}
                        onChangeText={(value) => updateCheckoutQty(index, Number(value || "1"))}
                        keyboardType="number-pad"
                        placeholder="1"
                        placeholderTextColor="#9d8a79"
                      />
                    </View>
                    <Pressable style={styles.inlineAction} onPress={() => updateCheckoutQty(index, line.qty + 1)}>
                      <Text style={styles.inlineActionText}>+</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={[styles.quickRow, { justifyContent: "space-between" }]}>
                  {checkoutLines.length > 1 ? (
                    <Pressable style={styles.secondaryButton} onPress={() => removeCheckoutLine(index)}>
                      <Text style={styles.secondaryButtonText}>Bo dong</Text>
                    </Pressable>
                  ) : <View />}
                  <Pressable style={styles.inlineAction} onPress={addCheckoutLine}>
                    <Text style={styles.inlineActionText}>Them dong</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.sectionSubCard}>
            <Text style={styles.detailLine}>
              {checkoutSummary.selectedLines.length} dich vu - {formatVnd(checkoutSummary.total)}
            </Text>
            {checkoutSummary.selectedLines.map((line, index) => (
              <Text key={`checkout-summary-${index}`} style={styles.detailLine}>
                {(line.service?.name ?? "-")} x{line.qty}
              </Text>
            ))}
          </View>

          <Pressable
            style={styles.primaryButton}
            disabled={
              mutating ||
              busyTargetId === selectedAppointment.id ||
              (role === "TECH" && techShiftOpen === false) ||
              !effectiveCheckoutCustomerName.trim() ||
              checkoutSummary.selectedLines.length === 0
            }
            onPress={() => void handleCreateCheckout()}
          >
            <Text style={styles.primaryButtonText}>
              {busyTargetId === selectedAppointment.id ? "Dang thanh toan..." : "Thanh toan"}
            </Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => void router.replace("/(admin)/scheduling")}>
            <Text style={styles.secondaryButtonText}>Ve lich</Text>
          </Pressable>

          {lastReceiptToken && mobileEnv.apiBaseUrl ? (
            <Pressable style={styles.secondaryButton} onPress={() => void openReceipt()}>
              <Text style={styles.secondaryButtonText}>Mo hoa don</Text>
            </Pressable>
          ) : null}

          {role === "TECH" && techShiftOpen === false ? (
            <Pressable style={styles.secondaryButton} onPress={() => void router.replace("/(admin)/shifts")}>
              <Text style={styles.secondaryButtonText}>Mo ca</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </AdminScreen>
  );
}
