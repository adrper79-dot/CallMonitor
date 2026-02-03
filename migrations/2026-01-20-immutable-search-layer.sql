-- ============================================================================
-- IMMUTABLE SEARCH LAYER
-- Per SYSTEM_OF_RECORD_COMPLIANCE:
-- - Append-only tables (no updates/deletes)
-- - Versioned documents
-- - Server timestamps only
-- - All writes auditable
-- ============================================================================

-- -----------------------------------------------------------------------------
-- search_documents: Versioned search documents
-- Each rebuild creates new versions; old versions remain for audit trail
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.search_documents (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    
    -- Source reference (links to canonical data)
    source_type text NOT NULL CHECK (source_type IN ('call', 'recording', 'transcript', 'evidence', 'note')),
    source_id uuid NOT NULL,
    
    -- Version tracking (append-only pattern)
    version integer NOT NULL DEFAULT 1,
    is_current boolean NOT NULL DEFAULT true,
    superseded_by uuid,
    
    -- Searchable content
    title text,
    content text NOT NULL,
    content_hash text NOT NULL,  -- SHA256 for integrity
    
    -- Searchable metadata (denormalized for filtering)
    call_id uuid,
    phone_number text,
    domain text,
    tags text[],
    
    -- Timestamps (server-side only)
    source_created_at timestamptz,
    indexed_at timestamptz NOT NULL DEFAULT now(),
    
    -- Provenance
    indexed_by text NOT NULL DEFAULT 'system',
    indexed_by_user_id uuid,
    
    CONSTRAINT search_documents_pkey PRIMARY KEY (id),
    CONSTRAINT search_documents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
    CONSTRAINT search_documents_indexed_by_user_id_fkey FOREIGN KEY (indexed_by_user_id) REFERENCES public.users(id),
    CONSTRAINT search_documents_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.search_documents(id)
);

-- Unique constraint on current version per source
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_documents_current 
    ON public.search_documents(organization_id, source_type, source_id) 
    WHERE is_current = true;

-- Indexes for common filters
CREATE INDEX IF NOT EXISTS idx_search_documents_org_id ON public.search_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_search_documents_call_id ON public.search_documents(call_id);
CREATE INDEX IF NOT EXISTS idx_search_documents_phone ON public.search_documents(phone_number);
CREATE INDEX IF NOT EXISTS idx_search_documents_domain ON public.search_documents(domain);
CREATE INDEX IF NOT EXISTS idx_search_documents_indexed_at ON public.search_documents(indexed_at);
CREATE INDEX IF NOT EXISTS idx_search_documents_source ON public.search_documents(source_type, source_id);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_search_documents_fts ON public.search_documents 
    USING gin(to_tsvector('english', coalesce(title, '') || ' ' || content));

-- -----------------------------------------------------------------------------
-- search_events: Append-only index write log (audit trail)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.search_events (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    
    -- Event type
    event_type text NOT NULL CHECK (event_type IN ('indexed', 'reindexed', 'rebuild_started', 'rebuild_completed')),
    
    -- References
    document_id uuid,
    source_type text,
    source_id uuid,
    
    -- Metadata
    metadata jsonb,
    
    -- Timestamps (server-side only)
    created_at timestamptz NOT NULL DEFAULT now(),
    
    -- Actor attribution
    actor_type text NOT NULL CHECK (actor_type IN ('system', 'human', 'automation')),
    actor_id uuid,
    actor_label text,
    
    CONSTRAINT search_events_pkey PRIMARY KEY (id),
    CONSTRAINT search_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
    CONSTRAINT search_events_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.search_documents(id)
);

CREATE INDEX IF NOT EXISTS idx_search_events_org_id ON public.search_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_search_events_created_at ON public.search_events(created_at);
CREATE INDEX IF NOT EXISTS idx_search_events_document_id ON public.search_events(document_id);

-- -----------------------------------------------------------------------------
-- IMMUTABILITY TRIGGERS
-- Prevent updates/deletes on search tables (append-only pattern)
-- -----------------------------------------------------------------------------

-- Prevent updates on search_documents (except is_current and superseded_by for version chain)
CREATE OR REPLACE FUNCTION prevent_search_document_update()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS search_documents_immutable ON public.search_documents;
CREATE TRIGGER search_documents_immutable
    BEFORE UPDATE ON public.search_documents
    FOR EACH ROW
    EXECUTE FUNCTION prevent_search_document_update();

-- Prevent deletes on search_documents
CREATE OR REPLACE FUNCTION prevent_search_document_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'search_documents is append-only. Deletes are not permitted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS search_documents_no_delete ON public.search_documents;
CREATE TRIGGER search_documents_no_delete
    BEFORE DELETE ON public.search_documents
    FOR EACH ROW
    EXECUTE FUNCTION prevent_search_document_delete();

-- Prevent updates on search_events (fully immutable)
CREATE OR REPLACE FUNCTION prevent_search_event_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'search_events is immutable. Updates are not permitted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS search_events_immutable ON public.search_events;
CREATE TRIGGER search_events_immutable
    BEFORE UPDATE ON public.search_events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_search_event_update();

-- Prevent deletes on search_events
CREATE OR REPLACE FUNCTION prevent_search_event_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'search_events is append-only. Deletes are not permitted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS search_events_no_delete ON public.search_events;
CREATE TRIGGER search_events_no_delete
    BEFORE DELETE ON public.search_events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_search_event_delete();

-- -----------------------------------------------------------------------------
-- RLS POLICIES (org-scoped visibility)
-- -----------------------------------------------------------------------------

ALTER TABLE public.search_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_events ENABLE ROW LEVEL SECURITY;

-- search_documents: Users can only see their org's documents
DROP POLICY IF EXISTS search_documents_select_org ON public.search_documents;
CREATE POLICY search_documents_select_org ON public.search_documents
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.org_members 
            WHERE user_id = auth.uid()
        )
    );

-- search_documents: Only service role can insert
DROP POLICY IF EXISTS search_documents_insert_service ON public.search_documents;
CREATE POLICY search_documents_insert_service ON public.search_documents
    FOR INSERT WITH CHECK (true);

-- search_events: Users can only see their org's events
DROP POLICY IF EXISTS search_events_select_org ON public.search_events;
CREATE POLICY search_events_select_org ON public.search_events
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.org_members 
            WHERE user_id = auth.uid()
        )
    );

-- search_events: Only service role can insert
DROP POLICY IF EXISTS search_events_insert_service ON public.search_events;
CREATE POLICY search_events_insert_service ON public.search_events
    FOR INSERT WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE public.search_documents IS 'Non-authoritative, append-only search index. Use canonical tables for source of truth.';
COMMENT ON TABLE public.search_events IS 'Append-only audit log for search index operations.';
COMMENT ON COLUMN public.search_documents.version IS 'Monotonically increasing version per source. Old versions retained for audit trail.';
COMMENT ON COLUMN public.search_documents.is_current IS 'True for latest version. Previous versions have is_current=false.';
