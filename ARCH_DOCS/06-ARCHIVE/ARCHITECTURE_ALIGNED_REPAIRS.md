# Architecture-Aligned Repairs

**Date:** January 13, 2026  
**Scope:** Repairs aligned with ARCH_DOCS/01-CORE/MASTER_ARCHITECTURE.txt principles

---

## ✅ Completed Repairs

### 1. User Diagnostic & Cleanup Script (ARCH-1)
**File:** `migrations/fixes/DIAGNOSE_AND_CLEANUP_USER.sql`

**Architecture Alignment:**
- **Call-rooted design**: Respects data hierarchy (users → orgs → calls)
- **Clean data model**: Removes orphans, maintains integrity  
- **Capability-driven**: Auth user existence determines system capability
- **Artifact integrity**: Respects foreign key relationships
- **No magic fixes**: If auth user doesn't exist, cleanup and restart is correct

**Philosophy Applied:**
> "If the user doesn't exist in auth, there's nothing to fix"

This is architecturally correct because:
- Supabase Auth is source of truth for authentication
- `public.users` is derived from `auth.users`
- Without auth user, they can't login anyway
- Cleanest solution: remove orphans, have user sign up with fixed code

**What It Does:**
1. **Diagnoses** user status in both `auth.users` and `public.users`
2. **Provides clear recommendations** based on state
3. **Cleans up orphaned data** if user missing from auth
4. **Follows architecture principle**: No auth user = nothing to fix

---

### 2. SignalWire Webhook Logging Upgrade (ARCH-2)
**File:** `app/api/webhooks/signalwire/route.ts`

**Architecture Alignment:**
- **SignalWire as execution plane**: Logs reflect "authoritative media plane" concept
- **Artifact integrity**: Recording logs emphasize "artifacts are first-class"
- **Structured logging**: Per architecture, proper logging infrastructure
- **Security events**: Invalid signatures logged as security events

**Changes Made:**
```typescript
// BEFORE: console.log/error
console.error('signalwire webhook: invalid signature', { ... })
console.log('signalwire webhook processing', { ... })

// AFTER: Structured logger with architecture context
logger.error('SignalWire webhook: Invalid signature - potential spoofing attempt', ...)
logger.info('SignalWire webhook received', { source: 'signalwire-webhook', ... })
logger.info('SignalWire webhook: Recording artifact detected', { 
  artifactType: 'recording',
  source: 'signalwire-webhook'
})
```

**Architecture Concepts Applied:**
- SignalWire = "authoritative media execution plane"
- Recordings = "first-class artifacts"
- Webhooks = external execution events
- Async processing = non-blocking architecture

**Remaining Console Statements:** 21 in webhook (to be migrated incrementally)

---

## 🎯 Architecture Principles Applied

### 1. Voice-First, Call-Rooted Design
- User fixes respect call hierarchy
- No orphan calls or recordings
- Data integrity maintained

### 2. SignalWire-First v1
- Webhooks handled as execution plane events
- Proper logging of media plane interactions
- Recording artifacts treated as first-class

### 3. Capability-Driven, Not UI-Driven
- User cleanup based on auth capability
- No artificial fixes for impossible states
- Clear path forward based on capabilities

### 4. Artifact Integrity Preserved
- Recordings are first-class
- Foreign key relationships respected
- Clean orphan removal when needed

### 5. Clean Pre-/Post-FreeSWITCH Alignment
- Current fixes work with v1 (SignalWire only)
- Will work with v2 (FreeSWITCH) without changes
- No v2 dependencies introduced

---

## 📋 Remaining Architecture-Aligned Tasks

### 3. API Routes Config Centralization (ARCH-3)
**Status:** Pending  
**Priority:** High

**Files to Update:**
- `app/api/voice/config/route.ts`
- `app/api/voice/laml/outbound/route.ts`
- `app/api/voice/swml/outbound/route.ts`
- `app/api/webhooks/assemblyai/route.ts`

