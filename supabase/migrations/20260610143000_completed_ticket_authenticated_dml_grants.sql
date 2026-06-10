begin;

-- Allow authenticated clients to perform bill edits through existing RLS policies.
-- Branch-scoped write policies already restrict these tables to OWNER/PARTNER/
-- MANAGER/RECEPTION on the relevant branch, but explicit DML grants are still
-- required for direct client-side updates to completed bills.
grant select, insert, update, delete on table public.tickets to authenticated;
grant select, insert, update, delete on table public.ticket_items to authenticated;
grant select, insert, update, delete on table public.payments to authenticated;
grant select, insert, update, delete on table public.receipts to authenticated;

commit;
