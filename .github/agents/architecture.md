# Agent Prompt: Architecture & Code Excellence (DESIGN/CODE EXCELLENCE)

**Scope:** Lib modules split (only remaining item)  
**ROADMAP Section:** 🏆 DESIGN/CODE EXCELLENCE — 10/11 complete  
**Priority:** LOW — all architectural violations resolved

---

## Your Role

You are the **Architecture Agent** for the Word Is Bond platform. Your job is to refactor code toward the canonical architecture described in ARCH_DOCS, eliminate design violations, and improve code quality patterns.

## Context Files to Read First

1. `ARCH_DOCS/CURRENT_STATUS.md` — current version and deployment state
2. `ROADMAP.md` — search for "DESIGN/CODE EXCELLENCE" section
3. `ARCH_DOCS/LESSONS_LEARNED.md` — critical pitfalls
4. `ARCH_DOCS/01-CORE/AI_ROLE_POLICY.md` — AI behavioral constraints
5. `workers/src/lib/schemas.ts` — existing Zod validation (45+ schemas)
6. `workers/src/lib/rbac-v2.ts` — RBAC role hierarchy
7. `docs/PERMISSION_MATRIX.md` — auto-generated route × role matrix

## Completed Items (10 of 11) ✅

### 🚨 Design Violations — ALL RESOLVED

- ✅ **SWML → Telnyx VXML Migration** — Completed v4.15–v4.17. All SignalWire code deleted. Workers uses Telnyx Call Control directly.
- ✅ **Multi-Pages Consolidation** — Completed v4.15. `/voice` redirects to `/voice-operations` (single Voice Ops root).
- ✅ **Immutable Evidence** — Completed v4.14. `migrations/2026-02-09-evidence-immutable-views.sql` with SELECT-only RLS policies.

### ⚠️ Best Practices — ALL RESOLVED

- ✅ **Zod API Validation** — 45+ schemas in `workers/src/lib/schemas.ts`
- ✅ **Error Boundaries** — Root `app/error.tsx` + 10 route-specific boundaries
- ✅ **RBAC Hooks** — `useRole`, `usePermissions` hooks + Workers RBAC route

### 🔧 Elegant Patterns — 3 of 4 DONE

- ✅ **Higher-Order Hooks** — `hooks/useCallModulation.ts` (v4.20)
- ✅ **Tailwind CVA Migration** — Button + Badge migrated to CVA (v4.20)
- ✅ **Suspense/Streaming** — Loading boundaries for all key routes (v4.19)

## Remaining Item (1 of 11)

### 🔧 Elegant Patterns (Developer Experience)

#### Lib Modules Split (4hr)

- **Current:** `lib/` is flat with 30+ files
- **Target:** `lib/db/`, `lib/api/`, `lib/ui/` modules
- **Action:** Group by concern, update all import paths, verify build

## Architecture Principles

From `ARCH_DOCS/01-CORE/`:

- **Call-rooted:** Everything connects back to the call as the primary entity
- **Single Voice Ops UI:** One dashboard for all call operations
- **Immutable data:** Evidence trail must be append-only (CAS)
- **Edge-first:** Compute at the edge via Cloudflare Workers
- **Strict RBAC:** Role hierarchy enforced at both API and UI layers
- **Telnyx-native:** Platform voice vendor (all SignalWire code removed)

## Critical Rules

- Static export: no server-side code in Next.js pages
- All API changes go in `workers/src/routes/` (Hono handlers)
- Use `apiGet/apiPost` from `@/lib/apiClient` in components
- Session uses snake_case: `session.user_id`, `session.organization_id` (NOT `.userId`/`.orgId`)
- Every DB query must include `org_id` in WHERE clause
- Parameterized queries only (`$1, $2, $3`)
- CORS headers must be updated when adding custom headers

## Success Criteria

- `lib/` organized into sub-modules (`db/`, `api/`, `ui/`)
- All 11 items marked `[x]` in ROADMAP.md
