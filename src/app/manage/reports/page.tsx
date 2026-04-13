"use client";

import { AppShell } from "@/components/app-shell";
import { ManageQuickNav } from "@/components/manage-quick-nav";
import { listUserRoles } from "@/lib/auth";
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
  const hasLoadedRef = useRef(false);

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
        const [summaryData, timeRows, teamRows, staffRevenueRows] = await Promise.all([
          getReportBreakdown(fromIso, toIso),
          listTimeEntriesInRange(fromIso, toIso),
          listUserRoles(),
          getStaffRevenueInRange(fromIso, toIso),
        ]);

        setBreakdown(summaryData);
        setStaffRevenue(staffRevenueRows);

        const team = (teamRows ?? []) as Array<{ user_id: string; display_name?: string; role?: string }>;
        const eligibleStaffIds = new Set(team.filter((r) => r.role !== "OWNER").map((r) => r.user_id));
        const nameMap = new Map(
          team.map((r) => [r.user_id, r.display_name || String(r.user_id).slice(0, 8)]),
        );

        const map = new Map<string, { minutes: number; entries: number }>();
        for (const r of timeRows as Array<{ staff_user_id: string; clock_in: string; clock_out: string | null }>) {
          if (!eligibleStaffIds.has(r.staff_user_id)) continue;
          const key = nameMap.get(r.staff_user_id) ?? r.staff_user_id;
          const start = new Date(r.clock_in).getTime();
          const end = r.clock_out ? new Date(r.clock_out).getTime() : Date.now();
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
        rows: [
          ["Dịch vụ", "Số lượng", "Tạm tính"],
          ...(breakdown?.by_service ?? []).map((s) => [s.service_name, Number(s.qty), Number(s.subtotal)]),
        ],
      },
      {
        name: "Theo_thanh_toan",
        rows: [
          ["Phương thức", "Số bill", "Số tiền"],
          ...(breakdown?.by_payment ?? []).map((p) => [p.method, Number(p.count), Number(p.amount)]),
        ],
      },
      {
        name: "Gio_lam",
        rows: [
          ["Nhân viên", "Số ca", "Số phút"],
          ...staffHours.map((s) => [s.staff, Number(s.entries), Number(s.minutes)]),
        ],
      },
      {
        name: "Doanh_thu_NV",
        rows: [
          ["Mã nhân viên", "Tên nhân viên", "Số bill", "Doanh thu"],
          ...staffRevenue.map((s) => [s.staffUserId, s.staff, Number(s.tickets), Number(s.revenue)]),
        ],
      },
      {
        name: "Chi_tiet_bill",
        rows: [
          ["Mã bill", "Mã nhân viên", "Thời gian", "Trạng thái", "Tạm tính", "VAT", "Tổng tiền"],
          ...filteredTicketRows.map((r) => [
            r.id,
            r.staff_user_id ?? "",
            new Date(r.created_at).toLocaleString("vi-VN"),
            r.status,
            Number(r.totals_json?.subtotal ?? 0),
            Number(r.totals_json?.vat_total ?? 0),
            Number(r.totals_json?.grand_total ?? 0),
          ]),
        ],
      },
    ]);
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <section className="manage-surface">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="page-title">Báo cáo</h2>
                {refreshing && <span className="badge-soft">Đang làm mới...</span>}
              </div>
            </div>
            <button className="btn btn-primary" onClick={exportExcel}>Xuất Excel</button>
          </div>

          <ManageQuickNav
            className="mt-4"
            items={[
              { href: "/manage/technician", label: "Bảng kỹ thuật" },
              { href: "/manage/appointments", label: "Lịch hẹn" },
              { href: "/manage/checkout", label: "Thanh toán" },
              { href: "/manage/shifts", label: "Ca làm" },
            ]}
          />

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto] lg:items-center">
            <select className="input" value={rangeMode} onChange={(e) => setRangeMode(e.target.value as RangeMode)}>
              <option value="day">Hôm nay / theo ngày</option>
              <option value="week">Theo tuần</option>
              <option value="month">Theo tháng</option>
              <option value="custom">Tùy chỉnh</option>
            </select>

            {rangeMode === "day" && <input className="input" type="date" value={dayValue} onChange={(e) => setDayValue(e.target.value)} />}
            {rangeMode === "week" && <input className="input" type="date" value={weekAnchor} onChange={(e) => setWeekAnchor(e.target.value)} />}
            {rangeMode === "month" && (
              <>
                <select className="input" value={monthValue} onChange={(e) => setMonthValue(e.target.value)}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={String(m)}>{`Tháng ${m}`}</option>)}
                </select>
                <input className="input w-[120px]" type="number" value={yearValue} onChange={(e) => setYearValue(e.target.value)} />
              </>
            )}
            {rangeMode === "custom" && (
              <>
                <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </>
            )}

            <select className="input" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
              <option value="ALL">Tất cả nhân viên</option>
              {staffRevenue.map((row) => <option key={row.staffUserId} value={row.staffUserId}>{row.staff}</option>)}
            </select>
            <button className="btn btn-outline" onClick={() => void load()} disabled={refreshing}>{refreshing ? "Đang lọc..." : "Lọc"}</button>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="manage-surface"><p className="text-sm text-neutral-500">Số bill CLOSED</p><p className="mt-2 text-3xl font-semibold text-neutral-900">{summary.count}</p></div>
          <div className="manage-surface"><p className="text-sm text-neutral-500">Subtotal</p><p className="mt-2 text-3xl font-semibold text-neutral-900">{formatVnd(summary.subtotal)}</p></div>
          <div className="manage-surface"><p className="text-sm text-neutral-500">VAT</p><p className="mt-2 text-3xl font-semibold text-neutral-900">{formatVnd(summary.vat)}</p></div>
          <div className="rounded-3xl border border-neutral-200 bg-[var(--color-primary)] p-5 text-white shadow-sm"><p className="text-sm text-white/80">Doanh thu</p><p className="mt-2 text-3xl font-semibold">{formatVnd(summary.revenue)}</p></div>
        </section>

        {breakdownError && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Phân tích nâng cao đang lỗi: {breakdownError}. Danh sách phiếu cơ bản vẫn hiển thị bình thường.</div>}

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_380px]">
          <div className="space-y-5">
            <div className="manage-surface">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">Phân tích doanh thu</h3>
                  <p className="text-sm text-neutral-500">Nhìn nhanh dịch vụ kéo doanh thu và nhân viên đang tạo ra nhiều bill nhất.</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Top dịch vụ</h4>
                  {(breakdown?.by_service ?? []).length === 0 ? <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-500">Chưa có dữ liệu dịch vụ trong kỳ này.</div> : (breakdown?.by_service ?? []).slice(0, 6).map((s, idx) => <div key={`${s.service_name}-${idx}`} className="flex items-center justify-between rounded-2xl border border-neutral-100 bg-neutral-50/70 px-4 py-3 text-sm"><div><div className="font-medium text-neutral-900">{s.service_name}</div><div className="text-neutral-500">SL: {s.qty}</div></div><div className="font-semibold text-neutral-900">{formatVnd(Number(s.subtotal ?? 0))}</div></div>)}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Doanh thu theo nhân viên</h4><span className="text-xs text-neutral-500">{formatVnd(revenueByStaffTotal)}</span></div>
                  {staffRevenue.length === 0 ? <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-500">Chưa có dữ liệu doanh thu theo nhân viên.</div> : staffRevenue.slice(0, 6).map((s) => <div key={s.staffUserId} className="flex items-center justify-between rounded-2xl border border-neutral-100 bg-neutral-50/70 px-4 py-3 text-sm"><div><div className="font-medium text-neutral-900">{s.staff}</div><div className="text-neutral-500">{s.tickets} bill</div></div><div className="font-semibold text-neutral-900">{formatVnd(s.revenue)}</div></div>)}
                </div>
              </div>
            </div>

            <div className="manage-surface">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">Chi tiết bill</h3>
                  <p className="text-sm text-neutral-500">Phần này để soi chi tiết từng bill sau khi đã đọc summary ở trên.</p>
                </div>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700">{filteredTicketRows.length} bill</span>
              </div>
              {error && <p className="mb-3 text-sm text-red-600">Lỗi: {error}</p>}
              {loading ? (
                <div className="space-y-2"><div className="skeleton h-10 rounded-xl" /><div className="skeleton h-10 rounded-xl" /><div className="skeleton h-10 rounded-xl" /></div>
              ) : filteredTicketRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-8 text-sm text-neutral-500">Không có bill nào khớp bộ lọc hiện tại.</div>
              ) : (
                <div className="space-y-3">
                  {filteredTicketRows.map((t) => (
                    <div key={t.id} className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="font-semibold text-neutral-900">{t.staff_user_id ? (staffNameMap.get(t.staff_user_id) ?? t.staff_user_id.slice(0, 8)) : "-"}</div>
                          <div className="text-sm text-neutral-500">{new Date(t.created_at).toLocaleString("vi-VN")}</div>
                        </div>
                        <div className="text-left md:text-right">
                          <div className="text-sm text-neutral-500">Tổng bill</div>
                          <div className="text-lg font-semibold text-neutral-900">{formatVnd(Number(t.totals_json?.grand_total ?? 0))}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-sm text-neutral-600">
                        <span className="rounded-full bg-white px-3 py-1">Trạng thái: <span className="font-medium text-neutral-900">{t.status}</span></span>
                        <span className="rounded-full bg-white px-3 py-1">Subtotal: <span className="font-medium text-neutral-900">{formatVnd(Number(t.totals_json?.subtotal ?? 0))}</span></span>
                        <span className="rounded-full bg-white px-3 py-1">VAT: <span className="font-medium text-neutral-900">{formatVnd(Number(t.totals_json?.vat_total ?? 0))}</span></span>
                        <Link className="manage-quick-link" href={`/manage/reports/${t.id}`}>Xem chi tiết</Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="manage-surface">
              <h3 className="font-semibold text-neutral-900">Theo phương thức thanh toán</h3>
              <p className="mt-1 text-sm text-neutral-500">Kiểm tra tiền về đang dồn ở phương thức nào.</p>
              <div className="mt-4 space-y-2">
                {(breakdown?.by_payment ?? []).length === 0 ? <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-500">Chưa có dữ liệu thanh toán.</div> : (breakdown?.by_payment ?? []).map((p, idx) => <div key={`${p.method}-${idx}`} className="flex items-center justify-between rounded-2xl border border-neutral-100 bg-neutral-50/70 px-4 py-3 text-sm"><div><div className="font-medium text-neutral-900">{p.method}</div><div className="text-neutral-500">{p.count} bill</div></div><div className="font-semibold text-neutral-900">{formatVnd(Number(p.amount ?? 0))}</div></div>)}
              </div>
            </div>

            <div className="manage-surface">
              <h3 className="font-semibold text-neutral-900">Theo nhân viên (giờ làm)</h3>
              <p className="mt-1 text-sm text-neutral-500">So nhanh giữa thời lượng làm việc và hiệu suất doanh thu.</p>
              <div className="mt-4 space-y-2">
                {staffHours.length === 0 ? <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-500">Chưa có dữ liệu giờ làm trong kỳ này.</div> : staffHours.map((s, idx) => <div key={`${s.staff}-${idx}`} className="flex items-center justify-between rounded-2xl border border-neutral-100 bg-neutral-50/70 px-4 py-3 text-sm"><div><div className="font-medium text-neutral-900">{s.staff}</div><div className="text-neutral-500">{s.entries} ca</div></div><div className="font-semibold text-neutral-900">{s.minutes} phút</div></div>)}
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
