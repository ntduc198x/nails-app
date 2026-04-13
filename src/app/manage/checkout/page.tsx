"use client";

import { AppShell } from "@/components/app-shell";
import { ManageAlert } from "@/components/manage-alert";
import { MobileCollapsible, MobileInfoGrid, MobileSectionHeader, MobileStickyActions } from "@/components/manage-mobile";
import { ManageQuickNav } from "@/components/manage-quick-nav";
import { ManageStatCard } from "@/components/manage-stat-card";
import { getCurrentSessionRole, type AppRole } from "@/lib/auth";
import { createCheckout, hasOpenShift, listCheckedInAppointments, listRecentTickets, listServices } from "@/lib/domain";
import { formatVnd } from "@/lib/mock-data";
import { useCallback, useEffect, useMemo, useState } from "react";

type ServiceRow = { id: string; name: string; base_price: number; vat_rate: number };
type TicketRow = { id: string; status: string; totals_json?: { grand_total?: number }; created_at: string; customers?: { name: string } | { name: string }[] | null; receipts?: { public_token: string; expires_at: string }[] };
type CheckedInAppointment = { id: string; start_at: string; customers?: { name: string } | { name: string }[] | null };
type RangeMode = "day" | "week" | "month" | "custom";

function mapCheckoutError(message: string) {
  if (message.includes("INVALID_SERVICES")) return "Dịch vụ không hợp lệ hoặc đã bị xóa.";
  if (message.includes("FORBIDDEN")) return "Bạn không có quyền tạo checkout.";
  if (message.includes("INVALID_PAYMENT_METHOD")) return "Phương thức thanh toán không hợp lệ.";
  if (message.includes("CHECKOUT_LINES_REQUIRED")) return "Vui lòng chọn ít nhất 1 dịch vụ.";
  if (message.includes("CUSTOMER_NAME_REQUIRED")) return "Vui lòng nhập tên khách.";
  if (message.includes("INVALID_APPOINTMENT_STATUS_TRANSITION")) return "Appointment không thể chuyển sang trạng thái DONE.";
  if (message.includes("Could not choose the best candidate function")) return "RPC checkout đang bị trùng phiên bản. Chạy cleanup_checkout_rpc_overloads.sql rồi thử lại.";
  return message;
}

function startOfDay(date: Date) { const d = new Date(date); d.setHours(0,0,0,0); return d; }
function endOfDay(date: Date) { const d = new Date(date); d.setHours(23,59,59,999); return d; }
function startOfWeek(date: Date) { const d = startOfDay(date); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return d; }
function endOfWeek(date: Date) { const d = startOfWeek(date); d.setDate(d.getDate() + 6); d.setHours(23,59,59,999); return d; }
function startOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0); }
function endOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999); }
function toDateInputValue(date: Date) { const y = date.getFullYear(); const m = `${date.getMonth() + 1}`.padStart(2, "0"); const d = `${date.getDate()}`.padStart(2, "0"); return `${y}-${m}-${d}`; }

