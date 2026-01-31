#!/bin/bash
# ============================================================================
# Voice Operations API Test Script
# Tests all APIs used by the Voice Operations page
# ============================================================================

# Configuration
BASE_URL="${BASE_URL:-https://voxsouth.online}"
ORG_ID="${ORG_ID:-143a4ad7-403c-4933-a0e6-553b05ca77a2}"
COOKIE="${COOKIE:-}"  # Set this from browser dev tools

echo "============================================"
echo "Voice Operations API Tests"
echo "Base URL: $BASE_URL"
echo "Org ID: $ORG_ID"
echo "============================================"
echo ""

# Helper function to test an endpoint
test_api() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4
    
    echo "Testing: $description"
    echo "  $method $endpoint"
    
    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL$endpoint" \
            -H "Cookie: $COOKIE" \
            -H "Accept: application/json")
    else
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
            -H "Cookie: $COOKIE" \
            -H "Content-Type: application/json" \
            -H "Accept: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo "  ✓ Status: $http_code"
        echo "  Response: $(echo "$body" | head -c 200)..."
    elif [ "$http_code" == "401" ]; then
        echo "  ⚠ Status: $http_code (Auth required - set COOKIE env var)"
    else
        echo "  ✗ Status: $http_code"
        echo "  Response: $body"
    fi
    echo ""
}

# ============================================================================
# Health Check
# ============================================================================
echo "=== Health Checks ==="
test_api GET "/api/health" "Health endpoint"

# ============================================================================
# Auth-Required APIs (need valid session cookie)
# ============================================================================
echo "=== Auth-Required APIs ==="
echo "Note: These require a valid session cookie. Set COOKIE env var from browser."
echo ""

test_api GET "/api/rbac/context?orgId=$ORG_ID" "RBAC Context"
test_api GET "/api/voice/config?orgId=$ORG_ID" "Voice Config"
test_api GET "/api/voice/targets?orgId=$ORG_ID" "Voice Targets"
test_api GET "/api/campaigns?orgId=$ORG_ID" "Campaigns"
test_api GET "/api/calls?orgId=$ORG_ID&limit=5" "Calls List"
test_api GET "/api/call-capabilities?orgId=$ORG_ID" "Call Capabilities"
test_api GET "/api/bookings?limit=5&status=pending" "Bookings"
test_api GET "/api/audit-logs?orgId=$ORG_ID&limit=10" "Audit Logs"
test_api POST "/api/realtime/subscribe" "Realtime Subscribe" "{\"orgId\":\"$ORG_ID\"}"

# ============================================================================
# Summary
# ============================================================================
echo "============================================"
echo "API Test Complete"
echo ""
echo "If you see 401 errors:"
echo "1. Open voxsouth.online in browser"
echo "2. Sign in"
echo "3. Open DevTools > Application > Cookies"
echo "4. Copy all cookies and set COOKIE env var"
echo ""
echo "Example:"
echo "  export COOKIE='next-auth.session-token=xxx; __Secure-next-auth.session-token=xxx'"
echo "  ./test-voice-apis.sh"
echo "============================================"
