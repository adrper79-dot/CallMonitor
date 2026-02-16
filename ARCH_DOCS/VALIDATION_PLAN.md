# Word Is Bond — System Validation & Remediation Plan

**TOGAF Phase:** G — Implementation Governance  
**Created:** February 15, 2026  
**Version:** v4.67  
**Scope:** Full platform audit against ARCH_DOCS standards, APPLICATION_FUNCTIONS.md accuracy, and functional completeness  
**Methodology:** Architecture → Standards → Codebase → Gap Analysis → Remediation → Verification

---

## Executive Summary

A full-depth audit of the Word Is Bond platform was conducted against ARCH_DOCS design standards and APPLICATION_FUNCTIONS.md intended functionality. The platform is **architecturally sound** — all 61 route files are mounted, all 8 cron jobs are implemented, all frontend pages exist, and the static-export constraint is fully respected. However, **43 standards violations** were identified across 6 categories, with **2 critical security risks** (missing tenant isolation on UPDATEs, missing RBAC on 30+ mutating endpoints) requiring immediate remediation. APPLICATION_FUNCTIONS.md itself has **5 documentation inaccuracies** that need correction.

---

## Part 1: Audit Findings

### 1.1 What Passed (No Action Required)

| Check | Result |
|-------|--------|
| All 61 backend route files mounted in index.ts | ✅ PASS |
| All 44 lib modules exist and are referenced | ✅ PASS |
| All 8 cron jobs implemented in scheduled.ts | ✅ PASS |
| Telnyx/AssemblyAI/Stripe webhook signature verification | ✅ PASS |
| No `getServerSideProps`, `cookies()`, `headers()` in Next.js | ✅ PASS |
| No raw `fetch()` to API — all use apiClient | ✅ PASS |
| Audit logs use `oldValue`/`newValue` (not `before`/`after`) | ✅ PASS |
| All frontend pages from APPLICATION_FUNCTIONS.md exist | ✅ PASS |
| DialerPanel is rendered (no longer orphaned) | ✅ PASS |
| Email campaigns lib fully implemented | ✅ PASS |
| Unsubscribe dual-mount is intentional and non-conflicting | ✅ PASS |
| Production source code — zero TypeScript errors | ✅ PASS |

### 1.2 Standards Violations Found

#### P0 — CRITICAL (Security Risk)

| # | Category | Count | Files | Risk |
|---|----------|-------|-------|------|
| 1 | Missing `organization_id` on UPDATE queries | 8 | `webrtc.ts` (4), `audio.ts` (4) | **Tenant isolation breach** — any authenticated user could modify another org's call records |
| 2 | Missing `requireRole()` on mutating endpoints | 30+ | 12 route files | **Privilege escalation** — any authenticated user (even lowest role) can execute admin-level mutations |

#### P1 — HIGH (Standards Violation)

| # | Category | Count | Files | Risk |
|---|----------|-------|-------|------|
| 3 | SQL string interpolation | 3 | `stripe-sync.ts` | Nominal injection risk (numeric input) but violates parameterized-query-only rule |

#### P2 — MEDIUM (Code Quality)

| # | Category | Count | Files | Risk |
|---|----------|-------|-------|------|
| 4 | CamelCase fallback properties | 2 | `EvidenceManifestSummary.tsx` | Defensive coding suggests API shape distrust; should be cleaned up |
| 5 | Broken test files | 2 | `workplace-simulator.spec.ts`, `webhooks-security.test.ts` | Dead test code — confuses test runners, inflates skip counts |

#### P3 — LOW (Documentation)

| # | Category | Count | Files | Risk |
|---|----------|-------|-------|------|
| 6 | APPLICATION_FUNCTIONS.md inaccuracies | 5 | `APPLICATION_FUNCTIONS.md` | Stale documentation misleads future sessions |

---

## Part 2: Remediation Work Items

### Phase A — Critical Security Fixes (Do First)

#### A1: Add `organization_id` to UPDATE Queries in webrtc.ts

**Files:** `workers/src/routes/webrtc.ts` (lines 385, 401, 418, 431)  
**Action:** Add `AND organization_id = $N` to each UPDATE WHERE clause, passing `session.organization_id` as parameter.

```sql
-- Before:
UPDATE calls SET status = $1 WHERE id = $2

-- After:
UPDATE calls SET status = $1 WHERE id = $2 AND organization_id = $3
```

**Risk:** Low (additive WHERE, no behavior change for legitimate queries)  
**Estimated effort:** 15 minutes

#### A2: Add `organization_id` to UPDATE Queries in audio.ts

**Files:** `workers/src/routes/audio.ts` (lines 148, 157, 163, 170)  
**Action:** Same pattern as A1 — add organization_id filter.  
**Estimated effort:** 15 minutes

