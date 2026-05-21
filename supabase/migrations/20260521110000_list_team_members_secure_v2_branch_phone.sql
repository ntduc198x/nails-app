create or replace function public.list_team_members_secure_v2()
returns table (
  id uuid,
  user_id uuid,
  role text,
  display_name text,
  email text,
  phone text,
  branch_id uuid
)
language sql
security definer
set search_path = public
as $$
  select
    ur.id,
    ur.user_id,
    ur.role::text,
    coalesce(
      case
        when nullif(trim(p.display_name), '') is not null
          and lower(trim(p.display_name)) <> 'user'
          and trim(p.display_name) !~* '^(nhân sự|staff)\s+\d+$'
        then trim(p.display_name)
        else null
      end,
      nullif(trim(coalesce(
        au.raw_user_meta_data ->> 'display_name',
        au.raw_user_meta_data ->> 'full_name',
        au.raw_user_meta_data ->> 'name'
      )), ''),
      nullif(split_part(coalesce(nullif(trim(p.email), ''), au.email, ''), '@', 1), ''),
      left(ur.user_id::text, 8)
    ) as display_name,
    coalesce(nullif(trim(p.email), ''), nullif(trim(au.email), '')) as email,
    coalesce(
      nullif(trim(p.phone), ''),
      nullif(trim(coalesce(au.phone, au.raw_user_meta_data ->> 'phone', '')), '')
    ) as phone,
    ur.branch_id
  from public.user_roles ur
  left join public.profiles p on p.user_id = ur.user_id
  left join auth.users au on au.id = ur.user_id
  where ur.org_id = public.my_org_id()
    and (
      public.has_org_role(array['OWNER'])
      or (
        public.can_access_branch(ur.branch_id, array['MANAGER','PARTNER'])
        and ur.branch_id is not null
      )
      or ur.user_id = auth.uid()
    )
  order by ur.role asc, ur.user_id asc
$$;
