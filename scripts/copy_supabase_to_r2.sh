#!/usr/bin/env bash
set -euo pipefail
# Copy Supabase storage objects to Cloudflare R2 using rclone (recommended)
# Requires: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET, SUPABASE_BUCKET_URL or path list

if [[ -z "${R2_ACCESS_KEY_ID:-}" || -z "${R2_SECRET_ACCESS_KEY:-}" || -z "${R2_ENDPOINT:-}" || -z "${R2_BUCKET:-}" ]]; then
  echo "Missing R2 env (R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_ENDPOINT/R2_BUCKET)"
  exit 2
fi

if [[ -z "${SUPABASE_BUCKET_URL:-}" && ! -f migrations/supabase_storage_backup/recordings_objects.json ]]; then
  echo "Provide SUPABASE_BUCKET_URL or ensure migrations/supabase_storage_backup/ contains exported object lists"
  exit 2
fi

# Example rclone config (use migrations/rclone.conf.template as starting point)
# rclone --config migrations/rclone.conf sync "supabase:bucketname" "r2:/$R2_BUCKET" --progress

echo "Run a dry-run first (replace supabase:bucketname with actual remote/bucket)"
echo "  rclone --config migrations/rclone.conf sync supabase:bucketname r2:$R2_BUCKET --dry-run --progress"

echo "If the dry-run looks good, run the actual sync:"
echo "  rclone --config migrations/rclone.conf sync supabase:bucketname r2:$R2_BUCKET --progress"

cat <<'EOF'
# rclone quick instructions:
# 1. Install rclone and create a remote named 'r2' with S3-compatible settings pointing to $R2_ENDPOINT.
# 2. Create a remote 'supabase' if needed (or use the object manifest in migrations/supabase_storage_backup/)
# 3. Run dry-run then real sync (above).
EOF

echo "Script finished. Verify checksums by sampling files or using object list comparisons."
