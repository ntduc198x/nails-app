import Feather from "@expo/vector-icons/Feather";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { buildTaxBookForMobile, type MobileTaxBookRow, type TaxBookType } from "@nails/shared";
import { ManageScreenShell, manageStyles } from "@/src/features/admin/manage-ui";
import { mobileSupabase } from "@/src/lib/supabase";

const palette = {
  border: "#EADFD3",
  text: "#2F241D",
  sub: "#84776C",
  accent: "#A56D3D",
  accentSoft: "#F3E7DA",
  success: "#2B9E5F",
  successSoft: "#EAF7EE",
  warning: "#D68A32",
  warningSoft: "#FFF7EF",
  mutedSoft: "#F8F4EF",
};

const BOOK_OPTIONS: Array<{ label: string; value: TaxBookType }> = [
  { label: "Mẫu S1a-HKD", value: "S1A_HKD" },
];

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount || 0);
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function getWeekRange() {
  const today = new Date();
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + mondayOffset);

  return {
    from: toDateInput(start),
    to: toDateInput(shiftDate(start, 7)),
  };
}

function getMonthRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return {
    from: toDateInput(start),
    to: toDateInput(end),
  };
}

function QuickInfo({ accent = false, label, value }: { accent?: boolean; label: string; value: string }) {
  return (
    <View style={[styles.quickInfo, accent ? styles.quickInfoAccent : null]}>
      <View style={styles.quickInfoRow}>
        <Text style={styles.quickLabel}>{label}</Text>
        <Text style={[styles.quickValue, accent ? styles.quickValueAccent : null]} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

export default function AdminManageTaxBooksScreen() {
  const today = new Date();
  const [bookType] = useState<TaxBookType>("S1A_HKD");
  const [fromDate, setFromDate] = useState(() => toDateInput(today));
  const [toDate, setToDate] = useState(() => toDateInput(new Date(today.getTime() + 24 * 60 * 60 * 1000)));
  const [rows, setRows] = useState<MobileTaxBookRow[]>([]);
  const ownerName = "";
  const address = "";
  const taxCode = "";
  const businessLocation = "";
  const unit = "đồng";
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const total = useMemo(() => rows.reduce((sum, row) => sum + row.amount, 0), [rows]);
  const selectedBookLabel = useMemo(
    () => BOOK_OPTIONS.find((option) => option.value === bookType)?.label ?? "Mẫu S1a-HKD",
    [bookType],
  );

  const load = useCallback(async (force = false) => {
    if (!mobileSupabase) {
      setError("Thiếu cấu hình Supabase mobile.");
      setLoading(false);
      return;
    }

    try {
      if (force || !rows.length) setLoading(true);
      setError(null);

      const data = await buildTaxBookForMobile(
        mobileSupabase,
        bookType,
        new Date(`${fromDate}T00:00:00`).toISOString(),
        new Date(`${toDate}T00:00:00`).toISOString(),
      );
      setRows(data);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không tải được sổ thuế.");
    } finally {
      setLoading(false);
    }
  }, [bookType, fromDate, rows.length, toDate]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void load(true);
    }, 200);
    return () => clearTimeout(timeoutId);
  }, [load]);

  function applyQuickRange(type: "week" | "month") {
    const range = type === "week" ? getWeekRange() : getMonthRange();
    setFromDate(range.from);
    setToDate(range.to);
  }

  async function exportTaxBook(kind: "excel" | "pdf") {
    const lines = [
      `${selectedBookLabel}`,
      `Hộ, cá nhân kinh doanh: ${ownerName || "................"}`,
      `Địa chỉ: ${address || "................"}`,
      `Mã số thuế: ${taxCode || "................"}`,
      `Địa điểm kinh doanh: ${businessLocation || "................"}`,
      `Kỳ kê khai: ${fromDate} đến ${toDate}`,
      `Đơn vị tính: ${unit}`,
      "",
      "Ngày tháng | Diễn giải | Số tiền",
      ...rows.map((row) => `${new Date(row.date).toLocaleDateString("vi-VN")} | ${row.description} | ${formatVnd(row.amount)}đ`),
      "",
      `Tổng cộng: ${formatVnd(total)}đ`,
    ];

    try {
      setExporting(true);
      await Share.share({
        title: `${selectedBookLabel}.${kind === "excel" ? "xlsx" : "pdf"}`,
        message: lines.join("\n"),
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không thể xuất file sổ thuế.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <ManageScreenShell
      title="Sổ thuế"
      subtitle="Mẫu S1a-HKD, kỳ kê khai và xuất file phục vụ in hoặc nộp thuế."
      currentKey="tax-books"
      group="insights"
    >
      <View style={styles.bookPill}>
        <Text style={styles.bookPillText}>{selectedBookLabel}</Text>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Điều hướng nhanh</Text>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{rows.length} dòng</Text>
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickInfo label="Mẫu" value="S1a-KKD" />
          <QuickInfo label="Từ ngày" value={fromDate} />
          <QuickInfo label="Đến ngày" value={toDate} />
          <QuickInfo accent label="Tổng" value={`${formatVnd(total)}đ`} />
        </View>
      </View>

      <View style={styles.noticeCard}>
        <View style={styles.noticeRow}>
          <View style={styles.noticeIcon}>
            <Feather name="alert-circle" size={16} color={palette.warning} />
          </View>
          <Text style={styles.noticeBody}>Trang này chỉ dùng cho mẫu S1a-HKD và xuất file để in hoặc nộp thuế.</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Pressable style={styles.infoHeader} onPress={() => setInfoOpen((current) => !current)}>
          <View style={styles.infoCopy}>
            <Text style={styles.infoTitle}>Thông tin kỳ kê khai</Text>
            <Text style={styles.infoSubtitle}>
              {new Date(`${fromDate}T00:00:00`).toLocaleDateString("vi-VN")} - {new Date(`${toDate}T00:00:00`).toLocaleDateString("vi-VN")} • MST: {taxCode || "Mã số thuế"} • Đơn vị: {unit}
            </Text>
          </View>
          <Feather name={infoOpen ? "chevron-up" : "chevron-down"} size={18} color={palette.text} />
        </Pressable>

        {infoOpen ? (
          <View style={styles.infoPanel}>
            <View style={styles.quickActionRow}>
              <Pressable style={styles.quickActionChip} onPress={() => applyQuickRange("week")}>
                <Text style={styles.quickActionChipText}>Chọn nhanh tuần</Text>
              </Pressable>
              <Pressable style={styles.quickActionChip} onPress={() => applyQuickRange("month")}>
                <Text style={styles.quickActionChipText}>Chọn nhanh tháng</Text>
              </Pressable>
            </View>
            <View style={styles.inlinePair}>
              <View style={styles.inlineField}>
                <Text style={styles.inlineLabel}>Từ ngày</Text>
                <Text style={styles.inlineValue}>{fromDate}</Text>
              </View>
              <View style={styles.inlineField}>
                <Text style={styles.inlineLabel}>Đến ngày</Text>
                <Text style={styles.inlineValue}>{toDate}</Text>
              </View>
            </View>
            <View style={styles.inlineField}>
              <Text style={styles.inlineLabel}>Hộ KD</Text>
              <Text style={styles.inlineValue}>{ownerName || "Tên hộ kinh doanh"}</Text>
            </View>
            <View style={styles.inlineField}>
              <Text style={styles.inlineLabel}>MST</Text>
              <Text style={styles.inlineValue}>{taxCode || "Mã số thuế"}</Text>
            </View>
            <View style={styles.inlineField}>
              <Text style={styles.inlineLabel}>Địa chỉ</Text>
              <Text style={styles.inlineValue}>{address || "Địa chỉ"}</Text>
            </View>
            <View style={styles.inlineField}>
              <Text style={styles.inlineLabel}>Địa điểm</Text>
              <Text style={styles.inlineValue}>{businessLocation || "Địa điểm kinh doanh"}</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.formCard}>
        <View style={styles.exportRow}>
          <Pressable style={styles.exportButton} onPress={() => void exportTaxBook("excel")} disabled={loading || exporting}>
            <Feather name="file-text" size={15} color="#1F9D55" />
            <Text style={styles.exportButtonText}>Xuất Excel</Text>
          </Pressable>
          <Pressable style={styles.exportButton} onPress={() => void exportTaxBook("pdf")} disabled={loading || exporting}>
            <Feather name="file" size={15} color="#D14343" />
            <Text style={styles.exportButtonText}>Xuất PDF</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Feather name="alert-circle" size={16} color="#C66043" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.printSheet}>
          <Text style={styles.sheetStrong}>HỘ, CÁ NHÂN KINH DOANH: {ownerName || "................"}</Text>
          <Text style={styles.sheetLine}>Địa chỉ: {address || "................"}</Text>
          <Text style={styles.sheetLine}>Mã số thuế: {taxCode || "................"}</Text>
          <Text style={styles.sheetStrong}>Mẫu số S1a-HKD</Text>
          <Text style={styles.sheetNote}>(Kèm theo Thông tư số 152/2025/TT-BTC)</Text>

          <Text style={styles.sheetHeading}>SỔ DOANH THU BÁN HÀNG HÓA, DỊCH VỤ</Text>
          <Text style={styles.sheetLine}>Địa điểm kinh doanh: {businessLocation || "................"}</Text>
          <Text style={styles.sheetLine}>Kỳ kê khai: {fromDate} đến {toDate}</Text>
          <Text style={styles.sheetLine}>Đơn vị tính: {unit}</Text>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color={palette.accent} />
              <Text style={styles.loadingText}>Đang tải dữ liệu sổ thuế...</Text>
            </View>
          ) : (
            <View style={styles.tableCard}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.dateColumn]}>Ngày tháng</Text>
                <Text style={[styles.tableHeaderCell, styles.descriptionColumn]}>Diễn giải</Text>
                <Text style={[styles.tableHeaderCell, styles.amountColumn]}>Số tiền</Text>
              </View>
              <ScrollView style={styles.tableBody} nestedScrollEnabled>
                {rows.length ? (
                  rows.map((row, index) => (
                    <View key={`${row.date}-${index}`} style={styles.tableRow}>
                      <Text style={[styles.tableCell, styles.dateColumn]}>{new Date(row.date).toLocaleDateString("vi-VN")}</Text>
                      <Text style={[styles.tableCell, styles.descriptionColumn]}>{row.description}</Text>
                      <Text style={[styles.tableCell, styles.amountColumn]}>{formatVnd(row.amount)}đ</Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyTable}>
                    <Text style={styles.emptyTableText}>Không có dữ liệu trong khoảng thời gian đã chọn.</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    </ManageScreenShell>
  );
}

const styles = StyleSheet.create({
  ...manageStyles,
  bookPill: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  bookPillText: {
    fontSize: 16,
    lineHeight: 20,
    color: palette.sub,
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
  countPill: {
    minHeight: 26,
    borderRadius: 13,
    paddingHorizontal: 10,
    backgroundColor: "#FBF2E6",
    alignItems: "center",
    justifyContent: "center",
  },
  countPillText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "800",
    color: palette.accent,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickInfo: {
    width: "47%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FCFAF8",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  quickInfoAccent: {
    backgroundColor: palette.successSoft,
  },
  quickInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  quickLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: palette.sub,
    textTransform: "uppercase",
  },
  quickValue: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "800",
    color: palette.text,
  },
  quickValueAccent: {
    color: palette.success,
  },
  noticeCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F3D7BC",
    backgroundColor: palette.warningSoft,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  noticeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  noticeIcon: {
    marginTop: 1,
  },
  noticeBody: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: palette.warning,
  },
  infoCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoCopy: {
    flex: 1,
    gap: 4,
  },
  infoTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "800",
    color: palette.text,
  },
  infoSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.sub,
  },
  infoPanel: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  quickActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  quickActionChip: {
    flex: 1,
    minHeight: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFF8EF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  quickActionChipText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
    color: palette.accent,
  },
  inlinePair: {
    flexDirection: "row",
    gap: 10,
  },
  inlineField: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  inlineLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: palette.sub,
    textTransform: "uppercase",
  },
  inlineValue: {
    fontSize: 13,
    lineHeight: 17,
    color: palette.text,
  },
  formCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  exportRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  exportButton: {
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  exportButtonText: {
    fontSize: 13,
    lineHeight: 16,
    color: palette.text,
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
  printSheet: {
    gap: 10,
  },
  sheetStrong: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: palette.text,
  },
  sheetLine: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.text,
  },
  sheetNote: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.text,
  },
  sheetHeading: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: palette.text,
  },
  loadingState: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    borderStyle: "dashed",
    backgroundColor: palette.mutedSoft,
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.sub,
  },
  tableCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  tableHeaderCell: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: palette.text,
  },
  tableBody: {
    maxHeight: 280,
    backgroundColor: "#FFFFFF",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#EFE7DE",
  },
  tableCell: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    lineHeight: 18,
    color: palette.text,
  },
  dateColumn: {
    width: "24%",
  },
  descriptionColumn: {
    width: "56%",
  },
  amountColumn: {
    width: "20%",
  },
  emptyTable: {
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  emptyTableText: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.sub,
  },
});
