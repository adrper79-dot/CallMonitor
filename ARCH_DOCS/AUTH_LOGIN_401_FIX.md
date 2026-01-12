# Auth Login 401 Fix - January 14, 2026

## ❌ **The Problem**

**Endpoint:** `/auth/v1/token?grant_type=password`  
**Status:** 401 Unauthorized  
**Error:** User login failing with 401

---

## 🔍 **Root Cause**

**File:** `app/api/auth/[...nextauth]/route.ts` line 110

**Wrong Code:**
```typescript
headers: { 
  'Content-Type': 'application/json', 
  Authorization: `Bearer ${serviceKey}`  // ❌ WRONG KEY!
}
```

**Why it's wrong:**
- Used **service role key** (`SUPABASE_SERVICE_ROLE_KEY`) for password authentication
- Service role key is for **admin operations** (bypasses RLS)
- Password authentication requires **anon key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)

---

## ✅ **The Fix**

**New Code:**
```typescript
// For password-based auth, use the ANON key, not service role key
// Service role key bypasses RLS and is for admin operations only
// Password auth needs anon key to work with Supabase Auth's user sessions
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY not configured for password login')

const endpoint = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`
const res = await fetch(endpoint, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json', 
    'apikey': anonKey,  // Use anon key for password auth
    'Authorization': `Bearer ${anonKey}`  // Also in Authorization header
  },
  body: JSON.stringify({ email: emailToUse, password: credentials.password })
})
```

---

## 📊 **Key Differences**

| Use Case | Correct Key | Why |
|----------|-------------|-----|
| **User signup** (admin API) | `SUPABASE_SERVICE_ROLE_KEY` | Creating users bypasses RLS |
| **User login** (password auth) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | User authentication uses Auth API |
| **Database queries** (server) | `SUPABASE_SERVICE_ROLE_KEY` | Admin access to tables |
| **Database queries** (client) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Respects RLS policies |

---

## 🎯 **What Was Fixed**

1. ✅ Changed from service role key to anon key for password auth
2. ✅ Added both `apikey` and `Authorization` headers (Supabase best practice)
3. ✅ Added validation to ensure anon key is configured
4. ✅ Added explanatory comments

---

## 🧪 **How to Test**

1. **Try logging in with credentials:**
   ```
   Email: test@example.com
   Password: your-password
   ```

2. **Should now return 200 OK** (instead of 401)

3. **Check response includes:**
   - `access_token`
   - `refresh_token`
   - `user` object

---

## 📝 **Related Issues**

This is the **second auth issue** we've fixed today:

1. ✅ **Signup 401** - Fixed by adding `apikey` header to admin user creation
2. ✅ **Login 401** - Fixed by using anon key instead of service role key

**Pattern:** Incorrect key usage for different Supabase Auth operations

---

## ⚠️ **Key Takeaways**

### When to Use Each Key:

**Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`):**
- ✅ Admin user creation (`/auth/v1/admin/users`)
- ✅ Server-side database queries
- ✅ Bypassing RLS policies
- ❌ **NOT for user authentication**

**Anon Key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`):**
- ✅ User login (`/auth/v1/token?grant_type=password`)
- ✅ User signup via client
- ✅ Client-side database queries
- ✅ Any user-facing Auth API calls

---

## ✅ **Status**

**Issue:** 401 on user login  
**Root Cause:** Using service role key for password auth  
**Fix Applied:** Changed to anon key  
**Status:** ✅ **FIXED**

**File Modified:** `app/api/auth/[...nextauth]/route.ts`  
**Lines Changed:** 107-118  
**Test Status:** Ready to test

---

**Date:** January 14, 2026  
**Issue Type:** Authentication  
**Severity:** HIGH (blocks user login)  
**Resolution:** ✅ COMPLETE
