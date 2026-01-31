-- Check if transcription was triggered for the recording

-- Check the recording
SELECT 
  'Recording Info' as type,
  id,
  recording_url,
  duration_seconds,
  transcript_json,
  status,
  created_at
FROM recordings
WHERE id = 'e33e539f-7cce-4061-ab46-5ea1ecaad26f';

-- Check if transcription jobs were created (ai_runs table)
SELECT 
  'AI Runs (Transcription Jobs)' as type,
  id,
  call_id,
  status,
  model,
  started_at,
  completed_at
FROM ai_runs
WHERE started_at > NOW() - INTERVAL '1 hour'
  OR completed_at > NOW() - INTERVAL '1 hour'
ORDER BY started_at DESC NULLS LAST;

-- Check recent calls
SELECT 
  'Recent Calls' as type,
  id,
  call_sid,
  status,
  started_at,
  ended_at,
  created_at
FROM calls
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
