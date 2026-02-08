# Lessons Learned — Word Is Bond Platform

**Purpose:** Capture every hard-won lesson, pitfall, and pattern discovered during development so any future AI session (Claude, Copilot, etc.) can avoid repeating costly mistakes.  
**Created:** February 7, 2026  
**Applicable Versions:** v4.8 – v4.24+

---

## 🔴 CRITICAL — Schema-Frontend Mismatches (v4.24 — 500 Errors in Production)

**The Zod schema + SQL INSERT must match what the frontend actually sends.**

### The Bug

`BookingModal.tsx` sent `{start_time, end_time, duration_minutes, attendee_name, attendee_email, attendee_phone, from_number, notes}` but `CreateBookingSchema` in `schemas.ts` only accepted `{title, call_id, description, scheduled_at, attendees, status}`. Zod **silently stripped** all the unknown fields. The INSERT then tried to write `NULL` into `start_time` (a NOT NULL column) → 500.

### Why It's Insidious

- No Zod validation error — it passes because `title` (the only required field) was present
- No TypeScript error — the frontend and backend schemas are in different packages
- The error only surfaces at runtime when the INSERT hits the NOT NULL constraint
- Appears as a generic "Failed to create booking" to the user

### Prevention

1. When adding form fields to a frontend component, ALWAYS update:
   - The Zod schema in `workers/src/lib/schemas.ts`
   - The INSERT/UPDATE SQL in the route handler
   - The destructuring in the handler
2. Run the frontend→API audit: verify field names match between `apiPost()` calls and `CreateXxxSchema`
3. Name fields identically in frontend and DB — don't have `start_time` in the frontend and `scheduled_at` in the schema

---

## 🔴 CRITICAL — Optional Object Fields + Destructuring (v4.24)

**If a Zod schema field is `.optional()` (e.g., `modulations`), the handler MUST null-check before accessing its properties.**

### The Bug

`VoiceConfigSchema.modulations` was `.optional()`, but the PUT handler did:

```typescript
const { modulations } = parsed.data
// modulations could be undefined
db.query(..., [modulations.record ?? false, ...])  // 💥 TypeError
```

### Compounding Bug

Even when `modulations` was present, the handler used `modulations.record ?? false` — meaning if only `translate` was changed, every OTHER toggle was reset to `false`. The fix: build dynamic SET clauses that only update fields explicitly sent.

### Prevention

- After Zod `.optional()`, always null-check: `if (!modulations) return ...`
- For UPSERT with optional fields, use dynamic SET clauses instead of blanket overwrite
- Add `.passthrough()` to schemas that receive mapped field names from the frontend

---

## 🔴 CRITICAL — Database Connection Order (8+ Hours Lost)

**The single most expensive bug in project history.**

### The Rule

```
✅ CORRECT:  c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
❌ WRONG:    c.env.HYPERDRIVE?.connectionString || c.env.NEON_PG_CONN
```

### Why It Matters

- `@neondatabase/serverless` driver uses **WebSocket** transport.
- Cloudflare Hyperdrive provides a **TCP** connection string.
- Mixing them produces `HTTP 530` or silent session verification failures.
- The bug is **invisible** — code compiles, some endpoints work (different code paths), works locally, works in debug endpoints if those happen to use the correct order.

### Symptoms of Violation

1. Intermittent 500s — some routes work, some don't
2. WebSocket errors: "expected 101, got 530"
3. Auth sessions created but never verifiable
4. Queries silently returning empty results

### Prevention

- All DB access goes through `workers/src/lib/db.ts` → `getDb(env)`
- Grep verification before deploy:
  ```bash
  # Should return ZERO results:
  grep -r "HYPERDRIVE.*connectionString.*||.*NEON" workers/src/
  ```
- See: `ARCH_DOCS/DATABASE_CONNECTION_STANDARD.md`

---

## 🔴 CRITICAL — Pool Leak Prevention (v4.13 — 147+ Endpoints Fixed)

**The second most expensive systemic bug — every route file leaked DB connections.**

### The Rule

