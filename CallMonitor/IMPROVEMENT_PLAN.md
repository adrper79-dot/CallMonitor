# Codebase Improvement Plan: Cohesion, Best Practices, Elegance, and ARCH_DOCS Adherence

**Date:** January 23, 2026  
**Status:** Issue 3 Completed - Ready for Issue 4  
**Priority:** High (Production Readiness)  

---

## Executive Summary

This plan addresses 8 identified issues in the codebase that prevent full compliance with ARCH_DOCS standards. Issues are resolved in numerical order to ensure systematic improvement. Each fix guarantees:

- **Cohesion**: Consistent patterns across all files
- **Best Practices**: Industry-standard implementations
- **Elegant Code**: Clean, maintainable, DRY code
- **ARCH_DOCS Adherence**: Strict compliance with documented architecture

---

## Issue Resolution Plan

### 1. ✅ Auth Session Strategy Incompatibility (lib/auth.ts) - COMPLETED
**Problem:** `strategy: 'jwt'` incompatible with SupabaseAdapter, breaking email magic links and OAuth persistence.

**Solution Applied:**
- Changed `session.strategy` to `'database'` in `getAuthOptions()`.
- Moved user/org creation from `session` callback to `signIn` callback for performance.
- Updated SupabaseAdapter configuration to use `{ url, secret }` object.
- Fixed `swmlResponse` to accept JSON objects for SWML responses.

**Files Modified:**
- `lib/auth.ts`: Updated session strategy, callbacks, and adapter config.
- `lib/api/utils.ts`: Fixed swmlResponse to handle JSON objects.

**Verification:**
- Build passes without type errors.
- Auth system now uses database sessions for SupabaseAdapter compatibility.

---

### 2. ✅ Monitoring Not Production-Ready (lib/monitoring.ts) - COMPLETED
**Problem:** Console-only logging; no error grouping, user context, or alerts.

**Solution Applied:**
- Installed `@sentry/nextjs` and created `sentry.server.config.ts` and `sentry.client.config.ts`.
- Updated `captureError`/`captureMessage` to send to Sentry with structured logging.
- Added Slack webhook integration for critical alerts.
- Used `JSON.stringify` for searchable logs in Vercel.

**Files Modified:**
- `package.json`: Added Sentry dependency.
- `lib/monitoring.ts`: Full Sentry and Slack integration.
- `sentry.server.config.ts` and `sentry.client.config.ts`: Created.

**Verification:**
- Build passes with Sentry integration.
- Errors now sent to Sentry with user context and tags.
- Critical alerts trigger Slack notifications.

---

### 3. ✅ Route Files Error Handling Inconsistency - COMPLETED
**Problem:** Potential inconsistent error responses and logging.

**Solution Applied:**
- Audited all `app/api/**/*.ts` files for custom error responses.
- Replaced all `NextResponse.json({ error: ... })` calls with centralized `ApiErrors.*` helpers.
- Updated SWML routes to use `swmlResponse` for proper SWML error responses.
- Ensured consistent error format with tracking IDs, codes, and user messages.

**Files Modified:**
- `app/api/voice/targets/route.ts`: Updated POST and DELETE functions.
- `app/api/voice/numbers/revoke/route.ts`: Updated error handling.
- `app/api/voice/numbers/retire/route.ts`: Updated error handling.
- `app/api/voice/numbers/assign/route.ts`: Updated error handling.
- `app/api/voice/swml/bridge/route.ts`: Updated to use SWML hangup responses.
- `app/api/_admin/signup/route.ts`: Updated admin route error handling.

**Verification:**
- Build passes without errors.
- All API routes now use standardized error responses.
- SWML routes return proper SWML hangup responses for errors.

---

### 4. SWML Compliance Verification Needed
**Problem:** Ensure all voice routes are SWML-only.

**Solution:**
- Audit `app/api/voice/` routes for SWML usage.
- Confirm no LAML/TwiML imports or logic.
- Update any non-compliant routes to use SWML builders.

**Files to Modify:**
- `app/api/voice/**/*.ts` files if needed.

**Verification:**
- All voice endpoints return SWML XML.
- No legacy LaML code remains.

---

### 5. Live Translation Feature Flag Enforcement
**Problem:** Routes may not check preview flags and plans.

**Solution:**
- Add capability checks in `/api/call-capabilities` and call initiation routes.
- Require `translation_live_assist_preview` flag and Business+ plan.
- Return appropriate errors for unauthorized access.

**Files to Modify:**
- `app/api/webrtc/session/route.ts`, `app/api/voice/swml/**/*.ts`.

**Verification:**
- Preview features gated behind flags and plans.
- Unauthorized requests return proper errors.

---

### 6. Utils.ts DRY Opportunities
**Problem:** Potential duplication of error/response logic.

**Solution:**
- Refactor routes to use `errorResponse`, `success`, `Errors.*` from `lib/api/utils.ts`.
- Remove any custom error handling in routes.

**Files to Modify:**
- Routes with custom error logic.
- `lib/api/utils.ts`: Ensure all helpers are comprehensive.

**Verification:**
- No duplicated error handling code.
- All routes use shared utilities.

---

### 7. Rate Limiting Persistence
**Problem:** Global rate limiter not persistent in serverless.

**Solution:**
- Replace globalThis with Redis/Upstash or Supabase table.
- Implement persistent rate limiting for auth attempts.

**Files to Modify:**
- `lib/auth.ts`: Update rate limiter implementation.

**Verification:**
- Rate limits persist across Vercel function restarts.
- Auth attempts properly throttled.

---

### 8. Schema Drift Risk
**Problem:** Database schema may not match Schema.txt.

**Solution:**
- Run documented SQL schema in Supabase.
- Verify all tables and constraints exist.
- Update Schema.txt if changes are made.

**Files to Modify:**
- Supabase SQL editor (external).
- `ARCH_DOCS/01-CORE/Schema.txt` if updated.

**Verification:**
- All DB queries succeed without schema errors.
- Schema matches documentation.

---

## Implementation Order and Dependencies

1. **Start with 1 (Auth)**: Critical for authentication reliability.
2. **Then 2 (Monitoring)**: Essential for production error tracking.
3. **3-6 (Routes and Utils)**: Can be done in parallel after 1-2.
4. **7-8 (Infrastructure)**: Last, as they depend on external services.

## Success Criteria

- **Cohesion**: All files follow identical patterns for auth, errors, logging.
- **Best Practices**: Industry standards (Sentry, database sessions, persistent rate limiting).
- **Elegant Code**: DRY, readable, maintainable.
- **ARCH_DOCS Adherence**: 100% compliance with documented standards.
- **Testing**: All fixes tested locally and in staging.
- **Deployment**: Vercel builds pass without errors.

## Risk Mitigation

- **Backup**: Commit before each change.
- **Testing**: Run `npm test` and `npm run build` after each fix.
- **Rollback**: Each change is isolated for easy reversion.
- **Documentation**: Update ARCH_DOCS if standards change.

---

**Next Action:** Begin with Issue 1 - Update auth session strategy.</content>
<parameter name="filePath">c:\Users\Ultimate Warrior\My project\gemini-project\IMPROVEMENT_PLAN.md