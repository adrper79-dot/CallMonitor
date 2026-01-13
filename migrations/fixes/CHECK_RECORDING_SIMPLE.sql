-- SIMPLEST QUERY: Check if your most recent call was recorded
-- Just run this one query in Supabase SQL Editor

SELECT 
  c.id as call_id,
  c.call_sid,
  c.status as call_status,
  c.started_at as call_time,
  CASE 
    WHEN r.recording_url IS NOT NULL THEN '✅ YES - Recorded'
    WHEN c.status = 'completed' AND r.id IS NULL THEN '❌ NO - Recording missing'
    ELSE '⏳ Pending - Wait 30 seconds'
  END as recorded,
  r.recording_url,
  r.duration_seconds,
  r.status as recording_status
FROM calls c
LEFT JOIN recordings r ON r.call_sid = c.call_sid
ORDER BY COALESCE(c.started_at, NOW()) DESC
LIMIT 1;
