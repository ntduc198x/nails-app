import { listUserRoles } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type OrgContext = { orgId: string; branchId: string };

const TTL = 30_000;

let orgContextCache: { value: OrgContext; at: number } | null = null;
let servicesCache: { value: unknown[]; at: number } | null = null;
let resourcesCache: { value: unknown[]; at: number } | null = null;
let appointmentsCache: { value: unknown[]; at: number } | null = null;
let ticketsCache: { value: unknown[]; at: number } | null = null;
let resourceSchedulingSupported: boolean | null = null;

function isFresh(cache: { at: number } | null, ttl = TTL) {
  return !!cache && Date.now() - cache.at < ttl;
}

function invalidateDataCaches() {
  appointmentsCache = null;
  ticketsCache = null;
  resourcesCache = null;
}

function isMissingResourceSchema(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return msg.includes("resource_id") || msg.includes("resources") || msg.includes("staff_user_id");
}

export async function ensureOrgContext(opts?: { force?: boolean }): Promise<OrgContext> {
  if (!supabase) throw new Error("Supabase chưa cấu hình");

  if (!opts?.force && isFresh(orgContextCache, 5 * 60_000)) {
    return orgContextCache!.value;
  }

  const { data: orgs, error: orgErr } = await supabase.from("orgs").select("id").limit(1);
  if (orgErr) throw orgErr;

  let orgId = orgs?.[0]?.id as string | undefined;

  if (!orgId) {
    const { data: newOrg, error } = await supabase
      .from("orgs")
      .insert({ name: "Nails Demo Org" })
      .select("id")
      .single();
    if (error) throw error;
    orgId = newOrg.id;
  }

  const { data: branches, error: branchErr } = await supabase
    .from("branches")
    .select("id")
    .eq("org_id", orgId)
    .limit(1);
  if (branchErr) throw branchErr;

  let branchId = branches?.[0]?.id as string | undefined;

  if (!branchId) {
    const { data: newBranch, error } = await supabase
      .from("branches")
      .insert({ org_id: orgId, name: "Chi nhánh chính", timezone: "Asia/Bangkok", currency: "VND" })
      .select("id")
      .single();
    if (error) throw error;
    branchId = newBranch.id;
  }

  if (!orgId || !branchId) {
    throw new Error("Không thể khởi tạo org/branch context");
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (user) {
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id,org_id,default_branch_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileErr) throw profileErr;

    if (!profile) {
      const { error: insertProfileErr } = await supabase.from("profiles").insert({
        user_id: user.id,
        org_id: orgId,
        default_branch_id: branchId,
        display_name: (user.user_metadata?.display_name as string | undefined)?.trim() || user.email?.split("@")[0] || "User",
      });
      if (insertProfileErr) throw insertProfileErr;
    } else if (profile.org_id !== orgId || profile.default_branch_id !== branchId) {
      const { error: updateProfileErr } = await supabase
        .from("profiles")
        .update({ org_id: orgId, default_branch_id: branchId })
        .eq("user_id", user.id);
      if (updateProfileErr) throw updateProfileErr;
    }
  }

  const ctx = { orgId, branchId };
  orgContextCache = { value: ctx, at: Date.now() };
  return ctx;
}

export async function listServices(opts?: { force?: boolean }) {
  if (!supabase) return [];
  if (!opts?.force && isFresh(servicesCache)) return servicesCache!.value;

  const { orgId } = await ensureOrgContext();
  const { data, error } = await supabase
    .from("services")
    .select("id,name,duration_min,base_price,vat_rate,active")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  servicesCache = { value: rows, at: Date.now() };
  return rows;
}

export async function listResources(opts?: { force?: boolean; activeOnly?: boolean }) {
  if (!supabase) return [];
  if (!opts?.force && isFresh(resourcesCache)) return resourcesCache!.value;

  const { orgId } = await ensureOrgContext();
  let query = supabase
    .from("resources")
    .select("id,name,type,active")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (opts?.activeOnly ?? true) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingResourceSchema(error)) {
      resourceSchedulingSupported = false;
      resourcesCache = { value: [], at: Date.now() };
      return [];
    }
    throw error;
  }
  const rows = data ?? [];
  resourceSchedulingSupported = true;
  resourcesCache = { value: rows, at: Date.now() };
  return rows;
}

