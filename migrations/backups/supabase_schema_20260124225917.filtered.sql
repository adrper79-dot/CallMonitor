--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

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
-- Name: auth; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA auth;


ALTER SCHEMA auth OWNER TO supabase_admin;

--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA extensions;


ALTER SCHEMA extensions OWNER TO postgres;

--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA graphql;


ALTER SCHEMA graphql OWNER TO supabase_admin;

--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA graphql_public;


ALTER SCHEMA graphql_public OWNER TO supabase_admin;

--
-- Name: next_auth; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA next_auth;


ALTER SCHEMA next_auth OWNER TO postgres;

--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: pgbouncer
--

CREATE SCHEMA pgbouncer;


ALTER SCHEMA pgbouncer OWNER TO pgbouncer;

--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA realtime;


ALTER SCHEMA realtime OWNER TO supabase_admin;

--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA storage;


ALTER SCHEMA storage OWNER TO supabase_admin;

--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA supabase_migrations;


ALTER SCHEMA supabase_migrations OWNER TO postgres;

--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA vault;


ALTER SCHEMA vault OWNER TO supabase_admin;

--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE auth.aal_level OWNER TO supabase_auth_admin;

--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


ALTER TYPE auth.code_challenge_method OWNER TO supabase_auth_admin;

--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE auth.factor_status OWNER TO supabase_auth_admin;

--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE auth.factor_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE auth.oauth_authorization_status OWNER TO supabase_auth_admin;

--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE auth.oauth_client_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE auth.oauth_registration_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


ALTER TYPE auth.oauth_response_type OWNER TO supabase_auth_admin;

--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE auth.one_time_token_type OWNER TO supabase_auth_admin;

--
-- Name: alert_sensitivity; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.alert_sensitivity AS ENUM (
    'low',
    'medium',
    'high'
);


ALTER TYPE public.alert_sensitivity OWNER TO postgres;

--
-- Name: call_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.call_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'failed'
);


ALTER TYPE public.call_status OWNER TO postgres;

--
-- Name: test_frequency; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.test_frequency AS ENUM (
    '5min',
    '15min',
    '30min',
    '1hr',
    '4hr',
    '24hr'
);


ALTER TYPE public.test_frequency OWNER TO postgres;

--
-- Name: tool_role_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tool_role_type AS ENUM (
    'admin',
    'editor',
    'viewer'
);


ALTER TYPE public.tool_role_type OWNER TO postgres;

--
-- Name: tool_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tool_type AS ENUM (
    'call_monitor',
    'secret_shopper',
    'call_recorder',
    'call_analysis',
    'monitoring',
    'campaigns',
    'analytics'
);


ALTER TYPE public.tool_type OWNER TO postgres;

--
-- Name: webhook_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.webhook_type AS ENUM (
    'slack',
    'teams'
);


ALTER TYPE public.webhook_type OWNER TO postgres;

--
-- Name: action; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


ALTER TYPE realtime.action OWNER TO supabase_admin;

--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: supabase_admin
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


ALTER TYPE realtime.equality_op OWNER TO supabase_admin;

--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


ALTER TYPE realtime.user_defined_filter OWNER TO supabase_admin;

--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


ALTER TYPE realtime.wal_column OWNER TO supabase_admin;

--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


ALTER TYPE realtime.wal_rls OWNER TO supabase_admin;

--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


ALTER TYPE storage.buckettype OWNER TO supabase_storage_admin;

--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
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


ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
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


ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin;

--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
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


ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
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


ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
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


ALTER FUNCTION extensions.grant_pg_cron_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
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


ALTER FUNCTION extensions.grant_pg_graphql_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
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


ALTER FUNCTION extensions.grant_pg_net_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
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


ALTER FUNCTION extensions.pgrst_ddl_watch() OWNER TO supabase_admin;

--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
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


ALTER FUNCTION extensions.pgrst_drop_watch() OWNER TO supabase_admin;

--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
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


ALTER FUNCTION extensions.set_graphql_placeholder() OWNER TO supabase_admin;

--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: sync_sessions_sessiontoken(); Type: FUNCTION; Schema: next_auth; Owner: postgres
--

CREATE FUNCTION next_auth.sync_sessions_sessiontoken() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    IF NEW."sessionToken" IS NOT NULL THEN
      NEW.session_token := NEW."sessionToken";
    ELSIF NEW.session_token IS NOT NULL THEN
      NEW."sessionToken" := NEW.session_token;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION next_auth.sync_sessions_sessiontoken() OWNER TO postgres;

--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: supabase_admin
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


ALTER FUNCTION pgbouncer.get_auth(p_usename text) OWNER TO supabase_admin;

--
-- Name: apply_legal_hold(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.apply_legal_hold() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.status = 'active' THEN
    -- Apply legal hold to specified calls
    IF array_length(NEW.call_ids, 1) > 0 THEN
      UPDATE public.calls
      SET legal_hold_flag = true,
          custody_status = 'legal_hold',
          retention_class = 'legal_hold'
      WHERE id = ANY(NEW.call_ids)
        AND organization_id = NEW.organization_id;
        
      UPDATE public.recordings
      SET legal_hold_flag = true,
          custody_status = 'legal_hold',
          retention_class = 'legal_hold'
      WHERE call_id = ANY(NEW.call_ids);
      
      UPDATE public.evidence_bundles
      SET legal_hold_flag = true,
          custody_status = 'legal_hold',
          retention_class = 'legal_hold'
      WHERE call_id = ANY(NEW.call_ids);
    END IF;
    
    -- If applies to all, mark org-wide
    IF NEW.applies_to_all THEN
      UPDATE public.calls
      SET legal_hold_flag = true,
          custody_status = 'legal_hold',
          retention_class = 'legal_hold'
      WHERE organization_id = NEW.organization_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.apply_legal_hold() OWNER TO postgres;

--
-- Name: check_billing(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_billing(plan_req text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organizations o 
    WHERE o.id = (auth.jwt()->>'organization_id')::uuid 
    AND o.plan = plan_req
  );
END;$$;


ALTER FUNCTION public.check_billing(plan_req text) OWNER TO postgres;

--
-- Name: check_export_compliance(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_export_compliance(p_call_id uuid, p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_call record;
  v_org_id uuid;
  v_policy record;
  v_active_hold record;
  v_result jsonb;
  v_allowed boolean := true;
  v_reasons text[] := '{}';
BEGIN
  -- Get call details
  SELECT * INTO v_call FROM public.calls WHERE id = p_call_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reasons', ARRAY['Call not found']);
  END IF;
  
  v_org_id := v_call.organization_id;
  
  -- Check legal hold
  IF v_call.legal_hold_flag THEN
    v_allowed := false;
    v_reasons := array_append(v_reasons, 'Call is under legal hold');
  END IF;
  
  -- Check active legal holds
  SELECT * INTO v_active_hold 
  FROM public.legal_holds 
  WHERE organization_id = v_org_id 
    AND status = 'active'
    AND (applies_to_all OR p_call_id = ANY(call_ids))
  LIMIT 1;
  
  IF FOUND THEN
    v_allowed := false;
    v_reasons := array_append(v_reasons, 'Active legal hold: ' || v_active_hold.hold_name);
  END IF;
  
  -- Check custody status
  IF v_call.custody_status = 'expired' THEN
    v_allowed := false;
    v_reasons := array_append(v_reasons, 'Call evidence has expired');
  END IF;
  
  -- Build result
  v_result := jsonb_build_object(
    'allowed', v_allowed,
    'reasons', v_reasons,
    'custody_status', v_call.custody_status,
    'retention_class', v_call.retention_class,
    'legal_hold_flag', v_call.legal_hold_flag,
    'checked_at', now()
  );
  
  -- Log the compliance check
  INSERT INTO public.export_compliance_log (
    organization_id,
    call_id,
    retention_check_passed,
    legal_hold_check_passed,
    custody_status_at_export,
    retention_class_at_export,
    export_allowed,
    denial_reason,
    requested_by,
    decision_metadata
  ) VALUES (
    v_org_id,
    p_call_id,
    v_call.custody_status != 'expired',
    NOT v_call.legal_hold_flag,
    v_call.custody_status,
    v_call.retention_class,
    v_allowed,
    CASE WHEN NOT v_allowed THEN array_to_string(v_reasons, '; ') ELSE NULL END,
    p_user_id,
    v_result
  );
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION public.check_export_compliance(p_call_id uuid, p_user_id uuid) OWNER TO postgres;

--
-- Name: check_qa_compliance(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_qa_compliance(p_call_id uuid, p_feature text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_call RECORD;
  v_restriction RECORD;
  v_violation_id UUID;
BEGIN
  -- Get call details
  SELECT c.*, vc.synthetic_caller, vc.survey
  INTO v_call
  FROM calls c
  LEFT JOIN voice_configs vc ON vc.organization_id = c.organization_id
  WHERE c.id = p_call_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'Call not found');
  END IF;
  
  -- Check if this is a QA evaluation call (synthetic_caller enabled)
  IF v_call.synthetic_caller AND p_feature IN ('confirmation', 'outcome') THEN
    -- Get the restriction
    SELECT * INTO v_restriction
    FROM compliance_restrictions
    WHERE restriction_code = 
      CASE 
        WHEN p_feature = 'confirmation' THEN 'QA_NO_CONFIRMATIONS'
        WHEN p_feature = 'outcome' THEN 'QA_NO_OUTCOMES'
      END
    AND is_active = true
    LIMIT 1;
    
    IF FOUND THEN
      -- Log the violation
      INSERT INTO compliance_violations (
        organization_id,
        call_id,
        restriction_code,
        violation_type,
        violation_context
      ) VALUES (
        v_call.organization_id,
        p_call_id,
        v_restriction.restriction_code,
        CASE v_restriction.violation_action
          WHEN 'block' THEN 'blocked'
          WHEN 'warn' THEN 'warned'
          ELSE 'detected'
        END,
        jsonb_build_object(
          'feature_attempted', p_feature,
          'call_type', 'qa_evaluation',
          'timestamp', now()
        )
      )
      RETURNING id INTO v_violation_id;
      
      RETURN jsonb_build_object(
        'allowed', v_restriction.violation_action != 'block',
        'warning', v_restriction.violation_action = 'warn',
        'restriction_code', v_restriction.restriction_code,
        'restriction_name', v_restriction.restriction_name,
        'description', v_restriction.description,
        'violation_id', v_violation_id
      );
    END IF;
  END IF;
  
  RETURN jsonb_build_object('allowed', true);
END;
$$;


ALTER FUNCTION public.check_qa_compliance(p_call_id uuid, p_feature text) OWNER TO postgres;

--
-- Name: FUNCTION check_qa_compliance(p_call_id uuid, p_feature text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.check_qa_compliance(p_call_id uuid, p_feature text) IS 'Checks if a call operation violates AI Role Policy compliance rules. Returns whether action is allowed and any warnings.';


--
-- Name: check_sso_required(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_sso_required(email_address text) RETURNS TABLE(sso_required boolean, sso_config_id uuid, organization_id uuid, provider_type text, sso_url text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  email_domain text;
BEGIN
  -- Extract domain from email
  email_domain := lower(split_part(email_address, '@', 2));
  
  -- Find SSO config with matching verified domain
  RETURN QUERY
  SELECT 
    osc.require_sso,
    osc.id AS sso_config_id,
    osc.organization_id,
    osc.provider_type,
    COALESCE(osc.saml_sso_url, osc.oidc_authorization_url) AS sso_url
  FROM public.org_sso_configs osc
  WHERE osc.is_enabled = true
    AND email_domain = ANY(osc.verified_domains)
  LIMIT 1;
END;
$$;


ALTER FUNCTION public.check_sso_required(email_address text) OWNER TO postgres;

--
-- Name: FUNCTION check_sso_required(email_address text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.check_sso_required(email_address text) IS 'Check if SSO is required for a given email domain. Returns SSO config if found.';


--
-- Name: cleanup_stale_webrtc_sessions(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_stale_webrtc_sessions() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Mark sessions as disconnected if they've been active for > 4 hours
  -- (calls shouldn't last that long, likely orphaned)
  UPDATE public.webrtc_sessions
  SET 
    status = 'disconnected',
    disconnected_at = now()
  WHERE 
    status IN ('initializing', 'connecting', 'connected', 'on_call')
    AND created_at < now() - interval '4 hours';
    
  -- Delete sessions older than 30 days
  DELETE FROM public.webrtc_sessions
  WHERE created_at < now() - interval '30 days';
END;
$$;


ALTER FUNCTION public.cleanup_stale_webrtc_sessions() OWNER TO postgres;

--
-- Name: create_ai_run_with_audit(uuid, uuid, uuid, text, text, text, jsonb, jsonb, uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_ai_run_with_audit(p_ai_run_id uuid, p_call_id uuid, p_organization_id uuid, p_model text, p_purpose text, p_status text DEFAULT 'queued'::text, p_input jsonb DEFAULT NULL::jsonb, p_output jsonb DEFAULT NULL::jsonb, p_actor_id uuid DEFAULT NULL::uuid, p_system_id uuid DEFAULT NULL::uuid, p_audit_after jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_ai_run_id uuid;
  v_audit_id uuid;
  v_created_at timestamptz;
BEGIN
  -- Validate inputs
  IF p_ai_run_id IS NULL THEN
    RAISE EXCEPTION 'ai_run_id is required';
  END IF;
  
  IF p_call_id IS NULL THEN
    RAISE EXCEPTION 'call_id is required';
  END IF;
  
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;
  
  IF p_model IS NULL THEN
    RAISE EXCEPTION 'model is required';
  END IF;
  
  -- Verify call exists
  IF NOT EXISTS (SELECT 1 FROM calls WHERE id = p_call_id) THEN
    RAISE EXCEPTION 'call_id does not exist: %', p_call_id;
  END IF;
  
  -- Set timestamp for consistency
  v_created_at := NOW();
  
  -- Insert AI run record
  INSERT INTO ai_runs (
    id,
    call_id,
    organization_id,
    model,
    purpose,
    status,
    input,
    output,
    created_at,
    updated_at
  ) VALUES (
    p_ai_run_id,
    p_call_id,
    p_organization_id,
    p_model,
    p_purpose,
    p_status,
    p_input,
    p_output,
    v_created_at,
    v_created_at
  )
  RETURNING id INTO v_ai_run_id;
  
  -- Generate audit log ID
  v_audit_id := gen_random_uuid();
  
  -- Insert audit log
  INSERT INTO audit_logs (
    id,
    organization_id,
    user_id,
    system_id,
    resource_type,
    resource_id,
    action,
    before,
    after,
    created_at
  ) VALUES (
    v_audit_id,
    p_organization_id,
    p_actor_id,
    p_system_id,
    'ai_runs',
    v_ai_run_id,
    'create',
    NULL,
    COALESCE(p_audit_after, jsonb_build_object(
      'id', v_ai_run_id,
      'call_id', p_call_id,
      'model', p_model,
      'purpose', p_purpose,
      'status', p_status,
      'created_at', v_created_at
    )),
    v_created_at
  );
  
  -- Return success with IDs
  RETURN jsonb_build_object(
    'success', true,
    'ai_run_id', v_ai_run_id,
    'audit_id', v_audit_id,
    'created_at', v_created_at
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Transaction will rollback automatically
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;


ALTER FUNCTION public.create_ai_run_with_audit(p_ai_run_id uuid, p_call_id uuid, p_organization_id uuid, p_model text, p_purpose text, p_status text, p_input jsonb, p_output jsonb, p_actor_id uuid, p_system_id uuid, p_audit_after jsonb) OWNER TO postgres;

--
-- Name: FUNCTION create_ai_run_with_audit(p_ai_run_id uuid, p_call_id uuid, p_organization_id uuid, p_model text, p_purpose text, p_status text, p_input jsonb, p_output jsonb, p_actor_id uuid, p_system_id uuid, p_audit_after jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.create_ai_run_with_audit(p_ai_run_id uuid, p_call_id uuid, p_organization_id uuid, p_model text, p_purpose text, p_status text, p_input jsonb, p_output jsonb, p_actor_id uuid, p_system_id uuid, p_audit_after jsonb) IS 'Atomically creates an AI run record (transcription/translation) and audit log entry.';


--
-- Name: create_call_with_audit(uuid, uuid, text, text, text, text, text, jsonb, uuid, uuid, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_call_with_audit(p_call_id uuid, p_organization_id uuid, p_phone_number text, p_from_number text DEFAULT NULL::text, p_call_sid text DEFAULT NULL::text, p_status text DEFAULT 'pending'::text, p_flow_type text DEFAULT 'outbound'::text, p_modulations jsonb DEFAULT '{}'::jsonb, p_created_by uuid DEFAULT NULL::uuid, p_actor_id uuid DEFAULT NULL::uuid, p_system_id uuid DEFAULT NULL::uuid, p_audit_action text DEFAULT 'create'::text, p_audit_after jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_call_id uuid;
  v_audit_id uuid;
  v_created_at timestamptz;
BEGIN
  -- Validate inputs
  IF p_call_id IS NULL THEN
    RAISE EXCEPTION 'call_id is required';
  END IF;
  
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;
  
  IF p_phone_number IS NULL THEN
    RAISE EXCEPTION 'phone_number is required';
  END IF;
  
  -- Set timestamp for consistency
  v_created_at := NOW();
  
  -- Insert call record
  INSERT INTO calls (
    id,
    organization_id,
    phone_number,
    from_number,
    call_sid,
    status,
    flow_type,
    created_by,
    started_at,
    created_at,
    updated_at
  ) VALUES (
    p_call_id,
    p_organization_id,
    p_phone_number,
    p_from_number,
    p_call_sid,
    p_status,
    p_flow_type,
    p_created_by,
    v_created_at,
    v_created_at,
    v_created_at
  )
  RETURNING id INTO v_call_id;
  
  -- Generate audit log ID
  v_audit_id := gen_random_uuid();
  
  -- Insert audit log
  INSERT INTO audit_logs (
    id,
    organization_id,
    user_id,
    system_id,
    resource_type,
    resource_id,
    action,
    before,
    after,
    created_at
  ) VALUES (
    v_audit_id,
    p_organization_id,
    p_actor_id,
    p_system_id,
    'calls',
    v_call_id,
    p_audit_action,
    NULL,
    COALESCE(p_audit_after, jsonb_build_object(
      'id', v_call_id,
      'organization_id', p_organization_id,
      'phone_number', p_phone_number,
      'from_number', p_from_number,
      'call_sid', p_call_sid,
      'status', p_status,
      'flow_type', p_flow_type,
      'modulations', p_modulations,
      'created_at', v_created_at
    )),
    v_created_at
  );
  
  -- Return success with IDs
  RETURN jsonb_build_object(
    'success', true,
    'call_id', v_call_id,
    'audit_id', v_audit_id,
    'created_at', v_created_at
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Transaction will rollback automatically
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;


ALTER FUNCTION public.create_call_with_audit(p_call_id uuid, p_organization_id uuid, p_phone_number text, p_from_number text, p_call_sid text, p_status text, p_flow_type text, p_modulations jsonb, p_created_by uuid, p_actor_id uuid, p_system_id uuid, p_audit_action text, p_audit_after jsonb) OWNER TO postgres;

--
-- Name: FUNCTION create_call_with_audit(p_call_id uuid, p_organization_id uuid, p_phone_number text, p_from_number text, p_call_sid text, p_status text, p_flow_type text, p_modulations jsonb, p_created_by uuid, p_actor_id uuid, p_system_id uuid, p_audit_action text, p_audit_after jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.create_call_with_audit(p_call_id uuid, p_organization_id uuid, p_phone_number text, p_from_number text, p_call_sid text, p_status text, p_flow_type text, p_modulations jsonb, p_created_by uuid, p_actor_id uuid, p_system_id uuid, p_audit_action text, p_audit_after jsonb) IS 'Atomically creates a call record and audit log entry in a single transaction. Prevents partial failures.';


--
-- Name: create_recording_with_audit(uuid, uuid, uuid, text, text, integer, text, uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_recording_with_audit(p_recording_id uuid, p_call_id uuid, p_organization_id uuid, p_recording_url text, p_recording_sid text DEFAULT NULL::text, p_duration integer DEFAULT NULL::integer, p_status text DEFAULT 'completed'::text, p_actor_id uuid DEFAULT NULL::uuid, p_system_id uuid DEFAULT NULL::uuid, p_audit_after jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_recording_id uuid;
  v_audit_id uuid;
  v_created_at timestamptz;
BEGIN
  -- Validate inputs
  IF p_recording_id IS NULL THEN
    RAISE EXCEPTION 'recording_id is required';
  END IF;
  
  IF p_call_id IS NULL THEN
    RAISE EXCEPTION 'call_id is required';
  END IF;
  
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;
  
  -- Verify call exists
  IF NOT EXISTS (SELECT 1 FROM calls WHERE id = p_call_id) THEN
    RAISE EXCEPTION 'call_id does not exist: %', p_call_id;
  END IF;
  
  -- Set timestamp for consistency
  v_created_at := NOW();
  
  -- Insert recording record
  INSERT INTO recordings (
    id,
    call_id,
    organization_id,
    recording_url,
    recording_sid,
    duration,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_recording_id,
    p_call_id,
    p_organization_id,
    p_recording_url,
    p_recording_sid,
    p_duration,
    p_status,
    v_created_at,
    v_created_at
  )
  RETURNING id INTO v_recording_id;
  
  -- Generate audit log ID
  v_audit_id := gen_random_uuid();
  
  -- Insert audit log
  INSERT INTO audit_logs (
    id,
    organization_id,
    user_id,
    system_id,
    resource_type,
    resource_id,
    action,
    before,
    after,
    created_at
  ) VALUES (
    v_audit_id,
    p_organization_id,
    p_actor_id,
    p_system_id,
    'recordings',
    v_recording_id,
    'create',
    NULL,
    COALESCE(p_audit_after, jsonb_build_object(
      'id', v_recording_id,
      'call_id', p_call_id,
      'recording_url', p_recording_url,
      'recording_sid', p_recording_sid,
      'duration', p_duration,
      'status', p_status,
      'created_at', v_created_at
    )),
    v_created_at
  );
  
  -- Return success with IDs
  RETURN jsonb_build_object(
    'success', true,
    'recording_id', v_recording_id,
    'audit_id', v_audit_id,
    'created_at', v_created_at
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Transaction will rollback automatically
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;


ALTER FUNCTION public.create_recording_with_audit(p_recording_id uuid, p_call_id uuid, p_organization_id uuid, p_recording_url text, p_recording_sid text, p_duration integer, p_status text, p_actor_id uuid, p_system_id uuid, p_audit_after jsonb) OWNER TO postgres;

--
-- Name: FUNCTION create_recording_with_audit(p_recording_id uuid, p_call_id uuid, p_organization_id uuid, p_recording_url text, p_recording_sid text, p_duration integer, p_status text, p_actor_id uuid, p_system_id uuid, p_audit_after jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.create_recording_with_audit(p_recording_id uuid, p_call_id uuid, p_organization_id uuid, p_recording_url text, p_recording_sid text, p_duration integer, p_status text, p_actor_id uuid, p_system_id uuid, p_audit_after jsonb) IS 'Atomically creates a recording record and audit log entry. Ensures recording integrity.';


--
-- Name: get_active_subscription(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_active_subscription(org_id uuid) RETURNS TABLE(subscription_id uuid, plan text, status text, current_period_end timestamp with time zone, cancel_at_period_end boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  return query
  select 
    id as subscription_id,
    plan,
    status,
    current_period_end,
    cancel_at_period_end
  from stripe_subscriptions
  where organization_id = org_id
    and status in ('active', 'trialing')
  order by current_period_end desc
  limit 1;
end;
$$;


ALTER FUNCTION public.get_active_subscription(org_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION get_active_subscription(org_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_active_subscription(org_id uuid) IS 'Returns the active subscription for an organization';


--
-- Name: get_ai_agent_config(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_ai_agent_config(org_id uuid) RETURNS TABLE(organization_id uuid, ai_agent_id text, ai_agent_prompt text, ai_agent_temperature numeric, ai_agent_model text, ai_post_prompt_url text, ai_features_enabled boolean, translate_from text, translate_to text, use_voice_cloning boolean, cloned_voice_id text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  return query
  select 
    vc.organization_id,
    vc.ai_agent_id,
    vc.ai_agent_prompt,
    vc.ai_agent_temperature,
    vc.ai_agent_model,
    vc.ai_post_prompt_url,
    vc.ai_features_enabled,
    vc.translate_from,
    vc.translate_to,
    vc.use_voice_cloning,
    vc.cloned_voice_id
  from voice_configs vc
  where vc.organization_id = org_id
  limit 1;
end;
$$;


ALTER FUNCTION public.get_ai_agent_config(org_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION get_ai_agent_config(org_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_ai_agent_config(org_id uuid) IS 'Returns AI agent configuration for an organization';


--
-- Name: get_campaign_stats(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_campaign_stats(campaign_id_param uuid) RETURNS TABLE(total bigint, completed bigint, successful bigint, failed bigint, pending bigint, calling bigint)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as completed,
    COUNT(*) FILTER (WHERE status = 'completed' AND outcome = 'answered')::BIGINT as successful,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending,
    COUNT(*) FILTER (WHERE status = 'calling')::BIGINT as calling
  FROM campaign_calls
  WHERE campaign_id = campaign_id_param;
END;
$$;


ALTER FUNCTION public.get_campaign_stats(campaign_id_param uuid) OWNER TO postgres;

--
-- Name: FUNCTION get_campaign_stats(campaign_id_param uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_campaign_stats(campaign_id_param uuid) IS 'Returns aggregated statistics for a campaign including total, completed, successful, failed, pending, and calling counts';


--
-- Name: get_user_organization_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_organization_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT organization_id FROM public.users WHERE id = auth.uid();
$$;


ALTER FUNCTION public.get_user_organization_id() OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Create organization first
  INSERT INTO public.organizations (id, name, plan, created_at)
  VALUES (
    gen_random_uuid(),
    COALESCE(NEW.email || '''s Organization', 'My Organization'),
    'business',
    NOW()
  )
  RETURNING id INTO new_org_id;
  
  -- Insert user with organization_id
  INSERT INTO public.users (id, organization_id, email, role, is_admin, created_at)
  VALUES (
    NEW.id,
    new_org_id,
    NEW.email,
    'owner',
    true,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create user/org for %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT COALESCE((SELECT is_admin FROM public.users WHERE id = auth.uid()), false);
$$;


ALTER FUNCTION public.is_admin() OWNER TO postgres;

--
-- Name: is_org_member(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_org_member(org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members 
    WHERE user_id = auth.uid() AND organization_id = org_id
  );
$$;


ALTER FUNCTION public.is_org_member(org_id uuid) OWNER TO postgres;

--
-- Name: log_ai_agent_config_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_ai_agent_config_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  change_type text;
  old_config jsonb;
  new_config jsonb;
BEGIN
  -- Determine change type
  IF TG_OP = 'INSERT' THEN
    change_type := 'created';
    old_config := null;
    new_config := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if AI features were enabled/disabled
    IF OLD.ai_features_enabled = false AND NEW.ai_features_enabled = true THEN
      change_type := 'enabled';
    ELSIF OLD.ai_features_enabled = true AND NEW.ai_features_enabled = false THEN
      change_type := 'disabled';
    ELSE
      change_type := 'updated';
    END IF;
    old_config := to_jsonb(OLD);
    new_config := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    change_type := 'deleted';
    old_config := to_jsonb(OLD);
    new_config := null;
  END IF;

  -- Only log if AI-related fields changed
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.ai_agent_id, OLD.ai_agent_prompt, OLD.ai_agent_temperature, OLD.ai_agent_model, 
        OLD.ai_post_prompt_url, OLD.ai_features_enabled, OLD.translate_from, OLD.translate_to,
        OLD.use_voice_cloning, COALESCE(OLD.live_translate, OLD.translate)) IS DISTINCT FROM
       (NEW.ai_agent_id, NEW.ai_agent_prompt, NEW.ai_agent_temperature, NEW.ai_agent_model,
        NEW.ai_post_prompt_url, NEW.ai_features_enabled, NEW.translate_from, NEW.translate_to,
        NEW.use_voice_cloning, COALESCE(NEW.live_translate, NEW.translate)) THEN
      
      INSERT INTO ai_agent_audit_log (
        organization_id,
        changed_by,
        change_type,
        old_config,
        new_config
      ) VALUES (
        COALESCE(NEW.organization_id, OLD.organization_id),
        NEW.updated_by,
        change_type,
        old_config,
        new_config
      );
    END IF;
  ELSE
    INSERT INTO ai_agent_audit_log (
      organization_id,
      changed_by,
      change_type,
      old_config,
      new_config
    ) VALUES (
      COALESCE(NEW.organization_id, OLD.organization_id),
      COALESCE(NEW.updated_by, OLD.updated_by),
      change_type,
      old_config,
      new_config
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.log_ai_agent_config_change() OWNER TO postgres;

--
-- Name: FUNCTION log_ai_agent_config_change(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.log_ai_agent_config_change() IS 'Logs all changes to AI agent configuration for audit trail';


--
-- Name: prevent_artifact_provenance_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_artifact_provenance_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'artifact_provenance is append-only. Updates are not permitted.';
  RETURN NULL;
END;
$$;


ALTER FUNCTION public.prevent_artifact_provenance_update() OWNER TO postgres;

--
-- Name: prevent_attention_decision_delete(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_attention_decision_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'attention_decisions is append-only. Deletes not permitted.';
END;
$$;


ALTER FUNCTION public.prevent_attention_decision_delete() OWNER TO postgres;

--
-- Name: prevent_attention_decision_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_attention_decision_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'attention_decisions is append-only. Create new decision for overrides.';
END;
$$;


ALTER FUNCTION public.prevent_attention_decision_update() OWNER TO postgres;

--
-- Name: prevent_attention_event_delete(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_attention_event_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'attention_events is append-only. Deletes not permitted.';
END;
$$;


ALTER FUNCTION public.prevent_attention_event_delete() OWNER TO postgres;

--
-- Name: prevent_attention_event_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_attention_event_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'attention_events is append-only. Updates not permitted.';
END;
$$;


ALTER FUNCTION public.prevent_attention_event_update() OWNER TO postgres;

--
-- Name: prevent_crm_sync_log_delete(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_crm_sync_log_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'crm_sync_log is append-only. Deletes are not permitted.';
END;
$$;


ALTER FUNCTION public.prevent_crm_sync_log_delete() OWNER TO postgres;

--
-- Name: prevent_crm_sync_log_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_crm_sync_log_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Allow status and completed_at updates only (for pending -> success/failed)
    IF (OLD.id != NEW.id OR
        OLD.organization_id != NEW.organization_id OR
        OLD.integration_id != NEW.integration_id OR
        OLD.operation != NEW.operation OR
        OLD.idempotency_key IS DISTINCT FROM NEW.idempotency_key OR
        OLD.started_at != NEW.started_at) THEN
        RAISE EXCEPTION 'crm_sync_log is append-only. Core fields cannot be modified.';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.prevent_crm_sync_log_update() OWNER TO postgres;

--
-- Name: prevent_digest_delete(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_digest_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'digests is append-only. Deletes not permitted.';
END;
$$;


ALTER FUNCTION public.prevent_digest_delete() OWNER TO postgres;

--
-- Name: prevent_digest_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_digest_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'digests is append-only. Create new digest instead.';
END;
$$;


ALTER FUNCTION public.prevent_digest_update() OWNER TO postgres;

--
-- Name: prevent_evidence_bundle_content_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_evidence_bundle_content_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (
    NEW.organization_id IS DISTINCT FROM OLD.organization_id OR
    NEW.call_id IS DISTINCT FROM OLD.call_id OR
    NEW.recording_id IS DISTINCT FROM OLD.recording_id OR
    NEW.manifest_id IS DISTINCT FROM OLD.manifest_id OR
    NEW.manifest_hash IS DISTINCT FROM OLD.manifest_hash OR
    NEW.artifact_hashes IS DISTINCT FROM OLD.artifact_hashes OR
    NEW.bundle_payload IS DISTINCT FROM OLD.bundle_payload OR
    NEW.bundle_hash IS DISTINCT FROM OLD.bundle_hash OR
    NEW.bundle_hash_algo IS DISTINCT FROM OLD.bundle_hash_algo OR
    NEW.version IS DISTINCT FROM OLD.version OR
    NEW.parent_bundle_id IS DISTINCT FROM OLD.parent_bundle_id OR
    NEW.immutable_storage IS DISTINCT FROM OLD.immutable_storage OR
    NEW.is_authoritative IS DISTINCT FROM OLD.is_authoritative OR
    NEW.produced_by IS DISTINCT FROM OLD.produced_by OR
    NEW.immutability_policy IS DISTINCT FROM OLD.immutability_policy OR
    NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'evidence_bundles is append-only. Only TSA and supersession fields may be updated.';
  END IF;

  -- Allow TSA fields and supersession marking only
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.prevent_evidence_bundle_content_update() OWNER TO postgres;

--
-- Name: prevent_evidence_manifest_content_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_evidence_manifest_content_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Allow supersession marking ONLY (setting superseded_at and superseded_by)
  -- Block all other updates including created_at
  IF (
    NEW.manifest IS DISTINCT FROM OLD.manifest OR
    NEW.recording_id IS DISTINCT FROM OLD.recording_id OR
    NEW.scorecard_id IS DISTINCT FROM OLD.scorecard_id OR
    NEW.organization_id IS DISTINCT FROM OLD.organization_id OR
    NEW.version IS DISTINCT FROM OLD.version OR
    NEW.parent_manifest_id IS DISTINCT FROM OLD.parent_manifest_id OR
    NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'evidence_manifests is append-only. Only supersession marking is allowed. Create a new manifest instead.';
  END IF;
  
  -- If we get here, only superseded_at/superseded_by are changing - allow it
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.prevent_evidence_manifest_content_update() OWNER TO postgres;

--
-- Name: prevent_observation_delete(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_observation_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'external_entity_observations is append-only. Deletes not permitted.';
END;
$$;


ALTER FUNCTION public.prevent_observation_delete() OWNER TO postgres;

--
-- Name: prevent_observation_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_observation_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'external_entity_observations is append-only. Updates not permitted.';
END;
$$;


ALTER FUNCTION public.prevent_observation_update() OWNER TO postgres;

--
-- Name: prevent_search_document_delete(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_search_document_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'search_documents is append-only. Deletes are not permitted.';
END;
$$;


ALTER FUNCTION public.prevent_search_document_delete() OWNER TO postgres;

--
-- Name: prevent_search_document_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_search_document_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Only allow updating is_current and superseded_by (for version chaining)
    IF (OLD.id != NEW.id OR
        OLD.organization_id != NEW.organization_id OR
        OLD.source_type != NEW.source_type OR
        OLD.source_id != NEW.source_id OR
        OLD.version != NEW.version OR
        OLD.content != NEW.content OR
        OLD.content_hash != NEW.content_hash) THEN
        RAISE EXCEPTION 'search_documents is immutable. Create new version instead.';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.prevent_search_document_update() OWNER TO postgres;

--
-- Name: prevent_search_event_delete(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_search_event_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'search_events is append-only. Deletes are not permitted.';
END;
$$;


ALTER FUNCTION public.prevent_search_event_delete() OWNER TO postgres;

--
-- Name: prevent_search_event_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_search_event_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'search_events is immutable. Updates are not permitted.';
END;
$$;


ALTER FUNCTION public.prevent_search_event_update() OWNER TO postgres;

--
-- Name: prevent_transcript_version_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_transcript_version_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'transcript_versions is append-only. Updates are not permitted. Create a new version instead.';
  RETURN NULL;
END;
$$;


ALTER FUNCTION public.prevent_transcript_version_update() OWNER TO postgres;

--
-- Name: record_sso_login(uuid, text, text, text, text[], text, inet, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.record_sso_login(p_sso_config_id uuid, p_event_type text, p_email text, p_name text DEFAULT NULL::text, p_groups text[] DEFAULT NULL::text[], p_idp_subject text DEFAULT NULL::text, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text, p_error_code text DEFAULT NULL::text, p_error_message text DEFAULT NULL::text, p_raw_claims jsonb DEFAULT NULL::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_config_row public.org_sso_configs%ROWTYPE;
  v_user_id uuid;
  v_event_id uuid;
BEGIN
  -- Get SSO config
  SELECT * INTO v_config_row FROM public.org_sso_configs WHERE id = p_sso_config_id;
  
  IF v_config_row IS NULL THEN
    RAISE EXCEPTION 'SSO config not found';
  END IF;
  
  -- Try to find existing user by email
  SELECT id INTO v_user_id FROM public.users WHERE email = lower(p_email) LIMIT 1;
  
  -- Auto-provision user if enabled and not exists
  IF v_user_id IS NULL AND v_config_row.auto_provision_users AND p_event_type = 'login_success' THEN
    INSERT INTO public.users (id, email, name, created_at)
    VALUES (gen_random_uuid(), lower(p_email), COALESCE(p_name, p_email), now())
    RETURNING id INTO v_user_id;
    
    -- Add user to organization with default role
    INSERT INTO public.org_members (organization_id, user_id, role, created_at)
    VALUES (v_config_row.organization_id, v_user_id, v_config_row.default_role, now())
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;
  
  -- Record the login event
  INSERT INTO public.sso_login_events (
    organization_id, sso_config_id, user_id, event_type,
    email, name, groups, idp_subject,
    ip_address, user_agent, error_code, error_message, raw_claims
  ) VALUES (
    v_config_row.organization_id, p_sso_config_id, v_user_id, p_event_type,
    p_email, p_name, p_groups, p_idp_subject,
    p_ip_address, p_user_agent, p_error_code, p_error_message, p_raw_claims
  ) RETURNING id INTO v_event_id;
  
  -- Update login stats on config
  IF p_event_type = 'login_success' THEN
    UPDATE public.org_sso_configs
    SET last_login_at = now(), login_count = login_count + 1
    WHERE id = p_sso_config_id;
  END IF;
  
  RETURN v_event_id;
END;
$$;


ALTER FUNCTION public.record_sso_login(p_sso_config_id uuid, p_event_type text, p_email text, p_name text, p_groups text[], p_idp_subject text, p_ip_address inet, p_user_agent text, p_error_code text, p_error_message text, p_raw_claims jsonb) OWNER TO postgres;

--
-- Name: FUNCTION record_sso_login(p_sso_config_id uuid, p_event_type text, p_email text, p_name text, p_groups text[], p_idp_subject text, p_ip_address inet, p_user_agent text, p_error_code text, p_error_message text, p_raw_claims jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.record_sso_login(p_sso_config_id uuid, p_event_type text, p_email text, p_name text, p_groups text[], p_idp_subject text, p_ip_address inet, p_user_agent text, p_error_code text, p_error_message text, p_raw_claims jsonb) IS 'Record an SSO login event. Auto-provisions user if enabled.';


--
-- Name: safe_insert_user(uuid, uuid, text, text, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.safe_insert_user(p_id uuid, p_org_id uuid, p_email text, p_role text, p_is_admin boolean) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO users (id, organization_id, email, role, is_admin)
  VALUES (p_id, p_org_id, p_email, p_role, p_is_admin);
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'User with id % already exists. Skipping insert.', p_id;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Unexpected error inserting user: %', SQLERRM;
END;
$$;


ALTER FUNCTION public.safe_insert_user(p_id uuid, p_org_id uuid, p_email text, p_role text, p_is_admin boolean) OWNER TO postgres;

--
-- Name: set_audit_log_actor_type(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_audit_log_actor_type() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.actor_type IS NULL THEN
    IF NEW.user_id IS NOT NULL THEN
      NEW.actor_type := 'human';
    ELSIF NEW.system_id IS NOT NULL THEN
      NEW.actor_type := 'system';
    ELSE
      NEW.actor_type := 'automation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_audit_log_actor_type() OWNER TO postgres;

--
-- Name: soft_delete_ai_run(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.soft_delete_ai_run() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  org_id uuid;
BEGIN
  -- Get organization_id from related call (handle null call_id for upload transcriptions)
  IF OLD.call_id IS NOT NULL THEN
    SELECT organization_id INTO org_id 
    FROM public.calls 
    WHERE id = OLD.call_id;
  ELSE
    -- Fallback: try to get org from output metadata if available
    org_id := (OLD.output->>'organization_id')::uuid;
  END IF;
  
  -- Instead of deleting, mark as deleted
  UPDATE public.ai_runs 
  SET is_deleted = true, 
      deleted_at = now(),
      deleted_by = auth.uid()
  WHERE id = OLD.id;
  
  -- Write audit log (org_id may be null for orphaned records)
  INSERT INTO public.audit_logs (id, organization_id, user_id, resource_type, resource_id, action, before, after, created_at)
  VALUES (
    gen_random_uuid(),
    org_id,
    auth.uid(),
    'ai_runs',
    OLD.id,
    'soft_delete',
    row_to_json(OLD),
    NULL,
    now()
  );
  
  RETURN NULL;  -- Prevent actual deletion
END;
$$;


ALTER FUNCTION public.soft_delete_ai_run() OWNER TO postgres;

--
-- Name: soft_delete_call(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.soft_delete_call() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Instead of deleting, mark as deleted
  UPDATE public.calls 
  SET is_deleted = true, 
      deleted_at = now(),
      deleted_by = auth.uid()
  WHERE id = OLD.id;
  
  -- Write audit log
  INSERT INTO public.audit_logs (id, organization_id, user_id, resource_type, resource_id, action, before, after, created_at)
  VALUES (
    gen_random_uuid(),
    OLD.organization_id,
    auth.uid(),
    'calls',
    OLD.id,
    'soft_delete',
    row_to_json(OLD),
    NULL,
    now()
  );
  
  RETURN NULL;  -- Prevent actual deletion
END;
$$;


ALTER FUNCTION public.soft_delete_call() OWNER TO postgres;

--
-- Name: soft_delete_recording(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.soft_delete_recording() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Instead of deleting, mark as deleted
  UPDATE public.recordings 
  SET is_deleted = true, 
      deleted_at = now(),
      deleted_by = auth.uid()
  WHERE id = OLD.id;
  
  -- Write audit log
  INSERT INTO public.audit_logs (id, organization_id, user_id, resource_type, resource_id, action, before, after, created_at)
  VALUES (
    gen_random_uuid(),
    OLD.organization_id,
    auth.uid(),
    'recordings',
    OLD.id,
    'soft_delete',
    row_to_json(OLD),
    NULL,
    now()
  );
  
  RETURN NULL;  -- Prevent actual deletion
END;
$$;


ALTER FUNCTION public.soft_delete_recording() OWNER TO postgres;

--
-- Name: sync_organization_plan(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_organization_plan() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  -- Update organization plan when subscription becomes active
  if new.status = 'active' or new.status = 'trialing' then
    update organizations
    set plan = new.plan,
        updated_at = now()
    where id = new.organization_id;
  end if;
  
  -- Downgrade to free when subscription cancelled/expired
  if new.status in ('canceled', 'unpaid', 'incomplete_expired', 'past_due') then
    -- Only downgrade if this is the most recent subscription
    if not exists (
      select 1 from stripe_subscriptions
      where organization_id = new.organization_id
        and status in ('active', 'trialing')
        and current_period_end > new.current_period_end
    ) then
      update organizations
      set plan = 'free',
          updated_at = now()
      where id = new.organization_id;
    end if;
  end if;
  
  return new;
end;
$$;


ALTER FUNCTION public.sync_organization_plan() OWNER TO postgres;

--
-- Name: FUNCTION sync_organization_plan(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.sync_organization_plan() IS 'Automatically syncs organization.plan with subscription status';


--
-- Name: sync_sessions_sessiontoken(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_sessions_sessiontoken() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    IF NEW."sessionToken" IS NOT NULL THEN
      NEW.session_token := NEW."sessionToken";
    ELSIF NEW.session_token IS NOT NULL THEN
      NEW."sessionToken" := NEW.session_token;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION public.sync_sessions_sessiontoken() OWNER TO postgres;

--
-- Name: update_booking_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_booking_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_booking_updated_at() OWNER TO postgres;

--
-- Name: update_shopper_jobs_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_shopper_jobs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_shopper_jobs_updated_at() OWNER TO postgres;

--
-- Name: update_test_statistics(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_test_statistics(p_test_config_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_total_24h INTEGER;
  v_failures_24h INTEGER;
  v_uptime_24h DECIMAL(5,2);
  v_avg_response INTEGER;
BEGIN
  -- Calculate stats from test_results
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status != 'answered'),
    ROUND((COUNT(*) FILTER (WHERE status = 'answered')::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2),
    AVG(duration_ms) FILTER (WHERE status = 'answered')
  INTO v_total_24h, v_failures_24h, v_uptime_24h, v_avg_response
  FROM test_results
  WHERE test_config_id = p_test_config_id
    AND created_at >= NOW() - INTERVAL '24 hours';
  
  -- Upsert statistics
  INSERT INTO test_statistics (
    test_config_id,
    uptime_percentage_24h,
    avg_response_ms_24h,
    total_tests_24h,
    failures_24h,
    updated_at
  ) VALUES (
    p_test_config_id,
    COALESCE(v_uptime_24h, 100),
    v_avg_response,
    COALESCE(v_total_24h, 0),
    COALESCE(v_failures_24h, 0),
    NOW()
  )
  ON CONFLICT (test_config_id) 
  DO UPDATE SET
    uptime_percentage_24h = EXCLUDED.uptime_percentage_24h,
    avg_response_ms_24h = EXCLUDED.avg_response_ms_24h,
    total_tests_24h = EXCLUDED.total_tests_24h,
    failures_24h = EXCLUDED.failures_24h,
    updated_at = NOW();
END;
$$;


ALTER FUNCTION public.update_test_statistics(p_test_config_id uuid) OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- Name: user_has_tool_access(uuid, uuid, public.tool_type, public.tool_role_type); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.user_has_tool_access(p_user_id uuid, p_org_id uuid, p_tool public.tool_type, p_min_role public.tool_role_type DEFAULT 'viewer'::public.tool_role_type) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Global org admin has access to everything
  IF EXISTS (SELECT 1 FROM org_members WHERE user_id = p_user_id AND organization_id = p_org_id AND role = 'admin') THEN
    RETURN TRUE;
  END IF;

  -- Check tool-specific access
  RETURN EXISTS (
    SELECT 1 FROM tool_team_members
    WHERE user_id = p_user_id
      AND organization_id = p_org_id
      AND tool = p_tool
      AND (
        (p_min_role = 'admin' AND role = 'admin')
        OR (p_min_role = 'editor' AND role IN ('admin', 'editor'))
        OR (p_min_role = 'viewer' AND role IN ('admin', 'editor', 'viewer'))
      )
  );
END;
$$;


ALTER FUNCTION public.user_has_tool_access(p_user_id uuid, p_org_id uuid, p_tool public.tool_type, p_min_role public.tool_role_type) OWNER TO postgres;

--
-- Name: FUNCTION user_has_tool_access(p_user_id uuid, p_org_id uuid, p_tool public.tool_type, p_min_role public.tool_role_type); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.user_has_tool_access(p_user_id uuid, p_org_id uuid, p_tool public.tool_type, p_min_role public.tool_role_type) IS 'Check if a user has access to a tool at a given role level';


--
-- Name: validate_ai_agent_config(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_ai_agent_config() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.ai_agent_temperature IS NOT NULL AND (NEW.ai_agent_temperature < 0 OR NEW.ai_agent_temperature > 2) THEN
    RAISE EXCEPTION 'ai_agent_temperature must be between 0 and 2';
  END IF;

  IF NEW.ai_agent_model IS NOT NULL AND NEW.ai_agent_model NOT IN ('gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo') THEN
    RAISE EXCEPTION 'ai_agent_model must be one of: gpt-4o-mini, gpt-4o, gpt-4-turbo';
  END IF;

  IF NEW.ai_post_prompt_url IS NOT NULL AND NEW.ai_post_prompt_url !~ '^https?://' THEN
    RAISE EXCEPTION 'ai_post_prompt_url must be a valid HTTP(S) URL';
  END IF;

  -- Only validate languages when NEWLY enabling translation
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.live_translate, NEW.translate, false) = true THEN
      IF NEW.translate_from IS NULL OR NEW.translate_to IS NULL THEN
        RAISE EXCEPTION 'translate_from and translate_to are required when translation is enabled';
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (COALESCE(NEW.live_translate, NEW.translate, false) = true) AND 
       (COALESCE(OLD.live_translate, OLD.translate, false) = false) THEN
      IF NEW.translate_from IS NULL OR NEW.translate_to IS NULL THEN
        RAISE EXCEPTION 'translate_from and translate_to are required when enabling translation';
      END IF;
    END IF;
  END IF;

  -- Sync live_translate and translate columns
  IF NEW.live_translate IS NOT NULL AND NEW.translate IS NULL THEN
    NEW.translate := NEW.live_translate;
  ELSIF NEW.translate IS NOT NULL AND NEW.live_translate IS NULL THEN
    NEW.live_translate := NEW.translate;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.validate_ai_agent_config() OWNER TO postgres;

--
-- Name: FUNCTION validate_ai_agent_config(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.validate_ai_agent_config() IS 'Validates AI agent configuration before insert/update';


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
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
        subs.entity = entity_;

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


ALTER FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) OWNER TO supabase_admin;

--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
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


ALTER FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) OWNER TO supabase_admin;

--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
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


ALTER FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) OWNER TO supabase_admin;

--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    declare
      res jsonb;
    begin
      execute format('select to_jsonb(%L::'|| type_::text || ')', val)  into res;
      return res;
    end
    $$;


ALTER FUNCTION realtime."cast"(val text, type_ regtype) OWNER TO supabase_admin;

--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
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


ALTER FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) OWNER TO supabase_admin;

--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
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


ALTER FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) OWNER TO supabase_admin;

--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
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
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


ALTER FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) OWNER TO supabase_admin;

--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
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


ALTER FUNCTION realtime.quote_wal2json(entity regclass) OWNER TO supabase_admin;

--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
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


ALTER FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) OWNER TO supabase_admin;

--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
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


ALTER FUNCTION realtime.subscription_check_filters() OWNER TO supabase_admin;

--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


ALTER FUNCTION realtime.to_regrole(role_name text) OWNER TO supabase_admin;

--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


ALTER FUNCTION realtime.topic() OWNER TO supabase_realtime_admin;

--
-- Name: add_prefixes(text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.add_prefixes(_bucket_id text, _name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    prefixes text[];
BEGIN
    prefixes := "storage"."get_prefixes"("_name");

    IF array_length(prefixes, 1) > 0 THEN
        INSERT INTO storage.prefixes (name, bucket_id)
        SELECT UNNEST(prefixes) as name, "_bucket_id" ON CONFLICT DO NOTHING;
    END IF;
END;
$$;


ALTER FUNCTION storage.add_prefixes(_bucket_id text, _name text) OWNER TO supabase_storage_admin;

--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
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


ALTER FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) OWNER TO supabase_storage_admin;

--
-- Name: delete_leaf_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.delete_leaf_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;


ALTER FUNCTION storage.delete_leaf_prefixes(bucket_ids text[], names text[]) OWNER TO supabase_storage_admin;

--
-- Name: delete_prefix(text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.delete_prefix(_bucket_id text, _name text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check if we can delete the prefix
    IF EXISTS(
        SELECT FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name") + 1
          AND "prefixes"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    )
    OR EXISTS(
        SELECT FROM "storage"."objects"
        WHERE "objects"."bucket_id" = "_bucket_id"
          AND "storage"."get_level"("objects"."name") = "storage"."get_level"("_name") + 1
          AND "objects"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    ) THEN
    -- There are sub-objects, skip deletion
    RETURN false;
    ELSE
        DELETE FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name")
          AND "prefixes"."name" = "_name";
        RETURN true;
    END IF;
END;
$$;


ALTER FUNCTION storage.delete_prefix(_bucket_id text, _name text) OWNER TO supabase_storage_admin;

--
-- Name: delete_prefix_hierarchy_trigger(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.delete_prefix_hierarchy_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    prefix text;
BEGIN
    prefix := "storage"."get_prefix"(OLD."name");

    IF coalesce(prefix, '') != '' THEN
        PERFORM "storage"."delete_prefix"(OLD."bucket_id", prefix);
    END IF;

    RETURN OLD;
END;
$$;


ALTER FUNCTION storage.delete_prefix_hierarchy_trigger() OWNER TO supabase_storage_admin;

--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
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


ALTER FUNCTION storage.enforce_bucket_name_length() OWNER TO supabase_storage_admin;

--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION storage.extension(name text) OWNER TO supabase_storage_admin;

--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
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


ALTER FUNCTION storage.filename(name text) OWNER TO supabase_storage_admin;

--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
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


ALTER FUNCTION storage.foldername(name text) OWNER TO supabase_storage_admin;

--
-- Name: get_level(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_level(name text) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


ALTER FUNCTION storage.get_level(name text) OWNER TO supabase_storage_admin;

--
-- Name: get_prefix(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_prefix(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


ALTER FUNCTION storage.get_prefix(name text) OWNER TO supabase_storage_admin;

--
-- Name: get_prefixes(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_prefixes(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


ALTER FUNCTION storage.get_prefixes(name text) OWNER TO supabase_storage_admin;

--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION storage.get_size_by_bucket() OWNER TO supabase_storage_admin;

--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
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


ALTER FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer, next_key_token text, next_upload_token text) OWNER TO supabase_storage_admin;

--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


ALTER FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer, start_after text, next_token text) OWNER TO supabase_storage_admin;

--
-- Name: lock_top_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.lock_top_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket text;
    v_top text;
BEGIN
    FOR v_bucket, v_top IN
        SELECT DISTINCT t.bucket_id,
            split_part(t.name, '/', 1) AS top
        FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        WHERE t.name <> ''
        ORDER BY 1, 2
        LOOP
            PERFORM pg_advisory_xact_lock(hashtextextended(v_bucket || '/' || v_top, 0));
        END LOOP;
END;
$$;


ALTER FUNCTION storage.lock_top_prefixes(bucket_ids text[], names text[]) OWNER TO supabase_storage_admin;

--
-- Name: objects_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.objects_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


ALTER FUNCTION storage.objects_delete_cleanup() OWNER TO supabase_storage_admin;

--
-- Name: objects_insert_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.objects_insert_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    NEW.level := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


ALTER FUNCTION storage.objects_insert_prefix_trigger() OWNER TO supabase_storage_admin;

--
-- Name: objects_update_cleanup(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.objects_update_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    -- NEW - OLD (destinations to create prefixes for)
    v_add_bucket_ids text[];
    v_add_names      text[];

    -- OLD - NEW (sources to prune)
    v_src_bucket_ids text[];
    v_src_names      text[];
BEGIN
    IF TG_OP <> 'UPDATE' THEN
        RETURN NULL;
    END IF;

    -- 1) Compute NEW−OLD (added paths) and OLD−NEW (moved-away paths)
    WITH added AS (
        SELECT n.bucket_id, n.name
        FROM new_rows n
        WHERE n.name <> '' AND position('/' in n.name) > 0
        EXCEPT
        SELECT o.bucket_id, o.name FROM old_rows o WHERE o.name <> ''
    ),
    moved AS (
         SELECT o.bucket_id, o.name
         FROM old_rows o
         WHERE o.name <> ''
         EXCEPT
         SELECT n.bucket_id, n.name FROM new_rows n WHERE n.name <> ''
    )
    SELECT
        -- arrays for ADDED (dest) in stable order
        COALESCE( (SELECT array_agg(a.bucket_id ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        COALESCE( (SELECT array_agg(a.name      ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        -- arrays for MOVED (src) in stable order
        COALESCE( (SELECT array_agg(m.bucket_id ORDER BY m.bucket_id, m.name) FROM moved m), '{}' ),
        COALESCE( (SELECT array_agg(m.name      ORDER BY m.bucket_id, m.name) FROM moved m), '{}' )
    INTO v_add_bucket_ids, v_add_names, v_src_bucket_ids, v_src_names;

    -- Nothing to do?
    IF (array_length(v_add_bucket_ids, 1) IS NULL) AND (array_length(v_src_bucket_ids, 1) IS NULL) THEN
        RETURN NULL;
    END IF;

    -- 2) Take per-(bucket, top) locks: ALL prefixes in consistent global order to prevent deadlocks
    DECLARE
        v_all_bucket_ids text[];
        v_all_names text[];
    BEGIN
        -- Combine source and destination arrays for consistent lock ordering
        v_all_bucket_ids := COALESCE(v_src_bucket_ids, '{}') || COALESCE(v_add_bucket_ids, '{}');
        v_all_names := COALESCE(v_src_names, '{}') || COALESCE(v_add_names, '{}');

        -- Single lock call ensures consistent global ordering across all transactions
        IF array_length(v_all_bucket_ids, 1) IS NOT NULL THEN
            PERFORM storage.lock_top_prefixes(v_all_bucket_ids, v_all_names);
        END IF;
    END;

    -- 3) Create destination prefixes (NEW−OLD) BEFORE pruning sources
    IF array_length(v_add_bucket_ids, 1) IS NOT NULL THEN
        WITH candidates AS (
            SELECT DISTINCT t.bucket_id, unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(v_add_bucket_ids, v_add_names) AS t(bucket_id, name)
            WHERE name <> ''
        )
        INSERT INTO storage.prefixes (bucket_id, name)
        SELECT c.bucket_id, c.name
        FROM candidates c
        ON CONFLICT DO NOTHING;
    END IF;

    -- 4) Prune source prefixes bottom-up for OLD−NEW
    IF array_length(v_src_bucket_ids, 1) IS NOT NULL THEN
        -- re-entrancy guard so DELETE on prefixes won't recurse
        IF current_setting('storage.gc.prefixes', true) <> '1' THEN
            PERFORM set_config('storage.gc.prefixes', '1', true);
        END IF;

        PERFORM storage.delete_leaf_prefixes(v_src_bucket_ids, v_src_names);
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION storage.objects_update_cleanup() OWNER TO supabase_storage_admin;

--
-- Name: objects_update_level_trigger(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.objects_update_level_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Set the new level
        NEW."level" := "storage"."get_level"(NEW."name");
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION storage.objects_update_level_trigger() OWNER TO supabase_storage_admin;

--
-- Name: objects_update_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.objects_update_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_prefixes TEXT[];
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Retrieve old prefixes
        old_prefixes := "storage"."get_prefixes"(OLD."name");

        -- Remove old prefixes that are only used by this object
        WITH all_prefixes as (
            SELECT unnest(old_prefixes) as prefix
        ),
        can_delete_prefixes as (
             SELECT prefix
             FROM all_prefixes
             WHERE NOT EXISTS (
                 SELECT 1 FROM "storage"."objects"
                 WHERE "bucket_id" = OLD."bucket_id"
                   AND "name" <> OLD."name"
                   AND "name" LIKE (prefix || '%')
             )
         )
        DELETE FROM "storage"."prefixes" WHERE name IN (SELECT prefix FROM can_delete_prefixes);

        -- Add new prefixes
        PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    END IF;
    -- Set the new level
    NEW."level" := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


ALTER FUNCTION storage.objects_update_prefix_trigger() OWNER TO supabase_storage_admin;

--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION storage.operation() OWNER TO supabase_storage_admin;

--
-- Name: prefixes_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.prefixes_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


ALTER FUNCTION storage.prefixes_delete_cleanup() OWNER TO supabase_storage_admin;

--
-- Name: prefixes_insert_trigger(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.prefixes_insert_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    RETURN NEW;
END;
$$;


ALTER FUNCTION storage.prefixes_insert_trigger() OWNER TO supabase_storage_admin;

--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql
    AS $$
declare
    can_bypass_rls BOOLEAN;
begin
    SELECT rolbypassrls
    INTO can_bypass_rls
    FROM pg_roles
    WHERE rolname = coalesce(nullif(current_setting('role', true), 'none'), current_user);

    IF can_bypass_rls THEN
        RETURN QUERY SELECT * FROM storage.search_v1_optimised(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    ELSE
        RETURN QUERY SELECT * FROM storage.search_legacy_v1(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    END IF;
end;
$$;


ALTER FUNCTION storage.search(prefix text, bucketname text, limits integer, levels integer, offsets integer, search text, sortcolumn text, sortorder text) OWNER TO supabase_storage_admin;

--
-- Name: search_legacy_v1(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


ALTER FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer, levels integer, offsets integer, search text, sortcolumn text, sortorder text) OWNER TO supabase_storage_admin;

--
-- Name: search_v1_optimised(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search_v1_optimised(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select (string_to_array(name, ''/''))[level] as name
           from storage.prefixes
             where lower(prefixes.name) like lower($2 || $3) || ''%''
               and bucket_id = $4
               and level = $1
           order by name ' || v_sort_order || '
     )
     (select name,
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[level] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where lower(objects.name) like lower($2 || $3) || ''%''
       and bucket_id = $4
       and level = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


ALTER FUNCTION storage.search_v1_optimised(prefix text, bucketname text, limits integer, levels integer, offsets integer, search text, sortcolumn text, sortorder text) OWNER TO supabase_storage_admin;

--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    sort_col text;
    sort_ord text;
    cursor_op text;
    cursor_expr text;
    sort_expr text;
BEGIN
    -- Validate sort_order
    sort_ord := lower(sort_order);
    IF sort_ord NOT IN ('asc', 'desc') THEN
        sort_ord := 'asc';
    END IF;

    -- Determine cursor comparison operator
    IF sort_ord = 'asc' THEN
        cursor_op := '>';
    ELSE
        cursor_op := '<';
    END IF;
    
    sort_col := lower(sort_column);
    -- Validate sort column  
    IF sort_col IN ('updated_at', 'created_at') THEN
        cursor_expr := format(
            '($5 = '''' OR ROW(date_trunc(''milliseconds'', %I), name COLLATE "C") %s ROW(COALESCE(NULLIF($6, '''')::timestamptz, ''epoch''::timestamptz), $5))',
            sort_col, cursor_op
        );
        sort_expr := format(
            'COALESCE(date_trunc(''milliseconds'', %I), ''epoch''::timestamptz) %s, name COLLATE "C" %s',
            sort_col, sort_ord, sort_ord
        );
    ELSE
        cursor_expr := format('($5 = '''' OR name COLLATE "C" %s $5)', cursor_op);
        sort_expr := format('name COLLATE "C" %s', sort_ord);
    END IF;

    RETURN QUERY EXECUTE format(
        $sql$
        SELECT * FROM (
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    NULL::uuid AS id,
                    updated_at,
                    created_at,
                    NULL::timestamptz AS last_accessed_at,
                    NULL::jsonb AS metadata
                FROM storage.prefixes
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
            UNION ALL
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    id,
                    updated_at,
                    created_at,
                    last_accessed_at,
                    metadata
                FROM storage.objects
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
        ) obj
        ORDER BY %s
        LIMIT $3
        $sql$,
        cursor_expr,    -- prefixes WHERE
        sort_expr,      -- prefixes ORDER BY
        cursor_expr,    -- objects WHERE
        sort_expr,      -- objects ORDER BY
        sort_expr       -- final ORDER BY
    )
    USING prefix, bucket_name, limits, levels, start_after, sort_column_after;
END;
$_$;


ALTER FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer, levels integer, start_after text, sort_order text, sort_column text, sort_column_after text) OWNER TO supabase_storage_admin;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION storage.update_updated_at_column() OWNER TO supabase_storage_admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE auth.audit_log_entries OWNER TO supabase_auth_admin;

--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method auth.code_challenge_method NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone
);


ALTER TABLE auth.flow_state OWNER TO supabase_auth_admin;

--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.flow_state IS 'stores metadata for pkce logins';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.identities OWNER TO supabase_auth_admin;

--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE auth.instances OWNER TO supabase_auth_admin;

--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


ALTER TABLE auth.mfa_amr_claims OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.mfa_challenges OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.mfa_factors OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.oauth_authorizations OWNER TO supabase_auth_admin;

--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE auth.oauth_client_states OWNER TO supabase_auth_admin;

--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048))
);


ALTER TABLE auth.oauth_clients OWNER TO supabase_auth_admin;

--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.oauth_consents OWNER TO supabase_auth_admin;

--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.one_time_tokens OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.refresh_tokens OWNER TO supabase_auth_admin;

--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: supabase_auth_admin
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE auth.refresh_tokens_id_seq OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: supabase_auth_admin
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.saml_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.saml_relay_states OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


ALTER TABLE auth.schema_migrations OWNER TO supabase_auth_admin;

--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.sessions OWNER TO supabase_auth_admin;

--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


ALTER TABLE auth.sso_domains OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


ALTER TABLE auth.sso_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
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


ALTER TABLE auth.users OWNER TO supabase_auth_admin;

--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: accounts; Type: TABLE; Schema: next_auth; Owner: postgres
--

CREATE TABLE next_auth.accounts (
    id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    provider character varying(255) NOT NULL,
    provider_account_id character varying(255) NOT NULL,
    "providerAccountId" text GENERATED ALWAYS AS (provider_account_id) STORED
);


ALTER TABLE next_auth.accounts OWNER TO postgres;

--
-- Name: sessions; Type: TABLE; Schema: next_auth; Owner: postgres
--

CREATE TABLE next_auth.sessions (
    id character varying(255) NOT NULL,
    session_token character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    expires timestamp without time zone NOT NULL,
    "sessionToken" text
);


ALTER TABLE next_auth.sessions OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: next_auth; Owner: postgres
--

CREATE TABLE next_auth.users (
    id character varying(255) NOT NULL,
    name character varying(255),
    email character varying(255),
    email_verified boolean DEFAULT false,
    image character varying(255)
);


ALTER TABLE next_auth.users OWNER TO postgres;

--
-- Name: verification_tokens; Type: TABLE; Schema: next_auth; Owner: postgres
--

CREATE TABLE next_auth.verification_tokens (
    identifier character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    expires timestamp without time zone NOT NULL
);


ALTER TABLE next_auth.verification_tokens OWNER TO postgres;

--
-- Name: access_grants_archived; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.access_grants_archived (
    id uuid NOT NULL,
    organization_id uuid,
    user_id uuid,
    role_id uuid,
    system_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.access_grants_archived OWNER TO postgres;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accounts (
    id text NOT NULL,
    user_id text NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    provider_account_id text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at integer,
    token_type text,
    scope text,
    id_token text,
    session_state text,
    oauth_token_secret text,
    oauth_token text,
    "providerAccountId" text GENERATED ALWAYS AS (provider_account_id) STORED
);


ALTER TABLE public.accounts OWNER TO postgres;

--
-- Name: ai_agent_audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_agent_audit_log (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    changed_by uuid,
    change_type text NOT NULL,
    old_config jsonb,
    new_config jsonb,
    change_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_agent_audit_log_change_type_check CHECK ((change_type = ANY (ARRAY['created'::text, 'updated'::text, 'deleted'::text, 'enabled'::text, 'disabled'::text])))
);


ALTER TABLE public.ai_agent_audit_log OWNER TO postgres;

--
-- Name: TABLE ai_agent_audit_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ai_agent_audit_log IS 'Audit trail for AI agent configuration changes';


--
-- Name: ai_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_runs (
    id uuid NOT NULL,
    call_id uuid,
    system_id uuid,
    model text,
    status text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    output jsonb,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    is_authoritative boolean DEFAULT false NOT NULL,
    produced_by text,
    job_id text
);


ALTER TABLE public.ai_runs OWNER TO postgres;

--
-- Name: COLUMN ai_runs.is_authoritative; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ai_runs.is_authoritative IS 'FALSE by default - AI runs are execution records, not canonical evidence';


--
-- Name: COLUMN ai_runs.produced_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ai_runs.produced_by IS 'The AI model or worker that produced this run (e.g., assemblyai, openai-gpt4)';


--
-- Name: alert_acknowledgements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alert_acknowledgements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alert_id uuid,
    user_id uuid,
    acknowledged_at timestamp with time zone DEFAULT now(),
    acknowledgement_message text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.alert_acknowledgements OWNER TO postgres;

--
-- Name: alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    test_config_id uuid,
    rule jsonb,
    enabled boolean DEFAULT true,
    last_triggered timestamp with time zone
);


ALTER TABLE public.alerts OWNER TO postgres;

--
-- Name: artifact_provenance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.artifact_provenance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    artifact_type text NOT NULL,
    artifact_id uuid NOT NULL,
    parent_artifact_id uuid,
    parent_artifact_type text,
    produced_by text NOT NULL,
    produced_by_model text,
    produced_by_user_id uuid,
    produced_by_system_id uuid,
    produced_at timestamp with time zone DEFAULT now() NOT NULL,
    input_refs jsonb,
    version integer DEFAULT 1 NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT artifact_provenance_artifact_type_check CHECK ((artifact_type = ANY (ARRAY['recording'::text, 'transcript'::text, 'translation'::text, 'survey'::text, 'score'::text, 'evidence_manifest'::text, 'evidence_bundle'::text]))),
    CONSTRAINT artifact_provenance_produced_by_check CHECK ((produced_by = ANY (ARRAY['system'::text, 'human'::text, 'model'::text])))
);


ALTER TABLE public.artifact_provenance OWNER TO postgres;

--
-- Name: TABLE artifact_provenance; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.artifact_provenance IS 'Chain of custody for all artifacts - tracks who/what/when/how';


--
-- Name: artifacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.artifacts (
    id text NOT NULL,
    type text NOT NULL,
    title text,
    created_at timestamp with time zone DEFAULT now(),
    duration_seconds integer,
    size_bytes bigint,
    storage_bucket text,
    storage_path text,
    provenance jsonb,
    transcript jsonb,
    evidence_manifest jsonb
);


ALTER TABLE public.artifacts OWNER TO postgres;

--
-- Name: attention_decisions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attention_decisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    attention_event_id uuid NOT NULL,
    decision text NOT NULL,
    reason text NOT NULL,
    policy_id uuid,
    confidence integer,
    uncertainty_notes text,
    produced_by text NOT NULL,
    produced_by_model text,
    produced_by_user_id uuid,
    input_refs jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attention_decisions_confidence_check CHECK (((confidence >= 0) AND (confidence <= 100))),
    CONSTRAINT attention_decisions_decision_check CHECK ((decision = ANY (ARRAY['escalate'::text, 'suppress'::text, 'include_in_digest'::text, 'needs_review'::text]))),
    CONSTRAINT attention_decisions_produced_by_check CHECK ((produced_by = ANY (ARRAY['system'::text, 'human'::text, 'model'::text])))
);


ALTER TABLE public.attention_decisions OWNER TO postgres;

--
-- Name: TABLE attention_decisions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.attention_decisions IS 'Append-only judgments on events. Includes provenance and reason.';


--
-- Name: COLUMN attention_decisions.produced_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.attention_decisions.produced_by IS 'Attribution: system (rules), human (override), or model (AI-assisted).';


--
-- Name: COLUMN attention_decisions.input_refs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.attention_decisions.input_refs IS 'JSON array of {table, id} pairs referencing canonical artifacts.';


--
-- Name: attention_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attention_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    event_type text NOT NULL,
    source_table text NOT NULL,
    source_id uuid NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    payload_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    input_refs jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attention_events_event_type_check CHECK ((event_type = ANY (ARRAY['call_completed'::text, 'alert_triggered'::text, 'webhook_failed'::text, 'carrier_degraded'::text, 'campaign_ended'::text, 'evidence_generated'::text, 'system_error'::text])))
);


ALTER TABLE public.attention_events OWNER TO postgres;

--
-- Name: TABLE attention_events; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.attention_events IS 'Append-only stream of normalized return traffic from canonical sources.';


--
-- Name: attention_policies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attention_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    policy_type text NOT NULL,
    policy_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attention_policies_policy_type_check CHECK ((policy_type = ANY (ARRAY['quiet_hours'::text, 'threshold'::text, 'recurring_suppress'::text, 'keyword_escalate'::text, 'custom'::text])))
);


ALTER TABLE public.attention_policies OWNER TO postgres;

--
-- Name: TABLE attention_policies; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.attention_policies IS 'Human-authored routing rules for attention events. Controls escalation/suppression.';


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid NOT NULL,
    organization_id uuid,
    user_id uuid,
    system_id uuid,
    resource_type text,
    resource_id uuid,
    action text,
    before jsonb,
    after jsonb,
    created_at timestamp with time zone DEFAULT now(),
    actor_type text,
    actor_label text,
    CONSTRAINT audit_logs_actor_type_check CHECK ((actor_type = ANY (ARRAY['human'::text, 'system'::text, 'vendor'::text, 'automation'::text])))
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: booking_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.booking_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid,
    call_id uuid,
    title text NOT NULL,
    description text,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    duration_minutes integer DEFAULT 30 NOT NULL,
    timezone text DEFAULT 'UTC'::text,
    attendee_name text,
    attendee_email text,
    attendee_phone text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reminder_sent boolean DEFAULT false,
    modulations jsonb DEFAULT '{}'::jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    from_number text
);


ALTER TABLE public.booking_events OWNER TO postgres;

--
-- Name: TABLE booking_events; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.booking_events IS 'Cal.com-style scheduled call bookings';


--
-- Name: COLUMN booking_events.call_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.booking_events.call_id IS 'Linked call record after call is placed';


--
-- Name: COLUMN booking_events.modulations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.booking_events.modulations IS 'Override call modulations (record, transcribe, translate, etc.)';


--
-- Name: call_confirmation_checklists; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.call_confirmation_checklists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    call_id uuid NOT NULL,
    template_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    confirmation_id uuid,
    skip_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT call_confirmation_checklists_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'declined'::text, 'skipped'::text, 'not_applicable'::text])))
);


ALTER TABLE public.call_confirmation_checklists OWNER TO postgres;

--
-- Name: TABLE call_confirmation_checklists; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.call_confirmation_checklists IS 'Links confirmation templates to specific calls, tracking completion status.';


--
-- Name: call_confirmations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.call_confirmations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    call_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    confirmation_type text NOT NULL,
    confirmation_label text,
    prompt_text text NOT NULL,
    confirmer_role text NOT NULL,
    confirmed_at timestamp with time zone DEFAULT now() NOT NULL,
    recording_timestamp_seconds numeric(10,2),
    captured_by text DEFAULT 'human'::text NOT NULL,
    captured_by_user_id uuid,
    verification_method text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT call_confirmations_captured_by_check CHECK ((captured_by = ANY (ARRAY['human'::text, 'system'::text]))),
    CONSTRAINT call_confirmations_confirmation_type_check CHECK ((confirmation_type = ANY (ARRAY['disclosure_accepted'::text, 'recording_consent'::text, 'terms_agreed'::text, 'price_confirmed'::text, 'scope_confirmed'::text, 'identity_verified'::text, 'authorization_given'::text, 'understanding_confirmed'::text, 'custom'::text]))),
    CONSTRAINT call_confirmations_confirmer_role_check CHECK ((confirmer_role = ANY (ARRAY['customer'::text, 'operator'::text, 'third_party'::text, 'both'::text]))),
    CONSTRAINT call_confirmations_verification_method_check CHECK ((verification_method = ANY (ARRAY['verbal'::text, 'keypress'::text, 'biometric'::text, 'document'::text, 'other'::text])))
);


ALTER TABLE public.call_confirmations OWNER TO postgres;

--
-- Name: TABLE call_confirmations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.call_confirmations IS 'Tracks operator-captured confirmations during calls. Per AI Role Policy: operators ask questions, humans answer, operators mark captured.';


--
-- Name: COLUMN call_confirmations.recording_timestamp_seconds; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.call_confirmations.recording_timestamp_seconds IS 'Position in the call recording where confirmation was given, for evidence linking';


--
-- Name: COLUMN call_confirmations.captured_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.call_confirmations.captured_by IS 'Who/what marked this confirmation - "human" for operator click, "system" for auto-detection';


--
-- Name: calls; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calls (
    id uuid NOT NULL,
    organization_id uuid,
    system_id uuid,
    status text,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    created_by uuid,
    call_sid text,
    disposition text,
    disposition_set_at timestamp with time zone,
    disposition_set_by uuid,
    consent_method text,
    consent_timestamp timestamp with time zone,
    consent_audio_offset_ms integer,
    disposition_notes text,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    is_authoritative boolean DEFAULT true NOT NULL,
    immutability_policy text DEFAULT 'limited'::text NOT NULL,
    custody_status text DEFAULT 'active'::text NOT NULL,
    retention_class text DEFAULT 'default'::text NOT NULL,
    legal_hold_flag boolean DEFAULT false NOT NULL,
    evidence_completeness text DEFAULT 'unknown'::text NOT NULL,
    disclosure_type text,
    disclosure_given boolean DEFAULT false,
    disclosure_timestamp timestamp with time zone,
    disclosure_text text,
    caller_id_number_id uuid,
    caller_id_used text,
    CONSTRAINT calls_consent_method_check CHECK ((consent_method = ANY (ARRAY['ivr_played'::text, 'verbal_yes'::text, 'dtmf_confirm'::text, 'written'::text, 'assumed'::text, 'none'::text]))),
    CONSTRAINT calls_custody_status_check CHECK ((custody_status = ANY (ARRAY['active'::text, 'archived'::text, 'legal_hold'::text, 'expired'::text]))),
    CONSTRAINT calls_disclosure_type_check CHECK ((disclosure_type = ANY (ARRAY['recording'::text, 'survey'::text, 'translation'::text, 'qa_evaluation'::text, 'multi'::text]))),
    CONSTRAINT calls_disposition_check CHECK ((disposition = ANY (ARRAY['sale'::text, 'no_answer'::text, 'voicemail'::text, 'not_interested'::text, 'follow_up'::text, 'wrong_number'::text, 'other'::text]))),
    CONSTRAINT calls_evidence_completeness_check CHECK ((evidence_completeness = ANY (ARRAY['unknown'::text, 'partial'::text, 'complete'::text, 'failed'::text]))),
    CONSTRAINT calls_id_format CHECK (((id IS NOT NULL) AND ((id)::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::text))),
    CONSTRAINT calls_immutability_policy_check CHECK ((immutability_policy = ANY (ARRAY['immutable'::text, 'limited'::text, 'mutable'::text]))),
    CONSTRAINT calls_retention_class_check CHECK ((retention_class = ANY (ARRAY['default'::text, 'regulated'::text, 'legal_hold'::text]))),
    CONSTRAINT calls_time_order CHECK (((ended_at IS NULL) OR (started_at IS NULL) OR (started_at <= ended_at)))
);


ALTER TABLE public.calls OWNER TO postgres;

--
-- Name: COLUMN calls.is_authoritative; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.calls.is_authoritative IS 'TRUE - calls are the root entity and always authoritative';


--
-- Name: COLUMN calls.immutability_policy; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.calls.immutability_policy IS 'Limited - only status, ended_at, call_sid can be updated';


--
-- Name: COLUMN calls.disclosure_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.calls.disclosure_type IS 'Type of disclosure given for this call';


--
-- Name: COLUMN calls.disclosure_given; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.calls.disclosure_given IS 'Whether disclosure was provided before call processing';


--
-- Name: COLUMN calls.caller_id_number_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.calls.caller_id_number_id IS 'FK to caller_id_numbers for audit trail';


--
-- Name: COLUMN calls.caller_id_used; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.calls.caller_id_used IS 'E.164 snapshot of caller ID displayed for this call';


--
-- Name: evidence_manifests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evidence_manifests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    recording_id uuid NOT NULL,
    scorecard_id uuid,
    manifest jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    version integer DEFAULT 1 NOT NULL,
    parent_manifest_id uuid,
    superseded_at timestamp with time zone,
    superseded_by uuid,
    is_authoritative boolean DEFAULT true NOT NULL,
    produced_by text DEFAULT 'system_cas'::text NOT NULL,
    immutability_policy text DEFAULT 'immutable'::text NOT NULL,
    cryptographic_hash text,
    CONSTRAINT evidence_manifests_immutability_policy_check CHECK ((immutability_policy = ANY (ARRAY['immutable'::text, 'limited'::text, 'mutable'::text])))
);


ALTER TABLE public.evidence_manifests OWNER TO postgres;

--
-- Name: COLUMN evidence_manifests.is_authoritative; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.evidence_manifests.is_authoritative IS 'TRUE for all evidence manifests (canonical provenance records)';


--
-- Name: COLUMN evidence_manifests.produced_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.evidence_manifests.produced_by IS 'Producer: system_cas (content-addressable storage)';


--
-- Name: COLUMN evidence_manifests.cryptographic_hash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.evidence_manifests.cryptographic_hash IS 'SHA256 hash of manifest content for integrity verification';


--
-- Name: recordings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recordings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    call_sid text NOT NULL,
    recording_sid text,
    recording_url text NOT NULL,
    duration_seconds integer,
    transcript_json jsonb,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tool_id uuid NOT NULL,
    created_by uuid,
    has_live_translation boolean DEFAULT false NOT NULL,
    live_translation_provider text,
    source text DEFAULT 'signalwire'::text NOT NULL,
    external_call_id text,
    media_hash text,
    is_altered boolean DEFAULT false,
    original_url text,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    is_authoritative boolean DEFAULT true NOT NULL,
    immutability_policy text DEFAULT 'immutable'::text NOT NULL,
    custody_status text DEFAULT 'active'::text NOT NULL,
    retention_class text DEFAULT 'default'::text NOT NULL,
    legal_hold_flag boolean DEFAULT false NOT NULL,
    evidence_completeness text DEFAULT 'unknown'::text NOT NULL,
    disclosure_given boolean DEFAULT false,
    disclosure_type text,
    call_id uuid,
    CONSTRAINT recordings_custody_status_check CHECK ((custody_status = ANY (ARRAY['active'::text, 'archived'::text, 'legal_hold'::text, 'expired'::text]))),
    CONSTRAINT recordings_duration_valid CHECK (((duration_seconds IS NULL) OR (duration_seconds >= 0))),
    CONSTRAINT recordings_evidence_completeness_check CHECK ((evidence_completeness = ANY (ARRAY['unknown'::text, 'partial'::text, 'complete'::text, 'failed'::text]))),
    CONSTRAINT recordings_immutability_policy_check CHECK ((immutability_policy = ANY (ARRAY['immutable'::text, 'limited'::text, 'mutable'::text]))),
    CONSTRAINT recordings_live_translation_provider_check CHECK (((live_translation_provider = 'signalwire'::text) OR (live_translation_provider IS NULL))),
    CONSTRAINT recordings_retention_class_check CHECK ((retention_class = ANY (ARRAY['default'::text, 'regulated'::text, 'legal_hold'::text]))),
    CONSTRAINT recordings_source_check CHECK ((source = ANY (ARRAY['signalwire'::text, 'webrtc'::text, 'upload'::text, 'external'::text])))
);


ALTER TABLE public.recordings OWNER TO postgres;

--
-- Name: TABLE recordings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.recordings IS 'Captured call recordings with optional transcripts and sentiment analysis';


--
-- Name: COLUMN recordings.has_live_translation; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.recordings.has_live_translation IS 'Whether this call used live translation (SignalWire AI Agent)';


--
-- Name: COLUMN recordings.live_translation_provider; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.recordings.live_translation_provider IS 'Provider used for live translation (e.g., signalwire)';


--
-- Name: COLUMN recordings.is_authoritative; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.recordings.is_authoritative IS 'TRUE if this recording is canonical evidence (always TRUE for recordings)';


--
-- Name: COLUMN recordings.immutability_policy; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.recordings.immutability_policy IS 'Level of mutability: immutable (no changes), limited (status only), mutable (full CRUD)';


--
-- Name: scored_recordings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scored_recordings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    recording_id uuid NOT NULL,
    scorecard_id uuid NOT NULL,
    scores_json jsonb NOT NULL,
    total_score numeric(5,2),
    manual_overrides_json jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    deleted_by uuid
);


ALTER TABLE public.scored_recordings OWNER TO postgres;

--
-- Name: TABLE scored_recordings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.scored_recordings IS 'Results of applying a scorecard to a recording';


--
-- Name: call_debug_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.call_debug_view AS
 SELECT c.id AS call_id,
    c.organization_id,
    c.status AS call_status,
    c.call_sid,
    c.started_at,
    c.ended_at,
    c.created_by,
    c.is_deleted AS call_deleted,
    r.id AS recording_id,
    r.recording_url,
    r.duration_seconds,
    r.status AS recording_status,
    r.source AS recording_source,
    (r.transcript_json IS NOT NULL) AS has_transcript,
    r.is_deleted AS recording_deleted,
    ( SELECT count(*) AS count
           FROM public.ai_runs ar
          WHERE (ar.call_id = c.id)) AS ai_run_count,
    ( SELECT json_agg(json_build_object('id', ar.id, 'model', ar.model, 'status', ar.status)) AS json_agg
           FROM public.ai_runs ar
          WHERE (ar.call_id = c.id)) AS ai_runs,
    em.id AS manifest_id,
    em.version AS manifest_version,
    sr.id AS score_id,
    sr.total_score,
    ( SELECT count(*) AS count
           FROM public.audit_logs al
          WHERE ((al.resource_id = c.id) AND (al.resource_type = 'calls'::text))) AS audit_log_count,
    ( SELECT json_agg(json_build_object('action', al.action, 'created_at', al.created_at) ORDER BY al.created_at DESC) AS json_agg
           FROM public.audit_logs al
          WHERE ((al.resource_id = c.id) AND (al.resource_type = 'calls'::text))
         LIMIT 10) AS recent_audit_events
   FROM (((public.calls c
     LEFT JOIN public.recordings r ON (((r.call_sid = c.call_sid) AND (r.is_deleted = false))))
     LEFT JOIN public.evidence_manifests em ON (((em.recording_id = r.id) AND (em.superseded_at IS NULL))))
     LEFT JOIN public.scored_recordings sr ON (((sr.recording_id = r.id) AND (sr.is_deleted = false))))
  WHERE (c.is_deleted = false);


ALTER VIEW public.call_debug_view OWNER TO postgres;

--
-- Name: VIEW call_debug_view; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.call_debug_view IS 'Operational view for reconstructing call state in <30 seconds';


--
-- Name: call_export_bundles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.call_export_bundles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    call_id uuid NOT NULL,
    bundle_hash text NOT NULL,
    artifacts_included jsonb NOT NULL,
    storage_path text,
    exported_by uuid,
    exported_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    download_count integer DEFAULT 0,
    metadata jsonb
);


ALTER TABLE public.call_export_bundles OWNER TO postgres;

--
-- Name: TABLE call_export_bundles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.call_export_bundles IS 'Self-contained export bundles for portability';


--
-- Name: call_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.call_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    call_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    note text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.call_notes OWNER TO postgres;

--
-- Name: caller_id_default_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.caller_id_default_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    scope_type text NOT NULL,
    user_id uuid,
    role_scope text,
    caller_id_number_id uuid NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    effective_until timestamp with time zone,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT caller_id_default_rules_scope_check CHECK ((((scope_type = 'user'::text) AND (user_id IS NOT NULL)) OR ((scope_type = 'organization'::text) AND (user_id IS NULL)) OR ((scope_type = 'role'::text) AND (role_scope IS NOT NULL)))),
    CONSTRAINT caller_id_default_rules_scope_type_check CHECK ((scope_type = ANY (ARRAY['organization'::text, 'user'::text, 'role'::text])))
);


ALTER TABLE public.caller_id_default_rules OWNER TO postgres;

--
-- Name: TABLE caller_id_default_rules; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.caller_id_default_rules IS 'Explicit default rules for caller ID selection. No implicit magic.';


--
-- Name: COLUMN caller_id_default_rules.priority; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.caller_id_default_rules.priority IS 'Lower number = higher priority. User defaults override org defaults.';


--
-- Name: caller_id_numbers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.caller_id_numbers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    phone_number text NOT NULL,
    display_name text,
    is_verified boolean DEFAULT false,
    verification_code text,
    verified_at timestamp with time zone,
    signalwire_verification_sid text,
    is_default boolean DEFAULT false,
    use_count integer DEFAULT 0,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    status text DEFAULT 'active'::text NOT NULL,
    retired_at timestamp with time zone,
    retired_by uuid,
    notes text,
    CONSTRAINT caller_id_numbers_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'retired'::text])))
);


ALTER TABLE public.caller_id_numbers OWNER TO postgres;

--
-- Name: TABLE caller_id_numbers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.caller_id_numbers IS 'Verified caller ID numbers for outbound call masking';


--
-- Name: COLUMN caller_id_numbers.phone_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.caller_id_numbers.phone_number IS 'E.164 format phone number to display';


--
-- Name: COLUMN caller_id_numbers.is_verified; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.caller_id_numbers.is_verified IS 'Number verified via SignalWire validation call';


--
-- Name: caller_id_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.caller_id_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    caller_id_number_id uuid NOT NULL,
    user_id uuid NOT NULL,
    permission_type text DEFAULT 'use'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_by uuid NOT NULL,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    revoke_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT caller_id_permissions_permission_type_check CHECK ((permission_type = ANY (ARRAY['use'::text, 'manage'::text, 'full'::text])))
);


ALTER TABLE public.caller_id_permissions OWNER TO postgres;

--
-- Name: TABLE caller_id_permissions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.caller_id_permissions IS 'User-level permissions for caller ID usage. Admins grant, operators use.';


--
-- Name: COLUMN caller_id_permissions.permission_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.caller_id_permissions.permission_type IS 'use=call only, manage=edit number, full=grant to others';


--
-- Name: campaign_audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.campaign_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    user_id uuid,
    action text NOT NULL,
    changes jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.campaign_audit_log OWNER TO postgres;

--
-- Name: TABLE campaign_audit_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.campaign_audit_log IS 'Audit trail for all campaign actions';


--
-- Name: campaign_calls; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.campaign_calls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    call_id uuid,
    target_phone text NOT NULL,
    target_metadata jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    attempt_number integer DEFAULT 1 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    outcome text,
    duration_seconds integer,
    error_message text,
    score_data jsonb,
    scheduled_for timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT campaign_calls_outcome_check CHECK ((outcome = ANY (ARRAY['answered'::text, 'no_answer'::text, 'busy'::text, 'failed'::text, 'error'::text]))),
    CONSTRAINT campaign_calls_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'calling'::text, 'completed'::text, 'failed'::text, 'canceled'::text])))
);


ALTER TABLE public.campaign_calls OWNER TO postgres;

--
-- Name: TABLE campaign_calls; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.campaign_calls IS 'Individual call tracking within campaigns';


--
-- Name: COLUMN campaign_calls.score_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.campaign_calls.score_data IS 'Quality scorecard results for secret shopper calls';


--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'draft'::text NOT NULL,
    call_flow_type text NOT NULL,
    target_list jsonb DEFAULT '[]'::jsonb NOT NULL,
    caller_id_id uuid,
    script_id uuid,
    survey_id uuid,
    custom_prompt text,
    schedule_type text DEFAULT 'immediate'::text NOT NULL,
    scheduled_at timestamp with time zone,
    recurring_pattern jsonb,
    call_config jsonb DEFAULT '{}'::jsonb,
    total_targets integer DEFAULT 0 NOT NULL,
    calls_completed integer DEFAULT 0 NOT NULL,
    calls_successful integer DEFAULT 0 NOT NULL,
    calls_failed integer DEFAULT 0 NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    CONSTRAINT campaigns_call_flow_type_check CHECK ((call_flow_type = ANY (ARRAY['secret_shopper'::text, 'survey'::text, 'outbound'::text, 'test'::text]))),
    CONSTRAINT campaigns_schedule_type_check CHECK ((schedule_type = ANY (ARRAY['immediate'::text, 'scheduled'::text, 'recurring'::text]))),
    CONSTRAINT campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'active'::text, 'paused'::text, 'completed'::text, 'canceled'::text])))
);


ALTER TABLE public.campaigns OWNER TO postgres;

--
-- Name: TABLE campaigns; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.campaigns IS 'Campaign management for bulk call operations (secret shopper, surveys, outbound)';


--
-- Name: COLUMN campaigns.target_list; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.campaigns.target_list IS 'JSON array of call targets with phone numbers and metadata';


--
-- Name: COLUMN campaigns.recurring_pattern; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.campaigns.recurring_pattern IS 'Recurring schedule pattern in cron-like format';


--
-- Name: capabilities_archived; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.capabilities_archived (
    id uuid NOT NULL,
    system_id uuid,
    action text NOT NULL,
    description text
);


ALTER TABLE public.capabilities_archived OWNER TO postgres;

--
-- Name: carrier_status; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carrier_status (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    carrier_name text NOT NULL,
    status text NOT NULL,
    last_updated timestamp with time zone DEFAULT now(),
    official_url text,
    status_page_api text,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    incident_count integer DEFAULT 0,
    last_incident_at timestamp with time zone,
    CONSTRAINT carrier_status_status_check CHECK ((status = ANY (ARRAY['operational'::text, 'degraded'::text, 'outage'::text])))
);


ALTER TABLE public.carrier_status OWNER TO postgres;

--
-- Name: TABLE carrier_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.carrier_status IS 'Real-time health status of major VoIP carriers';


--
-- Name: COLUMN carrier_status.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carrier_status.status IS 'Current operational status: operational, degraded, or outage';


--
-- Name: COLUMN carrier_status.incident_count; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.carrier_status.incident_count IS 'Total number of incidents tracked for this carrier';


--
-- Name: carrier_health_public; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.carrier_health_public AS
 SELECT carrier_name,
    status,
    last_updated,
    official_url,
    description,
        CASE
            WHEN (last_updated > (now() - '00:10:00'::interval)) THEN true
            ELSE false
        END AS is_fresh
   FROM public.carrier_status
  ORDER BY carrier_name;


ALTER VIEW public.carrier_health_public OWNER TO postgres;

--
-- Name: compliance_restrictions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.compliance_restrictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    restriction_code text NOT NULL,
    restriction_name text NOT NULL,
    description text NOT NULL,
    is_active boolean DEFAULT true,
    violation_action text DEFAULT 'warn'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compliance_restrictions_restriction_code_check CHECK ((restriction_code = ANY (ARRAY['QA_NO_CONFIRMATIONS'::text, 'QA_NO_OUTCOMES'::text, 'QA_NO_AGREEMENTS'::text, 'SURVEY_NO_AGREEMENTS'::text, 'AI_NO_NEGOTIATION'::text]))),
    CONSTRAINT compliance_restrictions_violation_action_check CHECK ((violation_action = ANY (ARRAY['block'::text, 'warn'::text, 'log'::text])))
);


ALTER TABLE public.compliance_restrictions OWNER TO postgres;

--
-- Name: TABLE compliance_restrictions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.compliance_restrictions IS 'Defines compliance restrictions for AI Role Policy. Prevents conflicting features from being used together.';


--
-- Name: compliance_violations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.compliance_violations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    call_id uuid,
    user_id uuid,
    restriction_code text NOT NULL,
    violation_type text NOT NULL,
    violation_context jsonb,
    resolution_status text DEFAULT 'open'::text,
    resolution_notes text,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compliance_violations_resolution_status_check CHECK ((resolution_status = ANY (ARRAY['open'::text, 'reviewed'::text, 'dismissed'::text, 'confirmed'::text]))),
    CONSTRAINT compliance_violations_violation_type_check CHECK ((violation_type = ANY (ARRAY['blocked'::text, 'warned'::text, 'detected'::text, 'prevented'::text])))
);


ALTER TABLE public.compliance_violations OWNER TO postgres;

--
-- Name: TABLE compliance_violations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.compliance_violations IS 'Logs potential compliance violations for audit. Used to track and review any policy conflicts.';


--
-- Name: confirmation_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.confirmation_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    confirmation_type text NOT NULL,
    label text NOT NULL,
    prompt_text text NOT NULL,
    description text,
    icon text DEFAULT '📋'::text,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    is_required boolean DEFAULT false,
    use_cases text[] DEFAULT ARRAY['general'::text],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


ALTER TABLE public.confirmation_templates OWNER TO postgres;

--
-- Name: TABLE confirmation_templates; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.confirmation_templates IS 'Pre-defined confirmation prompts that guide operators on what to ask during calls.';


--
-- Name: COLUMN confirmation_templates.is_required; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.confirmation_templates.is_required IS 'If true, operator must address this confirmation before call can be completed';


--
-- Name: crm_object_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.crm_object_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    integration_id uuid NOT NULL,
    call_id uuid NOT NULL,
    crm_object_type text NOT NULL,
    crm_object_id text NOT NULL,
    crm_object_name text,
    crm_object_url text,
    synced_at timestamp with time zone,
    sync_direction text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crm_object_links_crm_object_type_check CHECK ((crm_object_type = ANY (ARRAY['contact'::text, 'company'::text, 'deal'::text, 'lead'::text, 'account'::text, 'opportunity'::text]))),
    CONSTRAINT crm_object_links_sync_direction_check CHECK ((sync_direction = ANY (ARRAY['inbound'::text, 'outbound'::text])))
);


ALTER TABLE public.crm_object_links OWNER TO postgres;

--
-- Name: TABLE crm_object_links; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.crm_object_links IS 'Maps calls to CRM contacts/companies/deals. Read-only references from CRM.';


--
-- Name: crm_sync_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.crm_sync_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    integration_id uuid NOT NULL,
    operation text NOT NULL,
    status text NOT NULL,
    call_id uuid,
    export_bundle_id uuid,
    crm_object_link_id uuid,
    idempotency_key text,
    request_summary jsonb,
    response_summary jsonb,
    error_details jsonb,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    triggered_by text NOT NULL,
    triggered_by_user_id uuid,
    CONSTRAINT crm_sync_log_operation_check CHECK ((operation = ANY (ARRAY['oauth_connect'::text, 'oauth_disconnect'::text, 'oauth_refresh'::text, 'push_evidence'::text, 'push_note'::text, 'push_engagement'::text, 'pull_contact'::text, 'pull_company'::text, 'pull_deal'::text, 'link_object'::text, 'unlink_object'::text, 'error'::text, 'rate_limited'::text]))),
    CONSTRAINT crm_sync_log_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text, 'rate_limited'::text, 'skipped'::text]))),
    CONSTRAINT crm_sync_log_triggered_by_check CHECK ((triggered_by = ANY (ARRAY['user'::text, 'system'::text, 'webhook'::text, 'scheduler'::text])))
);


ALTER TABLE public.crm_sync_log OWNER TO postgres;

--
-- Name: TABLE crm_sync_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.crm_sync_log IS 'Append-only audit trail for all CRM operations. Idempotency keys for retry safety.';


--
-- Name: digest_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.digest_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    digest_id uuid NOT NULL,
    attention_decision_id uuid NOT NULL,
    item_order integer NOT NULL,
    is_highlighted boolean DEFAULT false NOT NULL,
    highlight_reason text
);


ALTER TABLE public.digest_items OWNER TO postgres;

--
-- Name: digests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.digests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    digest_type text NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    summary_text text NOT NULL,
    total_events integer DEFAULT 0 NOT NULL,
    escalated_count integer DEFAULT 0 NOT NULL,
    suppressed_count integer DEFAULT 0 NOT NULL,
    needs_review_count integer DEFAULT 0 NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated_by text DEFAULT 'system'::text NOT NULL,
    generated_by_user_id uuid,
    CONSTRAINT digests_digest_type_check CHECK ((digest_type = ANY (ARRAY['overnight'::text, 'weekly'::text, 'on_demand'::text])))
);


ALTER TABLE public.digests OWNER TO postgres;

--
-- Name: TABLE digests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.digests IS 'Periodic summaries (overnight, weekly). Append-only.';


--
-- Name: disclosure_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.disclosure_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    call_id uuid,
    disclosure_type text NOT NULL,
    disclosure_text text NOT NULL,
    disclosed_at timestamp with time zone DEFAULT now() NOT NULL,
    disclosure_method text DEFAULT 'tts'::text NOT NULL,
    caller_response text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT disclosure_logs_disclosure_method_check CHECK ((disclosure_method = ANY (ARRAY['tts'::text, 'prerecorded'::text, 'ivr'::text, 'agent'::text]))),
    CONSTRAINT disclosure_logs_disclosure_type_check CHECK ((disclosure_type = ANY (ARRAY['recording'::text, 'survey'::text, 'translation'::text, 'qa_evaluation'::text, 'multi'::text])))
);


ALTER TABLE public.disclosure_logs OWNER TO postgres;

--
-- Name: TABLE disclosure_logs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.disclosure_logs IS 'Audit trail for AI disclosures per AI Role Policy compliance';


--
-- Name: COLUMN disclosure_logs.disclosure_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.disclosure_logs.disclosure_type IS 'Type of disclosure: recording, survey, translation, qa_evaluation, or multi';


--
-- Name: COLUMN disclosure_logs.disclosure_method; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.disclosure_logs.disclosure_method IS 'How disclosure was delivered: tts, prerecorded, ivr, or agent';


--
-- Name: evidence_bundles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evidence_bundles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    call_id uuid NOT NULL,
    recording_id uuid,
    manifest_id uuid NOT NULL,
    manifest_hash text NOT NULL,
    artifact_hashes jsonb DEFAULT '[]'::jsonb NOT NULL,
    bundle_payload jsonb NOT NULL,
    bundle_hash text NOT NULL,
    bundle_hash_algo text DEFAULT 'sha256'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    parent_bundle_id uuid,
    superseded_at timestamp with time zone,
    superseded_by uuid,
    immutable_storage boolean DEFAULT true NOT NULL,
    is_authoritative boolean DEFAULT true NOT NULL,
    produced_by text DEFAULT 'system_cas'::text NOT NULL,
    immutability_policy text DEFAULT 'immutable'::text NOT NULL,
    tsa jsonb,
    tsa_status text DEFAULT 'not_configured'::text NOT NULL,
    tsa_requested_at timestamp with time zone,
    tsa_received_at timestamp with time zone,
    tsa_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    custody_status text DEFAULT 'active'::text NOT NULL,
    retention_class text DEFAULT 'default'::text NOT NULL,
    legal_hold_flag boolean DEFAULT false NOT NULL,
    evidence_completeness text DEFAULT 'unknown'::text NOT NULL,
    CONSTRAINT evidence_bundles_custody_status_check CHECK ((custody_status = ANY (ARRAY['active'::text, 'archived'::text, 'legal_hold'::text, 'expired'::text]))),
    CONSTRAINT evidence_bundles_evidence_completeness_check CHECK ((evidence_completeness = ANY (ARRAY['unknown'::text, 'partial'::text, 'complete'::text, 'failed'::text]))),
    CONSTRAINT evidence_bundles_immutability_policy_check CHECK ((immutability_policy = ANY (ARRAY['immutable'::text, 'limited'::text, 'mutable'::text]))),
    CONSTRAINT evidence_bundles_retention_class_check CHECK ((retention_class = ANY (ARRAY['default'::text, 'regulated'::text, 'legal_hold'::text]))),
    CONSTRAINT evidence_bundles_tsa_status_check CHECK ((tsa_status = ANY (ARRAY['not_configured'::text, 'pending'::text, 'completed'::text, 'error'::text])))
);


ALTER TABLE public.evidence_bundles OWNER TO postgres;

--
-- Name: execution_contexts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.execution_contexts (
    id uuid NOT NULL,
    name text,
    isolation_level text,
    description text
);


ALTER TABLE public.execution_contexts OWNER TO postgres;

--
-- Name: export_compliance_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.export_compliance_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    call_id uuid NOT NULL,
    bundle_id uuid,
    retention_check_passed boolean NOT NULL,
    legal_hold_check_passed boolean NOT NULL,
    custody_status_at_export text NOT NULL,
    retention_class_at_export text NOT NULL,
    export_allowed boolean NOT NULL,
    denial_reason text,
    requested_by uuid NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    decision_metadata jsonb
);


ALTER TABLE public.export_compliance_log OWNER TO postgres;

--
-- Name: external_entities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.external_entities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    display_name text,
    entity_type text DEFAULT 'contact'::text NOT NULL,
    notes text,
    tags text[],
    metadata jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT external_entities_entity_type_check CHECK ((entity_type = ANY (ARRAY['contact'::text, 'company'::text, 'location'::text, 'other'::text])))
);


ALTER TABLE public.external_entities OWNER TO postgres;

--
-- Name: TABLE external_entities; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.external_entities IS 'Org-scoped external party records. No cross-org visibility.';


--
-- Name: external_entity_identifiers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.external_entity_identifiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    entity_id uuid,
    identifier_type text NOT NULL,
    identifier_value text NOT NULL,
    identifier_normalized text NOT NULL,
    first_observed_at timestamp with time zone DEFAULT now() NOT NULL,
    last_observed_at timestamp with time zone DEFAULT now() NOT NULL,
    observation_count integer DEFAULT 1 NOT NULL,
    first_observed_source text,
    first_observed_source_id uuid,
    is_verified boolean DEFAULT false NOT NULL,
    verified_at timestamp with time zone,
    verified_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT external_entity_identifiers_identifier_type_check CHECK ((identifier_type = ANY (ARRAY['phone'::text, 'email_domain'::text, 'email'::text, 'crm_object'::text, 'other'::text])))
);


ALTER TABLE public.external_entity_identifiers OWNER TO postgres;

--
-- Name: TABLE external_entity_identifiers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.external_entity_identifiers IS 'Observed identifiers (phone, email). Unique per org.';


--
-- Name: external_entity_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.external_entity_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    link_type text NOT NULL,
    source_entity_id uuid,
    target_entity_id uuid,
    identifier_id uuid,
    created_by uuid NOT NULL,
    reason text,
    is_active boolean DEFAULT true NOT NULL,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    revoke_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT external_entity_links_link_type_check CHECK ((link_type = ANY (ARRAY['identifier_to_entity'::text, 'entity_merge'::text, 'entity_split'::text, 'identifier_transfer'::text])))
);


ALTER TABLE public.external_entity_links OWNER TO postgres;

--
-- Name: TABLE external_entity_links; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.external_entity_links IS 'Human-attributed assertions linking entities/identifiers. Auditable.';


--
-- Name: external_entity_observations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.external_entity_observations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    identifier_id uuid NOT NULL,
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    role text,
    direction text,
    observed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT external_entity_observations_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text]))),
    CONSTRAINT external_entity_observations_role_check CHECK ((role = ANY (ARRAY['caller'::text, 'callee'::text, 'participant'::text, 'target'::text, 'other'::text]))),
    CONSTRAINT external_entity_observations_source_type_check CHECK ((source_type = ANY (ARRAY['call'::text, 'target'::text, 'campaign_call'::text, 'booking'::text, 'manual'::text])))
);


ALTER TABLE public.external_entity_observations OWNER TO postgres;

--
-- Name: TABLE external_entity_observations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.external_entity_observations IS 'Append-only log of identifier sightings from calls.';


--
-- Name: generated_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.generated_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    file_path text,
    file_format text,
    file_size_bytes integer,
    report_data jsonb,
    parameters jsonb DEFAULT '{}'::jsonb NOT NULL,
    generated_by uuid NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'generating'::text NOT NULL,
    error_message text,
    generation_duration_ms integer,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT generated_reports_file_format_check CHECK ((file_format = ANY (ARRAY['pdf'::text, 'csv'::text, 'xlsx'::text, 'json'::text]))),
    CONSTRAINT generated_reports_status_check CHECK ((status = ANY (ARRAY['generating'::text, 'completed'::text, 'failed'::text])))
);


ALTER TABLE public.generated_reports OWNER TO postgres;

--
-- Name: TABLE generated_reports; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.generated_reports IS 'Generated report instances with exported files';


--
-- Name: COLUMN generated_reports.report_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.generated_reports.report_data IS 'Inline JSON data for small reports, null for exported files';


--
-- Name: global_feature_flags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.global_feature_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature text NOT NULL,
    enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.global_feature_flags OWNER TO postgres;

--
-- Name: incidents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    severity text NOT NULL,
    error_code text NOT NULL,
    error_message text NOT NULL,
    resource_type text,
    resource_id uuid,
    call_id uuid,
    stack_trace text,
    metadata jsonb,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT incidents_severity_check CHECK ((severity = ANY (ARRAY['CRITICAL'::text, 'HIGH'::text, 'MEDIUM'::text, 'LOW'::text])))
);


ALTER TABLE public.incidents OWNER TO postgres;

--
-- Name: integrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    provider text NOT NULL,
    provider_account_id text,
    provider_account_name text,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    last_error_at timestamp with time zone,
    settings jsonb DEFAULT '{}'::jsonb,
    sync_enabled boolean DEFAULT true NOT NULL,
    connected_at timestamp with time zone,
    disconnected_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    connected_by uuid,
    CONSTRAINT integrations_provider_check CHECK ((provider = ANY (ARRAY['hubspot'::text, 'salesforce'::text, 'zoho'::text, 'pipedrive'::text]))),
    CONSTRAINT integrations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'disconnected'::text, 'error'::text, 'expired'::text])))
);


ALTER TABLE public.integrations OWNER TO postgres;

--
-- Name: TABLE integrations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.integrations IS 'CRM OAuth connections. Platform-owner registers OAuth apps, customers just authorize.';


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoices (
    id uuid NOT NULL,
    organization_id uuid,
    stripe_invoice_id text,
    amount_cents integer,
    status text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.invoices OWNER TO postgres;

--
-- Name: kpi_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kpi_logs (
    id bigint NOT NULL,
    test_id uuid,
    stage text NOT NULL,
    status text NOT NULL,
    message text NOT NULL,
    duration_ms integer,
    error_details text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT kpi_logs_status_check CHECK ((status = ANY (ARRAY['success'::text, 'failure'::text])))
);


ALTER TABLE public.kpi_logs OWNER TO postgres;

--
-- Name: kpi_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.kpi_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kpi_logs_id_seq OWNER TO postgres;

--
-- Name: kpi_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.kpi_logs_id_seq OWNED BY public.kpi_logs.id;


--
-- Name: kpi_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kpi_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    response_time_threshold_ms integer DEFAULT 5000,
    response_time_warning_ms integer DEFAULT 3000,
    consecutive_failures_before_alert integer DEFAULT 3,
    alert_sensitivity text DEFAULT 'medium'::text,
    default_test_frequency text DEFAULT '5min'::text,
    send_email_alerts boolean DEFAULT true,
    send_sms_alerts boolean DEFAULT true,
    alert_on_recovery boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT kpi_settings_alert_sensitivity_check CHECK ((alert_sensitivity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT kpi_settings_default_test_frequency_check CHECK ((default_test_frequency = ANY (ARRAY['5min'::text, '15min'::text, '30min'::text, '1hr'::text, '4hr'::text, '24hr'::text])))
);


ALTER TABLE public.kpi_settings OWNER TO postgres;

--
-- Name: legal_holds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.legal_holds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    hold_name text NOT NULL,
    matter_reference text,
    description text,
    applies_to_all boolean DEFAULT false NOT NULL,
    call_ids uuid[] DEFAULT '{}'::uuid[],
    status text DEFAULT 'active'::text NOT NULL,
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    effective_until timestamp with time zone,
    released_at timestamp with time zone,
    released_by uuid,
    release_reason text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT legal_holds_status_check CHECK ((status = ANY (ARRAY['active'::text, 'released'::text, 'expired'::text])))
);


ALTER TABLE public.legal_holds OWNER TO postgres;

--
-- Name: login_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.login_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    ip text,
    succeeded boolean DEFAULT false NOT NULL,
    attempted_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.login_attempts OWNER TO postgres;

--
-- Name: media_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media_sessions (
    id uuid NOT NULL,
    call_id uuid,
    system_id uuid,
    freeswitch_node text,
    started_at timestamp with time zone,
    ended_at timestamp with time zone
);


ALTER TABLE public.media_sessions OWNER TO postgres;

--
-- Name: monitored_numbers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.monitored_numbers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    number text NOT NULL,
    name text,
    description text,
    type text DEFAULT 'inbound'::text,
    test_frequency text DEFAULT 'hourly'::text NOT NULL,
    greeting_message_id uuid,
    custom_greeting_message text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.monitored_numbers OWNER TO postgres;

--
-- Name: network_incidents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.network_incidents (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    description text,
    source text NOT NULL,
    link text,
    pub_date timestamp with time zone,
    severity text,
    affected_carriers text[],
    created_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    CONSTRAINT network_incidents_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])))
);


ALTER TABLE public.network_incidents OWNER TO postgres;

--
-- Name: TABLE network_incidents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.network_incidents IS 'Network outage incidents from RSS feeds and status pages';


--
-- Name: number_kpi_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.number_kpi_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    monitored_number_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    stage text,
    duration_ms integer,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.number_kpi_logs OWNER TO postgres;

--
-- Name: number_kpi_snapshot; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.number_kpi_snapshot (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    monitored_number_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    status text NOT NULL,
    uptime_percentage numeric(5,2),
    last_24h_failures integer,
    last_test_at timestamp with time zone,
    last_test_status text,
    avg_response_time_ms integer,
    last_updated timestamp with time zone DEFAULT now()
);


ALTER TABLE public.number_kpi_snapshot OWNER TO postgres;

--
-- Name: oauth_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.oauth_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    integration_id uuid NOT NULL,
    access_token_encrypted text NOT NULL,
    refresh_token_encrypted text,
    token_type text DEFAULT 'Bearer'::text,
    expires_at timestamp with time zone,
    refresh_expires_at timestamp with time zone,
    scopes text[],
    instance_url text,
    last_refreshed_at timestamp with time zone,
    refresh_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.oauth_tokens OWNER TO postgres;

--
-- Name: TABLE oauth_tokens; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.oauth_tokens IS 'Encrypted OAuth tokens. Service role access only. Never expose to client.';


--
-- Name: COLUMN oauth_tokens.access_token_encrypted; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.oauth_tokens.access_token_encrypted IS 'Encrypted with CRM_ENCRYPTION_KEY. Format: v1:base64:hash';


--
-- Name: org_feature_flags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_feature_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    feature text NOT NULL,
    enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    disabled_reason text,
    disabled_at timestamp with time zone,
    disabled_by uuid,
    daily_limit integer,
    monthly_limit integer,
    current_daily_usage integer DEFAULT 0,
    current_monthly_usage integer DEFAULT 0,
    usage_reset_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_feature_flags OWNER TO postgres;

--
-- Name: org_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text,
    created_at timestamp with time zone DEFAULT now(),
    invite_id uuid
);


ALTER TABLE public.org_members OWNER TO postgres;

--
-- Name: org_sso_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_sso_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    provider_type text NOT NULL,
    provider_name text NOT NULL,
    is_enabled boolean DEFAULT false,
    saml_entity_id text,
    saml_sso_url text,
    saml_slo_url text,
    saml_certificate text,
    saml_signature_algorithm text DEFAULT 'sha256'::text,
    saml_name_id_format text DEFAULT 'emailAddress'::text,
    oidc_client_id text,
    oidc_client_secret_encrypted text,
    oidc_issuer_url text,
    oidc_authorization_url text,
    oidc_token_url text,
    oidc_userinfo_url text,
    oidc_scopes text[] DEFAULT ARRAY['openid'::text, 'email'::text, 'profile'::text],
    verified_domains text[] DEFAULT '{}'::text[],
    auto_provision_users boolean DEFAULT true,
    default_role text DEFAULT 'member'::text,
    require_sso boolean DEFAULT false,
    allow_idp_initiated boolean DEFAULT true,
    session_duration_hours integer DEFAULT 24,
    attribute_mapping jsonb DEFAULT '{"name": "displayName", "email": "email", "groups": "groups", "given_name": "firstName", "family_name": "lastName"}'::jsonb,
    group_mapping jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    last_login_at timestamp with time zone,
    login_count integer DEFAULT 0,
    CONSTRAINT org_sso_configs_provider_type_check CHECK ((provider_type = ANY (ARRAY['saml'::text, 'oidc'::text, 'azure_ad'::text, 'okta'::text, 'google_workspace'::text])))
);


ALTER TABLE public.org_sso_configs OWNER TO postgres;

--
-- Name: TABLE org_sso_configs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.org_sso_configs IS 'Enterprise SSO configuration per organization. Supports SAML 2.0 (Okta, custom) and OIDC (Azure AD, Google Workspace).';


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    plan text,
    created_at timestamp with time zone DEFAULT now(),
    plan_status text DEFAULT 'active'::text,
    stripe_customer_id text,
    stripe_subscription_id text,
    tenant_id uuid,
    tool_id uuid,
    created_by uuid,
    default_booking_duration integer DEFAULT 30,
    booking_enabled boolean DEFAULT false,
    CONSTRAINT organizations_plan_status_check CHECK ((plan_status = ANY (ARRAY['active'::text, 'past_due'::text, 'canceled'::text, 'trialing'::text, 'incomplete'::text])))
);


ALTER TABLE public.organizations OWNER TO postgres;

--
-- Name: COLUMN organizations.plan; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.organizations.plan IS 'Subscription plan tier: free (default), starter ($49/mo), pro ($99/mo), enterprise ($299/mo)';


--
-- Name: COLUMN organizations.plan_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.organizations.plan_status IS 'Stripe subscription status: active, past_due, canceled, trialing, incomplete';


--
-- Name: COLUMN organizations.stripe_customer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.organizations.stripe_customer_id IS 'Stripe Customer ID (cus_...) for billing';


--
-- Name: COLUMN organizations.stripe_subscription_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.organizations.stripe_subscription_id IS 'Stripe Subscription ID (sub_...) for active subscription';


--
-- Name: COLUMN organizations.default_booking_duration; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.organizations.default_booking_duration IS 'Default booking duration in minutes';


--
-- Name: COLUMN organizations.booking_enabled; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.organizations.booking_enabled IS 'Whether booking feature is enabled for this org';


--
-- Name: qa_evaluation_disclosures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qa_evaluation_disclosures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    call_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    disclosure_type text DEFAULT 'qa_evaluation'::text NOT NULL,
    disclosure_text text NOT NULL,
    disclosed_at timestamp with time zone DEFAULT now() NOT NULL,
    disclosure_position_seconds numeric(10,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT qa_evaluation_disclosures_disclosure_type_check CHECK ((disclosure_type = ANY (ARRAY['qa_evaluation'::text, 'internal_audit'::text, 'training'::text])))
);


ALTER TABLE public.qa_evaluation_disclosures OWNER TO postgres;

--
-- Name: TABLE qa_evaluation_disclosures; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qa_evaluation_disclosures IS 'Tracks QA evaluation disclosures. Per AI Role Policy: QA evaluations must disclose that the call is for internal evaluation purposes only.';


--
-- Name: webhook_failures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.webhook_failures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    source text NOT NULL,
    endpoint text NOT NULL,
    payload jsonb NOT NULL,
    headers jsonb,
    error_message text NOT NULL,
    error_code text,
    http_status integer,
    idempotency_key text,
    attempt_count integer DEFAULT 1 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    next_retry_at timestamp with time zone,
    last_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    resolution_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resource_type text,
    resource_id uuid,
    CONSTRAINT webhook_failures_source_check CHECK ((source = ANY (ARRAY['signalwire'::text, 'assemblyai'::text, 'resend'::text, 'stripe'::text, 'internal'::text]))),
    CONSTRAINT webhook_failures_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'retrying'::text, 'succeeded'::text, 'failed'::text, 'manual_review'::text, 'discarded'::text])))
);


ALTER TABLE public.webhook_failures OWNER TO postgres;

--
-- Name: reliability_metrics; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.reliability_metrics AS
 SELECT organization_id,
    count(*) FILTER (WHERE (status = 'pending'::text)) AS pending_webhooks,
    count(*) FILTER (WHERE (status = 'failed'::text)) AS failed_webhooks,
    count(*) FILTER (WHERE (status = 'manual_review'::text)) AS manual_review_webhooks,
    count(*) FILTER (WHERE (status = 'succeeded'::text)) AS recovered_webhooks,
    count(*) FILTER (WHERE ((source = 'signalwire'::text) AND (status = ANY (ARRAY['pending'::text, 'failed'::text])))) AS signalwire_failures,
    count(*) FILTER (WHERE ((source = 'assemblyai'::text) AND (status = ANY (ARRAY['pending'::text, 'failed'::text])))) AS assemblyai_failures,
    count(*) FILTER (WHERE (created_at > (now() - '24:00:00'::interval))) AS failures_24h,
    count(*) FILTER (WHERE ((created_at > (now() - '24:00:00'::interval)) AND (status = 'succeeded'::text))) AS recovered_24h,
    min(created_at) FILTER (WHERE (status = ANY (ARRAY['pending'::text, 'retrying'::text]))) AS oldest_pending
   FROM public.webhook_failures
  GROUP BY organization_id;


ALTER VIEW public.reliability_metrics OWNER TO postgres;

--
-- Name: report_access_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.report_access_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    accessed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT report_access_log_action_check CHECK ((action = ANY (ARRAY['viewed'::text, 'downloaded'::text, 'shared'::text])))
);


ALTER TABLE public.report_access_log OWNER TO postgres;

--
-- Name: TABLE report_access_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.report_access_log IS 'Audit trail for report access';


--
-- Name: report_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.report_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    test_config_id uuid,
    frequency text NOT NULL,
    recipient_emails text[] NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT report_schedules_frequency_check CHECK ((frequency = ANY (ARRAY['daily'::text, 'weekly'::text])))
);


ALTER TABLE public.report_schedules OWNER TO postgres;

--
-- Name: report_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.report_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    report_type text NOT NULL,
    data_source text NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    metrics jsonb DEFAULT '[]'::jsonb NOT NULL,
    dimensions jsonb DEFAULT '[]'::jsonb NOT NULL,
    visualization_config jsonb DEFAULT '{}'::jsonb,
    is_public boolean DEFAULT false NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT report_templates_data_source_check CHECK ((data_source = ANY (ARRAY['calls'::text, 'campaigns'::text, 'scorecards'::text, 'surveys'::text, 'multi'::text]))),
    CONSTRAINT report_templates_report_type_check CHECK ((report_type = ANY (ARRAY['call_volume'::text, 'quality_scorecard'::text, 'campaign_performance'::text, 'custom'::text])))
);


ALTER TABLE public.report_templates OWNER TO postgres;

--
-- Name: TABLE report_templates; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.report_templates IS 'Reusable report templates with filters and metrics configuration';


--
-- Name: COLUMN report_templates.filters; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.report_templates.filters IS 'JSON filters: {date_range: {start, end}, statuses: [], users: [], etc}';


--
-- Name: COLUMN report_templates.metrics; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.report_templates.metrics IS 'Array of metric names to calculate';


--
-- Name: COLUMN report_templates.dimensions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.report_templates.dimensions IS 'Array of dimension names to group by';


--
-- Name: retention_policies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.retention_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    default_retention_class text DEFAULT 'default'::text NOT NULL,
    default_retention_days integer DEFAULT 0 NOT NULL,
    regulated_retention_days integer DEFAULT 2555 NOT NULL,
    auto_archive_after_days integer DEFAULT 90,
    auto_delete_after_days integer,
    legal_hold_contact_email text,
    legal_hold_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT retention_policies_default_retention_class_check CHECK ((default_retention_class = ANY (ARRAY['default'::text, 'regulated'::text, 'legal_hold'::text])))
);


ALTER TABLE public.retention_policies OWNER TO postgres;

--
-- Name: role_capabilities_archived; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_capabilities_archived (
    role_id uuid NOT NULL,
    capability_id uuid NOT NULL
);


ALTER TABLE public.role_capabilities_archived OWNER TO postgres;

--
-- Name: roles_archived; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles_archived (
    id uuid NOT NULL,
    organization_id uuid,
    name text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.roles_archived OWNER TO postgres;

--
-- Name: scheduled_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scheduled_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    schedule_pattern text NOT NULL,
    schedule_time time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    schedule_days integer[],
    timezone text DEFAULT 'UTC'::text NOT NULL,
    delivery_method text DEFAULT 'email'::text NOT NULL,
    delivery_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_run_at timestamp with time zone,
    next_run_at timestamp with time zone,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT scheduled_reports_delivery_method_check CHECK ((delivery_method = ANY (ARRAY['email'::text, 'webhook'::text, 'storage'::text])))
);


ALTER TABLE public.scheduled_reports OWNER TO postgres;

--
-- Name: TABLE scheduled_reports; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.scheduled_reports IS 'Scheduled report execution configuration';


--
-- Name: COLUMN scheduled_reports.schedule_pattern; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.scheduled_reports.schedule_pattern IS 'Frequency: daily, weekly, monthly';


--
-- Name: COLUMN scheduled_reports.delivery_config; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.scheduled_reports.delivery_config IS 'Delivery settings: {emails: [], webhook_url: "", s3_bucket: ""}';


--
-- Name: scorecards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scorecards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    structure jsonb NOT NULL,
    is_template boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tool_id uuid NOT NULL,
    created_by uuid
);


ALTER TABLE public.scorecards OWNER TO postgres;

--
-- Name: TABLE scorecards; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.scorecards IS 'Scorecard templates for evaluating call quality and customer interactions';


--
-- Name: search_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.search_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    is_current boolean DEFAULT true NOT NULL,
    superseded_by uuid,
    title text,
    content text NOT NULL,
    content_hash text NOT NULL,
    call_id uuid,
    phone_number text,
    domain text,
    tags text[],
    source_created_at timestamp with time zone,
    indexed_at timestamp with time zone DEFAULT now() NOT NULL,
    indexed_by text DEFAULT 'system'::text NOT NULL,
    indexed_by_user_id uuid,
    CONSTRAINT search_documents_source_type_check CHECK ((source_type = ANY (ARRAY['call'::text, 'recording'::text, 'transcript'::text, 'evidence'::text, 'note'::text])))
);


ALTER TABLE public.search_documents OWNER TO postgres;

--
-- Name: TABLE search_documents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.search_documents IS 'Non-authoritative, append-only search index. Use canonical tables for source of truth.';


--
-- Name: COLUMN search_documents.version; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.search_documents.version IS 'Monotonically increasing version per source. Old versions retained for audit trail.';


--
-- Name: COLUMN search_documents.is_current; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.search_documents.is_current IS 'True for latest version. Previous versions have is_current=false.';


--
-- Name: search_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.search_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    event_type text NOT NULL,
    document_id uuid,
    source_type text,
    source_id uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_type text NOT NULL,
    actor_id uuid,
    actor_label text,
    CONSTRAINT search_events_actor_type_check CHECK ((actor_type = ANY (ARRAY['system'::text, 'human'::text, 'automation'::text]))),
    CONSTRAINT search_events_event_type_check CHECK ((event_type = ANY (ARRAY['indexed'::text, 'reindexed'::text, 'rebuild_started'::text, 'rebuild_completed'::text])))
);


ALTER TABLE public.search_events OWNER TO postgres;

--
-- Name: TABLE search_events; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.search_events IS 'Append-only audit log for search index operations.';


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    id text NOT NULL,
    session_token text NOT NULL,
    user_id text NOT NULL,
    expires timestamp with time zone NOT NULL,
    "sessionToken" text
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: shopper_campaigns_archive; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shopper_campaigns_archive (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    scenario text NOT NULL,
    schedule text DEFAULT 'manual'::text,
    phone_numbers text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    caller_number text,
    phone_to_test text
);


ALTER TABLE public.shopper_campaigns_archive OWNER TO postgres;

--
-- Name: shopper_jobs_archive; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shopper_jobs_archive (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    organization_id uuid,
    result_id uuid,
    payload jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    next_try_at timestamp with time zone DEFAULT now(),
    last_error text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.shopper_jobs_archive OWNER TO postgres;

--
-- Name: shopper_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shopper_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    call_id uuid,
    recording_id uuid,
    script_id uuid,
    overall_score integer,
    sentiment_score text,
    sentiment_confidence numeric(4,3),
    outcome_results jsonb DEFAULT '[]'::jsonb,
    keywords_found text[],
    key_phrases text[],
    issues_detected text[],
    first_response_time_ms integer,
    hold_time_total_seconds integer,
    evaluated_at timestamp with time zone DEFAULT now(),
    evaluated_by text DEFAULT 'system'::text,
    notes text,
    CONSTRAINT shopper_results_overall_score_check CHECK (((overall_score >= 0) AND (overall_score <= 100)))
);


ALTER TABLE public.shopper_results OWNER TO postgres;

--
-- Name: shopper_scripts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shopper_scripts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    script_text text NOT NULL,
    persona text DEFAULT 'professional'::text,
    tts_provider text DEFAULT 'signalwire'::text,
    tts_voice text DEFAULT 'rime.spore'::text,
    elevenlabs_voice_id text,
    expected_outcomes jsonb DEFAULT '[]'::jsonb,
    scoring_weights jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    use_count integer DEFAULT 0,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


ALTER TABLE public.shopper_scripts OWNER TO postgres;

--
-- Name: sso_login_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sso_login_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    sso_config_id uuid NOT NULL,
    user_id uuid,
    event_type text NOT NULL,
    idp_subject text,
    idp_session_id text,
    email text,
    name text,
    groups text[],
    raw_claims jsonb,
    ip_address inet,
    user_agent text,
    error_code text,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sso_login_events_event_type_check CHECK ((event_type = ANY (ARRAY['login_success'::text, 'login_failure'::text, 'logout'::text, 'token_refresh'::text])))
);


ALTER TABLE public.sso_login_events OWNER TO postgres;

--
-- Name: TABLE sso_login_events; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.sso_login_events IS 'Audit trail for SSO login attempts (success and failure).';


--
-- Name: stock_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'greeting'::text NOT NULL,
    text text NOT NULL,
    category text,
    duration_seconds integer,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.stock_messages OWNER TO postgres;

--
-- Name: stripe_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stripe_events (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    stripe_event_id text NOT NULL,
    event_type text NOT NULL,
    organization_id uuid,
    data jsonb NOT NULL,
    processed boolean DEFAULT false NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone
);


ALTER TABLE public.stripe_events OWNER TO postgres;

--
-- Name: TABLE stripe_events; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.stripe_events IS 'Audit log of all Stripe webhook events';


--
-- Name: stripe_invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stripe_invoices (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    stripe_invoice_id text NOT NULL,
    stripe_customer_id text NOT NULL,
    stripe_subscription_id text,
    status text NOT NULL,
    amount_due_cents integer NOT NULL,
    amount_paid_cents integer DEFAULT 0 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    invoice_date timestamp with time zone NOT NULL,
    due_date timestamp with time zone,
    paid_at timestamp with time zone,
    invoice_pdf_url text,
    hosted_invoice_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stripe_invoices_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'open'::text, 'paid'::text, 'void'::text, 'uncollectible'::text])))
);


ALTER TABLE public.stripe_invoices OWNER TO postgres;

--
-- Name: TABLE stripe_invoices; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.stripe_invoices IS 'Historical record of invoices and payments';


--
-- Name: stripe_payment_methods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stripe_payment_methods (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    stripe_customer_id text NOT NULL,
    stripe_payment_method_id text NOT NULL,
    type text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    card_brand text,
    card_last4 text,
    card_exp_month integer,
    card_exp_year integer,
    bank_name text,
    bank_last4 text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stripe_payment_methods_type_check CHECK ((type = ANY (ARRAY['card'::text, 'bank_account'::text, 'sepa_debit'::text, 'us_bank_account'::text])))
);


ALTER TABLE public.stripe_payment_methods OWNER TO postgres;

--
-- Name: TABLE stripe_payment_methods; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.stripe_payment_methods IS 'Stores customer payment methods from Stripe';


--
-- Name: stripe_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stripe_subscriptions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    stripe_customer_id text NOT NULL,
    stripe_subscription_id text NOT NULL,
    stripe_price_id text NOT NULL,
    plan text NOT NULL,
    status text NOT NULL,
    current_period_start timestamp with time zone NOT NULL,
    current_period_end timestamp with time zone NOT NULL,
    cancel_at_period_end boolean DEFAULT false NOT NULL,
    canceled_at timestamp with time zone,
    amount_cents integer NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    "interval" text NOT NULL,
    trial_start timestamp with time zone,
    trial_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stripe_subscriptions_interval_check CHECK (("interval" = ANY (ARRAY['month'::text, 'year'::text]))),
    CONSTRAINT stripe_subscriptions_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'pro'::text, 'business'::text, 'enterprise'::text]))),
    CONSTRAINT stripe_subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'canceled'::text, 'past_due'::text, 'unpaid'::text, 'incomplete'::text, 'incomplete_expired'::text, 'trialing'::text, 'paused'::text])))
);


ALTER TABLE public.stripe_subscriptions OWNER TO postgres;

--
-- Name: TABLE stripe_subscriptions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.stripe_subscriptions IS 'Tracks Stripe subscription state for organizations';


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscriptions (
    id uuid NOT NULL,
    organization_id uuid,
    stripe_subscription_id text,
    plan text,
    status text,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.subscriptions OWNER TO postgres;

--
-- Name: surveys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.surveys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    questions jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


ALTER TABLE public.surveys OWNER TO postgres;

--
-- Name: systems; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.systems (
    id uuid NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    description text,
    category text,
    execution_plane text,
    is_billable boolean DEFAULT false,
    is_internal boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT systems_execution_plane_check CHECK ((execution_plane = ANY (ARRAY['control'::text, 'media'::text, 'ai'::text])))
);


ALTER TABLE public.systems OWNER TO postgres;

--
-- Name: team_invites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.team_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'viewer'::text NOT NULL,
    token uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    invited_by uuid,
    accepted_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    CONSTRAINT team_invites_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'cancelled'::text, 'expired'::text])))
);


ALTER TABLE public.team_invites OWNER TO postgres;

--
-- Name: TABLE team_invites; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.team_invites IS 'Stores pending team invitations for organizations';


--
-- Name: COLUMN team_invites.token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.team_invites.token IS 'Unique token used in invitation URL';


--
-- Name: COLUMN team_invites.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.team_invites.status IS 'pending, accepted, cancelled, or expired';


--
-- Name: COLUMN team_invites.expires_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.team_invites.expires_at IS 'Invitation expires after this time (default 7 days)';


--
-- Name: test_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.test_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name text,
    phone_to text NOT NULL,
    schedule text NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    custom_message text,
    dtmf_required boolean DEFAULT false,
    dtmf_expected character varying(10),
    description text,
    carrier text,
    test_script text DEFAULT 'basic'::text,
    alert_rules jsonb DEFAULT '{"alert_email": true, "consecutive_failures": 2}'::jsonb,
    last_test_at timestamp with time zone,
    last_status text,
    updated_at timestamp with time zone DEFAULT now(),
    tool_id uuid NOT NULL,
    created_by uuid
);


ALTER TABLE public.test_configs OWNER TO postgres;

--
-- Name: test_frequency_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.test_frequency_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    monitored_number_id uuid,
    frequency text NOT NULL,
    hours_between_tests integer,
    day_of_week integer,
    time_of_day time without time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.test_frequency_config OWNER TO postgres;

--
-- Name: test_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.test_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_config_id uuid,
    status text,
    duration_ms integer,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now(),
    tool_id uuid NOT NULL,
    created_by uuid
);


ALTER TABLE public.test_results OWNER TO postgres;

--
-- Name: test_statistics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.test_statistics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_config_id uuid NOT NULL,
    uptime_percentage_24h numeric(5,2) DEFAULT 100.00,
    uptime_percentage_7d numeric(5,2) DEFAULT 100.00,
    uptime_percentage_30d numeric(5,2) DEFAULT 100.00,
    avg_response_ms_24h integer,
    min_response_ms_24h integer,
    max_response_ms_24h integer,
    total_tests_24h integer DEFAULT 0,
    failures_24h integer DEFAULT 0,
    consecutive_failures integer DEFAULT 0,
    current_status text DEFAULT 'unknown'::text,
    last_success_at timestamp with time zone,
    last_failure_at timestamp with time zone,
    hourly_uptime_trend jsonb DEFAULT '[]'::jsonb,
    updated_at timestamp with time zone DEFAULT now(),
    system_id uuid,
    created_by uuid,
    visibility text DEFAULT 'org'::text,
    CONSTRAINT test_statistics_current_status_check CHECK ((current_status = ANY (ARRAY['healthy'::text, 'warning'::text, 'critical'::text, 'unknown'::text]))),
    CONSTRAINT test_statistics_visibility_check CHECK ((visibility = ANY (ARRAY['private'::text, 'team'::text, 'org'::text])))
);


ALTER TABLE public.test_statistics OWNER TO postgres;

--
-- Name: tool_access; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tool_access (
    id uuid,
    organization_id uuid,
    user_id uuid,
    tool public.tool_type,
    role public.tool_role_type,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.tool_access OWNER TO postgres;

--
-- Name: tool_access_archived; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tool_access_archived (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    tool public.tool_type NOT NULL,
    role public.tool_role_type DEFAULT 'viewer'::public.tool_role_type NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tool_access_archived OWNER TO postgres;

--
-- Name: TABLE tool_access_archived; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.tool_access_archived IS 'Tracks which users have access to which tools in an org';


--
-- Name: tool_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tool_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    tool public.tool_type NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tool_settings OWNER TO postgres;

--
-- Name: TABLE tool_settings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.tool_settings IS 'Tool-specific settings and integrations';


--
-- Name: tool_team_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tool_team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    tool public.tool_type NOT NULL,
    role public.tool_role_type NOT NULL,
    invited_by uuid,
    invited_at timestamp with time zone,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tool_team_members OWNER TO postgres;

--
-- Name: TABLE tool_team_members; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.tool_team_members IS 'Tool-specific team member roles (independent of org roles)';


--
-- Name: tools; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tools (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tools OWNER TO postgres;

--
-- Name: transcript_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transcript_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recording_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    transcript_json jsonb NOT NULL,
    transcript_hash text NOT NULL,
    produced_by text NOT NULL,
    produced_by_model text,
    produced_by_user_id uuid,
    input_refs jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_authoritative boolean DEFAULT true NOT NULL,
    immutability_policy text DEFAULT 'immutable'::text NOT NULL,
    CONSTRAINT transcript_versions_immutability_policy_check CHECK ((immutability_policy = ANY (ARRAY['immutable'::text, 'limited'::text, 'mutable'::text]))),
    CONSTRAINT transcript_versions_produced_by_check CHECK ((produced_by = ANY (ARRAY['system'::text, 'human'::text, 'model'::text])))
);


ALTER TABLE public.transcript_versions OWNER TO postgres;

--
-- Name: TABLE transcript_versions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.transcript_versions IS 'Immutable transcript history - each version is a new row, never updated';


--
-- Name: COLUMN transcript_versions.is_authoritative; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.transcript_versions.is_authoritative IS 'TRUE if this is the canonical transcript (AssemblyAI). FALSE for draft/preview transcripts.';


--
-- Name: COLUMN transcript_versions.immutability_policy; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.transcript_versions.immutability_policy IS 'Always immutable - use versioning for changes';


--
-- Name: usage_limits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usage_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    plan text,
    metric text,
    limit_value integer,
    billing_period text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.usage_limits OWNER TO postgres;

--
-- Name: usage_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usage_records (
    id uuid NOT NULL,
    organization_id uuid,
    metric text,
    value integer,
    recorded_at timestamp with time zone DEFAULT now(),
    call_id uuid,
    quantity integer,
    billing_period_start timestamp with time zone,
    billing_period_end timestamp with time zone,
    metadata jsonb
);


ALTER TABLE public.usage_records OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    name text,
    email text NOT NULL,
    email_verified timestamp with time zone,
    image text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: verification_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.verification_tokens (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp with time zone NOT NULL
);


ALTER TABLE public.verification_tokens OWNER TO postgres;

--
-- Name: voice_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.voice_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    record boolean DEFAULT false,
    transcribe boolean DEFAULT false,
    translate boolean DEFAULT false,
    translate_from text,
    translate_to text,
    survey boolean DEFAULT false,
    synthetic_caller boolean DEFAULT false,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    use_voice_cloning boolean DEFAULT false,
    cloned_voice_id text,
    survey_prompts jsonb DEFAULT '[]'::jsonb,
    survey_voice text DEFAULT 'rime.spore'::text,
    survey_webhook_email text,
    survey_inbound_number text,
    shopper_script text,
    shopper_persona text DEFAULT 'professional'::text,
    shopper_expected_outcomes jsonb DEFAULT '[]'::jsonb,
    script_id uuid,
    caller_id_mask text,
    caller_id_verified boolean DEFAULT false,
    caller_id_verified_at timestamp with time zone,
    translation_from text,
    translation_to text,
    survey_question_types jsonb DEFAULT '[]'::jsonb,
    survey_prompts_locales jsonb DEFAULT '{}'::jsonb,
    ai_agent_id text,
    ai_agent_prompt text,
    ai_agent_temperature numeric(3,2) DEFAULT 0.3,
    ai_agent_model text DEFAULT 'gpt-4o-mini'::text,
    ai_post_prompt_url text,
    ai_features_enabled boolean DEFAULT true,
    live_translate boolean DEFAULT false,
    CONSTRAINT voice_configs_ai_agent_model_check CHECK ((ai_agent_model = ANY (ARRAY['gpt-4o-mini'::text, 'gpt-4o'::text, 'gpt-4-turbo'::text]))),
    CONSTRAINT voice_configs_ai_agent_temperature_check CHECK (((ai_agent_temperature >= (0)::numeric) AND (ai_agent_temperature <= (2)::numeric)))
);


ALTER TABLE public.voice_configs OWNER TO postgres;

--
-- Name: COLUMN voice_configs.use_voice_cloning; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.voice_configs.use_voice_cloning IS 'Enable voice cloning for translated audio using caller voice';


--
-- Name: COLUMN voice_configs.cloned_voice_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.voice_configs.cloned_voice_id IS 'ElevenLabs voice ID for the cloned voice (if already created)';


--
-- Name: COLUMN voice_configs.survey_prompts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.voice_configs.survey_prompts IS 'Array of survey questions for AI bot (jsonb array of strings)';


--
-- Name: COLUMN voice_configs.survey_voice; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.voice_configs.survey_voice IS 'SignalWire voice ID for survey bot TTS';


--
-- Name: COLUMN voice_configs.survey_webhook_email; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.voice_configs.survey_webhook_email IS 'Email address to receive survey results';


--
-- Name: COLUMN voice_configs.survey_inbound_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.voice_configs.survey_inbound_number IS 'SignalWire phone number SID for inbound survey calls';


--
-- Name: COLUMN voice_configs.caller_id_mask; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.voice_configs.caller_id_mask IS 'Phone number to display as caller ID (must be verified or owned)';


--
-- Name: COLUMN voice_configs.caller_id_verified; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.voice_configs.caller_id_verified IS 'Whether the mask number has been verified with SignalWire';


--
-- Name: COLUMN voice_configs.caller_id_verified_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.voice_configs.caller_id_verified_at IS 'When the number was verified';


--
-- Name: COLUMN voice_configs.translation_from; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.voice_configs.translation_from IS 'Source language for translation (e.g., en, es, fr)';


--
-- Name: COLUMN voice_configs.translation_to; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.voice_configs.translation_to IS 'Target language for translation (e.g., en, es, fr)';


--
-- Name: COLUMN voice_configs.survey_question_types; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.voice_configs.survey_question_types IS 'Question type metadata: [{index: 0, type: "scale_1_5"}, {index: 1, type: "yes_no"}]';


--
-- Name: COLUMN voice_configs.survey_prompts_locales; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.voice_configs.survey_prompts_locales IS 'Localized survey prompts by language code (e.g., {"es": ["Pregunta 1"]})';


--
-- Name: COLUMN voice_configs.ai_agent_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.voice_configs.ai_agent_id IS 'Custom SignalWire AI Agent ID for this organization';


--
-- Name: COLUMN voice_configs.ai_agent_prompt; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.voice_configs.ai_agent_prompt IS 'Custom system prompt for AI agent (overrides default)';


--
-- Name: COLUMN voice_configs.ai_agent_temperature; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.voice_configs.ai_agent_temperature IS 'AI agent temperature (0=deterministic, 2=creative)';


--
-- Name: COLUMN voice_configs.ai_agent_model; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.voice_configs.ai_agent_model IS 'AI model for agent (gpt-4o-mini recommended)';


--
-- Name: COLUMN voice_configs.ai_post_prompt_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.voice_configs.ai_post_prompt_url IS 'Webhook URL called after AI agent processing';


--
-- Name: COLUMN voice_configs.ai_features_enabled; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.voice_configs.ai_features_enabled IS 'Master switch for AI features (translation, transcription, etc)';


--
-- Name: voice_targets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.voice_targets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    phone_number text NOT NULL,
    name text,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


ALTER TABLE public.voice_targets OWNER TO postgres;

--
-- Name: webhook_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.webhook_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    type text NOT NULL,
    url text NOT NULL,
    is_active boolean DEFAULT true,
    test_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT webhook_configs_type_check CHECK ((type = ANY (ARRAY['slack'::text, 'teams'::text])))
);


ALTER TABLE public.webhook_configs OWNER TO postgres;

--
-- Name: webhook_deliveries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.webhook_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid NOT NULL,
    event_type text NOT NULL,
    event_id uuid NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'pending'::text,
    attempts integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    max_attempts integer DEFAULT 5,
    next_retry_at timestamp with time zone,
    response_status integer,
    response_body text,
    response_time_ms integer,
    last_error text,
    delivered_at timestamp with time zone
);


ALTER TABLE public.webhook_deliveries OWNER TO postgres;

--
-- Name: webhook_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.webhook_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    secret text NOT NULL,
    events text[] NOT NULL,
    active boolean DEFAULT true,
    headers jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    retry_policy text DEFAULT 'exponential'::text,
    max_retries integer DEFAULT 5,
    timeout_ms integer DEFAULT 30000,
    updated_at timestamp with time zone
);


ALTER TABLE public.webhook_subscriptions OWNER TO postgres;

--
-- Name: webrtc_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.webrtc_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    session_token text NOT NULL,
    status text DEFAULT 'initializing'::text,
    created_at timestamp with time zone DEFAULT now(),
    call_id uuid,
    updated_at timestamp with time zone
);


ALTER TABLE public.webrtc_sessions OWNER TO postgres;

--
-- Name: TABLE webrtc_sessions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.webrtc_sessions IS 'Tracks browser-based WebRTC calling sessions. Per ARCH_DOCS: SignalWire-first execution.';


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: supabase_realtime_admin
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


ALTER TABLE realtime.messages OWNER TO supabase_realtime_admin;

--
-- Name: messages_2026_01_20; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.messages_2026_01_20 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE realtime.messages_2026_01_20 OWNER TO supabase_admin;

--
-- Name: messages_2026_01_21; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.messages_2026_01_21 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE realtime.messages_2026_01_21 OWNER TO supabase_admin;

--
-- Name: messages_2026_01_22; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.messages_2026_01_22 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE realtime.messages_2026_01_22 OWNER TO supabase_admin;

--
-- Name: messages_2026_01_23; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.messages_2026_01_23 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE realtime.messages_2026_01_23 OWNER TO supabase_admin;

--
-- Name: messages_2026_01_24; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.messages_2026_01_24 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE realtime.messages_2026_01_24 OWNER TO supabase_admin;

--
-- Name: messages_2026_01_25; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.messages_2026_01_25 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE realtime.messages_2026_01_25 OWNER TO supabase_admin;

--
-- Name: messages_2026_01_26; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.messages_2026_01_26 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE realtime.messages_2026_01_26 OWNER TO supabase_admin;

--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


ALTER TABLE realtime.schema_migrations OWNER TO supabase_admin;

--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


ALTER TABLE realtime.subscription OWNER TO supabase_admin;

--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: supabase_admin
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
-- Name: buckets; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
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


ALTER TABLE storage.buckets OWNER TO supabase_storage_admin;

--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: supabase_storage_admin
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
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


ALTER TABLE storage.buckets_analytics OWNER TO supabase_storage_admin;

--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.buckets_vectors OWNER TO supabase_storage_admin;

--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE storage.migrations OWNER TO supabase_storage_admin;

--
-- Name: objects; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
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
    user_metadata jsonb,
    level integer
);


ALTER TABLE storage.objects OWNER TO supabase_storage_admin;

--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: supabase_storage_admin
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: prefixes; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.prefixes (
    bucket_id text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    level integer GENERATED ALWAYS AS (storage.get_level(name)) STORED NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE storage.prefixes OWNER TO supabase_storage_admin;

--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
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
    user_metadata jsonb
);


ALTER TABLE storage.s3_multipart_uploads OWNER TO supabase_storage_admin;

--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
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


ALTER TABLE storage.s3_multipart_uploads_parts OWNER TO supabase_storage_admin;

--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
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


ALTER TABLE storage.vector_indexes OWNER TO supabase_storage_admin;

--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: postgres
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text
);


ALTER TABLE supabase_migrations.schema_migrations OWNER TO postgres;

--
-- Name: messages_2026_01_20; Type: TABLE ATTACH; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_01_20 FOR VALUES FROM ('2026-01-20 00:00:00') TO ('2026-01-21 00:00:00');


--
-- Name: messages_2026_01_21; Type: TABLE ATTACH; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_01_21 FOR VALUES FROM ('2026-01-21 00:00:00') TO ('2026-01-22 00:00:00');


--
-- Name: messages_2026_01_22; Type: TABLE ATTACH; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_01_22 FOR VALUES FROM ('2026-01-22 00:00:00') TO ('2026-01-23 00:00:00');


--
-- Name: messages_2026_01_23; Type: TABLE ATTACH; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_01_23 FOR VALUES FROM ('2026-01-23 00:00:00') TO ('2026-01-24 00:00:00');


--
-- Name: messages_2026_01_24; Type: TABLE ATTACH; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_01_24 FOR VALUES FROM ('2026-01-24 00:00:00') TO ('2026-01-25 00:00:00');


--
-- Name: messages_2026_01_25; Type: TABLE ATTACH; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_01_25 FOR VALUES FROM ('2026-01-25 00:00:00') TO ('2026-01-26 00:00:00');


--
-- Name: messages_2026_01_26; Type: TABLE ATTACH; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_01_26 FOR VALUES FROM ('2026-01-26 00:00:00') TO ('2026-01-27 00:00:00');


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: kpi_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kpi_logs ALTER COLUMN id SET DEFAULT nextval('public.kpi_logs_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: next_auth; Owner: postgres
--

ALTER TABLE ONLY next_auth.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_provider_provider_account_id_key; Type: CONSTRAINT; Schema: next_auth; Owner: postgres
--

ALTER TABLE ONLY next_auth.accounts
    ADD CONSTRAINT accounts_provider_provider_account_id_key UNIQUE (provider, provider_account_id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: next_auth; Owner: postgres
--

ALTER TABLE ONLY next_auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_sessionToken_key; Type: CONSTRAINT; Schema: next_auth; Owner: postgres
--

ALTER TABLE ONLY next_auth.sessions
    ADD CONSTRAINT "sessions_sessionToken_key" UNIQUE ("sessionToken");


--
-- Name: sessions sessions_session_token_key; Type: CONSTRAINT; Schema: next_auth; Owner: postgres
--

ALTER TABLE ONLY next_auth.sessions
    ADD CONSTRAINT sessions_session_token_key UNIQUE (session_token);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: next_auth; Owner: postgres
--

ALTER TABLE ONLY next_auth.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: next_auth; Owner: postgres
--

ALTER TABLE ONLY next_auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verification_tokens verification_tokens_pkey; Type: CONSTRAINT; Schema: next_auth; Owner: postgres
--

ALTER TABLE ONLY next_auth.verification_tokens
    ADD CONSTRAINT verification_tokens_pkey PRIMARY KEY (identifier, token);


--
-- Name: access_grants_archived access_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.access_grants_archived
    ADD CONSTRAINT access_grants_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_provider_provider_account_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_provider_provider_account_id_key UNIQUE (provider, provider_account_id);


--
-- Name: ai_agent_audit_log ai_agent_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_agent_audit_log
    ADD CONSTRAINT ai_agent_audit_log_pkey PRIMARY KEY (id);


--
-- Name: ai_runs ai_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_runs
    ADD CONSTRAINT ai_runs_pkey PRIMARY KEY (id);


--
-- Name: alert_acknowledgements alert_acknowledgements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alert_acknowledgements
    ADD CONSTRAINT alert_acknowledgements_pkey PRIMARY KEY (id);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: artifact_provenance artifact_provenance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.artifact_provenance
    ADD CONSTRAINT artifact_provenance_pkey PRIMARY KEY (id);


--
-- Name: artifacts artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.artifacts
    ADD CONSTRAINT artifacts_pkey PRIMARY KEY (id);


--
-- Name: attention_decisions attention_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attention_decisions
    ADD CONSTRAINT attention_decisions_pkey PRIMARY KEY (id);


--
-- Name: attention_events attention_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attention_events
    ADD CONSTRAINT attention_events_pkey PRIMARY KEY (id);


--
-- Name: attention_policies attention_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attention_policies
    ADD CONSTRAINT attention_policies_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: booking_events booking_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_events
    ADD CONSTRAINT booking_events_pkey PRIMARY KEY (id);


--
-- Name: call_confirmation_checklists call_confirmation_checklists_call_id_template_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_confirmation_checklists
    ADD CONSTRAINT call_confirmation_checklists_call_id_template_id_key UNIQUE (call_id, template_id);


--
-- Name: call_confirmation_checklists call_confirmation_checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_confirmation_checklists
    ADD CONSTRAINT call_confirmation_checklists_pkey PRIMARY KEY (id);


--
-- Name: call_confirmations call_confirmations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_confirmations
    ADD CONSTRAINT call_confirmations_pkey PRIMARY KEY (id);


--
-- Name: call_export_bundles call_export_bundles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_export_bundles
    ADD CONSTRAINT call_export_bundles_pkey PRIMARY KEY (id);


--
-- Name: call_notes call_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_notes
    ADD CONSTRAINT call_notes_pkey PRIMARY KEY (id);


--
-- Name: caller_id_default_rules caller_id_default_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caller_id_default_rules
    ADD CONSTRAINT caller_id_default_rules_pkey PRIMARY KEY (id);


--
-- Name: caller_id_numbers caller_id_numbers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caller_id_numbers
    ADD CONSTRAINT caller_id_numbers_pkey PRIMARY KEY (id);


--
-- Name: caller_id_permissions caller_id_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caller_id_permissions
    ADD CONSTRAINT caller_id_permissions_pkey PRIMARY KEY (id);


--
-- Name: calls calls_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_pkey PRIMARY KEY (id);


--
-- Name: campaign_audit_log campaign_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_audit_log
    ADD CONSTRAINT campaign_audit_log_pkey PRIMARY KEY (id);


--
-- Name: campaign_calls campaign_calls_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_calls
    ADD CONSTRAINT campaign_calls_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: capabilities_archived capabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capabilities_archived
    ADD CONSTRAINT capabilities_pkey PRIMARY KEY (id);


--
-- Name: carrier_status carrier_status_carrier_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_status
    ADD CONSTRAINT carrier_status_carrier_name_key UNIQUE (carrier_name);


--
-- Name: carrier_status carrier_status_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carrier_status
    ADD CONSTRAINT carrier_status_pkey PRIMARY KEY (id);


--
-- Name: compliance_restrictions compliance_restrictions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_restrictions
    ADD CONSTRAINT compliance_restrictions_pkey PRIMARY KEY (id);


--
-- Name: compliance_restrictions compliance_restrictions_restriction_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_restrictions
    ADD CONSTRAINT compliance_restrictions_restriction_code_key UNIQUE (restriction_code);


--
-- Name: compliance_violations compliance_violations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_violations
    ADD CONSTRAINT compliance_violations_pkey PRIMARY KEY (id);


--
-- Name: confirmation_templates confirmation_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.confirmation_templates
    ADD CONSTRAINT confirmation_templates_pkey PRIMARY KEY (id);


--
-- Name: crm_object_links crm_object_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_object_links
    ADD CONSTRAINT crm_object_links_pkey PRIMARY KEY (id);


--
-- Name: crm_object_links crm_object_links_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_object_links
    ADD CONSTRAINT crm_object_links_unique UNIQUE (integration_id, call_id, crm_object_type, crm_object_id);


--
-- Name: crm_sync_log crm_sync_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_sync_log
    ADD CONSTRAINT crm_sync_log_pkey PRIMARY KEY (id);


--
-- Name: digest_items digest_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.digest_items
    ADD CONSTRAINT digest_items_pkey PRIMARY KEY (id);


--
-- Name: digests digests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.digests
    ADD CONSTRAINT digests_pkey PRIMARY KEY (id);


--
-- Name: disclosure_logs disclosure_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disclosure_logs
    ADD CONSTRAINT disclosure_logs_pkey PRIMARY KEY (id);


--
-- Name: evidence_bundles evidence_bundles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_bundles
    ADD CONSTRAINT evidence_bundles_pkey PRIMARY KEY (id);


--
-- Name: evidence_manifests evidence_manifests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_manifests
    ADD CONSTRAINT evidence_manifests_pkey PRIMARY KEY (id);


--
-- Name: evidence_manifests evidence_manifests_unique_recording_scorecard; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_manifests
    ADD CONSTRAINT evidence_manifests_unique_recording_scorecard UNIQUE (recording_id, scorecard_id);


--
-- Name: execution_contexts execution_contexts_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution_contexts
    ADD CONSTRAINT execution_contexts_name_key UNIQUE (name);


--
-- Name: execution_contexts execution_contexts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution_contexts
    ADD CONSTRAINT execution_contexts_pkey PRIMARY KEY (id);


--
-- Name: export_compliance_log export_compliance_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.export_compliance_log
    ADD CONSTRAINT export_compliance_log_pkey PRIMARY KEY (id);


--
-- Name: external_entities external_entities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_entities
    ADD CONSTRAINT external_entities_pkey PRIMARY KEY (id);


--
-- Name: external_entity_identifiers external_entity_identifiers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_entity_identifiers
    ADD CONSTRAINT external_entity_identifiers_pkey PRIMARY KEY (id);


--
-- Name: external_entity_identifiers external_entity_identifiers_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_entity_identifiers
    ADD CONSTRAINT external_entity_identifiers_unique UNIQUE (organization_id, identifier_type, identifier_normalized);


--
-- Name: external_entity_links external_entity_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_entity_links
    ADD CONSTRAINT external_entity_links_pkey PRIMARY KEY (id);


--
-- Name: external_entity_observations external_entity_observations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_entity_observations
    ADD CONSTRAINT external_entity_observations_pkey PRIMARY KEY (id);


--
-- Name: generated_reports generated_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.generated_reports
    ADD CONSTRAINT generated_reports_pkey PRIMARY KEY (id);


--
-- Name: global_feature_flags global_feature_flags_feature_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.global_feature_flags
    ADD CONSTRAINT global_feature_flags_feature_key UNIQUE (feature);


--
-- Name: global_feature_flags global_feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.global_feature_flags
    ADD CONSTRAINT global_feature_flags_pkey PRIMARY KEY (id);


--
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);


--
-- Name: integrations integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_pkey PRIMARY KEY (id);


--
-- Name: integrations integrations_unique_provider; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_unique_provider UNIQUE (organization_id, provider);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: kpi_logs kpi_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kpi_logs
    ADD CONSTRAINT kpi_logs_pkey PRIMARY KEY (id);


--
-- Name: kpi_settings kpi_settings_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kpi_settings
    ADD CONSTRAINT kpi_settings_organization_id_key UNIQUE (organization_id);


--
-- Name: kpi_settings kpi_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kpi_settings
    ADD CONSTRAINT kpi_settings_pkey PRIMARY KEY (id);


--
-- Name: legal_holds legal_holds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.legal_holds
    ADD CONSTRAINT legal_holds_pkey PRIMARY KEY (id);


--
-- Name: login_attempts login_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_attempts
    ADD CONSTRAINT login_attempts_pkey PRIMARY KEY (id);


--
-- Name: media_sessions media_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_sessions
    ADD CONSTRAINT media_sessions_pkey PRIMARY KEY (id);


--
-- Name: monitored_numbers monitored_numbers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monitored_numbers
    ADD CONSTRAINT monitored_numbers_pkey PRIMARY KEY (id);


--
-- Name: network_incidents network_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.network_incidents
    ADD CONSTRAINT network_incidents_pkey PRIMARY KEY (id);


--
-- Name: number_kpi_logs number_kpi_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.number_kpi_logs
    ADD CONSTRAINT number_kpi_logs_pkey PRIMARY KEY (id);


--
-- Name: number_kpi_snapshot number_kpi_snapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.number_kpi_snapshot
    ADD CONSTRAINT number_kpi_snapshot_pkey PRIMARY KEY (id);


--
-- Name: oauth_tokens oauth_tokens_integration_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oauth_tokens
    ADD CONSTRAINT oauth_tokens_integration_id_key UNIQUE (integration_id);


--
-- Name: oauth_tokens oauth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oauth_tokens
    ADD CONSTRAINT oauth_tokens_pkey PRIMARY KEY (id);


--
-- Name: org_feature_flags org_feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_feature_flags
    ADD CONSTRAINT org_feature_flags_pkey PRIMARY KEY (id);


--
-- Name: org_feature_flags org_feature_flags_unique_org_feature; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_feature_flags
    ADD CONSTRAINT org_feature_flags_unique_org_feature UNIQUE (organization_id, feature);


--
-- Name: org_members org_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_members
    ADD CONSTRAINT org_members_pkey PRIMARY KEY (id);


--
-- Name: org_sso_configs org_sso_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_sso_configs
    ADD CONSTRAINT org_sso_configs_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_stripe_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_stripe_customer_id_key UNIQUE (stripe_customer_id);


--
-- Name: qa_evaluation_disclosures qa_evaluation_disclosures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qa_evaluation_disclosures
    ADD CONSTRAINT qa_evaluation_disclosures_pkey PRIMARY KEY (id);


--
-- Name: recordings recordings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recordings
    ADD CONSTRAINT recordings_pkey PRIMARY KEY (id);


--
-- Name: recordings recordings_recording_sid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recordings
    ADD CONSTRAINT recordings_recording_sid_key UNIQUE (recording_sid);


--
-- Name: report_access_log report_access_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report_access_log
    ADD CONSTRAINT report_access_log_pkey PRIMARY KEY (id);


--
-- Name: report_schedules report_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report_schedules
    ADD CONSTRAINT report_schedules_pkey PRIMARY KEY (id);


--
-- Name: report_templates report_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report_templates
    ADD CONSTRAINT report_templates_pkey PRIMARY KEY (id);


--
-- Name: retention_policies retention_policies_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.retention_policies
    ADD CONSTRAINT retention_policies_organization_id_key UNIQUE (organization_id);


--
-- Name: retention_policies retention_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.retention_policies
    ADD CONSTRAINT retention_policies_pkey PRIMARY KEY (id);


--
-- Name: role_capabilities_archived role_capabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_capabilities_archived
    ADD CONSTRAINT role_capabilities_pkey PRIMARY KEY (role_id, capability_id);


--
-- Name: roles_archived roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles_archived
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: scheduled_reports scheduled_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_reports
    ADD CONSTRAINT scheduled_reports_pkey PRIMARY KEY (id);


--
-- Name: scorecards scorecards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scorecards
    ADD CONSTRAINT scorecards_pkey PRIMARY KEY (id);


--
-- Name: scored_recordings scored_recordings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scored_recordings
    ADD CONSTRAINT scored_recordings_pkey PRIMARY KEY (id);


--
-- Name: scored_recordings scored_recordings_recording_id_scorecard_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scored_recordings
    ADD CONSTRAINT scored_recordings_recording_id_scorecard_id_key UNIQUE (recording_id, scorecard_id);


--
-- Name: search_documents search_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.search_documents
    ADD CONSTRAINT search_documents_pkey PRIMARY KEY (id);


--
-- Name: search_events search_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.search_events
    ADD CONSTRAINT search_events_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_sessionToken_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT "sessions_sessionToken_key" UNIQUE ("sessionToken");


--
-- Name: sessions sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_session_token_key UNIQUE (session_token);


--
-- Name: shopper_campaigns_archive shopper_campaigns_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shopper_campaigns_archive
    ADD CONSTRAINT shopper_campaigns_archive_pkey PRIMARY KEY (id);


--
-- Name: shopper_jobs_archive shopper_jobs_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shopper_jobs_archive
    ADD CONSTRAINT shopper_jobs_archive_pkey PRIMARY KEY (id);


--
-- Name: shopper_results shopper_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shopper_results
    ADD CONSTRAINT shopper_results_pkey PRIMARY KEY (id);


--
-- Name: shopper_scripts shopper_scripts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shopper_scripts
    ADD CONSTRAINT shopper_scripts_pkey PRIMARY KEY (id);


--
-- Name: sso_login_events sso_login_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sso_login_events
    ADD CONSTRAINT sso_login_events_pkey PRIMARY KEY (id);


--
-- Name: stock_messages stock_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_messages
    ADD CONSTRAINT stock_messages_pkey PRIMARY KEY (id);


--
-- Name: stripe_events stripe_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stripe_events
    ADD CONSTRAINT stripe_events_pkey PRIMARY KEY (id);


--
-- Name: stripe_events stripe_events_stripe_event_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stripe_events
    ADD CONSTRAINT stripe_events_stripe_event_id_key UNIQUE (stripe_event_id);


--
-- Name: stripe_invoices stripe_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stripe_invoices
    ADD CONSTRAINT stripe_invoices_pkey PRIMARY KEY (id);


--
-- Name: stripe_invoices stripe_invoices_stripe_invoice_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stripe_invoices
    ADD CONSTRAINT stripe_invoices_stripe_invoice_id_key UNIQUE (stripe_invoice_id);


--
-- Name: stripe_payment_methods stripe_payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stripe_payment_methods
    ADD CONSTRAINT stripe_payment_methods_pkey PRIMARY KEY (id);


--
-- Name: stripe_payment_methods stripe_payment_methods_stripe_payment_method_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stripe_payment_methods
    ADD CONSTRAINT stripe_payment_methods_stripe_payment_method_id_key UNIQUE (stripe_payment_method_id);


--
-- Name: stripe_subscriptions stripe_subscriptions_organization_id_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stripe_subscriptions
    ADD CONSTRAINT stripe_subscriptions_organization_id_stripe_subscription_id_key UNIQUE (organization_id, stripe_subscription_id);


--
-- Name: stripe_subscriptions stripe_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stripe_subscriptions
    ADD CONSTRAINT stripe_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: stripe_subscriptions stripe_subscriptions_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stripe_subscriptions
    ADD CONSTRAINT stripe_subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: surveys surveys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_pkey PRIMARY KEY (id);


--
-- Name: systems systems_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.systems
    ADD CONSTRAINT systems_key_key UNIQUE (key);


--
-- Name: systems systems_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.systems
    ADD CONSTRAINT systems_pkey PRIMARY KEY (id);


--
-- Name: team_invites team_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_invites
    ADD CONSTRAINT team_invites_pkey PRIMARY KEY (id);


--
-- Name: team_invites team_invites_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_invites
    ADD CONSTRAINT team_invites_token_key UNIQUE (token);


--
-- Name: test_configs test_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_configs
    ADD CONSTRAINT test_configs_pkey PRIMARY KEY (id);


--
-- Name: test_frequency_config test_frequency_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_frequency_config
    ADD CONSTRAINT test_frequency_config_pkey PRIMARY KEY (id);


--
-- Name: test_results test_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_results
    ADD CONSTRAINT test_results_pkey PRIMARY KEY (id);


--
-- Name: test_statistics test_statistics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_statistics
    ADD CONSTRAINT test_statistics_pkey PRIMARY KEY (id);


--
-- Name: test_statistics test_statistics_test_config_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_statistics
    ADD CONSTRAINT test_statistics_test_config_id_key UNIQUE (test_config_id);


--
-- Name: tool_access_archived tool_access_organization_id_user_id_tool_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool_access_archived
    ADD CONSTRAINT tool_access_organization_id_user_id_tool_key UNIQUE (organization_id, user_id, tool);


--
-- Name: tool_access_archived tool_access_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool_access_archived
    ADD CONSTRAINT tool_access_pkey PRIMARY KEY (id);


--
-- Name: tool_settings tool_settings_organization_id_tool_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool_settings
    ADD CONSTRAINT tool_settings_organization_id_tool_key UNIQUE (organization_id, tool);


--
-- Name: tool_settings tool_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool_settings
    ADD CONSTRAINT tool_settings_pkey PRIMARY KEY (id);


--
-- Name: tool_team_members tool_team_members_organization_id_user_id_tool_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool_team_members
    ADD CONSTRAINT tool_team_members_organization_id_user_id_tool_key UNIQUE (organization_id, user_id, tool);


--
-- Name: tool_team_members tool_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool_team_members
    ADD CONSTRAINT tool_team_members_pkey PRIMARY KEY (id);


--
-- Name: tools tools_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tools
    ADD CONSTRAINT tools_name_key UNIQUE (name);


--
-- Name: tools tools_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tools
    ADD CONSTRAINT tools_pkey PRIMARY KEY (id);


--
-- Name: transcript_versions transcript_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transcript_versions
    ADD CONSTRAINT transcript_versions_pkey PRIMARY KEY (id);


--
-- Name: transcript_versions transcript_versions_recording_id_version_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transcript_versions
    ADD CONSTRAINT transcript_versions_recording_id_version_key UNIQUE (recording_id, version);


--
-- Name: caller_id_numbers unique_org_phone; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caller_id_numbers
    ADD CONSTRAINT unique_org_phone UNIQUE (organization_id, phone_number);


--
-- Name: org_sso_configs unique_org_provider; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_sso_configs
    ADD CONSTRAINT unique_org_provider UNIQUE (organization_id, provider_type);


--
-- Name: org_members unique_org_user; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_members
    ADD CONSTRAINT unique_org_user UNIQUE (organization_id, user_id);


--
-- Name: usage_limits usage_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usage_limits
    ADD CONSTRAINT usage_limits_pkey PRIMARY KEY (id);


--
-- Name: usage_records usage_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usage_records
    ADD CONSTRAINT usage_records_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verification_tokens verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT verification_tokens_pkey PRIMARY KEY (identifier, token);


--
-- Name: voice_configs voice_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.voice_configs
    ADD CONSTRAINT voice_configs_pkey PRIMARY KEY (id);


--
-- Name: voice_targets voice_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.voice_targets
    ADD CONSTRAINT voice_targets_pkey PRIMARY KEY (id);


--
-- Name: webhook_configs webhook_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_configs
    ADD CONSTRAINT webhook_configs_pkey PRIMARY KEY (id);


--
-- Name: webhook_deliveries webhook_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_pkey PRIMARY KEY (id);


--
-- Name: webhook_failures webhook_failures_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_failures
    ADD CONSTRAINT webhook_failures_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: webhook_failures webhook_failures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_failures
    ADD CONSTRAINT webhook_failures_pkey PRIMARY KEY (id);


--
-- Name: webhook_subscriptions webhook_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_subscriptions
    ADD CONSTRAINT webhook_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: webrtc_sessions webrtc_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webrtc_sessions
    ADD CONSTRAINT webrtc_sessions_pkey PRIMARY KEY (id);


--
-- Name: webrtc_sessions webrtc_sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webrtc_sessions
    ADD CONSTRAINT webrtc_sessions_session_token_key UNIQUE (session_token);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_01_20 messages_2026_01_20_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages_2026_01_20
    ADD CONSTRAINT messages_2026_01_20_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_01_21 messages_2026_01_21_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages_2026_01_21
    ADD CONSTRAINT messages_2026_01_21_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_01_22 messages_2026_01_22_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages_2026_01_22
    ADD CONSTRAINT messages_2026_01_22_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_01_23 messages_2026_01_23_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages_2026_01_23
    ADD CONSTRAINT messages_2026_01_23_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_01_24 messages_2026_01_24_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages_2026_01_24
    ADD CONSTRAINT messages_2026_01_24_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_01_25 messages_2026_01_25_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages_2026_01_25
    ADD CONSTRAINT messages_2026_01_25_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_01_26 messages_2026_01_26_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.messages_2026_01_26
    ADD CONSTRAINT messages_2026_01_26_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: prefixes prefixes_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT prefixes_pkey PRIMARY KEY (bucket_id, level, name);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: postgres
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: accounts_provider_provider_account_id_idx; Type: INDEX; Schema: next_auth; Owner: postgres
--

CREATE INDEX accounts_provider_provider_account_id_idx ON next_auth.accounts USING btree (provider, provider_account_id);


--
-- Name: sessions_session_token_idx; Type: INDEX; Schema: next_auth; Owner: postgres
--

CREATE INDEX sessions_session_token_idx ON next_auth.sessions USING btree (session_token);


--
-- Name: calls_call_sid_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX calls_call_sid_idx ON public.calls USING btree (call_sid);


--
-- Name: idx_ai_agent_audit_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_agent_audit_created_at ON public.ai_agent_audit_log USING btree (created_at DESC);


--
-- Name: idx_ai_agent_audit_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_agent_audit_org_id ON public.ai_agent_audit_log USING btree (organization_id);


--
-- Name: idx_ai_runs_call_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_runs_call_id ON public.ai_runs USING btree (call_id);


--
-- Name: idx_ai_runs_job_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_runs_job_id ON public.ai_runs USING btree (job_id);


--
-- Name: idx_ai_runs_model; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_runs_model ON public.ai_runs USING btree (model, status);


--
-- Name: idx_ai_runs_model_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_runs_model_status ON public.ai_runs USING btree (model, status) WHERE (model = 'translation'::text);


--
-- Name: idx_ai_runs_output_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_runs_output_gin ON public.ai_runs USING gin (output);


--
-- Name: idx_ai_runs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_runs_status ON public.ai_runs USING btree (status) WHERE (status = ANY (ARRAY['queued'::text, 'processing'::text]));


--
-- Name: idx_alert_acknowledgements_alert_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alert_acknowledgements_alert_id ON public.alert_acknowledgements USING btree (alert_id);


--
-- Name: idx_alert_acknowledgements_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alert_acknowledgements_user_id ON public.alert_acknowledgements USING btree (user_id);


--
-- Name: idx_artifact_provenance_artifact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_artifact_provenance_artifact ON public.artifact_provenance USING btree (artifact_type, artifact_id);


--
-- Name: idx_artifact_provenance_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_artifact_provenance_org ON public.artifact_provenance USING btree (organization_id);


--
-- Name: idx_artifacts_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_artifacts_type ON public.artifacts USING btree (type);


--
-- Name: idx_attention_decisions_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attention_decisions_created_at ON public.attention_decisions USING btree (created_at DESC);


--
-- Name: idx_attention_decisions_decision; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attention_decisions_decision ON public.attention_decisions USING btree (decision);


--
-- Name: idx_attention_decisions_event; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attention_decisions_event ON public.attention_decisions USING btree (attention_event_id);


--
-- Name: idx_attention_decisions_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attention_decisions_org ON public.attention_decisions USING btree (organization_id);


--
-- Name: idx_attention_events_occurred_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attention_events_occurred_at ON public.attention_events USING btree (occurred_at DESC);


--
-- Name: idx_attention_events_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attention_events_org ON public.attention_events USING btree (organization_id);


--
-- Name: idx_attention_events_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attention_events_source ON public.attention_events USING btree (source_table, source_id);


--
-- Name: idx_attention_events_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attention_events_type ON public.attention_events USING btree (event_type);


--
-- Name: idx_attention_policies_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attention_policies_org ON public.attention_policies USING btree (organization_id);


--
-- Name: idx_attention_policies_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attention_policies_priority ON public.attention_policies USING btree (organization_id, priority) WHERE (is_enabled = true);


--
-- Name: idx_audit_logs_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_org_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_org_action ON public.audit_logs USING btree (organization_id, action);


--
-- Name: idx_audit_logs_org_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_org_created ON public.audit_logs USING btree (organization_id, created_at DESC);


--
-- Name: idx_audit_logs_resource; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_resource ON public.audit_logs USING btree (resource_type, resource_id);


--
-- Name: idx_audit_logs_resource_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_resource_id ON public.audit_logs USING btree (resource_id);


--
-- Name: idx_audit_logs_resource_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_resource_type_id ON public.audit_logs USING btree (resource_type, resource_id);


--
-- Name: idx_booking_events_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_booking_events_org_id ON public.booking_events USING btree (organization_id);


--
-- Name: idx_booking_events_pending_calls; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_booking_events_pending_calls ON public.booking_events USING btree (start_time) WHERE (status = 'pending'::text);


--
-- Name: idx_booking_events_start_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_booking_events_start_time ON public.booking_events USING btree (start_time);


--
-- Name: idx_booking_events_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_booking_events_status ON public.booking_events USING btree (status);


--
-- Name: idx_call_confirmations_call_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_call_confirmations_call_id ON public.call_confirmations USING btree (call_id);


--
-- Name: idx_call_confirmations_confirmed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_call_confirmations_confirmed_at ON public.call_confirmations USING btree (confirmed_at DESC);


--
-- Name: idx_call_confirmations_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_call_confirmations_org_id ON public.call_confirmations USING btree (organization_id);


--
-- Name: idx_call_confirmations_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_call_confirmations_type ON public.call_confirmations USING btree (confirmation_type);


--
-- Name: idx_caller_id_default_rules_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_caller_id_default_rules_org ON public.caller_id_default_rules USING btree (organization_id) WHERE (is_active = true);


--
-- Name: idx_caller_id_default_rules_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_caller_id_default_rules_priority ON public.caller_id_default_rules USING btree (organization_id, priority) WHERE (is_active = true);


--
-- Name: idx_caller_id_default_rules_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_caller_id_default_rules_user ON public.caller_id_default_rules USING btree (user_id) WHERE ((is_active = true) AND (user_id IS NOT NULL));


--
-- Name: idx_caller_id_numbers_default; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_caller_id_numbers_default ON public.caller_id_numbers USING btree (organization_id) WHERE (is_default = true);


--
-- Name: idx_caller_id_numbers_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_caller_id_numbers_org ON public.caller_id_numbers USING btree (organization_id);


--
-- Name: idx_caller_id_permissions_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_caller_id_permissions_active ON public.caller_id_permissions USING btree (organization_id, caller_id_number_id, user_id) WHERE (is_active = true);


--
-- Name: idx_caller_id_permissions_caller_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_caller_id_permissions_caller_id ON public.caller_id_permissions USING btree (caller_id_number_id);


--
-- Name: idx_caller_id_permissions_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_caller_id_permissions_org ON public.caller_id_permissions USING btree (organization_id);


--
-- Name: idx_caller_id_permissions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_caller_id_permissions_user ON public.caller_id_permissions USING btree (user_id) WHERE (is_active = true);


--
-- Name: idx_calls_call_sid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_calls_call_sid ON public.calls USING btree (call_sid) WHERE (call_sid IS NOT NULL);


--
-- Name: idx_calls_disclosure_given; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_calls_disclosure_given ON public.calls USING btree (disclosure_given) WHERE (disclosure_given = true);


--
-- Name: idx_calls_org_started; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_calls_org_started ON public.calls USING btree (organization_id, started_at DESC) WHERE (started_at IS NOT NULL);


--
-- Name: idx_calls_org_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_calls_org_status ON public.calls USING btree (organization_id, status);


--
-- Name: idx_campaign_audit_campaign; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaign_audit_campaign ON public.campaign_audit_log USING btree (campaign_id);


--
-- Name: idx_campaign_calls_campaign; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaign_calls_campaign ON public.campaign_calls USING btree (campaign_id);


--
-- Name: idx_campaign_calls_scheduled_for; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaign_calls_scheduled_for ON public.campaign_calls USING btree (scheduled_for) WHERE (scheduled_for IS NOT NULL);


--
-- Name: idx_campaign_calls_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaign_calls_status ON public.campaign_calls USING btree (status);


--
-- Name: idx_campaigns_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaigns_organization ON public.campaigns USING btree (organization_id);


--
-- Name: idx_campaigns_scheduled_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaigns_scheduled_at ON public.campaigns USING btree (scheduled_at) WHERE (scheduled_at IS NOT NULL);


--
-- Name: idx_campaigns_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaigns_status ON public.campaigns USING btree (status);


--
-- Name: idx_carrier_status_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_status_name ON public.carrier_status USING btree (carrier_name);


--
-- Name: idx_carrier_status_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carrier_status_updated ON public.carrier_status USING btree (last_updated DESC);


--
-- Name: idx_compliance_restrictions_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compliance_restrictions_active ON public.compliance_restrictions USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_compliance_restrictions_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compliance_restrictions_code ON public.compliance_restrictions USING btree (restriction_code);


--
-- Name: idx_compliance_violations_call_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compliance_violations_call_id ON public.compliance_violations USING btree (call_id);


--
-- Name: idx_compliance_violations_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compliance_violations_created_at ON public.compliance_violations USING btree (created_at DESC);


--
-- Name: idx_compliance_violations_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compliance_violations_org_id ON public.compliance_violations USING btree (organization_id);


--
-- Name: idx_compliance_violations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compliance_violations_status ON public.compliance_violations USING btree (resolution_status);


--
-- Name: idx_confirmation_checklists_call_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_confirmation_checklists_call_id ON public.call_confirmation_checklists USING btree (call_id);


--
-- Name: idx_confirmation_checklists_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_confirmation_checklists_status ON public.call_confirmation_checklists USING btree (status);


--
-- Name: idx_confirmation_templates_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_confirmation_templates_active ON public.confirmation_templates USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_confirmation_templates_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_confirmation_templates_org_id ON public.confirmation_templates USING btree (organization_id);


--
-- Name: idx_confirmation_templates_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_confirmation_templates_type ON public.confirmation_templates USING btree (confirmation_type);


--
-- Name: idx_crm_object_links_call_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_object_links_call_id ON public.crm_object_links USING btree (call_id);


--
-- Name: idx_crm_object_links_crm_object; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_object_links_crm_object ON public.crm_object_links USING btree (crm_object_type, crm_object_id);


--
-- Name: idx_crm_object_links_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_object_links_org_id ON public.crm_object_links USING btree (organization_id);


--
-- Name: idx_crm_sync_log_call_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_sync_log_call_id ON public.crm_sync_log USING btree (call_id);


--
-- Name: idx_crm_sync_log_idempotency; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_sync_log_idempotency ON public.crm_sync_log USING btree (idempotency_key);


--
-- Name: idx_crm_sync_log_integration; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_sync_log_integration ON public.crm_sync_log USING btree (integration_id);


--
-- Name: idx_crm_sync_log_operation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_sync_log_operation ON public.crm_sync_log USING btree (operation);


--
-- Name: idx_crm_sync_log_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_sync_log_org_id ON public.crm_sync_log USING btree (organization_id);


--
-- Name: idx_crm_sync_log_started_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_sync_log_started_at ON public.crm_sync_log USING btree (started_at);


--
-- Name: idx_digest_items_digest; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_digest_items_digest ON public.digest_items USING btree (digest_id);


--
-- Name: idx_digests_generated_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_digests_generated_at ON public.digests USING btree (generated_at DESC);


--
-- Name: idx_digests_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_digests_org ON public.digests USING btree (organization_id);


--
-- Name: idx_disclosure_logs_call_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_disclosure_logs_call_id ON public.disclosure_logs USING btree (call_id);


--
-- Name: idx_disclosure_logs_disclosed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_disclosure_logs_disclosed_at ON public.disclosure_logs USING btree (disclosed_at DESC);


--
-- Name: idx_disclosure_logs_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_disclosure_logs_org_id ON public.disclosure_logs USING btree (organization_id);


--
-- Name: idx_disclosure_logs_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_disclosure_logs_type ON public.disclosure_logs USING btree (disclosure_type);


--
-- Name: idx_evidence_bundles_call; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_evidence_bundles_call ON public.evidence_bundles USING btree (call_id, created_at DESC);


--
-- Name: idx_evidence_bundles_manifest; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_evidence_bundles_manifest ON public.evidence_bundles USING btree (manifest_id);


--
-- Name: idx_evidence_bundles_org_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_evidence_bundles_org_created ON public.evidence_bundles USING btree (organization_id, created_at DESC);


--
-- Name: idx_evidence_manifests_authoritative; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_evidence_manifests_authoritative ON public.evidence_manifests USING btree (is_authoritative) WHERE (is_authoritative = true);


--
-- Name: idx_evidence_manifests_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_evidence_manifests_org ON public.evidence_manifests USING btree (organization_id);


--
-- Name: idx_evidence_manifests_recording; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_evidence_manifests_recording ON public.evidence_manifests USING btree (recording_id);


--
-- Name: idx_export_compliance_log_call; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_export_compliance_log_call ON public.export_compliance_log USING btree (call_id, requested_at DESC);


--
-- Name: idx_external_entities_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_external_entities_org_id ON public.external_entities USING btree (organization_id);


--
-- Name: idx_external_entities_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_external_entities_type ON public.external_entities USING btree (entity_type);


--
-- Name: idx_external_entity_identifiers_entity_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_external_entity_identifiers_entity_id ON public.external_entity_identifiers USING btree (entity_id);


--
-- Name: idx_external_entity_identifiers_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_external_entity_identifiers_org_id ON public.external_entity_identifiers USING btree (organization_id);


--
-- Name: idx_external_entity_identifiers_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_external_entity_identifiers_type ON public.external_entity_identifiers USING btree (identifier_type);


--
-- Name: idx_external_entity_identifiers_value; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_external_entity_identifiers_value ON public.external_entity_identifiers USING btree (identifier_normalized);


--
-- Name: idx_external_entity_links_identifier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_external_entity_links_identifier ON public.external_entity_links USING btree (identifier_id);


--
-- Name: idx_external_entity_links_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_external_entity_links_org_id ON public.external_entity_links USING btree (organization_id);


--
-- Name: idx_external_entity_links_source_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_external_entity_links_source_entity ON public.external_entity_links USING btree (source_entity_id);


--
-- Name: idx_external_entity_links_target_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_external_entity_links_target_entity ON public.external_entity_links USING btree (target_entity_id);


--
-- Name: idx_external_entity_observations_identifier_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_external_entity_observations_identifier_id ON public.external_entity_observations USING btree (identifier_id);


--
-- Name: idx_external_entity_observations_observed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_external_entity_observations_observed_at ON public.external_entity_observations USING btree (observed_at);


--
-- Name: idx_external_entity_observations_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_external_entity_observations_org_id ON public.external_entity_observations USING btree (organization_id);


--
-- Name: idx_external_entity_observations_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_external_entity_observations_source ON public.external_entity_observations USING btree (source_type, source_id);


--
-- Name: idx_generated_reports_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_generated_reports_expires_at ON public.generated_reports USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: idx_generated_reports_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_generated_reports_organization ON public.generated_reports USING btree (organization_id);


--
-- Name: idx_generated_reports_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_generated_reports_status ON public.generated_reports USING btree (status);


--
-- Name: idx_generated_reports_template; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_generated_reports_template ON public.generated_reports USING btree (template_id);


--
-- Name: idx_incidents_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incidents_active ON public.network_incidents USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_incidents_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incidents_date ON public.network_incidents USING btree (pub_date DESC);


--
-- Name: idx_incidents_org_severity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incidents_org_severity ON public.incidents USING btree (organization_id, severity, created_at DESC);


--
-- Name: idx_incidents_unresolved; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incidents_unresolved ON public.incidents USING btree (organization_id, created_at DESC) WHERE (resolved_at IS NULL);


--
-- Name: idx_integrations_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_integrations_org_id ON public.integrations USING btree (organization_id);


--
-- Name: idx_integrations_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_integrations_provider ON public.integrations USING btree (provider);


--
-- Name: idx_integrations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_integrations_status ON public.integrations USING btree (status);


--
-- Name: idx_kpi_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_kpi_logs_created_at ON public.kpi_logs USING btree (created_at DESC);


--
-- Name: idx_kpi_logs_stage_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_kpi_logs_stage_status ON public.kpi_logs USING btree (stage, status);


--
-- Name: idx_kpi_logs_test_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_kpi_logs_test_id ON public.kpi_logs USING btree (test_id);


--
-- Name: idx_kpi_settings_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_kpi_settings_org ON public.kpi_settings USING btree (organization_id);


--
-- Name: idx_legal_holds_org_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_legal_holds_org_status ON public.legal_holds USING btree (organization_id, status);


--
-- Name: idx_monitored_numbers_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_monitored_numbers_active ON public.monitored_numbers USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_monitored_numbers_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_monitored_numbers_org ON public.monitored_numbers USING btree (organization_id);


--
-- Name: idx_number_kpi_logs_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_number_kpi_logs_number ON public.number_kpi_logs USING btree (monitored_number_id, created_at DESC);


--
-- Name: idx_number_kpi_snapshot_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_number_kpi_snapshot_number ON public.number_kpi_snapshot USING btree (monitored_number_id);


--
-- Name: idx_oauth_tokens_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_oauth_tokens_expires ON public.oauth_tokens USING btree (expires_at);


--
-- Name: idx_org_members_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_org_members_org ON public.org_members USING btree (organization_id);


--
-- Name: idx_org_members_org_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_org_members_org_role ON public.org_members USING btree (organization_id, role);


--
-- Name: idx_org_members_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_org_members_user ON public.org_members USING btree (user_id);


--
-- Name: idx_org_members_user_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_org_members_user_org ON public.org_members USING btree (user_id, organization_id);


--
-- Name: idx_org_sso_configs_domains; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_org_sso_configs_domains ON public.org_sso_configs USING gin (verified_domains);


--
-- Name: idx_org_sso_configs_enabled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_org_sso_configs_enabled ON public.org_sso_configs USING btree (is_enabled) WHERE (is_enabled = true);


--
-- Name: idx_org_sso_configs_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_org_sso_configs_org_id ON public.org_sso_configs USING btree (organization_id);


--
-- Name: idx_org_sso_configs_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_org_sso_configs_provider ON public.org_sso_configs USING btree (provider_type);


--
-- Name: idx_organizations_plan; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organizations_plan ON public.organizations USING btree (plan);


--
-- Name: idx_organizations_plan_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organizations_plan_status ON public.organizations USING btree (plan_status);


--
-- Name: idx_organizations_stripe_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_organizations_stripe_customer_id ON public.organizations USING btree (stripe_customer_id);


--
-- Name: idx_qa_disclosures_call_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_qa_disclosures_call_id ON public.qa_evaluation_disclosures USING btree (call_id);


--
-- Name: idx_qa_disclosures_disclosed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_qa_disclosures_disclosed_at ON public.qa_evaluation_disclosures USING btree (disclosed_at DESC);


--
-- Name: idx_qa_disclosures_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_qa_disclosures_org_id ON public.qa_evaluation_disclosures USING btree (organization_id);


--
-- Name: idx_recordings_authoritative; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recordings_authoritative ON public.recordings USING btree (is_authoritative) WHERE (is_authoritative = true);


--
-- Name: idx_recordings_call_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recordings_call_id ON public.recordings USING btree (call_id);


--
-- Name: idx_recordings_call_sid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recordings_call_sid ON public.recordings USING btree (call_sid);


--
-- Name: idx_recordings_has_live_translation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recordings_has_live_translation ON public.recordings USING btree (organization_id, has_live_translation) WHERE (has_live_translation = true);


--
-- Name: idx_recordings_live_translation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recordings_live_translation ON public.recordings USING btree (has_live_translation) WHERE (has_live_translation = true);


--
-- Name: idx_recordings_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recordings_org ON public.recordings USING btree (organization_id);


--
-- Name: idx_recordings_org_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recordings_org_created ON public.recordings USING btree (organization_id, created_at DESC);


--
-- Name: idx_recordings_org_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recordings_org_status ON public.recordings USING btree (organization_id, status);


--
-- Name: idx_recordings_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recordings_status ON public.recordings USING btree (status) WHERE (status <> 'completed'::text);


--
-- Name: idx_report_access_log_report; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_report_access_log_report ON public.report_access_log USING btree (report_id);


--
-- Name: idx_report_schedules_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_report_schedules_org_id ON public.report_schedules USING btree (organization_id);


--
-- Name: idx_report_templates_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_report_templates_organization ON public.report_templates USING btree (organization_id);


--
-- Name: idx_report_templates_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_report_templates_type ON public.report_templates USING btree (report_type);


--
-- Name: idx_retention_policies_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_retention_policies_org ON public.retention_policies USING btree (organization_id);


--
-- Name: idx_scheduled_reports_next_run; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scheduled_reports_next_run ON public.scheduled_reports USING btree (next_run_at) WHERE (is_active = true);


--
-- Name: idx_scheduled_reports_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scheduled_reports_organization ON public.scheduled_reports USING btree (organization_id);


--
-- Name: idx_scorecards_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scorecards_org ON public.scorecards USING btree (organization_id);


--
-- Name: idx_scorecards_template; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scorecards_template ON public.scorecards USING btree (is_template);


--
-- Name: idx_scored_recordings_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scored_recordings_org ON public.scored_recordings USING btree (organization_id);


--
-- Name: idx_scored_recordings_recording; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scored_recordings_recording ON public.scored_recordings USING btree (recording_id);


--
-- Name: idx_scored_recordings_scorecard; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scored_recordings_scorecard ON public.scored_recordings USING btree (scorecard_id);


--
-- Name: idx_search_documents_call_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_search_documents_call_id ON public.search_documents USING btree (call_id);


--
-- Name: idx_search_documents_current; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_search_documents_current ON public.search_documents USING btree (organization_id, source_type, source_id) WHERE (is_current = true);


--
-- Name: idx_search_documents_domain; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_search_documents_domain ON public.search_documents USING btree (domain);


--
-- Name: idx_search_documents_fts; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_search_documents_fts ON public.search_documents USING gin (to_tsvector('english'::regconfig, ((COALESCE(title, ''::text) || ' '::text) || content)));


--
-- Name: idx_search_documents_indexed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_search_documents_indexed_at ON public.search_documents USING btree (indexed_at);


--
-- Name: idx_search_documents_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_search_documents_org_id ON public.search_documents USING btree (organization_id);


--
-- Name: idx_search_documents_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_search_documents_phone ON public.search_documents USING btree (phone_number);


--
-- Name: idx_search_documents_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_search_documents_source ON public.search_documents USING btree (source_type, source_id);


--
-- Name: idx_search_events_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_search_events_created_at ON public.search_events USING btree (created_at);


--
-- Name: idx_search_events_document_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_search_events_document_id ON public.search_events USING btree (document_id);


--
-- Name: idx_search_events_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_search_events_org_id ON public.search_events USING btree (organization_id);


--
-- Name: idx_shopper_results_call_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shopper_results_call_id ON public.shopper_results USING btree (call_id);


--
-- Name: idx_shopper_results_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shopper_results_org_id ON public.shopper_results USING btree (organization_id);


--
-- Name: idx_shopper_scripts_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shopper_scripts_org_id ON public.shopper_scripts USING btree (organization_id);


--
-- Name: idx_sso_login_events_config_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sso_login_events_config_id ON public.sso_login_events USING btree (sso_config_id);


--
-- Name: idx_sso_login_events_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sso_login_events_created_at ON public.sso_login_events USING btree (created_at DESC);


--
-- Name: idx_sso_login_events_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sso_login_events_org_id ON public.sso_login_events USING btree (organization_id);


--
-- Name: idx_sso_login_events_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sso_login_events_user_id ON public.sso_login_events USING btree (user_id);


--
-- Name: idx_stripe_events_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stripe_events_created_at ON public.stripe_events USING btree (created_at DESC);


--
-- Name: idx_stripe_events_event_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stripe_events_event_type ON public.stripe_events USING btree (event_type);


--
-- Name: idx_stripe_events_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stripe_events_org_id ON public.stripe_events USING btree (organization_id);


--
-- Name: idx_stripe_events_processed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stripe_events_processed ON public.stripe_events USING btree (processed) WHERE (processed = false);


--
-- Name: idx_stripe_invoices_invoice_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stripe_invoices_invoice_date ON public.stripe_invoices USING btree (invoice_date DESC);


--
-- Name: idx_stripe_invoices_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stripe_invoices_org_id ON public.stripe_invoices USING btree (organization_id);


--
-- Name: idx_stripe_invoices_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stripe_invoices_status ON public.stripe_invoices USING btree (status);


--
-- Name: idx_stripe_invoices_stripe_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stripe_invoices_stripe_customer_id ON public.stripe_invoices USING btree (stripe_customer_id);


--
-- Name: idx_stripe_payment_methods_is_default; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stripe_payment_methods_is_default ON public.stripe_payment_methods USING btree (is_default) WHERE (is_default = true);


--
-- Name: idx_stripe_payment_methods_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stripe_payment_methods_org_id ON public.stripe_payment_methods USING btree (organization_id);


--
-- Name: idx_stripe_payment_methods_stripe_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stripe_payment_methods_stripe_customer_id ON public.stripe_payment_methods USING btree (stripe_customer_id);


--
-- Name: idx_stripe_subscriptions_current_period_end; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stripe_subscriptions_current_period_end ON public.stripe_subscriptions USING btree (current_period_end);


--
-- Name: idx_stripe_subscriptions_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stripe_subscriptions_org_id ON public.stripe_subscriptions USING btree (organization_id);


--
-- Name: idx_stripe_subscriptions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stripe_subscriptions_status ON public.stripe_subscriptions USING btree (status);


--
-- Name: idx_stripe_subscriptions_stripe_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stripe_subscriptions_stripe_customer_id ON public.stripe_subscriptions USING btree (stripe_customer_id);


--
-- Name: idx_surveys_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_surveys_active ON public.surveys USING btree (organization_id, is_active) WHERE (is_active = true);


--
-- Name: idx_surveys_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_surveys_org ON public.surveys USING btree (organization_id);


--
-- Name: idx_team_invites_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_team_invites_expires_at ON public.team_invites USING btree (expires_at) WHERE (status = 'pending'::text);


--
-- Name: idx_team_invites_org_email_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_team_invites_org_email_status ON public.team_invites USING btree (organization_id, email, status);


--
-- Name: idx_team_invites_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_team_invites_token ON public.team_invites USING btree (token);


--
-- Name: idx_test_statistics_config; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_test_statistics_config ON public.test_statistics USING btree (test_config_id);


--
-- Name: idx_tool_access_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tool_access_org ON public.tool_access_archived USING btree (organization_id);


--
-- Name: idx_tool_access_tool; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tool_access_tool ON public.tool_access_archived USING btree (tool);


--
-- Name: idx_tool_access_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tool_access_user ON public.tool_access_archived USING btree (user_id);


--
-- Name: idx_tool_settings_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tool_settings_org ON public.tool_settings USING btree (organization_id);


--
-- Name: idx_tool_team_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tool_team_org ON public.tool_team_members USING btree (organization_id);


--
-- Name: idx_tool_team_tool; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tool_team_tool ON public.tool_team_members USING btree (tool);


--
-- Name: idx_tool_team_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tool_team_user ON public.tool_team_members USING btree (user_id);


--
-- Name: idx_transcripts_authoritative; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transcripts_authoritative ON public.transcript_versions USING btree (is_authoritative) WHERE (is_authoritative = true);


--
-- Name: idx_voice_configs_ai_agent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_voice_configs_ai_agent_id ON public.voice_configs USING btree (ai_agent_id) WHERE (ai_agent_id IS NOT NULL);


--
-- Name: idx_voice_configs_live_translate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_voice_configs_live_translate ON public.voice_configs USING btree (live_translate) WHERE (live_translate = true);


--
-- Name: idx_voice_configs_survey_enabled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_voice_configs_survey_enabled ON public.voice_configs USING btree (organization_id) WHERE (survey = true);


--
-- Name: idx_voice_configs_voice_cloning; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_voice_configs_voice_cloning ON public.voice_configs USING btree (organization_id) WHERE (use_voice_cloning = true);


--
-- Name: idx_voice_targets_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_voice_targets_active ON public.voice_targets USING btree (organization_id, is_active) WHERE (is_active = true);


--
-- Name: idx_voice_targets_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_voice_targets_org ON public.voice_targets USING btree (organization_id);


--
-- Name: idx_webhook_configs_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webhook_configs_org_id ON public.webhook_configs USING btree (organization_id);


--
-- Name: idx_webhook_failures_idempotency; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webhook_failures_idempotency ON public.webhook_failures USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: idx_webhook_failures_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webhook_failures_org ON public.webhook_failures USING btree (organization_id, created_at DESC);


--
-- Name: idx_webhook_failures_status_retry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webhook_failures_status_retry ON public.webhook_failures USING btree (status, next_retry_at) WHERE (status = ANY (ARRAY['pending'::text, 'retrying'::text]));


--
-- Name: idx_webrtc_sessions_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webrtc_sessions_org ON public.webrtc_sessions USING btree (organization_id, created_at DESC);


--
-- Name: idx_webrtc_sessions_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webrtc_sessions_token ON public.webrtc_sessions USING btree (session_token);


--
-- Name: idx_webrtc_sessions_user_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webrtc_sessions_user_status ON public.webrtc_sessions USING btree (user_id, status) WHERE (status = ANY (ARRAY['initializing'::text, 'connecting'::text, 'connected'::text, 'on_call'::text]));


--
-- Name: login_attempts_attempted_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX login_attempts_attempted_at_idx ON public.login_attempts USING btree (attempted_at);


--
-- Name: login_attempts_username_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX login_attempts_username_idx ON public.login_attempts USING btree (username);


--
-- Name: shopper_campaigns_archive_caller_number_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX shopper_campaigns_archive_caller_number_idx ON public.shopper_campaigns_archive USING btree (caller_number);


--
-- Name: shopper_campaigns_archive_organization_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX shopper_campaigns_archive_organization_id_idx ON public.shopper_campaigns_archive USING btree (organization_id);


--
-- Name: shopper_jobs_archive_status_next_try_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX shopper_jobs_archive_status_next_try_at_idx ON public.shopper_jobs_archive USING btree (status, next_try_at);


--
-- Name: uq_evidence_bundles_manifest_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_evidence_bundles_manifest_active ON public.evidence_bundles USING btree (manifest_id) WHERE (superseded_at IS NULL);


--
-- Name: voice_configs_organization_id_uindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX voice_configs_organization_id_uindex ON public.voice_configs USING btree (organization_id);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_01_20_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE INDEX messages_2026_01_20_inserted_at_topic_idx ON realtime.messages_2026_01_20 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_01_21_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE INDEX messages_2026_01_21_inserted_at_topic_idx ON realtime.messages_2026_01_21 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_01_22_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE INDEX messages_2026_01_22_inserted_at_topic_idx ON realtime.messages_2026_01_22 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_01_23_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE INDEX messages_2026_01_23_inserted_at_topic_idx ON realtime.messages_2026_01_23 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_01_24_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE INDEX messages_2026_01_24_inserted_at_topic_idx ON realtime.messages_2026_01_24 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_01_25_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE INDEX messages_2026_01_25_inserted_at_topic_idx ON realtime.messages_2026_01_25 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_01_26_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE INDEX messages_2026_01_26_inserted_at_topic_idx ON realtime.messages_2026_01_26 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_key; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_key ON realtime.subscription USING btree (subscription_id, entity, filters);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_name_bucket_level_unique; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX idx_name_bucket_level_unique ON storage.objects USING btree (name COLLATE "C", bucket_id, level);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_lower_name; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_objects_lower_name ON storage.objects USING btree ((path_tokens[level]), lower(name) text_pattern_ops, bucket_id, level);


--
-- Name: idx_prefixes_lower_name; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_prefixes_lower_name ON storage.prefixes USING btree (bucket_id, level, ((string_to_array(name, '/'::text))[level]), lower(name) text_pattern_ops);


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: objects_bucket_id_level_idx; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX objects_bucket_id_level_idx ON storage.objects USING btree (bucket_id, level, name COLLATE "C");


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: messages_2026_01_20_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_01_20_inserted_at_topic_idx;


--
-- Name: messages_2026_01_20_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_01_20_pkey;


--
-- Name: messages_2026_01_21_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_01_21_inserted_at_topic_idx;


--
-- Name: messages_2026_01_21_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_01_21_pkey;


--
-- Name: messages_2026_01_22_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_01_22_inserted_at_topic_idx;


--
-- Name: messages_2026_01_22_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_01_22_pkey;


--
-- Name: messages_2026_01_23_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_01_23_inserted_at_topic_idx;


--
-- Name: messages_2026_01_23_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_01_23_pkey;


--
-- Name: messages_2026_01_24_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_01_24_inserted_at_topic_idx;


--
-- Name: messages_2026_01_24_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_01_24_pkey;


--
-- Name: messages_2026_01_25_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_01_25_inserted_at_topic_idx;


--
-- Name: messages_2026_01_25_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_01_25_pkey;


--
-- Name: messages_2026_01_26_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_01_26_inserted_at_topic_idx;


--
-- Name: messages_2026_01_26_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_01_26_pkey;


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: supabase_auth_admin
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: sessions sessions_sessiontoken_sync; Type: TRIGGER; Schema: next_auth; Owner: postgres
--

CREATE TRIGGER sessions_sessiontoken_sync BEFORE INSERT OR UPDATE ON next_auth.sessions FOR EACH ROW EXECUTE FUNCTION next_auth.sync_sessions_sessiontoken();


--
-- Name: ai_runs ai_runs_soft_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER ai_runs_soft_delete BEFORE DELETE ON public.ai_runs FOR EACH ROW EXECUTE FUNCTION public.soft_delete_ai_run();


--
-- Name: artifact_provenance artifact_provenance_immutable; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER artifact_provenance_immutable BEFORE UPDATE ON public.artifact_provenance FOR EACH ROW EXECUTE FUNCTION public.prevent_artifact_provenance_update();


--
-- Name: attention_decisions attention_decisions_immutable; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER attention_decisions_immutable BEFORE UPDATE ON public.attention_decisions FOR EACH ROW EXECUTE FUNCTION public.prevent_attention_decision_update();


--
-- Name: attention_decisions attention_decisions_no_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER attention_decisions_no_delete BEFORE DELETE ON public.attention_decisions FOR EACH ROW EXECUTE FUNCTION public.prevent_attention_decision_delete();


--
-- Name: attention_events attention_events_immutable; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER attention_events_immutable BEFORE UPDATE ON public.attention_events FOR EACH ROW EXECUTE FUNCTION public.prevent_attention_event_update();


--
-- Name: attention_events attention_events_no_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER attention_events_no_delete BEFORE DELETE ON public.attention_events FOR EACH ROW EXECUTE FUNCTION public.prevent_attention_event_delete();


--
-- Name: audit_logs audit_logs_actor_type; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_logs_actor_type BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.set_audit_log_actor_type();


--
-- Name: booking_events booking_events_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER booking_events_updated_at BEFORE UPDATE ON public.booking_events FOR EACH ROW EXECUTE FUNCTION public.update_booking_updated_at();


--
-- Name: calls calls_soft_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER calls_soft_delete BEFORE DELETE ON public.calls FOR EACH ROW EXECUTE FUNCTION public.soft_delete_call();


--
-- Name: crm_sync_log crm_sync_log_immutable; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER crm_sync_log_immutable BEFORE UPDATE ON public.crm_sync_log FOR EACH ROW EXECUTE FUNCTION public.prevent_crm_sync_log_update();


--
-- Name: crm_sync_log crm_sync_log_no_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER crm_sync_log_no_delete BEFORE DELETE ON public.crm_sync_log FOR EACH ROW EXECUTE FUNCTION public.prevent_crm_sync_log_delete();


--
-- Name: digests digests_immutable; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER digests_immutable BEFORE UPDATE ON public.digests FOR EACH ROW EXECUTE FUNCTION public.prevent_digest_update();


--
-- Name: digests digests_no_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER digests_no_delete BEFORE DELETE ON public.digests FOR EACH ROW EXECUTE FUNCTION public.prevent_digest_delete();


--
-- Name: evidence_bundles evidence_bundles_immutable; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER evidence_bundles_immutable BEFORE UPDATE ON public.evidence_bundles FOR EACH ROW EXECUTE FUNCTION public.prevent_evidence_bundle_content_update();


--
-- Name: evidence_manifests evidence_manifests_immutable; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER evidence_manifests_immutable BEFORE UPDATE ON public.evidence_manifests FOR EACH ROW EXECUTE FUNCTION public.prevent_evidence_manifest_content_update();


--
-- Name: TRIGGER evidence_manifests_immutable ON evidence_manifests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TRIGGER evidence_manifests_immutable ON public.evidence_manifests IS 'Enforces append-only policy per System of Record requirement 3';


--
-- Name: external_entity_observations external_entity_observations_immutable; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER external_entity_observations_immutable BEFORE UPDATE ON public.external_entity_observations FOR EACH ROW EXECUTE FUNCTION public.prevent_observation_update();


--
-- Name: external_entity_observations external_entity_observations_no_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER external_entity_observations_no_delete BEFORE DELETE ON public.external_entity_observations FOR EACH ROW EXECUTE FUNCTION public.prevent_observation_delete();


--
-- Name: legal_holds legal_hold_apply; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER legal_hold_apply AFTER INSERT OR UPDATE ON public.legal_holds FOR EACH ROW EXECUTE FUNCTION public.apply_legal_hold();


--
-- Name: voice_configs log_ai_agent_config_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER log_ai_agent_config_trigger AFTER INSERT OR DELETE OR UPDATE ON public.voice_configs FOR EACH ROW EXECUTE FUNCTION public.log_ai_agent_config_change();


--
-- Name: recordings recordings_soft_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER recordings_soft_delete BEFORE DELETE ON public.recordings FOR EACH ROW EXECUTE FUNCTION public.soft_delete_recording();


--
-- Name: search_documents search_documents_immutable; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER search_documents_immutable BEFORE UPDATE ON public.search_documents FOR EACH ROW EXECUTE FUNCTION public.prevent_search_document_update();


--
-- Name: search_documents search_documents_no_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER search_documents_no_delete BEFORE DELETE ON public.search_documents FOR EACH ROW EXECUTE FUNCTION public.prevent_search_document_delete();


--
-- Name: search_events search_events_immutable; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER search_events_immutable BEFORE UPDATE ON public.search_events FOR EACH ROW EXECUTE FUNCTION public.prevent_search_event_update();


--
-- Name: search_events search_events_no_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER search_events_no_delete BEFORE DELETE ON public.search_events FOR EACH ROW EXECUTE FUNCTION public.prevent_search_event_delete();


--
-- Name: sessions sessions_sessiontoken_sync; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER sessions_sessiontoken_sync BEFORE INSERT OR UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.sync_sessions_sessiontoken();


--
-- Name: call_confirmations set_call_confirmations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_call_confirmations_updated_at BEFORE UPDATE ON public.call_confirmations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: call_confirmation_checklists set_confirmation_checklists_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_confirmation_checklists_updated_at BEFORE UPDATE ON public.call_confirmation_checklists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: confirmation_templates set_confirmation_templates_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_confirmation_templates_updated_at BEFORE UPDATE ON public.confirmation_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stripe_subscriptions sync_org_plan_on_subscription_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER sync_org_plan_on_subscription_change AFTER INSERT OR UPDATE ON public.stripe_subscriptions FOR EACH ROW EXECUTE FUNCTION public.sync_organization_plan();


--
-- Name: transcript_versions transcript_versions_immutable; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER transcript_versions_immutable BEFORE UPDATE ON public.transcript_versions FOR EACH ROW EXECUTE FUNCTION public.prevent_transcript_version_update();


--
-- Name: campaign_calls update_campaign_calls_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_campaign_calls_updated_at BEFORE UPDATE ON public.campaign_calls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: campaigns update_campaigns_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: report_templates update_report_templates_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_report_templates_updated_at BEFORE UPDATE ON public.report_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: scheduled_reports update_scheduled_reports_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_scheduled_reports_updated_at BEFORE UPDATE ON public.scheduled_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stripe_invoices update_stripe_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_stripe_invoices_updated_at BEFORE UPDATE ON public.stripe_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stripe_payment_methods update_stripe_payment_methods_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_stripe_payment_methods_updated_at BEFORE UPDATE ON public.stripe_payment_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stripe_subscriptions update_stripe_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_stripe_subscriptions_updated_at BEFORE UPDATE ON public.stripe_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: voice_configs validate_ai_agent_config_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER validate_ai_agent_config_trigger BEFORE INSERT OR UPDATE ON public.voice_configs FOR EACH ROW EXECUTE FUNCTION public.validate_ai_agent_config();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: supabase_admin
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: objects objects_delete_delete_prefix; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects objects_insert_create_prefix; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();


--
-- Name: objects objects_update_create_prefix; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();


--
-- Name: prefixes prefixes_create_hierarchy; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();


--
-- Name: prefixes prefixes_delete_hierarchy; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: accounts accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: next_auth; Owner: postgres
--

ALTER TABLE ONLY next_auth.accounts
    ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES next_auth.users(id);


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: next_auth; Owner: postgres
--

ALTER TABLE ONLY next_auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES next_auth.users(id);


--
-- Name: access_grants_archived access_grants_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.access_grants_archived
    ADD CONSTRAINT access_grants_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: access_grants_archived access_grants_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.access_grants_archived
    ADD CONSTRAINT access_grants_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles_archived(id);


--
-- Name: access_grants_archived access_grants_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.access_grants_archived
    ADD CONSTRAINT access_grants_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id);


--
-- Name: ai_agent_audit_log ai_agent_audit_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_agent_audit_log
    ADD CONSTRAINT ai_agent_audit_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ai_runs ai_runs_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_runs
    ADD CONSTRAINT ai_runs_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: ai_runs ai_runs_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_runs
    ADD CONSTRAINT ai_runs_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id);


--
-- Name: alerts alerts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: alerts alerts_test_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_test_config_id_fkey FOREIGN KEY (test_config_id) REFERENCES public.test_configs(id);


--
-- Name: artifact_provenance artifact_provenance_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.artifact_provenance
    ADD CONSTRAINT artifact_provenance_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: artifact_provenance artifact_provenance_produced_by_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.artifact_provenance
    ADD CONSTRAINT artifact_provenance_produced_by_system_id_fkey FOREIGN KEY (produced_by_system_id) REFERENCES public.systems(id);


--
-- Name: attention_decisions attention_decisions_event_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attention_decisions
    ADD CONSTRAINT attention_decisions_event_fkey FOREIGN KEY (attention_event_id) REFERENCES public.attention_events(id);


--
-- Name: attention_decisions attention_decisions_org_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attention_decisions
    ADD CONSTRAINT attention_decisions_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: attention_decisions attention_decisions_policy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attention_decisions
    ADD CONSTRAINT attention_decisions_policy_fkey FOREIGN KEY (policy_id) REFERENCES public.attention_policies(id);


--
-- Name: attention_events attention_events_org_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attention_events
    ADD CONSTRAINT attention_events_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: attention_policies attention_policies_org_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attention_policies
    ADD CONSTRAINT attention_policies_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: audit_logs audit_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: audit_logs audit_logs_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id);


--
-- Name: booking_events booking_events_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_events
    ADD CONSTRAINT booking_events_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: booking_events booking_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_events
    ADD CONSTRAINT booking_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: call_confirmation_checklists call_confirmation_checklists_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_confirmation_checklists
    ADD CONSTRAINT call_confirmation_checklists_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id) ON DELETE CASCADE;


--
-- Name: call_confirmation_checklists call_confirmation_checklists_confirmation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_confirmation_checklists
    ADD CONSTRAINT call_confirmation_checklists_confirmation_id_fkey FOREIGN KEY (confirmation_id) REFERENCES public.call_confirmations(id) ON DELETE SET NULL;


--
-- Name: call_confirmation_checklists call_confirmation_checklists_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_confirmation_checklists
    ADD CONSTRAINT call_confirmation_checklists_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: call_confirmation_checklists call_confirmation_checklists_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_confirmation_checklists
    ADD CONSTRAINT call_confirmation_checklists_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.confirmation_templates(id) ON DELETE CASCADE;


--
-- Name: call_confirmations call_confirmations_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_confirmations
    ADD CONSTRAINT call_confirmations_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id) ON DELETE CASCADE;


--
-- Name: call_confirmations call_confirmations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_confirmations
    ADD CONSTRAINT call_confirmations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: call_export_bundles call_export_bundles_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_export_bundles
    ADD CONSTRAINT call_export_bundles_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: call_export_bundles call_export_bundles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_export_bundles
    ADD CONSTRAINT call_export_bundles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: caller_id_default_rules caller_id_default_rules_caller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caller_id_default_rules
    ADD CONSTRAINT caller_id_default_rules_caller_id_fkey FOREIGN KEY (caller_id_number_id) REFERENCES public.caller_id_numbers(id);


--
-- Name: caller_id_default_rules caller_id_default_rules_org_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caller_id_default_rules
    ADD CONSTRAINT caller_id_default_rules_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: caller_id_numbers caller_id_numbers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caller_id_numbers
    ADD CONSTRAINT caller_id_numbers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: caller_id_permissions caller_id_permissions_caller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caller_id_permissions
    ADD CONSTRAINT caller_id_permissions_caller_id_fkey FOREIGN KEY (caller_id_number_id) REFERENCES public.caller_id_numbers(id);


--
-- Name: caller_id_permissions caller_id_permissions_org_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caller_id_permissions
    ADD CONSTRAINT caller_id_permissions_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: calls calls_caller_id_number_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_caller_id_number_id_fkey FOREIGN KEY (caller_id_number_id) REFERENCES public.caller_id_numbers(id);


--
-- Name: calls calls_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: calls calls_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id);


--
-- Name: campaign_audit_log campaign_audit_log_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_audit_log
    ADD CONSTRAINT campaign_audit_log_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_calls campaign_calls_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_calls
    ADD CONSTRAINT campaign_calls_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id) ON DELETE SET NULL;


--
-- Name: campaign_calls campaign_calls_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_calls
    ADD CONSTRAINT campaign_calls_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaigns campaigns_caller_id_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_caller_id_id_fkey FOREIGN KEY (caller_id_id) REFERENCES public.caller_id_numbers(id) ON DELETE SET NULL;


--
-- Name: campaigns campaigns_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: campaigns campaigns_script_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_script_id_fkey FOREIGN KEY (script_id) REFERENCES public.shopper_scripts(id) ON DELETE SET NULL;


--
-- Name: campaigns campaigns_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE SET NULL;


--
-- Name: capabilities_archived capabilities_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capabilities_archived
    ADD CONSTRAINT capabilities_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id);


--
-- Name: compliance_restrictions compliance_restrictions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_restrictions
    ADD CONSTRAINT compliance_restrictions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: compliance_violations compliance_violations_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_violations
    ADD CONSTRAINT compliance_violations_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id) ON DELETE SET NULL;


--
-- Name: compliance_violations compliance_violations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_violations
    ADD CONSTRAINT compliance_violations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: confirmation_templates confirmation_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.confirmation_templates
    ADD CONSTRAINT confirmation_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: crm_object_links crm_object_links_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_object_links
    ADD CONSTRAINT crm_object_links_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: crm_object_links crm_object_links_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_object_links
    ADD CONSTRAINT crm_object_links_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id);


--
-- Name: crm_object_links crm_object_links_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_object_links
    ADD CONSTRAINT crm_object_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: crm_sync_log crm_sync_log_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_sync_log
    ADD CONSTRAINT crm_sync_log_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: crm_sync_log crm_sync_log_export_bundle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_sync_log
    ADD CONSTRAINT crm_sync_log_export_bundle_id_fkey FOREIGN KEY (export_bundle_id) REFERENCES public.call_export_bundles(id);


--
-- Name: crm_sync_log crm_sync_log_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_sync_log
    ADD CONSTRAINT crm_sync_log_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id);


--
-- Name: crm_sync_log crm_sync_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_sync_log
    ADD CONSTRAINT crm_sync_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: digest_items digest_items_decision_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.digest_items
    ADD CONSTRAINT digest_items_decision_fkey FOREIGN KEY (attention_decision_id) REFERENCES public.attention_decisions(id);


--
-- Name: digest_items digest_items_digest_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.digest_items
    ADD CONSTRAINT digest_items_digest_fkey FOREIGN KEY (digest_id) REFERENCES public.digests(id);


--
-- Name: digests digests_org_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.digests
    ADD CONSTRAINT digests_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: disclosure_logs disclosure_logs_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disclosure_logs
    ADD CONSTRAINT disclosure_logs_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id) ON DELETE SET NULL;


--
-- Name: disclosure_logs disclosure_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disclosure_logs
    ADD CONSTRAINT disclosure_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: evidence_bundles evidence_bundles_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_bundles
    ADD CONSTRAINT evidence_bundles_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: evidence_bundles evidence_bundles_manifest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_bundles
    ADD CONSTRAINT evidence_bundles_manifest_id_fkey FOREIGN KEY (manifest_id) REFERENCES public.evidence_manifests(id);


--
-- Name: evidence_bundles evidence_bundles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_bundles
    ADD CONSTRAINT evidence_bundles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: evidence_bundles evidence_bundles_parent_bundle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_bundles
    ADD CONSTRAINT evidence_bundles_parent_bundle_id_fkey FOREIGN KEY (parent_bundle_id) REFERENCES public.evidence_bundles(id);


--
-- Name: evidence_bundles evidence_bundles_recording_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_bundles
    ADD CONSTRAINT evidence_bundles_recording_id_fkey FOREIGN KEY (recording_id) REFERENCES public.recordings(id);


--
-- Name: evidence_bundles evidence_bundles_superseded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_bundles
    ADD CONSTRAINT evidence_bundles_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.evidence_bundles(id);


--
-- Name: evidence_manifests evidence_manifests_parent_manifest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_manifests
    ADD CONSTRAINT evidence_manifests_parent_manifest_id_fkey FOREIGN KEY (parent_manifest_id) REFERENCES public.evidence_manifests(id);


--
-- Name: evidence_manifests evidence_manifests_recording_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_manifests
    ADD CONSTRAINT evidence_manifests_recording_id_fkey FOREIGN KEY (recording_id) REFERENCES public.recordings(id) ON DELETE CASCADE;


--
-- Name: evidence_manifests evidence_manifests_superseded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidence_manifests
    ADD CONSTRAINT evidence_manifests_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.evidence_manifests(id);


--
-- Name: export_compliance_log export_compliance_log_bundle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.export_compliance_log
    ADD CONSTRAINT export_compliance_log_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.evidence_bundles(id);


--
-- Name: export_compliance_log export_compliance_log_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.export_compliance_log
    ADD CONSTRAINT export_compliance_log_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: export_compliance_log export_compliance_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.export_compliance_log
    ADD CONSTRAINT export_compliance_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: external_entities external_entities_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_entities
    ADD CONSTRAINT external_entities_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: external_entity_identifiers external_entity_identifiers_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_entity_identifiers
    ADD CONSTRAINT external_entity_identifiers_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.external_entities(id);


--
-- Name: external_entity_identifiers external_entity_identifiers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_entity_identifiers
    ADD CONSTRAINT external_entity_identifiers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: external_entity_links external_entity_links_identifier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_entity_links
    ADD CONSTRAINT external_entity_links_identifier_id_fkey FOREIGN KEY (identifier_id) REFERENCES public.external_entity_identifiers(id);


--
-- Name: external_entity_links external_entity_links_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_entity_links
    ADD CONSTRAINT external_entity_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: external_entity_links external_entity_links_source_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_entity_links
    ADD CONSTRAINT external_entity_links_source_entity_id_fkey FOREIGN KEY (source_entity_id) REFERENCES public.external_entities(id);


--
-- Name: external_entity_links external_entity_links_target_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_entity_links
    ADD CONSTRAINT external_entity_links_target_entity_id_fkey FOREIGN KEY (target_entity_id) REFERENCES public.external_entities(id);


--
-- Name: external_entity_observations external_entity_observations_identifier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_entity_observations
    ADD CONSTRAINT external_entity_observations_identifier_id_fkey FOREIGN KEY (identifier_id) REFERENCES public.external_entity_identifiers(id);


--
-- Name: external_entity_observations external_entity_observations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_entity_observations
    ADD CONSTRAINT external_entity_observations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: users fk_public_users_next_auth_users; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_public_users_next_auth_users FOREIGN KEY (id) REFERENCES next_auth.users(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: generated_reports generated_reports_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.generated_reports
    ADD CONSTRAINT generated_reports_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: generated_reports generated_reports_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.generated_reports
    ADD CONSTRAINT generated_reports_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.report_templates(id) ON DELETE CASCADE;


--
-- Name: incidents incidents_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: incidents incidents_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: integrations integrations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: invoices invoices_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: kpi_logs kpi_logs_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kpi_logs
    ADD CONSTRAINT kpi_logs_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.test_configs(id) ON DELETE SET NULL;


--
-- Name: kpi_settings kpi_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kpi_settings
    ADD CONSTRAINT kpi_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: legal_holds legal_holds_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.legal_holds
    ADD CONSTRAINT legal_holds_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: media_sessions media_sessions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_sessions
    ADD CONSTRAINT media_sessions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: media_sessions media_sessions_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_sessions
    ADD CONSTRAINT media_sessions_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id);


--
-- Name: monitored_numbers monitored_numbers_greeting_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monitored_numbers
    ADD CONSTRAINT monitored_numbers_greeting_message_id_fkey FOREIGN KEY (greeting_message_id) REFERENCES public.stock_messages(id);


--
-- Name: monitored_numbers monitored_numbers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monitored_numbers
    ADD CONSTRAINT monitored_numbers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: number_kpi_logs number_kpi_logs_monitored_number_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.number_kpi_logs
    ADD CONSTRAINT number_kpi_logs_monitored_number_id_fkey FOREIGN KEY (monitored_number_id) REFERENCES public.monitored_numbers(id) ON DELETE CASCADE;


--
-- Name: number_kpi_logs number_kpi_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.number_kpi_logs
    ADD CONSTRAINT number_kpi_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: number_kpi_snapshot number_kpi_snapshot_monitored_number_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.number_kpi_snapshot
    ADD CONSTRAINT number_kpi_snapshot_monitored_number_id_fkey FOREIGN KEY (monitored_number_id) REFERENCES public.monitored_numbers(id) ON DELETE CASCADE;


--
-- Name: number_kpi_snapshot number_kpi_snapshot_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.number_kpi_snapshot
    ADD CONSTRAINT number_kpi_snapshot_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: oauth_tokens oauth_tokens_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oauth_tokens
    ADD CONSTRAINT oauth_tokens_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id) ON DELETE CASCADE;


--
-- Name: org_members org_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_members
    ADD CONSTRAINT org_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_sso_configs org_sso_configs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_sso_configs
    ADD CONSTRAINT org_sso_configs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organizations organizations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: qa_evaluation_disclosures qa_evaluation_disclosures_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qa_evaluation_disclosures
    ADD CONSTRAINT qa_evaluation_disclosures_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id) ON DELETE CASCADE;


--
-- Name: qa_evaluation_disclosures qa_evaluation_disclosures_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qa_evaluation_disclosures
    ADD CONSTRAINT qa_evaluation_disclosures_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: recordings recordings_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recordings
    ADD CONSTRAINT recordings_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: recordings recordings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recordings
    ADD CONSTRAINT recordings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: recordings recordings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recordings
    ADD CONSTRAINT recordings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: recordings recordings_tool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recordings
    ADD CONSTRAINT recordings_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tools(id);


--
-- Name: report_access_log report_access_log_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report_access_log
    ADD CONSTRAINT report_access_log_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.generated_reports(id) ON DELETE CASCADE;


--
-- Name: report_schedules report_schedules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report_schedules
    ADD CONSTRAINT report_schedules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: report_schedules report_schedules_test_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report_schedules
    ADD CONSTRAINT report_schedules_test_config_id_fkey FOREIGN KEY (test_config_id) REFERENCES public.test_configs(id) ON DELETE SET NULL;


--
-- Name: report_templates report_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report_templates
    ADD CONSTRAINT report_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: retention_policies retention_policies_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.retention_policies
    ADD CONSTRAINT retention_policies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: role_capabilities_archived role_capabilities_capability_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_capabilities_archived
    ADD CONSTRAINT role_capabilities_capability_id_fkey FOREIGN KEY (capability_id) REFERENCES public.capabilities_archived(id);


--
-- Name: role_capabilities_archived role_capabilities_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_capabilities_archived
    ADD CONSTRAINT role_capabilities_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles_archived(id);


--
-- Name: roles_archived roles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles_archived
    ADD CONSTRAINT roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: scheduled_reports scheduled_reports_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_reports
    ADD CONSTRAINT scheduled_reports_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: scheduled_reports scheduled_reports_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_reports
    ADD CONSTRAINT scheduled_reports_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.report_templates(id) ON DELETE CASCADE;


--
-- Name: scorecards scorecards_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scorecards
    ADD CONSTRAINT scorecards_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: scorecards scorecards_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scorecards
    ADD CONSTRAINT scorecards_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: scorecards scorecards_tool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scorecards
    ADD CONSTRAINT scorecards_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tools(id);


--
-- Name: scored_recordings scored_recordings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scored_recordings
    ADD CONSTRAINT scored_recordings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: scored_recordings scored_recordings_recording_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scored_recordings
    ADD CONSTRAINT scored_recordings_recording_id_fkey FOREIGN KEY (recording_id) REFERENCES public.recordings(id) ON DELETE CASCADE;


--
-- Name: scored_recordings scored_recordings_scorecard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scored_recordings
    ADD CONSTRAINT scored_recordings_scorecard_id_fkey FOREIGN KEY (scorecard_id) REFERENCES public.scorecards(id) ON DELETE CASCADE;


--
-- Name: search_documents search_documents_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.search_documents
    ADD CONSTRAINT search_documents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: search_documents search_documents_superseded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.search_documents
    ADD CONSTRAINT search_documents_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.search_documents(id);


--
-- Name: search_events search_events_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.search_events
    ADD CONSTRAINT search_events_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.search_documents(id);


--
-- Name: search_events search_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.search_events
    ADD CONSTRAINT search_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: shopper_results shopper_results_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shopper_results
    ADD CONSTRAINT shopper_results_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: shopper_results shopper_results_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shopper_results
    ADD CONSTRAINT shopper_results_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: shopper_results shopper_results_recording_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shopper_results
    ADD CONSTRAINT shopper_results_recording_id_fkey FOREIGN KEY (recording_id) REFERENCES public.recordings(id);


--
-- Name: shopper_results shopper_results_script_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shopper_results
    ADD CONSTRAINT shopper_results_script_id_fkey FOREIGN KEY (script_id) REFERENCES public.shopper_scripts(id);


--
-- Name: shopper_scripts shopper_scripts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shopper_scripts
    ADD CONSTRAINT shopper_scripts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: sso_login_events sso_login_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sso_login_events
    ADD CONSTRAINT sso_login_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: sso_login_events sso_login_events_sso_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sso_login_events
    ADD CONSTRAINT sso_login_events_sso_config_id_fkey FOREIGN KEY (sso_config_id) REFERENCES public.org_sso_configs(id) ON DELETE CASCADE;


--
-- Name: stripe_events stripe_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stripe_events
    ADD CONSTRAINT stripe_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: stripe_invoices stripe_invoices_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stripe_invoices
    ADD CONSTRAINT stripe_invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: stripe_payment_methods stripe_payment_methods_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stripe_payment_methods
    ADD CONSTRAINT stripe_payment_methods_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: stripe_subscriptions stripe_subscriptions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stripe_subscriptions
    ADD CONSTRAINT stripe_subscriptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: surveys surveys_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_invites team_invites_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_invites
    ADD CONSTRAINT team_invites_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: test_configs test_configs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_configs
    ADD CONSTRAINT test_configs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: test_configs test_configs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_configs
    ADD CONSTRAINT test_configs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: test_configs test_configs_tool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_configs
    ADD CONSTRAINT test_configs_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tools(id);


--
-- Name: test_frequency_config test_frequency_config_monitored_number_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_frequency_config
    ADD CONSTRAINT test_frequency_config_monitored_number_id_fkey FOREIGN KEY (monitored_number_id) REFERENCES public.monitored_numbers(id) ON DELETE CASCADE;


--
-- Name: test_results test_results_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_results
    ADD CONSTRAINT test_results_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: test_results test_results_test_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_results
    ADD CONSTRAINT test_results_test_config_id_fkey FOREIGN KEY (test_config_id) REFERENCES public.test_configs(id);


--
-- Name: test_results test_results_tool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_results
    ADD CONSTRAINT test_results_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tools(id);


--
-- Name: test_statistics test_statistics_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_statistics
    ADD CONSTRAINT test_statistics_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id);


--
-- Name: test_statistics test_statistics_test_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_statistics
    ADD CONSTRAINT test_statistics_test_config_id_fkey FOREIGN KEY (test_config_id) REFERENCES public.test_configs(id) ON DELETE CASCADE;


--
-- Name: tool_access_archived tool_access_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool_access_archived
    ADD CONSTRAINT tool_access_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: tool_access_archived tool_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool_access_archived
    ADD CONSTRAINT tool_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tool_settings tool_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool_settings
    ADD CONSTRAINT tool_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: tool_team_members tool_team_members_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool_team_members
    ADD CONSTRAINT tool_team_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: tool_team_members tool_team_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool_team_members
    ADD CONSTRAINT tool_team_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: tool_team_members tool_team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool_team_members
    ADD CONSTRAINT tool_team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: transcript_versions transcript_versions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transcript_versions
    ADD CONSTRAINT transcript_versions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: transcript_versions transcript_versions_recording_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transcript_versions
    ADD CONSTRAINT transcript_versions_recording_id_fkey FOREIGN KEY (recording_id) REFERENCES public.recordings(id);


--
-- Name: usage_limits usage_limits_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usage_limits
    ADD CONSTRAINT usage_limits_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: usage_records usage_records_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usage_records
    ADD CONSTRAINT usage_records_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: voice_configs voice_configs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.voice_configs
    ADD CONSTRAINT voice_configs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: voice_configs voice_configs_script_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.voice_configs
    ADD CONSTRAINT voice_configs_script_id_fkey FOREIGN KEY (script_id) REFERENCES public.shopper_scripts(id);


--
-- Name: voice_targets voice_targets_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.voice_targets
    ADD CONSTRAINT voice_targets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: webhook_configs webhook_configs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_configs
    ADD CONSTRAINT webhook_configs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: webhook_failures webhook_failures_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_failures
    ADD CONSTRAINT webhook_failures_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: webrtc_sessions webrtc_sessions_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webrtc_sessions
    ADD CONSTRAINT webrtc_sessions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: prefixes prefixes_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT "prefixes_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: team_invites Admins can create invites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can create invites" ON public.team_invites FOR INSERT WITH CHECK ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: confirmation_templates Admins can manage org templates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage org templates" ON public.confirmation_templates USING ((organization_id IN ( SELECT om.organization_id
   FROM public.org_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: compliance_violations Admins can manage violations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage violations" ON public.compliance_violations FOR UPDATE USING ((organization_id IN ( SELECT om.organization_id
   FROM public.org_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: team_invites Admins can update invites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update invites" ON public.team_invites FOR UPDATE USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: accounts Allow all operations on accounts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow all operations on accounts" ON public.accounts USING (true);


--
-- Name: sessions Allow all operations on sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow all operations on sessions" ON public.sessions USING (true);


--
-- Name: users Allow all operations on users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow all operations on users" ON public.users USING (true);


--
-- Name: verification_tokens Allow all operations on verification_tokens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow all operations on verification_tokens" ON public.verification_tokens USING (true);


--
-- Name: stock_messages Allow all to read stock messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow all to read stock messages" ON public.stock_messages FOR SELECT USING (true);


--
-- Name: test_configs Allow public select on test_configs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public select on test_configs" ON public.test_configs FOR SELECT USING (true);


--
-- Name: test_results Allow public select on test_results; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public select on test_results" ON public.test_results FOR SELECT USING (true);


--
-- Name: tool_access_archived Org admins can manage tool access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Org admins can manage tool access" ON public.tool_access_archived FOR INSERT WITH CHECK ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = 'admin'::text)))));


--
-- Name: tool_access_archived Org admins can update tool access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Org admins can update tool access" ON public.tool_access_archived FOR UPDATE USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = 'admin'::text)))));


--
-- Name: org_sso_configs Org admins can view SSO configs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Org admins can view SSO configs" ON public.org_sso_configs FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: sso_login_events Org admins can view SSO events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Org admins can view SSO events" ON public.sso_login_events FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: org_sso_configs Org owners can create SSO configs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Org owners can create SSO configs" ON public.org_sso_configs FOR INSERT WITH CHECK ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = 'owner'::text)))));


--
-- Name: org_sso_configs Org owners can delete SSO configs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Org owners can delete SSO configs" ON public.org_sso_configs FOR DELETE USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = 'owner'::text)))));


--
-- Name: org_sso_configs Org owners can update SSO configs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Org owners can update SSO configs" ON public.org_sso_configs FOR UPDATE USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = 'owner'::text)))));


--
-- Name: surveys Owners and admins can delete surveys; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners and admins can delete surveys" ON public.surveys FOR DELETE USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: voice_targets Owners and admins can delete voice targets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners and admins can delete voice targets" ON public.voice_targets FOR DELETE USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: surveys Owners and admins can insert surveys; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners and admins can insert surveys" ON public.surveys FOR INSERT WITH CHECK ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: voice_targets Owners and admins can insert voice targets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners and admins can insert voice targets" ON public.voice_targets FOR INSERT WITH CHECK ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: surveys Owners and admins can update surveys; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners and admins can update surveys" ON public.surveys FOR UPDATE USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: voice_targets Owners and admins can update voice targets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners and admins can update voice targets" ON public.voice_targets FOR UPDATE USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: carrier_status Public read access to carrier status; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access to carrier status" ON public.carrier_status FOR SELECT USING (true);


--
-- Name: network_incidents Public read access to incidents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access to incidents" ON public.network_incidents FOR SELECT USING ((is_active = true));


--
-- Name: network_incidents Service role can insert incidents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can insert incidents" ON public.network_incidents FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: ai_agent_audit_log Service role can manage AI audit logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can manage AI audit logs" ON public.ai_agent_audit_log USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: qa_evaluation_disclosures Service role can manage QA disclosures; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can manage QA disclosures" ON public.qa_evaluation_disclosures USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: call_confirmation_checklists Service role can manage checklists; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can manage checklists" ON public.call_confirmation_checklists USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: call_confirmations Service role can manage confirmations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can manage confirmations" ON public.call_confirmations USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: disclosure_logs Service role can manage disclosure logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can manage disclosure logs" ON public.disclosure_logs USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: stripe_events Service role can manage events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can manage events" ON public.stripe_events USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: stripe_invoices Service role can manage invoices; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can manage invoices" ON public.stripe_invoices USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: stripe_payment_methods Service role can manage payment methods; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can manage payment methods" ON public.stripe_payment_methods USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: compliance_restrictions Service role can manage restrictions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can manage restrictions" ON public.compliance_restrictions USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: stripe_subscriptions Service role can manage subscriptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can manage subscriptions" ON public.stripe_subscriptions USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: confirmation_templates Service role can manage templates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can manage templates" ON public.confirmation_templates USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: compliance_violations Service role can manage violations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can manage violations" ON public.compliance_violations USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: carrier_status Service role can update carrier status; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can update carrier status" ON public.carrier_status FOR UPDATE USING ((auth.role() = 'service_role'::text));


--
-- Name: tool_team_members Tool admins can manage team members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tool admins can manage team members" ON public.tool_team_members FOR INSERT WITH CHECK ((organization_id IN ( SELECT tool_team_members_1.organization_id
   FROM public.tool_team_members tool_team_members_1
  WHERE ((tool_team_members_1.user_id = auth.uid()) AND (tool_team_members_1.role = 'admin'::public.tool_role_type)))));


--
-- Name: tool_settings Tool admins can update settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tool admins can update settings" ON public.tool_settings FOR UPDATE USING ((organization_id IN ( SELECT tool_team_members.organization_id
   FROM public.tool_team_members
  WHERE ((tool_team_members.user_id = auth.uid()) AND (tool_team_members.role = 'admin'::public.tool_role_type)))));


--
-- Name: call_confirmations Users can create confirmations for own org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create confirmations for own org" ON public.call_confirmations FOR INSERT WITH CHECK ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: scorecards Users can create scorecards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create scorecards" ON public.scorecards FOR INSERT WITH CHECK ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: recordings Users can insert own recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own recordings" ON public.recordings FOR INSERT WITH CHECK ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: scored_recordings Users can insert scored recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert scored recordings" ON public.scored_recordings FOR INSERT WITH CHECK ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: call_confirmation_checklists Users can update own org checklists; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own org checklists" ON public.call_confirmation_checklists FOR UPDATE USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: recordings Users can update own recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own recordings" ON public.recordings FOR UPDATE USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: scorecards Users can update own scorecards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own scorecards" ON public.scorecards FOR UPDATE USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: scored_recordings Users can update own scored recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own scored recordings" ON public.scored_recordings FOR UPDATE USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: compliance_restrictions Users can view compliance restrictions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view compliance restrictions" ON public.compliance_restrictions FOR SELECT USING (true);


--
-- Name: team_invites Users can view org invites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view org invites" ON public.team_invites FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: qa_evaluation_disclosures Users can view own org QA disclosures; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own org QA disclosures" ON public.qa_evaluation_disclosures FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: call_confirmation_checklists Users can view own org checklists; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own org checklists" ON public.call_confirmation_checklists FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: call_confirmations Users can view own org confirmations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own org confirmations" ON public.call_confirmations FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: confirmation_templates Users can view own org templates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own org templates" ON public.confirmation_templates FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: compliance_violations Users can view own org violations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own org violations" ON public.compliance_violations FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: ai_agent_audit_log Users can view own organization AI audit logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own organization AI audit logs" ON public.ai_agent_audit_log FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: disclosure_logs Users can view own organization disclosure logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own organization disclosure logs" ON public.disclosure_logs FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: stripe_events Users can view own organization events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own organization events" ON public.stripe_events FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: stripe_invoices Users can view own organization invoices; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own organization invoices" ON public.stripe_invoices FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: stripe_payment_methods Users can view own organization payment methods; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own organization payment methods" ON public.stripe_payment_methods FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: stripe_subscriptions Users can view own organization subscriptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own organization subscriptions" ON public.stripe_subscriptions FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: recordings Users can view own recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own recordings" ON public.recordings FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: scorecards Users can view own scorecards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own scorecards" ON public.scorecards FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: scored_recordings Users can view own scored recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own scored recordings" ON public.scored_recordings FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: surveys Users can view their org's surveys; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their org's surveys" ON public.surveys FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: voice_targets Users can view their org's voice targets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their org's voice targets" ON public.voice_targets FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: tool_access_archived Users can view tool access for their org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view tool access for their org" ON public.tool_access_archived FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: tool_settings Users can view tool settings for their org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view tool settings for their org" ON public.tool_settings FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: tool_team_members Users can view tool team members in their org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view tool team members in their org" ON public.tool_team_members FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: access_grants_archived; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.access_grants_archived ENABLE ROW LEVEL SECURITY;

--
-- Name: accounts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_agent_audit_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ai_agent_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_runs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_runs ai_runs_insert_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ai_runs_insert_all ON public.ai_runs FOR INSERT WITH CHECK (true);


--
-- Name: ai_runs ai_runs_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ai_runs_select_org ON public.ai_runs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.calls
  WHERE ((calls.id = ai_runs.call_id) AND (calls.organization_id = public.get_user_organization_id())))));


--
-- Name: ai_runs ai_runs_update_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ai_runs_update_all ON public.ai_runs FOR UPDATE USING (true);


--
-- Name: alert_acknowledgements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.alert_acknowledgements ENABLE ROW LEVEL SECURITY;

--
-- Name: alerts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: alerts alerts_tenant_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY alerts_tenant_policy ON public.alerts FOR SELECT USING ((organization_id = (current_setting('jwt.claims.organization_id'::text))::uuid));


--
-- Name: kpi_logs allow_anon_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_anon_select ON public.kpi_logs FOR SELECT USING (true);


--
-- Name: report_schedules allow_org_report_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_org_report_access ON public.report_schedules FOR SELECT USING (true);


--
-- Name: report_schedules allow_org_report_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_org_report_insert ON public.report_schedules FOR INSERT WITH CHECK (true);


--
-- Name: webhook_configs allow_org_webhook_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_org_webhook_access ON public.webhook_configs FOR SELECT USING (true);


--
-- Name: webhook_configs allow_org_webhook_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_org_webhook_insert ON public.webhook_configs FOR INSERT WITH CHECK (true);


--
-- Name: webhook_configs allow_org_webhook_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_org_webhook_update ON public.webhook_configs FOR UPDATE USING (true);


--
-- Name: alert_acknowledgements allow_public_insert_alerts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_public_insert_alerts ON public.alert_acknowledgements FOR INSERT WITH CHECK (true);


--
-- Name: alert_acknowledgements allow_public_select_alerts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_public_select_alerts ON public.alert_acknowledgements FOR SELECT USING (true);


--
-- Name: kpi_logs allow_service_role; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_service_role ON public.kpi_logs USING ((auth.role() = 'service_role'::text));


--
-- Name: artifact_provenance; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.artifact_provenance ENABLE ROW LEVEL SECURITY;

--
-- Name: artifact_provenance artifact_provenance_insert_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY artifact_provenance_insert_all ON public.artifact_provenance FOR INSERT WITH CHECK (true);


--
-- Name: artifact_provenance artifact_provenance_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY artifact_provenance_select_org ON public.artifact_provenance FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: attention_decisions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.attention_decisions ENABLE ROW LEVEL SECURITY;

--
-- Name: attention_decisions attention_decisions_insert_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY attention_decisions_insert_service ON public.attention_decisions FOR INSERT WITH CHECK (true);


--
-- Name: attention_decisions attention_decisions_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY attention_decisions_select_org ON public.attention_decisions FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: attention_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.attention_events ENABLE ROW LEVEL SECURITY;

--
-- Name: attention_events attention_events_insert_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY attention_events_insert_service ON public.attention_events FOR INSERT WITH CHECK (true);


--
-- Name: attention_events attention_events_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY attention_events_select_org ON public.attention_events FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: attention_policies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.attention_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: attention_policies attention_policies_insert_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY attention_policies_insert_admin ON public.attention_policies FOR INSERT WITH CHECK ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: attention_policies attention_policies_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY attention_policies_select_org ON public.attention_policies FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: attention_policies attention_policies_update_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY attention_policies_update_admin ON public.attention_policies FOR UPDATE USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_insert_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY audit_logs_insert_all ON public.audit_logs FOR INSERT WITH CHECK (true);


--
-- Name: audit_logs audit_logs_insert_org_members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY audit_logs_insert_org_members ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.organization_id = audit_logs.organization_id) AND (om.user_id = auth.uid())))) AND (user_id = auth.uid())));


--
-- Name: audit_logs audit_logs_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY audit_logs_select_org ON public.audit_logs FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: call_confirmation_checklists; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.call_confirmation_checklists ENABLE ROW LEVEL SECURITY;

--
-- Name: call_confirmations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.call_confirmations ENABLE ROW LEVEL SECURITY;

--
-- Name: call_export_bundles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.call_export_bundles ENABLE ROW LEVEL SECURITY;

--
-- Name: call_export_bundles call_export_bundles_insert_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY call_export_bundles_insert_org ON public.call_export_bundles FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: call_export_bundles call_export_bundles_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY call_export_bundles_select_org ON public.call_export_bundles FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: caller_id_default_rules; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.caller_id_default_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: caller_id_default_rules caller_id_default_rules_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY caller_id_default_rules_insert ON public.caller_id_default_rules FOR INSERT WITH CHECK ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: caller_id_default_rules caller_id_default_rules_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY caller_id_default_rules_select ON public.caller_id_default_rules FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: caller_id_default_rules caller_id_default_rules_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY caller_id_default_rules_update ON public.caller_id_default_rules FOR UPDATE USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: caller_id_permissions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.caller_id_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: caller_id_permissions caller_id_permissions_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY caller_id_permissions_insert ON public.caller_id_permissions FOR INSERT WITH CHECK ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: caller_id_permissions caller_id_permissions_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY caller_id_permissions_select ON public.caller_id_permissions FOR SELECT USING (((user_id = auth.uid()) OR (organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));


--
-- Name: caller_id_permissions caller_id_permissions_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY caller_id_permissions_update ON public.caller_id_permissions FOR UPDATE USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: calls; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

--
-- Name: calls calls_creator_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY calls_creator_policy ON public.calls FOR UPDATE USING ((created_by = auth.uid()));


--
-- Name: calls calls_insert_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY calls_insert_org ON public.calls FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: calls calls_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY calls_select_org ON public.calls FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: calls calls_tenant_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY calls_tenant_policy ON public.calls FOR SELECT USING ((organization_id = (current_setting('jwt.claims.organization_id'::text))::uuid));


--
-- Name: calls calls_update_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY calls_update_org ON public.calls FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: campaign_audit_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.campaign_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_calls; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.campaign_calls ENABLE ROW LEVEL SECURITY;

--
-- Name: campaigns; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: campaigns campaigns_delete_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY campaigns_delete_org ON public.campaigns FOR DELETE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: campaigns campaigns_insert_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY campaigns_insert_org ON public.campaigns FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: campaigns campaigns_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY campaigns_select_org ON public.campaigns FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: campaigns campaigns_update_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY campaigns_update_org ON public.campaigns FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: capabilities_archived; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.capabilities_archived ENABLE ROW LEVEL SECURITY;

--
-- Name: carrier_status; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.carrier_status ENABLE ROW LEVEL SECURITY;

--
-- Name: calls cas_delete_calls; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cas_delete_calls ON public.calls FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = calls.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_monitor'::public.tool_type) AND (ta.role = 'admin'::public.tool_role_type)))));


--
-- Name: recordings cas_delete_recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cas_delete_recordings ON public.recordings FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = recordings.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_recorder'::public.tool_type) AND (ta.role = 'admin'::public.tool_role_type)))));


--
-- Name: scorecards cas_delete_scorecards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cas_delete_scorecards ON public.scorecards FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = scorecards.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_analysis'::public.tool_type) AND (ta.role = 'admin'::public.tool_role_type)))));


--
-- Name: scored_recordings cas_delete_scored_recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cas_delete_scored_recordings ON public.scored_recordings FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = scored_recordings.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_analysis'::public.tool_type) AND (ta.role = 'admin'::public.tool_role_type)))));


--
-- Name: test_configs cas_delete_test_configs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cas_delete_test_configs ON public.test_configs FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = test_configs.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_monitor'::public.tool_type) AND (ta.role = 'admin'::public.tool_role_type)))));


--
-- Name: calls cas_insert_calls; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cas_insert_calls ON public.calls FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = calls.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_monitor'::public.tool_type) AND (ta.role = ANY (ARRAY['admin'::public.tool_role_type, 'editor'::public.tool_role_type]))))));


--
-- Name: recordings cas_insert_recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cas_insert_recordings ON public.recordings FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = recordings.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_recorder'::public.tool_type) AND (ta.role = ANY (ARRAY['admin'::public.tool_role_type, 'editor'::public.tool_role_type]))))));


--
-- Name: scorecards cas_insert_scorecards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cas_insert_scorecards ON public.scorecards FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = scorecards.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_analysis'::public.tool_type) AND (ta.role = ANY (ARRAY['admin'::public.tool_role_type, 'editor'::public.tool_role_type]))))));


--
-- Name: scored_recordings cas_insert_scored_recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cas_insert_scored_recordings ON public.scored_recordings FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = scored_recordings.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_analysis'::public.tool_type) AND (ta.role = ANY (ARRAY['admin'::public.tool_role_type, 'editor'::public.tool_role_type]))))));


--
-- Name: test_configs cas_insert_test_configs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cas_insert_test_configs ON public.test_configs FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = test_configs.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_monitor'::public.tool_type) AND (ta.role = ANY (ARRAY['admin'::public.tool_role_type, 'editor'::public.tool_role_type]))))));


--
-- Name: calls cas_select_calls; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cas_select_calls ON public.calls FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = calls.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_monitor'::public.tool_type)))));


--
-- Name: recordings cas_select_recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cas_select_recordings ON public.recordings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = recordings.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_recorder'::public.tool_type)))));


--
-- Name: scorecards cas_select_scorecards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cas_select_scorecards ON public.scorecards FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = scorecards.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_analysis'::public.tool_type)))));


--
-- Name: scored_recordings cas_select_scored_recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cas_select_scored_recordings ON public.scored_recordings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = scored_recordings.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_analysis'::public.tool_type)))));


--
-- Name: test_configs cas_select_test_configs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cas_select_test_configs ON public.test_configs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = test_configs.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_monitor'::public.tool_type)))));


--
-- Name: calls cas_update_calls; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cas_update_calls ON public.calls FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = calls.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_monitor'::public.tool_type))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = calls.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_monitor'::public.tool_type) AND (ta.role = ANY (ARRAY['admin'::public.tool_role_type, 'editor'::public.tool_role_type]))))));


--
-- Name: recordings cas_update_recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cas_update_recordings ON public.recordings FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = recordings.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_recorder'::public.tool_type))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = recordings.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_recorder'::public.tool_type) AND (ta.role = ANY (ARRAY['admin'::public.tool_role_type, 'editor'::public.tool_role_type]))))));


--
-- Name: scorecards cas_update_scorecards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cas_update_scorecards ON public.scorecards FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = scorecards.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_analysis'::public.tool_type))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = scorecards.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_analysis'::public.tool_type) AND (ta.role = ANY (ARRAY['admin'::public.tool_role_type, 'editor'::public.tool_role_type]))))));


--
-- Name: scored_recordings cas_update_scored_recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cas_update_scored_recordings ON public.scored_recordings FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = scored_recordings.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_analysis'::public.tool_type))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = scored_recordings.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_analysis'::public.tool_type) AND (ta.role = ANY (ARRAY['admin'::public.tool_role_type, 'editor'::public.tool_role_type]))))));


--
-- Name: test_configs cas_update_test_configs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cas_update_test_configs ON public.test_configs FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = test_configs.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_monitor'::public.tool_type))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.organization_id = test_configs.organization_id) AND (ta.user_id = auth.uid()) AND (ta.tool = 'call_monitor'::public.tool_type) AND (ta.role = ANY (ARRAY['admin'::public.tool_role_type, 'editor'::public.tool_role_type]))))));


--
-- Name: compliance_restrictions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.compliance_restrictions ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_violations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.compliance_violations ENABLE ROW LEVEL SECURITY;

--
-- Name: confirmation_templates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.confirmation_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_object_links; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.crm_object_links ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_object_links crm_object_links_insert_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY crm_object_links_insert_service ON public.crm_object_links FOR INSERT WITH CHECK (true);


--
-- Name: crm_object_links crm_object_links_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY crm_object_links_select_org ON public.crm_object_links FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: crm_sync_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.crm_sync_log ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_sync_log crm_sync_log_insert_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY crm_sync_log_insert_service ON public.crm_sync_log FOR INSERT WITH CHECK (true);


--
-- Name: crm_sync_log crm_sync_log_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY crm_sync_log_select_org ON public.crm_sync_log FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: access_grants_archived deny_all_access_grants; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY deny_all_access_grants ON public.access_grants_archived USING (false) WITH CHECK (false);


--
-- Name: capabilities_archived deny_all_capabilities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY deny_all_capabilities ON public.capabilities_archived USING (false) WITH CHECK (false);


--
-- Name: role_capabilities_archived deny_all_role_capabilities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY deny_all_role_capabilities ON public.role_capabilities_archived USING (false) WITH CHECK (false);


--
-- Name: roles_archived deny_all_roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY deny_all_roles ON public.roles_archived USING (false) WITH CHECK (false);


--
-- Name: tool_access_archived deny_all_tool_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY deny_all_tool_access ON public.tool_access_archived USING (false) WITH CHECK (false);


--
-- Name: digest_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.digest_items ENABLE ROW LEVEL SECURITY;

--
-- Name: digest_items digest_items_insert_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY digest_items_insert_service ON public.digest_items FOR INSERT WITH CHECK (true);


--
-- Name: digest_items digest_items_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY digest_items_select_org ON public.digest_items FOR SELECT USING ((digest_id IN ( SELECT d.id
   FROM public.digests d
  WHERE (d.organization_id IN ( SELECT org_members.organization_id
           FROM public.org_members
          WHERE (org_members.user_id = auth.uid()))))));


--
-- Name: digests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.digests ENABLE ROW LEVEL SECURITY;

--
-- Name: digests digests_insert_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY digests_insert_service ON public.digests FOR INSERT WITH CHECK (true);


--
-- Name: digests digests_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY digests_select_org ON public.digests FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: disclosure_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.disclosure_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: evidence_bundles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.evidence_bundles ENABLE ROW LEVEL SECURITY;

--
-- Name: evidence_bundles evidence_bundles_insert_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY evidence_bundles_insert_org ON public.evidence_bundles FOR INSERT WITH CHECK (((organization_id IN ( SELECT om.organization_id
   FROM public.org_members om
  WHERE (om.user_id = auth.uid()))) OR (auth.uid() IS NULL)));


--
-- Name: POLICY evidence_bundles_insert_org ON evidence_bundles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY evidence_bundles_insert_org ON public.evidence_bundles IS 'Requires org membership for user-context inserts. Service role bypasses RLS.';


--
-- Name: evidence_bundles evidence_bundles_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY evidence_bundles_select_org ON public.evidence_bundles FOR SELECT USING (((organization_id = public.get_user_organization_id()) OR public.is_admin()));


--
-- Name: evidence_bundles evidence_bundles_update_tsa; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY evidence_bundles_update_tsa ON public.evidence_bundles FOR UPDATE USING (((organization_id IN ( SELECT om.organization_id
   FROM public.org_members om
  WHERE (om.user_id = auth.uid()))) OR (auth.uid() IS NULL))) WITH CHECK (((organization_id IN ( SELECT om.organization_id
   FROM public.org_members om
  WHERE (om.user_id = auth.uid()))) OR (auth.uid() IS NULL)));


--
-- Name: POLICY evidence_bundles_update_tsa ON evidence_bundles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY evidence_bundles_update_tsa ON public.evidence_bundles IS 'Allows TSA field updates (trigger enforces immutability of content fields).';


--
-- Name: evidence_manifests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.evidence_manifests ENABLE ROW LEVEL SECURITY;

--
-- Name: evidence_manifests evidence_manifests_insert_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY evidence_manifests_insert_all ON public.evidence_manifests FOR INSERT WITH CHECK (true);


--
-- Name: evidence_manifests evidence_manifests_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY evidence_manifests_select_org ON public.evidence_manifests FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: export_compliance_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.export_compliance_log ENABLE ROW LEVEL SECURITY;

--
-- Name: export_compliance_log export_compliance_log_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY export_compliance_log_select_org ON public.export_compliance_log FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: external_entities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.external_entities ENABLE ROW LEVEL SECURITY;

--
-- Name: external_entities external_entities_insert_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY external_entities_insert_admin ON public.external_entities FOR INSERT WITH CHECK ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: external_entities external_entities_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY external_entities_select_org ON public.external_entities FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: external_entities external_entities_update_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY external_entities_update_admin ON public.external_entities FOR UPDATE USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: external_entity_identifiers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.external_entity_identifiers ENABLE ROW LEVEL SECURITY;

--
-- Name: external_entity_identifiers external_entity_identifiers_insert_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY external_entity_identifiers_insert_service ON public.external_entity_identifiers FOR INSERT WITH CHECK (true);


--
-- Name: external_entity_identifiers external_entity_identifiers_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY external_entity_identifiers_select_org ON public.external_entity_identifiers FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: external_entity_identifiers external_entity_identifiers_update_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY external_entity_identifiers_update_admin ON public.external_entity_identifiers FOR UPDATE USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: external_entity_links; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.external_entity_links ENABLE ROW LEVEL SECURITY;

--
-- Name: external_entity_links external_entity_links_insert_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY external_entity_links_insert_admin ON public.external_entity_links FOR INSERT WITH CHECK ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: external_entity_links external_entity_links_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY external_entity_links_select_org ON public.external_entity_links FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: external_entity_observations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.external_entity_observations ENABLE ROW LEVEL SECURITY;

--
-- Name: external_entity_observations external_entity_observations_insert_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY external_entity_observations_insert_service ON public.external_entity_observations FOR INSERT WITH CHECK (true);


--
-- Name: external_entity_observations external_entity_observations_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY external_entity_observations_select_org ON public.external_entity_observations FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: generated_reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: incidents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

--
-- Name: incidents incidents_insert_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY incidents_insert_all ON public.incidents FOR INSERT WITH CHECK (true);


--
-- Name: incidents incidents_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY incidents_select_org ON public.incidents FOR SELECT USING (((organization_id = public.get_user_organization_id()) OR public.is_admin()));


--
-- Name: incidents incidents_update_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY incidents_update_org ON public.incidents FOR UPDATE USING (((organization_id = public.get_user_organization_id()) OR public.is_admin()));


--
-- Name: integrations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

--
-- Name: integrations integrations_delete_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY integrations_delete_admin ON public.integrations FOR DELETE USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: integrations integrations_insert_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY integrations_insert_admin ON public.integrations FOR INSERT WITH CHECK ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: integrations integrations_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY integrations_select_org ON public.integrations FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: integrations integrations_update_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY integrations_update_admin ON public.integrations FOR UPDATE USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: kpi_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.kpi_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: kpi_logs kpi_logs_insert_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY kpi_logs_insert_all ON public.kpi_logs FOR INSERT WITH CHECK (true);


--
-- Name: kpi_logs kpi_logs_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY kpi_logs_select_org ON public.kpi_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.test_configs
  WHERE ((test_configs.id = kpi_logs.test_id) AND (test_configs.organization_id = public.get_user_organization_id())))));


--
-- Name: legal_holds; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.legal_holds ENABLE ROW LEVEL SECURITY;

--
-- Name: legal_holds legal_holds_manage_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY legal_holds_manage_admin ON public.legal_holds USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: legal_holds legal_holds_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY legal_holds_select_org ON public.legal_holds FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: monitored_numbers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.monitored_numbers ENABLE ROW LEVEL SECURITY;

--
-- Name: monitored_numbers monitored_numbers_delete_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY monitored_numbers_delete_org ON public.monitored_numbers FOR DELETE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: monitored_numbers monitored_numbers_insert_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY monitored_numbers_insert_org ON public.monitored_numbers FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: monitored_numbers monitored_numbers_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY monitored_numbers_select_org ON public.monitored_numbers FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: monitored_numbers monitored_numbers_update_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY monitored_numbers_update_org ON public.monitored_numbers FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: network_incidents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.network_incidents ENABLE ROW LEVEL SECURITY;

--
-- Name: number_kpi_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.number_kpi_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: number_kpi_snapshot; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.number_kpi_snapshot ENABLE ROW LEVEL SECURITY;

--
-- Name: oauth_tokens; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: oauth_tokens oauth_tokens_service_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY oauth_tokens_service_only ON public.oauth_tokens USING (false);


--
-- Name: org_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

--
-- Name: evidence_manifests org_members_delete_evidence_manifests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY org_members_delete_evidence_manifests ON public.evidence_manifests FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.organization_id = om.organization_id) AND (om.user_id = auth.uid())))));


--
-- Name: org_members org_members_delete_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY org_members_delete_owner ON public.org_members FOR DELETE USING (((organization_id = public.get_user_organization_id()) AND (EXISTS ( SELECT 1
   FROM public.org_members org_members_1
  WHERE ((org_members_1.organization_id = org_members_1.organization_id) AND (org_members_1.user_id = auth.uid()) AND (org_members_1.role = 'owner'::text))))));


--
-- Name: recordings org_members_delete_recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY org_members_delete_recordings ON public.recordings FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.organization_id = om.organization_id) AND (om.user_id = auth.uid())))));


--
-- Name: scorecards org_members_delete_scorecards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY org_members_delete_scorecards ON public.scorecards FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.organization_id = om.organization_id) AND (om.user_id = auth.uid())))));


--
-- Name: scored_recordings org_members_delete_scored_recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY org_members_delete_scored_recordings ON public.scored_recordings FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.organization_id = om.organization_id) AND (om.user_id = auth.uid())))));


--
-- Name: evidence_manifests org_members_insert_evidence_manifests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY org_members_insert_evidence_manifests ON public.evidence_manifests FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.organization_id = om.organization_id) AND (om.user_id = auth.uid())))));


--
-- Name: org_members org_members_insert_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY org_members_insert_owner ON public.org_members FOR INSERT WITH CHECK (((organization_id = public.get_user_organization_id()) AND (EXISTS ( SELECT 1
   FROM public.org_members org_members_1
  WHERE ((org_members_1.organization_id = org_members_1.organization_id) AND (org_members_1.user_id = auth.uid()) AND (org_members_1.role = 'owner'::text))))));


--
-- Name: recordings org_members_insert_recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY org_members_insert_recordings ON public.recordings FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.organization_id = om.organization_id) AND (om.user_id = auth.uid())))));


--
-- Name: scorecards org_members_insert_scorecards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY org_members_insert_scorecards ON public.scorecards FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.organization_id = om.organization_id) AND (om.user_id = auth.uid())))));


--
-- Name: scored_recordings org_members_insert_scored_recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY org_members_insert_scored_recordings ON public.scored_recordings FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.organization_id = om.organization_id) AND (om.user_id = auth.uid())))));


--
-- Name: evidence_manifests org_members_select_evidence_manifests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY org_members_select_evidence_manifests ON public.evidence_manifests FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.organization_id = om.organization_id) AND (om.user_id = auth.uid())))));


--
-- Name: org_members org_members_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY org_members_select_org ON public.org_members FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: recordings org_members_select_recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY org_members_select_recordings ON public.recordings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.organization_id = om.organization_id) AND (om.user_id = auth.uid())))));


--
-- Name: scorecards org_members_select_scorecards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY org_members_select_scorecards ON public.scorecards FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.organization_id = om.organization_id) AND (om.user_id = auth.uid())))));


--
-- Name: scored_recordings org_members_select_scored_recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY org_members_select_scored_recordings ON public.scored_recordings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.organization_id = om.organization_id) AND (om.user_id = auth.uid())))));


--
-- Name: evidence_manifests org_members_update_evidence_manifests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY org_members_update_evidence_manifests ON public.evidence_manifests FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.organization_id = om.organization_id) AND (om.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.organization_id = om.organization_id) AND (om.user_id = auth.uid())))));


--
-- Name: recordings org_members_update_recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY org_members_update_recordings ON public.recordings FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.organization_id = om.organization_id) AND (om.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.organization_id = om.organization_id) AND (om.user_id = auth.uid())))));


--
-- Name: scorecards org_members_update_scorecards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY org_members_update_scorecards ON public.scorecards FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.organization_id = om.organization_id) AND (om.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.organization_id = om.organization_id) AND (om.user_id = auth.uid())))));


--
-- Name: scored_recordings org_members_update_scored_recordings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY org_members_update_scored_recordings ON public.scored_recordings FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.organization_id = om.organization_id) AND (om.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.org_members om
  WHERE ((om.organization_id = om.organization_id) AND (om.user_id = auth.uid())))));


--
-- Name: org_sso_configs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.org_sso_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations organizations_insert_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY organizations_insert_admin ON public.organizations FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: organizations organizations_select_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY organizations_select_admin ON public.organizations FOR SELECT USING (public.is_admin());


--
-- Name: organizations organizations_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY organizations_select_own ON public.organizations FOR SELECT USING ((id = public.get_user_organization_id()));


--
-- Name: organizations organizations_update_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY organizations_update_owner ON public.organizations FOR UPDATE USING (((id = public.get_user_organization_id()) AND (EXISTS ( SELECT 1
   FROM public.org_members
  WHERE ((org_members.organization_id = organizations.id) AND (org_members.user_id = auth.uid()) AND (org_members.role = 'owner'::text))))));


--
-- Name: qa_evaluation_disclosures; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qa_evaluation_disclosures ENABLE ROW LEVEL SECURITY;

--
-- Name: recordings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

--
-- Name: recordings recordings_insert_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY recordings_insert_all ON public.recordings FOR INSERT WITH CHECK (true);


--
-- Name: recordings recordings_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY recordings_select_org ON public.recordings FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: recordings recordings_update_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY recordings_update_org ON public.recordings FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: report_access_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.report_access_log ENABLE ROW LEVEL SECURITY;

--
-- Name: report_access_log report_access_log_user_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY report_access_log_user_access ON public.report_access_log USING ((user_id = auth.uid()));


--
-- Name: report_schedules; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: report_templates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: retention_policies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: retention_policies retention_policies_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY retention_policies_select_org ON public.retention_policies FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: retention_policies retention_policies_update_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY retention_policies_update_admin ON public.retention_policies FOR UPDATE USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: role_capabilities_archived; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.role_capabilities_archived ENABLE ROW LEVEL SECURITY;

--
-- Name: roles_archived; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.roles_archived ENABLE ROW LEVEL SECURITY;

--
-- Name: scheduled_reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: scorecards; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.scorecards ENABLE ROW LEVEL SECURITY;

--
-- Name: scorecards scorecards_delete_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY scorecards_delete_org ON public.scorecards FOR DELETE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: scorecards scorecards_insert_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY scorecards_insert_org ON public.scorecards FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: scorecards scorecards_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY scorecards_select_org ON public.scorecards FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: scorecards scorecards_update_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY scorecards_update_org ON public.scorecards FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: scored_recordings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.scored_recordings ENABLE ROW LEVEL SECURITY;

--
-- Name: scored_recordings scored_recordings_insert_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY scored_recordings_insert_org ON public.scored_recordings FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: scored_recordings scored_recordings_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY scored_recordings_select_org ON public.scored_recordings FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: scored_recordings scored_recordings_update_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY scored_recordings_update_org ON public.scored_recordings FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: search_documents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.search_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: search_documents search_documents_insert_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY search_documents_insert_service ON public.search_documents FOR INSERT WITH CHECK (true);


--
-- Name: search_documents search_documents_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY search_documents_select_org ON public.search_documents FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: search_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.search_events ENABLE ROW LEVEL SECURITY;

--
-- Name: search_events search_events_insert_service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY search_events_insert_service ON public.search_events FOR INSERT WITH CHECK (true);


--
-- Name: search_events search_events_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY search_events_select_org ON public.search_events FOR SELECT USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid()))));


--
-- Name: sessions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_login_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sso_login_events ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stock_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: stripe_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

--
-- Name: stripe_invoices; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stripe_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: stripe_payment_methods; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stripe_payment_methods ENABLE ROW LEVEL SECURITY;

--
-- Name: stripe_subscriptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stripe_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: surveys; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

--
-- Name: surveys surveys_delete_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY surveys_delete_org ON public.surveys FOR DELETE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: surveys surveys_insert_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY surveys_insert_org ON public.surveys FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: surveys surveys_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY surveys_select_org ON public.surveys FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: surveys surveys_update_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY surveys_update_org ON public.surveys FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: team_invites; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: test_configs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.test_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: test_configs test_configs_delete_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY test_configs_delete_org ON public.test_configs FOR DELETE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: test_configs test_configs_insert_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY test_configs_insert_org ON public.test_configs FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: test_configs test_configs_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY test_configs_select_org ON public.test_configs FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: test_configs test_configs_update_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY test_configs_update_org ON public.test_configs FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: test_frequency_config; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.test_frequency_config ENABLE ROW LEVEL SECURITY;

--
-- Name: test_results; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

--
-- Name: test_results test_results_insert_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY test_results_insert_all ON public.test_results FOR INSERT WITH CHECK (true);


--
-- Name: test_results test_results_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY test_results_select_org ON public.test_results FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.test_configs
  WHERE ((test_configs.id = test_results.test_config_id) AND (test_configs.organization_id = public.get_user_organization_id())))));


--
-- Name: test_statistics; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.test_statistics ENABLE ROW LEVEL SECURITY;

--
-- Name: test_statistics test_statistics_insert_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY test_statistics_insert_all ON public.test_statistics FOR INSERT WITH CHECK (true);


--
-- Name: test_statistics test_statistics_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY test_statistics_select_org ON public.test_statistics FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.test_configs
  WHERE ((test_configs.id = test_statistics.test_config_id) AND (test_configs.organization_id = public.get_user_organization_id())))));


--
-- Name: test_statistics test_statistics_update_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY test_statistics_update_all ON public.test_statistics FOR UPDATE USING (true);


--
-- Name: tool_access_archived; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tool_access_archived ENABLE ROW LEVEL SECURITY;

--
-- Name: tool_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tool_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: tool_team_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tool_team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: transcript_versions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.transcript_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: transcript_versions transcript_versions_insert_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY transcript_versions_insert_all ON public.transcript_versions FOR INSERT WITH CHECK (true);


--
-- Name: transcript_versions transcript_versions_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY transcript_versions_select_org ON public.transcript_versions FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: verification_tokens; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: voice_configs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.voice_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: voice_configs voice_configs_insert_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY voice_configs_insert_org ON public.voice_configs FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: voice_configs voice_configs_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY voice_configs_select_org ON public.voice_configs FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: voice_configs voice_configs_update_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY voice_configs_update_org ON public.voice_configs FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: voice_targets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.voice_targets ENABLE ROW LEVEL SECURITY;

--
-- Name: voice_targets voice_targets_delete_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY voice_targets_delete_org ON public.voice_targets FOR DELETE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: voice_targets voice_targets_insert_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY voice_targets_insert_org ON public.voice_targets FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: voice_targets voice_targets_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY voice_targets_select_org ON public.voice_targets FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: voice_targets voice_targets_update_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY voice_targets_update_org ON public.voice_targets FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: webhook_configs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_failures; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.webhook_failures ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_failures webhook_failures_select_org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY webhook_failures_select_org ON public.webhook_failures FOR SELECT USING (((organization_id IS NULL) OR (organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE (org_members.user_id = auth.uid())))));


--
-- Name: webhook_failures webhook_failures_update_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY webhook_failures_update_admin ON public.webhook_failures FOR UPDATE USING ((organization_id IN ( SELECT org_members.organization_id
   FROM public.org_members
  WHERE ((org_members.user_id = auth.uid()) AND (org_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: webrtc_sessions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.webrtc_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: webrtc_sessions webrtc_sessions_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY webrtc_sessions_insert_own ON public.webrtc_sessions FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: webrtc_sessions webrtc_sessions_select_org_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY webrtc_sessions_select_org_admin ON public.webrtc_sessions FOR SELECT USING ((organization_id IN ( SELECT om.organization_id
   FROM public.org_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: webrtc_sessions webrtc_sessions_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY webrtc_sessions_select_own ON public.webrtc_sessions FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: webrtc_sessions webrtc_sessions_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY webrtc_sessions_update_own ON public.webrtc_sessions FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: objects Allow authenticated uploads; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "Allow authenticated uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'recordings'::text));


--
-- Name: objects Allow authenticated users to read recordings; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "Allow authenticated users to read recordings" ON storage.objects FOR SELECT TO authenticated USING ((bucket_id = 'call-recordings'::text));


--
-- Name: objects Allow public read access; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "Allow public read access" ON storage.objects FOR SELECT USING ((bucket_id = 'recordings'::text));


--
-- Name: objects Allow service role full access; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "Allow service role full access" ON storage.objects TO service_role USING ((bucket_id = 'recordings'::text)) WITH CHECK ((bucket_id = 'recordings'::text));


--
-- Name: objects Allow service role to manage recordings; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "Allow service role to manage recordings" ON storage.objects TO service_role USING ((bucket_id = 'call-recordings'::text));


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: prefixes; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.prefixes ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: postgres
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION supabase_realtime OWNER TO postgres;

--
-- Name: supabase_realtime_messages_publication; Type: PUBLICATION; Schema: -; Owner: supabase_admin
--

CREATE PUBLICATION supabase_realtime_messages_publication WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION supabase_realtime_messages_publication OWNER TO supabase_admin;

--
-- Name: supabase_realtime_messages_publication messages; Type: PUBLICATION TABLE; Schema: realtime; Owner: supabase_admin
--

ALTER PUBLICATION supabase_realtime_messages_publication ADD TABLE ONLY realtime.messages;


--
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO dashboard_user;
GRANT USAGE ON SCHEMA auth TO postgres;


--
-- Name: SCHEMA extensions; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;
GRANT ALL ON SCHEMA extensions TO dashboard_user;


--
-- Name: SCHEMA next_auth; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA next_auth TO authenticator;
GRANT USAGE ON SCHEMA next_auth TO anon;
GRANT USAGE ON SCHEMA next_auth TO authenticated;
GRANT USAGE ON SCHEMA next_auth TO service_role;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: SCHEMA realtime; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA realtime TO postgres;
GRANT USAGE ON SCHEMA realtime TO anon;
GRANT USAGE ON SCHEMA realtime TO authenticated;
GRANT USAGE ON SCHEMA realtime TO service_role;
GRANT ALL ON SCHEMA realtime TO supabase_realtime_admin;


--
-- Name: SCHEMA storage; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA storage TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA storage TO anon;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO service_role;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON SCHEMA storage TO dashboard_user;


--
-- Name: SCHEMA vault; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA vault TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA vault TO service_role;


--
-- Name: FUNCTION email(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.email() TO dashboard_user;


--
-- Name: FUNCTION jwt(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.jwt() TO postgres;
GRANT ALL ON FUNCTION auth.jwt() TO dashboard_user;


--
-- Name: FUNCTION role(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.role() TO dashboard_user;


--
-- Name: FUNCTION uid(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.uid() TO dashboard_user;


--
-- Name: FUNCTION armor(bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.armor(bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.armor(bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.armor(bytea) TO dashboard_user;


--
-- Name: FUNCTION armor(bytea, text[], text[]); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.armor(bytea, text[], text[]) FROM postgres;
GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO dashboard_user;


--
-- Name: FUNCTION crypt(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.crypt(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.crypt(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.crypt(text, text) TO dashboard_user;


--
-- Name: FUNCTION dearmor(text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.dearmor(text) FROM postgres;
GRANT ALL ON FUNCTION extensions.dearmor(text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.dearmor(text) TO dashboard_user;


--
-- Name: FUNCTION decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION decrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION digest(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.digest(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION digest(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.digest(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.digest(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.digest(text, text) TO dashboard_user;


--
-- Name: FUNCTION encrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION encrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION gen_random_bytes(integer); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_random_bytes(integer) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO dashboard_user;


--
-- Name: FUNCTION gen_random_uuid(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_random_uuid() FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO dashboard_user;


--
-- Name: FUNCTION gen_salt(text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_salt(text) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_salt(text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_salt(text) TO dashboard_user;


--
-- Name: FUNCTION gen_salt(text, integer); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_salt(text, integer) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO dashboard_user;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION extensions.grant_pg_cron_access() FROM supabase_admin;
GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO dashboard_user;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.grant_pg_graphql_access() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION grant_pg_net_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION extensions.grant_pg_net_access() FROM supabase_admin;
GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO dashboard_user;


--
-- Name: FUNCTION hmac(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.hmac(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION hmac(text, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.hmac(text, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO dashboard_user;


--
-- Name: FUNCTION pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) TO dashboard_user;


--
-- Name: FUNCTION pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO dashboard_user;


--
-- Name: FUNCTION pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) TO dashboard_user;


--
-- Name: FUNCTION pgp_armor_headers(text, OUT key text, OUT value text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO dashboard_user;


--
-- Name: FUNCTION pgp_key_id(bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_key_id(bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt(text, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt(text, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt(text, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgrst_ddl_watch(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.pgrst_ddl_watch() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgrst_drop_watch(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.pgrst_drop_watch() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.set_graphql_placeholder() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION uuid_generate_v1(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v1() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v1mc(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v1mc() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v3(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v4(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v4() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v5(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO dashboard_user;


--
-- Name: FUNCTION uuid_nil(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_nil() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_nil() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_nil() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_dns(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_dns() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_oid(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_oid() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_url(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_url() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_x500(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_x500() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO dashboard_user;


--
-- Name: FUNCTION graphql("operationName" text, query text, variables jsonb, extensions jsonb); Type: ACL; Schema: graphql_public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO postgres;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO anon;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO authenticated;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO service_role;


--
-- Name: FUNCTION pg_reload_conf(); Type: ACL; Schema: pg_catalog; Owner: supabase_admin
--

GRANT ALL ON FUNCTION pg_catalog.pg_reload_conf() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION get_auth(p_usename text); Type: ACL; Schema: pgbouncer; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION pgbouncer.get_auth(p_usename text) FROM PUBLIC;
GRANT ALL ON FUNCTION pgbouncer.get_auth(p_usename text) TO pgbouncer;


--
-- Name: FUNCTION apply_legal_hold(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.apply_legal_hold() TO anon;
GRANT ALL ON FUNCTION public.apply_legal_hold() TO authenticated;
GRANT ALL ON FUNCTION public.apply_legal_hold() TO service_role;


--
-- Name: FUNCTION check_billing(plan_req text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_billing(plan_req text) TO anon;
GRANT ALL ON FUNCTION public.check_billing(plan_req text) TO authenticated;
GRANT ALL ON FUNCTION public.check_billing(plan_req text) TO service_role;


--
-- Name: FUNCTION check_export_compliance(p_call_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_export_compliance(p_call_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.check_export_compliance(p_call_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.check_export_compliance(p_call_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION check_qa_compliance(p_call_id uuid, p_feature text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_qa_compliance(p_call_id uuid, p_feature text) TO anon;
GRANT ALL ON FUNCTION public.check_qa_compliance(p_call_id uuid, p_feature text) TO authenticated;
GRANT ALL ON FUNCTION public.check_qa_compliance(p_call_id uuid, p_feature text) TO service_role;


--
-- Name: FUNCTION check_sso_required(email_address text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_sso_required(email_address text) TO anon;
GRANT ALL ON FUNCTION public.check_sso_required(email_address text) TO authenticated;
GRANT ALL ON FUNCTION public.check_sso_required(email_address text) TO service_role;


--
-- Name: FUNCTION cleanup_stale_webrtc_sessions(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.cleanup_stale_webrtc_sessions() TO anon;
GRANT ALL ON FUNCTION public.cleanup_stale_webrtc_sessions() TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_stale_webrtc_sessions() TO service_role;


--
-- Name: FUNCTION create_ai_run_with_audit(p_ai_run_id uuid, p_call_id uuid, p_organization_id uuid, p_model text, p_purpose text, p_status text, p_input jsonb, p_output jsonb, p_actor_id uuid, p_system_id uuid, p_audit_after jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_ai_run_with_audit(p_ai_run_id uuid, p_call_id uuid, p_organization_id uuid, p_model text, p_purpose text, p_status text, p_input jsonb, p_output jsonb, p_actor_id uuid, p_system_id uuid, p_audit_after jsonb) TO anon;
GRANT ALL ON FUNCTION public.create_ai_run_with_audit(p_ai_run_id uuid, p_call_id uuid, p_organization_id uuid, p_model text, p_purpose text, p_status text, p_input jsonb, p_output jsonb, p_actor_id uuid, p_system_id uuid, p_audit_after jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.create_ai_run_with_audit(p_ai_run_id uuid, p_call_id uuid, p_organization_id uuid, p_model text, p_purpose text, p_status text, p_input jsonb, p_output jsonb, p_actor_id uuid, p_system_id uuid, p_audit_after jsonb) TO service_role;


--
-- Name: FUNCTION create_call_with_audit(p_call_id uuid, p_organization_id uuid, p_phone_number text, p_from_number text, p_call_sid text, p_status text, p_flow_type text, p_modulations jsonb, p_created_by uuid, p_actor_id uuid, p_system_id uuid, p_audit_action text, p_audit_after jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_call_with_audit(p_call_id uuid, p_organization_id uuid, p_phone_number text, p_from_number text, p_call_sid text, p_status text, p_flow_type text, p_modulations jsonb, p_created_by uuid, p_actor_id uuid, p_system_id uuid, p_audit_action text, p_audit_after jsonb) TO anon;
GRANT ALL ON FUNCTION public.create_call_with_audit(p_call_id uuid, p_organization_id uuid, p_phone_number text, p_from_number text, p_call_sid text, p_status text, p_flow_type text, p_modulations jsonb, p_created_by uuid, p_actor_id uuid, p_system_id uuid, p_audit_action text, p_audit_after jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.create_call_with_audit(p_call_id uuid, p_organization_id uuid, p_phone_number text, p_from_number text, p_call_sid text, p_status text, p_flow_type text, p_modulations jsonb, p_created_by uuid, p_actor_id uuid, p_system_id uuid, p_audit_action text, p_audit_after jsonb) TO service_role;


--
-- Name: FUNCTION create_recording_with_audit(p_recording_id uuid, p_call_id uuid, p_organization_id uuid, p_recording_url text, p_recording_sid text, p_duration integer, p_status text, p_actor_id uuid, p_system_id uuid, p_audit_after jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_recording_with_audit(p_recording_id uuid, p_call_id uuid, p_organization_id uuid, p_recording_url text, p_recording_sid text, p_duration integer, p_status text, p_actor_id uuid, p_system_id uuid, p_audit_after jsonb) TO anon;
GRANT ALL ON FUNCTION public.create_recording_with_audit(p_recording_id uuid, p_call_id uuid, p_organization_id uuid, p_recording_url text, p_recording_sid text, p_duration integer, p_status text, p_actor_id uuid, p_system_id uuid, p_audit_after jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.create_recording_with_audit(p_recording_id uuid, p_call_id uuid, p_organization_id uuid, p_recording_url text, p_recording_sid text, p_duration integer, p_status text, p_actor_id uuid, p_system_id uuid, p_audit_after jsonb) TO service_role;


--
-- Name: FUNCTION get_active_subscription(org_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_active_subscription(org_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_active_subscription(org_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_active_subscription(org_id uuid) TO service_role;


--
-- Name: FUNCTION get_ai_agent_config(org_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_ai_agent_config(org_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_ai_agent_config(org_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_ai_agent_config(org_id uuid) TO service_role;


--
-- Name: FUNCTION get_campaign_stats(campaign_id_param uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_campaign_stats(campaign_id_param uuid) TO anon;
GRANT ALL ON FUNCTION public.get_campaign_stats(campaign_id_param uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_campaign_stats(campaign_id_param uuid) TO service_role;


--
-- Name: FUNCTION get_user_organization_id(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_organization_id() TO anon;
GRANT ALL ON FUNCTION public.get_user_organization_id() TO authenticated;
GRANT ALL ON FUNCTION public.get_user_organization_id() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION is_org_member(org_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_org_member(org_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_org_member(org_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_org_member(org_id uuid) TO service_role;


--
-- Name: FUNCTION log_ai_agent_config_change(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.log_ai_agent_config_change() TO anon;
GRANT ALL ON FUNCTION public.log_ai_agent_config_change() TO authenticated;
GRANT ALL ON FUNCTION public.log_ai_agent_config_change() TO service_role;


--
-- Name: FUNCTION prevent_artifact_provenance_update(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_artifact_provenance_update() TO anon;
GRANT ALL ON FUNCTION public.prevent_artifact_provenance_update() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_artifact_provenance_update() TO service_role;


--
-- Name: FUNCTION prevent_attention_decision_delete(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_attention_decision_delete() TO anon;
GRANT ALL ON FUNCTION public.prevent_attention_decision_delete() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_attention_decision_delete() TO service_role;


--
-- Name: FUNCTION prevent_attention_decision_update(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_attention_decision_update() TO anon;
GRANT ALL ON FUNCTION public.prevent_attention_decision_update() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_attention_decision_update() TO service_role;


--
-- Name: FUNCTION prevent_attention_event_delete(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_attention_event_delete() TO anon;
GRANT ALL ON FUNCTION public.prevent_attention_event_delete() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_attention_event_delete() TO service_role;


--
-- Name: FUNCTION prevent_attention_event_update(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_attention_event_update() TO anon;
GRANT ALL ON FUNCTION public.prevent_attention_event_update() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_attention_event_update() TO service_role;


--
-- Name: FUNCTION prevent_crm_sync_log_delete(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_crm_sync_log_delete() TO anon;
GRANT ALL ON FUNCTION public.prevent_crm_sync_log_delete() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_crm_sync_log_delete() TO service_role;


--
-- Name: FUNCTION prevent_crm_sync_log_update(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_crm_sync_log_update() TO anon;
GRANT ALL ON FUNCTION public.prevent_crm_sync_log_update() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_crm_sync_log_update() TO service_role;


--
-- Name: FUNCTION prevent_digest_delete(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_digest_delete() TO anon;
GRANT ALL ON FUNCTION public.prevent_digest_delete() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_digest_delete() TO service_role;


--
-- Name: FUNCTION prevent_digest_update(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_digest_update() TO anon;
GRANT ALL ON FUNCTION public.prevent_digest_update() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_digest_update() TO service_role;


--
-- Name: FUNCTION prevent_evidence_bundle_content_update(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_evidence_bundle_content_update() TO anon;
GRANT ALL ON FUNCTION public.prevent_evidence_bundle_content_update() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_evidence_bundle_content_update() TO service_role;


--
-- Name: FUNCTION prevent_evidence_manifest_content_update(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_evidence_manifest_content_update() TO anon;
GRANT ALL ON FUNCTION public.prevent_evidence_manifest_content_update() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_evidence_manifest_content_update() TO service_role;


--
-- Name: FUNCTION prevent_observation_delete(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_observation_delete() TO anon;
GRANT ALL ON FUNCTION public.prevent_observation_delete() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_observation_delete() TO service_role;


--
-- Name: FUNCTION prevent_observation_update(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_observation_update() TO anon;
GRANT ALL ON FUNCTION public.prevent_observation_update() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_observation_update() TO service_role;


--
-- Name: FUNCTION prevent_search_document_delete(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_search_document_delete() TO anon;
GRANT ALL ON FUNCTION public.prevent_search_document_delete() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_search_document_delete() TO service_role;


--
-- Name: FUNCTION prevent_search_document_update(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_search_document_update() TO anon;
GRANT ALL ON FUNCTION public.prevent_search_document_update() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_search_document_update() TO service_role;


--
-- Name: FUNCTION prevent_search_event_delete(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_search_event_delete() TO anon;
GRANT ALL ON FUNCTION public.prevent_search_event_delete() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_search_event_delete() TO service_role;


--
-- Name: FUNCTION prevent_search_event_update(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_search_event_update() TO anon;
GRANT ALL ON FUNCTION public.prevent_search_event_update() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_search_event_update() TO service_role;


--
-- Name: FUNCTION prevent_transcript_version_update(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_transcript_version_update() TO anon;
GRANT ALL ON FUNCTION public.prevent_transcript_version_update() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_transcript_version_update() TO service_role;


--
-- Name: FUNCTION record_sso_login(p_sso_config_id uuid, p_event_type text, p_email text, p_name text, p_groups text[], p_idp_subject text, p_ip_address inet, p_user_agent text, p_error_code text, p_error_message text, p_raw_claims jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.record_sso_login(p_sso_config_id uuid, p_event_type text, p_email text, p_name text, p_groups text[], p_idp_subject text, p_ip_address inet, p_user_agent text, p_error_code text, p_error_message text, p_raw_claims jsonb) TO anon;
GRANT ALL ON FUNCTION public.record_sso_login(p_sso_config_id uuid, p_event_type text, p_email text, p_name text, p_groups text[], p_idp_subject text, p_ip_address inet, p_user_agent text, p_error_code text, p_error_message text, p_raw_claims jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.record_sso_login(p_sso_config_id uuid, p_event_type text, p_email text, p_name text, p_groups text[], p_idp_subject text, p_ip_address inet, p_user_agent text, p_error_code text, p_error_message text, p_raw_claims jsonb) TO service_role;


--
-- Name: FUNCTION safe_insert_user(p_id uuid, p_org_id uuid, p_email text, p_role text, p_is_admin boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.safe_insert_user(p_id uuid, p_org_id uuid, p_email text, p_role text, p_is_admin boolean) TO anon;
GRANT ALL ON FUNCTION public.safe_insert_user(p_id uuid, p_org_id uuid, p_email text, p_role text, p_is_admin boolean) TO authenticated;
GRANT ALL ON FUNCTION public.safe_insert_user(p_id uuid, p_org_id uuid, p_email text, p_role text, p_is_admin boolean) TO service_role;


--
-- Name: FUNCTION set_audit_log_actor_type(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_audit_log_actor_type() TO anon;
GRANT ALL ON FUNCTION public.set_audit_log_actor_type() TO authenticated;
GRANT ALL ON FUNCTION public.set_audit_log_actor_type() TO service_role;


--
-- Name: FUNCTION soft_delete_ai_run(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.soft_delete_ai_run() TO anon;
GRANT ALL ON FUNCTION public.soft_delete_ai_run() TO authenticated;
GRANT ALL ON FUNCTION public.soft_delete_ai_run() TO service_role;


--
-- Name: FUNCTION soft_delete_call(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.soft_delete_call() TO anon;
GRANT ALL ON FUNCTION public.soft_delete_call() TO authenticated;
GRANT ALL ON FUNCTION public.soft_delete_call() TO service_role;


--
-- Name: FUNCTION soft_delete_recording(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.soft_delete_recording() TO anon;
GRANT ALL ON FUNCTION public.soft_delete_recording() TO authenticated;
GRANT ALL ON FUNCTION public.soft_delete_recording() TO service_role;


--
-- Name: FUNCTION sync_organization_plan(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_organization_plan() TO anon;
GRANT ALL ON FUNCTION public.sync_organization_plan() TO authenticated;
GRANT ALL ON FUNCTION public.sync_organization_plan() TO service_role;


--
-- Name: FUNCTION sync_sessions_sessiontoken(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_sessions_sessiontoken() TO anon;
GRANT ALL ON FUNCTION public.sync_sessions_sessiontoken() TO authenticated;
GRANT ALL ON FUNCTION public.sync_sessions_sessiontoken() TO service_role;


--
-- Name: FUNCTION update_booking_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_booking_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_booking_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_booking_updated_at() TO service_role;


--
-- Name: FUNCTION update_shopper_jobs_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_shopper_jobs_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_shopper_jobs_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_shopper_jobs_updated_at() TO service_role;


--
-- Name: FUNCTION update_test_statistics(p_test_config_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_test_statistics(p_test_config_id uuid) TO anon;
GRANT ALL ON FUNCTION public.update_test_statistics(p_test_config_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.update_test_statistics(p_test_config_id uuid) TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: FUNCTION user_has_tool_access(p_user_id uuid, p_org_id uuid, p_tool public.tool_type, p_min_role public.tool_role_type); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.user_has_tool_access(p_user_id uuid, p_org_id uuid, p_tool public.tool_type, p_min_role public.tool_role_type) TO anon;
GRANT ALL ON FUNCTION public.user_has_tool_access(p_user_id uuid, p_org_id uuid, p_tool public.tool_type, p_min_role public.tool_role_type) TO authenticated;
GRANT ALL ON FUNCTION public.user_has_tool_access(p_user_id uuid, p_org_id uuid, p_tool public.tool_type, p_min_role public.tool_role_type) TO service_role;


--
-- Name: FUNCTION validate_ai_agent_config(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.validate_ai_agent_config() TO anon;
GRANT ALL ON FUNCTION public.validate_ai_agent_config() TO authenticated;
GRANT ALL ON FUNCTION public.validate_ai_agent_config() TO service_role;


--
-- Name: FUNCTION apply_rls(wal jsonb, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO authenticated;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO service_role;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO supabase_realtime_admin;


--
-- Name: FUNCTION broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO postgres;
GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO dashboard_user;


--
-- Name: FUNCTION build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO postgres;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO anon;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO service_role;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO supabase_realtime_admin;


--
-- Name: FUNCTION "cast"(val text, type_ regtype); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO postgres;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO dashboard_user;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO anon;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO authenticated;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO service_role;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO supabase_realtime_admin;


--
-- Name: FUNCTION check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO postgres;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO anon;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO authenticated;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO service_role;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO supabase_realtime_admin;


--
-- Name: FUNCTION is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO postgres;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO anon;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO service_role;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO supabase_realtime_admin;


--
-- Name: FUNCTION list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO authenticated;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO service_role;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO supabase_realtime_admin;


--
-- Name: FUNCTION quote_wal2json(entity regclass); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO postgres;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO anon;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO authenticated;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO service_role;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO supabase_realtime_admin;


--
-- Name: FUNCTION send(payload jsonb, event text, topic text, private boolean); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO postgres;
GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO dashboard_user;


--
-- Name: FUNCTION subscription_check_filters(); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO postgres;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO dashboard_user;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO anon;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO authenticated;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO service_role;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO supabase_realtime_admin;


--
-- Name: FUNCTION to_regrole(role_name text); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO postgres;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO anon;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO authenticated;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO service_role;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO supabase_realtime_admin;


--
-- Name: FUNCTION topic(); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.topic() TO postgres;
GRANT ALL ON FUNCTION realtime.topic() TO dashboard_user;


--
-- Name: FUNCTION _crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO service_role;


--
-- Name: FUNCTION create_secret(new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- Name: FUNCTION update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- Name: TABLE audit_log_entries; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.audit_log_entries TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.audit_log_entries TO postgres;
GRANT SELECT ON TABLE auth.audit_log_entries TO postgres WITH GRANT OPTION;


--
-- Name: TABLE flow_state; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.flow_state TO postgres;
GRANT SELECT ON TABLE auth.flow_state TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.flow_state TO dashboard_user;


--
-- Name: TABLE identities; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.identities TO postgres;
GRANT SELECT ON TABLE auth.identities TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.identities TO dashboard_user;


--
-- Name: TABLE instances; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.instances TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.instances TO postgres;
GRANT SELECT ON TABLE auth.instances TO postgres WITH GRANT OPTION;


--
-- Name: TABLE mfa_amr_claims; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_amr_claims TO postgres;
GRANT SELECT ON TABLE auth.mfa_amr_claims TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_amr_claims TO dashboard_user;


--
-- Name: TABLE mfa_challenges; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_challenges TO postgres;
GRANT SELECT ON TABLE auth.mfa_challenges TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_challenges TO dashboard_user;


--
-- Name: TABLE mfa_factors; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_factors TO postgres;
GRANT SELECT ON TABLE auth.mfa_factors TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_factors TO dashboard_user;


--
-- Name: TABLE oauth_authorizations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_authorizations TO postgres;
GRANT ALL ON TABLE auth.oauth_authorizations TO dashboard_user;


--
-- Name: TABLE oauth_client_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_client_states TO postgres;
GRANT ALL ON TABLE auth.oauth_client_states TO dashboard_user;


--
-- Name: TABLE oauth_clients; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_clients TO postgres;
GRANT ALL ON TABLE auth.oauth_clients TO dashboard_user;


--
-- Name: TABLE oauth_consents; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_consents TO postgres;
GRANT ALL ON TABLE auth.oauth_consents TO dashboard_user;


--
-- Name: TABLE one_time_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.one_time_tokens TO postgres;
GRANT SELECT ON TABLE auth.one_time_tokens TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.one_time_tokens TO dashboard_user;


--
-- Name: TABLE refresh_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.refresh_tokens TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.refresh_tokens TO postgres;
GRANT SELECT ON TABLE auth.refresh_tokens TO postgres WITH GRANT OPTION;


--
-- Name: SEQUENCE refresh_tokens_id_seq; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO dashboard_user;
GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO postgres;


--
-- Name: TABLE saml_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_providers TO postgres;
GRANT SELECT ON TABLE auth.saml_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_providers TO dashboard_user;


--
-- Name: TABLE saml_relay_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_relay_states TO postgres;
GRANT SELECT ON TABLE auth.saml_relay_states TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_relay_states TO dashboard_user;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT SELECT ON TABLE auth.schema_migrations TO postgres WITH GRANT OPTION;


--
-- Name: TABLE sessions; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sessions TO postgres;
GRANT SELECT ON TABLE auth.sessions TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sessions TO dashboard_user;


--
-- Name: TABLE sso_domains; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_domains TO postgres;
GRANT SELECT ON TABLE auth.sso_domains TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_domains TO dashboard_user;


--
-- Name: TABLE sso_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_providers TO postgres;
GRANT SELECT ON TABLE auth.sso_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_providers TO dashboard_user;


--
-- Name: TABLE users; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.users TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.users TO postgres;
GRANT SELECT ON TABLE auth.users TO postgres WITH GRANT OPTION;


--
-- Name: TABLE pg_stat_statements; Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON TABLE extensions.pg_stat_statements FROM postgres;
GRANT ALL ON TABLE extensions.pg_stat_statements TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE extensions.pg_stat_statements TO dashboard_user;


--
-- Name: TABLE pg_stat_statements_info; Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON TABLE extensions.pg_stat_statements_info FROM postgres;
GRANT ALL ON TABLE extensions.pg_stat_statements_info TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE extensions.pg_stat_statements_info TO dashboard_user;


--
-- Name: TABLE accounts; Type: ACL; Schema: next_auth; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE next_auth.accounts TO authenticator;
GRANT ALL ON TABLE next_auth.accounts TO anon;
GRANT ALL ON TABLE next_auth.accounts TO authenticated;
GRANT ALL ON TABLE next_auth.accounts TO service_role;


--
-- Name: TABLE sessions; Type: ACL; Schema: next_auth; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE next_auth.sessions TO authenticator;
GRANT ALL ON TABLE next_auth.sessions TO anon;
GRANT ALL ON TABLE next_auth.sessions TO authenticated;
GRANT ALL ON TABLE next_auth.sessions TO service_role;


--
-- Name: TABLE users; Type: ACL; Schema: next_auth; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE next_auth.users TO authenticator;
GRANT ALL ON TABLE next_auth.users TO anon;
GRANT ALL ON TABLE next_auth.users TO authenticated;
GRANT ALL ON TABLE next_auth.users TO service_role;


--
-- Name: TABLE verification_tokens; Type: ACL; Schema: next_auth; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE next_auth.verification_tokens TO authenticator;
GRANT ALL ON TABLE next_auth.verification_tokens TO anon;
GRANT ALL ON TABLE next_auth.verification_tokens TO authenticated;
GRANT ALL ON TABLE next_auth.verification_tokens TO service_role;


--
-- Name: TABLE access_grants_archived; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.access_grants_archived TO anon;
GRANT ALL ON TABLE public.access_grants_archived TO authenticated;
GRANT ALL ON TABLE public.access_grants_archived TO service_role;


--
-- Name: TABLE accounts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.accounts TO anon;
GRANT ALL ON TABLE public.accounts TO authenticated;
GRANT ALL ON TABLE public.accounts TO service_role;


--
-- Name: TABLE ai_agent_audit_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ai_agent_audit_log TO anon;
GRANT ALL ON TABLE public.ai_agent_audit_log TO authenticated;
GRANT ALL ON TABLE public.ai_agent_audit_log TO service_role;


--
-- Name: TABLE ai_runs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ai_runs TO anon;
GRANT ALL ON TABLE public.ai_runs TO authenticated;
GRANT ALL ON TABLE public.ai_runs TO service_role;


--
-- Name: TABLE alert_acknowledgements; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.alert_acknowledgements TO anon;
GRANT ALL ON TABLE public.alert_acknowledgements TO authenticated;
GRANT ALL ON TABLE public.alert_acknowledgements TO service_role;


--
-- Name: TABLE alerts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.alerts TO anon;
GRANT ALL ON TABLE public.alerts TO authenticated;
GRANT ALL ON TABLE public.alerts TO service_role;


--
-- Name: TABLE artifact_provenance; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.artifact_provenance TO anon;
GRANT ALL ON TABLE public.artifact_provenance TO authenticated;
GRANT ALL ON TABLE public.artifact_provenance TO service_role;


--
-- Name: TABLE artifacts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.artifacts TO anon;
GRANT ALL ON TABLE public.artifacts TO authenticated;
GRANT ALL ON TABLE public.artifacts TO service_role;


--
-- Name: TABLE attention_decisions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.attention_decisions TO anon;
GRANT ALL ON TABLE public.attention_decisions TO authenticated;
GRANT ALL ON TABLE public.attention_decisions TO service_role;


--
-- Name: TABLE attention_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.attention_events TO anon;
GRANT ALL ON TABLE public.attention_events TO authenticated;
GRANT ALL ON TABLE public.attention_events TO service_role;


--
-- Name: TABLE attention_policies; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.attention_policies TO anon;
GRANT ALL ON TABLE public.attention_policies TO authenticated;
GRANT ALL ON TABLE public.attention_policies TO service_role;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.audit_logs TO anon;
GRANT ALL ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;


--
-- Name: TABLE booking_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.booking_events TO anon;
GRANT ALL ON TABLE public.booking_events TO authenticated;
GRANT ALL ON TABLE public.booking_events TO service_role;


--
-- Name: TABLE call_confirmation_checklists; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.call_confirmation_checklists TO anon;
GRANT ALL ON TABLE public.call_confirmation_checklists TO authenticated;
GRANT ALL ON TABLE public.call_confirmation_checklists TO service_role;


--
-- Name: TABLE call_confirmations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.call_confirmations TO anon;
GRANT ALL ON TABLE public.call_confirmations TO authenticated;
GRANT ALL ON TABLE public.call_confirmations TO service_role;


--
-- Name: TABLE calls; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.calls TO anon;
GRANT ALL ON TABLE public.calls TO authenticated;
GRANT ALL ON TABLE public.calls TO service_role;


--
-- Name: TABLE evidence_manifests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.evidence_manifests TO anon;
GRANT ALL ON TABLE public.evidence_manifests TO authenticated;
GRANT ALL ON TABLE public.evidence_manifests TO service_role;


--
-- Name: TABLE recordings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.recordings TO anon;
GRANT ALL ON TABLE public.recordings TO authenticated;
GRANT ALL ON TABLE public.recordings TO service_role;


--
-- Name: TABLE scored_recordings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.scored_recordings TO anon;
GRANT ALL ON TABLE public.scored_recordings TO authenticated;
GRANT ALL ON TABLE public.scored_recordings TO service_role;


--
-- Name: TABLE call_debug_view; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.call_debug_view TO anon;
GRANT ALL ON TABLE public.call_debug_view TO authenticated;
GRANT ALL ON TABLE public.call_debug_view TO service_role;


--
-- Name: TABLE call_export_bundles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.call_export_bundles TO anon;
GRANT ALL ON TABLE public.call_export_bundles TO authenticated;
GRANT ALL ON TABLE public.call_export_bundles TO service_role;


--
-- Name: TABLE call_notes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.call_notes TO anon;
GRANT ALL ON TABLE public.call_notes TO authenticated;
GRANT ALL ON TABLE public.call_notes TO service_role;


--
-- Name: TABLE caller_id_default_rules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.caller_id_default_rules TO anon;
GRANT ALL ON TABLE public.caller_id_default_rules TO authenticated;
GRANT ALL ON TABLE public.caller_id_default_rules TO service_role;


--
-- Name: TABLE caller_id_numbers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.caller_id_numbers TO anon;
GRANT ALL ON TABLE public.caller_id_numbers TO authenticated;
GRANT ALL ON TABLE public.caller_id_numbers TO service_role;


--
-- Name: TABLE caller_id_permissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.caller_id_permissions TO anon;
GRANT ALL ON TABLE public.caller_id_permissions TO authenticated;
GRANT ALL ON TABLE public.caller_id_permissions TO service_role;


--
-- Name: TABLE campaign_audit_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.campaign_audit_log TO anon;
GRANT ALL ON TABLE public.campaign_audit_log TO authenticated;
GRANT ALL ON TABLE public.campaign_audit_log TO service_role;


--
-- Name: TABLE campaign_calls; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.campaign_calls TO anon;
GRANT ALL ON TABLE public.campaign_calls TO authenticated;
GRANT ALL ON TABLE public.campaign_calls TO service_role;


--
-- Name: TABLE campaigns; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.campaigns TO anon;
GRANT ALL ON TABLE public.campaigns TO authenticated;
GRANT ALL ON TABLE public.campaigns TO service_role;


--
-- Name: TABLE capabilities_archived; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.capabilities_archived TO anon;
GRANT ALL ON TABLE public.capabilities_archived TO authenticated;
GRANT ALL ON TABLE public.capabilities_archived TO service_role;


--
-- Name: TABLE carrier_status; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.carrier_status TO anon;
GRANT ALL ON TABLE public.carrier_status TO authenticated;
GRANT ALL ON TABLE public.carrier_status TO service_role;


--
-- Name: TABLE carrier_health_public; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.carrier_health_public TO anon;
GRANT ALL ON TABLE public.carrier_health_public TO authenticated;
GRANT ALL ON TABLE public.carrier_health_public TO service_role;


--
-- Name: TABLE compliance_restrictions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.compliance_restrictions TO anon;
GRANT ALL ON TABLE public.compliance_restrictions TO authenticated;
GRANT ALL ON TABLE public.compliance_restrictions TO service_role;


--
-- Name: TABLE compliance_violations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.compliance_violations TO anon;
GRANT ALL ON TABLE public.compliance_violations TO authenticated;
GRANT ALL ON TABLE public.compliance_violations TO service_role;


--
-- Name: TABLE confirmation_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.confirmation_templates TO anon;
GRANT ALL ON TABLE public.confirmation_templates TO authenticated;
GRANT ALL ON TABLE public.confirmation_templates TO service_role;


--
-- Name: TABLE crm_object_links; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.crm_object_links TO anon;
GRANT ALL ON TABLE public.crm_object_links TO authenticated;
GRANT ALL ON TABLE public.crm_object_links TO service_role;


--
-- Name: TABLE crm_sync_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.crm_sync_log TO anon;
GRANT ALL ON TABLE public.crm_sync_log TO authenticated;
GRANT ALL ON TABLE public.crm_sync_log TO service_role;


--
-- Name: TABLE digest_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.digest_items TO anon;
GRANT ALL ON TABLE public.digest_items TO authenticated;
GRANT ALL ON TABLE public.digest_items TO service_role;


--
-- Name: TABLE digests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.digests TO anon;
GRANT ALL ON TABLE public.digests TO authenticated;
GRANT ALL ON TABLE public.digests TO service_role;


--
-- Name: TABLE disclosure_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.disclosure_logs TO anon;
GRANT ALL ON TABLE public.disclosure_logs TO authenticated;
GRANT ALL ON TABLE public.disclosure_logs TO service_role;


--
-- Name: TABLE evidence_bundles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.evidence_bundles TO anon;
GRANT ALL ON TABLE public.evidence_bundles TO authenticated;
GRANT ALL ON TABLE public.evidence_bundles TO service_role;


--
-- Name: TABLE execution_contexts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.execution_contexts TO anon;
GRANT ALL ON TABLE public.execution_contexts TO authenticated;
GRANT ALL ON TABLE public.execution_contexts TO service_role;


--
-- Name: TABLE export_compliance_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.export_compliance_log TO anon;
GRANT ALL ON TABLE public.export_compliance_log TO authenticated;
GRANT ALL ON TABLE public.export_compliance_log TO service_role;


--
-- Name: TABLE external_entities; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.external_entities TO anon;
GRANT ALL ON TABLE public.external_entities TO authenticated;
GRANT ALL ON TABLE public.external_entities TO service_role;


--
-- Name: TABLE external_entity_identifiers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.external_entity_identifiers TO anon;
GRANT ALL ON TABLE public.external_entity_identifiers TO authenticated;
GRANT ALL ON TABLE public.external_entity_identifiers TO service_role;


--
-- Name: TABLE external_entity_links; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.external_entity_links TO anon;
GRANT ALL ON TABLE public.external_entity_links TO authenticated;
GRANT ALL ON TABLE public.external_entity_links TO service_role;


--
-- Name: TABLE external_entity_observations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.external_entity_observations TO anon;
GRANT ALL ON TABLE public.external_entity_observations TO authenticated;
GRANT ALL ON TABLE public.external_entity_observations TO service_role;


--
-- Name: TABLE generated_reports; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.generated_reports TO anon;
GRANT ALL ON TABLE public.generated_reports TO authenticated;
GRANT ALL ON TABLE public.generated_reports TO service_role;


--
-- Name: TABLE global_feature_flags; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.global_feature_flags TO anon;
GRANT ALL ON TABLE public.global_feature_flags TO authenticated;
GRANT ALL ON TABLE public.global_feature_flags TO service_role;


--
-- Name: TABLE incidents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.incidents TO anon;
GRANT ALL ON TABLE public.incidents TO authenticated;
GRANT ALL ON TABLE public.incidents TO service_role;


--
-- Name: TABLE integrations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.integrations TO anon;
GRANT ALL ON TABLE public.integrations TO authenticated;
GRANT ALL ON TABLE public.integrations TO service_role;


--
-- Name: TABLE invoices; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.invoices TO anon;
GRANT ALL ON TABLE public.invoices TO authenticated;
GRANT ALL ON TABLE public.invoices TO service_role;


--
-- Name: TABLE kpi_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.kpi_logs TO anon;
GRANT ALL ON TABLE public.kpi_logs TO authenticated;
GRANT ALL ON TABLE public.kpi_logs TO service_role;


--
-- Name: SEQUENCE kpi_logs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.kpi_logs_id_seq TO anon;
GRANT ALL ON SEQUENCE public.kpi_logs_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.kpi_logs_id_seq TO service_role;


--
-- Name: TABLE kpi_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.kpi_settings TO anon;
GRANT ALL ON TABLE public.kpi_settings TO authenticated;
GRANT ALL ON TABLE public.kpi_settings TO service_role;


--
-- Name: TABLE legal_holds; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.legal_holds TO anon;
GRANT ALL ON TABLE public.legal_holds TO authenticated;
GRANT ALL ON TABLE public.legal_holds TO service_role;


--
-- Name: TABLE login_attempts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.login_attempts TO anon;
GRANT ALL ON TABLE public.login_attempts TO authenticated;
GRANT ALL ON TABLE public.login_attempts TO service_role;


--
-- Name: TABLE media_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.media_sessions TO anon;
GRANT ALL ON TABLE public.media_sessions TO authenticated;
GRANT ALL ON TABLE public.media_sessions TO service_role;


--
-- Name: TABLE monitored_numbers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.monitored_numbers TO anon;
GRANT ALL ON TABLE public.monitored_numbers TO authenticated;
GRANT ALL ON TABLE public.monitored_numbers TO service_role;


--
-- Name: TABLE network_incidents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.network_incidents TO anon;
GRANT ALL ON TABLE public.network_incidents TO authenticated;
GRANT ALL ON TABLE public.network_incidents TO service_role;


--
-- Name: TABLE number_kpi_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.number_kpi_logs TO anon;
GRANT ALL ON TABLE public.number_kpi_logs TO authenticated;
GRANT ALL ON TABLE public.number_kpi_logs TO service_role;


--
-- Name: TABLE number_kpi_snapshot; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.number_kpi_snapshot TO anon;
GRANT ALL ON TABLE public.number_kpi_snapshot TO authenticated;
GRANT ALL ON TABLE public.number_kpi_snapshot TO service_role;


--
-- Name: TABLE oauth_tokens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.oauth_tokens TO anon;
GRANT ALL ON TABLE public.oauth_tokens TO authenticated;
GRANT ALL ON TABLE public.oauth_tokens TO service_role;


--
-- Name: TABLE org_feature_flags; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.org_feature_flags TO anon;
GRANT ALL ON TABLE public.org_feature_flags TO authenticated;
GRANT ALL ON TABLE public.org_feature_flags TO service_role;


--
-- Name: TABLE org_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.org_members TO anon;
GRANT ALL ON TABLE public.org_members TO authenticated;
GRANT ALL ON TABLE public.org_members TO service_role;


--
-- Name: TABLE org_sso_configs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.org_sso_configs TO anon;
GRANT ALL ON TABLE public.org_sso_configs TO authenticated;
GRANT ALL ON TABLE public.org_sso_configs TO service_role;


--
-- Name: TABLE organizations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.organizations TO anon;
GRANT ALL ON TABLE public.organizations TO authenticated;
GRANT ALL ON TABLE public.organizations TO service_role;


--
-- Name: TABLE qa_evaluation_disclosures; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qa_evaluation_disclosures TO anon;
GRANT ALL ON TABLE public.qa_evaluation_disclosures TO authenticated;
GRANT ALL ON TABLE public.qa_evaluation_disclosures TO service_role;


--
-- Name: TABLE webhook_failures; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.webhook_failures TO anon;
GRANT ALL ON TABLE public.webhook_failures TO authenticated;
GRANT ALL ON TABLE public.webhook_failures TO service_role;


--
-- Name: TABLE reliability_metrics; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.reliability_metrics TO anon;
GRANT ALL ON TABLE public.reliability_metrics TO authenticated;
GRANT ALL ON TABLE public.reliability_metrics TO service_role;


--
-- Name: TABLE report_access_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.report_access_log TO anon;
GRANT ALL ON TABLE public.report_access_log TO authenticated;
GRANT ALL ON TABLE public.report_access_log TO service_role;


--
-- Name: TABLE report_schedules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.report_schedules TO anon;
GRANT ALL ON TABLE public.report_schedules TO authenticated;
GRANT ALL ON TABLE public.report_schedules TO service_role;


--
-- Name: TABLE report_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.report_templates TO anon;
GRANT ALL ON TABLE public.report_templates TO authenticated;
GRANT ALL ON TABLE public.report_templates TO service_role;


--
-- Name: TABLE retention_policies; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.retention_policies TO anon;
GRANT ALL ON TABLE public.retention_policies TO authenticated;
GRANT ALL ON TABLE public.retention_policies TO service_role;


--
-- Name: TABLE role_capabilities_archived; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.role_capabilities_archived TO anon;
GRANT ALL ON TABLE public.role_capabilities_archived TO authenticated;
GRANT ALL ON TABLE public.role_capabilities_archived TO service_role;


--
-- Name: TABLE roles_archived; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.roles_archived TO anon;
GRANT ALL ON TABLE public.roles_archived TO authenticated;
GRANT ALL ON TABLE public.roles_archived TO service_role;


--
-- Name: TABLE scheduled_reports; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.scheduled_reports TO anon;
GRANT ALL ON TABLE public.scheduled_reports TO authenticated;
GRANT ALL ON TABLE public.scheduled_reports TO service_role;


--
-- Name: TABLE scorecards; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.scorecards TO anon;
GRANT ALL ON TABLE public.scorecards TO authenticated;
GRANT ALL ON TABLE public.scorecards TO service_role;


--
-- Name: TABLE search_documents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.search_documents TO anon;
GRANT ALL ON TABLE public.search_documents TO authenticated;
GRANT ALL ON TABLE public.search_documents TO service_role;


--
-- Name: TABLE search_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.search_events TO anon;
GRANT ALL ON TABLE public.search_events TO authenticated;
GRANT ALL ON TABLE public.search_events TO service_role;


--
-- Name: TABLE sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sessions TO anon;
GRANT ALL ON TABLE public.sessions TO authenticated;
GRANT ALL ON TABLE public.sessions TO service_role;


--
-- Name: TABLE shopper_campaigns_archive; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.shopper_campaigns_archive TO anon;
GRANT ALL ON TABLE public.shopper_campaigns_archive TO authenticated;
GRANT ALL ON TABLE public.shopper_campaigns_archive TO service_role;


--
-- Name: TABLE shopper_jobs_archive; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.shopper_jobs_archive TO anon;
GRANT ALL ON TABLE public.shopper_jobs_archive TO authenticated;
GRANT ALL ON TABLE public.shopper_jobs_archive TO service_role;


--
-- Name: TABLE shopper_results; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.shopper_results TO anon;
GRANT ALL ON TABLE public.shopper_results TO authenticated;
GRANT ALL ON TABLE public.shopper_results TO service_role;


--
-- Name: TABLE shopper_scripts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.shopper_scripts TO anon;
GRANT ALL ON TABLE public.shopper_scripts TO authenticated;
GRANT ALL ON TABLE public.shopper_scripts TO service_role;


--
-- Name: TABLE sso_login_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sso_login_events TO anon;
GRANT ALL ON TABLE public.sso_login_events TO authenticated;
GRANT ALL ON TABLE public.sso_login_events TO service_role;


--
-- Name: TABLE stock_messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stock_messages TO anon;
GRANT ALL ON TABLE public.stock_messages TO authenticated;
GRANT ALL ON TABLE public.stock_messages TO service_role;


--
-- Name: TABLE stripe_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stripe_events TO anon;
GRANT ALL ON TABLE public.stripe_events TO authenticated;
GRANT ALL ON TABLE public.stripe_events TO service_role;


--
-- Name: TABLE stripe_invoices; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stripe_invoices TO anon;
GRANT ALL ON TABLE public.stripe_invoices TO authenticated;
GRANT ALL ON TABLE public.stripe_invoices TO service_role;


--
-- Name: TABLE stripe_payment_methods; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stripe_payment_methods TO anon;
GRANT ALL ON TABLE public.stripe_payment_methods TO authenticated;
GRANT ALL ON TABLE public.stripe_payment_methods TO service_role;


--
-- Name: TABLE stripe_subscriptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stripe_subscriptions TO anon;
GRANT ALL ON TABLE public.stripe_subscriptions TO authenticated;
GRANT ALL ON TABLE public.stripe_subscriptions TO service_role;


--
-- Name: TABLE subscriptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.subscriptions TO anon;
GRANT ALL ON TABLE public.subscriptions TO authenticated;
GRANT ALL ON TABLE public.subscriptions TO service_role;


--
-- Name: TABLE surveys; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.surveys TO anon;
GRANT ALL ON TABLE public.surveys TO authenticated;
GRANT ALL ON TABLE public.surveys TO service_role;


--
-- Name: TABLE systems; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.systems TO anon;
GRANT ALL ON TABLE public.systems TO authenticated;
GRANT ALL ON TABLE public.systems TO service_role;


--
-- Name: TABLE team_invites; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.team_invites TO anon;
GRANT ALL ON TABLE public.team_invites TO authenticated;
GRANT ALL ON TABLE public.team_invites TO service_role;


--
-- Name: TABLE test_configs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.test_configs TO anon;
GRANT ALL ON TABLE public.test_configs TO authenticated;
GRANT ALL ON TABLE public.test_configs TO service_role;


--
-- Name: TABLE test_frequency_config; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.test_frequency_config TO anon;
GRANT ALL ON TABLE public.test_frequency_config TO authenticated;
GRANT ALL ON TABLE public.test_frequency_config TO service_role;


--
-- Name: TABLE test_results; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.test_results TO anon;
GRANT ALL ON TABLE public.test_results TO authenticated;
GRANT ALL ON TABLE public.test_results TO service_role;


--
-- Name: TABLE test_statistics; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.test_statistics TO anon;
GRANT ALL ON TABLE public.test_statistics TO authenticated;
GRANT ALL ON TABLE public.test_statistics TO service_role;


--
-- Name: TABLE tool_access; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tool_access TO anon;
GRANT ALL ON TABLE public.tool_access TO authenticated;
GRANT ALL ON TABLE public.tool_access TO service_role;


--
-- Name: TABLE tool_access_archived; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tool_access_archived TO anon;
GRANT ALL ON TABLE public.tool_access_archived TO authenticated;
GRANT ALL ON TABLE public.tool_access_archived TO service_role;


--
-- Name: TABLE tool_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tool_settings TO anon;
GRANT ALL ON TABLE public.tool_settings TO authenticated;
GRANT ALL ON TABLE public.tool_settings TO service_role;


--
-- Name: TABLE tool_team_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tool_team_members TO anon;
GRANT ALL ON TABLE public.tool_team_members TO authenticated;
GRANT ALL ON TABLE public.tool_team_members TO service_role;


--
-- Name: TABLE tools; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tools TO anon;
GRANT ALL ON TABLE public.tools TO authenticated;
GRANT ALL ON TABLE public.tools TO service_role;


--
-- Name: TABLE transcript_versions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.transcript_versions TO anon;
GRANT ALL ON TABLE public.transcript_versions TO authenticated;
GRANT ALL ON TABLE public.transcript_versions TO service_role;


--
-- Name: TABLE usage_limits; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.usage_limits TO anon;
GRANT ALL ON TABLE public.usage_limits TO authenticated;
GRANT ALL ON TABLE public.usage_limits TO service_role;


--
-- Name: TABLE usage_records; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.usage_records TO anon;
GRANT ALL ON TABLE public.usage_records TO authenticated;
GRANT ALL ON TABLE public.usage_records TO service_role;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;


--
-- Name: TABLE verification_tokens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.verification_tokens TO anon;
GRANT ALL ON TABLE public.verification_tokens TO authenticated;
GRANT ALL ON TABLE public.verification_tokens TO service_role;


--
-- Name: TABLE voice_configs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.voice_configs TO anon;
GRANT ALL ON TABLE public.voice_configs TO authenticated;
GRANT ALL ON TABLE public.voice_configs TO service_role;


--
-- Name: TABLE voice_targets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.voice_targets TO anon;
GRANT ALL ON TABLE public.voice_targets TO authenticated;
GRANT ALL ON TABLE public.voice_targets TO service_role;


--
-- Name: TABLE webhook_configs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.webhook_configs TO anon;
GRANT ALL ON TABLE public.webhook_configs TO authenticated;
GRANT ALL ON TABLE public.webhook_configs TO service_role;


--
-- Name: TABLE webhook_deliveries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.webhook_deliveries TO anon;
GRANT ALL ON TABLE public.webhook_deliveries TO authenticated;
GRANT ALL ON TABLE public.webhook_deliveries TO service_role;


--
-- Name: TABLE webhook_subscriptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.webhook_subscriptions TO anon;
GRANT ALL ON TABLE public.webhook_subscriptions TO authenticated;
GRANT ALL ON TABLE public.webhook_subscriptions TO service_role;


--
-- Name: TABLE webrtc_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.webrtc_sessions TO anon;
GRANT ALL ON TABLE public.webrtc_sessions TO authenticated;
GRANT ALL ON TABLE public.webrtc_sessions TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON TABLE realtime.messages TO postgres;
GRANT ALL ON TABLE realtime.messages TO dashboard_user;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO anon;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO service_role;


--
-- Name: TABLE messages_2026_01_20; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.messages_2026_01_20 TO postgres;
GRANT ALL ON TABLE realtime.messages_2026_01_20 TO dashboard_user;


--
-- Name: TABLE messages_2026_01_21; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.messages_2026_01_21 TO postgres;
GRANT ALL ON TABLE realtime.messages_2026_01_21 TO dashboard_user;


--
-- Name: TABLE messages_2026_01_22; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.messages_2026_01_22 TO postgres;
GRANT ALL ON TABLE realtime.messages_2026_01_22 TO dashboard_user;


--
-- Name: TABLE messages_2026_01_23; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.messages_2026_01_23 TO postgres;
GRANT ALL ON TABLE realtime.messages_2026_01_23 TO dashboard_user;


--
-- Name: TABLE messages_2026_01_24; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.messages_2026_01_24 TO postgres;
GRANT ALL ON TABLE realtime.messages_2026_01_24 TO dashboard_user;


--
-- Name: TABLE messages_2026_01_25; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.messages_2026_01_25 TO postgres;
GRANT ALL ON TABLE realtime.messages_2026_01_25 TO dashboard_user;


--
-- Name: TABLE messages_2026_01_26; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.messages_2026_01_26 TO postgres;
GRANT ALL ON TABLE realtime.messages_2026_01_26 TO dashboard_user;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.schema_migrations TO postgres;
GRANT ALL ON TABLE realtime.schema_migrations TO dashboard_user;
GRANT SELECT ON TABLE realtime.schema_migrations TO anon;
GRANT SELECT ON TABLE realtime.schema_migrations TO authenticated;
GRANT SELECT ON TABLE realtime.schema_migrations TO service_role;
GRANT ALL ON TABLE realtime.schema_migrations TO supabase_realtime_admin;


--
-- Name: TABLE subscription; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON TABLE realtime.subscription TO postgres;
GRANT ALL ON TABLE realtime.subscription TO dashboard_user;
GRANT SELECT ON TABLE realtime.subscription TO anon;
GRANT SELECT ON TABLE realtime.subscription TO authenticated;
GRANT SELECT ON TABLE realtime.subscription TO service_role;
GRANT ALL ON TABLE realtime.subscription TO supabase_realtime_admin;


--
-- Name: SEQUENCE subscription_id_seq; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO postgres;
GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO dashboard_user;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO anon;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO service_role;
GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO supabase_realtime_admin;


--
-- Name: TABLE buckets; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

REVOKE ALL ON TABLE storage.buckets FROM supabase_storage_admin;
GRANT ALL ON TABLE storage.buckets TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON TABLE storage.buckets TO service_role;
GRANT ALL ON TABLE storage.buckets TO authenticated;
GRANT ALL ON TABLE storage.buckets TO anon;
GRANT ALL ON TABLE storage.buckets TO postgres WITH GRANT OPTION;


--
-- Name: TABLE buckets_analytics; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.buckets_analytics TO service_role;
GRANT ALL ON TABLE storage.buckets_analytics TO authenticated;
GRANT ALL ON TABLE storage.buckets_analytics TO anon;


--
-- Name: TABLE buckets_vectors; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT SELECT ON TABLE storage.buckets_vectors TO service_role;
GRANT SELECT ON TABLE storage.buckets_vectors TO authenticated;
GRANT SELECT ON TABLE storage.buckets_vectors TO anon;


--
-- Name: TABLE objects; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

REVOKE ALL ON TABLE storage.objects FROM supabase_storage_admin;
GRANT ALL ON TABLE storage.objects TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON TABLE storage.objects TO service_role;
GRANT ALL ON TABLE storage.objects TO authenticated;
GRANT ALL ON TABLE storage.objects TO anon;
GRANT ALL ON TABLE storage.objects TO postgres WITH GRANT OPTION;


--
-- Name: TABLE prefixes; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.prefixes TO service_role;
GRANT ALL ON TABLE storage.prefixes TO authenticated;
GRANT ALL ON TABLE storage.prefixes TO anon;


--
-- Name: TABLE s3_multipart_uploads; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.s3_multipart_uploads TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO anon;


--
-- Name: TABLE s3_multipart_uploads_parts; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.s3_multipart_uploads_parts TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO anon;


--
-- Name: TABLE vector_indexes; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT SELECT ON TABLE storage.vector_indexes TO service_role;
GRANT SELECT ON TABLE storage.vector_indexes TO authenticated;
GRANT SELECT ON TABLE storage.vector_indexes TO anon;


--
-- Name: TABLE secrets; Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.secrets TO service_role;


--
-- Name: TABLE decrypted_secrets; Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.decrypted_secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.decrypted_secrets TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON SEQUENCES TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON FUNCTIONS TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON TABLES TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: next_auth; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA next_auth GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA next_auth GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA next_auth GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: next_auth; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA next_auth GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA next_auth GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA next_auth GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO service_role;


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


ALTER EVENT TRIGGER issue_graphql_placeholder OWNER TO supabase_admin;

--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


ALTER EVENT TRIGGER issue_pg_cron_access OWNER TO supabase_admin;

--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


ALTER EVENT TRIGGER issue_pg_graphql_access OWNER TO supabase_admin;

--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


ALTER EVENT TRIGGER issue_pg_net_access OWNER TO supabase_admin;

--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


ALTER EVENT TRIGGER pgrst_ddl_watch OWNER TO supabase_admin;

--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


ALTER EVENT TRIGGER pgrst_drop_watch OWNER TO supabase_admin;

--
-- PostgreSQL database dump complete
--

\unrestrict P9DHBFghZRBxgrxgXZT1cCAIexb7osFLCegmPft7Hy994IfgINveeBv35WMCh3i

