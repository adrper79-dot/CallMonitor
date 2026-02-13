# Production Readiness Verdict

**Date:** 2026-02-12  
**Version:** v4.64  
**Verdict:** ❌ **NOT READY** — 5 P0 blockers, 10 P1 issues  
**Estimated fix effort:** 3–5 working days for P0 blockers

---

## Executive Summary

The platform builds clean (0 TypeScript errors frontend + Workers, 83 pages exported successfully). Auth flow is solid. Security posture is strong (all 20 forensic findings fixed). However, **35 frontend API calls hit 404** because of path mismatches and missing routes. The core call-placing flow is broken. Two competing navigation shells create a jarring UX.

**Score: 4/10 for production launch readiness.**

---

## Build Status ✅

| Check | Result |
|---|---|
| Frontend TypeScript (`tsc --noEmit`) | 0 errors |
| Workers TypeScript (`tsc --noEmit --project workers/tsconfig.json`) | 0 errors |
| Next.js static export (`next build`) | 83 pages, GREEN |
| Security fixes applied | 20/20 complete |

---

## P0 BLOCKERS — Must fix before any launch

### 1. Core Call Flow is Dead
- **Cockpit calls `POST /api/calls/initiate`** — backend only serves `POST /api/calls/start`
- **Payload mismatch:** Frontend sends `{target_number, account_id}` — backend expects `{phone_number, caller_id, system_id}`
- **Impact:** Agents cannot place calls. The #1 feature of the app doesn't work.
- **Fix:** Update `components/cockpit/Cockpit.tsx` call path + payload

### 2. Disposition Flow is Dead
- **Cockpit calls `POST /api/calls/dispositions`** — backend serves `PUT /api/calls/:id/disposition`
- **Impact:** After every call, agents can't record outcomes. Supervisor reporting is broken.
- **Fix:** Update `DispositionBar.tsx` to use correct method + URL pattern

### 3. Entire `/api/payments/*` Route Missing
- **7 frontend calls** to `/api/payments`, `/api/payments/plans`, `/api/payments/links`, `/api/payments/reconciliation`
- **Backend has billing at `/api/billing`** — no `/api/payments` route exists
- **Impact:** Payment plans page, failed payments page, payment link generation, reconciliation — ALL dead
- **Fix:** Create `/api/payments` route that proxies/aliases to billing, OR update 7 frontend calls

### 4. DNC Management is Dead
- **DNCManager component calls `GET/POST/DELETE /api/dnc`** — no route exists
- **Impact:** Compliance team cannot manage Do-Not-Call lists — a legal risk for debt collection
- **Fix:** Create `workers/src/routes/dnc.ts` with CRUD operations on `dnc_lists` table

### 5. Collections Account Path Mismatch
- **Frontend calls `/api/collections/accounts/...`** — backend serves at `/api/collections/...` (no `/accounts/` prefix)
- **8 endpoint mismatches** including account listing, detail, notes, callbacks, daily-stats
- **Impact:** Account management pages, work queue, and account detail views all broken
- **Fix:** Either add `/accounts` sub-routes to collections, or update frontend paths

---

## P1 Issues — Fix before beta

### 6. Two Competing Navigation Shells (UI Cohesion: 5/10)
- **RoleShell** (new): Used by 12 route layouts — `/work`, `/command`, `/admin`, `/tools`, `/payments`, `/settings`, etc.
- **AppShell** (legacy): Used by 8 pages — `/dashboard`, `/manager`, `/review`, `/bookings`, `/teams`, `/voice-operations`, etc.
- **Impact:** User sees completely different sidebar when navigating between shells. Jarring UX.
- **Fix:** Migrate remaining 8 AppShell pages to RoleShell, or consolidate nav items.

### 7. No Auto Session Refresh
- Session expires after 7 days. `POST /auth/refresh` endpoint exists but frontend never calls it.
- **Impact:** Active users silently logged out with no warning.
- **Fix:** Add refresh call in AuthProvider when session < 24h remaining.

### 8. Pre-Dial Compliance Check Missing
- `PreDialChecker.tsx` calls `GET /api/compliance/pre-dial` — no handler exists
- **Impact:** Cockpit compliance check is dead — agents call without TCPA checks.
- **Fix:** Add `/pre-dial` handler to compliance routes.

### 9. Analytics Endpoints Missing
- `GET /api/analytics/agents` (leaderboard) and `GET /api/analytics/agent/:id` (personal analytics) — no handlers
- **Impact:** Agent performance pages are dead.
- **Fix:** Add handlers to analytics routes.

### 10. Campaign Sequences Not Wired
- `POST/GET/PUT /api/campaigns/sequences/:id` — no handler
- **Impact:** Contact sequence editor is non-functional.
- **Fix:** Add CRUD handlers to campaigns routes.

