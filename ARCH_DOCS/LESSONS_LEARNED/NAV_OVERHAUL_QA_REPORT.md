# Navigation Overhaul QA Report

## 3 Role Shells + 5-Flow Architecture with Cockpit

**Version:** v4.64 → v4.65 (post-QA)
**Date:** 2026-02-14
**Scope:** Full 6-phase multi-agent checkout of Session 23 navigation rebuild
**Build Status:** ✅ GREEN
**Test Regressions:** 0

---

## Executive Summary

The navigation overhaul (3 Role Shells + 5-Flow Architecture with Cockpit) shipped with **critical build-breaking defects** that would have prevented deployment. The QA checkout discovered and fixed 28 files across 13+ build-fix iterations before achieving a clean static export. The underlying architecture is sound, but the implementation was incomplete — pages were scaffolded without wiring session/org data, imports referenced non-existent paths, and component prop contracts were violated throughout.

### Verdict: **CONDITIONAL GO** ⚠️

The build compiles and exports cleanly. Zero test regressions. However, the weighted QA score of **37.4/100** reflects serious gaps in test coverage, schema constraints, and integration readiness that must be addressed before the feature flag (`NEXT_PUBLIC_NEW_NAV`) is flipped to `true` in production.

---

## Phase Scores

| Phase | Domain | Score | Weight | Weighted |
|-------|--------|-------|--------|----------|
| 1 | Error Logging & Debugging | 52/100 | 20% | 10.4 |
| 2 | Testing Suite Validation | 22/100 | 40% | 8.8 |
| 3 | Schema Integrity | 62/100 | 25% | 15.5 |
| 4 | Integration & Regression | 18/100 | 15% | 2.7 |
| **5** | **Fix & Backlog** | **BUILD GREEN** | — | — |
| | | **Weighted Total** | | **37.4/100** |

---

## Phase 1: Error Logging & Debugging Audit (52/100)

### Findings

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | 🔴 CRITICAL | `ProtectedGate` was display-only — no auth enforcement, no children rendering | **FIXED** |
| 2 | 🔴 CRITICAL | 10 layout files imported from `@/components/auth/ProtectedGate` — path didn't exist | **FIXED** |
| 3 | 🔴 CRITICAL | `FeatureFlagRedirect` imported from non-existent barrel | **FIXED** |
| 4 | 🟡 HIGH | Cockpit `handlePaymentLink` is a stub (`alert()`) | Backlog |
| 5 | 🟡 HIGH | Cockpit `handleHangUp` is a stub (logs only) | Backlog |
| 6 | 🟡 HIGH | Cockpit compliance fetch error silently swallowed | Backlog |
| 7 | 🟡 HIGH | Missing `useEffect`/`useCallback` dependency warnings in Cockpit (`selectedAccount`) | Backlog |
| 8 | 🟡 MEDIUM | No error boundaries wrapping `/work`, `/command`, `/admin` route groups | Backlog |
| 9 | 🟡 MEDIUM | `PreDialChecker` calls `/api/compliance/pre-dial` — endpoint doesn't exist | Backlog |
| 10 | 🟡 MEDIUM | `WorkQueuePage` requests `sort=priority` — silently ignored by collections API | Backlog |
| 11 | ⚪ LOW | 5 ESLint warnings (missing deps, anonymous default export, unescaped entity) | Backlog |
| 12 | ⚪ LOW | `logger.error()` used inconsistently — some components use `console.error` | Backlog |
| 13 | ⚪ LOW | Dark mode color tokens not fully consistent across new components | Backlog |

---

## Phase 2: Testing Suite Validation (22/100)

### Critical Test Gaps

