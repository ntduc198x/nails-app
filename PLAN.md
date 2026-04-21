# Mobile Expansion Plan

## Current Status
- Week 1 scaffold is complete and kept the Next.js web app stable at repo root.
- Week 2 data-access direction is now locked:
  - mobile uses direct Supabase access for authenticated staff/private flows
  - mobile uses Next API routes only for public or server-only flows
- `packages/shared` now contains real cross-platform contracts/adapters for:
  - auth and app-session contracts
  - org-context bootstrap
  - booking request summaries
  - appointment summaries
  - dashboard snapshots
  - CRM summaries and dashboard metrics
- `apps/mobile` now contains:
  - real Supabase mobile client bootstrap
  - persisted mobile device fingerprint
  - secure app-session token storage
  - real auth/session provider with sign-in, sign-up, reset-password request, restore session, and logout
  - admin overview hook wired to real dashboard, booking request, appointment, and CRM metric loaders
  - router-owned admin tabs for `overview`, `queue`, `appointments`, and `checkout`
- Mobile route groups are now intentionally locked to:
  - `/` for bootstrap-only role/session redirect
  - `/(customer)` for public guest-first booking
  - `/(auth)` for staff authentication only
  - `/(admin)` for staff/admin operations
- Mobile auth UI is no longer demo-role based.
- Week 3 guest booking is the active scope:
  - mobile guest users enter from the public customer shell
  - guest booking reuses `/api/booking-request`
  - Telegram notification and rebalance stay backend-owned
- Android build readiness is the next immediate milestone:
  - first target is local debug APK via Expo prebuild
  - no EAS setup is included in this phase
  - mobile env contract must be explicit before Android compile verification
- Root TypeScript check passes after the Week 2 changes.
- Mobile lint and mobile typecheck pass after the Week 2 changes.

## Repo Decisions
- Keep the production web app at repo root.
- Keep one Expo mobile app in `apps/mobile`.
- Keep shared domain logic in `packages/shared`.
- Do not add a broad new API layer for private mobile data right now.
- Treat all current internal roles (`OWNER`, `MANAGER`, `RECEPTION`, `ACCOUNTANT`, `TECH`) as staff/admin-side users in the mobile router.
- Keep guest booking as the first real customer feature for Week 3.
- Keep Expo Router as the only mobile router; do not add another navigation library.

## Mobile Navigation Contract
- **Root contract**
  - `/` exists only to restore session/role state and redirect.
  - `/` must not become a business UI screen.
- **Customer contract**
  - `/(customer)` is public-first and optimized for guest booking.
  - Guest booking must not require authentication.
  - Authenticated customer history/status is explicitly deferred and must not drive current navigation decisions.
- **Auth contract**
  - `/(auth)` is for staff authentication flows only.
  - `/(auth)` is never the default home once session bootstrap finishes.
- **Admin contract**
  - `/(admin)` is the staff/admin route group.
  - Admin navigation is locked to a **Hybrid Tabs** model:
    - router-level tabs for primary operational areas
    - stack-based detail/edit/action screens opened from the active tab
  - Tab changes must be navigation-level, not local `useState` section switching.

## Admin Navigation Decisions
- The phase-locked admin tabs are:
  - `overview`
  - `queue`
  - `appointments`
  - `checkout`
- Later parity areas must extend the same navigation model rather than introduce a second pattern:
  - `reports`
  - `customers`
  - `services/resources`
  - `account/settings`
- `checkout` is considered an early top-level operations area because it already appears in the current admin workflow and is high-frequency.
- Disallowed navigation patterns for future implementation:
  - do not add new admin sections as local `useState` tabs inside `/(admin)/index`
  - do not expand `/(admin)/index` into a long-lived “god screen”
  - do not mix router-level tabs with new screen-state-only primary navigation

## Session Routing Rules
- App bootstrap always starts at `/`.
- If no staff/admin role is restored, redirect to `/(customer)`.
- If a staff/admin role is restored, redirect to `/(admin)`.
- `/(auth)` remains an entry path for staff sign-in/sign-up/reset only.
- Sign-out always returns the app to `/(customer)`.
- Back behavior and deep links must resolve inside the current admin tab stack rather than through local state toggles.

## Week-by-Week Milestones
### Week 1: Foundation + Scaffold
- Add `PLAN.md`.
- Add npm workspace wiring.
- Scaffold `apps/mobile`.
- Scaffold `packages/shared`.
- Extract low-risk shared primitives:
  - role labels
  - booking DTOs
  - validation
  - date/currency formatting

### Week 2: Shared Business Logic + Real Mobile Auth
- Add shared auth/session contracts and adapters.
- Add shared org-context, dashboard, booking, appointment, and CRM adapters.
- Replace demo mobile role storage with real Supabase-backed auth/session bootstrap.
- Wire the admin shell to real operational data:
  - dashboard snapshot
  - booking queue
  - appointments
  - CRM summary metrics

