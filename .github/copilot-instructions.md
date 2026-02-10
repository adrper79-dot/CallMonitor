# Copilot Custom Instructions — Word Is Bond Platform

## Project Identity

- **Product:** Word Is Bond — AI-powered voice intelligence platform for call centers
- **Stack:** Next.js 15 (static export on Cloudflare Pages) + Hono 4.7 (Cloudflare Workers API) + Neon PostgreSQL 17 + Telnyx (voice) + Stripe (billing)
- **URLs:** `https://wordis-bond.com` (UI) | `https://wordisbond-api.adrper79.workers.dev` (API)
- **Version:** v4.29 | **Progress:** 109/109 ROADMAP items (100%)

## Critical Rules (NEVER Violate)

### 1. Database Connection Order

```
✅ c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
❌ c.env.HYPERDRIVE?.connectionString || c.env.NEON_PG_CONN
```

Neon serverless uses WebSocket; Hyperdrive uses TCP. Reversing causes HTTP 530. Use `getDb(c.env)` from `workers/src/lib/db.ts`.

### 2. No Server-Side Code in Next.js

Static export (`output: 'export'`). No API routes, no `getServerSideProps`, no `cookies()`, no `headers()`. All API lives in `workers/src/routes/`.

### 3. Audit Log Columns

Use `old_value` / `new_value` — NOT `before` / `after`. Always use `writeAuditLog()` from `workers/src/lib/audit.ts`.

### 4. Bearer Token Auth

Client components must use `apiGet/apiPost/apiPut/apiDelete` from `@/lib/apiClient`. Never raw `fetch()` to API endpoints.

### 5. Multi-Tenant Isolation

Every business query MUST include `organization_id` in WHERE clause. Get from `c.get('session').organization_id` after `requireAuth()`.

### 6. Parameterized Queries Only

Always `$1, $2, $3` — never string interpolation in SQL.

## Architecture Patterns

### Workers Route Handler

```typescript
import { getDb } from '../lib/db'
import { requireAuth } from '../lib/auth'
import { writeAuditLog, AuditAction } from '../lib/audit'

routes.post('/resource', rateLimit, async (c) => {
  const session = c.get('session')
  const db = getDb(c.env)
  try {
    const result = await db.query('INSERT INTO ... WHERE organization_id = $1 RETURNING *', [
      session.organization_id,
    ])
    writeAuditLog(db, {
      userId: session.user_id,
      orgId: session.organization_id,
      action: AuditAction.RESOURCE_CREATED,
      resourceType: 'resource',
      resourceId: result.rows[0].id,
      oldValue: null,
      newValue: result.rows[0],
    }).catch(() => {})
    return c.json({ data: result.rows[0] }, 201)
  } finally {
    await db.end()
  }
})
```

### Key Utilities (ONE canonical source each)

| Concern     | File                             | Usage                             |
| ----------- | -------------------------------- | --------------------------------- |
| DB          | `workers/src/lib/db.ts`          | `getDb(env)` → `DbClient`         |
| Auth        | `workers/src/lib/auth.ts`        | `requireAuth()` middleware        |
| Rate limit  | `workers/src/lib/rate-limit.ts`  | Pre-configured limiters           |
| Idempotency | `workers/src/lib/idempotency.ts` | `idempotency()` middleware        |
| Audit       | `workers/src/lib/audit.ts`       | `writeAuditLog()` fire-and-forget |
| Validation  | `workers/src/lib/schemas.ts`     | Zod schemas                       |
| Logging     | `workers/src/lib/logger.ts`      | Structured JSON logger            |
| RBAC        | `workers/src/lib/rbac-v2.ts`     | Role hierarchy                    |

### CORS Custom Headers

When adding custom request/response headers, update `workers/src/index.ts` CORS config — both `allowHeaders` and `exposeHeaders`.

## AI Role Policy

AI operates as a **notary/stenographer** — observes, records, assists. Does NOT autonomously initiate calls, modify evidence, or take unsupervised actions. See `ARCH_DOCS/01-CORE/AI_ROLE_POLICY.md`.

## Session Start Checklist

Read these files first:

1. `ARCH_DOCS/CURRENT_STATUS.md` — version, deployment state
2. `ROADMAP.md` — progress, remaining items
3. `ARCH_DOCS/LESSONS_LEARNED.md` — pitfalls to avoid

## Deploy Chain

```bash
npm run api:deploy    # Workers first
npm run build         # Next.js static export
npm run pages:deploy  # Pages second
npm run health-check  # Verify
```

Always deploy + health-check BEFORE committing.