```typescript
// ✅ CORRECT — getDb BEFORE try, db.end() in finally
const db = getDb(c.env)
try {
  // all DB work
  return c.json({ data }, 200)
} catch (err: any) {
  return c.json({ error: 'Internal error' }, 500)
} finally {
  await db.end()
}

// ❌ WRONG — getDb inside try, no finally block
try {
  const db = getDb(c.env) // leak if error thrown after this
  // DB work
  return c.json({ data }, 200)
} catch (err: any) {
  return c.json({ error: 'Internal error' }, 500)
}
// db.end() never called — connection leaks!
```

### Why It Matters

- Neon serverless uses connection pooling with max=5 connections per request handler
- Without `db.end()`, connections are never returned to the pool
- Under sustained load, ALL 5 pool slots fill up → new requests hang → HTTP 524 timeouts
- The leak is invisible during low traffic — only surfaces under real production load
- Unlike traditional servers, Cloudflare Workers are ephemeral but Neon pools persist

### Discovery & Impact

- **v4.12 audit** found 12 endpoints leaking across 4 files (analytics, health, webhooks)
- **v4.13 comprehensive audit** found **147+ endpoints** leaking across ALL 34 route files
- Only 4 route files were clean before v4.13 remediation
- Fix was mechanical: move `getDb()` before try, add `finally { await db.end() }`

### Prevention

- Every new route handler MUST follow the try/catch/finally pattern above
- Code review checklist: every `getDb()` must have a matching `db.end()`
- Grep verification:
  ```bash
  # Count getDb vs db.end — numbers should match:
  grep -c "getDb" workers/src/routes/*.ts
  grep -c "db.end" workers/src/routes/*.ts
  ```

---

## 🔴 CRITICAL — Session Property Names (v4.15 — AI Routes Silently Broken)

**AI proxy routes shipped with wrong session property names — multi-tenant isolation silently broken.**

### The Rule

```typescript
// ✅ CORRECT — Session interface uses snake_case
session.user_id // NOT session.userId
session.organization_id // NOT session.orgId
session.email
session.name
session.role
session.expires
```

### Why It Matters

- The `Session` interface in `workers/src/lib/auth.ts` returns `user_id` and `organization_id` (snake_case)
- Some route files (ai-transcribe.ts, ai-llm.ts) used `session.orgId` and `session.userId` (camelCase)
- TypeScript doesn't catch this because handlers cast `session as any` to avoid type narrowing friction
- Result: `undefined` passed to SQL `$1` parameter → `null` stored in `org_id` column
- Impact: AI summaries had no org isolation — visible across organizations, audit logs had null userId/orgId

### Prevention

- NEVER use `as any` for session — always type as `Session` from `workers/src/lib/auth.ts`
- Grep verification before deploy:
  ```bash
  # Should return ZERO results:
  grep -r "session\.orgId\|session\.userId" workers/src/routes/
  ```
- Use `session.organization_id` and `session.user_id` exclusively

---

## 🔴 CRITICAL — Audit Log Column Names

### The Rule

```
✅ CORRECT columns:  old_value, new_value
❌ WRONG columns:    before, after
```

The `audit_logs` table uses `old_value` and `new_value` columns. The audit utility at `workers/src/lib/audit.ts` is the ONLY place that writes audit logs — never bypass it.

### Pattern

```typescript
import { writeAuditLog, AuditAction } from '../lib/audit'

// Fire-and-forget — NEVER await, NEVER block the main request
writeAuditLog(db, {
  userId,
  orgId,
  action: AuditAction.CALL_STARTED,
  resourceType: 'call',
  resourceId: callId,
  oldValue: null, // NOT "before"
  newValue: { status: 'active' }, // NOT "after"
}).catch(() => {})
```

---

## 🔴 CRITICAL — Static Export Limitations (Next.js on Cloudflare Pages)

### The Rule

This project uses `output: 'export'` in `next.config.js`. That means:

1. **No server-side rendering** — all pages are static HTML at build time
2. **No Next.js API routes** — all API is on Cloudflare Workers (Hono)
3. **No `next/image` optimization** — must use custom `cloudflare-image-loader.ts`
4. **No middleware** — Cloudflare Pages `_middleware.ts` or Workers handle routing
5. **No `getServerSideProps`** — use client-side data fetching with `apiGet()`

### Common Mistakes

