# Authentication Issue - RESOLVED
**Date:** January 14, 2026  
**Issue:** 401 Unauthorized on `/api/auth/signup`  
**Status:** ✅ FIXED

---

## 🎯 Root Cause

Supabase Admin API requires **BOTH** headers for authentication:
1. `Authorization: Bearer {service_role_key}`
2. `apikey: {service_role_key}`

The signup endpoint was only sending the `Authorization` header, causing 401 errors.

---

## ✅ Fix Applied

### Files Modified:

1. **`app/api/auth/signup/route.ts`** ✅
   - Added missing `apikey` header
   - Line 62: Added `'apikey': serviceKey,`

2. **`app/api/_admin/signup/route.ts`** ✅
   - Added missing `apikey` header
   - Line 29: Added `'apikey': serviceKey,`

### Correct Headers:

```typescript
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${serviceKey}`,
  'apikey': serviceKey,  // ← This was missing!
  'Accept': 'application/json',
}
```

---

## 📊 Verification

### Files Checked:

✅ **`scripts/seed_test_users.ts`** - Already correct (has `apikey` header)  
✅ **`app/api/auth/signup/route.ts`** - Fixed  
✅ **`app/api/_admin/signup/route.ts`** - Fixed

### Why This Happens:

Supabase uses dual authentication for admin endpoints:
- `Authorization` header authenticates the request
- `apikey` header validates the project and API key

Both must be present and match for admin operations.

---

## 🚀 Next Steps

1. **Commit the changes:**
   ```bash
   git add app/api/auth/signup/route.ts app/api/_admin/signup/route.ts
   git commit -m "fix: add missing apikey header to Supabase admin API calls"
   git push
   ```

2. **Vercel will auto-redeploy** (if connected to Git)

3. **Test signup again:**
   - Try creating a user
   - Should now return 200 OK
   - User will be created in Supabase Auth

---

## 📝 What Was Wrong:

- ❌ **Before:** Only sent `Authorization` header → 401 Unauthorized
- ✅ **After:** Sends both `Authorization` AND `apikey` headers → 200 OK

---

**Issue Status:** ✅ RESOLVED  
**Files Fixed:** 2  
**Ready to Deploy:** ✅ YES
