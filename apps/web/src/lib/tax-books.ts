import { getTicketDetail, listTicketsInRange, listTimeEntriesInRange } from "@/lib/reporting";

export type TaxBookType = "S1A_HKD" | "S2A_HKD" | "S3A_HKD";

export type TaxBookRow = {
  date: string;
  description: string;
  amount: number;
};

function buildServiceCustomerDescription(serviceNames: string[], customerName?: string | null) {
  const serviceLabel = serviceNames.length > 0 ? serviceNames.join(" + ") : "Dịch vụ";
  const customerLabel = customerName?.trim() ? customerName.trim() : "khách lẻ";
  return `${serviceLabel} - ${customerLabel}`;
}

export async function buildTaxBook(type: TaxBookType, fromIso: string, toIso: string): Promise<TaxBookRow[]> {
  if (type === "S1A_HKD" || type === "S2A_HKD") {
    const tickets = (await listTicketsInRange(fromIso, toIso)).filter((t) => t.status === "CLOSED");
    const details = await Promise.all(
      tickets.map(async (t) => {
        try {
          const detail = await getTicketDetail(t.id);
          const serviceNames = [...new Set((detail.items ?? []).map((item) => item.service_name).filter(Boolean))];
          const description = buildServiceCustomerDescription(serviceNames, detail.customer?.name ?? null);
          return {
            ticket: t,
            description,
          };
        } catch {
          return {
            ticket: t,
            description: buildServiceCustomerDescription([], null),
          };
        }
      }),
    );

    return details.map(({ ticket, description }) => ({
      date: ticket.created_at,
      description: type === "S1A_HKD" ? description : `VAT - ${description}`,
      amount: Number(type === "S1A_HKD" ? ticket.totals_json?.grand_total ?? 0 : ticket.totals_json?.vat_total ?? 0),
    }));
  }

  const entries = await listTimeEntriesInRange(fromIso, toIso);
  return (entries as Array<{ staff_user_id: string; clock_in: string; clock_out: string | null }>).map((e) => {
    const start = new Date(e.clock_in).getTime();
    const end = e.clock_out ? new Date(e.clock_out).getTime() : Date.now();
    const mins = Math.max(0, Math.round((end - start) / 60000));
    return {
      date: e.clock_in,
      description: `Công thợ ${e.staff_user_id.slice(0, 8)} (${mins} phút)`,
      amount: 0,
    };
  });
}