| # | Missing Test | Risk |
|---|-------------|------|
| 1 | `RoleShell` renders correct nav groups per role | Role mismatch in production |
| 2 | `getRoleShell()` maps all 5 RBAC roles correctly | Wrong shell assignment |
| 3 | `getNavGroups()` returns expected items per shell | Missing nav items |
| 4 | `isNavActive()` edge cases (prefix matching) | Wrong active highlight |
| 5 | `ProtectedGate` redirects unauthenticated users | Auth bypass |
| 6 | `ProtectedGate` renders children when authenticated | Blank page |
| 7 | `CommandPalette` search filters correctly | Broken search |
| 8 | `CommandPalette` keyboard navigation (↑↓↵) | Accessibility failure |
| 9 | `FeatureFlagRedirect` respects env + localStorage | Unwanted redirects |
| 10 | `Cockpit` renders 3-column layout with account data | Layout regression |
| 11 | `Cockpit` disposition flow submits correctly | Lost call outcomes |
| 12 | `PreDialChecker` renders pass/fail states | Compliance gap |
| 13 | `PreDialChecker` blocks on API failure (fail-safe) | Illegal calls |
| 14 | `WorkQueuePage` sorts and filters accounts | Queue malfunction |
| 15 | `DispositionBar` validates required fields | Incomplete dispositions |
| 16 | `LiveBoard` renders agent status grid | Manager blindspot |
| 17 | `ViolationDashboard` filters by severity/status | Compliance oversight |
| 18 | `DNCManager` add/remove/search operations | DNC violations |
| 19 | `AuditLogBrowser` pagination and search | Audit trail gaps |
| 20 | E2E: Full agent workflow (login → queue → call → dispose) | End-to-end validation |

### Existing Test Suite

- **850 total tests** across 34 test files
- **753 passed** | **55 failed** (pre-existing, live API tests) | **42 skipped**
- **0 regressions** introduced by navigation overhaul
- All 55 failures are production integration tests hitting live Telnyx/database APIs — not related to UI changes

---

## Phase 3: Schema Integrity (62/100)

### Critical Gaps

| # | Severity | Finding | Impact |
|---|----------|---------|--------|
| 1 | 🔴 CRITICAL | `org_members.role` is TEXT with default `'member'` — no CHECK constraint | Any string accepted as role; `'member'` not in any RBAC hierarchy |
| 2 | 🔴 CRITICAL | RBAC role vocabulary mismatch across 3 files | Client: `owner\|admin\|operator\|analyst\|viewer`. Server auth.ts: `analyst(2)\|operator(3)`. Server rbac-v2.ts: `agent(2)\|manager(3)` |
| 3 | 🟡 HIGH | `collections_accounts` table missing `days_past_due` and `contact_count_7day` columns referenced by Cockpit/WorkQueue | Components will show `0` or `undefined` for these fields |
| 4 | 🟡 HIGH | No migration for `compliance_pre_dial_checks` table (PreDialChecker expects API endpoint) | Pre-dial compliance will 404 |
| 5 | 🟡 MEDIUM | 149+ live tables verified — new components use existing API endpoints safely | OK |

### RBAC Role Mapping Discrepancy

```
CLIENT (lib/rbac.ts):     owner → admin → operator → analyst → viewer
SERVER (auth.ts):         analyst(2) → operator(3)
SERVER (rbac-v2.ts):      agent(2) → manager(3)
DB (org_members.role):    TEXT, default 'member', NO CHECK constraint
NAVIGATION (navigation.ts): owner|admin → Admin shell
                            analyst → Manager shell
                            operator|viewer → Agent shell
```

**Risk:** A user with role `'member'` (DB default) falls through to `default` case → Agent shell. This is accidental correctness, not intentional design.

---

## Phase 4: Integration & Regression (18/100)

### Orphan Navigation Routes (12 routes → no page exists)

| Route | Shell | Page Exists? |
|-------|-------|-------------|
| `/accounts/import` | Agent | ❌ 404 |
| `/accounts/disputes` | Agent | ❌ 404 |
| `/analytics/me` | Agent | ❌ 404 |
| `/command/live` | Manager | ❌ 404 |
| `/compliance/violations` | Manager | ❌ 404 |
| `/compliance/audit` | Manager | ❌ 404 |
| `/compliance/dnc` | Manager | ❌ 404 |
| `/compliance/disputes` | Manager | ❌ 404 |
| `/payments/plans` | Manager | ❌ 404 |
| `/payments/reconciliation` | Manager | ❌ 404 |
| `/payments/failed` | Manager | ❌ 404 |
| `/campaigns/surveys` | Manager | ❌ 404 |

