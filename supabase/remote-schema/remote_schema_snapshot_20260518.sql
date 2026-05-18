--
-- PostgreSQL database dump
--

\restrict nXAUYu2azM7RWd3lokYD8Gt2R9NIRnucrcunUrM9vgyQWgMoTJ4hObeH5VlnKeb

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: pg_cron; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION pg_cron; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL';


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pg_net; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_net; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_net IS 'Async HTTP';


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: supabase_functions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_functions;


--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_migrations;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: graphql(text, text, jsonb, jsonb); Type: FUNCTION; Schema: graphql_public; Owner: -
--

CREATE FUNCTION graphql_public.graphql("operationName" text DEFAULT NULL::text, query text DEFAULT NULL::text, variables jsonb DEFAULT NULL::jsonb, extensions jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


--
-- Name: append_customer_activity(uuid, uuid, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.append_customer_activity(p_org_id uuid, p_customer_id uuid, p_type text, p_channel text, p_content_summary text, p_created_by uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if p_customer_id is null or p_org_id is null or p_content_summary is null or btrim(p_content_summary) = '' then
    return;
  end if;

  insert into public.customer_activities (
    org_id,
    customer_id,
    type,
    channel,
    content_summary,
    created_by
  )
  values (
    p_org_id,
    p_customer_id,
    p_type,
    p_channel,
    p_content_summary,
    p_created_by
  );
end;
$$;


--
-- Name: assert_branch_belongs_to_org(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_branch_belongs_to_org() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.branch_id is not null and not exists (
    select 1
    from public.branches b
    where b.id = new.branch_id
      and b.org_id = new.org_id
  ) then
    raise exception 'BRANCH_NOT_IN_ORG';
  end if;

  return new;
end;
$$;


--
-- Name: FUNCTION assert_branch_belongs_to_org(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.assert_branch_belongs_to_org() IS 'Internal trigger function. Execution is revoked from API roles and only used by branch/org consistency triggers.';


--
-- Name: assert_not_dev_preview(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_not_dev_preview() RETURNS void
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is not null and public.has_role('DEV') then
    raise exception 'DEV_READ_ONLY';
  end if;
end;
$$;


--
-- Name: auto_resolve_admin_notification_states(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_resolve_admin_notification_states() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_count integer := 0;
begin
  -- Booking notifications: resolve when booking is no longer actionable.
  update public.admin_notification_states ans
  set
    resolved_at = coalesce(ans.resolved_at, now()),
    updated_at = now()
  where ans.resolved_at is null
    and (
      (ans.notification_key like 'booking-%' and exists (
        select 1
        from public.booking_requests br
        where ('booking-' || br.id::text) = ans.notification_key
          and br.status not in ('NEW', 'NEEDS_RESCHEDULE', 'EXPIRED_UNCONFIRMED')
      ))
      or (ans.notification_key like 'arrival-overdue-%' and exists (
        select 1
        from public.appointments ap
        where ('arrival-overdue-' || ap.id::text) = ans.notification_key
          and ap.status <> 'BOOKED'
      ))
      or (ans.notification_key like 'checked-in-stale-%' and exists (
        select 1
        from public.appointments ap
        where ('checked-in-stale-' || ap.id::text) = ans.notification_key
          and ap.status <> 'CHECKED_IN'
      ))
      or (ans.notification_key like 'leave-%' and exists (
        select 1
        from public.shift_leave_requests lr
        where ('leave-' || lr.id::text) = ans.notification_key
          and lr.status <> 'PENDING'
      ))
      or (ans.notification_key like 'attendance-%' and exists (
        select 1
        from public.time_entries te
        where ('attendance-' || te.id::text) = ans.notification_key
          and te.status <> 'PENDING_APPROVAL'
      ))
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


--
-- Name: can_access_branch(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_branch(p_branch_id uuid, p_roles text[] DEFAULT NULL::text[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.org_id = public.my_org_id()
      and (
        ur.branch_id is null
        or ur.branch_id = p_branch_id
      )
      and (
        p_roles is null
        or ur.role = any(p_roles)
      )
  )
$$;


--
-- Name: FUNCTION can_access_branch(p_branch_id uuid, p_roles text[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.can_access_branch(p_branch_id uuid, p_roles text[]) IS 'Branch-aware authorization helper. Users with org-level roles (branch_id null) can access all branches in their org.';


--
-- Name: can_access_crm(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_crm() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.org_id = public.my_org_id()
      and ur.role in ('OWNER', 'PARTNER', 'MANAGER', 'RECEPTION', 'ACCOUNTANT')
  )
$$;


--
-- Name: can_access_crm_branch(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_crm_branch(p_branch_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.can_access_branch(
    p_branch_id,
    array['OWNER','PARTNER','MANAGER','RECEPTION','ACCOUNTANT']
  )
$$;


--
-- Name: check_device_conflict(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_device_conflict(p_fingerprint text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_owner_id uuid;
  v_owner_name text;
begin
  if p_fingerprint is null or btrim(p_fingerprint) = '' then
    return jsonb_build_object('conflict', false);
  end if;

  select
    ds.user_id,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), left(ds.user_id::text, 8))
  into v_owner_id, v_owner_name
  from public.device_sessions ds
  left join public.profiles p on p.user_id = ds.user_id
  where ds.device_fingerprint = p_fingerprint
  limit 1;

  if v_owner_id is null or v_owner_id = auth.uid() then
    return jsonb_build_object('conflict', false);
  end if;

  return jsonb_build_object(
    'conflict', true,
    'type', 'DEVICE_TAKEN',
    'message', 'This device is already linked to another account.',
    'owner_name', v_owner_name
  );
end;
$$;


--
-- Name: checkout_close_ticket_secure(text, text, jsonb, uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.checkout_close_ticket_secure(p_customer_name text, p_payment_method text, p_lines jsonb, p_appointment_id uuid DEFAULT NULL::uuid, p_dedupe_window_ms integer DEFAULT 15000, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_customer_id uuid;
  v_subtotal numeric := 0;
  v_vat_total numeric := 0;
  v_grand_total numeric := 0;
  v_ticket_id uuid;
  v_token text;
  v_expires_at timestamptz;
  v_days int := 30;
  v_duplicate_ticket_id uuid;
  v_duplicate_token text;
  v_existing_ticket_id uuid;
  v_existing_token text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'CUSTOMER_NAME_REQUIRED';
  end if;

  if p_payment_method not in ('CASH', 'TRANSFER') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'CHECKOUT_LINES_REQUIRED';
  end if;

  v_org_id := public.my_org_id();
  v_branch_id := public.my_default_branch_id();

  if v_org_id is null then
    raise exception 'ORG_NOT_FOUND';
  end if;

  if p_appointment_id is not null then
    select a.branch_id
    into v_branch_id
    from public.appointments a
    where a.id = p_appointment_id
      and a.org_id = v_org_id;

    if v_branch_id is null then
      raise exception 'APPOINTMENT_NOT_FOUND';
    end if;
  end if;

  if v_branch_id is null then
    select b.id
    into v_branch_id
    from public.branches b
    where b.org_id = v_org_id
    order by b.created_at asc
    limit 1;
  end if;

  if v_branch_id is null then
    raise exception 'BRANCH_NOT_FOUND';
  end if;

  if not public.can_access_branch(
    v_branch_id,
    array['OWNER','PARTNER','MANAGER','RECEPTION']
  ) then
    raise exception 'ACCESS_DENIED';
  end if;

  v_customer_id := public.upsert_customer_by_identity(
    v_org_id,
    p_customer_name,
    null,
    'APP',
    null,
    v_branch_id
  );

  select
    coalesce(sum((s.base_price * x.qty)), 0),
    coalesce(sum((s.base_price * x.qty * s.vat_rate)), 0)
  into v_subtotal, v_vat_total
  from (
    select
      (elem->>'serviceId')::uuid as service_id,
      greatest((elem->>'qty')::int, 1) as qty
    from jsonb_array_elements(p_lines) elem
  ) x
  join public.services s on s.id = x.service_id and s.org_id = v_org_id;

  if v_subtotal <= 0 then
    raise exception 'INVALID_SERVICES';
  end if;

  v_grand_total := v_subtotal + v_vat_total;

  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    select cr.ticket_id
    into v_existing_ticket_id
    from public.checkout_requests cr
    where cr.org_id = v_org_id
      and cr.idempotency_key = p_idempotency_key
    limit 1;

    if v_existing_ticket_id is not null then
      select r.public_token
      into v_existing_token
      from public.receipts r
      where r.ticket_id = v_existing_ticket_id
      order by r.created_at desc
      limit 1;

      return jsonb_build_object(
        'ticketId', v_existing_ticket_id,
        'receiptToken', coalesce(v_existing_token, ''),
        'grandTotal', v_grand_total,
        'deduped', true
      );
    end if;
  end if;

  select t.id
  into v_duplicate_ticket_id
  from public.tickets t
  where t.org_id = v_org_id
    and t.branch_id = v_branch_id
    and t.customer_id = v_customer_id
    and t.status = 'CLOSED'
    and t.created_at >= (now() - make_interval(secs => greatest(p_dedupe_window_ms, 1000) / 1000.0))
    and abs(coalesce((t.totals_json->>'grand_total')::numeric, 0) - v_grand_total) < 0.01
  order by t.created_at desc
  limit 1;

  if v_duplicate_ticket_id is not null then
    select r.public_token
    into v_duplicate_token
    from public.receipts r
    where r.ticket_id = v_duplicate_ticket_id
    order by r.created_at desc
    limit 1;

    return jsonb_build_object(
      'ticketId', v_duplicate_ticket_id,
      'receiptToken', coalesce(v_duplicate_token, ''),
      'grandTotal', v_grand_total,
      'deduped', true
    );
  end if;

  insert into public.tickets (org_id, branch_id, customer_id, appointment_id, status, totals_json)
  values (
    v_org_id,
    v_branch_id,
    v_customer_id,
    p_appointment_id,
    'CLOSED',
    jsonb_build_object(
      'subtotal', v_subtotal,
      'discount_total', 0,
      'vat_total', v_vat_total,
      'grand_total', v_grand_total
    )
  )
  returning id into v_ticket_id;

  insert into public.ticket_items (org_id, ticket_id, service_id, qty, unit_price, vat_rate)
  select
    v_org_id,
    v_ticket_id,
    s.id,
    x.qty,
    s.base_price,
    s.vat_rate
  from (
    select
      (elem->>'serviceId')::uuid as service_id,
      greatest((elem->>'qty')::int, 1) as qty
    from jsonb_array_elements(p_lines) elem
  ) x
  join public.services s on s.id = x.service_id and s.org_id = v_org_id;

  insert into public.payments (org_id, ticket_id, method, amount, status)
  values (v_org_id, v_ticket_id, p_payment_method, v_grand_total, 'PAID');

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_expires_at := now() + make_interval(days => v_days);

  insert into public.receipts (org_id, ticket_id, public_token, expires_at)
  values (v_org_id, v_ticket_id, v_token, v_expires_at);

  if p_appointment_id is not null then
    update public.appointments
    set status = 'DONE'
    where id = p_appointment_id
      and org_id = v_org_id
      and branch_id = v_branch_id;
  end if;

  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    insert into public.checkout_requests (org_id, idempotency_key, ticket_id, created_by)
    values (v_org_id, p_idempotency_key, v_ticket_id, v_uid)
    on conflict (org_id, idempotency_key)
    do update set ticket_id = excluded.ticket_id;
  end if;

  return jsonb_build_object(
    'ticketId', v_ticket_id,
    'branchId', v_branch_id,
    'receiptToken', v_token,
    'grandTotal', v_grand_total,
    'deduped', false
  );
end;
$$;


--
-- Name: confirm_telegram_link(text, bigint, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_telegram_link(p_code text, p_telegram_user_id bigint, p_telegram_username text DEFAULT NULL::text, p_telegram_first_name text DEFAULT NULL::text, p_telegram_last_name text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_link_code record;
  v_role text;
  v_display_name text;
begin
  select id, app_user_id, expires_at, used_at
  into v_link_code
  from public.telegram_link_codes
  where code = p_code
    and used_at is null
  order by created_at desc
  limit 1;

  if v_link_code.id is null then
    if exists (
      select 1
      from public.telegram_link_codes
      where code = p_code
        and used_at is not null
    ) then
      return jsonb_build_object('success', false, 'error', 'CODE_USED');
    end if;

    if exists (
      select 1
      from public.telegram_link_codes
      where code = p_code
        and used_at is null
        and expires_at < now()
    ) then
      return jsonb_build_object('success', false, 'error', 'CODE_EXPIRED');
    end if;

    return jsonb_build_object('success', false, 'error', 'INVALID_CODE');
  end if;

  if v_link_code.expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'CODE_EXPIRED');
  end if;

  delete from public.telegram_links
  where app_user_id = v_link_code.app_user_id;

  delete from public.telegram_links
  where telegram_user_id = p_telegram_user_id;

  insert into public.telegram_links (
    app_user_id,
    telegram_user_id,
    telegram_username,
    telegram_first_name,
    telegram_last_name,
    linked_at
  )
  values (
    v_link_code.app_user_id,
    p_telegram_user_id,
    p_telegram_username,
    p_telegram_first_name,
    p_telegram_last_name,
    now()
  );

  update public.telegram_link_codes
  set used_at = now()
  where id = v_link_code.id;

  select r.role, p.display_name
  into v_role, v_display_name
  from public.user_roles r
  left join public.profiles p on p.user_id = r.user_id
  where r.user_id = v_link_code.app_user_id
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'success', true,
    'app_user_id', v_link_code.app_user_id,
    'user_id', v_link_code.app_user_id,
    'role', coalesce(v_role, 'STAFF'),
    'display_name', coalesce(v_display_name, p_telegram_first_name, p_telegram_username, 'Tai khoan')
  );
end;
$$;


--
-- Name: consume_invite_code_secure(text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_invite_code_secure(p_code text, p_user_id uuid, p_display_name text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_invite public.invite_codes;
  v_display_name text;
begin
  if p_user_id is null then
    raise exception 'USER_REQUIRED';
  end if;

  select * into v_invite
  from public.invite_codes
  where code = upper(trim(p_code))
    and revoked_at is null
    and used_count < max_uses
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if v_invite.id is null then
    raise exception 'INVITE_INVALID';
  end if;

  update public.invite_codes
  set used_count = used_count + 1,
      used_by = p_user_id,
      used_at = now()
  where id = v_invite.id
    and used_count < max_uses;

  if not found then
    raise exception 'INVITE_ALREADY_USED';
  end if;

  v_display_name := nullif(trim(coalesce(p_display_name, '')), '');

  insert into public.profiles (user_id, org_id, default_branch_id, display_name)
  values (p_user_id, v_invite.org_id, v_invite.branch_id, coalesce(v_display_name, 'User'))
  on conflict (user_id) do update
    set org_id = excluded.org_id,
        default_branch_id = excluded.default_branch_id,
        display_name = coalesce(nullif(excluded.display_name, ''), public.profiles.display_name, 'User');

  perform set_config('app.invite_role_insert', 'on', true);
  perform set_config('app.invite_allowed_role', v_invite.allowed_role, true);

  insert into public.user_roles (user_id, org_id, branch_id, role)
  values (p_user_id, v_invite.org_id, v_invite.branch_id, v_invite.allowed_role)
  on conflict (user_id, org_id) do update
    set branch_id = excluded.branch_id,
        role = excluded.role;

  return jsonb_build_object(
    'inviteId', v_invite.id,
    'orgId', v_invite.org_id,
    'role', v_invite.allowed_role,
    'expiresAt', v_invite.expires_at
  );
end;
$$;


--
-- Name: convert_booking_request_to_appointment_secure(uuid, uuid, uuid, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.convert_booking_request_to_appointment_secure(p_booking_request_id uuid, p_staff_user_id uuid DEFAULT NULL::uuid, p_resource_id uuid DEFAULT NULL::uuid, p_start_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_at timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_req public.booking_requests;
  v_customer_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_appointment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select *
  into v_req
  from public.booking_requests br
  where br.id = p_booking_request_id
    and br.org_id = public.my_org_id()
  limit 1;

  if v_req.id is null then
    raise exception 'BOOKING_REQUEST_NOT_FOUND';
  end if;

  if not public.can_access_branch(
    v_req.branch_id,
    array['OWNER','PARTNER','MANAGER','RECEPTION']
  ) then
    raise exception 'ACCESS_DENIED';
  end if;

  if v_req.status in ('CANCELLED', 'CONVERTED') then
    raise exception 'BOOKING_REQUEST_ALREADY_FINALIZED';
  end if;

  if p_resource_id is not null and not exists (
    select 1
    from public.resources r
    where r.id = p_resource_id
      and r.org_id = v_req.org_id
      and r.branch_id = v_req.branch_id
  ) then
    raise exception 'RESOURCE_BRANCH_MISMATCH';
  end if;

  v_start := coalesce(p_start_at, v_req.requested_start_at);
  v_end := coalesce(p_end_at, v_req.requested_end_at, v_start + interval '60 minutes');

  if v_end <= v_start then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  v_customer_id := public.upsert_customer_by_identity(
    v_req.org_id,
    v_req.customer_name,
    v_req.customer_phone,
    v_req.source,
    concat_ws(' | ',
      case when v_req.requested_service is not null then 'DV: ' || v_req.requested_service else null end,
      case when v_req.preferred_staff is not null then 'Tho mong muon: ' || v_req.preferred_staff else null end,
      nullif(v_req.note, '')
    ),
    v_req.branch_id
  );

  insert into public.appointments (
    org_id, branch_id, customer_id, staff_user_id, resource_id, start_at, end_at, status
  ) values (
    v_req.org_id, v_req.branch_id, v_customer_id, p_staff_user_id, p_resource_id, v_start, v_end, 'BOOKED'
  )
  returning id into v_appointment_id;

  update public.booking_requests
  set status = 'CONVERTED',
      appointment_id = v_appointment_id
  where id = v_req.id;

  return jsonb_build_object(
    'booking_request_id', v_req.id,
    'appointment_id', v_appointment_id,
    'status', 'CONVERTED',
    'branch_id', v_req.branch_id
  );
end;
$$;


--
-- Name: create_app_session(uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_app_session(p_user_id uuid, p_device_fingerprint text DEFAULT NULL::text, p_device_info jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_token text;
  v_existing_user_id uuid;
  v_existing_owner_name text;
  v_current_user_id uuid := auth.uid();
begin
  if v_current_user_id is null or v_current_user_id <> p_user_id then
    raise exception 'UNAUTHORIZED';
  end if;

  perform public.ensure_current_user_profile(p_user_id);

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

  -- Avoid dependency on gen_random_bytes() availability across projects.
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


--
-- Name: create_booking_request_public(text, text, text, text, text, timestamp with time zone, timestamp with time zone, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_booking_request_public(p_customer_name text, p_customer_phone text, p_requested_service text DEFAULT NULL::text, p_preferred_staff text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_requested_start_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_requested_end_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_source text DEFAULT 'landing_page'::text, p_offer_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_auth_user_id uuid := auth.uid();
  v_org_id uuid;
  v_branch_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_row public.booking_requests;
  v_customer_id uuid;
  v_customer_account_id uuid;
  v_source text := coalesce(nullif(trim(p_source), ''), 'landing_page');
  v_normalized_phone text := public.normalize_customer_phone(p_customer_phone);
begin
  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'CUSTOMER_NAME_REQUIRED';
  end if;

  if p_customer_phone is null or btrim(p_customer_phone) = '' then
    raise exception 'CUSTOMER_PHONE_REQUIRED';
  end if;

  if p_requested_start_at is null then
    raise exception 'REQUESTED_START_REQUIRED';
  end if;

  v_start := p_requested_start_at;
  v_end := coalesce(p_requested_end_at, p_requested_start_at + interval '60 minutes');

  if v_end <= v_start then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  if v_auth_user_id is not null then
    select ca.org_id, ca.customer_id
    into v_org_id, v_customer_id
    from public.customer_accounts ca
    where ca.user_id = v_auth_user_id
    order by ca.created_at asc
    limit 1;

    if v_customer_id is null then
      begin
        perform public.link_customer_account_for_current_user();
      exception
        when others then
          null;
      end;

      select ca.org_id, ca.customer_id
      into v_org_id, v_customer_id
      from public.customer_accounts ca
      where ca.user_id = v_auth_user_id
      order by ca.created_at asc
      limit 1;
    end if;
  end if;

  if v_org_id is null then
    select id
    into v_org_id
    from public.orgs
    order by created_at asc
    limit 1;
  end if;

  if v_org_id is null then
    raise exception 'ORG_NOT_FOUND';
  end if;

  if v_customer_id is not null then
    perform 1
    from public.customers c
    where c.id = v_customer_id
      and c.org_id = v_org_id
      and c.merged_into_customer_id is null;

    if not found then
      v_customer_id := null;
    end if;
  end if;

  if v_customer_id is null then
    v_customer_id := public.upsert_customer_by_identity(
      v_org_id,
      p_customer_name,
      p_customer_phone,
      v_source,
      p_note
    );
  else
    update public.customers
    set
      full_name = case
        when full_name is null or btrim(full_name) = '' then p_customer_name
        else full_name
      end,
      name = case
        when name is null or btrim(name) = '' then p_customer_name
        else name
      end,
      phone = case
        when (phone is null or btrim(phone) = '') and v_normalized_phone is not null then v_normalized_phone
        else phone
      end,
      source = coalesce(source, v_source)
    where id = v_customer_id
      and org_id = v_org_id;
  end if;

  if p_offer_id is not null and v_customer_id is null then
    raise exception 'OFFER_ACCOUNT_REQUIRED';
  end if;

  if p_offer_id is not null then
    perform 1
    from public.marketing_offers mo
    where mo.id = p_offer_id
      and mo.org_id = v_org_id
      and mo.is_active = true;

    if not found then
      raise exception 'OFFER_NOT_FOUND';
    end if;
  end if;

  if v_auth_user_id is not null and v_customer_id is not null then
    select ca.id
    into v_customer_account_id
    from public.customer_accounts ca
    where ca.user_id = v_auth_user_id
    order by ca.created_at asc
    limit 1;

    if v_customer_account_id is null then
      insert into public.customer_accounts (user_id, customer_id, org_id, linked_by)
      values (v_auth_user_id, v_customer_id, v_org_id, 'BOOKING_PHONE_SYNC');
    end if;
  end if;

  select id
  into v_branch_id
  from public.branches
  where org_id = v_org_id
  order by created_at asc
  limit 1;

  if v_branch_id is null then
    raise exception 'BRANCH_NOT_FOUND';
  end if;

  insert into public.booking_requests (
    org_id,
    branch_id,
    customer_id,
    offer_id,
    customer_name,
    customer_phone,
    requested_service,
    preferred_staff,
    note,
    requested_start_at,
    requested_end_at,
    source,
    status
  )
  values (
    v_org_id,
    v_branch_id,
    v_customer_id,
    p_offer_id,
    p_customer_name,
    v_normalized_phone,
    p_requested_service,
    p_preferred_staff,
    p_note,
    v_start,
    v_end,
    v_source,
    'NEW'
  )
  returning * into v_row;

  if v_customer_id is not null then
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
    values (
      null,
      v_customer_id,
      v_org_id,
      'YÃªu cáº§u Ä‘áº·t lá»‹ch Ä‘Ã£ Ä‘Æ°á»£c gá»­i',
      'Tiá»‡m Ä‘Ã£ nháº­n yÃªu cáº§u ' || coalesce(nullif(trim(p_requested_service), ''), 'Ä‘áº·t lá»‹ch') || ' vÃ o ' || to_char(v_start at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI') || '.',
      'BOOKING',
      false,
      now()
    );
  end if;

  perform public.append_customer_activity(
    v_org_id,
    v_customer_id,
    'BOOKING_REQUEST',
    'WEB',
    'Táº¡o yÃªu cáº§u Ä‘áº·t lá»‹ch ' || to_char(v_start at time zone 'Asia/Bangkok', 'DD/MM HH24:MI'),
    null
  );

  return jsonb_build_object(
    'booking_request_id', v_row.id,
    'status', v_row.status
  );
end;
$$;


--
-- Name: create_booking_request_public(text, text, text, text, text, timestamp with time zone, timestamp with time zone, text, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_booking_request_public(p_customer_name text, p_customer_phone text, p_requested_service text DEFAULT NULL::text, p_preferred_staff text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_requested_start_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_requested_end_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_source text DEFAULT 'landing_page'::text, p_applied_offer_id uuid DEFAULT NULL::uuid, p_applied_offer_claim_id uuid DEFAULT NULL::uuid, p_applied_offer_code text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_auth_user_id uuid := auth.uid();
  v_org_id uuid;
  v_branch_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_row public.booking_requests;
  v_customer_id uuid;
  v_customer_account_id uuid;
  v_source text := coalesce(nullif(trim(p_source), ''), 'landing_page');
  v_normalized_phone text := public.normalize_customer_phone(p_customer_phone);
  v_claim public.customer_offer_claims;
  v_offer public.marketing_offers;
  v_offer_code text;
begin
  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'CUSTOMER_NAME_REQUIRED';
  end if;

  if p_customer_phone is null or btrim(p_customer_phone) = '' then
    raise exception 'CUSTOMER_PHONE_REQUIRED';
  end if;

  if p_requested_start_at is null then
    raise exception 'REQUESTED_START_REQUIRED';
  end if;

  v_start := p_requested_start_at;
  v_end := coalesce(p_requested_end_at, p_requested_start_at + interval '60 minutes');

  if v_end <= v_start then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  if v_auth_user_id is not null then
    select ca.id, ca.org_id, ca.customer_id
    into v_customer_account_id, v_org_id, v_customer_id
    from public.customer_accounts ca
    where ca.user_id = v_auth_user_id
    order by ca.created_at asc
    limit 1;

    if v_customer_id is null then
      begin
        perform public.link_customer_account_for_current_user();
      exception when others then null;
      end;

      select ca.id, ca.org_id, ca.customer_id
      into v_customer_account_id, v_org_id, v_customer_id
      from public.customer_accounts ca
      where ca.user_id = v_auth_user_id
      order by ca.created_at asc
      limit 1;
    end if;
  end if;

  if v_org_id is null then
    select id into v_org_id from public.orgs order by created_at asc limit 1;
  end if;

  if v_org_id is null then
    raise exception 'ORG_NOT_FOUND';
  end if;

  if v_customer_id is not null then
    perform 1 from public.customers c
    where c.id = v_customer_id and c.org_id = v_org_id and c.merged_into_customer_id is null;
    if not found then v_customer_id := null; end if;
  end if;

  if v_customer_id is null then
    v_customer_id := public.upsert_customer_by_identity(v_org_id, p_customer_name, p_customer_phone, v_source, p_note);
  else
    update public.customers
    set full_name = case when full_name is null or btrim(full_name) = '' then p_customer_name else full_name end,
        name = case when name is null or btrim(name) = '' then p_customer_name else name end,
        phone = case when (phone is null or btrim(phone) = '') and v_normalized_phone is not null then v_normalized_phone else phone end,
        source = coalesce(source, v_source)
    where id = v_customer_id and org_id = v_org_id;
  end if;

  if v_auth_user_id is not null and v_customer_id is not null and v_customer_account_id is null then
    insert into public.customer_accounts (user_id, customer_id, org_id, linked_by)
    values (v_auth_user_id, v_customer_id, v_org_id, 'BOOKING_PHONE_SYNC')
    returning id into v_customer_account_id;
  end if;

  if p_applied_offer_id is not null then
    select * into v_offer
    from public.marketing_offers mo
    where mo.id = p_applied_offer_id
      and mo.org_id = v_org_id
      and mo.is_active = true
      and (mo.starts_at is null or mo.starts_at <= now())
      and (mo.ends_at is null or mo.ends_at >= now())
    limit 1;

    if v_offer.id is null then
      raise exception 'OFFER_NOT_AVAILABLE';
    end if;

    if v_customer_id is null then
      raise exception 'OFFER_REQUIRES_LINKED_CUSTOMER';
    end if;

    v_offer_code := coalesce(nullif(trim(p_applied_offer_code), ''), nullif(trim(v_offer.offer_metadata ->> 'code'), ''));

    if p_applied_offer_claim_id is not null then
      select * into v_claim
      from public.customer_offer_claims coc
      where coc.id = p_applied_offer_claim_id
        and coc.customer_id = v_customer_id
        and coc.offer_id = p_applied_offer_id
        and coc.org_id = v_org_id
      limit 1;
    end if;

    if v_claim.id is null then
      select * into v_claim
      from public.customer_offer_claims coc
      where coc.customer_id = v_customer_id
        and coc.offer_id = p_applied_offer_id
        and coc.org_id = v_org_id
      limit 1;
    end if;

    if v_claim.id is not null and v_claim.status in ('CLAIMED', 'USED', 'EXPIRED') then
      raise exception 'OFFER_ALREADY_USED_OR_RESERVED';
    end if;

    if v_claim.id is null then
      insert into public.customer_offer_claims (
        user_id,
        customer_id,
        offer_id,
        org_id,
        status,
        claimed_at,
        reservation_expires_at
      ) values (
        v_auth_user_id,
        v_customer_id,
        p_applied_offer_id,
        v_org_id,
        'CLAIMED',
        now(),
        v_end + interval '6 hours'
      )
      returning * into v_claim;
    else
      update public.customer_offer_claims
      set status = 'CLAIMED',
          customer_id = v_customer_id,
          user_id = coalesce(user_id, v_auth_user_id),
          claimed_at = coalesce(claimed_at, now()),
          reservation_expires_at = v_end + interval '6 hours',
          cancelled_at = null
      where id = v_claim.id
      returning * into v_claim;
    end if;
  end if;

  select id into v_branch_id
  from public.branches
  where org_id = v_org_id
  order by created_at asc
  limit 1;

  if v_branch_id is null then
    raise exception 'BRANCH_NOT_FOUND';
  end if;

  insert into public.booking_requests (
    org_id, branch_id, customer_id, customer_name, customer_phone,
    requested_service, preferred_staff, note,
    requested_start_at, requested_end_at,
    source, status, applied_offer_id, applied_offer_claim_id, applied_offer_code
  ) values (
    v_org_id, v_branch_id, v_customer_id, p_customer_name, v_normalized_phone,
    p_requested_service, p_preferred_staff, p_note,
    v_start, v_end,
    v_source, 'NEW', p_applied_offer_id, v_claim.id, v_offer_code
  ) returning * into v_row;

  if v_claim.id is not null then
    update public.customer_offer_claims
    set booking_request_id = v_row.id
    where id = v_claim.id;
  end if;

  if v_customer_id is not null then
    insert into public.customer_notifications (
      user_id, customer_id, org_id, title, body, kind, is_read, sent_at, related_offer_id
    ) values (
      v_auth_user_id,
      v_customer_id,
      v_org_id,
      'Yêu cầu đặt lịch đã được gửi',
      'Tiệm đã nhận yêu cầu ' || coalesce(nullif(trim(p_requested_service), ''), 'đặt lịch') || ' vào ' || to_char(v_start at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI') || case when v_offer_code is not null then '. Ưu đãi ' || v_offer_code || ' đang được giữ chỗ.' else '.' end,
      'BOOKING',
      false,
      now(),
      p_applied_offer_id
    );
  end if;

  perform public.append_customer_activity(
    v_org_id,
    v_customer_id,
    'BOOKING_REQUEST',
    'WEB',
    'Tạo yêu cầu đặt lịch ' || to_char(v_start at time zone 'Asia/Bangkok', 'DD/MM HH24:MI'),
    null
  );

  return jsonb_build_object(
    'booking_request_id', v_row.id,
    'status', v_row.status,
    'applied_offer_id', p_applied_offer_id,
    'applied_offer_claim_id', v_claim.id,
    'applied_offer_code', v_offer_code
  );
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    timezone text DEFAULT 'Asia/Bangkok'::text NOT NULL,
    currency text DEFAULT 'VND'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: create_branch_secure(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_branch_secure(p_name text, p_timezone text DEFAULT 'Asia/Ho_Chi_Minh'::text, p_currency text DEFAULT 'VND'::text) RETURNS public.branches
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_org_id uuid;
  v_branch public.branches;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select p.org_id
  into v_org_id
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1;

  if v_org_id is null then
    raise exception 'ORG_CONTEXT_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.org_id = v_org_id
      and ur.role in ('OWNER', 'PARTNER')
  ) then
    raise exception 'FORBIDDEN';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'BRANCH_NAME_REQUIRED';
  end if;

  insert into public.branches (org_id, name, timezone, currency)
  values (v_org_id, btrim(p_name), coalesce(nullif(btrim(p_timezone), ''), 'Asia/Ho_Chi_Minh'), coalesce(nullif(btrim(p_currency), ''), 'VND'))
  returning * into v_branch;

  return v_branch;
end;
$$;


--
-- Name: create_checkout_secure(text, text, jsonb, uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_checkout_secure(p_customer_name text, p_payment_method text, p_lines jsonb, p_appointment_id uuid DEFAULT NULL::uuid, p_dedupe_window_ms integer DEFAULT 15000, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_allowed boolean;
  v_customer_id uuid;
  v_subtotal numeric := 0;
  v_vat_total numeric := 0;
  v_grand_total numeric := 0;
  v_ticket_id uuid;
  v_token text;
  v_expires_at timestamptz;
  v_days int := 30;
  v_duplicate_ticket_id uuid;
  v_duplicate_token text;
  v_existing_ticket_id uuid;
  v_existing_token text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'CUSTOMER_NAME_REQUIRED';
  end if;

  if p_payment_method not in ('CASH', 'TRANSFER') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'CHECKOUT_LINES_REQUIRED';
  end if;

  select org_id, default_branch_id
  into v_org_id, v_branch_id
  from profiles
  where user_id = v_uid
  limit 1;

  if v_org_id is null then
    raise exception 'ORG_NOT_FOUND';
  end if;

  select exists (
    select 1
    from user_roles ur
    where ur.user_id = v_uid
      and ur.org_id = v_org_id
      and ur.role in ('OWNER', 'MANAGER', 'RECEPTION', 'TECH')
  ) into v_allowed;

  if not v_allowed then
    raise exception 'FORBIDDEN';
  end if;

  if v_branch_id is null then
    select b.id into v_branch_id
    from branches b
    where b.org_id = v_org_id
    order by b.created_at asc
    limit 1;
  end if;

  if v_branch_id is null then
    raise exception 'BRANCH_NOT_FOUND';
  end if;

  select c.id into v_customer_id
  from customers c
  where c.org_id = v_org_id and c.name = p_customer_name
  order by c.created_at asc
  limit 1;

  if v_customer_id is null then
    insert into customers (org_id, name)
    values (v_org_id, p_customer_name)
    returning id into v_customer_id;
  end if;

  select
    coalesce(sum((s.base_price * x.qty)), 0),
    coalesce(sum((s.base_price * x.qty * s.vat_rate)), 0)
  into v_subtotal, v_vat_total
  from (
    select
      (elem->>'serviceId')::uuid as service_id,
      greatest((elem->>'qty')::int, 1) as qty
    from jsonb_array_elements(p_lines) elem
  ) x
  join services s on s.id = x.service_id and s.org_id = v_org_id;

  if v_subtotal <= 0 then
    raise exception 'INVALID_SERVICES';
  end if;

  v_grand_total := v_subtotal + v_vat_total;

  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    select cr.ticket_id
    into v_existing_ticket_id
    from checkout_requests cr
    where cr.org_id = v_org_id
      and cr.idempotency_key = p_idempotency_key
    limit 1;

    if v_existing_ticket_id is not null then
      select r.public_token
      into v_existing_token
      from receipts r
      where r.ticket_id = v_existing_ticket_id
      order by r.created_at desc
      limit 1;

      return jsonb_build_object(
        'ticketId', v_existing_ticket_id,
        'receiptToken', coalesce(v_existing_token, ''),
        'grandTotal', v_grand_total,
        'deduped', true
      );
    end if;
  end if;

  select t.id
  into v_duplicate_ticket_id
  from tickets t
  where t.org_id = v_org_id
    and t.customer_id = v_customer_id
    and t.status = 'CLOSED'
    and t.created_at >= (now() - make_interval(secs => greatest(p_dedupe_window_ms, 1000) / 1000.0))
    and abs(coalesce((t.totals_json->>'grand_total')::numeric, 0) - v_grand_total) < 0.01
  order by t.created_at desc
  limit 1;

  if v_duplicate_ticket_id is not null then
    select r.public_token
    into v_duplicate_token
    from receipts r
    where r.ticket_id = v_duplicate_ticket_id
    order by r.created_at desc
    limit 1;

    return jsonb_build_object(
      'ticketId', v_duplicate_ticket_id,
      'receiptToken', coalesce(v_duplicate_token, ''),
      'grandTotal', v_grand_total,
      'deduped', true
    );
  end if;

  insert into tickets (org_id, branch_id, customer_id, appointment_id, status, totals_json)
  values (
    v_org_id,
    v_branch_id,
    v_customer_id,
    p_appointment_id,
    'CLOSED',
    jsonb_build_object(
      'subtotal', v_subtotal,
      'discount_total', 0,
      'vat_total', v_vat_total,
      'grand_total', v_grand_total
    )
  )
  returning id into v_ticket_id;

  insert into ticket_items (org_id, ticket_id, service_id, qty, unit_price, vat_rate)
  select
    v_org_id,
    v_ticket_id,
    s.id,
    x.qty,
    s.base_price,
    s.vat_rate
  from (
    select
      (elem->>'serviceId')::uuid as service_id,
      greatest((elem->>'qty')::int, 1) as qty
    from jsonb_array_elements(p_lines) elem
  ) x
  join services s on s.id = x.service_id and s.org_id = v_org_id;

  insert into payments (org_id, ticket_id, method, amount, status)
  values (v_org_id, v_ticket_id, p_payment_method, v_grand_total, 'PAID');

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_expires_at := now() + make_interval(days => v_days);

  insert into receipts (org_id, ticket_id, public_token, expires_at)
  values (v_org_id, v_ticket_id, v_token, v_expires_at);

  if p_appointment_id is not null then
    update appointments
    set status = 'DONE'
    where id = p_appointment_id
      and org_id = v_org_id;
  end if;

  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    insert into checkout_requests (org_id, idempotency_key, ticket_id, created_by)
    values (v_org_id, p_idempotency_key, v_ticket_id, v_uid)
    on conflict (org_id, idempotency_key)
    do update set ticket_id = excluded.ticket_id;
  end if;

  return jsonb_build_object(
    'ticketId', v_ticket_id,
    'receiptToken', v_token,
    'grandTotal', v_grand_total,
    'deduped', false
  );
end;
$$;


--
-- Name: crm_appointment_after_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crm_appointment_after_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.customer_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform public.append_customer_activity(
      new.org_id,
      new.customer_id,
      'APPOINTMENT',
      'APP',
      'Tạo lịch hẹn ' || to_char(new.start_at at time zone 'Asia/Bangkok', 'DD/MM HH24:MI'),
      auth.uid()
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform public.append_customer_activity(
      new.org_id,
      new.customer_id,
      'APPOINTMENT',
      'APP',
      'Cập nhật lịch hẹn sang trạng thái ' || new.status,
      auth.uid()
    );
  end if;

  perform public.refresh_customer_metrics(new.customer_id, null);
  return new;
end;
$$;


--
-- Name: crm_ticket_after_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crm_ticket_after_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.customer_id is not null and new.status = 'CLOSED' then
    perform public.refresh_customer_metrics(new.customer_id, null);
    perform public.append_customer_activity(
      new.org_id,
      new.customer_id,
      'CHECKOUT',
      'APP',
      'Thanh toán thành công, tổng bill ' || coalesce(new.totals_json->>'grand_total', '0'),
      auth.uid()
    );
  end if;

  return new;
end;
$$;


--
-- Name: enforce_appointment_status_transition(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_appointment_status_transition() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
if NEW.status = OLD.status then
return NEW;
end if;

if OLD.status = 'BOOKED' and NEW.status in ('CHECKED_IN', 'DONE', 'CANCELLED', 'NO_SHOW') then
return NEW;
elsif OLD.status = 'CHECKED_IN' and NEW.status in ('DONE', 'CANCELLED', 'NO_SHOW') then
return NEW;
end if;

raise exception 'INVALID_APPOINTMENT_STATUS_TRANSITION: % -> %', OLD.status, NEW.status;
end;
$$;


--
-- Name: ensure_current_user_profile(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_current_user_profile(p_user_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_current_user_id uuid := auth.uid();
  v_auth_user auth.users%rowtype;
  v_workspace jsonb;
  v_org_id uuid;
  v_branch_id uuid;
  v_display_name text;
  v_phone text;
  v_registration_mode text;
  v_auth_provider text;
  v_role text;
begin
  if v_current_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_user_id is not null and p_user_id <> v_current_user_id then
    raise exception 'UNAUTHORIZED';
  end if;

  select *
  into v_auth_user
  from auth.users
  where id = v_current_user_id
  limit 1;

  if v_auth_user.id is null then
    raise exception 'AUTH_USER_NOT_FOUND';
  end if;

  v_auth_provider := lower(coalesce(v_auth_user.raw_app_meta_data ->> 'provider', 'email'));
  v_registration_mode := upper(
    coalesce(
      v_auth_user.raw_user_meta_data ->> 'registration_mode',
      case
        when v_auth_provider in ('google', 'apple') then 'USER'
        else 'ADMIN'
      end
    )
  );

  if v_registration_mode = 'USER' then
    select ca.org_id
    into v_org_id
    from public.customer_accounts ca
    where ca.user_id = v_current_user_id
    limit 1;

    if v_org_id is null then
      v_workspace := public.ensure_default_workspace();
      v_org_id := coalesce((v_workspace ->> 'org_id')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
    end if;

    select b.id
    into v_branch_id
    from public.branches b
    where b.org_id = v_org_id
    order by b.created_at asc, b.id asc
    limit 1;

    return jsonb_build_object(
      'success', true,
      'user_id', v_current_user_id,
      'org_id', v_org_id,
      'branch_id', v_branch_id
    );
  end if;

  select p.org_id, p.default_branch_id
  into v_org_id, v_branch_id
  from public.profiles p
  where p.user_id = v_current_user_id
  limit 1;

  if v_org_id is null then
    select ur.org_id
    into v_org_id
    from public.user_roles ur
    where ur.user_id = v_current_user_id
    limit 1;
  end if;

  if v_org_id is null then
    v_workspace := public.ensure_default_workspace();
    v_org_id := coalesce((v_workspace ->> 'org_id')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
    v_branch_id := coalesce(v_branch_id, (v_workspace ->> 'branch_id')::uuid, '00000000-0000-0000-0000-000000000101'::uuid);
  end if;

  if v_branch_id is null then
    select b.id
    into v_branch_id
    from public.branches b
    where b.org_id = v_org_id
    order by b.created_at asc, b.id asc
    limit 1;
  end if;

  v_display_name := nullif(
    trim(
      coalesce(
        v_auth_user.raw_user_meta_data ->> 'display_name',
        v_auth_user.raw_user_meta_data ->> 'full_name',
        ''
      )
    ),
    ''
  );

  if v_display_name is null then
    v_display_name := coalesce(nullif(split_part(coalesce(v_auth_user.email, ''), '@', 1), ''), 'User');
  end if;

  v_phone := public.normalize_customer_phone(nullif(trim(coalesce(v_auth_user.phone, v_auth_user.raw_user_meta_data ->> 'phone', '')), ''));

  insert into public.profiles (
    user_id,
    org_id,
    default_branch_id,
    display_name,
    email,
    phone
  )
  values (
    v_current_user_id,
    v_org_id,
    v_branch_id,
    v_display_name,
    v_auth_user.email,
    v_phone
  )
  on conflict (user_id) do update
    set
      org_id = coalesce(public.profiles.org_id, excluded.org_id),
      default_branch_id = coalesce(public.profiles.default_branch_id, excluded.default_branch_id),
      display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
      email = coalesce(excluded.email, public.profiles.email),
      phone = coalesce(excluded.phone, public.profiles.phone);

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_current_user_id
      and ur.org_id = v_org_id
  ) then
    select case
      when exists (
        select 1
        from public.user_roles
        where org_id = v_org_id
          and role = 'OWNER'
      ) then 'RECEPTION'
      else 'OWNER'
    end
    into v_role;

    begin
      insert into public.user_roles (user_id, org_id, role)
      values (v_current_user_id, v_org_id, v_role);
    exception when unique_violation then
      null;
    end;
  end if;

  return jsonb_build_object(
    'success', true,
    'user_id', v_current_user_id,
    'org_id', v_org_id,
    'branch_id', v_branch_id
  );
end;
$$;


--
-- Name: ensure_default_workspace(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_default_workspace() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_default_org_id constant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_default_branch_id constant uuid := '00000000-0000-0000-0000-000000000101'::uuid;
  v_org_id uuid;
  v_branch_id uuid;
begin
  select id
  into v_org_id
  from public.orgs
  where id <> v_default_org_id
  order by created_at asc, id asc
  limit 1;

  if v_org_id is null then
    select id
    into v_org_id
    from public.orgs
    order by created_at asc, id asc
    limit 1;
  end if;

  if v_org_id is null then
    v_org_id := v_default_org_id;

    insert into public.orgs (id, name)
    values (v_org_id, 'Nails App Default Org')
    on conflict (id) do update
      set name = excluded.name;
  end if;

  select id
  into v_branch_id
  from public.branches
  where org_id = v_org_id
  order by created_at asc, id asc
  limit 1;

  if v_branch_id is null then
    v_branch_id := case
      when v_org_id = v_default_org_id then v_default_branch_id
      else gen_random_uuid()
    end;

    insert into public.branches (id, org_id, name, timezone, currency)
    values (
      v_branch_id,
      v_org_id,
      case when v_org_id = v_default_org_id then 'Main Branch' else 'Primary Branch' end,
      'Asia/Bangkok',
      'VND'
    )
    on conflict (id) do update
      set
        org_id = excluded.org_id,
        name = excluded.name,
        timezone = excluded.timezone,
        currency = excluded.currency;
  end if;

  return jsonb_build_object(
    'org_id', v_org_id,
    'branch_id', v_branch_id
  );
end;
$$;


--
-- Name: ensure_overdue_scheduling_cron(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_overdue_scheduling_cron() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_job_id bigint;
begin
  if not exists (
    select 1
    from pg_namespace
    where nspname = 'cron'
  ) then
    raise exception 'PG_CRON_NOT_AVAILABLE';
  end if;

  begin
    perform cron.unschedule('overdue-scheduling-queue');
  exception when others then
    null;
  end;

  select cron.schedule(
    'overdue-scheduling-queue',
    '*/10 * * * *',
    'select public.process_overdue_scheduling_queue();'
  ) into v_job_id;

  return 'scheduled:' || v_job_id::text;
end;
$$;


--
-- Name: expire_unconfirmed_booking_request_before_read(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_unconfirmed_booking_request_before_read() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.status = 'NEW' and new.requested_start_at < now() then
    new.status := 'EXPIRED_UNCONFIRMED';
  end if;
  return new;
end;
$$;


--
-- Name: expire_unconfirmed_booking_requests(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_unconfirmed_booking_requests() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_count integer := 0;
begin
  update public.booking_requests
  set status = 'EXPIRED_UNCONFIRMED'
  where status = 'NEW'
    and requested_start_at < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


--
-- Name: invite_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invite_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    code text NOT NULL,
    created_by uuid,
    allowed_role text DEFAULT 'TECH'::text NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:15:00'::interval) NOT NULL,
    max_uses integer DEFAULT 1 NOT NULL,
    used_count integer DEFAULT 0 NOT NULL,
    used_by uuid,
    used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    branch_id uuid NOT NULL,
    CONSTRAINT invite_codes_allowed_role_check CHECK ((allowed_role = ANY (ARRAY['PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text, 'ACCOUNTANT'::text, 'TECH'::text]))),
    CONSTRAINT invite_codes_check CHECK (((used_count >= 0) AND (used_count <= max_uses))),
    CONSTRAINT invite_codes_max_uses_check CHECK ((max_uses = 1))
);


--
-- Name: generate_invite_code_secure(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invite_code_secure(p_allowed_role text DEFAULT 'TECH'::text, p_note text DEFAULT NULL::text) RETURNS public.invite_codes
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.generate_invite_code_secure(
    public.my_default_branch_id(),
    p_allowed_role,
    p_note
  )
$$;


--
-- Name: generate_invite_code_secure(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invite_code_secure(p_branch_id uuid, p_allowed_role text DEFAULT 'TECH'::text, p_note text DEFAULT NULL::text) RETURNS public.invite_codes
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_org_id uuid;
  v_role text;
  v_code text;
  v_row public.invite_codes;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  v_org_id := public.my_org_id();
  if v_org_id is null then
    raise exception 'ORG_CONTEXT_REQUIRED';
  end if;

  if p_branch_id is null then
    raise exception 'BRANCH_CONTEXT_REQUIRED';
  end if;

  if not public.can_access_branch(
    p_branch_id,
    array['OWNER','PARTNER','MANAGER']
  ) then
    raise exception 'ACCESS_DENIED';
  end if;

  v_role := coalesce(nullif(trim(p_allowed_role), ''), 'TECH');
  if v_role not in ('OWNER','PARTNER','MANAGER','RECEPTION','ACCOUNTANT','TECH') then
    raise exception 'INVALID_ROLE';
  end if;

  if v_role in ('OWNER','PARTNER') and not public.has_org_role(array['OWNER']) then
    raise exception 'FORBIDDEN_ROLE';
  end if;

  if v_role = 'MANAGER'
     and not (
       public.has_org_role(array['OWNER'])
       or public.can_access_branch(p_branch_id, array['PARTNER'])
     ) then
    raise exception 'FORBIDDEN_ROLE';
  end if;

  if v_role in ('RECEPTION','ACCOUNTANT','TECH')
     and not public.can_access_branch(p_branch_id, array['OWNER','PARTNER','MANAGER']) then
    raise exception 'FORBIDDEN_ROLE';
  end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.invite_codes (org_id, branch_id, code, created_by, allowed_role, expires_at, note)
      values (v_org_id, p_branch_id, v_code, auth.uid(), v_role, now() + interval '15 minutes', nullif(trim(p_note), ''))
      returning * into v_row;
      exit;
    exception when unique_violation then
    end;
  end loop;

  return v_row;
end;
$$;


--
-- Name: generate_invite_code_with_branch_secure(text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invite_code_with_branch_secure(p_allowed_role text DEFAULT 'TECH'::text, p_branch_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text) RETURNS public.invite_codes
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_org_id uuid;
  v_default_branch_id uuid;
  v_target_branch_id uuid;
  v_role text;
  v_code text;
  v_row public.invite_codes;
  v_can_manage_all_roles boolean := false;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select p.org_id, p.default_branch_id
  into v_org_id, v_default_branch_id
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1;

  if v_org_id is null then
    raise exception 'ORG_CONTEXT_REQUIRED';
  end if;

  v_target_branch_id := coalesce(p_branch_id, v_default_branch_id);

  if v_target_branch_id is null then
    select id into v_target_branch_id
    from public.branches
    where org_id = v_org_id
    order by created_at asc
    limit 1;
  end if;

  if v_target_branch_id is null then
    raise exception 'BRANCH_CONTEXT_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.branches b
    where b.id = v_target_branch_id
      and b.org_id = v_org_id
  ) then
    raise exception 'BRANCH_NOT_IN_ORG';
  end if;

  if not (public.has_role('OWNER') or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.org_id = v_org_id
      and ur.role = 'PARTNER'
      and (ur.branch_id = v_target_branch_id or ur.branch_id is null)
  )) then
    raise exception 'FORBIDDEN';
  end if;

  v_can_manage_all_roles := exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.org_id = v_org_id
      and ur.role = 'OWNER'
      and ur.branch_id is null
  );

  v_role := upper(coalesce(nullif(trim(p_allowed_role), ''), 'TECH'));
  if v_role not in ('PARTNER','MANAGER','RECEPTION','ACCOUNTANT','TECH') then
    raise exception 'ROLE_NOT_SUPPORTED';
  end if;

  if v_role = 'PARTNER' and not v_can_manage_all_roles then
    raise exception 'FORBIDDEN_ROLE';
  end if;

  v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));

  insert into public.invite_codes (org_id, branch_id, code, allowed_role, note, max_uses, used_count, expires_at)
  values (v_org_id, v_target_branch_id, v_code, v_role, p_note, 1, 0, now() + interval '7 days')
  returning * into v_row;

  return v_row;
end;
$$;


--
-- Name: generate_telegram_link_code(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_telegram_link_code(p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_current_user_id uuid;
  v_code text;
begin
  v_current_user_id := auth.uid();
  if v_current_user_id is null or v_current_user_id <> p_user_id then
    raise exception 'Unauthorized';
  end if;

  v_code := public.generate_telegram_link_code(p_user_id, 5);
  return jsonb_build_object('success', true, 'code', v_code);
end;
$$;


--
-- Name: generate_telegram_link_code(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_telegram_link_code(p_app_user_id uuid, p_ttl_minutes integer DEFAULT 5) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_code text;
begin
  delete from public.telegram_link_codes
  where app_user_id = p_app_user_id
    and (used_at is not null or expires_at <= now());

  loop
    v_code := lpad(floor(random() * 1000000)::text, 6, '0');
    exit when not exists (
      select 1
      from public.telegram_link_codes
      where code = v_code
        and used_at is null
        and expires_at >= now()
    );
  end loop;

  insert into public.telegram_link_codes (app_user_id, code, expires_at)
  values (p_app_user_id, v_code, now() + make_interval(mins => greatest(p_ttl_minutes, 1)));

  return v_code;
end;
$$;


--
-- Name: get_customer_crm_detail(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_customer_crm_detail(p_customer_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_customer_row public.customers;
  v_customer jsonb;
  v_appointments jsonb;
  v_tickets jsonb;
  v_booking_requests jsonb;
  v_activities jsonb;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select *
  into v_customer_row
  from public.customers c
  where c.id = p_customer_id
    and c.org_id = public.my_org_id()
    and c.merged_into_customer_id is null;

  if v_customer_row.id is null then
    raise exception 'CUSTOMER_NOT_FOUND';
  end if;

  if not public.can_access_crm_branch(v_customer_row.branch_id) then
    raise exception 'ACCESS_DENIED';
  end if;

  select to_jsonb(x)
  into v_customer
  from (
    select
      c.id,
      c.org_id,
      c.branch_id,
      coalesce(nullif(trim(c.full_name), ''), c.name) as full_name,
      c.phone,
      c.birthday,
      c.gender,
      c.first_visit_at,
      c.last_visit_at,
      c.total_visits,
      c.total_spend,
      c.last_service_summary,
      c.favorite_staff_user_id,
      c.customer_status,
      c.tags,
      coalesce(c.care_note, c.notes) as care_note,
      c.source,
      c.next_follow_up_at,
      c.last_contacted_at,
      c.follow_up_status,
      c.needs_merge_review
    from public.customers c
    where c.id = p_customer_id
  ) x;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.start_at desc), '[]'::jsonb)
  into v_appointments
  from (
    select id, branch_id, start_at, end_at, status, staff_user_id, resource_id
    from public.appointments
    where customer_id = p_customer_id
      and org_id = public.my_org_id()
      and public.can_access_branch(branch_id)
    order by start_at desc
    limit 50
  ) a;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb)
  into v_tickets
  from (
    select
      t.id,
      t.branch_id,
      t.status,
      t.created_at,
      t.appointment_id,
      t.totals_json,
      (
        select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
        from (
          select public_token, expires_at, created_at
          from public.receipts
          where ticket_id = t.id
          order by created_at desc
          limit 3
        ) r
      ) as receipts
    from public.tickets t
    where t.customer_id = p_customer_id
      and t.org_id = public.my_org_id()
      and public.can_access_branch(
        t.branch_id,
        array['OWNER','PARTNER','MANAGER','RECEPTION','ACCOUNTANT']
      )
    order by t.created_at desc
    limit 50
  ) t;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.created_at desc), '[]'::jsonb)
  into v_booking_requests
  from (
    select
      br.id,
      br.branch_id,
      br.customer_name,
      br.customer_phone,
      br.requested_service,
      br.requested_start_at,
      br.requested_end_at,
      br.source,
      br.status,
      br.created_at
    from public.booking_requests br
    where br.org_id = public.my_org_id()
      and public.can_access_crm_branch(br.branch_id)
      and (
        public.normalize_customer_phone(br.customer_phone) = public.normalize_customer_phone(v_customer_row.phone)
        or lower(trim(br.customer_name)) = lower(trim(coalesce(v_customer_row.full_name, v_customer_row.name)))
      )
    order by br.created_at desc
    limit 50
  ) b;

  select coalesce(jsonb_agg(to_jsonb(ca) order by ca.created_at desc), '[]'::jsonb)
  into v_activities
  from (
    select id, customer_id, type, channel, content_summary, created_by, created_at
    from public.customer_activities
    where customer_id = p_customer_id
    order by created_at desc
    limit 100
  ) ca;

  return jsonb_build_object(
    'customer', v_customer,
    'appointments', v_appointments,
    'tickets', v_tickets,
    'booking_requests', v_booking_requests,
    'activities', v_activities
  );
end;
$$;


--
-- Name: get_my_device_session(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_device_session() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_current_user_id uuid := auth.uid();
  v_session record;
begin
  if v_current_user_id is null then
    return jsonb_build_object('registered', false);
  end if;

  select *
  into v_session
  from public.device_sessions
  where user_id = v_current_user_id
  limit 1;

  if v_session.id is null then
    return jsonb_build_object('registered', false);
  end if;

  return jsonb_build_object(
    'registered', true,
    'fingerprint', v_session.device_fingerprint,
    'device_info', v_session.device_info,
    'created_at', v_session.created_at
  );
end;
$$;


--
-- Name: get_receipt_public(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_receipt_public(p_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_receipt record;
  v_ticket record;
  v_customer jsonb;
  v_payment jsonb;
  v_items jsonb;
begin
  if p_token is null or btrim(p_token) = '' then
    raise exception 'TOKEN_REQUIRED';
  end if;

  select r.ticket_id, r.expires_at
  into v_receipt
  from receipts r
  where r.public_token = p_token
    and r.expires_at > now()
  limit 1;

  if not found then
    raise exception 'RECEIPT_NOT_FOUND_OR_EXPIRED';
  end if;

  select t.id, t.created_at, t.totals_json, t.customer_id
  into v_ticket
  from tickets t
  where t.id = v_receipt.ticket_id
  limit 1;

  if not found then
    raise exception 'TICKET_NOT_FOUND';
  end if;

  select to_jsonb(c) into v_customer
  from (
    select name
    from customers
    where id = v_ticket.customer_id
    limit 1
  ) c;

  select to_jsonb(p) into v_payment
  from (
    select method, amount, status
    from payments
    where ticket_id = v_ticket.id
    order by created_at desc
    limit 1
  ) p;

  select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
  into v_items
  from (
    select
      ti.qty,
      ti.unit_price,
      ti.vat_rate,
      coalesce(s.name, '(service deleted)') as service_name
    from ticket_items ti
    left join services s on s.id = ti.service_id
    where ti.ticket_id = v_ticket.id
    order by ti.created_at asc
  ) i;

  return jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', v_ticket.id,
      'created_at', v_ticket.created_at,
      'totals_json', v_ticket.totals_json
    ),
    'customer', coalesce(v_customer, '{}'::jsonb),
    'payment', coalesce(v_payment, '{}'::jsonb),
    'items', v_items
  );
end;
$$;


--
-- Name: get_report_breakdown_secure(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_report_breakdown_secure(p_from timestamp with time zone, p_to timestamp with time zone) RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.get_report_breakdown_secure(p_from, p_to, null::uuid)
$$;


--
-- Name: get_report_breakdown_secure(timestamp with time zone, timestamp with time zone, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_report_breakdown_secure(p_from timestamp with time zone, p_to timestamp with time zone, p_branch_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_summary jsonb;
  v_by_service jsonb;
  v_by_payment jsonb;
  v_effective_branch_id uuid := p_branch_id;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_to <= p_from then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  if v_effective_branch_id is not null then
    if not public.can_access_branch(
      v_effective_branch_id,
      array['OWNER','PARTNER','MANAGER','ACCOUNTANT']
    ) then
      raise exception 'ACCESS_DENIED';
    end if;
  elsif not public.has_org_role(array['OWNER']) then
    v_effective_branch_id := public.my_default_branch_id();
    if v_effective_branch_id is null then
      raise exception 'BRANCH_CONTEXT_REQUIRED';
    end if;
    if not public.can_access_branch(
      v_effective_branch_id,
      array['OWNER','PARTNER','MANAGER','ACCOUNTANT']
    ) then
      raise exception 'ACCESS_DENIED';
    end if;
  end if;

  select jsonb_build_object(
    'count', count(*)::int,
    'subtotal', coalesce(sum((t.totals_json->>'subtotal')::numeric), 0),
    'vat', coalesce(sum((t.totals_json->>'vat_total')::numeric), 0),
    'revenue', coalesce(sum((t.totals_json->>'grand_total')::numeric), 0)
  )
  into v_summary
  from public.tickets t
  where t.org_id = public.my_org_id()
    and t.status = 'CLOSED'
    and t.created_at >= p_from
    and t.created_at < p_to
    and (
      v_effective_branch_id is null
      or t.branch_id = v_effective_branch_id
    )
    and public.can_access_branch(
      t.branch_id,
      array['OWNER','PARTNER','MANAGER','ACCOUNTANT']
    );

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  into v_by_service
  from (
    select
      coalesce(s.name, '(service deleted)') as service_name,
      sum(ti.qty)::int as qty,
      coalesce(sum(ti.qty * ti.unit_price), 0)::numeric as subtotal
    from public.ticket_items ti
    join public.tickets t on t.id = ti.ticket_id
    left join public.services s on s.id = ti.service_id
    where t.org_id = public.my_org_id()
      and t.status = 'CLOSED'
      and t.created_at >= p_from
      and t.created_at < p_to
      and (
        v_effective_branch_id is null
        or t.branch_id = v_effective_branch_id
      )
      and public.can_access_branch(
        t.branch_id,
        array['OWNER','PARTNER','MANAGER','ACCOUNTANT']
      )
    group by coalesce(s.name, '(service deleted)')
    order by subtotal desc
  ) x;

  select coalesce(jsonb_agg(to_jsonb(y)), '[]'::jsonb)
  into v_by_payment
  from (
    select
      p.method,
      count(*)::int as count,
      coalesce(sum(p.amount), 0)::numeric as amount
    from public.payments p
    join public.tickets t on t.id = p.ticket_id
    where t.org_id = public.my_org_id()
      and t.status = 'CLOSED'
      and t.created_at >= p_from
      and t.created_at < p_to
      and (
        v_effective_branch_id is null
        or t.branch_id = v_effective_branch_id
      )
      and public.can_access_branch(
        t.branch_id,
        array['OWNER','PARTNER','MANAGER','ACCOUNTANT']
      )
    group by p.method
    order by amount desc
  ) y;

  return jsonb_build_object(
    'summary', coalesce(v_summary, '{}'::jsonb),
    'branch_id', v_effective_branch_id,
    'by_service', v_by_service,
    'by_payment', v_by_payment
  );
end;
$$;


--
-- Name: get_telegram_user_role(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_telegram_user_role(p_telegram_user_id bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_app_user_id uuid;
  v_role text;
  v_display_name text;
  v_org_id uuid;
  v_branch_id uuid;
begin
  select tl.app_user_id
  into v_app_user_id
  from public.telegram_links tl
  where tl.telegram_user_id = p_telegram_user_id
  limit 1;

  if v_app_user_id is null then
    return jsonb_build_object('linked', false);
  end if;

  select r.role, r.org_id, r.branch_id
  into v_role, v_org_id, v_branch_id
  from public.user_roles r
  where r.user_id = v_app_user_id
  order by
    case r.role
      when 'OWNER' then 0
      when 'PARTNER' then 1
      when 'MANAGER' then 2
      when 'RECEPTION' then 3
      when 'ACCOUNTANT' then 4
      when 'TECH' then 5
      else 99
    end asc
  limit 1;

  select p.display_name
  into v_display_name
  from public.profiles p
  where p.user_id = v_app_user_id;

  return jsonb_build_object(
    'linked', true,
    'user_id', v_app_user_id,
    'role', v_role,
    'display_name', v_display_name,
    'org_id', v_org_id,
    'branch_id', v_branch_id
  );
end;
$$;


--
-- Name: get_ticket_detail_secure(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_ticket_detail_secure(p_ticket_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_ticket public.tickets;
  v_customer jsonb;
  v_payment jsonb;
  v_receipt jsonb;
  v_items jsonb;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select *
  into v_ticket
  from public.tickets t
  where t.id = p_ticket_id
    and t.org_id = public.my_org_id();

  if v_ticket.id is null then
    raise exception 'TICKET_NOT_FOUND';
  end if;

  if not public.can_access_branch(
    v_ticket.branch_id,
    array['OWNER','PARTNER','MANAGER','RECEPTION','ACCOUNTANT']
  ) then
    raise exception 'ACCESS_DENIED';
  end if;

  select to_jsonb(c)
  into v_customer
  from (
    select name, full_name, phone, branch_id
    from public.customers
    where id = v_ticket.customer_id
      and org_id = v_ticket.org_id
    limit 1
  ) c;

  select to_jsonb(p)
  into v_payment
  from (
    select method, amount, status, created_at
    from public.payments
    where ticket_id = v_ticket.id
      and org_id = v_ticket.org_id
    order by created_at desc
    limit 1
  ) p;

  select to_jsonb(r)
  into v_receipt
  from (
    select public_token, expires_at
    from public.receipts
    where ticket_id = v_ticket.id
      and org_id = v_ticket.org_id
    order by created_at desc
    limit 1
  ) r;

  select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
  into v_items
  from (
    select
      ti.qty,
      ti.unit_price,
      ti.vat_rate,
      coalesce(s.name, '(service deleted)') as service_name
    from public.ticket_items ti
    left join public.services s on s.id = ti.service_id
    where ti.ticket_id = v_ticket.id
      and ti.org_id = v_ticket.org_id
    order by ti.created_at asc
  ) i;

  return jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', v_ticket.id,
      'branch_id', v_ticket.branch_id,
      'created_at', v_ticket.created_at,
      'status', v_ticket.status,
      'totals_json', v_ticket.totals_json
    ),
    'customer', coalesce(v_customer, '{}'::jsonb),
    'payment', coalesce(v_payment, '{}'::jsonb),
    'receipt', coalesce(v_receipt, '{}'::jsonb),
    'items', v_items
  );
end;
$$;


--
-- Name: handle_new_auth_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_auth_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_workspace jsonb;
  v_org_id uuid;
  v_branch_id uuid;
  v_role text;
  v_display_name text;
  v_phone text;
  v_email text;
  v_registration_mode text;
  v_auth_provider text;
  v_customer_id uuid;
  v_existing_customer_id uuid;
begin
  v_auth_provider := lower(coalesce(new.raw_app_meta_data ->> 'provider', 'email'));
  v_registration_mode := upper(
    coalesce(
      new.raw_user_meta_data ->> 'registration_mode',
      case
        when v_auth_provider in ('google', 'apple') then 'USER'
        else 'ADMIN'
      end
    )
  );

  v_workspace := public.ensure_default_workspace();
  v_org_id := coalesce((v_workspace ->> 'org_id')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
  v_branch_id := coalesce((v_workspace ->> 'branch_id')::uuid, '00000000-0000-0000-0000-000000000101'::uuid);

  v_display_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', '')), '');
  if v_display_name is null then
    v_display_name := coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'User');
  end if;

  v_phone := public.normalize_customer_phone(nullif(trim(coalesce(new.phone, new.raw_user_meta_data ->> 'phone', '')), ''));
  v_email := lower(nullif(trim(coalesce(new.email, '')), ''));

  if v_registration_mode = 'USER' then
    -- 1) existing customer_accounts by auth.user.id
    select ca.customer_id
    into v_existing_customer_id
    from public.customer_accounts ca
    where ca.user_id = new.id
    order by ca.created_at asc
    limit 1;

    if v_existing_customer_id is not null then
      v_customer_id := v_existing_customer_id;
    end if;

    -- 2) customers by normalized email only
    if v_customer_id is null and v_email is not null then
      select c.id
      into v_customer_id
      from public.customers c
      where c.org_id = v_org_id
        and lower(coalesce(c.email, '')) = v_email
        and c.merged_into_customer_id is null
      order by c.total_visits desc, c.total_spend desc, c.created_at asc
      limit 1;
    end if;

    if v_customer_id is null then
      insert into public.customers (org_id, name, full_name, email, phone, source)
      values (v_org_id, v_display_name, v_display_name, v_email, v_phone, 'APP_SIGNUP')
      returning id into v_customer_id;
    else
      update public.customers
      set
        full_name = coalesce(nullif(trim(full_name), ''), v_display_name),
        name = coalesce(nullif(trim(name), ''), v_display_name),
        email = coalesce(email, v_email),
        phone = coalesce(phone, v_phone),
        source = coalesce(source, 'APP_SIGNUP')
      where id = v_customer_id;
    end if;

    insert into public.customer_accounts (user_id, customer_id, org_id, linked_by)
    values (
      new.id,
      v_customer_id,
      v_org_id,
      case
        when v_existing_customer_id is not null then 'ACCOUNT_LINK'
        when v_email is not null then 'EMAIL_MATCH'
        else 'APP_SIGNUP'
      end
    )
    on conflict (user_id) do update
      set customer_id = excluded.customer_id,
          org_id = excluded.org_id,
          linked_by = excluded.linked_by;

    return new;
  end if;

  insert into public.profiles (user_id, org_id, default_branch_id, display_name, email, phone)
  values (new.id, v_org_id, v_branch_id, v_display_name, new.email, v_phone)
  on conflict (user_id) do update
    set org_id = coalesce(public.profiles.org_id, excluded.org_id),
        default_branch_id = coalesce(public.profiles.default_branch_id, excluded.default_branch_id),
        display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
        email = coalesce(excluded.email, public.profiles.email),
        phone = coalesce(excluded.phone, public.profiles.phone);

  select case
    when exists (select 1 from public.user_roles where org_id = v_org_id and role = 'OWNER') then 'RECEPTION'
    else 'OWNER'
  end into v_role;

  begin
    insert into public.user_roles (user_id, org_id, role)
    values (new.id, v_org_id, v_role);
  exception when unique_violation then
    null;
  end;

  return new;
end;
$$;


--
-- Name: has_branch_role(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_branch_role(p_branch_id uuid, p_roles text[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.org_id = public.my_org_id()
      and ur.branch_id = p_branch_id
      and ur.role = any(p_roles)
  )
$$;


--
-- Name: has_org_role(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_org_role(p_roles text[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.org_id = public.my_org_id()
      and ur.branch_id is null
      and ur.role = any(p_roles)
  )
$$;


--
-- Name: has_role(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_role text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.org_id = public.my_org_id()
      and (
        (
          ur.role = _role
          and (
            ur.branch_id is null
            or ur.branch_id = public.my_branch_id()
          )
        )
        or (
          _role = 'OWNER'
          and ur.role = 'PARTNER'
          and ur.branch_id = public.my_branch_id()
        )
      )
  )
$$;


--
-- Name: heartbeat_online_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.heartbeat_online_user(p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.online_users
  set last_heartbeat = now()
  where user_id = p_user_id;

  return jsonb_build_object('success', true);
end;
$$;


--
-- Name: infer_follow_up_days(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.infer_follow_up_days(p_service_summary text) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  v_text text := lower(coalesce(p_service_summary, ''));
begin
  if v_text like '%gel%' or v_text like '%biab%' then
    return 21;
  end if;

  if v_text like '%extension%' or v_text like '%refill%' or v_text like '%up mong%' or v_text like '%dual form%' then
    return 18;
  end if;

  return 30;
end;
$$;


--
-- Name: link_customer_account_by_phone(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_customer_account_by_phone() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_customer_id uuid;
  v_existing_account_id uuid;
  v_phone text;
  v_email text;
  v_display_name text;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select ca.org_id, ca.customer_id
  into v_org_id, v_customer_id
  from public.customer_accounts ca
  where ca.user_id = v_user_id
  order by ca.created_at asc
  limit 1;

  if v_customer_id is not null then
    return v_customer_id;
  end if;

  select
    coalesce(
      nullif(trim((auth.jwt() -> 'user_metadata' ->> 'phone')), ''),
      nullif(trim((auth.jwt() ->> 'phone')), '')
    ),
    coalesce(
      nullif(trim((auth.jwt() ->> 'email')), ''),
      nullif(trim((auth.jwt() -> 'user_metadata' ->> 'email')), '')
    ),
    coalesce(
      nullif(trim((auth.jwt() -> 'user_metadata' ->> 'full_name')), ''),
      nullif(trim((auth.jwt() -> 'user_metadata' ->> 'name')), ''),
      nullif(trim((auth.jwt() ->> 'email')), ''),
      'Customer'
    )
  into v_phone, v_email, v_display_name;

  if v_phone is not null then
    v_phone := public.normalize_customer_phone(v_phone);
  end if;

  if v_phone is null or btrim(v_phone) = '' then
    raise exception 'CUSTOMER_PHONE_REQUIRED';
  end if;

  if v_org_id is null then
    select id into v_org_id
    from public.orgs
    order by created_at asc
    limit 1;
  end if;

  if v_org_id is null then
    raise exception 'ORG_NOT_FOUND';
  end if;

  select id
  into v_customer_id
  from public.customers
  where org_id = v_org_id
    and public.normalize_customer_phone(phone) = v_phone
    and merged_into_customer_id is null
  order by total_visits desc, total_spend desc, created_at asc
  limit 1;

  if v_customer_id is null then
    insert into public.customers (
      org_id,
      name,
      full_name,
      email,
      phone,
      source
    )
    values (
      v_org_id,
      v_display_name,
      v_display_name,
      v_email,
      v_phone,
      'APP_SIGNUP'
    )
    returning id into v_customer_id;
  end if;

  select id
  into v_existing_account_id
  from public.customer_accounts
  where user_id = v_user_id
     or customer_id = v_customer_id
  order by case when user_id = v_user_id then 0 else 1 end, created_at asc
  limit 1;

  if v_existing_account_id is not null then
    update public.customer_accounts
    set
      user_id = v_user_id,
      customer_id = v_customer_id,
      org_id = v_org_id,
      linked_by = 'PHONE_MATCH'
    where id = v_existing_account_id;
  else
    insert into public.customer_accounts (
      user_id,
      customer_id,
      org_id,
      linked_by
    )
    values (
      v_user_id,
      v_customer_id,
      v_org_id,
      'PHONE_MATCH'
    );
  end if;

  return v_customer_id;
end;
$$;


--
-- Name: link_customer_account_for_current_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_customer_account_for_current_user() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_auth_user auth.users%rowtype;
  v_workspace jsonb;
  v_org_id uuid;
  v_display_name text;
  v_phone text;
  v_email text;
  v_customer_id uuid;
  v_existing_account_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select *
  into v_auth_user
  from auth.users
  where id = auth.uid()
  limit 1;

  if v_auth_user.id is null then
    raise exception 'AUTH_USER_NOT_FOUND';
  end if;

  select ca.org_id, ca.customer_id, ca.id
  into v_org_id, v_customer_id, v_existing_account_id
  from public.customer_accounts ca
  where ca.user_id = auth.uid()
  order by ca.created_at asc
  limit 1;

  if v_org_id is null then
    v_workspace := public.ensure_default_workspace();
    v_org_id := coalesce((v_workspace ->> 'org_id')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
  end if;

  v_display_name := nullif(trim(coalesce(
    v_auth_user.raw_user_meta_data ->> 'display_name',
    v_auth_user.raw_user_meta_data ->> 'full_name',
    split_part(coalesce(v_auth_user.email, ''), '@', 1),
    'Customer'
  )), '');
  v_phone := public.normalize_customer_phone(nullif(trim(coalesce(v_auth_user.phone, v_auth_user.raw_user_meta_data ->> 'phone', '')), ''));
  v_email := lower(nullif(trim(coalesce(v_auth_user.email, '')), ''));

  -- 1) existing customer_accounts by auth.user.id
  if v_customer_id is not null then
    update public.customers
    set
      email = coalesce(email, v_email),
      phone = coalesce(phone, v_phone),
      full_name = coalesce(nullif(trim(full_name), ''), v_display_name),
      name = coalesce(nullif(trim(name), ''), v_display_name)
    where id = v_customer_id;

    return v_customer_id;
  end if;

  -- 2) customers by normalized email only
  if v_email is not null then
    select id
    into v_customer_id
    from public.customers
    where org_id = v_org_id
      and lower(coalesce(email, '')) = v_email
      and merged_into_customer_id is null
    order by total_visits desc, total_spend desc, created_at asc
    limit 1;
  end if;

  if v_customer_id is null then
    insert into public.customers (org_id, name, full_name, email, phone, source)
    values (
      v_org_id,
      coalesce(v_display_name, coalesce(v_auth_user.email, 'Customer')),
      coalesce(v_display_name, coalesce(v_auth_user.email, 'Customer')),
      v_email,
      v_phone,
      'APP_SIGNUP'
    )
    returning id into v_customer_id;
  else
    update public.customers
    set
      email = coalesce(email, v_email),
      phone = coalesce(phone, v_phone),
      full_name = coalesce(nullif(trim(full_name), ''), v_display_name),
      name = coalesce(nullif(trim(name), ''), v_display_name)
    where id = v_customer_id;
  end if;

  select id
  into v_existing_account_id
  from public.customer_accounts
  where user_id = auth.uid() or customer_id = v_customer_id
  order by case when user_id = auth.uid() then 0 else 1 end, created_at asc
  limit 1;

  if v_existing_account_id is not null then
    update public.customer_accounts
    set user_id = auth.uid(),
        customer_id = v_customer_id,
        org_id = v_org_id,
        linked_by = case
          when v_email is not null then 'EMAIL_MATCH'
          else 'APP_SIGNUP'
        end
    where id = v_existing_account_id;
  else
    insert into public.customer_accounts (user_id, customer_id, org_id, linked_by)
    values (
      auth.uid(),
      v_customer_id,
      v_org_id,
      case
        when v_email is not null then 'EMAIL_MATCH'
        else 'APP_SIGNUP'
      end
    );
  end if;

  return v_customer_id;
end;
$$;


--
-- Name: list_booking_requests_secure(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_booking_requests_secure(p_status text DEFAULT NULL::text) RETURNS TABLE(id uuid, customer_name text, customer_phone text, requested_service text, preferred_staff text, note text, requested_start_at timestamp with time zone, requested_end_at timestamp with time zone, status text, appointment_id uuid, source text, created_at timestamp with time zone)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    br.id,
    br.customer_name,
    br.customer_phone,
    br.requested_service,
    br.preferred_staff,
    br.note,
    br.requested_start_at,
    br.requested_end_at,
    br.status,
    br.appointment_id,
    br.source,
    br.created_at
  from public.booking_requests br
  where br.org_id = public.my_org_id()
    and (
      public.has_role('OWNER')
      or public.has_role('MANAGER')
      or public.has_role('RECEPTION')
      or public.has_role('TECH')
    )
    and (p_status is null or br.status = p_status)
  order by br.created_at asc
  limit 200;
$$;


--
-- Name: list_customer_duplicate_candidates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_customer_duplicate_candidates() RETURNS TABLE(org_id uuid, match_type text, match_value text, duplicate_count integer, canonical_customer_id uuid, duplicate_customer_ids uuid[])
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    v.org_id,
    v.match_type,
    v.match_value,
    v.duplicate_count::int,
    v.customer_ids[1] as canonical_customer_id,
    case
      when coalesce(array_length(v.customer_ids, 1), 0) <= 1 then '{}'::uuid[]
      else v.customer_ids[2:array_length(v.customer_ids, 1)]
    end as duplicate_customer_ids
  from public.customer_duplicate_candidates v
  order by v.org_id, v.match_type, v.match_value;
$$;


--
-- Name: list_customer_name_duplicate_candidates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_customer_name_duplicate_candidates() RETURNS TABLE(org_id uuid, match_value text, duplicate_count integer, canonical_customer_id uuid, duplicate_customer_ids uuid[])
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    org_id,
    match_value,
    duplicate_count::int,
    canonical_customer_id,
    duplicate_customer_ids
  from public.customer_name_duplicate_candidates
  order by org_id, match_value;
$$;


--
-- Name: list_customers_crm(text, text, integer, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_customers_crm(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_dormant_days integer DEFAULT NULL::integer, p_vip_only boolean DEFAULT false, p_source text DEFAULT NULL::text) RETURNS TABLE(id uuid, org_id uuid, full_name text, phone text, birthday date, gender text, first_visit_at timestamp with time zone, last_visit_at timestamp with time zone, total_visits integer, total_spend numeric, last_service_summary text, favorite_staff_user_id uuid, customer_status text, tags text[], care_note text, source text, next_follow_up_at timestamp with time zone, last_contacted_at timestamp with time zone, follow_up_status text, needs_merge_review boolean)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select *
  from public.list_customers_crm(
    p_search,
    p_status,
    p_dormant_days,
    p_vip_only,
    p_source,
    null::uuid
  )
$$;


--
-- Name: list_customers_crm(text, text, integer, boolean, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_customers_crm(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_dormant_days integer DEFAULT NULL::integer, p_vip_only boolean DEFAULT false, p_source text DEFAULT NULL::text, p_branch_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, org_id uuid, full_name text, phone text, birthday date, gender text, first_visit_at timestamp with time zone, last_visit_at timestamp with time zone, total_visits integer, total_spend numeric, last_service_summary text, favorite_staff_user_id uuid, customer_status text, tags text[], care_note text, source text, next_follow_up_at timestamp with time zone, last_contacted_at timestamp with time zone, follow_up_status text, needs_merge_review boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if not public.can_access_crm() then
    raise exception 'FORBIDDEN';
  end if;

  if p_branch_id is not null and not public.can_access_crm_branch(p_branch_id) then
    raise exception 'ACCESS_DENIED';
  end if;

  return query
  select
    c.id,
    c.org_id,
    coalesce(nullif(trim(c.full_name), ''), c.name) as full_name,
    c.phone,
    c.birthday,
    c.gender,
    c.first_visit_at,
    c.last_visit_at,
    c.total_visits,
    c.total_spend,
    c.last_service_summary,
    c.favorite_staff_user_id,
    c.customer_status,
    c.tags,
    coalesce(c.care_note, c.notes) as care_note,
    c.source,
    c.next_follow_up_at,
    c.last_contacted_at,
    c.follow_up_status,
    c.needs_merge_review
  from public.customers c
  where c.org_id = public.my_org_id()
    and public.can_access_crm_branch(c.branch_id)
    and (
      p_branch_id is null
      or c.branch_id = p_branch_id
    )
    and c.merged_into_customer_id is null
    and (
      p_search is null
      or lower(coalesce(c.full_name, c.name, '')) like '%' || lower(p_search) || '%'
      or coalesce(public.normalize_customer_phone(c.phone), '') like '%' || coalesce(public.normalize_customer_phone(p_search), p_search) || '%'
    )
    and (p_status is null or c.customer_status = p_status)
    and (p_source is null or c.source = p_source)
    and (not p_vip_only or c.customer_status = 'VIP')
    and (
      p_dormant_days is null
      or c.last_visit_at is null
      or c.last_visit_at <= now() - make_interval(days => p_dormant_days)
    )
  order by c.last_visit_at desc nulls last, c.total_spend desc, c.created_at desc;
end;
$$;


--
-- Name: list_follow_up_candidates(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_follow_up_candidates(p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(id uuid, org_id uuid, full_name text, phone text, birthday date, gender text, first_visit_at timestamp with time zone, last_visit_at timestamp with time zone, total_visits integer, total_spend numeric, last_service_summary text, favorite_staff_user_id uuid, customer_status text, tags text[], care_note text, source text, next_follow_up_at timestamp with time zone, last_contacted_at timestamp with time zone, follow_up_status text, needs_merge_review boolean)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select *
  from public.list_follow_up_candidates(p_from, p_to, null::uuid)
$$;


--
-- Name: list_follow_up_candidates(timestamp with time zone, timestamp with time zone, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_follow_up_candidates(p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_branch_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, org_id uuid, full_name text, phone text, birthday date, gender text, first_visit_at timestamp with time zone, last_visit_at timestamp with time zone, total_visits integer, total_spend numeric, last_service_summary text, favorite_staff_user_id uuid, customer_status text, tags text[], care_note text, source text, next_follow_up_at timestamp with time zone, last_contacted_at timestamp with time zone, follow_up_status text, needs_merge_review boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if not public.can_access_crm() then
    raise exception 'FORBIDDEN';
  end if;

  if p_branch_id is not null and not public.can_access_crm_branch(p_branch_id) then
    raise exception 'ACCESS_DENIED';
  end if;

  return query
  select
    c.id,
    c.org_id,
    coalesce(nullif(trim(c.full_name), ''), c.name) as full_name,
    c.phone,
    c.birthday,
    c.gender,
    c.first_visit_at,
    c.last_visit_at,
    c.total_visits,
    c.total_spend,
    c.last_service_summary,
    c.favorite_staff_user_id,
    c.customer_status,
    c.tags,
    coalesce(c.care_note, c.notes) as care_note,
    c.source,
    c.next_follow_up_at,
    c.last_contacted_at,
    c.follow_up_status,
    c.needs_merge_review
  from public.customers c
  where c.org_id = public.my_org_id()
    and public.can_access_crm_branch(c.branch_id)
    and (
      p_branch_id is null
      or c.branch_id = p_branch_id
    )
    and c.next_follow_up_at is not null
    and (p_from is null or c.next_follow_up_at >= p_from)
    and (p_to is null or c.next_follow_up_at <= p_to)
    and coalesce(c.follow_up_status, 'PENDING') <> 'DONE'
  order by c.next_follow_up_at asc, c.total_spend desc;
end;
$$;


--
-- Name: list_pending_customer_push_notifications(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_pending_customer_push_notifications(p_limit integer DEFAULT 100) RETURNS TABLE(notification_id uuid, customer_id uuid, org_id uuid, title text, body text, kind text, expo_push_token text, push_device_id uuid)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  select
    cn.id as notification_id,
    cn.customer_id,
    cn.org_id,
    cn.title,
    cn.body,
    cn.kind,
    cpd.expo_push_token,
    cpd.id as push_device_id
  from public.customer_notifications cn
  join public.customer_push_devices cpd
    on cpd.customer_id = cn.customer_id
   and cpd.org_id = cn.org_id
  where cn.push_delivery_state in ('PENDING', 'FAILED')
  order by cn.sent_at asc, cpd.last_seen_at desc
  limit greatest(coalesce(p_limit, 100), 1);
$$;


--
-- Name: list_team_members_secure(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_team_members_secure() RETURNS TABLE(id uuid, user_id uuid, role text, display_name text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    ur.id,
    ur.user_id,
    ur.role::text,
    coalesce(nullif(trim(p.display_name), ''), left(ur.user_id::text, 8)) as display_name
  from public.user_roles ur
  left join public.profiles p on p.user_id = ur.user_id
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


--
-- Name: list_team_members_secure_v2(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_team_members_secure_v2() RETURNS TABLE(id uuid, user_id uuid, role text, display_name text, email text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    ur.id,
    ur.user_id,
    ur.role::text,
    coalesce(nullif(trim(p.display_name), ''), left(ur.user_id::text, 8)) as display_name,
    nullif(trim(p.email), '') as email
  from public.user_roles ur
  left join public.profiles p on p.user_id = ur.user_id
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


--
-- Name: mark_customer_push_delivery_result(uuid, uuid, text, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_customer_push_delivery_result(p_notification_id uuid, p_push_device_id uuid, p_status text, p_response_payload jsonb DEFAULT NULL::jsonb, p_error_message text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
begin
  insert into public.customer_push_delivery_logs (
    notification_id,
    push_device_id,
    expo_push_token,
    status,
    response_payload,
    error_message,
    attempted_at,
    delivered_at
  )
  select
    p_notification_id,
    p_push_device_id,
    cpd.expo_push_token,
    p_status,
    p_response_payload,
    p_error_message,
    now(),
    case when p_status = 'SENT' then now() else null end
  from public.customer_push_devices cpd
  where cpd.id = p_push_device_id;

  update public.customer_notifications
  set
    push_last_sent_at = case when p_status = 'SENT' then now() else push_last_sent_at end,
    push_last_error = case when p_status = 'FAILED' then p_error_message else null end,
    push_delivery_state = case
      when p_status = 'SENT' then 'SENT'
      when p_status = 'FAILED' then 'FAILED'
      else 'SKIPPED'
    end
  where id = p_notification_id;
end;
$$;


--
-- Name: merge_customer_records(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.merge_customer_records(p_canonical_customer_id uuid, p_duplicate_customer_id uuid, p_reason text DEFAULT 'EMAIL_OR_PHONE_DUPLICATE'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_canonical public.customers%rowtype;
  v_duplicate public.customers%rowtype;
  v_actor uuid := auth.uid();
  v_snapshot jsonb;
  v_canonical_email text;
  v_duplicate_email text;
  v_canonical_phone text;
  v_duplicate_phone text;
begin
  if p_canonical_customer_id is null or p_duplicate_customer_id is null then
    raise exception 'CUSTOMER_IDS_REQUIRED';
  end if;

  if p_canonical_customer_id = p_duplicate_customer_id then
    raise exception 'CUSTOMER_IDS_MUST_DIFFER';
  end if;

  select * into v_canonical
  from public.customers
  where id = p_canonical_customer_id
  for update;

  if not found then
    raise exception 'CANONICAL_CUSTOMER_NOT_FOUND';
  end if;

  select * into v_duplicate
  from public.customers
  where id = p_duplicate_customer_id
  for update;

  if not found then
    raise exception 'DUPLICATE_CUSTOMER_NOT_FOUND';
  end if;

  if v_canonical.org_id <> v_duplicate.org_id then
    raise exception 'CUSTOMER_ORG_MISMATCH';
  end if;

  if v_canonical.merged_into_customer_id is not null then
    raise exception 'CANONICAL_ALREADY_MERGED';
  end if;

  if v_duplicate.merged_into_customer_id is not null then
    raise exception 'DUPLICATE_ALREADY_MERGED';
  end if;

  v_canonical_email := lower(nullif(trim(v_canonical.email), ''));
  v_duplicate_email := lower(nullif(trim(v_duplicate.email), ''));
  v_canonical_phone := public.normalize_customer_phone(v_canonical.phone);
  v_duplicate_phone := public.normalize_customer_phone(v_duplicate.phone);

  if v_canonical_email is not null and v_duplicate_email is not null and v_canonical_email <> v_duplicate_email then
    raise exception 'MERGE_BLOCKED_EMAIL_CONFLICT';
  end if;

  if v_canonical_phone is not null and v_duplicate_phone is not null and v_canonical_phone <> v_duplicate_phone then
    raise exception 'MERGE_BLOCKED_PHONE_CONFLICT';
  end if;

  if v_canonical.birthday is not null and v_duplicate.birthday is not null and v_canonical.birthday <> v_duplicate.birthday then
    raise exception 'MERGE_BLOCKED_BIRTHDAY_CONFLICT';
  end if;

  if nullif(trim(coalesce(v_canonical.notes, '')), '') is not null
     and nullif(trim(coalesce(v_duplicate.notes, '')), '') is not null then
    raise exception 'MERGE_BLOCKED_BOTH_HAVE_NOTES';
  end if;

  if nullif(trim(coalesce(v_canonical.care_note, '')), '') is not null
     and nullif(trim(coalesce(v_duplicate.care_note, '')), '') is not null then
    raise exception 'MERGE_BLOCKED_BOTH_HAVE_CARE_NOTES';
  end if;

  if coalesce(v_canonical.total_visits, 0) > 0 and coalesce(v_duplicate.total_visits, 0) > 0 then
    raise exception 'MERGE_BLOCKED_BOTH_HAVE_VISIT_HISTORY';
  end if;

  if coalesce(v_canonical.total_spend, 0) > 0 and coalesce(v_duplicate.total_spend, 0) > 0 then
    raise exception 'MERGE_BLOCKED_BOTH_HAVE_SPEND_HISTORY';
  end if;

  v_snapshot := jsonb_build_object(
    'canonical_before', to_jsonb(v_canonical),
    'duplicate_before', to_jsonb(v_duplicate)
  );

  update public.customers
  set
    full_name = case
      when nullif(trim(public.customers.full_name), '') is not null then public.customers.full_name
      when nullif(trim(v_duplicate.full_name), '') is not null then v_duplicate.full_name
      when nullif(trim(v_duplicate.name), '') is not null then v_duplicate.name
      else public.customers.full_name
    end,
    name = case
      when nullif(trim(public.customers.name), '') is not null then public.customers.name
      when nullif(trim(v_duplicate.name), '') is not null then v_duplicate.name
      when nullif(trim(v_duplicate.full_name), '') is not null then v_duplicate.full_name
      else public.customers.name
    end,
    email = coalesce(public.customers.email, v_duplicate.email),
    phone = coalesce(public.customers.phone, v_duplicate.phone),
    birthday = coalesce(public.customers.birthday, v_duplicate.birthday),
    gender = coalesce(public.customers.gender, v_duplicate.gender),
    address = coalesce(public.customers.address, v_duplicate.address),
    tags = coalesce((
      select array_agg(distinct tag)
      from unnest(coalesce(public.customers.tags, '{}'::text[]) || coalesce(v_duplicate.tags, '{}'::text[])) tag
    ), '{}'::text[]),
    notes = concat_ws(E'\n\n', nullif(public.customers.notes, ''), nullif(v_duplicate.notes, '')),
    care_note = concat_ws(E'\n\n', nullif(public.customers.care_note, ''), nullif(v_duplicate.care_note, '')),
    first_visit_at = least(
      coalesce(public.customers.first_visit_at, v_duplicate.first_visit_at),
      coalesce(v_duplicate.first_visit_at, public.customers.first_visit_at)
    ),
    last_visit_at = greatest(
      coalesce(public.customers.last_visit_at, v_duplicate.last_visit_at),
      coalesce(v_duplicate.last_visit_at, public.customers.last_visit_at)
    ),
    last_contacted_at = greatest(
      coalesce(public.customers.last_contacted_at, v_duplicate.last_contacted_at),
      coalesce(v_duplicate.last_contacted_at, public.customers.last_contacted_at)
    ),
    next_follow_up_at = coalesce(public.customers.next_follow_up_at, v_duplicate.next_follow_up_at),
    follow_up_status = coalesce(public.customers.follow_up_status, v_duplicate.follow_up_status),
    favorite_staff_user_id = coalesce(public.customers.favorite_staff_user_id, v_duplicate.favorite_staff_user_id),
    source = coalesce(public.customers.source, v_duplicate.source)
  where public.customers.id = v_canonical.id;

  update public.customer_accounts
  set customer_id = v_canonical.id,
      linked_by = coalesce(linked_by, 'MERGED')
  where customer_id = v_duplicate.id;

  update public.appointments set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  update public.tickets set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  update public.booking_requests set customer_id = v_canonical.id where customer_id = v_duplicate.id;

  update public.customer_favorite_services
  set customer_id = v_canonical.id
  where customer_id = v_duplicate.id
    and not exists (
      select 1
      from public.customer_favorite_services keep
      where keep.customer_id = v_canonical.id
        and keep.service_id = public.customer_favorite_services.service_id
    );
  delete from public.customer_favorite_services where customer_id = v_duplicate.id;

  update public.customer_memberships
  set customer_id = v_canonical.id
  where customer_id = v_duplicate.id
    and not exists (
      select 1 from public.customer_memberships keep where keep.customer_id = v_canonical.id
    );
  delete from public.customer_memberships where customer_id = v_duplicate.id;

  update public.customer_notification_preferences
  set customer_id = v_canonical.id
  where customer_id = v_duplicate.id
    and not exists (
      select 1 from public.customer_notification_preferences keep where keep.customer_id = v_canonical.id
    );
  delete from public.customer_notification_preferences where customer_id = v_duplicate.id;

  update public.customer_offer_claims
  set customer_id = v_canonical.id
  where customer_id = v_duplicate.id
    and not exists (
      select 1
      from public.customer_offer_claims keep
      where keep.customer_id = v_canonical.id
        and keep.offer_id = public.customer_offer_claims.offer_id
    );
  delete from public.customer_offer_claims where customer_id = v_duplicate.id;

  update public.customer_notifications set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  update public.customer_service_reviews set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  update public.customer_activities set customer_id = v_canonical.id where customer_id = v_duplicate.id;

  update public.customers
  set merged_into_customer_id = v_canonical.id,
      needs_merge_review = false
  where id = v_duplicate.id;

  update public.customers
  set needs_merge_review = false
  where id = v_canonical.id;

  insert into public.customer_merge_audit (
    org_id,
    canonical_customer_id,
    duplicate_customer_id,
    merge_reason,
    merged_by,
    snapshot
  )
  values (
    v_canonical.org_id,
    v_canonical.id,
    v_duplicate.id,
    coalesce(nullif(trim(p_reason), ''), 'EMAIL_OR_PHONE_DUPLICATE'),
    v_actor,
    v_snapshot
  )
  on conflict (canonical_customer_id, duplicate_customer_id) do update
    set merge_reason = excluded.merge_reason,
        merged_by = excluded.merged_by,
        merged_at = now(),
        snapshot = excluded.snapshot;

  perform public.append_customer_activity(
    v_canonical.org_id,
    v_canonical.id,
    'MERGE',
    'CRM',
    'Merged duplicate customer ' || v_duplicate.id::text || ' into canonical record',
    null
  );

  perform public.refresh_customer_metrics(v_canonical.id, null);

  return jsonb_build_object(
    'success', true,
    'org_id', v_canonical.org_id,
    'canonical_customer_id', v_canonical.id,
    'duplicate_customer_id', v_duplicate.id,
    'reason', coalesce(nullif(trim(p_reason), ''), 'EMAIL_OR_PHONE_DUPLICATE')
  );
end;
$$;


--
-- Name: merge_customer_records_force(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.merge_customer_records_force(p_canonical_customer_id uuid, p_duplicate_customer_id uuid, p_reason text DEFAULT 'CONFIRMED_NAME_DUPLICATE'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_canonical public.customers%rowtype;
  v_duplicate public.customers%rowtype;
  v_actor uuid := auth.uid();
  v_snapshot jsonb;
begin
  if p_canonical_customer_id is null or p_duplicate_customer_id is null then
    raise exception 'CUSTOMER_IDS_REQUIRED';
  end if;

  if p_canonical_customer_id = p_duplicate_customer_id then
    raise exception 'CUSTOMER_IDS_MUST_DIFFER';
  end if;

  select * into v_canonical
  from public.customers
  where id = p_canonical_customer_id
  for update;

  if not found then
    raise exception 'CANONICAL_CUSTOMER_NOT_FOUND';
  end if;

  select * into v_duplicate
  from public.customers
  where id = p_duplicate_customer_id
  for update;

  if not found then
    raise exception 'DUPLICATE_CUSTOMER_NOT_FOUND';
  end if;

  if v_canonical.org_id <> v_duplicate.org_id then
    raise exception 'CUSTOMER_ORG_MISMATCH';
  end if;

  if v_canonical.merged_into_customer_id is not null then
    raise exception 'CANONICAL_ALREADY_MERGED';
  end if;

  if v_duplicate.merged_into_customer_id is not null then
    raise exception 'DUPLICATE_ALREADY_MERGED';
  end if;

  v_snapshot := jsonb_build_object(
    'canonical_before', to_jsonb(v_canonical),
    'duplicate_before', to_jsonb(v_duplicate),
    'forced', true
  );

  update public.customers
  set
    full_name = case
      when nullif(trim(public.customers.full_name), '') is not null then public.customers.full_name
      when nullif(trim(v_duplicate.full_name), '') is not null then v_duplicate.full_name
      when nullif(trim(v_duplicate.name), '') is not null then v_duplicate.name
      else public.customers.full_name
    end,
    name = case
      when nullif(trim(public.customers.name), '') is not null then public.customers.name
      when nullif(trim(v_duplicate.name), '') is not null then v_duplicate.name
      when nullif(trim(v_duplicate.full_name), '') is not null then v_duplicate.full_name
      else public.customers.name
    end,
    email = coalesce(public.customers.email, v_duplicate.email),
    phone = coalesce(public.customers.phone, v_duplicate.phone),
    birthday = coalesce(public.customers.birthday, v_duplicate.birthday),
    gender = coalesce(public.customers.gender, v_duplicate.gender),
    address = coalesce(public.customers.address, v_duplicate.address),
    tags = coalesce((
      select array_agg(distinct tag)
      from unnest(coalesce(public.customers.tags, '{}'::text[]) || coalesce(v_duplicate.tags, '{}'::text[])) tag
    ), '{}'::text[]),
    notes = concat_ws(E'\n\n', nullif(public.customers.notes, ''), nullif(v_duplicate.notes, '')),
    care_note = concat_ws(E'\n\n', nullif(public.customers.care_note, ''), nullif(v_duplicate.care_note, '')),
    first_visit_at = least(
      coalesce(public.customers.first_visit_at, v_duplicate.first_visit_at),
      coalesce(v_duplicate.first_visit_at, public.customers.first_visit_at)
    ),
    last_visit_at = greatest(
      coalesce(public.customers.last_visit_at, v_duplicate.last_visit_at),
      coalesce(v_duplicate.last_visit_at, public.customers.last_visit_at)
    ),
    last_contacted_at = greatest(
      coalesce(public.customers.last_contacted_at, v_duplicate.last_contacted_at),
      coalesce(v_duplicate.last_contacted_at, public.customers.last_contacted_at)
    ),
    next_follow_up_at = coalesce(public.customers.next_follow_up_at, v_duplicate.next_follow_up_at),
    follow_up_status = coalesce(public.customers.follow_up_status, v_duplicate.follow_up_status),
    favorite_staff_user_id = coalesce(public.customers.favorite_staff_user_id, v_duplicate.favorite_staff_user_id),
    source = coalesce(public.customers.source, v_duplicate.source)
  where public.customers.id = v_canonical.id;

  update public.customer_accounts
  set customer_id = v_canonical.id,
      linked_by = 'FORCED_MERGE'
  where customer_id = v_duplicate.id;

  update public.appointments set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  update public.tickets set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  update public.booking_requests set customer_id = v_canonical.id where customer_id = v_duplicate.id;

  update public.customer_favorite_services
  set customer_id = v_canonical.id
  where customer_id = v_duplicate.id
    and not exists (
      select 1
      from public.customer_favorite_services keep
      where keep.customer_id = v_canonical.id
        and keep.service_id = public.customer_favorite_services.service_id
    );
  delete from public.customer_favorite_services where customer_id = v_duplicate.id;

  update public.customer_memberships
  set customer_id = v_canonical.id
  where customer_id = v_duplicate.id
    and not exists (
      select 1 from public.customer_memberships keep where keep.customer_id = v_canonical.id
    );
  delete from public.customer_memberships where customer_id = v_duplicate.id;

  update public.customer_notification_preferences
  set customer_id = v_canonical.id
  where customer_id = v_duplicate.id
    and not exists (
      select 1 from public.customer_notification_preferences keep where keep.customer_id = v_canonical.id
    );
  delete from public.customer_notification_preferences where customer_id = v_duplicate.id;

  update public.customer_offer_claims
  set customer_id = v_canonical.id
  where customer_id = v_duplicate.id
    and not exists (
      select 1
      from public.customer_offer_claims keep
      where keep.customer_id = v_canonical.id
        and keep.offer_id = public.customer_offer_claims.offer_id
    );
  delete from public.customer_offer_claims where customer_id = v_duplicate.id;

  update public.customer_notifications set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  update public.customer_service_reviews set customer_id = v_canonical.id where customer_id = v_duplicate.id;
  update public.customer_activities set customer_id = v_canonical.id where customer_id = v_duplicate.id;

  update public.customers
  set merged_into_customer_id = v_canonical.id,
      needs_merge_review = false
  where id = v_duplicate.id;

  update public.customers
  set needs_merge_review = false
  where id = v_canonical.id;

  insert into public.customer_merge_audit (
    org_id,
    canonical_customer_id,
    duplicate_customer_id,
    merge_reason,
    merged_by,
    snapshot
  )
  values (
    v_canonical.org_id,
    v_canonical.id,
    v_duplicate.id,
    coalesce(nullif(trim(p_reason), ''), 'CONFIRMED_NAME_DUPLICATE'),
    v_actor,
    v_snapshot
  )
  on conflict (canonical_customer_id, duplicate_customer_id) do update
    set merge_reason = excluded.merge_reason,
        merged_by = excluded.merged_by,
        merged_at = now(),
        snapshot = excluded.snapshot;

  perform public.append_customer_activity(
    v_canonical.org_id,
    v_canonical.id,
    'FORCED_MERGE',
    'CRM',
    'Forced merge duplicate customer ' || v_duplicate.id::text || ' into canonical record',
    null
  );

  perform public.refresh_customer_metrics(v_canonical.id, null);

  return jsonb_build_object(
    'success', true,
    'org_id', v_canonical.org_id,
    'canonical_customer_id', v_canonical.id,
    'duplicate_customer_id', v_duplicate.id,
    'reason', coalesce(nullif(trim(p_reason), ''), 'CONFIRMED_NAME_DUPLICATE'),
    'forced', true
  );
end;
$$;


--
-- Name: merge_safe_customer_duplicates_by_email(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.merge_safe_customer_duplicates_by_email(p_org_id uuid DEFAULT NULL::uuid, p_dry_run boolean DEFAULT true) RETURNS TABLE(canonical_customer_id uuid, duplicate_customer_id uuid, match_value text, action text, reason text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_row record;
  v_result jsonb;
begin
  for v_row in
    with ranked as (
      select
        c.id,
        c.org_id,
        lower(nullif(trim(c.email), '')) as normalized_email,
        public.normalize_customer_phone(c.phone) as normalized_phone,
        c.birthday,
        nullif(trim(coalesce(c.notes, '')), '') as notes_value,
        nullif(trim(coalesce(c.care_note, '')), '') as care_note_value,
        coalesce(c.total_visits, 0) as total_visits,
        coalesce(c.total_spend, 0) as total_spend,
        c.last_visit_at,
        c.created_at,
        row_number() over (
          partition by c.org_id, lower(nullif(trim(c.email), ''))
          order by coalesce(c.total_visits, 0) desc,
                   coalesce(c.total_spend, 0) desc,
                   c.last_visit_at desc nulls last,
                   c.created_at asc
        ) as rank_in_group,
        count(*) over (
          partition by c.org_id, lower(nullif(trim(c.email), ''))
        ) as group_size
      from public.customers c
      where c.merged_into_customer_id is null
        and lower(nullif(trim(c.email), '')) is not null
        and (p_org_id is null or c.org_id = p_org_id)
    ), paired as (
      select
        winner.org_id,
        winner.normalized_email,
        winner.normalized_phone as winner_phone,
        loser.normalized_phone as loser_phone,
        winner.birthday as winner_birthday,
        loser.birthday as loser_birthday,
        winner.notes_value as winner_notes,
        loser.notes_value as loser_notes,
        winner.care_note_value as winner_care_note,
        loser.care_note_value as loser_care_note,
        winner.total_visits as winner_total_visits,
        loser.total_visits as loser_total_visits,
        winner.total_spend as winner_total_spend,
        loser.total_spend as loser_total_spend,
        winner.id as canonical_customer_id,
        loser.id as duplicate_customer_id
      from ranked winner
      join ranked loser
        on loser.org_id = winner.org_id
       and loser.normalized_email = winner.normalized_email
       and loser.rank_in_group > 1
      where winner.rank_in_group = 1
        and winner.group_size > 1
    )
    select *
    from paired
    where coalesce(loser_total_visits, 0) = 0
      and coalesce(loser_total_spend, 0) = 0
      and not (winner_notes is not null and loser_notes is not null)
      and not (winner_care_note is not null and loser_care_note is not null)
      and not (winner_birthday is not null and loser_birthday is not null and winner_birthday <> loser_birthday)
      and (winner_phone is null or loser_phone is null or winner_phone = loser_phone)
      and not (coalesce(winner_total_visits, 0) > 0 and coalesce(loser_total_visits, 0) > 0)
      and not (coalesce(winner_total_spend, 0) > 0 and coalesce(loser_total_spend, 0) > 0)
  loop
    if p_dry_run then
      canonical_customer_id := v_row.canonical_customer_id;
      duplicate_customer_id := v_row.duplicate_customer_id;
      match_value := v_row.normalized_email;
      action := 'DRY_RUN';
      reason := 'SAFE_EMAIL_DUPLICATE';
      return next;
    else
      v_result := public.merge_customer_records(
        v_row.canonical_customer_id,
        v_row.duplicate_customer_id,
        'SAFE_EMAIL_DUPLICATE'
      );

      canonical_customer_id := (v_result ->> 'canonical_customer_id')::uuid;
      duplicate_customer_id := (v_result ->> 'duplicate_customer_id')::uuid;
      match_value := v_row.normalized_email;
      action := 'MERGED';
      reason := 'SAFE_EMAIL_DUPLICATE';
      return next;
    end if;
  end loop;
end;
$$;


--
-- Name: merge_safe_customer_duplicates_by_phone(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.merge_safe_customer_duplicates_by_phone(p_org_id uuid DEFAULT NULL::uuid, p_dry_run boolean DEFAULT true) RETURNS TABLE(canonical_customer_id uuid, duplicate_customer_id uuid, match_value text, action text, reason text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_row record;
  v_result jsonb;
begin
  for v_row in
    with ranked as (
      select
        c.id,
        c.org_id,
        public.normalize_customer_phone(c.phone) as normalized_phone,
        lower(nullif(trim(c.email), '')) as normalized_email,
        c.birthday,
        nullif(trim(coalesce(c.notes, '')), '') as notes_value,
        nullif(trim(coalesce(c.care_note, '')), '') as care_note_value,
        coalesce(c.total_visits, 0) as total_visits,
        coalesce(c.total_spend, 0) as total_spend,
        c.last_visit_at,
        c.created_at,
        row_number() over (
          partition by c.org_id, public.normalize_customer_phone(c.phone)
          order by coalesce(c.total_visits, 0) desc,
                   coalesce(c.total_spend, 0) desc,
                   c.last_visit_at desc nulls last,
                   c.created_at asc
        ) as rank_in_group,
        count(*) over (
          partition by c.org_id, public.normalize_customer_phone(c.phone)
        ) as group_size
      from public.customers c
      where c.merged_into_customer_id is null
        and public.normalize_customer_phone(c.phone) is not null
        and (p_org_id is null or c.org_id = p_org_id)
    ), paired as (
      select
        winner.org_id,
        winner.normalized_phone,
        winner.normalized_email as winner_email,
        loser.normalized_email as loser_email,
        winner.birthday as winner_birthday,
        loser.birthday as loser_birthday,
        winner.notes_value as winner_notes,
        loser.notes_value as loser_notes,
        winner.care_note_value as winner_care_note,
        loser.care_note_value as loser_care_note,
        winner.total_visits as winner_total_visits,
        loser.total_visits as loser_total_visits,
        winner.total_spend as winner_total_spend,
        loser.total_spend as loser_total_spend,
        winner.id as canonical_customer_id,
        loser.id as duplicate_customer_id
      from ranked winner
      join ranked loser
        on loser.org_id = winner.org_id
       and loser.normalized_phone = winner.normalized_phone
       and loser.rank_in_group > 1
      where winner.rank_in_group = 1
        and winner.group_size > 1
    )
    select *
    from paired
    where coalesce(loser_total_visits, 0) = 0
      and coalesce(loser_total_spend, 0) = 0
      and (winner_email is null or loser_email is null or winner_email = loser_email)
      and not (winner_notes is not null and loser_notes is not null)
      and not (winner_care_note is not null and loser_care_note is not null)
      and not (winner_birthday is not null and loser_birthday is not null and winner_birthday <> loser_birthday)
      and not (coalesce(winner_total_visits, 0) > 0 and coalesce(loser_total_visits, 0) > 0)
      and not (coalesce(winner_total_spend, 0) > 0 and coalesce(loser_total_spend, 0) > 0)
  loop
    if p_dry_run then
      canonical_customer_id := v_row.canonical_customer_id;
      duplicate_customer_id := v_row.duplicate_customer_id;
      match_value := v_row.normalized_phone;
      action := 'DRY_RUN';
      reason := 'SAFE_PHONE_DUPLICATE';
      return next;
    else
      v_result := public.merge_customer_records(
        v_row.canonical_customer_id,
        v_row.duplicate_customer_id,
        'SAFE_PHONE_DUPLICATE'
      );

      canonical_customer_id := (v_result ->> 'canonical_customer_id')::uuid;
      duplicate_customer_id := (v_result ->> 'duplicate_customer_id')::uuid;
      match_value := v_row.normalized_phone;
      action := 'MERGED';
      reason := 'SAFE_PHONE_DUPLICATE';
      return next;
    end if;
  end loop;
end;
$$;


--
-- Name: my_branch_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_branch_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.my_default_branch_id()
$$;


--
-- Name: my_customer_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_customer_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select ca.customer_id
  from public.customer_accounts ca
  where ca.user_id = auth.uid()
  limit 1
$$;


--
-- Name: my_default_branch_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_default_branch_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select p.default_branch_id
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1
$$;


--
-- Name: FUNCTION my_default_branch_id(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.my_default_branch_id() IS 'Default branch selector for UI defaults. Do not use as the primary authorization source.';


--
-- Name: my_org_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_org_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select p.org_id
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1
$$;


--
-- Name: normalize_customer_name_tokens(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_customer_name_tokens(p_value text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  v_value text;
  v_tokens text[];
begin
  v_value := lower(coalesce(p_value, ''));
  v_value := translate(
    v_value,
    'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
  );
  v_value := regexp_replace(v_value, '[^a-z0-9\s]+', ' ', 'g');
  v_value := regexp_replace(v_value, '\s+', ' ', 'g');
  v_value := btrim(v_value);

  if v_value = '' then
    return null;
  end if;

  select array_agg(token order by token)
  into v_tokens
  from unnest(string_to_array(v_value, ' ')) token
  where btrim(token) <> '';

  if coalesce(array_length(v_tokens, 1), 0) = 0 then
    return null;
  end if;

  return array_to_string(v_tokens, ' ');
end;
$$;


--
-- Name: normalize_customer_phone(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_customer_phone(p_phone text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  v_digits text;
begin
  if p_phone is null then
    return null;
  end if;

  v_digits := regexp_replace(p_phone, '\D', '', 'g');

  if v_digits = '' then
    return null;
  end if;

  if left(v_digits, 2) = '84' and length(v_digits) >= 11 then
    return '0' || substr(v_digits, 3);
  end if;

  return v_digits;
end;
$$;


--
-- Name: normalize_user_role_on_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_user_role_on_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_owner_count int;
  v_current_user_id uuid;
  v_invite_insert text;
  v_invite_role text;
begin
  v_current_user_id := auth.uid();
  v_invite_insert := current_setting('app.invite_role_insert', true);
  v_invite_role := current_setting('app.invite_allowed_role', true);

  if v_current_user_id is null then
    return NEW;
  end if;

  select count(*)::int into v_owner_count
  from public.user_roles
  where org_id = NEW.org_id
    and role = 'OWNER';

  if v_owner_count = 0 then
    NEW.role := 'OWNER';
    return NEW;
  end if;

  if v_invite_insert = 'on' and v_invite_role in ('PARTNER','MANAGER','RECEPTION','ACCOUNTANT','TECH') then
    NEW.role := v_invite_role;
    return NEW;
  end if;

  if NEW.user_id = v_current_user_id then
    NEW.role := 'RECEPTION';
    return NEW;
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.org_id = NEW.org_id
      and ur.user_id = v_current_user_id
      and ur.role in ('OWNER', 'PARTNER')
  ) then
    return NEW;
  end if;

  raise exception 'FORBIDDEN_ROLE_INSERT';
end;
$$;


--
-- Name: notify_customer_booking_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_customer_booking_status_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_customer_user_id uuid;
  v_title text;
  v_body text;
  v_effective_start timestamptz;
  v_status text := coalesce(new.status, 'NEW');
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.customer_id is null then
    return new;
  end if;

  if coalesce(old.status, '') = coalesce(new.status, '') and coalesce(old.appointment_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(new.appointment_id, '00000000-0000-0000-0000-000000000000'::uuid) then
    return new;
  end if;

  select ca.user_id
  into v_customer_user_id
  from public.customer_accounts ca
  where ca.customer_id = new.customer_id
    and ca.org_id = new.org_id
  order by ca.created_at asc
  limit 1;

  if v_customer_user_id is null then
    return new;
  end if;

  v_effective_start := coalesce(new.requested_start_at, old.requested_start_at);

  if v_status = 'CONFIRMED' then
    v_title := 'Lịch hẹn đã được xác nhận';
    v_body := 'Tiệm đã xác nhận lịch ' || coalesce(nullif(trim(new.requested_service), ''), 'dịch vụ của bạn') || ' vào ' || to_char(v_effective_start at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI') || '.';
  elsif v_status = 'NEEDS_RESCHEDULE' then
    v_title := 'Lịch hẹn cần đổi giờ';
    v_body := 'Tiệm cần điều chỉnh lịch ' || coalesce(nullif(trim(new.requested_service), ''), 'dịch vụ của bạn') || '. Bạn vui lòng liên hệ trực tiếp với tiệm để được hỗ trợ nhanh nhất.';
  elsif v_status = 'CANCELLED' then
    v_title := 'Lịch hẹn đã bị hủy';
    v_body := 'Lịch ' || coalesce(nullif(trim(new.requested_service), ''), 'dịch vụ của bạn') || ' đã bị hủy. Nếu cần hỗ trợ, bạn vui lòng liên hệ trực tiếp với tiệm.';
  elsif v_status = 'CONVERTED' or (new.appointment_id is not null and old.appointment_id is distinct from new.appointment_id) then
    v_title := 'Lịch hẹn đã được ghi nhận';
    v_body := 'Yêu cầu đặt lịch ' || coalesce(nullif(trim(new.requested_service), ''), 'của bạn') || ' đã được chuyển thành lịch hẹn chính thức.';
  else
    return new;
  end if;

  insert into public.customer_notifications (
    user_id,
    customer_id,
    org_id,
    title,
    body,
    kind,
    related_appointment_id,
    is_read,
    sent_at
  )
  values (
    v_customer_user_id,
    new.customer_id,
    new.org_id,
    v_title,
    v_body,
    'BOOKING',
    new.appointment_id,
    false,
    now()
  );

  return new;
end;
$$;


--
-- Name: notify_customer_membership_tier_upgrade(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_customer_membership_tier_upgrade() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_old_tier record;
  v_new_tier record;
  v_customer_user_id uuid;
  v_title text;
  v_body text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.customer_id is null or new.org_id is null then
    return new;
  end if;

  if coalesce(old.tier_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(new.tier_id, '00000000-0000-0000-0000-000000000000'::uuid) then
    return new;
  end if;

  select id, code, name, coalesce(sort_order, 0) as sort_order
  into v_old_tier
  from public.membership_tiers
  where id = old.tier_id;

  select id, code, name, coalesce(sort_order, 0) as sort_order
  into v_new_tier
  from public.membership_tiers
  where id = new.tier_id;

  if v_new_tier.id is null then
    return new;
  end if;

  -- Only notify on actual upgrade, not downgrade/lateral moves.
  if v_old_tier.id is not null and coalesce(v_new_tier.sort_order, 0) <= coalesce(v_old_tier.sort_order, 0) then
    return new;
  end if;

  select ca.user_id
  into v_customer_user_id
  from public.customer_accounts ca
  where ca.customer_id = new.customer_id
    and ca.org_id = new.org_id
  order by ca.created_at asc
  limit 1;

  v_title := 'Bạn đã lên hạng thành viên';
  v_body := 'Chúc mừng bạn đã lên hạng ' || coalesce(v_new_tier.name, v_new_tier.code, 'mới') || '. Mở mục thành viên để xem quyền lợi mới dành cho bạn.';

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
  values (
    v_customer_user_id,
    new.customer_id,
    new.org_id,
    v_title,
    v_body,
    'MEMBERSHIP',
    false,
    now()
  );

  return new;
end;
$$;


--
-- Name: notify_customers_for_membership_offer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_customers_for_membership_offer() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_package text;
  v_title text;
  v_body text;
begin
  if coalesce(new.is_active, false) is not true then
    return new;
  end if;

  if new.starts_at is not null and new.starts_at > now() then
    return new;
  end if;

  v_package := upper(coalesce(new.offer_metadata ->> 'packageTier', new.offer_metadata ->> 'package_tier', 'REGULAR'));
  if v_package = '' then
    v_package := 'REGULAR';
  end if;

  v_title := 'Ưu đãi mới dành cho hạng thành viên';
  v_body := 'Bạn có ưu đãi mới: ' || coalesce(new.title, 'Ưu đãi thành viên') || '. Mở mục thành viên để xem chi tiết và điều kiện áp dụng.';

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
    ca.user_id,
    cm.customer_id,
    cm.org_id,
    v_title,
    v_body,
    'MEMBERSHIP',
    false,
    now()
  from public.customer_memberships cm
  join public.membership_tiers mt on mt.id = cm.tier_id
  left join public.customer_accounts ca on ca.customer_id = cm.customer_id and ca.org_id = cm.org_id
  where cm.org_id = new.org_id
    and upper(coalesce(mt.code, 'REGULAR')) = v_package
    and not exists (
      select 1
      from public.customer_notifications existing
      where existing.customer_id = cm.customer_id
        and existing.org_id = cm.org_id
        and existing.kind = 'MEMBERSHIP'
        and existing.title = v_title
        and existing.body = v_body
    );

  return new;
end;
$$;


--
-- Name: process_overdue_scheduling_queue(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_overdue_scheduling_queue() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_now timestamptz := now();
  v_no_show_count int := 0;
  v_checkout_warning_count int := 0;
  v_row record;
begin
  -- 1) BOOKED older than 1 hour -> NO_SHOW
  for v_row in
    select a.id, a.org_id, a.branch_id, a.customer_id, a.start_at
    from public.appointments a
    where a.status = 'BOOKED'
      and a.start_at <= (v_now - interval '1 hour')
  loop
    update public.appointments
    set status = 'NO_SHOW',
        overdue_alert_sent_at = coalesce(overdue_alert_sent_at, v_now)
    where id = v_row.id
      and status = 'BOOKED';

    if found then
      v_no_show_count := v_no_show_count + 1;

      perform public.push_admin_notification(
        v_row.org_id,
        v_row.branch_id,
        'Tự động no-show',
        'Lịch hẹn quá 1 giờ chưa check-in đã được tự động chuyển sang no-show.',
        'SCHEDULING_NO_SHOW',
        v_row.id,
        'appointment:no-show:' || v_row.id::text
      );
    end if;
  end loop;

  -- 2) CHECKED_IN older than 4 hours -> warning only once
  for v_row in
    select a.id, a.org_id, a.branch_id, a.customer_id, a.start_at, a.overdue_alert_sent_at
    from public.appointments a
    where a.status = 'CHECKED_IN'
      and coalesce(a.checked_in_at, a.start_at) <= (v_now - interval '4 hours')
      and a.overdue_alert_sent_at is null
  loop
    update public.appointments
    set overdue_alert_sent_at = v_now
    where id = v_row.id
      and status = 'CHECKED_IN'
      and overdue_alert_sent_at is null;

    if found then
      v_checkout_warning_count := v_checkout_warning_count + 1;

      perform public.push_admin_notification(
        v_row.org_id,
        v_row.branch_id,
        'Cảnh báo check-out quá hạn',
        'Có lịch hẹn đang chờ check-out quá 4 giờ. Nhân sự cần kiểm tra lại ngay.',
        'SCHEDULING_CHECKOUT_WARNING',
        v_row.id,
        'appointment:checkout-warning:' || v_row.id::text
      );
    end if;
  end loop;

  return jsonb_build_object(
    'processed_at', v_now,
    'auto_no_show_count', v_no_show_count,
    'checkout_warning_count', v_checkout_warning_count
  );
end;
$$;


--
-- Name: purge_expired_unconfirmed_booking_requests(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_expired_unconfirmed_booking_requests() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_count integer := 0;
begin
  delete from public.booking_requests
  where status = 'EXPIRED_UNCONFIRMED'
    and requested_start_at < now() - interval '3 days';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


--
-- Name: purge_old_admin_notification_states(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_old_admin_notification_states() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_count integer := 0;
begin
  delete from public.admin_notification_states
  where coalesce(resolved_at, acknowledged_at, created_at) < now() - interval '7 days';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


--
-- Name: purge_old_customer_notifications(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_old_customer_notifications() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_count integer := 0;
begin
  delete from public.customer_notifications
  where sent_at < now() - interval '7 days';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


--
-- Name: push_admin_notification(uuid, uuid, text, text, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.push_admin_notification(p_org_id uuid, p_branch_id uuid, p_title text, p_body text, p_kind text DEFAULT 'GENERAL'::text, p_related_appointment_id uuid DEFAULT NULL::uuid, p_notification_key text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_notification_id uuid;
begin
  insert into public.admin_notifications (
    org_id,
    branch_id,
    title,
    body,
    kind,
    related_appointment_id,
    notification_key
  )
  values (
    p_org_id,
    p_branch_id,
    p_title,
    p_body,
    coalesce(nullif(trim(p_kind), ''), 'GENERAL'),
    p_related_appointment_id,
    nullif(trim(coalesce(p_notification_key, '')), '')
  )
  on conflict (notification_key) do update
    set title = excluded.title,
        body = excluded.body,
        kind = excluded.kind,
        related_appointment_id = excluded.related_appointment_id,
        sent_at = now()
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;


--
-- Name: refresh_customer_metrics(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_customer_metrics(p_customer_id uuid DEFAULT NULL::uuid, p_org_id uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_customer record;
  v_updated int := 0;
  v_first_visit timestamptz;
  v_last_visit timestamptz;
  v_total_visits int;
  v_total_spend numeric(12,2);
  v_last_service_summary text;
  v_favorite_staff_user_id uuid;
  v_status text;
  v_next_follow_up_at timestamptz;
begin
  for v_customer in
    select c.id, c.org_id
    from public.customers c
    where (p_customer_id is null or c.id = p_customer_id)
      and (p_org_id is null or c.org_id = p_org_id)
      and c.merged_into_customer_id is null
  loop
    select min(a.start_at), max(a.start_at)
    into v_first_visit, v_last_visit
    from public.appointments a
    where a.customer_id = v_customer.id
      and a.status in ('BOOKED','CHECKED_IN','DONE');

    select
      coalesce(count(*), 0),
      coalesce(sum((t.totals_json->>'grand_total')::numeric), 0)
    into v_total_visits, v_total_spend
    from public.tickets t
    where t.customer_id = v_customer.id
      and t.status = 'CLOSED';

    if v_total_visits = 0 then
      select count(*)
      into v_total_visits
      from public.appointments a
      where a.customer_id = v_customer.id
        and a.status in ('DONE','CHECKED_IN');
    end if;

    select string_agg(distinct s.name, ', ' order by s.name)
    into v_last_service_summary
    from public.tickets t
    join public.ticket_items ti on ti.ticket_id = t.id
    left join public.services s on s.id = ti.service_id
    where t.customer_id = v_customer.id
      and t.status = 'CLOSED'
      and t.created_at = (
        select max(t2.created_at)
        from public.tickets t2
        where t2.customer_id = v_customer.id
          and t2.status = 'CLOSED'
      );

    select a.staff_user_id
    into v_favorite_staff_user_id
    from public.tickets t
    join public.appointments a on a.id = t.appointment_id
    where t.customer_id = v_customer.id
      and t.status = 'CLOSED'
      and a.staff_user_id is not null
    group by a.staff_user_id
    order by count(*) desc, max(t.created_at) desc
    limit 1;

    if v_total_spend >= 3000000 or v_total_visits >= 8 then
      v_status := 'VIP';
    elsif v_last_visit is not null and v_last_visit < now() - interval '60 days' then
      v_status := 'LOST';
    elsif v_last_visit is not null and v_last_visit < now() - interval '30 days' then
      v_status := 'AT_RISK';
    elsif v_total_visits >= 3 then
      v_status := 'RETURNING';
    elsif v_total_visits >= 1 then
      v_status := 'ACTIVE';
    else
      v_status := 'NEW';
    end if;

    if v_last_visit is not null then
      v_next_follow_up_at := v_last_visit + make_interval(days => public.infer_follow_up_days(v_last_service_summary));
    else
      v_next_follow_up_at := null;
    end if;

    update public.customers
    set
      full_name = coalesce(nullif(trim(full_name), ''), name),
      first_visit_at = v_first_visit,
      last_visit_at = v_last_visit,
      total_visits = coalesce(v_total_visits, 0),
      total_spend = coalesce(v_total_spend, 0),
      last_service_summary = v_last_service_summary,
      favorite_staff_user_id = v_favorite_staff_user_id,
      customer_status = v_status,
      next_follow_up_at = case
        when follow_up_status = 'DONE' then next_follow_up_at
        else coalesce(next_follow_up_at, v_next_follow_up_at)
      end
    where id = v_customer.id;

    v_updated := v_updated + 1;
  end loop;

  return v_updated;
end;
$$;


--
-- Name: register_customer_push_device(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_customer_push_device(p_platform text, p_expo_push_token text, p_device_label text DEFAULT NULL::text, p_app_build text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_customer_id uuid;
  v_device_id uuid;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select ca.org_id, ca.customer_id
  into v_org_id, v_customer_id
  from public.customer_accounts ca
  where ca.user_id = v_user_id
  order by ca.created_at asc
  limit 1;

  if v_customer_id is null or v_org_id is null then
    raise exception 'CUSTOMER_ACCOUNT_NOT_FOUND';
  end if;

  insert into public.customer_push_devices (
    user_id,
    customer_id,
    org_id,
    platform,
    expo_push_token,
    device_label,
    app_build,
    last_seen_at
  )
  values (
    v_user_id,
    v_customer_id,
    v_org_id,
    p_platform,
    p_expo_push_token,
    p_device_label,
    p_app_build,
    now()
  )
  on conflict (expo_push_token) do update
    set
      user_id = excluded.user_id,
      customer_id = excluded.customer_id,
      org_id = excluded.org_id,
      platform = excluded.platform,
      device_label = excluded.device_label,
      app_build = excluded.app_build,
      last_seen_at = now()
  returning id into v_device_id;

  return v_device_id;
end;
$$;


--
-- Name: register_device_session(uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_device_session(p_user_id uuid, p_fingerprint text, p_device_info jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_current_user_id uuid := auth.uid();
  v_existing_user_id uuid;
  v_existing_owner_name text;
  v_swapped boolean := false;
begin
  if v_current_user_id is null or v_current_user_id <> p_user_id then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_fingerprint is null or btrim(p_fingerprint) = '' then
    raise exception 'DEVICE_FINGERPRINT_REQUIRED';
  end if;

  perform public.ensure_current_user_profile(p_user_id);

  select
    ds.user_id,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), left(ds.user_id::text, 8))
  into v_existing_user_id, v_existing_owner_name
  from public.device_sessions ds
  left join public.profiles p on p.user_id = ds.user_id
  where ds.device_fingerprint = p_fingerprint
  limit 1;

  if v_existing_user_id is not null and v_existing_user_id <> p_user_id then
    delete from public.app_sessions where user_id = v_existing_user_id;
    delete from public.online_users where user_id = v_existing_user_id;
    delete from public.device_sessions where user_id = v_existing_user_id or device_fingerprint = p_fingerprint;
    v_swapped := true;
  end if;

  delete from public.device_sessions
  where user_id = p_user_id or device_fingerprint = p_fingerprint;

  insert into public.device_sessions (user_id, device_fingerprint, device_info)
  values (p_user_id, p_fingerprint, coalesce(p_device_info, '{}'::jsonb));

  return jsonb_build_object(
    'success', true,
    'swapped', v_swapped,
    'message', case when v_swapped then 'Device session reassigned.' else 'Device session registered.' end
  );
end;
$$;


--
-- Name: release_offer_claim_for_deleted_booking_request(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_offer_claim_for_deleted_booking_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
begin
  update public.customer_offer_claims
  set
    status = 'SAVED',
    booking_request_id = null,
    claimed_at = null
  where booking_request_id = old.id
    and status = 'CLAIMED';

  return old;
end;
$$;


--
-- Name: revoke_all_user_sessions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_all_user_sessions(p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  delete from public.app_sessions where user_id = p_user_id;
  delete from public.online_users where user_id = p_user_id;
  return jsonb_build_object('success', true);
end;
$$;


--
-- Name: revoke_app_session(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_app_session(p_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id
  from public.app_sessions
  where session_token = p_token
  limit 1;

  delete from public.app_sessions where session_token = p_token;

  if v_user_id is not null then
    delete from public.online_users where user_id = v_user_id;
  end if;

  return jsonb_build_object('success', true);
end;
$$;


--
-- Name: revoke_invite_code_secure(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_invite_code_secure(p_invite_id uuid) RETURNS public.invite_codes
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_org_id uuid;
  v_branch_id uuid;
  v_row public.invite_codes;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select p.org_id, p.default_branch_id
  into v_org_id, v_branch_id
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1;

  if v_org_id is null or v_branch_id is null then
    raise exception 'ORG_CONTEXT_REQUIRED';
  end if;

  if not public.has_role('OWNER') then
    raise exception 'FORBIDDEN';
  end if;

  update public.invite_codes
  set revoked_at = now()
  where id = p_invite_id
    and org_id = v_org_id
    and branch_id = v_branch_id
    and revoked_at is null
    and used_count < max_uses
  returning * into v_row;

  if v_row.id is null then
    raise exception 'INVITE_NOT_FOUND_OR_FINALIZED';
  end if;

  return v_row;
end;
$$;


--
-- Name: run_admin_notification_auto_resolve_job(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_admin_notification_auto_resolve_job() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_resolved integer := 0;
begin
  v_resolved := public.auto_resolve_admin_notification_states();

  return jsonb_build_object(
    'ok', true,
    'job', 'admin_notification_auto_resolve',
    'resolved_count', v_resolved,
    'ran_at', now()
  );
end;
$$;


--
-- Name: run_customer_membership_progress_nudges_job(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_customer_membership_progress_nudges_job() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
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


--
-- Name: run_expire_unconfirmed_booking_requests_job(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_expire_unconfirmed_booking_requests_job() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_expired_count integer := 0;
begin
  v_expired_count := public.expire_unconfirmed_booking_requests();

  return jsonb_build_object(
    'ok', true,
    'job', 'expire_unconfirmed_booking_requests',
    'expired_count', v_expired_count,
    'ran_at', now()
  );
end;
$$;


--
-- Name: run_expired_unconfirmed_booking_retention_job(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_expired_unconfirmed_booking_retention_job() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_deleted integer := 0;
begin
  v_deleted := public.purge_expired_unconfirmed_booking_requests();

  return jsonb_build_object(
    'ok', true,
    'job', 'expired_unconfirmed_booking_retention',
    'deleted_count', v_deleted,
    'ran_at', now()
  );
end;
$$;


--
-- Name: run_notification_retention_job(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_notification_retention_job() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_customer_deleted integer := 0;
  v_admin_deleted integer := 0;
begin
  v_customer_deleted := public.purge_old_customer_notifications();
  v_admin_deleted := public.purge_old_admin_notification_states();

  return jsonb_build_object(
    'ok', true,
    'job', 'notification_retention',
    'customer_deleted', v_customer_deleted,
    'admin_deleted', v_admin_deleted,
    'ran_at', now()
  );
end;
$$;


--
-- Name: set_appointment_timestamps(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_appointment_timestamps() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status = 'CHECKED_IN' AND OLD.status != 'CHECKED_IN' THEN
    NEW.checked_in_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: sync_customer_offer_claim_for_booking_request(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_customer_offer_claim_for_booking_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_claim public.customer_offer_claims;
  v_user_id uuid;
  v_linked_status text;
begin
  if tg_op = 'UPDATE'
     and old.customer_id is not null
     and old.offer_id is not null
     and (
       new.customer_id is distinct from old.customer_id
       or new.offer_id is distinct from old.offer_id
     ) then
    update public.customer_offer_claims
    set
      status = 'SAVED',
      booking_request_id = null,
      claimed_at = null
    where customer_id = old.customer_id
      and offer_id = old.offer_id
      and booking_request_id = new.id
      and status = 'CLAIMED';
  end if;

  if new.customer_id is null or new.offer_id is null then
    return new;
  end if;

  select *
  into v_claim
  from public.customer_offer_claims
  where customer_id = new.customer_id
    and offer_id = new.offer_id
  limit 1
  for update;

  if v_claim.id is null then
    select *
    into v_claim
    from public.customer_offer_claims
    where offer_id = new.offer_id
      and user_id in (
        select ca.user_id
        from public.customer_accounts ca
        where ca.customer_id = new.customer_id
          and ca.org_id = new.org_id
      )
    limit 1
    for update;

    if v_claim.id is not null and v_claim.customer_id is null then
      update public.customer_offer_claims
      set customer_id = new.customer_id
      where id = v_claim.id;
    end if;
  end if;

  if v_claim.id is not null
     and v_claim.status = 'CLAIMED'
     and v_claim.booking_request_id is not null
     and v_claim.booking_request_id <> new.id then
    select br.status
    into v_linked_status
    from public.booking_requests br
    where br.id = v_claim.booking_request_id;

    if v_linked_status is null
       or v_linked_status in ('CANCELLED', 'NEEDS_RESCHEDULE', 'EXPIRED_UNCONFIRMED') then
      update public.customer_offer_claims
      set
        status = 'SAVED',
        booking_request_id = null,
        claimed_at = null
      where id = v_claim.id;

      select *
      into v_claim
      from public.customer_offer_claims
      where id = v_claim.id
      limit 1
      for update;
    else
      raise exception 'OFFER_ALREADY_HELD';
    end if;
  end if;

  if v_claim.id is not null
     and v_claim.status = 'USED'
     and coalesce(v_claim.booking_request_id, new.id) <> new.id then
    raise exception 'OFFER_ALREADY_USED';
  end if;

  if new.status in ('CANCELLED', 'NEEDS_RESCHEDULE', 'EXPIRED_UNCONFIRMED') then
    if v_claim.id is not null
       and v_claim.booking_request_id = new.id
       and v_claim.status = 'CLAIMED' then
      update public.customer_offer_claims
      set
        status = 'SAVED',
        booking_request_id = null,
        claimed_at = null
      where id = v_claim.id;
    end if;

    return new;
  end if;

  if v_claim.id is not null and v_claim.user_id is not null then
    v_user_id := v_claim.user_id;
  else
    select ca.user_id
    into v_user_id
    from public.customer_accounts ca
    where ca.customer_id = new.customer_id
      and ca.org_id = new.org_id
    order by ca.created_at asc
    limit 1;
  end if;

  if v_user_id is null then
    raise exception 'OFFER_ACCOUNT_REQUIRED';
  end if;

  if new.status in ('CONFIRMED', 'CONVERTED') then
    if v_claim.id is null then
      insert into public.customer_offer_claims (
        user_id,
        customer_id,
        offer_id,
        org_id,
        status,
        claimed_at,
        used_at,
        booking_request_id
      )
      values (
        v_user_id,
        new.customer_id,
        new.offer_id,
        new.org_id,
        'USED',
        coalesce(new.created_at, now()),
        now(),
        new.id
      );
    else
      update public.customer_offer_claims
      set
        user_id = v_user_id,
        customer_id = new.customer_id,
        org_id = new.org_id,
        status = 'USED',
        booking_request_id = new.id,
        claimed_at = coalesce(v_claim.claimed_at, new.created_at, now()),
        used_at = now()
      where id = v_claim.id;
    end if;

    return new;
  end if;

  if new.status = 'NEW' then
    if v_claim.id is null then
      insert into public.customer_offer_claims (
        user_id,
        customer_id,
        offer_id,
        org_id,
        status,
        claimed_at,
        booking_request_id
      )
      values (
        v_user_id,
        new.customer_id,
        new.offer_id,
        new.org_id,
        'CLAIMED',
        now(),
        new.id
      );
    else
      update public.customer_offer_claims
      set
        user_id = v_user_id,
        customer_id = new.customer_id,
        org_id = new.org_id,
        status = 'CLAIMED',
        booking_request_id = new.id,
        claimed_at = coalesce(v_claim.claimed_at, now()),
        used_at = null
      where id = v_claim.id;
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: tech_check_in_appointment_secure(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tech_check_in_appointment_secure(p_appointment_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
v_org_id uuid;
begin
select org_id into v_org_id
from public.user_roles
where user_id = auth.uid()
limit 1;

if v_org_id is null then
raise exception 'ORG_NOT_FOUND';
end if;

if not exists (
select 1
from public.user_roles ur
where ur.user_id = auth.uid()
and ur.org_id = v_org_id
and ur.role = 'TECH'
) then
raise exception 'FORBIDDEN';
end if;

update public.appointments
set status = 'CHECKED_IN'
where id = p_appointment_id
and org_id = v_org_id
and staff_user_id = auth.uid()
and status = 'BOOKED';

if not found then
raise exception 'APPOINTMENT_NOT_FOUND_OR_NOT_ASSIGNED';
end if;
end;
$$;


--
-- Name: touch_admin_notification_state(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_admin_notification_state(p_org_id uuid, p_notification_key text, p_action text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  insert into public.admin_notification_states (
    org_id,
    notification_key,
    acknowledged_at,
    acknowledged_by,
    resolved_at,
    resolved_by,
    updated_at
  )
  values (
    p_org_id,
    p_notification_key,
    case when p_action in ('ack','resolve') then now() else null end,
    case when p_action in ('ack','resolve') then v_user_id else null end,
    case when p_action = 'resolve' then now() else null end,
    case when p_action = 'resolve' then v_user_id else null end,
    now()
  )
  on conflict (org_id, notification_key)
  do update set
    acknowledged_at = case
      when p_action in ('ack','resolve') then coalesce(public.admin_notification_states.acknowledged_at, now())
      else public.admin_notification_states.acknowledged_at
    end,
    acknowledged_by = case
      when p_action in ('ack','resolve') then coalesce(public.admin_notification_states.acknowledged_by, v_user_id)
      else public.admin_notification_states.acknowledged_by
    end,
    resolved_at = case
      when p_action = 'resolve' then now()
      else public.admin_notification_states.resolved_at
    end,
    resolved_by = case
      when p_action = 'resolve' then v_user_id
      else public.admin_notification_states.resolved_by
    end,
    updated_at = now();
end;
$$;


--
-- Name: touch_device_sessions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_device_sessions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: touch_storefront_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_storefront_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: touch_telegram_conversations_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_telegram_conversations_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: unlink_telegram(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unlink_telegram(p_app_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_current_user_id uuid;
begin
  v_current_user_id := auth.uid();
  if v_current_user_id is null or v_current_user_id <> p_app_user_id then
    raise exception 'Unauthorized';
  end if;

  delete from public.telegram_links where app_user_id = p_app_user_id;
  return jsonb_build_object('success', true);
end;
$$;


--
-- Name: update_customer_care_note(uuid, text, text[], timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_customer_care_note(p_customer_id uuid, p_care_note text, p_tags text[] DEFAULT '{}'::text[], p_next_follow_up_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_follow_up_status text DEFAULT 'PENDING'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_branch_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select c.branch_id
  into v_branch_id
  from public.customers c
  where c.id = p_customer_id
    and c.org_id = public.my_org_id();

  if v_branch_id is null then
    raise exception 'CUSTOMER_NOT_FOUND';
  end if;

  if not public.can_access_crm_branch(v_branch_id) then
    raise exception 'ACCESS_DENIED';
  end if;

  update public.customers
  set
    care_note = p_care_note,
    tags = coalesce(p_tags, '{}'::text[]),
    next_follow_up_at = p_next_follow_up_at,
    follow_up_status = coalesce(p_follow_up_status, 'PENDING'),
    last_contacted_at = now()
  where id = p_customer_id
    and org_id = public.my_org_id()
    and branch_id = v_branch_id;

  perform public.append_customer_activity(
    public.my_org_id(),
    p_customer_id,
    'FOLLOW_UP_NOTE',
    'MANUAL',
    coalesce(nullif(trim(p_care_note), ''), 'Cap nhat ghi chu cham soc'),
    auth.uid()
  );

  return jsonb_build_object('ok', true, 'customer_id', p_customer_id);
end;
$$;


--
-- Name: update_staff_display_name_secure(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_staff_display_name_secure(p_user_id uuid, p_display_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_org_id uuid;
  v_branch_id uuid;
begin
  select org_id, default_branch_id
  into v_org_id, v_branch_id
  from public.profiles
  where user_id = auth.uid()
  limit 1;

  if v_org_id is null then
    raise exception 'ORG_NOT_FOUND';
  end if;

  if not public.has_role('OWNER') then
    raise exception 'FORBIDDEN';
  end if;

  update public.profiles
  set display_name = coalesce(nullif(trim(p_display_name), ''), 'User')
  where user_id = p_user_id
    and org_id = v_org_id
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = p_user_id
        and ur.org_id = v_org_id
        and (
          ur.branch_id is null
          or ur.branch_id = v_branch_id
        )
    );
end;
$$;


--
-- Name: upsert_customer_by_identity(uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_customer_by_identity(p_org_id uuid, p_full_name text, p_phone text DEFAULT NULL::text, p_source text DEFAULT NULL::text, p_care_note text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.upsert_customer_by_identity(
    p_org_id,
    p_full_name,
    p_phone,
    p_source,
    p_care_note,
    public.my_default_branch_id()
  )
$$;


--
-- Name: upsert_customer_by_identity(uuid, text, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_customer_by_identity(p_org_id uuid, p_full_name text, p_phone text DEFAULT NULL::text, p_source text DEFAULT NULL::text, p_care_note text DEFAULT NULL::text, p_branch_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_customer_id uuid;
  v_phone text := public.normalize_customer_phone(p_phone);
  v_branch_id uuid := p_branch_id;
begin
  if p_org_id is null then
    raise exception 'ORG_REQUIRED';
  end if;

  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'CUSTOMER_NAME_REQUIRED';
  end if;

  if v_branch_id is null then
    v_branch_id := public.my_default_branch_id();
  end if;

  if v_branch_id is null then
    select b.id
    into v_branch_id
    from public.branches b
    where b.org_id = p_org_id
    order by b.created_at asc
    limit 1;
  end if;

  if v_branch_id is null then
    raise exception 'BRANCH_REQUIRED';
  end if;

  if v_phone is not null then
    select id
    into v_customer_id
    from public.customers
    where org_id = p_org_id
      and branch_id = v_branch_id
      and public.normalize_customer_phone(phone) = v_phone
      and merged_into_customer_id is null
    order by created_at asc
    limit 1;
  end if;

  if v_customer_id is null then
    select id
    into v_customer_id
    from public.customers
    where org_id = p_org_id
      and branch_id = v_branch_id
      and lower(trim(coalesce(full_name, name))) = lower(trim(p_full_name))
      and merged_into_customer_id is null
    order by created_at asc
    limit 1;
  end if;

  if v_customer_id is null then
    insert into public.customers (
      org_id,
      branch_id,
      name,
      full_name,
      phone,
      notes,
      care_note,
      source
    )
    values (
      p_org_id,
      v_branch_id,
      p_full_name,
      p_full_name,
      v_phone,
      p_care_note,
      p_care_note,
      p_source
    )
    returning id into v_customer_id;
  else
    update public.customers
    set
      full_name = coalesce(nullif(trim(full_name), ''), p_full_name),
      name = coalesce(name, p_full_name),
      phone = coalesce(phone, v_phone),
      source = coalesce(source, p_source),
      care_note = case
        when p_care_note is null or btrim(p_care_note) = '' then care_note
        when care_note is null or btrim(care_note) = '' then p_care_note
        when position(p_care_note in care_note) > 0 then care_note
        else care_note || E'\n' || p_care_note
      end
    where id = v_customer_id;
  end if;

  if v_phone is null then
    update public.customers
    set needs_merge_review = true
    where id = v_customer_id;
  end if;

  return v_customer_id;
end;
$$;


--
-- Name: validate_app_session(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_app_session(p_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_session record;
  v_device_session record;
  v_current_user_id uuid := auth.uid();
begin
  select
    s.id,
    s.user_id,
    s.device_fingerprint,
    s.device_info,
    s.created_at,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), left(s.user_id::text, 8)) as owner_name
  into v_session
  from public.app_sessions s
  left join public.profiles p on p.user_id = s.user_id
  where s.session_token = p_token
    and s.expires_at > now()
  limit 1;

  if v_session.id is null then
    return jsonb_build_object(
      'valid', false,
      'reason', 'INVALID_TOKEN',
      'message', 'Session token is invalid or expired.'
    );
  end if;

  if v_current_user_id is not null and v_session.user_id <> v_current_user_id then
    return jsonb_build_object(
      'valid', false,
      'reason', 'INVALID_TOKEN',
      'message', 'Session token does not belong to the current user.'
    );
  end if;

  if not exists (select 1 from public.online_users where user_id = v_session.user_id) then
    return jsonb_build_object(
      'valid', false,
      'reason', 'SESSION_REPLACED',
      'message', 'Session was replaced by a newer login.'
    );
  end if;

  if v_session.device_fingerprint is not null then
    select *
    into v_device_session
    from public.device_sessions
    where user_id = v_session.user_id
    limit 1;

    if v_device_session.id is null then
      return jsonb_build_object(
        'valid', false,
        'reason', 'SESSION_REPLACED',
        'message', 'Device session is no longer active.'
      );
    end if;

    if v_device_session.device_fingerprint <> v_session.device_fingerprint then
      return jsonb_build_object(
        'valid', false,
        'reason', 'SESSION_REPLACED',
        'message', 'Device session changed after login.'
      );
    end if;
  end if;

  update public.app_sessions
  set expires_at = now() + interval '7 days'
  where id = v_session.id;

  update public.online_users
  set last_heartbeat = now()
  where user_id = v_session.user_id;

  return jsonb_build_object(
    'valid', true,
    'user_id', v_session.user_id,
    'device_fingerprint', v_session.device_fingerprint,
    'device_info', v_session.device_info,
    'owner_name', v_session.owner_name
  );
end;
$$;


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_
        -- Filter by action early - only get subscriptions interested in this action
        -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
        and (subs.action_filter = '*' or subs.action_filter = action::text);

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  res jsonb;
begin
  if type_::text = 'bytea' then
    return to_jsonb(val);
  end if;
  execute format('select to_jsonb(%L::'|| type_::text || ')', val) into res;
  return res;
end
$$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS TABLE(wal jsonb, is_rls_enabled boolean, subscription_ids uuid[], errors text[], slot_changes_count bigint)
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
  WITH pub AS (
    SELECT
      concat_ws(
        ',',
        CASE WHEN bool_or(pubinsert) THEN 'insert' ELSE NULL END,
        CASE WHEN bool_or(pubupdate) THEN 'update' ELSE NULL END,
        CASE WHEN bool_or(pubdelete) THEN 'delete' ELSE NULL END
      ) AS w2j_actions,
      coalesce(
        string_agg(
          realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
          ','
        ) filter (WHERE ppt.tablename IS NOT NULL AND ppt.tablename NOT LIKE '% %'),
        ''
      ) AS w2j_add_tables
    FROM pg_publication pp
    LEFT JOIN pg_publication_tables ppt ON pp.pubname = ppt.pubname
    WHERE pp.pubname = publication
    GROUP BY pp.pubname
    LIMIT 1
  ),
  -- MATERIALIZED ensures pg_logical_slot_get_changes is called exactly once
  w2j AS MATERIALIZED (
    SELECT x.*, pub.w2j_add_tables
    FROM pub,
         pg_logical_slot_get_changes(
           slot_name, null, max_changes,
           'include-pk', 'true',
           'include-transaction', 'false',
           'include-timestamp', 'true',
           'include-type-oids', 'true',
           'format-version', '2',
           'actions', pub.w2j_actions,
           'add-tables', pub.w2j_add_tables
         ) x
  ),
  -- Count raw slot entries before apply_rls/subscription filter
  slot_count AS (
    SELECT count(*)::bigint AS cnt
    FROM w2j
    WHERE w2j.w2j_add_tables <> ''
  ),
  -- Apply RLS and filter as before
  rls_filtered AS (
    SELECT xyz.wal, xyz.is_rls_enabled, xyz.subscription_ids, xyz.errors
    FROM w2j,
         realtime.apply_rls(
           wal := w2j.data::jsonb,
           max_record_bytes := max_record_bytes
         ) xyz(wal, is_rls_enabled, subscription_ids, errors)
    WHERE w2j.w2j_add_tables <> ''
      AND xyz.subscription_ids[1] IS NOT NULL
  )
  -- Real rows with slot count attached
  SELECT rf.wal, rf.is_rls_enabled, rf.subscription_ids, rf.errors, sc.cnt
  FROM rls_filtered rf, slot_count sc

  UNION ALL

  -- Sentinel row: always returned when no real rows exist so Elixir can
  -- always read slot_changes_count. Identified by wal IS NULL.
  SELECT null, null, null, null, sc.cnt
  FROM slot_count sc
  WHERE NOT EXISTS (SELECT 1 FROM rls_filtered)
$$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: allow_any_operation(text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_any_operation(expected_operations text[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


--
-- Name: allow_only_operation(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_only_operation(expected_operation text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


--
-- Name: http_request(); Type: FUNCTION; Schema: supabase_functions; Owner: -
--

CREATE FUNCTION supabase_functions.http_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'supabase_functions'
    AS $$
    DECLARE
      request_id bigint;
      payload jsonb;
      url text := TG_ARGV[0]::text;
      method text := TG_ARGV[1]::text;
      headers jsonb DEFAULT '{}'::jsonb;
      params jsonb DEFAULT '{}'::jsonb;
      timeout_ms integer DEFAULT 1000;
    BEGIN
      IF url IS NULL OR url = 'null' THEN
        RAISE EXCEPTION 'url argument is missing';
      END IF;

      IF method IS NULL OR method = 'null' THEN
        RAISE EXCEPTION 'method argument is missing';
      END IF;

      IF TG_ARGV[2] IS NULL OR TG_ARGV[2] = 'null' THEN
        headers = '{"Content-Type": "application/json"}'::jsonb;
      ELSE
        headers = TG_ARGV[2]::jsonb;
      END IF;

      IF TG_ARGV[3] IS NULL OR TG_ARGV[3] = 'null' THEN
        params = '{}'::jsonb;
      ELSE
        params = TG_ARGV[3]::jsonb;
      END IF;

      IF TG_ARGV[4] IS NULL OR TG_ARGV[4] = 'null' THEN
        timeout_ms = 1000;
      ELSE
        timeout_ms = TG_ARGV[4]::integer;
      END IF;

      CASE
        WHEN method = 'GET' THEN
          SELECT http_get INTO request_id FROM net.http_get(
            url,
            params,
            headers,
            timeout_ms
          );
        WHEN method = 'POST' THEN
          payload = jsonb_build_object(
            'old_record', OLD,
            'record', NEW,
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'schema', TG_TABLE_SCHEMA
          );

          SELECT http_post INTO request_id FROM net.http_post(
            url,
            payload,
            params,
            headers,
            timeout_ms
          );
        ELSE
          RAISE EXCEPTION 'method argument % is invalid', method;
      END CASE;

      INSERT INTO supabase_functions.hooks
        (hook_table_id, hook_name, request_id)
      VALUES
        (TG_RELID, TG_NAME, request_id);

      RETURN NEW;
    END
  $$;


--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    challenge_type text NOT NULL,
    session_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT webauthn_challenges_challenge_type_check CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])))
);


--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id bytea NOT NULL,
    public_key bytea NOT NULL,
    attestation_type text DEFAULT ''::text NOT NULL,
    aaguid uuid,
    sign_count bigint DEFAULT 0 NOT NULL,
    transports jsonb DEFAULT '[]'::jsonb NOT NULL,
    backup_eligible boolean DEFAULT false NOT NULL,
    backed_up boolean DEFAULT false NOT NULL,
    friendly_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: admin_notification_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_notification_states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    notification_key text NOT NULL,
    acknowledged_at timestamp with time zone,
    acknowledged_by uuid,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    branch_id uuid,
    title text NOT NULL,
    body text NOT NULL,
    kind text DEFAULT 'GENERAL'::text NOT NULL,
    related_appointment_id uuid,
    notification_key text,
    is_read boolean DEFAULT false NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone
);


--
-- Name: app_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_token text NOT NULL,
    device_fingerprint text,
    device_info jsonb DEFAULT '{}'::jsonb,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    customer_id uuid,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    staff_user_id uuid,
    resource_id uuid,
    overdue_alert_sent_at timestamp with time zone,
    checked_in_at timestamp with time zone,
    CONSTRAINT appointments_status_check CHECK ((status = ANY (ARRAY['BOOKED'::text, 'CHECKED_IN'::text, 'DONE'::text, 'CANCELLED'::text, 'NO_SHOW'::text])))
);


--
-- Name: booking_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    requested_service text,
    preferred_staff text,
    note text,
    requested_start_at timestamp with time zone NOT NULL,
    requested_end_at timestamp with time zone NOT NULL,
    source text DEFAULT 'landing_page'::text NOT NULL,
    status text DEFAULT 'NEW'::text NOT NULL,
    appointment_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    telegram_message_id bigint,
    telegram_chat_id text,
    notified_at timestamp with time zone,
    customer_id uuid,
    offer_id uuid,
    applied_offer_id uuid,
    applied_offer_claim_id uuid,
    applied_offer_code text,
    CONSTRAINT booking_requests_status_check CHECK ((status = ANY (ARRAY['NEW'::text, 'CONFIRMED'::text, 'NEEDS_RESCHEDULE'::text, 'CANCELLED'::text, 'CONVERTED'::text, 'EXPIRED_UNCONFIRMED'::text])))
);


--
-- Name: checkout_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkout_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    ticket_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    org_id uuid NOT NULL,
    linked_by text DEFAULT 'PHONE_MATCH'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_accounts_linked_by_check CHECK ((linked_by = ANY (ARRAY['MANUAL'::text, 'PHONE_MATCH'::text, 'EMAIL_MATCH'::text, 'ADMIN'::text]))),
    CONSTRAINT customer_accounts_org_match CHECK ((org_id IS NOT NULL))
);


--
-- Name: customer_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    type text NOT NULL,
    channel text,
    content_summary text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_activities_type_check CHECK ((type = ANY (ARRAY['BOOKING_REQUEST'::text, 'APPOINTMENT'::text, 'CHECKOUT'::text, 'FOLLOW_UP_NOTE'::text, 'TELEGRAM_CONTACT'::text])))
);


--
-- Name: customer_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    org_id uuid NOT NULL,
    label text NOT NULL,
    contact_name text,
    contact_phone text,
    address_line_1 text NOT NULL,
    address_line_2 text,
    ward text,
    district text,
    city text,
    postal_code text,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    customer_id uuid NOT NULL
);


--
-- Name: TABLE customer_addresses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.customer_addresses IS 'Deprecated for customer app runtime. Use public.customers.address as source of truth.';


--
-- Name: customer_content_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_content_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    source_platform text DEFAULT 'telegram'::text NOT NULL,
    source_message_id text,
    title text NOT NULL,
    summary text DEFAULT ''::text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    cover_image_url text,
    content_type text DEFAULT 'trend'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    published_at timestamp with time zone,
    priority integer DEFAULT 100 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_content_posts_content_type_check CHECK ((content_type = ANY (ARRAY['trend'::text, 'care'::text, 'news'::text, 'offer_hint'::text]))),
    CONSTRAINT customer_content_posts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    phone text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    full_name text,
    birthday date,
    gender text,
    first_visit_at timestamp with time zone,
    last_visit_at timestamp with time zone,
    total_visits integer DEFAULT 0 NOT NULL,
    total_spend numeric(12,2) DEFAULT 0 NOT NULL,
    last_service_summary text,
    favorite_staff_user_id uuid,
    customer_status text DEFAULT 'NEW'::text NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    care_note text,
    source text,
    next_follow_up_at timestamp with time zone,
    last_contacted_at timestamp with time zone,
    follow_up_status text DEFAULT 'PENDING'::text NOT NULL,
    needs_merge_review boolean DEFAULT false NOT NULL,
    merged_into_customer_id uuid,
    email text,
    address text,
    branch_id uuid NOT NULL
);


--
-- Name: customer_duplicate_candidates; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.customer_duplicate_candidates WITH (security_invoker='on') AS
 WITH base AS (
         SELECT c.id,
            c.org_id,
            COALESCE(NULLIF(TRIM(BOTH FROM c.full_name), ''::text), NULLIF(TRIM(BOTH FROM c.name), ''::text), 'Khách hàng'::text) AS display_name,
            lower(NULLIF(TRIM(BOTH FROM c.email), ''::text)) AS normalized_email,
            public.normalize_customer_phone(c.phone) AS normalized_phone,
            c.created_at,
            c.last_visit_at,
            c.total_visits,
            c.total_spend,
            c.source,
            c.needs_merge_review
           FROM public.customers c
          WHERE (c.merged_into_customer_id IS NULL)
        ), email_groups AS (
         SELECT base.org_id,
            'EMAIL'::text AS match_type,
            base.normalized_email AS match_value,
            array_agg(base.id ORDER BY base.total_visits DESC NULLS LAST, base.total_spend DESC NULLS LAST, base.last_visit_at DESC NULLS LAST, base.created_at) AS customer_ids,
            count(*) AS duplicate_count
           FROM base
          WHERE (base.normalized_email IS NOT NULL)
          GROUP BY base.org_id, base.normalized_email
         HAVING (count(*) > 1)
        ), phone_groups AS (
         SELECT base.org_id,
            'PHONE'::text AS match_type,
            base.normalized_phone AS match_value,
            array_agg(base.id ORDER BY base.total_visits DESC NULLS LAST, base.total_spend DESC NULLS LAST, base.last_visit_at DESC NULLS LAST, base.created_at) AS customer_ids,
            count(*) AS duplicate_count
           FROM base
          WHERE (base.normalized_phone IS NOT NULL)
          GROUP BY base.org_id, base.normalized_phone
         HAVING (count(*) > 1)
        )
 SELECT email_groups.org_id,
    email_groups.match_type,
    email_groups.match_value,
    email_groups.customer_ids,
    email_groups.duplicate_count
   FROM email_groups
UNION ALL
 SELECT phone_groups.org_id,
    phone_groups.match_type,
    phone_groups.match_value,
    phone_groups.customer_ids,
    phone_groups.duplicate_count
   FROM phone_groups;


--
-- Name: customer_favorite_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_favorite_services (
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    service_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    customer_id uuid NOT NULL
);


--
-- Name: customer_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    customer_id uuid NOT NULL,
    org_id uuid NOT NULL,
    tier_id uuid NOT NULL,
    points_balance integer DEFAULT 0 NOT NULL,
    lifetime_points integer DEFAULT 0 NOT NULL,
    total_spent numeric(12,2) DEFAULT 0 NOT NULL,
    total_visits integer DEFAULT 0 NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_merge_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_merge_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    canonical_customer_id uuid NOT NULL,
    duplicate_customer_id uuid NOT NULL,
    merge_reason text NOT NULL,
    merged_by uuid,
    merged_at timestamp with time zone DEFAULT now() NOT NULL,
    snapshot jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: customer_name_duplicate_candidates; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.customer_name_duplicate_candidates WITH (security_invoker='on') AS
 WITH base AS (
         SELECT c.id,
            c.org_id,
            COALESCE(NULLIF(TRIM(BOTH FROM c.full_name), ''::text), NULLIF(TRIM(BOTH FROM c.name), ''::text), 'Khách hàng'::text) AS display_name,
            public.normalize_customer_name_tokens(COALESCE(NULLIF(TRIM(BOTH FROM c.full_name), ''::text), NULLIF(TRIM(BOTH FROM c.name), ''::text))) AS normalized_name,
            lower(NULLIF(TRIM(BOTH FROM c.email), ''::text)) AS normalized_email,
            public.normalize_customer_phone(c.phone) AS normalized_phone,
            c.birthday,
            c.created_at,
            COALESCE(c.total_visits, 0) AS total_visits,
            COALESCE(c.total_spend, (0)::numeric) AS total_spend,
            c.last_visit_at
           FROM public.customers c
          WHERE (c.merged_into_customer_id IS NULL)
        ), grouped AS (
         SELECT base.org_id,
            base.normalized_name,
            array_agg(base.id ORDER BY base.total_visits DESC, base.total_spend DESC, base.last_visit_at DESC NULLS LAST, base.created_at) AS customer_ids,
            count(*) AS duplicate_count
           FROM base
          WHERE (base.normalized_name IS NOT NULL)
          GROUP BY base.org_id, base.normalized_name
         HAVING (count(*) > 1)
        )
 SELECT org_id,
    normalized_name AS match_value,
    duplicate_count,
    customer_ids[1] AS canonical_customer_id,
        CASE
            WHEN (COALESCE(array_length(customer_ids, 1), 0) <= 1) THEN '{}'::uuid[]
            ELSE customer_ids[2:array_length(customer_ids, 1)]
        END AS duplicate_customer_ids
   FROM grouped g;


--
-- Name: customer_notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_notification_preferences (
    user_id uuid,
    org_id uuid NOT NULL,
    push_enabled boolean DEFAULT true NOT NULL,
    sound_enabled boolean DEFAULT true NOT NULL,
    vibration_enabled boolean DEFAULT false NOT NULL,
    dark_mode_enabled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    customer_id uuid NOT NULL,
    language text DEFAULT 'vi'::text NOT NULL
);


--
-- Name: customer_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    org_id uuid NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    kind text DEFAULT 'GENERAL'::text NOT NULL,
    related_offer_id uuid,
    related_appointment_id uuid,
    is_read boolean DEFAULT false NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone,
    customer_id uuid NOT NULL,
    push_last_sent_at timestamp with time zone,
    push_last_error text,
    push_delivery_state text DEFAULT 'PENDING'::text NOT NULL,
    CONSTRAINT customer_notifications_kind_check CHECK ((kind = ANY (ARRAY['GENERAL'::text, 'BOOKING'::text, 'PROMOTION'::text, 'MEMBERSHIP'::text, 'PAYMENT'::text]))),
    CONSTRAINT customer_notifications_push_delivery_state_check CHECK ((push_delivery_state = ANY (ARRAY['PENDING'::text, 'SENT'::text, 'FAILED'::text, 'SKIPPED'::text])))
);


--
-- Name: customer_offer_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_offer_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    offer_id uuid NOT NULL,
    org_id uuid NOT NULL,
    status text DEFAULT 'SAVED'::text NOT NULL,
    claimed_at timestamp with time zone,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    customer_id uuid NOT NULL,
    booking_request_id uuid,
    reservation_expires_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    CONSTRAINT customer_offer_claims_status_check CHECK ((status = ANY (ARRAY['SAVED'::text, 'CLAIMED'::text, 'USED'::text, 'EXPIRED'::text, 'CANCELLED'::text])))
);


--
-- Name: customer_payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_payment_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    org_id uuid NOT NULL,
    provider text NOT NULL,
    label text NOT NULL,
    masked_value text,
    holder_name text,
    expires_at date,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    customer_id uuid NOT NULL,
    CONSTRAINT customer_payment_methods_provider_check CHECK ((provider = ANY (ARRAY['CASH'::text, 'BANK_TRANSFER'::text, 'MOMO'::text, 'ZALOPAY'::text, 'VNPAY'::text, 'CARD'::text])))
);


--
-- Name: customer_push_delivery_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_push_delivery_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    notification_id uuid NOT NULL,
    push_device_id uuid,
    expo_push_token text,
    status text NOT NULL,
    response_payload jsonb,
    error_message text,
    attempted_at timestamp with time zone DEFAULT now() NOT NULL,
    delivered_at timestamp with time zone,
    CONSTRAINT customer_push_delivery_logs_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'SENT'::text, 'FAILED'::text, 'SKIPPED'::text])))
);


--
-- Name: customer_push_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_push_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    customer_id uuid NOT NULL,
    org_id uuid NOT NULL,
    platform text NOT NULL,
    expo_push_token text NOT NULL,
    device_label text,
    app_build text,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_service_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_service_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    customer_id uuid,
    org_id uuid NOT NULL,
    appointment_id uuid,
    service_id uuid,
    rating integer NOT NULL,
    title text,
    content text,
    is_public boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_service_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: device_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    device_fingerprint text NOT NULL,
    device_info jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    last_active_at timestamp with time zone DEFAULT now()
);


--
-- Name: marketing_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    image_url text,
    badge text,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    offer_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: membership_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.membership_tiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    spending_threshold numeric(12,2) DEFAULT 0 NOT NULL,
    visit_threshold integer DEFAULT 0 NOT NULL,
    accent_color text,
    perks jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    gradient_from text,
    gradient_to text,
    badge_icon text,
    theme_key text,
    visit_min_spend numeric DEFAULT 300000 NOT NULL
);


--
-- Name: online_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.online_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    device_fingerprint text,
    device_info jsonb DEFAULT '{}'::jsonb,
    last_heartbeat timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: orgs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orgs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    ticket_id uuid NOT NULL,
    method text NOT NULL,
    amount numeric(12,2) NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_method_check CHECK ((method = ANY (ARRAY['CASH'::text, 'TRANSFER'::text]))),
    CONSTRAINT payments_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'PAID'::text, 'FAILED'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    default_branch_id uuid,
    display_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    phone text,
    email text,
    birth_date date,
    address text,
    avatar_url text,
    marketing_opt_in boolean DEFAULT false NOT NULL,
    push_opt_in boolean DEFAULT true NOT NULL,
    language text DEFAULT 'vi'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profiles_language_check CHECK ((language = ANY (ARRAY['vi'::text, 'en'::text])))
);


--
-- Name: receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    ticket_id uuid NOT NULL,
    public_token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'CHAIR'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT resources_type_check CHECK ((type = ANY (ARRAY['CHAIR'::text, 'TABLE'::text, 'ROOM'::text])))
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    duration_min integer NOT NULL,
    base_price numeric(12,2) NOT NULL,
    vat_rate numeric(5,4) DEFAULT 0.10 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    short_description text,
    image_url text,
    featured_in_lookbook boolean DEFAULT false NOT NULL,
    featured_in_home boolean DEFAULT false NOT NULL,
    featured_in_explore boolean DEFAULT false NOT NULL,
    lookbook_category text,
    lookbook_badge text,
    lookbook_tone text,
    duration_label text,
    display_order_home integer DEFAULT 0 NOT NULL,
    display_order_explore integer DEFAULT 0 NOT NULL,
    branch_id uuid NOT NULL
);


--
-- Name: shift_leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_leave_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    staff_user_id uuid NOT NULL,
    request_type text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    scheduled_date date,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    requested_end_at timestamp with time zone,
    note text,
    owner_note text,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    time_entry_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    branch_id uuid NOT NULL,
    CONSTRAINT shift_leave_requests_request_type_check CHECK ((request_type = ANY (ARRAY['DAY_OFF'::text, 'EARLY_LEAVE'::text]))),
    CONSTRAINT shift_leave_requests_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text])))
);


--
-- Name: shift_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    week_start date NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    assignments_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    demands_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    forecast_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    employee_summaries_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    day_summaries_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    conflicts_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    suggestions_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    published_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shift_plans_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))
);


--
-- Name: staff_shift_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_shift_profiles (
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    staff_role text NOT NULL,
    skills_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    availability_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    leave_dates_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    max_weekly_hours integer DEFAULT 40 NOT NULL,
    fairness_offset_hours integer DEFAULT 0 NOT NULL,
    performance_score integer DEFAULT 7 NOT NULL,
    notes_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staff_shift_profiles_fairness_offset_hours_check CHECK (((fairness_offset_hours >= 0) AND (fairness_offset_hours <= 24))),
    CONSTRAINT staff_shift_profiles_max_weekly_hours_check CHECK (((max_weekly_hours >= 0) AND (max_weekly_hours <= 84))),
    CONSTRAINT staff_shift_profiles_performance_score_check CHECK (((performance_score >= 1) AND (performance_score <= 10))),
    CONSTRAINT staff_shift_profiles_staff_role_check CHECK ((staff_role = ANY (ARRAY['MANAGER'::text, 'RECEPTION'::text, 'TECH'::text, 'ACCOUNTANT'::text])))
);


--
-- Name: storefront_gallery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storefront_gallery (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    storefront_id uuid NOT NULL,
    title text,
    image_url text NOT NULL,
    kind text,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: storefront_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storefront_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    storefront_id uuid NOT NULL,
    name text NOT NULL,
    subtitle text,
    price_label text,
    image_url text,
    product_type text,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: storefront_profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storefront_profile (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    branch_id uuid,
    slug text NOT NULL,
    name text NOT NULL,
    category text,
    description text,
    cover_image_url text,
    logo_image_url text,
    rating numeric(3,2),
    reviews_label text,
    address_line text,
    map_url text,
    opening_hours text,
    phone text,
    messenger_url text,
    instagram_url text,
    highlights jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: storefront_team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storefront_team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    storefront_id uuid NOT NULL,
    profile_id uuid,
    display_name text NOT NULL,
    role_label text,
    avatar_url text,
    bio text,
    display_order integer DEFAULT 0 NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: telegram_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telegram_conversations (
    telegram_user_id bigint NOT NULL,
    step text NOT NULL,
    data_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: telegram_link_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telegram_link_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_user_id uuid NOT NULL,
    code text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: telegram_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telegram_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_user_id uuid NOT NULL,
    telegram_user_id bigint NOT NULL,
    telegram_username text,
    telegram_first_name text,
    verified_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    telegram_last_name text,
    linked_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ticket_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    ticket_id uuid NOT NULL,
    service_id uuid,
    qty integer DEFAULT 1 NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    vat_rate numeric(5,4) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    customer_id uuid,
    appointment_id uuid,
    status text DEFAULT 'OPEN'::text NOT NULL,
    totals_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tickets_status_check CHECK ((status = ANY (ARRAY['OPEN'::text, 'CLOSED'::text, 'VOID'::text])))
);


--
-- Name: time_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.time_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    staff_user_id uuid NOT NULL,
    clock_in timestamp with time zone NOT NULL,
    clock_out timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    effective_clock_in timestamp with time zone,
    effective_clock_out timestamp with time zone,
    scheduled_date date,
    scheduled_week_start date,
    scheduled_shift_type text,
    scheduled_shift_label text,
    scheduled_start timestamp with time zone,
    scheduled_end timestamp with time zone,
    approval_status text DEFAULT 'PENDING'::text NOT NULL,
    approval_note text,
    approved_by uuid,
    approved_at timestamp with time zone,
    auto_closed boolean DEFAULT false NOT NULL,
    branch_id uuid NOT NULL,
    CONSTRAINT time_entries_approval_status_check CHECK ((approval_status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text]))),
    CONSTRAINT time_entries_scheduled_shift_type_check CHECK ((scheduled_shift_type = ANY (ARRAY['MORNING'::text, 'AFTERNOON'::text, 'FULL_DAY'::text, 'OFF'::text])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    role text NOT NULL,
    branch_id uuid,
    CONSTRAINT user_roles_partner_requires_branch CHECK (((role <> 'PARTNER'::text) OR (branch_id IS NOT NULL))),
    CONSTRAINT user_roles_role_check CHECK ((role = ANY (ARRAY['USER'::text, 'OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text, 'ACCOUNTANT'::text, 'TECH'::text])))
);


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


--
-- Name: messages_2026_03_08; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_03_08 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_03_09; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_03_09 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_03_10; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_03_10 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_03_11; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_03_11 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_03_12; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_03_12 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    action_filter text DEFAULT '*'::text,
    CONSTRAINT subscription_action_filter_check CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb,
    metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hooks; Type: TABLE; Schema: supabase_functions; Owner: -
--

CREATE TABLE supabase_functions.hooks (
    id bigint NOT NULL,
    hook_table_id integer NOT NULL,
    hook_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id bigint
);


--
-- Name: TABLE hooks; Type: COMMENT; Schema: supabase_functions; Owner: -
--

COMMENT ON TABLE supabase_functions.hooks IS 'Supabase Functions Hooks: Audit trail for triggered hooks.';


--
-- Name: hooks_id_seq; Type: SEQUENCE; Schema: supabase_functions; Owner: -
--

CREATE SEQUENCE supabase_functions.hooks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hooks_id_seq; Type: SEQUENCE OWNED BY; Schema: supabase_functions; Owner: -
--

ALTER SEQUENCE supabase_functions.hooks_id_seq OWNED BY supabase_functions.hooks.id;


--
-- Name: migrations; Type: TABLE; Schema: supabase_functions; Owner: -
--

CREATE TABLE supabase_functions.migrations (
    version text NOT NULL,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text
);


--
-- Name: messages_2026_03_08; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_03_08 FOR VALUES FROM ('2026-03-08 00:00:00') TO ('2026-03-09 00:00:00');


--
-- Name: messages_2026_03_09; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_03_09 FOR VALUES FROM ('2026-03-09 00:00:00') TO ('2026-03-10 00:00:00');


--
-- Name: messages_2026_03_10; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_03_10 FOR VALUES FROM ('2026-03-10 00:00:00') TO ('2026-03-11 00:00:00');


--
-- Name: messages_2026_03_11; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_03_11 FOR VALUES FROM ('2026-03-11 00:00:00') TO ('2026-03-12 00:00:00');


--
-- Name: messages_2026_03_12; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_03_12 FOR VALUES FROM ('2026-03-12 00:00:00') TO ('2026-03-13 00:00:00');


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: hooks id; Type: DEFAULT; Schema: supabase_functions; Owner: -
--

ALTER TABLE ONLY supabase_functions.hooks ALTER COLUMN id SET DEFAULT nextval('supabase_functions.hooks_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


--
-- Name: admin_notification_states admin_notification_states_org_id_notification_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notification_states
    ADD CONSTRAINT admin_notification_states_org_id_notification_key_key UNIQUE (org_id, notification_key);


--
-- Name: admin_notification_states admin_notification_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notification_states
    ADD CONSTRAINT admin_notification_states_pkey PRIMARY KEY (id);


--
-- Name: admin_notifications admin_notifications_notification_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT admin_notifications_notification_key_key UNIQUE (notification_key);


--
-- Name: admin_notifications admin_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT admin_notifications_pkey PRIMARY KEY (id);


--
-- Name: app_sessions app_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_sessions
    ADD CONSTRAINT app_sessions_pkey PRIMARY KEY (id);


--
-- Name: app_sessions app_sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_sessions
    ADD CONSTRAINT app_sessions_session_token_key UNIQUE (session_token);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: booking_requests booking_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_pkey PRIMARY KEY (id);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: checkout_requests checkout_requests_org_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_requests
    ADD CONSTRAINT checkout_requests_org_id_idempotency_key_key UNIQUE (org_id, idempotency_key);


--
-- Name: checkout_requests checkout_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_requests
    ADD CONSTRAINT checkout_requests_pkey PRIMARY KEY (id);


--
-- Name: customer_accounts customer_accounts_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_accounts
    ADD CONSTRAINT customer_accounts_customer_id_key UNIQUE (customer_id);


--
-- Name: customer_accounts customer_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_accounts
    ADD CONSTRAINT customer_accounts_pkey PRIMARY KEY (id);


--
-- Name: customer_accounts customer_accounts_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_accounts
    ADD CONSTRAINT customer_accounts_user_id_key UNIQUE (user_id);


--
-- Name: customer_activities customer_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_activities
    ADD CONSTRAINT customer_activities_pkey PRIMARY KEY (id);


--
-- Name: customer_addresses customer_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_pkey PRIMARY KEY (id);


--
-- Name: customer_content_posts customer_content_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_content_posts
    ADD CONSTRAINT customer_content_posts_pkey PRIMARY KEY (id);


--
-- Name: customer_favorite_services customer_favorite_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_favorite_services
    ADD CONSTRAINT customer_favorite_services_pkey PRIMARY KEY (customer_id, service_id);


--
-- Name: customer_memberships customer_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_memberships
    ADD CONSTRAINT customer_memberships_pkey PRIMARY KEY (id);


--
-- Name: customer_merge_audit customer_merge_audit_pair_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_merge_audit
    ADD CONSTRAINT customer_merge_audit_pair_unique UNIQUE (canonical_customer_id, duplicate_customer_id);


--
-- Name: customer_merge_audit customer_merge_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_merge_audit
    ADD CONSTRAINT customer_merge_audit_pkey PRIMARY KEY (id);


--
-- Name: customer_notification_preferences customer_notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_notification_preferences
    ADD CONSTRAINT customer_notification_preferences_pkey PRIMARY KEY (customer_id);


--
-- Name: customer_notifications customer_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_notifications
    ADD CONSTRAINT customer_notifications_pkey PRIMARY KEY (id);


--
-- Name: customer_offer_claims customer_offer_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_offer_claims
    ADD CONSTRAINT customer_offer_claims_pkey PRIMARY KEY (id);


--
-- Name: customer_payment_methods customer_payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payment_methods
    ADD CONSTRAINT customer_payment_methods_pkey PRIMARY KEY (id);


--
-- Name: customer_push_delivery_logs customer_push_delivery_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_push_delivery_logs
    ADD CONSTRAINT customer_push_delivery_logs_pkey PRIMARY KEY (id);


--
-- Name: customer_push_devices customer_push_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_push_devices
    ADD CONSTRAINT customer_push_devices_pkey PRIMARY KEY (id);


--
-- Name: customer_service_reviews customer_service_reviews_appointment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_service_reviews
    ADD CONSTRAINT customer_service_reviews_appointment_id_key UNIQUE (appointment_id);


--
-- Name: customer_service_reviews customer_service_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_service_reviews
    ADD CONSTRAINT customer_service_reviews_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: device_sessions device_sessions_device_fingerprint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_sessions
    ADD CONSTRAINT device_sessions_device_fingerprint_key UNIQUE (device_fingerprint);


--
-- Name: device_sessions device_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_sessions
    ADD CONSTRAINT device_sessions_pkey PRIMARY KEY (id);


--
-- Name: device_sessions device_sessions_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_sessions
    ADD CONSTRAINT device_sessions_user_id_key UNIQUE (user_id);


--
-- Name: invite_codes invite_codes_org_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT invite_codes_org_id_code_key UNIQUE (org_id, code);


--
-- Name: invite_codes invite_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT invite_codes_pkey PRIMARY KEY (id);


--
-- Name: marketing_offers marketing_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_offers
    ADD CONSTRAINT marketing_offers_pkey PRIMARY KEY (id);


--
-- Name: membership_tiers membership_tiers_org_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership_tiers
    ADD CONSTRAINT membership_tiers_org_id_code_key UNIQUE (org_id, code);


--
-- Name: membership_tiers membership_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership_tiers
    ADD CONSTRAINT membership_tiers_pkey PRIMARY KEY (id);


--
-- Name: online_users online_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.online_users
    ADD CONSTRAINT online_users_pkey PRIMARY KEY (id);


--
-- Name: online_users online_users_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.online_users
    ADD CONSTRAINT online_users_user_id_key UNIQUE (user_id);


--
-- Name: orgs orgs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orgs
    ADD CONSTRAINT orgs_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_id);


--
-- Name: receipts receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_pkey PRIMARY KEY (id);


--
-- Name: receipts receipts_public_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_public_token_key UNIQUE (public_token);


--
-- Name: resources resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: shift_leave_requests shift_leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_leave_requests
    ADD CONSTRAINT shift_leave_requests_pkey PRIMARY KEY (id);


--
-- Name: shift_plans shift_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_plans
    ADD CONSTRAINT shift_plans_pkey PRIMARY KEY (id);


--
-- Name: staff_shift_profiles staff_shift_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_shift_profiles
    ADD CONSTRAINT staff_shift_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: storefront_gallery storefront_gallery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_gallery
    ADD CONSTRAINT storefront_gallery_pkey PRIMARY KEY (id);


--
-- Name: storefront_products storefront_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_products
    ADD CONSTRAINT storefront_products_pkey PRIMARY KEY (id);


--
-- Name: storefront_profile storefront_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_profile
    ADD CONSTRAINT storefront_profile_pkey PRIMARY KEY (id);


--
-- Name: storefront_team_members storefront_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_team_members
    ADD CONSTRAINT storefront_team_members_pkey PRIMARY KEY (id);


--
-- Name: telegram_conversations telegram_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_conversations
    ADD CONSTRAINT telegram_conversations_pkey PRIMARY KEY (telegram_user_id);


--
-- Name: telegram_link_codes telegram_link_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_link_codes
    ADD CONSTRAINT telegram_link_codes_pkey PRIMARY KEY (id);


--
-- Name: telegram_links telegram_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_links
    ADD CONSTRAINT telegram_links_pkey PRIMARY KEY (id);


--
-- Name: ticket_items ticket_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_items
    ADD CONSTRAINT ticket_items_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: time_entries time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_pkey PRIMARY KEY (id);


--
-- Name: customer_accounts unique_user_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_accounts
    ADD CONSTRAINT unique_user_id UNIQUE (user_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_03_08 messages_2026_03_08_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_03_08
    ADD CONSTRAINT messages_2026_03_08_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_03_09 messages_2026_03_09_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_03_09
    ADD CONSTRAINT messages_2026_03_09_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_03_10 messages_2026_03_10_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_03_10
    ADD CONSTRAINT messages_2026_03_10_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_03_11 messages_2026_03_11_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_03_11
    ADD CONSTRAINT messages_2026_03_11_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_03_12 messages_2026_03_12_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_03_12
    ADD CONSTRAINT messages_2026_03_12_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: hooks hooks_pkey; Type: CONSTRAINT; Schema: supabase_functions; Owner: -
--

ALTER TABLE ONLY supabase_functions.hooks
    ADD CONSTRAINT hooks_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: supabase_functions; Owner: -
--

ALTER TABLE ONLY supabase_functions.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (version);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: idx_users_created_at_desc; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_created_at_desc ON auth.users USING btree (created_at DESC);


--
-- Name: idx_users_email; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_email ON auth.users USING btree (email);


--
-- Name: idx_users_last_sign_in_at_desc; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_last_sign_in_at_desc ON auth.users USING btree (last_sign_in_at DESC);


--
-- Name: idx_users_name; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_name ON auth.users USING btree (((raw_user_meta_data ->> 'name'::text))) WHERE ((raw_user_meta_data ->> 'name'::text) IS NOT NULL);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at);


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id);


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id);


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id);


--
-- Name: customers_org_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_org_email_idx ON public.customers USING btree (org_id, lower(email)) WHERE (email IS NOT NULL);


--
-- Name: customers_org_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customers_org_email_unique ON public.customers USING btree (org_id, lower(email)) WHERE (email IS NOT NULL);


--
-- Name: idx_admin_notification_states_org_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_notification_states_org_key ON public.admin_notification_states USING btree (org_id, notification_key);


--
-- Name: idx_admin_notifications_appointment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_notifications_appointment ON public.admin_notifications USING btree (related_appointment_id, sent_at DESC);


--
-- Name: idx_admin_notifications_org_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_notifications_org_sent ON public.admin_notifications USING btree (org_id, is_read, sent_at DESC);


--
-- Name: idx_app_sessions_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_sessions_expires ON public.app_sessions USING btree (expires_at);


--
-- Name: idx_app_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_sessions_token ON public.app_sessions USING btree (session_token);


--
-- Name: idx_app_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_sessions_user ON public.app_sessions USING btree (user_id);


--
-- Name: idx_appointments_checked_in_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_checked_in_at ON public.appointments USING btree (org_id, checked_in_at) WHERE (checked_in_at IS NOT NULL);


--
-- Name: idx_appointments_org_start_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_org_start_at ON public.appointments USING btree (org_id, start_at);


--
-- Name: idx_appointments_org_status_overdue_alert; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_org_status_overdue_alert ON public.appointments USING btree (org_id, status, overdue_alert_sent_at, start_at);


--
-- Name: idx_appointments_org_status_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_org_status_start ON public.appointments USING btree (org_id, status, start_at);


--
-- Name: idx_appointments_overdue_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_overdue_queue ON public.appointments USING btree (org_id, status, overdue_alert_sent_at, start_at);


--
-- Name: idx_booking_requests_offer_claim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_offer_claim ON public.booking_requests USING btree (applied_offer_claim_id) WHERE (applied_offer_claim_id IS NOT NULL);


--
-- Name: idx_booking_requests_offer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_offer_id ON public.booking_requests USING btree (offer_id) WHERE (offer_id IS NOT NULL);


--
-- Name: idx_booking_requests_org_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_org_created_at ON public.booking_requests USING btree (org_id, created_at DESC);


--
-- Name: idx_booking_requests_org_customer_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_org_customer_created ON public.booking_requests USING btree (org_id, customer_id, created_at DESC);


--
-- Name: idx_booking_requests_org_status_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_org_status_start ON public.booking_requests USING btree (org_id, status, requested_start_at);


--
-- Name: idx_customer_accounts_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_accounts_customer_id ON public.customer_accounts USING btree (customer_id);


--
-- Name: idx_customer_accounts_org_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_accounts_org_customer ON public.customer_accounts USING btree (org_id, customer_id);


--
-- Name: idx_customer_accounts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_accounts_user_id ON public.customer_accounts USING btree (user_id);


--
-- Name: idx_customer_activities_customer_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_activities_customer_created ON public.customer_activities USING btree (customer_id, created_at DESC);


--
-- Name: idx_customer_addresses_customer_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_addresses_customer_default ON public.customer_addresses USING btree (customer_id, is_default DESC, created_at DESC);


--
-- Name: idx_customer_addresses_user_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_addresses_user_default ON public.customer_addresses USING btree (user_id, is_default DESC, created_at DESC);


--
-- Name: idx_customer_content_posts_org_status_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_content_posts_org_status_published ON public.customer_content_posts USING btree (org_id, status, priority, published_at DESC NULLS LAST);


--
-- Name: idx_customer_content_posts_source_message; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_customer_content_posts_source_message ON public.customer_content_posts USING btree (source_platform, source_message_id) WHERE (source_message_id IS NOT NULL);


--
-- Name: idx_customer_favorite_services_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_favorite_services_customer ON public.customer_favorite_services USING btree (customer_id, created_at DESC);


--
-- Name: idx_customer_favorite_services_customer_service_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_customer_favorite_services_customer_service_unique ON public.customer_favorite_services USING btree (customer_id, service_id);


--
-- Name: idx_customer_favorite_services_org_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_favorite_services_org_service ON public.customer_favorite_services USING btree (org_id, service_id);


--
-- Name: idx_customer_favorite_services_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_favorite_services_user_id ON public.customer_favorite_services USING btree (user_id);


--
-- Name: idx_customer_memberships_customer_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_customer_memberships_customer_unique ON public.customer_memberships USING btree (customer_id) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_customer_memberships_org_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_memberships_org_tier ON public.customer_memberships USING btree (org_id, tier_id);


--
-- Name: idx_customer_merge_audit_org_merged_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_merge_audit_org_merged_at ON public.customer_merge_audit USING btree (org_id, merged_at DESC);


--
-- Name: idx_customer_notification_preferences_customer_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_customer_notification_preferences_customer_unique ON public.customer_notification_preferences USING btree (customer_id) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_customer_notifications_customer_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_notifications_customer_sent ON public.customer_notifications USING btree (customer_id, is_read, sent_at DESC);


--
-- Name: idx_customer_notifications_push_delivery_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_notifications_push_delivery_state ON public.customer_notifications USING btree (push_delivery_state, sent_at DESC);


--
-- Name: idx_customer_notifications_user_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_notifications_user_sent ON public.customer_notifications USING btree (user_id, is_read, sent_at DESC);


--
-- Name: idx_customer_offer_claims_booking_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_offer_claims_booking_request ON public.customer_offer_claims USING btree (booking_request_id) WHERE (booking_request_id IS NOT NULL);


--
-- Name: idx_customer_offer_claims_booking_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_offer_claims_booking_request_id ON public.customer_offer_claims USING btree (booking_request_id) WHERE (booking_request_id IS NOT NULL);


--
-- Name: idx_customer_offer_claims_customer_offer_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_customer_offer_claims_customer_offer_unique ON public.customer_offer_claims USING btree (customer_id, offer_id) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_customer_offer_claims_user_offer_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_offer_claims_user_offer_status ON public.customer_offer_claims USING btree (user_id, offer_id, status);


--
-- Name: idx_customer_payment_methods_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_payment_methods_customer ON public.customer_payment_methods USING btree (customer_id, is_default DESC, created_at DESC);


--
-- Name: idx_customer_payment_methods_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_payment_methods_user ON public.customer_payment_methods USING btree (user_id, is_default DESC, created_at DESC);


--
-- Name: idx_customer_push_delivery_logs_notification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_push_delivery_logs_notification ON public.customer_push_delivery_logs USING btree (notification_id, attempted_at DESC);


--
-- Name: idx_customer_push_devices_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_push_devices_customer ON public.customer_push_devices USING btree (customer_id, last_seen_at DESC);


--
-- Name: idx_customer_push_devices_unique_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_customer_push_devices_unique_token ON public.customer_push_devices USING btree (expo_push_token);


--
-- Name: idx_customer_service_reviews_customer_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_service_reviews_customer_created ON public.customer_service_reviews USING btree (customer_id, created_at DESC);


--
-- Name: idx_customer_service_reviews_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_service_reviews_user_created ON public.customer_service_reviews USING btree (user_id, created_at DESC);


--
-- Name: idx_customers_org_branch_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_org_branch_created ON public.customers USING btree (org_id, branch_id, created_at DESC);


--
-- Name: idx_customers_org_branch_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_org_branch_phone ON public.customers USING btree (org_id, branch_id, phone);


--
-- Name: idx_customers_org_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_customers_org_email_unique ON public.customers USING btree (org_id, lower(email)) WHERE ((email IS NOT NULL) AND (merged_into_customer_id IS NULL));


--
-- Name: idx_customers_org_follow_up; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_org_follow_up ON public.customers USING btree (org_id, next_follow_up_at) WHERE (next_follow_up_at IS NOT NULL);


--
-- Name: idx_customers_org_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_org_phone ON public.customers USING btree (org_id, phone);


--
-- Name: idx_customers_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_org_status ON public.customers USING btree (org_id, customer_status, last_visit_at DESC);


--
-- Name: idx_device_sessions_fingerprint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_sessions_fingerprint ON public.device_sessions USING btree (device_fingerprint);


--
-- Name: idx_device_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_sessions_user ON public.device_sessions USING btree (user_id);


--
-- Name: idx_invite_codes_org_branch_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invite_codes_org_branch_created_at ON public.invite_codes USING btree (org_id, branch_id, created_at DESC);


--
-- Name: idx_marketing_offers_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_offers_org_active ON public.marketing_offers USING btree (org_id, is_active, starts_at DESC NULLS LAST);


--
-- Name: idx_online_users_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_online_users_user ON public.online_users USING btree (user_id);


--
-- Name: idx_payments_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_ticket_id ON public.payments USING btree (ticket_id);


--
-- Name: idx_receipts_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receipts_ticket_id ON public.receipts USING btree (ticket_id, created_at DESC);


--
-- Name: idx_services_branch_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_branch_active ON public.services USING btree (branch_id, active);


--
-- Name: idx_services_org_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_org_branch ON public.services USING btree (org_id, branch_id);


--
-- Name: idx_shift_leave_requests_org_branch_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shift_leave_requests_org_branch_staff ON public.shift_leave_requests USING btree (org_id, branch_id, staff_user_id, scheduled_date DESC);


--
-- Name: idx_shift_leave_requests_org_branch_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shift_leave_requests_org_branch_status ON public.shift_leave_requests USING btree (org_id, branch_id, status, requested_at DESC);


--
-- Name: idx_shift_leave_requests_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shift_leave_requests_org_status ON public.shift_leave_requests USING btree (org_id, status, requested_at DESC);


--
-- Name: idx_shift_leave_requests_staff_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shift_leave_requests_staff_date ON public.shift_leave_requests USING btree (staff_user_id, scheduled_date DESC, requested_at DESC);


--
-- Name: idx_shift_plans_org_branch_week_status; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_shift_plans_org_branch_week_status ON public.shift_plans USING btree (org_id, branch_id, week_start, status);


--
-- Name: idx_shift_plans_org_status_week; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shift_plans_org_status_week ON public.shift_plans USING btree (org_id, status, week_start DESC);


--
-- Name: idx_staff_shift_profiles_org_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_shift_profiles_org_branch ON public.staff_shift_profiles USING btree (org_id, branch_id, staff_role);


--
-- Name: idx_storefront_gallery_storefront_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storefront_gallery_storefront_active ON public.storefront_gallery USING btree (storefront_id, is_active, display_order);


--
-- Name: idx_storefront_products_storefront_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storefront_products_storefront_active ON public.storefront_products USING btree (storefront_id, is_active, display_order);


--
-- Name: idx_storefront_profile_active_org; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_storefront_profile_active_org ON public.storefront_profile USING btree (org_id) WHERE (is_active = true);


--
-- Name: idx_storefront_profile_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_storefront_profile_slug ON public.storefront_profile USING btree (slug);


--
-- Name: idx_storefront_team_members_storefront_visible; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storefront_team_members_storefront_visible ON public.storefront_team_members USING btree (storefront_id, is_visible, display_order);


--
-- Name: idx_telegram_conversations_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telegram_conversations_expires_at ON public.telegram_conversations USING btree (expires_at);


--
-- Name: idx_telegram_link_codes_app_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telegram_link_codes_app_user ON public.telegram_link_codes USING btree (app_user_id);


--
-- Name: idx_telegram_link_codes_app_user_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telegram_link_codes_app_user_created_at ON public.telegram_link_codes USING btree (app_user_id, created_at DESC);


--
-- Name: idx_telegram_link_codes_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telegram_link_codes_code ON public.telegram_link_codes USING btree (code);


--
-- Name: idx_telegram_link_codes_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telegram_link_codes_expires_at ON public.telegram_link_codes USING btree (expires_at);


--
-- Name: idx_telegram_links_app_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_telegram_links_app_user ON public.telegram_links USING btree (app_user_id);


--
-- Name: idx_telegram_links_telegram_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_telegram_links_telegram_user ON public.telegram_links USING btree (telegram_user_id);


--
-- Name: idx_ticket_items_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_items_ticket_id ON public.ticket_items USING btree (ticket_id);


--
-- Name: idx_tickets_org_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_org_created_at ON public.tickets USING btree (org_id, created_at DESC);


--
-- Name: idx_tickets_org_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_org_status_created ON public.tickets USING btree (org_id, status, created_at DESC);


--
-- Name: idx_time_entries_open_shift_end; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_entries_open_shift_end ON public.time_entries USING btree (org_id, scheduled_end) WHERE (clock_out IS NULL);


--
-- Name: idx_time_entries_org_branch_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_entries_org_branch_staff ON public.time_entries USING btree (org_id, branch_id, staff_user_id, clock_in DESC);


--
-- Name: idx_time_entries_org_branch_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_entries_org_branch_status ON public.time_entries USING btree (org_id, branch_id, approval_status, scheduled_date DESC);


--
-- Name: idx_time_entries_org_clockin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_entries_org_clockin ON public.time_entries USING btree (org_id, clock_in DESC);


--
-- Name: idx_time_entries_staff_status_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_entries_staff_status_day ON public.time_entries USING btree (staff_user_id, approval_status, scheduled_date DESC, clock_in DESC);


--
-- Name: idx_user_roles_org_branch_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_org_branch_role ON public.user_roles USING btree (org_id, branch_id, role);


--
-- Name: idx_user_roles_user_org_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user_org_branch ON public.user_roles USING btree (user_id, org_id, branch_id);


--
-- Name: idx_user_roles_user_org_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_user_roles_user_org_unique ON public.user_roles USING btree (user_id, org_id);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_03_08_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_03_08_inserted_at_topic_idx ON realtime.messages_2026_03_08 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_03_09_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_03_09_inserted_at_topic_idx ON realtime.messages_2026_03_09 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_03_10_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_03_10_inserted_at_topic_idx ON realtime.messages_2026_03_10 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_03_11_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_03_11_inserted_at_topic_idx ON realtime.messages_2026_03_11 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_03_12_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_03_12_inserted_at_topic_idx ON realtime.messages_2026_03_12 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_action_filter_key; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_key ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: supabase_functions_hooks_h_table_id_h_name_idx; Type: INDEX; Schema: supabase_functions; Owner: -
--

CREATE INDEX supabase_functions_hooks_h_table_id_h_name_idx ON supabase_functions.hooks USING btree (hook_table_id, hook_name);


--
-- Name: supabase_functions_hooks_request_id_idx; Type: INDEX; Schema: supabase_functions; Owner: -
--

CREATE INDEX supabase_functions_hooks_request_id_idx ON supabase_functions.hooks USING btree (request_id);


--
-- Name: messages_2026_03_08_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_03_08_inserted_at_topic_idx;


--
-- Name: messages_2026_03_08_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_03_08_pkey;


--
-- Name: messages_2026_03_09_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_03_09_inserted_at_topic_idx;


--
-- Name: messages_2026_03_09_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_03_09_pkey;


--
-- Name: messages_2026_03_10_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_03_10_inserted_at_topic_idx;


--
-- Name: messages_2026_03_10_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_03_10_pkey;


--
-- Name: messages_2026_03_11_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_03_11_inserted_at_topic_idx;


--
-- Name: messages_2026_03_11_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_03_11_pkey;


--
-- Name: messages_2026_03_12_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_03_12_inserted_at_topic_idx;


--
-- Name: messages_2026_03_12_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_03_12_pkey;


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


--
-- Name: appointments set_appointment_timestamps_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_appointment_timestamps_trigger BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_appointment_timestamps();


--
-- Name: profiles set_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: appointments trg_appointments_branch_org; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_appointments_branch_org BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.assert_branch_belongs_to_org();


--
-- Name: booking_requests trg_booking_requests_branch_org; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_booking_requests_branch_org BEFORE INSERT OR UPDATE ON public.booking_requests FOR EACH ROW EXECUTE FUNCTION public.assert_branch_belongs_to_org();


--
-- Name: booking_requests trg_booking_requests_expire_before_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_booking_requests_expire_before_write BEFORE INSERT OR UPDATE OF requested_start_at, status ON public.booking_requests FOR EACH ROW EXECUTE FUNCTION public.expire_unconfirmed_booking_request_before_read();


--
-- Name: booking_requests trg_booking_requests_release_offer_claim_on_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_booking_requests_release_offer_claim_on_delete AFTER DELETE ON public.booking_requests FOR EACH ROW EXECUTE FUNCTION public.release_offer_claim_for_deleted_booking_request();


--
-- Name: booking_requests trg_booking_requests_sync_offer_claim; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_booking_requests_sync_offer_claim AFTER INSERT OR UPDATE OF status, offer_id, customer_id ON public.booking_requests FOR EACH ROW EXECUTE FUNCTION public.sync_customer_offer_claim_for_booking_request();


--
-- Name: appointments trg_crm_appointment_after_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_crm_appointment_after_insert AFTER INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.crm_appointment_after_change();


--
-- Name: appointments trg_crm_appointment_after_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_crm_appointment_after_update AFTER UPDATE OF status ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.crm_appointment_after_change();


--
-- Name: tickets trg_crm_ticket_after_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_crm_ticket_after_insert AFTER INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.crm_ticket_after_change();


--
-- Name: customer_addresses trg_customer_addresses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customer_addresses_updated_at BEFORE UPDATE ON public.customer_addresses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: booking_requests trg_customer_booking_status_notifications; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customer_booking_status_notifications AFTER UPDATE OF status, appointment_id ON public.booking_requests FOR EACH ROW EXECUTE FUNCTION public.notify_customer_booking_status_change();


--
-- Name: customer_content_posts trg_customer_content_posts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customer_content_posts_updated_at BEFORE UPDATE ON public.customer_content_posts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: customer_memberships trg_customer_membership_tier_notifications; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customer_membership_tier_notifications AFTER UPDATE OF tier_id ON public.customer_memberships FOR EACH ROW EXECUTE FUNCTION public.notify_customer_membership_tier_upgrade();


--
-- Name: customer_memberships trg_customer_memberships_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customer_memberships_updated_at BEFORE UPDATE ON public.customer_memberships FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: customer_notification_preferences trg_customer_notification_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customer_notification_preferences_updated_at BEFORE UPDATE ON public.customer_notification_preferences FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: customer_payment_methods trg_customer_payment_methods_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customer_payment_methods_updated_at BEFORE UPDATE ON public.customer_payment_methods FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: customer_service_reviews trg_customer_service_reviews_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customer_service_reviews_updated_at BEFORE UPDATE ON public.customer_service_reviews FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: customers trg_customers_branch_org; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customers_branch_org BEFORE INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.assert_branch_belongs_to_org();


--
-- Name: invite_codes trg_invite_codes_branch_org; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_invite_codes_branch_org BEFORE INSERT OR UPDATE ON public.invite_codes FOR EACH ROW EXECUTE FUNCTION public.assert_branch_belongs_to_org();


--
-- Name: marketing_offers trg_membership_offer_notifications; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_membership_offer_notifications AFTER INSERT OR UPDATE OF is_active, starts_at, offer_metadata ON public.marketing_offers FOR EACH ROW EXECUTE FUNCTION public.notify_customers_for_membership_offer();


--
-- Name: user_roles trg_normalize_user_role_on_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_normalize_user_role_on_insert BEFORE INSERT ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.normalize_user_role_on_insert();


--
-- Name: resources trg_resources_branch_org; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_resources_branch_org BEFORE INSERT OR UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.assert_branch_belongs_to_org();


--
-- Name: shift_leave_requests trg_shift_leave_requests_branch_org; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_shift_leave_requests_branch_org BEFORE INSERT OR UPDATE ON public.shift_leave_requests FOR EACH ROW EXECUTE FUNCTION public.assert_branch_belongs_to_org();


--
-- Name: shift_leave_requests trg_shift_leave_requests_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_shift_leave_requests_touch_updated_at BEFORE UPDATE ON public.shift_leave_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: shift_plans trg_shift_plans_branch_org; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_shift_plans_branch_org BEFORE INSERT OR UPDATE ON public.shift_plans FOR EACH ROW EXECUTE FUNCTION public.assert_branch_belongs_to_org();


--
-- Name: shift_plans trg_shift_plans_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_shift_plans_touch_updated_at BEFORE UPDATE ON public.shift_plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: staff_shift_profiles trg_staff_shift_profiles_branch_org; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_staff_shift_profiles_branch_org BEFORE INSERT OR UPDATE ON public.staff_shift_profiles FOR EACH ROW EXECUTE FUNCTION public.assert_branch_belongs_to_org();


--
-- Name: staff_shift_profiles trg_staff_shift_profiles_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_staff_shift_profiles_touch_updated_at BEFORE UPDATE ON public.staff_shift_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: tickets trg_tickets_branch_org; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tickets_branch_org BEFORE INSERT OR UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.assert_branch_belongs_to_org();


--
-- Name: time_entries trg_time_entries_branch_org; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_time_entries_branch_org BEFORE INSERT OR UPDATE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION public.assert_branch_belongs_to_org();


--
-- Name: device_sessions trg_touch_device_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_device_sessions_updated_at BEFORE UPDATE ON public.device_sessions FOR EACH ROW EXECUTE FUNCTION public.touch_device_sessions_updated_at();


--
-- Name: storefront_gallery trg_touch_storefront_gallery; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_storefront_gallery BEFORE UPDATE ON public.storefront_gallery FOR EACH ROW EXECUTE FUNCTION public.touch_storefront_updated_at();


--
-- Name: storefront_products trg_touch_storefront_products; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_storefront_products BEFORE UPDATE ON public.storefront_products FOR EACH ROW EXECUTE FUNCTION public.touch_storefront_updated_at();


--
-- Name: storefront_profile trg_touch_storefront_profile; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_storefront_profile BEFORE UPDATE ON public.storefront_profile FOR EACH ROW EXECUTE FUNCTION public.touch_storefront_updated_at();


--
-- Name: storefront_team_members trg_touch_storefront_team_members; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_storefront_team_members BEFORE UPDATE ON public.storefront_team_members FOR EACH ROW EXECUTE FUNCTION public.touch_storefront_updated_at();


--
-- Name: telegram_conversations trg_touch_telegram_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_telegram_conversations_updated_at BEFORE UPDATE ON public.telegram_conversations FOR EACH ROW EXECUTE FUNCTION public.touch_telegram_conversations_updated_at();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: admin_notification_states admin_notification_states_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notification_states
    ADD CONSTRAINT admin_notification_states_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: admin_notifications admin_notifications_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT admin_notifications_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;


--
-- Name: admin_notifications admin_notifications_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT admin_notifications_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: admin_notifications admin_notifications_related_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT admin_notifications_related_appointment_id_fkey FOREIGN KEY (related_appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: app_sessions app_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_sessions
    ADD CONSTRAINT app_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: appointments appointments_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resources(id);


--
-- Name: appointments appointments_staff_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_staff_user_id_fkey FOREIGN KEY (staff_user_id) REFERENCES public.profiles(user_id);


--
-- Name: booking_requests booking_requests_applied_offer_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_applied_offer_claim_id_fkey FOREIGN KEY (applied_offer_claim_id) REFERENCES public.customer_offer_claims(id) ON DELETE SET NULL;


--
-- Name: booking_requests booking_requests_applied_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_applied_offer_id_fkey FOREIGN KEY (applied_offer_id) REFERENCES public.marketing_offers(id) ON DELETE SET NULL;


--
-- Name: booking_requests booking_requests_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: booking_requests booking_requests_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: booking_requests booking_requests_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: booking_requests booking_requests_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.marketing_offers(id) ON DELETE SET NULL;


--
-- Name: booking_requests booking_requests_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: branches branches_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: checkout_requests checkout_requests_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_requests
    ADD CONSTRAINT checkout_requests_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: checkout_requests checkout_requests_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_requests
    ADD CONSTRAINT checkout_requests_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;


--
-- Name: customer_accounts customer_accounts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_accounts
    ADD CONSTRAINT customer_accounts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_accounts customer_accounts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_accounts
    ADD CONSTRAINT customer_accounts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: customer_accounts customer_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_accounts
    ADD CONSTRAINT customer_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: customer_activities customer_activities_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_activities
    ADD CONSTRAINT customer_activities_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_activities customer_activities_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_activities
    ADD CONSTRAINT customer_activities_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: customer_addresses customer_addresses_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_addresses customer_addresses_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: customer_content_posts customer_content_posts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_content_posts
    ADD CONSTRAINT customer_content_posts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: customer_favorite_services customer_favorite_services_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_favorite_services
    ADD CONSTRAINT customer_favorite_services_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_favorite_services customer_favorite_services_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_favorite_services
    ADD CONSTRAINT customer_favorite_services_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: customer_favorite_services customer_favorite_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_favorite_services
    ADD CONSTRAINT customer_favorite_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: customer_memberships customer_memberships_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_memberships
    ADD CONSTRAINT customer_memberships_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_memberships customer_memberships_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_memberships
    ADD CONSTRAINT customer_memberships_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: customer_memberships customer_memberships_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_memberships
    ADD CONSTRAINT customer_memberships_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.membership_tiers(id) ON DELETE RESTRICT;


--
-- Name: customer_merge_audit customer_merge_audit_canonical_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_merge_audit
    ADD CONSTRAINT customer_merge_audit_canonical_customer_id_fkey FOREIGN KEY (canonical_customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_merge_audit customer_merge_audit_duplicate_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_merge_audit
    ADD CONSTRAINT customer_merge_audit_duplicate_customer_id_fkey FOREIGN KEY (duplicate_customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_merge_audit customer_merge_audit_merged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_merge_audit
    ADD CONSTRAINT customer_merge_audit_merged_by_fkey FOREIGN KEY (merged_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: customer_merge_audit customer_merge_audit_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_merge_audit
    ADD CONSTRAINT customer_merge_audit_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: customer_notification_preferences customer_notification_preferences_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_notification_preferences
    ADD CONSTRAINT customer_notification_preferences_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_notification_preferences customer_notification_preferences_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_notification_preferences
    ADD CONSTRAINT customer_notification_preferences_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: customer_notifications customer_notifications_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_notifications
    ADD CONSTRAINT customer_notifications_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_notifications customer_notifications_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_notifications
    ADD CONSTRAINT customer_notifications_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: customer_notifications customer_notifications_related_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_notifications
    ADD CONSTRAINT customer_notifications_related_appointment_id_fkey FOREIGN KEY (related_appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: customer_notifications customer_notifications_related_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_notifications
    ADD CONSTRAINT customer_notifications_related_offer_id_fkey FOREIGN KEY (related_offer_id) REFERENCES public.marketing_offers(id) ON DELETE SET NULL;


--
-- Name: customer_offer_claims customer_offer_claims_booking_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_offer_claims
    ADD CONSTRAINT customer_offer_claims_booking_request_id_fkey FOREIGN KEY (booking_request_id) REFERENCES public.booking_requests(id) ON DELETE SET NULL;


--
-- Name: customer_offer_claims customer_offer_claims_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_offer_claims
    ADD CONSTRAINT customer_offer_claims_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_offer_claims customer_offer_claims_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_offer_claims
    ADD CONSTRAINT customer_offer_claims_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.marketing_offers(id) ON DELETE CASCADE;


--
-- Name: customer_offer_claims customer_offer_claims_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_offer_claims
    ADD CONSTRAINT customer_offer_claims_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: customer_payment_methods customer_payment_methods_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payment_methods
    ADD CONSTRAINT customer_payment_methods_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_payment_methods customer_payment_methods_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payment_methods
    ADD CONSTRAINT customer_payment_methods_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: customer_push_delivery_logs customer_push_delivery_logs_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_push_delivery_logs
    ADD CONSTRAINT customer_push_delivery_logs_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.customer_notifications(id) ON DELETE CASCADE;


--
-- Name: customer_push_delivery_logs customer_push_delivery_logs_push_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_push_delivery_logs
    ADD CONSTRAINT customer_push_delivery_logs_push_device_id_fkey FOREIGN KEY (push_device_id) REFERENCES public.customer_push_devices(id) ON DELETE SET NULL;


--
-- Name: customer_push_devices customer_push_devices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_push_devices
    ADD CONSTRAINT customer_push_devices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_push_devices customer_push_devices_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_push_devices
    ADD CONSTRAINT customer_push_devices_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: customer_service_reviews customer_service_reviews_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_service_reviews
    ADD CONSTRAINT customer_service_reviews_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: customer_service_reviews customer_service_reviews_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_service_reviews
    ADD CONSTRAINT customer_service_reviews_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: customer_service_reviews customer_service_reviews_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_service_reviews
    ADD CONSTRAINT customer_service_reviews_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: customer_service_reviews customer_service_reviews_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_service_reviews
    ADD CONSTRAINT customer_service_reviews_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: customers customers_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE RESTRICT;


--
-- Name: customers customers_favorite_staff_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_favorite_staff_user_id_fkey FOREIGN KEY (favorite_staff_user_id) REFERENCES public.profiles(user_id);


--
-- Name: customers customers_merged_into_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_merged_into_customer_id_fkey FOREIGN KEY (merged_into_customer_id) REFERENCES public.customers(id);


--
-- Name: customers customers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: device_sessions device_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_sessions
    ADD CONSTRAINT device_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: invite_codes invite_codes_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT invite_codes_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: invite_codes invite_codes_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_codes
    ADD CONSTRAINT invite_codes_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: marketing_offers marketing_offers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_offers
    ADD CONSTRAINT marketing_offers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: membership_tiers membership_tiers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership_tiers
    ADD CONSTRAINT membership_tiers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: online_users online_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.online_users
    ADD CONSTRAINT online_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: payments payments_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: payments payments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_default_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_default_branch_id_fkey FOREIGN KEY (default_branch_id) REFERENCES public.branches(id);


--
-- Name: profiles profiles_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: receipts receipts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: receipts receipts_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: resources resources_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: resources resources_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: services services_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;


--
-- Name: services services_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: shift_leave_requests shift_leave_requests_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_leave_requests
    ADD CONSTRAINT shift_leave_requests_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE RESTRICT;


--
-- Name: shift_leave_requests shift_leave_requests_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_leave_requests
    ADD CONSTRAINT shift_leave_requests_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: shift_leave_requests shift_leave_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_leave_requests
    ADD CONSTRAINT shift_leave_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;


--
-- Name: shift_leave_requests shift_leave_requests_staff_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_leave_requests
    ADD CONSTRAINT shift_leave_requests_staff_user_id_fkey FOREIGN KEY (staff_user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: shift_leave_requests shift_leave_requests_time_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_leave_requests
    ADD CONSTRAINT shift_leave_requests_time_entry_id_fkey FOREIGN KEY (time_entry_id) REFERENCES public.time_entries(id) ON DELETE SET NULL;


--
-- Name: shift_plans shift_plans_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_plans
    ADD CONSTRAINT shift_plans_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: shift_plans shift_plans_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_plans
    ADD CONSTRAINT shift_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;


--
-- Name: shift_plans shift_plans_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_plans
    ADD CONSTRAINT shift_plans_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: shift_plans shift_plans_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_plans
    ADD CONSTRAINT shift_plans_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;


--
-- Name: staff_shift_profiles staff_shift_profiles_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_shift_profiles
    ADD CONSTRAINT staff_shift_profiles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: staff_shift_profiles staff_shift_profiles_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_shift_profiles
    ADD CONSTRAINT staff_shift_profiles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: staff_shift_profiles staff_shift_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_shift_profiles
    ADD CONSTRAINT staff_shift_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: storefront_gallery storefront_gallery_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_gallery
    ADD CONSTRAINT storefront_gallery_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: storefront_gallery storefront_gallery_storefront_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_gallery
    ADD CONSTRAINT storefront_gallery_storefront_id_fkey FOREIGN KEY (storefront_id) REFERENCES public.storefront_profile(id) ON DELETE CASCADE;


--
-- Name: storefront_products storefront_products_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_products
    ADD CONSTRAINT storefront_products_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: storefront_products storefront_products_storefront_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_products
    ADD CONSTRAINT storefront_products_storefront_id_fkey FOREIGN KEY (storefront_id) REFERENCES public.storefront_profile(id) ON DELETE CASCADE;


--
-- Name: storefront_profile storefront_profile_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_profile
    ADD CONSTRAINT storefront_profile_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: storefront_profile storefront_profile_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_profile
    ADD CONSTRAINT storefront_profile_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: storefront_team_members storefront_team_members_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_team_members
    ADD CONSTRAINT storefront_team_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: storefront_team_members storefront_team_members_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_team_members
    ADD CONSTRAINT storefront_team_members_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;


--
-- Name: storefront_team_members storefront_team_members_storefront_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_team_members
    ADD CONSTRAINT storefront_team_members_storefront_id_fkey FOREIGN KEY (storefront_id) REFERENCES public.storefront_profile(id) ON DELETE CASCADE;


--
-- Name: telegram_link_codes telegram_link_codes_app_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_link_codes
    ADD CONSTRAINT telegram_link_codes_app_user_id_fkey FOREIGN KEY (app_user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: telegram_links telegram_links_app_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_links
    ADD CONSTRAINT telegram_links_app_user_id_fkey FOREIGN KEY (app_user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


--
-- Name: ticket_items ticket_items_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_items
    ADD CONSTRAINT ticket_items_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: ticket_items ticket_items_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_items
    ADD CONSTRAINT ticket_items_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- Name: ticket_items ticket_items_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_items
    ADD CONSTRAINT ticket_items_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: tickets tickets_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: tickets tickets_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: time_entries time_entries_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;


--
-- Name: time_entries time_entries_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE RESTRICT;


--
-- Name: time_entries time_entries_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: device_sessions Users can manage own device session; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own device session" ON public.device_sessions USING ((auth.uid() = user_id));


--
-- Name: admin_notification_states; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_notification_states ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_notification_states admin_notification_states_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_notification_states_manage ON public.admin_notification_states USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: admin_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_offers anon read active marketing offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anon read active marketing offers" ON public.marketing_offers FOR SELECT TO anon USING (((is_active = true) AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));


--
-- Name: services anon read explore services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anon read explore services" ON public.services FOR SELECT TO anon USING (((active = true) AND (featured_in_explore = true)));


--
-- Name: services anon read home services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anon read home services" ON public.services FOR SELECT TO anon USING (((active = true) AND (featured_in_home = true)));


--
-- Name: services anon read lookbook services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anon read lookbook services" ON public.services FOR SELECT TO anon USING (((active = true) AND (featured_in_lookbook = true)));


--
-- Name: customer_content_posts anon read published customer content posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anon read published customer content posts" ON public.customer_content_posts FOR SELECT TO anon USING ((status = 'published'::text));


--
-- Name: storefront_gallery anon read storefront gallery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anon read storefront gallery" ON public.storefront_gallery FOR SELECT TO anon USING ((org_id IS NOT NULL));


--
-- Name: storefront_products anon read storefront products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anon read storefront products" ON public.storefront_products FOR SELECT TO anon USING ((org_id IS NOT NULL));


--
-- Name: storefront_profile anon read storefront profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anon read storefront profile" ON public.storefront_profile FOR SELECT TO anon USING ((org_id IS NOT NULL));


--
-- Name: storefront_team_members anon read storefront team members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anon read storefront team members" ON public.storefront_team_members FOR SELECT TO anon USING ((org_id IS NOT NULL));


--
-- Name: app_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- Name: appointments appointments branch read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "appointments branch read" ON public.appointments FOR SELECT USING (((org_id = public.my_org_id()) AND (public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text, 'ACCOUNTANT'::text]) OR (staff_user_id = auth.uid()))));


--
-- Name: appointments appointments branch write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "appointments branch write" ON public.appointments USING (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text]))) WITH CHECK (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text])));


--
-- Name: appointments appointments tech update own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "appointments tech update own" ON public.appointments FOR UPDATE USING (((org_id = public.my_org_id()) AND (staff_user_id = auth.uid()) AND public.can_access_branch(branch_id, ARRAY['TECH'::text]))) WITH CHECK (((org_id = public.my_org_id()) AND (staff_user_id = auth.uid()) AND public.can_access_branch(branch_id, ARRAY['TECH'::text])));


--
-- Name: marketing_offers authenticated read active marketing offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated read active marketing offers" ON public.marketing_offers FOR SELECT TO authenticated USING (((is_active = true) AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));


--
-- Name: customer_content_posts authenticated read published customer content posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated read published customer content posts" ON public.customer_content_posts FOR SELECT TO authenticated USING ((status = 'published'::text));


--
-- Name: booking_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_requests booking_requests branch delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "booking_requests branch delete" ON public.booking_requests FOR DELETE USING (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text])));


--
-- Name: booking_requests booking_requests branch read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "booking_requests branch read" ON public.booking_requests FOR SELECT USING (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text])));


--
-- Name: booking_requests booking_requests branch update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "booking_requests branch update" ON public.booking_requests FOR UPDATE USING (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text]))) WITH CHECK (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text])));


--
-- Name: branches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

--
-- Name: branches branches branch scoped read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "branches branch scoped read" ON public.branches FOR SELECT USING (((org_id = public.my_org_id()) AND (public.has_org_role(ARRAY['OWNER'::text]) OR public.can_access_branch(id))));


--
-- Name: branches branches owner insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "branches owner insert" ON public.branches FOR INSERT WITH CHECK (((org_id = public.my_org_id()) AND public.has_org_role(ARRAY['OWNER'::text])));


--
-- Name: branches branches owner update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "branches owner update" ON public.branches FOR UPDATE USING (((org_id = public.my_org_id()) AND public.has_org_role(ARRAY['OWNER'::text]))) WITH CHECK (((org_id = public.my_org_id()) AND public.has_org_role(ARRAY['OWNER'::text])));


--
-- Name: checkout_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checkout_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_activities crm read customer activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "crm read customer activities" ON public.customer_activities FOR SELECT USING (((org_id = public.my_org_id()) AND (public.has_role('OWNER'::text) OR public.has_role('MANAGER'::text) OR public.has_role('RECEPTION'::text) OR public.has_role('TECH'::text))));


--
-- Name: customer_activities crm write customer activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "crm write customer activities" ON public.customer_activities USING (((org_id = public.my_org_id()) AND (public.has_role('OWNER'::text) OR public.has_role('MANAGER'::text) OR public.has_role('RECEPTION'::text)))) WITH CHECK (((org_id = public.my_org_id()) AND (public.has_role('OWNER'::text) OR public.has_role('MANAGER'::text) OR public.has_role('RECEPTION'::text))));


--
-- Name: customer_accounts customer accounts own select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer accounts own select" ON public.customer_accounts FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: customer_addresses customer addresses own all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer addresses own all" ON public.customer_addresses USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: marketing_offers customer can read active offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer can read active offers" ON public.marketing_offers FOR SELECT USING (((is_active = true) AND ((ends_at IS NULL) OR (ends_at >= now()))));


--
-- Name: membership_tiers customer can read active tiers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer can read active tiers" ON public.membership_tiers FOR SELECT USING ((is_active = true));


--
-- Name: customer_favorite_services customer favorites own all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer favorites own all" ON public.customer_favorite_services USING ((EXISTS ( SELECT 1
   FROM public.customer_accounts ca
  WHERE ((ca.user_id = auth.uid()) AND (ca.org_id = customer_favorite_services.org_id) AND (ca.customer_id = customer_favorite_services.customer_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.customer_accounts ca
  WHERE ((ca.user_id = auth.uid()) AND (ca.org_id = customer_favorite_services.org_id) AND (ca.customer_id = customer_favorite_services.customer_id)))));


--
-- Name: customer_memberships customer memberships own read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer memberships own read" ON public.customer_memberships FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.customer_accounts ca
  WHERE ((ca.user_id = auth.uid()) AND (ca.org_id = customer_memberships.org_id) AND (ca.customer_id = customer_memberships.customer_id)))));


--
-- Name: customer_notification_preferences customer notification preferences own all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer notification preferences own all" ON public.customer_notification_preferences USING ((EXISTS ( SELECT 1
   FROM public.customer_accounts ca
  WHERE ((ca.user_id = auth.uid()) AND (ca.org_id = customer_notification_preferences.org_id) AND (ca.customer_id = customer_notification_preferences.customer_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.customer_accounts ca
  WHERE ((ca.user_id = auth.uid()) AND (ca.org_id = customer_notification_preferences.org_id) AND (ca.customer_id = customer_notification_preferences.customer_id)))));


--
-- Name: customer_notifications customer notifications own read update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer notifications own read update" ON public.customer_notifications FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.customer_accounts ca
  WHERE ((ca.user_id = auth.uid()) AND (ca.org_id = customer_notifications.org_id) AND (ca.customer_id = customer_notifications.customer_id)))));


--
-- Name: customer_notifications customer notifications own update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer notifications own update" ON public.customer_notifications FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.customer_accounts ca
  WHERE ((ca.user_id = auth.uid()) AND (ca.org_id = customer_notifications.org_id) AND (ca.customer_id = customer_notifications.customer_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.customer_accounts ca
  WHERE ((ca.user_id = auth.uid()) AND (ca.org_id = customer_notifications.org_id) AND (ca.customer_id = customer_notifications.customer_id)))));


--
-- Name: customer_offer_claims customer offers own all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer offers own all" ON public.customer_offer_claims USING ((EXISTS ( SELECT 1
   FROM public.customer_accounts ca
  WHERE ((ca.user_id = auth.uid()) AND (ca.org_id = customer_offer_claims.org_id) AND (ca.customer_id = customer_offer_claims.customer_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.customer_accounts ca
  WHERE ((ca.user_id = auth.uid()) AND (ca.org_id = customer_offer_claims.org_id) AND (ca.customer_id = customer_offer_claims.customer_id)))));


--
-- Name: customer_payment_methods customer payment methods own all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer payment methods own all" ON public.customer_payment_methods USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: customer_push_devices customer push devices own all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer push devices own all" ON public.customer_push_devices USING ((EXISTS ( SELECT 1
   FROM public.customer_accounts ca
  WHERE ((ca.user_id = auth.uid()) AND (ca.org_id = customer_push_devices.org_id) AND (ca.customer_id = customer_push_devices.customer_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.customer_accounts ca
  WHERE ((ca.user_id = auth.uid()) AND (ca.org_id = customer_push_devices.org_id) AND (ca.customer_id = customer_push_devices.customer_id)))));


--
-- Name: customer_service_reviews customer reviews own all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer reviews own all" ON public.customer_service_reviews USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: customer_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_accounts customer_accounts read own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer_accounts read own" ON public.customer_accounts FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: customer_activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_activities ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_addresses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_content_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_content_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_favorite_services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_favorite_services ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_merge_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_merge_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_notification_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_offer_claims; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_offer_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_payment_methods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_payment_methods ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_push_delivery_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_push_delivery_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_push_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_push_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_service_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_service_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: customers customers branch read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customers branch read" ON public.customers FOR SELECT USING (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text, 'ACCOUNTANT'::text])));


--
-- Name: customers customers branch write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customers branch write" ON public.customers USING (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text]))) WITH CHECK (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text])));


--
-- Name: device_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: invite_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: invite_codes invite_codes branch read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "invite_codes branch read" ON public.invite_codes FOR SELECT USING (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text])));


--
-- Name: invite_codes invite_codes branch write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "invite_codes branch write" ON public.invite_codes USING (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text]))) WITH CHECK (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text])));


--
-- Name: marketing_offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_offers ENABLE ROW LEVEL SECURITY;

--
-- Name: membership_tiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.membership_tiers ENABLE ROW LEVEL SECURITY;

--
-- Name: online_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.online_users ENABLE ROW LEVEL SECURITY;

--
-- Name: services org read services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org read services" ON public.services FOR SELECT USING ((org_id = public.my_org_id()));


--
-- Name: storefront_gallery org read storefront gallery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org read storefront gallery" ON public.storefront_gallery FOR SELECT USING ((org_id = public.my_org_id()));


--
-- Name: storefront_products org read storefront products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org read storefront products" ON public.storefront_products FOR SELECT USING ((org_id = public.my_org_id()));


--
-- Name: storefront_profile org read storefront profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org read storefront profile" ON public.storefront_profile FOR SELECT USING ((org_id = public.my_org_id()));


--
-- Name: storefront_team_members org read storefront team members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org read storefront team members" ON public.storefront_team_members FOR SELECT USING ((org_id = public.my_org_id()));


--
-- Name: orgs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;

--
-- Name: orgs orgs auth insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "orgs auth insert" ON public.orgs FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: orgs orgs auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "orgs auth read" ON public.orgs FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: customer_content_posts owner full access customer content posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner full access customer content posts" ON public.customer_content_posts TO authenticated USING (((org_id = public.my_org_id()) AND public.has_role('OWNER'::text))) WITH CHECK (((org_id = public.my_org_id()) AND public.has_role('OWNER'::text)));


--
-- Name: marketing_offers owner full access marketing offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner full access marketing offers" ON public.marketing_offers TO authenticated USING (((org_id = public.my_org_id()) AND public.has_role('OWNER'::text))) WITH CHECK (((org_id = public.my_org_id()) AND public.has_role('OWNER'::text)));


--
-- Name: services owner manager reception write services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner manager reception write services" ON public.services USING (((org_id = public.my_org_id()) AND (public.has_role('OWNER'::text) OR public.has_role('MANAGER'::text) OR public.has_role('RECEPTION'::text)))) WITH CHECK (((org_id = public.my_org_id()) AND (public.has_role('OWNER'::text) OR public.has_role('MANAGER'::text) OR public.has_role('RECEPTION'::text))));


--
-- Name: storefront_gallery owner manager reception write storefront gallery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner manager reception write storefront gallery" ON public.storefront_gallery USING (((org_id = public.my_org_id()) AND (public.has_role('OWNER'::text) OR public.has_role('MANAGER'::text) OR public.has_role('RECEPTION'::text)))) WITH CHECK (((org_id = public.my_org_id()) AND (public.has_role('OWNER'::text) OR public.has_role('MANAGER'::text) OR public.has_role('RECEPTION'::text))));


--
-- Name: storefront_products owner manager reception write storefront products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner manager reception write storefront products" ON public.storefront_products USING (((org_id = public.my_org_id()) AND (public.has_role('OWNER'::text) OR public.has_role('MANAGER'::text) OR public.has_role('RECEPTION'::text)))) WITH CHECK (((org_id = public.my_org_id()) AND (public.has_role('OWNER'::text) OR public.has_role('MANAGER'::text) OR public.has_role('RECEPTION'::text))));


--
-- Name: storefront_profile owner manager reception write storefront profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner manager reception write storefront profile" ON public.storefront_profile USING (((org_id = public.my_org_id()) AND (public.has_role('OWNER'::text) OR public.has_role('MANAGER'::text) OR public.has_role('RECEPTION'::text)))) WITH CHECK (((org_id = public.my_org_id()) AND (public.has_role('OWNER'::text) OR public.has_role('MANAGER'::text) OR public.has_role('RECEPTION'::text))));


--
-- Name: storefront_team_members owner manager reception write storefront team members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner manager reception write storefront team members" ON public.storefront_team_members USING (((org_id = public.my_org_id()) AND (public.has_role('OWNER'::text) OR public.has_role('MANAGER'::text) OR public.has_role('RECEPTION'::text)))) WITH CHECK (((org_id = public.my_org_id()) AND (public.has_role('OWNER'::text) OR public.has_role('MANAGER'::text) OR public.has_role('RECEPTION'::text))));


--
-- Name: storefront_gallery owner partner write storefront gallery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner partner write storefront gallery" ON public.storefront_gallery USING (((org_id = public.my_org_id()) AND (public.has_role('OWNER'::text) OR public.has_role('PARTNER'::text)))) WITH CHECK (((org_id = public.my_org_id()) AND (public.has_role('OWNER'::text) OR public.has_role('PARTNER'::text))));


--
-- Name: storefront_products owner partner write storefront products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner partner write storefront products" ON public.storefront_products USING (((org_id = public.my_org_id()) AND (public.has_role('OWNER'::text) OR public.has_role('PARTNER'::text)))) WITH CHECK (((org_id = public.my_org_id()) AND (public.has_role('OWNER'::text) OR public.has_role('PARTNER'::text))));


--
-- Name: storefront_profile owner partner write storefront profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner partner write storefront profile" ON public.storefront_profile USING (((org_id = public.my_org_id()) AND (public.has_role('OWNER'::text) OR public.has_role('PARTNER'::text)))) WITH CHECK (((org_id = public.my_org_id()) AND (public.has_role('OWNER'::text) OR public.has_role('PARTNER'::text))));


--
-- Name: storefront_team_members owner partner write storefront team members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner partner write storefront team members" ON public.storefront_team_members USING (((org_id = public.my_org_id()) AND (public.has_role('OWNER'::text) OR public.has_role('PARTNER'::text)))) WITH CHECK (((org_id = public.my_org_id()) AND (public.has_role('OWNER'::text) OR public.has_role('PARTNER'::text))));


--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: payments payments branch read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payments branch read" ON public.payments FOR SELECT USING (((org_id = public.my_org_id()) AND (EXISTS ( SELECT 1
   FROM public.tickets t
  WHERE ((t.id = payments.ticket_id) AND (t.org_id = payments.org_id) AND public.can_access_branch(t.branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text, 'ACCOUNTANT'::text]))))));


--
-- Name: payments payments branch write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payments branch write" ON public.payments USING (((org_id = public.my_org_id()) AND (EXISTS ( SELECT 1
   FROM public.tickets t
  WHERE ((t.id = payments.ticket_id) AND (t.org_id = payments.org_id) AND public.can_access_branch(t.branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text])))))) WITH CHECK (((org_id = public.my_org_id()) AND (EXISTS ( SELECT 1
   FROM public.tickets t
  WHERE ((t.id = payments.ticket_id) AND (t.org_id = payments.org_id) AND public.can_access_branch(t.branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text]))))));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles profiles read own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles read own" ON public.profiles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: profiles profiles select own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles select own" ON public.profiles FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: profiles profiles update own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: storefront_gallery public read active storefront gallery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read active storefront gallery" ON public.storefront_gallery FOR SELECT USING (((is_active = true) AND (EXISTS ( SELECT 1
   FROM public.storefront_profile sp
  WHERE ((sp.id = storefront_gallery.storefront_id) AND (sp.is_active = true))))));


--
-- Name: storefront_products public read active storefront products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read active storefront products" ON public.storefront_products FOR SELECT USING (((is_active = true) AND (EXISTS ( SELECT 1
   FROM public.storefront_profile sp
  WHERE ((sp.id = storefront_products.storefront_id) AND (sp.is_active = true))))));


--
-- Name: storefront_profile public read active storefront profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read active storefront profile" ON public.storefront_profile FOR SELECT USING ((is_active = true));


--
-- Name: services public read customer browse services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read customer browse services" ON public.services FOR SELECT USING (((active = true) AND ((featured_in_lookbook = true) OR (featured_in_home = true) OR (featured_in_explore = true))));


--
-- Name: services public read lookbook services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read lookbook services" ON public.services FOR SELECT USING (((active = true) AND ((featured_in_lookbook = true) OR (featured_in_home = true) OR (featured_in_explore = true))));


--
-- Name: storefront_team_members public read visible storefront team members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read visible storefront team members" ON public.storefront_team_members FOR SELECT USING (((is_visible = true) AND (EXISTS ( SELECT 1
   FROM public.storefront_profile sp
  WHERE ((sp.id = storefront_team_members.storefront_id) AND (sp.is_active = true))))));


--
-- Name: receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: receipts receipts branch read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "receipts branch read" ON public.receipts FOR SELECT USING (((org_id = public.my_org_id()) AND (EXISTS ( SELECT 1
   FROM public.tickets t
  WHERE ((t.id = receipts.ticket_id) AND (t.org_id = receipts.org_id) AND public.can_access_branch(t.branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text, 'ACCOUNTANT'::text]))))));


--
-- Name: receipts receipts branch write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "receipts branch write" ON public.receipts USING (((org_id = public.my_org_id()) AND (EXISTS ( SELECT 1
   FROM public.tickets t
  WHERE ((t.id = receipts.ticket_id) AND (t.org_id = receipts.org_id) AND public.can_access_branch(t.branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text])))))) WITH CHECK (((org_id = public.my_org_id()) AND (EXISTS ( SELECT 1
   FROM public.tickets t
  WHERE ((t.id = receipts.ticket_id) AND (t.org_id = receipts.org_id) AND public.can_access_branch(t.branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text]))))));


--
-- Name: resources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

--
-- Name: resources resources branch read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "resources branch read" ON public.resources FOR SELECT USING (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id)));


--
-- Name: resources resources branch write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "resources branch write" ON public.resources USING (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text]))) WITH CHECK (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text])));


--
-- Name: app_sessions service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role full access" ON public.app_sessions TO service_role USING (true) WITH CHECK (true);


--
-- Name: customer_content_posts service role full access customer content posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role full access customer content posts" ON public.customer_content_posts TO service_role USING (true) WITH CHECK (true);


--
-- Name: device_sessions service role full access device sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role full access device sessions" ON public.device_sessions TO service_role USING (true) WITH CHECK (true);


--
-- Name: telegram_link_codes service role full access link codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role full access link codes" ON public.telegram_link_codes TO service_role USING (true) WITH CHECK (true);


--
-- Name: online_users service role full access online; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role full access online" ON public.online_users TO service_role USING (true) WITH CHECK (true);


--
-- Name: telegram_links service role full access telegram; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role full access telegram" ON public.telegram_links TO service_role USING (true) WITH CHECK (true);


--
-- Name: telegram_conversations service role full access telegram conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role full access telegram conversations" ON public.telegram_conversations TO service_role USING (true) WITH CHECK (true);


--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_leave_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shift_leave_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_leave_requests shift_leave_requests branch read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "shift_leave_requests branch read" ON public.shift_leave_requests FOR SELECT USING (((org_id = public.my_org_id()) AND (public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text]) OR (staff_user_id = auth.uid()))));


--
-- Name: shift_leave_requests shift_leave_requests manager branch write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "shift_leave_requests manager branch write" ON public.shift_leave_requests USING (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text]))) WITH CHECK (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text])));


--
-- Name: shift_leave_requests shift_leave_requests staff insert self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "shift_leave_requests staff insert self" ON public.shift_leave_requests FOR INSERT WITH CHECK (((org_id = public.my_org_id()) AND (staff_user_id = auth.uid()) AND public.can_access_branch(branch_id, ARRAY['RECEPTION'::text, 'TECH'::text, 'ACCOUNTANT'::text, 'MANAGER'::text])));


--
-- Name: shift_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shift_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_plans shift_plans manager branch read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "shift_plans manager branch read" ON public.shift_plans FOR SELECT USING (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text])));


--
-- Name: shift_plans shift_plans manager branch write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "shift_plans manager branch write" ON public.shift_plans USING (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text]))) WITH CHECK (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text])));


--
-- Name: shift_plans shift_plans staff read published branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "shift_plans staff read published branch" ON public.shift_plans FOR SELECT USING (((org_id = public.my_org_id()) AND (status = 'published'::text) AND public.can_access_branch(branch_id)));


--
-- Name: staff_shift_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_shift_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_shift_profiles staff_shift_profiles branch read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_shift_profiles branch read" ON public.staff_shift_profiles FOR SELECT USING (((org_id = public.my_org_id()) AND (public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text]) OR (user_id = auth.uid()))));


--
-- Name: staff_shift_profiles staff_shift_profiles branch write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "staff_shift_profiles branch write" ON public.staff_shift_profiles USING (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text]))) WITH CHECK (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text])));


--
-- Name: storefront_gallery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.storefront_gallery ENABLE ROW LEVEL SECURITY;

--
-- Name: storefront_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.storefront_products ENABLE ROW LEVEL SECURITY;

--
-- Name: storefront_profile; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.storefront_profile ENABLE ROW LEVEL SECURITY;

--
-- Name: storefront_team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.storefront_team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: telegram_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.telegram_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: telegram_link_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: telegram_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ticket_items ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_items ticket_items branch read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ticket_items branch read" ON public.ticket_items FOR SELECT USING (((org_id = public.my_org_id()) AND (EXISTS ( SELECT 1
   FROM public.tickets t
  WHERE ((t.id = ticket_items.ticket_id) AND (t.org_id = ticket_items.org_id) AND public.can_access_branch(t.branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text, 'ACCOUNTANT'::text]))))));


