"use client";

import { AppShell } from "@/components/app-shell";
import { ManageAlert } from "@/components/manage-alert";
import { MobileCollapsible, MobileInfoGrid, MobileSectionHeader } from "@/components/manage-mobile";
import { ManageQuickNav } from "@/components/manage-quick-nav";
import { ManageStatCard } from "@/components/manage-stat-card";
import { getCurrentSessionRole } from "@/lib/auth";
import { ensureOrgContext, listStaffMembers, updateAppointmentStatus } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type RangeMode = "day" | "week" | "month";
type StatusFilter = "ALL" | "BOOKED" | "CHECKED_IN" | "DONE";

type AppointmentRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  staff_user_id: string | null;
  resource_id: string | null;
  customers?: { name?: string } | { name?: string }[] | null;
};

type ResourceRow = { id: string; name: string };
type StaffRow = { user_id: string; display_name: string };
type OpenTicketRow = { id: string; appointment_id: string | null; status: string };

type QueueCardProps = {
  row: AppointmentRow;
  actingId: string | null;
  resourceName: (id: string | null) => string;
  onAdvanceStatus: (row: AppointmentRow) => Promise<void>;
  openTicketId?: string | null;
};

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

function pickCustomerName(customers: AppointmentRow["customers"]) {
  if (Array.isArray(customers)) return customers[0]?.name ?? "-";
  return customers?.name ?? "-";
}

function statusTone(status: string) {
  if (status === "CHECKED_IN") return "bg-emerald-50 text-emerald-700";
  if (status === "BOOKED") return "bg-amber-50 text-amber-700";
  if (status === "DONE") return "bg-slate-100 text-slate-700";
  return "bg-neutral-100 text-neutral-600";
}

