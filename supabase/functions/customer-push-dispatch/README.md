# customer-push-dispatch

Supabase Edge Function skeleton for phase 2c push delivery.

## Purpose
- Read pending customer inbox notifications from DB
- Send push payloads to Expo Push API
- Write delivery result back into DB logs

## Required secrets
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Expected DB patches
Apply first:
- `customer_phase16_push_device_registry_patch_2026_05.sql`
- `customer_phase17_push_delivery_outbox_patch_2026_05.sql`

## Invoke manually
After deploying the function, invoke it with your preferred method or scheduler.

Example conceptual flow:
1. Deploy function `customer-push-dispatch`
2. Schedule it every 1-5 minutes
3. Inspect `customer_push_delivery_logs`

## Notes
- Inbox remains the source of truth.
- This worker is best-effort delivery only.
- You can extend it later for invalid token cleanup and Expo receipts.
