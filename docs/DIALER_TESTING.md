# Predictive Dialer Testing Documentation

## Overview

Comprehensive test suite for the Telnyx Call Control v2 Predictive Dialer integration. Tests cover production integration (unit/integration tests) and end-to-end user workflows.

**Version:** 1.0  
**Last Updated:** February 14, 2026  
**Coverage Target:** ≥90% for dialer-related code

---

## Test Files

| File | Type | Purpose |
|------|------|---------|
| `tests/production/dialer-integration.test.ts` | Production Integration | Unit/integration tests for dialer engine, AMD, compliance |
| `tests/e2e/dialer-workflow.spec.ts` | E2E | Playwright tests for agent/manager UI workflows |
| `docs/DIALER_TESTING.md` | Documentation | This file — test scenarios, setup, troubleshooting |

---

## Production Integration Tests

### File: `tests/production/dialer-integration.test.ts`

#### Test Scenarios

##### 1. **Happy Path Test**
- **Description:** Start dialer with 5-account campaign, all calls complete successfully
- **Steps:**
  1. Mock 5 pending campaign calls
  2. Mock 3 available agents
  3. Start dialer queue
  4. Verify Telnyx API called for each call
  5. Verify all calls logged in DB
- **Success Criteria:**
  - 5 calls queued
  - Dialer started successfully
  - Telnyx API called ≥1 time
  - Calls inserted into database

##### 2. **Pause/Resume Test**
- **Description:** Dialer pauses immediately and resumes from queue position
- **Steps:**
  1. Start dialer
  2. Pause dialer
  3. Verify campaign status = 'paused'
  4. Resume dialer
  5. Verify calls continue
- **Success Criteria:**
  - Pause updates DB status
  - Resume restarts queue
  - No calls originate during pause

##### 3. **Compliance Check Test**
- **Description:** DNC accounts are skipped and audit logged
- **Steps:**
  1. Add account to DNC list
  2. Start dialer with DNC account in queue
  3. Verify call skipped (no Telnyx API call)
  4. Verify audit log records DNC skip
- **Success Criteria:**
  - DNC account never dialed
  - Audit log contains skip event

##### 4. **AMD (Answering Machine Detection) Test**
- **Description:** Call auto-dispositioned as 'voicemail' when machine detected
- **Steps:**
  1. Start dialer
  2. Mock `call.machine_detection.ended` webhook with result: 'machine'
  3. Verify call outcome = 'voicemail'
  4. Verify Telnyx hangup API called
- **Success Criteria:**
  - AMD result processed correctly
  - Call dispositioned automatically
  - Hangup triggered

