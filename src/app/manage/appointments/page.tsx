"use client";

import { AppShell } from "@/components/app-shell";
import { ManageAlert } from "@/components/manage-alert";
import { ManageDateTimePicker, toDateTimeLocalValue } from "@/components/manage-datetime-picker";
import { MobileCollapsible, MobileSectionHeader, MobileStickyActions } from "@/components/manage-mobile";
import { ManageQuickNav, operationsQuickNav } from "@/components/manage-quick-nav";
import { getCurrentSessionRole } from "@/lib/auth";
import { createAppointment, ensureOrgContext, listAppointments, listResources, listStaffMembers, updateAppointmentStatus } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type AppointmentRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  staff_user_id?: string | null;
  resource_id?: string | null;
  customers?: { name?: string; phone?: string } | { name?: string; phone?: string }[] | null;
  booking_requests?: { id?: string; source?: string | null } | { id?: string; source?: string | null }[] | null;
};

type StaffOption = { userId: string; name: string };
type ResourceOption = { id: string; name: string; type: string };
type RangeMode = "day" | "week" | "month" | "custom";

const OVERDUE_GRACE_MINUTES = 20;
const STALE_CHECKED_IN_MINUTES = 90;
const CRITICAL_CHECKED_IN_MINUTES = 150;

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

function pickCustomerPhone(customers: AppointmentRow["customers"]) {
  if (Array.isArray(customers)) return customers[0]?.phone ?? "";
  return customers?.phone ?? "";
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

function isOverdueBooked(row: AppointmentRow) {
  if (row.status !== "BOOKED") return false;
  const threshold = Date.now() - OVERDUE_GRACE_MINUTES * 60 * 1000;
  return new Date(row.start_at).getTime() < threshold;
}

function isStaleCheckedIn(row: AppointmentRow & { checked_in_at?: string | null }) {
  if (row.status !== "CHECKED_IN") return false;
  const checkedInTime = row.checked_in_at ? new Date(row.checked_in_at).getTime() : new Date(row.start_at).getTime();
  const threshold = Date.now() - STALE_CHECKED_IN_MINUTES * 60 * 1000;
  return checkedInTime < threshold;
}

function isCriticalCheckedIn(row: AppointmentRow & { checked_in_at?: string | null }) {
  if (row.status !== "CHECKED_IN") return false;
  const checkedInTime = row.checked_in_at ? new Date(row.checked_in_at).getTime() : new Date(row.start_at).getTime();
  const threshold = Date.now() - CRITICAL_CHECKED_IN_MINUTES * 60 * 1000;
  return checkedInTime < threshold;
}

function FieldLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <label className={`block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 ${className}`}>{children}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full cursor-text rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-base md:text-[13px] text-neutral-900 outline-none transition placeholder:text-[13px] placeholder:text-neutral-400 md:placeholder:text-[12px] focus:border-rose-300 focus:ring-4 focus:ring-rose-100 ${props.className ?? ""}`}
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full cursor-pointer rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-[15px] md:text-[13px] text-neutral-900 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100 ${props.className ?? ""}`}
    />
  );
}

