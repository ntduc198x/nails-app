select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('admin_notification_states', 'orgs')
order by tablename, policyname;

select
  proname,
  pg_get_function_identity_arguments(oid) as identity_args,
  pg_get_functiondef(oid) as function_definition
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname = 'touch_admin_notification_state';

select version, name, statements
from supabase_migrations.schema_migrations
where version = '20260526203000';