--
-- Name: ticket_items ticket_items branch write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ticket_items branch write" ON public.ticket_items USING (((org_id = public.my_org_id()) AND (EXISTS ( SELECT 1
   FROM public.tickets t
  WHERE ((t.id = ticket_items.ticket_id) AND (t.org_id = ticket_items.org_id) AND public.can_access_branch(t.branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text])))))) WITH CHECK (((org_id = public.my_org_id()) AND (EXISTS ( SELECT 1
   FROM public.tickets t
  WHERE ((t.id = ticket_items.ticket_id) AND (t.org_id = ticket_items.org_id) AND public.can_access_branch(t.branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text]))))));


--
-- Name: tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: tickets tickets branch read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tickets branch read" ON public.tickets FOR SELECT USING (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text, 'ACCOUNTANT'::text])));


--
-- Name: tickets tickets branch write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tickets branch write" ON public.tickets USING (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text]))) WITH CHECK (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text])));


--
-- Name: time_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: time_entries time_entries branch read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "time_entries branch read" ON public.time_entries FOR SELECT USING (((org_id = public.my_org_id()) AND (public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text, 'RECEPTION'::text, 'ACCOUNTANT'::text]) OR (staff_user_id = auth.uid()))));


--
-- Name: time_entries time_entries manager branch write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "time_entries manager branch write" ON public.time_entries USING (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text]))) WITH CHECK (((org_id = public.my_org_id()) AND public.can_access_branch(branch_id, ARRAY['OWNER'::text, 'PARTNER'::text, 'MANAGER'::text])));


