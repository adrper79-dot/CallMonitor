-- Migration: Add voice support tables per MASTER_ARCHITECTURE.txt UI→API→Table contract
-- Run with: psql "$DATABASE_URL" -f migrations/2026-01-12-add-voice-support-tables.sql

-- voice_targets: Target phone numbers for calls
CREATE TABLE IF NOT EXISTS public.voice_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  phone_number text NOT NULL,
  name text,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT voice_targets_pkey PRIMARY KEY (id),
  CONSTRAINT voice_targets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT voice_targets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_voice_targets_org ON public.voice_targets(organization_id);
CREATE INDEX IF NOT EXISTS idx_voice_targets_active ON public.voice_targets(organization_id, is_active) WHERE is_active = true;

-- campaigns: Optional grouping for calls
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT campaigns_pkey PRIMARY KEY (id),
  CONSTRAINT campaigns_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_org ON public.campaigns(organization_id);

-- surveys: Survey definitions (optional, for structured surveys)
CREATE TABLE IF NOT EXISTS public.surveys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  questions jsonb, -- Array of survey questions
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT surveys_pkey PRIMARY KEY (id),
  CONSTRAINT surveys_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT surveys_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_surveys_org ON public.surveys(organization_id);

-- Add survey_id to voice_configs if needed (optional foreign key)
-- ALTER TABLE public.voice_configs ADD COLUMN IF NOT EXISTS survey_id uuid;
-- ALTER TABLE public.voice_configs ADD CONSTRAINT voice_configs_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id);

-- Add script storage to voice_configs (JSONB for secret shopper scripts)
ALTER TABLE public.voice_configs ADD COLUMN IF NOT EXISTS shopper_script text;
ALTER TABLE public.voice_configs ADD COLUMN IF NOT EXISTS shopper_expected_outcomes jsonb;

-- RLS Policies
ALTER TABLE public.voice_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

-- voice_targets RLS
CREATE POLICY "Users can view their org's voice targets"
  ON public.voice_targets FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage voice targets"
  ON public.voice_targets FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.org_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- campaigns RLS
CREATE POLICY "Users can view their org's campaigns"
  ON public.campaigns FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage campaigns"
  ON public.campaigns FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.org_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- surveys RLS
CREATE POLICY "Users can view their org's surveys"
  ON public.surveys FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage surveys"
  ON public.surveys FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.org_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );
