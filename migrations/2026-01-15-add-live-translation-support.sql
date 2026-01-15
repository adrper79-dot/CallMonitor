-- ============================================================================
-- MIGRATION: Add Live Translation Support (SignalWire AI Agents)
-- Date: January 15, 2026
-- Description: Add fields to support SignalWire AI Agent live translation
-- ============================================================================

-- Add live translation fields to recordings table
ALTER TABLE recordings 
ADD COLUMN IF NOT EXISTS has_live_translation BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS live_translation_provider TEXT;

COMMENT ON COLUMN recordings.has_live_translation IS 'Whether this call used live translation (SignalWire AI Agent)';
COMMENT ON COLUMN recordings.live_translation_provider IS 'Provider used for live translation (e.g., signalwire)';

-- Add translation language fields to voice_configs table
ALTER TABLE voice_configs
ADD COLUMN IF NOT EXISTS translation_from TEXT,
ADD COLUMN IF NOT EXISTS translation_to TEXT;

COMMENT ON COLUMN voice_configs.translation_from IS 'Source language for translation (e.g., en, es, fr)';
COMMENT ON COLUMN voice_configs.translation_to IS 'Target language for translation (e.g., en, es, fr)';

-- Create index for querying live translation recordings
CREATE INDEX IF NOT EXISTS idx_recordings_live_translation 
ON recordings(has_live_translation) 
WHERE has_live_translation = TRUE;

-- Verify changes
SELECT 
    'recordings' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'recordings'
AND column_name IN ('has_live_translation', 'live_translation_provider')
ORDER BY ordinal_position;

SELECT 
    'voice_configs' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'voice_configs'
AND column_name IN ('translation_from', 'translation_to')
ORDER BY ordinal_position;

-- ============================================================================
-- SUCCESS: Live translation database fields added
-- Next Steps:
-- 1. Create /api/call-capabilities endpoint
-- 2. Update /api/voice/config validation
-- 3. Integrate SignalWire AI Agent in startCallHandler
-- ============================================================================
