"use client";

import { AppShell } from "@/components/app-shell";
import { ManageDateTimePicker, toDateTimeLocalValue } from "@/components/manage-datetime-picker";
import { getCurrentSessionRole } from "@/lib/auth";
import { createAppointment, listAppointments, listResources, listStaffMembers, updateAppointmentStatus } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type AppointmentRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  staff_user_id?: string | null;
  resource_id?: string | null;
  customers?: { name?: string } | { name?: string }[] | null;
  booking_requests?: { id?: string; source?: string | null } | { id?: string; source?: string | null }[] | null;
};

type StaffOption = { userId: string; name: string };
type ResourceOption = { id: string; name: string; type: string };
type RangeMode = "day" | "week" | "month" | "custom";

function toInputValue(date: Date) {
  return toDateTimeLocalValue(date);
}

function toDateInputValue(date: Date) {
  return toInputValue(date).slice(0, 10);
}

function roundToNextSlot(date: Date, slotMinutes = 15) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  const minutes = d.getMinutes();
  const rounded = Math.ceil(minutes / slotMinutes) * slotMinutes;
  if (rounded === 60) d.setHours(d.getHours() + 1, 0, 0, 0);
  else d.setMinutes(rounded, 0, 0);
  return d;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
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
  const d = startOfDay(date);
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

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function statusBadge(status: string) {
  if (status === "BOOKED") return "bg-slate-100 text-slate-700";
  if (status === "CHECKED_IN") return "bg-blue-100 text-blue-700";
  if (status === "DONE") return "bg-emerald-100 text-emerald-700";
  if (status === "CANCELLED") return "bg-red-100 text-red-700";
  if (status === "NO_SHOW") return "bg-amber-100 text-amber-700";
  return "bg-neutral-100 text-neutral-700";
}

function pickCustomerName(customers: AppointmentRow["customers"]) {
  if (Array.isArray(customers)) return customers[0]?.name ?? "-";
  return customers?.name ?? "-";
}

function pickBookingRequest(row: AppointmentRow) {
  return Array.isArray(row.booking_requests) ? row.booking_requests[0] ?? null : row.booking_requests ?? null;
}

function isOnlineBooked(row: AppointmentRow) {
  const booking = pickBookingRequest(row);
  return booking?.source === "landing_page";
}

