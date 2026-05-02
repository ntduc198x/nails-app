"use client";

import { AppShell } from "@/components/app-shell";
import { getRoleLabel } from "@/lib/role-labels";
import { ManageAlert } from "@/components/manage-alert";
import { ManageDateTimePicker } from "@/components/manage-datetime-picker";
import { MobileSectionHeader } from "@/components/manage-mobile";
import { ManageQuickNav, operationsQuickNav } from "@/components/manage-quick-nav";
import { getCurrentSessionRole, type AppRole } from "@/lib/auth";
import { listCustomerCardsByPhones, type CustomerCrmSummary } from "@/lib/crm";
import {
  BookingRequestRow,
  BookingRequestStatus,
  checkAppointmentCapacity,
  convertBookingRequestToAppointment,
  listBookingRequests,
  updateBookingRequestStatus,
} from "@/lib/booking-requests";
import { listResources, listStaffMembers } from "@/lib/domain";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StaffOption = { userId: string; name: string };
type ResourceOption = { id: string; name: string; type: string };

type OverlapRow = {
  id: string;
  kind?: "appointment" | "booking_request";
  start_at: string;
  end_at: string;
  status?: string;
  customer_name?: string;
  customers?: { name?: string } | { name?: string }[] | null;
};

function toInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function statusTone(status: BookingRequestStatus, isExpired = false) {
  if (status === "NEW") return "bg-blue-100 text-blue-700";
  if (status === "NEEDS_RESCHEDULE" && isExpired) return "bg-red-100 text-red-700";
  if (status === "NEEDS_RESCHEDULE") return "bg-amber-100 text-amber-800";
  if (status === "CONFIRMED") return "bg-violet-100 text-violet-700";
  if (status === "CONVERTED") return "bg-emerald-100 text-emerald-700";
  return "bg-red-100 text-red-700";
}

function statusLabel(status: BookingRequestStatus, isExpired = false) {
  if (status === "NEW") return "MỚI";
  if (status === "NEEDS_RESCHEDULE" && isExpired) return "QUÁ GIỜ";
  if (status === "NEEDS_RESCHEDULE") return "TRÙNG LỊCH";
  if (status === "CONFIRMED") return "ĐÃ XÁC NHẬN";
  if (status === "CONVERTED") return "ĐÃ CHUYỂN";
  return "ĐÃ HỦY";
}

function pickCustomerName(customers: OverlapRow["customers"]) {
  if (Array.isArray(customers)) return customers[0]?.name ?? "Khách";
  return customers?.name ?? "Khách";
}

function isExpiredBookingRequest(row: BookingRequestRow) {
  return !!row.requested_start_at && new Date(row.requested_start_at).getTime() < Date.now();
}

function normalizePhone(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("84") && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}

function formatShortDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function QueueCard({
  row,
  crm,
  active,
  onClick,
}: {
  row: BookingRequestRow;
  crm?: CustomerCrmSummary | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full cursor-pointer rounded-2xl border px-3 py-3 text-left transition ${active ? "border-rose-300 bg-rose-50 shadow-sm" : "border-neutral-200 bg-white hover:bg-neutral-50"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-neutral-900 md:text-base">{row.customer_name}</p>
            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${statusTone(row.status, isExpiredBookingRequest(row))}`}>{statusLabel(row.status, isExpiredBookingRequest(row))}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-500 md:text-xs">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[12px] font-extrabold tracking-[0.02em] text-emerald-800 md:text-xs">{row.customer_phone}</span>
            <span>•</span>
            <span>{row.source === "landing_page" ? "Đặt lịch từ web" : row.source ?? "-"}</span>
          </div>
        </div>
      </div>

      <div className="mt-2 grid gap-1 text-[11px] text-neutral-600 md:text-xs">
        <p className="truncate">{new Date(row.requested_start_at).toLocaleString("vi-VN")}</p>
        {crm ? (
          <div className="mt-1 rounded-2xl border border-violet-200 bg-violet-50 px-2.5 py-2 text-[11px] text-violet-900">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold">Khach cu</span>
              <span>{crm.total_visits} luot</span>
              <span>-</span>
              <span>{crm.customer_status}</span>
            </div>
            <div className="mt-1 text-violet-800">Lan gan nhat: {formatShortDateTime(crm.last_visit_at)}</div>
            {crm.last_service_summary ? <div className="mt-1 line-clamp-1 text-violet-800">Dich vu gan nhat: {crm.last_service_summary}</div> : null}
          </div>
        ) : null}
        <p className="truncate">{row.requested_service ?? "Không rõ dịch vụ"}</p>
      </div>
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{children}</label>;
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full cursor-pointer rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-base md:text-sm text-neutral-900 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100 ${props.className ?? ""}`}
    />
  );
}

