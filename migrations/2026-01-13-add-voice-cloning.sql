-- Migration: Add voice cloning support to voice_configs
-- Date: January 13, 2026

-- Add voice cloning fields to voice_configs table
ALTER TABLE public.voice_configs 
  ADD COLUMN IF NOT EXISTS use_voice_cloning boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cloned_voice_id text;

-- Add comment for documentation
COMMENT ON COLUMN public.voice_configs.use_voice_cloning IS 'Enable voice cloning for translated audio using caller voice';
COMMENT ON COLUMN public.voice_configs.cloned_voice_id IS 'ElevenLabs voice ID for the cloned voice (if already created)';

-- Optional: Create index for organizations with voice cloning enabled
CREATE INDEX IF NOT EXISTS idx_voice_configs_voice_cloning 
  ON public.voice_configs (organization_id) 
  WHERE use_voice_cloning = true;
