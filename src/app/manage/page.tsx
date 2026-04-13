"use client";

import { AppShell } from "@/components/app-shell";
import { MobileSectionHeader } from "@/components/manage-mobile";
import { ManageQuickNav } from "@/components/manage-quick-nav";
import { ManageStatCard } from "@/components/manage-stat-card";
import { countNewBookingRequests, listBookingRequests, type BookingRequestRow } from "@/lib/booking-requests";
import { listAppointments, listStaffMembers } from "@/lib/domain";
import { formatVnd } from "@/lib/mock-data";
import { getReportBreakdown, getStaffRevenueInRange } from "@/lib/reporting";
import { useCallback, useEffect, useRef, useState } from "react";

type DashboardAppointment = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  staff_user_id?: string | null;
  customers?: { name?: string } | { name?: string }[] | null;
};

type DashboardData = {
  appointmentsToday: number;
  waiting: number;
  active: number;
  revenue: number;
  closedCount: number;
  waitingSchedule: Array<{ time: string; customer: string; staff: string }>;
  activeServiceBoard: Array<{ time: string; customer: string; staff: string; status: string; appointmentId: string }>;
};

function pickCustomerName(customers: DashboardAppointment["customers"]) {
  if (Array.isArray(customers)) return customers[0]?.name ?? "-";
  return customers?.name ?? "-";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(", ", " • ");
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const hasLoadedRef = useRef(false);
  const [topServices, setTopServices] = useState<Array<{ service_name: string; qty: number; subtotal: number }>>([]);
  const [topStaffRevenue, setTopStaffRevenue] = useState<Array<{ staffUserId: string; staff: string; revenue: number; tickets: number }>>([]);
  const [newBookingCount, setNewBookingCount] = useState(0);
  const [latestBookingRequests, setLatestBookingRequests] = useState<BookingRequestRow[]>([]);
  const [data, setData] = useState<DashboardData>({
    appointmentsToday: 0,
    waiting: 0,
    active: 0,
    revenue: 0,
    closedCount: 0,
    waitingSchedule: [],
    activeServiceBoard: [],
  });

  const load = useCallback(async (opts?: { force?: boolean; silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      setError(null);

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const [appointments, staffRows, breakdown, staffRevenue, bookingRequests, bookingCount] = await Promise.all([
        listAppointments({ force: opts?.force }),
        listStaffMembers(),
        getReportBreakdown(start.toISOString(), end.toISOString()),
        getStaffRevenueInRange(start.toISOString(), end.toISOString()),
        listBookingRequests("NEW"),
        countNewBookingRequests(),
      ]);

      const staffMap = new Map((staffRows ?? []).map((s: { userId: string; name: string }) => [s.userId, s.name]));
      const rows = (appointments ?? []) as DashboardAppointment[];
      const appointmentsTodayRows = rows.filter((row) => {
        const t = new Date(row.start_at).getTime();
        return t >= start.getTime() && t < end.getTime();
      });
      const waitingRows = rows.filter((row) => row.status === "BOOKED");
      const activeRows = rows.filter((row) => row.status === "CHECKED_IN");

      setData({
        appointmentsToday: appointmentsTodayRows.length,
        waiting: waitingRows.length,
        active: activeRows.length,
        revenue: Number(breakdown.summary?.revenue ?? 0),
        closedCount: Number(breakdown.summary?.count ?? 0),
        waitingSchedule: waitingRows
          .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
          .map((row) => ({
            time: formatDateTime(row.start_at),
            customer: pickCustomerName(row.customers),
            staff: row.staff_user_id ? (staffMap.get(row.staff_user_id) ?? row.staff_user_id.slice(0, 8)) : "-",
          })),
        activeServiceBoard: activeRows
          .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
          .map((row) => ({
            appointmentId: row.id,
            time: formatDateTime(row.start_at),
            customer: pickCustomerName(row.customers),
            staff: row.staff_user_id ? (staffMap.get(row.staff_user_id) ?? row.staff_user_id.slice(0, 8)) : "-",
            status: row.status,
          })),
      });

      setTopServices((breakdown.by_service ?? []).slice(0, 3));
      setTopStaffRevenue(staffRevenue.slice(0, 5));
      setLatestBookingRequests((bookingRequests as BookingRequestRow[]).slice(0, 5));
      setNewBookingCount(bookingCount);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load dashboard failed");
    } finally {
      if (!opts?.silent) setLoading(false);
      hasLoadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    const id = setInterval(() => {
      void load({ silent: true });
    }, 30000);
    return () => clearInterval(id);
  }, [load]);

  const avgBill = data.closedCount ? data.revenue / data.closedCount : 0;

  return (
    <AppShell>
      <div className="page-shell space-y-4">
        <ManageQuickNav
          items={[
            { href: "/manage/booking-requests", label: `Yêu cầu đặt lịch${newBookingCount > 0 ? ` (${newBookingCount})` : ""}`, accent: true },
            { href: "/manage/technician", label: "Bảng kỹ thuật" },
            { href: "/manage/appointments", label: "Lịch hẹn" },
            { href: "/manage/checkout", label: "Thanh toán" },
            { href: "/manage/shifts", label: "Ca làm" },
          ]}
        />

        <section className="manage-surface">
          <MobileSectionHeader
            title="Tổng quan"
            meta={<div className="text-right text-xs text-neutral-500"><p>{lastUpdated ? `Cập nhật lúc ${lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "Đang tải dữ liệu..."}</p></div>}
          />
          {error && <p className="mt-2 text-sm text-red-600">Lỗi: {error}</p>}
        </section>

        <section className="page-grid md:grid-cols-4">
          <ManageStatCard label="Lịch hôm nay" value={loading ? "..." : data.appointmentsToday} className="text-3xl font-bold" />
          <ManageStatCard label="Khách chờ" value={loading ? "..." : data.waiting} className="text-3xl font-bold" />
          <ManageStatCard label="Đang phục vụ" value={loading ? "..." : data.active} className="text-3xl font-bold" />
          <ManageStatCard label="Doanh thu hôm nay" value={loading ? "..." : formatVnd(data.revenue)} className="text-3xl font-bold" />
        </section>

        <section className="page-grid md:grid-cols-3">
          <div className="card">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Booking requests mới</h3>
              <a href="/manage/booking-requests" className="text-xs font-medium text-[var(--color-primary)] underline underline-offset-2">Mở trang xử lý</a>
            </div>
            <div className="mt-4 space-y-2">
              {loading ? (
                <><div className="skeleton h-16 rounded-2xl" /><div className="skeleton h-16 rounded-2xl" /></>
              ) : latestBookingRequests.length ? (
                latestBookingRequests.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-neutral-100 px-4 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{item.customer_name}</p>
                        <p className="mt-1 text-neutral-500">{item.customer_phone}</p>
                      </div>
                      <span className="badge-soft">{item.status}</span>
                    </div>
                    <p className="mt-2 text-neutral-600">{new Date(item.requested_start_at).toLocaleString("vi-VN")}</p>
                    <p className="text-neutral-500">DV: {item.requested_service ?? "-"}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-500">Chưa có booking request mới.</p>
              )}
            </div>
          </div>

          <div className="card md:col-span-2">
            <h3 className="text-lg font-semibold">Hiệu suất thanh toán</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-neutral-500">Tổng bill closed</p>
                <p className="text-3xl font-bold">{loading ? "..." : data.closedCount}</p>
                <p className="mt-3 text-sm text-neutral-500">Doanh thu / bill trung bình</p>
                <p className="text-lg font-semibold">{loading ? "..." : `${formatVnd(data.revenue)} / ${formatVnd(avgBill)}`}</p>
              </div>
              <div>
                <p className="mb-2 text-sm text-neutral-500">Khách chờ</p>
                {loading ? (
                  <p className="text-sm">...</p>
                ) : data.waitingSchedule.length ? (
                  <div className="space-y-2">
                    {data.waitingSchedule.slice(0, 5).map((item, idx) => (
                      <div key={`${item.time}-${item.customer}-${idx}`} className="rounded-lg border border-neutral-100 px-3 py-2 text-sm">
                        <p className="font-medium">{item.customer}</p>
                        <p className="text-neutral-500">{item.time}</p>
                        <p className="text-neutral-500">Thợ: {item.staff}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">Chưa có khách chờ.</p>
                )}
              </div>
              <div>
                <p className="mb-2 text-sm text-neutral-500">Khách đang phục vụ</p>
                {loading ? (
                  <p className="text-sm">...</p>
                ) : data.activeServiceBoard.length ? (
                  <div className="space-y-2">
                    {data.activeServiceBoard.slice(0, 5).map((item, idx) => (
                      <div key={`${item.customer}-${item.appointmentId}-${idx}`} className="rounded-lg border border-neutral-100 px-3 py-2 text-sm">
                        <p className="font-medium">{item.customer}</p>
                        <p className="text-neutral-500">Thợ: {item.staff}</p>
                        <p className="text-neutral-500">{item.time}</p>
                        <div className="mt-2">
                          <a href={`/manage/checkout?appointmentId=${item.appointmentId}&customer=${encodeURIComponent(item.customer)}`} className="rounded-lg border border-[#eadfce] bg-[#f6efe6] px-3 py-1 text-xs font-medium transition hover:bg-[var(--color-primary)] hover:text-white">Checkout</a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">Chưa có khách đang phục vụ.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="page-grid md:grid-cols-2">
          <div className="card">
            <h3 className="text-lg font-semibold">Top dịch vụ hôm nay</h3>
            <div className="mt-4 space-y-2 text-sm">
              {topServices.length === 0 ? (
                <p className="text-neutral-500">Chưa có dữ liệu dịch vụ hôm nay.</p>
              ) : (
                topServices.map((s, idx) => (
                  <div key={`${s.service_name}-${idx}`} className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2">
                    <div>
                      <p className="font-medium">{s.service_name}</p>
                      <p className="text-xs text-neutral-500">SL: {s.qty}</p>
                    </div>
                    <p className="font-semibold">{formatVnd(Number(s.subtotal))}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold">Top nhân viên theo doanh thu hôm nay</h3>
            <div className="mt-4 space-y-2 text-sm">
              {topStaffRevenue.length === 0 ? (
                <p className="text-neutral-500">Chưa có dữ liệu doanh thu theo nhân viên hôm nay.</p>
              ) : (
                topStaffRevenue.map((s) => (
                  <div key={s.staffUserId} className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2">
                    <div>
                      <p className="font-medium">{s.staff}</p>
                      <p className="text-xs text-neutral-500">{s.tickets} bill</p>
                    </div>
                    <p className="font-semibold">{formatVnd(s.revenue)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
