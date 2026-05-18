-- Phase 13 membership tier notifications patch
-- Notify customer inbox when membership tier is upgraded.

begin;

create or replace function public.notify_customer_membership_tier_upgrade()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_old_tier record;
  v_new_tier record;
  v_customer_user_id uuid;
  v_title text;
  v_body text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.customer_id is null or new.org_id is null then
    return new;
  end if;

  if coalesce(old.tier_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(new.tier_id, '00000000-0000-0000-0000-000000000000'::uuid) then
    return new;
  end if;

  select id, code, name, coalesce(sort_order, 0) as sort_order
  into v_old_tier
  from public.membership_tiers
  where id = old.tier_id;

  select id, code, name, coalesce(sort_order, 0) as sort_order
  into v_new_tier
  from public.membership_tiers
  where id = new.tier_id;

  if v_new_tier.id is null then
    return new;
  end if;

  -- Only notify on actual upgrade, not downgrade/lateral moves.
  if v_old_tier.id is not null and coalesce(v_new_tier.sort_order, 0) <= coalesce(v_old_tier.sort_order, 0) then
    return new;
  end if;

  select ca.user_id
  into v_customer_user_id
  from public.customer_accounts ca
  where ca.customer_id = new.customer_id
    and ca.org_id = new.org_id
  order by ca.created_at asc
  limit 1;

  v_title := 'Bạn đã lên hạng thành viên';
  v_body := 'Chúc mừng bạn đã lên hạng ' || coalesce(v_new_tier.name, v_new_tier.code, 'mới') || '. Mở mục thành viên để xem quyền lợi mới dành cho bạn.';

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
  values (
    v_customer_user_id,
    new.customer_id,
    new.org_id,
    v_title,
    v_body,
    'MEMBERSHIP',
    false,
    now()
  );

  return new;
end;
$$;

drop trigger if exists trg_customer_membership_tier_notifications on public.customer_memberships;
create trigger trg_customer_membership_tier_notifications
after update of tier_id on public.customer_memberships
for each row
execute function public.notify_customer_membership_tier_upgrade();

commit;
