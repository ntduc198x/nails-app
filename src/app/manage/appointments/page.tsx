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
      <div className="page-shell">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="page-title">Appointments</h2>
            {refreshing && <span className="text-xs text-neutral-500">Đang làm mới...</span>}
          </div>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <input className="input" placeholder="Tên khách" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />

            <div className="stack-tight">
              <select className="input" value={autoTime ? "auto" : "custom"} onChange={(e) => setAutoTime(e.target.value === "auto")}>
                <option value="auto">Giờ tự động</option>
                <option value="custom">Tùy chỉnh giờ</option>
              </select>
              {!autoTime && <ManageDateTimePicker label="Thời gian lịch hẹn" value={bookingAt} onChange={setBookingAt} />}
              <p className="text-xs text-neutral-500">Nếu trùng ghế hoặc trùng thợ, hệ thống sẽ tự cộng thêm 60 phút.</p>
            </div>

            <div className="stack-tight">
              <select className="input w-full" value={staffUserId} onChange={(e) => setStaffUserId(e.target.value)} disabled={submitting || role === "TECH"}>
                <option value="">-- Chọn thợ --</option>
                {staffOptions.map((s) => <option key={s.userId} value={s.userId}>{s.name}</option>)}
              </select>
              <p className="text-xs text-neutral-500">Tên thợ là bắt buộc cho flow vận hành.</p>
            </div>

            <div className="stack-tight">
              <select className="input w-full" value={resourceId} onChange={(e) => setResourceId(e.target.value)} disabled={submitting} required>
                <option value="">-- Chọn số ghế --</option>
                {resourceOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <p className={`text-xs ${currentConflict ? "text-amber-600" : "text-emerald-600"}`}>{currentConflict ? "Đang trùng ghế hoặc thợ, hệ thống sẽ tự dời +60 phút." : "Khung hiện tại đang dùng được."}</p>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
            Rule hiện tại: chỉ cần khác <b>thợ</b> và khác <b>ghế</b> thì được phép trùng giờ. Nếu trùng ghế hoặc trùng thợ, app sẽ tự dời sang giờ kế tiếp.
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={submitting || !staffUserId || !resourceId}>{submitting ? "Đang xử lý..." : editingId ? "Lưu lịch hẹn" : "Tạo lịch hẹn"}</button>
            {editingId && <button type="button" className="btn btn-outline" onClick={resetForm}>Hủy sửa</button>}
          </div>
        </form>

        <div className="card">
          {error && <p className="mb-3 text-sm text-red-600">Lỗi: {error}</p>}
          {loading ? (
            <p className="text-sm text-neutral-500">Đang tải...</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th className="py-2">Giờ đặt</th>
                    <th>Khách</th>
                    <th>Thợ</th>
                    <th>Ghế</th>
                    <th>Trạng thái</th>
                    <th></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((a) => {
                    const customer = pickCustomerName(a.customers);
                    const staffName = staffOptions.find((s) => s.userId === a.staff_user_id)?.name ?? "-";
                    const resourceName = resourceOptions.find((r) => r.id === a.resource_id)?.name ?? "-";
                    const onlineBooked = isOnlineBooked(a);
                    return (
                      <tr key={a.id} className="border-t border-neutral-100">
                        <td className="py-2">{new Date(a.start_at).toLocaleString("vi-VN")}</td>
                        <td>
                          <div className="flex flex-col gap-1">
                            <span>{customer}</span>
                            {onlineBooked && <span className="inline-flex w-fit rounded-full bg-violet-100 px-2 py-1 text-[11px] font-medium text-violet-700">BOOKED ONLINE</span>}
                          </div>
                        </td>
                        <td>{staffName}</td>
                        <td>{resourceName}</td>
                        <td><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusBadge(a.status)}`}>{a.status}</span></td>
                        <td>
                          <div className="flex flex-wrap items-center gap-2">
                            {a.status === "BOOKED" && (
                              <>
                                <button type="button" className="btn btn-outline px-2 py-1 text-xs" onClick={() => {
                                  setEditingId(a.id);
                                  setCustomerName(customer);
                                  setAutoTime(false);
                                  setBookingAt(toInputValue(new Date(a.start_at)));
                                  setStaffUserId(a.staff_user_id ?? "");
                                  setResourceId(a.resource_id ?? "");
                                }}>Sửa</button>
                                <button onClick={() => onQuickStatus(a.id, "CHECKED_IN")} className="btn btn-outline px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60" disabled={!!updatingId}>{updatingId === a.id ? "Đang xử lý..." : "Check-in"}</button>
                                <span className="mx-1 h-5 w-px bg-neutral-200" />
                                <button onClick={() => onQuickStatus(a.id, "CANCELLED")} className="btn btn-outline px-2 py-1 text-xs text-red-600 disabled:cursor-not-allowed disabled:opacity-60" disabled={!!updatingId}>{updatingId === a.id ? "Đang xử lý..." : "Hủy"}</button>
                              </>
                            )}
                            {a.status === "CHECKED_IN" && (
                              <button onClick={() => onQuickStatus(a.id, "CANCELLED")} className="btn btn-outline px-2 py-1 text-xs text-red-600 disabled:cursor-not-allowed disabled:opacity-60" disabled={!!updatingId}>{updatingId === a.id ? "Đang xử lý..." : "Cancel"}</button>
                            )}
                          </div>
                        </td>
                        <td>
                          {["BOOKED", "CHECKED_IN"].includes(a.status) ? <Link href={`/manage/checkout?customer=${encodeURIComponent(customer)}&appointmentId=${a.id}`} className="btn btn-outline px-2 py-1 text-xs">Open ticket</Link> : <span className="text-xs text-neutral-400">Closed</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card grid gap-3 md:grid-cols-4">
          <select className="input" value={rangeMode} onChange={(e) => setRangeMode(e.target.value as RangeMode)}>
            <option value="day">Trong ngày</option>
            <option value="week">Trong tuần</option>
            <option value="month">Trong tháng</option>
            <option value="custom">Tùy chỉnh</option>
          </select>
          <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} disabled={rangeMode !== "custom"} />
          <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} disabled={rangeMode !== "custom"} />
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">Tất cả trạng thái</option>
            <option value="BOOKED">BOOKED</option>
            <option value="CHECKED_IN">CHECKED_IN</option>
            <option value="DONE">DONE</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="NO_SHOW">NO_SHOW</option>
          </select>
          <div className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">Pending checkout: <b>{pendingCheckoutRows.length}</b></div>
          <div className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">Lịch đang BOOKED: <b>{activeBookedRows.length}</b></div>
          <div className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600 md:col-span-2">Đang xem: <b>{filterRange.from.toLocaleDateString("vi-VN")}</b> → <b>{filterRange.to.toLocaleDateString("vi-VN")}</b></div>
        </div>
      </div>
    </AppShell>
  );
}