##### 5. **Error Handling Test**
- **Description:** System recovers gracefully from network failures and timeouts
- **Steps:**
  1. Mock Telnyx API failure (network error)
  2. Verify error logged
  3. Verify queue continues (doesn't hang)
  4. Mock webhook timeout
  5. Verify timeout handled
- **Success Criteria:**
  - Errors logged
  - System doesn't crash
  - Queue continues processing

##### 6. **Edge Case: No Available Agents**
- **Description:** Dialer returns queued but not started when no agents available
- **Success Criteria:** `{ queued: >0, started: false }`

##### 7. **Edge Case: Empty Campaign Queue**
- **Description:** Dialer returns gracefully when campaign has no pending calls
- **Success Criteria:** `{ queued: 0, started: false }`

---

## E2E Tests (Playwright)

### File: `tests/e2e/dialer-workflow.spec.ts`

#### Test Scenarios

##### 1. **Agent Workflow Test**
- **Description:** Full agent dialing cycle from start to disposition
- **Steps:**
  1. Login as agent
  2. Navigate to `/voice-operations`
  3. Select campaign
  4. Start dialing
  5. Receive call (mocked)
  6. Disposition call
  7. Verify next call auto-advances
- **Success Criteria:** Full workflow completes without errors

##### 2. **Auto-Advance Test**
- **Description:** Auto-advance triggers next call after disposition
- **Success Criteria:** Next call indicator appears after disposition

##### 3. **Manager Monitoring Test**
- **Description:** Manager can view real-time stats and control dialer
- **Steps:**
  1. Login as manager
  2. Navigate to `/voice-operations`
  3. Verify stats display (active calls, agents, rate)
  4. Click "Pause All"
  5. Verify dialer pauses
- **Success Criteria:** Manager controls functional, stats update

##### 4. **Manager Multi-Campaign Test**
- **Description:** Manager can switch between campaigns and view stats
- **Success Criteria:** Stats load for each campaign

##### 5. **Campaign Switching Test**
- **Description:** Campaign switch resets dialer and loads new accounts
- **Steps:**
  1. Start dialing Campaign A
  2. Switch to Campaign B
  3. Verify dialer resets
  4. Verify new accounts load
- **Success Criteria:** Dialer resets, no errors

##### 6. **Campaign Switch Warning Test**
- **Description:** Warning shown when switching during active call
- **Success Criteria:** Warning dialog appears OR switch blocked

##### 7. **Empty State Test**
- **Description:** No campaigns available shows empty state
- **Success Criteria:** Empty state message visible

##### 8. **API Error Test**
- **Description:** API error shows user-friendly message
- **Success Criteria:** Error banner visible with message

##### 9. **Performance Test: Page Load**
- **Description:** Voice Operations page loads within 3 seconds
- **Success Criteria:** Load time < 3000ms

##### 10. **Performance Test: Stats Update**
- **Description:** Stats update within 2 seconds of disposition
- **Success Criteria:** Update time < 2000ms

---

## Running Tests

### Production Integration Tests

```bash
# Run all production tests
npm run test:production

# Run only dialer integration tests
npx vitest tests/production/dialer-integration.test.ts --run

# Run with coverage
npx vitest tests/production/dialer-integration.test.ts --coverage --run

# Run in watch mode (development)
npx vitest tests/production/dialer-integration.test.ts
```

### E2E Tests (Playwright)

```bash
# Run all E2E tests
npm run test:e2e

# Run only dialer workflow tests
npx playwright test tests/e2e/dialer-workflow.spec.ts

# Run in headed mode (see browser)
npx playwright test tests/e2e/dialer-workflow.spec.ts --headed

# Run specific test
npx playwright test tests/e2e/dialer-workflow.spec.ts -g "Agent can start dialer"

# Debug mode
npx playwright test tests/e2e/dialer-workflow.spec.ts --debug
```

---

## Environment Variables

### Required for Production Tests

```bash
# .env or CI/CD environment
WORKERS_API_URL=https://wordisbond-api.adrper79.workers.dev
TELNYX_API_KEY=your-test-telnyx-key
TEST_ORG_ID=org-test-123
TEST_USER_ID=user-test-456
TEST_CAMPAIGN_ID=camp-test-789
```

### Required for E2E Tests

```bash
# .env.test or playwright.config.ts
BASE_URL=https://wordis-bond.com  # or http://localhost:3000
API_URL=https://wordisbond-api.adrper79.workers.dev

# Test user credentials
TEST_AGENT_EMAIL=agent@test.wordis-bond.com
TEST_AGENT_PASSWORD=TestPassword123!
TEST_MANAGER_EMAIL=manager@test.wordis-bond.com
TEST_MANAGER_PASSWORD=TestPassword123!
```

---

## Mock Data Setup

### Creating Test Campaign

```sql
-- Insert test campaign
INSERT INTO campaigns (id, organization_id, name, status, call_flow_type)
VALUES ('camp-test-789', 'org-test-123', 'Test Campaign', 'draft', 'predictive');

-- Insert test accounts
INSERT INTO campaign_calls (id, campaign_id, organization_id, target_phone, status)
VALUES 
  ('call-1', 'camp-test-789', 'org-test-123', '+15551234001', 'pending'),
  ('call-2', 'camp-test-789', 'org-test-123', '+15551234002', 'pending'),
  ('call-3', 'camp-test-789', 'org-test-123', '+15551234003', 'pending'),
  ('call-4', 'camp-test-789', 'org-test-123', '+15551234004', 'pending'),
  ('call-5', 'camp-test-789', 'org-test-123', '+15551234005', 'pending');

-- Create test agents
INSERT INTO dialer_agent_status (organization_id, user_id, status, campaign_id)
VALUES 
  ('org-test-123', 'agent-1', 'available', NULL),
  ('org-test-123', 'agent-2', 'available', NULL),
  ('org-test-123', 'agent-3', 'available', NULL);
```

### Cleaning Up Test Data

```sql
-- After tests, clean up
DELETE FROM campaign_calls WHERE campaign_id = 'camp-test-789';
DELETE FROM campaigns WHERE id = 'camp-test-789';
DELETE FROM dialer_agent_status WHERE organization_id = 'org-test-123';
DELETE FROM calls WHERE organization_id = 'org-test-123' AND created_at > NOW() - INTERVAL '1 hour';
```

---

## Troubleshooting

### Common Test Failures

#### 1. **Telnyx API Mock Not Working**

**Error:** `Expected fetch to be called, but was not`

**Fix:**
```typescript
// Ensure global fetch is mocked BEFORE test
beforeEach(() => {
  fetchMock = vi.fn()
  globalThis.fetch = fetchMock as any
})
```

#### 2. **Database Query Mock Failing**

**Error:** `Cannot read property 'rows' of undefined`

**Fix:**
```typescript
// Mock ALL expected DB queries in sequence
mockDb.query
  .mockResolvedValueOnce({ rows: [...] })  // First query
  .mockResolvedValueOnce({ rows: [...] })  // Second query
  .mockResolvedValue({ rows: [...] })      // All remaining queries
```

#### 3. **Playwright Timeout on Login**

**Error:** `Timeout 10000ms exceeded waiting for URL /dashboard`

**Fix:**
```typescript
// Increase timeout for slow networks
await page.waitForURL('/dashboard', { timeout: 20000 })

// Or check if auth.setup.ts fixture is available
test.use({ storageState: 'playwright/.auth/agent.json' })
```

#### 4. **E2E Test: Element Not Found**

**Error:** `locator.click: Target closed`

**Fix:**
```typescript
// Use more resilient selectors
const startButton = page.getByRole('button', { name: /start/i })

// Add visibility check before interaction
if (await startButton.isVisible({ timeout: 5000 })) {
  await startButton.click()
}
```

#### 5. **Production Test: Module Import Error**

**Error:** `Cannot find module '../../workers/src/lib/dialer-engine'`

**Fix:**
```bash
# Ensure TypeScript paths are configured in vitest.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Dialer Tests

on:
  push:
    paths:
      - 'workers/src/lib/dialer-engine.ts'
      - 'workers/src/routes/dialer.ts'
      - 'app/voice-operations/**'
      - 'tests/production/dialer-integration.test.ts'
      - 'tests/e2e/dialer-workflow.spec.ts'

jobs:
  production-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx vitest tests/production/dialer-integration.test.ts --run
        env:
          WORKERS_API_URL: ${{ secrets.WORKERS_API_URL }}
          TELNYX_API_KEY: ${{ secrets.TELNYX_API_KEY_TEST }}

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test tests/e2e/dialer-workflow.spec.ts
        env:
          BASE_URL: ${{ secrets.BASE_URL }}
          API_URL: ${{ secrets.API_URL }}
          TEST_AGENT_EMAIL: ${{ secrets.TEST_AGENT_EMAIL }}
          TEST_AGENT_PASSWORD: ${{ secrets.TEST_AGENT_PASSWORD }}
```

---

## Test Coverage Report

### Generating Coverage

```bash
# Production tests with coverage
npx vitest tests/production/dialer-integration.test.ts --coverage --run

# View HTML coverage report
open coverage/index.html  # macOS
start coverage/index.html # Windows
```

### Coverage Thresholds

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
      include: [
        'workers/src/lib/dialer-engine.ts',
        'workers/src/routes/dialer.ts',
      ],
    },
  },
})
```

---

## Best Practices

### 1. **Use Realistic Test Data**
```typescript
// Use faker for realistic phone numbers
import { faker } from '@faker-js/faker'

