import { NextResponse } from "next/server";
import { verifyTelegramInternalRequest } from "@/lib/route-secrets";
import { buildTelegramBookingNotificationResponse } from "@/lib/telegram-booking-notification";

export async function POST(req: Request) {
  const verification = verifyTelegramInternalRequest(req);
  if (!verification.ok) {
    return NextResponse.json({ ok: false, error: verification.error }, { status: verification.status });
  }

  const body = await req.json();
  return buildTelegramBookingNotificationResponse(body);
}
