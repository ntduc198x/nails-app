import Feather from "@expo/vector-icons/Feather";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  getCrmDashboardMetricsForMobile,
  listCustomersCrmForMobile,
  listSafeCustomerDuplicateCandidatesForMobile,
  mergeCustomerRecordsForMobile,
  type CrmDashboardMetrics,
  type CustomerCrmSummary,
  type CustomerStatus,
  type SafeCustomerDuplicateCandidate,
} from "@nails/shared";
import { ManageScreenShell, manageStyles, useManageRouteAccess } from "@/src/features/admin/manage-ui";
import { mobileSupabase } from "@/src/lib/supabase";
import { useAdminKeyboardFieldFocus } from "@/src/features/admin/ui";

const palette = {
  border: "#EADFD3",
  text: "#2F241D",
  sub: "#84776C",
  accent: "#A56D3D",
  accentSoft: "#F3E7DA",
  success: "#20B283",
  successSoft: "#E8F8F2",
  info: "#7A69E8",
  infoSoft: "#F1EEFF",
  warning: "#F2A23A",
  warningSoft: "#FFF3E2",
  danger: "#EF6D7D",
  dangerSoft: "#FDECF1",
  mutedSoft: "#F8F4EF",
};

const STATUS_OPTIONS: Array<{ label: string; value: CustomerStatus | "ALL" }> = [
  { label: "Tất cả trạng thái", value: "ALL" },
  { label: "Mới", value: "NEW" },
  { label: "Đang hoạt động", value: "ACTIVE" },
  { label: "Quay lại", value: "RETURNING" },
  { label: "VIP", value: "VIP" },
  { label: "Có nguy cơ", value: "AT_RISK" },
  { label: "Rời bỏ", value: "LOST" },
];

const DORMANT_DAY_OPTIONS = [
  { label: "7 ngày gần nhất", value: 7 },
  { label: "30 ngày gần nhất", value: 30 },
  { label: "60 ngày gần nhất", value: 60 },
  { label: "90 ngày gần nhất", value: 90 },
];

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatDateLabel(value: string | null) {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function statusLabel(status: CustomerStatus) {
  if (status === "NEW") return "Khách mới";
  if (status === "ACTIVE") return "Đã ghé tiệm";
  if (status === "RETURNING") return "Thường xuyên tới";
  if (status === "VIP") return "VIP";
  if (status === "AT_RISK") return "Có nguy cơ";
  return "Cần chăm sóc";
}

function statusTone(status: CustomerStatus) {
  if (status === "VIP") {
    return { soft: "#FFF4D8", text: "#C58618" };
  }
  if (status === "RETURNING") {
    return { soft: "#E8F8F2", text: "#20B283" };
  }
  if (status === "ACTIVE") {
    return { soft: "#EAF1FF", text: "#4B7BEC" };
  }
  if (status === "AT_RISK") {
    return { soft: "#FFF3E2", text: "#E79937" };
  }
  if (status === "LOST") {
    return { soft: "#FDECF1", text: "#D65C73" };
  }
  return { soft: "#EEF5FF", text: "#5D86C8" };
}

function metricCardTone(kind: "new" | "returning" | "risk" | "repeat") {
  if (kind === "new") return { soft: palette.infoSoft, icon: palette.info };
  if (kind === "returning") return { soft: palette.successSoft, icon: palette.success };
  if (kind === "risk") return { soft: palette.warningSoft, icon: palette.warning };
  return { soft: palette.dangerSoft, icon: palette.danger };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "KH";
  return parts.slice(-2).map((part) => part.charAt(0).toUpperCase()).join("");
}

function sourceLabel(source: string | null) {
  if (!source) return "walk-in";
  return source;
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  const handleFieldFocus = useAdminKeyboardFieldFocus();

  return (
    <TextInput
      {...props}
      onFocus={(event) => {
        handleFieldFocus(event);
        props.onFocus?.(event);
      }}
      placeholderTextColor="#B5A99D"
      style={[styles.input, props.style]}
    />
  );
}

function MetricCard({
  icon,
  kind,
  label,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  kind: "new" | "returning" | "risk" | "repeat";
  label: string;
  value: string;
}) {
  const tone = metricCardTone(kind);
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricRow}>
        <View style={[styles.metricIcon, { backgroundColor: tone.soft }]}>
          <Feather name={icon} size={15} color={tone.icon} />
        </View>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function SelectField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.selectField} onPress={onPress}>
      <Text style={[styles.selectValue, !value ? styles.selectPlaceholder : null]} numberOfLines={1}>
        {value || label}
      </Text>
      <Feather name="chevron-down" size={16} color={palette.sub} />
    </Pressable>
  );
}

