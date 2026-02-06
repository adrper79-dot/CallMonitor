#!/usr/bin/env bash
# ============================================================================
# Schema Drift Check — Detects differences between live Neon schema and local snapshot
#
# Usage:
#   npm run db:schema-check        (compare only)
#   npm run db:schema-snapshot      (update local snapshot)
#
# Requires: psql, NEON_PG_CONN environment variable
# ============================================================================

set -euo pipefail

SNAPSHOT_FILE="migrations/schema_snapshot.sql"
TEMP_FILE=$(mktemp)

if [[ -z "${NEON_PG_CONN:-}" ]]; then
  echo "❌ NEON_PG_CONN not set. Export it or add to .env"
  exit 1
fi

echo "🔍 Fetching live schema from Neon..."

# Dump schema-only (no data) for public schema
pg_dump "$NEON_PG_CONN" \
  --schema-only \
  --schema=public \
  --no-owner \
  --no-privileges \
  --no-comments \
  --no-tablespaces \
  2>/dev/null | \
  grep -v '^--' | \
  grep -v '^$' | \
  grep -v '^SET ' | \
  grep -v '^SELECT pg_catalog' \
  > "$TEMP_FILE"

# If snapshot mode (--snapshot flag), save and exit
if [[ "${1:-}" == "--snapshot" ]]; then
  cp "$TEMP_FILE" "$SNAPSHOT_FILE"
  rm "$TEMP_FILE"
  echo "✅ Schema snapshot saved to $SNAPSHOT_FILE"
  echo "   Lines: $(wc -l < "$SNAPSHOT_FILE")"
  exit 0
fi

# Compare mode
if [[ ! -f "$SNAPSHOT_FILE" ]]; then
  echo "⚠️  No local snapshot found at $SNAPSHOT_FILE"
  echo "   Run with --snapshot first to create baseline:"
  echo "   npm run db:schema-snapshot"
  rm "$TEMP_FILE"
  exit 1
fi

echo "📊 Comparing live schema against local snapshot..."

DIFF_OUTPUT=$(diff --unified=3 "$SNAPSHOT_FILE" "$TEMP_FILE" 2>/dev/null || true)
rm "$TEMP_FILE"

if [[ -z "$DIFF_OUTPUT" ]]; then
  echo "✅ No schema drift detected. Live matches snapshot."
  exit 0
else
  echo "❌ Schema drift detected!"
  echo ""
  echo "$DIFF_OUTPUT"
  echo ""
  echo "Actions:"
  echo "  1. Review the diff above"
  echo "  2. If intended, update snapshot: npm run db:schema-snapshot"
  echo "  3. If unintended, investigate who changed the live schema"
  exit 1
fi
