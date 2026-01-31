-- Enterprise SSO Configuration Tables
-- Phase 2: Enterprise Readiness - SSO/SAML Implementation
-- Migration: 20260118_org_sso_configs
--
-- Purpose: Per-organization SSO/SAML configuration for Enterprise customers
-- Supports: Okta SAML, Azure AD, Google Workspace, Custom SAML providers

-- =============================================================================
-- ORG SSO CONFIGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.org_sso_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- SSO Provider Configuration
  provider_type text NOT NULL CHECK (provider_type IN ('saml', 'oidc', 'azure_ad', 'okta', 'google_workspace')),
  provider_name text NOT NULL,                           -- Display name (e.g., "Corporate Okta")
  is_enabled boolean DEFAULT false,
  
  -- SAML Configuration
  saml_entity_id text,                                   -- Identity Provider Entity ID
  saml_sso_url text,                                     -- SSO Login URL
  saml_slo_url text,                                     -- Single Logout URL (optional)
  saml_certificate text,                                 -- X.509 Certificate (PEM format)
  saml_signature_algorithm text DEFAULT 'sha256',        -- Signature algorithm
  saml_name_id_format text DEFAULT 'emailAddress',       -- NameID format
  
  -- OIDC Configuration (for Azure AD, Google Workspace, custom OIDC)
  oidc_client_id text,
  oidc_client_secret_encrypted text,                     -- Encrypted client secret
  oidc_issuer_url text,                                  -- Issuer URL for auto-discovery
  oidc_authorization_url text,                           -- Override: Authorization endpoint
  oidc_token_url text,                                   -- Override: Token endpoint
  oidc_userinfo_url text,                                -- Override: UserInfo endpoint
  oidc_scopes text[] DEFAULT ARRAY['openid', 'email', 'profile'],
  
  -- Domain Verification
  verified_domains text[] DEFAULT '{}',                  -- List of verified email domains
  auto_provision_users boolean DEFAULT true,             -- Auto-create users on first SSO login
  default_role text DEFAULT 'member',                    -- Default role for auto-provisioned users
  
  -- Security Settings
  require_sso boolean DEFAULT false,                     -- Block password auth for org users
  allow_idp_initiated boolean DEFAULT true,              -- Allow IdP-initiated SSO
  session_duration_hours integer DEFAULT 24,             -- SSO session duration
  
  -- Attribute Mapping (SAML attributes → user fields)
  attribute_mapping jsonb DEFAULT '{
    "email": "email",
    "name": "displayName",
    "given_name": "firstName",
    "family_name": "lastName",
    "groups": "groups"
  }'::jsonb,
  
  -- Group Mapping (IdP groups → app roles)
  group_mapping jsonb DEFAULT '{}',                      -- e.g., {"Admins": "admin", "Users": "member"}
  
  -- Audit Fields
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.users(id),
  updated_at timestamptz DEFAULT now(),
  last_login_at timestamptz,
  login_count integer DEFAULT 0,
  
  -- Unique constraint: one config per provider per org
  CONSTRAINT unique_org_provider UNIQUE (organization_id, provider_type)
);

