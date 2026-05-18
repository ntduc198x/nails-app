-- Phase 14 membership offer notifications patch
-- Notify eligible customers when a new active membership offer is published.

begin;

create or replace function public.notify_customers_for_membership_offer()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_package text;
  v_title text;
  v_body text;
begin
  if coalesce(new.is_active, false) is not true then
    return new;
  end if;

  if new.starts_at is not null and new.starts_at > now() then
    return new;
  end if;

  v_package := upper(coalesce(new.offer_metadata ->> 'packageTier', new.offer_metadata ->> 'package_tier', 'REGULAR'));
  if v_package = '' then
    v_package := 'REGULAR';
  end if;

  v_title := 'Ưu đãi mới dành cho hạng thành viên';
  v_body := 'Bạn có ưu đãi mới: ' || coalesce(new.title, 'Ưu đãi thành viên') || '. Mở mục thành viên để xem chi tiết và điều kiện áp dụng.';

  insert into public.customer_notifications (
    user_id,
    customer_id,
    org_id,
    title,
    body,
    kind,
    is_read,
    sent_at
  )
  select
    ca.user_id,
    cm.customer_id,
    cm.org_id,
    v_title,
    v_body,
    'MEMBERSHIP',
    false,
    now()
  from public.customer_memberships cm
  join public.membership_tiers mt on mt.id = cm.tier_id
  left join public.customer_accounts ca on ca.customer_id = cm.customer_id and ca.org_id = cm.org_id
  where cm.org_id = new.org_id
    and upper(coalesce(mt.code, 'REGULAR')) = v_package
    and not exists (
      select 1
      from public.customer_notifications existing
      where existing.customer_id = cm.customer_id
        and existing.org_id = cm.org_id
        and existing.kind = 'MEMBERSHIP'
        and existing.title = v_title
        and existing.body = v_body
    );

  return new;
end;
$$;

drop trigger if exists trg_membership_offer_notifications on public.marketing_offers;
create trigger trg_membership_offer_notifications
after insert or update of is_active, starts_at, offer_metadata on public.marketing_offers
for each row
execute function public.notify_customers_for_membership_offer();

commit;
