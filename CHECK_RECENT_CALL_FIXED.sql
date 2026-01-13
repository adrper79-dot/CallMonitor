-- FIXED: Check Recent Call Recording Status
-- Run this in Supabase SQL Editor
-- Corrected for actual schema (calls has no created_at, uses started_at)

-- 1. Check most recent calls (last hour)
SELECT 
  id,
  status,
  call_sid,
  started_at,
  ended_at,
  organization_id
FROM calls
WHERE started_at > NOW() - INTERVAL '1 hour'
   OR (started_at IS NULL AND id IN (
     SELECT id FROM calls ORDER BY id DESC LIMIT 10
   ))
ORDER BY COALESCE(started_at, '1970-01-01'::timestamp) DESC
LIMIT 5;

-- 2. Check if recordings exist for recent calls
SELECT 
  r.id as recording_id,
  r.call_sid,
  r.recording_url,
  r.status as recording_status,
  r.duration_seconds,
  r.created_at,
  c.id as call_id,
  c.status as call_status
FROM recordings r
LEFT JOIN calls c ON c.call_sid = r.call_sid
WHERE r.created_at > NOW() - INTERVAL '1 hour'
ORDER BY r.created_at DESC
LIMIT 5;

-- 3. Quick check: Most recent call + recording
SELECT 
  c.id as call_id,
  c.call_sid,
  c.status as call_status,
  c.started_at,
  c.ended_at,
  r.id as recording_id,
  r.recording_url IS NOT NULL as has_recording,
  r.status as recording_status,
  r.duration_seconds
FROM calls c
LEFT JOIN recordings r ON r.call_sid = c.call_sid
WHERE c.started_at > NOW() - INTERVAL '10 minutes'
   OR (c.started_at IS NULL AND c.id IN (
     SELECT id FROM calls ORDER BY id DESC LIMIT 1
   ))
ORDER BY COALESCE(c.started_at, '1970-01-01'::timestamp) DESC
LIMIT 1;

-- 4. Check voice_configs
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
  WHERE started_at > NOW() - INTERVAL '1 hour'
     OR started_at IS NULL
  ORDER BY COALESCE(started_at, '1970-01-01'::timestamp) DESC
  LIMIT 1
)
LIMIT 5;
