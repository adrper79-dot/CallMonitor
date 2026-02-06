# Agent Instructions - Wordis Bond Engineering Standards

**Version**: 1.0
**Date**: February 6, 2026
**Status**: 🔴 **MANDATORY** - All agents must follow these standards
**Authority**: Orchestrator-approved engineering gospel

---

## 🎯 Mission Statement

**Wordis Bond is "The System of Record for Business Conversations"**

Every line of code contributes to trust, reliability, and evidence-grade quality. We build systems that legal teams, compliance officers, and CIOs depend on. There are no "small" bugs here—everything matters.

---

## 📜 Core Principles

### 1. **Best Practices Only - No Shortcuts**

❌ **NEVER**:
- Skip input validation
- Use `any` types in TypeScript
- Hardcode configuration
- Copy-paste code without understanding
- Use `console.log` for production logging
- Skip error handling
- Write "TODO: fix later" comments
- Commit commented-out code
- Use `@ts-ignore` or `@ts-nocheck`

✅ **ALWAYS**:
- Use Zod for all API input validation
- Type everything explicitly
- Use environment variables for config
- Abstract repeated patterns into utilities
- Use structured logger (`lib/logger.ts`)
- Handle all error cases gracefully
- Fix issues immediately or create tracked tasks
- Delete dead code, don't comment it out
- Fix TypeScript errors properly

### 2. **Zero Technical Debt Policy**

**Definition**: Technical debt is any code that:
- You wouldn't want to explain in a code review
- You'd be embarrassed to show a senior engineer
- Makes you say "I'll clean this up later"
- Works but you don't understand why
- Has security implications you're ignoring

**Enforcement**:
- If you write code you're not proud of, **refactor immediately**
- If you find debt while working, **fix it or log it as a task**
- If you're blocked and must take a shortcut, **get orchestrator approval + add tracking issue**

**Examples of Unacceptable Debt**:
```typescript
// ❌ WRONG - Ignoring errors
try { await riskyOperation() } catch {}

// ❌ WRONG - Unclear magic numbers
if (status === 3) { /* ... */ }

// ❌ WRONG - Unclear variable names
const x = await fetchData()

// ❌ WRONG - No input validation
const data = await req.json()
await db.insert(data) // SQL injection risk!
```

**Fixed Versions**:
```typescript
// ✅ CORRECT - Handle errors
try {
  await riskyOperation()
} catch (error) {
  logger.error('Risk operation failed', { error: error.message })
  return c.json({ error: 'Operation failed' }, 500)
}

// ✅ CORRECT - Named constants
const STATUS_ACTIVE = 3
if (status === STATUS_ACTIVE) { /* ... */ }

// ✅ CORRECT - Clear names
const userProfile = await fetchUserProfile(userId)

// ✅ CORRECT - Zod validation
const schema = z.object({ name: z.string(), email: z.string().email() })
const data = schema.parse(await req.json())
await db.insert(data)
```

### 3. **Adherence to ARCH_DOCS Design Principles**

**Required Reading** (check these BEFORE starting work):
- [`ARCH_DOCS/MASTER_ARCHITECTURE.md`](ARCH_DOCS/MASTER_ARCHITECTURE.md) - System architecture gospel
- [`ARCH_DOCS/DATABASE_CONNECTION_STANDARD.md`](ARCH_DOCS/DATABASE_CONNECTION_STANDARD.md) - 🔴 CRITICAL database connection rules
- [`ARCH_DOCS/02-FEATURES/TELNYX_WEBRTC_STANDARD.md`](ARCH_DOCS/02-FEATURES/TELNYX_WEBRTC_STANDARD.md) - 🔴 CRITICAL WebRTC standards
- [`ARCH_DOCS/QUICK_REFERENCE.md`](ARCH_DOCS/QUICK_REFERENCE.md) - Common patterns and commands

**Key Standards**:

#### **Naming Convention: snake_case Everywhere**
```typescript
// ✅ CORRECT - snake_case for everything
interface UserSession {
  user_id: string
  session_token: string
  created_at: Date
}

// ❌ WRONG - camelCase
interface UserSession {
  userId: string
  sessionToken: string
  createdAt: Date
}
```

**Rationale**: PostgreSQL uses snake_case. Consistency across DB ↔ API ↔ Frontend prevents bugs.

#### **Database Connections: NEON_PG_CONN First**
```typescript
// ✅ CORRECT - NEON first
const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString

// ❌ WRONG - HYPERDRIVE first (causes WebSocket 530 errors)
const connectionString = c.env.HYPERDRIVE?.connectionString || c.env.NEON_PG_CONN
```