const testPhone = faker.phone.number('+1##########')
const testName = faker.person.fullName()
```

### 2. **Mock External APIs Consistently**
```typescript
// Create reusable mock helpers
function mockTelnyxSuccess() {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ data: { call_control_id: faker.string.uuid() } }),
  })
}
```

### 3. **Clean Up After Tests**
```typescript
afterEach(async () => {
  await mockDb.end()
  vi.clearAllMocks()
})
```

### 4. **Test Error Paths**
```typescript
// Don't only test happy paths
test('handles network timeout gracefully', async () => {
  fetchMock.mockRejectedValue(new Error('Network timeout'))
  const result = await startDialerQueue(...)
  expect(result).toBeDefined() // System recovers
})
```

### 5. **Use Descriptive Test Names**
```typescript
// ✅ Good
test('AMD: Machine detected, call auto-dispositioned as voicemail', ...)

// ❌ Bad
test('amd test', ...)
```

---

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Telnyx Call Control API](https://developers.telnyx.com/docs/api/v2/call-control)
- [ARCH_DOCS/FEATURE_IMPLEMENTATION_PLAN.md](../ARCH_DOCS/FEATURE_IMPLEMENTATION_PLAN.md) — Phase 4
- [TELNYX_IMPLEMENTATION_COMPLETE.md](../TELNYX_IMPLEMENTATION_COMPLETE.md) — Integration details

---

## Changelog

### v1.0 — February 14, 2026
- Initial test suite creation
- 8 production integration tests
- 10 E2E workflow tests
- Full documentation
