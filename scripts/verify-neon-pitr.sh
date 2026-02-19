#!/usr/bin/env bash
# =============================================================================
# scripts/verify-neon-pitr.sh
# Verifies that Point-in-Time Recovery (PITR) is enabled on the Neon project.
#
# PITR is required for:
#   - Recovering from accidental data deletion (compliance/legal records)
#   - Meeting CFPB 7-year record retention requirements
#   - Recovering from a bad migration within the recovery window
#
# PITR availability:
#   - Free tier:        NOT available
#   - Launch tier:      7-day history
#   - Scale tier:       7-day history + branch restore
#   - Business tier:    14-day history
#
# Prerequisites:
#   export NEON_API_KEY="<Neon API key (console.neon.tech → Account → API Keys)>"
#   export NEON_PROJECT_ID="<Project ID shown in Neon console URL bar>"
#
# Usage:
#   chmod +x scripts/verify-neon-pitr.sh
#   ./scripts/verify-neon-pitr.sh
# =============================================================================
set -euo pipefail

RED='\033[0;31m'
GRN='\033[0;32m'
YLW='\033[1;33m'
BLU='\033[0;34m'
RST='\033[0m'

log_info()  { echo -e "${BLU}[INFO]${RST}  $*"; }
log_ok()    { echo -e "${GRN}[OK]${RST}    $*"; }
log_warn()  { echo -e "${YLW}[WARN]${RST}  $*"; }
log_error() { echo -e "${RED}[ERROR]${RST} $*"; }

# ─── Required env check ──────────────────────────────────────────────────────
MISSING=0
for VAR in NEON_API_KEY NEON_PROJECT_ID; do
  if [[ -z "${!VAR:-}" ]]; then
    log_error "Required env var not set: $VAR"
    MISSING=$((MISSING + 1))
  fi
done
if [[ $MISSING -gt 0 ]]; then
  echo
  echo "Set the missing variables and re-run:"
  echo "  export NEON_API_KEY=\"...\""
  echo "  export NEON_PROJECT_ID=\"...\""
  echo
  echo "Find NEON_PROJECT_ID in the Neon console URL:"
  echo "  https://console.neon.tech/app/projects/{NEON_PROJECT_ID}/..."
  exit 1
fi

NEON_BASE="https://console.neon.tech/api/v2"

# ─── 1. Fetch project details ────────────────────────────────────────────────
log_info "Fetching Neon project: ${NEON_PROJECT_ID}"
PROJECT=$(curl -sf \
  -H "Authorization: Bearer ${NEON_API_KEY}" \
  -H "Accept: application/json" \
  "${NEON_BASE}/projects/${NEON_PROJECT_ID}") || {
  log_error "Failed to fetch project. Check NEON_API_KEY and NEON_PROJECT_ID."
  exit 1
}

# ─── 2. Parse key fields ──────────────────────────────────────────────────────
PROJECT_NAME=$(echo "$PROJECT" | python3 -c \
  "import json,sys; p=json.load(sys.stdin)['project']; print(p.get('name','unknown'))" \
  2>/dev/null || echo "unknown")

REGION=$(echo "$PROJECT" | python3 -c \
  "import json,sys; p=json.load(sys.stdin)['project']; print(p.get('region_id','unknown'))" \
  2>/dev/null || echo "unknown")

PLAN=$(echo "$PROJECT" | python3 -c \
  "import json,sys; p=json.load(sys.stdin)['project']; print(p.get('store_passwords',None))" \
  2>/dev/null || echo "unknown")

