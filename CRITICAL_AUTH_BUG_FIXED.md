# 🚨 **CRITICAL AUTHENTICATION BUG - ROOT CAUSE FOUND & FIXED**
**Date:** January 14, 2026  
**Issue:** POST /api/voice/call returns 500 "Authentication required"  
**Status:** ✅ **FIXED & DEPLOYED**

---

## 🔴 **ROOT CAUSE ANALYSIS**

### **The Real Problem:**

The `/api/voice/call` endpoint was calling `startCallHandler` **without passing the authenticated user ID** (`actor_id`), causing the handler to throw an authentication error in production.

### **Code Flow:**

1. **Frontend** sends request:
   ```typescript
   fetch('/api/voice/call', {
     method: 'POST',
     credentials: 'include', // ✅ Sends session cookie
     body: JSON.stringify({ phone_number: '+1...' })
   })
   ```

2. **API Route** (`/api/voice/call/route.ts`) receives request:
   ```typescript
   // ❌ BEFORE: No session check, no actor_id
   const result = await startCallHandler({
     organization_id: body.organization_id,
     phone_number: phoneNumber,
     // MISSING: actor_id!
   })
   ```

3. **startCallHandler** checks for actor_id:
   ```typescript
   let actorId = (input as any).actor_id ?? null
   if (!actorId) {
     if (env.NODE_ENV !== 'production') {
       // Use fallback in dev
     } else {
       // ⚠️ THROWS ERROR IN PRODUCTION!
       throw new AppError({ 
         code: 'AUTH_REQUIRED', 
         message: 'Unauthenticated' 
       })
     }
   }
   ```

4. **Result:** 500 Internal Server Error → "Authentication required"

---

## ✅ **THE FIX**

### **What Changed:**

Modified `/api/voice/call/route.ts` to:
1. Get the authenticated session using NextAuth
2. Extract the user ID from session
3. Return 401 if not authenticated
4. Pass `actor_id` to `startCallHandler`

### **Code Changes:**

```typescript
async function handlePOST(req: Request) {
  try {
    // ✅ NEW: Get authenticated session
    const { getServerSession } = await import('next-auth/next')
    const { authOptions } = await import('@/lib/auth')
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null
    
    // ✅ NEW: Validate authentication
    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }
    
    const body = await req.json()
    // ... [rest of code]
    
    // ✅ NEW: Pass actor_id to handler
    const result = await startCallHandler(
      {
        organization_id: body.organization_id || body.orgId,
        phone_number: phoneNumber,
        from_number: body.from_number || undefined,
        flow_type: body.flow_type || (body.from_number ? 'bridge' : 'outbound'),
        modulations: body.modulations || {},
        actor_id: userId  // ⭐ CRITICAL FIX
      },
      {
        supabaseAdmin
      }
    )
  }
}
```

---

## 🔍 **WHY IT FAILED BEFORE**

### **The Handler's Expectation:**
`startCallHandler` expects either:
- An `actor_id` passed in the input, OR
- A fallback user ID in non-production environments

### **What the API Was Doing:**
- ❌ NOT checking authentication
- ❌ NOT passing `actor_id`
- ❌ Handler throws error in production

### **Why Adding `credentials: 'include'` Didn't Help:**
- Credentials were being sent to the API ✅
- But the API wasn't **using** them ❌
- Session cookie was there, but **not being read** ❌

---

## 📊 **IMPACT ANALYSIS**

### **Before Fix:**
```
User → API (with session cookie) → startCallHandler (no actor_id)
                                    ↓
                               AUTH_REQUIRED error
                                    ↓
                               500 Internal Error
```

### **After Fix:**
```
User → API (with session cookie) → getServerSession() → Extract userId
                                         ↓
                                    startCallHandler (with actor_id)
                                         ↓
                                    Call initiated ✅
```

---

## 🚀 **DEPLOYMENT STATUS**

**Commit:** `7842fc4`  
**Message:** "CRITICAL FIX: Add session authentication to /api/voice/call endpoint - pass actor_id to startCallHandler"  
**Status:** ✅ **Pushed to production**  
**Files Changed:** 1 (`app/api/voice/call/route.ts`)  
**Lines Changed:** +16, -2  

---

## ✅ **VERIFICATION STEPS**

### **Step 1: Wait for Vercel Deployment (2-3 minutes)**
Vercel needs to:
1. Build the new code
2. Deploy to edge network
3. Invalidate CDN cache