export async function createResource(input: { name: string; type: "CHAIR" | "TABLE" | "ROOM" }) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { orgId, branchId } = await ensureOrgContext();

  const { data, error } = await supabase
    .from("resources")
    .insert({
      org_id: orgId,
      branch_id: branchId,
      name: input.name,
      type: input.type,
      active: true,
    })
    .select("id,name,type,active")
    .single();
  if (error) throw error;

  resourcesCache = null;
  return data;
}

export async function updateResource(input: { id: string; name: string; type: "CHAIR" | "TABLE" | "ROOM"; active: boolean }) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { orgId } = await ensureOrgContext();

  const { data, error } = await supabase
    .from("resources")
    .update({ name: input.name, type: input.type, active: input.active })
    .eq("id", input.id)
    .eq("org_id", orgId)
    .select("id,name,type,active")
    .single();
  if (error) throw error;

  resourcesCache = null;
  return data;
}

export async function updateService(input: {
  id: string;
  name: string;
  durationMin: number;
  basePrice: number;
  vatPercent: number;
  active: boolean;
}) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { orgId } = await ensureOrgContext();

  const { data, error } = await supabase
    .from("services")
    .update({
      name: input.name,
      duration_min: input.durationMin,
      base_price: input.basePrice,
      vat_rate: input.vatPercent / 100,
      active: input.active,
    })
    .eq("id", input.id)
    .eq("org_id", orgId)
    .select("id")
    .single();
  if (error) throw error;

  servicesCache = null;
  return data;
}

export async function createService(input: {
  name: string;
  durationMin: number;
  basePrice: number;
  vatPercent: number;
}) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { orgId } = await ensureOrgContext();

  const { data, error } = await supabase
    .from("services")
    .insert({
      org_id: orgId,
      name: input.name,
      duration_min: input.durationMin,
      base_price: input.basePrice,
      vat_rate: input.vatPercent / 100,
      active: true,
    })
    .select("id,name,duration_min,base_price,vat_rate,active")
    .single();
  if (error) throw error;

  if (servicesCache) {
    servicesCache = { value: [data, ...(servicesCache.value as unknown[])], at: Date.now() };
  }

  return data;
}

async function findOrCreateCustomer(orgId: string, name: string) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");

  const { data: existing, error: findErr } = await supabase
    .from("customers")
    .select("id")
    .eq("org_id", orgId)
    .eq("name", name)
    .limit(1);
  if (findErr) throw findErr;
  if (existing?.[0]?.id) return existing[0].id as string;

  const { data: created, error: createErr } = await supabase
    .from("customers")
    .insert({ org_id: orgId, name })
    .select("id")
    .single();
  if (createErr) throw createErr;
  return created.id as string;
}

export async function listStaffMembers() {
  const teamRows = (await listUserRoles()) as Array<{ user_id: string; role: string; display_name?: string }>;
  return (teamRows ?? [])
    .filter((r) => r.role === "TECH")
    .map((r) => ({
      userId: r.user_id,
      name: r.display_name || String(r.user_id).slice(0, 8),
    }));
}

export async function listAppointments(opts?: { force?: boolean }) {
  if (!supabase) return [];
  if (!opts?.force && isFresh(appointmentsCache)) return appointmentsCache!.value;

  const { orgId } = await ensureOrgContext();

  let { data, error } = await supabase
    .from("appointments")
    .select("id,start_at,end_at,status,staff_user_id,resource_id,customers(name),booking_requests!booking_requests_appointment_id_fkey(id,source)")
    .eq("org_id", orgId)
    .order("start_at", { ascending: true })
    .limit(50);

  if (error && isMissingResourceSchema(error)) {
    resourceSchedulingSupported = false;
    const fallback = await supabase
      .from("appointments")
      .select("id,start_at,end_at,status,customers(name),booking_requests!booking_requests_appointment_id_fkey(id,source)")
      .eq("org_id", orgId)
      .order("start_at", { ascending: true })
      .limit(50);
    data = (fallback.data ?? []).map((row) => ({ ...row, staff_user_id: null, resource_id: null }));
    error = fallback.error;
  }

  if (error) throw error;
  const rows = data ?? [];
  appointmentsCache = { value: rows, at: Date.now() };
  return rows;
}

