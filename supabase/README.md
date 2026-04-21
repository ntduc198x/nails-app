# Supabase SQL layout

## Canonical deploy

- `deploy.sql`
  - file deploy chuan duy nhat
  - chua schema, RLS, RPC, indexes, invite codes, landing booking, storage setup
  - da bao gom Telegram setup (`telegram_links`, `telegram_link_codes`, `telegram_conversations`, RPC cho Telegram)
  - da bao gom cac cot runtime app dang dung nhu `appointments.checked_in_at` va `appointments.overdue_alert_sent_at`

## Split files

- `app_sessions.sql`
  - setup session / single-device login
- `telegram_links.sql`
  - ban tach rieng cho Telegram link + RPC
  - giu lai de patch chon loc khi khong muon chay lai `deploy.sql`
- `telegram_conversations.sql`
  - ban tach rieng cho Telegram conversation state
  - giu lai de patch nhanh khi can
- `lookbook_trend_seed.sql`
  - seed mau lookbook
- `update_services_from_priceboard.sql`
  - seed/update bang gia thanh services

## Notes

- Neu can setup moi truong moi, uu tien chay `deploy.sql`.
- Chi chay cac file split rieng khi can patch mot phan cu the.

## Recommended order

1. `deploy.sql` - Schema + RLS + RPC + Telegram + runtime patches
2. `app_sessions.sql` - Single-device login
3. `lookbook_trend_seed.sql` - seed mau lookbook khi can
4. `update_services_from_priceboard.sql` - seed bang gia khi can

## Selective patch order

1. `telegram_links.sql` - patch Telegram link + RPC
2. `telegram_conversations.sql` - patch Telegram conversation state
