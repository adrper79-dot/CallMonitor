-- ============================================================================
-- EXTERNAL ENTITY OVERLAY
-- Per SYSTEM_OF_RECORD_COMPLIANCE:
-- - Org-scoped (absolute tenant isolation)
-- - Observed ≠ Asserted (no silent merges)
-- - Human-attributed linking with audit trail
-- - Append-only observations
-- ============================================================================

-- -----------------------------------------------------------------------------
-- external_entities: Org-scoped entity records
-- Represents a single external party (person, company, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.external_entities (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    
    -- Display info (can be updated by admins)
    display_name text,
    entity_type text NOT NULL DEFAULT 'contact' CHECK (entity_type IN ('contact', 'company', 'location', 'other')),
    
    -- Metadata
    notes text,
    tags text[],
    metadata jsonb DEFAULT '{}'::jsonb,
    
    -- Lifecycle
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    
    CONSTRAINT external_entities_pkey PRIMARY KEY (id),
    CONSTRAINT external_entities_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
    CONSTRAINT external_entities_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_external_entities_org_id ON public.external_entities(organization_id);
CREATE INDEX IF NOT EXISTS idx_external_entities_type ON public.external_entities(entity_type);

-- -----------------------------------------------------------------------------
-- external_entity_identifiers: Observed identifiers (phone, email, etc.)
-- Each identifier belongs to exactly one entity within an org
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.external_entity_identifiers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    entity_id uuid,  -- NULL until linked to an entity
    
    -- Identifier info
    identifier_type text NOT NULL CHECK (identifier_type IN ('phone', 'email_domain', 'email', 'crm_object', 'other')),
    identifier_value text NOT NULL,
    identifier_normalized text NOT NULL,  -- E.164 for phone, lowercase for email
    
    -- Observation tracking
    first_observed_at timestamptz NOT NULL DEFAULT now(),
    last_observed_at timestamptz NOT NULL DEFAULT now(),
    observation_count integer NOT NULL DEFAULT 1,
    
    -- Source tracking
    first_observed_source text,  -- 'call', 'target', 'campaign', 'manual'
    first_observed_source_id uuid,
    
    -- Lifecycle
    is_verified boolean NOT NULL DEFAULT false,
    verified_at timestamptz,
    verified_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT external_entity_identifiers_pkey PRIMARY KEY (id),
    CONSTRAINT external_entity_identifiers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
    CONSTRAINT external_entity_identifiers_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.external_entities(id),
    CONSTRAINT external_entity_identifiers_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id),
    
    -- Unique identifier per org (no cross-org dedup)
    CONSTRAINT external_entity_identifiers_unique UNIQUE (organization_id, identifier_type, identifier_normalized)
);

CREATE INDEX IF NOT EXISTS idx_external_entity_identifiers_org_id ON public.external_entity_identifiers(organization_id);
CREATE INDEX IF NOT EXISTS idx_external_entity_identifiers_entity_id ON public.external_entity_identifiers(entity_id);
CREATE INDEX IF NOT EXISTS idx_external_entity_identifiers_value ON public.external_entity_identifiers(identifier_normalized);
CREATE INDEX IF NOT EXISTS idx_external_entity_identifiers_type ON public.external_entity_identifiers(identifier_type);

-- -----------------------------------------------------------------------------
-- external_entity_observations: Append-only log of identifier sightings
-- Every time an identifier is seen in a call, log it here
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.external_entity_observations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    identifier_id uuid NOT NULL,
    
    -- Source reference
    source_type text NOT NULL CHECK (source_type IN ('call', 'target', 'campaign_call', 'booking', 'manual')),
    source_id uuid NOT NULL,
    
    -- Observation context
    role text CHECK (role IN ('caller', 'callee', 'participant', 'target', 'other')),
    direction text CHECK (direction IN ('inbound', 'outbound')),
    
    -- Timestamp (server-side only)
    observed_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT external_entity_observations_pkey PRIMARY KEY (id),
    CONSTRAINT external_entity_observations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
    CONSTRAINT external_entity_observations_identifier_id_fkey FOREIGN KEY (identifier_id) REFERENCES public.external_entity_identifiers(id)
);