function formatTimeRange(startAt: string, endAt: string) {
  return `${new Date(startAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} - ${new Date(endAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

function QueueCard({ row, actingId, resourceName, onAdvanceStatus, openTicketId }: QueueCardProps) {
  const customerName = pickCustomerName(row.customers);
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-neutral-900">{customerName}</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(row.status)}`}>{row.status}</span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">{formatTimeRange(row.start_at, row.end_at)} · {resourceName(row.resource_id)} · {openTicketId ? "Có phiếu" : "Chưa có phiếu"}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {row.status === "BOOKED" ? (
          <button
            className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={actingId === row.id}
            onClick={() => void onAdvanceStatus(row)}
          >
            {actingId === row.id ? "Đang xử lý..." : "Check-in ngay"}
          </button>
        ) : null}
        {row.status === "CHECKED_IN" ? (
          <Link
            href={`/manage/checkout?appointmentId=${row.id}&customer=${encodeURIComponent(customerName)}`}
            className="flex-1 rounded-xl border border-[#eadfce] bg-[#f6efe6] px-3 py-2 text-center text-sm font-semibold text-neutral-900 transition hover:bg-[var(--color-primary)] hover:text-white"
          >
            Mở phiếu
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function QueueColumn({
  title,
  rows,
  loading,
  actingId,
  resourceName,
  onAdvanceStatus,
  openTicketForAppointment,
}: {
  title: string;
  rows: AppointmentRow[];
  loading: boolean;
  actingId: string | null;
  resourceName: (id: string | null) => string;
  onAdvanceStatus: (row: AppointmentRow) => Promise<void>;
  openTicketForAppointment: (appointmentId: string) => OpenTicketRow | undefined;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="badge-soft">{rows.length}</span>
      </div>
      <div className="mt-4 stack-tight">
        {loading ? (
          <>
            <div className="skeleton h-24 rounded-2xl" />
            <div className="skeleton h-24 rounded-2xl" />
          </>
        ) : rows.length ? (
          rows.map((row) => (
            <QueueCard
              key={row.id}
              row={row}
              actingId={actingId}
              resourceName={resourceName}
              onAdvanceStatus={onAdvanceStatus}
              openTicketId={openTicketForAppointment(row.id)?.id ?? null}
            />
          ))
        ) : (
          <p className="text-sm text-neutral-500">Không có dữ liệu.</p>
        )}
      </div>
    </div>
  );
}

export default function TechnicianBoardPage() {
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [staffs, setStaffs] = useState<StaffRow[]>([]);
  const [openTickets, setOpenTickets] = useState<OpenTicketRow[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [rangeMode, setRangeMode] = useState<RangeMode>("day");
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(opts?: { silent?: boolean }) {
    try {
      if (!opts?.silent) setLoading(true);
      setError(null);
      if (!supabase) throw new Error("Thiếu cấu hình Supabase");

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error("Chưa đăng nhập");
      setMyUserId(userId);

      const currentRole = await getCurrentSessionRole();
      setRole(currentRole);

      const { orgId } = await ensureOrgContext();
      const now = new Date();
      const range = rangeMode === "day"
        ? { start: startOfDay(now), end: endOfDay(now) }
        : rangeMode === "week"
          ? { start: startOfWeek(now), end: endOfWeek(now) }
          : { start: startOfMonth(now), end: endOfMonth(now) };

      const [appointmentsRes, resourcesRes, ticketsRes, staffRows] = await Promise.all([
        supabase
          .from("appointments")
          .select("id,start_at,end_at,status,staff_user_id,resource_id,customers(name)")
          .eq("org_id", orgId)
          .or(`and(status.eq.BOOKED,start_at.lte.${range.end.toISOString()}),and(status.eq.CHECKED_IN,start_at.lte.${range.end.toISOString()}),and(status.eq.DONE,start_at.gte.${range.start.toISOString()},start_at.lte.${range.end.toISOString()})`)
          .order("start_at", { ascending: true }),
        supabase.from("resources").select("id,name").eq("org_id", orgId).eq("active", true),
        supabase.from("tickets").select("id,appointment_id,status").eq("org_id", orgId).eq("status", "OPEN"),
        listStaffMembers(),
      ]);

      if (appointmentsRes.error) throw appointmentsRes.error;
      if (resourcesRes.error) throw resourcesRes.error;
      if (ticketsRes.error) throw ticketsRes.error;

      setRows((appointmentsRes.data ?? []) as AppointmentRow[]);
      setResources((resourcesRes.data ?? []) as ResourceRow[]);
      setStaffs(((staffRows ?? []) as Array<{ userId: string; name: string }>).map((s) => ({ user_id: s.userId, display_name: s.name })) as StaffRow[]);
      setOpenTickets((ticketsRes.data ?? []) as OpenTicketRow[]);
      setSelectedStaffId((prev) => prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tải bảng kỹ thuật thất bại");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [rangeMode]);

  useEffect(() => {
    const id = setInterval(() => {
      void load({ silent: true });
    }, 30000);
    return () => clearInterval(id);
  }, [rangeMode]);

  const canSwitchStaff = role === "OWNER" || role === "MANAGER" || role === "RECEPTION";
  const effectiveStaffId = canSwitchStaff ? selectedStaffId : myUserId ?? "";

  const filteredRows = useMemo(() => {
    const byStaff = !effectiveStaffId ? rows : rows.filter((r) => r.staff_user_id === effectiveStaffId);
    if (statusFilter === "ALL") return byStaff;
    return byStaff.filter((r) => r.status === statusFilter);
  }, [rows, effectiveStaffId, statusFilter]);

  const booked = useMemo(() => filteredRows.filter((r) => r.status === "BOOKED"), [filteredRows]);
  const active = useMemo(() => filteredRows.filter((r) => r.status === "CHECKED_IN"), [filteredRows]);
  const done = useMemo(() => filteredRows.filter((r) => r.status === "DONE"), [filteredRows]);
  const timelineRows = useMemo(() => [...filteredRows].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()), [filteredRows]);

  const resourceName = (id: string | null) => resources.find((r) => r.id === id)?.name ?? "-";
  const staffName = (id: string | null) => staffs.find((s) => s.user_id === id)?.display_name ?? "-";
  const openTicketForAppointment = (appointmentId: string) => openTickets.find((t) => t.appointment_id === appointmentId);

  const nextActionLabel = useMemo(() => {
    if (booked.length > 0) return "Có khách đang chờ check-in";
    if (active.length > 0) return "Có khách đang phục vụ, có thể mở phiếu";
    return "Hiện chưa có việc cần xử lý ngay";
  }, [booked.length, active.length]);

  async function onAdvanceStatus(row: AppointmentRow) {
    if (actingId) return;
    try {
      setActingId(row.id);
      if (row.status === "BOOKED") {
        if (role === "TECH") {
          if (!supabase) throw new Error("Thiếu cấu hình Supabase");
          const { error } = await supabase.rpc("tech_check_in_appointment_secure", { p_appointment_id: row.id });
          if (error) throw error;
        } else {
          await updateAppointmentStatus(row.id, "CHECKED_IN");
        }
      }
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cập nhật bảng kỹ thuật thất bại");
    } finally {
      setActingId(null);
    }
  }

  return (
    <AppShell>
      <div className="page-shell">
        <ManageQuickNav
          items={[
            { href: "/manage/appointments", label: "Lịch hẹn" },
            { href: "/manage/checkout", label: "Thanh toán" },
            { href: "/manage/shifts", label: "Ca làm" },
          ]}
        />

        <MobileSectionHeader
          title="Bảng kỹ thuật"
          meta={<div className="manage-info-box">{nextActionLabel}</div>}
        />

        {error ? <ManageAlert tone="error">Lỗi: {error}</ManageAlert> : null}

        <section className="manage-surface">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-semibold text-neutral-900 md:text-lg">Việc cần làm ngay</h3>
              <p className="mt-1 text-xs text-neutral-500 md:text-sm">Ưu tiên check-in khách chờ trước, sau đó mở phiếu cho khách đang phục vụ.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Khách chờ: <b>{booked.length}</b>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Sẵn sàng mở phiếu: <b>{active.length}</b>
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto md:hidden">
            <a href="#queue-booked" className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">Khách chờ</a>
            <a href="#queue-active" className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">Đang phục vụ</a>
            <a href="#queue-done" className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700">Đã xong</a>
          </div>
        </section>

        <section className="manage-surface space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-neutral-900 md:text-lg">Bộ lọc thao tác</h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
              {canSwitchStaff ? (
                <select className="input" value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)}>
                  <option value="">-- Chọn thợ --</option>
                  {staffs.map((s) => <option key={s.user_id} value={s.user_id}>{s.display_name || s.user_id.slice(0, 8)}</option>)}
                </select>
              ) : (
                <div className="badge-soft flex items-center justify-center px-4 py-2">{staffName(myUserId)}</div>
              )}
              <select className="input" value={rangeMode} onChange={(e) => setRangeMode(e.target.value as RangeMode)}>
                <option value="day">Trong ngày</option>
                <option value="week">Trong tuần</option>
                <option value="month">Trong tháng</option>
              </select>
              <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
                <option value="ALL">Tất cả</option>
                <option value="BOOKED">Khách chờ</option>
                <option value="CHECKED_IN">Đang phục vụ</option>
                <option value="DONE">Đã xong</option>
              </select>
            </div>
          </div>
        </section>

        <MobileCollapsible summary="Mở bộ lọc" defaultOpen={false}>
          <div className="grid gap-2">
            {canSwitchStaff ? (
              <select className="input" value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)}>
                <option value="">-- Chọn thợ --</option>
                {staffs.map((s) => <option key={s.user_id} value={s.user_id}>{s.display_name || s.user_id.slice(0, 8)}</option>)}
              </select>
            ) : (
              <div className="badge-soft flex items-center justify-center px-4 py-2">{staffName(myUserId)}</div>
            )}
            <select className="input" value={rangeMode} onChange={(e) => setRangeMode(e.target.value as RangeMode)}>
              <option value="day">Trong ngày</option>
              <option value="week">Trong tuần</option>
              <option value="month">Trong tháng</option>
            </select>
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="ALL">Tất cả</option>
              <option value="BOOKED">Khách chờ</option>
              <option value="CHECKED_IN">Đang phục vụ</option>
              <option value="DONE">Đã xong</option>
            </select>
          </div>
        </MobileCollapsible>

        <MobileInfoGrid>
          <ManageStatCard label="Khách đang chờ" value={booked.length} />
          <ManageStatCard label="Đang phục vụ" value={active.length} />
          <ManageStatCard label="Đã xong" value={done.length} />
        </MobileInfoGrid>

        <section className="grid gap-4 xl:grid-cols-3">
          <div id="queue-booked">
          <QueueColumn
            title="Khách đang chờ"
            rows={booked}
            loading={loading}
            actingId={actingId}
            resourceName={resourceName}
            onAdvanceStatus={onAdvanceStatus}
            openTicketForAppointment={openTicketForAppointment}
          />
          </div>
          <div id="queue-active">
          <QueueColumn
            title="Đang phục vụ"
            rows={active}
            loading={loading}
            actingId={actingId}
            resourceName={resourceName}
            onAdvanceStatus={onAdvanceStatus}
            openTicketForAppointment={openTicketForAppointment}
          />
          </div>
          <div id="queue-done">
          <QueueColumn
            title="Đã xong"
            rows={done}
            loading={loading}
            actingId={actingId}
            resourceName={resourceName}
            onAdvanceStatus={onAdvanceStatus}
            openTicketForAppointment={openTicketForAppointment}
          />
          </div>
        </section>

        <section className="manage-surface">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Timeline</h3>
            </div>
            <span className="badge-soft">{timelineRows.length} lịch</span>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <>
                <div className="skeleton h-20 rounded-2xl" />
                <div className="skeleton h-20 rounded-2xl" />
                <div className="skeleton h-20 rounded-2xl" />
              </>
            ) : timelineRows.length ? (
              timelineRows.map((row) => (
                <div key={`timeline-${row.id}`} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-neutral-900">{pickCustomerName(row.customers)}</p>
                      <p className="text-sm text-neutral-500">{formatTimeRange(row.start_at, row.end_at)}</p>
                    </div>
                    <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${statusTone(row.status)}`}>{row.status}</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-neutral-600 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-2xl bg-neutral-50 px-3 py-2">Ghế/Bàn: <span className="font-medium text-neutral-900">{resourceName(row.resource_id)}</span></div>
                    <div className="rounded-2xl bg-neutral-50 px-3 py-2">Thợ: <span className="font-medium text-neutral-900">{staffName(row.staff_user_id)}</span></div>
                    <div className="rounded-2xl bg-neutral-50 px-3 py-2">Ticket mở: <span className="font-medium text-neutral-900">{openTicketForAppointment(row.id)?.id ? "Có" : "Chưa có"}</span></div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-neutral-500">Không có lịch trong bộ lọc hiện tại.</p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
