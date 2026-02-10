-- Enable Translation for Test Organization
-- Run this SQL to enable live translation for testing

-- Insert or update voice_configs for test org
INSERT INTO voice_configs (
  organization_id,
  live_translate,
  transcribe,
  translate_from,
  translate_to,
  record,
  voice_to_voice
) VALUES (
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001',  -- Test organization ID
  true,                                      -- Enable translation
  true,                                      -- Enable transcription
  'en',                                      -- Source language (English)
  'es',                                      -- Target language (Spanish)
  true,                                      -- Record calls
  false                                      -- Voice-to-voice (can enable later)
)
ON CONFLICT (organization_id) DO UPDATE 
SET 
  live_translate = true,
  transcribe = true,
  translate_from = 'en',
  translate_to = 'es',
  voice_to_voice = false;

-- Verify configuration
SELECT 
  organization_id,
  live_translate,
  transcribe,
  translate_from,
  translate_to,
  voice_to_voice,
  record
FROM voice_configs
WHERE organization_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001';
