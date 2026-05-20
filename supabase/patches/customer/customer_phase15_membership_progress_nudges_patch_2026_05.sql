-- Phase 15 membership progress nudges patch
-- Notify customers when they are close to the next membership tier.
-- Anti-spam rules:
-- 1) Only notify when remaining spend <= 300000 OR remaining visits <= 1
-- 2) At most one notification per customer + next tier + reason within 7 days

begin;

create or replace function public.run_customer_membership_progress_nudges_job()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_inserted_count integer := 0;
begin
  with ranked_memberships as (
    select
      cm.customer_id,
      cm.org_id,
      cm.total_spent,
      cm.total_visits,
      current_tier.code as current_tier_code,
      current_tier.name as current_tier_name,
      current_tier.sort_order as current_sort_order,
      next_tier.id as next_tier_id,
      next_tier.code as next_tier_code,
      next_tier.name as next_tier_name,
      next_tier.spending_threshold,
      next_tier.visit_threshold,
      greatest(0, coalesce(next_tier.spending_threshold, 0) - coalesce(cm.total_spent, 0)) as remaining_spent,
      greatest(0, coalesce(next_tier.visit_threshold, 0) - coalesce(cm.total_visits, 0)) as remaining_visits,
      ca.user_id
    from public.customer_memberships cm
    join public.membership_tiers current_tier on current_tier.id = cm.tier_id
    left join lateral (
      select mt.*
      from public.membership_tiers mt
      where mt.org_id = cm.org_id
        and coalesce(mt.is_active, true) = true
        and coalesce(mt.sort_order, 0) > coalesce(current_tier.sort_order, 0)
      order by mt.sort_order asc
      limit 1
    ) next_tier on true
    left join public.customer_accounts ca
      on ca.customer_id = cm.customer_id
     and ca.org_id = cm.org_id
  ), eligible as (
    select
      customer_id,
      org_id,
      user_id,
      next_tier_code,
      next_tier_name,
      remaining_spent,
      remaining_visits,
      case
        when remaining_visits <= 1 then 'VISIT'
        when remaining_spent <= 300000 then 'SPEND'
        else null
      end as nudge_reason,
      case
        when remaining_visits <= 1 then
          'Bạn chỉ còn ' || remaining_visits::text || ' lượt hẹn hợp lệ nữa để lên hạng ' || coalesce(next_tier_name, next_tier_code, 'tiếp theo') || '. Mở mục thành viên để xem quyền lợi mới đang chờ bạn.'
        when remaining_spent <= 300000 then
          'Bạn chỉ còn ' || to_char(remaining_spent, 'FM999G999G999') || 'đ để lên hạng ' || coalesce(next_tier_name, next_tier_code, 'tiếp theo') || '. Mở mục thành viên để xem quyền lợi mới đang chờ bạn.'
        else null
      end as body
    from ranked_memberships
    where next_tier_code is not null
      and (
        remaining_visits <= 1
        or remaining_spent <= 300000
      )
  ), inserted as (
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
      e.user_id,
      e.customer_id,
      e.org_id,
      'Bạn sắp lên hạng thành viên',
      e.body,
      'MEMBERSHIP',
      false,
      now()
    from eligible e
    where e.nudge_reason is not null
      and e.body is not null
      and not exists (
        select 1
        from public.customer_notifications existing
        where existing.customer_id = e.customer_id
          and existing.org_id = e.org_id
          and existing.kind = 'MEMBERSHIP'
          and existing.title = 'Bạn sắp lên hạng thành viên'
          and existing.body = e.body
          and existing.sent_at >= now() - interval '7 days'
      )
    returning id
  )
  select count(*) into v_inserted_count from inserted;

  return jsonb_build_object(
    'ok', true,
    'job', 'customer_membership_progress_nudges',
    'inserted_count', v_inserted_count,
    'ran_at', now()
  );
end;
$$;

grant execute on function public.run_customer_membership_progress_nudges_job() to authenticated;

commit;