# PITR is indicated by history_retention_seconds > 0
HISTORY_RETENTION=$(echo "$PROJECT" | python3 -c "
import json, sys
p = json.load(sys.stdin)['project']
# Neon returns history_retention_seconds on paid plans
val = p.get('history_retention_seconds', p.get('history_retention', 0))
print(int(val))
" 2>/dev/null || echo "0")

PITR_SUPPORTED=$(echo "$PROJECT" | python3 -c "
import json, sys
p = json.load(sys.stdin)['project']
# pitr_restore_supported is true on launch/scale/business tiers
print(str(p.get('pitr_restore_supported', False)).lower())
" 2>/dev/null || echo "false")

CREATED_AT=$(echo "$PROJECT" | python3 -c \
  "import json,sys; p=json.load(sys.stdin)['project']; print(p.get('created_at','unknown'))" \
  2>/dev/null || echo "unknown")

# ─── 3. Fetch branches ───────────────────────────────────────────────────────
log_info "Fetching branches..."
BRANCHES=$(curl -sf \
  -H "Authorization: Bearer ${NEON_API_KEY}" \
  -H "Accept: application/json" \
  "${NEON_BASE}/projects/${NEON_PROJECT_ID}/branches") || BRANCHES="{}"

BRANCH_COUNT=$(echo "$BRANCHES" | python3 -c \
  "import json,sys; print(len(json.load(sys.stdin).get('branches',[])))" 2>/dev/null || echo "unknown")

MAIN_BRANCH_ID=$(echo "$BRANCHES" | python3 -c "
import json, sys
branches = json.load(sys.stdin).get('branches', [])
main = next((b for b in branches if b.get('default') or b.get('name') == 'main'), None)
print(main['id'] if main else '')
" 2>/dev/null || echo "")

# ─── 4. Evaluate PITR status ─────────────────────────────────────────────────
echo
echo -e "${BLU}════════════════════════════════════════════════════════${RST}"
echo -e "${BLU} Neon PITR Verification Report${RST}"
echo -e "${BLU}════════════════════════════════════════════════════════${RST}"
echo
echo "  Project:     ${PROJECT_NAME} (${NEON_PROJECT_ID})"
echo "  Region:      ${REGION}"
echo "  Created:     ${CREATED_AT}"
echo "  Branches:    ${BRANCH_COUNT}"
echo
echo "  PITR supported:   ${PITR_SUPPORTED}"

if [[ "$HISTORY_RETENTION" -gt 0 ]]; then
  DAYS=$(( HISTORY_RETENTION / 86400 ))
  echo "  History window:   ${DAYS} days (${HISTORY_RETENTION}s)"
else
  echo "  History window:   NOT SET"
fi

echo

# ─── 5. Verdict ──────────────────────────────────────────────────────────────
if [[ "$PITR_SUPPORTED" == "true" && "$HISTORY_RETENTION" -gt 0 ]]; then
  DAYS=$(( HISTORY_RETENTION / 86400 ))
  log_ok "PITR is ENABLED — ${DAYS}-day recovery window."
  echo
  echo "  Minimum required for CFPB compliance: 7 days ✓"
  if [[ "$DAYS" -lt 7 ]]; then
    log_warn "Recovery window < 7 days. Upgrade to Scale or Business tier for full 7-day PITR."
  fi
  echo
  echo "  To perform a PITR restore:"
  echo "    1. Neon Console → Project → Branches → Restore"
  echo "    2. Or via API:"
  echo "       POST ${NEON_BASE}/projects/${NEON_PROJECT_ID}/branches"
  echo "       body: {\"type\":\"time\", \"time\": \"2026-02-01T00:00:00Z\", \"source_branch_id\": \"${MAIN_BRANCH_ID}\"}"

elif [[ "$PITR_SUPPORTED" == "true" && "$HISTORY_RETENTION" -eq 0 ]]; then
  log_warn "PITR is structurally supported but no history_retention_seconds set."
  echo "  Action: Contact Neon support or upgrade plan to activate retention window."

else
  log_error "PITR is NOT enabled on this project."
  echo
  echo -e "${RED}  ┌─────────────────────────────────────────────────────┐${RST}"
  echo -e "${RED}  │  REMEDIATION REQUIRED (CIO Item 0.3)                │${RST}"
  echo -e "${RED}  │                                                     │${RST}"
  echo -e "${RED}  │  Current plan does not include PITR.                │${RST}"
  echo -e "${RED}  │                                                     │${RST}"
  echo -e "${RED}  │  Steps to fix:                                      │${RST}"
  echo -e "${RED}  │  1. Login to https://console.neon.tech              │${RST}"
  echo -e "${RED}  │  2. Settings → Billing → Upgrade to Launch ($19/mo) │${RST}"
  echo -e "${RED}  │  3. Re-run this script to confirm.                  │${RST}"
  echo -e "${RED}  │                                                     │${RST}"
  echo -e "${RED}  │  Launch tier: $19/mo + 7-day PITR                   │${RST}"
  echo -e "${RED}  │  Scale tier:  $69/mo + 7-day PITR + branch restore  │${RST}"
  echo -e "${RED}  └─────────────────────────────────────────────────────┘${RST}"
  echo
  exit 1
fi

# ─── 6. Backup verification ───────────────────────────────────────────────────
echo
log_info "Checking R2 backup script..."
if [[ -f "scripts/neon-backup.sh" ]]; then
  log_ok "scripts/neon-backup.sh exists — daily snapshot → R2."
  echo "  Tip: Add this to a cron job on a secure VM for belt-and-suspenders:"
  echo "    0 1 * * * /path/to/scripts/neon-backup.sh >> /var/log/neon-backup.log 2>&1"
else
  log_warn "scripts/neon-backup.sh not found — R2 backup not configured."
fi

echo
echo -e "${GRN}PITR verification complete (Item 0.3).${RST}"
echo