export default function BookingRequestsPage() {
  const [rows, setRows] = useState<BookingRequestRow[]>([]);
  const [crmCards, setCrmCards] = useState<CustomerCrmSummary[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [resourceOptions, setResourceOptions] = useState<ResourceOption[]>([]);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [staffUserId, setStaffUserId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [bookingAt, setBookingAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; type: "cancel" } | null>(null);

  async function handleCancelWithConfirm(id: string) {
    if (confirmAction?.id === id) {
      setConfirmAction(null);
      await onCancel(id, true);
    } else {
      setConfirmAction({ id, type: "cancel" });
    }
  }

  function cancelConfirmAction() {
    setConfirmAction(null);
  }

  const [capacityWarning, setCapacityWarning] = useState<string | null>(null);
  const [overlaps, setOverlaps] = useState<OverlapRow[]>([]);
  const [capacityAllowed, setCapacityAllowed] = useState(true);
  const [maxSimultaneous, setMaxSimultaneous] = useState(2);
  const detailRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (opts?.silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [currentRole, requests, staffs, resources] = await Promise.all([
        getCurrentSessionRole(),
        listBookingRequests(),
        listStaffMembers(),
        listResources(),
      ]);
      const activeRequests = requests.filter((row) => row.status === "NEW" || row.status === "NEEDS_RESCHEDULE");
      const cards = await listCustomerCardsByPhones(activeRequests.map((row) => row.customer_phone));

      setRole(currentRole);
      setRows(activeRequests);
      setCrmCards(cards);
      setStaffOptions(staffs as StaffOption[]);
      setResourceOptions(resources as ResourceOption[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tải yêu cầu đặt lịch thất bại");
    } finally {
      if (opts?.silent) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rescheduleRows = useMemo(() => rows.filter((row) => row.status === "NEEDS_RESCHEDULE"), [rows]);
  const newRows = useMemo(() => rows.filter((row) => row.status === "NEW"), [rows]);
  const selectedRow = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);
  const crmByPhone = useMemo(() => {
    const map = new Map<string, CustomerCrmSummary>();
    for (const row of crmCards) {
      const phone = normalizePhone(row.phone);
      if (phone) map.set(phone, row);
    }
    return map;
  }, [crmCards]);
  const selectedCustomerCrm = useMemo(() => {
    if (!selectedRow) return null;
    return crmByPhone.get(normalizePhone(selectedRow.customer_phone) ?? "") ?? null;
  }, [crmByPhone, selectedRow]);

  useEffect(() => {
    if (!selectedRow) return;
    setBookingAt(toInputValue(new Date(selectedRow.requested_start_at)));
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [selectedRow]);

  useEffect(() => {
    let cancelled = false;

    async function runCapacityCheck() {
      if (!selectedRow || !bookingAt) {
        setCapacityWarning(null);
        setOverlaps([]);
        setCapacityAllowed(true);
        return;
      }

      try {
        const start = new Date(bookingAt);
        if (Number.isNaN(start.getTime())) return;
        const end = addMinutes(start, 60);
        const result = await checkAppointmentCapacity({
          bookingRequestId: selectedRow.id,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
        });

        if (cancelled) return;

        setOverlaps(result.overlaps as OverlapRow[]);
        setCapacityAllowed(result.allowed);
        setMaxSimultaneous(result.maxSimultaneous);
        setCapacityWarning(
          result.allowed
            ? null
            : `Khung giờ này đã có ${result.overlapCount} khách trong lịch hẹn. Tối đa cho phép là ${result.maxSimultaneous}. Hãy chọn giờ khác trước khi chuyển lịch.`,
        );
      } catch (e) {
        if (cancelled) return;
        setCapacityAllowed(false);
        setCapacityWarning(e instanceof Error ? e.message : "Không kiểm tra được sức chứa khung giờ.");
      }
    }

    void runCapacityCheck();
    return () => {
      cancelled = true;
    };
  }, [selectedRow, bookingAt]);

  async function onCancel(id: string, confirmed = false) {
    try {
      setSubmitting(true);
      setError(null);
      if (!confirmed && !window.confirm("Hủy yêu cầu đặt lịch?")) return;
      await updateBookingRequestStatus(id, "CANCELLED");
      if (selectedId === id) setSelectedId(null);
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hủy yêu cầu đặt lịch thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  async function onConvert() {
    if (!selectedRow) return;
    if (!capacityAllowed) {
      setError(capacityWarning || "Khung giờ đang vượt số lượng khách cho phép.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const start = new Date(bookingAt);
      const end = addMinutes(start, 60);

      await convertBookingRequestToAppointment({
        bookingRequestId: selectedRow.id,
        staffUserId: staffUserId || null,
        resourceId: resourceId || null,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      });

      setSelectedId(null);
      setStaffUserId("");
      setResourceId("");
      setBookingAt("");
      setCapacityWarning(null);
      setOverlaps([]);
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chuyển yêu cầu đặt lịch sang lịch hẹn thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  const compactHeader = refreshing ? "Đang làm mới..." : `${rows.length} request`;
  const canHandleRequest = role === "OWNER" || role === "MANAGER" || role === "RECEPTION" || role === "TECH";
  const selectionMeta = selectedRow
    ? `${selectedRow.customer_name} · ${selectedRow.status === "NEEDS_RESCHEDULE" ? (isExpiredBookingRequest(selectedRow) ? "Quá giờ" : "Trùng lịch") : "Mới"}`
    : "Chọn request để xử lý";

  return (
    <AppShell>
      <div className="space-y-5 pb-24 md:pb-0">
        <ManageQuickNav items={operationsQuickNav("/manage/booking-requests")} />

        <MobileSectionHeader title="Đặt lịch từ web" meta={<div className="manage-info-box">{compactHeader}</div>} />

        {error ? <ManageAlert tone="error">{error}</ManageAlert> : null}

        <section className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setSelectedId(newRows[0]?.id ?? null)} className="cursor-pointer rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-left transition hover:bg-neutral-100">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-neutral-600">Booking mới</span>
              <span className="text-base font-semibold leading-none text-neutral-900">{newRows.length}</span>
            </div>
          </button>
          <button type="button" onClick={() => setSelectedId(rescheduleRows[0]?.id ?? null)} className="cursor-pointer rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left transition hover:bg-amber-100">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-amber-700">Cần dời lịch</span>
              <span className="text-base font-semibold leading-none text-amber-900">{rescheduleRows.length}</span>
            </div>
          </button>
        </section>

        <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr] xl:items-start">
          <div className="grid gap-3 xl:grid-cols-2">
            <div className="manage-surface p-3.5 md:p-4 h-full">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-neutral-900 md:text-base">Booking mới</h3>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">{newRows.length}</span>
              </div>

              <div className="mt-3 space-y-2">
                {loading ? (
                  <p className="text-sm text-neutral-500">Đang tải...</p>
                ) : newRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-5 text-center text-sm text-neutral-500">
                    Không có booking mới.
                  </div>
                ) : (
                  newRows.map((row) => (
                    <QueueCard key={row.id} row={row} crm={crmByPhone.get(normalizePhone(row.customer_phone) ?? "") ?? null} active={selectedId === row.id} onClick={() => setSelectedId(row.id)} />
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-3.5 shadow-sm h-full">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-amber-900 md:text-base">Cần dời lịch</h3>
                <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-900">{rescheduleRows.length}</span>
              </div>

              <div className="mt-3 space-y-2">
                {loading ? (
                  <p className="text-sm text-amber-800/70">Đang tải...</p>
                ) : rescheduleRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-amber-200 bg-white/70 px-4 py-5 text-center text-sm text-amber-800/70">
                    Không có request nào cần dời lịch.
                  </div>
                ) : (
                  rescheduleRows.map((row) => (
                    <QueueCard key={row.id} row={row} crm={crmByPhone.get(normalizePhone(row.customer_phone) ?? "") ?? null} active={selectedId === row.id} onClick={() => setSelectedId(row.id)} />
                  ))
                )}
              </div>
            </div>
          </div>

          <div ref={detailRef} className="manage-surface space-y-2.5 p-3 md:p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-1.5">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 md:text-base">{selectionMeta}</h3>
              </div>
              {role ? <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-medium text-neutral-600 md:px-3 md:text-[11px]">{getRoleLabel(role)}</span> : null}
            </div>

            {!selectedRow ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
                Chọn một request để bắt đầu xử lý.
              </div>
            ) : (
              <div className="space-y-2">
                <div className={`rounded-2xl border p-2.5 text-sm ${selectedRow.status === "NEEDS_RESCHEDULE" ? "border-amber-200 bg-amber-50" : "border-neutral-200 bg-neutral-50"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-neutral-900 md:text-base">{selectedRow.customer_name}</p>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusTone(selectedRow.status, isExpiredBookingRequest(selectedRow))}`}>{statusLabel(selectedRow.status, isExpiredBookingRequest(selectedRow))}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-500 md:text-xs">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[12px] font-extrabold tracking-[0.02em] text-emerald-800 md:text-xs">{selectedRow.customer_phone}</span>
                        <span>•</span>
                        <span>{selectedRow.source === "landing_page" ? "Đặt lịch từ web" : selectedRow.source ?? "-"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-[0.35fr_0.65fr] gap-2">
                    <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                      <p className="manage-stat-label">Giờ yêu cầu</p>
                      <p className="mt-1 text-xs font-medium text-neutral-900 md:text-sm">{new Date(selectedRow.requested_start_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                      <p className="manage-stat-label">Dịch vụ</p>
                      <p className="mt-1 truncate text-xs font-medium text-neutral-900 md:text-sm">{selectedRow.requested_service ?? "-"}</p>
                    </div>
                  </div>

                  {selectedCustomerCrm ? (
                    <div className="mt-2 rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm text-violet-950">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold">CRM</span>
                        <span className="font-semibold">{selectedCustomerCrm.customer_status}</span>
                        <span>-</span>
                        <span>{selectedCustomerCrm.total_visits} luot</span>
                        <span>-</span>
                        <span>{selectedCustomerCrm.total_spend.toLocaleString("vi-VN")} VND</span>
                      </div>
                      <div className="mt-1 text-xs text-violet-900">Lan gan nhat: {formatShortDateTime(selectedCustomerCrm.last_visit_at)}</div>
                      {selectedCustomerCrm.last_service_summary ? <div className="mt-1 text-xs text-violet-900">Dich vu gan nhat: {selectedCustomerCrm.last_service_summary}</div> : null}
                      {selectedCustomerCrm.care_note ? <div className="mt-1 text-xs text-violet-900">Ghi chu: {selectedCustomerCrm.care_note}</div> : null}
                    </div>
                  ) : null}

                  {selectedRow.status === "NEEDS_RESCHEDULE" ? (
                    <p className={`mt-2 rounded-xl px-3 py-1.5 text-xs md:text-sm ${isExpiredBookingRequest(selectedRow) ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>
                      {isExpiredBookingRequest(selectedRow)
                        ? "Request này đã quá giờ so với thời gian khách chọn. Cần chốt lại giờ mới trước khi convert."
                        : "Request này đang trùng lịch hoặc vượt sức chứa khung giờ. Cần chọn giờ khác trước khi convert."}
                    </p>
                  ) : null}
                </div>

                <div className="booking-request-compact-datetime">
                  <ManageDateTimePicker label="Thời gian chốt" value={bookingAt} onChange={setBookingAt} compact />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Chọn thợ</FieldLabel>
                    <SelectInput value={staffUserId} onChange={(e) => setStaffUserId(e.target.value)}>
                      <option value="">Không gán thợ</option>
                      {staffOptions.map((staff) => (
                        <option key={staff.userId} value={staff.userId}>{staff.name}</option>
                      ))}
                    </SelectInput>
                  </div>
                  <div>
                    <FieldLabel>Chọn ghế</FieldLabel>
                    <SelectInput value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
                      <option value="">Không gán ghế</option>
                      {resourceOptions.map((resource) => (
                        <option key={resource.id} value={resource.id}>{resource.name}</option>
                      ))}
                    </SelectInput>
                  </div>
                </div>

                {capacityWarning ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 md:text-sm">
                    <p className="font-semibold">Khung giờ vượt giới hạn</p>
                    <p className="mt-1">{capacityWarning}</p>
                    {overlaps.length > 0 ? (
                      <div className="mt-2 space-y-1 text-[11px] md:text-xs">
                        {overlaps.map((item) => (
                          <p key={item.id}>• {pickCustomerName(item.customers)} — {new Date(item.start_at).toLocaleString("vi-VN")}</p>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-2 text-[11px] text-red-600 md:text-xs">Tối đa {maxSimultaneous} khách trong cùng khung giờ.</p>
                  </div>
                ) : bookingAt ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-700 md:text-sm">
                    Khung giờ hợp lệ để convert.
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-1.5">
                  {selectedRow.status !== "CONVERTED" && selectedRow.status !== "CANCELLED" ? (
                    <button type="button" className="cursor-pointer rounded-2xl bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white shadow-sm ring-1 ring-[var(--color-primary)]/20 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 md:px-3.5 md:py-2.5 md:text-sm" disabled={submitting || !bookingAt || !capacityAllowed || !canHandleRequest} onClick={() => void onConvert()}>
                      {submitting ? "Đang convert..." : selectedRow.status === "NEEDS_RESCHEDULE" ? "Chốt giờ & tạo lịch" : "Tạo lịch"}
                    </button>
                  ) : null}

                  {selectedRow.status !== "CANCELLED" && selectedRow.status !== "CONVERTED" ? (
                    <>
                      {confirmAction?.id === selectedRow.id ? (
                      <>
                        <button type="button" className="cursor-pointer rounded-2xl border border-red-600 bg-red-600 px-3 py-2 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 md:px-3.5 md:py-2.5 md:text-sm" disabled={submitting} onClick={() => handleCancelWithConfirm(selectedRow.id)}>
                          Xác nhận
                        </button>
                        <button type="button" className="cursor-pointer rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 md:px-3.5 md:py-2.5 md:text-sm" disabled={submitting} onClick={cancelConfirmAction}>
                          Không
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="cursor-pointer rounded-2xl border border-red-500 bg-red-100 px-3 py-2 text-xs font-bold text-red-800 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60 md:px-3.5 md:py-2.5 md:text-sm" disabled={submitting} onClick={() => handleCancelWithConfirm(selectedRow.id)}>
                          Xóa
                        </button>
                        <button type="button" className="cursor-pointer rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 md:px-3.5 md:py-2.5 md:text-sm" disabled={submitting} onClick={() => setSelectedId(null)}>
                          Đóng
                        </button>
                      </>
                    )}
                    </>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
