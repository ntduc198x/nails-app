import { NextResponse } from "next/server";
import { processTelegramUpdate } from "@/app/api/telegram/callback/route";
import { processTelegramBookingNotification } from "@/app/api/telegram/route";
import { getAdminSupabase, getTelegramUserRole } from "@/lib/telegram-bot";

function isDevRouteEnabled() {
  return process.env.NODE_ENV !== "production";
}

export async function GET() {
  if (!isDevRouteEnabled()) {
    return NextResponse.json({ ok: false, error: "Local Telegram dev route is disabled in production." }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    route: "/api/telegram/dev",
    usage: {
      message: {
        method: "POST",
        body: {
          type: "message",
          telegramUserId: 123456789,
          chatId: 123456789,
          text: "/manage",
          username: "local_test",
          firstName: "Local",
        },
      },
      callback: {
        method: "POST",
        body: {
          type: "callback",
          telegramUserId: 123456789,
          chatId: 123456789,
          data: "menu:admin",
          callbackId: "local-callback-1",
          messageId: 1,
        },
      },
      inspect: {
        method: "POST",
        body: {
          type: "inspect",
          telegramUserId: 123456789,
        },
      },
      seed_booking_notify: {
        method: "POST",
        body: {
          type: "seed_booking_notify",
          telegramUserId: 123456789,
          customerName: "Khach test local",
          customerPhone: "0900000000",
          requestedService: "Gel tay",
          requestedStartAt: "2026-04-18T14:30:00+07:00",
          note: "Seed tu local dev",
        },
      },
    },
  });
}

export async function POST(req: Request) {
  if (!isDevRouteEnabled()) {
    return NextResponse.json({ ok: false, error: "Local Telegram dev route is disabled in production." }, { status: 403 });
  }

  const body = await req.json() as {
    type?: "message" | "callback" | "inspect" | "seed_booking_notify";
    telegramUserId?: number;
    chatId?: number | string;
    text?: string;
    data?: string;
    username?: string;
    firstName?: string;
    callbackId?: string;
    messageId?: number;
    customerName?: string;
    customerPhone?: string;
    requestedService?: string;
    requestedStartAt?: string;
    note?: string;
  };

  const telegramUserId = Number(body.telegramUserId ?? 123456789);
  const chatId = String(body.chatId ?? telegramUserId);

  if (body.type === "inspect") {
    const userInfo = await getTelegramUserRole(telegramUserId);
    if (!userInfo.linked || !userInfo.org_id) {
      return NextResponse.json({ ok: false, error: "telegram user is not linked", telegramUserId }, { status: 404 });
    }

    const supabase = getAdminSupabase();
    const [{ data: bookings, error: bookingsError }, { data: appointments, error: appointmentsError }] = await Promise.all([
      supabase
        .from("booking_requests")
        .select("id,status,customer_name,requested_start_at")
        .eq("org_id", userInfo.org_id)
        .in("status", ["NEW", "NEEDS_RESCHEDULE"])
        .order("requested_start_at", { ascending: true })
        .limit(5),
      supabase
        .from("appointments")
        .select("id,status,start_at")
        .eq("org_id", userInfo.org_id)
        .eq("status", "BOOKED")
        .order("start_at", { ascending: true })
        .limit(5),
    ]);

    if (bookingsError) throw bookingsError;
    if (appointmentsError) throw appointmentsError;

    return NextResponse.json({
      ok: true,
      telegramUserId,
      userInfo,
      bookings: bookings ?? [],
      appointments: appointments ?? [],
    });
  }

  if (body.type === "seed_booking_notify") {
    const userInfo = await getTelegramUserRole(telegramUserId);
    if (!userInfo.linked || !userInfo.org_id) {
      return NextResponse.json({ ok: false, error: "telegram user is not linked", telegramUserId }, { status: 404 });
    }

    const supabase = getAdminSupabase();
    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("default_branch_id")
      .eq("org_id", userInfo.org_id)
      .not("default_branch_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profileRow?.default_branch_id) {
      return NextResponse.json({ ok: false, error: "No default branch found for org", orgId: userInfo.org_id }, { status: 400 });
    }

    const startAt = body.requestedStartAt
      ? new Date(body.requestedStartAt).toISOString()
      : new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const endAt = new Date(new Date(startAt).getTime() + 60 * 60 * 1000).toISOString();

    const { data: bookingRow, error: bookingError } = await supabase
      .from("booking_requests")
      .insert({
        org_id: userInfo.org_id,
        branch_id: profileRow.default_branch_id,
        customer_name: body.customerName ?? `Khach test ${Date.now()}`,
        customer_phone: body.customerPhone ?? "0900000000",
        requested_service: body.requestedService ?? "Gel tay",
        note: body.note ?? "Seed tu /api/telegram/dev",
        requested_start_at: startAt,
        requested_end_at: endAt,
        source: "telegram_dev",
        status: "NEW",
        telegram_message_id: null,
        telegram_chat_id: null,
        notified_at: null,
      })
      .select("id,org_id,status,requested_start_at,customer_name")
      .single();

    if (bookingError) throw bookingError;

    const notifyResponse = await processTelegramBookingNotification({
      record: { id: bookingRow.id },
    });
    const notifyJson = await notifyResponse.json();

    return NextResponse.json({
      ok: true,
      telegramUserId,
      userInfo,
      seededBooking: bookingRow,
      notification: notifyJson,
    }, { status: notifyResponse.status });
  }

  if (body.type === "callback") {
    return processTelegramUpdate({
      callback_query: {
        id: body.callbackId ?? `local-callback-${Date.now()}`,
        data: body.data ?? "menu:admin",
        message: {
          chat: { id: chatId },
          message_id: body.messageId ?? 1,
          from: { id: telegramUserId },
        },
      },
    });
  }

  return processTelegramUpdate({
    message: {
      from: {
        id: telegramUserId,
        username: body.username ?? "local_test",
        first_name: body.firstName ?? "Local",
      },
      chat: { id: chatId },
      text: body.text ?? "/start",
    },
  });
}