--
-- Name: time_entries time_entries staff self write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "time_entries staff self write" ON public.time_entries USING (((org_id = public.my_org_id()) AND (staff_user_id = auth.uid()) AND public.can_access_branch(branch_id, ARRAY['RECEPTION'::text, 'TECH'::text, 'ACCOUNTANT'::text, 'MANAGER'::text]))) WITH CHECK (((org_id = public.my_org_id()) AND (staff_user_id = auth.uid()) AND public.can_access_branch(branch_id, ARRAY['RECEPTION'::text, 'TECH'::text, 'ACCOUNTANT'::text, 'MANAGER'::text])));


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles manager branch write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_roles manager branch write" ON public.user_roles USING (((org_id = public.my_org_id()) AND (branch_id IS NOT NULL) AND public.can_access_branch(branch_id, ARRAY['MANAGER'::text]) AND (role = ANY (ARRAY['RECEPTION'::text, 'ACCOUNTANT'::text, 'TECH'::text])))) WITH CHECK (((org_id = public.my_org_id()) AND (branch_id IS NOT NULL) AND public.can_access_branch(branch_id, ARRAY['MANAGER'::text]) AND (role = ANY (ARRAY['RECEPTION'::text, 'ACCOUNTANT'::text, 'TECH'::text]))));


