"use client";

import { AppShell } from "@/components/app-shell";
import { ManageAlert } from "@/components/manage-alert";
import { MobileCollapsible, MobileSectionHeader, MobileStickyActions } from "@/components/manage-mobile";
import { ManageQuickNav, operationsQuickNav } from "@/components/manage-quick-nav";
import { getCurrentSessionRole, listUserRoles, type AppRole } from "@/lib/auth";
import { ensureOrgContext } from "@/lib/domain";
import { getRoleLabel } from "@/lib/role-labels";
import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useState } from "react";

type RangeMode = "week" | "month" | "custom";

type Entry = {
  id: string;
  staff_user_id: string;
  clock_in: string;
  clock_out: string | null;
};

type TeamMember = {
  user_id: string;
  display_name?: string | null;
  role?: string | null;
};

const LONG_OPEN_SHIFT_HOURS = 10;

function canManageTeamView(role: AppRole | null) {
  return role === "OWNER" || role === "MANAGER";
}

function formatDuration(clockIn: string, clockOut: string | null) {
  const start = new Date(clockIn).getTime();
  const end = clockOut ? new Date(clockOut).getTime() : Date.now();
  const totalMinutes = Math.max(0, Math.round((end - start) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStartOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getEndOfWeek(date: Date) {
  const next = getStartOfWeek(date);
  next.setDate(next.getDate() + 6);
  next.setHours(23, 59, 59, 999);
  return next;
}

function getStartOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function getEndOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ShiftRowCard({
  name,
  role,
  clockIn,
  clockOut,
  active,
  overdue,
}: {
  name: string;
  role: string;
  clockIn: string;
  clockOut: string | null;
  active: boolean;
  overdue: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-3 ${overdue ? "border-amber-300 bg-amber-50/60" : active ? "border-emerald-200 bg-emerald-50/50" : "border-neutral-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-900">{name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
            <span>{getRoleLabel(role)}</span>
            <span>•</span>
            <span>{formatDuration(clockIn, clockOut)}</span>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-700"}`}>{active ? "Đang mở" : "Đã đóng"}</span>
          {overdue ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Quá lâu</span> : null}
        </div>
      </div>
      <div className="mt-2 grid gap-1 text-[11px] text-neutral-600">
        <p>Mở: <span className="font-medium text-neutral-900">{new Date(clockIn).toLocaleString("vi-VN")}</span></p>
        <p>Đóng: <span className="font-medium text-neutral-900">{clockOut ? new Date(clockOut).toLocaleString("vi-VN") : "-"}</span></p>
      </div>
    </div>
  );
}

export default function ShiftsPage() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [staffFilter, setStaffFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [rangeMode, setRangeMode] = useState<RangeMode>("week");
  const [fromDate, setFromDate] = useState(() => toDateInputValue(getStartOfWeek(new Date())));
  const [toDate, setToDate] = useState(() => toDateInputValue(new Date()));

  const loadEntries = useCallback(async (targetOrgId: string) => {
    const isInitial = entries.length === 0;
    try {
      if (isInitial) setLoading(true); else setRefreshing(true);
      setError(null);
      if (!supabase) throw new Error("Thiếu cấu hình Supabase");

      const [entriesRes, teamRows] = await Promise.all([
        supabase.from("time_entries").select("id,staff_user_id,clock_in,clock_out").eq("org_id", targetOrgId).order("clock_in", { ascending: false }).limit(100),
        listUserRoles(),
      ]);

      if (entriesRes.error) throw entriesRes.error;
      setEntries((entriesRes.data ?? []) as Entry[]);
      setTeamMembers((teamRows ?? []) as TeamMember[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load shifts failed");
    } finally {
      if (isInitial) setLoading(false); else setRefreshing(false);
    }
  }, [entries.length]);

  useEffect(() => {
    async function init() {
      try {
        if (!supabase) throw new Error("Thiếu cấu hình Supabase");
        const { data } = await supabase.auth.getSession();
        const currentUserId = data.session?.user?.id;
        if (!currentUserId) throw new Error("Chưa đăng nhập");
        const [r, ctx] = await Promise.all([getCurrentSessionRole(), ensureOrgContext()]);
        setRole(r);
        setUserId(currentUserId);
        setOrgId(ctx.orgId);
        await loadEntries(ctx.orgId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Khởi tạo shifts failed");
        setLoading(false);
      }
    }
    void init();
  }, [loadEntries]);

  async function clockIn() {
    if (!orgId || !userId || submitting || role === "OWNER") return;
    try {
      setSubmitting(true);
      setError(null);
      if (!supabase) throw new Error("Thiếu cấu hình Supabase");
      const { data: openRows, error: existingErr } = await supabase.from("time_entries").select("id").eq("org_id", orgId).eq("staff_user_id", userId).is("clock_out", null).limit(1);
      if (existingErr) throw existingErr;
      if (openRows?.length) throw new Error("Bạn đang có một ca mở rồi, cần clock out trước khi mở ca mới.");
      const { error } = await supabase.from("time_entries").insert({ org_id: orgId, staff_user_id: userId, clock_in: new Date().toISOString() });
      if (error) throw error;
      await loadEntries(orgId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clock in failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function clockOut() {
    if (!orgId || !userId || submitting || role === "OWNER") return;
    try {
      setSubmitting(true);
      setError(null);
      if (!supabase) throw new Error("Thiếu cấu hình Supabase");
      const { data: openRows, error: findErr } = await supabase.from("time_entries").select("id").eq("org_id", orgId).eq("staff_user_id", userId).is("clock_out", null).order("clock_in", { ascending: false }).limit(1);
      if (findErr) throw findErr;
      const id = openRows?.[0]?.id;
      if (!id) throw new Error("Không có ca đang mở để clock out");
      const { error } = await supabase.from("time_entries").update({ clock_out: new Date().toISOString() }).eq("id", id).eq("org_id", orgId);
      if (error) throw error;
      await loadEntries(orgId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clock out failed");
    } finally {
      setSubmitting(false);
    }
  }

  const canUse = role === "OWNER" || role === "MANAGER" || role === "RECEPTION" || role === "TECH";
  const canManageView = canManageTeamView(role);
  const memberMap = useMemo(() => new Map(teamMembers.map((m) => [m.user_id, { name: (m.display_name || String(m.user_id).slice(0, 8)).trim(), role: m.role || "-" }])), [teamMembers]);
  const visibleEntries = useMemo(() => {
    const base = canManageView ? entries : entries.filter((entry) => entry.staff_user_id === userId);
    return base.filter((entry) => memberMap.get(entry.staff_user_id)?.role !== "OWNER");
  }, [canManageView, entries, memberMap, userId]);
  const filterRange = useMemo(() => {
    const now = new Date();
    if (rangeMode === "week") return { from: getStartOfWeek(now), to: getEndOfWeek(now) };
    if (rangeMode === "month") return { from: getStartOfMonth(now), to: getEndOfMonth(now) };
    const from = new Date(fromDate);
    const to = new Date(toDate);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }, [fromDate, rangeMode, toDate]);

  const filteredEntries = useMemo(() => visibleEntries.filter((entry) => {
    const member = memberMap.get(entry.staff_user_id);
    const startedAt = new Date(entry.clock_in).getTime();
    if (startedAt < filterRange.from.getTime() || startedAt > filterRange.to.getTime()) return false;
    if (canManageView && staffFilter !== "ALL" && entry.staff_user_id !== staffFilter) return false;
    if (canManageView && roleFilter !== "ALL" && member?.role !== roleFilter) return false;
    return true;
  }), [canManageView, filterRange, memberMap, roleFilter, staffFilter, visibleEntries]);
  const totalMinutes = useMemo(() => filteredEntries.reduce((acc, entry) => {
    const start = new Date(entry.clock_in).getTime();
    const end = entry.clock_out ? new Date(entry.clock_out).getTime() : Date.now();
    return acc + Math.max(0, Math.round((end - start) / 60000));
  }, 0), [filteredEntries]);
  const activeEntry = useMemo(() => entries.find((entry) => entry.staff_user_id === userId && !entry.clock_out) ?? null, [entries, userId]);
  const visibleTeamMembers = useMemo(() => {
    const base = canManageView ? teamMembers : teamMembers.filter((m) => m.user_id === userId);
    return base
      .filter((m) => m.role !== "OWNER")
      .sort((a, b) => {
        const aName = (a.display_name || String(a.user_id).slice(0, 8)).trim();
        const bName = (b.display_name || String(b.user_id).slice(0, 8)).trim();
        return aName.localeCompare(bName, "vi");
      });
  }, [canManageView, teamMembers, userId]);
  const roleOptions = useMemo(() => {
    const preferredOrder = ["MANAGER", "RECEPTION", "ACCOUNTANT", "TECH"];
    const existing = [...new Set(teamMembers.map((m) => m.role).filter((value) => value && value !== "OWNER"))] as string[];
    return preferredOrder.filter((value) => existing.includes(value));
  }, [teamMembers]);
  const openCount = useMemo(() => visibleEntries.filter((e) => !e.clock_out).length, [visibleEntries]);
  const openEntries = useMemo(() => filteredEntries.filter((e) => !e.clock_out), [filteredEntries]);
  const overdueOpenEntries = useMemo(() => openEntries.filter((entry) => (Date.now() - new Date(entry.clock_in).getTime()) / 3600000 >= LONG_OPEN_SHIFT_HOURS), [openEntries]);
  const closedEntries = useMemo(() => filteredEntries.filter((e) => !!e.clock_out), [filteredEntries]);

  function exportCsv() {
    const rows = [["staff", "role", "clock_in", "clock_out", "duration"]];
    for (const entry of filteredEntries) {
      const member = memberMap.get(entry.staff_user_id);
      rows.push([member?.name ?? entry.staff_user_id, member?.role ?? "-", new Date(entry.clock_in).toLocaleString("vi-VN"), entry.clock_out ? new Date(entry.clock_out).toLocaleString("vi-VN") : "Đang mở", formatDuration(entry.clock_in, entry.clock_out)]);
    }
    downloadCsv("shifts-report.csv", rows);
  }

  const headerMeta = refreshing ? "Đang làm mới..." : overdueOpenEntries.length > 0 ? `${overdueOpenEntries.length} ca mở quá lâu` : activeEntry ? "Đang trong ca" : openCount > 0 ? `${openCount} ca đang mở` : "Chưa mở ca";

  return (
    <AppShell>
      <div className="page-shell space-y-4 pb-24 md:pb-0">
        <ManageQuickNav items={operationsQuickNav("/manage/shifts")} />

        <MobileSectionHeader title="Ca làm" meta={<div className="manage-info-box">{headerMeta}</div>} />

        {error ? <ManageAlert tone="error">Lỗi: {error}</ManageAlert> : null}
        {overdueOpenEntries.length > 0 ? <ManageAlert tone="warn">{overdueOpenEntries.length} ca mở quá {LONG_OPEN_SHIFT_HOURS} giờ</ManageAlert> : null}

        {canUse ? (
          <section className="manage-surface space-y-3 p-4 md:p-5">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className={`rounded-2xl border px-3 py-2.5 ${activeEntry ? "border-emerald-200 bg-emerald-50" : "border-neutral-200 bg-neutral-50"}`}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Trạng thái</div>
                <div className={`mt-0.5 text-sm font-semibold ${activeEntry ? "text-emerald-800" : "text-neutral-900"}`}>{activeEntry ? "Đang trong ca" : "Chưa mở ca"}</div>
                <div className="mt-0.5 text-[11px] text-neutral-600">
                  {role === "OWNER"
                    ? "Theo dõi ca làm của đội ngũ"
                    : activeEntry
                      ? `Bắt đầu ${new Date(activeEntry.clock_in).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · ${formatDuration(activeEntry.clock_in, null)}`
                      : "Mở ca ngay khi bắt đầu làm việc"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex">
                <button onClick={clockIn} disabled={role === "OWNER" || submitting || Boolean(activeEntry)} className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Đang xử lý..." : "Mở ca"}</button>
                <button onClick={clockOut} disabled={role === "OWNER" || submitting || !activeEntry} className="btn btn-outline disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Đang xử lý..." : "Đóng ca"}</button>
              </div>
            </div>
          </section>
        ) : <p className="text-sm text-amber-700">Vai trò hiện tại không được phép chấm công.</p>}

        <section className="manage-surface space-y-3 p-4 md:p-5">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-center">
              <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-neutral-500">Đang mở</p>
              <p className="mt-0.5 text-lg font-semibold leading-none text-neutral-900">{openEntries.length}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-center">
              <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-amber-700">Quá lâu</p>
              <p className="mt-0.5 text-lg font-semibold leading-none text-amber-900">{overdueOpenEntries.length}</p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-center">
              <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-neutral-500">Tổng ca</p>
              <p className="mt-0.5 text-lg font-semibold leading-none text-neutral-900">{filteredEntries.length}</p>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                <span className="text-[11px] uppercase tracking-[0.06em] text-neutral-500">Tổng giờ</span>
                <span className="ml-2 font-semibold text-neutral-900">{`${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, "0")}m`}</span>
              </div>
              {role === "OWNER" ? <button type="button" className="btn btn-outline" onClick={exportCsv} disabled={loading || filteredEntries.length === 0}>Xuất CSV</button> : null}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRangeMode("week")}
                className={`rounded-2xl px-3 py-2 text-xs font-semibold transition ${rangeMode === "week" ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"}`}
              >
                Tuần
              </button>
              <button
                type="button"
                onClick={() => setRangeMode("month")}
                className={`rounded-2xl px-3 py-2 text-xs font-semibold transition ${rangeMode === "month" ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"}`}
              >
                Tháng
              </button>
              <button
                type="button"
                onClick={() => setRangeMode("custom")}
                className={`rounded-2xl px-3 py-2 text-xs font-semibold transition ${rangeMode === "custom" ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"}`}
              >
                Tùy chỉnh
              </button>
            </div>

            {rangeMode === "custom" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            ) : null}

            {canManageView ? <MobileCollapsible summary={`Nhân sự · ${visibleTeamMembers.length}`} defaultOpen={false}>
              <div className="grid gap-2 pt-2">
                <select className="input" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
                  <option value="ALL">Tất cả nhân sự</option>
                  {visibleTeamMembers.map((m) => <option key={m.user_id} value={m.user_id}>{(m.display_name || String(m.user_id).slice(0, 8)).trim()}</option>)}
                </select>
                <select className="input" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                  <option value="ALL">Tất cả vai trò</option>
                  {roleOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
            </MobileCollapsible> : null}

            <MobileCollapsible summary={`Lịch sử · ${closedEntries.length}`} defaultOpen={false}>
              {loading ? <p className="pt-2 text-sm text-neutral-500">Đang tải...</p> : (
                <div className="space-y-1.5 pt-2">
                  {closedEntries.slice(0, 12).map((entry) => {
                    const member = memberMap.get(entry.staff_user_id);
                    return <ShiftRowCard key={entry.id} name={member?.name ?? entry.staff_user_id} role={member?.role ?? "-"} clockIn={entry.clock_in} clockOut={entry.clock_out} active={false} overdue={false} />;
                  })}
                </div>
              )}
            </MobileCollapsible>
          </div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-neutral-900">Ca đang mở</h3>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">{openEntries.length}</span>
          </div>

          {loading ? <p className="text-sm text-neutral-500">Đang tải...</p> : openEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">Không có ca nào đang mở.</div>
          ) : (
            <div className="space-y-1.5">
              {openEntries.map((entry) => {
                const member = memberMap.get(entry.staff_user_id);
                const overdue = (Date.now() - new Date(entry.clock_in).getTime()) / 3600000 >= LONG_OPEN_SHIFT_HOURS;
                return <ShiftRowCard key={entry.id} name={member?.name ?? entry.staff_user_id} role={member?.role ?? "-"} clockIn={entry.clock_in} clockOut={entry.clock_out} active overdue={overdue} />;
              })}
            </div>
          )}
        </section>

        {!canManageView && canUse ? (
          <MobileStickyActions>
            <button onClick={clockIn} disabled={submitting || Boolean(activeEntry)} className="flex-1 btn btn-primary py-3 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Đang xử lý..." : "Mở ca"}</button>
            <button onClick={clockOut} disabled={submitting || !activeEntry} className="flex-1 btn btn-outline py-3 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Đang xử lý..." : "Đóng ca"}</button>
          </MobileStickyActions>
        ) : null}
      </div>
    </AppShell>
  );
}
