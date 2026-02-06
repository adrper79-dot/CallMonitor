# Cloudflare & Codebase Roadmap (Updated: Feb 2, 2026)

**Architecture**: ✅ **HYBRID GOSPEL** - Static UI (Cloudflare Pages) + Workers API (Hono) + Neon Postgres (Hyperdrive)  
**Deployment**: ✅ Live at https://voxsouth.online (Pages) + https://wordisbond-api.adrper79.workers.dev (API)  
**Status**: ✅ **PRODUCTION** — Custom Workers auth (9 endpoints), all API routes live, 29/29 production-verified  
**Progress**: 54/109 items complete | Tests: ✅ GREEN CI (123 passed, 87 skipped) | Lint: ✅ PASSING (126 warnings)

> **Auth**: ✅ RESOLVED — Custom session-based auth built on Cloudflare Workers (Hono). PBKDF2 passwords, CSRF protection, KV rate limiting, HttpOnly cookies. See [AUTH_ARCHITECTURE_DECISION.md](AUTH_ARCHITECTURE_DECISION.md).

---

## 🚨 BLOCKERS (Deploy/Tests) - PROGRESS: 15/15 ✅ COMPLETE

### ✅ Completed

- [x] **Tests/DB Auth** (`tests/setup.ts`): Added Neon/pg mocks. ✅
- [x] **Build Static** (`next.config.js`): `output: 'export'` configured. ✅
- [x] **Vitest Timeout** (`vitest.config.ts`): 30s timeout set. ✅
- [x] **UUID Mock** (`tests/setup.ts`): Added uuid mock. ✅
- [x] **RateLimit Reset** (`rateLimit.test.ts`): Fixed flaky timing test. ✅
- [x] **Compliance RLS** (`compliance.test.ts`): Added vitest mocks. ✅
- [x] **CRM Token** (`crm-integration.test.ts`): Mocked pool + crmService. ✅
- [x] **Translation Mock** (`translation.test.ts`): Fixed pgClient mock. ✅
- [x] **Cron Triggers** (`workers/wrangler.toml`): Added scheduled handlers. ✅
- [x] **Health Route** (`workers/src/routes/health.ts`): DB/KV/R2 checks. ✅
- [x] **Env Verify** (`scripts/verify-env.ts`): Pre-deploy validation. ✅
- [x] **Auth Migration** (`migrations/auth_pg_adapter.sql`): Created. ✅
- [x] **Integration Tests Skippable** (`describeOrSkip` pattern): 13 test files marked. ✅
- [x] **Orphaned Code Cleanup** (`__tests__/*.ts`): Fixed syntax errors. ✅
- [x] **Missing Imports** (`tier1-features.test.ts`): Added FEATURE_FLAGS import. ✅

### 📋 Status

> **All blockers resolved!** CI is now green with 123 passing tests.
> Integration tests run with: `RUN_INTEGRATION=1 npm test`

---

## ⚠️ RISK/SCALE (Perf/Sec) - PROGRESS: 14/25

### ✅ Completed

- [x] **Cache TTL** (`lib/cache.ts`): ORG preset bumped to 10m/24h. ✅
- [x] **Cron Triggers** (`workers/wrangler.toml`): 3 crons configured. ✅
- [x] **Health Route** (`workers/src/routes/health.ts`): Full bind checks. ✅
- [x] **Deps Audit** (`package.json`): Removed 10 unused packages. ✅
- [x] **Workers Split** (`workers/`): Hono API fully scaffolded. ✅
- [x] **Hyperdrive Fallback** (`lib/pgClient.ts`): Bind preference. ✅
- [x] **KV Sessions** (`workers/src/lib/auth.ts`): JWT via KV. ✅
- [x] **Scheduled Handler** (`workers/src/scheduled.ts`): Cron jobs. ✅
- [x] **R2 Proxy** (`workers/src/routes/recordings.ts`): Full R2 recordings CRUD + signed URLs. ✅
- [x] **RateLimit Edge** (`workers/src/lib/rate-limit.ts`): KV-backed rate limiting. ✅
- [x] **Pool Hardening** (`workers/src/lib/db.ts`): max=5, idle/connection timeouts, statement_timeout=30s. ✅
- [x] **Structured Logger** (`workers/src/lib/logger.ts`): JSON structured logging, all console.log/warn/error migrated. ✅
- [x] **Idempotency** (`workers/src/lib/idempotency.ts`): KV-backed, fail-open, 24h TTL, wired to billing/calls/bookings mutations. ✅
- [x] **Billing 500 Fix** (`workers/src/routes/billing.ts`): Column fallback for missing `plan` column. ✅

