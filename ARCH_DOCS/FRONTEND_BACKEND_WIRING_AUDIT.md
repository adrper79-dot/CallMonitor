# Frontend ↔ Backend Wiring Audit

**Date:** 2026-02-12  
**Auditor:** Copilot automated scan  
**Scope:** All `apiGet/apiPost/apiPut/apiDelete/apiPatch` calls in `lib/`, `components/`, `app/`, `hooks/`, `contexts/` vs all Hono route handlers in `workers/src/routes/`

---

## Summary

| Metric | Count |
|---|---|
| **TOTAL_FRONTEND_API_CALLS** (unique endpoint patterns) | **148** |
| **TOTAL_BACKEND_ENDPOINTS** (registered handlers) | **~243** |
| **MATCHED** | **113** |
| **MISSING_BACKEND_ROUTES** (404 risks) | **35** |
| **UNUSED_BACKEND_ROUTES** (backend-only, no frontend caller found) | **~95** |

---

## MISSING_BACKEND_ROUTES — 404 Risks

These are frontend calls that will return **404 Not Found** in production.

### SEVERITY: CRITICAL — Entire Route Not Mounted

| # | Frontend URL | Method | Called From | Issue |
|---|---|---|---|---|
| 1 | `/api/dnc` | GET | `components/compliance/DNCManager.tsx` | **No `/api/dnc` route in index.ts** |
| 2 | `/api/dnc` | POST | `components/compliance/DNCManager.tsx` | Same — no route |
| 3 | `/api/dnc/:id` | DELETE | `components/compliance/DNCManager.tsx` | Same — no route |
| 4 | `/api/feedback` | POST | `components/feedback/BugReporter.tsx` | **No `/api/feedback` route in index.ts** |
| 5 | `/api/messages/send` | POST | `components/cockpit/PaymentLinkGenerator.tsx` | **No `/api/messages` route in index.ts** |
| 6 | `/api/messages/email` | POST | `components/cockpit/PaymentLinkGenerator.tsx` | Same — no route |
| 7 | `/api/payments` | GET | `app/work/payments/page.tsx`, `app/payments/failed/page.tsx`, `app/accounts/[id]/AccountDetailClient.tsx` | **No `/api/payments` route in index.ts** (billing mounted at `/api/billing`) |
| 8 | `/api/payments/plans` | GET | `app/payments/page.tsx`, `app/payments/plans/page.tsx` | Same — no route |
| 9 | `/api/payments/links` | GET | `app/payments/page.tsx` | Same — no route |
| 10 | `/api/payments/links` | POST | `components/cockpit/PaymentLinkGenerator.tsx` | Same — no route |
| 11 | `/api/payments/plans` | POST | `components/cockpit/PlanBuilder.tsx` | Same — no route |
| 12 | `/api/payments/reconciliation` | GET | `app/payments/reconciliation/page.tsx` | Same — no route |

### SEVERITY: HIGH — Endpoint Missing Inside Existing Route

| # | Frontend URL | Method | Called From | Issue |
|---|---|---|---|---|
| 13 | `/api/compliance` (root) | GET | `components/compliance/ViolationDashboard.tsx` | Backend has `GET /violations` not `GET /`. Frontend should call `/api/compliance/violations` |
| 14 | `/api/compliance/pre-dial` | GET | `components/cockpit/PreDialChecker.tsx`, `components/cockpit/Cockpit.tsx` | No `/pre-dial` handler in compliance routes |
| 15 | `/api/compliance/disputes` | GET | `app/compliance/disputes/page.tsx`, `app/accounts/disputes/page.tsx` | No `/disputes` handler in compliance routes |
| 16 | `/api/calls/initiate` | POST | `components/cockpit/Cockpit.tsx` | Backend has `POST /start`, not `/initiate` — **path mismatch** |
| 17 | `/api/calls/dispositions` | POST | `components/cockpit/Cockpit.tsx`, `components/cockpit/DispositionBar.tsx` | Backend has `PUT /:id/disposition` — **different URL pattern AND HTTP method** |
| 18 | `/api/organizations/:id` | GET | `components/voice/CallDetailView.tsx`, `components/review/ReviewMode.tsx`, `components/layout/AppShell.tsx` | Backend only has `POST /` and `GET /current`, no `GET /:id` |
| 19 | `/api/analytics/agents` | GET | `components/analytics/AgentLeaderboard.tsx` | No `/agents` handler in analytics routes |
| 20 | `/api/analytics/agent/:userId` | GET | `app/analytics/me/page.tsx` | No `/agent/:id` handler in analytics routes |
| 21 | `/api/onboarding/compliance` | POST | `app/onboarding/page.tsx` | Backend only has `/setup` and `/progress`, no `/compliance` |
| 22 | `/api/teams/invite-batch` | POST | `app/onboarding/page.tsx` | No `/invite-batch` handler in teams routes |
| 23 | `/api/campaigns/sequences` | POST | `components/campaigns/ContactSequenceEditor.tsx` | No `/sequences` handler in campaigns routes |
| 24 | `/api/campaigns/sequences/:id` | GET | `components/campaigns/ContactSequenceEditor.tsx` | Same — no handler |
| 25 | `/api/campaigns/sequences/:id` | PUT | `components/campaigns/ContactSequenceEditor.tsx` | Same — no handler |
| 26 | `/api/campaigns/surveys` | GET | `app/campaigns/surveys/page.tsx` | No `/surveys` in campaigns routes (separate `/api/surveys` route exists) |

