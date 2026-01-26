-- ============================================================================
-- MIGRATION: Add team_invites table
-- Date: 2026-01-15
-- Description: Creates the team_invites table for managing team invitations
-- ============================================================================

-- Create team_invites table
CREATE TABLE IF NOT EXISTS public.team_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer',
  token uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
  invited_by uuid,
  accepted_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  accepted_at timestamp with time zone,
  
  CONSTRAINT team_invites_pkey PRIMARY KEY (id),
  CONSTRAINT team_invites_organization_id_fkey FOREIGN KEY (organization_id) 
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT team_invites_invited_by_fkey FOREIGN KEY (invited_by) 
    REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT team_invites_accepted_by_fkey FOREIGN KEY (accepted_by) 
    REFERENCES public.users(id) ON DELETE SET NULL
);

-- Create index for looking up invites by token (used during accept flow)
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON public.team_invites(token);

-- Create index for looking up pending invites by org and email
CREATE INDEX IF NOT EXISTS idx_team_invites_org_email_status 
  ON public.team_invites(organization_id, email, status);

-- Create index for cleaning up expired invites
CREATE INDEX IF NOT EXISTS idx_team_invites_expires_at 
  ON public.team_invites(expires_at) WHERE status = 'pending';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.team_invites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invites TO service_role;

-- Add RLS policies
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view invites for their organization
CREATE POLICY "Users can view org invites" ON public.team_invites
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.org_members 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Admins/owners can create invites
CREATE POLICY "Admins can create invites" ON public.team_invites
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.org_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Policy: Admins/owners can update (cancel) invites
CREATE POLICY "Admins can update invites" ON public.team_invites
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.org_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Comment on table
COMMENT ON TABLE public.team_invites IS 'Stores pending team invitations for organizations';
COMMENT ON COLUMN public.team_invites.token IS 'Unique token used in invitation URL';
COMMENT ON COLUMN public.team_invites.status IS 'pending, accepted, cancelled, or expired';
COMMENT ON COLUMN public.team_invites.expires_at IS 'Invitation expires after this time (default 7 days)';

-- ============================================================================
-- Also add invite_id column to org_members for tracking invite origin
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'org_members' 
    AND column_name = 'invite_id'
  ) THEN
    ALTER TABLE public.org_members ADD COLUMN invite_id uuid;
    ALTER TABLE public.org_members ADD CONSTRAINT org_members_invite_id_fkey 
      FOREIGN KEY (invite_id) REFERENCES public.team_invites(id) ON DELETE SET NULL;
    COMMENT ON COLUMN public.org_members.invite_id IS 'Reference to the invite that created this membership';
  END IF;
END $$;
