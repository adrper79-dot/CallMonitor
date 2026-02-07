#!/usr/bin/env bash
# ============================================================================
# Smoke Test Suite — Automated Manual Test Replacement
# Run: npm run test:smoke
#
# Tests all critical API endpoints against the production Workers API
# Uses curl + jq to verify response codes and JSON structure
#
# Requires: API_BASE_URL (default: https://wordisbond-api.adrper79.workers.dev)
# ============================================================================

set -euo pipefail

API_BASE="${API_BASE_URL:-https://wordisbond-api.adrper79.workers.dev}"
PASS=0
FAIL=0
SKIP=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Word Is Bond - API Smoke Tests         ║${NC}"
echo -e "${GREEN}║   Target: ${API_BASE}${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""

# Test helper function
test_endpoint() {
  local METHOD="$1"
  local PATH="$2"
  local EXPECTED_STATUS="$3"
  local DESCRIPTION="$4"
  local AUTH_HEADER="${5:-}"
  local BODY="${6:-}"

  local CURL_ARGS=(-s -o /tmp/smoke_response.json -w "%{http_code}" -X "$METHOD")

  if [ -n "$AUTH_HEADER" ]; then
    CURL_ARGS+=(-H "Authorization: Bearer $AUTH_HEADER")
  fi

  CURL_ARGS+=(-H "Content-Type: application/json")
  CURL_ARGS+=(-H "Origin: https://voxsouth.online")

  if [ -n "$BODY" ]; then
    CURL_ARGS+=(-d "$BODY")
  fi

  local STATUS
  STATUS=$(curl "${CURL_ARGS[@]}" "${API_BASE}${PATH}" 2>/dev/null || echo "000")

  if [ "$STATUS" = "$EXPECTED_STATUS" ]; then
    echo -e "  ${GREEN}✓${NC} ${METHOD} ${PATH} → ${STATUS} — ${DESCRIPTION}"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} ${METHOD} ${PATH} → ${STATUS} (expected ${EXPECTED_STATUS}) — ${DESCRIPTION}"
    FAIL=$((FAIL + 1))
    # Show response body on failure
    if [ -f /tmp/smoke_response.json ]; then
      echo -e "    ${YELLOW}Response:${NC} $(head -c 200 /tmp/smoke_response.json)"
    fi
  fi
}

# ============================================================================
# Section 1: Public Endpoints (no auth required)
# ============================================================================
echo -e "${YELLOW}[1/5] Public Endpoints${NC}"

test_endpoint GET "/health" "200" "Health check"
test_endpoint GET "/health/analytics" "200" "Analytics health"
test_endpoint GET "/health/webhooks" "200" "Webhooks health"
test_endpoint OPTIONS "/api/auth/signin" "204" "CORS preflight"

echo ""

# ============================================================================
# Section 2: Auth Endpoints (expect 401 without token)
# ============================================================================
echo -e "${YELLOW}[2/5] Auth Boundary (expect 401)${NC}"

test_endpoint GET "/api/billing" "401" "Billing requires auth"
test_endpoint GET "/api/calls" "401" "Calls requires auth"
test_endpoint GET "/api/analytics/kpis" "401" "Analytics requires auth"
test_endpoint GET "/api/usage" "401" "Usage requires auth"
test_endpoint GET "/api/teams" "401" "Teams requires auth"
test_endpoint GET "/api/capabilities" "401" "Capabilities requires auth"

echo ""

# ============================================================================
# Section 3: Auth Flow
# ============================================================================
echo -e "${YELLOW}[3/5] Auth Flow${NC}"

# Attempt signin with test credentials (if TEST_EMAIL and TEST_PASSWORD are set)
if [ -n "${TEST_EMAIL:-}" ] && [ -n "${TEST_PASSWORD:-}" ]; then
  # Sign in to get a token
  SIGNIN_RESPONSE=$(curl -s -X POST "${API_BASE}/api/auth/signin" \
    -H "Content-Type: application/json" \
    -H "Origin: https://voxsouth.online" \
    -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}" 2>/dev/null)
  
  TOKEN=$(echo "$SIGNIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null || echo "")
  
  if [ -n "$TOKEN" ] && [ "$TOKEN" != "" ]; then
    echo -e "  ${GREEN}✓${NC} POST /api/auth/signin → 200 — Sign in successful"
    PASS=$((PASS + 1))

    # Section 4: Authenticated Endpoints
    echo ""
    echo -e "${YELLOW}[4/5] Authenticated Endpoints${NC}"

    test_endpoint GET "/api/billing" "200" "Billing overview" "$TOKEN"
    test_endpoint GET "/api/billing/subscription" "200" "Subscription info" "$TOKEN"
    test_endpoint GET "/api/billing/invoices" "200" "Invoice history" "$TOKEN"
    test_endpoint GET "/api/usage" "200" "Usage stats" "$TOKEN"
    test_endpoint GET "/api/capabilities" "200" "Capabilities" "$TOKEN"
    test_endpoint GET "/api/capabilities/plan" "200" "Plan details" "$TOKEN"
    test_endpoint GET "/api/analytics/kpis" "200" "Analytics KPIs" "$TOKEN"
    test_endpoint GET "/api/calls" "200" "Calls list" "$TOKEN"
    test_endpoint GET "/api/teams" "200" "Team members" "$TOKEN"

    # Section 5: Rate Limiting Verification
    echo ""
    echo -e "${YELLOW}[5/5] Rate Limit Headers${NC}"
    
    HEADERS=$(curl -s -D - -o /dev/null -X GET "${API_BASE}/api/analytics/kpis" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Origin: https://voxsouth.online" 2>/dev/null)
    
    if echo "$HEADERS" | grep -qi "x-ratelimit"; then
      echo -e "  ${GREEN}✓${NC} Rate limit headers present in analytics response"
      PASS=$((PASS + 1))
    else
      echo -e "  ${YELLOW}~${NC} Rate limit headers not detected (may be behind CDN)"
      SKIP=$((SKIP + 1))
    fi
  else
    echo -e "  ${RED}✗${NC} POST /api/auth/signin — Sign in failed"
    FAIL=$((FAIL + 1))
    echo -e "  ${YELLOW}~${NC} Skipping authenticated tests (no token)"
    SKIP=$((SKIP + 9))
  fi
else
  echo -e "  ${YELLOW}~${NC} Skipping auth flow (TEST_EMAIL/TEST_PASSWORD not set)"
  echo -e "  ${YELLOW}  Set: export TEST_EMAIL=... TEST_PASSWORD=... to enable${NC}"
  SKIP=$((SKIP + 10))
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
TOTAL=$((PASS + FAIL + SKIP))
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Results: ${PASS} passed, ${FAIL} failed, ${SKIP} skipped${NC}"
echo -e "${GREEN}║   Total:   ${TOTAL} tests${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
