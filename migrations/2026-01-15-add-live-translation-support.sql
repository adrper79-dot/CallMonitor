-- ============================================================================
-- MIGRATION: Add Live Translation Support (SignalWire AI Agents)
-- Date: January 15, 2026
-- Description: Add fields to support SignalWire AI Agent live translation
-- ============================================================================

-- Add live translation fields to recordings table
ALTER TABLE recordings 
ADD COLUMN IF NOT EXISTS has_live_translation BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS live_translation_provider TEXT;

-- has_live_translation: Whether this call used live translation (SignalWire AI Agent)
-- live_translation_provider: Provider used for live translation (e.g., signalwire)

-- Note: translate_from and translate_to already exist in voice_configs per Schema.txt
-- No need to add them. Just verify they exist.
-- The live_translate_from and live_translate_to are for SignalWire AI Agent live translation.

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

-- Verify translate_from and translate_to exist in voice_configs (per Schema.txt)
SELECT 
    'voice_configs' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'voice_configs'
AND column_name IN ('translate_from', 'translate_to', 'live_translate_from', 'live_translate_to')
ORDER BY ordinal_position;

-- ============================================================================
-- SUCCESS: Live translation database fields added
-- Next Steps:
-- 1. Create /api/call-capabilities endpoint
-- 2. Update /api/voice/config validation
-- 3. Integrate SignalWire AI Agent in startCallHandler
-- ============================================================================
