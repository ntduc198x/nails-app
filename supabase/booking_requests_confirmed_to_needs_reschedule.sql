-- One-time cleanup to align booking_requests workflow:
-- move all legacy CONFIRMED rows to NEEDS_RESCHEDULE.

update public.booking_requests
set status = 'NEEDS_RESCHEDULE'
where status = 'CONFIRMED';
