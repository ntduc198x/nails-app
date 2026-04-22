"use client";

import { AppShell } from "@/components/app-shell";
import { ManageQuickNav, setupQuickNav } from "@/components/manage-quick-nav";
import { getCustomerCrmDetail, updateCustomerCareNote } from "@/lib/crm";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount || 0);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN");
}

function toDatetimeLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function CustomerDetailPage() {
  const params = useParams<{ customerId: string }>();
  const router = useRouter();
  const customerId = params?.customerId ?? "";

  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getCustomerCrmDetail>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [careNote, setCareNote] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const payload = await getCustomerCrmDetail(customerId);
      setDetail(payload);
      setCareNote(payload.customer.care_note ?? "");
      setTagsText((payload.customer.tags ?? []).join(", "));
      setFollowUpAt(toDatetimeLocalInput(payload.customer.next_follow_up_at));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được hồ sơ khách");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (!customerId) return;
    void load();
  }, [customerId, load]);

  const telegramReminderText = useMemo(() => {
    if (!detail) return "";
    return `Nhắc chăm sóc khách ${detail.customer.full_name} - ${detail.customer.phone ?? "chưa có SĐT"}.\nGhi chú: ${detail.customer.care_note ?? "chưa có"}\nFollow-up: ${detail.customer.next_follow_up_at ? formatDateTime(detail.customer.next_follow_up_at) : "chưa đặt"}`;
  }, [detail]);

  async function onSave() {
    if (!detail) return;

    try {
      setSaving(true);
      setError(null);
      await updateCustomerCareNote({
        customerId: detail.customer.id,
        careNote,
        tags: tagsText.split(",").map((item) => item.trim()).filter(Boolean),
        nextFollowUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
        followUpStatus: "PENDING",
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được ghi chú CRM");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-5 pb-24 md:pb-0">
        <ManageQuickNav items={setupQuickNav("/manage/customers")} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/manage/customers")}
            className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700"
          >
            ← Quay lại CRM
          </button>
          {detail ? (
            <div className="manage-info-box">{detail.customer.customer_status} • {detail.customer.total_visits} lượt</div>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {loading || !detail ? (
          <div className="space-y-3">
            <div className="skeleton h-28 rounded-3xl" />
            <div className="skeleton h-52 rounded-3xl" />
          </div>
        ) : (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_380px]">
            <div className="space-y-4">
              <div className="manage-surface space-y-4 p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-900">{detail.customer.full_name}</h2>
                    <div className="mt-1 text-sm text-neutral-500">{detail.customer.phone ?? "Chưa có số điện thoại"} • {detail.customer.source ?? "walk-in"}</div>
                  </div>
                  <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-right">
                    <div className="text-[11px] text-neutral-500">Tổng chi tiêu</div>
                    <div className="mt-1 text-lg font-semibold text-neutral-900">{formatVnd(detail.customer.total_spend)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3">
                    <div className="text-[11px] text-neutral-500">Lần đầu</div>
                    <div className="mt-1 text-sm font-medium text-neutral-900">{formatDateTime(detail.customer.first_visit_at)}</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3">
                    <div className="text-[11px] text-neutral-500">Lần gần nhất</div>
                    <div className="mt-1 text-sm font-medium text-neutral-900">{formatDateTime(detail.customer.last_visit_at)}</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3">
                    <div className="text-[11px] text-neutral-500">Số lượt</div>
                    <div className="mt-1 text-sm font-medium text-neutral-900">{detail.customer.total_visits}</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3">
                    <div className="text-[11px] text-neutral-500">Follow-up</div>
                    <div className="mt-1 text-sm font-medium text-neutral-900">{formatDateTime(detail.customer.next_follow_up_at)}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4">
                  <div className="text-sm font-semibold text-neutral-900">Dịch vụ gần nhất</div>
                  <div className="mt-2 text-sm text-neutral-700">{detail.customer.last_service_summary ?? "Chưa có dữ liệu dịch vụ gần nhất."}</div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4">
                    <div className="mb-3 text-sm font-semibold text-neutral-900">Lịch sử lịch hẹn</div>
                    <div className="space-y-2">
                      {detail.appointments.length === 0 ? (
                        <div className="text-sm text-neutral-500">Chưa có lịch hẹn nào.</div>
                      ) : (
                        detail.appointments.map((row) => (
                          <div key={row.id} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm">
                            <div className="font-medium text-neutral-900">{formatDateTime(row.start_at)}</div>
                            <div className="mt-1 text-xs text-neutral-500">{row.status}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4">
                    <div className="mb-3 text-sm font-semibold text-neutral-900">Lịch sử bill</div>
                    <div className="space-y-2">
                      {detail.tickets.length === 0 ? (
                        <div className="text-sm text-neutral-500">Chưa có bill nào.</div>
                      ) : (
                        detail.tickets.map((row) => (
                          <Link key={row.id} href={`/manage/reports/${row.id}`} className="block rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm transition hover:bg-neutral-100">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="font-medium text-neutral-900">{formatDateTime(row.created_at)}</div>
                                <div className="mt-1 text-xs text-neutral-500">{row.status}</div>
                              </div>
                              <div className="font-semibold text-neutral-900">{formatVnd(Number(row.totals_json?.grand_total ?? 0))}</div>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4">
                  <div className="mb-3 text-sm font-semibold text-neutral-900">Timeline CRM</div>
                  <div className="space-y-2">
                    {detail.activities.length === 0 ? (
                      <div className="text-sm text-neutral-500">Chưa có activity CRM nào.</div>
                    ) : (
                      detail.activities.map((row) => (
                        <div key={row.id} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium text-neutral-900">{row.type}</div>
                            <div className="text-xs text-neutral-500">{formatDateTime(row.created_at)}</div>
                          </div>
                          <div className="mt-1 text-sm text-neutral-700">{row.content_summary}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="manage-surface space-y-3 p-4 md:p-5">
                <h3 className="text-sm font-semibold text-neutral-900">Thao tác nhanh</h3>
                <div className="grid gap-2">
                  <Link
                    href={`/manage/appointments?customer=${encodeURIComponent(detail.customer.full_name)}&customerId=${detail.customer.id}`}
                    className="cursor-pointer rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                  >
                    Tạo lịch mới cho khách này
                  </Link>
                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent("https://chambeauty.example/crm")}&text=${encodeURIComponent(telegramReminderText)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="cursor-pointer rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
                  >
                    Mở Telegram để nhắc chăm sóc
                  </a>
                </div>
              </div>

              <div className="manage-surface space-y-3 p-4 md:p-5">
                <h3 className="text-sm font-semibold text-neutral-900">Ghi chú chăm sóc</h3>
                <textarea
                  className="input min-h-32 py-3 text-sm"
                  value={careNote}
                  onChange={(e) => setCareNote(e.target.value)}
                  placeholder="Lưu ý phục vụ, thói quen, sở thích, lưu ý follow-up..."
                />
                <input
                  className="input py-2.5 text-sm"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder="Tag, phân cách bằng dấu phẩy. Ví dụ: gel định kỳ, high value"
                />
                <input
                  className="input py-2.5 text-sm"
                  type="datetime-local"
                  value={followUpAt}
                  onChange={(e) => setFollowUpAt(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => void onSave()}
                  disabled={saving}
                  className="cursor-pointer rounded-2xl bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Đang lưu..." : "Lưu ghi chú CRM"}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
