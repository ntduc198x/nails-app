"use client";

import { AppShell } from "@/components/app-shell";
import { ManageAlert } from "@/components/manage-alert";
import { MobileCollapsible, MobileInfoGrid, MobileSectionHeader, MobileStickyActions } from "@/components/manage-mobile";
import { ManageQuickNav } from "@/components/manage-quick-nav";
import { ManageStatCard } from "@/components/manage-stat-card";
import { getCurrentSessionRole, listUserRoles, type AppRole } from "@/lib/auth";
import { ensureOrgContext } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  const filteredEntries = useMemo(() => visibleEntries.filter((entry) => {
    const member = memberMap.get(entry.staff_user_id);
    if (canManageView && staffFilter !== "ALL" && entry.staff_user_id !== staffFilter) return false;
    if (canManageView && roleFilter !== "ALL" && member?.role !== roleFilter) return false;
    return true;
  }), [canManageView, memberMap, roleFilter, staffFilter, visibleEntries]);
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
    const existing = [...new Set(teamMembers.map((m) => m.role).filter((role) => role && role !== "OWNER"))] as string[];
    return preferredOrder.filter((role) => existing.includes(role));
  }, [teamMembers]);
  const openCount = useMemo(() => visibleEntries.filter((e) => !e.clock_out).length, [visibleEntries]);

  function exportCsv() {
    const rows = [["staff", "role", "clock_in", "clock_out", "duration"]];
    for (const entry of filteredEntries) {
      const member = memberMap.get(entry.staff_user_id);
      rows.push([member?.name ?? entry.staff_user_id, member?.role ?? "-", new Date(entry.clock_in).toLocaleString("vi-VN"), entry.clock_out ? new Date(entry.clock_out).toLocaleString("vi-VN") : "Đang mở", formatDuration(entry.clock_in, entry.clock_out)]);
    }
    downloadCsv("shifts-report.csv", rows);
  }

  const headerMeta = refreshing ? "Đang làm mới..." : activeEntry ? "Đang trong ca" : `Ca mở: ${openCount}`;

  return (
    <AppShell>
      <div className="page-shell space-y-4 pb-24 md:pb-0">
        <ManageQuickNav
          items={[
            { href: "/manage/technician", label: "Bảng kỹ thuật", accent: true },
            { href: "/manage/appointments", label: "Lịch hẹn" },
            { href: "/manage/checkout", label: "Thanh toán" },
          ]}
        />

        <MobileSectionHeader title="Ca làm / Chấm công" meta={<div className="manage-info-box">{headerMeta}</div>} />

        {error ? <ManageAlert tone="error">Lỗi: {error}</ManageAlert> : null}

        {canUse ? (
          <section className="manage-surface space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Trạng thái ca hiện tại</h3>
                <p className="mt-1 text-sm text-neutral-500">Thợ chỉ cần quan tâm mình đã mở ca chưa, đang trong ca hay đã đóng ca.</p>
              </div>
              <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${activeEntry ? "border border-emerald-200 bg-emerald-50 text-emerald-800" : "border border-neutral-200 bg-neutral-50 text-neutral-700"}`}>
                {activeEntry ? "Đang trong ca" : "Chưa mở ca"}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
                {role === "OWNER" ? (
                  <p className="font-medium text-neutral-900">Theo dõi ca làm của đội ngũ.</p>
                ) : activeEntry ? (
                  <>
                    <p className="font-medium text-neutral-900">Đang trong ca.</p>
                    <p className="mt-1">Bắt đầu: {new Date(activeEntry.clock_in).toLocaleString("vi-VN")}</p>
                    <p className="mt-1">Thời lượng: {formatDuration(activeEntry.clock_in, null)}</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-neutral-900">Chưa có ca mở.</p>
                    <p className="mt-1">Có thể mở ca ngay khi bắt đầu làm việc.</p>
                  </>
                )}
              </div>
              <button onClick={clockIn} disabled={role === "OWNER" || submitting || Boolean(activeEntry)} className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Đang xử lý..." : "Mở ca"}</button>
              <button onClick={clockOut} disabled={role === "OWNER" || submitting || !activeEntry} className="btn btn-outline disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Đang xử lý..." : "Đóng ca"}</button>
            </div>
          </section>
        ) : <p className="text-sm text-amber-700">Vai trò hiện tại không được chấm công.</p>}

        <MobileInfoGrid>
          <ManageStatCard label="Tổng ca" value={filteredEntries.length} />
          <ManageStatCard label="Tổng thời lượng" value={`${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, "0")}m`} />
          <ManageStatCard label="Nhân sự hiển thị" value={new Set(filteredEntries.map((e) => e.staff_user_id)).size} />
        </MobileInfoGrid>

        {canManageView && (
          <section className="card space-y-3">
            <h3 className="font-semibold">Bộ lọc</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <select className="input" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
                <option value="ALL">Tất cả nhân sự</option>
                {visibleTeamMembers.map((m) => <option key={m.user_id} value={m.user_id}>{(m.display_name || String(m.user_id).slice(0, 8)).trim()}</option>)}
              </select>
              <select className="input" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="ALL">Tất cả vai trò</option>
                {roleOptions.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
          </section>
        )}

        <section className="card space-y-3 hidden md:block">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Danh sách ca</h3>
            <button type="button" className="btn btn-outline" onClick={exportCsv} disabled={loading || filteredEntries.length === 0}>Export CSV</button>
          </div>
          {loading ? <p className="text-sm text-neutral-500">Đang tải...</p> : (
            <div className="space-y-3">
              {filteredEntries.map((e) => {
                const member = memberMap.get(e.staff_user_id);
                return (
                  <div key={e.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-neutral-900">{member?.name ?? e.staff_user_id}</p>
                        <p className="text-sm text-neutral-500">{member?.role ?? "-"}</p>
                      </div>
                      <span className={`w-fit rounded-full px-3 py-1 text-xs ${e.clock_out ? "bg-neutral-100 text-neutral-700" : "bg-emerald-100 text-emerald-700"}`}>{e.clock_out ? "Đã đóng ca" : "Đang làm"}</span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-neutral-600 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-2xl bg-neutral-50 px-3 py-2">Mở ca: <span className="font-medium text-neutral-900">{new Date(e.clock_in).toLocaleString("vi-VN")}</span></div>
                      <div className="rounded-2xl bg-neutral-50 px-3 py-2">Đóng ca: <span className="font-medium text-neutral-900">{e.clock_out ? new Date(e.clock_out).toLocaleString("vi-VN") : "-"}</span></div>
                      <div className="rounded-2xl bg-neutral-50 px-3 py-2">Thời lượng: <span className="font-medium text-neutral-900">{formatDuration(e.clock_in, e.clock_out)}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <MobileCollapsible summary="Xem lịch sử ca" defaultOpen={false}>
          {loading ? <p className="text-sm text-neutral-500">Đang tải...</p> : (
            <div className="space-y-3">
              {filteredEntries.slice(0, 10).map((e) => {
                const member = memberMap.get(e.staff_user_id);
                return (
                  <div key={`mobile-${e.id}`} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <p className="font-semibold text-neutral-900">{member?.name ?? e.staff_user_id}</p>
                    <p className="mt-1 text-sm text-neutral-500">{formatDuration(e.clock_in, e.clock_out)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </MobileCollapsible>

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