### API Integration Risks

| # | Component | API Endpoint | Issue |
|---|-----------|-------------|-------|
| 1 | `PreDialChecker` | `GET /api/compliance/pre-dial` | Endpoint doesn't exist |
| 2 | `WorkQueuePage` | `GET /api/collections/accounts?sort=priority` | `sort` param silently ignored |
| 3 | `Cockpit` | `GET /api/collections/accounts` | Response missing `days_past_due`, `contact_count_7day` |
| 4 | `DNCManager` | `GET/POST/DELETE /api/dnc` | Endpoints may not exist |
| 5 | `FollowUpTracker` | `GET /api/collections/promises` | Endpoint may not exist |
| 6 | `LiveBoard` | `GET /api/manager/team-members` | Missing `status`, `current_call_id` fields |
| 7 | `CallbackScheduler` | `POST /api/bookings` | `recurring` field not in schema |
| 8 | `AuditLogBrowser` | `GET /api/audit?search=` | `search` param may not be implemented |

### Deploy Pipeline Gaps

- 3 deploy workflows (Pages, Workers, combined) skip test execution entirely
- E2E authenticated tests in Playwright are commented out
- No smoke test after deploy for new navigation routes

---

## Phase 5: Fix & Backlog — Files Modified (28 total)

### Build-Breaking Fixes Applied

| File | Fix Applied |
|------|------------|
| `components/ui/ProtectedGate.tsx` | **REWRITTEN** — proper auth wrapper with useSession, children, loading state |
| `components/auth/ProtectedGate.tsx` | **CREATED** — barrel re-export resolving ghost imports in 8 layouts |
| `components/auth/FeatureFlagRedirect.tsx` | **CREATED** — barrel re-export for ghost import |
| `app/analytics/layout.tsx` | Import path corrected |
| `app/campaigns/layout.tsx` | Import path corrected |
| `app/schedule/callbacks/page.tsx` | Import path corrected |
| `app/schedule/page.tsx` | Import path corrected |
| `app/reports/page.tsx` | Extra `</div>` removed |
| `components/cockpit/PreDialChecker.tsx` | Apostrophe escaped for JSX |
| `components/manager/LiveBoard.tsx` | Added missing `Users` import from lucide-react |
| `app/admin/ai/page.tsx` | **REWRITTEN** — session/org fetch + dynamic import `.then()` + props wiring |
| `app/admin/api/page.tsx` | **REWRITTEN** — session/org fetch + dynamic import fix + organizationId prop |
| `app/admin/billing/page.tsx` | **REWRITTEN** — session/org/role/plan fetch + 4 component props wired |
| `app/admin/retention/page.tsx` | **REWRITTEN** — session/org fetch + RetentionSettings organizationId + canEdit |
| `app/admin/voice/page.tsx` | **REWRITTEN** — session/org fetch + CallerIdManager/VoiceTargetManager organizationId |
| `app/analytics/sentiment/page.tsx` | Removed invalid `\|\| m.default` fallback on named export |
| `app/command/scorecards/page.tsx` | Added session/org fetch + ScorecardAlerts organizationId |
| `app/payments/page.tsx` | PaymentHistoryChart receives `accountId=""` (graceful empty) |
| `app/tools/scripts/page.tsx` | **REWRITTEN** — session/org fetch + ShopperScriptManager organizationId |
| `app/tools/templates/page.tsx` | **REWRITTEN** — state management + NoteTemplates onInsertTemplate/currentText |
| `app/work/call/page.tsx` | **REWRITTEN** — replaced invalid initialAccountId with org fetch + Cockpit props |
| `app/work/dialer/page.tsx` | **REWRITTEN** — session/org fetch + Cockpit organizationId |
| `app/work/page.tsx` | Badge `variant="outline"` → `"secondary"` |
| `app/work/payments/page.tsx` | Badge `variant="outline"` → `"secondary"` |
| `components/compliance/ViolationDashboard.tsx` | Badge `variant="outline"` → `"secondary"` |
| `components/layout/CommandPalette.tsx` | `useRBAC()` → `useRBAC(null)` (hook requires param) |
| `app/accounts/[id]/page.tsx` | **RESTRUCTURED** — server wrapper + `generateStaticParams` for static export |
| `app/accounts/[id]/AccountDetailClient.tsx` | **CREATED** — extracted client component for static export compatibility |