-- Enable RLS
ALTER TABLE public.org_sso_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  -- Admins can view SSO configs for their org
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_sso_configs' AND policyname = 'Org admins can view SSO configs') THEN
    CREATE POLICY "Org admins can view SSO configs"
      ON public.org_sso_configs FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM public.org_members 
          WHERE auth.user_equals_auth(user_id::text) AND role IN ('owner', 'admin')
        )
      );
  END IF;

  -- Only owners can insert SSO configs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_sso_configs' AND policyname = 'Org owners can create SSO configs') THEN
    CREATE POLICY "Org owners can create SSO configs"
      ON public.org_sso_configs FOR INSERT
      WITH CHECK (
        organization_id IN (
          SELECT organization_id FROM public.org_members 
          WHERE auth.user_equals_auth(user_id::text) AND role = 'owner'
        )
      );
  END IF;

  -- Only owners can update SSO configs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_sso_configs' AND policyname = 'Org owners can update SSO configs') THEN
    CREATE POLICY "Org owners can update SSO configs"
      ON public.org_sso_configs FOR UPDATE
      USING (
        organization_id IN (
          SELECT organization_id FROM public.org_members 
          WHERE auth.user_equals_auth(user_id::text) AND role = 'owner'
        )
      );
  END IF;

  -- Only owners can delete SSO configs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_sso_configs' AND policyname = 'Org owners can delete SSO configs') THEN
    CREATE POLICY "Org owners can delete SSO configs"
      ON public.org_sso_configs FOR DELETE
      USING (
        organization_id IN (
          SELECT organization_id FROM public.org_members 
          WHERE auth.user_equals_auth(user_id::text) AND role = 'owner'
        )
      );
  END IF;
END $$;

-- =============================================================================
-- SSO LOGIN EVENTS TABLE (Audit Trail)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sso_login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sso_config_id uuid NOT NULL REFERENCES public.org_sso_configs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id),
  
  -- Event Details
  event_type text NOT NULL CHECK (event_type IN ('login_success', 'login_failure', 'logout', 'token_refresh')),
  idp_subject text,                                      -- Subject identifier from IdP
  idp_session_id text,                                   -- Session ID from IdP
  
  -- User Info from IdP
  email text,
  name text,
  groups text[],
  raw_claims jsonb,                                      -- Full claims/attributes (sanitized)
  
  -- Request Context
  ip_address inet,
  user_agent text,
  
  -- Error Details (for failures)
  error_code text,
  error_message text,
  
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sso_login_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for SSO events
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sso_login_events' AND policyname = 'Org admins can view SSO events') THEN
    CREATE POLICY "Org admins can view SSO events"
      ON public.sso_login_events FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM public.org_members 
          WHERE auth.user_equals_auth(user_id::text) AND role IN ('owner', 'admin')
        )
      );
  END IF;
END $$;

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_org_sso_configs_org_id ON public.org_sso_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_sso_configs_provider ON public.org_sso_configs(provider_type);
CREATE INDEX IF NOT EXISTS idx_org_sso_configs_enabled ON public.org_sso_configs(is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_org_sso_configs_domains ON public.org_sso_configs USING gin(verified_domains);

CREATE INDEX IF NOT EXISTS idx_sso_login_events_org_id ON public.sso_login_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_sso_login_events_user_id ON public.sso_login_events(user_id);
CREATE INDEX IF NOT EXISTS idx_sso_login_events_created_at ON public.sso_login_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sso_login_events_config_id ON public.sso_login_events(sso_config_id);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to check if SSO is required for a given email domain
CREATE OR REPLACE FUNCTION check_sso_required(email_address text)
RETURNS TABLE (
  sso_required boolean,
  sso_config_id uuid,
  organization_id uuid,
  provider_type text,
  sso_url text
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record SSO login attempt
CREATE OR REPLACE FUNCTION record_sso_login(
  p_sso_config_id uuid,
  p_event_type text,
  p_email text,
  p_name text DEFAULT NULL,
  p_groups text[] DEFAULT NULL,
  p_idp_subject text DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_raw_claims jsonb DEFAULT NULL
)
RETURNS uuid AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE public.org_sso_configs IS 'Enterprise SSO configuration per organization. Supports SAML 2.0 (Okta, custom) and OIDC (Azure AD, Google Workspace).';
COMMENT ON TABLE public.sso_login_events IS 'Audit trail for SSO login attempts (success and failure).';
COMMENT ON FUNCTION check_sso_required IS 'Check if SSO is required for a given email domain. Returns SSO config if found.';
COMMENT ON FUNCTION record_sso_login IS 'Record an SSO login event. Auto-provisions user if enabled.';

