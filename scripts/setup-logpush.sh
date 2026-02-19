#!/usr/bin/env bash
# =============================================================================
# scripts/setup-logpush.sh
# Configures Cloudflare Logpush to ship Workers trace events to Axiom.
#
# What it does:
#   1. Validates required env vars
#   2. Verifies the Axiom dataset and API token
#   3. Creates/updates a Logpush job on your Cloudflare account
#
# Prerequisites — set these before running:
#   export CF_API_TOKEN="<CF token with Logs:Edit on your account>"
#   export CF_ACCOUNT_ID="<Cloudflare account ID>"
#   export AXIOM_API_TOKEN="<Axiom API token (axiom.co → Settings → API Tokens)>"
#   export AXIOM_DATASET="cloudflare-logpush"   # or your dataset name
#
# Usage:
#   chmod +x scripts/setup-logpush.sh
#   ./scripts/setup-logpush.sh
#
# Idempotent: safe to run multiple times — updates an existing job if found.
# =============================================================================
set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
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
for VAR in CF_API_TOKEN CF_ACCOUNT_ID AXIOM_API_TOKEN AXIOM_DATASET; do
  if [[ -z "${!VAR:-}" ]]; then
    log_error "Required env var not set: $VAR"
    MISSING=$((MISSING + 1))
  fi
done
if [[ $MISSING -gt 0 ]]; then
  echo
  echo "Set the missing variables and re-run:"
  echo "  export CF_API_TOKEN=\"...\""
  echo "  export CF_ACCOUNT_ID=\"...\""
  echo "  export AXIOM_API_TOKEN=\"...\""
  echo "  export AXIOM_DATASET=\"cloudflare-logpush\""
  exit 1
fi

CF_BASE="https://api.cloudflare.com/client/v4"
AXIOM_BASE="https://api.axiom.co"
WORKERS_SCRIPT_NAME="${CF_WORKERS_SCRIPT_NAME:-wordisbond-api}"

# ─── 1. Verify Axiom dataset ─────────────────────────────────────────────────
log_info "Verifying Axiom dataset: ${AXIOM_DATASET}"
AXIOM_CHECK=$(curl -sf \
  -H "Authorization: Bearer ${AXIOM_API_TOKEN}" \
  -H "Content-Type: application/json" \
  "${AXIOM_BASE}/v1/datasets/${AXIOM_DATASET}" 2>&1) || {
  log_warn "Dataset '${AXIOM_DATASET}' not found — creating it..."
  CREATE_RESP=$(curl -sf -X POST \
    -H "Authorization: Bearer ${AXIOM_API_TOKEN}" \
    -H "Content-Type: application/json" \
    "${AXIOM_BASE}/v1/datasets" \
    -d "{\"name\": \"${AXIOM_DATASET}\", \"description\": \"Word Is Bond — Cloudflare Workers logs\"}")
  echo "$CREATE_RESP" | grep -q '"id"' \
    && log_ok "Dataset '${AXIOM_DATASET}' created." \
    || { log_error "Failed to create Axiom dataset. Response: $CREATE_RESP"; exit 1; }
}
log_ok "Axiom dataset '${AXIOM_DATASET}' is ready."

# ─── 2. Build destination URL ─────────────────────────────────────────────────
# Axiom ingest endpoint — Cloudflare Logpush HTTP destination format.
# The `Authorization` header is passed as a URL-encoded query parameter so
# Cloudflare's Logpush infrastructure can embed it without a secrets manager.
ENCODED_AUTH=$(python3 -c \
  "import urllib.parse; print(urllib.parse.quote('Bearer ${AXIOM_API_TOKEN}', safe=''))" \
  2>/dev/null || node -e \
  "console.log(encodeURIComponent('Bearer ${AXIOM_API_TOKEN}'))")

DEST_CONF="${AXIOM_BASE}/v1/datasets/${AXIOM_DATASET}/ingest?header_Authorization=${ENCODED_AUTH}"

# Workers Trace Events fields — all fields the Workers runtime emits.
# Ref: https://developers.cloudflare.com/logs/reference/log-fields/account/workers-trace-events/
FIELDS="DispatchNamespace,EntryPoint,Event,EventTimestampMs,ExecutionModel,\
Exceptions,Logs,Outcome,ScriptName,ScriptTags,ScriptVersion,TriggerDispatch"

