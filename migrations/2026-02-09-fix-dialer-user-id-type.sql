-- Fix dialer_agent_status user_id type mismatch
-- users.id is TEXT, but dialer_agent_status.user_id is UUID
-- Change to TEXT to match

ALTER TABLE dialer_agent_status ALTER COLUMN user_id TYPE TEXT;