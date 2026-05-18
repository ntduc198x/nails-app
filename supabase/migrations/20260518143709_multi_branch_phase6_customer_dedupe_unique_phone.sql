begin;

update public.customers
set normalized_phone = public.normalize_customer_phone(phone)
where normalized_phone is distinct from public.normalize_customer_phone(phone);

select public.merge_safe_customer_duplicates_by_email(null, false);
select public.merge_safe_customer_duplicates_by_phone(null, false);

update public.customers c
set normalized_phone = null,
    needs_merge_review = true
where c.merged_into_customer_id is null
  and c.normalized_phone in (
    '0123456789',
    '1234567890',
    '0000000000',
    '1111111111'
  )
  and exists (
    select 1
    from public.customers dup
    where dup.org_id = c.org_id
      and dup.normalized_phone = c.normalized_phone
      and dup.merged_into_customer_id is null
      and dup.id <> c.id
  );

do $$
declare
  v_remaining_duplicate_groups integer;
begin
  select count(*)
  into v_remaining_duplicate_groups
  from (
    select 1
    from public.customers c
    where c.merged_into_customer_id is null
      and c.normalized_phone is not null
    group by c.org_id, c.normalized_phone
    having count(*) > 1
  ) duplicate_groups;

  if v_remaining_duplicate_groups > 0 then
    raise exception
      'UNRESOLVED_CUSTOMER_PHONE_DUPLICATES: % group(s) remain after safe merge',
      v_remaining_duplicate_groups;
  end if;
end;
$$;

create unique index if not exists uniq_customers_org_normalized_phone_active
on public.customers (org_id, normalized_phone)
where normalized_phone is not null
  and merged_into_customer_id is null;

commit;
