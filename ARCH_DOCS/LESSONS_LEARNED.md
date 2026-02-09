# Lessons Learned — Word Is Bond Platform

**Purpose:** Capture every hard-won lesson, pitfall, and pattern discovered during development so any future AI session (Claude, Copilot, etc.) can avoid repeating costly mistakes.  
**Created:** February 7, 2026  
**Applicable Versions:** v4.8 – v4.28

---

## 🔴 CRITICAL — Helper Function Return Type Mismatches (v4.28 — 500 in Bond AI Insights)

**When you refactor a helper's return type, ALL callers must be updated too.**

### The Bug

`fetchKpiSummary()` was rewritten (in a prior fix) to return `{ settings, recentPerformance }` — an object. But the `/insights` handler still treated the return value as an array, calling `.filter()` on it → `TypeError: kpis.filter is not a function` → 500.

Additionally, the insights handler created a standalone `const db = getDb(c.env)` and called `db.end()` in finally — but each helper creates its own db connection. The outer db was never used for queries, just opened and closed wastefully.

### Why It's Insidious

- TypeScript didn't catch it because the return was typed as `any` in the Promise.all destructuring
- The prior fix to `fetchKpiSummary` was correct, but the caller was never updated
- The handler returned generic `{ error: 'Failed to get insights' }` with no logging, hiding the actual TypeError

### Prevention

1. When refactoring a helper function's return type, search for ALL callers with `grep_search`
2. Never use `.filter()` on an unknown return type without verifying it's an array
3. Always add `logger.error(...)` in catch blocks — silent 500s are the hardest to debug
4. Don't create unused `db` connections — each helper should manage its own lifecycle

---

## 🔴 CRITICAL — Auth Routes Missing Audit Logging (v4.28 — Security Gap)

**The highest-value audit events (login, signup, password reset) had ZERO audit trail.**

### The Gap

`auth.ts` had 677 lines and 7 mutation endpoints — signup, login, signout, session refresh, forgot-password, reset-password, validate-key. None of them called `writeAuditLog()`. The `AuditAction` enum already had `SESSION_CREATED` and `SESSION_REVOKED` constants defined, but they were never used.

### Why It Matters

- Compliance requires knowing WHO logged in, WHEN, and from WHERE
- Password reset events are critical for security incident investigation
- API key validation events help detect stolen credentials
- Without auth audit logs, there's no forensic trail for the most sensitive operations

### The Fix

