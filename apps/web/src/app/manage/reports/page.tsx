"use client";

import { AppShell } from "@/components/app-shell";
import { MobileSectionHeader } from "@/components/manage-mobile";
import { ManageQuickNav, reportsQuickNav } from "@/components/manage-quick-nav";
import { listUserRoles } from "@/lib/auth";
import { getCrmDashboardMetrics } from "@/lib/crm";
import { formatVnd } from "@/lib/mock-data";
import { getReportBreakdown, getStaffRevenueInRange, listTicketsInRange, listTimeEntriesInRange, type ReportTicketRow } from "@/lib/reporting";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

type RangeMode = "day" | "week" | "month" | "custom";

function toDateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

function endOfWeek(date: Date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex, 1, 0, 0, 0, 0);
}

function endOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
}

function downloadExcel(filename: string, sheets: Array<{ name: string; rows: Array<Array<string | number>> }>) {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }
  XLSX.writeFile(workbook, filename);
}

export default function ReportsPage() {
  const [today] = useState(() => new Date());
  const [rangeMode, setRangeMode] = useState<RangeMode>("day");
  const [dayValue, setDayValue] = useState(toDateInput(today));
  const [weekAnchor, setWeekAnchor] = useState(toDateInput(today));
  const [monthValue, setMonthValue] = useState(String(today.getMonth() + 1));
  const [yearValue, setYearValue] = useState(String(today.getFullYear()));
  const [fromDate, setFromDate] = useState(toDateInput(today));
  const [toDate, setToDate] = useState(toDateInput(new Date(today.getTime() + 24 * 60 * 60 * 1000)));
  const [staffFilter, setStaffFilter] = useState<string>("ALL");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileInsightsOpen, setMobileInsightsOpen] = useState(false);
  const [mobileTicketsLimit, setMobileTicketsLimit] = useState(12);

  const [rows, setRows] = useState<ReportTicketRow[]>([]);
  const [breakdown, setBreakdown] = useState<{
    summary: { count: number; subtotal: number; vat: number; revenue: number };
    by_service: Array<{ service_name: string; qty: number; subtotal: number }>;
    by_payment: Array<{ method: string; count: number; amount: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);
  const [staffHours, setStaffHours] = useState<Array<{ staff: string; minutes: number; entries: number }>>([]);
  const [staffRevenue, setStaffRevenue] = useState<Array<{ staffUserId: string; staff: string; revenue: number; tickets: number }>>([]);
  const [crmMetrics, setCrmMetrics] = useState({ newToday: 0, returningToday: 0, atRiskCount: 0, repeat30: 0 });
  const hasLoadedRef = useRef(false);
  const ticketsSectionRef = useRef<HTMLDivElement | null>(null);

  const range = useMemo(() => {
    if (rangeMode === "day") {
      const day = new Date(`${dayValue}T00:00:00`);
      return { from: startOfDay(day), to: endOfDay(day) };
    }
    if (rangeMode === "week") {
      const anchor = new Date(`${weekAnchor}T00:00:00`);
      return { from: startOfWeek(anchor), to: endOfWeek(anchor) };
    }
    if (rangeMode === "month") {
      const year = Number(yearValue) || today.getFullYear();
      const monthIndex = Math.max(0, Math.min(11, (Number(monthValue) || 1) - 1));
      return { from: startOfMonth(year, monthIndex), to: endOfMonth(year, monthIndex) };
    }
    return {
      from: new Date(`${fromDate}T00:00:00`),
      to: new Date(`${toDate}T23:59:59`),
    };
  }, [rangeMode, dayValue, weekAnchor, monthValue, yearValue, fromDate, toDate, today]);

  const load = useCallback(async () => {
    const isInitial = !hasLoadedRef.current;
    try {
      setError(null);
      setBreakdownError(null);
      if (isInitial) setLoading(true);
      else setRefreshing(true);

      const fromIso = range.from.toISOString();
      const toIso = range.to.toISOString();

      const data = await listTicketsInRange(fromIso, toIso);
      setRows(data);

      try {
        const [summaryData, timeRows, teamRows, staffRevenueRows, crm] = await Promise.all([
          getReportBreakdown(fromIso, toIso),
          listTimeEntriesInRange(fromIso, toIso),
          listUserRoles(),
          getStaffRevenueInRange(fromIso, toIso),
          getCrmDashboardMetrics(),
        ]);

        setBreakdown(summaryData);
        setStaffRevenue(staffRevenueRows);
        setCrmMetrics(crm);

        const team = (teamRows ?? []) as Array<{ user_id: string; display_name?: string; role?: string }>;
        const eligibleStaffIds = new Set(team.filter((r) => r.role !== "OWNER").map((r) => r.user_id));
        const nameMap = new Map(team.map((r) => [r.user_id, r.display_name || String(r.user_id).slice(0, 8)]));

        const map = new Map<string, { minutes: number; entries: number }>();
        for (const r of timeRows as Array<{ staff_user_id: string; effective_clock_in: string; effective_clock_out: string | null }>) {
          if (!eligibleStaffIds.has(r.staff_user_id)) continue;
          const key = nameMap.get(r.staff_user_id) ?? r.staff_user_id;
          const start = new Date(r.effective_clock_in).getTime();
          const end = r.effective_clock_out ? new Date(r.effective_clock_out).getTime() : Date.now();
          const mins = Math.max(0, Math.round((end - start) / 60000));
          const prev = map.get(key) ?? { minutes: 0, entries: 0 };
          map.set(key, { minutes: prev.minutes + mins, entries: prev.entries + 1 });
        }

        setStaffHours(
          Array.from(map.entries())
            .map(([staff, v]) => ({ staff, minutes: v.minutes, entries: v.entries }))
            .sort((a, b) => b.minutes - a.minutes),
        );
      } catch (e) {
        setBreakdown(null);
        setBreakdownError(e instanceof Error ? e.message : "Breakdown RPC failed");
        setStaffHours([]);
        setStaffRevenue([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load reports failed");
    } finally {
      hasLoadedRef.current = true;
      if (isInitial) setLoading(false);
      else setRefreshing(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    if (breakdown?.summary) {
      return {
        count: Number(breakdown.summary.count ?? 0),
        revenue: Number(breakdown.summary.revenue ?? 0),
        vat: Number(breakdown.summary.vat ?? 0),
        subtotal: Number(breakdown.summary.subtotal ?? 0),
      };
    }

    const closed = rows.filter((r) => r.status === "CLOSED");
    const revenue = closed.reduce((acc, r) => acc + Number(r.totals_json?.grand_total ?? 0), 0);
    const vat = closed.reduce((acc, r) => acc + Number(r.totals_json?.vat_total ?? 0), 0);
    const subtotal = closed.reduce((acc, r) => acc + Number(r.totals_json?.subtotal ?? 0), 0);
    return { count: closed.length, revenue, vat, subtotal };
  }, [rows, breakdown]);

  const revenueByStaffTotal = useMemo(() => staffRevenue.reduce((sum, row) => sum + row.revenue, 0), [staffRevenue]);
  const staffNameMap = useMemo(() => new Map(staffRevenue.map((row) => [row.staffUserId, row.staff])), [staffRevenue]);
  const filteredTicketRows = useMemo(() => {
    if (staffFilter === "ALL") return rows;
    return rows.filter((row) => row.staff_user_id === staffFilter);
  }, [rows, staffFilter]);

  const mobileTicketRows = useMemo(() => filteredTicketRows.slice(0, mobileTicketsLimit), [filteredTicketRows, mobileTicketsLimit]);

  function exportExcel() {
    downloadExcel(`bao-cao-nails-${rangeMode}.xlsx`, [
      {
        name: "Tong_quan",
        rows: [
          ["Chỉ số", "Giá trị"],
          ["Số bill CLOSED", summary.count],
          ["Tạm tính", Number(summary.subtotal)],
          ["VAT", Number(summary.vat)],
          ["Doanh thu", Number(summary.revenue)],
        ],
      },
      {
        name: "Theo_dich_vu",
        rows: [["Dịch vụ", "Số lượng", "Tạm tính"], ...(breakdown?.by_service ?? []).map((s) => [s.service_name, Number(s.qty), Number(s.subtotal)])],
      },
      {
        name: "Theo_thanh_toan",
        rows: [["Phương thức", "Số bill", "Số tiền"], ...(breakdown?.by_payment ?? []).map((p) => [p.method, Number(p.count), Number(p.amount)])],
      },
      {
        name: "Gio_lam",
        rows: [["Nhân viên", "Số ca", "Số phút"], ...staffHours.map((s) => [s.staff, Number(s.entries), Number(s.minutes)])],
      },
      {
        name: "Doanh_thu_NV",
        rows: [["Mã nhân viên", "Tên nhân viên", "Số bill", "Doanh thu"], ...staffRevenue.map((s) => [s.staffUserId, s.staff, Number(s.tickets), Number(s.revenue)])],
      },
      {
        name: "Chi_tiet_bill",
        rows: [["Mã bill", "Mã nhân viên", "Thời gian", "Trạng thái", "Tạm tính", "VAT", "Tổng tiền"], ...filteredTicketRows.map((r) => [r.id, r.staff_user_id ?? "", new Date(r.created_at).toLocaleString("vi-VN"), r.status, Number(r.totals_json?.subtotal ?? 0), Number(r.totals_json?.vat_total ?? 0), Number(r.totals_json?.grand_total ?? 0)])],
      },
    ]);
  }

  return (
    <AppShell>
      <div className="space-y-4 pb-24 md:pb-0">
        <ManageQuickNav items={reportsQuickNav("/manage/reports")} />

        <MobileSectionHeader title="Báo cáo" meta={<div className="manage-info-box">{refreshing ? "Đang làm mới..." : `${filteredTicketRows.length} bill`}</div>} />

        <section className="manage-surface space-y-3 p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-neutral-900">Điều hướng nhanh</h3>
            <button className="cursor-pointer rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700" onClick={exportExcel}>Xuất Excel</button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-[10px] tracking-[0.04em] text-neutral-500">Bill</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">{summary.count}</div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-[10px] tracking-[0.04em] text-neutral-500">Subtotal</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">{formatVnd(summary.subtotal)}</div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-[10px] tracking-[0.04em] text-neutral-500">VAT</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">{formatVnd(summary.vat)}</div>
            </div>
            <div className="rounded-2xl bg-[var(--color-primary)] px-3 py-2.5 text-white">
              <div className="text-[10px] tracking-[0.04em] text-white/80">Doanh thu</div>
              <div className="mt-1 text-sm font-semibold">{formatVnd(summary.revenue)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-[10px] tracking-[0.04em] text-neutral-500">Khách mới hôm nay</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">{crmMetrics.newToday}</div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-[10px] tracking-[0.04em] text-neutral-500">Khách quay lại</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">{crmMetrics.returningToday}</div>
            </div>
            <div className="rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2.5">
              <div className="text-[10px] tracking-[0.04em] text-orange-700">Có nguy cơ rời bỏ</div>
              <div className="mt-1 text-sm font-semibold text-orange-900">{crmMetrics.atRiskCount}</div>
            </div>
            <div className="rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2.5">
              <div className="text-[10px] tracking-[0.04em] text-violet-700">Repeat 30 ngày</div>
              <div className="mt-1 text-sm font-semibold text-violet-900">{crmMetrics.repeat30}%</div>
            </div>
          </div>

          <div className="hidden md:block">
            <div className="grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 lg:grid-cols-[160px_minmax(0,1fr)_220px_auto] lg:items-end">
              <div className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Kiểu báo cáo</div>
                <select className="input py-2.5 text-sm" value={rangeMode} onChange={(e) => setRangeMode(e.target.value as RangeMode)}>
                  <option value="day">Theo ngày</option>
                  <option value="week">Theo tuần</option>
                  <option value="month">Theo tháng</option>
                  <option value="custom">Tùy chỉnh</option>
                </select>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Khoảng thời gian</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {rangeMode === "day" && <input className="input py-2.5 text-sm md:col-span-2" type="date" value={dayValue} onChange={(e) => setDayValue(e.target.value)} />}
                  {rangeMode === "week" && <input className="input py-2.5 text-sm md:col-span-2" type="date" value={weekAnchor} onChange={(e) => setWeekAnchor(e.target.value)} />}
                  {rangeMode === "month" && (
                    <>
                      <select className="input py-2.5 text-sm" value={monthValue} onChange={(e) => setMonthValue(e.target.value)}>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={String(m)}>{`Tháng ${m}`}</option>)}
                      </select>
                      <input className="input py-2.5 text-sm" type="number" value={yearValue} onChange={(e) => setYearValue(e.target.value)} />
                    </>
                  )}
                  {rangeMode === "custom" && (
                    <>
                      <input className="input py-2.5 text-sm" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                      <input className="input py-2.5 text-sm" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Nhân viên</div>
                <select className="input py-2.5 text-sm" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
                  <option value="ALL">Tất cả nhân viên</option>
                  {staffRevenue.map((row) => <option key={row.staffUserId} value={row.staffUserId}>{row.staff}</option>)}
                </select>
              </div>

              <button className="cursor-pointer rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700" onClick={() => void load()} disabled={refreshing}>{refreshing ? "Đang lọc..." : "Lọc"}</button>
            </div>
          </div>

          <div className="space-y-2 md:hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 text-[10px] text-neutral-600">
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5">{rangeMode === "day" ? "Theo ngày" : rangeMode === "week" ? "Theo tuần" : rangeMode === "month" ? "Theo tháng" : "Tùy chỉnh"}</div>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-right">{staffFilter === "ALL" ? "Tất cả NV" : (staffNameMap.get(staffFilter) ?? "1 NV")}</div>
            </div>
            {mobileFilterOpen ? (
              <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2">
                <select className="input py-2.5 text-sm" value={rangeMode} onChange={(e) => setRangeMode(e.target.value as RangeMode)}>
                  <option value="day">Theo ngày</option>
                  <option value="week">Theo tuần</option>
                  <option value="month">Theo tháng</option>
                  <option value="custom">Tùy chỉnh</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  {rangeMode === "day" && <input className="input col-span-2 py-2.5 text-sm" type="date" value={dayValue} onChange={(e) => setDayValue(e.target.value)} />}
                  {rangeMode === "week" && <input className="input col-span-2 py-2.5 text-sm" type="date" value={weekAnchor} onChange={(e) => setWeekAnchor(e.target.value)} />}
                  {rangeMode === "month" && (
                    <>
                      <select className="input py-2.5 text-sm" value={monthValue} onChange={(e) => setMonthValue(e.target.value)}>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={String(m)}>{`Tháng ${m}`}</option>)}
                      </select>
                      <input className="input py-2.5 text-sm" type="number" value={yearValue} onChange={(e) => setYearValue(e.target.value)} />
                    </>
                  )}
                  {rangeMode === "custom" && (
                    <>
                      <input className="input py-2.5 text-sm" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                      <input className="input py-2.5 text-sm" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                    </>
                  )}
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <select className="input py-2.5 text-sm" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
                    <option value="ALL">Tất cả nhân viên</option>
                    {staffRevenue.map((row) => <option key={row.staffUserId} value={row.staffUserId}>{row.staff}</option>)}
                  </select>
                  <button className="cursor-pointer rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-medium text-neutral-700" onClick={() => void load()} disabled={refreshing}>{refreshing ? "Đang lọc..." : "Lọc"}</button>
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
              <button
                className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700"
                onClick={() => {
                  requestAnimationFrame(() => ticketsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
                }}
              >
                Xem bill
              </button>
              <button className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700" onClick={() => setMobileFilterOpen((v) => !v)}>
                {mobileFilterOpen ? "Ẩn lọc" : "Bộ lọc"}
              </button>
            </div>
          </div>
        </section>

        {breakdownError ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Phân tích nâng cao đang lỗi: {breakdownError}. Danh sách phiếu cơ bản vẫn hiển thị bình thường.</div> : null}
        {error ? <div className="manage-error-box">{error}</div> : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_380px]">
          <div className="space-y-4">
            <div className="manage-surface space-y-3 p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-neutral-900">Phân tích doanh thu</h3>
                <button className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-700 md:hidden" onClick={() => setMobileInsightsOpen((v) => !v)}>
                  {mobileInsightsOpen ? "Thu gọn" : "Mở nhanh"}
                </button>
              </div>

              <div className={`grid gap-3 md:grid-cols-2 ${mobileInsightsOpen ? "" : "hidden md:grid"}`}>
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-[0.08em] text-neutral-500">Top dịch vụ</div>
                  {(breakdown?.by_service ?? []).length === 0 ? <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-500">Chưa có dữ liệu dịch vụ trong kỳ này.</div> : (breakdown?.by_service ?? []).slice(0, 4).map((s, idx) => <div key={`${s.service_name}-${idx}`} className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="line-clamp-1 font-medium text-neutral-900">{s.service_name}</div><div className="text-[11px] text-neutral-500">SL {s.qty}</div></div><div className="font-semibold text-neutral-900">{formatVnd(Number(s.subtotal ?? 0))}</div></div></div>)}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2"><div className="text-[10px] uppercase tracking-[0.08em] text-neutral-500">Theo nhân viên</div><div className="text-xs text-neutral-500">{formatVnd(revenueByStaffTotal)}</div></div>
                  {staffRevenue.length === 0 ? <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-500">Chưa có dữ liệu doanh thu theo nhân viên.</div> : staffRevenue.slice(0, 4).map((s) => <div key={s.staffUserId} className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="line-clamp-1 font-medium text-neutral-900">{s.staff}</div><div className="text-[11px] text-neutral-500">{s.tickets} bill</div></div><div className="font-semibold text-neutral-900">{formatVnd(s.revenue)}</div></div></div>)}
                </div>
              </div>
            </div>

            <div ref={ticketsSectionRef} className="manage-surface space-y-3 p-4 md:p-5">
              <div className="hidden md:block space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900">Chi tiết bill</h3>
                  </div>
                  <div className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-medium text-neutral-700">{filteredTicketRows.length} bill</div>
                </div>

                {loading ? (
                  <div className="space-y-2"><div className="skeleton h-10 rounded-xl" /><div className="skeleton h-10 rounded-xl" /><div className="skeleton h-10 rounded-xl" /></div>
                ) : filteredTicketRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-8 text-sm text-neutral-500">Không có bill nào khớp bộ lọc hiện tại.</div>
                ) : (
                  <div className="space-y-1.5">
                    {mobileTicketRows.map((t) => (
                      <div key={t.id} className="rounded-xl border border-neutral-200 bg-white p-1.5 md:rounded-2xl md:p-2.5">
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="min-w-0 flex-1">
                            <div className="line-clamp-1 text-[13px] font-medium text-neutral-900 md:text-sm">{t.staff_user_id ? (staffNameMap.get(t.staff_user_id) ?? t.staff_user_id.slice(0, 8)) : "-"}</div>
                            <div className="mt-0.5 text-[10px] leading-4 text-neutral-500">{new Date(t.created_at).toLocaleString("vi-VN")}</div>
                          </div>
                          <div className="shrink-0 text-right text-[13px] font-semibold text-neutral-900 md:text-sm">{formatVnd(Number(t.totals_json?.grand_total ?? 0))}</div>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-neutral-700 md:mt-1.5 md:text-[11px]">
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5">{t.status}</span>
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5">{formatVnd(Number(t.totals_json?.subtotal ?? 0))}</span>
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5">VAT {formatVnd(Number(t.totals_json?.vat_total ?? 0))}</span>
                          <Link className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 font-medium text-neutral-800" href={`/manage/reports/${t.id}`}>Chi tiết</Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

<div className="md:hidden space-y-3">
                <div className="flex items-center justify-between gap-3 pr-2">
                  <span className="text-sm font-semibold text-neutral-900">Chi tiết bill</span>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-medium text-neutral-700">{filteredTicketRows.length}</span>
                </div>
                {loading ? (
                  <div className="space-y-2"><div className="skeleton h-10 rounded-xl" /><div className="skeleton h-10 rounded-xl" /><div className="skeleton h-10 rounded-xl" /></div>
                ) : filteredTicketRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-8 text-sm text-neutral-500">Không có bill nào khớp bộ lọc hiện tại.</div>
                ) : (
                  <div className="space-y-1.5">
                    {mobileTicketRows.map((t) => (
                      <div key={t.id} className="rounded-xl border border-neutral-200 bg-white p-1.5">
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="min-w-0 flex-1">
                            <div className="line-clamp-1 text-[13px] font-medium text-neutral-900">{t.staff_user_id ? (staffNameMap.get(t.staff_user_id) ?? t.staff_user_id.slice(0, 8)) : "-"}</div>
                            <div className="mt-0.5 text-[10px] leading-4 text-neutral-500">{new Date(t.created_at).toLocaleString("vi-VN")}</div>
                          </div>
                          <div className="shrink-0 text-right text-[13px] font-semibold text-neutral-900">{formatVnd(Number(t.totals_json?.grand_total ?? 0))}</div>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-neutral-700">
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5">{t.status}</span>
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5">{formatVnd(Number(t.totals_json?.subtotal ?? 0))}</span>
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5">VAT {formatVnd(Number(t.totals_json?.vat_total ?? 0))}</span>
                          <Link className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 font-medium text-neutral-800" href={`/manage/reports/${t.id}`}>Chi tiết</Link>
                        </div>
                      </div>
                    ))}
                    {filteredTicketRows.length > mobileTicketRows.length ? (
                      <button
                        type="button"
                        className="mt-2 w-full cursor-pointer rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700"
                        onClick={() => setMobileTicketsLimit((v) => v + 12)}
                      >
                        Xem thêm {Math.min(12, filteredTicketRows.length - mobileTicketRows.length)} bill
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="hidden md:block manage-surface space-y-3 p-4 md:p-5">
              <h3 className="text-sm font-semibold text-neutral-900">Theo phương thức thanh toán</h3>
              <div className="space-y-2">
                {(breakdown?.by_payment ?? []).length === 0 ? <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-500">Chưa có dữ liệu thanh toán.</div> : (breakdown?.by_payment ?? []).map((p, idx) => <div key={`${p.method}-${idx}`} className="rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm"><div className="flex items-center justify-between gap-2"><div><div className="font-medium text-neutral-900">{p.method}</div><div className="text-[11px] text-neutral-500">{p.count} bill</div></div><div className="font-semibold text-neutral-900">{formatVnd(Number(p.amount ?? 0))}</div></div></div>)}
              </div>
            </div>
            <div className="manage-surface space-y-3 p-4 md:hidden">
              <h3 className="text-sm font-semibold text-neutral-900">Theo phương thức thanh toán</h3>
              <div className="space-y-2">
                {(breakdown?.by_payment ?? []).length === 0 ? <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-500">Chưa có dữ liệu thanh toán.</div> : (breakdown?.by_payment ?? []).map((p, idx) => <div key={`${p.method}-${idx}`} className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm"><div className="flex items-center justify-between gap-2"><div><div className="font-medium text-neutral-900">{p.method}</div><div className="text-[11px] text-neutral-500">{p.count} bill</div></div><div className="font-semibold text-neutral-900">{formatVnd(Number(p.amount ?? 0))}</div></div></div>)}
              </div>
            </div>

            <div className="hidden md:block manage-surface space-y-3 p-4 md:p-5">
              <h3 className="text-sm font-semibold text-neutral-900">Theo nhân viên (giờ làm)</h3>
              <div className="space-y-2">
                {staffHours.length === 0 ? <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-500">Chưa có dữ liệu giờ làm trong kỳ này.</div> : staffHours.map((s, idx) => <div key={`${s.staff}-${idx}`} className="rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm"><div className="flex items-center justify-between gap-2"><div><div className="line-clamp-1 font-medium text-neutral-900">{s.staff}</div><div className="text-[11px] text-neutral-500">{s.entries} ca</div></div><div className="font-semibold text-neutral-900">{s.minutes} phút</div></div></div>)}
              </div>
            </div>
            <div className="manage-surface space-y-3 p-4 md:hidden">
              <h3 className="text-sm font-semibold text-neutral-900">Theo nhân viên (giờ làm)</h3>
              <div className="space-y-2">
                {staffHours.length === 0 ? <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-500">Chưa có dữ liệu giờ làm trong kỳ này.</div> : staffHours.map((s, idx) => <div key={`${s.staff}-${idx}`} className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm"><div className="flex items-center justify-between gap-2"><div><div className="line-clamp-1 font-medium text-neutral-900">{s.staff}</div><div className="text-[11px] text-neutral-500">{s.entries} ca</div></div><div className="font-semibold text-neutral-900">{s.minutes} phút</div></div></div>)}
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
