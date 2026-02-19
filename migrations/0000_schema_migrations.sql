-- Migration tracking table
-- This is always the FIRST migration applied by scripts/migrate.ts.
-- All subsequent migrations are recorded here to ensure idempotent runs.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     TEXT        NOT NULL PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum    TEXT        NOT NULL,    -- SHA-256 hex of file contents
  duration_ms INTEGER     NOT NULL DEFAULT 0
);

COMMENT ON TABLE schema_migrations IS
  'Tracks applied SQL migrations for scripts/migrate.ts runner';