### Error Categories Resolved

| Category | Count | Pattern |
|----------|-------|---------|
| Ghost imports (non-existent paths) | 6 | `@/components/auth/*` barrel didn't exist |
| Missing component props | 12 | Pages scaffolded without session/org data pipeline |
| Invalid Badge variant | 5 | `"outline"` not in Badge; only Button supports it |
| Dynamic import without `.then()` | 7 | Named exports need `.then(m => m.ComponentName)` |
| Static export incompatibility | 1 | `[id]` dynamic route needs `generateStaticParams` |
| TypeScript type errors | 2 | `useRBAC()` missing param, `m.default` on named-only module |
| JSX syntax errors | 2 | Unescaped apostrophe, extra closing tag |

---

## Prioritized Backlog

### 🔴 P0 — Must Fix Before Feature Flag Activation

| # | Item | Effort | Owner |
|---|------|--------|-------|
| 1 | Create 12 orphan route pages (or remove from navigation.ts) | 2-3 days | Frontend |
| 2 | Add CHECK constraint on `org_members.role` | 30 min | Backend + Migration |
| 3 | Unify RBAC role vocabulary across client/server (single source of truth) | 4 hours | Full-stack |
| 4 | Add unit tests for `RoleShell`, `navigation.ts`, `ProtectedGate` | 1 day | Frontend |
| 5 | Create `/api/compliance/pre-dial` endpoint (or make PreDialChecker graceful) | 4 hours | Backend |

### 🟡 P1 — Should Fix Before GA

| # | Item | Effort | Owner |
|---|------|--------|-------|
| 6 | Add `days_past_due` + `contact_count_7day` to collections API response | 2 hours | Backend |
| 7 | Implement `sort=priority` in `/api/collections/accounts` | 1 hour | Backend |
| 8 | Wire Cockpit `handlePaymentLink` to Stripe payment link generator | 2 hours | Frontend |
| 9 | Wire Cockpit `handleHangUp` to Telnyx call control API | 2 hours | Frontend |
| 10 | Add error boundaries for `/work`, `/command`, `/admin` route groups | 2 hours | Frontend |
| 11 | Add E2E test: agent login → queue → call → disposition flow | 1 day | QA |
| 12 | Enable test execution in CI/CD deploy workflows | 1 hour | DevOps |
| 13 | Create `/api/dnc` CRUD endpoints | 4 hours | Backend |
| 14 | Add mobile nav support for manager/admin shells | 4 hours | Frontend |

### ⚪ P2 — Nice to Have

| # | Item | Effort | Owner |
|---|------|--------|-------|
| 15 | Fix 5 ESLint warnings (missing useEffect deps in Cockpit, etc.) | 30 min | Frontend |
| 16 | CommandPalette: pass real organizationId to `useRBAC()` instead of `null` | 30 min | Frontend |
| 17 | PaymentHistoryChart: provide org-level payment history on `/payments` page | 2 hours | Frontend |
| 18 | Add `recurring` column to `bookings` table for CallbackScheduler | 1 hour | Backend |
| 19 | Standardize logger usage (replace stray `console.error` calls) | 1 hour | Frontend |
| 20 | Dark mode token consistency audit across new components | 2 hours | Design/Frontend |

