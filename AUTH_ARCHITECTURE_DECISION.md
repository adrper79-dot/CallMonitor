# Critical Architecture Issue: NextAuth in Hybrid Deployment

**Date**: Feb 2, 2026  
**Status**: ❌ **BLOCKER** - Authentication non-functional in production

---

## Problem Statement

NextAuth.js is **incompatible with static-only Pages deployment** because it requires:
- API routes (`app/api/auth/*`) that execute server-side code
- Session management with server-side cookie handling
- OAuth callback endpoints
- CSRF token generation

**Current State:**
- ✅ UI deployed to Pages (static)
- ✅ Workers API operational
- ❌ Auth broken: All `/api/auth/*` endpoints return 404/405
- ❌ Users cannot sign in, sign up, or maintain sessions

**Error Evidence:**
```
GET /api/auth/session → 404 (Not Found)
POST /api/auth/signup → 405 (Method Not Allowed)
POST /api/auth/signin → 405 (Method Not Allowed)
GET /api/auth/providers → 404 (Not Found)
```

---

## Root Cause Analysis

### NextAuth Architecture Mismatch

NextAuth was designed for:
- ✅ Next.js with API routes (`pages/api/` or `app/api/`)
- ✅ Server-side rendering (SSR)
- ✅ Server components with `getServerSession()`

Our hybrid architecture:
- ❌ Static-only Pages (no API routes)
- ❌ No SSR capability
- ❌ Client-side only (`useSession()`)

### Why This Happened

When we moved to static export (`output: 'export'`), we:
1. Removed ALL `app/api/` routes (moved to `app/_api_to_migrate/`)
2. Converted server pages to client-side
3. But **forgot NextAuth requires API routes to function**

---

## Solution Options

### Option 1: Migrate NextAuth to Workers ⚠️ (Complex)

**Approach:** Recreate NextAuth API routes in Workers

**Required Work:**
- [ ] Port `app/_api_to_migrate/auth/[...nextauth]/route.ts` to Hono
- [ ] Implement OAuth flows (Google, GitHub) in Workers
- [ ] Set up session storage in KV
- [ ] Handle CSRF protection
- [ ] Implement callbacks, signin, signup, session endpoints
- [ ] Test OAuth redirect flows

**Complexity:** HIGH (3-5 days)
**Benefit:** Keep NextAuth, full OAuth support

### Option 2: Switch to Clerk/Auth0 ✅ (Recommended)

**Approach:** Use SaaS auth provider with client-side SDK

**Services:**
- **Clerk**: React SDK, handles everything client-side
- **Auth0**: Similar, mature
- **Supabase Auth**: If we use Supabase features

**Required Work:**
- [ ] Sign up for Clerk/Auth0
- [ ] Replace `next-auth` with Clerk SDK
- [ ] Update `useSession()` calls to Clerk equivalents
- [ ] Configure OAuth providers in Clerk dashboard
- [ ] Update RBAC checks to use Clerk roles

**Complexity:** LOW (1-2 days)
**Benefit:** 
- ✅ Works with static Pages
- ✅ No server-side auth needed
- ✅ Full OAuth support
- ✅ Session management handled
- ✅ Edge-compatible

### Option 3: Custom JWT Auth in Workers (Minimal)

**Approach:** Build minimal email/password auth

**Required Work:**
- [ ] Create `/api/auth/signup` in Workers (email + password)
- [ ] Create `/api/auth/signin` in Workers (issue JWT)
- [ ] Create `/api/auth/session` in Workers (validate JWT)
- [ ] Implement password hashing (bcrypt)
- [ ] Store sessions in KV
- [ ] Update client to use custom auth hooks

**Complexity:** MEDIUM (2-3 days)
**Benefit:**
- ✅ Full control
- ✅ No external dependencies
- ❌ No OAuth (unless we build it)
- ❌ More security responsibility

### Option 4: Revert to SSR ❌ (Not Recommended)

**Approach:** Go back to @cloudflare/next-on-pages

**Why Not:**
- Conflicts with ARCH_DOCS design
- Version-locked to Vercel tools
- More complex deployment
- Already committed to hybrid architecture

---

## Recommendation: Option 2 (Clerk)

**Rationale:**
1. **Time to production**: Fastest path (1-2 days)
2. **Maintenance**: Zero auth maintenance burden
3. **Features**: Full OAuth, MFA, user management UI
4. **Architecture fit**: Perfect for client-side static apps
5. **Security**: Battle-tested, compliant (SOC2, GDPR)
6. **Developer experience**: Excellent React SDK

**Clerk Pricing:**
- Free tier: 10,000 MAU (monthly active users)
- Pro: $25/mo + $0.02/MAU
- Enterprise: Custom

**Implementation Plan:**

1. **Setup (30 min):**
   ```bash
   npm install @clerk/nextjs
   ```

2. **Configure (30 min):**
   ```typescript
   // app/layout.tsx
   import { ClerkProvider } from '@clerk/nextjs'
   
   export default function RootLayout({ children }) {
     return (
       <ClerkProvider>
         {children}
       </ClerkProvider>
     )
   }
   ```

3. **Replace Auth Hooks (2-3 hours):**
   ```typescript
   // Before (NextAuth)
   import { useSession } from 'next-auth/react'
   const { data: session } = useSession()
   
   // After (Clerk)
   import { useUser } from '@clerk/nextjs'
   const { user, isLoaded } = useUser()
   ```

4. **Update Protected Routes (1 hour):**
   ```typescript
   import { auth } from '@clerk/nextjs'
   ```

5. **Configure OAuth (30 min):**
   - Clerk dashboard → Configure Google/GitHub OAuth
   - Copy client IDs/secrets

6. **Test (1-2 hours):**
   - Sign up flow
   - Sign in flow
   - OAuth flows
   - Session persistence
   - RBAC checks

**Total Time:** 1-2 days

---

## Alternative: Quick Fix for Testing

If you want to **test the site now** without full auth:

1. **Mock the session:**
   ```typescript
   // lib/mockSession.ts
   export const useMockSession = () => ({
     data: {
       user: {
         id: '123',
         email: 'test@example.com',
         name: 'Test User',
         organizationId: 'org-123'
       }
     },
     status: 'authenticated'
   })
   ```

2. **Use in pages:**
   ```typescript
   // import { useSession } from 'next-auth/react'
   import { useMockSession as useSession } from '@/lib/mockSession'
   ```

3. **Result:** UI works, but no real auth (dev only)

---

## Decision Needed

**Question for stakeholder:** Which option?

1. ✅ **Clerk** (recommended) - 1-2 days, $0-25/mo
2. ⚠️ **Custom JWT** - 2-3 days, full control, no OAuth
3. ⚠️ **Port NextAuth** - 3-5 days, complex
4. 🧪 **Mock Session** - 1 hour, testing only

**My vote:** Option 1 (Clerk). It's the right tool for hybrid architecture.

---

## Next Steps

Once auth decision is made:
1. Update this document with chosen approach
2. Create implementation checklist
3. Execute migration
4. Update ARCH_DOCS with new auth flow
5. Redeploy and test

---

## Related Documents

- [CLOUDFLARE_DEPLOYMENT.md](ARCH_DOCS/CLOUDFLARE_DEPLOYMENT.md) - Deployment architecture
- [API_MIGRATION_GUIDE.md](API_MIGRATION_GUIDE.md) - API migration strategy
- [ROADMAP.md](ROADMAP.md) - Development roadmap
