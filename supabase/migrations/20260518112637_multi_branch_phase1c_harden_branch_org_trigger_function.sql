begin;

revoke all on function public.assert_branch_belongs_to_org() from public;
revoke all on function public.assert_branch_belongs_to_org() from anon;
revoke all on function public.assert_branch_belongs_to_org() from authenticated;

comment on function public.assert_branch_belongs_to_org() is
  'Internal trigger function. Execution is revoked from API roles and only used by branch/org consistency triggers.';

commit;
