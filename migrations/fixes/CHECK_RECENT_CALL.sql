-- Check Recent Call Recording Status
-- Run this in Supabase SQL Editor

-- 1. Check most recent calls (last hour)
SELECT 
  id,
  status,
  call_sid,
  created_at,
  started_at,
  ended_at,
  organization_id
FROM calls
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check if recordings exist for recent calls
SELECT 
  r.id as recording_id,
  r.call_id,
  r.recording_url,
  r.status as recording_status,
  r.duration_seconds,
  r.has_live_translation,
  r.live_translation_provider,
  r.created_at,
  c.call_sid,
  c.status as call_status
FROM recordings r
JOIN calls c ON c.id = r.call_id
WHERE r.created_at > NOW() - INTERVAL '1 hour'
ORDER BY r.created_at DESC
LIMIT 5;

-- 3. Check for any transcription/translation runs
SELECT 
  id,
  call_id,
  model,
  status,
  created_at,
  completed_at
FROM ai_runs
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check logs/audit trail (if you have audit_logs table)
-- SELECT * FROM audit_logs 
-- WHERE created_at > NOW() - INTERVAL '1 hour'
-- ORDER BY created_at DESC
-- LIMIT 20;

-- 5. Check voice_configs to see if recording is enabled
SELECT 
  organization_id,
  record,
  transcribe,
  translate,
  translate_from,
  translate_to
FROM voice_configs
WHERE organization_id IN (
  SELECT DISTINCT organization_id 
  FROM calls 
  WHERE created_at > NOW() - INTERVAL '1 hour'
)
LIMIT 5;
