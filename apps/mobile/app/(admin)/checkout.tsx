import { useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { useAdminOperations } from "@/src/hooks/use-admin-operations";
import {
  AdminScreen,
  createCheckoutKey,
  formatDateTime,
  formatVnd,
  InfoTile,
  SectionTitleRow,
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
    recentTickets,
    role,
    techShiftOpen,
    user,
    busyTargetId,
    error,
    loading,
    mutating,
    reload,
  } = useAdminOperations();
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [checkoutCustomerName, setCheckoutCustomerName] = useState("");
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [checkoutLines, setCheckoutLines] = useState<Array<{ serviceId: string; qty: number }>>([{ serviceId: "", qty: 1 }]);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const requestedAppointmentId = Array.isArray(params.appointmentId) ? params.appointmentId[0] : params.appointmentId;

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
  const quickCheckoutServices = useMemo(
    () => activeCheckoutServices.filter((item) => item.featuredInLookbook).slice(0, 6),
    [activeCheckoutServices],
  );
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

    return {
      selectedLines,
      total,
    };
  }, [activeCheckoutServices, checkoutLines]);
  const effectiveCheckoutCustomerName = checkoutCustomerName.trim() || selectedAppointment?.customerName || "";

  function addCheckoutLine() {
    setCheckoutLines((current) => [...current, { serviceId: "", qty: 1 }]);
  }

  function updateCheckoutLine(index: number, patch: Partial<{ serviceId: string; qty: number }>) {
    setCheckoutLines((current) =>
      current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    );
  }

  function removeCheckoutLine(index: number) {
    setCheckoutLines((current) => (current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index)));
  }

  function addQuickCheckoutService(serviceId: string) {
    setCheckoutLines((current) => {
      const existingIndex = current.findIndex((line) => line.serviceId === serviceId);
      if (existingIndex >= 0) {
        return current.map((line, lineIndex) =>
          lineIndex === existingIndex ? { ...line, qty: line.qty + 1 } : line,
        );
      }

      const firstEmptyIndex = current.findIndex((line) => !line.serviceId);
      if (firstEmptyIndex >= 0) {
        return current.map((line, lineIndex) => (lineIndex === firstEmptyIndex ? { serviceId, qty: 1 } : line));
      }

      return [...current, { serviceId, qty: 1 }];
    });
  }

  async function handleCreateCheckout() {
    if (!selectedAppointment) {
      return;
    }

    const validLines = checkoutLines.filter((line) => line.serviceId && line.qty > 0);
    if (!effectiveCheckoutCustomerName.trim() || validLines.length === 0) {
      return;
    }

    await createCheckout({
      customerName: effectiveCheckoutCustomerName.trim(),
      paymentMethod: checkoutPaymentMethod,
      lines: validLines,
      appointmentId: selectedAppointment.id,
      idempotencyKey: createCheckoutKey(),
    });

    setCheckoutNotice("Da thanh toan thanh cong.");
    setCheckoutLines([{ serviceId: "", qty: 1 }]);
  }

  return (
    <AdminScreen
      title="Thanh toan"
      subtitle="Mang logic checkout tu web sang mobile de staff dong bill tu lich da check-in, kiem tra mo ca va theo doi bill gan day ngay trong menu van hanh."
      role={role}
      userEmail={user?.email}
    >
      <View style={styles.section}>
        <SectionTitleRow
          title="Trang thai checkout"
          actionLabel={loading || mutating ? "Dang tai..." : "Tai lai"}
          onActionPress={() => void reload()}
          actionDisabled={loading || mutating}
        />
        <Text style={styles.sectionBody}>
          {error ??
            (selectedAppointment
              ? "Chon dich vu, phuong thuc thanh toan va dong bill."
              : "Chua co lich check-in nao san sang checkout.")}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Lich da check-in</Text>
        {checkedInAppointments.map((item) => (
          <Pressable
            key={item.id}
            style={[styles.listRow, item.id === selectedAppointment?.id ? styles.listRowActive : null]}
            onPress={() => setSelectedAppointmentId(item.id)}
          >
            <View style={styles.rowHeader}>
              <Text style={styles.rowTitle}>{item.customerName}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.rowMeta}>{formatDateTime(item.startAt)}</Text>
          </Pressable>
        ))}
        {checkedInAppointments.length === 0 ? <Text style={styles.sectionBody}>Khong co lich check-in nao.</Text> : null}
      </View>

      {selectedAppointment ? (
        <View style={styles.section}>
          <View style={styles.rowHeader}>
            <Text style={styles.sectionTitle}>Chi tiet checkout</Text>
            <StatusBadge status={selectedAppointment.status} />
          </View>

          <View style={styles.infoGrid}>
            <InfoTile label="Khach" value={selectedAppointment.customerName} />
            <InfoTile label="So dien thoai" value={selectedAppointment.customerPhone ?? "-"} />
            <InfoTile label="Bat dau" value={formatDateTime(selectedAppointment.startAt)} />
            <InfoTile label="Check-in" value={selectedAppointment.checkedInAt ? formatDateTime(selectedAppointment.checkedInAt) : "-"} />
          </View>

          {role === "TECH" && techShiftOpen === false ? (
            <Text style={styles.warningText}>Chua mo ca. Ky thuat vien can mo Ca lam truoc khi thanh toan.</Text>
          ) : null}
          {checkoutNotice ? <Text style={styles.successText}>{checkoutNotice}</Text> : null}

          <Text style={styles.fieldTitle}>Ten khach tren bill</Text>
          <TextInput
            style={styles.input}
            value={checkoutCustomerName}
            onChangeText={setCheckoutCustomerName}
            placeholder={selectedAppointment.customerName}
            placeholderTextColor="#9d8a79"
          />

          <Text style={styles.fieldTitle}>Phuong thuc thanh toan</Text>
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

          {quickCheckoutServices.length > 0 ? (
            <>
              <Text style={styles.fieldTitle}>Them nhanh dich vu</Text>
              <View style={styles.inlineWrap}>
                {quickCheckoutServices.map((service) => (
                  <Pressable key={service.id} style={styles.inlineAction} onPress={() => addQuickCheckoutService(service.id)}>
                    <Text style={styles.inlineActionText}>{service.name}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <View style={styles.sectionSubCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionSubtitle}>Dich vu checkout</Text>
              <Pressable style={styles.inlineAction} onPress={addCheckoutLine}>
                <Text style={styles.inlineActionText}>Them dong</Text>
              </Pressable>
            </View>

            {checkoutLines.map((line, index) => (
              <View key={`checkout-line-${index}`} style={styles.sectionSubCard}>
                <Text style={styles.fieldTitle}>Dich vu</Text>
                <View style={styles.inlineWrap}>
                  {activeCheckoutServices.slice(0, 12).map((service) => (
                    <Pressable
                      key={`${index}-${service.id}`}
                      style={[styles.inlineChipSelectable, line.serviceId === service.id ? styles.inlineChipSelectableActive : null]}
                      onPress={() => updateCheckoutLine(index, { serviceId: service.id })}
                    >
                      <Text
                        style={[
                          styles.inlineChipSelectableText,
                          line.serviceId === service.id ? styles.inlineChipSelectableTextActive : null,
                        ]}
                      >
                        {service.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.inlineWrap}>
                  {[1, 2, 3].map((qty) => (
                    <Pressable
                      key={`${index}-qty-${qty}`}
                      style={[styles.inlineChipSelectable, line.qty === qty ? styles.inlineChipSelectableActive : null]}
                      onPress={() => updateCheckoutLine(index, { qty })}
                    >
                      <Text
                        style={[
                          styles.inlineChipSelectableText,
                          line.qty === qty ? styles.inlineChipSelectableTextActive : null,
                        ]}
                      >
                        SL {qty}
                      </Text>
                    </Pressable>
                  ))}
                  {checkoutLines.length > 1 ? (
                    <Pressable style={styles.secondaryButton} onPress={() => removeCheckoutLine(index)}>
                      <Text style={styles.secondaryButtonText}>Bo dong</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.sectionSubCard}>
            <Text style={styles.sectionSubtitle}>Tom tat bill</Text>
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
              {busyTargetId === selectedAppointment.id ? "Dang thanh toan..." : "Thanh toan va dong bill"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              if (!selectedAppointment) {
                return;
              }
              void router.push({ pathname: "/(admin)/scheduling", params: { filter: "CHECKED_IN" } });
            }}
          >
            <Text style={styles.secondaryButtonText}>Mo lai Dieu phoi lich</Text>
          </Pressable>

          {role === "TECH" && techShiftOpen === false ? (
            <Pressable style={styles.secondaryButton} onPress={() => void router.push("/(admin)/shifts")}>
              <Text style={styles.secondaryButtonText}>Mo man Ca lam</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bill gan day</Text>
        {recentTickets.slice(0, 4).map((ticket) => (
          <View key={ticket.id} style={styles.ticketRow}>
            <View style={styles.ticketMeta}>
              <Text style={styles.ticketCustomer}>{ticket.customerName ?? "Khach le"}</Text>
              <Text style={styles.ticketDate}>{formatDateTime(ticket.createdAt)}</Text>
            </View>
            <Text style={styles.ticketTotal}>{formatVnd(ticket.grandTotal)}</Text>
          </View>
        ))}
        {recentTickets.length === 0 ? <Text style={styles.detailLine}>Chua co bill nao gan day.</Text> : null}
      </View>
    </AdminScreen>
  );
}
