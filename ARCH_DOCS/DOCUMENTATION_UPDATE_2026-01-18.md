# Documentation Update Summary

**Date:** January 18, 2026  
**Commit:** 37c84aa  
**Focus:** API Routes Repair & RBAC Architecture Fix

## Overview

Critical fixes to API routes based on ARCH_DOCS compliance review. This update resolves 404 errors for missing endpoints and 500 errors caused by incorrect auth system usage and wrong database table queries.

---

## Root Cause Analysis

### Issues Identified

1. **Missing API Routes (404 errors)**
   - `/api/organizations/current` - Not implemented
   - `/api/billing/invoices` - Not implemented
   - `/api/billing/payment-methods` - Not implemented

2. **Wrong Auth System (500 errors)**
   - `lib/rbac.ts requireRole()` was using Supabase Auth session
   - The application uses **NextAuth**, not Supabase Auth
   - Session was always null → 401/500 errors in protected routes

3. **Wrong Table Queries (500 errors)**
   - `getUserOrg()` queried `users.organization_id` column
   - Per Schema.txt, `org_members` is the source of truth for user-org relationships
   - `getPlanLimits()` queried by `plan` name instead of `organization_id`
   - `usage_limits` table is keyed by organization, not plan

4. **Client/Server Bundle Mixing (Build errors)**
   - `components/voice/CallModulations.tsx` imports from `lib/rbac.ts`
   - `lib/rbac.ts` had `requireRole` with server-only dependencies (next-auth, nodemailer)
   - Webpack bundled server dependencies into client bundle → build failure

---

## Fixes Applied

### New API Routes Created

| Route | Purpose | RBAC |
|-------|---------|------|
| `/api/organizations/current` | Get current user's organization with subscription | All roles |
| `/api/billing/invoices` | Get paginated invoice history | Owner, Admin |
| `/api/billing/payment-methods` | Get payment methods (masked) | Owner, Admin |

### RBAC Architecture Refactored

**Before (problematic):**
```
lib/rbac.ts
├── Types (Plan, UserRole) - client-safe ✅
├── planSupportsFeature() - client-safe ✅
├── canAccessFeature() - client-safe ✅
└── requireRole() - SERVER ONLY ❌ (caused bundling issues)
```

**After (fixed):**
```
lib/rbac.ts (client-safe)
├── Types (Plan, UserRole)
├── planSupportsFeature()
└── canAccessFeature()

lib/rbac-server.ts (server-only) ⭐ NEW
└── requireRole()
    ├── Uses NextAuth getServerSession()
    ├── Queries org_members table for role
    └── Returns RBACSession type
```

### Database Query Fixes

**lib/api/utils.ts - getUserOrg()**
```diff
- const { data } = await supabaseAdmin
-   .from('users')
-   .select('organization_id')
-   .eq('id', userId)
+ const { data } = await supabaseAdmin
+   .from('org_members')
+   .select('organization_id')
+   .eq('user_id', userId)
```

**lib/services/usageTracker.ts - getPlanLimits()**
```diff
- export async function getPlanLimits(plan: string)
+ export async function getPlanLimits(organizationId: string)

- .from('usage_limits')
- .eq('plan', plan)
+ .from('usage_limits')
+ .eq('organization_id', organizationId)
```

### API Route Import Updates

Updated 15 API routes to import `requireRole` from `@/lib/rbac-server`:
- `/api/billing/checkout`
- `/api/billing/portal`
- `/api/billing/subscription`
- `/api/billing/cancel`
- `/api/ai-config`
- `/api/campaigns/[id]`
- `/api/campaigns/[id]/execute`
- `/api/campaigns/[id]/stats`
- `/api/reports`
- `/api/reports/schedules`
- `/api/reports/schedules/[id]`
- `/api/webhooks`
- `/api/webhooks/[id]`
- `/api/webhooks/[id]/test`
- `/api/voice/config/test`

---

## Files Changed

### New Files
| File | Lines | Purpose |
|------|-------|---------|
| `app/api/organizations/current/route.ts` | 100 | Get current organization |
| `app/api/billing/invoices/route.ts` | 100 | Invoice history with pagination |
| `app/api/billing/payment-methods/route.ts` | 115 | Payment methods (owner/admin) |
| `lib/rbac-server.ts` | 84 | Server-only RBAC functions |

### Modified Files
| File | Changes |
|------|---------|
| `lib/rbac.ts` | Removed `requireRole` (moved to rbac-server.ts) |
| `lib/api/utils.ts` | Fixed `getUserOrg()` to query `org_members` |
| `lib/services/usageTracker.ts` | Fixed `getPlanLimits()` to use `organizationId` |
| `app/api/usage/route.ts` | Pass `orgId` to `getPlanLimits()` |
| 15 API routes | Import `requireRole` from `@/lib/rbac-server` |

---

## Documentation Updated

### ARCH_DOCS/05-REFERENCE/API_ENDPOINTS.md
- Added `GET /api/billing/invoices` endpoint documentation
- Added `GET /api/billing/payment-methods` endpoint documentation
- Added `GET /api/organizations/current` endpoint documentation
- Added new "Organizations" section

### ARCH_DOCS/CURRENT_STATUS.md
- Updated version to 3.1
- Updated last modified date to January 18, 2026
- Added billing/invoices and billing/payment-methods routes
- Added organizations/current route
- Updated route counts (5 → 8 billing routes)

---

## RBAC Implementation Guide

### For API Routes (Server-Side)

**Option 1: Use rbac-server.ts (throws on error)**
```typescript
import { requireRole } from '@/lib/rbac-server'

export async function GET(req: NextRequest) {
  try {
    const session = await requireRole(['owner', 'admin'])
    const { id: userId, organizationId, role } = session.user
    // ... your logic
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
}
```

**Option 2: Use lib/api/utils.ts (returns NextResponse on error)**
```typescript
import { requireRole, success, Errors } from '@/lib/api/utils'

export async function GET(req: NextRequest) {
  const ctx = await requireRole(['owner', 'admin'])
  if (ctx instanceof NextResponse) return ctx
  
  const { userId, orgId, role } = ctx
  // ... your logic
}
```

### For Client Components
```typescript
// lib/rbac.ts is client-safe - use for feature checks
import { planSupportsFeature, canAccessFeature } from '@/lib/rbac'

// Check if plan supports a feature
if (planSupportsFeature('pro', 'translation')) {
  // Show translation UI
}
```

---

## Verification

### Build Status
```
✅ npm run build - Exit code 0
✅ 25 static pages generated
✅ 100+ API routes compiled
✅ No TypeScript errors
```

### Routes Verified
- ✅ `/api/organizations/current` - Returns organization with subscription
- ✅ `/api/billing/invoices` - Returns paginated invoice list
- ✅ `/api/billing/payment-methods` - Returns masked payment methods
- ✅ All existing routes continue to work

---

## Key Takeaways

1. **org_members is the source of truth** for user-organization relationships, not the `users` table
2. **NextAuth is the auth system**, not Supabase Auth - always use `getServerSession(authOptions)`
3. **usage_limits is per-organization**, not per-plan - query by `organization_id`
4. **Separate server-only code** from client-importable modules to avoid bundling issues
5. **Two RBAC patterns exist**:
   - `lib/rbac-server.ts` - Throws AppError (newer pattern)
   - `lib/api/utils.ts` - Returns NextResponse (older pattern, still works)