- Adding `app/api/` routes (won't work in static export)
- Using `<Image>` without `loader` prop or config
- Importing server-only modules in client components
- Trying `cookies()` or `headers()` from `next/headers`

### Where API Lives

All API routes are in `workers/src/routes/*.ts` — NOT in `app/api/`.  
Legacy `app/_api_to_migrate/` exists but is NOT active.

---

## 🟠 HIGH — CORS and Custom Headers

### The Lesson

When adding custom HTTP headers to cross-origin requests, you MUST update CORS config in `workers/src/index.ts`:

```typescript
// Both of these must be updated:
cors({
  allowHeaders: [...existing, 'Idempotency-Key'], // Request headers
  exposeHeaders: [...existing, 'Idempotent-Replayed'], // Response headers
})
```

**What happened:** v4.8 added the idempotency layer with `Idempotency-Key` header. Everything worked in same-origin testing. In production (cross-origin Pages→Workers), the header was silently stripped by the browser's CORS preflight. The idempotency layer appeared broken for ~1 sprint until diagnosed.

---

## 🟠 HIGH — Bearer Token Authentication Pattern

### The Rule

Every client-side API call MUST use the centralized API client:

```typescript
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/apiClient'

// ✅ CORRECT — auto-attaches Bearer token + CSRF
const data = await apiGet('/api/calls')

// ❌ WRONG — no auth header, will 401 in production
const data = await fetch('https://wordisbond-api.../api/calls')
```

**What happened:** 30+ components were using raw `fetch()`. All worked during local dev (same-origin cookies). All broke in production (cross-origin, cookies not sent). Required a multi-batch migration across 3 agent sessions.

### Prevention

- Grep for raw `fetch(` calls that hit API endpoints
- All new components must use `apiGet/apiPost/apiPut/apiDelete`
- The `apiClient` handles: Bearer token injection, CSRF header, base URL resolution, error normalization

---

## 🟠 HIGH — Rate Limiting: Fail-Open Principle

### The Rule

If KV is unavailable, rate limiting MUST fail open (allow the request).

```typescript
// In workers/src/lib/rate-limit.ts
try {
  const count = await env.RATE_LIMIT_KV.get(key)
  // ... check limits
} catch (err) {
  // KV error → ALLOW the request, don't block business operations
  return next()
}
```

**Rationale:** A KV outage should not bring down the entire API. Rate limiting is a safety net, not a gate.

---

## 🟠 HIGH — Idempotency: Fail-Open + 24h TTL

### Pattern

- KV key: `idem:${userId}:${idempotencyKey}`
- TTL: 24 hours (86400 seconds)
- If KV is down → process normally (fail-open)
- Applied to: billing mutations, call start, booking create
- Response header: `Idempotent-Replayed: true` when returning cached response

---

## 🟡 MEDIUM — Multi-Tenant Isolation (org_id)

### The Rule

Every query that reads or writes business data MUST include `org_id` in the WHERE clause:

```sql
-- ✅ CORRECT
SELECT * FROM calls WHERE id = $1 AND org_id = $2

-- ❌ WRONG — data leak across organizations
SELECT * FROM calls WHERE id = $1
```

**Where org_id comes from:** Session object after `requireAuth()` middleware → `c.get('session').organization_id`

### RLS as Defense-in-Depth

Database-level Row Level Security policies are the backup, not the primary guard. Application-level filtering is still required in every query.

---

## 🟡 MEDIUM — Workers Route Registration Order

### The Rule

In `workers/src/index.ts`, route registration order matters:

1. CORS middleware (first)
2. CSRF middleware
3. Health routes (unauthenticated)
4. Auth routes (unauthenticated — signup/signin)
5. All other routes (authenticated)

**What happened:** Auth routes registered after a global auth middleware caused login to require... being logged in.

---

## 🟡 MEDIUM — Hono Context Patterns

### Session Access

```typescript
// After requireAuth() middleware:
const session = c.get('session')
const { user_id, organization_id, role } = session // snake_case — see CRITICAL lesson above
```

### Environment Bindings

```typescript
// Cloudflare bindings:
c.env.NEON_PG_CONN // Database connection string
c.env.RATE_LIMIT_KV // KV namespace
c.env.SESSION_KV // KV namespace
c.env.IDEMPOTENCY_KV // KV namespace
c.env.RECORDINGS_BUCKET // R2 bucket
c.env.TELNYX_API_KEY // Secret
c.env.STRIPE_WEBHOOK_SECRET // Secret
```

### Database Pattern

```typescript
const db = getDb(c.env)
try {
  const result = await db.query('SELECT ...', [params])
  return c.json({ data: result.rows })
} finally {
  await db.end() // ALWAYS close in finally block
}
```

---

## 🟡 MEDIUM — Build and Deploy Chain

### Correct Order

```bash
# 1. Workers first (API must be live before Pages)
npm run api:deploy    # wrangler deploy

# 2. Next.js build (static export)
npm run build         # next build → out/

# 3. Pages deploy
npm run pages:deploy  # wrangler pages deploy out/

# 4. Verify
npm run health-check
```

### Common Build Issues

- `next build` fails if any component imports server-only modules
- Workers build fails if `wrangler.jsonc` has syntax errors in comments
- Pages deploy uploads diff — first deploy takes longer
- `wrangler types` must run if `wrangler.jsonc` bindings change

---

## 🟡 MEDIUM — Test Architecture

### Pattern: `describeOrSkip`

Integration tests that need real DB/API use `describeOrSkip`:

```typescript
const describeOrSkip = process.env.RUN_INTEGRATION ? describe : describe.skip

describeOrSkip('Call Flow', () => {
  // These tests hit real Neon DB
})
```

### Vitest Config

- `vitest.config.ts` — unit tests (default, CI)
- `vitest.production.config.ts` — integration tests (manual)
- Workers code is **excluded** from vitest (`workers/` in exclude list) — Workers tests use wrangler's test runner

### Test User

- Email: `adrper79@gmail.com`
- Password: `123qweASD`
- User ID: `0b6a566f-19de-4ae8-8478-f4b2008ce65a`
- Org ID: `f92acc56-7a95-4276-8513-4d041347fab3`

---

## 🟢 PATTERNS — What Works Well

### 1. Centralized Utilities

Every cross-cutting concern has ONE canonical implementation:

| Concern       | File                             | Pattern                           |
| ------------- | -------------------------------- | --------------------------------- |
| DB access     | `workers/src/lib/db.ts`          | `getDb(env)` → `DbClient`         |
| Auth          | `workers/src/lib/auth.ts`        | `requireAuth()` middleware        |
| Rate limiting | `workers/src/lib/rate-limit.ts`  | `rateLimit(config)` middleware    |
| Idempotency   | `workers/src/lib/idempotency.ts` | `idempotency()` middleware        |
| Audit         | `workers/src/lib/audit.ts`       | `writeAuditLog()` fire-and-forget |
| Logging       | `workers/src/lib/logger.ts`      | Structured JSON logger            |
| Validation    | `workers/src/lib/schemas.ts`     | Zod schemas                       |
| RBAC          | `workers/src/lib/rbac-v2.ts`     | Role hierarchy + permission check |

### 2. Middleware Composition on Routes

```typescript
// Stack middleware inline on route definitions:
routes.post(
  '/billing/subscribe',
  billingRateLimit, // Rate limit
  idempotency(), // Idempotency
  async (c) => {
    // ... handler with writeAuditLog() inside
  }
)
```

### 3. Fire-and-Forget for Non-Critical Writes

Audit logs, analytics events, and cache updates use `.catch(() => {})` to never block the main request path.

### 4. KV for Everything Ephemeral

- Sessions (7-day TTL)
- Rate limit counters (sliding window)
- Idempotency keys (24h TTL)
- Feature flags (cached)

---

## 🟢 PROJECT CONVENTIONS

### File Organization

```
workers/src/routes/*.ts   — API route handlers (Hono)
workers/src/lib/*.ts      — Shared utilities
app/                      — Next.js pages (static export)
components/               — React components
lib/                      — Client-side utilities
hooks/                    — React hooks
services/                 — Client-side service layer
types/                    — TypeScript type definitions
migrations/               — SQL migration files
scripts/                  — CLI tools and maintenance scripts
tools/                    — Code generation tools
ARCH_DOCS/                — Architecture documentation
docs/                     — Generated documentation (ERD, permission matrix)
```

### Naming Conventions

- Route files: lowercase, plural (`calls.ts`, `bookings.ts`)
- Lib files: lowercase, descriptive (`rate-limit.ts`, `audit.ts`)
- Components: PascalCase (`CallDetailView.tsx`)
- Hooks: camelCase with `use` prefix (`useRole.ts`)
- Types: PascalCase interfaces (`CallRecord`, `AuditLogEntry`)

### SQL Conventions

- Always parameterized: `$1, $2, $3` — never string interpolation
- Always include `org_id` in business queries
- Always `RETURNING *` on INSERT/UPDATE for audit trail
- Table names: lowercase, snake_case, plural (`audit_logs`, `call_records`)

### Git Conventions

- Commit format: `v{version}: {summary}` (e.g., `v4.11: KV rate limiting...`)
- Branch: `main` only (direct deploy)
- Always deploy + health-check before commit
- Never commit with failing builds

---

## 🟢 DOCUMENTATION MAP

When starting a new session, read in this order:

1. **`ARCH_DOCS/CURRENT_STATUS.md`** — What version are we on, what's deployed
2. **`ROADMAP.md`** — What's done, what's remaining (progress tracker)
3. **`ARCH_DOCS/LESSONS_LEARNED.md`** — This file (don't repeat mistakes)
4. **`ARCH_DOCS/DATABASE_CONNECTION_STANDARD.md`** — DB connection rules
5. **`ARCH_DOCS/01-CORE/AI_ROLE_POLICY.md`** — AI behavioral constraints
6. **`ARCH_DOCS/QUICK_REFERENCE.md`** — URLs, commands, architecture diagrams

### AI Role Constraints

The AI on this platform operates as a **notary/stenographer** — it observes, records, and assists but does NOT autonomously initiate calls, modify evidence, or take actions on behalf of users. See `AI_ROLE_POLICY.md` for the full behavioral framework.

---

## 📊 INCIDENT LOG

| Date  | Issue                           | Root Cause                                 | Hours Lost | Fix                        |
| ----- | ------------------------------- | ------------------------------------------ | ---------- | -------------------------- |
| Feb 5 | Auth sessions not verifying     | DB connection order (HYPERDRIVE first)     | 4+         | Swap to NEON_PG_CONN first |
| Feb 5 | /api/calls WebSocket error      | Same — HYPERDRIVE first in getDb()         | 2+         | Same fix                   |
| Feb 5 | Login works but session invalid | Inconsistent connection order across files | 2+         | Standardized all files     |
| Feb 6 | 30+ components 401 in prod      | Raw fetch() without Bearer token           | 3+         | Migrated to apiClient      |
| Feb 6 | Billing 500 error               | Missing `plan` column in orgs table        | 1          | Graceful column fallback   |
| Feb 6 | Voice config 400                | Org validation too strict                  | 0.5        | Fall back to session org   |
| Feb 6 | Idempotency silently broken     | CORS not exposing Idempotency-Key header   | 1          | Added to CORS config       |
| Feb 7 | Rate limiting gap               | Only auth.ts had rate limits               | 0          | Extended to 6 route files  |

**Total hours lost to preventable issues: ~13+**

---

## 🔴 CRITICAL — Runtime DDL in Route Handlers (v4.24 Audit)

**Never put `CREATE TABLE IF NOT EXISTS` inside request handlers.**

### The Problem

The Feb 7, 2026 codebase audit found 5 route files executing DDL on every request: `voice.ts`, `live-translation.ts`, `campaigns.ts`, `surveys.ts`, `scorecards.ts`. This causes:

- ~20-50ms latency penalty per request (DDL check + lock acquisition)
- Table catalog locks that can block concurrent requests
- Tables created outside migration tracking — no version control
- Schema drift between what migrations define and what runtime DDL creates

### Prevention

1. **All DDL belongs in `migrations/` folder** — run once, not per-request
2. Route handlers should assume tables exist — if they don't, the query fails loudly (which is correct behavior for missing migrations)
3. New features must include a migration file BEFORE the route handler is written
4. Use the audit report pattern: `2026-02-07-audit-remediation.sql`

---

## 🟡 MEDIUM — Documentation Rot (v4.24 Audit)

**ARCH_DOCS rot faster than code. 10 files were stale enough to mislead engineers.**

### What Happened

The Feb 7 audit found:

- 4 different version numbers (v4.0, v4.22, v4.24) across 4 "current" docs
- Wrong production URLs (`wordis-bond.com` → actual is `voxsouth.online`)
- NextAuth code samples in MASTER_ARCHITECTURE.md (NextAuth removed in v4.22)
- Wrong session property name in copilot-instructions.md (`orgId` → actual is `organization_id`)
- 10 tracker/review files with all items marked ✅ Complete — zero actionable content

### Prevention

1. When updating code, grep ARCH_DOCS for related terms and update simultaneously
2. Keep a single canonical version number in CURRENT_STATUS.md — other docs link to it
3. Archive point-in-time review documents to `archive/reviews/` once resolved
4. Copilot instructions file is the most-read doc — keep it surgically accurate

---

## ⚠️ KNOWN REMAINING RISKS

1. **No E2E tests** — Playwright not yet configured. Critical flows (signin → call → recording) have no automated browser coverage.
2. **WAF not configured** — Cloudflare WAF rules for `/api` not set up in dashboard.
3. **RLS not audited in production** — `npm run db:rls-audit` has not been run against prod Neon.
4. **No refresh tokens** — Sessions expire after 7 days (KV TTL + DB `expires` column) with no refresh mechanism (~4hr implementation).
5. ~~**SWML legacy code**~~ — ✅ Resolved in v4.16 and verified in v4.24 audit. All SignalWire code deleted.
6. **Workers tests not in vitest** — Workers route tests need wrangler's test runner, currently no CI coverage.
7. **14 route files missing rate limiting/audit** — Identified in Feb 7 audit. Mutations in bookings, surveys, scorecards, compliance, retention, shopper, caller-id, organizations, reports, ai-config, and analytics routes lack `writeAuditLog()` and/or rate limiting middleware.
8. ~~**Frontend/backend RBAC role mismatch**~~ — ✅ Fixed in Round 2. Added operator/analyst/compliance to backend roleHierarchy.
9. **API key client_secret not hashed** — `auth_providers.client_secret_hash` stores literal '**_hashed_**'. Low risk (0 orgs using auth_providers in prod).
10. **R2 credentials in git history** — deploy-cloudflare.sh deleted but keys persist in git. Must be rotated manually.
11. ~~**Runtime DDL in lower-traffic routes**~~ — ✅ Fixed. All runtime DDL removed from all route files. Migrations executed against production Neon.
12. ~~**Migrations not yet executed**~~ — ✅ Fixed. Both `2026-02-07-audit-remediation.sql` and `2026-02-07-runtime-ddl-consolidation.sql` executed against production Neon. Created missing tables (call_translations, survey_responses, caller_ids) and added disposition_notes column.

---

## 🧹 Round 2 Audit Summary (February 7, 2026)

### Security Fixes

- **C-6:** Telnyx webhook — removed `OR phone_number` cross-tenant risk
- **C-7:** Stripe webhook — fixed all 4 audit log calls (wrong interface properties)
- **C-8:** Recording DELETE — fixed auth bypass (operator→manager)
- **H-1:** Billing DELETE — fixed DB connection leak
- **H-2:** Billing audit — fixed 4 calls (oldValue→before, newValue→after)

### Architecture Fixes

- **H-3:** Unified RBAC — added operator:3, analyst:2, compliance:3 to backend hierarchy
- **H-4:** Removed runtime DDL from 7 high-traffic route files
- Created comprehensive migration covering 20 tables

### UI Polish Fixes

- LiveTranslationPanel: auth token key mismatch (auth_token→wb-session-token)
- Removed hardcoded 'test-org-id' from dashboard, reports, campaigns, analytics
- Added missing 'compliance' tab to Settings page

### Documentation Fixes

- 00-README.md: corrupted header
- CLOUDFLARE_DEPLOYMENT.md: wrong KV binding, URLs, session prop, Zod casing
- MASTER_ARCHITECTURE.md: KV description
- CURRENT_STATUS.md: broken link to archived file

---

_This document should be updated after every sprint or major incident._
