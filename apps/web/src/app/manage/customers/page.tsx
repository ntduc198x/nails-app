"use client";

import { AppShell } from "@/components/app-shell";
import { MobileCollapsible, MobileSectionHeader } from "@/components/manage-mobile";
import { ManageQuickNav, reportsQuickNav } from "@/components/manage-quick-nav";
import { type CustomerStatus, getCrmDashboardMetrics, listCustomersCrm, listFollowUpCandidates, type CustomerCrmSummary } from "@/lib/crm";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const STATUS_OPTIONS: Array<CustomerStatus | "ALL"> = ["ALL", "NEW", "ACTIVE", "RETURNING", "VIP", "AT_RISK", "LOST"];

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount || 0);
}

function statusTone(status: CustomerStatus) {
  if (status === "VIP") return "bg-amber-100 text-amber-800";
  if (status === "RETURNING") return "bg-violet-100 text-violet-800";
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-800";
  if (status === "AT_RISK") return "bg-orange-100 text-orange-800";
  if (status === "LOST") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN");
}

export default function CustomersPage() {
  const [rows, setRows] = useState<CustomerCrmSummary[]>([]);
  const [followUps, setFollowUps] = useState<CustomerCrmSummary[]>([]);
  const [metrics, setMetrics] = useState({ newToday: 0, returningToday: 0, atRiskCount: 0, repeat30: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CustomerStatus | "ALL">("ALL");
  const [source, setSource] = useState<"ALL" | string>("ALL");
  const [vipOnly, setVipOnly] = useState(false);
  const [dormantDays, setDormantDays] = useState<string>("30");

  const load = useCallback(async (silent?: boolean) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const dormant = dormantDays.trim() ? Number(dormantDays) : null;
      const [customers, due, dashboard] = await Promise.all([
        listCustomersCrm({
          search,
          status,
          source,
          vipOnly,
          dormantDays: Number.isFinite(dormant) ? dormant : null,
        }),
        listFollowUpCandidates(),
        getCrmDashboardMetrics(),
      ]);

      setRows(customers);
      setFollowUps(due.slice(0, 8));
      setMetrics(dashboard);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tải CRM khách hàng thất bại");
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [dormantDays, search, source, status, vipOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const sourceOptions = useMemo(() => {
    const values = new Set<string>();
    for (const row of rows) {
      if (row.source) values.add(row.source);
    }
    return ["ALL", ...Array.from(values.values())];
  }, [rows]);

  const customerListContent = loading ? (
    <div className="space-y-2">
      <div className="skeleton h-16 rounded-2xl" />
      <div className="skeleton h-16 rounded-2xl" />
      <div className="skeleton h-16 rounded-2xl" />
    </div>
  ) : rows.length === 0 ? (
    <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-8 text-sm text-neutral-500">
      Chưa có khách nào khớp bộ lọc hiện tại.
    </div>
  ) : (
    <div className="space-y-2">
      {rows.map((row) => (
        <Link
          key={row.id}
          href={`/manage/customers/${row.id}`}
          className="block rounded-2xl border border-neutral-200 bg-white px-4 py-3 transition hover:border-rose-200 hover:bg-rose-50/40"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="truncate text-sm font-semibold text-neutral-900 md:text-base">{row.full_name}</div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone(row.customer_status)}`}>
                  {row.customer_status}
                </span>
                {row.needs_merge_review ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">Cần rà soát</span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-500">
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-800">{row.phone ?? "Chưa có SĐT"}</span>
                <span>•</span>
                <span>{row.total_visits} lượt</span>
                <span>•</span>
                <span>{formatVnd(row.total_spend)}</span>
                <span>•</span>
                <span>{row.source ?? "walk-in"}</span>
              </div>
              <div className="mt-2 text-xs text-neutral-600">
                Lần gần nhất: <span className="font-medium text-neutral-800">{formatDateTime(row.last_visit_at)}</span>
              </div>
              {row.last_service_summary ? (
                <div className="mt-1 line-clamp-1 text-xs text-neutral-600">Dịch vụ gần nhất: {row.last_service_summary}</div>
              ) : null}
              {row.care_note ? (
                <div className="mt-1 line-clamp-2 text-xs text-neutral-600">Ghi chú: {row.care_note}</div>
              ) : null}
            </div>
            <div className="shrink-0 text-left text-xs text-neutral-500 md:text-right">
              <div>Follow-up</div>
              <div className="mt-1 font-medium text-neutral-800">{formatDateTime(row.next_follow_up_at)}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );

  return (
    <AppShell>
      <div className="space-y-5 pb-24 md:pb-0">
        <ManageQuickNav items={reportsQuickNav("/manage/customers")} />

        <MobileSectionHeader
          title="CRM khách"
          meta={<div className="manage-info-box">{refreshing ? "Đang làm mới..." : `${rows.length} khách`}</div>}
        />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3">
            <div className="text-[11px] text-neutral-500">Khách mới hôm nay</div>
            <div className="mt-1 text-lg font-semibold text-neutral-900">{metrics.newToday}</div>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3">
            <div className="text-[11px] text-neutral-500">Khách quay lại</div>
            <div className="mt-1 text-lg font-semibold text-neutral-900">{metrics.returningToday}</div>
          </div>
          <div className="rounded-2xl border border-orange-200 bg-orange-50 px-3 py-3">
            <div className="text-[11px] text-orange-700">Có nguy cơ rời bỏ</div>
            <div className="mt-1 text-lg font-semibold text-orange-900">{metrics.atRiskCount}</div>
          </div>
          <div className="rounded-2xl bg-[var(--color-primary)] px-3 py-3 text-white">
            <div className="text-[11px] text-white/80">Repeat rate 30 ngày</div>
            <div className="mt-1 text-lg font-semibold">{metrics.repeat30}%</div>
          </div>
        </section>

        <section className="manage-surface space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-neutral-900">Bộ lọc CRM</h3>
            <button
              type="button"
              onClick={() => void load(true)}
              className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700"
            >
              Làm mới
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-5">
            <input
              className="input py-2.5 text-sm"
              placeholder="Tìm tên hoặc số điện thoại"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="input py-2.5 text-sm" value={status} onChange={(e) => setStatus(e.target.value as CustomerStatus | "ALL")}>
              {STATUS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item === "ALL" ? "Tất cả trạng thái" : item}
                </option>
              ))}
            </select>
            <select className="input py-2.5 text-sm" value={source} onChange={(e) => setSource(e.target.value)}>
              {sourceOptions.map((item) => (
                <option key={item} value={item}>
                  {item === "ALL" ? "Tất cả nguồn" : item}
                </option>
              ))}
            </select>
            <input
              className="input py-2.5 text-sm"
              type="number"
              min={0}
              value={dormantDays}
              onChange={(e) => setDormantDays(e.target.value)}
              placeholder="Lâu chưa quay lại (ngày)"
            />
            <label className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-700">
              <input type="checkbox" checked={vipOnly} onChange={(e) => setVipOnly(e.target.checked)} />
              Chỉ khách VIP
            </label>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <div className="manage-surface hidden space-y-3 p-4 md:block">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-neutral-900">Danh sách khách</h3>
              <div className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-medium text-neutral-700">{rows.length} khách</div>
            </div>

            {customerListContent}
          </div>

          <MobileCollapsible
            defaultOpen
            summary={
              <div className="flex items-center justify-between gap-3 pr-2">
                <span>Danh sách khách</span>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-medium text-neutral-700">{rows.length} khách</span>
              </div>
            }
          >
            {customerListContent}
          </MobileCollapsible>

          <div className="space-y-4">
            <div className="manage-surface space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-neutral-900">Đến hạn chăm sóc</h3>
                <div className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-medium text-neutral-700">{followUps.length}</div>
              </div>

              {followUps.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-500">
                  Chưa có khách nào đến hạn follow-up.
                </div>
              ) : (
                <div className="space-y-2">
                  {followUps.map((row) => (
                    <div key={`follow-up-${row.id}`} className="rounded-2xl border border-neutral-200 bg-white px-3 py-3">
                      <div className="text-sm font-semibold text-neutral-900">{row.full_name}</div>
                      <div className="mt-1 text-xs text-neutral-500">{row.phone ?? "Chưa có SĐT"} • {formatDateTime(row.next_follow_up_at)}</div>
                      <div className="mt-2 flex gap-2">
                        <Link
                          href={`/manage/customers/${row.id}`}
                          className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700"
                        >
                          Mở hồ sơ
                        </Link>
                        <a
                          href={`https://t.me/share/url?url=${encodeURIComponent("https://chambeauty.example/crm")}&text=${encodeURIComponent(`Nhắc follow-up khách ${row.full_name} - ${row.phone ?? "chưa có SĐT"}`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="cursor-pointer rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700"
                        >
                          Tạo nhắc Telegram
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