**Rationale**: Neon serverless driver uses WebSocket, not TCP. See [`DATABASE_CONNECTION_STANDARD.md`](ARCH_DOCS/DATABASE_CONNECTION_STANDARD.md).

#### **Static Export: No SSR**
- All pages are static (Next.js `output: 'export'`)
- No `getServerSideProps`, no server components with data fetching
- API calls happen client-side using `apiGet()`/`apiPost()` from `@/lib/apiClient`

#### **API Layer: Workers Only**
- All APIs live in `workers/src/routes/`
- `app/api/` is DEPRECATED (do not add new routes there)
- Use Hono framework, not Next.js API routes

#### **Auth: Session-Based with Bearer Tokens**
- Sessions stored in `public.sessions` table
- Client sends `Authorization: Bearer <token>` header
- Workers validate with `requireAuth(c)` or `verifySession(c)`
- CSRF protection for mutations

#### **Security: Defense in Depth**
- PBKDF2 password hashing (120,000 iterations)
- Session fingerprinting (device binding)
- CSRF tokens stored in KV (10-minute TTL)
- Rate limiting on auth endpoints (KV-backed)
- Webhook signature verification (HMAC-SHA256)
- Input validation (Zod schemas)
- Audit logging for all mutations

**If design principles conflict with greater security/performance best practices**:
1. Document the conflict
2. Propose alternative approach
3. Get orchestrator approval before deviating

### 4. **Live Tests with KPI Tracking**

**For EVERY new feature, you must create**:

#### A. **Functional Test** (proves it works)
```typescript
// tests/feature-name.test.ts
import { describe, it, expect } from 'vitest'

describe('Feature Name', () => {
  it('should perform expected behavior', async () => {
    const result = await featureFunction()
    expect(result).toBeDefined()
    expect(result.status).toBe('success')
  })

  it('should handle error cases', async () => {
    await expect(featureFunction({ invalid: true }))
      .rejects.toThrow('Validation error')
  })
})
```

#### B. **Integration Test** (proves it works end-to-end)
```typescript
// tests/integration/feature-name.integration.test.ts
import { describe, it, expect } from 'vitest'

describe('Feature Name Integration', () => {
  it('should work with database', async () => {
    // Create test data
    const testData = await createTestData()

    // Execute feature
    const result = await executeFeature(testData.id)

    // Verify database state
    const dbRecord = await db.query('SELECT * FROM table WHERE id = $1', [testData.id])
    expect(dbRecord.rows[0].status).toBe('processed')

    // Cleanup
    await cleanupTestData(testData.id)
  })
})
```

#### C. **Live Health Check** (KPI endpoint)
```typescript
// workers/src/routes/health.ts
router.get('/health/feature-name', async (c) => {
  const startTime = Date.now()

  try {
    // Test critical path
    const result = await featureHealthCheck()
    const latency = Date.now() - startTime

    return c.json({
      status: 'healthy',
      feature: 'feature-name',
      latency_ms: latency,
      last_check: new Date().toISOString(),
      metrics: {
        operations_last_hour: result.count,
        success_rate: result.successRate,
        avg_duration_ms: result.avgDuration
      }
    })
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      feature: 'feature-name',
      error: error.message,
      last_check: new Date().toISOString()
    }, 503)
  }
})
```

#### D. **Dashboard Widget** (user-visible KPI)
```typescript
// components/dashboard/FeatureKPIWidget.tsx
'use client'

import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/apiClient'

export function FeatureKPIWidget() {
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    const fetchMetrics = async () => {
      const data = await apiGet('/health/feature-name')
      setMetrics(data)
    }

    fetchMetrics()
    const interval = setInterval(fetchMetrics, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  if (!metrics) return <div>Loading metrics...</div>

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold">Feature Name Health</h3>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div>
          <div className="text-sm text-gray-500">Status</div>
          <div className={metrics.status === 'healthy' ? 'text-green-600' : 'text-red-600'}>
            {metrics.status}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Success Rate</div>
          <div>{(metrics.metrics?.success_rate * 100).toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Latency</div>
          <div>{metrics.latency_ms}ms</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Operations/hour</div>
          <div>{metrics.metrics?.operations_last_hour || 0}</div>
        </div>
      </div>
    </div>
  )
}
```

**Rationale**: Live KPIs create accountability and enable data-driven decisions. If something breaks, we know immediately.

### 5. **Lessons Learned Integration**

