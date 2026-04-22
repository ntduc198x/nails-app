import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

function formatVnd(n: number) {
  return `${new Intl.NumberFormat("vi-VN").format(n)}đ`;
}

type Params = { token: string };

export default async function ReceiptPage({ params }: { params: Promise<Params> }) {
  const { token } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return <main className="p-8">Thiếu cấu hình Supabase.</main>;
  }

  const supabase = createClient(url, key);

  const { data: payload, error: receiptErr } = await supabase.rpc("get_receipt_public", { p_token: token });

  if (receiptErr || !payload) {
    return <main className="p-8">Không tìm thấy receipt hoặc link đã hết hạn.</main>;
  }

  const receiptData = payload as {
    ticket?: { id?: string; created_at?: string; totals_json?: { subtotal?: number; vat_total?: number; grand_total?: number } };
    customer?: { name?: string };
    payment?: { method?: string; amount?: number; status?: string };
    items?: Array<{ qty?: number; unit_price?: number; vat_rate?: number; service_name?: string }>;
  };

  const ticket = receiptData.ticket;
  if (!ticket?.id || !ticket.created_at) {
    return <main className="p-8">Không tìm thấy ticket.</main>;
  }

  const customer = receiptData.customer;
  const items = receiptData.items ?? [];
  const payment = receiptData.payment;
  const totals = receiptData.ticket?.totals_json ?? {};

  return (
    <main className="mx-auto max-w-2xl space-y-4 bg-white p-6 print:max-w-full print:p-2">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">Hóa đơn</h1>
        <div className="flex gap-2">
          <Link href="/manage/reports" className="rounded border px-3 py-1 text-sm">
            Về báo cáo
          </Link>
          <span className="rounded border px-3 py-1 text-sm">In: Ctrl/Cmd + P</span>
        </div>
      </div>
      <div className="rounded-xl border p-4 print:rounded-none print:border-0 print:p-0">
        <p>Khách: {customer?.name ?? "-"}</p>
        <p>Thời gian: {new Date(ticket.created_at).toLocaleString("vi-VN")}</p>
        <p>Thanh toán: {payment?.method ?? "-"}</p>
      </div>

      <div className="rounded-xl border p-4">
        <h2 className="mb-2 font-semibold">Chi tiết dịch vụ</h2>
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
            {items.map((it, idx) => {
              return (
                <tr key={idx} className="border-t">
                  <td className="py-2">{it.service_name ?? "-"}</td>
                  <td>{it.qty}</td>
                  <td>{formatVnd(Number(it.unit_price ?? 0))}</td>
                  <td>{Number(it.vat_rate ?? 0) * 100}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border p-4 text-sm">
        <p>Tạm tính: {formatVnd(Number(totals.subtotal ?? 0))}</p>
        <p>VAT: {formatVnd(Number(totals.vat_total ?? 0))}</p>
        <p className="mt-2 text-lg font-semibold">Tổng: {formatVnd(Number(totals.grand_total ?? 0))}</p>
      </div>
    </main>
  );
}