export async function createAppointment(input: {
  customerName: string;
  startAt: string;
  endAt: string;
  staffUserId?: string | null;
  resourceId?: string | null;
  appointmentId?: string | null;
}) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { orgId, branchId } = await ensureOrgContext();

  let overlaps: Array<{ staff_user_id?: string | null; resource_id?: string | null; customers?: { name?: string } | Array<{ name?: string }> | null }> = [];

  if (resourceSchedulingSupported !== false) {
    const overlapRes = await supabase
      .from("appointments")
      .select("id,start_at,end_at,staff_user_id,resource_id,customers(name)")
      .eq("org_id", orgId)
      .eq("status", "BOOKED")
      .lt("start_at", input.endAt)
      .gt("end_at", input.startAt)
      .limit(50);

    if (overlapRes.error) {
      if (isMissingResourceSchema(overlapRes.error)) {
        resourceSchedulingSupported = false;
      } else {
        throw overlapRes.error;
      }
    } else {
      resourceSchedulingSupported = true;
      overlaps = (overlapRes.data ?? []) as typeof overlaps;

      if (input.staffUserId) {
        const conflictStaff = overlaps.find((row) => row.staff_user_id === input.staffUserId);
        if (conflictStaff) {
          const c = conflictStaff.customers as { name?: string } | Array<{ name?: string }> | null | undefined;
          const customer = Array.isArray(c) ? c[0]?.name : c?.name;
          throw new Error(`Thợ đã có lịch trùng giờ${customer ? ` với khách ${customer}` : ""}.`);
        }
      }

      if (input.resourceId) {
        const conflictResource = overlaps.find((row) => row.resource_id === input.resourceId);
        if (conflictResource) {
          const c = conflictResource.customers as { name?: string } | Array<{ name?: string }> | null | undefined;
          const customer = Array.isArray(c) ? c[0]?.name : c?.name;
          throw new Error(`Ghế/Bàn đã được dùng ở khung giờ này${customer ? ` cho khách ${customer}` : ""}.`);
        }
      }
    }
  }

  const customerId = await findOrCreateCustomer(orgId, input.customerName);

  let error;
  if (input.appointmentId) {
    const updateRes = await supabase.from("appointments").update({
      customer_id: customerId,
      start_at: input.startAt,
      end_at: input.endAt,
      staff_user_id: input.staffUserId ?? null,
      resource_id: input.resourceId ?? null,
    }).eq("id", input.appointmentId).eq("org_id", orgId).eq("status", "BOOKED");
    error = updateRes.error;
  } else {
    const insertRes = await supabase.from("appointments").insert({
      org_id: orgId,
      branch_id: branchId,
      customer_id: customerId,
      start_at: input.startAt,
      end_at: input.endAt,
      staff_user_id: input.staffUserId ?? null,
      resource_id: input.resourceId ?? null,
      status: "BOOKED",
    });
    error = insertRes.error;
  }

  if (error && isMissingResourceSchema(error)) {
    resourceSchedulingSupported = false;
    const fallback = await supabase.from("appointments").insert({
      org_id: orgId,
      branch_id: branchId,
      customer_id: customerId,
      start_at: input.startAt,
      end_at: input.endAt,
      status: "BOOKED",
    });
    error = fallback.error;
  }

  if (error) {
    const message = [error.message, (error as { details?: string }).details, (error as { hint?: string }).hint]
      .filter(Boolean)
      .join(" | ");
    throw new Error(message || "Create appointment failed");
  }
  invalidateDataCaches();
}

