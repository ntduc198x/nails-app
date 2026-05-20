# Supabase SQL layout

## Root entry points

- `bootstrap.sql`
  - one-shot file for a fresh Supabase project
  - already includes core schema, CRM, booking conversion hardening, app sessions, customer content feed, and default workspace bootstrap
- `deploy.sql`
  - legacy core schema deploy
  - keeps schema, RLS, base RPC, Telegram tables, and landing booking core
- `app_sessions.sql`
  - self-contained single-device and app-session layer
- `crm_patch_2026_04.sql`
  - CRM and customer-retention layer
- `config.toml`
  - Supabase local config

## Directory layout

- `migrations/`
  - ordered migration files for the newer branch-scoping work
- `patches/auth/`
  - auth bootstrap and runtime fixes
- `patches/core/`
  - core booking and service-scope fixes
- `patches/customer/`
  - customer identity, feed, explore, membership, notifications, and push patches
- `patches/admin/`
  - admin notification lifecycle patches
- `patches/staff/`
  - staff profiles, shifts, attendance, and scheduling support
- `patches/telegram/`
  - Telegram tables and booking/invite related patches
- `seeds/`
  - optional sample or data-backfill SQL for lookbook, storefront, membership, and priceboard imports
- `remote-schema/`
  - schema snapshots pulled from remote environments
- `functions/`
  - Supabase Edge Functions

## Recommended usage

For a brand new Supabase project:

1. Open SQL Editor in Supabase.
2. Run `bootstrap.sql`.
3. Create the first auth user.
4. The first user is auto-bound to the default org/branch and gets role `OWNER`.

For selective patching on an existing project:

1. Run `crm_patch_2026_04.sql` if CRM/customer retention tables are missing.
2. Run `patches/core/fix_convert_booking_request_secure.sql` for the secure booking conversion path.
3. Run `app_sessions.sql` for device and app session support.
4. Run `patches/auth/auth_runtime_patch_2026_05_user_roles_conflict.sql` if auth hits `42P10` on `user_roles`.
5. Run `patches/auth/fresh_project_patch.sql` for default org/branch bootstrap.
6. Run the needed files from `patches/customer/` for customer mobile, feed, explore, identity, or membership capabilities.
7. Run the needed files from `patches/staff/` for scheduling and shift support.
8. Run the needed files from `patches/telegram/` if Telegram bot flows or invite scope need repair.

## Notes

- `bootstrap.sql` and `deploy.sql` still embed sections named after older standalone SQL files. That is expected.
- The patch folders are organized for navigation. They are not an execution order by themselves.
- Run seed files only after the core bootstrap and required schema patches are already in place.
