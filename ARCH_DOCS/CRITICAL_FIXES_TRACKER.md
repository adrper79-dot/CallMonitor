# Critical Fixes Tracker

**Created:** February 3, 2026  
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
- **Status:** 🔄 In Progress

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
| `components/team/TeamManagement.tsx` | ✅ Fixed (Feb 3, 4:40 PM) |
| `components/voice/ScorecardTemplateLibrary.tsx` | ✅ Fixed (Feb 3, 4:45 PM) |
| `components/reports/ReportScheduler.tsx` | ✅ Fixed (Feb 3, 4:45 PM) |
| `components/voice/ActiveCallPanel.tsx` | ✅ Fixed (Feb 3, 4:59 PM) |
| `components/voice/ActivityFeedEmbed.tsx` | ✅ Fixed (Feb 3, 4:59 PM) |
| `components/voice/ArtifactViewer.tsx` | ✅ Fixed (Feb 3, 4:59 PM) |
| `components/voice/BookingModal.tsx` | ✅ Fixed (Feb 3, 4:59 PM) |
| `components/voice/BookingsList.tsx` | ✅ Fixed (Feb 3, 4:59 PM) |
| `components/voice/CallDetailView.tsx` | ⬜ TODO |
| `components/voice/CallList.tsx` | ⬜ TODO |
| `components/voice/CallModulations.tsx` | ⬜ TODO |
| `components/voice/CallNotes.tsx` | ⬜ TODO |
| `components/review/ReviewMode.tsx` | ⬜ TODO |
| `components/dashboard/SurveyAnalyticsWidget.tsx` | ⬜ TODO |
| `components/campaigns/CampaignProgress.tsx` | ⬜ TODO |
| `components/reliability/ReliabilityDashboard.tsx` | ⬜ TODO |

#### Batch 3 - Root Components (Agent 3)
| File | Status |
|------|--------|
| `components/TTSGenerator.tsx` | ⬜ TODO |
| `components/AdminAuthDiagnostics.tsx` | ⬜ TODO |
| `components/BulkCallUpload.tsx` | ⬜ TODO |
| `components/AuthProvider.tsx` | ⬜ TODO |
| `components/AudioUpload.tsx` | ⬜ TODO |
| `components/layout/AppShell.tsx` | ⬜ TODO |

#### Batch 4 - Hooks (Agent 4)
| File | Status |
|------|--------|
| `hooks/useVoiceConfig.tsx` | ⬜ TODO |
| `hooks/useActiveCall.ts` | ✅ Fixed (Feb 3, 4:45 PM) |
| `hooks/useCallDetails.ts` | ⬜ TODO |
| `hooks/useRealtime.ts` | ⬜ TODO |

#### Batch 4 - App Components (Agent 4)
| File | Status |
|------|--------|
| `app/components/CallModulations.tsx` | ⬜ TODO |
| `lib/services/campaignExecutor.ts` | ⬜ TODO |
| `lib/compliance/complianceUtils.ts` | ⬜ TODO |

---

## 🔴 P1: HIGH PRIORITY

### P1-1: Missing Workers Routes
Many frontend components call API endpoints that don't exist in Workers yet.

| Route | Workers File | Status |
|-------|--------------|--------|
| `/api/voice/*` | `workers/src/routes/voice.ts` | ⬜ TODO |
| `/api/team/*` | `workers/src/routes/team.ts` | ⬜ TODO |
| `/api/billing/*` | `workers/src/routes/billing.ts` | ⬜ TODO |
| `/api/retention/*` | `workers/src/routes/retention.ts` | ⬜ TODO |
| `/api/ai-config` | `workers/src/routes/ai-config.ts` | ⬜ TODO |
| `/api/campaigns/*` | `workers/src/routes/campaigns.ts` | ⬜ TODO |
| `/api/reports/*` | `workers/src/routes/reports.ts` | ⬜ TODO |
| `/api/caller-id/*` | `workers/src/routes/caller-id.ts` | ⬜ TODO |
| `/api/compliance/*` | `workers/src/routes/compliance.ts` | ⬜ TODO |

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

### P2-1: Duplicate API Client Files
- **Files:** `lib/apiClient.ts` vs `lib/api-client.ts`
- **Decision:** Keep `apiClient.ts` (has Bearer token support), deprecate `api-client.ts`
- **Action:** Update any imports from `api-client.ts` to use `apiClient.ts`
- **Status:** ⬜ TODO

### P2-2: Centralize Database Connection in Workers
- **Issue:** Every route does `const { neon } = await import('@neondatabase/serverless')`
- **Fix:** Use centralized `getDb()` from `workers/src/lib/db.ts`
- **Status:** ⬜ TODO

---

## 🟡 P3: LOW PRIORITY

### P3-1: Add Rate Limiting to Workers
- **File:** `workers/src/index.ts`
- **Action:** Add Hono rate limiter middleware
- **Status:** ⬜ TODO

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

### AD-2: API Client Consolidation
**Decision:** Use `lib/apiClient.ts` as the single API client. Deprecate `lib/api-client.ts`.

**Rationale:** `apiClient.ts` includes:
- Bearer token from localStorage
- API_BASE URL resolution
- Credentials include for cookies (fallback)
- Consistent error handling

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

---

## How to Use This Document

1. **Claim a batch:** Edit this file, change status from ⬜ to 🔄 with your agent ID
2. **Complete work:** Change status to ✅ when done
3. **Log progress:** Add entry to Progress Log table
4. **Rebuild/Deploy:** After P0 fixes, rebuild frontend and redeploy Workers
