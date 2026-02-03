-- ============================================================================
-- CRM CONNECTIVITY - OAuth Integration for HubSpot and Salesforce
-- Per SYSTEM_OF_RECORD_COMPLIANCE:
-- - CRMs are NON-AUTHORITATIVE
-- - Tokens encrypted at rest (service-role only)
-- - All sync operations auditable (append-only log)
-- - Evidence bundle links only (no raw mutable data)
-- ============================================================================

-- -----------------------------------------------------------------------------
-- integrations: CRM provider connections per organization
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.integrations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    
    -- Provider info
    provider text NOT NULL CHECK (provider IN ('hubspot', 'salesforce', 'zoho', 'pipedrive')),
    provider_account_id text,  -- External account ID from provider
    provider_account_name text,
    
    -- Status
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disconnected', 'error', 'expired')),
    error_message text,
    last_error_at timestamptz,
    
    -- Settings
    settings jsonb DEFAULT '{}'::jsonb,
    sync_enabled boolean NOT NULL DEFAULT true,
    
    -- Lifecycle
    connected_at timestamptz,
    disconnected_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    connected_by uuid,
    
    CONSTRAINT integrations_pkey PRIMARY KEY (id),
    CONSTRAINT integrations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
    CONSTRAINT integrations_connected_by_fkey FOREIGN KEY (connected_by) REFERENCES public.users(id),
    
    -- One active integration per provider per org
    CONSTRAINT integrations_unique_provider UNIQUE (organization_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integrations_org_id ON public.integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON public.integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON public.integrations(status);

-- -----------------------------------------------------------------------------
-- oauth_tokens: Encrypted token storage (server-only access)
-- Tokens encrypted with CRM_ENCRYPTION_KEY using v1:base64:hash format
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.oauth_tokens (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    integration_id uuid NOT NULL UNIQUE,
    
    -- Encrypted tokens (v1:base64:hash format)
    access_token_encrypted text NOT NULL,
    refresh_token_encrypted text,
    
    -- Token metadata
    token_type text DEFAULT 'Bearer',
    expires_at timestamptz,
    refresh_expires_at timestamptz,
    scopes text[],
    
    -- Provider-specific (e.g., Salesforce instance URL)
    instance_url text,
    
    -- Refresh tracking
    last_refreshed_at timestamptz,
    refresh_count integer NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT oauth_tokens_pkey PRIMARY KEY (id),
    CONSTRAINT oauth_tokens_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id) ON DELETE CASCADE
);

-- No index on encrypted columns (no searching)
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires ON public.oauth_tokens(expires_at);

-- -----------------------------------------------------------------------------
-- crm_object_links: Map calls to CRM objects (contacts, companies, deals)
-- Pulled from CRM - read-only references
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_object_links (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    integration_id uuid NOT NULL,
    
    -- Local reference
    call_id uuid NOT NULL,
    
    -- CRM object reference
    crm_object_type text NOT NULL CHECK (crm_object_type IN ('contact', 'company', 'deal', 'lead', 'account', 'opportunity')),
    crm_object_id text NOT NULL,
    crm_object_name text,
    crm_object_url text,
    
    -- Sync tracking
    synced_at timestamptz,
    sync_direction text NOT NULL CHECK (sync_direction IN ('inbound', 'outbound')),
    
    -- Lifecycle
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT crm_object_links_pkey PRIMARY KEY (id),
    CONSTRAINT crm_object_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
    CONSTRAINT crm_object_links_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id),
    CONSTRAINT crm_object_links_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id),
    
    -- Unique link per call + CRM object
    CONSTRAINT crm_object_links_unique UNIQUE (integration_id, call_id, crm_object_type, crm_object_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_object_links_org_id ON public.crm_object_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_object_links_call_id ON public.crm_object_links(call_id);
CREATE INDEX IF NOT EXISTS idx_crm_object_links_crm_object ON public.crm_object_links(crm_object_type, crm_object_id);

-- -----------------------------------------------------------------------------
-- crm_sync_log: Append-only audit trail for all CRM operations
-- Per SYSTEM_OF_RECORD_COMPLIANCE: All writes attributable
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_sync_log (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    integration_id uuid NOT NULL,
    
    -- Operation details
    operation text NOT NULL CHECK (operation IN (
        'oauth_connect', 'oauth_disconnect', 'oauth_refresh',
        'push_evidence', 'push_note', 'push_engagement',
        'pull_contact', 'pull_company', 'pull_deal',
        'link_object', 'unlink_object',
        'error', 'rate_limited'
    )),
    status text NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'rate_limited', 'skipped')),
    
    -- References
    call_id uuid,
    export_bundle_id uuid,  -- Reference to immutable evidence bundle
    crm_object_link_id uuid,
    
    -- Idempotency key for retry safety
    idempotency_key text,
    
    -- Request/Response (redacted sensitive data)
    request_summary jsonb,
    response_summary jsonb,
    error_details jsonb,
    
    -- Timestamps
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    
    -- Actor attribution (per ARCH_DOCS)
    triggered_by text NOT NULL CHECK (triggered_by IN ('user', 'system', 'webhook', 'scheduler')),
    triggered_by_user_id uuid,
    
    CONSTRAINT crm_sync_log_pkey PRIMARY KEY (id),
    CONSTRAINT crm_sync_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
    CONSTRAINT crm_sync_log_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id),
    CONSTRAINT crm_sync_log_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id),
    CONSTRAINT crm_sync_log_export_bundle_id_fkey FOREIGN KEY (export_bundle_id) REFERENCES public.call_export_bundles(id)
);

