// Phase 2c: customer push dispatch worker skeleton
// Usage intent:
// - Deploy as a Supabase Edge Function
// - Invoke manually or on a schedule
// - Reads pending inbox notifications from DB
// - Fans out to Expo Push API
// - Acks result back into DB delivery logs

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: pendingRows, error: pendingError } = await supabase.rpc("list_pending_customer_push_notifications", {
    p_limit: 100,
  });

  if (pendingError) {
    return Response.json({ ok: false, stage: "load_pending", error: pendingError.message }, { status: 500 });
  }

  const rows = Array.isArray(pendingRows) ? pendingRows : [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const token = typeof row.expo_push_token === "string" ? row.expo_push_token : "";
    if (!token) {
      skipped += 1;
      await supabase.rpc("mark_customer_push_delivery_result", {
        p_notification_id: row.notification_id,
        p_push_device_id: row.push_device_id,
        p_status: "SKIPPED",
        p_response_payload: { reason: "missing_token" },
        p_error_message: null,
      });
      continue;
    }

    const payload = {
      to: token,
      title: row.title,
      body: row.body,
      sound: "default",
      data: {
        notificationId: row.notification_id,
        customerId: row.customer_id,
        orgId: row.org_id,
        kind: row.kind,
      },
    };

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      const ok = res.ok && !json?.data?.some?.((item: { status?: string }) => item.status === "error");

      await supabase.rpc("mark_customer_push_delivery_result", {
        p_notification_id: row.notification_id,
        p_push_device_id: row.push_device_id,
        p_status: ok ? "SENT" : "FAILED",
        p_response_payload: json,
        p_error_message: ok ? null : JSON.stringify(json),
      });

      if (ok) {
        sent += 1;
      } else {
        failed += 1;
      }
    } catch (error) {
      failed += 1;
      await supabase.rpc("mark_customer_push_delivery_result", {
        p_notification_id: row.notification_id,
        p_push_device_id: row.push_device_id,
        p_status: "FAILED",
        p_response_payload: null,
        p_error_message: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  return Response.json({ ok: true, pending: rows.length, sent, failed, skipped });
});
