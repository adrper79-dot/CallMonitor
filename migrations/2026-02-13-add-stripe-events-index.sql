-- Migration: Add missing index on stripe_events.stripe_event_id
-- BL-221: stripe_events table has no index on stripe_event_id for idempotency lookups
-- Safe: CREATE INDEX CONCURRENTLY does not block reads/writes
-- Idempotent: IF NOT EXISTS prevents re-creation errors

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stripe_events_event_id
  ON stripe_events(stripe_event_id);
