-- FINAL CHECK: Did the recording get created?
-- Run this 60 seconds after making a test call

SELECT 
  c.id as call_id,
  c.call_sid,
  c.status as call_status,
  c.started_at as call_time,
  c.ended_at,
  r.id as recording_id,
  r.recording_sid,
  r.recording_url,
  r.duration_seconds,
  r.status as recording_status,
  r.tool_id,
  CASE 
    WHEN r.id IS NOT NULL THEN '🎉 SUCCESS! Recording created!'
    WHEN c.status = 'completed' AND r.id IS NULL THEN '❌ FAILED: Call completed but no recording'
    WHEN c.status = 'in-progress' THEN '⏳ WAIT: Call still in progress'
    ELSE '⚠️ UNKNOWN: Check call status'
  END as result
FROM calls c
LEFT JOIN recordings r ON r.call_sid = c.call_sid
WHERE c.organization_id = '77249446-3201-4b00-9b96-fe7c4b16b593'
ORDER BY COALESCE(c.started_at, c.ended_at, NOW()) DESC
LIMIT 1;

-- Also check the actual recording in the recordings table
SELECT 
  id,
  call_sid,
  recording_sid,
  recording_url IS NOT NULL as has_url,
  duration_seconds,
  status,
  created_at,
  organization_id,
  tool_id
FROM recordings
WHERE organization_id = '77249446-3201-4b00-9b96-fe7c4b16b593'
ORDER BY created_at DESC
LIMIT 3;
