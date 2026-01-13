-- Migration: Add AI Survey Bot support to voice_configs
-- Date: January 14, 2026
-- Feature: Dynamic AI Survey Bot with SignalWire Integration

-- Add survey prompt fields to voice_configs table
ALTER TABLE public.voice_configs 
  ADD COLUMN IF NOT EXISTS survey_prompts jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS survey_voice text DEFAULT 'rime.spore',
  ADD COLUMN IF NOT EXISTS survey_webhook_email text,
  ADD COLUMN IF NOT EXISTS survey_inbound_number text;

-- Add comments for documentation
COMMENT ON COLUMN public.voice_configs.survey_prompts IS 'Array of survey questions for AI bot (jsonb array of strings)';
COMMENT ON COLUMN public.voice_configs.survey_voice IS 'SignalWire voice ID for survey bot TTS';
COMMENT ON COLUMN public.voice_configs.survey_webhook_email IS 'Email address to receive survey results';
COMMENT ON COLUMN public.voice_configs.survey_inbound_number IS 'SignalWire phone number SID for inbound survey calls';

-- Create index for organizations with survey enabled
CREATE INDEX IF NOT EXISTS idx_voice_configs_survey_enabled 
  ON public.voice_configs (organization_id) 
  WHERE survey = true;
