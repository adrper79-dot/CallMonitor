-- COMPREHENSIVE RECORDING DIAGNOSTIC
-- Run this to find out why recordings aren't being created

-- 1. Check if organization has tool_id (REQUIRED for recordings)
SELECT 
  o.id as organization_id,
  o.name,
  o.plan,
  o.tool_id,
  CASE 
    WHEN o.tool_id IS NULL THEN '❌ NO TOOL_ID - Recordings will FAIL!'
    ELSE '✅ Has tool_id'
  END as tool_status,
  t.name as tool_name
FROM organizations o
LEFT JOIN tools t ON t.id = o.tool_id
WHERE o.id IN (
  SELECT DISTINCT organization_id 
  FROM calls 
  WHERE started_at > NOW() - INTERVAL '24 hours'
     OR started_at IS NULL
  ORDER BY organization_id
  LIMIT 1
);

-- 2. Check calls vs recordings relationship
SELECT 
  'Total Calls (last 24h)' as metric,
  COUNT(*) as count
FROM calls
WHERE started_at > NOW() - INTERVAL '24 hours'
   OR started_at IS NULL
UNION ALL
SELECT 
  'Calls with call_sid' as metric,
  COUNT(*) as count
FROM calls
WHERE (started_at > NOW() - INTERVAL '24 hours' OR started_at IS NULL)
  AND call_sid IS NOT NULL
UNION ALL
SELECT 
  'Calls "completed"' as metric,
  COUNT(*) as count
FROM calls
WHERE (started_at > NOW() - INTERVAL '24 hours' OR started_at IS NULL)
  AND status = 'completed'
UNION ALL
SELECT 
  'Calls "in-progress"' as metric,
  COUNT(*) as count
FROM calls
WHERE (started_at > NOW() - INTERVAL '24 hours' OR started_at IS NULL)
  AND status = 'in-progress'
UNION ALL
SELECT 
  'Total Recordings' as metric,
  COUNT(*) as count
FROM recordings
WHERE created_at > NOW() - INTERVAL '24 hours';

-- 3. Find calls WITH call_sid but NO recording (webhook issue!)
SELECT 
  c.id as call_id,
  c.call_sid,
  c.status,
  c.started_at,
  c.ended_at,
  'Webhook arrived (has call_sid) but NO recording created!' as issue
FROM calls c
WHERE c.call_sid IS NOT NULL
  AND c.status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM recordings r 
    WHERE r.call_sid = c.call_sid
  )
ORDER BY c.started_at DESC
LIMIT 5;

-- 4. Check voice_configs (is recording enabled?)
SELECT 
  organization_id,
  record as recording_enabled,
  transcribe,
  translate,
  CASE 
    WHEN record = true THEN '✅ Recording ON'
    ELSE '❌ Recording OFF'
  END as status
FROM voice_configs
WHERE organization_id IN (
  SELECT DISTINCT organization_id 
  FROM calls 
  LIMIT 1
);

-- 5. Sample recent recordings (if any exist)
SELECT 
  id,
  call_sid,
  recording_sid,
  status,
  duration_seconds,
  created_at,
  tool_id,
  CASE 
    WHEN tool_id IS NULL THEN '❌ Missing tool_id'
    ELSE '✅ Has tool_id'
  END as tool_check
FROM recordings
ORDER BY created_at DESC
LIMIT 5;
