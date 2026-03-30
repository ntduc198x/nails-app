"use client";

import { AppShell } from "@/components/app-shell";
import { listResources, listStaffMembers } from "@/lib/domain";
import { ManageDateTimePicker } from "@/components/manage-datetime-picker";
import {
  BookingRequestRow,
  BookingRequestStatus,
  checkAppointmentCapacity,
  convertBookingRequestToAppointment,
  listBookingRequests,
  updateBookingRequestStatus,
} from "@/lib/booking-requests";
import { useCallback, useEffect, useMemo, useState } from "react";

type StaffOption = { userId: string; name: string };
type ResourceOption = { id: string; name: string; type: string };
type QueueFilter = "OPEN" | BookingRequestStatus;

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
  const [statusFilter, setStatusFilter] = useState<QueueFilter>("OPEN");
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

      setRows(requests);
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

  const filteredRows = useMemo(() => {
    if (statusFilter === "OPEN") return rows.filter((row) => ["NEW", "NEEDS_RESCHEDULE"].includes(row.status));
    return rows.filter((row) => row.status === statusFilter);
  }, [rows, statusFilter]);

  const rescheduleRows = useMemo(() => rows.filter((row) => row.status === "NEEDS_RESCHEDULE"), [rows]);
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
      <div className="page-shell">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="page-title">Booking requests</h2>
            <p className="page-subtitle">Hàng chờ xử lý booking online. Khách đã xác nhận nhưng bị trùng lịch sẽ nằm ở mục Cần dời lịch để đổi giờ rồi convert sang appointment.</p>
          </div>
          <div className="flex items-center gap-2">
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as QueueFilter)}>
              <option value="OPEN">Hàng chờ xử lý</option>
              <option value="NEW">Mới</option>
              <option value="NEEDS_RESCHEDULE">Cần dời lịch</option>
            </select>
            {refreshing && <span className="text-xs text-neutral-500">Đang làm mới...</span>}
          </div>
        </div>

        {error && <div className="card text-sm text-red-600">Lỗi: {error}</div>}

        {rescheduleRows.length > 0 && (
          <div className="card border-amber-200 bg-amber-50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-amber-900">Khách đã confirmed nhưng bị trùng lịch</h3>
                <p className="mt-1 text-sm text-amber-800">Những khách này cần đổi giờ rồi mới convert sang appointment.</p>
              </div>
              <span className="rounded-full bg-amber-200 px-3 py-1 text-sm font-semibold text-amber-900">{rescheduleRows.length} khách cần dời lịch</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rescheduleRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${selectedId === row.id ? "border-amber-500 bg-white" : "border-amber-200 bg-white hover:bg-amber-100/60"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-amber-950">{row.customer_name}</p>
                      <p className="mt-1 text-sm text-amber-900/80">{row.customer_phone}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">CẦN DỜI</span>
                  </div>
                  <p className="mt-3 text-sm text-amber-900">{new Date(row.requested_start_at).toLocaleString("vi-VN")}</p>
                  <p className="mt-2 text-sm text-amber-800">{row.requested_service ?? "Không rõ dịch vụ"}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.9fr]">
          <div className="card">
            {loading ? (
              <p className="text-sm text-neutral-500">Đang tải booking requests...</p>
            ) : filteredRows.length === 0 ? (
              <p className="text-sm text-neutral-500">Chưa có yêu cầu nào trong bộ lọc hiện tại.</p>
            ) : (
              <div className="space-y-3">
                {filteredRows.map((row) => {
                  const active = row.id === selectedId;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${active ? "border-[var(--color-primary)] bg-[#fff1f3]" : "border-neutral-200 hover:bg-neutral-50"}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{row.customer_name}</p>
                          <p className="mt-1 text-sm text-neutral-500">{row.customer_phone}</p>
                          <p className="mt-2 text-sm text-neutral-600">{new Date(row.requested_start_at).toLocaleString("vi-VN")}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(row.status)}`}>{statusLabel(row.status)}</span>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm text-neutral-600 md:grid-cols-2">
                        <p><b>Dịch vụ:</b> {row.requested_service ?? "-"}</p>
                        <p><b>Thợ mong muốn:</b> {row.preferred_staff ?? "-"}</p>
                        <p><b>Nguồn:</b> {row.source === "landing_page" ? "Booking online" : row.source ?? "-"}</p>
                        <p><b>Trạng thái DB:</b> {row.status}</p>
                        <p className="md:col-span-2"><b>Ghi chú:</b> {row.note ?? "-"}</p>
                        {row.appointment_id && <p className="md:col-span-2"><b>Appointment:</b> {row.appointment_id}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Xử lý request</h3>
              <p className="mt-1 text-sm text-neutral-500">Khi sửa giờ cho khách trùng lịch, hệ thống sẽ check lại appointments. Nếu khung giờ đã vượt ngưỡng khách cho phép thì sẽ không cho convert.</p>
            </div>

            {!selectedRow ? (
              <p className="text-sm text-neutral-500">Chưa chọn request nào.</p>
            ) : (
              <>
                <div className={`rounded-2xl border p-4 text-sm ${selectedRow.status === "NEEDS_RESCHEDULE" ? "border-amber-200 bg-amber-50" : "border-neutral-200 bg-neutral-50"}`}>
                  <p><b>Khách:</b> {selectedRow.customer_name}</p>
                  <p><b>SĐT:</b> {selectedRow.customer_phone}</p>
                  <p><b>Giờ yêu cầu:</b> {new Date(selectedRow.requested_start_at).toLocaleString("vi-VN")}</p>
                  <p><b>Dịch vụ:</b> {selectedRow.requested_service ?? "-"}</p>
                  <p><b>Trạng thái hiện tại:</b> {statusLabel(selectedRow.status)}</p>
                  {selectedRow.status === "NEEDS_RESCHEDULE" && (
                    <p className="mt-2 rounded-xl bg-amber-100 px-3 py-2 text-amber-900">
                      Khách này đã confirmed nhưng đang bị trùng lịch. Cần sửa giờ trước rồi mới convert sang appointment.
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <ManageDateTimePicker label="Thời gian chốt" value={bookingAt} onChange={setBookingAt} />

                  <label className="block text-sm">
                    <span className="mb-1 block text-neutral-600">Gán thợ</span>
                    <select className="input w-full" value={staffUserId} onChange={(e) => setStaffUserId(e.target.value)}>
                      <option value="">-- Chọn thợ --</option>
                      {staffOptions.map((s) => <option key={s.userId} value={s.userId}>{s.name}</option>)}
                    </select>
                  </label>

                  <label className="block text-sm">
                    <span className="mb-1 block text-neutral-600">Gán ghế</span>
                    <select className="input w-full" value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
                      <option value="">-- Chọn ghế --</option>
                      {resourceOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </label>
                </div>

                {capacityWarning ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <p className="font-semibold">Khung giờ đang vượt giới hạn</p>
                    <p className="mt-1">{capacityWarning}</p>
                    {overlaps.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {overlaps.map((item) => (
                          <p key={item.id}>• {pickCustomerName(item.customers)} — {new Date(item.start_at).toLocaleString("vi-VN")}</p>
                        ))}
                      </div>
                    )}
                    <p className="mt-3 text-xs text-red-600">Rule hiện tại: tối đa {maxSimultaneous} khách trong appointments cùng đúng khung giờ.</p>
                  </div>
                ) : bookingAt ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                    Khung giờ này đang hợp lệ để convert sang appointment.
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {selectedRow.status === "NEW" && (
                    <button type="button" className="btn btn-outline" disabled={submitting} onClick={() => void onMarkNeedsReschedule(selectedRow.id)}>
                      Đánh dấu cần dời lịch
                    </button>
                  )}

                  {selectedRow.status !== "CONVERTED" && selectedRow.status !== "CANCELLED" && (
                    <button type="button" className="btn btn-primary" disabled={submitting || !bookingAt || !capacityAllowed} onClick={() => void onConvert()}>
                      {submitting ? "Đang convert..." : selectedRow.status === "NEEDS_RESCHEDULE" ? "Chốt giờ mới & convert" : "Convert thành appointment"}
                    </button>
                  )}

                  {selectedRow.status !== "CANCELLED" && selectedRow.status !== "CONVERTED" && (
                    <button type="button" className="btn btn-outline text-red-600" disabled={submitting} onClick={() => void onCancel(selectedRow.id)}>
                      Hủy request
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
