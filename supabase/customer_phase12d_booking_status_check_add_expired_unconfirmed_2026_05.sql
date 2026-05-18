-- Phase 12d booking_requests status constraint patch
-- Add EXPIRED_UNCONFIRMED to the allowed booking request statuses.

begin;

alter table public.booking_requests
  drop constraint if exists booking_requests_status_check;

alter table public.booking_requests
  add constraint booking_requests_status_check
  check (
    status in (
      'NEW',
      'CONFIRMED',
      'NEEDS_RESCHEDULE',
      'CANCELLED',
      'CONVERTED',
      'EXPIRED_UNCONFIRMED'
    )
  );

commit;
