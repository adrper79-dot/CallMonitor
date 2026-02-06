# Critical Fixes Tracker

**Created:** February 3, 2026  
**Last Updated:** February 6, 2026  
**Status:** Active Work Items  
**Priority Legend:** 🚨 P0 (Blocking) | 🔴 P1 (High) | 🟠 P2 (Medium) | 🟡 P3 (Low)

---

## Executive Summary

Architecture review identified **6 categories** of issues affecting production stability. This document serves as the canonical work list for remediation.

**Root Cause:** Hybrid deployment (Pages + Workers) requires all API calls to use Bearer token authentication since cross-origin cookies are unreliable. Many components still use raw `fetch()` without auth headers.

---

## 🚨 P0: BLOCKING ISSUES

### P0-1: Organizations Endpoint Auth Broken ✅ FIXED
- **File:** `workers/src/routes/organizations.ts`
- **Issue:** `/api/organizations/current` has `requireAuth()` commented out but references `session.userId`
- **Impact:** Endpoint crashes with undefined error
- **Fix:** Uncomment auth, properly use session
- **Status:** ✅ Fixed by Agent 1

### P0-2: Components Using Raw fetch() Without Bearer Token
- **Impact:** 401 Unauthorized errors in production
- **Pattern Required:** Use `apiGet()`/`apiPost()` from `@/lib/apiClient`
- **Status:** ✅ COMPLETE (All components migrated, `api-client.ts` consolidated and deleted)

#### Batch 1 - Settings Components (Agent 1)
| File | Status |
|------|--------|
| `components/settings/AIAgentConfig.tsx` | ✅ Fixed |
| `components/settings/UsageDisplay.tsx` | ✅ Fixed |
| `components/settings/RetentionSettings.tsx` | ✅ Fixed |
| `components/settings/LiveTranslationConfig.tsx` | ✅ Fixed |
| `components/settings/PaymentMethodManager.tsx` | ✅ Fixed |
| `components/settings/PlanComparisonTable.tsx` | ✅ Fixed |
| `components/settings/BillingActions.tsx` | ✅ Fixed |
| `components/settings/SSOConfiguration.tsx` | ✅ Fixed |
| `components/settings/WebhookDeliveryLog.tsx` | ✅ Fixed |
| `components/settings/WebhookManager.tsx` | ✅ Fixed |
| `components/settings/WebhookList.tsx` | ✅ Fixed |
| `components/settings/SubscriptionManager.tsx` | ✅ Fixed |

#### Batch 2 - Team, Voice & Dashboard Components (Agent 2)
| File | Status |
|------|--------|
| `components/team/TeamManagement.tsx` | ✅ Fixed |
| `components/voice/ScorecardTemplateLibrary.tsx` | ✅ Fixed |
| `components/reports/ReportScheduler.tsx` | ✅ Fixed |
| `components/voice/ActiveCallPanel.tsx` | ✅ Fixed |
| `components/voice/ActivityFeedEmbed.tsx` | ✅ Fixed |
| `components/voice/ArtifactViewer.tsx` | ✅ Fixed |
| `components/voice/BookingModal.tsx` | ✅ Fixed |
| `components/voice/BookingsList.tsx` | ✅ Fixed |
| `components/voice/CallDetailView.tsx` | ✅ Fixed (Feb 6) |
| `components/voice/CallList.tsx` | ✅ Fixed (Feb 6) |
| `components/voice/CallModulations.tsx` | ✅ Fixed (Feb 6) |
| `components/voice/CallNotes.tsx` | ✅ Fixed (Feb 6) |
| `components/review/ReviewMode.tsx` | ✅ Fixed (Feb 6) |
| `components/dashboard/SurveyAnalyticsWidget.tsx` | ✅ Fixed (Feb 6) |
| `components/campaigns/CampaignProgress.tsx` | ✅ Fixed (Feb 6) |
| `components/reliability/ReliabilityDashboard.tsx` | ✅ Fixed (Feb 6) |

#### Batch 3 - Root Components (Agent 3)
| File | Status |
|------|--------|
| `components/TTSGenerator.tsx` | ✅ Fixed (Feb 6) |
| `components/AdminAuthDiagnostics.tsx` | ✅ Fixed (Feb 6) |
| `components/BulkCallUpload.tsx` | ✅ Fixed (Feb 6) |
| `components/AuthProvider.tsx` | ✅ Fixed (Feb 6) |
| `components/AudioUpload.tsx` | ✅ Fixed (Feb 6) |
| `components/layout/AppShell.tsx` | ✅ Fixed (Feb 6) |

