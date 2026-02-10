-- Voice-to-Voice Translation Database Migration
-- Adds support for audio synthesis and injection in live translation

-- Add audio fields to call_translations table
ALTER TABLE call_translations
ADD COLUMN translated_audio_url TEXT,
ADD COLUMN audio_duration_ms INTEGER;

-- Create audio_injections table for tracking audio playback
CREATE TABLE audio_injections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL,
  audio_url TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  target_call_control_id TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'playing', 'completed', 'failed')),
  playback_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Ensure one injection per segment per call
  UNIQUE(call_id, segment_index)
);

-- Add voice-to-voice configuration to voice_configs
ALTER TABLE voice_configs
ADD COLUMN voice_to_voice BOOLEAN DEFAULT FALSE,
ADD COLUMN elevenlabs_voice_id TEXT,
ADD COLUMN elevenlabs_api_key TEXT;

-- Create indexes for performance
CREATE INDEX idx_audio_injections_call_status ON audio_injections(call_id, status);
CREATE INDEX idx_audio_injections_org_created ON audio_injections(organization_id, created_at);
CREATE INDEX idx_call_translations_audio ON call_translations(call_id, segment_index) WHERE translated_audio_url IS NOT NULL;

-- Add RLS policies for audio_injections
ALTER TABLE audio_injections ENABLE ROW LEVEL SECURITY;

-- Organizations can only access their own audio injections
CREATE POLICY audio_injections_org_isolation ON audio_injections
  FOR ALL USING (organization_id::text = current_setting('app.current_organization_id', true));

-- Add audit logging trigger for audio_injections
CREATE TRIGGER audit_audio_injections_trigger
  AFTER INSERT OR UPDATE OR DELETE ON audio_injections
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Update voice_configs RLS to include new columns
-- (existing policy should cover these automatically)

COMMENT ON TABLE audio_injections IS 'Tracks audio injection attempts for voice-to-voice translation';
COMMENT ON COLUMN audio_injections.target_call_control_id IS 'Telnyx Call Control ID for the target call leg';
COMMENT ON COLUMN audio_injections.playback_id IS 'Telnyx playback session ID for tracking';
COMMENT ON COLUMN call_translations.translated_audio_url IS 'Signed R2 URL for synthesized speech audio';
COMMENT ON COLUMN call_translations.audio_duration_ms IS 'Estimated duration of synthesized audio in milliseconds';
COMMENT ON COLUMN voice_configs.voice_to_voice IS 'Enable voice-to-voice translation (vs text-only)';
COMMENT ON COLUMN voice_configs.elevenlabs_voice_id IS 'ElevenLabs voice ID for speech synthesis';
COMMENT ON COLUMN voice_configs.elevenlabs_api_key IS 'ElevenLabs API key (encrypted at rest)';