export default function CheckoutPage() {
  const today = new Date();
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [checkedInAppointments, setCheckedInAppointments] = useState<CheckedInAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [techShiftOpen, setTechShiftOpen] = useState<boolean | null>(null);
  const [lastReceipt, setLastReceipt] = useState<string | null>(null);
  const [receiptLink, setReceiptLink] = useState<string | null>(null);
  const [dedupeNotice, setDedupeNotice] = useState<string | null>(null);
  const [rangeMode, setRangeMode] = useState<RangeMode>("day");
  const [fromDate, setFromDate] = useState(toDateInputValue(today));
  const [toDate, setToDate] = useState(toDateInputValue(today));

  const [customerName, setCustomerName] = useState("");
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [lines, setLines] = useState<Array<{ serviceId: string; qty: number }>>([{ serviceId: "", qty: 1 }]);

  const range = useMemo(() => {
    const now = new Date();
    if (rangeMode === "day") return { from: startOfDay(now), to: endOfDay(now) };
    if (rangeMode === "week") return { from: startOfWeek(now), to: endOfWeek(now) };
    if (rangeMode === "month") return { from: startOfMonth(now), to: endOfMonth(now) };
    return { from: startOfDay(new Date(fromDate)), to: endOfDay(new Date(toDate)) };
  }, [fromDate, rangeMode, toDate]);

  const load = useCallback(async () => {
    const isInitial = services.length === 0 && tickets.length === 0;
    try {
      if (isInitial) setLoading(true); else setRefreshing(true);
      setError(null);
      const currentRole = await getCurrentSessionRole();
      setRole(currentRole);
      if (!["OWNER", "MANAGER", "RECEPTION", "ACCOUNTANT", "TECH"].includes(currentRole)) throw new Error("Vai trò hiện tại không có quyền truy cập trang thanh toán");
      const [serviceRows, ticketRows, checkedInRows, openShift] = await Promise.all([
        listServices(),
        listRecentTickets({ fromIso: range.from.toISOString(), toIso: range.to.toISOString(), limit: 200, force: true }),
        listCheckedInAppointments(),
        currentRole === "TECH" ? hasOpenShift() : Promise.resolve(true),
      ]);
      setServices(serviceRows as ServiceRow[]);
      setTickets(ticketRows as TicketRow[]);
      setCheckedInAppointments(checkedInRows as CheckedInAppointment[]);
      setTechShiftOpen(openShift);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tải dữ liệu thanh toán thất bại");
    } finally {
      if (isInitial) setLoading(false); else setRefreshing(false);
    }
  }, [range.from, range.to, services.length, tickets.length]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const qs = new URLSearchParams(window.location.search);
      const customer = qs.get("customer");
      const appointment = qs.get("appointmentId");
      if (customer) setCustomerName(customer);
      if (appointment) setAppointmentId(appointment);
    }
    void load();
  }, [load]);

  const estimatedTotal = useMemo(() => {
    let subtotal = 0; let vat = 0;
    for (const line of lines) {
      const s = services.find((x) => x.id === line.serviceId); if (!s) continue;
      const unit = Number(s.base_price); const rate = Number(s.vat_rate);
      subtotal += unit * line.qty; vat += unit * line.qty * rate;
    }
    return subtotal + vat;
  }, [lines, services]);

  const ticketSummary = useMemo(() => ({ count: tickets.length, total: tickets.reduce((sum, t) => sum + Number(t.totals_json?.grand_total ?? 0), 0) }), [tickets]);
  const selectedServices = useMemo(() => lines.map((line) => ({ ...line, service: services.find((service) => service.id === line.serviceId) ?? null })).filter((line) => line.service), [lines, services]);

  function addLine() { setLines((prev) => [...prev, { serviceId: "", qty: 1 }]); }
  function onSelectCheckedInAppointment(id: string) { setAppointmentId(id || null); const picked = checkedInAppointments.find((a) => a.id === id); const customer = Array.isArray(picked?.customers) ? picked?.customers[0]?.name : picked?.customers?.name; if (customer) setCustomerName(customer); }
  function updateLine(index: number, patch: Partial<{ serviceId: string; qty: number }>) { setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l))); }
  function removeLine(index: number) { setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index))); }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    try {
      setSubmitting(true); setError(null); setDedupeNotice(null);
      if (role === "ACCOUNTANT") throw new Error("Vai trò hiện tại không được phép tạo thanh toán.");
      if (role === "TECH") {
        const openShift = await hasOpenShift();
        setTechShiftOpen(openShift);
        if (!openShift) throw new Error("TECH chỉ được checkout khi đang mở ca.");
      }
      const valid = lines.filter((l) => l.serviceId && l.qty > 0);
      if (!valid.length) throw new Error("Vui lòng chọn ít nhất 1 dịch vụ trước khi thanh toán");
      const idempotencyKey = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await createCheckout({ customerName, paymentMethod, lines: valid, appointmentId: appointmentId ?? undefined, idempotencyKey });
      setLastReceipt(result.receiptToken || null);
      setReceiptLink(result.receiptToken && typeof window !== "undefined" ? `${window.location.origin}/receipt/${result.receiptToken}` : null);
      if (result.deduped) setDedupeNotice("Đã chặn tạo bill trùng do thao tác bấm thanh toán lặp nhanh.");
      setCustomerName(""); setAppointmentId(null); setPaymentMethod("CASH"); setLines([{ serviceId: "", qty: 1 }]);
      await load();
    } catch (e) {
      if (e instanceof Error) setError(mapCheckoutError(e.message));
      else if (e && typeof e === "object" && "message" in e) setError(mapCheckoutError(String((e as { message?: unknown }).message ?? "Thanh toán thất bại")));
      else setError("Thanh toán thất bại");
    } finally { setSubmitting(false); }
  }

  const statusMeta = refreshing
    ? "Đang làm mới..."
    : role === "TECH"
      ? techShiftOpen ? "Đang mở ca" : "Chưa mở ca"
      : `${ticketSummary.count} bill`;

  return (
    <AppShell>
      <div className="space-y-5 pb-24 md:pb-0">
        <ManageQuickNav
          items={[
            { href: "/manage/technician", label: "Bảng kỹ thuật", accent: true },
            { href: "/manage/appointments", label: "Lịch hẹn" },
            { href: "/manage/shifts", label: "Ca làm" },
          ]}
        />

        <MobileSectionHeader title="Thanh toán" meta={<div className="manage-info-box">{statusMeta}</div>} />

        {error ? <ManageAlert tone="error">Lỗi: {error}</ManageAlert> : null}
        {lastReceipt ? <ManageAlert tone="info">Tạo hóa đơn thành công. Mã công khai: <code>{lastReceipt}</code>{receiptLink ? <> · <a className="underline" href={receiptLink} target="_blank" rel="noreferrer">Mở link hóa đơn</a></> : null}</ManageAlert> : null}
        {dedupeNotice ? <ManageAlert tone="warn">{dedupeNotice}</ManageAlert> : null}
        {role === "TECH" && techShiftOpen === false ? (
          <ManageAlert tone="warn">
            Ca làm chưa được mở. Vui lòng vào <a className="underline font-medium" href="/manage/shifts">Ca làm</a> để mở ca trước khi thanh toán.
          </ManageAlert>
        ) : null}

        <section className="manage-surface">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Ưu tiên thao tác</h3>
              <p className="mt-1 text-sm text-neutral-500">Ưu tiên chọn khách từ danh sách CHECKED_IN để giảm nhập tay và tránh sai bill.</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Khách CHECKED_IN: <b>{checkedInAppointments.length}</b>
            </div>
          </div>
        </section>

        <MobileInfoGrid>
          <ManageStatCard label="Số bill" value={ticketSummary.count} />
          <ManageStatCard label="Doanh thu" value={formatVnd(ticketSummary.total)} />
          <ManageStatCard label="Khách check-in" value={checkedInAppointments.length} />
        </MobileInfoGrid>

        <MobileCollapsible summary={`Tóm tắt bill${customerName ? ` · ${customerName}` : ""}`} defaultOpen={false}>
          <div className="space-y-3">
            <div className="rounded-xl bg-neutral-50 p-3">
              <div className="text-sm text-neutral-500">Khách hàng</div>
              <div className="mt-1 text-base font-semibold text-neutral-900">{customerName || "Chưa chọn khách"}</div>
              <div className="mt-2 text-sm text-neutral-500">Phương thức</div>
              <div className="mt-1 font-medium text-neutral-900">{paymentMethod === "CASH" ? "Tiền mặt" : "Chuyển khoản"}</div>
            </div>
            <div className="rounded-xl bg-neutral-900 p-3 text-white">
              <div className="text-sm text-neutral-300">Tổng thanh toán</div>
              <div className="mt-1 text-2xl font-semibold">{formatVnd(estimatedTotal)}</div>
            </div>
          </div>
        </MobileCollapsible>

        <form onSubmit={onSubmit} className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_380px]">
          <div className="space-y-5">
            <div className="card space-y-3">
              <h3 className="font-semibold text-neutral-900">Chọn khách</h3>
              <div className="grid gap-2 md:grid-cols-3">
                <div className="space-y-2 md:col-span-3">
                  <label className="text-sm font-medium text-neutral-700">Khách đang CHECKED_IN</label>
                  <select className="input" value={appointmentId ?? ""} onChange={(e) => onSelectCheckedInAppointment(e.target.value)}>
                    <option value="">-- Chọn từ appointment --</option>
                    {checkedInAppointments.map((a) => { const customer = Array.isArray(a.customers) ? a.customers[0]?.name : a.customers?.name; return <option key={a.id} value={a.id}>{(customer ?? "Khách") + " · " + new Date(a.start_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</option>; })}
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-neutral-700">Tên khách</label>
                  <input className="input" placeholder="Nhập tên khách" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700">Thanh toán</label>
                  <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as "CASH" | "TRANSFER")}><option value="CASH">Tiền mặt</option><option value="TRANSFER">Chuyển khoản</option></select>
                </div>
              </div>
            </div>

            <div className="card space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-neutral-900">Dịch vụ</h3>
                <button type="button" onClick={addLine} className="rounded-lg border px-3 py-2 text-sm">+ Thêm dòng</button>
              </div>

              <div className="space-y-2">
                {lines.map((line, idx) => (
                  <div key={idx} className="rounded-xl border border-neutral-200 bg-neutral-50 p-2.5">
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_100px_72px] md:items-end">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-neutral-700">Dịch vụ #{idx + 1}</label>
                        <select className="input bg-white py-2.5" value={line.serviceId} onChange={(e) => updateLine(idx, { serviceId: e.target.value })}>
                          <option value="">-- Chọn dịch vụ --</option>
                          {services.map((s) => <option key={s.id} value={s.id}>{s.name} · {formatVnd(Number(s.base_price))}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-neutral-700">SL</label>
                        <input className="input bg-white py-2.5" type="number" min={1} value={line.qty} onChange={(e) => updateLine(idx, { qty: Number(e.target.value) })} />
                      </div>
                      <button type="button" onClick={() => removeLine(idx)} disabled={lines.length === 1} className="rounded-lg border border-neutral-200 px-2 py-2 text-sm text-neutral-600 disabled:cursor-not-allowed disabled:opacity-50">Xóa</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card space-y-3 hidden md:block">
              <h3 className="font-semibold">Lịch sử phiếu</h3>
              <div className="grid gap-3 md:grid-cols-4">
                <select className="input" value={rangeMode} onChange={(e) => setRangeMode(e.target.value as RangeMode)}>
                  <option value="day">Trong ngày</option>
                  <option value="week">Trong tuần</option>
                  <option value="month">Trong tháng</option>
                  <option value="custom">Tùy chỉnh</option>
                </select>
                <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} disabled={rangeMode !== "custom"} />
                <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} disabled={rangeMode !== "custom"} />
                <div className="rounded-xl bg-neutral-100 px-3 py-2 text-sm text-neutral-700">{range.from.toLocaleDateString("vi-VN")} → {range.to.toLocaleDateString("vi-VN")}</div>
              </div>

              {loading ? <p className="text-sm text-neutral-500">Đang tải...</p> : (
                <div className="space-y-3">
                  {tickets.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-500">Chưa có bill nào trong khoảng thời gian này.</div>
                  ) : tickets.map((t) => {
                    const customer = Array.isArray(t.customers) ? t.customers[0]?.name : t.customers?.name;
                    const token = t.receipts?.[0]?.public_token ?? "-";
                    return (
                      <div key={t.id} className="rounded-2xl border border-neutral-200 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-neutral-900">{customer ?? "Khách lẻ"}</div>
                            <div className="text-sm text-neutral-500">{new Date(t.created_at).toLocaleString("vi-VN")}</div>
                          </div>
                          <div className="text-left md:text-right">
                            <div className="text-sm text-neutral-500">Tổng bill</div>
                            <div className="text-base font-semibold text-neutral-900">{formatVnd(Number(t.totals_json?.grand_total ?? 0))}</div>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-neutral-600">
                          <div>Trạng thái: <span className="font-medium text-neutral-900">{t.status}</span></div>
                          <div className="truncate">Mã hóa đơn: <span className="font-mono text-xs text-neutral-800">{token}</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <MobileCollapsible summary="Xem lịch sử phiếu" defaultOpen={false}>
              <div className="space-y-3">
                {loading ? <p className="text-sm text-neutral-500">Đang tải...</p> : tickets.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-500">Chưa có bill nào trong khoảng thời gian này.</div>
                ) : tickets.slice(0, 10).map((t) => {
                  const customer = Array.isArray(t.customers) ? t.customers[0]?.name : t.customers?.name;
                  return (
                    <div key={`mobile-${t.id}`} className="rounded-2xl border border-neutral-200 p-4">
                      <div className="text-sm font-semibold text-neutral-900">{customer ?? "Khách lẻ"}</div>
                      <div className="mt-1 text-sm text-neutral-500">{new Date(t.created_at).toLocaleString("vi-VN")}</div>
                    </div>
                  );
                })}
              </div>
            </MobileCollapsible>
          </div>

          <div className="space-y-5 hidden xl:block">
            <div className="card sticky top-4 space-y-3 xl:self-start">
              <h3 className="font-semibold text-neutral-900">Tóm tắt bill</h3>

              <div className="rounded-xl bg-neutral-50 p-3">
                <div className="text-sm text-neutral-500">Khách hàng</div>
                <div className="mt-1 text-base font-semibold text-neutral-900">{customerName || "Chưa chọn khách"}</div>
                <div className="mt-2 text-sm text-neutral-500">Phương thức</div>
                <div className="mt-1 font-medium text-neutral-900">{paymentMethod === "CASH" ? "Tiền mặt" : "Chuyển khoản"}</div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-neutral-500">
                  <span>Số dòng dịch vụ</span>
                  <span>{selectedServices.length}</span>
                </div>
                <div className="space-y-2 rounded-xl border border-neutral-200 p-3">
                  {selectedServices.length === 0 ? (
                    <div className="text-sm text-neutral-500">Chưa có dịch vụ nào được chọn.</div>
                  ) : selectedServices.map((line, idx) => {
                    const service = line.service;
                    if (!service) return null;
                    return (
                      <div key={`${line.serviceId}-${idx}`} className="flex items-start justify-between gap-3 text-sm">
                        <div>
                          <div className="font-medium text-neutral-900">{service.name}</div>
                          <div className="text-neutral-500">SL: {line.qty}</div>
                        </div>
                        <div className="font-medium text-neutral-900">{formatVnd(Number(service.base_price) * line.qty * (1 + Number(service.vat_rate)))}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl bg-neutral-900 p-3 text-white">
                <div className="text-sm text-neutral-300">Tổng thanh toán</div>
                <div className="mt-1 text-2xl font-semibold">{formatVnd(estimatedTotal)}</div>
              </div>

              <div className="hidden md:flex flex-col gap-2">
                <button disabled={submitting || role === "ACCOUNTANT" || (role === "TECH" && techShiftOpen === false)} className="btn btn-primary w-full py-3 text-base">{submitting ? "Đang xử lý..." : "Thanh toán và đóng bill"}</button>
                {role === "TECH" && techShiftOpen === false && <p className="text-xs text-amber-700">Cần mở ca trước khi thanh toán.</p>}
              </div>
            </div>
          </div>
        </form>

        <MobileStickyActions>
          <button type="button" onClick={addLine} className="flex-1 rounded-lg border px-4 py-3 text-sm font-medium">+ Thêm dòng</button>
          <button disabled={submitting || role === "ACCOUNTANT" || (role === "TECH" && techShiftOpen === false)} className="flex-1 btn btn-primary py-3">{submitting ? "Đang xử lý..." : "Thanh toán"}</button>
        </MobileStickyActions>
      </div>
    </AppShell>
  );
}