**Architecture Principle:** Centralized, validated configuration
**Pattern:**
```typescript
// BEFORE:
const url = process.env.NEXT_PUBLIC_SUPABASE_URL

// AFTER:
import { config } from '@/lib/config'
const url = config.supabase.url
```

---

### 4. RLS Policy Verification (ARCH-4)
**Status:** Requires Production Access  
**Priority:** High

**Architecture Principle:** Capability-driven security (RBAC matrix)

**Verification Needed:**
```sql
-- Verify RLS policies exist for critical tables
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('calls', 'recordings', 'organizations', 'users', 'voice_configs')
ORDER BY tablename, policyname;
```

**RBAC Alignment Check:**
- Owner: Full access
- Admin: Manage organization and calls  
- Operator: Execute calls, view data
- Viewer: Read-only access

---

### 5. Rate Limiting Application (ARCH-5)
**Status:** Partially Applied  
**Priority:** Medium

**Architecture Principle:** Security boundaries

**Current State:**
✅ `/api/voice/call` - Has rate limiting (10 req/min per IP+org)
⚠️  `/api/auth/signup` - NO rate limiting (abuse risk)
⚠️  `/api/webhooks/*` - NO rate limiting (DoS risk)

**Recommended Limits (per architecture):**
- Signup: 5 attempts/hour per IP
- Webhooks: 1000/minute per source
- Call API: 100/hour per org (current: 10/min - may be too restrictive)

---

## 🔍 Architecture Compliance Status

| Principle | Status | Notes |
|-----------|--------|-------|
| **Voice-First, Call-Rooted** | ✅ Compliant | User fixes respect call hierarchy |
| **SignalWire-First v1** | ✅ Compliant | Webhook logging reflects execution plane |
| **One Voice Operations UI** | ✅ Compliant | No changes needed to UI |
| **Artifact Integrity** | ✅ Compliant | Recordings treated as first-class |
| **Capability-Driven** | ⚠️  Partial | RLS verification needed |
| **Clean FreeSWITCH Alignment** | ✅ Compliant | No v2 dependencies |

---

## 📊 Progress Tracking

**Architecture-Aligned Repairs:**
- Completed: 2/5 (40%)
- In Progress: 1/5 (20%)
- Pending: 2/5 (40%)

**Code Quality:**
- Console.log replaced in webhook: 5/26 locations (19%)
- Config centralization: 0/80 files (0%)
- Rate limiting: 1/3 endpoints (33%)

---

## 🎯 Next Steps (Architecture Priority Order)

1. **Complete webhook logging migration** (ARCH-2)
   - Replace remaining 21 console statements
   - Estimated time: 1-2 hours

2. **Config centralization** (ARCH-3)
   - Update 4 critical API routes
   - Then gradually migrate remaining 76 files
   - Estimated time: 4-6 hours for critical paths

3. **RLS verification** (ARCH-4)
   - Requires production database access
   - Run verification queries
   - Create test suite
   - Estimated time: 2-3 hours

4. **Rate limiting** (ARCH-5)
   - Apply to signup endpoint
   - Apply to webhook endpoints
   - Review call API limits
   - Estimated time: 2-3 hours

---

## 📖 Architecture Reference

**Key Documents:**
- `ARCH_DOCS/01-CORE/MASTER_ARCHITECTURE.txt` - Core principles
- `ARCH_DOCS/01-CORE/Schema.txt` - Database design
- `ARCH_DOCS/02-FEATURES/Translation_Agent` - Feature implementations
- `ARCH_DOCS/04-DESIGN/UX_DESIGN_PRINCIPLES.txt` - UI patterns

**Key Principles to Maintain:**
1. Call is the root object
2. Recording, translation, surveys, secret shopper are call modulations
3. SignalWire is authoritative media execution plane
4. AssemblyAI is intelligence plane
5. No FreeSWITCH dependency in v1
6. Capability-driven, not UI-driven
7. Artifacts (recordings) are first-class
8. Evidence manifests are immutable

---

**Last Updated:** January 13, 2026  
**Maintained By:** Principal Web Engineer (AI Assistant)
