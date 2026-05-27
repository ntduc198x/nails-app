import Feather from "@expo/vector-icons/Feather";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Share, StyleSheet, Text, View } from "react-native";
import {
  getReportBreakdownForMobile,
  getStaffHoursInRangeForMobile,
  getStaffRevenueInRangeForMobile,
  listReportStaffOptionsForMobile,
  listTicketsInRangeForMobile,
  formatAttendanceFraction,
  localizeAdminBranchName,
  type MobileReportBreakdown,
  type MobileReportStaffOption,
  type MobileReportTicketRow,
  type MobileStaffHoursRow,
  type MobileStaffRevenueRow,
} from "@nails/shared";
import { ManageScreenShell, manageStyles, useManageRouteAccess } from "@/src/features/admin/manage-ui";
import { useAdminStrings } from "@/src/features/admin/strings";
import { useAdminObserverScope } from "@/src/hooks/use-admin-observer-scope";
import { mobileSupabase } from "@/src/lib/supabase";
import { useAdminPreferences } from "@/src/providers/admin-preferences-provider";

type RangeMode = "day" | "week" | "month" | "custom";

const palette = {
  border: "#EADFD3",
  text: "#2F241D",
  sub: "#84776C",
  accent: "#A56D3D",
  accentSoft: "#F3E7DA",
  success: "#2B9E5F",
  successSoft: "#EAF7EE",
  warning: "#E79937",
  warningSoft: "#FFF1E4",
  violet: "#7A69E8",
  violetSoft: "#F1EEFF",
  mutedSoft: "#F8F4EF",
};

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount || 0);
}

function formatPercent(value: number) {
  return `${Math.round((value || 0) * 100)}%`;
}

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

function shiftAnchorDate(anchor: Date, mode: RangeMode, delta: number) {
  const next = new Date(anchor);
  if (mode === "day") {
    next.setDate(next.getDate() + delta);
    return next;
  }
  if (mode === "week") {
    next.setDate(next.getDate() + delta * 7);
    return next;
  }
  next.setMonth(next.getMonth() + delta);
  return next;
}

function formatDateByLocale(value: Date, locale: "vi" | "en") {
  return value.toLocaleDateString(locale === "en" ? "en-US" : "vi-VN");
}

function formatRangeLabel(mode: RangeMode, anchorDate: Date, customFrom: string, customTo: string, locale: "vi" | "en") {
  if (mode === "day") return formatDateByLocale(anchorDate, locale);
  if (mode === "week") {
    return `${formatDateByLocale(startOfWeek(anchorDate), locale)} - ${formatDateByLocale(endOfWeek(anchorDate), locale)}`;
  }
  if (mode === "month") return `${anchorDate.getMonth() + 1}/${anchorDate.getFullYear()}`;
  return `${formatDateByLocale(new Date(`${customFrom}T00:00:00`), locale)} - ${formatDateByLocale(new Date(`${customTo}T00:00:00`), locale)}`;
}

function buildRange(mode: RangeMode, anchorDate: Date, customFrom: string, customTo: string) {
  if (mode === "day") return { from: startOfDay(anchorDate), to: endOfDay(anchorDate) };
  if (mode === "week") return { from: startOfWeek(anchorDate), to: endOfWeek(anchorDate) };
  if (mode === "month") return { from: startOfMonth(anchorDate), to: endOfMonth(anchorDate) };
  return { from: new Date(`${customFrom}T00:00:00`), to: new Date(`${customTo}T23:59:59`) };
}