### 🔄 Remaining

- [ ] ~~**Sentry Workers** (`sentry.config.ts`): Edge init.~~ **N/A** — Sentry removed; use Cloudflare Logpush.
- [ ] **WAF Rules** (CF Dashboard): Rate limit /api. **10min**
- [ ] **Origin CA** (secrets): Custom TLS cert. **20min**
- [ ] **Image CDN** (`next.config.js`): CF Image Resizing. **15min**
- [ ] **RLS Audit** (`migrations/`): Policy coverage check. **1hr**
- [ ] **Audit Logs** (`lib/audit.ts`): All mutation logging. **1hr**
- [ ] **Backup Policy** (`scripts/`): Weekly Neon backup. **1hr**
- [ ] **Schema Drift** (`current_schema.sql`): CI diff check. **1hr**
- [ ] **Public Compress** (`public/branding/`): WebP conversion. **30min**
- [ ] **OpenAPI Gen** (`public/openapi.yaml`): Zod-based. **1hr**

### 📋 Recommendations

> **Priority**: WAF rules + RLS Audit (core resilience).
> **Security**: WAF rules should be configured in CF Dashboard immediately.
> **Compliance**: RLS Audit critical for HIPAA/SOC2 requirements.
> **Resilience**: ✅ Idempotency layer complete — billing, calls, bookings protected.

---

## 🔧 DX/CI (Dev Flow) - PROGRESS: 13/20

### ✅ Completed

- [x] **gitignore** (`.gitignore`): Cleaned up patterns. ✅
- [x] **Vitest CI** (`vitest.config.ts`): Coverage thresholds 60%. ✅
- [x] **Scripts Menu** (`package.json`): Organized npm scripts. ✅
- [x] **Env Example** (`.env.example`): All vars documented. ✅
- [x] **Tier1 Guard** (`vitest.config.ts`): Test gate ready. ✅
- [x] **describeOrSkip Pattern** (all test files): Integration tests skippable. ✅
- [x] **Test Syntax Fixes** (`__tests__/*.ts`): Orphaned code cleanup. ✅
- [x] **Prettier** (`.prettierrc`): Config added + format scripts. ✅
- [x] **ESLint Flat Config** (`eslint.config.mjs`): ESLint 9 migration. ✅
- [x] **Lint Fix** (`eslint`): 0 errors, 126 warnings (gradual cleanup). ✅
- [x] **React Hooks Fix** (`useVoiceConfig.tsx`): Fixed conditional hooks violation. ✅
- [x] **Husky** (`.husky/pre-commit`): Pre-commit hooks with lint-staged (ESLint + Prettier). ✅
- [x] **Console Cleanup** (`workers/src/`): All console.log/warn/error → structured logger. ✅

### 🔄 Remaining

- [ ] **Types Gen** (`cloudflare-env.d.ts`): CI hook. **10min**
- [ ] **Test E2E** (`tests/e2e/`): Playwright setup. **2hr**
- [ ] **DB Reset** (`scripts/db:reset-test`): Truncate test data. **30min**
- [ ] **Manual Tests** (`tests/manual/`): Automate. **1hr**
- [ ] **Schema Doc** (`schema.sql`): Mermaid ERD. **1hr**
- [ ] **README Scripts** (`README.md`): Document all. **30min**
- [ ] **Permission Matrix** (`tools/`): RBAC gen. **30min**

### 📋 Recommendations

> **Quick Wins**: Types Gen CI hook (10min), DB Reset script (30min), README scripts doc (30min).
> **E2E**: Consider Playwright for critical flows (signin, call start).
> **Docs**: Schema ERD helps onboarding new developers.
> **Pre-commit**: ✅ Husky + lint-staged now auto-lint + auto-format on commit.

---

## 🏆 DESIGN/CODE EXCELLENCE (ARCH_DOCS Alignment) - PROGRESS: 4/12

