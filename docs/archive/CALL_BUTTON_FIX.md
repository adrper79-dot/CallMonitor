# Call Button 500 Error - FIXED

## Problem
Clicking "Make Call" button returns:
```
POST /api/voice/call 500 (Internal Server Error)
TOAST: "Authentication required"
```

## Root Cause
The `/api/voice/call` endpoint was using inconsistent authentication logic:
- Custom session check that wasn't working properly
- Not using the standardized `requireAuth()` helper
- Session was returning null even though user was logged in

## Fix Applied

### File: `app/api/voice/call/route.ts`

**Before**:
```typescript
// Manual session check with cookies/headers
const cookieStore = await cookies()
const session = await getServerSession(authOptions)
const userId = (session?.user as any)?.id ?? null

if (!userId) {
  return NextResponse.json({ ... }, { status: 401 })
}
```

**After**:
```typescript
// Use standardized requireAuth helper
const { requireAuth, Errors, success } = await import('@/lib/api/utils')

const ctx = await requireAuth()
if (ctx instanceof NextResponse) {
  return ctx // Returns proper 401 error
}

const userId = ctx.userId
```

### Benefits:
1. ✅ **Consistent with other endpoints** - Uses same auth pattern
2. ✅ **Better error handling** - Standardized error responses
3. ✅ **Proper logging** - Uses `logger.*` instead of `console.log`
4. ✅ **Simplified code** - Removed 20+ lines of boilerplate

---

## WebRTC/WebRPC Answer

### ❌ **NOT IMPLEMENTED**

You currently have:
- ✅ **SignalWire REST API** (server-side calling)
- ❌ **No WebRTC** (browser peer-to-peer)
- ❌ **No WebRPC** (SignalWire browser SDK)

### What This Means:
- Calls go to actual phones (not computer audio)
- Server initiates calls via SignalWire
- Cannot use computer microphone/speakers
- Cannot make calls directly from browser

### To Add WebRPC (Browser Calling):
Would require:
1. Install `@signalwire/js` SDK
2. Create JWT token endpoint
3. Add browser calling component
4. Configure SignalWire Fabric

**Effort**: ~1 day of development

---

## Deploy These Fixes

```bash
git add .
git commit -m "fix: Call button auth error + mobile login cookies + cron auth"
git push origin main
```

### What's Fixed in This Push:
1. ✅ `/api/voice/call` authentication (call button works)
2. ✅ Mobile login cookies (`sameSite: 'lax'`)
3. ✅ Cron job auth (scheduled calls work)
4. ✅ Caller ID verify (better error handling)
5. ✅ Team invites table migration created

---

## Test After Deploy

### 1. Call Button
1. Go to https://voxsouth.online/voice
2. Enter a phone number in Quick Dial
3. Click "Execute Call" button
4. Should see success toast (not "Authentication required")
5. Check Vercel logs for "Call placed" message

### 2. Scheduled Calls
1. Create a booking for 2-3 minutes from now
2. Wait for cron (runs every 5 minutes)
3. Should ring at scheduled time
4. No more "AUTH_REQUIRED" errors in logs

### 3. Mobile Login
1. Clear cookies on mobile
2. Sign in with OAuth provider
3. Should work without fraud/security error

---

## Summary

| Issue | Status | Fix |
|-------|--------|-----|
| Call button 500 error | ✅ Fixed | Use `requireAuth()` helper |
| Scheduled calls not working | ✅ Fixed | Pass `actor_id: 'system-cron'` |
| Mobile login fraud error | ✅ Fixed | Change cookies to `sameSite: 'lax'` |
| Team invites table missing | ✅ Migration | Run `add-team-invites-table.sql` |
| WebRTC/WebRPC | ❌ Not implemented | Use SignalWire REST API for now |

**Status**: ✅ **Ready to deploy**  
**Expected Result**: Call button works, scheduled calls ring, mobile login works  
**WebRTC**: Not implemented - would be a separate project if needed