- Added `writeAuditLog()` calls to all 7 mutation endpoints in auth.ts
- Added 5 new `AuditAction` constants: `USER_SIGNUP`, `SESSION_REFRESHED`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED`, `API_KEY_VALIDATED`
- All audit calls use fire-and-forget pattern — never blocks auth response

### Prevention

1. Every new mutation endpoint MUST include a `writeAuditLog()` call — treat it as a PR checklist item
2. When creating new route files, always import `{ writeAuditLog, AuditAction }` from `../lib/audit`
3. Auth events are the highest-priority audit targets — check auth.ts first in any audit review

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

## 🔴 CRITICAL — Unapplied Migrations Silently Break Auth (v4.29 — 4+ Hours Lost)

**Code referencing a column that doesn't exist in production = silent total auth failure.**

### The Bug

Commit `5bd452b` added `u.platform_role` to the `verifySession` SQL query and the `Session` interface. The corresponding migration file (`2026-02-09-platform-admin.sql`) existed in `migrations/` but was **never run against the production database**. Result: every call to `verifySession` threw `column u.platform_role does not exist`, the catch block returned `null` with zero logging, and **every authenticated request returned 401**.

### Why It's Insidious

- Login itself still works (session is created in DB) — user sees "login success"
- Session verification silently fails — dashboard shows "unauthenticated"
- The `catch(error) { return null }` pattern hides the real error completely
- No logs, no 500, no stack trace — just `{user: null}` from `/auth/session`
- The migration file exists in the repo, so it _looks_ like it was applied
- TypeScript compiles fine — the column is a string in a template literal

### Compounding Bug: PBKDF2 Iteration Limit

Same session also set `PBKDF2_ITERATIONS = 120_000` but Cloudflare Workers hard-caps at 100,000. This silently broke signup and password hash upgrades on login. The rehash try/catch hid this failure too.

### Prevention

1. **ALWAYS run migrations against production BEFORE deploying code that references new columns**
2. **Never swallow errors silently** — every `catch` block in auth/session code MUST `console.error()` the actual error message
3. After adding any column to a SQL query, verify it exists: `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'platform_role'`
4. When adding crypto parameters (iterations, key size), check the runtime's limits — Cloudflare Workers PBKDF2 max = 100,000 iterations
5. Add a deployment checklist item: "Are there unapplied migrations in `migrations/`?"

---

## 🔴 CRITICAL — Fail-Closed Webhook Verification With Missing Secret (v4.29 — Live Translation Silently Dead)

**A fail-closed guard on a missing secret blocks the entire webhook pipeline, not just one feature.**

### The Bug

The Telnyx webhook handler at `workers/src/routes/webhooks.ts` line 142 checked for `TELNYX_WEBHOOK_SECRET`. When the secret was not configured (it was never added via `wrangler secret put`), the handler returned HTTP 500 for **all** incoming Telnyx webhooks — including `call.initiated`, `call.answered`, `call.hangup`, and `call.transcription` events.

This meant:

- **Live translation never fired** — `call.transcription` events were rejected before reaching `handleCallTranscription`
- **Call status updates never arrived** — calls showed as "pending" forever in the DB
- **Recording webhooks were rejected** — no recording URLs stored

The user's 10:37pm call had translation enabled (`translate: true`, `live_translate: true`), Telnyx sent transcription webhooks, but every one was 500'd at the door.

### Why It's Insidious

- The translation pipeline has 6+ components (Telnyx call config → transcription → webhook → OpenAI → DB → SSE) — hard to pinpoint which link is broken
- The `call_translations` table exists, `OPENAI_API_KEY` is configured, voice config has translation enabled — everything looks correct
- The webhook secret was listed in `wrangler.toml` comments and `scripts/verify-env.ts` as `required: false`
- The verification function used HMAC-SHA256 but Telnyx V2 actually uses ed25519 signatures — even if the secret were set, verification would fail
- No Cloudflare Workers logs are easily visible for webhook 500s
- Calls still "work" (Telnyx connects calls) — only the post-connect webhooks fail

### Prevention

1. **Webhook signature verification must fail-open with a warning when the secret is not configured** — production should set the secret, but missing it should not silently kill all webhooks
2. **Every env secret listed in `wrangler.toml` comments should have a corresponding integration test** that verifies it's actually set
3. **When debugging a pipeline, test each link independently** — don't assume upstream components are fine just because the table and config exist
4. **Use `wrangler secret list` as a diagnostic step** — compare against the secrets the code expects

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

| Date  | Issue                           | Root Cause                                  | Hours Lost | Fix                        |
| ----- | ------------------------------- | ------------------------------------------- | ---------- | -------------------------- |
| Feb 5 | Auth sessions not verifying     | DB connection order (HYPERDRIVE first)      | 4+         | Swap to NEON_PG_CONN first |
| Feb 5 | /api/calls WebSocket error      | Same — HYPERDRIVE first in getDb()          | 2+         | Same fix                   |
| Feb 5 | Login works but session invalid | Inconsistent connection order across files  | 2+         | Standardized all files     |
| Feb 6 | 30+ components 401 in prod      | Raw fetch() without Bearer token            | 3+         | Migrated to apiClient      |
| Feb 6 | Billing 500 error               | Missing `plan` column in orgs table         | 1          | Graceful column fallback   |
| Feb 6 | Voice config 400                | Org validation too strict                   | 0.5        | Fall back to session org   |
| Feb 6 | Idempotency silently broken     | CORS not exposing Idempotency-Key header    | 1          | Added to CORS config       |
| Feb 7 | Rate limiting gap               | Only auth.ts had rate limits                | 0          | Extended to 6 route files  |
| Feb 8 | Login works, dashboard blocked  | Missing `platform_role` column in users     | 4+         | Applied migration to DB    |
| Feb 8 | Signup & hash rehash fail       | PBKDF2 iterations 120k > CF Workers 100k    | 1          | Reduced to 100,000         |
| Feb 9 | Live translation silent failure | TELNYX_WEBHOOK_SECRET not set → 500 rejects | 2          | Fail-open with warning     |

**Total hours lost to preventable issues: ~20+**

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

---

## 🔴 Session 3 Deep Audit — Voice/Translation/DB Patterns (February 2026)

### SSE Streams Must Not Hold DB Connections

**live-translation.ts** held a single `getDb()` Pool for up to 30 minutes during SSE streaming. Neon serverless connections are expensive edge resources. **Fix:** Open/close a fresh DB connection per poll iteration inside the SSE loop. The cost of connection setup (~5ms) is negligible vs the 1-second poll interval.

### Plan Gating Must Be Enforced, Not Just Commented

A comment said "requires business plan" but no code enforced it. **Rule:** If a feature is plan-gated, the middleware or handler MUST check `organizations.plan` before proceeding. Never rely on frontend-only gating.

### Auth Before DB — Always

Six handlers in voice.ts called `getDb(c.env)` before `requireAuth(c)`. This means unauthenticated requests waste a DB pool connection. **Rule:** `requireAuth()` (or `requireRole()`) MUST be the first call in every handler. Only acquire DB after auth succeeds.

### Audit Logs on All Mutations

POST /targets and DELETE /targets/:id had no audit trail. **Rule:** Every CREATE, UPDATE, DELETE operation MUST call `writeAuditLog()`. Add new action constants to `AuditAction` as needed.

### Never Leak Internal IDs in External URLs

webrtc.ts embedded `org_id` in the Telnyx webhook callback URL. **Rule:** Webhook URLs should contain only the minimum correlation key (e.g., `call_id`). Internal identifiers like organization_id must never appear in URLs sent to third parties.

### No DDL in Request Handlers

calls.ts had `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS` inside request handlers. This causes: (1) unnecessary DDL execution per request, (2) schema drift if migrations are run separately, (3) permission issues in pooled connections. **Rule:** All DDL goes in migration files under `migrations/`. Request handlers only do DML.

### statement_timeout Belongs in Connection Options

db.ts ran `SET statement_timeout = 30000` as a separate query before every user query, doubling round-trips. **Fix:** Use Pool's `options` parameter: `options: '-c statement_timeout=30000'`. This sets the timeout at connection time with zero extra queries.

### Telnyx Webhook Signing — HMAC vs Ed25519

Telnyx V2 webhooks can sign with either shared-secret HMAC or Ed25519 public key. Our verification used HMAC-SHA256 but read the `telnyx-signature-ed25519` header. This works if your Telnyx portal is configured for shared-secret signing, but would fail silently with Ed25519. **Lesson:** Always verify which signing method your Telnyx application uses. For Ed25519, you need to import the public key and use `crypto.subtle.verify('Ed25519', ...)`.

---

## 🔴 CRITICAL — Credentials Committed to Git History (v4.29 Audit — Feb 8, 2026)

**Two files containing live production credentials were tracked in git.**

### The Files

| File                       | Contents                                             | Risk            |
| -------------------------- | ---------------------------------------------------- | --------------- |
| `workers/.neon_secret.txt` | Full Neon PostgreSQL connection string with password | Database access |
| `migrations/rclone.conf`   | R2 access key + secret key                           | Storage access  |

### Why It Happened

- Both files were created during infrastructure setup for one-off tasks (manual migration, R2 sync)
- Neither was in `.gitignore` at creation time
- No pre-commit hook checked for credential patterns

### The Fix (v4.29 Audit)

1. Files removed from tracking with `git rm --cached`
2. Both patterns added to `.gitignore` (`workers/.neon_secret.txt`, `**/rclone.conf`, `**/*.secret.txt`)
3. **Credentials must be rotated** — even after removal, they persist in git history

### Prevention

1. **Never create credential files** without FIRST adding the pattern to `.gitignore`
2. Add `detect-secrets` or `gitleaks` as a pre-commit hook to catch credential patterns
3. For one-off tasks, use environment variables or Cloudflare `wrangler secret` — never plaintext files
4. Periodically audit git history: `git log --all --diff-filter=A -- '*.secret*' '*.conf' '*.key'`

---

## 🟠 HIGH — Dead Frontend DB Code Creates False Architecture (v4.29 Audit — Feb 8, 2026)

**Nine frontend files directly imported `@/lib/pgClient` — code that can never execute in static export.**

### The Files Deleted

| File                           | Purpose                           | Workers Equivalent               |
| ------------------------------ | --------------------------------- | -------------------------------- |
| `lib/pgClient.ts`              | Pool singleton using `pg` library | `workers/src/lib/db.ts`          |
| `lib/neon.ts`                  | Neon serverless client            | `workers/src/lib/db.ts`          |
| `lib/rateLimit.ts`             | Token bucket using pgClient       | `workers/src/lib/rate-limit.ts`  |
| `lib/idempotency.ts`           | Idempotency keys using pgClient   | `workers/src/lib/idempotency.ts` |
| `lib/cache.ts`                 | Edge cache using pgClient         | Workers KV                       |
| `lib/kv-sessions.ts`           | KV session store                  | Workers KV sessions              |
| `services/callPlacer.ts`       | Call placement using pgClient     | `workers/src/routes/voice.ts`    |
| `services/reportGenerator.ts`  | Report gen using pgClient         | `workers/src/routes/reports.ts`  |
| `services/auditLogger.ts`      | Audit using pgClient              | `workers/src/lib/audit.ts`       |
| `services/callMonitor.ts`      | Monitoring using pgClient         | Workers routes                   |
| `services/webhookDelivery.ts`  | Webhook dispatch using pgClient   | `workers/src/routes/webhooks.ts` |
| `services/edgeCacheService.ts` | Cache service                     | Workers KV                       |

### Why This Matters

- `pgClient.ts` used the `pg` library (TCP-only) with `rejectUnauthorized: false` — MITM-vulnerable and incompatible with edge runtimes
- `neon.ts` created a module-level singleton pool — violates the per-request create-and-close pattern
- A developer might import from `@/lib/rateLimit` instead of `workers/src/lib/rate-limit` and get zero runtime errors but zero rate limiting
- Tree-shaking might pull `pg` or `@neondatabase/serverless` into the client bundle

### Prevention

1. **Rule:** No file under `lib/` or `services/` (frontend) may import database clients
2. After any architecture migration, audit for orphaned files that reference the old pattern
3. The `services/` directory was deleted entirely — all service logic lives in Workers routes

---

## 🟠 HIGH — Report Download URL Points to Wrong Domain (v4.29 Audit — Feb 8, 2026)

**`app/reports/page.tsx` used a relative URL for exports, resolving to the Pages domain (no API) instead of the Workers domain.**

### The Bug

```typescript
// BEFORE (broken) — resolves to https://voxsouth.online/api/reports/...
window.open(`/api/reports/${reportId}/export?format=${format}`, '_blank')

// AFTER (fixed) — resolves to https://wordisbond-api.adrper79.workers.dev/api/reports/...
window.open(resolveApiUrl(`/api/reports/${reportId}/export?format=${format}`), '_blank')
```

### Prevention

1. **NEVER use relative `/api/` URLs** in the frontend — static export has no API routes
2. Always use `resolveApiUrl()` or `API_BASE` from `@/lib/apiClient` for any API URL
3. `window.open()` calls to API endpoints need the same treatment as `fetch()` calls

---

## 🔴 CRITICAL — Removing `.passthrough()` Requires Consumer Audit (v4.29 — Session 4, Feb 8, 2026)

**Removing `.passthrough()` from a Zod schema can break consumers that rely on extra fields passing through validation.**

### The Bug

`VoiceConfigSchema.modulations` used `.passthrough()` which allowed arbitrary extra fields. The route handler in `voice.ts` accessed `modulations.live_translate` — a property not explicitly defined in the schema. When `.passthrough()` was removed (BL-069), TypeScript immediately flagged `live_translate` as an unknown property.

### Why It's Insidious

- `.passthrough()` silently creates implicit contracts — consumers use fields that aren't in the schema definition
- TypeScript only catches it AFTER removal, not during the time `.passthrough()` was active
- The schema appears "clean" in code review but has hidden consumers relying on pass-through behavior

### Prevention

1. Before removing `.passthrough()`, `grep_search` for all properties accessed on the parsed result — not just the schema's explicit fields
2. When you find implicit fields, add them explicitly to the schema before removing `.passthrough()`
3. Prefer `.strict()` over `.passthrough()` for new schemas — it rejects extra fields immediately, forcing explicit definitions

---

## 🟠 HIGH — Hono Context Type Casting Requires `unknown` Intermediate (v4.29 — Session 4)

**Hono's middleware generic typing prevents direct `Context<A>` → `Context<B>` casts when the Variable types don't overlap.**

### The Bug

In `idempotency.ts`, accessing the session from Hono's context required:

```typescript
// ❌ FAILS — TypeScript error: types don't overlap
const session = (c as Context<{ Bindings: Env; Variables: { session: Session } }>).get('session')

// ✅ WORKS — double-cast through unknown
const session = (c as unknown as Context<{ Bindings: Env; Variables: { session: Session } }>).get(
  'session'
)
```

### Why It Happens

Hono's `Context<E>` type is generic over the full environment shape. When a middleware's `E` type doesn't include `Variables: { session: Session }`, TypeScript sees the two Context types as structurally incompatible and refuses the direct cast.

### Prevention

1. For middleware that needs session access, use the `unknown` intermediate cast pattern
2. Alternatively, define a shared `AppEnv` type and use it consistently across all middleware (done in BL-003 for routes, but not for standalone middleware)
3. Consider `c.get('session') as Session | undefined` with a runtime null-check as a simpler alternative

---

## 🟠 HIGH — Cross-Tenant Idempotency Key Collision (v4.29 — Session 4)

**Idempotency keys stored in KV without org-scoping caused cross-tenant data leaks.**

### The Bug

`idempotency.ts` stored keys as `idem:${key}`. If Org A and Org B both sent `Idempotency-Key: create-booking-123`, Org B would receive Org A's cached response — including Org A's data.

### The Fix

Changed to `idem:${orgId}:${key}`. When no session exists (pre-auth middleware), falls back to `idem:global:${key}`.

### Prevention

1. **Every KV/cache key MUST include tenant scope** — `organization_id` or `user_id`
2. Audit all KV operations for tenant isolation, not just database queries
3. The multi-tenant isolation checklist should include: DB WHERE clauses ✓, RLS policies ✓, KV key prefixes ✓

---

## 🟡 MEDIUM — Rate Limiter Wiring Requires Two Steps (v4.29 — Session 4)

**Creating a rate limiter in `rate-limit.ts` doesn't protect anything — it must also be wired into route handlers.**

### The Pattern

```typescript
// Step 1: Define in rate-limit.ts (necessary but not sufficient)
export const aiSummaryRateLimit = createRateLimiter({ requests: 5, window: 60 })

// Step 2: Wire into route handler (THIS is what actually protects)
routes.post('/:id/ai-summary', aiSummaryRateLimit, requireAuth, async (c) => { ... })
```

### Why 35 Endpoints Were Unprotected

Session 2 created rate limiters for auth endpoints but didn't audit mutation endpoints in other route files. The limiters existed but were never imported or used.

### Prevention

1. When adding a rate limiter, ALWAYS verify it's imported AND used in the route definition
2. Rate limit audit should check both `rate-limit.ts` (definitions) and route files (usage)
3. Group rate limiters by domain: auth, billing, AI, voice — makes coverage gaps obvious

---

## 🟡 MEDIUM — DB Migration Must Use NOT VALID + VALIDATE Pattern (v4.29 — Session 4)

**Adding NOT NULL constraints or FK constraints to existing tables can cause downtime if not done in two phases.**

### Zero-Downtime Pattern

```sql
-- Phase 1: Add constraint without validating existing rows (fast, minimal lock)
ALTER TABLE calls ADD CONSTRAINT calls_org_id_not_null
  CHECK (organization_id IS NOT NULL) NOT VALID;

-- Phase 2: Validate existing rows (slow, but doesn't block writes)
ALTER TABLE calls VALIDATE CONSTRAINT calls_org_id_not_null;

-- Phase 3: Set the actual NOT NULL (instant, since constraint guarantees it)
ALTER TABLE calls ALTER COLUMN organization_id SET NOT NULL;

-- Phase 4: Drop redundant check constraint
ALTER TABLE calls DROP CONSTRAINT calls_org_id_not_null;
```

### Why Direct ALTER Fails

`ALTER TABLE ... ALTER COLUMN ... SET NOT NULL` without prior validation acquires an ACCESS EXCLUSIVE lock and scans the entire table — blocking all reads/writes for the duration.

### Prevention

1. Always use NOT VALID + VALIDATE for constraints on tables with production data
2. Wrap migrations in `BEGIN/COMMIT` for atomicity
3. Use `IF NOT EXISTS` / `IF EXISTS` guards for idempotency
4. Test migrations on a Neon branch before applying to main

---

## 🔴 CRITICAL — Auth Before DB: Always Call `requireAuth()` Before `getDb()` (v4.29 — Session 5, Feb 9, 2026)

**Opening a DB connection before checking auth wastes pool slots on unauthenticated traffic.**

### The Bug

27 route handlers across 5 files (`collections.ts`, `admin.ts`, `compliance.ts`, `scorecards.ts`, `audio.ts`) called `const db = getDb(c.env)` as their first statement, then called `requireAuth(c)` inside the `try` block. On 401 rejections, the DB connection was opened, used for nothing, then closed in `finally`. Under unauthenticated traffic spikes, this exhausts the Neon connection pool (100 max on free tier).

### Prevention

1. **Pattern:** `requireAuth()` → 401 early return → `getDb()` → `try/finally { db.end() }`
2. Any new route handler should be reviewed for auth-before-db ordering
3. Add a linting rule or code review checklist item for this pattern

---

## 🔴 CRITICAL — Cron Jobs Must Call `db.end()` (v4.29 — Session 5)

**`scheduled.ts` leaked 3 DB connections per cron cycle because functions never closed them.**

### The Bug

All 3 cron functions (`retryFailedTranscriptions`, `cleanupExpiredSessions`, `aggregateUsage`) called `getDb(env)` but never called `db.end()`. Unlike HTTP handlers (which have a `finally` block pattern), the cron functions were just bare async functions with no cleanup. Over time, this exhausts the connection pool.

### Prevention

1. Every function that calls `getDb()` MUST have a corresponding `db.end()` in a `finally` block
2. Grep for `getDb(` and verify each call site has a matching `db.end()` or `await db.end()` in finally

---

## 🟠 HIGH — Always Verify Sub-Agent Results (v4.29 — Session 5)

**Sub-agents may report changes that were already in place or report stale file state.**

### The Bug

A sub-agent was tasked with fixing `LiveTranslationPanel.tsx` to use `apiFetch` from `@/lib/apiClient` instead of raw `fetch()`. It reported making the fix. But upon reading the actual file, it already had `import { apiFetch } from '@/lib/apiClient'` on line 5 and used `apiFetch` at line 85. The sub-agent either read stale context or reported changes that matched the existing code.

Similarly, another sub-agent reported fixing BL-054 webhook handlers, but the file already had the `AND organization_id IS NOT NULL` guards in place from a prior session.

### Prevention

1. Always `read_file` after a sub-agent reports changes to verify the actual file state
2. Don't trust sub-agent "diff" reports — verify by reading the file directly
3. Mark items as "verified fixed" only after independent confirmation

---

## 🟡 MEDIUM — Rate Limiters Need Brute-Force Tiers (v4.29 — Session 5)

**Verification code endpoints need stricter rate limits than general mutation endpoints.**

### The Bug

The caller-id PUT /verify endpoint accepted a 6-digit code with no rate limiting. An attacker could brute-force all 1,000,000 combinations in minutes. General rate limiters (20/5min) are insufficient for sensitive verification flows.

### Prevention

1. Verification/OTP endpoints: Use strict limits (5/5min per IP)
2. General mutation endpoints: Standard limits (20–30/5min)
3. Read-only endpoints: Relaxed limits (60/5min) or no rate limiting
4. Always consider the attack surface when setting rate limit tiers
