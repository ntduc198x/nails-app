import type { SharedSupabaseClient } from "./org";
import { getTicketDetailForMobile, listTicketsInRangeForMobile, listTimeEntriesInRangeForMobile } from "./reporting";

export type TaxBookType = "S1A_HKD" | "S2A_HKD" | "S3A_HKD";

export type MobileTaxBookRow = {
  date: string;
  description: string;
  amount: number;
};

function buildServiceCustomerDescription(serviceNames: string[], customerName?: string | null) {
  const serviceLabel = serviceNames.length > 0 ? serviceNames.join(" + ") : "Dịch vụ";
  const customerLabel = customerName?.trim() ? customerName.trim() : "khách lẻ";
  return `${serviceLabel} - ${customerLabel}`;
}

export async function buildTaxBookForMobile(
  client: SharedSupabaseClient,
  type: TaxBookType,
  fromIso: string,
  toIso: string,
): Promise<MobileTaxBookRow[]> {
  if (type === "S1A_HKD" || type === "S2A_HKD") {
    const tickets = (await listTicketsInRangeForMobile(client, fromIso, toIso)).filter((ticket) => ticket.status === "CLOSED");
    const details = await Promise.all(
      tickets.map(async (ticket) => {
        try {
          const detail = await getTicketDetailForMobile(client, ticket.id);
          const serviceNames = [...new Set((detail.items ?? []).map((item) => item.serviceName).filter(Boolean))];
          const description = buildServiceCustomerDescription(serviceNames, detail.customer?.name ?? ticket.customerName ?? null);
          return { ticket, description };
        } catch {
          return {
            ticket,
            description: buildServiceCustomerDescription([], ticket.customerName ?? null),
          };
        }
      }),
    );

    return details.map(({ ticket, description }) => ({
      date: ticket.createdAt,
      description: type === "S1A_HKD" ? description : `VAT - ${description}`,
      amount: Number(type === "S1A_HKD" ? ticket.grandTotal : ticket.vat),
    }));
  }

  const entries = await listTimeEntriesInRangeForMobile(client, fromIso, toIso);
  return (entries as Array<{ staff_user_id?: string | null; effective_clock_in?: string | null; effective_clock_out?: string | null }>).map((entry) => {
    const start = typeof entry.effective_clock_in === "string" ? new Date(entry.effective_clock_in).getTime() : NaN;
    const end = typeof entry.effective_clock_out === "string" ? new Date(entry.effective_clock_out).getTime() : Date.now();
    const minutes = Number.isNaN(start) || Number.isNaN(end) ? 0 : Math.max(0, Math.round((end - start) / 60000));

    return {
      date: typeof entry.effective_clock_in === "string" ? entry.effective_clock_in : new Date().toISOString(),
      description: `Công thợ ${(entry.staff_user_id ?? "staff").slice(0, 8)} (${minutes} phút)`,
      amount: 0,
    };
  });
}
