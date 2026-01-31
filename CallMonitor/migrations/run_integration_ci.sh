#!/usr/bin/env bash
set -euo pipefail

# Local helper to run the CI steps (useful for dev). Requires envs set in the shell:
# NEON_PG_CONN, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET, SUPABASE_PG_CONN

if [[ -z "${NEON_PG_CONN:-}" ]]; then
  echo "NEON_PG_CONN is required" >&2; exit 2
fi
if [[ -z "${R2_ACCESS_KEY_ID:-}" || -z "${R2_SECRET_ACCESS_KEY:-}" || -z "${R2_ENDPOINT:-}" || -z "${R2_BUCKET:-}" ]]; then
  echo "R2 envs required" >&2; exit 2
fi

# Create rclone config from env
cat > migrations/rclone.conf <<EOF
[r2]
 type = s3
 env_auth = false
 access_key_id = "$R2_ACCESS_KEY_ID"
 secret_access_key = "$R2_SECRET_ACCESS_KEY"
 endpoint = "$R2_ENDPOINT"
 region = auto
EOF

# Dry-run (manual verify)
rclone --config migrations/rclone.conf sync supabase:recordings r2:$R2_BUCKET --dry-run --progress || true

echo "If dry-run looks good, re-run this script with RCLONE_RUN=1 to perform the real sync."
if [[ "${RCLONE_RUN:-}" != "1" ]]; then
  exit 0
fi

rclone --config migrations/rclone.conf sync supabase:recordings r2:$R2_BUCKET --progress

# Apply schema and seeds
psql "$NEON_PG_CONN" -f migrations/neon_public_schema_pass1.sql
node scripts/apply_pass2_safe.js "$NEON_PG_CONN"
psql "$NEON_PG_CONN" -f migrations/seed_test_users.sql

# Run integration tests
RUN_INTEGRATION=1 NEON_PG_CONN="$NEON_PG_CONN" R2_ENDPOINT="$R2_ENDPOINT" R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" npx vitest --run
