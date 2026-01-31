#!/bin/bash
# ============================================================================
# VOICE OPERATIONS API TEST SCRIPT
# ============================================================================
# Tests all APIs required for Voice Operations page
# Usage: ./scripts/test-voice-ops-apis.sh
# ============================================================================

BASE_URL="https://voxsouth.online"
ORG_ID="143a4ad7-403c-4933-a0e6-553b05ca77a2"
USER_EMAIL="stepdadstrong@gmail.com"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "═══════════════════════════════════════════════════════════════════════"
echo "VOICE OPERATIONS API TESTS"
echo "═══════════════════════════════════════════════════════════════════════"
echo "Base URL: $BASE_URL"
echo "Org ID: $ORG_ID"
echo "User: $USER_EMAIL"
echo ""

# Function to test API endpoint
test_api() {
  local name=$1
  local url=$2
  local expected_status=$3
  
  echo -n "Testing $name... "
  
  response=$(curl -s -w "\n%{http_code}" "$url")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  
  if [ "$http_code" -eq "$expected_status" ]; then
    echo -e "${GREEN}✅ $http_code${NC}"
    echo "$body" | jq -C '.' 2>/dev/null || echo "$body"
  else
    echo -e "${RED}❌ $http_code (expected $expected_status)${NC}"
    echo "$body" | jq -C '.' 2>/dev/null || echo "$body"
  fi
  echo ""
}

# ============================================================================
# 1. HEALTH CHECK
# ============================================================================

echo "1️⃣  Health Check"
echo "────────────────────────────────────────────────────────────────────"
test_api "Health endpoint" "$BASE_URL/api/health" 200

# ============================================================================
# 2. RBAC CONTEXT
# ============================================================================

echo "2️⃣  RBAC Context (requires auth)"
echo "────────────────────────────────────────────────────────────────────"
echo "NOTE: This requires authentication cookie"
echo "To test: Open browser DevTools -> Application -> Cookies -> Copy next-auth.session-token"
echo ""
echo "curl '$BASE_URL/api/rbac/context?orgId=$ORG_ID' \\"
echo "  -H 'Cookie: next-auth.session-token=YOUR_TOKEN_HERE'"
echo ""

# ============================================================================
# 3. VOICE TARGETS
# ============================================================================

echo "3️⃣  Voice Targets (requires auth)"
echo "────────────────────────────────────────────────────────────────────"
echo "Endpoint: GET $BASE_URL/api/voice/targets?orgId=$ORG_ID"
echo "Expected: 200 with { success: true, targets: [...] }"
echo ""
echo "curl '$BASE_URL/api/voice/targets?orgId=$ORG_ID' \\"
echo "  -H 'Cookie: next-auth.session-token=YOUR_TOKEN_HERE'"
echo ""

# ============================================================================
# 4. CAMPAIGNS
# ============================================================================

echo "4️⃣  Campaigns (requires auth)"
echo "────────────────────────────────────────────────────────────────────"
echo "Endpoint: GET $BASE_URL/api/campaigns?orgId=$ORG_ID"
echo "Expected: 200 with { success: true, campaigns: [...] }"
echo "Note: Returns empty array if campaigns table doesn't exist"
echo ""
echo "curl '$BASE_URL/api/campaigns?orgId=$ORG_ID' \\"
echo "  -H 'Cookie: next-auth.session-token=YOUR_TOKEN_HERE'"
echo ""

# ============================================================================
# 5. VOICE CONFIG
# ============================================================================

echo "5️⃣  Voice Config (requires auth)"
echo "────────────────────────────────────────────────────────────────────"
echo "Endpoint: GET $BASE_URL/api/voice/config?orgId=$ORG_ID"
echo "Expected: 200 with voice configuration"
echo ""
echo "curl '$BASE_URL/api/voice/config?orgId=$ORG_ID' \\"
echo "  -H 'Cookie: next-auth.session-token=YOUR_TOKEN_HERE'"
echo ""

# ============================================================================
# 6. CALL CAPABILITIES
# ============================================================================

echo "6️⃣  Call Capabilities (requires auth)"
echo "────────────────────────────────────────────────────────────────────"
echo "Endpoint: GET $BASE_URL/api/call-capabilities?orgId=$ORG_ID"
echo "Expected: 200 with feature flags"
echo ""
echo "curl '$BASE_URL/api/call-capabilities?orgId=$ORG_ID' \\"
echo "  -H 'Cookie: next-auth.session-token=YOUR_TOKEN_HERE'"
echo ""

# ============================================================================
# 7. SURVEYS
# ============================================================================

echo "7️⃣  Surveys (requires auth)"
echo "────────────────────────────────────────────────────────────────────"
echo "Endpoint: GET $BASE_URL/api/surveys?orgId=$ORG_ID"
echo "Expected: 200 with surveys list"
echo ""
echo "curl '$BASE_URL/api/surveys?orgId=$ORG_ID' \\"
echo "  -H 'Cookie: next-auth.session-token=YOUR_TOKEN_HERE'"
echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo "═══════════════════════════════════════════════════════════════════════"
echo "TESTING INSTRUCTIONS"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""
echo "1. Get your authentication token:"
echo "   a. Open https://voxsouth.online in browser"
echo "   b. Open DevTools (F12)"
echo "   c. Go to Application tab -> Cookies"
echo "   d. Copy the value of 'next-auth.session-token'"
echo ""
echo "2. Run the curl commands above, replacing YOUR_TOKEN_HERE"
echo ""
echo "3. Expected results:"
echo "   ✅ All endpoints return 200 status"
echo "   ✅ All responses have { success: true }"
echo "   ✅ Empty arrays are OK (e.g., no targets/campaigns yet)"
echo "   ❌ 401 = Not authenticated"
echo "   ❌ 403 = Not authorized for this org"
echo "   ❌ 500 = Server error (check Vercel logs)"
echo ""
echo "═══════════════════════════════════════════════════════════════════════"
