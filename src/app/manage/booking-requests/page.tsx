"use client";

import { AppShell } from "@/components/app-shell";
import { ManageDateTimePicker } from "@/components/manage-datetime-picker";
import {
  BookingRequestRow,
  BookingRequestStatus,
  checkAppointmentCapacity,
  convertBookingRequestToAppointment,
  listBookingRequests,
  updateBookingRequestStatus,
} from "@/lib/booking-requests";
import { listResources, listStaffMembers } from "@/lib/domain";
import { useCallback, useEffect, useMemo, useState } from "react";

type StaffOption = { userId: string; name: string };
type ResourceOption = { id: string; name: string; type: string };

type OverlapRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  customers?: { name?: string } | { name?: string }[] | null;
};

function toInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function statusTone(status: BookingRequestStatus) {
  if (status === "NEW") return "bg-blue-100 text-blue-700";
  if (status === "NEEDS_RESCHEDULE") return "bg-amber-100 text-amber-800";
  if (status === "CONFIRMED") return "bg-violet-100 text-violet-700";
  if (status === "CONVERTED") return "bg-emerald-100 text-emerald-700";
  return "bg-red-100 text-red-700";
}

function statusLabel(status: BookingRequestStatus) {
  if (status === "NEW") return "MỚI";
  if (status === "NEEDS_RESCHEDULE") return "CẦN DỜI LỊCH";
  if (status === "CONFIRMED") return "ĐÃ XÁC NHẬN";
  if (status === "CONVERTED") return "ĐÃ CHUYỂN APPOINTMENT";
  return "ĐÃ HỦY";
}

function pickCustomerName(customers: OverlapRow["customers"]) {
  if (Array.isArray(customers)) return customers[0]?.name ?? "Khách";
  return customers?.name ?? "Khách";
}

