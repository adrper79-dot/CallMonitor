-- Add localized survey prompts by language code
ALTER TABLE public.voice_configs
  ADD COLUMN IF NOT EXISTS survey_prompts_locales jsonb DEFAULT '{}';

COMMENT ON COLUMN public.voice_configs.survey_prompts_locales IS
  'Localized survey prompts by language code (e.g., {"es": ["Pregunta 1"]})';
