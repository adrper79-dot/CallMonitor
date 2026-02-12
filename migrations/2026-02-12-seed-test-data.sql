-- Seed test organization, user, and voice configs for production tests
-- Idempotent: safe to run multiple times

-- Test organization (if not exists)
INSERT INTO organizations (id, name, created_at, updated_at)
VALUES ('3cc2cb3c-2f6c-4418-8c98-a7948aea9625', 'Word Is Bond QA Team', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Test user (adrper79@gmail.com / 123qweASD) as owner
-- Skip user creation since email already exists - assume it's already set up correctly

-- Organization membership for test user as owner (use the existing user ID)
-- First find the existing user ID for adrper79@gmail.com
DO $$
DECLARE
    existing_user_id UUID;
BEGIN
    SELECT id INTO existing_user_id FROM users WHERE email = 'adrper79@gmail.com' LIMIT 1;

    IF existing_user_id IS NOT NULL THEN
        INSERT INTO org_members (organization_id, user_id, role, created_at, updated_at)
        VALUES ('3cc2cb3c-2f6c-4418-8c98-a7948aea9625', existing_user_id, 'owner', NOW(), NOW())
        ON CONFLICT (organization_id, user_id) DO UPDATE SET
          role = EXCLUDED.role,
          updated_at = NOW();
    END IF;
END $$;

-- Voice configuration for test org (enable all features for testing)
INSERT INTO voice_configs (
  organization_id,
  record,
  transcribe,
  translate,
  translate_from,
  translate_to,
  live_translate,
  voice_to_voice,
  survey,
  synthetic_caller,
  use_voice_cloning,
  elevenlabs_voice_id,
  updated_at
) VALUES (
  '3cc2cb3c-2f6c-4418-8c98-a7948aea9625',
  true,  -- record
  true,  -- transcribe
  true,  -- translate
  'en',  -- translate_from
  'es',  -- translate_to
  true,  -- live_translate
  true,  -- voice_to_voice
  false, -- survey
  false, -- synthetic_caller
  false, -- use_voice_cloning
  NULL,  -- elevenlabs_voice_id
  NOW()
)
ON CONFLICT (organization_id) DO UPDATE SET
  record = EXCLUDED.record,
  transcribe = EXCLUDED.transcribe,
  translate = EXCLUDED.translate,
  translate_from = EXCLUDED.translate_from,
  translate_to = EXCLUDED.translate_to,
  live_translate = EXCLUDED.live_translate,
  voice_to_voice = EXCLUDED.voice_to_voice,
  survey = EXCLUDED.survey,
  synthetic_caller = EXCLUDED.synthetic_caller,
  use_voice_cloning = EXCLUDED.use_voice_cloning,
  elevenlabs_voice_id = EXCLUDED.elevenlabs_voice_id,
  updated_at = NOW();