**Before starting work**:
1. Check if similar work was done before
2. Search for related lessons in:
   - `ARCH_DOCS/archive/fixes/` - Historical bug fixes
   - `ARCH_DOCS/CIO_PRODUCTION_AUDIT_2026-02-05.md` - Known issues
   - `ARCH_DOCS/CRITICAL_FIXES_TRACKER.md` - Active fixes
   - Migration history in `migrations/`
   - Git commit messages: `git log --grep="feature-name"`

**After completing work**:
1. Document lessons learned
2. Update relevant ARCH_DOCS
3. If you discovered a bug pattern, create a lint rule
4. If you found a reusable pattern, create a utility
5. Update this file if you learned a new best practice

**Example Lessons to Apply**:

| Lesson | Source | Application |
|--------|--------|-------------|
| Always use `NEON_PG_CONN` first | DATABASE_CONNECTION_STANDARD.md | Every database connection |
| Virtual audio devices break WebRTC | TELNYX_WEBRTC_STANDARD.md | Filter device enumeration |
| CSRF tokens must be stored server-side | v4.5 security sprint | All mutation endpoints |
| PII must not be logged | v4.5 security sprint | Use structured logger only |
| Dual-write creates consistency bugs | H7 zombie schemas | Write to single source of truth |
| Webhook signatures prevent forgery | v4.8 security sprint | All webhook handlers |

---

## 🛠️ Code Quality Standards

### TypeScript
- **Strict mode**: `"strict": true` in `tsconfig.json`
- **No implicit any**: Every variable must have explicit type
- **No `as` casts**: Use type guards instead
- **Interfaces over types**: For object shapes
- **Enums for constants**: Not magic strings

### React
- **Functional components only**: No class components
- **Hooks over HOCs**: Use custom hooks for shared logic
- **Error boundaries**: Wrap risky components
- **Suspense boundaries**: Wrap async data fetching
- **Client-side only**: All pages have `'use client'` directive

### API Routes (Workers)
```typescript
// Template for new API route
import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'

const router = new Hono()

// Input validation schema
const inputSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  // ... more fields
})

// GET endpoint
router.get('/resource', async (c) => {
  const session = await requireAuth(c)

  try {
    const result = await fetchResource(session.organization_id)
    return c.json({ data: result })
  } catch (error) {
    logger.error('Failed to fetch resource', {
      organization_id: session.organization_id,
      error: error.message
    })
    return c.json({ error: 'Failed to fetch resource' }, 500)
  }
})

// POST endpoint with validation
router.post('/resource', async (c) => {
  const session = await requireAuth(c)

  // Validate input
  const body = await c.req.json()
  const validated = inputSchema.parse(body) // Throws 400 if invalid

  try {
    const result = await createResource(session.organization_id, validated)

    // Audit log
    await writeAuditLog(c.env, {
      organization_id: session.organization_id,
      user_id: session.user_id,
      resource_type: 'resource',
      resource_id: result.id,
      action: 'created',
      new_value: validated
    }).catch(err => logger.error('Audit log failed', { error: err.message }))

    return c.json({ data: result }, 201)
  } catch (error) {
    logger.error('Failed to create resource', {
      organization_id: session.organization_id,
      error: error.message
    })
    return c.json({ error: 'Failed to create resource' }, 500)
  }
})

export default router
```

### Database Queries
```typescript
// ✅ CORRECT - Parameterized queries
const result = await sql`
  SELECT * FROM users
  WHERE organization_id = ${orgId}
  AND email = ${email}
`

// ✅ CORRECT - Named parameters
const result = await pool.query(
  'SELECT * FROM users WHERE organization_id = $1 AND email = $2',
  [orgId, email]
)

// ❌ WRONG - String concatenation (SQL injection!)
const result = await sql`SELECT * FROM users WHERE email = '${email}'`
```

### Error Handling
```typescript
// ✅ CORRECT - Structured error handling
try {
  await riskyOperation()
} catch (error) {
  if (error instanceof ValidationError) {
    return c.json({ error: error.message }, 400)
  }
  if (error instanceof NotFoundError) {
    return c.json({ error: 'Resource not found' }, 404)
  }
  logger.error('Unexpected error', { error: error.message })
  return c.json({ error: 'Internal server error' }, 500)
}

// ❌ WRONG - Swallowed errors
try {
  await riskyOperation()
} catch {
  // Silent failure - never do this!
}

// ❌ WRONG - Leaking internal details
try {
  await riskyOperation()
} catch (error) {
  return c.json({ error: error.stack }, 500) // Exposes internals!
}
```

