-- ============================================================================
-- RETURN-TRAFFIC INTELLIGENCE (RTI) LAYER
-- Per LAW-RTI and SYSTEM_OF_RECORD_COMPLIANCE:
-- - Append-only tables (no updates/deletes on decisions)
-- - Human-authored policies control routing
-- - All decisions include provenance (input_refs, produced_by)
-- - Never mutates canonical artifacts
-- ============================================================================

-- -----------------------------------------------------------------------------
-- attention_policies: Human-authored routing rules
-- Control quiet hours, thresholds, recurring suppression
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attention_policies (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    
    -- Policy definition
    name text NOT NULL,
    description text,
    policy_type text NOT NULL CHECK (policy_type IN (
        'quiet_hours',           -- Suppress during specific hours
        'threshold',             -- Escalate only above threshold
        'recurring_suppress',    -- Suppress known recurring events
        'keyword_escalate',      -- Escalate if keywords match
        'custom'                 -- Custom rule logic
    )),
    policy_config jsonb NOT NULL DEFAULT '{}',
    
    -- Ordering
    priority integer NOT NULL DEFAULT 100,  -- Lower = evaluated first
    
    -- Lifecycle
    is_enabled boolean NOT NULL DEFAULT true,
    
    -- Audit
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT attention_policies_pkey PRIMARY KEY (id),
    CONSTRAINT attention_policies_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
    CONSTRAINT attention_policies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_attention_policies_org ON public.attention_policies(organization_id);
CREATE INDEX IF NOT EXISTS idx_attention_policies_priority ON public.attention_policies(organization_id, priority) WHERE is_enabled = true;

-- -----------------------------------------------------------------------------
-- attention_events: Normalized return traffic stream (append-only)
-- Every significant event from canonical sources
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attention_events (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    
    -- Event classification
    event_type text NOT NULL CHECK (event_type IN (
        'call_completed',
        'alert_triggered',
        'webhook_failed',
        'carrier_degraded',
        'campaign_ended',
        'evidence_generated',
        'system_error'
    )),
    
    -- Source reference (canonical artifact)
    source_table text NOT NULL,
    source_id uuid NOT NULL,
    
    -- Event timing
    occurred_at timestamptz NOT NULL,
    
    -- Immutable snapshot for explainability
    payload_snapshot jsonb NOT NULL DEFAULT '{}',
    
    -- Provenance: references to canonical artifacts this event derives from
    input_refs jsonb NOT NULL DEFAULT '[]',  -- Array of {table, id} pairs
    
    -- Server timestamp
    created_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT attention_events_pkey PRIMARY KEY (id),
    CONSTRAINT attention_events_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_attention_events_org ON public.attention_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_attention_events_type ON public.attention_events(event_type);
CREATE INDEX IF NOT EXISTS idx_attention_events_occurred_at ON public.attention_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attention_events_source ON public.attention_events(source_table, source_id);

-- -----------------------------------------------------------------------------
-- attention_decisions: Escalate/Suppress judgments (append-only)
-- Every decision includes reason + provenance
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attention_decisions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    
    -- Reference to event being decided
    attention_event_id uuid NOT NULL,
    
    -- Decision outcome
    decision text NOT NULL CHECK (decision IN (
        'escalate',           -- Needs immediate attention
        'suppress',           -- Safe to ignore
        'include_in_digest',  -- Include in next digest
        'needs_review'        -- Ambiguous, requires human
    )),
    
    -- Explainability (required per LAW RTI-04)
    reason text NOT NULL,  -- Human-readable explanation
    policy_id uuid,        -- Which policy triggered this (if any)
    
    -- Confidence assessment
    confidence integer CHECK (confidence >= 0 AND confidence <= 100),
    uncertainty_notes text,
    
    -- Attribution (required per LAW RTI-03)
    produced_by text NOT NULL CHECK (produced_by IN ('system', 'human', 'model')),
    produced_by_model text,  -- e.g., 'gemini-2.0-flash' if model
    produced_by_user_id uuid,  -- If human override
    
    -- Provenance: canonical refs this decision was based on
    input_refs jsonb NOT NULL DEFAULT '[]',
    
    -- Server timestamp
    created_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT attention_decisions_pkey PRIMARY KEY (id),
    CONSTRAINT attention_decisions_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
    CONSTRAINT attention_decisions_event_fkey FOREIGN KEY (attention_event_id) REFERENCES public.attention_events(id),
    CONSTRAINT attention_decisions_policy_fkey FOREIGN KEY (policy_id) REFERENCES public.attention_policies(id),
    CONSTRAINT attention_decisions_user_fkey FOREIGN KEY (produced_by_user_id) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_attention_decisions_org ON public.attention_decisions(organization_id);
CREATE INDEX IF NOT EXISTS idx_attention_decisions_event ON public.attention_decisions(attention_event_id);
CREATE INDEX IF NOT EXISTS idx_attention_decisions_decision ON public.attention_decisions(decision);
CREATE INDEX IF NOT EXISTS idx_attention_decisions_created_at ON public.attention_decisions(created_at DESC);

-- -----------------------------------------------------------------------------
-- digests: Overnight/periodic summaries (append-only)
-- "Nothing woke you up because nothing important happened"
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.digests (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    
    -- Digest classification
    digest_type text NOT NULL CHECK (digest_type IN ('overnight', 'weekly', 'on_demand')),
    
    -- Time range covered
    period_start timestamptz NOT NULL,
    period_end timestamptz NOT NULL,
    
    -- Summary content
    summary_text text NOT NULL,  -- "3 calls completed, 1 escalation, 15 suppressed"
    
    -- Statistics
    total_events integer NOT NULL DEFAULT 0,
    escalated_count integer NOT NULL DEFAULT 0,
    suppressed_count integer NOT NULL DEFAULT 0,
    needs_review_count integer NOT NULL DEFAULT 0,
    
    -- Generation metadata
    generated_at timestamptz NOT NULL DEFAULT now(),
    generated_by text NOT NULL DEFAULT 'system',  -- 'system' or 'user-triggered'
    generated_by_user_id uuid,
    
    CONSTRAINT digests_pkey PRIMARY KEY (id),
    CONSTRAINT digests_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
    CONSTRAINT digests_user_fkey FOREIGN KEY (generated_by_user_id) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_digests_org ON public.digests(organization_id);
CREATE INDEX IF NOT EXISTS idx_digests_generated_at ON public.digests(generated_at DESC);

-- -----------------------------------------------------------------------------
-- digest_items: Individual items in a digest
-- Links to decisions with ordering
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.digest_items (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    digest_id uuid NOT NULL,
    
    -- Reference to decision
    attention_decision_id uuid NOT NULL,
    
    -- Ordering within digest
    item_order integer NOT NULL,
    
    -- Highlighting
    is_highlighted boolean NOT NULL DEFAULT false,
    highlight_reason text,
    
    CONSTRAINT digest_items_pkey PRIMARY KEY (id),
    CONSTRAINT digest_items_digest_fkey FOREIGN KEY (digest_id) REFERENCES public.digests(id),
    CONSTRAINT digest_items_decision_fkey FOREIGN KEY (attention_decision_id) REFERENCES public.attention_decisions(id)
);

CREATE INDEX IF NOT EXISTS idx_digest_items_digest ON public.digest_items(digest_id);

-- -----------------------------------------------------------------------------
-- IMMUTABILITY TRIGGERS (per LAW RTI-03)
-- attention_events, attention_decisions, digests are append-only
-- -----------------------------------------------------------------------------

-- Prevent updates on attention_events
CREATE OR REPLACE FUNCTION prevent_attention_event_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'attention_events is append-only. Updates not permitted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS attention_events_immutable ON public.attention_events;
CREATE TRIGGER attention_events_immutable
    BEFORE UPDATE ON public.attention_events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_attention_event_update();

-- Prevent deletes on attention_events
CREATE OR REPLACE FUNCTION prevent_attention_event_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'attention_events is append-only. Deletes not permitted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS attention_events_no_delete ON public.attention_events;
CREATE TRIGGER attention_events_no_delete
    BEFORE DELETE ON public.attention_events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_attention_event_delete();

-- Prevent updates on attention_decisions
CREATE OR REPLACE FUNCTION prevent_attention_decision_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'attention_decisions is append-only. Create new decision for overrides.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS attention_decisions_immutable ON public.attention_decisions;
CREATE TRIGGER attention_decisions_immutable
    BEFORE UPDATE ON public.attention_decisions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_attention_decision_update();

-- Prevent deletes on attention_decisions
CREATE OR REPLACE FUNCTION prevent_attention_decision_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'attention_decisions is append-only. Deletes not permitted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS attention_decisions_no_delete ON public.attention_decisions;
CREATE TRIGGER attention_decisions_no_delete
    BEFORE DELETE ON public.attention_decisions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_attention_decision_delete();

-- Prevent updates on digests
CREATE OR REPLACE FUNCTION prevent_digest_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'digests is append-only. Create new digest instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS digests_immutable ON public.digests;
CREATE TRIGGER digests_immutable
    BEFORE UPDATE ON public.digests
    FOR EACH ROW
    EXECUTE FUNCTION prevent_digest_update();

-- Prevent deletes on digests
CREATE OR REPLACE FUNCTION prevent_digest_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'digests is append-only. Deletes not permitted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS digests_no_delete ON public.digests;
CREATE TRIGGER digests_no_delete
    BEFORE DELETE ON public.digests
    FOR EACH ROW
    EXECUTE FUNCTION prevent_digest_delete();

-- -----------------------------------------------------------------------------
-- RLS POLICIES
-- -----------------------------------------------------------------------------

ALTER TABLE public.attention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attention_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attention_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digest_items ENABLE ROW LEVEL SECURITY;

-- attention_policies: Org members read, admin write
DROP POLICY IF EXISTS attention_policies_select_org ON public.attention_policies;
CREATE POLICY attention_policies_select_org ON public.attention_policies
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM public.org_members WHERE auth.user_equals_auth(user_id::text))
    );

DROP POLICY IF EXISTS attention_policies_insert_admin ON public.attention_policies;
CREATE POLICY attention_policies_insert_admin ON public.attention_policies
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.org_members 
            WHERE auth.user_equals_auth(user_id::text) AND role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS attention_policies_update_admin ON public.attention_policies;
CREATE POLICY attention_policies_update_admin ON public.attention_policies
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM public.org_members 
            WHERE auth.user_equals_auth(user_id::text) AND role IN ('owner', 'admin')
        )
    );

