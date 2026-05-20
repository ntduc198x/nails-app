begin;

update public.services
set featured_in_lookbook = true
where active = true
  and coalesce(featured_in_lookbook, false) = false
  and (
    coalesce(featured_in_home, false) = true
    or coalesce(featured_in_explore, false) = true
  );

commit;