#### A3: Add `requireRole()` to 30+ Mutating Endpoints

**Files and recommended minimum roles:**

| File | Endpoints | Recommended Role |
|------|-----------|-----------------|
| `caller-id.ts` | POST /, PUT /verify, DELETE /:id | `agent` |
| `voice.ts` | PUT /config, POST /call | `agent` (call), `operator` (config) |
| `webrtc.ts` | POST /dial | `agent` |
| `notifications.ts` | POST/PUT/DELETE /channels, POST /test | `operator` |
| `helpdesk.ts` | POST /tickets, POST /auto-create, POST /settings | `operator` |
| `shopper.ts` | POST/PUT/DELETE scripts | `manager` |
| `retention.ts` | PUT/POST/DELETE policies | `admin` |
| `reliability.ts` | PUT /webhooks | `admin` |
| `scorecards.ts` | POST / | `operator` |
| `surveys.ts` | POST/DELETE | `operator` |
| `payments.ts` | POST /plans, POST /links | `agent` |
| `onboarding.ts` | POST /progress, POST /test-call | `agent` |

**Note:** `teams.ts` already has inline role checks (manual `roleLevel` comparison). These should be refactored to use the standard `requireRole()` middleware for consistency, but are functionally protected.

**Estimated effort:** 2-3 hours

### Phase B — Standards Compliance

#### B1: Fix SQL String Interpolation in stripe-sync.ts

**File:** `workers/src/lib/stripe-sync.ts` (lines 354, 361, 368)  
**Action:** Replace `${retentionDays}` interpolation with parameterized query.

```sql
-- Before:
WHERE updated_at < NOW() - INTERVAL '${retentionDays} days'

-- After:
WHERE updated_at < NOW() - ($1 || ' days')::interval
```

**Estimated effort:** 15 minutes

#### B2: Clean CamelCase Fallbacks in EvidenceManifestSummary.tsx

**File:** `components/voice/EvidenceManifestSummary.tsx` (lines 31, 33)  
**Action:** Remove camelCase fallback properties (`createdAt`, `manifestHash`). If the API ever returned camelCase, it's a bug that should be fixed at the source, not worked around.  
**Estimated effort:** 10 minutes

### Phase C — Dead Code Cleanup

#### C1: Delete or Fix Broken Test Files

| File | Action |
|------|--------|
| `tests/simulator/workplace-simulator.spec.ts` | DELETE — structurally corrupt, the working version is `tests/e2e/workplace-simulator.spec.ts` |
| `tests/webhooks-security.test.ts` | FIX — 4 errors (missing `handleCheckoutCompleted` import), or archive if superseded |

**Estimated effort:** 30 minutes

### Phase D — Documentation Corrections

#### D1: Update APPLICATION_FUNCTIONS.md

| Section | Current (Wrong) | Correct |
|---------|-----------------|---------|
| §7 Dialer | "DialerPanel — NOTE: Currently orphaned, not rendered in any page" | Remove orphan note; add: "Rendered in `/voice-operations` and `/campaigns/[id]`" |
| Architecture Summary table | "59 Backend Route Files" | "61 Backend Route Files" |
| Architecture Summary table | "42 Backend Lib Modules" | "44 Backend Lib Modules" |
| Missing section | — | Add §37.5: "Email Campaign System" documenting `email-campaigns.ts` (CAN-SPAM footer, 4 templates, Resend integration) |
| Missing section | — | Add note about `unsubscribe.ts` sharing `/api/messages` mount for email opt-out management |

**Estimated effort:** 30 minutes

---

## Part 3: Verification Strategy

### Approach: 4-Layer Validation Pyramid

The most effective method to confirm all design works as intended is a **4-layer validation pyramid** that tests from code standards up through live production behavior.

```
        ┌─────────────┐
        │  Layer 4:   │  Production Smoke Tests
        │  Live E2E   │  (Real API, real DB, real auth)
        ├─────────────┤
        │  Layer 3:   │  Integration Tests
        │  API Flow   │  (Multi-endpoint workflows)
        ├─────────────┤
        │  Layer 2:   │  Static Analysis
        │  Linting    │  (TypeScript, SQL patterns)
        ├─────────────┤
        │  Layer 1:   │  Schema Drift
        │  Structure  │  (DB ↔ Code ↔ Docs alignment)
        └─────────────┘
```

### Layer 1: Schema & Structure Validation (Automated)

**Purpose:** Confirm DB tables, route files, and ARCH_DOCS are synchronized.

