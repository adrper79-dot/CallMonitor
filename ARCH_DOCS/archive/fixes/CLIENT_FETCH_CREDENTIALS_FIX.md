# Client-Side Fetch Credentials Fix - RESOLVED
**Date:** January 15, 2026  
**Issue:** 401 Unauthorized on ALL API calls after login  
**Status:** ✅ FIXED

---

## 🎯 Root Cause

All client-side `fetch()` calls were **missing `credentials: 'include'`**.

By default, browsers do **NOT** send cookies (including NextAuth session cookies) with fetch requests. This means:
- User logs in successfully (pages render with 200 OK)
- But ALL client-side API calls fail with 401 because the session cookie isn't sent

---

## 🔍 Symptoms

- Pages load correctly after login (200 OK)
- All API calls immediately fail with 401 Unauthorized
- Console shows: `GET https://domain.com/api/rbac/context 401 (Unauthorized)`
- Multiple "Fetch failed loading" errors in browser console
- React Error #31 (objects rendered as children - API error responses)

---

## ✅ Fix Applied

### Rule: ALL client-side fetch calls MUST include `credentials: 'include'`

### Wrong:
```typescript
const res = await fetch('/api/some-endpoint')
```

### Correct:
```typescript
const res = await fetch('/api/some-endpoint', {
  credentials: 'include'
})
```

### For POST/PUT/DELETE:
```typescript
const res = await fetch('/api/some-endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // ← CRITICAL!
  body: JSON.stringify(data)
})
```

---

## 📁 Files Fixed (13 total)

### New Files Created:
- **`lib/apiClient.ts`** - Centralized API client with credentials baked in

### Hooks Updated:
- **`hooks/useRBAC.ts`** - RBAC context fetching
- **`hooks/useRealtime.ts`** - Real-time subscription
- **`hooks/useCallDetails.ts`** - Call details fetching

### Components Updated:
- **`components/voice/CallList.tsx`** - Call polling
- **`components/voice/ActivityFeedEmbed.tsx`** - Audit logs
- **`components/voice/BookingsList.tsx`** - Bookings fetch
- **`components/voice/ShopperScriptManager.tsx`** - Scripts GET/DELETE
- **`components/team/TeamManagement.tsx`** - Member/invite DELETE
- **`components/BulkCallUpload.tsx`** - Template download

### Pages Updated:
- **`app/components/CallModulations.tsx`** - Capabilities fetch
- **`app/bookings/page.tsx`** - Cancel booking
- **`app/settings/page.tsx`** - Organization fetch

---

## 🛠️ API Client Utility

Created `lib/apiClient.ts` with pre-configured credentials:

```typescript
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/apiClient'

// GET request
const data = await apiGet('/api/some-endpoint')

// POST request
const result = await apiPost('/api/some-endpoint', { body: 'data' })

// PUT request
const updated = await apiPut('/api/some-endpoint', { changes: 'data' })

// DELETE request
const deleted = await apiDelete('/api/some-endpoint')
```

**Benefit:** No need to remember `credentials: 'include'` - it's automatic!

---

## 📋 Checklist for New Components

When creating new client-side components that call APIs:

- [ ] Use `credentials: 'include'` in ALL fetch calls
- [ ] OR use the `apiClient` utility functions
- [ ] Test with authenticated session
- [ ] Verify no 401 errors in browser console

---

## 🔒 Why This Matters

NextAuth.js uses HTTP-only cookies for session management:
- `next-auth.session-token` (or `__Secure-next-auth.session-token` in production)
- Cookies are **only sent** when `credentials: 'include'` is set

Without credentials, the server sees an anonymous request → 401 Unauthorized.

---

## 🧪 How to Test

1. Log in to the application
2. Open browser DevTools → Network tab
3. Navigate to a page that makes API calls
4. Check that:
   - All API requests include the session cookie
   - Responses return 200 OK (not 401)

---

## 📊 Before vs After

### Before (Broken):
```
Pages: 200 OK ✅
API calls: 401 Unauthorized ❌
User experience: Blank data, error states
```

### After (Fixed):
```
Pages: 200 OK ✅
API calls: 200 OK ✅
User experience: Data loads correctly
```

---

**Issue Status:** ✅ RESOLVED  
**Files Fixed:** 13  
**Commit:** `4d58e60 - Fix 401 errors: Add credentials include to all client-side fetch calls`
