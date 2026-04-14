"use client";

import { AppShell } from "@/components/app-shell";
import { MobileCollapsible, MobileSectionHeader } from "@/components/manage-mobile";
import { ManageQuickNav, reportsQuickNav } from "@/components/manage-quick-nav";
import { buildTaxBook, type TaxBookRow } from "@/lib/tax-books";
import { formatVnd } from "@/lib/mock-data";
import { useEffect, useMemo, useRef, useState } from "react";

function toDateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toBookLabel() {
  return "S1a-HKD";
}

function FieldLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <label className={`text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500 ${className}`}>{children}</label>;
}

function InlineField({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2">
      <FieldLabel className="mb-0">{label}</FieldLabel>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export default function TaxBooksPage() {
  const today = new Date();
  const [fromDate, setFromDate] = useState(toDateInput(today));
  const [toDate, setToDate] = useState(toDateInput(new Date(today.getTime() + 24 * 60 * 60 * 1000)));
  const [rows, setRows] = useState<TaxBookRow[]>([]);
  const [ownerName, setOwnerName] = useState("");
  const [address, setAddress] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [businessLocation, setBusinessLocation] = useState("");
  const [unit, setUnit] = useState("đồng");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    try {
      if (rows.length) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const fromIso = new Date(`${fromDate}T00:00:00`).toISOString();
      const toIso = new Date(`${toDate}T00:00:00`).toISOString();
      const data = await buildTaxBook("S1A_HKD", fromIso, toIso);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load tax book failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 250);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  const total = useMemo(() => rows.reduce((acc, r) => acc + r.amount, 0), [rows]);

  async function exportExcel() {
    try {
      setExporting(true);
      const XLSX = await import("xlsx");
      const bookLabel = toBookLabel();
      const header = [
        [`Mẫu ${bookLabel}`],
        [`Hộ, cá nhân kinh doanh: ${ownerName || "................"}`],
        [`Địa chỉ: ${address || "................"}`],
        [`Mã số thuế: ${taxCode || "................"}`],
        [`Địa điểm kinh doanh: ${businessLocation || "................"}`],
        [`Kỳ kê khai: ${fromDate} đến ${toDate}`],
        [`Đơn vị tính: ${unit}`],
        [],
        ["Ngày tháng", "Diễn giải", "Số tiền"],
        ["A", "B", "1"],
      ];
      const body = rows.map((r) => [new Date(r.date).toLocaleDateString("vi-VN"), r.description, r.amount]);
      while (body.length < 18) body.push(["", "", ""]);
      const footer = [[], ["", "Tổng cộng", total], [], ["", "Ngày ... tháng ... năm ...", ""], ["", "Người đại diện HKD/CNKD", ""]];

      const ws = XLSX.utils.aoa_to_sheet([...header, ...body, ...footer]);
      ws["!cols"] = [{ wch: 14 }, { wch: 56 }, { wch: 18 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, bookLabel);
      XLSX.writeFile(wb, `${bookLabel}_${fromDate}_to_${toDate}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  async function exportPdf() {
    try {
      setExporting(true);
      if (!printRef.current) return;

      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas")]);
      const bookLabel = toBookLabel();

      try {
        const canvas = await html2canvas(printRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          onclone: (clonedDoc) => {
            clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => el.remove());
            const style = clonedDoc.createElement("style");
            style.textContent = `
              #tax-book-export-root { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; padding: 16px; }
              #tax-book-export-root table { width: 100%; border-collapse: collapse; font-size: 12px; }
              #tax-book-export-root th, #tax-book-export-root td { border: 1px solid #333; padding: 6px 8px; }
              #tax-book-export-root thead th { background: #f3f4f6; font-weight: 700; }
              #tax-book-export-root tfoot td { font-weight: 700; }
              #tax-book-export-root .amount { text-align: right; white-space: nowrap; }
            `;
            clonedDoc.head.appendChild(style);
          },
        });

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 40;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 20;
        pdf.addImage(imgData, "PNG", 20, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - 40;

        while (heightLeft > 0) {
          pdf.addPage();
          position = 20 - (imgHeight - heightLeft);
          pdf.addImage(imgData, "PNG", 20, position, imgWidth, imgHeight);
          heightLeft -= pageHeight - 40;
        }

        pdf.save(`${bookLabel}_${fromDate}_to_${toDate}.pdf`);
        return;
      } catch {
        const autoTableModule = await import("jspdf-autotable");
        const autoTable = autoTableModule.default;
        const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });

        pdf.setFontSize(12);
        pdf.text(`Mẫu ${bookLabel}`, 40, 40);
        pdf.setFontSize(10);
        pdf.text(`Hộ/CNKD: ${ownerName || "..............."}`, 40, 58);
        pdf.text(`MST: ${taxCode || "..............."}`, 40, 74);
        pdf.text(`Kỳ kê khai: ${fromDate} đến ${toDate}`, 40, 90);
        pdf.text(`Đơn vị tính: ${unit}`, 40, 106);

        autoTable(pdf, {
          startY: 120,
          head: [["Ngày tháng", "Diễn giải", "Số tiền"], ["A", "B", "1"]],
          body: rows.map((r) => [new Date(r.date).toLocaleDateString("vi-VN"), r.description, formatVnd(r.amount)]),
          foot: [["", "Tổng cộng", formatVnd(total)]],
          styles: { fontSize: 9 },
          columnStyles: { 0: { cellWidth: 95 }, 1: { cellWidth: 280 }, 2: { cellWidth: 120, halign: "right" } },
        });

        pdf.save(`${bookLabel}_${fromDate}_to_${toDate}.pdf`);
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-4 pb-24 md:pb-0">
        <ManageQuickNav items={reportsQuickNav("/manage/tax-books")} />

        <MobileSectionHeader title="Sổ thuế" meta={<div className="manage-info-box">{refreshing ? "Đang làm mới..." : "Mẫu S1a-HKD"}</div>} />

        <section className="manage-surface space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-neutral-900">Điều hướng nhanh</h3>
            <div className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-medium text-neutral-600">{rows.length} dòng</div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.08em] text-neutral-500">Mẫu</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">{toBookLabel()}</div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.08em] text-neutral-500">Từ ngày</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">{fromDate}</div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.08em] text-neutral-500">Đến ngày</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">{toDate}</div>
            </div>
            <div className="rounded-2xl bg-[var(--color-primary)] px-3 py-2.5 text-white">
              <div className="text-[10px] uppercase tracking-[0.08em] text-white/80">Tổng</div>
              <div className="mt-1 text-sm font-semibold">{formatVnd(total)}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void exportExcel()} disabled={loading || exporting}>{exporting ? "Đang xuất..." : "Xuất Excel"}</button>
            <button className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void exportPdf()} disabled={loading || exporting}>{exporting ? "Đang xuất..." : "Xuất PDF"}</button>
          </div>
        </section>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Trang này chỉ dùng cho mẫu S1a-HKD và xuất file để in hoặc nộp thuế.
        </div>

        <div className="space-y-4 xl:grid xl:grid-cols-[360px_minmax(0,1fr)] xl:gap-4 xl:space-y-0">
          <div className="space-y-4">
            <div className="hidden xl:block card space-y-3 xl:sticky xl:top-4 xl:self-start">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">Thông tin kỳ kê khai</h3>
                <p className="text-xs text-neutral-500">Điền gọn để xuất đúng mẫu.</p>
              </div>

              <div className="space-y-2">
                <InlineField label="Từ ngày"><input className="input py-2.5" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></InlineField>
                <InlineField label="Đến ngày"><input className="input py-2.5" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></InlineField>
                <InlineField label="Hộ KD"><input className="input py-2.5" placeholder="Tên hộ kinh doanh" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} /></InlineField>
                <InlineField label="MST"><input className="input py-2.5" placeholder="Mã số thuế" value={taxCode} onChange={(e) => setTaxCode(e.target.value)} /></InlineField>
                <InlineField label="Đơn vị"><input className="input py-2.5" placeholder="đồng" value={unit} onChange={(e) => setUnit(e.target.value)} /></InlineField>
                <InlineField label="Địa chỉ"><input className="input py-2.5" placeholder="Địa chỉ" value={address} onChange={(e) => setAddress(e.target.value)} /></InlineField>
                <InlineField label="Địa điểm"><input className="input py-2.5" placeholder="Địa điểm kinh doanh" value={businessLocation} onChange={(e) => setBusinessLocation(e.target.value)} /></InlineField>
                <div className="rounded-2xl bg-neutral-50 px-3 py-2 text-[11px] text-neutral-500">Đổi kỳ kê khai là hệ thống tự nạp dữ liệu.</div>
              </div>
            </div>

            <div className="xl:hidden">
              <MobileCollapsible summary="Thông tin kỳ kê khai" defaultOpen>
                <div className="space-y-2">
                  <InlineField label="Từ ngày"><input className="input py-2.5" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></InlineField>
                  <InlineField label="Đến ngày"><input className="input py-2.5" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></InlineField>
                  <InlineField label="Hộ KD"><input className="input py-2.5" placeholder="Tên hộ kinh doanh" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} /></InlineField>
                  <InlineField label="MST"><input className="input py-2.5" placeholder="Mã số thuế" value={taxCode} onChange={(e) => setTaxCode(e.target.value)} /></InlineField>
                  <InlineField label="Đơn vị"><input className="input py-2.5" placeholder="đồng" value={unit} onChange={(e) => setUnit(e.target.value)} /></InlineField>
                  <InlineField label="Địa chỉ"><input className="input py-2.5" placeholder="Địa chỉ" value={address} onChange={(e) => setAddress(e.target.value)} /></InlineField>
                  <InlineField label="Địa điểm"><input className="input py-2.5" placeholder="Địa điểm kinh doanh" value={businessLocation} onChange={(e) => setBusinessLocation(e.target.value)} /></InlineField>
                  <div className="rounded-2xl bg-neutral-50 px-3 py-2 text-[11px] text-neutral-500">Đổi kỳ kê khai là hệ thống tự nạp dữ liệu.</div>
                </div>
              </MobileCollapsible>
            </div>
          </div>

          <div id="tax-book-export-root" ref={printRef} className="card space-y-4">
            <div className="text-sm leading-6">
              <div className="flex flex-col gap-3 md:flex-row md:justify-between">
                <div>
                  <p><strong>HỘ, CÁ NHÂN KINH DOANH:</strong> {ownerName || "..............."}</p>
                  <p><strong>Địa chỉ:</strong> {address || "..............."}</p>
                  <p><strong>Mã số thuế:</strong> {taxCode || "..............."}</p>
                </div>
                <div className="text-left md:text-right">
                  <p><strong>Mẫu số {toBookLabel()}</strong></p>
                  <p>(Kèm theo Thông tư số 152/2025/TT-BTC)</p>
                </div>
              </div>
              <p className="mt-3 text-center text-base font-semibold">SỔ DOANH THU BÁN HÀNG HÓA, DỊCH VỤ</p>
              <p><strong>Địa điểm kinh doanh:</strong> {businessLocation || "..............."}</p>
              <p><strong>Kỳ kê khai:</strong> {fromDate} đến {toDate}</p>
              <p><strong>Đơn vị tính:</strong> {unit}</p>
            </div>

            {error ? <p className="text-sm text-red-600">Lỗi: {error}</p> : null}
            {loading ? (
              <p className="text-sm text-neutral-500">Đang tải...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-neutral-600">
                    <tr>
                      <th className="py-2">Ngày tháng</th>
                      <th>Diễn giải</th>
                      <th>Số tiền</th>
                    </tr>
                    <tr>
                      <th className="py-1">A</th>
                      <th>B</th>
                      <th>1</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr key={`${r.date}-${idx}`} className="border-t border-neutral-100">
                        <td className="py-2">{new Date(r.date).toLocaleDateString("vi-VN")}</td>
                        <td>{r.description}</td>
                        <td className="amount">{formatVnd(r.amount)}</td>
                      </tr>
                    ))}
                    {!rows.length ? (
                      <tr className="border-t border-neutral-100">
                        <td className="py-2 text-neutral-500" colSpan={3}>Không có dữ liệu trong khoảng thời gian đã chọn.</td>
                      </tr>
                    ) : null}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-neutral-200 font-semibold">
                      <td className="py-2" colSpan={2}>Tổng</td>
                      <td className="amount">{formatVnd(total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <div className="pt-8 text-right text-sm leading-6">
              <p>Ngày ... tháng ... năm ...</p>
              <p><strong>NGƯỜI ĐẠI DIỆN HỘ KINH DOANH/CÁ NHÂN KINH DOANH</strong></p>
              <p>(Ký, ghi rõ họ tên, đóng dấu nếu có)</p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
