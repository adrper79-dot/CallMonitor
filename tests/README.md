# Test Suite

## Overview

Comprehensive test coverage for critical paths in the Voice Operations platform.

## Test Structure

```
tests/
├── unit/           # Unit tests for individual functions/services
│   ├── rbac.test.ts
│   ├── errorHandling.test.ts
│   ├── webhookSecurity.test.ts
│   ├── rateLimit.test.ts
│   ├── idempotency.test.ts
│   ├── translation.test.ts
│   ├── scoring.test.ts
│   └── startCallHandler.test.ts
├── integration/   # Integration tests for end-to-end flows
│   ├── webhookFlow.test.ts
│   ├── callExecutionFlow.test.ts
│   └── startCallFlow.test.ts
└── setup.ts       # Test setup and mocks
```

## Running Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/unit/rbac.test.ts
```

## Test Coverage

### Unit Tests

- **RBAC** (`tests/unit/rbac.test.ts`)
  - Permission checks
  - Plan gating
  - Role enforcement
  - API endpoint permissions

- **Error Handling** (`tests/unit/errorHandling.test.ts`)
  - Error catalog
  - Error tracking
  - KPI collection
  - System health

- **Webhook Security** (`tests/unit/webhookSecurity.test.ts`)
  - SignalWire signature verification
  - AssemblyAI signature verification

- **Rate Limiting** (`tests/unit/rateLimit.test.ts`)
  - Rate limit enforcement
  - Blocking after max attempts
  - Window expiration

- **Idempotency** (`tests/unit/idempotency.test.ts`)
  - Request hashing
  - Idempotency key handling

- **Translation** (`tests/unit/translation.test.ts`)
  - Translation service
  - Plan enforcement
  - Error handling

- **Scoring** (`tests/unit/scoring.test.ts`)
  - Scorecard evaluation
  - Auto-scoring logic

### Integration Tests

- **Webhook Flow** (`tests/integration/webhookFlow.test.ts`)
  - SignalWire webhook → Call status update
  - AssemblyAI webhook → Transcription completion
  - Evidence manifest generation

- **Call Execution Flow** (`tests/integration/callExecutionFlow.test.ts`)
  - Call initiation → SignalWire → LaML generation
  - End-to-end call flow

## Mocking

Tests use mocks for:
- Supabase client (`@/lib/supabaseAdmin`)
- External APIs (SignalWire, AssemblyAI, OpenAI)
- Next.js server components
- Environment variables

See `tests/setup.ts` for global mocks.

## Coverage Goals

- **Critical Paths:** 80%+ coverage
  - Call execution
  - Webhook processing
  - RBAC enforcement
  - Error handling

- **Services:** 70%+ coverage
  - Translation
  - Scoring
  - Recording storage

## CI/CD Integration

Tests should run in CI/CD pipeline:
- On every pull request
- Before deployment
- Coverage reports should be generated

## Writing New Tests

1. **Unit Tests:** Test individual functions in isolation
2. **Integration Tests:** Test complete flows with mocked external services
3. **Use descriptive test names:** `should [expected behavior] when [condition]`
4. **Mock external dependencies:** Never call real APIs in tests
5. **Test error cases:** Include failure scenarios

## Example Test

```typescript
import { describe, it, expect } from 'vitest'
import { functionToTest } from '@/path/to/function'

describe('Function Name', () => {
  it('should do X when Y', () => {
    const result = functionToTest(input)
    expect(result).toBe(expected)
  })
})
```
