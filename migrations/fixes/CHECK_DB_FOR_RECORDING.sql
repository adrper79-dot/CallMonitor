-- Run these queries in Supabase SQL Editor or via CLI
-- These will tell us what's in the database

-- Query 1: Recent calls (last 1 hour)
SELECT 
  id,
  status,
  call_sid,
  organization_id,
  started_at,
  ended_at,
  EXTRACT(EPOCH FROM (ended_at - started_at))::int as duration_seconds,
  created_at,
  created_by
FROM calls 
WHERE created_at > NOW() - INTERVAL '1 hour' 
ORDER BY created_at DESC
LIMIT 5;

-- Expected: Should see your recent call with status='completed'
-- Copy the call_sid value for next queries


-- Query 2: Check for recordings
SELECT 
  id,
  call_sid,
  recording_sid,
  recording_url,
  duration_seconds,
  status,
  tool_id,
  organization_id,
  created_at
FROM recordings 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5;

-- Expected: Should see recording entry
-- If EMPTY: Recording webhook didn't fire or failed to insert


-- Query 3: Check for specific call_sid (replace with your actual call_sid from Query 1)
-- SELECT * FROM recordings WHERE call_sid = 'YOUR_CALL_SID_HERE';


-- Query 4: Check audit logs for recording activity
SELECT 
  resource_type,
  resource_id,
  action,
  after->>'recording_url' as recording_url,
  after->>'error' as error,
  created_at
FROM audit_logs
WHERE resource_type IN ('recordings', 'calls')
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;

-- Look for: 
-- - action='create' with resource_type='recordings' (success)
-- - action='error' (failure - check error field)


-- Query 5: Check organization has tool_id (required for recordings)
SELECT 
  o.id,
  o.name,
  o.tool_id,
  o.plan
FROM organizations o
WHERE o.id IN (
  SELECT DISTINCT organization_id 
  FROM calls 
  WHERE created_at > NOW() - INTERVAL '1 hour'
);

-- Expected: tool_id should NOT be null
-- If NULL: Organization has no tool, recordings can't be created