CREATE INDEX IF NOT EXISTS idx_crm_sync_log_org_id ON public.crm_sync_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_log_integration ON public.crm_sync_log(integration_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_log_call_id ON public.crm_sync_log(call_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_log_operation ON public.crm_sync_log(operation);
CREATE INDEX IF NOT EXISTS idx_crm_sync_log_started_at ON public.crm_sync_log(started_at);
CREATE INDEX IF NOT EXISTS idx_crm_sync_log_idempotency ON public.crm_sync_log(idempotency_key);

-- -----------------------------------------------------------------------------
-- IMMUTABILITY TRIGGERS for crm_sync_log (append-only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_crm_sync_log_update()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS crm_sync_log_immutable ON public.crm_sync_log;
CREATE TRIGGER crm_sync_log_immutable
    BEFORE UPDATE ON public.crm_sync_log
    FOR EACH ROW
    EXECUTE FUNCTION prevent_crm_sync_log_update();

CREATE OR REPLACE FUNCTION prevent_crm_sync_log_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'crm_sync_log is append-only. Deletes are not permitted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS crm_sync_log_no_delete ON public.crm_sync_log;
CREATE TRIGGER crm_sync_log_no_delete
    BEFORE DELETE ON public.crm_sync_log
    FOR EACH ROW
    EXECUTE FUNCTION prevent_crm_sync_log_delete();

-- -----------------------------------------------------------------------------
-- RLS POLICIES
-- -----------------------------------------------------------------------------

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_object_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sync_log ENABLE ROW LEVEL SECURITY;

-- integrations: Org members can read, admin/owner can modify
DROP POLICY IF EXISTS integrations_select_org ON public.integrations;
CREATE POLICY integrations_select_org ON public.integrations
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM public.org_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS integrations_insert_admin ON public.integrations;
CREATE POLICY integrations_insert_admin ON public.integrations
    FOR INSERT WITH CHECK (
        organization_id IN (SELECT organization_id FROM public.org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    );

DROP POLICY IF EXISTS integrations_update_admin ON public.integrations;
CREATE POLICY integrations_update_admin ON public.integrations
    FOR UPDATE USING (
        organization_id IN (SELECT organization_id FROM public.org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    );

DROP POLICY IF EXISTS integrations_delete_admin ON public.integrations;
CREATE POLICY integrations_delete_admin ON public.integrations
    FOR DELETE USING (
        organization_id IN (SELECT organization_id FROM public.org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    );

-- oauth_tokens: Service role only (no direct user access for security)
DROP POLICY IF EXISTS oauth_tokens_service_only ON public.oauth_tokens;
CREATE POLICY oauth_tokens_service_only ON public.oauth_tokens
    FOR ALL USING (false);  -- Only service role can access via supabaseAdmin

-- crm_object_links: Org members can read
DROP POLICY IF EXISTS crm_object_links_select_org ON public.crm_object_links;
CREATE POLICY crm_object_links_select_org ON public.crm_object_links
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM public.org_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS crm_object_links_insert_service ON public.crm_object_links;
CREATE POLICY crm_object_links_insert_service ON public.crm_object_links
    FOR INSERT WITH CHECK (true);

-- crm_sync_log: Org members can read audit trail
DROP POLICY IF EXISTS crm_sync_log_select_org ON public.crm_sync_log;
CREATE POLICY crm_sync_log_select_org ON public.crm_sync_log
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM public.org_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS crm_sync_log_insert_service ON public.crm_sync_log;
CREATE POLICY crm_sync_log_insert_service ON public.crm_sync_log
    FOR INSERT WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- COMMENTS
-- -----------------------------------------------------------------------------
COMMENT ON TABLE public.integrations IS 'CRM OAuth connections. Platform-owner registers OAuth apps, customers just authorize.';
COMMENT ON TABLE public.oauth_tokens IS 'Encrypted OAuth tokens. Service role access only. Never expose to client.';
COMMENT ON TABLE public.crm_object_links IS 'Maps calls to CRM contacts/companies/deals. Read-only references from CRM.';
COMMENT ON TABLE public.crm_sync_log IS 'Append-only audit trail for all CRM operations. Idempotency keys for retry safety.';
COMMENT ON COLUMN public.oauth_tokens.access_token_encrypted IS 'Encrypted with CRM_ENCRYPTION_KEY. Format: v1:base64:hash';
