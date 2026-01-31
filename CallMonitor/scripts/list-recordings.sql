-- ============================================================================
-- LIST RECORDINGS WITH DETAILS
-- Run in Supabase SQL Editor to see available recordings
-- ============================================================================

SELECT 
  r.id as recording_id,
  r.call_sid,
  r.recording_sid,
  r.recording_url,
  r.status,
  r.duration_seconds,
  r.created_at,
  o.name as organization_name
FROM recordings r
LEFT JOIN organizations o ON r.organization_id = o.id
WHERE r.recording_url IS NOT NULL
ORDER BY r.created_at DESC
LIMIT 20;

-- Summary
SELECT 
  COUNT(*) as total_recordings,
  COUNT(CASE WHEN recording_url IS NOT NULL THEN 1 END) as recordings_with_url,
  COUNT(CASE WHEN status = 'transcribed' THEN 1 END) as transcribed,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
FROM recordings;
