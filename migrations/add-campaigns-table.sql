-- ============================================================================
-- ADD CAMPAIGNS TABLE
-- ============================================================================
-- Creates the campaigns table if it doesn't exist
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS)
-- ============================================================================

BEGIN;

-- Create campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for organization lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_org_id ON public.campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_org_active ON public.campaigns(organization_id, is_active);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view campaigns in their organization" ON public.campaigns;
DROP POLICY IF EXISTS "Owners and admins can insert campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Owners and admins can update campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Owners and admins can delete campaigns" ON public.campaigns;

-- RLS Policies
-- View: All members can view campaigns in their org
CREATE POLICY "Users can view campaigns in their organization"
ON public.campaigns
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.org_members
    WHERE user_id = auth.uid()
  )
);

-- Insert: Only owners and admins
CREATE POLICY "Owners and admins can insert campaigns"
ON public.campaigns
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  )
);

-- Update: Only owners and admins
CREATE POLICY "Owners and admins can update campaigns"
ON public.campaigns
FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  )
);

-- Delete: Only owners and admins
CREATE POLICY "Owners and admins can delete campaigns"
ON public.campaigns
FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  )
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_campaigns_updated_at();

COMMIT;

-- Verify
SELECT 
  'campaigns' as table_name,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'campaigns';

\echo '✅ Campaigns table created successfully'
\echo 'Table: public.campaigns'
\echo 'RLS: Enabled'
\echo 'Policies: 4 (SELECT, INSERT, UPDATE, DELETE)'
