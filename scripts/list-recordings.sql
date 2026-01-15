-- ============================================================================
-- LIST RECORDINGS WITH DETAILS
-- Run in Supabase SQL Editor to see available recordings
-- ============================================================================

SELECT 
  r.id as recording_id,
  r.call_id,
  r.recording_url,
  r.status,
  r.duration,
  r.created_at,
  c.phone_number as called_number,
  c.status as call_status,
  o.name as organization_name
FROM recordings r
LEFT JOIN calls c ON r.call_id = c.id
LEFT JOIN organizations o ON c.organization_id = o.id
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