function QueueCard({
  row,
  active,
  onClick,
}: {
  row: BookingRequestRow;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${active ? "border-rose-300 bg-rose-50 shadow-sm" : "border-neutral-200 bg-white hover:bg-neutral-50"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-neutral-900">{row.customer_name}</p>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone(row.status)}`}>{statusLabel(row.status)}</span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">{row.customer_phone}</p>
        </div>
        <span className="text-xs text-neutral-400">{row.source === "landing_page" ? "Online" : row.source ?? "-"}</span>
      </div>

      <div className="mt-3 space-y-1 text-sm text-neutral-600">
        <p>{new Date(row.requested_start_at).toLocaleString("vi-VN")}</p>
        <p>{row.requested_service ?? "Không rõ dịch vụ"}</p>
      </div>
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">{children}</label>;
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100 ${props.className ?? ""}`}
    />
  );
}

export default function BookingRequestsPage() {
  const [rows, setRows] = useState<BookingRequestRow[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [resourceOptions, setResourceOptions] = useState<ResourceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [staffUserId, setStaffUserId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [bookingAt, setBookingAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [capacityWarning, setCapacityWarning] = useState<string | null>(null);
  const [overlaps, setOverlaps] = useState<OverlapRow[]>([]);
  const [capacityAllowed, setCapacityAllowed] = useState(true);
  const [maxSimultaneous, setMaxSimultaneous] = useState(2);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (opts?.silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [requests, staffs, resources] = await Promise.all([
        listBookingRequests(),
        listStaffMembers(),
        listResources(),
      ]);

      setRows(requests.filter((row) => row.status === "NEW" || row.status === "NEEDS_RESCHEDULE"));
      setStaffOptions(staffs as StaffOption[]);
      setResourceOptions(resources as ResourceOption[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load booking requests failed");
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

  useEffect(() => {
    if (!selectedRow) return;
    setBookingAt(toInputValue(new Date(selectedRow.requested_start_at)));
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
            : `Khung giờ này đã có ${result.overlapCount} khách trong appointments. Tối đa cho phép là ${result.maxSimultaneous}. Hãy chọn giờ khác trước khi convert.`,
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

  async function onCancel(id: string) {
    try {
      setSubmitting(true);
      setError(null);
      await updateBookingRequestStatus(id, "CANCELLED");
      if (selectedId === id) setSelectedId(null);
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel booking request failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onMarkNeedsReschedule(id: string) {
    try {
      setSubmitting(true);
      setError(null);
      await updateBookingRequestStatus(id, "NEEDS_RESCHEDULE");
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update booking request failed");
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
      setError(e instanceof Error ? e.message : "Convert booking request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900">Booking requests</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
              Giao diện xử lý theo kiểu inbox vận hành: request mới và request cần dời lịch được gom thành hàng chờ, mở ra xử lý từng case một.
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500 shadow-sm">
            {refreshing ? "Đang làm mới..." : `${rows.length} request cần xử lý`}
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">{error}</div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-amber-900">Cần dời lịch</h3>
                  <p className="mt-1 text-sm text-amber-800">Ưu tiên xử lý trước để chốt giờ mới và convert.</p>
                </div>
                <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-900">{rescheduleRows.length}</span>
              </div>

              <div className="mt-4 space-y-3">
                {loading ? (
                  <p className="text-sm text-amber-800/70">Đang tải...</p>
                ) : rescheduleRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-amber-200 bg-white/70 px-4 py-6 text-center text-sm text-amber-800/70">
                    Không có request nào cần dời lịch.
                  </div>
                ) : (
                  rescheduleRows.map((row) => (
                    <QueueCard key={row.id} row={row} active={selectedId === row.id} onClick={() => setSelectedId(row.id)} />
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">Booking mới</h3>
                  <p className="mt-1 text-sm text-neutral-500">Các booking mới chờ xác nhận và convert sang appointment.</p>
                </div>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">{newRows.length}</span>
              </div>

              <div className="mt-4 space-y-3">
                {loading ? (
                  <p className="text-sm text-neutral-500">Đang tải...</p>
                ) : newRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
                    Không có booking mới.
                  </div>
                ) : (
                  newRows.map((row) => (
                    <QueueCard key={row.id} row={row} active={selectedId === row.id} onClick={() => setSelectedId(row.id)} />
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-neutral-900">Bảng xử lý request</h3>
              <p className="mt-1 text-sm text-neutral-500">Xử lý từng booking như một inbox công việc: xem tình trạng, sửa giờ, gán thợ/ghế và convert.</p>
            </div>

            {!selectedRow ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-10 text-center text-sm text-neutral-500">
                Chọn một request ở cột bên trái để bắt đầu xử lý.
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`rounded-2xl border p-4 text-sm ${selectedRow.status === "NEEDS_RESCHEDULE" ? "border-amber-200 bg-amber-50" : "border-neutral-200 bg-neutral-50"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-neutral-900">{selectedRow.customer_name}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone(selectedRow.status)}`}>{statusLabel(selectedRow.status)}</span>
                      </div>
                      <p className="mt-1 text-sm text-neutral-500">{selectedRow.customer_phone}</p>
                    </div>
                    <div className="text-sm text-neutral-500">
                      <p>{selectedRow.source === "landing_page" ? "Booking online" : selectedRow.source ?? "-"}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Giờ yêu cầu</p>
                      <p className="mt-2 text-sm font-medium text-neutral-900">{new Date(selectedRow.requested_start_at).toLocaleString("vi-VN")}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Dịch vụ</p>
                      <p className="mt-2 text-sm font-medium text-neutral-900">{selectedRow.requested_service ?? "-"}</p>
                    </div>
                  </div>

                  {selectedRow.status === "NEEDS_RESCHEDULE" ? (
                    <p className="mt-4 rounded-xl bg-amber-100 px-3 py-2 text-amber-900">
                      Request này đã được xác nhận nhưng đang bị trùng lịch. Cần sửa giờ trước rồi mới convert.
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <ManageDateTimePicker label="Thời gian chốt" value={bookingAt} onChange={setBookingAt} />

                  <div className="space-y-4">
                    <div>
                      <FieldLabel>Gán thợ</FieldLabel>
                      <SelectInput value={staffUserId} onChange={(e) => setStaffUserId(e.target.value)}>
                        <option value="">-- Chọn thợ --</option>
                        {staffOptions.map((s) => <option key={s.userId} value={s.userId}>{s.name}</option>)}
                      </SelectInput>
                    </div>
                    <div>
                      <FieldLabel>Gán ghế</FieldLabel>
                      <SelectInput value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
                        <option value="">-- Chọn ghế --</option>
                        {resourceOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </SelectInput>
                    </div>
                  </div>
                </div>

                {capacityWarning ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <p className="font-semibold">Khung giờ đang vượt giới hạn</p>
                    <p className="mt-1">{capacityWarning}</p>
                    {overlaps.length > 0 ? (
                      <div className="mt-3 space-y-1">
                        {overlaps.map((item) => (
                          <p key={item.id}>• {pickCustomerName(item.customers)} — {new Date(item.start_at).toLocaleString("vi-VN")}</p>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-3 text-xs text-red-600">Rule hiện tại: tối đa {maxSimultaneous} khách trong appointments cùng đúng khung giờ.</p>
                  </div>
                ) : bookingAt ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                    Khung giờ này đang hợp lệ để convert sang appointment.
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {selectedRow.status === "NEW" ? (
                    <button type="button" className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50" disabled={submitting} onClick={() => void onMarkNeedsReschedule(selectedRow.id)}>
                      Đánh dấu cần dời lịch
                    </button>
                  ) : null}

                  {selectedRow.status !== "CONVERTED" && selectedRow.status !== "CANCELLED" ? (
                    <button type="button" className="rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting || !bookingAt || !capacityAllowed} onClick={() => void onConvert()}>
                      {submitting ? "Đang convert..." : selectedRow.status === "NEEDS_RESCHEDULE" ? "Chốt giờ mới & convert" : "Convert thành appointment"}
                    </button>
                  ) : null}

                  {selectedRow.status !== "CANCELLED" && selectedRow.status !== "CONVERTED" ? (
                    <button type="button" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} onClick={() => void onCancel(selectedRow.id)}>
                      Hủy request
                    </button>
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