function rankStatus(status: string) {
  if (status === "BOOKED") return 0;
  if (status === "CHECKED_IN") return 1;
  if (status === "DONE") return 2;
  if (status === "NO_SHOW") return 3;
  if (status === "CANCELLED") return 4;
  return 5;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">{children}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 ${props.className ?? ""}`}
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100 ${props.className ?? ""}`}
    />
  );
}

export default function AppointmentsPage() {
  const now = roundToNextSlot(new Date());
  const [customerName, setCustomerName] = useState("");
  const [autoTime, setAutoTime] = useState(true);
  const [bookingAt, setBookingAt] = useState(toInputValue(now));
  const [staffUserId, setStaffUserId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [resourceOptions, setResourceOptions] = useState<ResourceOption[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [rangeMode, setRangeMode] = useState<RangeMode>("day");
  const [fromDate, setFromDate] = useState(toDateInputValue(now));
  const [toDate, setToDate] = useState(toDateInputValue(now));
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async (opts?: { force?: boolean }) => {
    const isInitial = rows.length === 0;
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const sessionRes = await supabase?.auth.getSession();
      const userId = sessionRes?.data.session?.user?.id ?? "";
      const currentRole = userId ? await getCurrentSessionRole() : null;

      const [data, staffs, resources] = await Promise.all([
        listAppointments({ force: opts?.force }),
        listStaffMembers(),
        listResources(),
      ]);

      setRole(currentRole);
      setMyUserId(userId);
      setRows(data as AppointmentRow[]);
      setStaffOptions(staffs as StaffOption[]);
      setResourceOptions(resources as ResourceOption[]);
      if (!editingId && currentRole === "TECH" && userId) setStaffUserId(userId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load appointments failed");
    } finally {
      if (isInitial) setLoading(false);
      else setRefreshing(false);
    }
  }, [rows.length, editingId]);

  useEffect(() => {
    void load({ force: true });
  }, [load]);

  const scopedRows = useMemo(() => {
    if (role === "TECH") return rows.filter((r) => r.staff_user_id === myUserId);
    return rows;
  }, [rows, role, myUserId]);

  const filterRange = useMemo(() => {
    const nowDate = new Date();
    if (rangeMode === "day") return { from: startOfDay(nowDate), to: endOfDay(nowDate) };
    if (rangeMode === "week") return { from: startOfWeek(nowDate), to: endOfWeek(nowDate) };
    if (rangeMode === "month") return { from: startOfMonth(nowDate), to: endOfMonth(nowDate) };
    return { from: startOfDay(new Date(fromDate)), to: endOfDay(new Date(toDate)) };
  }, [rangeMode, fromDate, toDate]);

  const filteredRows = useMemo(() => {
    const bookedRows = scopedRows.filter((r) => r.status === "BOOKED");
    const rangedNonBookedRows = scopedRows.filter((r) => {
      if (r.status === "BOOKED") return false;
      const d = new Date(r.start_at).getTime();
      return d >= filterRange.from.getTime() && d <= filterRange.to.getTime();
    });

    const merged = statusFilter === "ALL"
      ? [...bookedRows, ...rangedNonBookedRows]
      : statusFilter === "BOOKED"
        ? bookedRows
        : rangedNonBookedRows.filter((r) => r.status === statusFilter);

    return [...merged].sort((a, b) => {
      const byRank = rankStatus(a.status) - rankStatus(b.status);
      if (byRank !== 0) return byRank;
      return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
    });
  }, [scopedRows, statusFilter, filterRange]);

  const pendingCheckoutRows = useMemo(() => scopedRows.filter((r) => r.status === "CHECKED_IN"), [scopedRows]);
  const activeBookedRows = useMemo(() => scopedRows.filter((r) => r.status === "BOOKED"), [scopedRows]);

  const bookingDate = useMemo(() => {
    if (autoTime) return roundToNextSlot(new Date());
    return roundToNextSlot(new Date(bookingAt));
  }, [autoTime, bookingAt]);

  const slotEndDate = useMemo(() => addMinutes(bookingDate, 60), [bookingDate]);
  const targetStaffUserId = role === "TECH" ? myUserId : staffUserId;

  function isConflict(row: AppointmentRow, slotStart: Date, slotEnd: Date, targetStaffId: string | null, targetResourceId: string | null) {
    const overlaps = new Date(row.start_at).getTime() < slotEnd.getTime() && new Date(row.end_at).getTime() > slotStart.getTime();
    if (!overlaps) return false;
    const sameStaff = !!targetStaffId && row.staff_user_id === targetStaffId;
    const sameResource = !!targetResourceId && row.resource_id === targetResourceId;
    return sameStaff || sameResource;
  }

  function findNextAvailableSlot(slotStart: Date, targetStaffId: string | null, preferredResourceId: string) {
    for (let step = 0; step <= 16; step += 1) {
      const candidateStart = addMinutes(slotStart, step * 60);
      const candidateEnd = addMinutes(candidateStart, 60);
      const hasConflict = activeBookedRows.some((row) => {
        if (editingId && row.id === editingId) return false;
        return isConflict(row, candidateStart, candidateEnd, targetStaffId, preferredResourceId);
      });
      if (!hasConflict) return { start: candidateStart, end: candidateEnd, resourceId: preferredResourceId };
    }
    return null;
  }

  const currentConflict = useMemo(() => {
    if (!resourceId) return false;
    return activeBookedRows.some((row) => {
      if (editingId && row.id === editingId) return false;
      return isConflict(row, bookingDate, slotEndDate, targetStaffUserId || null, resourceId);
    });
  }, [activeBookedRows, bookingDate, slotEndDate, targetStaffUserId, resourceId, editingId]);

  function resetForm() {
    const next = roundToNextSlot(new Date());
    setCustomerName("");
    setAutoTime(true);
    setBookingAt(toInputValue(next));
    setStaffUserId(role === "TECH" ? myUserId : "");
    setResourceId("");
    setEditingId(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!resourceId) {
      setError("Số ghế là bắt buộc.");
      return;
    }

    const resolved = findNextAvailableSlot(bookingDate, targetStaffUserId || null, resourceId);
    if (!resolved) {
      setError("Không tìm được giờ phù hợp gần nhất cho ghế/thợ đã chọn.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await createAppointment({
        appointmentId: editingId,
        customerName,
        startAt: resolved.start.toISOString(),
        endAt: resolved.end.toISOString(),
        staffUserId: targetStaffUserId || null,
        resourceId: resolved.resourceId,
      });
      resetForm();
      await load({ force: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create appointment failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onQuickStatus(id: string, status: "CHECKED_IN" | "CANCELLED") {
    try {
      setUpdatingId(id);
      setError(null);
      await updateAppointmentStatus(id, status);
      await load({ force: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update appointment failed");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900">Appointments</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
              Quản lý lịch hẹn vận hành theo hướng tối giản: tạo nhanh, lọc nhanh, xử lý trạng thái ngay tại chỗ và giữ focus vào các lịch đang BOOKED / CHECKED_IN.
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500 shadow-sm">
            {refreshing ? "Đang làm mới..." : `${filteredRows.length} lịch trong bộ lọc hiện tại`}
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">{error}</div>
        ) : null}

        <form onSubmit={onSubmit} className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Tạo / chỉnh lịch hẹn</h3>
              <p className="mt-1 text-sm text-neutral-500">Nhập nhanh thông tin khách, hệ thống sẽ tự dời slot nếu trùng ghế hoặc trùng thợ.</p>
            </div>
            {currentConflict ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">Có xung đột, sẽ dời giờ</span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">Khung giờ hợp lệ</span>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Tên khách</FieldLabel>
                <TextInput placeholder="Ví dụ: Nguyễn Thị A" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
              </div>

              <div>
                <FieldLabel>Chế độ thời gian</FieldLabel>
                <SelectInput value={autoTime ? "auto" : "custom"} onChange={(e) => setAutoTime(e.target.value === "auto")}>
                  <option value="auto">Giờ tự động</option>
                  <option value="custom">Tùy chỉnh giờ</option>
                </SelectInput>
              </div>

              <div>
                <FieldLabel>Thợ phụ trách</FieldLabel>
                <SelectInput value={staffUserId} onChange={(e) => setStaffUserId(e.target.value)} disabled={submitting || role === "TECH"}>
                  <option value="">-- Chọn thợ --</option>
                  {staffOptions.map((s) => <option key={s.userId} value={s.userId}>{s.name}</option>)}
                </SelectInput>
              </div>

              <div>
                <FieldLabel>Số ghế</FieldLabel>
                <SelectInput value={resourceId} onChange={(e) => setResourceId(e.target.value)} disabled={submitting} required>
                  <option value="">-- Chọn số ghế --</option>
                  {resourceOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </SelectInput>
              </div>
            </div>

            <div className="space-y-4 rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
              {!autoTime ? (
                <ManageDateTimePicker label="Thời gian lịch hẹn" value={bookingAt} onChange={setBookingAt} />
              ) : (
                <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-4 py-4 text-sm text-neutral-500">
                  Hệ thống sẽ tự lấy khung giờ gần nhất phù hợp khi tạo lịch.
                </div>
              )}

              <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 text-sm text-neutral-600">
                Rule hiện tại: chỉ cần khác <b>thợ</b> và khác <b>ghế</b> thì được phép trùng giờ. Nếu trùng ghế hoặc trùng thợ, app sẽ tự dời sang giờ kế tiếp.
              </div>

              <div className="flex gap-2">
                <button className="flex-1 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting || !staffUserId || !resourceId}>
                  {submitting ? "Đang xử lý..." : editingId ? "Lưu lịch hẹn" : "Tạo lịch hẹn"}
                </button>
                {editingId && (
                  <button type="button" className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50" onClick={resetForm}>
                    Hủy sửa
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Pending checkout</p>
            <p className="mt-3 text-2xl font-bold text-neutral-900">{pendingCheckoutRows.length}</p>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Đang booked</p>
            <p className="mt-3 text-2xl font-bold text-neutral-900">{activeBookedRows.length}</p>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Khoảng đang xem</p>
            <p className="mt-3 text-base font-semibold text-neutral-900">{filterRange.from.toLocaleDateString("vi-VN")} → {filterRange.to.toLocaleDateString("vi-VN")}</p>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Lọc trạng thái</p>
            <SelectInput className="mt-3" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">Tất cả</option>
              <option value="BOOKED">BOOKED</option>
              <option value="CHECKED_IN">CHECKED_IN</option>
              <option value="DONE">DONE</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="NO_SHOW">NO_SHOW</option>
            </SelectInput>
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 grid gap-4 lg:grid-cols-4">
            <div>
              <FieldLabel>Khoảng thời gian</FieldLabel>
              <SelectInput value={rangeMode} onChange={(e) => setRangeMode(e.target.value as RangeMode)}>
                <option value="day">Trong ngày</option>
                <option value="week">Trong tuần</option>
                <option value="month">Trong tháng</option>
                <option value="custom">Tùy chỉnh</option>
              </SelectInput>
            </div>
            <div>
              <FieldLabel>Từ ngày</FieldLabel>
              <TextInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} disabled={rangeMode !== "custom"} />
            </div>
            <div>
              <FieldLabel>Đến ngày</FieldLabel>
              <TextInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} disabled={rangeMode !== "custom"} />
            </div>
            <div className="flex items-end">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">Lọc nhanh danh sách lịch theo thời gian và trạng thái.</div>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-neutral-500">Đang tải appointments...</p>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
              Chưa có lịch hẹn nào trong bộ lọc hiện tại.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRows.map((a) => {
                const customer = pickCustomerName(a.customers);
                const staffName = staffOptions.find((s) => s.userId === a.staff_user_id)?.name ?? "-";
                const resourceName = resourceOptions.find((r) => r.id === a.resource_id)?.name ?? "-";
                const onlineBooked = isOnlineBooked(a);
                return (
                  <div key={a.id} className="rounded-3xl border border-neutral-200 bg-neutral-50/70 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-semibold text-neutral-900">{customer}</h4>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBadge(a.status)}`}>{a.status}</span>
                          {onlineBooked ? <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-700">BOOKED ONLINE</span> : null}
                        </div>
                        <p className="mt-1 text-sm text-neutral-500">{new Date(a.start_at).toLocaleString("vi-VN")}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {a.status === "BOOKED" && (
                          <>
                            <button
                              type="button"
                              className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                              onClick={() => {
                                setEditingId(a.id);
                                setCustomerName(customer);
                                setAutoTime(false);
                                setBookingAt(toInputValue(new Date(a.start_at)));
                                setStaffUserId(a.staff_user_id ?? "");
                                setResourceId(a.resource_id ?? "");
                              }}
                            >
                              Sửa
                            </button>
                            <button
                              onClick={() => onQuickStatus(a.id, "CHECKED_IN")}
                              className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={!!updatingId}
                            >
                              {updatingId === a.id ? "Đang xử lý..." : "Check-in"}
                            </button>
                            <button
                              onClick={() => onQuickStatus(a.id, "CANCELLED")}
                              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={!!updatingId}
                            >
                              {updatingId === a.id ? "Đang xử lý..." : "Hủy"}
                            </button>
                          </>
                        )}
                        {a.status === "CHECKED_IN" && (
                          <button
                            onClick={() => onQuickStatus(a.id, "CANCELLED")}
                            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={!!updatingId}
                          >
                            {updatingId === a.id ? "Đang xử lý..." : "Cancel"}
                          </button>
                        )}
                        {[
                          "BOOKED",
                          "CHECKED_IN",
                        ].includes(a.status) ? (
                          <Link href={`/manage/checkout?customer=${encodeURIComponent(customer)}&appointmentId=${a.id}`} className="rounded-2xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600">
                            Open ticket
                          </Link>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Thợ</p>
                        <p className="mt-2 text-base font-semibold text-neutral-900">{staffName}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Ghế</p>
                        <p className="mt-2 text-base font-semibold text-neutral-900">{resourceName}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Thời gian</p>
                        <p className="mt-2 text-base font-semibold text-neutral-900">{new Date(a.start_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