### Week 3: Customer Flows
- Implement guest booking using the current public booking route.
- Preserve Telegram side effects on the server path.
- Keep the customer shell public-first so booking works without authentication.
- End Week 3 at simple success confirmation; defer guest status/history lookup.

### Week 4: Admin/Staff Core Flows
- Expand the admin shell from overview into router-owned operational screens under the Hybrid Tabs contract:
  - booking request queue actions
  - appointments list/detail
  - quick actions
  - highest-frequency daily workflows

### Week 5: Full Feature Gap Fill
- Triage remaining web parity features into:
  - native now
  - mobile wrapper later
  - explicit defer
- Fill remaining business-critical parity gaps:
  - checkout
  - reports
  - services/resources
  - tax books
  - customers
  - account/settings

### Week 6: Stabilization + Beta Readiness
- Android-first hardening.
- Real-device Android QA.
- Session expiry and retry/offline checks.
- iOS readiness checklist and blocker review.

## Feature Parity Matrix
| Area | Web | Mobile | Notes |
| --- | --- | --- | --- |
| Auth shell | Live | Week 2 connected | Sign-in, sign-up, reset request, restore, logout scaffolded |
| App-session enforcement | Live | Week 2 connected | Mobile now uses secure token storage and validation/create flow |
| Customer guest booking | Live | Planned | Week 3, remains guest-first and public-first |
| Authenticated customer | Live-ish / partial | Explicitly deferred | No signed-in customer navigation commitment in current mobile phase |
| Admin dashboard | Live | Week 4 route-owned | Overview now lives in admin tabs using real snapshot adapter |
| Booking requests queue | Live | Week 4 route-owned | Queue now runs as its own admin tab with convert/update/delete actions |
| Appointments | Live | Week 4 route-owned | Appointments now run as their own admin tab with filter/edit/check-in actions |
| CRM dashboard metrics | Live | Week 2 connected | Uses shared CRM summary adapter |
| Checkout | Live | Week 4 route-owned | Checkout now runs as its own admin tab for checked-in appointments |
| Reports | Live | Planned | Week 5 |
| Resources/services/tax books | Live | Planned | Week 5 |

## Android Local Setup
- Android Studio is installed at `D:\Program Files\Android\Android Studio`.
- Android SDK is present at `C:\Users\Admin\AppData\Local\Android\Sdk`.
- Android is the primary verification target from this point onward.
- First build-ready target is `local Android debug APK`, not release APK/AAB.
- First supported build lane is `expo run:android` after local Expo prebuild, not EAS.
- Expected local environment values to document and use before emulator verification:
  - `ANDROID_HOME`
  - `ANDROID_SDK_ROOT`
  - SDK `platform-tools` on `PATH`
- Required mobile runtime env contract:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_API_BASE_URL`
  - `EXPO_PUBLIC_PASSWORD_RESET_URL`
- Expo/Android validation target:
  - app boots on emulator
  - auth flows work
  - session restores after restart
  - admin overview loads real data
  - public booking keeps server-side Telegram behavior once Week 3 lands
  - Week 3 verification centers on the guest booking flow from Android runtime
- Verified repo-side readiness on this machine:
  - mobile env contract passes
  - Expo config resolves cleanly
  - Expo Android prebuild succeeds
  - Gradle `assembleDebug` succeeds and produces a debug APK
- Verified Android runtime progress on this machine:
  - Android AVD `Pixel_5` exists
  - debug APK installs successfully on emulator
  - `MainActivity` launches successfully on emulator
  - root Expo script now auto-resolves `JAVA_HOME` from Android Studio on Windows for Expo/Gradle lane startup
- Remaining local-machine blocker:
  - Android dev runtime is not yet stable after launch; the current blocker is Expo dev client / Metro connectivity or reload stability, not compile/install readiness
- Expected non-blocking warning:
  - Expo Doctor still warns that `app.json` fields require `prebuild` sync while `android/` exists; this is expected in the current local prebuild workflow

## Acceptance Gates
- Web app behavior remains unchanged while mobile expands.
- Shared imports resolve in both web and mobile workspaces.
- Mobile typecheck and lint pass after each significant Week 2 change set.
- Mobile can sign in, sign up, request password reset, restore session, and sign out.
- Mobile admin shell can load dashboard, booking requests, appointments, and CRM metrics from real data.
- Any deferred feature must remain explicitly recorded in this file.

## Blockers
- No Mac available for iOS Simulator.
- No Apple Developer account yet.
- Local `next build` remains blocked in this environment by remote Google Fonts fetch, not by the workspace/mobile scaffold.
- Android runtime still needs Metro/dev-client stabilization before guest booking can be verified end-to-end on emulator.

## Next Tasks
- Keep `/(customer)` focused on guest booking only; do not add signed-in customer navigation in the current phase.
- Add stack-level admin detail/deep-link routes on top of the new tab shell where repeated detail flows warrant dedicated screens.
- Stabilize Expo dev client <-> Metro runtime on emulator.
- Verify the public mobile guest booking path against `/api/booking-request` on emulator once runtime stabilization is complete.