function ResourceChip({ active, disabled, label, onClick }: { active: boolean; disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`cursor-pointer rounded-xl border px-2.5 py-1.5 text-[13px] font-medium transition ${active ? "border-rose-300 bg-rose-50 text-rose-700" : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"} ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {label}
    </button>
  );
}

function AppointmentCard({ row, staffName, resourceName, onlineBooked, overdue, staleCheckedIn, criticalCheckedIn, updatingId, onEdit, onQuickStatus, role }: {
  row: AppointmentRow;
  staffName: string;
  resourceName: string;
  onlineBooked: boolean;
  overdue: boolean;
  staleCheckedIn: boolean;
  criticalCheckedIn: boolean;
  updatingId: string | null;
  role: string | null;
  onEdit: () => void;
  onQuickStatus: (id: string, status: "CHECKED_IN" | "CANCELLED") => Promise<void>;
}) {
  const customer = pickCustomerName(row.customers);
  const customerPhone = pickCustomerPhone(row.customers);

  return (
    <div className={`rounded-2xl border bg-white p-3 shadow-sm ${overdue ? "border-amber-300 bg-amber-50/40" : criticalCheckedIn ? "border-fuchsia-300 bg-fuchsia-50/40" : staleCheckedIn ? "border-violet-300 bg-violet-50/40" : "border-neutral-200"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold text-neutral-900">{customer}</h4>
                {customerPhone ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">{customerPhone}</span> : null}
              </div>
              <p className="mt-1 text-xs text-neutral-500">{onlineBooked ? <><b className="font-semibold text-neutral-700">Web</b>{" · "}</> : null}{new Date(row.start_at).toLocaleString("vi-VN")} · {staffName} · {resourceName}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {row.status === "CHECKED_IN"
                ? criticalCheckedIn
                  ? <span className="rounded-full bg-fuchsia-100 px-2 py-0.5 text-[11px] font-medium text-fuchsia-700">ĐÃ LÀM RẤT LÂU</span>
                  : staleCheckedIn
                    ? <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">ĐÃ LÀM LÂU</span>
                    : <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge(row.status)}`}>{row.status}</span>
                : <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge(row.status)}`}>{row.status}</span>}
              {overdue ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">QUÁ GIỜ</span> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {row.status === "BOOKED" && (
            <>
              <button type="button" className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50" onClick={onEdit}>Sửa</button>
              <button onClick={() => void onQuickStatus(row.id, "CHECKED_IN")} className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60" disabled={!!updatingId}>{updatingId === row.id ? "Đang xử lý..." : "Check-in"}</button>
              <button onClick={() => void onQuickStatus(row.id, "CANCELLED")} className="cursor-pointer rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60" disabled={!!updatingId}>{updatingId === row.id ? "Đang xử lý..." : "Hủy"}</button>
            </>
          )}
          {row.status === "CHECKED_IN" && (
            <>
              {role === "BOSS" ? (
                <button onClick={() => void onQuickStatus(row.id, "CANCELLED")} className="cursor-pointer rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60" disabled={!!updatingId}>{updatingId === row.id ? "Đang xử lý..." : "Cancel"}</button>
              ) : (
                <span className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-400">Không thể hủy</span>
              )}
              {criticalCheckedIn ? <button type="button" className="cursor-pointer rounded-xl border border-fuchsia-300 bg-fuchsia-100 px-3 py-2 text-sm font-semibold text-fuchsia-800 transition hover:bg-fuchsia-200 disabled:cursor-not-allowed disabled:opacity-60" disabled={!!updatingId}>Đóng bill ngay</button> : null}
            </>
          )}
          {row.status === "CHECKED_IN" ? (
            <Link href={`/manage/checkout?customer=${encodeURIComponent(customer)}&appointmentId=${row.id}`} className={`cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold text-white transition ${criticalCheckedIn ? "bg-fuchsia-600 hover:bg-fuchsia-700" : "bg-rose-500 hover:bg-rose-600"}`}>{criticalCheckedIn ? "Mở phiếu ngay" : "Mở phiếu"}</Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function OperationsPage() {
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
  const [showRangeFilters, setShowRangeFilters] = useState(false);
  const [fromDate, setFromDate] = useState(toDateInputValue(now));
  const [toDate, setToDate] = useState(toDateInputValue(now));
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showDetailList, setShowDetailList] = useState(false);
  const formRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  function openFilteredDetails(nextStatus: string) {
    setStatusFilter(nextStatus);
    setShowDetailList(true);
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const load = useCallback(async (opts?: { force?: boolean; silent?: boolean }) => {
    const isInitial = rows.length === 0;
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const sessionRes = await supabase?.auth.getSession();
      const userId = sessionRes?.data.session?.user?.id ?? "";
      const currentRole = userId ? await getCurrentSessionRole() : null;
      await ensureOrgContext();

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
      setError(e instanceof Error ? e.message : "Tải dữ liệu vận hành thất bại");
    } finally {
      if (isInitial) setLoading(false);
      else setRefreshing(false);
    }
  }, [rows.length, editingId]);

  useEffect(() => {
    void load({ force: true });
  }, [load]);

  const scopedRows = useMemo(() => {
    if (role !== "TECH") return rows;
    return rows.filter((r) => r.status === "BOOKED" || r.staff_user_id === myUserId);
  }, [rows, role, myUserId]);

  const filterRange = useMemo(() => {
    const nowDate = new Date();
    if (rangeMode === "day") return { from: startOfDay(nowDate), to: endOfDay(nowDate) };
    if (rangeMode === "week") return { from: startOfWeek(nowDate), to: endOfWeek(nowDate) };
    if (rangeMode === "month") return { from: startOfMonth(nowDate), to: endOfMonth(nowDate) };
    return { from: startOfDay(new Date(fromDate)), to: endOfDay(new Date(toDate)) };
  }, [rangeMode, fromDate, toDate]);

  const pendingCheckoutRows = useMemo(() => scopedRows.filter((r) => r.status === "CHECKED_IN"), [scopedRows]);
  const staleCheckedInRows = useMemo(() => pendingCheckoutRows.filter(isStaleCheckedIn), [pendingCheckoutRows]);
  const criticalCheckedInRows = useMemo(() => pendingCheckoutRows.filter(isCriticalCheckedIn), [pendingCheckoutRows]);
  const activeBookedRows = useMemo(() => scopedRows.filter((r) => r.status === "BOOKED"), [scopedRows]);
  const overdueBookedRows = useMemo(() => activeBookedRows.filter(isOverdueBooked), [activeBookedRows]);
  const bookingDate = useMemo(() => autoTime ? roundToNextSlot(new Date()) : roundToNextSlot(new Date(bookingAt)), [autoTime, bookingAt]);
  const slotEndDate = useMemo(() => addMinutes(bookingDate, 60), [bookingDate]);
  const targetStaffUserId = role === "TECH" ? myUserId : staffUserId;

  const filteredRows = useMemo(() => {
    const bookedRows = scopedRows.filter((r) => r.status === "BOOKED");
    const overdueRows = bookedRows.filter(isOverdueBooked);
    const normalBookedRows = bookedRows.filter((r) => !isOverdueBooked(r));
    const rangedNonBookedRows = scopedRows.filter((r) => {
      if (r.status === "BOOKED" || r.status === "CHECKED_IN") return false;
      const d = new Date(r.start_at).getTime();
      return d >= filterRange.from.getTime() && d <= filterRange.to.getTime();
    });
    const checkedInRows = scopedRows.filter((r) => r.status === "CHECKED_IN");
    const criticalRows = checkedInRows.filter(isCriticalCheckedIn);
    const staleRows = checkedInRows.filter((r) => isStaleCheckedIn(r) && !isCriticalCheckedIn(r));
    const freshCheckedInRows = checkedInRows.filter((r) => !isStaleCheckedIn(r));

    const merged = statusFilter === "ALL"
      ? [...overdueRows, ...normalBookedRows, ...criticalRows, ...staleRows, ...freshCheckedInRows, ...rangedNonBookedRows]
: statusFilter === "BOOKED"
          ? rangedNonBookedRows.filter((r) => r.status === "BOOKED")
          : statusFilter === "STALE_CHECKED_IN"
            ? [...criticalRows, ...staleRows]
            : statusFilter === "CHECKED_IN"
              ? checkedInRows
              : rangedNonBookedRows.filter((r) => r.status === statusFilter);

    return [...merged].sort((a, b) => {
      const aRow = a as AppointmentRow & { checked_in_at?: string | null };
      const bRow = b as AppointmentRow & { checked_in_at?: string | null };
      const aGroup = aRow.status === "CHECKED_IN" ? 1 : 0;
      const bGroup = bRow.status === "CHECKED_IN" ? 1 : 0;
      if (aGroup !== bGroup) return aGroup - bGroup;
      const aTime = aRow.checked_in_at ? new Date(aRow.checked_in_at).getTime() : new Date(aRow.start_at).getTime();
      const bTime = bRow.checked_in_at ? new Date(bRow.checked_in_at).getTime() : new Date(bRow.start_at).getTime();
      return aTime - bTime;
    });
  }, [scopedRows, statusFilter, filterRange]);

  function isConflict(row: AppointmentRow, slotStart: Date, slotEnd: Date, targetStaffId: string | null, targetResourceId: string | null) {
    const overlaps = new Date(row.start_at).getTime() < slotEnd.getTime() && new Date(row.end_at).getTime() > slotStart.getTime();
    if (!overlaps) return false;
    const sameStaff = !!targetStaffId && row.staff_user_id === targetStaffId;
    const sameResource = !!targetResourceId && (row.resource_id ?? null) === targetResourceId;
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

  function rebaseDateTimeToToday(dateValue: string) {
    const source = new Date(dateValue);
    if (Number.isNaN(source.getTime())) return toInputValue(roundToNextSlot(new Date()));
    const today = new Date();
    const next = new Date(today.getFullYear(), today.getMonth(), today.getDate(), source.getHours(), source.getMinutes(), 0, 0);
    return toInputValue(next);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const normalizedCustomerName = customerName.trim();
    if (!normalizedCustomerName) {
      setError("Tên khách là bắt buộc.");
      return;
    }
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
      await createAppointment({ appointmentId: editingId, customerName: normalizedCustomerName, startAt: resolved.start.toISOString(), endAt: resolved.end.toISOString(), staffUserId: targetStaffUserId || null, resourceId: resolved.resourceId });
      setStatusFilter("ALL");
      setRangeMode("day");
      resetForm();
      await load({ force: true });
      requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo lịch hẹn thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  async function onQuickStatus(id: string, status: "CHECKED_IN" | "CANCELLED") {
    try {
      setUpdatingId(id);
      setError(null);
      await updateAppointmentStatus(id, status);
      const now = new Date().toISOString();
      setRows((prev) => prev.map((r) => {
        if (r.id !== id) return r;
        if (status === "CHECKED_IN") return { ...r, status, checked_in_at: now };
        return { ...r, status };
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cập nhật lịch hẹn thất bại");
    } finally {
      setUpdatingId(null);
    }
  }

  const nextActionLabel = overdueBookedRows.length > 0
    ? `Có ${overdueBookedRows.length} lịch quá giờ cần xử lý`
    : criticalCheckedInRows.length > 0
      ? `Có ${criticalCheckedInRows.length} lịch check-in rất lâu cần xử lý`
      : staleCheckedInRows.length > 0
        ? `Có ${staleCheckedInRows.length} lịch check-in lâu chưa đóng bill`
      : activeBookedRows.length > 0
        ? `Có ${activeBookedRows.length} lịch đang ở trạng thái booked`
        : pendingCheckoutRows.length > 0
          ? `Có ${pendingCheckoutRows.length} lịch sẵn sàng mở phiếu`
          : "Không có lịch cần xử lý gấp";

  return (
    <AppShell>
      <div className="space-y-6 pb-24 md:pb-0">
        <ManageQuickNav items={operationsQuickNav("/manage/appointments")} />

        <MobileSectionHeader title="Điều phối lịch" meta={<div className="manage-info-box">{refreshing ? "Đang làm mới..." : nextActionLabel}</div>} />

        {error ? <ManageAlert tone="error">{error}</ManageAlert> : null}

        <>
          <section ref={formRef} className="manage-surface space-y-2.5 md:space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-neutral-900 md:text-lg">Tạo lịch nhanh</h3>
                {currentConflict ? <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">Có xung đột</span> : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDetailList(true);
                  requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
                }}
                className="cursor-pointer rounded-2xl border border-neutral-300 bg-neutral-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-700"
              >
                Danh sách lịch
              </button>
            </div>

            <form onSubmit={onSubmit} className="grid gap-2.5 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="grid gap-2 md:hidden">
                <div className="grid gap-2">
                <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2.5">
                  <FieldLabel className="mb-0">Tên khách</FieldLabel>
                  <TextInput placeholder="Ví dụ: Nguyễn Thị A" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2.5">
                  <FieldLabel className="mb-0">Chế độ giờ</FieldLabel>
                  <SelectInput value={autoTime ? "auto" : "custom"} onChange={(e) => setAutoTime(e.target.value === "auto")}><option value="auto">Giờ tự động</option><option value="custom">Tùy chỉnh giờ</option></SelectInput>
                </div>
                <div className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-2.5">
                  <FieldLabel className="mb-0 pt-1.5">Số ghế</FieldLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {resourceOptions.map((r) => <ResourceChip key={r.id} active={resourceId === r.id} label={r.name} onClick={() => setResourceId(r.id)} />)}
                  </div>
                </div>
                <div className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-2.5">
                  <FieldLabel className="mb-0 pt-1.5">Thợ</FieldLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {staffOptions.map((s) => (
                      <ResourceChip key={s.userId} active={staffUserId === s.userId} label={s.name} onClick={() => setStaffUserId(s.userId)} />
                    ))}
                  </div>
                </div>
                {!autoTime ? <div className="pt-0.5"><ManageDateTimePicker label="Thời gian lịch hẹn" value={bookingAt} onChange={setBookingAt} /></div> : null}
                  </div>
              </div>
              <div className="hidden gap-2 md:grid">
                <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2.5">
                  <FieldLabel className="mb-0">Tên khách</FieldLabel>
                  <TextInput placeholder="Ví dụ: Nguyễn Thị A" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2.5">
                  <FieldLabel className="mb-0">Chế độ giờ</FieldLabel>
                  <SelectInput value={autoTime ? "auto" : "custom"} onChange={(e) => setAutoTime(e.target.value === "auto")}><option value="auto">Giờ tự động</option><option value="custom">Tùy chỉnh giờ</option></SelectInput>
                </div>
                <div className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-2.5">
                  <FieldLabel className="mb-0 pt-1.5">Số ghế</FieldLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {resourceOptions.map((r) => <ResourceChip key={r.id} active={resourceId === r.id} label={r.name} onClick={() => setResourceId(r.id)} />)}
                  </div>
                </div>
                <div className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-2.5">
                  <FieldLabel className="mb-0 pt-1.5">Thợ</FieldLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {staffOptions.map((s) => (
                      <ResourceChip key={s.userId} active={staffUserId === s.userId} label={s.name} onClick={() => setStaffUserId(s.userId)} />
                    ))}
                  </div>
                </div>
                {!autoTime ? <div className="pt-0.5"><ManageDateTimePicker label="Thời gian lịch hẹn" value={bookingAt} onChange={setBookingAt} /></div> : null}
              </div>
              <div className="space-y-1.5 rounded-2xl border border-neutral-200 bg-neutral-50 p-2.5">
                {editingId ? <div className="flex items-center justify-end"><button type="button" className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-[13px] font-medium text-neutral-700 transition hover:bg-neutral-50" onClick={resetForm}>Hủy</button></div> : null}
                <button className="w-full cursor-pointer rounded-2xl bg-rose-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting || !staffUserId || !resourceId}>{submitting ? "Đang xử lý..." : editingId ? "Lưu lịch hẹn" : "Tạo lịch hẹn"}</button>
              </div>
            </form>
          </section>

          <section ref={listRef} className="manage-surface md:p-6 space-y-4">
            <div className="hidden space-y-4 md:block">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-neutral-900">Bộ lọc lịch</div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-neutral-700">{filteredRows.length} lịch</div>
                </div>
                <div className="mt-3 grid gap-2 lg:grid-cols-5">
                  <button type="button" onClick={() => setStatusFilter("ALL")} className={`cursor-pointer rounded-2xl px-3 py-2 text-sm font-medium transition ${statusFilter === "ALL" ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"}`}>Tất cả</button>
                  <button type="button" onClick={() => setStatusFilter("BOOKED")} className={`cursor-pointer rounded-2xl px-3 py-2 text-sm font-medium transition ${statusFilter === "BOOKED" ? "bg-amber-500 text-white" : "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"}`}>Booked</button>
                  <button type="button" onClick={() => setStatusFilter("CHECKED_IN")} className={`cursor-pointer rounded-2xl px-3 py-2 text-sm font-medium transition ${statusFilter === "CHECKED_IN" ? "bg-blue-600 text-white" : "border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"}`}>Đã check-in</button>
                  <button type="button" onClick={() => setStatusFilter("DONE")} className={`cursor-pointer rounded-2xl px-3 py-2 text-sm font-medium transition ${statusFilter === "DONE" ? "bg-emerald-600 text-white" : "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"}`}>Đã xong</button>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
                  <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2">
                    <FieldLabel className="mb-0">Khoảng TG</FieldLabel>
                    <SelectInput value={rangeMode} onChange={(e) => setRangeMode(e.target.value as RangeMode)} className="py-2"><option value="day">Trong ngày</option><option value="week">Trong tuần</option><option value="month">Trong tháng</option><option value="custom">Tùy chỉnh</option></SelectInput>
                  </div>
                  <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2">
                    <FieldLabel className="mb-0">Từ ngày</FieldLabel>
                    <TextInput className="py-2" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} disabled={rangeMode !== "custom"} />
                  </div>
                  <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2">
                    <FieldLabel className="mb-0">Đến ngày</FieldLabel>
                    <TextInput className="py-2" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} disabled={rangeMode !== "custom"} />
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-500">{`${filterRange.from.toLocaleDateString("vi-VN")} → ${filterRange.to.toLocaleDateString("vi-VN")}`}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-neutral-900 md:text-base">Chi tiết lịch</h3>
                  <div className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">{filteredRows.length} lịch</div>
                </div>
                {loading ? <p className="text-sm text-neutral-500">Đang tải lịch hẹn...</p> : filteredRows.length === 0 ? <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">Chưa có lịch hẹn nào trong bộ lọc hiện tại.</div> : (
                  <div className="space-y-4">
                    {filteredRows.map((a) => {
                      const customer = pickCustomerName(a.customers);
                      const staff = staffOptions.find((s) => s.userId === a.staff_user_id)?.name ?? "-";
                      const resource = resourceOptions.find((r) => r.id === (a.resource_id ?? ""))?.name ?? "-";
                      const overdue = isOverdueBooked(a);
                      const staleCheckedIn = isStaleCheckedIn(a);
                      const criticalCheckedIn = isCriticalCheckedIn(a);
                      return <AppointmentCard key={`desktop-${a.id}`} row={a} staffName={staff} resourceName={resource} onlineBooked={isOnlineBooked(a)} overdue={overdue} staleCheckedIn={staleCheckedIn} criticalCheckedIn={criticalCheckedIn} updatingId={updatingId} role={role} onEdit={() => { setEditingId(a.id); setCustomerName(customer); setAutoTime(false); setBookingAt(rebaseDateTimeToToday(a.start_at)); setStaffUserId(a.staff_user_id ?? ""); setResourceId(a.resource_id ?? ""); requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }} onQuickStatus={onQuickStatus} />;
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="md:hidden space-y-3">
              <MobileCollapsible summary={<div className="flex items-center justify-between gap-3 pr-2"><span>Bộ lọc lịch</span><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-medium text-neutral-700">{filteredRows.length}</span></div>} defaultOpen={false}>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => openFilteredDetails("ALL")} className={`cursor-pointer rounded-2xl px-3 py-2 text-sm font-medium transition ${statusFilter === "ALL" ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"}`}>Tất cả</button>
                    <button type="button" onClick={() => openFilteredDetails("BOOKED")} className={`cursor-pointer rounded-2xl px-3 py-2 text-sm font-medium transition ${statusFilter === "BOOKED" ? "bg-amber-500 text-white" : "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"}`}>Booked</button>
                    <button type="button" onClick={() => openFilteredDetails("CHECKED_IN")} className={`cursor-pointer rounded-2xl px-3 py-2 text-sm font-medium transition ${statusFilter === "CHECKED_IN" ? "bg-blue-600 text-white" : "border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"}`}>Đã check-in</button>
                    <button type="button" onClick={() => openFilteredDetails("DONE")} className={`cursor-pointer rounded-2xl px-3 py-2 text-sm font-medium transition ${statusFilter === "DONE" ? "bg-emerald-600 text-white" : "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"}`}>Đã xong</button>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">{`${filterRange.from.toLocaleDateString("vi-VN")} → ${filterRange.to.toLocaleDateString("vi-VN")}`}</div>
                  <div className="grid gap-2">
                    <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-2">
                      <FieldLabel className="mb-0">Khoảng TG</FieldLabel>
                      <SelectInput value={rangeMode} onChange={(e) => setRangeMode(e.target.value as RangeMode)} className="py-2 text-sm"><option value="day">Trong ngày</option><option value="week">Trong tuần</option><option value="month">Trong tháng</option><option value="custom">Tùy chỉnh</option></SelectInput>
                    </div>
                    <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-2">
                      <FieldLabel className="mb-0">Từ ngày</FieldLabel>
                      <TextInput className="py-2 text-sm" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} disabled={rangeMode !== "custom"} />
                    </div>
                    <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-2">
                      <FieldLabel className="mb-0">Đến ngày</FieldLabel>
                      <TextInput className="py-2 text-sm" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} disabled={rangeMode !== "custom"} />
                    </div>
                  </div>
                </div>
              </MobileCollapsible>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-neutral-900">Chi tiết lịch</h3>
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-medium text-neutral-700">{filteredRows.length}</span>
              </div>
              {loading ? <p className="text-sm text-neutral-500">Đang tải lịch hẹn...</p> : filteredRows.length === 0 ? <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">Chưa có lịch hẹn nào trong bộ lọc hiện tại.</div> : (
                <div className="space-y-4">
                  {filteredRows.map((a) => {
                    const customer = pickCustomerName(a.customers);
                    const staff = staffOptions.find((s) => s.userId === a.staff_user_id)?.name ?? "-";
                    const resource = resourceOptions.find((r) => r.id === (a.resource_id ?? ""))?.name ?? "-";
                    const overdue = isOverdueBooked(a);
                    const staleCheckedIn = isStaleCheckedIn(a);
                    const criticalCheckedIn = isCriticalCheckedIn(a);
                    return <AppointmentCard key={a.id} row={a} staffName={staff} resourceName={resource} onlineBooked={isOnlineBooked(a)} overdue={overdue} staleCheckedIn={staleCheckedIn} criticalCheckedIn={criticalCheckedIn} updatingId={updatingId} role={role} onEdit={() => { setEditingId(a.id); setCustomerName(customer); setAutoTime(false); setBookingAt(rebaseDateTimeToToday(a.start_at)); setStaffUserId(a.staff_user_id ?? ""); setResourceId(a.resource_id ?? ""); requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }} onQuickStatus={onQuickStatus} />;
                  })}
                </div>
              )}
            </div>
          </section>

          <MobileStickyActions>
            <button type="button" onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="flex-1 cursor-pointer rounded-2xl bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white shadow-md ring-1 ring-[var(--color-primary)]/25 transition hover:brightness-95">
              Form tạo lịch
            </button>
          </MobileStickyActions>
        </>
      </div>
    </AppShell>
  );
}