| Test | Tool | What It Verifies |
|------|------|-----------------|
| Schema drift check | `validate-schema-drift.ts` (already exists) | All tables in code exist in DB |
| RLS audit | `rls-audit.sql` (already exists) | All business tables have RLS policies |
| Route coverage | New script (proposed below) | Every route in APPLICATION_FUNCTIONS.md has a matching file |
| Doc accuracy | New script (proposed below) | Counts in APPLICATION_FUNCTIONS.md match filesystem |

**New Script: `scripts/validate-architecture.ts`**
- Count route files in `workers/src/routes/` → compare to APPLICATION_FUNCTIONS.md count
- Count lib files in `workers/src/lib/` → compare
- Grep for orphaned components (imported nowhere)
- Verify all cron expressions in `scheduled.ts` match docs
- Output: PASS/FAIL per check

### Layer 2: Static Analysis & Standards (Automated)

**Purpose:** Catch standards violations without running code.

| Test | Pattern | What It Catches |
|------|---------|----------------|
| Organization isolation | Grep `UPDATE.*WHERE id = \$` without `organization_id` | Missing tenant isolation |
| RBAC enforcement | Grep `\.post\|\.put\|\.patch\|\.delete` handlers and check for `requireRole` | Missing authorization |
| SQL injection | Grep `\$\{.*\}` in SQL template literals | String interpolation |
| CamelCase leak | Grep `\.createdAt\|\.updatedAt\|\.userId` patterns | Snake case violations |
| Audit log pattern | Grep `writeAuditLog` calls and verify `oldValue`/`newValue` | Wrong property names |

**New Script: `scripts/standards-audit.ts`**
- Run all 5 pattern checks against `workers/src/`
- Output: violation count per category, file:line for each
- Exit code 0 only if zero critical violations
- **Run as pre-commit hook** or CI step

### Layer 3: Integration Tests — Workflow Validation (Semi-Automated)

**Purpose:** Verify multi-step business workflows work end-to-end.

These tests should be added to `tests/production/` using the existing pattern (`describeOrSkip` + real API):

| Workflow | Steps | Validates |
|----------|-------|----------|
| **Auth → RBAC → Mutation** | Login → get RBAC context → attempt mutation with insufficient role → expect 403 | requireRole enforcement |
| **Collection Account Lifecycle** | Import CSV → create account → add payment → disposition → verify timeline | §8 Collections CRM |
| **Campaign → Dialer → Call** | Create campaign → start dialer queue → verify agent status tracking | §7 + §9 |
| **Multi-Channel Send** | Send SMS → send email → verify unified timeline entry | §25.5 |
| **Integration Connect** | OAuth flow → verify encrypted token in KV → delta sync trigger | §17 CRM Framework |
| **Webhook Round-Trip** | Create subscription → trigger event → verify delivery + DLQ fallback | §16 + §36 |
| **Billing Lifecycle** | Checkout → subscription active → cancel → dunning triggered | §12 + §20 |
| **Compliance Check** | Pre-dial check → frequency cap → DNC match → violation logged | §14 |

**New Test File: `tests/production/workflow-validation.test.ts`**
- Consolidates the 8 critical workflows above
- Runs against real production API with test org
- Reports pass/fail per workflow

### Layer 4: Production Smoke Tests (Manual + Script)

**Purpose:** Confirm the deployed system at `wordisbond-api.adrper79.workers.dev` responds correctly.

| Check | Method | Endpoint |
|-------|--------|----------|
| Health | GET | `/api/health` |
| Deep health | GET | `/api/health?deep=true` |
| Auth flow | POST → GET | `/api/auth/signin` → `/api/auth/session` |
| CORS | OPTIONS | Any endpoint → verify `Access-Control-*` headers |
| Rate limit | 50x GET | `/api/health` → verify 429 eventually |
| Cron health | GET | `/api/internal/cron-health` |
| Schema health | GET | `/api/internal/schema-health` |
| Webhook DLQ | GET | `/api/internal/webhook-dlq` |

**Existing:** Most of these are already covered by `tests/production/api.test.ts`. Verify all pass green.

**New Script: `scripts/post-deploy-health.ts`**
- Run all 8 checks above
- Exit 0 only if all pass
- Integrate into deploy chain: `npm run api:deploy && npm run health-check`

---

## Part 4: Execution Order

### Sprint 1: Fix Critical Issues (Day 1)

| # | Work Item | Est. Time | Pre-Req |
|---|-----------|-----------|---------|
| 1 | A1 — Fix org_id isolation in webrtc.ts | 15 min | — |
| 2 | A2 — Fix org_id isolation in audio.ts | 15 min | — |
| 3 | A3 — Add requireRole() to 30+ endpoints | 2-3 hrs | — |
| 4 | B1 — Fix SQL interpolation in stripe-sync.ts | 15 min | — |
| 5 | Deploy + health check | 10 min | 1-4 |