**Standards**: Call-rooted architecture, single Voice Ops UI, immutable data (CAS), edge-first, strict RBAC, Telnyx integration.
**Practices**: Typesafe (Zod validation), DRY principles, structured logging (no console.log), error boundaries, modular libs.
**Elegant**: Modular architecture, HOFs/custom hooks, performance (Suspense/streaming), design system (cva).

### 🚨 Design Violations (Architecture)

- [ ] **SWML → Telnyx** (`app/api/calls/*`, `lib/signalwire*`, `tests/call*`): Migrate to Telnyx VXML. **4hr**
- [ ] **Multi-Pages Consolidation** (`app/*` vs `/voice`): Single Voice Ops root. **2hr**
- [x] **Console Logging** (`workers/src/`): Structured logger (`workers/src/lib/logger.ts`) + all routes migrated. ✅

### ⚠️ Best Practices (Code Quality)

- [x] **Zod API Validation** (`workers/src/lib/schemas.ts`): 45+ schemas, all POST/PUT routes validated. ✅
- [x] **Error Boundaries** (`app/error.tsx` + 10 route-specific): Root catch-all + key routes covered. ✅
- [x] **RBAC Hooks** (`hooks/useRole.ts`): `useRole`, `usePermissions` hooks + Workers RBAC route. ✅
- [ ] **Immutable Evidence** (`app/evidence/*`): RLS read-only views enforcement. **1hr**

### 🔧 Elegant Patterns (Developer Experience)

- [ ] **Lib Modules** (`lib/`): Split into `/db`, `/api`, `/ui` modules. **4hr**
- [ ] **Higher-Order Hooks** (`hooks/`): Create `useCallModulation` HOF. **2hr**
- [ ] **Suspense/Streaming** (`app/`): Add React Suspense boundaries. **1hr**
- [ ] **Tailwind CVA** (`components/` with raw clsx): Migrate to class-variance-authority. **2hr**

### 📋 Recommendations

> **Priority**: Zod validation (API security) + Error boundaries (stability) first.
> **Architecture**: Telnyx migration aligns with LAW compliance + vendor diversity.
> **Modularity**: Lib split enables better tree-shaking and faster builds.
> **Elegance**: CVA + HOFs reduce boilerplate, improve DX significantly.

---

## ✨ POLISH (Ongoing) - 40+ Items

Low priority, addressed during normal dev work:

- Unused imports cleanup (lint --fix)
- Console.log removal
- Comment cleanup
- Emoji standardization

---

## 📊 Test Status Summary

| Category    | Passed  | Skipped | Total   |
| ----------- | ------- | ------- | ------- |
| Unit Tests  | 81      | 58      | 139     |
| Integration | 42      | 29      | 71      |
| **Total**   | **123** | **87**  | **210** |

**CI Status**: ✅ GREEN (100% pass rate on non-skipped tests)

### Skipped Test Suites (Integration-Only)

These tests use `describeOrSkip` and run with `RUN_INTEGRATION=1`:

1. `startCallHandler.test.ts` - SignalWire integration
2. `startCallHandler.enforce.test.ts` - Voice config enforcement
3. `callExecutionFlow.test.ts` - Full call flow
4. `startCallFlow.test.ts` - Call start integration
5. `scoring.test.ts` - Scorecard with DB
6. `evidenceManifest.test.ts` - Artifact DB operations
7. `crm-integration.test.ts` - CRM sync
8. `compliance.test.ts` - HIPAA/SOC2 RLS
9. `external-entities.test.ts` - Entity overlay
10. `governed-caller-id.test.ts` - Caller ID governance
11. `immutable-search.test.ts` - Search layer
12. `rti-layer.test.ts` - RTI immutability
13. `tier1-features.test.ts` - Core features
14. `rateLimit.test.ts` - Rate limiting

### 📋 Test Recommendations

> **Run Integration Tests**: `RUN_INTEGRATION=1 npm run test:run`
> **Option B**: Create `.env.test.local` with real Neon test DB for full integration runs.
> **Option C**: Add GitHub Action that runs integration tests on `main` branch only.

---

## 🚀 Deployment Commands

