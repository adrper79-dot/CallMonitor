-- ============================================================================
-- GOVERNED CALLER ID + NUMBER ASSIGNMENT
-- Per SYSTEM_OF_RECORD_COMPLIANCE:
-- - Explicit caller ID choice recorded per call
-- - User-level permissions (not implicit)
-- - All assignments auditable
-- - No magic defaults without recorded rules
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Enhance existing caller_id_numbers with status lifecycle
-- -----------------------------------------------------------------------------
ALTER TABLE public.caller_id_numbers 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS retired_at timestamptz,
  ADD COLUMN IF NOT EXISTS retired_by uuid,
  ADD COLUMN IF NOT EXISTS notes text;

-- Add constraint separately (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'caller_id_numbers_status_check'
  ) THEN
    ALTER TABLE public.caller_id_numbers 
      ADD CONSTRAINT caller_id_numbers_status_check 
      CHECK (status IN ('active', 'suspended', 'retired'));
  END IF;
END $$;

-- Add FK for retired_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'caller_id_numbers_retired_by_fkey'
  ) THEN
    ALTER TABLE public.caller_id_numbers 
      ADD CONSTRAINT caller_id_numbers_retired_by_fkey 
      FOREIGN KEY (retired_by) REFERENCES public.users(id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- caller_id_permissions: User-level access to specific caller IDs
-- Admins grant, users can only use what they're permitted
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.caller_id_permissions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    caller_id_number_id uuid NOT NULL,
    user_id uuid NOT NULL,
    
    -- Permission scope: 'use' = can use for calls, 'manage' = can also edit, 'full' = can grant to others
    permission_type text NOT NULL DEFAULT 'use' CHECK (permission_type IN ('use', 'manage', 'full')),
    
    -- Lifecycle (soft revocation for audit trail)
    is_active boolean NOT NULL DEFAULT true,
    granted_at timestamptz NOT NULL DEFAULT now(),
    granted_by uuid NOT NULL,
    revoked_at timestamptz,
    revoked_by uuid,
    revoke_reason text,
    
    -- Audit
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT caller_id_permissions_pkey PRIMARY KEY (id),
    CONSTRAINT caller_id_permissions_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
    CONSTRAINT caller_id_permissions_caller_id_fkey FOREIGN KEY (caller_id_number_id) REFERENCES public.caller_id_numbers(id),
    CONSTRAINT caller_id_permissions_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
    CONSTRAINT caller_id_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id),
    CONSTRAINT caller_id_permissions_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.users(id)
);

