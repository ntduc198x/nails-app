begin;

create or replace function public.create_app_session(
  p_user_id uuid,
  p_device_fingerprint text default null,
  p_device_info jsonb default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_token text;
  v_existing_user_id uuid;
  v_existing_owner_name text;
  v_current_user_id uuid := auth.uid();
  v_auth_user auth.users%rowtype;
  v_org_id uuid;
  v_branch_id uuid;
  v_display_name text;
  v_phone text;
begin
  if v_current_user_id is null or v_current_user_id <> p_user_id then
    raise exception 'UNAUTHORIZED';
  end if;

  perform public.ensure_current_user_profile(p_user_id);

  if not exists (
    select 1 from public.profiles where user_id = p_user_id
  ) then
    select * into v_auth_user from auth.users where id = p_user_id limit 1;

    if v_auth_user.id is null then
      raise exception 'AUTH_USER_NOT_FOUND';
    end if;

    select p.org_id, p.default_branch_id
    into v_org_id, v_branch_id
    from public.profiles p
    where p.user_id = p_user_id
    limit 1;

    if v_org_id is null then
      select ur.org_id into v_org_id
      from public.user_roles ur
      where ur.user_id = p_user_id
      limit 1;
    end if;

    if v_org_id is null then
      select id into v_org_id from public.orgs order by created_at asc limit 1;
    end if;

    if v_branch_id is null and v_org_id is not null then
      select b.id into v_branch_id
      from public.branches b
      where b.org_id = v_org_id
      order by b.created_at asc, b.id asc
      limit 1;
    end if;

    v_display_name := nullif(trim(coalesce(
      v_auth_user.raw_user_meta_data ->> 'display_name',
      v_auth_user.raw_user_meta_data ->> 'full_name',
      split_part(coalesce(v_auth_user.email, ''), '@', 1)
    )), '');

    v_phone := nullif(trim(coalesce(v_auth_user.phone, v_auth_user.raw_user_meta_data ->> 'phone', '')), '');

    insert into public.profiles (
      user_id,
      org_id,
      default_branch_id,
      display_name,
      email,
      phone
    ) values (
      p_user_id,
      v_org_id,
      v_branch_id,
      coalesce(v_display_name, 'User'),
      v_auth_user.email,
      v_phone
    )
    on conflict (user_id) do nothing;
  end if;

  if p_device_fingerprint is not null then
    select
      ds.user_id,
      coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), left(ds.user_id::text, 8))
    into v_existing_user_id, v_existing_owner_name
    from public.device_sessions ds
    left join public.profiles p on p.user_id = ds.user_id
    where ds.device_fingerprint = p_device_fingerprint
    limit 1;

    if v_existing_user_id is not null and v_existing_user_id <> p_user_id then
      delete from public.app_sessions where user_id = v_existing_user_id;
      delete from public.online_users where user_id = v_existing_user_id;
      delete from public.device_sessions where user_id = v_existing_user_id or device_fingerprint = p_device_fingerprint;
    end if;

    delete from public.device_sessions
    where user_id = p_user_id or device_fingerprint = p_device_fingerprint;

    insert into public.device_sessions (user_id, device_fingerprint, device_info)
    values (p_user_id, p_device_fingerprint, coalesce(p_device_info, '{}'::jsonb));
  end if;

  delete from public.app_sessions where user_id = p_user_id;
  delete from public.online_users where user_id = p_user_id;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.app_sessions (user_id, session_token, device_fingerprint, device_info)
  values (p_user_id, v_token, p_device_fingerprint, coalesce(p_device_info, '{}'::jsonb));

  insert into public.online_users (user_id, device_fingerprint, device_info)
  values (p_user_id, p_device_fingerprint, coalesce(p_device_info, '{}'::jsonb));

  return jsonb_build_object(
    'success', true,
    'token', v_token,
    'device_replaced', v_existing_user_id is not null and v_existing_user_id <> p_user_id,
    'replaced_user_id', case when v_existing_user_id <> p_user_id then v_existing_user_id else null end,
    'replaced_owner_name', case when v_existing_user_id <> p_user_id then v_existing_owner_name else null end,
    'message', 'Session created.'
  );
end;
$$;

grant execute on function public.create_app_session(uuid, text, jsonb) to authenticated;

commit;