-- attention_events: Org members read, service role insert
DROP POLICY IF EXISTS attention_events_select_org ON public.attention_events;
CREATE POLICY attention_events_select_org ON public.attention_events
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM public.org_members WHERE auth.user_equals_auth(user_id::text))
    );

DROP POLICY IF EXISTS attention_events_insert_service ON public.attention_events;
CREATE POLICY attention_events_insert_service ON public.attention_events
    FOR INSERT WITH CHECK (true);

-- attention_decisions: Org members read, service role insert
DROP POLICY IF EXISTS attention_decisions_select_org ON public.attention_decisions;
CREATE POLICY attention_decisions_select_org ON public.attention_decisions
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM public.org_members WHERE auth.user_equals_auth(user_id::text))
    );

DROP POLICY IF EXISTS attention_decisions_insert_service ON public.attention_decisions;
CREATE POLICY attention_decisions_insert_service ON public.attention_decisions
    FOR INSERT WITH CHECK (true);

-- digests: Org members read, service role insert
DROP POLICY IF EXISTS digests_select_org ON public.digests;
CREATE POLICY digests_select_org ON public.digests
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM public.org_members WHERE auth.user_equals_auth(user_id::text))
    );

DROP POLICY IF EXISTS digests_insert_service ON public.digests;
CREATE POLICY digests_insert_service ON public.digests
    FOR INSERT WITH CHECK (true);

