#!/usr/bin/env bash
# ============================================================================
# Neon Backup Policy Script — pg_dump to local archive + R2 offsite upload
# Run: npm run db:backup
# Schedule: Daily via cron or CI pipeline
#
# Requires: psql/pg_dump CLI, NEON_PG_CONN env var
# Optional: npx wrangler (for R2 upload) — skipped gracefully if absent
# Outputs: backups/db/neon_<date>.sql.gz  +  r2://wordisbond01/backups/db/neon_<date>.sql.gz
# ============================================================================

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups/db}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/neon_${TIMESTAMP}.sql.gz"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Neon Database Backup Script            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"

# Verify environment
if [ -z "${NEON_PG_CONN:-}" ]; then
  echo -e "${RED}✗ NEON_PG_CONN environment variable not set${NC}"
  echo "  Set it in .env.local or export it before running"
  exit 1
fi

# Verify pg_dump is available
if ! command -v pg_dump &> /dev/null; then
  echo -e "${RED}✗ pg_dump not found. Install PostgreSQL client tools.${NC}"
  exit 1
fi

# Create backup directory
mkdir -p "${BACKUP_DIR}"
echo -e "${GREEN}✓${NC} Backup directory: ${BACKUP_DIR}"

# Run backup
echo -e "${YELLOW}→${NC} Starting backup..."
START_TIME=$(date +%s)

pg_dump "${NEON_PG_CONN}" \
  --no-owner \
  --no-privileges \
  --no-comments \
  --if-exists \
  --clean \
  --format=plain \
  --verbose 2>/dev/null \
  | gzip > "${BACKUP_FILE}"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)

echo -e "${GREEN}✓${NC} Backup complete: ${BACKUP_FILE}"
echo -e "${GREEN}✓${NC} Size: ${FILE_SIZE} | Duration: ${DURATION}s"

# Cleanup old backups (retention policy)
echo -e "${YELLOW}→${NC} Cleaning backups older than ${RETENTION_DAYS} days..."
DELETED=$(find "${BACKUP_DIR}" -name "neon_*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
echo -e "${GREEN}✓${NC} Deleted ${DELETED} old backup(s)"

# ── Upload to Cloudflare R2 (offsite copy) ────────────────────────────────────
R2_BUCKET="${R2_BUCKET:-wordisbond01}"
R2_PREFIX="${R2_PREFIX:-backups/db}"
R2_KEY="${R2_PREFIX}/$(basename "${BACKUP_FILE}")"
WRANGLER_CONFIG="${WRANGLER_CONFIG:-workers/wrangler.toml}"

echo ""
echo -e "${YELLOW}→${NC} Uploading backup to R2 (${R2_BUCKET}/${R2_KEY})..."

if command -v npx &> /dev/null; then
  if npx wrangler r2 object put "${R2_BUCKET}/${R2_KEY}" \
      --file "${BACKUP_FILE}" \
      --config "${WRANGLER_CONFIG}" 2>&1; then
    echo -e "${GREEN}✓${NC} R2 upload complete: r2://${R2_BUCKET}/${R2_KEY}"
  else
    echo -e "${YELLOW}⚠${NC}  R2 upload failed — local backup retained at ${BACKUP_FILE}"
    echo "    Ensure CLOUDFLARE_API_TOKEN or wrangler auth is configured."
  fi
else
  echo -e "${YELLOW}⚠${NC}  npx/wrangler not found — skipping R2 upload (local backup retained)"
fi

# List current backups
echo ""
echo -e "${GREEN}Current backups:${NC}"
ls -lh "${BACKUP_DIR}"/neon_*.sql.gz 2>/dev/null | awk '{print "  " $5 "\t" $9}'

echo ""
echo -e "${GREEN}✓ Backup policy complete${NC}"