# ─── 3. Check for existing Logpush job ───────────────────────────────────────
log_info "Checking for existing Logpush jobs on account ${CF_ACCOUNT_ID}..."
JOBS=$(curl -sf \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  "${CF_BASE}/accounts/${CF_ACCOUNT_ID}/logpush/jobs")

EXISTING_JOB_ID=$(echo "$JOBS" | \
  python3 -c "
import json, sys
jobs = json.load(sys.stdin).get('result', [])
match = next((j for j in jobs if 'axiom' in j.get('destination_conf','').lower()), None)
print(match['id'] if match else '')
" 2>/dev/null || echo "")

# ─── 4. Create or update the Logpush job ─────────────────────────────────────
JOB_PAYLOAD=$(cat <<JSON
{
  "name": "wordisbond-workers-to-axiom",
  "destination_conf": "${DEST_CONF}",
  "dataset": "workers_trace_events",
  "logpull_options": "fields=${FIELDS}&timestamps=rfc3339",
  "filter": "{\"where\":{\"key\":\"ScriptName\",\"operator\":\"eq\",\"value\":\"${WORKERS_SCRIPT_NAME}\"}}",
  "frequency": "low",
  "enabled": true
}
JSON
)

if [[ -n "$EXISTING_JOB_ID" ]]; then
  log_info "Updating existing Logpush job ID: ${EXISTING_JOB_ID}"
  RESP=$(curl -sf -X PUT \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    "${CF_BASE}/accounts/${CF_ACCOUNT_ID}/logpush/jobs/${EXISTING_JOB_ID}" \
    -d "$JOB_PAYLOAD")
else
  log_info "Creating new Logpush job: wordisbond-workers-to-axiom"
  RESP=$(curl -sf -X POST \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    "${CF_BASE}/accounts/${CF_ACCOUNT_ID}/logpush/jobs" \
    -d "$JOB_PAYLOAD")
fi

# ─── 5. Validate response ─────────────────────────────────────────────────────
SUCCESS=$(echo "$RESP" | python3 -c \
  "import json,sys; d=json.load(sys.stdin); print(str(d.get('success',False)).lower())" \
  2>/dev/null || echo "false")

if [[ "$SUCCESS" == "true" ]]; then
  JOB_ID=$(echo "$RESP" | python3 -c \
    "import json,sys; print(json.load(sys.stdin)['result']['id'])" 2>/dev/null || echo "unknown")
  log_ok "Logpush job configured successfully (ID: ${JOB_ID})"
else
  ERRORS=$(echo "$RESP" | python3 -c \
    "import json,sys; d=json.load(sys.stdin); print(d.get('errors',''))" 2>/dev/null || echo "$RESP")
  log_error "Logpush job creation failed: ${ERRORS}"
  exit 1
fi

# ─── 6. Store AXIOM_API_TOKEN as Workers secret ───────────────────────────────
echo
log_info "Setting AXIOM_API_TOKEN as a Workers secret..."
echo "${AXIOM_API_TOKEN}" | npx wrangler secret put AXIOM_API_TOKEN \
  --config workers/wrangler.toml 2>/dev/null \
  && log_ok "AXIOM_API_TOKEN secret stored in Workers." \
  || log_warn "Could not auto-set AXIOM_API_TOKEN via wrangler — set it manually:"
  echo "   echo '${AXIOM_API_TOKEN}' | npx wrangler secret put AXIOM_API_TOKEN --config workers/wrangler.toml"

# ─── 7. Summary ───────────────────────────────────────────────────────────────
echo
echo -e "${GRN}════════════════════════════════════════════════════════${RST}"
echo -e "${GRN} Logpush → Axiom configured (Item 0.1 DONE)${RST}"
echo -e "${GRN}════════════════════════════════════════════════════════${RST}"
echo
echo "  Dataset:     ${AXIOM_DATASET}"
echo "  Worker:      ${WORKERS_SCRIPT_NAME}"
echo "  Fields:      ${FIELDS}"
echo "  Frequency:   low (batch, ~30s)"
echo
echo "Next steps:"
echo "  1. Visit https://app.axiom.co → Datasets → ${AXIOM_DATASET} to confirm logs arrive."
echo "  2. Create a dashboard in Axiom: filter by Outcome, group by ScriptName."
echo "  3. Set AXIOM_DATASET=${AXIOM_DATASET} in workers/wrangler.toml [vars]."
echo