```bash
# Verify environment before deploy
npm run env:verify

# Deploy UI (Cloudflare Pages)
npm run ui:deploy

# Deploy API (Cloudflare Workers)
npm run api:deploy

# Deploy both
npm run deploy:all   # Includes env:verify

# Check health
npm run health-check
```

---

## 📅 Next Sprint Priorities

### Week 1 (Feb 1-7)

1. ✅ Test mocks complete (123/210 passing, 87 integration-skipped)
2. ✅ Skip integration tests for CI (`describeOrSkip` pattern)
3. ✅ Prettier + ESLint flat config setup
4. ✅ Lint --fix completed (0 errors, 126 warnings)
5. ✅ Deploy UI + API to production
6. [ ] Configure WAF rules
7. ✅ ~~Set up Sentry for Workers~~ — Removed; using structured logger + Cloudflare Logpush

### Week 2 (Feb 8-14) - **Excellence Focus**

1. ✅ **Zod API Validation** (45+ schemas): All Workers routes validated
2. ✅ **Error Boundaries** (app/): Root + 10 route-specific boundaries
3. ✅ Console.log → Logger service migration (all Workers routes)
4. ✅ R2 proxy for recordings (already implemented in Workers)
5. ✅ KV-backed rate limiting (already implemented)
6. [ ] Playwright E2E for critical flows

### Week 3 (Feb 15-21) - **Architecture Refinement**

1. [ ] **Telnyx Migration** (SWML → Telnyx): Vendor diversity + LAW compliance
2. [ ] **Lib Modules** (lib/ → /db/api/ui): Modular architecture
3. [ ] **RBAC Hooks** (useOrgRole/usePermissions): DRY RBAC
4. [ ] RLS audit and hardening
5. [ ] Schema drift CI check

### Week 4+ (Feb 22+) - **Elegance & Scale**

1. [ ] **CVA Migration** (Tailwind): Design system
2. [ ] **Suspense/Streaming** (app/): Performance
3. [ ] **HOF Hooks** (useCallModulation): Elegant patterns
4. [ ] OpenAPI generation
5. [ ] Idempotency layer
6. [ ] Full audit logging

---

**Track**: Update [x] as items complete. **Progress**: 52/109 (48%).
**Last Updated**: Feb 7, 2026 by GitHub Copilot

---

## 🚀 STACK EXCELLENCE (Full-Stack Integration) — PROGRESS: 5/12

**Stack**: Cloudflare (Pages/Workers/Hyperdrive/R2/KV) + Neon (Postgres) + Telnyx (Voice) + Stripe (Billing) + AssemblyAI (Transcription) + OpenAI (LLM) + ElevenLabs (TTS)

### Telephony (Telnyx VXML)

- [ ] **Telnyx VXML Migration** (app/\_api_to_migrate/calls\*): Convert SWML → Telnyx Command API. **4hr**
- [x] **Webhook Handlers** (workers/src/routes/webhooks.ts): Telnyx call events + HMAC verification. ✅
- [x] **Call Recording Storage** (workers/src/routes/recordings.ts): R2 bucket integration + signed URLs. ✅

### Billing (Stripe)

- [x] **Stripe Webhooks** (workers/src/routes/billing.ts): HMAC-verified webhooks. ✅
- [ ] **Usage Metering** (lib/billing.ts): Track call minutes, transcriptions. **2hr**
- [ ] **Subscription Management** (workers/src/routes/subscriptions.ts): CRUD operations. **1hr**

### AI Stack (Edge Proxies)

- [ ] **AssemblyAI Proxy** (workers/src/routes/ai/transcribe.ts): Edge transcription. **1hr**
- [ ] **OpenAI Rate Limiter** (lib/ai/openai.ts): KV-based throttling. **1hr**
- [ ] **ElevenLabs TTS** (lib/ai/elevenlabs.ts): KV cache for voices. **1hr**

### Database (Neon)

- [x] **Connection Pool Hardening** (`workers/src/lib/db.ts`): max=5, idle/connection timeouts, statement_timeout=30s. ✅
- [x] **Query Timeout Config** (`workers/src/lib/db.ts`): Statement timeout = 30s via connection options. ✅
- [ ] **RLS Policy Audit** (migrations/): Verify all tables have RLS. **1hr**

---
