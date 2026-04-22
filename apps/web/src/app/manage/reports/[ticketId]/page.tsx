"use client";

import { getTicketDetail } from "@/lib/reporting";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

function formatVnd(n: number) {
  return `${new Intl.NumberFormat("vi-VN").format(n)}đ`;
}

type Detail = Awaited<ReturnType<typeof getTicketDetail>>;

export default function TicketDetailPage() {
  const params = useParams<{ ticketId: string }>();
  const ticketId = params?.ticketId;

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      if (!ticketId) return;
      try {
        setLoading(true);
        setError(null);
        const data = await getTicketDetail(ticketId);
        setDetail(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [ticketId]);

  if (loading) return <main className="mx-auto max-w-5xl p-6"><div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm text-sm text-neutral-500">Đang tải chi tiết phiếu...</div></main>;
  if (error || !detail)
    return <main className="mx-auto max-w-5xl p-6"><div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Không tải được chi tiết phiếu: {error ?? "Không có dữ liệu"}</div></main>;

  const totals = (detail.ticket.totals_json as { subtotal?: number; vat_total?: number; grand_total?: number } | null) ?? {};

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-6">
      <section className="manage-surface">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Chi tiết phiếu</h1>
            <p className="mt-1 text-sm text-neutral-500">Chi tiết bill, thanh toán và hóa đơn trong cùng một màn hình.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="manage-quick-link" href="/manage/reports">Quay lại báo cáo</Link>
            {detail.receipt?.public_token && <Link className="manage-quick-link" href={`/receipt/${detail.receipt.public_token}`}>Mở hóa đơn</Link>}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="manage-surface text-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-neutral-500">Mã phiếu</p>
                <p className="mt-1 font-semibold text-neutral-900">{detail.ticket.id}</p>
              </div>
              <div>
                <p className="text-neutral-500">Thời gian</p>
                <p className="mt-1 font-semibold text-neutral-900">{new Date(detail.ticket.created_at).toLocaleString("vi-VN")}</p>
              </div>
              <div>
                <p className="text-neutral-500">Khách hàng</p>
                <p className="mt-1 font-semibold text-neutral-900">{detail.customer?.name ?? "-"}</p>
              </div>
              <div>
                <p className="text-neutral-500">Số điện thoại</p>
                <p className="mt-1 font-semibold text-neutral-900">{detail.customer?.phone ?? "-"}</p>
              </div>
              <div>
                <p className="text-neutral-500">Trạng thái</p>
                <p className="mt-1 font-semibold text-neutral-900">{detail.ticket.status}</p>
              </div>
              <div>
                <p className="text-neutral-500">Thanh toán</p>
                <p className="mt-1 font-semibold text-neutral-900">{detail.payment?.method ?? "-"} ({detail.payment?.status ?? "-"})</p>
              </div>
            </div>
          </div>

          <div className="manage-surface">
            <h2 className="mb-3 font-semibold text-neutral-900">Dịch vụ trong phiếu</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-neutral-500">
                  <tr>
                    <th className="py-2">Dịch vụ</th>
                    <th>SL</th>
                    <th>Đơn giá</th>
                    <th>VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.length === 0 ? (
                    <tr className="border-t border-neutral-100">
                      <td className="py-3 text-neutral-500" colSpan={4}>Không có ticket items cho bill này (có thể là bill cũ bị lỗi trước khi fix RLS).</td>
                    </tr>
                  ) : (
                    detail.items.map((it, idx) => (
                      <tr key={idx} className="border-t border-neutral-100">
                        <td className="py-2">{it.service_name ?? "-"}</td>
                        <td>{it.qty}</td>
                        <td>{formatVnd(Number(it.unit_price))}</td>
                        <td>{Number(it.vat_rate) * 100}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="manage-surface text-sm">
            <h2 className="font-semibold text-neutral-900">Tổng kết bill</h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between"><span className="text-neutral-500">Subtotal</span><span className="font-semibold text-neutral-900">{formatVnd(Number(totals.subtotal ?? 0))}</span></div>
              <div className="flex items-center justify-between"><span className="text-neutral-500">VAT</span><span className="font-semibold text-neutral-900">{formatVnd(Number(totals.vat_total ?? 0))}</span></div>
              <div className="rounded-2xl bg-neutral-900 p-4 text-white"><div className="text-sm text-white/70">Tổng thanh toán</div><div className="mt-2 text-2xl font-semibold">{formatVnd(Number(totals.grand_total ?? 0))}</div></div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
