# Agent Prompt: Stack Integration (STACK EXCELLENCE)

**Scope:** Telnyx VXML, Stripe usage metering, subscription management, AI proxies, RLS policy audit  
**ROADMAP Section:** 🚀 STACK EXCELLENCE (Full-Stack Integration) — 5/12 complete  
**Priority:** HIGH — revenue-critical integrations and data security

---

## Your Role

You are the **Stack Integration Agent** for the Word Is Bond platform. Your job is to complete third-party service integrations (Telnyx, Stripe, AssemblyAI, OpenAI, ElevenLabs) and ensure database-level security policies are properly configured.

## Context Files to Read First

1. `ARCH_DOCS/CURRENT_STATUS.md` — current version and deployment state
2. `ROADMAP.md` — search for "STACK EXCELLENCE" section
3. `ARCH_DOCS/LESSONS_LEARNED.md` — critical pitfalls
4. `ARCH_DOCS/DATABASE_CONNECTION_STANDARD.md` — DB connection rules
5. `workers/src/routes/webhooks.ts` — existing Telnyx + Stripe webhook handlers
6. `workers/src/routes/billing.ts` — Stripe billing routes
7. `workers/src/routes/calls.ts` — call management routes
8. `workers/src/lib/rate-limit.ts` — existing rate limiters
9. `wrangler.jsonc` — Cloudflare Workers bindings (KV, R2, secrets)

## Remaining Items (7 of 12)

### Telephony (Telnyx VXML)

#### 1. Telnyx VXML Migration (4hr)

- **Current:** `app/_api_to_migrate/calls/` has legacy SWML call flows
- **Target:** Convert to Telnyx Command API (call control via REST)
- **Already done:** Webhooks (`webhooks.ts`) already handle Telnyx call events
- **Already done:** Recordings (`recordings.ts`) already use R2 storage
- **Action:** Create `workers/src/lib/telnyx.ts` — typed Telnyx API client

### Billing (Stripe)

#### 2. Usage Metering (2hr)

- **Target:** Track call minutes + transcription tokens per org per billing period
- **Action:** Create `workers/src/lib/usage.ts` — usage tracking utility
- **Storage:** New `usage_records` table or KV-based counters
- **Integration:** Report to Stripe metered billing API at period end

#### 3. Subscription Management (1hr)

- **Current:** Subscription logic is embedded in `webhooks.ts`
- **Target:** Extract to `workers/src/routes/subscriptions.ts`
- **Action:** CRUD routes for subscription plans, upgrades, cancellations
- **Pattern:** Follow existing route handler pattern with rate limiting + audit

### AI Stack (Edge Proxies)

#### 4. AssemblyAI Proxy (1hr)

- **Target:** `workers/src/routes/ai/transcribe.ts`
- **Purpose:** Edge proxy for transcription API — hide API key, add rate limiting
- **Pattern:** Proxy request to AssemblyAI, stream response back
- **Auth:** `requireAuth()` + org-level rate limiting via KV

#### 5. OpenAI Rate Limiter (1hr)

- **Target:** `workers/src/lib/ai/openai.ts`
- **Purpose:** KV-based per-org rate throttling for OpenAI calls
- **Pattern:** Wrap OpenAI SDK with KV counter, fail-open on KV error
- **Integration:** Used by Bond AI chat (Tier 1-3)

#### 6. ElevenLabs TTS (1hr)

- **Target:** `workers/src/lib/ai/elevenlabs.ts`
- **Purpose:** KV cache for generated voice audio (same text = cache hit)
- **Pattern:** Hash text input → check KV → generate if miss → cache in KV
- **Integration:** Used by live translation and TTS generator

### Database (Neon)

#### 7. RLS Policy Audit (1hr)

- **Script exists:** `scripts/rls-audit.sql` — run against production
- **Command:** `npm run db:rls-audit`
- **Action:** Run, review results, create migration SQL for any gaps
- **Target:** Every business table has `org_id`-scoped RLS policy

## Existing Stack Integration Points

| Service    | Binding/Secret                                  | Current Status                    |
| ---------- | ----------------------------------------------- | --------------------------------- |
| Telnyx     | `TELNYX_API_KEY`                                | Webhooks ✅, Call control partial |
| Stripe     | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`    | Webhooks ✅, Billing partial      |
| AssemblyAI | `ASSEMBLYAI_API_KEY`                            | Direct client-side (needs proxy)  |
| OpenAI     | `OPENAI_API_KEY`                                | Direct client-side (needs proxy)  |
| ElevenLabs | `ELEVENLABS_API_KEY`                            | Direct client-side (needs proxy)  |
| Neon       | `NEON_PG_CONN`                                  | Full connection ✅                |
| KV         | `RATE_LIMIT_KV`, `SESSION_KV`, `IDEMPOTENCY_KV` | All configured ✅                 |
| R2         | `RECORDINGS_BUCKET`                             | Recordings storage ✅             |

## Critical Rules

- **DB Connection:** ALWAYS `NEON_PG_CONN` first, then HYPERDRIVE fallback
- **API Keys:** NEVER expose third-party API keys to client — proxy through Workers
- **Rate Limiting:** All new endpoints must have rate limiters (use `workers/src/lib/rate-limit.ts`)
- **Audit Logging:** All mutations must call `writeAuditLog()` fire-and-forget
- **Fail-Open:** KV-based features (rate limiting, caching) must fail-open
- **Parameterized SQL:** Always `$1, $2, $3` — never string interpolation
- **Multi-Tenant:** Every query includes `org_id` in WHERE clause

## Workers Route Handler Template

```typescript
import { Hono } from 'hono';
import { getDb } from '../lib/db';
import { requireAuth } from '../lib/auth';
import { writeAuditLog, AuditAction } from '../lib/audit';
import { rateLimit } from '../lib/rate-limit';

const routes = new Hono();
const apiRateLimit = rateLimit({ max: 20, windowMs: 5 * 60 * 1000 });

routes.use('/*', requireAuth());

routes.post('/endpoint', apiRateLimit, async (c) => {
  const session = c.get('session');
  const db = getDb(c.env);
  try {
    const result = await db.query(
      'INSERT INTO table (org_id, ...) VALUES ($1, ...) RETURNING *',
      [session.orgId, ...]
    );
    writeAuditLog(db, {
      userId: session.userId,
      orgId: session.orgId,
      action: AuditAction.RESOURCE_CREATED,
      resourceType: 'resource',
      resourceId: result.rows[0].id,
      oldValue: null,
      newValue: result.rows[0],
    }).catch(() => {});
    return c.json({ data: result.rows[0] }, 201);
  } finally {
    await db.end();
  }
});

export default routes;
```

## Success Criteria

- Telnyx call control fully operational (create, answer, hangup, transfer)
- Stripe usage metering tracking call minutes per org
- Subscription CRUD routes extracted from webhooks.ts
- AI services proxied through Workers (no client-side API key exposure)
- RLS policies verified on all business tables
- All 12 items marked `[x]` in ROADMAP.md
