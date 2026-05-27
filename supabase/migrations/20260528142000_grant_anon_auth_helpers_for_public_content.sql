grant execute on function public.my_org_id() to anon;
grant execute on function public.my_default_branch_id() to anon;
grant execute on function public.my_branch_id() to anon;
grant execute on function public.has_org_role(text[]) to anon;
grant execute on function public.has_branch_role(uuid, text[]) to anon;
grant execute on function public.can_access_branch(uuid, text[]) to anon;
grant execute on function public.can_access_crm() to anon;
grant execute on function public.can_access_crm_branch(uuid) to anon;