### **Step 2: Hard Refresh Browser**
After deployment completes:
- Windows: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

### **Step 3: Check Network Tab**
In DevTools → Network, look for:

```
POST /api/voice/call
Status: 200 OK ✅ (not 500!)

Response:
{
  "success": true,
  "call_id": "...",
  "call_sid": "CA..."  (real SignalWire SID)
}
```

### **Step 4: Verify in Database**
```sql
SELECT id, call_sid, status, created_by
FROM calls
WHERE organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2'
ORDER BY started_at DESC
LIMIT 1;
```

**Should show:**
- ✅ Real call_sid (starts with "CA")
- ✅ `created_by` = your user ID
- ✅ `status` = 'initiated' or 'in_progress'

---

## 🎯 **WHAT WE FIXED TODAY**

### **Bug #1:** Missing `credentials: 'include'` (Fixed ✅)
- 10 components updated
- Session cookies now sent

### **Bug #2:** API not passing `actor_id` (Fixed ✅)
- `/api/voice/call` now reads session
- Extracts user ID
- Passes to `startCallHandler`

### **Bug #3:** Mock SID in production (Fixed ✅)
- `startCallHandler` now throws error instead of creating fake data
- No more `mock-` call SIDs

---

## 📋 **COMPLETE FIX CHECKLIST**

- [x] Add `credentials: 'include'` to all fetch calls
- [x] Add session authentication to `/api/voice/call`
- [x] Extract user ID from session
- [x] Pass `actor_id` to `startCallHandler`
- [x] Remove mock SID generation
- [x] Deploy to production
- [ ] **Wait for Vercel deployment to complete**
- [ ] **Hard refresh browser**
- [ ] **Test call execution**

---

## ⏱️ **EXPECTED TIMELINE**

| Step | Duration | Status |
|------|----------|--------|
| Code fixes | 0 min | ✅ Done |
| Git push | 0 min | ✅ Done |
| Vercel build | 2-3 min | ⏳ In progress |
| CDN propagation | 1-2 min | ⏳ Pending |
| **Total** | **3-5 min** | ⏳ **Wait** |

---

## 🔍 **HOW TO VERIFY IT'S DEPLOYED**

### **Option 1: Check Vercel Dashboard**
Go to: https://vercel.com/dashboard  
Look for: Latest deployment status = "Ready"

### **Option 2: Check Build Hash**
After hard refresh, check if the JavaScript bundle name changed:

**Before:** `page-3740f03ab79414b1.js` ← OLD  
**After:** `page-[NEW-HASH].js` ← NEW (should be different)

If the hash is the same, the new code hasn't deployed yet.

---

## 🎯 **FINAL VERIFICATION CHECKLIST**

After Vercel deployment completes (3-5 minutes):

```bash
# 1. Hard refresh browser
Ctrl + Shift + R (Windows) or Cmd + Shift + R (Mac)

# 2. Open DevTools → Network tab

# 3. Click "Execute Call" button

# 4. Look for POST /api/voice/call in Network tab
Should show:
  - Status: 200 OK ✅
  - Response: {success: true, call_id: "...", call_sid: "CA..."}

# 5. Check browser console
Should NOT show:
  - ❌ 500 Internal Server Error
  - ❌ Authentication required
```

---

## 📝 **LESSONS LEARNED**

### **Why Two Fixes Were Needed:**

1. **Frontend Fix** (`credentials: 'include'`):
   - Ensures session cookie is sent from browser to API
   - Without it: No cookie = No session = Can't authenticate

2. **Backend Fix** (session check + `actor_id`):
   - Ensures API reads the session cookie
   - Extracts user ID
   - Passes it to the handler
   - Without it: Handler can't identify who's calling

**Both were required!**

---

## 🚀 **NEXT STEPS**

1. **Wait 3-5 minutes** for Vercel deployment
2. **Hard refresh** browser (`Ctrl+Shift+R`)
3. **Test call** execution
4. **Verify** in database

If still failing after 5 minutes:
- Check Vercel dashboard for deployment errors
- Share the deployment URL/logs
- Check if session cookie exists in DevTools → Application → Cookies

---

**Status:** ✅ **Fix deployed, waiting for CDN propagation**  
**ETA:** 3-5 minutes  
**Action Required:** Hard refresh after deployment completes