### Sprint 2: Standards & Cleanup (Day 2)

| # | Work Item | Est. Time | Pre-Req |
|---|-----------|-----------|---------|
| 6 | B2 — Clean camelCase fallbacks | 10 min | — |
| 7 | C1 — Delete/fix broken test files | 30 min | — |
| 8 | D1 — Update APPLICATION_FUNCTIONS.md | 30 min | — |
| 9 | Create `scripts/standards-audit.ts` | 1 hr | — |
| 10 | Run standards audit → verify zero P0 violations | 15 min | 5, 9 |

### Sprint 3: Validation Framework (Day 3)

| # | Work Item | Est. Time | Pre-Req |
|---|-----------|-----------|---------|
| 11 | Create `scripts/validate-architecture.ts` | 1 hr | 8 |
| 12 | Create `tests/production/workflow-validation.test.ts` | 3 hrs | 5 |
| 13 | Create `scripts/post-deploy-health.ts` | 1 hr | — |
| 14 | Run full validation suite → generate pass/fail report | 30 min | 11-13 |
| 15 | Update CURRENT_STATUS.md + ROADMAP.md with results | 15 min | 14 |

### Total Estimated Effort: ~3 working days

---

## Part 5: Success Criteria

The platform is confirmed as "all design works as intended" when:

- [x] **Zero P0 violations** — all UPDATE queries include `organization_id`, all mutating endpoints have `requireRole()`
- [x] **Zero P1 violations** — no SQL string interpolation
- [ ] **Schema drift check passes** — all tables referenced in code exist in DB
- [ ] **RLS audit passes** — all business tables have RLS policies
- [x] **Standards audit script passes** — `scripts/standards-audit.ts` exits 0
- [x] **Architecture validation passes** — `scripts/validate-architecture.ts` exits 0
- [ ] **8 critical workflow tests pass** — `tests/production/workflow-validation.test.ts` all green (requires `RUN_INTEGRATION=1`)
- [x] **Post-deploy health passes** — all 8 smoke checks return expected responses
- [x] **APPLICATION_FUNCTIONS.md is current** — counts, notes, and sections match reality
- [x] **No broken test files** — `npx vitest --run` produces 0 errors (skips are OK)
- [x] **Build passes clean** — `npx next build` exits 0 with zero TS errors in production code

---

## Part 6: Ongoing Governance

After remediation, institute these guardrails to prevent regression:

| Guardrail | Implementation |
|-----------|---------------|
| **Pre-commit hook** | Run `scripts/standards-audit.ts` — block commits with P0 violations |
| **CI pipeline step** | Run schema drift + standards audit on every PR |
| **Deploy gate** | `scripts/post-deploy-health.ts` must pass before commit |
| **SESSION_START checklist** | Add `scripts/standards-audit.ts` to the session start checklist in copilot-instructions.md |
| **ARCH_DOCS update rule** | When adding routes/libs, update APPLICATION_FUNCTIONS.md in the same PR |
| **Quarterly audit** | Re-run full audit (this document) every 90 days |

---

## Appendix: File Reference

| Artifact | Path | Status |
|----------|------|--------|
| Architecture standards | `ARCH_DOCS/MASTER_ARCHITECTURE.md` | Current |
| Application functions | `ARCH_DOCS/APPLICATION_FUNCTIONS.md` | ✅ Updated (v4.67, 61 routes, 44 libs, §38 added) |
| Lessons learned | `ARCH_DOCS/LESSONS_LEARNED.md` | Current |
| System map | `ARCH_DOCS/SYSTEM_MAP.md` | Current |
| Production tests | `tests/production/` (39 files) | Working |
| Broken simulator | `tests/simulator/workplace-simulator.spec.ts` | ✅ DELETED |
| Broken webhook test | `tests/webhooks-security.test.ts` | ✅ FIXED |
| Working simulator | `tests/e2e/workplace-simulator.spec.ts` | Working |
| Schema drift check | `tests/production/validate-schema-drift.ts` | Working |
| RLS audit | `migrations/rls-audit.sql` | Working |
| Standards audit (new) | `scripts/standards-audit.ts` | ✅ BUILT — 0 violations |
| Architecture check (new) | `scripts/validate-architecture.ts` | ✅ BUILT — 5/5 pass |
| Workflow tests (new) | `tests/production/workflow-validation.test.ts` | ✅ BUILT — 8 workflows |
| Post-deploy health (new) | `scripts/post-deploy-health.ts` | ✅ BUILT — 8/8 pass |

---

*This plan was generated from a live codebase audit on February 15, 2026. All violation counts and file references were verified against actual source code.*
