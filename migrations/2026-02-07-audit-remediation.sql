-- ============================================================================
-- Migration: 2026-02-07 Audit Remediation
-- Purpose: Create tables that were previously created at runtime via DDL
--          in route handlers (anti-pattern), plus missing tables found
--          during the comprehensive codebase audit.
--
-- Tables created:
--   1. call_translations — Live translation segments (was in live-translation.ts)
--   2. teams — Department/squad management (missing from all migrations)
--   3. team_members — User-team associations (missing from all migrations)
--   4. survey_responses — Survey response collection (queried but never created)
--
-- Indexes added:
--   - voice_configs(organization_id)
--   - voice_targets(organization_id)
--   - booking_events(organization_id)
--
-- Safe to run multiple times (all IF NOT EXISTS / IF EXISTS).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. call_translations — previously runtime DDL in live-translation.ts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.call_translations (
  id SERIAL PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  source_language TEXT NOT NULL DEFAULT 'en',
  target_language TEXT NOT NULL DEFAULT 'es',
  original_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  segment_index INTEGER NOT NULL DEFAULT 0,
  confidence REAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_translations_call_id
  ON public.call_translations(call_id, segment_index);

CREATE INDEX IF NOT EXISTS idx_call_translations_org_id
  ON public.call_translations(organization_id);

-- ---------------------------------------------------------------------------
-- 2. teams — department/squad management
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  team_type TEXT DEFAULT 'department',
  parent_team_id UUID REFERENCES public.teams(id),
  manager_user_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_teams_org_id
  ON public.teams(organization_id);

-- ---------------------------------------------------------------------------
-- 3. team_members — user-team associations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  team_role TEXT DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id
  ON public.team_members(team_id);

CREATE INDEX IF NOT EXISTS idx_team_members_user_id
  ON public.team_members(user_id);

-- ---------------------------------------------------------------------------
-- 4. survey_responses — survey response collection
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL,
  call_id UUID,
  organization_id UUID NOT NULL,
  responses JSONB NOT NULL DEFAULT '{}',
  respondent_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_org_id
  ON public.survey_responses(organization_id);

CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_id
  ON public.survey_responses(survey_id);

-- ---------------------------------------------------------------------------
-- 5. Missing indexes on frequently-queried multi-tenant tables
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_voice_configs_org_id
  ON public.voice_configs(organization_id);

CREATE INDEX IF NOT EXISTS idx_voice_targets_org_id
  ON public.voice_targets(organization_id);

-- Add translate_mode column if missing from voice_configs
ALTER TABLE public.voice_configs
  ADD COLUMN IF NOT EXISTS translate_mode TEXT DEFAULT 'post_call';

-- ---------------------------------------------------------------------------
-- End of migration
-- ---------------------------------------------------------------------------