#### Batch 4 - Hooks (Agent 4)
| File | Status |
|------|--------|
| `hooks/useVoiceConfig.tsx` | ✅ Fixed (Feb 6) |
| `hooks/useActiveCall.ts` | ✅ Fixed |
| `hooks/useCallDetails.ts` | ✅ Fixed (Feb 6) |
| `hooks/useRealtime.ts` | ✅ Fixed (Feb 6) |

#### Batch 5 - Pages & Services (Feb 6)
| File | Status |
|------|--------|
| `app/analytics/page.tsx` | ✅ Fixed (Feb 6) |
| `app/test/page.tsx` | ✅ Fixed (Feb 6) |
| `app/signup/page.tsx` | ✅ Fixed (Feb 6) |
| `app/bookings/page.tsx` | ✅ Fixed (Feb 6) |
| `components/UnlockForm.tsx` | ✅ Fixed (Feb 6) |
| `components/voice/VoiceTargetManager.tsx` | ✅ Fixed (Feb 6) |
| `components/voice/TargetCampaignSelector.tsx` | ✅ Fixed (Feb 6) |
| `app/components/CallModulations.tsx` | ✅ Fixed (Feb 6) |
| `lib/compliance/complianceUtils.ts` | ✅ Fixed (Feb 6) |

---

## 🔴 P1: HIGH PRIORITY

### P1-1: Missing Workers Routes
Many frontend components call API endpoints that don't exist in Workers yet.

| Route | Workers File | Status |
|-------|--------------|--------|
| `/api/voice/*` | `workers/src/routes/voice.ts` | ✅ DONE |
| `/api/team/*` | `workers/src/routes/team.ts` | ✅ DONE |
| `/api/billing/*` | `workers/src/routes/billing.ts` | ✅ DONE |
| `/api/retention/*` | `workers/src/routes/retention.ts` | ✅ DONE |
| `/api/ai-config` | `workers/src/routes/ai-config.ts` | ✅ DONE |
| `/api/campaigns/*` | `workers/src/routes/campaigns.ts` | ✅ DONE |
| `/api/reports/*` | `workers/src/routes/reports.ts` | ✅ DONE |
| `/api/caller-id/*` | `workers/src/routes/caller-id.ts` | ✅ DONE |
| `/api/compliance/*` | `workers/src/routes/compliance.ts` | ✅ DONE |

**Migration Pattern:**
1. Copy logic from `app/api/[route]/route.ts` 
2. Convert to Hono handlers
3. Use `requireAuth()` for protected routes
4. Register in `workers/src/index.ts`

### P1-2: Deploy Workers After Fixes
After P0 fixes, redeploy Workers:
```bash
cd workers && npx wrangler deploy
```

---

## 🟠 P2: MEDIUM PRIORITY

### P2-1: Duplicate API Client Files ✅ COMPLETE
- **Files:** `lib/apiClient.ts` (canonical) — `lib/api-client.ts` **DELETED**
- **Resolution:** Ported 4 unique functions (`apiFetchRaw`, `apiPostFormData`, `apiPostNoAuth`, `apiGetNoAuth`) into `apiClient.ts`, migrated all 22 importers, deleted duplicate.
- **Status:** ✅ COMPLETE (Feb 6, 2026)

### P2-2: Centralize Database Connection in Workers
- **Issue:** Every route does `const { neon } = await import('@neondatabase/serverless')`
- **Fix:** Use centralized `getDb()` from `workers/src/lib/db.ts`
- **Batch 1 (7 files):** ✅ DONE — admin, reliability, tts, audio, surveys, retention, ai-config migrated to `getDb()` + parameterized queries
- **Batch 2 (15 files):** ✅ DONE — auth, webhooks, voice, billing, shopper, caller-id, organizations, users, webrtc, audit, usage, campaigns, scorecards, reports, analytics migrated to `getDb()` + parameterized queries
- **Status:** ✅ COMPLETE (22/22 files migrated)

---

## 🟡 P3: LOW PRIORITY

### P3-1: Add Rate Limiting to Workers
- **Auth endpoints:** ✅ DONE via M6 — KV-backed sliding-window rate limiter in `workers/src/lib/rate-limit.ts`
- **Broader API rate limiting:** ⬜ TODO — Cloudflare WAF can handle general rate limiting; app-level middleware deferred
- **Status:** ⚠️ PARTIAL (auth done, broader API deferred)