-- digest_items: Read via digest access
DROP POLICY IF EXISTS digest_items_select_org ON public.digest_items;
CREATE POLICY digest_items_select_org ON public.digest_items
    FOR SELECT USING (
        digest_id IN (
            SELECT id FROM public.digests d
            WHERE d.organization_id IN (
                SELECT organization_id FROM public.org_members WHERE auth.user_equals_auth(user_id::text)
            )
        )
    );

DROP POLICY IF EXISTS digest_items_insert_service ON public.digest_items;
CREATE POLICY digest_items_insert_service ON public.digest_items
    FOR INSERT WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- Comments
-- -----------------------------------------------------------------------------
COMMENT ON TABLE public.attention_policies IS 'Human-authored routing rules for attention events. Controls escalation/suppression.';
COMMENT ON TABLE public.attention_events IS 'Append-only stream of normalized return traffic from canonical sources.';
COMMENT ON TABLE public.attention_decisions IS 'Append-only judgments on events. Includes provenance and reason.';
COMMENT ON TABLE public.digests IS 'Periodic summaries (overnight, weekly). Append-only.';
COMMENT ON COLUMN public.attention_decisions.input_refs IS 'JSON array of {table, id} pairs referencing canonical artifacts.';
COMMENT ON COLUMN public.attention_decisions.produced_by IS 'Attribution: system (rules), human (override), or model (AI-assisted).';

