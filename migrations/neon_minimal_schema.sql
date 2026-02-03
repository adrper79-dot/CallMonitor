-- Minimal Neon schema for CI/tests
-- Idempotent guards, only objects required by application tests.
-- Safe to run against a staging Neon branch.

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Organisations
CREATE TABLE IF NOT EXISTS organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  display_name text,
  created_at timestamptz DEFAULT now()
);

-- Org members
CREATE TABLE IF NOT EXISTS org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  created_at timestamptz DEFAULT now()
);

-- Attention policies (minimal)
CREATE TABLE IF NOT EXISTS attention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id),
  name text,
  is_enabled boolean DEFAULT true,
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Search documents / events (minimal)
CREATE TABLE IF NOT EXISTS search_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id),
  content text,
  version integer DEFAULT 1,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS search_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES search_documents(id) ON DELETE CASCADE,
  event_type text,
  payload jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Caller ID and Calls
CREATE TABLE IF NOT EXISTS caller_id_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id),
  number text,
  label text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id),
  from_number text,
  to_number text,
  started_at timestamptz,
  ended_at timestamptz,
  metadata jsonb DEFAULT '{}'
);

-- External entities and links
CREATE TABLE IF NOT EXISTS external_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id),
  name text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS external_entity_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_entity_id uuid REFERENCES external_entities(id) ON DELETE CASCADE,
  scheme text,
  identifier text
);

CREATE TABLE IF NOT EXISTS external_entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_entity_id uuid REFERENCES external_entities(id) ON DELETE CASCADE,
  linked_entity_id uuid,
  relation text
);

-- Audit / logs / CRM
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id),
  actor_id uuid,
  action text,
  meta jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id),
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- OAuth tokens (minimal)
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  provider text,
  token jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_search_documents_org_id ON search_documents(organisation_id);
CREATE INDEX IF NOT EXISTS idx_calls_org_id ON calls(organisation_id);

-- Minimal role placeholder (no-op if role exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user;
  END IF;
EXCEPTION WHEN others THEN
  -- ignore role creation errors in restrictive environments
  PERFORM 1;
END$$;

-- End of minimal schema
