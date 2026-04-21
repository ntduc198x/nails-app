import type { SharedSupabaseClient } from "./org";
import { ensureOrgContext } from "./org";

export type MobileCheckoutService = {
  id: string;
  name: string;
  durationMin: number;
  basePrice: number;
  vatRate: number;
  featuredInLookbook: boolean;
  active: boolean;
};

export type MobileRecentTicketSummary = {
  id: string;
  status: string;
  createdAt: string;
  grandTotal: number;
  customerName: string | null;
  receiptToken: string | null;
};

export type MobileCheckoutInput = {
  customerName: string;
  paymentMethod: "CASH" | "TRANSFER";
  lines: Array<{ serviceId: string; qty: number }>;
  appointmentId?: string | null;
  dedupeWindowMs?: number;
  idempotencyKey?: string | null;
};

export async function listServicesForMobile(
  client: SharedSupabaseClient,
): Promise<MobileCheckoutService[]> {
  const { orgId } = await ensureOrgContext(client);

  let { data, error } = await client
    .from("services")
    .select("id,name,duration_min,base_price,vat_rate,featured_in_lookbook,active")
    .eq("org_id", orgId)
    .order("name", { ascending: true });

  if (error) {
    const message = error.message || "";
    const missingNewFields = message.includes("featured_in_lookbook");
    if (!missingNewFields) {
      throw error;
    }

    const fallback = await client
      .from("services")
      .select("id,name,duration_min,base_price,vat_rate,active")
      .eq("org_id", orgId)
      .order("name", { ascending: true });

    if (fallback.error) {
      throw fallback.error;
    }

    data = (fallback.data ?? []).map((row) => ({
      ...row,
      featured_in_lookbook: false,
    }));
  }

  return (data ?? []).map((row) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? "-"),
    durationMin: Number(row.duration_min ?? 0),
    basePrice: Number(row.base_price ?? 0),
    vatRate: Number(row.vat_rate ?? 0),
    featuredInLookbook: Boolean(row.featured_in_lookbook),
    active: row.active !== false,
  }));
}

export async function listRecentTicketsForMobile(
  client: SharedSupabaseClient,
  options?: { fromIso?: string; toIso?: string; limit?: number },
): Promise<MobileRecentTicketSummary[]> {
  const { orgId } = await ensureOrgContext(client);

  let query = client
    .from("tickets")
    .select("id,status,totals_json,created_at,customers(name),receipts(public_token,expires_at)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 20);

  if (options?.fromIso) {
    query = query.gte("created_at", options.fromIso);
  }
  if (options?.toIso) {
    query = query.lte("created_at", options.toIso);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
    const receipt = Array.isArray(row.receipts) ? row.receipts[0] : row.receipts;

    return {
      id: String(row.id ?? ""),
      status: String(row.status ?? ""),
      createdAt: String(row.created_at ?? ""),
      grandTotal: Number((row.totals_json as { grand_total?: number } | null)?.grand_total ?? 0),
      customerName: typeof customer?.name === "string" ? customer.name : null,
      receiptToken: typeof receipt?.public_token === "string" ? receipt.public_token : null,
    };
  });
}

export async function hasOpenShiftForMobile(
  client: SharedSupabaseClient,
  userId?: string,
) {
  const { orgId } = await ensureOrgContext(client);

  let targetUserId = userId;
  if (!targetUserId) {
    const { data } = await client.auth.getSession();
    targetUserId = data.session?.user?.id;
  }

  if (!targetUserId) {
    throw new Error("Chua dang nhap");
  }

  const { count, error } = await client
    .from("time_entries")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("staff_user_id", targetUserId)
    .is("clock_out", null)
    .limit(1);

  if (error) {
    throw error;
  }

  return (count ?? 0) > 0;
}

export async function createCheckoutForMobile(
  client: SharedSupabaseClient,
  input: MobileCheckoutInput,
) {
  if (!input.lines.length) {
    throw new Error("CHECKOUT_LINES_REQUIRED");
  }

  const params = {
    p_customer_name: input.customerName,
    p_payment_method: input.paymentMethod,
    p_lines: input.lines,
    p_appointment_id: input.appointmentId ?? null,
    p_dedupe_window_ms: input.dedupeWindowMs ?? 15000,
    p_idempotency_key: input.idempotencyKey ?? null,
  };

  let { data: rpcData, error: rpcError } = await client.rpc("checkout_close_ticket_secure", params);
  const rpcMessage = rpcError
    ? [rpcError.message, (rpcError as { details?: string }).details, (rpcError as { hint?: string }).hint]
        .filter(Boolean)
        .join(" | ")
    : "";

  if (rpcError && rpcMessage.includes("FORBIDDEN")) {
    const fallback = await client.rpc("create_checkout_secure", params);
    rpcData = fallback.data;
    rpcError = fallback.error;
  }

  if (rpcError) {
    throw rpcError;
  }

  if (!rpcData) {
    throw new Error("Checkout RPC khong tra du lieu.");
  }

  const output = rpcData as {
    ticketId?: string;
    ticket_id?: string;
    receiptToken?: string;
    receipt_token?: string;
    grandTotal?: number;
    grand_total?: number;
    deduped?: boolean;
  };

  const ticketId = output.ticketId ?? output.ticket_id ?? "";
  let receiptToken = output.receiptToken ?? output.receipt_token ?? "";

  if (!receiptToken && ticketId) {
    const { data: receiptRows } = await client
      .from("receipts")
      .select("public_token")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false })
      .limit(1);

    receiptToken = typeof receiptRows?.[0]?.public_token === "string" ? receiptRows[0].public_token : "";
  }

  return {
    ticketId,
    receiptToken,
    grandTotal: Number(output.grandTotal ?? output.grand_total ?? 0),
    deduped: Boolean(output.deduped),
  };
}
