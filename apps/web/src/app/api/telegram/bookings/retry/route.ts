import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processTelegramBookingNotification } from "@/lib/telegram-booking-notification";
import { verifyTelegramInternalRequest } from "@/lib/route-secrets";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STALE_NOTIFICATION_CLAIM_MINUTES = Number(process.env.BOOKING_NOTIFICATION_CLAIM_TTL_MINUTES ?? "2");
const DEFAULT_RETRY_LIMIT = Number(process.env.BOOKING_NOTIFICATION_RETRY_BATCH_SIZE ?? "20");
const MAX_RETRY_LIMIT = 100;

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeRetryLimit(rawValue: unknown) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_RETRY_LIMIT;
  }

  return Math.min(Math.trunc(parsed), MAX_RETRY_LIMIT);
}

export async function POST(req: Request) {
  const verification = verifyTelegramInternalRequest(req);
  if (!verification.ok) {
    return NextResponse.json({ ok: false, error: verification.error }, { status: verification.status });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const limit = normalizeRetryLimit(
      typeof body === "object" && body !== null ? (body as { limit?: unknown }).limit : undefined,
    );
    const staleClaimThreshold = new Date(
      Date.now() - STALE_NOTIFICATION_CLAIM_MINUTES * 60 * 1000,
    ).toISOString();

    const supabase = getSupabase();
    const { data: pendingRows, error } = await supabase
      .from("booking_requests")
      .select("id,notified_at,created_at,status")
      .in("status", ["NEW", "NEEDS_RESCHEDULE"])
      .is("telegram_message_id", null)
      .or(`notified_at.is.null,notified_at.lt.${staleClaimThreshold}`)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    const results: Array<{
      bookingId: string;
      ok: boolean;
      skipped?: boolean;
      reason?: string;
      error?: string;
    }> = [];

    for (const row of pendingRows ?? []) {
      const bookingId = String((row as { id: string }).id);

      try {
        const result = await processTelegramBookingNotification({
          record: { id: bookingId },
        });

        results.push({
          bookingId,
          ok: true,
          skipped: Boolean((result as { skipped?: boolean }).skipped),
          reason: typeof (result as { reason?: string }).reason === "string"
            ? (result as { reason: string }).reason
            : undefined,
        });
      } catch (retryError) {
        console.error("telegram booking retry failed", { bookingId, error: retryError });
        results.push({
          bookingId,
          ok: false,
          error: retryError instanceof Error ? retryError.message : "Retry failed",
        });
      }
    }

    const successCount = results.filter((item) => item.ok && !item.skipped).length;
    const skippedCount = results.filter((item) => item.skipped).length;
    const failedCount = results.filter((item) => !item.ok).length;

    return NextResponse.json({
      ok: true,
      scanned: pendingRows?.length ?? 0,
      successCount,
      skippedCount,
      failedCount,
      results,
    });
  } catch (routeError) {
    console.error("telegram booking retry route failed", routeError);
    return NextResponse.json(
      { ok: false, error: "Telegram booking retry failed" },
      { status: 500 },
    );
  }
}