function OptionSheet<T extends string | number>({
  options,
  title,
  onClose,
  onSelect,
  selected,
  visible,
}: {
  options: Array<{ label: string; value: T }>;
  title: string;
  onClose: () => void;
  onSelect: (value: T) => void;
  selected: T;
  visible: boolean;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable style={styles.modalCloseButton} onPress={onClose}>
              <Feather name="x" size={18} color={palette.text} />
            </Pressable>
          </View>
          <View style={styles.modalList}>
            {options.map((option) => {
              const active = option.value === selected;
              return (
                <Pressable
                  key={String(option.value)}
                  style={[styles.modalOption, active ? styles.modalOptionActive : null]}
                  onPress={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                >
                  <Text style={[styles.modalOptionText, active ? styles.modalOptionTextActive : null]}>
                    {option.label}
                  </Text>
                  {active ? <Feather name="check" size={16} color={palette.accent} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CustomerRow({
  item,
  onPress,
}: {
  item: CustomerCrmSummary;
  onPress: () => void;
}) {
  const tone = statusTone(item.customerStatus);

  return (
    <Pressable style={styles.customerRow} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(item.fullName)}</Text>
      </View>

      <View style={styles.customerCopy}>
        <View style={styles.customerTitleRow}>
          <Text style={styles.customerName} numberOfLines={1}>
            {item.fullName}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: tone.soft }]}>
            <Text style={[styles.statusBadgeText, { color: tone.text }]}>{statusLabel(item.customerStatus)}</Text>
          </View>
        </View>

        <View style={styles.customerMetaRow}>
          <Text style={styles.phonePill}>{item.phone ?? "Chưa có số"}</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>{item.totalVisits} lượt</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>{formatVnd(item.totalSpend)} đ</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>{sourceLabel(item.source)}</Text>
        </View>
      </View>

      <Feather name="chevron-right" size={18} color="#B8AA9B" />
    </Pressable>
  );
}

function dedupeCustomerRowsForRender(rows: CustomerCrmSummary[]) {
  const byId = new Map<string, CustomerCrmSummary>();

  for (const row of rows) {
    if (!byId.has(row.id)) {
      byId.set(row.id, row);
    }
  }

  return Array.from(byId.values());
}

function normalizeDuplicateCandidatesForRender(candidates: SafeCustomerDuplicateCandidate[]) {
  const grouped = new Map<string, SafeCustomerDuplicateCandidate>();

  for (const candidate of candidates) {
    const key = `${candidate.matchType}:${candidate.matchValue}:${candidate.canonicalCustomerId}`;
    const duplicateCustomerIds = [...new Set(candidate.duplicateCustomerIds.filter(Boolean))];
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        ...candidate,
        duplicateCustomerIds,
        duplicateCount: duplicateCustomerIds.length + 1,
      });
      continue;
    }

    const mergedIds = [...new Set([...existing.duplicateCustomerIds, ...duplicateCustomerIds])];
    grouped.set(key, {
      ...existing,
      duplicateCustomerIds: mergedIds,
      duplicateCount: mergedIds.length + 1,
      reason: existing.reason || candidate.reason,
    });
  }

  return Array.from(grouped.values());
}

export default function AdminManageCustomersScreen() {
  const { isHydrated, allowed } = useManageRouteAccess(["OWNER", "PARTNER", "MANAGER", "RECEPTION"]);
  const [rows, setRows] = useState<CustomerCrmSummary[]>([]);
  const [allRows, setAllRows] = useState<CustomerCrmSummary[]>([]);
  const [duplicateCandidates, setDuplicateCandidates] = useState<SafeCustomerDuplicateCandidate[]>([]);
  const [mergingPairKey, setMergingPairKey] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<CrmDashboardMetrics>({
    newToday: 0,
    returningToday: 0,
    atRiskCount: 0,
    repeat30: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CustomerStatus | "ALL">("ALL");
  const [source, setSource] = useState<string | "ALL">("ALL");
  const [vipOnly, setVipOnly] = useState(false);
  const [dormantDays, setDormantDays] = useState(30);
  const [showStatusSheet, setShowStatusSheet] = useState(false);
  const [showSourceSheet, setShowSourceSheet] = useState(false);
  const [showDormantSheet, setShowDormantSheet] = useState(false);
  const [customerListExpanded, setCustomerListExpanded] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (!mobileSupabase) {
      setError("Thiếu cấu hình Supabase mobile.");
      setLoading(false);
      return;
    }

    try {
      if (force || !rows.length) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      const [filteredRows, customers, dashboard, duplicates] = await Promise.all([
        listCustomersCrmForMobile(mobileSupabase, {
          search,
          status,
          source,
          vipOnly,
          dormantDays,
        }),
        listCustomersCrmForMobile(mobileSupabase),
        getCrmDashboardMetricsForMobile(mobileSupabase),
        listSafeCustomerDuplicateCandidatesForMobile(mobileSupabase).catch(() => []),
      ]);

      setRows(dedupeCustomerRowsForRender(filteredRows));
      setAllRows(dedupeCustomerRowsForRender(customers));
      setMetrics(dashboard);
      setDuplicateCandidates(normalizeDuplicateCandidatesForRender(duplicates));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không tải được CRM khách.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dormantDays, rows.length, search, source, status, vipOnly]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void load(true);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [load]);

  const sourceOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const item of allRows) {
      if (item.source) {
        unique.add(item.source);
      }
    }

    return [
      { label: "Tất cả nguồn", value: "ALL" },
      ...Array.from(unique).sort().map((item) => ({ label: item, value: item })),
    ];
  }, [allRows]);

  const selectedStatusLabel = useMemo(
    () => STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "Tất cả trạng thái",
    [status],
  );
  const selectedSourceLabel = useMemo(
    () => sourceOptions.find((option) => option.value === source)?.label ?? "Tất cả nguồn",
    [source, sourceOptions],
  );
  const selectedDormantLabel = useMemo(
    () => DORMANT_DAY_OPTIONS.find((option) => option.value === dormantDays)?.label ?? `${dormantDays} ngày`,
    [dormantDays],
  );

  const renderRows = useMemo(() => dedupeCustomerRowsForRender(rows), [rows]);

  const safeEmailPreviewCount = useMemo(
    () => duplicateCandidates.filter((candidate) => candidate.matchType === "EMAIL").length,
    [duplicateCandidates],
  );
  const safePhonePreviewCount = useMemo(
    () => duplicateCandidates.filter((candidate) => candidate.matchType === "PHONE").length,
    [duplicateCandidates],
  );
  const selectedCustomer = useMemo(
    () => allRows.find((item) => item.id === selectedCustomerId) ?? null,
    [allRows, selectedCustomerId],
  );

  async function handleMergeDuplicate(candidate: SafeCustomerDuplicateCandidate, duplicateCustomerId: string) {
    if (!mobileSupabase) {
      return;
    }

    const pairKey = `${candidate.canonicalCustomerId}:${duplicateCustomerId}`;
    try {
      setMergingPairKey(pairKey);
      await mergeCustomerRecordsForMobile(mobileSupabase, {
        canonicalCustomerId: candidate.canonicalCustomerId,
        duplicateCustomerId,
        reason: `MANUAL_${candidate.matchType}_MERGE`,
      });
      Alert.alert("Đã merge", "Đã gộp hồ sơ trùng và làm mới danh sách.");
      await load(true);
    } catch (mergeError) {
      Alert.alert(
        "Không merge được",
        mergeError instanceof Error ? mergeError.message : "Merge thất bại.",
      );
    } finally {
      setMergingPairKey(null);
    }
  }

  if (!isHydrated || !allowed) {
    return <View style={manageStyles.loadingState} />;
  }

  return (
    <ManageScreenShell
      title="CRM khách"
      subtitle="Theo dõi khách mới, khách quay lại, tệp có nguy cơ rời bỏ và khách VIP."
      currentKey="customers"
      group="insights"
      showBackButton={false}
    >

      <View style={styles.metricGrid}>
        <MetricCard icon="users" kind="new" label="Khách mới hôm nay" value={String(metrics.newToday)} />
        <MetricCard icon="refresh-cw" kind="returning" label="Khách quay lại" value={String(metrics.returningToday)} />
        <MetricCard icon="alert-triangle" kind="risk" label="Có nguy cơ rời bỏ" value={String(metrics.atRiskCount)} />
        <MetricCard icon="trending-up" kind="repeat" label="Repeat rate 30 ngày" value={`${metrics.repeat30}%`} />
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleWrap}>
            <View style={styles.sectionIcon}>
              <Feather name="filter" size={15} color={palette.accent} />
            </View>
            <Text style={styles.sectionTitle}>Bộ lọc CRM</Text>
          </View>
          <Pressable style={styles.refreshButton} onPress={() => void load(true)}>
            {refreshing ? (
              <ActivityIndicator size="small" color={palette.accent} />
            ) : (
              <>
                <Feather name="rotate-cw" size={14} color={palette.sub} />
                <Text style={styles.refreshButtonText}>Làm mới</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.filterGrid}>
          <SelectField label="Tất cả trạng thái" value={selectedStatusLabel} onPress={() => setShowStatusSheet(true)} />
          <SelectField label="Tất cả nguồn" value={selectedSourceLabel} onPress={() => setShowSourceSheet(true)} />
          <SelectField label="30 ngày gần nhất" value={selectedDormantLabel} onPress={() => setShowDormantSheet(true)} />
          <Pressable style={styles.vipField} onPress={() => setVipOnly((current) => !current)}>
            <View style={[styles.checkbox, vipOnly ? styles.checkboxActive : null]}>
              {vipOnly ? <Feather name="check" size={12} color="#FFFFFF" /> : null}
            </View>
            <Text style={styles.vipFieldText}>Chỉ khách VIP</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleWrap}>
            <View style={styles.sectionIcon}>
              <Feather name="git-merge" size={15} color={palette.accent} />
            </View>
            <Text style={styles.sectionTitle}>Rà hồ sơ trùng an toàn</Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{duplicateCandidates.length} nhóm</Text>
          </View>
        </View>

        <View style={styles.duplicateSummaryRow}>
          <View style={styles.duplicateSummaryCard}>
            <Text style={styles.duplicateSummaryLabel}>Safe email</Text>
            <Text style={styles.duplicateSummaryValue}>{safeEmailPreviewCount}</Text>
          </View>
          <View style={styles.duplicateSummaryCard}>
            <Text style={styles.duplicateSummaryLabel}>Safe phone</Text>
            <Text style={styles.duplicateSummaryValue}>{safePhonePreviewCount}</Text>
          </View>
        </View>

        {duplicateCandidates.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Hiện chưa có nhóm hồ sơ nào đủ điều kiện merge an toàn.</Text>
          </View>
        ) : (
          <View style={styles.listStack}>
            {duplicateCandidates.slice(0, 8).map((candidate, candidateIndex) => (
              <View
                key={`${candidate.matchType}:${candidate.matchValue}:${candidate.canonicalCustomerId}:${candidateIndex}`}
                style={styles.duplicateCard}
              >
                <View style={styles.duplicateHeader}>
                  <Text style={styles.duplicateTitle}>{candidate.matchType} · {candidate.matchValue}</Text>
                  <Text style={styles.duplicateMeta}>{candidate.duplicateCount} hồ sơ</Text>
                </View>
                <Text style={styles.duplicateHint}>Bản chính: {candidate.canonicalCustomerId.slice(0, 8)}…</Text>
                <Text style={styles.duplicateHint}>Rule: {candidate.reason}</Text>
                <View style={styles.duplicateActions}>
                  {candidate.duplicateCustomerIds.slice(0, 3).map((duplicateId, duplicateIndex) => {
                    const busyKey = `${candidate.canonicalCustomerId}:${duplicateId}`;
                    const renderKey = `${busyKey}:${duplicateIndex}`;
                    const busy = mergingPairKey === busyKey;
                    return (
                      <Pressable
                        key={renderKey}
                        style={[styles.mergeButton, busy ? styles.mergeButtonDisabled : null]}
                        disabled={busy}
                        onPress={() => void handleMergeDuplicate(candidate, duplicateId)}
                      >
                        {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.mergeButtonText}>Merge {duplicateId.slice(0, 8)}…</Text>}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleWrap}>
            <View style={styles.sectionIcon}>
              <Feather name="users" size={15} color={palette.accent} />
            </View>
            <Text style={styles.sectionTitle}>Danh sách khách</Text>
          </View>
          <View style={styles.headerActions}>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{renderRows.length} khách</Text>
            </View>
            <Pressable
              style={styles.collapseButton}
              onPress={() => setCustomerListExpanded((current) => !current)}
            >
              <Feather
                name={customerListExpanded ? "chevron-up" : "chevron-down"}
                size={16}
                color={palette.sub}
              />
              <Text style={styles.collapseButtonText}>
                {customerListExpanded ? "Thu gọn" : "Mở rộng"}
              </Text>
            </Pressable>
          </View>
        </View>

        {customerListExpanded ? (
          <>
            <View style={styles.searchRow}>
              <View style={styles.searchInputWrap}>
                <Feather name="search" size={15} color="#A99B8D" />
                <Input
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Tìm theo tên, số điện thoại..."
                  style={styles.searchInput}
                />
              </View>
              <Pressable style={styles.filterButton} onPress={() => setShowStatusSheet(true)}>
                <Feather name="sliders" size={15} color={palette.accent} />
              </Pressable>
            </View>

            {error ? (
              <View style={styles.errorCard}>
                <Feather name="alert-circle" size={16} color="#C66043" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {loading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="small" color={palette.accent} />
                <Text style={styles.emptyText}>Đang tải danh sách khách...</Text>
              </View>
            ) : renderRows.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Không có khách nào khớp bộ lọc hiện tại.</Text>
              </View>
            ) : (
              <View style={styles.listStack}>
                {renderRows.map((item, index) => (
                  <CustomerRow
                    key={`${item.id}:${index}`}
                    item={item}
                    onPress={() => setSelectedCustomerId(item.id)}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={styles.collapsedSummary}>
            <Feather name="minimize-2" size={15} color={palette.sub} />
            <Text style={styles.collapsedSummaryText}>
              Danh sách khách đang được thu gọn. Bấm mở rộng để xem và chọn chi tiết.
            </Text>
          </View>
        )}
      </View>

      <OptionSheet
        title="Chọn trạng thái"
        options={STATUS_OPTIONS}
        selected={status}
        visible={showStatusSheet}
        onClose={() => setShowStatusSheet(false)}
        onSelect={setStatus}
      />
      <OptionSheet
        title="Chọn nguồn khách"
        options={sourceOptions}
        selected={source}
        visible={showSourceSheet}
        onClose={() => setShowSourceSheet(false)}
        onSelect={setSource}
      />
      <OptionSheet
        title="Chọn khoảng theo dõi"
        options={DORMANT_DAY_OPTIONS}
        selected={dormantDays}
        visible={showDormantSheet}
        onClose={() => setShowDormantSheet(false)}
        onSelect={setDormantDays}
      />
      <Modal
        transparent
        animationType="fade"
        visible={Boolean(selectedCustomer)}
        onRequestClose={() => setSelectedCustomerId(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedCustomerId(null)}>
          <Pressable style={styles.detailModalCard} onPress={() => {}}>
            {selectedCustomer ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.detailHeaderCopy}>
                    <Text style={styles.modalTitle}>{selectedCustomer.fullName}</Text>
                    <Text style={styles.detailSubtitle}>
                      {statusLabel(selectedCustomer.customerStatus)} · {sourceLabel(selectedCustomer.source)}
                    </Text>
                  </View>
                  <Pressable style={styles.modalCloseButton} onPress={() => setSelectedCustomerId(null)}>
                    <Feather name="x" size={18} color={palette.text} />
                  </Pressable>
                </View>

                <View style={styles.detailGrid}>
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Số điện thoại</Text>
                    <Text style={styles.detailValue}>{selectedCustomer.phone ?? "Chưa cập nhật"}</Text>
                  </View>
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Sinh nhật</Text>
                    <Text style={styles.detailValue}>{formatDateLabel(selectedCustomer.birthday)}</Text>
                  </View>
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Lượt ghé</Text>
                    <Text style={styles.detailValue}>{selectedCustomer.totalVisits}</Text>
                  </View>
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Tổng chi</Text>
                    <Text style={styles.detailValue}>{formatVnd(selectedCustomer.totalSpend)} đ</Text>
                  </View>
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Lần đầu</Text>
                    <Text style={styles.detailValue}>{formatDateLabel(selectedCustomer.firstVisitAt)}</Text>
                  </View>
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Lần gần nhất</Text>
                    <Text style={styles.detailValue}>{formatDateLabel(selectedCustomer.lastVisitAt)}</Text>
                  </View>
                </View>

                <View style={styles.detailBlock}>
                  <Text style={styles.detailBlockLabel}>Dịch vụ gần nhất</Text>
                  <Text style={styles.detailBlockValue}>
                    {selectedCustomer.lastServiceSummary ?? "Chưa có dữ liệu"}
                  </Text>
                </View>

                <View style={styles.detailBlock}>
                  <Text style={styles.detailBlockLabel}>Ghi chú / care note</Text>
                  <Text style={styles.detailBlockValue}>
                    {selectedCustomer.careNote ?? "Chưa có ghi chú chăm sóc"}
                  </Text>
                </View>

                <View style={styles.detailFooterRow}>
                  <View style={styles.detailMetaPill}>
                    <Text style={styles.detailMetaPillText}>
                      Follow-up: {selectedCustomer.followUpStatus}
                    </Text>
                  </View>
                  <View style={styles.detailMetaPill}>
                    <Text style={styles.detailMetaPillText}>
                      Ngày rời xa: {selectedCustomer.dormantDays ?? 0}
                    </Text>
                  </View>
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </ManageScreenShell>
  );
}

const styles = StyleSheet.create({
  ...manageStyles,
  totalCard: {
    minHeight: 56,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  totalCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  totalIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  totalCardText: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "800",
    color: palette.text,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricCard: {
    width: "47%",
    borderRadius: 16,
    backgroundColor: "#FCFAF8",
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: palette.sub,
  },
  metricValue: {
    fontSize: 19,
    lineHeight: 22,
    fontWeight: "800",
    color: palette.text,
  },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    color: palette.text,
  },
  refreshButton: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  refreshButtonText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
    color: palette.sub,
  },
  filterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  selectField: {
    width: "47%",
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  selectValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    color: palette.text,
  },
  selectPlaceholder: {
    color: "#B5A99D",
  },
  vipField: {
    width: "47%",
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#D1C4B7",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  vipFieldText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
    color: palette.text,
  },
  countPill: {
    minHeight: 28,
    borderRadius: 14,
    backgroundColor: "#FBF2E6",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  countPillText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "800",
    color: palette.accent,
  },
  collapseButton: {
    minHeight: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  collapseButtonText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "700",
    color: palette.sub,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingLeft: 12,
    paddingRight: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 18,
    color: palette.text,
  },
  searchInput: {
    flex: 1,
    minHeight: 40,
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: "transparent",
  },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFF9F3",
    alignItems: "center",
    justifyContent: "center",
  },
  errorCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1D5CA",
    backgroundColor: "#FBECE7",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: "#C66043",
  },
  emptyState: {
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.border,
    backgroundColor: palette.mutedSoft,
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.sub,
    textAlign: "center",
  },
  collapsedSummary: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.mutedSoft,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  collapsedSummaryText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: palette.sub,
  },
  listStack: {
    gap: 12,
  },
  customerRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F2DDD4",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
    color: "#8A5947",
  },
  customerCopy: {
    flex: 1,
    gap: 6,
  },
  customerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  customerName: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: palette.text,
  },
  statusBadge: {
    minHeight: 20,
    borderRadius: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
  },
  customerMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
  },
  duplicateSummaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  duplicateSummaryCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FCFAF8",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  duplicateSummaryLabel: {
    fontSize: 12,
    lineHeight: 15,
    color: palette.sub,
  },
  duplicateSummaryValue: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    color: palette.text,
  },
  duplicateCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  duplicateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  duplicateTitle: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
    color: palette.text,
  },
  duplicateMeta: {
    fontSize: 11,
    lineHeight: 14,
    color: palette.sub,
  },
  duplicateHint: {
    fontSize: 11,
    lineHeight: 15,
    color: palette.sub,
  },
  duplicateActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  mergeButton: {
    minHeight: 34,
    borderRadius: 17,
    backgroundColor: palette.accent,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  mergeButtonDisabled: {
    opacity: 0.7,
  },
  mergeButtonText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  phonePill: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    color: "#2BAE7C",
    backgroundColor: "#E8F8F2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metaDot: {
    fontSize: 10,
    lineHeight: 12,
    color: "#B8AA9B",
  },
  metaText: {
    fontSize: 11,
    lineHeight: 14,
    color: palette.sub,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(47,36,29,0.28)",
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  detailModalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  detailHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  modalTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    color: palette.text,
  },
  detailSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: palette.sub,
  },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.mutedSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  modalList: {
    gap: 8,
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  detailCard: {
    width: "47%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FCFAF8",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  detailLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: palette.sub,
  },
  detailValue: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
    color: palette.text,
  },
  detailBlock: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
  },
  detailBlockLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: palette.sub,
    textTransform: "uppercase",
  },
  detailBlockValue: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.text,
  },
  detailFooterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailMetaPill: {
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 10,
    backgroundColor: "#FBF2E6",
    alignItems: "center",
    justifyContent: "center",
  },
  detailMetaPillText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: palette.accent,
  },
  modalOption: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  modalOptionActive: {
    backgroundColor: "#FFF8EF",
    borderColor: "#D8BEA2",
  },
  modalOptionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    color: palette.text,
  },
  modalOptionTextActive: {
    fontWeight: "800",
    color: palette.accent,
  },
});
