-- ============================================================================
-- FIX TRIGGER ISSUE
-- The booking_events trigger function references organization_id incorrectly
-- ============================================================================

-- Step 1: Check the trigger function definition
SELECT pg_get_functiondef(oid) AS function_definition
FROM pg_proc 
WHERE proname = 'update_booking_updated_at';

-- Step 2: Check booking_events table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'booking_events'
ORDER BY ordinal_position;

-- Step 3: Drop the problematic trigger
DROP TRIGGER IF EXISTS booking_events_updated_at ON booking_events;

-- Step 4: Create a correct trigger function
CREATE OR REPLACE FUNCTION update_booking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Recreate the trigger
CREATE TRIGGER booking_events_updated_at
  BEFORE UPDATE ON booking_events
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_updated_at();

-- Step 6: Verify
SELECT 'Trigger fixed' AS status;
