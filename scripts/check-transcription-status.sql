-- ============================================
-- TRANSCRIPTION & TRANSLATION DIAGNOSTIC
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Check voice_configs: Is transcription/translation enabled?
SELECT 
  vc.organization_id,
  o.name as org_name,
  o.plan,
  vc.record,
  vc.transcribe,
  vc.translate,
  vc.translate_from,
  vc.translate_to,
  vc.updated_at
FROM voice_configs vc
JOIN organizations o ON o.id = vc.organization_id
ORDER BY vc.updated_at DESC
LIMIT 10;

-- 2. Check recent calls
SELECT 
  c.id,
  c.call_sid,
  c.status,
  c.flow_type,
  c.started_at,
  c.ended_at
FROM calls c
ORDER BY c.started_at DESC NULLS LAST
LIMIT 10;

-- 3. Check recordings - Do we have any?
SELECT 
  r.id,
  r.call_sid,
  r.recording_sid,
  r.status,
  r.duration_seconds,
  r.recording_url IS NOT NULL as has_url,
  r.transcript_json IS NOT NULL as has_transcript,
  r.created_at
FROM recordings r
ORDER BY r.created_at DESC
LIMIT 10;

-- 4. Check ai_runs - Transcription/Translation jobs
SELECT 
  ar.id,
  ar.call_id,
  ar.model,
  ar.status,
  ar.started_at,
  ar.completed_at,
  jsonb_typeof(ar.output) as output_type,
  CASE 
    WHEN ar.output ? 'transcript' THEN 'has transcript'
    WHEN ar.output ? 'translated_text' THEN 'has translation'
    WHEN ar.output ? 'error' THEN ar.output->>'error'
    ELSE 'pending'
  END as result_summary
FROM ai_runs ar
WHERE ar.model LIKE 'assemblyai%'
ORDER BY ar.started_at DESC
LIMIT 20;

-- 5. Summary counts
SELECT 
  'calls' as table_name,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM calls
UNION ALL
SELECT 
  'recordings',
  COUNT(*),
  COUNT(*) FILTER (WHERE status = 'completed'),
  COUNT(*) FILTER (WHERE transcript_json IS NOT NULL)
FROM recordings
UNION ALL
SELECT 
  'ai_runs (transcription)',
  COUNT(*),
  COUNT(*) FILTER (WHERE status = 'completed'),
  COUNT(*) FILTER (WHERE status = 'failed')
FROM ai_runs
WHERE model = 'assemblyai-v1'
UNION ALL
SELECT 
  'ai_runs (translation)',
  COUNT(*),
  COUNT(*) FILTER (WHERE status = 'completed'),
  COUNT(*) FILTER (WHERE status = 'failed')
FROM ai_runs
WHERE model = 'assemblyai-translation';

-- 6. Check if systems table has 'system-ai' entry (required for transcription)
SELECT 
  id,
  key,
  name,
  created_at
FROM systems
WHERE key = 'system-ai';
