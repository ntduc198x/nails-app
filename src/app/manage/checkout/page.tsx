"use client";

import { AppShell } from "@/components/app-shell";
import { ManageAlert } from "@/components/manage-alert";
import { MobileCollapsible, MobileInfoGrid, MobileSectionHeader, MobileStickyActions } from "@/components/manage-mobile";
import { ManageQuickNav, operationsQuickNav } from "@/components/manage-quick-nav";
import { ManageStatCard } from "@/components/manage-stat-card";
import { getCurrentSessionRole, type AppRole } from "@/lib/auth";
import { createCheckout, hasOpenShift, listCheckedInAppointments, listRecentTickets, listServices } from "@/lib/domain";
import { formatVnd } from "@/lib/mock-data";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  if (message.includes("TECH chỉ được checkout khi đang mở ca.")) return "Chưa mở ca. Vui lòng sang mục Ca làm để chuyển sang ca mới và mở ca trước khi checkout.";
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

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

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
  const customerSectionRef = useRef<HTMLDivElement | null>(null);
  const serviceSectionRef = useRef<HTMLDivElement | null>(null);
  const mobileSummaryRef = useRef<HTMLDivElement | null>(null);

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
  const quickServices = useMemo(() => {
    const selectedNames = selectedServices.map((line) => normalizeText(line.service?.name ?? ""));
    const hasBaseGel = selectedNames.some((name) => name.includes("son gel") || name.includes("gel thach") || name.includes("biab"));
    const hasExtensions = selectedNames.some((name) => name.includes("mong up") || name.includes("dual form") || name.includes("dap gel") || name.includes("refill"));

    const score = (service: ServiceRow) => {
      const name = normalizeText(service.name);
      let points = 0;
      if (!selectedNames.length) {
        if (name.includes("son gel") || name.includes("gel thach") || name.includes("biab") || name.includes("mong up") || name.includes("dual form")) points += 5;
        if (name.includes("combo")) points += 4;
      }
      if (hasBaseGel && (name.includes("nhu") || name.includes("mat meo") || name.includes("mix mau") || name.includes("trang guong"))) points += 8;
      if (hasExtensions && (name.includes("dinh") || name.includes("charm") || name.includes("ombre") || name.includes("ve") || name.includes("loang"))) points += 8;
      if (name.includes("son gel") || name.includes("gel thach") || name.includes("biab")) points += 3;
      if (name.includes("mong up") || name.includes("dual form") || name.includes("dap gel")) points += 3;
      if (selectedNames.includes(name)) points -= 2;
      return points;
    };

    return [...services]
      .sort((a, b) => score(b) - score(a) || Number(a.base_price) - Number(b.base_price))
      .slice(0, 8);
  }, [services, selectedServices]);

  function addLine() { setLines((prev) => [...prev, { serviceId: "", qty: 1 }]); }
  function onSelectCheckedInAppointment(id: string) { setAppointmentId(id || null); const picked = checkedInAppointments.find((a) => a.id === id); const customer = Array.isArray(picked?.customers) ? picked?.customers[0]?.name : picked?.customers?.name; if (customer) setCustomerName(customer); requestAnimationFrame(() => serviceSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }
  function updateLine(index: number, patch: Partial<{ serviceId: string; qty: number }>) { setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l))); }
  function removeLine(index: number) { setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index))); }
  function addQuickService(serviceId: string) {
    setLines((prev) => {
      const existingIndex = prev.findIndex((line) => line.serviceId === serviceId);
      if (existingIndex >= 0) return prev.map((line, index) => index === existingIndex ? { ...line, qty: line.qty + 1 } : line);
      const firstEmptyIndex = prev.findIndex((line) => !line.serviceId);
      if (firstEmptyIndex >= 0) return prev.map((line, index) => index === firstEmptyIndex ? { serviceId, qty: 1 } : line);
      return [...prev, { serviceId, qty: 1 }];
    });
  }

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (submitting) return;
    try {
      setSubmitting(true); setError(null); setDedupeNotice(null);
      if (role === "ACCOUNTANT") throw new Error("Vai trò hiện tại không được phép tạo thanh toán.");
      if (role === "TECH") {
        const openShift = await hasOpenShift();
        setTechShiftOpen(openShift);
        if (!openShift) {
          const mobileWarn = "Chưa mở ca. Vui lòng sang mục Ca làm để chuyển sang ca mới và mở ca trước khi checkout.";
          setError(mobileWarn);
          requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
          throw new Error(mobileWarn);
        }
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
        <ManageQuickNav items={operationsQuickNav("/manage/checkout")} />

        <MobileSectionHeader title="Thanh toán" meta={<div className="manage-info-box">{statusMeta}</div>} />

        {error ? <ManageAlert tone="error">Lỗi: {error}</ManageAlert> : null}
        {lastReceipt ? <ManageAlert tone="info">Tạo hóa đơn thành công. Mã công khai: <code>{lastReceipt}</code>{receiptLink ? <> · <a className="underline" href={receiptLink} target="_blank" rel="noreferrer">Mở link hóa đơn</a></> : null}</ManageAlert> : null}
        {dedupeNotice ? <ManageAlert tone="warn">{dedupeNotice}</ManageAlert> : null}
        {role === "TECH" && techShiftOpen === false ? (
          <ManageAlert tone="warn">
            Chưa mở ca. Vui lòng vào <a className="underline font-medium" href="/manage/shifts">Ca làm</a> để chuyển sang ca mới và mở ca trước khi thanh toán.
          </ManageAlert>
        ) : null}

        <section className="manage-surface space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-neutral-900">Ưu tiên thao tác</h3>
            <button
              type="button"
              onClick={() => requestAnimationFrame(() => customerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))}
              className="cursor-pointer rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800 transition hover:bg-blue-100 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
            >
              Khách CHECKED_IN: <b>{checkedInAppointments.length}</b>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-[11px] font-medium text-neutral-500">Số bill</div>
              <div className="mt-1 text-base font-semibold text-neutral-900">{ticketSummary.count}</div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-[11px] font-medium text-neutral-500">Doanh thu</div>
              <div className="mt-1 text-base font-semibold text-neutral-900">{formatVnd(ticketSummary.total)}</div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-[11px] font-medium text-neutral-500">Check-in</div>
              <div className="mt-1 text-base font-semibold text-neutral-900">{checkedInAppointments.length}</div>
            </div>
          </div>
        </section>

        <form onSubmit={onSubmit} className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_380px]">
          <div className="space-y-4">
            <div ref={customerSectionRef} className="card space-y-3 p-4">
              <h3 className="text-base font-semibold text-neutral-900">Chọn khách</h3>

              {checkedInAppointments.length > 0 ? (
                <div className="space-y-2 md:hidden">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Khách đang check-in</div>
                  <div className="flex flex-wrap gap-2">
                    {checkedInAppointments.slice(0, 6).map((a) => {
                      const customer = Array.isArray(a.customers) ? a.customers[0]?.name : a.customers?.name;
                      const active = appointmentId === a.id;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => onSelectCheckedInAppointment(a.id)}
                          className={`cursor-pointer rounded-full border px-3 py-2 text-left text-xs font-medium transition ${active ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-neutral-200 bg-white text-neutral-700"}`}
                        >
                          <span className="block truncate">{customer ?? "Khách"}</span>
                          <span className={`block text-[10px] ${active ? "text-white/80" : "text-neutral-400"}`}>{new Date(a.start_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {checkedInAppointments.length > 0 ? (
                <div className="hidden md:block space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-neutral-700">Khách đang CHECKED_IN</label>
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">{checkedInAppointments.length}</span>
                  </div>
                  <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
                    {checkedInAppointments.map((a) => {
                      const customer = Array.isArray(a.customers) ? a.customers[0]?.name : a.customers?.name;
                      const active = appointmentId === a.id;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => onSelectCheckedInAppointment(a.id)}
                          className={`cursor-pointer rounded-2xl border px-3 py-2.5 text-left transition ${active ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]" : "border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700"}`}
                        >
                          <span className="block truncate text-sm font-medium">{customer ?? "Khách"}</span>
                          <span className={`mt-1 block text-xs ${active ? "text-[var(--color-primary)]/80" : "text-neutral-500"}`}>{new Date(a.start_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2 md:grid-cols-3">
                <div className="space-y-2 md:col-span-2">
                  <input className="input cursor-text py-2.5" placeholder="Tên khách" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <select className="input cursor-pointer py-2.5" aria-label="Phương thức thanh toán" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as "CASH" | "TRANSFER")}><option value="CASH">Tiền mặt</option><option value="TRANSFER">Chuyển khoản</option></select>
                </div>
              </div>

            </div>

            <div ref={serviceSectionRef} className="card space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-neutral-900">Dịch vụ</h3>
                <button type="button" onClick={addLine} className="cursor-pointer rounded-lg border px-3 py-2 text-xs md:text-sm">+ Thêm dòng</button>
              </div>

              {quickServices.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Dịch vụ nhanh</div>
                    <div className="text-xs text-neutral-500">{customerName ? "Đã ưu tiên theo bill hiện tại" : "Đang ưu tiên các dịch vụ phổ biến"}</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {quickServices.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => addQuickService(service.id)}
                        className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] md:text-sm"
                      >
                        {service.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                {lines.map((line, idx) => {
                  const selectedService = services.find((service) => service.id === line.serviceId);
                  return (
                    <div key={idx} className="rounded-xl border border-neutral-200 bg-neutral-50 p-2.5">
                      <div className="space-y-3">
                        <div>
                          <select className="input cursor-pointer bg-white py-2.5" aria-label={`Dịch vụ ${idx + 1}`} value={line.serviceId} onChange={(e) => updateLine(idx, { serviceId: e.target.value })}>
                            <option value="">-- Chọn dịch vụ --</option>
                            {services.map((s) => <option key={s.id} value={s.id}>{s.name} · {formatVnd(Number(s.base_price))}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-white/70 bg-white px-3 py-2">
                          <div className="min-w-0 flex-1 text-sm text-neutral-500">
                            {selectedService ? (
                              <>
                                <span className="font-medium text-neutral-800">Tạm tính</span>{" "}
                                {formatVnd(Number(selectedService.base_price) * line.qty * (1 + Number(selectedService.vat_rate)))}
                              </>
                            ) : "Chưa chọn dịch vụ"}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateLine(idx, { qty: Math.max(1, line.qty - 1) })}
                              disabled={line.qty <= 1}
                              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-neutral-200 bg-white text-base font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Giảm số lượng dịch vụ ${idx + 1}`}
                            >
                              −
                            </button>
                            <div className="flex min-w-[2.5rem] items-center justify-center rounded-full bg-neutral-900 px-3 py-2 text-sm font-semibold text-white">
                              {line.qty}
                            </div>
                            <button
                              type="button"
                              onClick={() => updateLine(idx, { qty: line.qty + 1 })}
                              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-neutral-200 bg-white text-base font-semibold text-neutral-700"
                              aria-label={`Tăng số lượng dịch vụ ${idx + 1}`}
                            >
                              +
                            </button>
                            <button type="button" onClick={() => removeLine(idx)} disabled={lines.length === 1} className="cursor-pointer rounded-lg border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-600 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm">Xóa</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div ref={mobileSummaryRef} className="card space-y-3 p-4 md:hidden">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-neutral-900">Tóm tắt bill</h3>
                <div className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">{selectedServices.length} dịch vụ</div>
              </div>

              <div className="rounded-xl bg-neutral-50 p-3">
                <div className="text-sm text-neutral-500">Khách hàng</div>
                <div className="mt-1 text-base font-semibold text-neutral-900">{customerName || "Chưa chọn khách"}</div>
                <div className="mt-2 text-sm text-neutral-500">Phương thức</div>
                <div className="mt-1 font-medium text-neutral-900">{paymentMethod === "CASH" ? "Tiền mặt" : "Chuyển khoản"}</div>
              </div>

              <div className="space-y-2 rounded-xl border border-neutral-200 p-3">
                {selectedServices.length === 0 ? (
                  <div className="text-sm text-neutral-500">Chưa có dịch vụ nào được chọn.</div>
                ) : selectedServices.map((line, idx) => {
                  const service = line.service;
                  if (!service) return null;
                  return (
                    <div key={`mobile-summary-${line.serviceId}-${idx}`} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium text-neutral-900">{service.name}</div>
                        <div className="text-neutral-500">SL: {line.qty}</div>
                      </div>
                      <div className="text-right font-medium text-neutral-900">{formatVnd(Number(service.base_price) * line.qty * (1 + Number(service.vat_rate)))}</div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl bg-neutral-900 p-3 text-white">
                <div className="text-sm text-neutral-300">Tổng thanh toán</div>
                <div className="mt-1 text-2xl font-semibold">{formatVnd(estimatedTotal)}</div>
              </div>
            </div>

            <div className="card space-y-3 hidden md:block">
              <h3 className="font-semibold">Lịch sử phiếu</h3>
              <div className="grid gap-3 md:grid-cols-4">
                <select className="input cursor-pointer" value={rangeMode} onChange={(e) => setRangeMode(e.target.value as RangeMode)}>
                  <option value="day">Trong ngày</option>
                  <option value="week">Trong tuần</option>
                  <option value="month">Trong tháng</option>
                  <option value="custom">Tùy chỉnh</option>
                </select>
                <input className="input cursor-pointer" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} disabled={rangeMode !== "custom"} />
                <input className="input cursor-pointer" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} disabled={rangeMode !== "custom"} />
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

            <MobileCollapsible summary={`Lịch sử phiếu · ${tickets.length} bill`} defaultOpen={false}>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <select className="input cursor-pointer py-2.5" value={rangeMode} onChange={(e) => setRangeMode(e.target.value as RangeMode)}>
                    <option value="day">Trong ngày</option>
                    <option value="week">Trong tuần</option>
                    <option value="month">Trong tháng</option>
                    <option value="custom">Tùy chỉnh</option>
                  </select>
                  <div className="rounded-xl bg-neutral-100 px-3 py-2 text-xs text-neutral-700">{range.from.toLocaleDateString("vi-VN")} → {range.to.toLocaleDateString("vi-VN")}</div>
                </div>
                {rangeMode === "custom" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input className="input cursor-pointer py-2.5" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                    <input className="input cursor-pointer py-2.5" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                  </div>
                ) : null}

                {loading ? <p className="text-sm text-neutral-500">Đang tải...</p> : tickets.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-500">Chưa có bill nào trong khoảng thời gian này.</div>
                ) : tickets.slice(0, 10).map((t) => {
                  const customer = Array.isArray(t.customers) ? t.customers[0]?.name : t.customers?.name;
                  const token = t.receipts?.[0]?.public_token ?? "-";
                  return (
                    <div key={`mobile-${t.id}`} className="rounded-2xl border border-neutral-200 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-neutral-900">{customer ?? "Khách lẻ"}</div>
                          <div className="mt-1 text-xs text-neutral-500">{new Date(t.created_at).toLocaleString("vi-VN")}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] text-neutral-400">Tổng bill</div>
                          <div className="text-sm font-semibold text-neutral-900">{formatVnd(Number(t.totals_json?.grand_total ?? 0))}</div>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-600">
                        <div className="flex items-start justify-between gap-3">
                          <span>Trạng thái</span>
                          <span className="font-medium text-neutral-900">{t.status}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span>Mã hóa đơn</span>
                          <span className="max-w-[11rem] truncate font-mono text-[11px] text-neutral-800">{token}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </MobileCollapsible>
          </div>

          <div className="space-y-4 hidden xl:block">
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
                <button disabled={submitting || role === "ACCOUNTANT" || (role === "TECH" && techShiftOpen === false)} className="btn btn-primary w-full cursor-pointer py-3 text-base disabled:cursor-not-allowed">{submitting ? "Đang xử lý..." : "Thanh toán và đóng bill"}</button>
                {role === "TECH" && techShiftOpen === false && <p className="text-xs text-amber-700">Chưa mở ca, vào Ca làm để chuyển sang ca mới và mở ca trước khi thanh toán.</p>}
              </div>
            </div>
          </div>
        </form>

        <MobileStickyActions>
          <button
            type="button"
            onClick={() => requestAnimationFrame(() => mobileSummaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))}
            className="cursor-pointer rounded-lg border px-4 py-3 text-sm font-medium"
          >
            Xem bill {formatVnd(estimatedTotal)}
          </button>
          <button type="button" onClick={addLine} className="cursor-pointer rounded-lg border px-4 py-3 text-sm font-medium">+ Dòng</button>
          <button type="button" onClick={() => void onSubmit()} disabled={submitting || role === "ACCOUNTANT"} className="flex-1 btn btn-primary cursor-pointer py-3 disabled:cursor-not-allowed">{submitting ? "Đang xử lý..." : "Thanh toán"}</button>
        </MobileStickyActions>
      </div>
    </AppShell>
  );
}
