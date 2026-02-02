#!/bin/bash
# Truth Script: Tiered Test Runs + Health Checks
# Ensures tests are truthful and deployment-ready

set -e

echo "🎯 WordIsBond Truth Script - Tiered Testing"
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
RESULTS=()

# Function to run test tier and track results
run_tier() {
    local tier_name="$1"
    local test_command="$2"
    local description="$3"
    
    echo -e "\n${BLUE}🧪 Testing: ${tier_name}${NC}"
    echo -e "${YELLOW}   ${description}${NC}"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ ${tier_name} PASSED${NC}"
        RESULTS+=("✅ $tier_name")
        return 0
    else
        echo -e "${RED}❌ ${tier_name} FAILED${NC}"
        RESULTS+=("❌ $tier_name")
        return 1
    fi
}

# Tier 1: Core Infrastructure (Must Always Pass)
run_tier "Tier 1: Core" \
    "npx vitest tests/tier1-core.test.ts --run --reporter=basic" \
    "Basic utilities, environment, mocking infrastructure"

# Tier 2: Unit Tests
run_tier "Tier 2: Units" \
    "npx vitest tests/unit/*.test.ts --run --reporter=basic" \
    "Individual component and function tests"

# Tier 3: Integration Tests  
run_tier "Tier 3: Integration" \
    "npx vitest tests/integration/*.test.ts --run --reporter=basic" \
    "Cross-component workflow tests"

# Tier 4: Production Health
echo -e "\n${BLUE}🏥 Health Checks${NC}"

# Local health (if running)
if curl -f http://localhost:3000/api/health &>/dev/null; then
    echo -e "${GREEN}✅ Local health check passed${NC}"
    RESULTS+=("✅ Local Health")
else
    echo -e "${YELLOW}⚠️  Local dev server not running (expected)${NC}"
    RESULTS+=("⚠️  Local Health (N/A)")
fi

# Production health
if curl -f https://wordisbond-production.adrper79.workers.dev/api/health &>/dev/null; then
    echo -e "${GREEN}✅ Production health check passed${NC}"
    RESULTS+=("✅ Production Health")
else
    echo -e "${RED}❌ Production health check failed${NC}"
    RESULTS+=("❌ Production Health")
fi

# Tier 5: Deployment Validation
run_tier "Tier 5: Deploy Check" \
    "npx wrangler deploy --dry-run" \
    "Validate Cloudflare Workers deployment configuration"

# Summary Report
echo -e "\n${BLUE}📊 Truth Script Results${NC}"
echo "========================"

failed_count=0
for result in "${RESULTS[@]}"; do
    if [[ $result == *"❌"* ]]; then
        echo -e "${RED}$result${NC}"
        ((failed_count++))
    elif [[ $result == *"⚠️"* ]]; then
        echo -e "${YELLOW}$result${NC}"
    else
        echo -e "${GREEN}$result${NC}"
    fi
done

total_count=${#RESULTS[@]}
pass_count=$((total_count - failed_count))
pass_rate=$((pass_count * 100 / total_count))

echo -e "\n${BLUE}Overall: $pass_count/$total_count passed (${pass_rate}%)${NC}"

if [ $failed_count -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Ready for deployment.${NC}"
    exit 0
elif [ $pass_rate -ge 80 ]; then
    echo -e "${YELLOW}⚠️  Most tests passed. Review failures before deploy.${NC}"
    exit 1
else
    echo -e "${RED}🚨 Significant test failures. Do not deploy.${NC}"
    exit 1
fi