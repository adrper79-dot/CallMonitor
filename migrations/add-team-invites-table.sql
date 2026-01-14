-- ============================================================================
-- ADD TEAM INVITES TABLE
-- ============================================================================
-- Creates the team_invites table for managing team invitation emails
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS)
-- ============================================================================

BEGIN;

-- Create team_invites table
CREATE TABLE IF NOT EXISTS public.team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'operator', 'analyst', 'viewer')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_team_invites_org_id ON public.team_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON public.team_invites(email);
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON public.team_invites(token);
CREATE INDEX IF NOT EXISTS idx_team_invites_expires ON public.team_invites(expires_at) WHERE accepted_at IS NULL;

-- Enable RLS
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view invites for their organization" ON public.team_invites;
DROP POLICY IF EXISTS "Owners and admins can create invites" ON public.team_invites;
DROP POLICY IF EXISTS "Owners and admins can update invites" ON public.team_invites;
DROP POLICY IF EXISTS "Owners and admins can delete invites" ON public.team_invites;

-- RLS Policies
-- View: Owners and Admins can view invites in their org
CREATE POLICY "Users can view invites for their organization"
ON public.team_invites
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  )
);

-- Insert: Only owners and admins can create invites
CREATE POLICY "Owners and admins can create invites"
ON public.team_invites
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  )
);

-- Update: Only owners and admins can update invites
CREATE POLICY "Owners and admins can update invites"
ON public.team_invites
FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  )
);

-- Delete: Only owners and admins can delete invites
CREATE POLICY "Owners and admins can delete invites"
ON public.team_invites
FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.org_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  )
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_team_invites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_team_invites_updated_at ON public.team_invites;

CREATE TRIGGER update_team_invites_updated_at
  BEFORE UPDATE ON public.team_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_team_invites_updated_at();

COMMIT;

-- Verify
SELECT 
  'team_invites' as table_name,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'team_invites';

\echo '✅ Team invites table created successfully'
\echo 'Table: public.team_invites'
\echo 'RLS: Enabled'
\echo 'Policies: 4 (SELECT, INSERT, UPDATE, DELETE)'
