-- Migration: add voice_configs table
-- Run with: psql "$DATABASE_URL" -f migrations/2026-01-10-add-voice-configs.sql

CREATE TABLE IF NOT EXISTS public.voice_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  record boolean DEFAULT false,
  transcribe boolean DEFAULT false,
  translate boolean DEFAULT false,
  translate_from text,
  translate_to text,
  survey boolean DEFAULT false,
  synthetic_caller boolean DEFAULT false,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT voice_configs_pkey PRIMARY KEY (id),
  CONSTRAINT voice_configs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT voice_configs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id)
);

-- Optional index to lookup by organization quickly
CREATE UNIQUE INDEX IF NOT EXISTS voice_configs_organization_id_uindex ON public.voice_configs (organization_id);