---

## 📋 Pre-Work Checklist

Before writing ANY code, verify:

- [ ] I've read the relevant ARCH_DOCS for this feature
- [ ] I understand the existing patterns in the codebase
- [ ] I've checked for similar implementations to learn from
- [ ] I've reviewed lessons learned from past bugs
- [ ] I have a clear plan (not just "start coding and see")
- [ ] I know how to test this feature
- [ ] I know what KPI metrics this will expose
- [ ] I have orchestrator approval if deviating from standards

---

## 🚀 Work Execution Checklist

While coding:

- [ ] Every function has clear TypeScript types
- [ ] Every API input is validated with Zod
- [ ] Every database query is parameterized (no SQL injection)
- [ ] Every mutation has audit logging
- [ ] Every error case is handled explicitly
- [ ] Every external call has timeout/retry logic
- [ ] No secrets in code (use environment variables)
- [ ] No PII in logs (use structured logger with redaction)
- [ ] Code follows snake_case convention
- [ ] Database connections use NEON_PG_CONN first

---

## ✅ Completion Checklist

Before marking work complete:

- [ ] All TypeScript errors resolved (no build warnings)
- [ ] All tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Feature has functional tests
- [ ] Feature has integration tests (if applicable)
- [ ] Feature has health check endpoint
- [ ] Feature has dashboard KPI widget (if user-facing)
- [ ] Documentation updated (ARCH_DOCS + inline comments)
- [ ] Lessons learned documented (if applicable)
- [ ] Code reviewed by orchestrator (if security-sensitive)
- [ ] Migration created (if database changes)
- [ ] Rollback plan documented (if risky change)

---

## 🎓 Learning Resources

### Wordis Bond Specific
- [`ARCH_DOCS/MASTER_ARCHITECTURE.md`](ARCH_DOCS/MASTER_ARCHITECTURE.md) - System architecture
- [`ARCH_DOCS/QUICK_REFERENCE.md`](ARCH_DOCS/QUICK_REFERENCE.md) - Common commands
- [`ARCH_DOCS/DATABASE_CONNECTION_STANDARD.md`](ARCH_DOCS/DATABASE_CONNECTION_STANDARD.md) - DB connections
- [`ARCH_DOCS/01-CORE/FULL_SYSTEM_ARCHITECTURE.md`](ARCH_DOCS/01-CORE/FULL_SYSTEM_ARCHITECTURE.md) - Complete system view
- [`API_MIGRATION_GUIDE.md`](API_MIGRATION_GUIDE.md) - API patterns

### External Best Practices
- [Hono Framework Docs](https://hono.dev/)
- [Zod Validation](https://zod.dev/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [Neon Serverless Driver](https://neon.tech/docs/serverless/serverless-driver)

---

## 🚨 Escalation Policy

**When to ask for help**:
- Security implications unclear
- Performance implications unclear
- Database migration risk unclear
- Breaking change to API contract
- Conflicts with ARCH_DOCS standards
- Stuck for >30 minutes on the same problem

**How to ask**:
1. Document what you've tried
2. Show relevant code snippets
3. Explain expected vs actual behavior
4. Propose solution options
5. Ask for orchestrator review

**DO NOT**:
- Guess at security implications
- Ship broken code "to unblock yourself"
- Ignore errors because they're "probably fine"
- Copy code from Stack Overflow without understanding

---

## 💯 Excellence Mindset

**Every line of code is a reflection of your craftsmanship.**

Ask yourself:
- Would I want to maintain this code in 2 years?
- Would I be proud to show this in a code review?
- Is this the simplest solution that could work?
- Am I solving the right problem?
- Did I leave the codebase better than I found it?

**If the answer to any question is "no", refactor before submitting.**

---

## 📊 Agent Performance Metrics

We track:
- Code quality (lint score, TypeScript strict compliance)
- Test coverage (% of new code covered by tests)
- Bug introduction rate (bugs found in your code within 30 days)
- Documentation completeness (ARCH_DOCS updates)
- Adherence to standards (violations flagged in review)

**High performers**:
- ✅ Write elegant, self-documenting code
- ✅ Leave comprehensive test coverage
- ✅ Introduce zero bugs
- ✅ Update documentation proactively
- ✅ Follow standards without reminders

**Be a high performer.**

---

**Version**: 1.0
**Approved by**: Orchestrator
**Effective**: February 6, 2026
**Next Review**: After first 10 agents complete work
