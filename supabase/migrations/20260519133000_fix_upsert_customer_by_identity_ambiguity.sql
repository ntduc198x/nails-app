begin;

create or replace function public.upsert_customer_by_identity(
  p_org_id uuid,
  p_full_name text,
  p_phone text,
  p_source text,
  p_care_note text,
  p_branch_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_org_id is null then
    raise exception 'ORG_REQUIRED';
  end if;

  if public.my_org_id() is distinct from p_org_id then
    raise exception 'ACCESS_DENIED';
  end if;

  return public.upsert_customer_by_identity_secure(
    coalesce(p_branch_id, public.my_default_branch_id()),
    p_full_name,
    p_phone,
    p_care_note,
    p_source
  );
end;
$$;

comment on function public.upsert_customer_by_identity(uuid, text, text, text, text, uuid)
  is 'Explicit 6-arg overload without default branch param to avoid ambiguous resolution with the 5-arg wrapper.';

grant execute on function public.upsert_customer_by_identity(uuid, text, text, text, text, uuid) to authenticated, service_role;

grant execute on function public.upsert_customer_by_identity(uuid, text, text, text, text) to authenticated, service_role;

commit;
