-- Repair customer profiles that were bound to the wrong org/branch by auth runtime patches.
-- Safe to run multiple times.

begin;

update public.profiles as p
set
  org_id = ca.org_id,
  default_branch_id = coalesce(
    p.default_branch_id,
    (
      select b.id
      from public.branches as b
      where b.org_id = ca.org_id
      order by b.created_at asc, b.id asc
      limit 1
    )
  )
from public.customer_accounts as ca
where ca.user_id = p.user_id
  and (
    p.org_id is distinct from ca.org_id
    or p.default_branch_id is null
  );

delete from public.user_roles as ur
using public.customer_accounts as ca
where ca.user_id = ur.user_id;

commit;