### SEVERITY: HIGH — Collections Path Mismatch

Frontend uses `/api/collections/accounts/...` but backend defines all routes at `/api/collections/...` root.

| # | Frontend URL | Method | Called From | Issue |
|---|---|---|---|---|
| 27 | `/api/collections/accounts` | GET | `app/accounts/page.tsx`, `components/cockpit/Cockpit.tsx`, `components/cockpit/WorkQueuePage.tsx` | Backend `GET /` lists accounts, but `/accounts` hits `/:id` with id="accounts" → wrong result |
| 28 | `/api/collections/accounts/:accountId` | GET | `app/accounts/[id]/AccountDetailClient.tsx` | Backend `GET /:id` expects UUID at root, not under `/accounts/` |
| 29 | `/api/collections/accounts/:accountId/notes` | POST | `app/accounts/[id]/AccountDetailClient.tsx` | No `/accounts/:id/notes` or `/:id/notes` route exists |
| 30 | `/api/collections/promises` | GET | `components/schedule/FollowUpTracker.tsx` | No `/promises` handler — falls through to `/:id` with id="promises" |
| 31 | `/api/collections/daily-stats` | GET | `app/work/page.tsx` | No `/daily-stats` handler — falls through to `/:id` |
| 32 | `/api/collections/callbacks` | GET | `app/work/page.tsx` | No `/callbacks` handler — falls through to `/:id` |
| 33 | `/api/collections/aging` | GET | `components/analytics/CollectionsKPIs.tsx` | No `/aging` handler — falls through to `/:id` |
| 34 | `/api/collections/portfolio-stats` | GET | `app/accounts/page.tsx` | Backend has `GET /stats`, not `/portfolio-stats` — path mismatch |

---

## Specifically-Requested Checks

### DNC_STATUS: ❌ BROKEN

- **Frontend:** `DNCManager.tsx` calls `GET /api/dnc`, `POST /api/dnc`, `DELETE /api/dnc/:id`
- **Backend:** No `/api/dnc` route is mounted in `workers/src/index.ts`. No `dnc.ts` file exists in `workers/src/routes/`.
- **Impact:** DNC management page is completely non-functional. All 3 CRUD operations return 404.

### FEATURE_FLAGS_STATUS: ✅ WIRED

- **Frontend:** `admin/feature-flags/page.tsx` calls `GET /api/feature-flags/global`, `GET /api/feature-flags/org`, `PUT /api/feature-flags/global|org/:feature`, `POST /api/feature-flags/global|org`, `DELETE /api/feature-flags/global|org/:feature`
- **Backend:** `workers/src/routes/feature-flags.ts` has all 10 handlers. Mounted at `/api/feature-flags`.
- **Status:** Fully wired and functional.

### BILLING_STATUS: ⚠️ PARTIALLY WIRED

- **Backend billing routes** are fully implemented at `/api/billing` with: checkout, portal, cancel, resume, change-plan, subscription, payment-methods, invoices, sync-stripe-data.
- **Frontend billing calls** from `SubscriptionManager.tsx` and `PaymentMethodManager.tsx` correctly target `/api/billing/cancel` and `/api/billing/payment-methods/:id`. ✅
- **However:** The entire `/api/payments/*` family (plans, links, reconciliation, payment listing) has **no mounted route**. The frontend payments pages (`app/payments/`, `app/work/payments/`, `PlanBuilder.tsx`, `PaymentLinkGenerator.tsx`) all call `/api/payments/...` which does not exist. These are 404. ❌

