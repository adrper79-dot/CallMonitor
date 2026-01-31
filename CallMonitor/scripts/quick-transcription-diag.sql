-- ============================================
-- QUICK TRANSCRIPTION DIAGNOSTIC
-- Run in Supabase SQL Editor
-- ============================================

-- 1. Voice Config Status
SELECT 'VOICE CONFIG' as section;
SELECT 
  vc.organization_id,
  o.name as org_name,
  o.plan,
  vc.record,
  vc.transcribe,
  vc.translate,
  vc.translate_from,
  vc.translate_to
FROM voice_configs vc
LEFT JOIN organizations o ON o.id = vc.organization_id
LIMIT 5;

-- 2. Recent Calls Summary
SELECT 'CALLS SUMMARY' as section;
SELECT 
  status,
  COUNT(*) as count
FROM calls
GROUP BY status;

-- 3. Recordings Summary  
SELECT 'RECORDINGS SUMMARY' as section;
SELECT 
  COUNT(*) as total_recordings,
  COUNT(*) FILTER (WHERE recording_url IS NOT NULL) as with_url,
  COUNT(*) FILTER (WHERE transcript_json IS NOT NULL) as with_transcript
FROM recordings;

-- 4. AI Runs by Model and Status
SELECT 'AI RUNS' as section;
SELECT 
  model,
  status,
  COUNT(*) as count
FROM ai_runs
WHERE model LIKE '%assemblyai%' OR model LIKE '%translation%'
GROUP BY model, status
ORDER BY model, status;

-- 5. Check for system-ai entry
SELECT 'SYSTEM-AI CHECK' as section;
SELECT EXISTS(SELECT 1 FROM systems WHERE key = 'system-ai') as has_system_ai;

-- 6. Most Recent Recordings
SELECT 'RECENT RECORDINGS (last 5)' as section;
SELECT 
  id,
  call_sid,
  status,
  recording_url IS NOT NULL as has_url,
  transcript_json IS NOT NULL as has_transcript,
  created_at
FROM recordings
ORDER BY created_at DESC
LIMIT 5;

-- 7. Most Recent AI Runs
SELECT 'RECENT AI RUNS (last 10)' as section;
SELECT 
  id,
  call_id,
  model,
  status,
  started_at,
  CASE 
    WHEN output IS NULL THEN 'no output'
    WHEN output::text LIKE '%error%' THEN 'ERROR: ' || (output->>'error')::text
    WHEN output::text LIKE '%transcript%' THEN 'has transcript'
    WHEN output::text LIKE '%translated%' THEN 'has translation'
    ELSE 'processing'
  END as result
FROM ai_runs
ORDER BY started_at DESC NULLS LAST
LIMIT 10;
