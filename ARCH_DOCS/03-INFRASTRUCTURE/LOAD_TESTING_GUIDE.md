# Load Testing Guide

**Status:** Active | **Date:** February 11, 2026 | **Version:** 1.0

This document provides a comprehensive guide to load testing the Word Is Bond platform, including strategy, execution, interpretation, and troubleshooting.

---

## 📖 Table of Contents

- [Overview](#overview)
- [Bridge Crossing Framework](#bridge-crossing-framework)
- [Test Categories](#test-categories)
- [Load Testing Strategy](#load-testing-strategy)
- [Running Load Tests](#running-load-tests)
- [Interpreting Results](#interpreting-results)
- [Performance Budgets and SLAs](#performance-budgets-and-slas)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)
- [Quick Reference](#quick-reference)

---

## Overview

### Purpose

Load testing ensures the Word Is Bond platform can handle production traffic volumes while maintaining acceptable performance, reliability, and user experience.

### Architecture Context

Our platform uses a **hybrid architecture**:
- **Frontend:** Static Next.js export on Cloudflare Pages CDN
- **API:** Cloudflare Workers (serverless, auto-scaling)
- **Database:** Neon Postgres (connection pooling via Hyperdrive)
- **Storage:** Cloudflare R2 (call recordings, evidence bundles)
- **Cache:** Cloudflare KV (sessions, rate limiting)

**Key Characteristics:**
- **Auto-scaling:** Workers scale automatically with traffic
- **Edge-distributed:** Global CDN distribution reduces latency
- **Connection pooling:** Hyperdrive mitigates cold start DB connection overhead
- **Rate limiting:** Per-endpoint rate limits protect against abuse

### Performance Goals

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| **API Response Time (p95)** | < 500ms | < 1000ms |
| **API Response Time (p99)** | < 1000ms | < 2000ms |
| **Database Query Time** | < 200ms | < 500ms |
| **Page Load Time (FCP)** | < 1.5s | < 3s |
| **Error Rate** | < 0.1% | < 1% |
| **Availability** | > 99.9% | > 99.5% |

---

## Bridge Crossing Framework

### The User's Analogy

> "If a man has to cross a bridge, I want to test:
> 1. Is the bridge there? (L1)
> 2. Did he BEGIN crossing? (L2)
> 3. Did he COMPLETE the crossing? (L3)
> 4. Can 100 people cross at once? (LOAD)"

### Test Level Mapping

| Level | Focus | Method | Example |
|-------|-------|--------|---------|
| **L1** | Route Reachability | `curl` / fetch | Does `/api/calls` return 200 or 401? |
| **L2** | Auth Gate Verification | Authenticated requests | Does auth work? Is 200/403 returned? |
| **L3** | Functional Correctness | Full response validation | Is data shape correct? Tenant isolated? |
| **L4** | Cross-Cutting Concerns | Security, audit, rate limiting | Are logs written? RLS enforced? |
| **LOAD** | Concurrent Performance | k6, Artillery, JMeter | Can 100 users call at once? |

### Bridge Crossing in Load Tests

Load tests answer:
- Can the **bridge handle 100 people crossing simultaneously**?
- Does the **bridge hold up under sustained traffic**?
- What happens when **traffic spikes 10x suddenly**?
- Does the system **gracefully degrade** under overload?

---

## Test Categories

### 1. L1: Route Reachability Tests

**Purpose:** Verify all API endpoints are deployed and accessible.

**Location:** `tests/production/api-live.test.ts`

**Coverage:**
- ✅ 120+ API endpoints
- ✅ Health checks
- ✅ Public routes (no auth)
- ✅ Response status codes (200, 401, 404)

**Run Command:**
```bash
npm run test:live:api
```

**Expected Result:** All endpoints return expected status codes (200 for public, 401 for protected).

---

### 2. L2: Auth Gate Verification Tests

**Purpose:** Verify authentication and authorization work correctly.

**Location:** `tests/production/feature-validation.test.ts`

**Coverage:**
- ✅ Session creation and validation
- ✅ Bearer token handling
- ✅ RBAC role enforcement
- ✅ Plan-gated features
- ✅ Unauthorized access rejection

**Run Command:**
```bash
npm run test:validate
```

**Expected Result:** Auth flows work, protected routes require valid sessions, roles enforced.

---

### 3. L3: Functional Correctness Tests

**Purpose:** Verify business logic, data shape, and tenant isolation.

**Location:** `tests/production/bridge-crossing.test.ts`

**Coverage:**
- ✅ Response data structure validation
- ✅ Tenant isolation (org_id scoping)
- ✅ Business logic correctness
- ✅ Edge cases and error handling
- ✅ Performance under authentication

**Run Command:**
```bash
npm run test:bridge
```

**Expected Result:** All data correctly shaped, tenant-isolated, business logic correct.

---

### 4. L4: Cross-Cutting Concerns Tests

**Purpose:** Verify audit logging, security, rate limiting, and compliance.

**Location:** `tests/production/ai-optimization-l4.test.ts`

**Coverage:**
- ✅ Audit log completeness
- ✅ RLS enforcement
- ✅ Rate limiting
- ✅ PII redaction
- ✅ Prompt injection protection
- ✅ Cost tracking

**Run Command:**
```bash
npm run test:live:all
```

**Expected Result:** Audit logs written, RLS enforced, rate limits work, PII redacted.

---

### 5. Load Tests (Performance & Scalability)

**Purpose:** Verify system performance under concurrent load.

**Location:** `tests/load/` (to be created)

**Coverage:**
- 🔜 Concurrent API requests (10, 50, 100, 500 users)
- 🔜 Sustained load (baseline traffic for 10 minutes)
- 🔜 Spike testing (sudden 10x traffic increase)
- 🔜 Stress testing (find breaking point)
- 🔜 Soak testing (24-hour sustained load)

**Tool:** k6 (open-source load testing)

**Run Command:**
```bash
npm run test:load
```

**Expected Result:** System handles target load with acceptable latency/error rates.

---

## Load Testing Strategy

### Test Scenarios

#### 1. Baseline Load Test

**Goal:** Verify normal production traffic performance.

**Profile:**
- **Users:** 50 concurrent virtual users
- **Duration:** 10 minutes
- **Ramp-up:** 30 seconds
- **Endpoints:** Core API endpoints (users/me, calls, voice/config, analytics/kpis)

**Success Criteria:**
- p95 latency < 500ms
- Error rate < 0.1%
- No database connection errors

#### 2. Peak Traffic Test

**Goal:** Verify system handles peak hours traffic.

**Profile:**
- **Users:** 200 concurrent virtual users
- **Duration:** 5 minutes
- **Ramp-up:** 1 minute
- **Endpoints:** Mixed workload (70% reads, 30% writes)

**Success Criteria:**
- p95 latency < 1000ms
- Error rate < 0.5%
- Database connection pool healthy

#### 3. Spike Test

**Goal:** Verify graceful handling of sudden traffic spikes.

**Profile:**
- **Users:** 10 → 500 → 10 (spike pattern)
- **Duration:** 8 minutes (baseline → spike → recovery)
- **Spike Duration:** 2 minutes
- **Endpoints:** High-traffic endpoints (calls, voice operations)

**Success Criteria:**
- p95 latency < 2000ms during spike
- Error rate < 1% during spike
- System recovers within 30s after spike
- No cascading failures

#### 4. Stress Test

**Goal:** Find system breaking point.

**Profile:**
- **Users:** Gradually increase 50 → 1000+ until failure
- **Duration:** 20 minutes
- **Ramp-up:** Continuous increase
- **Endpoints:** All critical paths

**Success Criteria:**
- Identify max sustainable load
- System fails gracefully (errors, not crashes)
- No data corruption
- System recovers after load reduction

#### 5. Soak Test (Endurance)

**Goal:** Verify stability under sustained load (memory leaks, resource exhaustion).

**Profile:**
- **Users:** 100 concurrent virtual users
- **Duration:** 24 hours
- **Endpoints:** Mixed realistic workload

**Success Criteria:**
- No memory leaks
- No gradual performance degradation
- Error rate remains stable
- Database connections stable

---

## Running Load Tests

### Prerequisites

1. **Install k6:**
   ```bash
   # macOS
   brew install k6

   # Windows (via Chocolatey)
   choco install k6

   # Linux
   sudo apt-get install k6
   ```

2. **Set environment variables:**
   ```bash
   export API_BASE_URL="https://wordisbond-api.adrper79.workers.dev"
   export TEST_USER_EMAIL="load-test@wordis-bond.com"
   export TEST_USER_PASSWORD="secure-password"
   export TEST_ORG_ID="org-123"
   ```

3. **Create test data:**
   - Create dedicated test organization
   - Create test user accounts (10-50 for realistic load)
   - Pre-populate test data (calls, targets, campaigns)

### Running Tests

#### Quick Start

```bash
# Run baseline load test
npm run test:load:baseline

# Run peak traffic test
npm run test:load:peak

# Run spike test
npm run test:load:spike

# Run stress test
npm run test:load:stress

# Run full suite
npm run test:load:all
```

#### Manual k6 Execution

```bash
# Basic load test
k6 run tests/load/baseline.k6.js

# With custom VUs and duration
k6 run --vus 100 --duration 10m tests/load/baseline.k6.js

# With cloud results
k6 cloud tests/load/baseline.k6.js

# With output to InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 tests/load/baseline.k6.js
```

### k6 Script Structure

```javascript
// tests/load/baseline.k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  vus: 50,                    // Virtual users
  duration: '10m',            // Test duration
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests < 500ms
    errors: ['rate<0.001'],           // Error rate < 0.1%
  },
};

// Setup: Authenticate once per VU
export function setup() {
  const loginRes = http.post(`${__ENV.API_BASE_URL}/api/auth/login`, {
    email: __ENV.TEST_USER_EMAIL,
    password: __ENV.TEST_USER_PASSWORD,
  });

  return { token: loginRes.json('session.id') };
}

// Main test scenario
export default function (data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // Test: GET /api/users/me
  let res = http.get(`${__ENV.API_BASE_URL}/api/users/me`, { headers });
  check(res, {
    'users/me status 200': (r) => r.status === 200,
    'users/me has data': (r) => r.json('user') !== undefined,
  }) || errorRate.add(1);

  sleep(1); // Think time

  // Test: GET /api/calls
  res = http.get(`${__ENV.API_BASE_URL}/api/calls?limit=10`, { headers });
  check(res, {
    'calls status 200': (r) => r.status === 200,
    'calls has array': (r) => Array.isArray(r.json('calls')),
  }) || errorRate.add(1);

  sleep(2);
}
```

---

## Interpreting Results

### k6 Output Metrics

```
     ✓ users/me status 200
     ✓ calls status 200

     checks.........................: 100.00% ✓ 12000      ✗ 0
     data_received..................: 6.2 MB  103 kB/s
     data_sent......................: 2.1 MB  35 kB/s
     http_req_blocked...............: avg=1.2ms   min=0s   med=0s   max=150ms  p(90)=0s   p(95)=0s
     http_req_connecting............: avg=500µs   min=0s   med=0s   max=80ms   p(90)=0s   p(95)=0s
     http_req_duration..............: avg=250ms   min=80ms med=200ms max=1.5s   p(90)=400ms p(95)=500ms
       { expected_response:true }...: avg=250ms   min=80ms med=200ms max=1.5s   p(90)=400ms p(95)=500ms
     http_req_failed................: 0.00%   ✓ 0          ✗ 12000
     http_req_receiving.............: avg=1ms     min=0s   med=500µs max=50ms   p(90)=2ms  p(95)=5ms
     http_req_sending...............: avg=200µs   min=0s   med=100µs max=20ms   p(90)=300µs p(95)=500µs
     http_req_tls_handshaking.......: avg=0s      min=0s   med=0s   max=0s     p(90)=0s   p(95)=0s
     http_req_waiting...............: avg=248ms   min=79ms med=199ms max=1.49s  p(90)=398ms p(95)=498ms
     http_reqs......................: 12000   200/s
     iteration_duration.............: avg=3.2s    min=3s   med=3.1s max=5s     p(90)=3.5s p(95)=3.8s
     iterations.....................: 6000    100/s
     vus............................: 50      min=50       max=50
     vus_max........................: 50      min=50       max=50
```

### Key Metrics Explained

| Metric | Meaning | Good | Warning | Critical |
|--------|---------|------|---------|----------|
| **http_req_duration (p95)** | 95% of requests faster than | < 500ms | 500-1000ms | > 1000ms |
| **http_req_duration (p99)** | 99% of requests faster than | < 1000ms | 1-2s | > 2s |
| **http_req_failed** | % of failed requests | < 0.1% | 0.1-1% | > 1% |
| **checks** | % of assertions passed | 100% | 95-99% | < 95% |
| **http_reqs** | Requests per second | Varies | N/A | N/A |
| **iteration_duration** | Full scenario time | As expected | +20% | +50% |

### Health Indicators

#### ✅ Healthy System
```
✓ http_req_duration p95: 450ms
✓ http_req_failed: 0.05%
✓ checks: 100%
✓ Database connections: stable
✓ Error rate: < 0.1%
```

#### ⚠️ Warning Signs
```
⚠️ http_req_duration p95: 800ms (degraded)
⚠️ http_req_failed: 0.5% (elevated errors)
⚠️ checks: 98% (some failures)
⚠️ Database connections: fluctuating
⚠️ Error rate: 0.5%
```

#### 🔴 Critical Issues
```
🔴 http_req_duration p95: 2000ms (severe latency)
🔴 http_req_failed: 5% (high error rate)
🔴 checks: 85% (many failures)
🔴 Database connections: exhausted
🔴 Error rate: > 1%
🔴 Cascading failures observed
```

---

## Performance Budgets and SLAs

### API Response Time Budgets

| Endpoint Category | p50 | p95 | p99 | Budget Rationale |
|-------------------|-----|-----|-----|-----------------|
| **Identity** (`/api/users/me`) | 100ms | 300ms | 500ms | Cached session, simple query |
| **Config** (`/api/voice/config`) | 150ms | 400ms | 800ms | Single row, org-scoped |
| **Lists** (`/api/calls`) | 200ms | 500ms | 1000ms | Paginated, indexed queries |
| **Analytics** (`/api/analytics/kpis`) | 300ms | 800ms | 1500ms | Aggregations, complex queries |
| **Mutations** (`POST /api/calls/start`) | 400ms | 1000ms | 2000ms | External API call (Telnyx) |
| **AI Operations** (`POST /api/bond-ai/chat`) | 500ms | 1500ms | 3000ms | LLM inference latency |

### Service Level Objectives (SLOs)

| Service | Availability | Latency (p95) | Error Budget |
|---------|--------------|---------------|--------------|
| **API (Core)** | 99.9% | < 500ms | 0.1% monthly |
| **API (AI)** | 99.5% | < 1500ms | 0.5% monthly |
| **Database** | 99.95% | < 200ms | 0.05% monthly |
| **Storage (R2)** | 99.9% | < 300ms | 0.1% monthly |
| **CDN (Pages)** | 99.99% | < 100ms | 0.01% monthly |

### Capacity Planning

| Metric | Current | Target (6 months) | Scale Factor |
|--------|---------|-------------------|--------------|
| **Daily API Calls** | 50k | 500k | 10x |
| **Peak RPS** | 50 req/s | 500 req/s | 10x |
| **Concurrent Users** | 100 | 1000 | 10x |
| **Database Connections** | 10 pooled | 50 pooled | 5x |
| **Storage (Recordings)** | 100 GB | 5 TB | 50x |

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/load-test.yml
name: Load Testing

on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM UTC
  workflow_dispatch:    # Manual trigger

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install k6
        run: |
          sudo apt-get update
          sudo apt-get install -y k6

      - name: Run baseline load test
        env:
          API_BASE_URL: ${{ secrets.API_BASE_URL }}
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
        run: k6 run tests/load/baseline.k6.js

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: results/

      - name: Notify on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "⚠️ Load test failed - investigate immediately"
            }
```

### Pre-Deployment Load Tests

```bash
# Run before production deployment
npm run test:smoke    # Quick smoke test (< 1 min)
npm run test:load:baseline  # Baseline load test (10 min)

# If passing:
npm run deploy:all
```

### Post-Deployment Validation

```bash
# Run after production deployment
npm run test:live:api    # Verify all routes reachable
npm run test:bridge      # Verify functional correctness
npm run test:load:smoke  # Quick load test (5 min)
```

---

## Troubleshooting

### Common Issues

#### Issue: High Latency (p95 > 1s)

**Symptoms:**
- Slow API response times
- User complaints about sluggish UI
- Timeout errors

**Possible Causes:**
1. **Database query performance**
   - Missing indexes
   - N+1 queries
   - Large result sets without pagination

2. **Cold starts**
   - Workers cold start penalty (mitigated by Hyperdrive)
   - Database connection pool exhaustion

3. **External API latency**
   - Telnyx API slow
   - OpenAI API slow
   - Network issues

**Diagnosis:**
```bash
# Check database query performance
npm run db:slow-queries

# Check Workers logs
wrangler tail wordisbond-api --format pretty

# Check Neon dashboard
# https://console.neon.tech
```

**Resolution:**
1. Add missing indexes
2. Optimize queries (use `EXPLAIN ANALYZE`)
3. Increase connection pool size
4. Add caching (KV) for frequently accessed data
5. Implement request coalescing

---

#### Issue: High Error Rate (> 1%)

**Symptoms:**
- 500 errors in API responses
- Database connection errors
- Auth failures

**Possible Causes:**
1. **Database connection exhaustion**
   - Too many concurrent connections
   - Connection leaks
   - Hyperdrive misconfiguration

2. **Rate limiting triggered**
   - Too many requests from same IP/user
   - DDoS attack

3. **Auth session expiry**
   - Sessions expiring mid-test
   - KV session store issues

**Diagnosis:**
```bash
# Check error logs
wrangler tail wordisbond-api --format pretty | grep ERROR

# Check database connections
psql $NEON_PG_CONN -c "SELECT count(*) FROM pg_stat_activity;"

# Check rate limit metrics
curl https://wordisbond-api.adrper79.workers.dev/api/_admin/metrics
```

**Resolution:**
1. Increase database connection pool
2. Fix connection leaks (ensure `db.end()` called)
3. Adjust rate limits
4. Extend session TTL for load tests
5. Use connection pooling (Hyperdrive)

---

#### Issue: Memory Leaks

**Symptoms:**
- Performance degrades over time
- Workers memory usage grows
- Soak test fails after hours

**Possible Causes:**
1. **Unbounded caches**
   - In-memory caches without eviction
   - Event listeners not cleaned up

2. **Database connections not released**
   - Missing `finally` blocks
   - Leaked connections

**Diagnosis:**
```javascript
// Add memory tracking to k6 script
import { Counter } from 'k6/metrics';
const memoryUsage = new Counter('memory_usage');

export default function() {
  // ... test logic
  memoryUsage.add(__ENV.MEMORY_MB || 0);
}
```

**Resolution:**
1. Use bounded caches (LRU)
2. Clean up event listeners
3. Always release connections in `finally` blocks
4. Use WeakMap/WeakSet for object references

---

#### Issue: Database Timeout Errors

**Symptoms:**
```
Error: Query timeout
Connection terminated unexpectedly
```

**Possible Causes:**
1. Long-running queries
2. Table locks
3. Connection pool exhausted

**Diagnosis:**
```sql
-- Check active queries
SELECT pid, usename, state, query, now() - query_start AS duration
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;

-- Check locks
SELECT * FROM pg_locks WHERE NOT granted;
```

**Resolution:**
1. Set query timeout: `SET statement_timeout = '5s';`
2. Optimize slow queries
3. Add indexes
4. Increase connection pool

---

#### Issue: Cascading Failures

**Symptoms:**
- One endpoint failure causes others to fail
- System doesn't recover after load reduction
- 503 errors across all endpoints

**Possible Causes:**
1. **Circuit breaker missing**
   - Failed external API call blocks all requests

2. **Retry storms**
   - Clients retry aggressively, amplifying load

3. **Shared resource exhaustion**
   - Database connection pool
   - KV quota

**Resolution:**
1. Implement circuit breakers
2. Add exponential backoff with jitter
3. Implement bulkheads (isolate resources)
4. Add graceful degradation (serve cached data)
5. Implement request shedding (reject excess load)

---

### Performance Optimization Checklist

#### Database Optimization
- [ ] All queries use indexed columns in WHERE clauses
- [ ] Pagination implemented (LIMIT/OFFSET)
- [ ] N+1 queries eliminated
- [ ] Connection pooling enabled (Hyperdrive)
- [ ] Query timeout set (`statement_timeout`)
- [ ] Prepared statements used for repeated queries

#### API Optimization
- [ ] Rate limiting implemented
- [ ] Caching enabled (KV) for static data
- [ ] Gzip compression enabled
- [ ] Request coalescing for identical concurrent requests
- [ ] Graceful degradation for non-critical features
- [ ] Circuit breakers for external APIs

#### Workers Optimization
- [ ] Minimal bundle size (tree shaking)
- [ ] No blocking operations
- [ ] Background tasks offloaded (Queues)
- [ ] Memory-efficient data structures
- [ ] Connection reuse (fetch keepalive)

---

## Quick Reference

### Test Commands

| Command | Purpose | Duration |
|---------|---------|----------|
| `npm run test:live:api` | L1: Route reachability | 30s |
| `npm run test:validate` | L2: Auth verification | 1 min |
| `npm run test:bridge` | L3: Functional correctness | 3 min |
| `npm run test:live:all` | L4: Cross-cutting concerns | 5 min |
| `npm run test:load:baseline` | Load: Baseline (50 VUs, 10m) | 10 min |
| `npm run test:load:peak` | Load: Peak traffic (200 VUs, 5m) | 5 min |
| `npm run test:load:spike` | Load: Spike test | 8 min |
| `npm run test:load:stress` | Load: Stress test (find limits) | 20 min |
| `npm run test:load:soak` | Load: 24h endurance test | 24 hours |

### Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| **API p95 latency** | < 500ms | < 1000ms |
| **Error rate** | < 0.1% | < 1% |
| **Availability** | > 99.9% | > 99.5% |
| **DB query time** | < 200ms | < 500ms |

### Load Test Profiles

| Test | VUs | Duration | Purpose |
|------|-----|----------|---------|
| **Smoke** | 10 | 1 min | Quick sanity check |
| **Baseline** | 50 | 10 min | Normal traffic |
| **Peak** | 200 | 5 min | Peak hours |
| **Spike** | 10→500→10 | 8 min | Traffic surge |
| **Stress** | 50→1000+ | 20 min | Find breaking point |
| **Soak** | 100 | 24 hours | Stability/leaks |

### Key Files

| File | Purpose |
|------|---------|
| `tests/production/bridge-crossing.test.ts` | L3 functional tests |
| `tests/production/ai-optimization-l4.test.ts` | L4 cross-cutting tests |
| `tests/load/baseline.k6.js` | k6 baseline load test |
| `tests/load/spike.k6.js` | k6 spike test |
| `tests/load/stress.k6.js` | k6 stress test |
| `tests/LOAD_TESTING_README.md` | Quick start guide |

---

## Next Steps

1. **Create k6 test scripts** - See `tests/LOAD_TESTING_README.md`
2. **Set up monitoring** - InfluxDB + Grafana dashboards
3. **Schedule automated tests** - Daily load tests in CI/CD
4. **Document baselines** - Record current performance metrics
5. **Set alerts** - Notify team when SLOs violated

---

## Related Documentation

- **[CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md)** - Infrastructure overview
- **[SECURITY_HARDENING.md](SECURITY_HARDENING.md)** - Security measures
- **[../../tests/README.md](../../tests/README.md)** - Test suite overview
- **[../../tests/LOAD_TESTING_README.md](../../tests/LOAD_TESTING_README.md)** - Load test quick start

---

**Questions? Issues?** See [TROUBLESHOOTING](#troubleshooting) or contact the infrastructure team.
