# i18n v1 rollout

## Scope
- Localize `apps/mobile` customer-facing routes and shared customer UI.
- Localize public/customer-facing web routes only.
- Keep `apps/web/src/app/manage` and admin mobile flows in Vietnamese for v1.

## Locale model
- Supported locales: `vi`, `en`
- Default locale: `vi`
- Fallback locale: `vi`
- Persisted mobile locale key: `customer-preferences:locale`
- Public web locale must resolve in this order:
  1. URL locale segment
  2. Persisted cookie
  3. Browser language
  4. `vi`

## Translation ownership
- Shared UI/system copy belongs in `packages/shared/src/i18n.ts`.
- Customer/public app code should read copy from shared translations instead of inline literals.
- Admin/internal strings can stay Vietnamese until admin localization is explicitly scoped.

## Content policy for v1
- CMS-like business content from Supabase can remain Vietnamese in v1.
- This includes service names, lookbook titles, gallery content, offers, membership tier names, and editorial content.
- English v1 covers UI/system copy, metadata, and customer/public workflow messages.

## Notification and transactional copy
- New customer-facing notifications should prefer `message_key` plus `message_params`.
- Legacy rows with stored `title` and `body` must continue to render safely.
- Add new message keys in shared i18n before wiring new notification producers.

## Regression guardrails
- Run `npm run i18n:audit` before release and before opening localization PRs.
- `npm run lint` and `npm run typecheck` remain required pre-merge checks.
- Treat new hardcoded public/customer strings as regressions unless they are explicitly temporary and documented.

## Phase 2
- Add bilingual CMS/schema support for Supabase-managed content.
- Expand localization to admin/manage surfaces.
- Add locale-aware content authoring rules and content QA.