### 11. Feedback / Bug Reporter Dead
- `POST /api/feedback` — no route exists
- **Impact:** BugReporter component button does nothing.
- **Fix:** Create feedback route.

### 12. Compliance Disputes Page Dead
- `GET /api/compliance/disputes` — no handler
- **Impact:** Disputes management page empty.

### 13. `/admin` Root is 404
- Navigation links to `/admin` but no `app/admin/page.tsx` exists. Metrics live at `/admin/metrics`.
- **Fix:** Add `app/admin/page.tsx` that redirects to `/admin/metrics`.

### 14. Organizations GET /:id Missing
- 3 components call `GET /api/organizations/:id` — backend only has `POST /` and `GET /current`
- **Impact:** Call detail view, review mode, and AppShell fail to load org data.

### 15. Compliance Root GET Mismatch
- `ViolationDashboard.tsx` calls `GET /api/compliance` — backend serves `GET /api/compliance/violations`
- **Fix:** Update frontend to correct path.

---

## P2 Issues — Fix post-beta

| # | Issue | Impact |
|---|---|---|
| 16 | 70 routes lack `loading.tsx` (esp. `/work/*`, `/command/*`) | No loading state, blank screens on slow networks |
| 17 | 62 routes lack own `error.tsx` (inherit from root) | Generic error page instead of contextual recovery |
| 18 | `/api/messages/send` + `/api/messages/email` missing (payment link SMS/email) | Payment link delivery dead |
| 19 | `/api/onboarding/compliance` missing | Onboarding compliance step fails silently |
| 20 | `/api/teams/invite-batch` missing | Batch invite during onboarding fails |
| 21 | `/api/campaigns/surveys` should call `/api/surveys` | Surveys page empty |
| 22 | `analytics/sentiment` page not in any nav | Unreachable page |
| 23 | `/manager` page is pure orphan — no nav links anywhere | Dead page |
| 24 | Signup uses `apiGet` for invite validation (should be `apiGetNoAuth`) | Invite acceptance may 401 |
| 25 | ~52 orphan DB tables need DROP migration | Technical debt |
| 26 | ~95 unused backend endpoints | Code bloat, audit surface |
| 27 | Dual ProtectedGate import paths | Code hygiene |

---

## What IS Working Well

| Area | Status |
|---|---|
| **Auth (signup/signin/signout)** | ✅ Solid — CSRF, fingerprinting, PBKDF2, timing-safe |
| **Session management** | ✅ Works (needs auto-refresh) |
| **Security** | ✅ All 20 forensic findings resolved |
| **Build pipeline** | ✅ Clean TS, clean build, 83 pages |
| **Feature flags** | ✅ Fully wired CRUD |
| **WebRTC token** | ✅ Wired with KV caching |
| **Billing (Stripe portal/checkout)** | ✅ Correctly wired |
| **RBAC** | ✅ 9-role hierarchy enforced server-side |
| **Audit logging** | ✅ 130+ audit actions, fire-and-forget |
| **AI Router (chat/TTS)** | ✅ Grok + OpenAI + ElevenLabs with fallback |
| **Error boundaries** | ✅ 17 present (root provides fallback for all) |
| **Import health** | ✅ 0 broken imports |

---

## Recommended Launch Sequence

### Phase 1: Unblock Core (2 days)
1. Fix Cockpit `/api/calls/initiate` → `/api/calls/start` + payload
2. Fix DispositionBar `/api/calls/dispositions` → `PUT /api/calls/:id/disposition`
3. Fix collections path: add `/accounts` sub-route or update 8 frontend paths
4. Fix payments: create `/api/payments` route aliasing `/api/billing` + add plans/links
5. Create `/api/dnc` route (CRUD on `dnc_lists` table)

### Phase 2: Unblock Workflows (2 days)
6. Add `/api/compliance/pre-dial` + `/api/compliance/disputes` handlers
7. Add `/api/analytics/agents` + `/api/analytics/agent/:id` handlers
8. Add `/api/organizations/:id` GET handler
9. Fix compliance root path in ViolationDashboard
10. Add auto session refresh to AuthProvider

### Phase 3: UI Polish (1 day)
11. Complete AppShell → RoleShell migration (8 pages)
12. Add `/admin/page.tsx` redirect
13. Add loading.tsx for `/work`, `/command`, `/compliance`

### Phase 4: Beta-Ready
14. Wire feedback route, messages route, onboarding compliance
15. Add campaign sequences handlers
16. Clean up orphan pages and DB tables

---

*Report generated from: UI cohesion audit (5/10), API wiring audit (35 missing routes), auth flow audit (call flow BROKEN), build verification (GREEN).*
