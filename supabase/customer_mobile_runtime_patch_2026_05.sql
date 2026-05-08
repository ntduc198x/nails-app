-- Runtime patch for customer mobile account linking.
-- Purpose:
-- 1. Remove dependency on ON CONFLICT(user_id) inside link_customer_account_by_phone()
-- 2. Keep existing environments working even if customer_accounts was created without
--    the expected unique constraint/index on user_id.

begin;

create index if not exists idx_customer_accounts_user_id
  on public.customer_accounts (user_id);

create index if not exists idx_customer_accounts_customer_id
  on public.customer_accounts (customer_id);

create or replace function public.link_customer_account_by_phone()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_customer_id uuid;
  v_existing_account_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select *
  into v_profile
  from public.profiles
  where user_id = auth.uid()
  limit 1;

  if v_profile.user_id is null then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  select id
  into v_customer_id
  from public.customers
  where org_id = v_profile.org_id
    and public.normalize_customer_phone(phone) = public.normalize_customer_phone(v_profile.phone)
    and merged_into_customer_id is null
  order by total_visits desc, total_spend desc, created_at asc
  limit 1;

  if v_customer_id is null then
    insert into public.customers (
      org_id,
      name,
      full_name,
      phone,
      source
    )
    values (
      v_profile.org_id,
      coalesce(nullif(trim(v_profile.display_name), ''), coalesce(v_profile.email, 'Customer')),
      coalesce(nullif(trim(v_profile.display_name), ''), coalesce(v_profile.email, 'Customer')),
      public.normalize_customer_phone(v_profile.phone),
      'APP_SIGNUP'
    )
    returning id into v_customer_id;
  end if;

  select id
  into v_existing_account_id
  from public.customer_accounts
  where user_id = v_profile.user_id
     or customer_id = v_customer_id
  order by case when user_id = v_profile.user_id then 0 else 1 end, created_at asc
  limit 1;

  if v_existing_account_id is not null then
    update public.customer_accounts
    set
      user_id = v_profile.user_id,
      customer_id = v_customer_id,
      org_id = v_profile.org_id,
      linked_by = 'PHONE_MATCH'
    where id = v_existing_account_id;
  else
    insert into public.customer_accounts (
      user_id,
      customer_id,
      org_id,
      linked_by
    )
    values (
      v_profile.user_id,
      v_customer_id,
      v_profile.org_id,
      'PHONE_MATCH'
    );
  end if;

  return v_customer_id;
end;
$$;

grant execute on function public.link_customer_account_by_phone() to authenticated;

commit;
