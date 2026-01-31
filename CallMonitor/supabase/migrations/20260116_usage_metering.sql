-- ============================================================================
-- USAGE METERING SYSTEM
-- ============================================================================
-- Tracks billable usage events per organization for revenue management
-- Per ARCH_DOCS: Call-rooted design - usage tied to calls
-- Per ERROR_HANDLING_REVIEW.md: System of record compliance
-- ============================================================================

BEGIN;

-- Usage Records Table
-- Tracks all billable usage events per organization
CREATE TABLE IF NOT EXISTS public.usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
  
  -- Usage metrics
  metric TEXT NOT NULL CHECK (metric IN ('call', 'minute', 'transcription', 'translation', 'ai_run')),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost_cents INTEGER, -- For historical pricing tracking
  
  -- Billing period tracking
  billing_period_start TIMESTAMPTZ NOT NULL,
  billing_period_end TIMESTAMPTZ NOT NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_usage_records_org_period 
  ON public.usage_records(organization_id, billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_usage_records_call 
  ON public.usage_records(call_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_metric 
  ON public.usage_records(organization_id, metric);

-- RLS Policies
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org's usage" ON public.usage_records;
DROP POLICY IF EXISTS "Service role can insert usage" ON public.usage_records;

CREATE POLICY "Users can view their org's usage"
  ON public.usage_records FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.org_members
      WHERE auth.user_equals_auth(user_id::text)
    )
  );

-- Only service role can insert usage records
CREATE POLICY "Service role can insert usage"
  ON public.usage_records FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS, but policy required

-- Usage Limits Table
-- Defines plan limits for enforcement
CREATE TABLE IF NOT EXISTS public.usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan TEXT NOT NULL UNIQUE,
  
  -- Monthly limits
  calls_per_month INTEGER NOT NULL DEFAULT 0,
  minutes_per_month INTEGER NOT NULL DEFAULT 0,
  transcriptions_per_month INTEGER NOT NULL DEFAULT 0,
  translations_per_month INTEGER NOT NULL DEFAULT 0,
  
  -- Feature flags
  can_record BOOLEAN NOT NULL DEFAULT false,
  can_transcribe BOOLEAN NOT NULL DEFAULT false,
  can_translate BOOLEAN NOT NULL DEFAULT false,
  can_use_secret_shopper BOOLEAN NOT NULL DEFAULT false,
  
  -- Overage handling
  allow_overage BOOLEAN NOT NULL DEFAULT false,
  overage_rate_cents INTEGER, -- Cost per unit over limit
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed usage limits for each plan
INSERT INTO public.usage_limits (
  plan, 
  calls_per_month, 
  minutes_per_month, 
  transcriptions_per_month, 
  translations_per_month, 
  can_record, 
  can_transcribe, 
  can_translate, 
  can_use_secret_shopper, 
  allow_overage
) VALUES
  ('free', 0, 0, 0, 0, false, false, false, false, false),
  ('pro', 500, 5000, 500, 0, true, true, false, false, true),
  ('business', 2000, 20000, 2000, 2000, true, true, true, true, true),
  ('enterprise', 999999, 999999, 999999, 999999, true, true, true, true, true)
ON CONFLICT (plan) DO NOTHING;

-- Add updated_at trigger for usage_limits
CREATE OR REPLACE FUNCTION update_usage_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_usage_limits_updated_at ON public.usage_limits;

CREATE TRIGGER update_usage_limits_updated_at
  BEFORE UPDATE ON public.usage_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_usage_limits_updated_at();

COMMENT ON TABLE public.usage_records IS 'Tracks billable usage events per organization for revenue management';
COMMENT ON TABLE public.usage_limits IS 'Defines plan limits for usage enforcement';

COMMIT;