CREATE INDEX IF NOT EXISTS idx_external_entity_observations_org_id ON public.external_entity_observations(organization_id);
CREATE INDEX IF NOT EXISTS idx_external_entity_observations_identifier_id ON public.external_entity_observations(identifier_id);
CREATE INDEX IF NOT EXISTS idx_external_entity_observations_source ON public.external_entity_observations(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_external_entity_observations_observed_at ON public.external_entity_observations(observed_at);

-- -----------------------------------------------------------------------------
-- external_entity_links: Human assertions linking entities/identifiers
-- All links are human-attributed and auditable
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.external_entity_links (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    
    -- Link type
    link_type text NOT NULL CHECK (link_type IN (
        'identifier_to_entity',  -- Link identifier to entity
        'entity_merge',          -- Merge two entities (source -> target)
        'entity_split',          -- Split entity (creates new entity)
        'identifier_transfer'    -- Move identifier to different entity
    )),
    
    -- References (depends on link_type)
    source_entity_id uuid,
    target_entity_id uuid,
    identifier_id uuid,
    
    -- Human attribution (required)
    created_by uuid NOT NULL,
    reason text,
    
    -- Lifecycle (append-only, but can be revoked)
    is_active boolean NOT NULL DEFAULT true,
    revoked_at timestamptz,
    revoked_by uuid,
    revoke_reason text,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT external_entity_links_pkey PRIMARY KEY (id),
    CONSTRAINT external_entity_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
    CONSTRAINT external_entity_links_source_entity_id_fkey FOREIGN KEY (source_entity_id) REFERENCES public.external_entities(id),
    CONSTRAINT external_entity_links_target_entity_id_fkey FOREIGN KEY (target_entity_id) REFERENCES public.external_entities(id),
    CONSTRAINT external_entity_links_identifier_id_fkey FOREIGN KEY (identifier_id) REFERENCES public.external_entity_identifiers(id),
    CONSTRAINT external_entity_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id),
    CONSTRAINT external_entity_links_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_external_entity_links_org_id ON public.external_entity_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_external_entity_links_source_entity ON public.external_entity_links(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_external_entity_links_target_entity ON public.external_entity_links(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_external_entity_links_identifier ON public.external_entity_links(identifier_id);

-- -----------------------------------------------------------------------------
-- IMMUTABILITY TRIGGER for observations (append-only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_observation_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'external_entity_observations is append-only. Updates not permitted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS external_entity_observations_immutable ON public.external_entity_observations;
CREATE TRIGGER external_entity_observations_immutable
    BEFORE UPDATE ON public.external_entity_observations
    FOR EACH ROW
    EXECUTE FUNCTION prevent_observation_update();

CREATE OR REPLACE FUNCTION prevent_observation_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'external_entity_observations is append-only. Deletes not permitted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS external_entity_observations_no_delete ON public.external_entity_observations;
CREATE TRIGGER external_entity_observations_no_delete
    BEFORE DELETE ON public.external_entity_observations
    FOR EACH ROW
    EXECUTE FUNCTION prevent_observation_delete();

-- -----------------------------------------------------------------------------
-- RLS POLICIES (org-scoped visibility)
-- -----------------------------------------------------------------------------

ALTER TABLE public.external_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_entity_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_entity_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_entity_links ENABLE ROW LEVEL SECURITY;

-- external_entities: Org members can read
DROP POLICY IF EXISTS external_entities_select_org ON public.external_entities;
CREATE POLICY external_entities_select_org ON public.external_entities
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.org_members WHERE user_id = auth.uid()
        )
    );

-- external_entities: Admin/owner can insert/update
DROP POLICY IF EXISTS external_entities_insert_admin ON public.external_entities;
CREATE POLICY external_entities_insert_admin ON public.external_entities
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.org_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS external_entities_update_admin ON public.external_entities;
CREATE POLICY external_entities_update_admin ON public.external_entities
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM public.org_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- external_entity_identifiers: Org members can read
DROP POLICY IF EXISTS external_entity_identifiers_select_org ON public.external_entity_identifiers;
CREATE POLICY external_entity_identifiers_select_org ON public.external_entity_identifiers
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.org_members WHERE user_id = auth.uid()
        )
    );

-- external_entity_identifiers: Service role can insert (from derivation jobs)
DROP POLICY IF EXISTS external_entity_identifiers_insert_service ON public.external_entity_identifiers;
CREATE POLICY external_entity_identifiers_insert_service ON public.external_entity_identifiers
    FOR INSERT WITH CHECK (true);

-- Updates allowed for linking to entity
DROP POLICY IF EXISTS external_entity_identifiers_update_admin ON public.external_entity_identifiers;
CREATE POLICY external_entity_identifiers_update_admin ON public.external_entity_identifiers
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM public.org_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- external_entity_observations: Org members can read
DROP POLICY IF EXISTS external_entity_observations_select_org ON public.external_entity_observations;
CREATE POLICY external_entity_observations_select_org ON public.external_entity_observations
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.org_members WHERE user_id = auth.uid()
        )
    );

-- external_entity_observations: Service role can insert
DROP POLICY IF EXISTS external_entity_observations_insert_service ON public.external_entity_observations;
CREATE POLICY external_entity_observations_insert_service ON public.external_entity_observations
    FOR INSERT WITH CHECK (true);

-- external_entity_links: Org members can read
DROP POLICY IF EXISTS external_entity_links_select_org ON public.external_entity_links;
CREATE POLICY external_entity_links_select_org ON public.external_entity_links
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.org_members WHERE user_id = auth.uid()
        )
    );

-- external_entity_links: Only admin/owner can create links
DROP POLICY IF EXISTS external_entity_links_insert_admin ON public.external_entity_links;
CREATE POLICY external_entity_links_insert_admin ON public.external_entity_links
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.org_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Comments
COMMENT ON TABLE public.external_entities IS 'Org-scoped external party records. No cross-org visibility.';
COMMENT ON TABLE public.external_entity_identifiers IS 'Observed identifiers (phone, email). Unique per org.';
COMMENT ON TABLE public.external_entity_observations IS 'Append-only log of identifier sightings from calls.';
COMMENT ON TABLE public.external_entity_links IS 'Human-attributed assertions linking entities/identifiers. Auditable.';