### P3-2: Session Storage Key Alignment
- **Issue:** Frontend uses `wb-session-token` in localStorage, Workers reads `session-token` cookie
- **Current Mitigation:** Bearer token in Authorization header (implemented in apiClient.ts)
- **Status:** ⚠️ Mitigated (Bearer token works around cookie issues)

---

## Architectural Decisions

### AD-1: Bearer Token Authentication (Mandatory)
**Decision:** All frontend-to-Workers API calls MUST include Bearer token via Authorization header.

**Rationale:** Cross-origin cookies (frontend on `voxsouth.online`, API on `wordisbond-api.adrper79.workers.dev`) are blocked by browser security even with `SameSite=None; Secure`.

**Implementation:**
```typescript
// CORRECT - use apiClient.ts
import { apiGet, apiPost } from '@/lib/apiClient'
const data = await apiGet('/api/endpoint')

// WRONG - raw fetch without auth
const res = await fetch('/api/endpoint', { credentials: 'include' })
```

### AD-2: API Client Consolidation ✅ IMPLEMENTED
**Decision:** `lib/apiClient.ts` is the **sole** API client. `lib/api-client.ts` has been **deleted**.

**Full export surface:**
- `apiGet`, `apiPost`, `apiPut`, `apiPatch`, `apiDelete` — JSON helpers with Bearer auth
- `apiFetch` — raw Response (no error check)
- `apiFetchRaw` — raw Response with error check
- `apiPostFormData` — file uploads with Bearer auth
- `apiPostNoAuth`, `apiGetNoAuth` — pre-auth calls (signin, forgot-password)
- `resolveApiUrl`, `API_BASE`, `ApiError` class

### AD-3: Workers Route Migration
**Decision:** All API logic must exist in Cloudflare Workers (`workers/src/routes/`).

**Rationale:** Next.js static export cannot have API routes. The `app/api/` directory is for reference only during migration.

---

## Progress Log

| Date | Agent | Action | Files |
|------|-------|--------|-------|
| 2026-02-03 | Agent 1 | Fixed organizations.ts auth | `workers/src/routes/organizations.ts` |
| 2026-02-03 | Agent 1 | Fixed settings components (Batch 1) | 12 files in `components/settings/` |
| 2026-02-03 | Agent 2 | Fixed team component (Batch 2) | `components/team/TeamManagement.tsx` |
| 2026-02-03 | Agent 2 | Fixed voice/reports (Batch 2) | `ScorecardTemplateLibrary.tsx`, `ReportScheduler.tsx` |
| 2026-02-03 | Agent 2 | Fixed voice/hook (Batch 2+4) | `ActiveCallPanel.tsx`, `ActivityFeedEmbed.tsx`, `ArtifactViewer.tsx`, `BookingModal.tsx`, `BookingsList.tsx`, `useActiveCall.ts` |
| 2026-02-06 | Agent | D2 Phase 1: Raw fetch migration (14 calls, 9 files) | Batch 2-5 remaining components, hooks, pages |
| 2026-02-06 | Agent | D1: Dead code cleanup (3 files, 14 API_BASE) | Deleted unused files, removed dead declarations |
| 2026-02-06 | Agent | D2 Phase 2: 8 files, 17 fetch calls migrated | Voice, analytics, compliance components |
| 2026-02-06 | Agent | P2-1: API client consolidation | Ported 4 functions → `apiClient.ts`, rewrote 21 imports, deleted `api-client.ts` |
| 2026-02-06 | Agent | Sentry dead code removal | Deleted `monitoring.ts`, `sentry-edge.ts`, uninstalled `@sentry/nextjs` |
| 2026-02-06 | Agent | Build + Deploy verified | 30/30 pages clean, deployed to Cloudflare Pages |
| 2026-02-07 | Agent | P2-2 Batch 2: DB centralization (15 files) | auth, webhooks, voice, billing, shopper, caller-id, organizations, users, webrtc, audit, usage, campaigns, scorecards, reports, analytics — all migrated from inline neon to `getDb()` + parameterized queries |
| 2026-02-07 | Agent | P1-1: Compliance route (last missing) | Created `workers/src/routes/compliance.ts` — POST/GET/PATCH violations with Zod validation, registered in index.ts |

---

## How to Use This Document

1. **Claim a batch:** Edit this file, change status from ⬜ to 🔄 with your agent ID
2. **Complete work:** Change status to ✅ when done
3. **Log progress:** Add entry to Progress Log table
4. **Rebuild/Deploy:** After P0 fixes, rebuild frontend and redeploy Workers