function OptionSheet<T extends string>({
  options,
  title,
  visible,
  selected,
  onClose,
  onSelect,
}: {
  options: Array<{ label: string; value: T }>;
  title: string;
  visible: boolean;
  selected: T;
  onClose: () => void;
  onSelect: (value: T) => void;
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
                  key={option.value}
                  style={[styles.modalOption, active ? styles.modalOptionActive : null]}
                  onPress={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                >
                  <Text style={[styles.modalOptionText, active ? styles.modalOptionTextActive : null]}>{option.label}</Text>
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

function MetricCard({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "violet" }) {
  const toneStyle = tone === "success" ? styles.metricCardSuccess : tone === "warning" ? styles.metricCardWarning : tone === "violet" ? styles.metricCardViolet : null;
  return (
    <View style={[styles.metricCard, toneStyle]}>
      <View style={styles.metricRow}>
        <Text style={[styles.metricLabel, tone === "warning" ? styles.metricLabelWarning : tone === "violet" ? styles.metricLabelViolet : null]} numberOfLines={1}>{label}</Text>
        <Text style={[styles.metricValue, tone === "success" ? styles.metricValueSuccess : null]}>{value}</Text>
      </View>
    </View>
  );
}

function SelectLike({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable style={styles.selectField} onPress={onPress}>
      <Text style={styles.selectLabel}>{label}</Text>
      <View style={styles.selectValueRow}>
        <Text style={styles.selectValue} numberOfLines={1}>{value}</Text>
        <Feather name="chevron-down" size={16} color={palette.sub} />
      </View>
    </Pressable>
  );
}

function formatMonthRangeLabel(anchorDate: Date, strings: ReturnType<typeof useAdminStrings>) {
  return strings.manageReportsMonthLabelTemplate
    .replace("{month}", String(anchorDate.getMonth() + 1))
    .replace("{year}", String(anchorDate.getFullYear()));
}

export default function AdminManageReportsScreen() {
  const strings = useAdminStrings();
  const { locale } = useAdminPreferences();
  const { isHydrated, allowed } = useManageRouteAccess(["OWNER", "PARTNER", "MANAGER", "ACCOUNTANT"]);
  const observer = useAdminObserverScope();
  const [rangeMode, setRangeMode] = useState<RangeMode>("day");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [customFrom, setCustomFrom] = useState(() => toDateInput(new Date()));
  const [customTo, setCustomTo] = useState(() => toDateInput(new Date()));
  const [staffFilter, setStaffFilter] = useState("ALL");
  const [staffOptions, setStaffOptions] = useState<MobileReportStaffOption[]>([]);
  const [tickets, setTickets] = useState<MobileReportTicketRow[]>([]);
  const [breakdown, setBreakdown] = useState<MobileReportBreakdown | null>(null);
  const [staffRevenue, setStaffRevenue] = useState<MobileStaffRevenueRow[]>([]);
  const [staffHours, setStaffHours] = useState<MobileStaffHoursRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showBills, setShowBills] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showModeSheet, setShowModeSheet] = useState(false);
  const [showStaffSheet, setShowStaffSheet] = useState(false);

  const rangeModeOptions = useMemo<Array<{ label: string; value: RangeMode }>>(
    () => [
      { label: strings.manageReportsModeDay, value: "day" },
      { label: strings.manageReportsModeWeek, value: "week" },
      { label: strings.manageReportsModeMonth, value: "month" },
      { label: strings.manageReportsModeCustom, value: "custom" },
    ],
    [strings],
  );

  const range = useMemo(() => buildRange(rangeMode, anchorDate, customFrom, customTo), [rangeMode, anchorDate, customFrom, customTo]);

  const filteredTickets = useMemo(() => {
    if (staffFilter === "ALL") return tickets;
    return tickets.filter((ticket) => ticket.staffUserId === staffFilter);
  }, [staffFilter, tickets]);

  const summary = useMemo(() => {
    if (breakdown?.summary) return breakdown.summary;
    const closedRows = filteredTickets.filter((ticket) => ticket.status === "CLOSED");
    return {
      count: closedRows.length,
      subtotal: closedRows.reduce((sum, ticket) => sum + ticket.subtotal, 0),
      vat: closedRows.reduce((sum, ticket) => sum + ticket.vat, 0),
      revenue: closedRows.reduce((sum, ticket) => sum + ticket.grandTotal, 0),
    };
  }, [breakdown, filteredTickets]);

  const selectedModeLabel = useMemo(
    () => rangeModeOptions.find((option) => option.value === rangeMode)?.label ?? strings.manageReportsModeDay,
    [rangeMode, rangeModeOptions, strings.manageReportsModeDay],
  );
  const rangeLabel = useMemo(
    () => rangeMode === "month"
      ? formatMonthRangeLabel(anchorDate, strings)
      : formatRangeLabel(rangeMode, anchorDate, customFrom, customTo, locale),
    [anchorDate, customFrom, customTo, locale, rangeMode, strings],
  );
  const selectedStaffLabel = useMemo(() => {
    if (staffFilter === "ALL") return strings.manageReportsAllStaff;
    return staffOptions.find((option) => option.userId === staffFilter)?.name ?? strings.manageReportsSingleStaff;
  }, [staffFilter, staffOptions, strings.manageReportsAllStaff, strings.manageReportsSingleStaff]);
  const scopePillLabel = useMemo(() => {
    if (!breakdown) return null;
    if (breakdown.viewMode === "org") return strings.observerScopeOrg;

    const activeBranch = observer.viewContext?.branches.find((branch) => branch.id === breakdown.branchId);
    if (activeBranch) {
      return localizeAdminBranchName(locale, activeBranch.name, activeBranch.translations) ?? activeBranch.name;
    }

    return breakdown.branchName ?? breakdown.scopeLabel ?? null;
  }, [breakdown, locale, observer.viewContext?.branches, strings.observerScopeOrg]);
  const staffSelectOptions = useMemo(
    () => [{ label: strings.manageReportsAllStaff, value: "ALL" }, ...staffOptions.map((option) => ({ label: option.name, value: option.userId }))],
    [staffOptions, strings.manageReportsAllStaff],
  );

  const benchmarkSummary = breakdown?.orgBenchmark ?? null;
  const selectedBranchBenchmark = benchmarkSummary?.selectedBranch ?? null;
  const topBranches = breakdown?.branchRanking?.slice(0, 5) ?? [];

  const load = useCallback(async (force = false) => {
    if (!mobileSupabase || !observer.isReady) {
      setError(strings.manageReportsMissingSupabase);
      setLoading(false);
      return;
    }

    try {
      if (force || !tickets.length) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const fromIso = range.from.toISOString();
      const toIso = range.to.toISOString();

      const observerOptions = { observerScope: observer.observerScope };
      const [ticketRows, nextBreakdown, nextStaffRevenue, nextStaffHours, nextStaffOptions] = await Promise.all([
        listTicketsInRangeForMobile(mobileSupabase, fromIso, toIso, observerOptions),
        getReportBreakdownForMobile(mobileSupabase, fromIso, toIso, observerOptions).catch(() => null),
        getStaffRevenueInRangeForMobile(mobileSupabase, fromIso, toIso, observerOptions).catch(() => []),
        getStaffHoursInRangeForMobile(mobileSupabase, fromIso, toIso, observerOptions).catch(() => []),
        listReportStaffOptionsForMobile(mobileSupabase, observerOptions).catch(() => []),
      ]);

      setTickets(ticketRows);
      setBreakdown(nextBreakdown);
      setStaffRevenue(nextStaffRevenue);
      setStaffHours(nextStaffHours);
      setStaffOptions(nextStaffOptions);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : strings.manageReportsLoadFailed);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    observer.isReady,
    observer.observerScope,
    range.from,
    range.to,
    strings.manageReportsLoadFailed,
    strings.manageReportsMissingSupabase,
    tickets.length,
  ]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void load(true);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [load]);

  async function exportReport() {
    const lines = [
      strings.manageReportsExportTitle,
      `${strings.manageReportsExportPeriodPrefix}: ${rangeLabel}`,
      `${strings.manageReportsExportBillCountPrefix}: ${filteredTickets.length}`,
      `${strings.manageReportsExportSubtotalPrefix}: ${formatVnd(summary.subtotal)}d`,
      `${strings.manageReportsExportVatPrefix}: ${formatVnd(summary.vat)}d`,
      `${strings.manageReportsExportRevenuePrefix}: ${formatVnd(summary.revenue)}d`,
      "",
      strings.manageReportsExportBillDetailsTitle,
      ...filteredTickets.map((ticket) => `${ticket.createdAt} | ${ticket.customerName ?? "-"} | ${ticket.status} | ${formatVnd(ticket.grandTotal)}d`),
    ];

    try {
      await Share.share({ message: lines.join("\n") });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : strings.manageReportsExportFailed);
    }
  }

  if (!isHydrated || !allowed) {
    return <View style={manageStyles.loadingState} />;
  }

  return (
    <ManageScreenShell
      title={strings.manageReportsTitle}
      subtitle={strings.manageReportsSubtitle}
      currentKey="reports"
      group="insights"
      showBackButton={false}
    >
      <View style={styles.totalCard}>
        <Text style={styles.totalCardText}>{filteredTickets.length} {strings.manageReportsTotalBillsSuffix}</Text>
      </View>
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{strings.manageReportsQuickNavTitle}</Text>
          <Pressable style={styles.exportButton} onPress={() => void exportReport()}>
            <Feather name="download" size={14} color={palette.accent} />
            <Text style={styles.exportButtonText}>{strings.manageReportsExportButton}</Text>
          </Pressable>
        </View>

        <View style={styles.metricGrid}>
          <MetricCard label={strings.manageReportsMetricBills} value={String(summary.count)} />
          <MetricCard label={strings.manageReportsMetricSubtotal} value={`${formatVnd(summary.subtotal)}d`} />
          <MetricCard label={strings.manageReportsMetricVat} value={`${formatVnd(summary.vat)}d`} />
          <MetricCard label={strings.manageReportsMetricRevenue} value={`${formatVnd(summary.revenue)}d`} tone="success" />
        </View>

        <View style={styles.inlineMetaRow}>
          <View style={styles.periodPill}>
            <Text style={styles.periodPillText}>{selectedModeLabel}</Text>
          </View>
          {scopePillLabel ? (
            <View style={styles.periodPill}>
              <Text style={styles.periodPillText}>{scopePillLabel}</Text>
            </View>
          ) : null}
          <View style={styles.periodPill}>
            <Text style={styles.periodPillText}>{staffFilter === "ALL" ? strings.manageReportsAllStaffShort : strings.manageReportsOneStaffShort}</Text>
          </View>
        </View>

        {showFilters ? (
          <View style={styles.filterPanel}>
            <SelectLike label={strings.manageReportsFiltersReportType} value={selectedModeLabel} onPress={() => setShowModeSheet(true)} />
            {(rangeMode === "day" || rangeMode === "week" || rangeMode === "month") ? (
              <View style={styles.rangeNavigator}>
                <Pressable style={styles.navButton} onPress={() => setAnchorDate((current) => shiftAnchorDate(current, rangeMode, -1))}>
                  <Feather name="chevron-left" size={18} color={palette.accent} />
                </Pressable>
                <View style={styles.rangeLabelWrap}>
                  <Text style={styles.rangeLabel}>{rangeLabel}</Text>
                </View>
                <Pressable style={styles.navButton} onPress={() => setAnchorDate((current) => shiftAnchorDate(current, rangeMode, 1))}>
                  <Feather name="chevron-right" size={18} color={palette.accent} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.customRangeGrid}>
                <Pressable style={styles.customQuickButton} onPress={() => setCustomFrom(toDateInput(new Date()))}>
                  <Text style={styles.customQuickButtonText}>{strings.manageReportsFromToday}</Text>
                </Pressable>
                <Pressable style={styles.customQuickButton} onPress={() => setCustomTo(toDateInput(new Date()))}>
                  <Text style={styles.customQuickButtonText}>{strings.manageReportsToToday}</Text>
                </Pressable>
                <View style={styles.customDateValue}>
                  <Text style={styles.customDateLabel}>{strings.manageReportsFromLabel}</Text>
                  <Text style={styles.customDateText}>{formatDateByLocale(new Date(`${customFrom}T00:00:00`), locale)}</Text>
                </View>
                <View style={styles.customDateValue}>
                  <Text style={styles.customDateLabel}>{strings.manageReportsToLabel}</Text>
                  <Text style={styles.customDateText}>{formatDateByLocale(new Date(`${customTo}T00:00:00`), locale)}</Text>
                </View>
              </View>
            )}
            <SelectLike label={strings.manageReportsStaffLabel} value={selectedStaffLabel} onPress={() => setShowStaffSheet(true)} />
            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryAction} onPress={() => setShowBills(true)}>
                <Feather name="eye" size={14} color={palette.sub} />
                <Text style={styles.secondaryActionText}>{strings.manageReportsViewBills}</Text>
              </Pressable>
              <Pressable style={styles.secondaryAction} onPress={() => setShowInsights((current) => !current)}>
                <Feather name="bar-chart-2" size={14} color={palette.sub} />
                <Text style={styles.secondaryActionText}>{showInsights ? strings.manageReportsQuickHide : strings.manageReportsQuickOpen}</Text>
              </Pressable>
            </View>
            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryAction} onPress={() => setShowFilters(false)}>
                <Feather name="filter" size={14} color={palette.sub} />
                <Text style={styles.secondaryActionText}>{strings.manageReportsHideFilters}</Text>
              </Pressable>
              <Pressable style={styles.secondaryAction} onPress={() => void load()}>
                {refreshing ? <ActivityIndicator size="small" color={palette.accent} /> : <Feather name="rotate-cw" size={14} color={palette.sub} />}
                <Text style={styles.secondaryActionText}>{strings.manageReportsApplyFilters}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.actionRow}>
            <Pressable style={styles.secondaryAction} onPress={() => setShowBills(true)}>
              <Feather name="eye" size={14} color={palette.sub} />
              <Text style={styles.secondaryActionText}>{strings.manageReportsViewBills}</Text>
            </Pressable>
            <Pressable style={styles.secondaryAction} onPress={() => setShowFilters(true)}>
              <Feather name="filter" size={14} color={palette.sub} />
              <Text style={styles.secondaryActionText}>{strings.manageReportsOpenFilters}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Feather name="alert-circle" size={16} color="#C66043" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {breakdown?.viewMode === "branch" && selectedBranchBenchmark && benchmarkSummary ? (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{strings.manageReportsCompareOrgTitle}</Text>
            <View style={styles.periodPill}>
              <Text style={styles.periodPillText}>{strings.manageReportsRankPrefix}{selectedBranchBenchmark.revenueRank}</Text>
            </View>
          </View>

          <View style={styles.metricGrid}>
            <MetricCard
              label={strings.manageReportsBranchRevenue}
              value={`${formatVnd(selectedBranchBenchmark.revenue)}d`}
              tone={selectedBranchBenchmark.revenue >= benchmarkSummary.avgRevenuePerBranch ? "success" : "warning"}
            />
            <MetricCard label={strings.manageReportsOrgBranchAverage} value={`${formatVnd(benchmarkSummary.avgRevenuePerBranch)}d`} />
            <MetricCard
              label={strings.manageReportsBranchCheckIn}
              value={formatPercent(selectedBranchBenchmark.checkInRate)}
              tone={selectedBranchBenchmark.checkInRate >= benchmarkSummary.avgCheckInRate ? "success" : "warning"}
            />
            <MetricCard
              label={strings.manageReportsBranchNoShow}
              value={formatPercent(selectedBranchBenchmark.noShowRate)}
              tone={selectedBranchBenchmark.noShowRate <= benchmarkSummary.avgNoShowRate ? "success" : "warning"}
            />
          </View>

          <View style={styles.stack}>
            <View style={styles.listItemCard}>
              <View style={styles.listItemCopy}>
                <Text style={styles.listItemTitle}>{strings.manageReportsBillsAppointmentsTitle}</Text>
                <Text style={styles.listItemMeta}>{strings.manageReportsBillsAppointmentsSubtitle}</Text>
              </View>
              <Text style={styles.listItemAmount}>
                {selectedBranchBenchmark.ticketCount} / {selectedBranchBenchmark.appointmentCount}
              </Text>
            </View>
            <View style={styles.listItemCard}>
              <View style={styles.listItemCopy}>
                <Text style={styles.listItemTitle}>{strings.manageReportsAverageTicketTitle}</Text>
                <Text style={styles.listItemMeta}>Branch {formatVnd(selectedBranchBenchmark.avgTicketValue)}d</Text>
              </View>
              <Text style={styles.listItemAmount}>{formatVnd(benchmarkSummary.avgTicketValue)}d</Text>
            </View>
          </View>
        </View>
      ) : null}

      {breakdown?.viewMode === "org" && topBranches.length ? (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{strings.manageReportsBranchRankingTitle}</Text>
            <View style={styles.periodPill}>
              <Text style={styles.periodPillText}>{benchmarkSummary?.branchCount ?? topBranches.length} {strings.manageReportsBranchCountSuffix}</Text>
            </View>
          </View>

          <View style={styles.stack}>
            {topBranches.map((branch) => (
              <View key={branch.branchId} style={styles.listItemCard}>
                <View style={styles.listItemCopy}>
                  <Text style={styles.listItemTitle}>#{branch.revenueRank} {branch.branchName}</Text>
                  <Text style={styles.listItemMeta}>
                    {branch.ticketCount} {strings.manageReportsTotalBillsSuffix} • {branch.appointmentCount} appointments • check-in {formatPercent(branch.checkInRate)}
                  </Text>
                </View>
                <Text style={styles.listItemAmount}>{formatVnd(branch.revenue)}d</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{strings.manageReportsRevenueAnalysisTitle}</Text>
          <View style={styles.periodPill}>
            <Text style={styles.periodPillText}>{showInsights ? strings.manageReportsOpened : strings.manageReportsHidden}</Text>
          </View>
        </View>

        {showInsights ? (
          <View style={styles.insightGrid}>
            <View style={styles.insightBlock}>
              <Text style={styles.insightTitle}>{strings.manageReportsTopServicesTitle}</Text>
              {breakdown?.byService.length ? (
                breakdown.byService.slice(0, 4).map((item, index) => (
                  <View key={`${item.serviceName}-${index}`} style={styles.listItemCard}>
                    <View style={styles.listItemCopy}>
                      <Text style={styles.listItemTitle} numberOfLines={1}>{item.serviceName}</Text>
                      <Text style={styles.listItemMeta}>SL {item.qty}</Text>
                    </View>
                    <Text style={styles.listItemAmount}>{formatVnd(item.subtotal)}d</Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptySection}>
                  <Text style={styles.emptySectionText}>{strings.manageReportsServiceEmpty}</Text>
                </View>
              )}
            </View>

            <View style={styles.insightBlock}>
              <Text style={styles.insightTitle}>{strings.manageReportsByStaffTitle}</Text>
              {staffRevenue.length ? (
                staffRevenue.slice(0, 4).map((item) => (
                  <View key={item.staffUserId} style={styles.listItemCard}>
                    <View style={styles.listItemCopy}>
                      <Text style={styles.listItemTitle} numberOfLines={1}>{item.staff}</Text>
                      <Text style={styles.listItemMeta}>{item.tickets} bill</Text>
                    </View>
                    <Text style={styles.listItemAmount}>{formatVnd(item.revenue)}d</Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptySection}>
                  <Text style={styles.emptySectionText}>{strings.manageReportsStaffRevenueEmpty}</Text>
                </View>
              )}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{strings.manageReportsBillDetailsSectionTitle}</Text>
          <View style={styles.countDot}>
            <Text style={styles.countDotText}>{filteredTickets.length}</Text>
          </View>
        </View>
        {loading ? (
          <View style={styles.emptySection}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={styles.emptySectionText}>{strings.manageReportsLoadingBills}</Text>
          </View>
        ) : showBills && filteredTickets.length ? (
          <View style={styles.stack}>
            {filteredTickets.slice(0, 12).map((ticket) => (
              <View key={ticket.id} style={styles.ticketCard}>
                <View style={styles.ticketTopRow}>
                  <View style={styles.ticketCopy}>
                    <Text style={styles.ticketTitle} numberOfLines={1}>{ticket.customerName ?? ticket.staffUserId ?? "Bill"}</Text>
                    <Text style={styles.ticketMeta}>{new Date(ticket.createdAt).toLocaleString("vi-VN")}</Text>
                  </View>
                  <Text style={styles.ticketAmount}>{formatVnd(ticket.grandTotal)}d</Text>
                </View>
                <View style={styles.ticketBadgeRow}>
                  <View style={styles.ticketBadge}>
                    <Text style={styles.ticketBadgeText}>{ticket.status}</Text>
                  </View>
                  <View style={styles.ticketBadge}>
                    <Text style={styles.ticketBadgeText}>VAT {formatVnd(ticket.vat)}d</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptySection}>
            <Feather name="file-text" size={16} color="#B6A899" />
            <Text style={styles.emptySectionText}>{strings.manageReportsNoBillsFiltered}</Text>
          </View>
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{strings.manageReportsPaymentMethodTitle}</Text>
        {breakdown?.byPayment.length ? (
          <View style={styles.stack}>
            {breakdown.byPayment.map((item, index) => (
              <View key={`${item.method}-${index}`} style={styles.listItemCard}>
                <View style={styles.listItemCopy}>
                  <Text style={styles.listItemTitle}>{item.method}</Text>
                  <Text style={styles.listItemMeta}>{item.count} bill</Text>
                </View>
                <Text style={styles.listItemAmount}>{formatVnd(item.amount)}d</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptySection}>
            <Feather name="credit-card" size={16} color="#B6A899" />
            <Text style={styles.emptySectionText}>{strings.manageReportsPaymentEmpty}</Text>
          </View>
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{strings.manageReportsStaffHoursTitle}</Text>
        {staffHours.length ? (
          <View style={styles.stack}>
            {staffHours.map((item) => (
              <View key={item.staffUserId} style={styles.listItemCard}>
                <View style={styles.listItemCopy}>
                  <Text style={styles.listItemTitle}>{item.staff}</Text>
                  <Text style={styles.listItemMeta}>{item.entries} {strings.manageReportsShiftsUnit} • {item.minutes} {strings.manageReportsMinutesUnit}</Text>
                </View>
                <Text style={styles.listItemAmount}>{formatAttendanceFraction(item.attendanceFraction)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptySection}>
            <Feather name="clock" size={16} color="#B6A899" />
            <Text style={styles.emptySectionText}>{strings.manageReportsStaffHoursEmpty}</Text>
          </View>
        )}
      </View>

      <OptionSheet
        title={strings.manageReportsSelectReportType}
        options={rangeModeOptions}
        selected={rangeMode}
        visible={showModeSheet}
        onClose={() => setShowModeSheet(false)}
        onSelect={setRangeMode}
      />
      <OptionSheet
        title={strings.manageReportsSelectStaff}
        options={staffSelectOptions}
        selected={staffFilter}
        visible={showStaffSheet}
        onClose={() => setShowStaffSheet(false)}
        onSelect={setStaffFilter}
      />
    </ManageScreenShell>
  );
}

const styles = StyleSheet.create({
  ...manageStyles,
  totalCard: {
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  totalCardText: {
    fontSize: 16,
    lineHeight: 20,
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
  sectionTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    color: palette.text,
  },
  exportButton: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 10,
    backgroundColor: "#FFF8EF",
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  exportButtonText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
    color: palette.accent,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricCard: {
    width: "47%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FCFAF8",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  metricCardSuccess: {
    backgroundColor: palette.successSoft,
  },
  metricCardWarning: {
    backgroundColor: palette.warningSoft,
  },
  metricCardViolet: {
    backgroundColor: palette.violetSoft,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  metricLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: palette.sub,
  },
  metricLabelWarning: {
    color: palette.warning,
  },
  metricLabelViolet: {
    color: palette.violet,
  },
  metricValue: {
    fontSize: 18,
    lineHeight: 21,
    fontWeight: "800",
    color: palette.text,
  },
  metricValueSuccess: {
    color: palette.success,
  },
  inlineMetaRow: {
    flexDirection: "row",
    gap: 10,
  },
  periodPill: {
    flex: 1,
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  periodPillText: {
    fontSize: 11,
    lineHeight: 14,
    color: palette.sub,
  },
  filterPanel: {
    gap: 12,
  },
  selectField: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  selectLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: palette.sub,
  },
  selectValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  selectValue: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    color: palette.text,
  },
  rangeNavigator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  navButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFF8EF",
    alignItems: "center",
    justifyContent: "center",
  },
  rangeLabelWrap: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  rangeLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: palette.text,
    textAlign: "center",
  },
  customRangeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  customQuickButton: {
    width: "47%",
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFF8EF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  customQuickButtonText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
    color: palette.accent,
  },
  customDateValue: {
    width: "47%",
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  customDateLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: palette.sub,
  },
  customDateText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
    color: palette.text,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryActionText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "700",
    color: palette.sub,
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
  insightGrid: {
    gap: 14,
  },
  insightBlock: {
    gap: 10,
  },
  insightTitle: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
    color: palette.text,
  },
  emptySection: {
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.border,
    backgroundColor: palette.mutedSoft,
    paddingHorizontal: 16,
    paddingVertical: 22,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptySectionText: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.sub,
    textAlign: "center",
  },
  listItemCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  listItemCopy: {
    flex: 1,
    gap: 4,
  },
  listItemTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: palette.text,
  },
  listItemMeta: {
    fontSize: 11,
    lineHeight: 14,
    color: palette.sub,
  },
  listItemAmount: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
    color: palette.text,
  },
  countDot: {
    minWidth: 24,
    minHeight: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    backgroundColor: "#FBF2E6",
    alignItems: "center",
    justifyContent: "center",
  },
  countDotText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    color: palette.accent,
  },
  stack: {
    gap: 10,
  },
  ticketCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  ticketTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  ticketCopy: {
    flex: 1,
    gap: 4,
  },
  ticketTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: palette.text,
  },
  ticketMeta: {
    fontSize: 11,
    lineHeight: 14,
    color: palette.sub,
  },
  ticketAmount: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
    color: palette.text,
  },
  ticketBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  ticketBadge: {
    minHeight: 20,
    borderRadius: 10,
    paddingHorizontal: 8,
    backgroundColor: "#F4EFEA",
    alignItems: "center",
    justifyContent: "center",
  },
  ticketBadgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "700",
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
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modalTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    color: palette.text,
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
