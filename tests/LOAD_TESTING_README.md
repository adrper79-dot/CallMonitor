# Load Testing Quick Start Guide

**Version:** 1.0 | **Date:** February 11, 2026

A practical guide to running load tests for the Word Is Bond platform.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Test Suite Overview](#test-suite-overview)
- [Running Specific Tests](#running-specific-tests)
- [k6 Script Usage](#k6-script-usage)
- [Performance Baselines](#performance-baselines)
- [What to Do If Tests Fail](#what-to-do-if-tests-fail)

---

## Quick Start

### Prerequisites

1. **Install k6:**
   ```bash
   # macOS
   brew install k6

   # Windows
   choco install k6

   # Linux
   sudo apt-get install k6
   ```

2. **Set environment variables:**
   ```bash
   # Create .env.test file
   cat > .env.test << EOF
   API_BASE_URL=https://wordisbond-api.adrper79.workers.dev
   TEST_USER_EMAIL=load-test@wordis-bond.com
   TEST_USER_PASSWORD=your-secure-password
   TEST_ORG_ID=your-test-org-id
   EOF

   # Load variables
   export $(cat .env.test | xargs)
   ```

3. **Verify setup:**
   ```bash
   # Check API is reachable
   curl $API_BASE_URL/health

   # Verify auth works
   curl -X POST $API_BASE_URL/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"'$TEST_USER_EMAIL'","password":"'$TEST_USER_PASSWORD'"}'
   ```

### Run Your First Load Test

```bash
# Smoke test (quick sanity check)
k6 run tests/load/smoke.k6.js

# Baseline test (10 minutes, 50 users)
k6 run tests/load/baseline.k6.js

# View results
cat results/baseline-$(date +%Y%m%d).json | jq .
```

---

## Test Suite Overview

### Test Levels (L1-L4 + Load)

| Level | Test File | Purpose | Runtime | VUs |
|-------|-----------|---------|---------|-----|
| **L1** | `production/api-live.test.ts` | Route reachability | 30s | N/A |
| **L2** | `production/feature-validation.test.ts` | Auth verification | 1 min | N/A |
| **L3** | `production/bridge-crossing.test.ts` | Functional correctness | 3 min | N/A |
| **L4** | `production/ai-optimization-l4.test.ts` | Cross-cutting concerns | 5 min | N/A |
| **Load** | `load/*.k6.js` | Performance & scalability | Varies | 10-1000 |

### Load Test Types

```
tests/load/
├── smoke.k6.js          # Quick sanity (1 min, 10 VUs)
├── baseline.k6.js       # Normal traffic (10 min, 50 VUs)
├── peak.k6.js           # Peak hours (5 min, 200 VUs)
├── spike.k6.js          # Traffic surge (8 min, 10→500→10 VUs)
├── stress.k6.js         # Find limits (20 min, 50→1000+ VUs)
├── soak.k6.js           # 24h endurance (24h, 100 VUs)
└── scenarios/
    ├── auth.js          # Authentication flows
    ├── calls.js         # Call operations
    ├── analytics.js     # Analytics queries
    └── voice.js         # Voice operations
```

---

## Running Specific Tests

### Unit and Integration Tests (L1-L4)

```bash
# L1: Route reachability
npm run test:live:api

# L2: Auth verification
npm run test:validate

# L3: Functional correctness
npm run test:bridge

# L4: Cross-cutting concerns
npm run test:live:all

# Run all functional tests
npm run test:validate:full
```

### Load Tests (k6)

```bash
# Smoke test (fastest)
npm run test:load:smoke

# Baseline load test
npm run test:load:baseline

# Peak traffic test
npm run test:load:peak

# Spike test
npm run test:load:spike

# Stress test (find breaking point)
npm run test:load:stress

# Soak test (24 hours - run overnight)
npm run test:load:soak

# Run all load tests (excluding soak)
npm run test:load:all
```

### Custom k6 Runs

```bash
# Run with custom VUs and duration
k6 run --vus 100 --duration 5m tests/load/baseline.k6.js

# Run specific scenario
k6 run --scenario calls tests/load/baseline.k6.js

# Output to JSON
k6 run --out json=results.json tests/load/baseline.k6.js

# Real-time dashboard (k6 cloud)
k6 cloud tests/load/baseline.k6.js

# Debug mode (verbose output)
k6 run --verbose tests/load/baseline.k6.js
```

---

## k6 Script Usage

### Basic k6 Script Structure

```javascript
// tests/load/example.k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  vus: 50,                // 50 concurrent users
  duration: '10m',        // Run for 10 minutes
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% < 500ms
    errors: ['rate<0.001'],           // < 0.1% errors
  },
};

// Setup (runs once per VU at start)
export function setup() {
  const res = http.post(`${__ENV.API_BASE_URL}/api/auth/login`, {
    email: __ENV.TEST_USER_EMAIL,
    password: __ENV.TEST_USER_PASSWORD,
  });

  return { token: res.json('session.id') };
}

// Main test (runs repeatedly during test)
export default function(data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // Make API request
  const res = http.get(`${__ENV.API_BASE_URL}/api/users/me`, { headers });

  // Check response
  check(res, {
    'status 200': (r) => r.status === 200,
    'has user data': (r) => r.json('user') !== undefined,
  }) || errorRate.add(1);

  // Think time (simulate user delay)
  sleep(1);
}

// Teardown (runs once at end)
export function teardown(data) {
  console.log('Test complete');
}
```

### Scenario-Based Testing

```javascript
// tests/load/scenarios.k6.js
export const options = {
  scenarios: {
    // Scenario 1: Constant load
    baseline: {
      executor: 'constant-vus',
      vus: 50,
      duration: '10m',
    },

    // Scenario 2: Ramping load
    ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up
        { duration: '5m', target: 50 },   // Stay at 50
        { duration: '2m', target: 100 },  // Ramp to 100
        { duration: '1m', target: 0 },    // Ramp down
      ],
    },

    // Scenario 3: Fixed iterations
    smoke: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 100,
    },
  },
};
```

### Custom Checks and Metrics

```javascript
import { check } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// Define custom metrics
const callsStarted = new Counter('calls_started');
const callLatency = new Trend('call_latency');
const errorRate = new Rate('errors');

export default function() {
  const start = Date.now();

  const res = http.post(`${__ENV.API_BASE_URL}/api/calls/start`, {
    phone: '+12025551234',
  }, { headers });

  const duration = Date.now() - start;

  // Record metrics
  callsStarted.add(1);
  callLatency.add(duration);

  // Custom checks
  const ok = check(res, {
    'call started': (r) => r.status === 200,
    'has call_id': (r) => r.json('call_id') !== undefined,
    'latency < 2s': (r) => duration < 2000,
  });

  if (!ok) errorRate.add(1);
}
```

---

## Performance Baselines

### Current System Performance (as of Feb 2026)

#### API Response Times (p95)

| Endpoint | p50 | p95 | p99 | Status |
|----------|-----|-----|-----|--------|
| `GET /api/users/me` | 120ms | 280ms | 450ms | ✅ Excellent |
| `GET /api/organizations/current` | 140ms | 320ms | 500ms | ✅ Excellent |
| `GET /api/voice/config` | 150ms | 350ms | 550ms | ✅ Excellent |
| `GET /api/calls` | 180ms | 420ms | 700ms | ✅ Good |
| `GET /api/analytics/kpis` | 250ms | 600ms | 1000ms | ✅ Good |
| `POST /api/calls/start` | 400ms | 950ms | 1500ms | ✅ Acceptable |
| `POST /api/bond-ai/chat` | 800ms | 1800ms | 3000ms | ⚠️ Slow (LLM) |

#### Load Test Results

| Test | VUs | Duration | RPS | p95 Latency | Error Rate | Status |
|------|-----|----------|-----|-------------|------------|--------|
| **Smoke** | 10 | 1m | 20 | 300ms | 0% | ✅ Pass |
| **Baseline** | 50 | 10m | 100 | 500ms | 0.05% | ✅ Pass |
| **Peak** | 200 | 5m | 350 | 900ms | 0.2% | ✅ Pass |
| **Spike** | 10→500→10 | 8m | 150 avg | 1200ms | 0.5% | ✅ Pass |
| **Stress** | 50→800 | 20m | 400 peak | 1800ms | 1% @ 800 | ⚠️ Limit |

#### System Limits

| Resource | Current | Limit | Headroom |
|----------|---------|-------|----------|
| **Database Connections** | 10-20 | 100 | 80% |
| **Workers RPS** | 100-400 | 10,000+ | 95%+ |
| **KV Operations** | 50/s | 1,000/s | 95% |
| **R2 Operations** | 10/s | 10,000/s | 99%+ |

### Expected Performance Degradation

| Load Level | p95 Latency | Error Rate | Degradation |
|------------|-------------|------------|-------------|
| **Normal (50 VUs)** | 500ms | 0.05% | Baseline |
| **Peak (200 VUs)** | 900ms | 0.2% | +80% latency |
| **Spike (500 VUs)** | 1200ms | 0.5% | +140% latency |
| **Stress (800 VUs)** | 1800ms | 1% | +260% latency |

---

## What to Do If Tests Fail

### Step 1: Identify the Failure Type

#### High Latency (p95 > 1s)

**Symptoms:**
```
✗ http_req_duration p95: 1800ms (expected < 1000ms)
```

**Immediate Actions:**
1. Check Workers logs: `wrangler tail wordisbond-api --format pretty`
2. Check Neon dashboard for slow queries
3. Review recent deployments (rollback if needed)

**Investigation:**
```bash
# Check database performance
npm run db:slow-queries

# Check API health
curl https://wordisbond-api.adrper79.workers.dev/health

# Run diagnostics
npm run test:bridge
```

**Common Causes:**
- Missing database indexes
- N+1 queries
- External API slowness (Telnyx, OpenAI)
- Cold start issues

**Resolution:**
- Add indexes: `CREATE INDEX idx_calls_org_created ON calls(org_id, created_at DESC);`
- Optimize queries: Use `EXPLAIN ANALYZE`
- Add caching: Store frequently accessed data in KV
- Warm up connections: Ensure Hyperdrive is configured

---

#### High Error Rate (> 1%)

**Symptoms:**
```
✗ http_req_failed: 5.2% (expected < 1%)
✗ checks: 92% (expected 100%)
```

**Immediate Actions:**
1. Check error logs: `wrangler tail wordisbond-api --format pretty | grep ERROR`
2. Check database connections: `psql $NEON_PG_CONN -c "SELECT count(*) FROM pg_stat_activity;"`
3. Alert team in Slack/Discord

**Investigation:**
```bash
# Check API errors
curl https://wordisbond-api.adrper79.workers.dev/api/health

# Check database health
npm run db:schema-check

# Run functional tests
npm run test:validate
```

**Common Causes:**
- Database connection exhaustion
- Rate limiting triggered
- Auth session issues
- External API failures

**Resolution:**
- Increase connection pool size
- Adjust rate limits
- Extend session TTL
- Implement circuit breakers

---

#### Failed Checks

**Symptoms:**
```
✗ users/me status 200: 85% (expected 100%)
✗ calls has array: 90% (expected 100%)
```

**Immediate Actions:**
1. Identify which checks are failing
2. Check if issue is consistent or intermittent
3. Review recent code changes

**Investigation:**
```bash
# Run functional tests to isolate issue
npm run test:bridge

# Check specific endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://wordisbond-api.adrper79.workers.dev/api/users/me
```

**Common Causes:**
- Schema mismatch (API vs frontend)
- Data migration issues
- Tenant isolation bugs

**Resolution:**
- Fix schema inconsistencies
- Run migrations
- Fix tenant isolation queries

---

### Step 2: Reproduce Locally

```bash
# Run same test locally
k6 run tests/load/baseline.k6.js

# Run functional tests
npm run test:bridge

# Run single endpoint test
k6 run --vus 1 --iterations 1 tests/load/debug.k6.js
```

### Step 3: Collect Diagnostics

```bash
# Capture full test output
k6 run tests/load/baseline.k6.js --out json=results.json 2>&1 | tee test.log

# Check Workers logs during test
wrangler tail wordisbond-api --format pretty > workers.log &
k6 run tests/load/baseline.k6.js
kill %1

# Check database during test
watch -n 1 'psql $NEON_PG_CONN -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"'
```

### Step 4: Root Cause Analysis

#### Database Issues

```sql
-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Find missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND correlation < 0.1
ORDER BY n_distinct DESC;

-- Check table bloat
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### Workers Issues

```bash
# Check Workers metrics
wrangler tail wordisbond-api --format json | jq .

# Check CPU time (high = compute-bound)
# Check real time (high = IO-bound)
```

#### External API Issues

```bash
# Test Telnyx API
curl -H "Authorization: Bearer $TELNYX_API_KEY" \
  https://api.telnyx.com/v2/phone_numbers

# Test OpenAI API
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# Check status pages
# - Telnyx: https://status.telnyx.com
# - OpenAI: https://status.openai.com
# - Cloudflare: https://www.cloudflarestatus.com
```

### Step 5: Apply Fix and Re-test

```bash
# Apply fix (e.g., add index)
psql $NEON_PG_CONN -c "CREATE INDEX idx_calls_org_created ON calls(org_id, created_at DESC);"

# Re-run load test
k6 run tests/load/baseline.k6.js

# Verify fix
npm run test:bridge
```

### Step 6: Document and Monitor

1. **Document the issue:**
   - Root cause
   - Fix applied
   - Performance improvement

2. **Add monitoring:**
   - Set up alerts for similar issues
   - Add custom metrics in k6 scripts

3. **Update baselines:**
   - Record new performance metrics
   - Update performance budgets

---

## Useful Commands

### Test Execution

```bash
# Quick smoke test
k6 run --vus 10 --duration 1m tests/load/smoke.k6.js

# Full baseline test with JSON output
k6 run tests/load/baseline.k6.js --out json=results/baseline.json

# Run specific scenario
k6 run --scenario peak tests/load/scenarios.k6.js

# Debug single iteration
k6 run --vus 1 --iterations 1 tests/load/debug.k6.js
```

### Monitoring During Tests

```bash
# Watch Workers logs
wrangler tail wordisbond-api --format pretty

# Watch database connections
watch -n 1 'psql $NEON_PG_CONN -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"'

# Watch system metrics
watch -n 1 'curl -s https://wordisbond-api.adrper79.workers.dev/health | jq .'
```

### Results Analysis

```bash
# View k6 results
k6 run tests/load/baseline.k6.js --out json=results.json
cat results.json | jq '.metrics.http_req_duration'

# Generate HTML report (requires k6 extension)
k6 run tests/load/baseline.k6.js --out json=results.json
k6-reporter results.json --output report.html
```

---

## Performance Optimization Tips

### Database
- ✅ Add indexes for WHERE/JOIN columns
- ✅ Use pagination (LIMIT/OFFSET)
- ✅ Enable connection pooling (Hyperdrive)
- ✅ Use prepared statements
- ✅ Avoid N+1 queries

### API
- ✅ Enable caching (KV) for static data
- ✅ Implement rate limiting
- ✅ Use request coalescing
- ✅ Add circuit breakers
- ✅ Implement graceful degradation

### Workers
- ✅ Minimize bundle size
- ✅ Reuse connections (fetch keepalive)
- ✅ Offload background tasks (Queues)
- ✅ Use streaming for large responses
- ✅ Cache frequently accessed data

---

## Getting Help

### Documentation
- **Full Guide:** `ARCH_DOCS/03-INFRASTRUCTURE/LOAD_TESTING_GUIDE.md`
- **Infrastructure:** `ARCH_DOCS/03-INFRASTRUCTURE/CLOUDFLARE_DEPLOYMENT.md`
- **Test Suite:** `tests/README.md`

### Tools
- **k6 Docs:** https://k6.io/docs/
- **Cloudflare Workers:** https://developers.cloudflare.com/workers/
- **Neon Postgres:** https://neon.tech/docs

### Support
- Check existing issues and documentation first
- Run diagnostics and collect logs
- Provide reproduction steps and test results

---

**Ready to start load testing? Run your first test:**

```bash
npm run test:load:smoke
```
