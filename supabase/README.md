# Supabase SQL layout

## Canonical bootstrap for a brand new project

- `bootstrap.sql`
  - the one-shot file for a fresh Supabase project
  - already includes:
    - core schema / RLS / RPC from `deploy.sql`
    - CRM patch from `crm_patch_2026_04.sql`
    - latest booking conversion patch from `fix_convert_booking_request_secure.sql`
    - self-contained device + app session setup from `app_sessions.sql`
    - customer content feed table + RLS from `customer_content_feed_2026_04.sql`
    - default workspace bootstrap and auto-bind trigger for new `auth.users`

## Core and patch files

- `deploy.sql`
  - legacy core schema deploy
  - keeps schema, RLS, base RPC, Telegram tables, landing booking core
- `crm_patch_2026_04.sql`
  - CRM/customer retention layer
- `fix_convert_booking_request_secure.sql`
  - latest safe version of booking-to-appointment conversion
- `app_sessions.sql`
  - self-contained single-device + app-session layer
  - now includes `device_sessions`, `app_sessions`, `online_users`, and related RPCs
- `fresh_project_patch.sql`
  - default org/branch bootstrap
  - auto-create `profiles` + first role on `auth.users` insert
- `customer_explore_storefront_2026_04.sql`
  - storefront/domain patch for customer Explore
  - adds `storefront_*` tables and expands `services` with explicit Home/Explore metadata
- `customer_content_feed_2026_04.sql`
  - creates `customer_content_posts`
  - enables published content feed for customer Home and Telegram content ingestion
- `shift_plans_2026_04.sql`
  - persists weekly owner shift drafts/published schedules as JSON
  - lets staff read the published schedule from the same source of truth
- `staff_shift_profiles_2026_04.sql`
  - persists real shift profile data for each staff member
  - stores skills, weekly availability, leave dates, and weekly-hour limits for owner scheduling

## Recommended usage

For a brand new Supabase project:

1. Open SQL Editor in Supabase
2. Run `bootstrap.sql`
3. Create the first auth user
4. The first user is auto-bound to the default org/branch and gets role `OWNER`

For selective patching on an existing project:

1. `crm_patch_2026_04.sql`
2. `fix_convert_booking_request_secure.sql`
3. `app_sessions.sql`
4. `fresh_project_patch.sql`
5. `auth_workspace_patch_2026_04.sql`
6. `customer_explore_storefront_2026_04.sql`
7. `customer_content_feed_2026_04.sql`
8. `shift_plans_2026_04.sql`
9. `staff_shift_profiles_2026_04.sql`

`auth_workspace_patch_2026_04.sql`
- fixes new auth users being bound to the placeholder default org when a real org already exists
- supports `registration_mode=USER` so customer signups stop receiving admin roles

`auth_repair_cleanup_2026_04.sql`
- one-off cleanup for the known broken duplicate auth user
- use when Supabase Auth admin endpoints fail with `Database error finding/loading user`

## Optional seed files

- `lookbook_trend_seed.sql`
  - sample lookbook services
- `update_services_from_priceboard.sql`
  - priceboard-to-services seed/update

Run these only after the core bootstrap is already in place.