---

## Deployment Readiness Checklist

| Criterion | Status | Notes |
|-----------|--------|-------|
| TypeScript compilation | ✅ Pass | Zero type errors |
| Static export (`next build`) | ✅ Pass | All routes exported successfully |
| Test regressions | ✅ 0 regressions | 753/850 pass; 55 pre-existing failures |
| Feature flag default | ✅ Safe | `NEXT_PUBLIC_NEW_NAV` defaults `false` |
| Orphan routes handled | ⚠️ Partial | 12 nav items link to non-existent pages |
| RBAC consistency | ❌ Not resolved | 3 competing role vocabularies |
| Pre-dial compliance API | ❌ Missing | Will 404 when PreDialChecker mounts |
| Error boundaries | ❌ Missing | Unhandled component errors crash entire shell |
| New component test coverage | ❌ 0% | No unit/integration tests for any new component |

---

## Go/No-Go Decision Matrix

| Factor | Weight | Score | Verdict |
|--------|--------|-------|---------|
| Build compiles | 30% | ✅ 100 | GO |
| No test regressions | 25% | ✅ 100 | GO |
| Feature flag safe | 15% | ✅ 100 | GO |
| Orphan routes resolved | 10% | ❌ 0 | NO-GO |
| RBAC consistency | 10% | ❌ 0 | NO-GO |
| New component tests | 10% | ❌ 0 | NO-GO |

### **Final Verdict: CONDITIONAL GO** ⚠️

**Deploy the build** — the code compiles cleanly, exports correctly, and introduces zero regressions. The feature flag (`NEXT_PUBLIC_NEW_NAV=false`) ensures the new navigation is **not visible to users** until explicitly activated.

**Do NOT activate the feature flag** until P0 backlog items 1–5 are complete. Specifically:
1. The 12 orphan navigation routes must either have pages created or be removed from `navigation.ts`
2. The RBAC role vocabulary must be unified
3. Minimum unit test coverage must be added for `RoleShell`, `navigation.ts`, and `ProtectedGate`

---

## Appendix: Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Feature Flag Gate                         │
│              NEXT_PUBLIC_NEW_NAV = false (default)           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ Agent Shell  │  │ Manager Shell│  │  Admin Shell     │   │
│  │ (operator,   │  │ (analyst)    │  │  (owner, admin)  │   │
│  │  viewer)     │  │              │  │                   │   │
│  ├─────────────┤  ├──────────────┤  ├─────────────────┤   │
│  │ /work/*     │  │ /command/*   │  │ /command/* +     │   │
│  │ /accounts/* │  │ /teams/*     │  │ /admin/*         │   │
│  │ /schedule/* │  │ /compliance/*│  │                   │   │
│  │ /tools/*    │  │ /payments/*  │  │                   │   │
│  │             │  │ /analytics/* │  │                   │   │
│  │             │  │ /campaigns/* │  │                   │   │
│  │             │  │ /reports/*   │  │                   │   │
│  │             │  │ /settings/*  │  │                   │   │
│  └─────────────┘  └──────────────┘  └─────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               Cockpit (3-column workspace)           │   │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │ Queue    │  │ Active Call  │  │ Intelligence │  │   │
│  │  │ Rail     │  │ Center       │  │ Panel        │  │   │
│  │  │          │  │              │  │              │  │   │
│  │  │ AI-sort  │  │ PreDialCheck │  │ AI Insights  │  │   │
│  │  │ accounts │  │ Softphone    │  │ Compliance   │  │   │
│  │  │          │  │ DisposBar    │  │ Objections   │  │   │
│  │  └──────────┘  └──────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────┐  ┌─────────────────────────────┐   │
│  │ CommandPalette ⌘K  │  │ ProtectedGate (auth wrapper)│   │
│  └────────────────────┘  └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

*Report generated by QA Orchestrator — 6-phase multi-agent checkout*
*Build verified: `npx next build` ✅ | Tests: 753/850 passed | 0 regressions*
