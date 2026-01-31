#!/usr/bin/env bash
set -euo pipefail

MIGRATION="migrations/2026-01-10-add-voice-configs.sql"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL must be set (eg: postgres://user:pass@host:5432/db)"
  exit 1
fi

if [ ! -f "$MIGRATION" ]; then
  echo "Migration file not found: $MIGRATION"
  exit 1
fi

echo "Applying migration $MIGRATION"
psql "$DATABASE_URL" -f "$MIGRATION"
