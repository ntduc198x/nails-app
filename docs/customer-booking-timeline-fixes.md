# Customer Booking Timeline Fixes

This file records the customer booking timeline issues that were fixed in May 2026.

## Root Causes Fixed

1. Customer account linking could resolve incomplete context.
The customer flow now prefers `link_customer_account_for_current_user()` and falls back to
`link_customer_account_by_phone()` when needed.

2. Branch context was being resolved from the wrong place.
The app previously assumed `customer_accounts.branch_id` existed, but the real schema stores
customer-branch relationships in `customer_branches`.
The fix now resolves branch context from `customer_branches`, preferring the latest seen branch.

3. Customer booking lookup was too narrow.
History and upcoming booking queries originally depended too heavily on a single `customer_id`.
The fix expands matching to include:
- linked customer ids found by same-org email
- linked customer ids found by same phone
- booking requests matched by phone variants
- booking requests matched by customer name variants

4. Appointment service lookup used the wrong relation path.
The previous implementation tried to read `appointments -> ticket_items` directly.
In the real database the valid path is `appointments -> tickets -> ticket_items`.
The fix now resolves appointment ticket and service data through `tickets(...)`.

5. Mobile timeline hydration could keep stale or partial state.
The runtime store could stay blank or stale if cache existed for only one side of the timeline.
The fix adds cache freshness revalidation and remote refresh on screen focus.

## Main Files Updated

- `packages/shared/src/customer-personalization.ts`
- `packages/shared/src/org.ts`
- `packages/shared/src/session.ts`
- `apps/mobile/src/lib/customer-booking-timeline-store.ts`
- `apps/mobile/src/hooks/use-customer-booking-timeline.ts`
- `apps/mobile/src/lib/customer-profile.ts`
- `apps/mobile/src/providers/session-provider.tsx`
- `apps/mobile/app/(customer)/(tabs)/account.tsx`
- `apps/mobile/app/(customer)/(tabs)/booking.tsx`

## Cleanup

Temporary debug output used during investigation was removed after the customer timeline returned
correct data.