--
-- Name: user_roles user_roles owner write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_roles owner write" ON public.user_roles USING (((org_id = public.my_org_id()) AND public.has_org_role(ARRAY['OWNER'::text]))) WITH CHECK (((org_id = public.my_org_id()) AND public.has_org_role(ARRAY['OWNER'::text])));


--
-- Name: user_roles user_roles read scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_roles read scoped" ON public.user_roles FOR SELECT USING (((org_id = public.my_org_id()) AND ((user_id = auth.uid()) OR public.has_org_role(ARRAY['OWNER'::text]) OR ((branch_id IS NOT NULL) AND public.can_access_branch(branch_id, ARRAY['MANAGER'::text, 'PARTNER'::text])))));


--
-- Name: device_sessions users can delete own device session; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can delete own device session" ON public.device_sessions FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: device_sessions users can view own device session; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can view own device session" ON public.device_sessions FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: online_users users can view own online status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can view own online status" ON public.online_users FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: app_sessions users can view own session; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can view own session" ON public.app_sessions FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: telegram_link_codes users view own codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own codes" ON public.telegram_link_codes FOR SELECT USING ((app_user_id = auth.uid()));


--
-- Name: telegram_links users view own link; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own link" ON public.telegram_links FOR SELECT USING ((app_user_id = auth.uid()));


--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime_messages_publication; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime_messages_publication WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime_messages_publication messages; Type: PUBLICATION TABLE; Schema: realtime; Owner: -
--

ALTER PUBLICATION supabase_realtime_messages_publication ADD TABLE ONLY realtime.messages;


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--

\unrestrict nXAUYu2azM7RWd3lokYD8Gt2R9NIRnucrcunUrM9vgyQWgMoTJ4hObeH5VlnKeb

