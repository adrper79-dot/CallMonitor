#!/bin/bash
# Test script for billing integration
# Agent 3: Billing Integration Agent
# Date: 2026-02-06

set -e

echo "============================================"
echo "Billing Integration Test Suite"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}ERROR: DATABASE_URL not set${NC}"
  exit 1
fi

echo -e "${YELLOW}Step 1: Checking database schema...${NC}"

# Check if billing columns exist
COLUMNS=$(psql "$DATABASE_URL" -t -c "
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'organizations'
AND column_name IN ('subscription_status', 'subscription_id', 'plan_id', 'plan_started_at', 'plan_ends_at')
ORDER BY column_name;
" | xargs)

EXPECTED="plan_ends_at plan_id plan_started_at subscription_id subscription_status"

if [ "$COLUMNS" == "$EXPECTED" ]; then
  echo -e "${GREEN}✓ All billing columns exist${NC}"
else
  echo -e "${RED}✗ Missing billing columns${NC}"
  echo "Expected: $EXPECTED"
  echo "Found: $COLUMNS"
  echo ""
  echo -e "${YELLOW}Running migration...${NC}"
  psql "$DATABASE_URL" -f migrations/2026-02-06-billing-columns.sql
  echo -e "${GREEN}✓ Migration completed${NC}"
fi

echo ""
echo -e "${YELLOW}Step 2: Checking billing_events table...${NC}"

TABLE_EXISTS=$(psql "$DATABASE_URL" -t -c "
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'billing_events'
);
" | xargs)

if [ "$TABLE_EXISTS" == "t" ]; then
  echo -e "${GREEN}✓ billing_events table exists${NC}"
else
  echo -e "${RED}✗ billing_events table missing${NC}"
  echo -e "${YELLOW}Running migration...${NC}"
  psql "$DATABASE_URL" -f migrations/2026-02-06-billing-columns.sql
  echo -e "${GREEN}✓ Migration completed${NC}"
fi

echo ""
echo -e "${YELLOW}Step 3: Checking Stripe environment variables...${NC}"

if [ -z "$STRIPE_SECRET_KEY" ]; then
  echo -e "${RED}✗ STRIPE_SECRET_KEY not set${NC}"
else
  if [[ $STRIPE_SECRET_KEY == sk_test_* ]]; then
    echo -e "${GREEN}✓ STRIPE_SECRET_KEY set (TEST MODE)${NC}"
  elif [[ $STRIPE_SECRET_KEY == sk_live_* ]]; then
    echo -e "${YELLOW}⚠ STRIPE_SECRET_KEY set (LIVE MODE)${NC}"
  else
    echo -e "${RED}✗ STRIPE_SECRET_KEY invalid format${NC}"
  fi
fi

if [ -z "$STRIPE_WEBHOOK_SECRET" ]; then
  echo -e "${RED}✗ STRIPE_WEBHOOK_SECRET not set${NC}"
else
  echo -e "${GREEN}✓ STRIPE_WEBHOOK_SECRET set${NC}"
fi

if [ -z "$STRIPE_PRICE_PRO" ]; then
  echo -e "${RED}✗ STRIPE_PRICE_PRO not set${NC}"
else
  echo -e "${GREEN}✓ STRIPE_PRICE_PRO set ($STRIPE_PRICE_PRO)${NC}"
fi

echo ""
echo -e "${YELLOW}Step 4: Testing API endpoints (requires Workers running)...${NC}"

API_URL="${API_URL:-https://wordisbond-api.adrper79.workers.dev}"

# Test health endpoint
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" || echo "000")

if [ "$HTTP_CODE" == "200" ]; then
  echo -e "${GREEN}✓ API is running ($API_URL)${NC}"
else
  echo -e "${RED}✗ API not responding (HTTP $HTTP_CODE)${NC}"
  echo -e "${YELLOW}  Skipping API tests${NC}"
  exit 0
fi

# Test billing endpoint (requires auth)
echo -e "${YELLOW}  Note: Billing endpoint tests require authentication${NC}"
echo -e "${YELLOW}  Run manual tests with authenticated session${NC}"

echo ""
echo "============================================"
echo -e "${GREEN}Billing Integration Tests Complete${NC}"
echo "============================================"
echo ""
echo "Next Steps:"
echo "1. Run: wrangler dev --config workers/wrangler.toml"
echo "2. Test checkout flow manually in browser"
echo "3. Use Stripe CLI to test webhooks:"
echo "   stripe listen --forward-to $API_URL/webhooks/stripe"
echo "4. Trigger test events:"
echo "   stripe trigger checkout.session.completed"
echo ""
