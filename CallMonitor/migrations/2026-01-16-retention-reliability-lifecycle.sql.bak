-- Migration: Retention & Lifecycle + Reliability Hardening
-- Date: 2026-01-16
-- Purpose: 
--   1. Org-level retention policies
--   2. Dead-letter queue for failed webhooks
--   3. Reliability tracking
-- Reference: ARCH_DOCS/01-CORE/SYSTEM_OF_RECORD_COMPLIANCE.md

BEGIN;

-- =============================================================================
-- 1. ORGANIZATION-LEVEL RETENTION POLICIES
-- =============================================================================

-- Retention policies per organization
CREATE TABLE IF NOT EXISTS public.retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Default retention class for new calls/recordings
  default_retention_class text NOT NULL DEFAULT 'default'
    CHECK (default_retention_class IN ('default', 'regulated', 'legal_hold')),
  
  -- Retention periods (days, 0 = indefinite)
  default_retention_days integer NOT NULL DEFAULT 0,
  regulated_retention_days integer NOT NULL DEFAULT 2555, -- ~7 years for regulated
  
  -- Auto-archive settings
  auto_archive_after_days integer DEFAULT 90,
  auto_delete_after_days integer DEFAULT NULL, -- NULL = never auto-delete
  
  -- Legal hold settings
  legal_hold_contact_email text,
  legal_hold_notes text,
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id),
  
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "retention_policies_select_org" ON public.retention_policies
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.org_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "retention_policies_update_admin" ON public.retention_policies
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.org_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_retention_policies_org 
  ON public.retention_policies(organization_id);

-- =============================================================================
-- 2. DEAD-LETTER QUEUE FOR FAILED WEBHOOKS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  
  -- Webhook source
  source text NOT NULL CHECK (source IN ('signalwire', 'assemblyai', 'resend', 'stripe', 'internal')),
  endpoint text NOT NULL,
  
  -- Original payload
  payload jsonb NOT NULL,
  headers jsonb,
  
  -- Failure details
  error_message text NOT NULL,
  error_code text,
  http_status integer,
  
  -- Idempotency
  idempotency_key text UNIQUE,
  
  -- Retry tracking
  attempt_count integer NOT NULL DEFAULT 1,
  max_attempts integer NOT NULL DEFAULT 5,
  next_retry_at timestamptz,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  
  -- Status
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'retrying', 'succeeded', 'failed', 'manual_review', 'discarded')),
  
  -- Resolution
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.users(id),
  resolution_notes text,
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Related resource (if identifiable)
  resource_type text,
  resource_id uuid
);

-- Enable RLS
ALTER TABLE public.webhook_failures ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "webhook_failures_select_org" ON public.webhook_failures
  FOR SELECT USING (
    organization_id IS NULL OR
    organization_id IN (
      SELECT organization_id FROM public.org_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "webhook_failures_update_admin" ON public.webhook_failures
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.org_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Indexes for retry queries
CREATE INDEX IF NOT EXISTS idx_webhook_failures_status_retry 
  ON public.webhook_failures(status, next_retry_at) 
  WHERE status IN ('pending', 'retrying');

CREATE INDEX IF NOT EXISTS idx_webhook_failures_org 
  ON public.webhook_failures(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_failures_idempotency 
  ON public.webhook_failures(idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- =============================================================================
-- 3. RELIABILITY METRICS VIEW
-- =============================================================================

CREATE OR REPLACE VIEW public.reliability_metrics AS
SELECT 
  organization_id,
  
  -- Webhook failure counts
  COUNT(*) FILTER (WHERE status = 'pending') as pending_webhooks,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_webhooks,
  COUNT(*) FILTER (WHERE status = 'manual_review') as manual_review_webhooks,
  COUNT(*) FILTER (WHERE status = 'succeeded') as recovered_webhooks,
  
  -- By source
  COUNT(*) FILTER (WHERE source = 'signalwire' AND status IN ('pending', 'failed')) as signalwire_failures,
  COUNT(*) FILTER (WHERE source = 'assemblyai' AND status IN ('pending', 'failed')) as assemblyai_failures,
  
  -- Time window metrics (last 24h)
  COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours') as failures_24h,
  COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND status = 'succeeded') as recovered_24h,
  
  -- Oldest pending
  MIN(created_at) FILTER (WHERE status IN ('pending', 'retrying')) as oldest_pending
  
FROM public.webhook_failures
GROUP BY organization_id;

-- =============================================================================
-- 4. EXPORT COMPLIANCE LOG
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.export_compliance_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Export details
  call_id uuid NOT NULL REFERENCES public.calls(id),
  bundle_id uuid REFERENCES public.evidence_bundles(id),
  
  -- Compliance checks
  retention_check_passed boolean NOT NULL,
  legal_hold_check_passed boolean NOT NULL,
  custody_status_at_export text NOT NULL,
  retention_class_at_export text NOT NULL,
  
  -- Export outcome
  export_allowed boolean NOT NULL,
  denial_reason text,
  
  -- Actor
  requested_by uuid NOT NULL REFERENCES public.users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  
  -- Audit trail
  decision_metadata jsonb
);

-- Enable RLS
ALTER TABLE public.export_compliance_log ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "export_compliance_log_select_org" ON public.export_compliance_log
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.org_members 
      WHERE user_id = auth.uid()
    )
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_export_compliance_log_call 
  ON public.export_compliance_log(call_id, requested_at DESC);

-- =============================================================================
-- 5. LEGAL HOLD TRACKING
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.legal_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Hold details
  hold_name text NOT NULL,
  matter_reference text, -- External legal matter ID
  description text,
  
  -- Scope
  applies_to_all boolean NOT NULL DEFAULT false,
  call_ids uuid[] DEFAULT '{}',
  
  -- Status
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'released', 'expired')),
  
  -- Timeline
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  released_at timestamptz,
  released_by uuid REFERENCES public.users(id),
  release_reason text,
  
  -- Audit
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.legal_holds ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "legal_holds_select_org" ON public.legal_holds
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.org_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "legal_holds_manage_admin" ON public.legal_holds
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.org_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_legal_holds_org_status 
  ON public.legal_holds(organization_id, status);

-- =============================================================================
-- 6. TRIGGER: Auto-apply legal hold to related records
-- =============================================================================

CREATE OR REPLACE FUNCTION apply_legal_hold()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS legal_hold_apply ON public.legal_holds;
CREATE TRIGGER legal_hold_apply
  AFTER INSERT OR UPDATE ON public.legal_holds
  FOR EACH ROW
  EXECUTE FUNCTION apply_legal_hold();

-- =============================================================================
-- 7. FUNCTION: Check export compliance
-- =============================================================================

CREATE OR REPLACE FUNCTION check_export_compliance(
  p_call_id uuid,
  p_user_id uuid
)
RETURNS jsonb AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