export async function listCheckedInAppointments() {
  if (!supabase) return [];
  const { orgId } = await ensureOrgContext();

  const { data, error } = await supabase
    .from("appointments")
    .select("id,start_at,staff_user_id,resource_id,customers(name)")
    .eq("org_id", orgId)
    .eq("status", "CHECKED_IN")
    .order("start_at", { ascending: true })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

export async function updateAppointmentStatus(appointmentId: string, status: "BOOKED" | "CHECKED_IN" | "DONE" | "CANCELLED" | "NO_SHOW") {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { orgId } = await ensureOrgContext();

  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", appointmentId)
    .eq("org_id", orgId);

  if (error) throw error;
  invalidateDataCaches();
}

type CheckoutInput = {
  customerName: string;
  paymentMethod: "CASH" | "TRANSFER";
  lines: Array<{ serviceId: string; qty: number }>;
  appointmentId?: string;
  dedupeWindowMs?: number;
  idempotencyKey?: string;
};

export async function createCheckout(input: CheckoutInput) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  if (!input.lines.length) throw new Error("Cần ít nhất 1 dịch vụ");

  const rpcDedupeWindowMs = input.dedupeWindowMs ?? 15000;
  const params = {
    p_customer_name: input.customerName,
    p_payment_method: input.paymentMethod,
    p_lines: input.lines,
    p_appointment_id: input.appointmentId ?? null,
    p_dedupe_window_ms: rpcDedupeWindowMs,
    p_idempotency_key: input.idempotencyKey ?? null,
  };

  let { data: rpcData, error: rpcErr } = await supabase.rpc("checkout_close_ticket_secure", params);

  const combinedErr = rpcErr
    ? [rpcErr.message, (rpcErr as { details?: string }).details, (rpcErr as { hint?: string }).hint]
        .filter(Boolean)
        .join(" | ")
    : "";

  if (rpcErr && combinedErr.includes("FORBIDDEN")) {
    const fallback = await supabase.rpc("create_checkout_secure", params);
    rpcData = fallback.data;
    rpcErr = fallback.error;
  }

  if (!rpcErr && rpcData) {
    ticketsCache = null;
    invalidateDataCaches();

    const out = rpcData as {
      ticketId?: string;
      ticket_id?: string;
      receiptToken?: string;
      receipt_token?: string;
      grandTotal?: number;
      grand_total?: number;
      deduped?: boolean;
    };

    const ticketId = out.ticketId ?? out.ticket_id ?? "";
    let receiptToken = out.receiptToken ?? out.receipt_token ?? "";

    if (!receiptToken && ticketId) {
      const { data: receiptRows } = await supabase
        .from("receipts")
        .select("public_token")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false })
        .limit(1);

      receiptToken = (receiptRows?.[0]?.public_token as string | undefined) ?? "";
    }

    return {
      ticketId,
      receiptToken,
      grandTotal: Number(out.grandTotal ?? out.grand_total ?? 0),
      deduped: Boolean(out.deduped),
    };
  }

  if (rpcErr) {
    throw rpcErr;
  }

  throw new Error("Checkout RPC không trả dữ liệu.");
}

export async function listRecentTickets(opts?: { force?: boolean; fromIso?: string; toIso?: string; limit?: number }) {
  if (!supabase) return [];
  const useCache = !opts?.force && !opts?.fromIso && !opts?.toIso && isFresh(ticketsCache);
  if (useCache) return ticketsCache!.value;

  const { orgId } = await ensureOrgContext();

  let query = supabase
    .from("tickets")
    .select("id,status,totals_json,created_at,customers(name),receipts(public_token,expires_at)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);

  if (opts?.fromIso) query = query.gte("created_at", opts.fromIso);
  if (opts?.toIso) query = query.lte("created_at", opts.toIso);

  const { data, error } = await query;

  if (error) throw error;
  const rows = data ?? [];
  if (!opts?.fromIso && !opts?.toIso) {
    ticketsCache = { value: rows, at: Date.now() };
  }
  return rows;
}

export async function subscribeAppointmentsRealtime(onChange: () => void): Promise<RealtimeChannel | null> {
  if (!supabase) return null;
  const { orgId } = await ensureOrgContext();

  const channel = supabase
    .channel(`appointments-org-${orgId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "appointments",
        filter: `org_id=eq.${orgId}`,
      },
      () => {
        appointmentsCache = null;
        onChange();
      },
    )
    .subscribe();

  return channel;
}

export function unsubscribeRealtime(channel: RealtimeChannel | null | undefined) {
  if (!supabase || !channel) return;
  supabase.removeChannel(channel);
}