-- Unique active permission per user per caller ID (soft-delete friendly)
CREATE UNIQUE INDEX IF NOT EXISTS idx_caller_id_permissions_active 
    ON public.caller_id_permissions(organization_id, caller_id_number_id, user_id) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_caller_id_permissions_user ON public.caller_id_permissions(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_caller_id_permissions_caller_id ON public.caller_id_permissions(caller_id_number_id);
CREATE INDEX IF NOT EXISTS idx_caller_id_permissions_org ON public.caller_id_permissions(organization_id);

-- -----------------------------------------------------------------------------
-- caller_id_default_rules: Explicit defaults (org-level or user-level)
-- No implicit magic - defaults must be recorded
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.caller_id_default_rules (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    
    -- Scope: org-wide or user-specific
    scope_type text NOT NULL CHECK (scope_type IN ('organization', 'user', 'role')),
    user_id uuid,  -- NULL for org-wide, set for user-specific
    role_scope text,  -- NULL unless scope_type = 'role', e.g., 'operator', 'admin'
    
    -- Default caller ID to use
    caller_id_number_id uuid NOT NULL,
    
    -- Priority (lower number = higher priority for resolution)
    priority integer NOT NULL DEFAULT 100,
    
    -- Lifecycle
    is_active boolean NOT NULL DEFAULT true,
    effective_from timestamptz NOT NULL DEFAULT now(),
    effective_until timestamptz,  -- NULL = no expiry
    
    -- Audit
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT caller_id_default_rules_pkey PRIMARY KEY (id),
    CONSTRAINT caller_id_default_rules_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
    CONSTRAINT caller_id_default_rules_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
    CONSTRAINT caller_id_default_rules_caller_id_fkey FOREIGN KEY (caller_id_number_id) REFERENCES public.caller_id_numbers(id),
    CONSTRAINT caller_id_default_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id),
    
    -- Validation: user_id required when scope_type = 'user'
    CONSTRAINT caller_id_default_rules_scope_check CHECK (
        (scope_type = 'user' AND user_id IS NOT NULL) OR
        (scope_type = 'organization' AND user_id IS NULL) OR
        (scope_type = 'role' AND role_scope IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_caller_id_default_rules_org ON public.caller_id_default_rules(organization_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_caller_id_default_rules_user ON public.caller_id_default_rules(user_id) WHERE is_active = true AND user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_caller_id_default_rules_priority ON public.caller_id_default_rules(organization_id, priority) WHERE is_active = true;

-- -----------------------------------------------------------------------------
-- Add caller_id_used to calls table (explicit recording)
-- Snapshot at call time for historical accuracy
-- -----------------------------------------------------------------------------
ALTER TABLE public.calls 
  ADD COLUMN IF NOT EXISTS caller_id_number_id uuid,
  ADD COLUMN IF NOT EXISTS caller_id_used text;

-- Add FK separately (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'calls_caller_id_number_id_fkey'
  ) THEN
    ALTER TABLE public.calls 
      ADD CONSTRAINT calls_caller_id_number_id_fkey 
      FOREIGN KEY (caller_id_number_id) REFERENCES public.caller_id_numbers(id);
  END IF;
END $$;

COMMENT ON COLUMN public.calls.caller_id_number_id IS 'FK to caller_id_numbers for audit trail';
COMMENT ON COLUMN public.calls.caller_id_used IS 'E.164 snapshot of caller ID displayed for this call';

-- -----------------------------------------------------------------------------
-- RLS Policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.caller_id_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caller_id_default_rules ENABLE ROW LEVEL SECURITY;

-- caller_id_permissions: Users can see their own, admins can see/manage all
DROP POLICY IF EXISTS caller_id_permissions_select ON public.caller_id_permissions;
CREATE POLICY caller_id_permissions_select ON public.caller_id_permissions
    FOR SELECT USING (
        user_id = auth.uid() OR
        organization_id IN (
            SELECT organization_id FROM public.org_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS caller_id_permissions_insert ON public.caller_id_permissions;
CREATE POLICY caller_id_permissions_insert ON public.caller_id_permissions
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.org_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS caller_id_permissions_update ON public.caller_id_permissions;
CREATE POLICY caller_id_permissions_update ON public.caller_id_permissions
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM public.org_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- caller_id_default_rules: Org members can read, admins can modify
DROP POLICY IF EXISTS caller_id_default_rules_select ON public.caller_id_default_rules;
CREATE POLICY caller_id_default_rules_select ON public.caller_id_default_rules
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.org_members WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS caller_id_default_rules_insert ON public.caller_id_default_rules;
CREATE POLICY caller_id_default_rules_insert ON public.caller_id_default_rules
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.org_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS caller_id_default_rules_update ON public.caller_id_default_rules;
CREATE POLICY caller_id_default_rules_update ON public.caller_id_default_rules
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM public.org_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- -----------------------------------------------------------------------------
-- Comments for documentation
-- -----------------------------------------------------------------------------
COMMENT ON TABLE public.caller_id_permissions IS 'User-level permissions for caller ID usage. Admins grant, operators use.';
COMMENT ON TABLE public.caller_id_default_rules IS 'Explicit default rules for caller ID selection. No implicit magic.';
COMMENT ON COLUMN public.caller_id_permissions.permission_type IS 'use=call only, manage=edit number, full=grant to others';
COMMENT ON COLUMN public.caller_id_default_rules.priority IS 'Lower number = higher priority. User defaults override org defaults.';
