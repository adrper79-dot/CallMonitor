-- Team Invites Table
-- Manages pending team invitations

CREATE TABLE IF NOT EXISTS public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'operator',
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
  invited_by uuid REFERENCES public.users(id),
  accepted_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_team_invites_org ON public.team_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON public.team_invites(email);
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON public.team_invites(token);
CREATE INDEX IF NOT EXISTS idx_team_invites_status ON public.team_invites(status);

-- RLS Policies
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- Org members can view their org's invites
CREATE POLICY "team_invites_select" ON public.team_invites
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- Only admins/owners can insert
CREATE POLICY "team_invites_insert" ON public.team_invites
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.org_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

-- Only admins/owners can update
CREATE POLICY "team_invites_update" ON public.team_invites
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.org_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

-- Comments
COMMENT ON TABLE public.team_invites IS 'Pending team invitations';
COMMENT ON COLUMN public.team_invites.token IS 'Unique invite token for URL';
COMMENT ON COLUMN public.team_invites.status IS 'pending, accepted, cancelled, expired';

-- Add team activity tracking fields to org_members
ALTER TABLE public.org_members 
ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.team_invites(id);

-- Update Schema.txt note: 
-- team_invites table added for invite system