### WEBRTC_STATUS: ✅ WIRED

- **Backend:** `workers/src/routes/webrtc.ts` has `GET /token`, `GET /debug`, `POST /dial` mounted at `/api/webrtc`.
- **Frontend:** `useVoiceConfig.tsx` and voice components use WebRTC via the voice/call flow. Token endpoint accessible.

---

## UNUSED_BACKEND_ROUTES (Notable)

Backend endpoints with no detected frontend caller. Not bugs, but worth noting for dead-code cleanup:

| Route | Endpoints | Notes |
|---|---|---|
| `/api/billing` | `GET /`, `GET /subscription`, `GET /invoices`, `POST /checkout`, `POST /portal`, `POST /resume`, `POST /change-plan`, `POST /sync-stripe-data` | Frontend uses `/api/payments/*` instead — entire billing UI points to wrong base path |
| `/api/collections` | `GET /imports`, `POST /import`, `PUT /:id`, `DELETE /:id`, `GET /:id/payments`, `POST /:id/payments`, `*/:id/tasks/*` | Frontend calls use `/accounts/` sub-path instead |
| `/api/bond-ai` | `POST /conversations`, `GET /alert-rules`, `POST /alert-rules`, `PUT /alert-rules/:id`, `DELETE /alert-rules/:id`, `GET /insights` | Alert rules management + insights not wired in UI |
| `/api/auth` | `/validate-key`, `/csrf`, `/providers`, `/callback/credentials`, `/_log`, `/refresh`, `/forgot-password`, `/reset-password` | Some may be called from auth flows not scanned (e.g., custom auth library) |
| `/api/webrtc` | `GET /debug`, `POST /dial` | Debug endpoint; dial may be used internally |
| `/api/health` | `GET /`, `GET /ping`, `GET /analytics`, `GET /webhooks` | Infrastructure monitoring endpoints |
| `/api/dialer` | `GET /stats/:campaignId`, `PUT /agent-status`, `GET /agents` | Stats/agent management not wired in dialer UI |
| `/api/scorecards` | `GET /alerts`, `GET /:id` | Individual scorecard view + alerts not wired |
| `/api/productivity` | `GET /likelihood/:accountId` | Pay-likelihood prediction not wired |
| `/api/retention` | `GET /`, `PUT /`, `GET /legal-holds`, `POST /legal-holds` | Only DELETE /legal-holds/:id called; read/write settings not found |
| `/api/sentiment` | `GET /live/:callId`, `GET /summary/:callId`, `GET /history` | Real-time + historical sentiment endpoints not wired |

---

## Recommended Fixes (Priority Order)

### P0 — Production Blockers (entire features broken)

1. **Create `/api/dnc` route** or mount DNC handlers inside compliance routes
2. **Create `/api/payments` route** or redirect frontend from `/api/payments/*` → `/api/billing/*`
3. **Fix `/api/collections/accounts/...`** paths — either:
   - Add `/accounts`, `/accounts/:id`, `/accounts/:id/notes` routes to collections, OR  
   - Fix frontend to call `/api/collections/`, `/api/collections/:id`
4. **Fix `/api/calls/initiate`** → change frontend to `POST /api/calls/start`
5. **Fix `/api/calls/dispositions`** → change frontend to `PUT /api/calls/:id/disposition` with call_id in URL

### P1 — Major Feature Gaps

6. Add `/api/compliance/pre-dial` handler (pre-dial check blocks cockpit workflow)
7. Add `/api/compliance/disputes` handler (disputes page dead)
8. Add `/api/analytics/agents` and `/api/analytics/agent/:id` handlers (leaderboard + personal analytics dead)
9. Add `/api/organizations/:id` GET handler (org lookup from 3 components)
10. Add `/api/campaigns/sequences` CRUD handlers (sequence editor dead)
11. Fix `/api/compliance` root GET → frontend should call `/api/compliance/violations`

### P2 — Feature Gaps

12. Add `/api/feedback` route (bug reporter dead)
13. Add `/api/messages/send` + `/api/messages/email` routes (payment link messaging dead)
14. Add `/api/onboarding/compliance` handler
15. Add `/api/teams/invite-batch` handler  
16. Add missing collections sub-endpoints: `/promises`, `/daily-stats`, `/callbacks`, `/aging`
17. Fix `/api/collections/portfolio-stats` → either add handler or fix frontend to call `/stats`
18. Fix `/api/campaigns/surveys` → frontend should call `/api/surveys` directly

---

*End of audit. 35 endpoints will return 404 in production.*
