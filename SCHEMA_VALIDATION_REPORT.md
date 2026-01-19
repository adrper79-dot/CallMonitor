# Production Schema Validation Report

**Date:** 2025-01-22  
**Validator:** 5-Phase Schema-to-Code Cross-Reference  
**Source of Truth:** `ARCH_DOCS/01-CORE/Schema.txt` (production schema)

---

## Executive Summary

Comprehensive validation found **5 CRITICAL schema mismatches** that would cause production 500 errors. All have been **FIXED**.

---

## ❌ CRITICAL ISSUES FOUND & FIXED

### Issue 1: webrtc_sessions GET Handler - Non-Existent Columns
**File:** [app/api/webrtc/session/route.ts](app/api/webrtc/session/route.ts#L325-L337)  
**Severity:** 🔴 CRITICAL (would cause 500)

**Problem:** Code accessed columns that don't exist in production:
- `webrtcSession.call_id` ❌
- `webrtcSession.connected_at` ❌
- `webrtcSession.audio_bitrate` ❌
- `webrtcSession.packet_loss_percent` ❌
- `webrtcSession.jitter_ms` ❌
- `webrtcSession.round_trip_time_ms` ❌

**Production Schema:**
```sql
webrtc_sessions: id, organization_id, user_id, session_token, status, created_at
```

**Fix Applied:** Removed all references to non-existent columns. Now returns only schema-valid fields.

---

### Issue 2: webrtc_sessions DELETE Handler - Non-Existent Column
**File:** [app/api/webrtc/session/route.ts](app/api/webrtc/session/route.ts#L376)  
**Severity:** 🔴 CRITICAL (would cause UPDATE failure)

**Problem:** 
```typescript
.update({ status: 'disconnected', disconnected_at: new Date().toISOString() })
```
Column `disconnected_at` does NOT exist in production schema.

**Fix Applied:** Removed `disconnected_at` from UPDATE.

---

### Issue 3: audit_logs INSERT - Using `details` Column
**File:** [app/api/webhooks/survey/route.ts](app/api/webhooks/survey/route.ts#L213)  
**Severity:** 🔴 CRITICAL (would cause INSERT failure)

**Problem:**
```typescript
await supabaseAdmin.from('audit_logs').insert({
  ...
  details: { call_id: call.id, responses_count: responses.length }  // ❌ WRONG
})
```

**Production Schema for audit_logs:**
```sql
id, organization_id, user_id, system_id, resource_type, resource_id, 
action, before, after, created_at, actor_type, actor_label
```
No `details` column - should use `after` column.

**Fix Applied:** Changed `details` to `after` and added `created_at`.

---

### Issue 4: audit_logs INSERT - Using `details` Column (Second Location)
**File:** [app/api/webhooks/survey/route.ts](app/api/webhooks/survey/route.ts#L311)  
**Severity:** 🔴 CRITICAL (would cause INSERT failure)

**Same Issue:** Used `details` instead of `after`.

**Fix Applied:** Changed `details` to `after` and added `created_at`.

---

### Issue 5: audit_logs INSERT - Using `details` Column (Shopper)
**File:** [app/api/shopper/results/route.ts](app/api/shopper/results/route.ts#L99)  
**Severity:** 🔴 CRITICAL (would cause INSERT failure)

**Problem:**
```typescript
await supabaseAdmin.from('audit_logs').insert({
  ...
  details: { call_id: callId, script_id: scriptId, ... }  // ❌ WRONG
})
```

**Fix Applied:** Changed `details` to `after` and added `created_at`.

---

### Issue 6: TypeScript Type Mismatch
**File:** [types/tier1-features.ts](types/tier1-features.ts#L342)  
**Severity:** 🟡 MEDIUM (type mismatch, wouldn't cause runtime error but misleading)

**Problem:** `WebRTCSession` interface included columns not in production:
- `call_id`, `signalwire_resource_id`, `ice_servers`, `audio_bitrate`, 
- `packet_loss_percent`, `jitter_ms`, `round_trip_time_ms`, 
- `connected_at`, `disconnected_at`

**Fix Applied:** Trimmed interface to match production schema exactly.

---

## ✅ VALIDATED TABLES (No Issues)

| Table | Operations Found | Status |
|-------|------------------|--------|
| `calls` | 8 INSERTs | ✅ All columns valid |
| `ai_runs` | 13 INSERTs | ✅ All columns valid |
| `recordings` | 3 INSERTs | ✅ All columns valid |
| `voice_configs` | 2 INSERTs | ✅ All columns valid |
| `audit_logs` | 50+ INSERTs | ✅ Fixed (see above) |
| `campaign_audit_log` | 5 INSERTs | ✅ All columns valid |
| `org_members` | 3 INSERTs | ✅ All columns valid |
| `users` | 2 INSERTs | ✅ All columns valid |
| `evidence_bundles` | 2 INSERTs | ✅ All columns valid |
| `evidence_manifests` | 1 INSERT | ✅ All columns valid |
| `caller_id_numbers` | 1 INSERT | ✅ All columns valid |
| `generated_reports` | 1 INSERT | ✅ All columns valid |
| `scorecards` | 1 INSERT | ✅ All columns valid |
| `sso_login_events` | 1 INSERT | ✅ All columns valid |
| `shopper_results` | 1 INSERT | ✅ All columns valid |
| `transcript_versions` | 1 INSERT | ✅ All columns valid |
| `artifact_provenance` | 1 INSERT | ✅ All columns valid |
| `legal_holds` | Audit only | ✅ All columns valid |
| `webrtc_sessions` | 1 INSERT | ✅ Fixed (see above) |

---

## Root Cause Analysis

### Why Previous Scans Missed This

1. **Migration Files ≠ Production Schema**
   - The `migrations/2026-01-16-webrtc-sessions.sql` file defines 15+ columns
   - Production `Schema.txt` only has 6 columns
   - **Previous scans validated against migration files, not production schema**

2. **TypeScript Types Matched Migrations**
   - `types/tier1-features.ts` defined interfaces matching migration columns
   - TypeScript compiled successfully but runtime would fail

3. **audit_logs `details` Column**
   - Some code used `details` instead of `after`
   - This was copied from incorrect examples or added without schema verification

---

## Files Modified

1. `app/api/webrtc/session/route.ts` - Removed non-existent columns
2. `app/api/webhooks/survey/route.ts` - Changed `details` to `after` (2 locations)
3. `app/api/shopper/results/route.ts` - Changed `details` to `after`
4. `types/tier1-features.ts` - Fixed WebRTCSession interface

---

## Recommended Follow-Up

1. **Apply Migration** (if desired): Run `migrations/2026-01-16-webrtc-sessions.sql` to add columns to production
2. **Update Schema.txt**: Keep Schema.txt as single source of truth
3. **CI Integration**: Add schema validation to CI pipeline

---

## Schema Reference (Critical Tables)

### webrtc_sessions (PRODUCTION)
```sql
id uuid NOT NULL DEFAULT gen_random_uuid(),
organization_id uuid NOT NULL,
user_id uuid NOT NULL,
session_token text NOT NULL UNIQUE,
status text DEFAULT 'initializing',
created_at timestamptz DEFAULT now()
```

### audit_logs (PRODUCTION)
```sql
id uuid NOT NULL,
organization_id uuid,
user_id uuid,
system_id uuid,
resource_type text,
resource_id uuid,
action text,
before jsonb,
after jsonb,
created_at timestamptz DEFAULT now(),
actor_type text,
actor_label text
```

---

**Validation Complete ✅**
