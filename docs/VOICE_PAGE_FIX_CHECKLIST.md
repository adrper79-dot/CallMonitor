# Voice Operations Page Fix Checklist

## Date: 2026-01-15

## Environment: Production (wordis-bond.com)

## User: stepdadstrong@gmail.com

## Org ID: 143a4ad7-403c-4933-a0e6-553b05ca77a2

---

## Issues Identified

### 1. React Error #31 - Objects rendered as React children

**Cause**: API error responses returning `{id, code, message}` objects were being rendered directly in JSX instead of extracting the message string.

**Files Fixed**:

- `components/voice/BookingsList.tsx` - Added error object handling
- `components/voice/ShopperScriptManager.tsx` - Added error object handling (2 locations)
- `app/bookings/page.tsx` - Added error object handling

### 2. 401 Unauthorized Errors

**Cause**: User may not be properly set up as a member of the organization in `org_members` table.

**Solution**: Run diagnostic SQL script to verify and fix membership.

### 3. 500 Errors on APIs (campaigns, voice_targets, etc.)

**Cause**: Database tables may not exist yet, causing queries to fail.

**Files Fixed**:

- `app/api/campaigns/route.ts` - Already had table existence check
- `app/api/voice/targets/route.ts` - Added table existence check
- `app/api/audit-logs/route.ts` - Added table existence check
- `app/api/bookings/route.ts` - Added table existence check

### 4. Deprecated Meta Tag

**Cause**: `apple-mobile-web-app-capable` is deprecated.

**File Fixed**:

- `app/layout.tsx` - Changed to `mobile-web-app-capable`

---

## Code Changes Summary

### API Error Handling Pattern

All API routes now use this pattern for handling missing tables:

```typescript
const { data, error } = await supabaseAdmin.from('table_name').select('...')

// Handle missing table gracefully
if (error) {
  if (error.code === '42P01' || error.message?.includes('does not exist')) {
    logger.info('Table does not exist yet, returning empty array')
    return NextResponse.json({ success: true, items: [] })
  }
  // Log and return error for other cases
  logger.error('Query failed', error)
  return NextResponse.json({ success: false, error: ... }, { status: 500 })
}
```

### Client Error Handling Pattern

All client components now use this pattern for handling error objects:

```typescript
const errorMsg =
  typeof data.error === 'object' && data.error !== null
    ? data.error.message || data.error.code || JSON.stringify(data.error)
    : data.error || 'Default error message'
setError(errorMsg)
```

---

## Verification Steps

### Step 1: Run Diagnostic SQL Script

1. Open Supabase SQL Editor
2. Run `scripts/diagnose-voice-page.sql`
3. Check output for any `✗ MISSING` items
4. Run the FIX scripts if needed (uncomment them)

### Step 2: Verify API Endpoints

Run the test script or use these curl commands:

```bash
# Health check (no auth required)
curl -s https://wordis-bond.com/api/health

# Auth-required endpoints (need session cookie from browser)
# Get cookie from DevTools > Application > Cookies

export COOKIE="your-session-cookie-here"
export ORG_ID="143a4ad7-403c-4933-a0e6-553b05ca77a2"

# RBAC Context
curl -s "https://wordis-bond.com/api/rbac/context?orgId=$ORG_ID" \
  -H "Cookie: $COOKIE"

# Voice Config
curl -s "https://wordis-bond.com/api/voice/config?orgId=$ORG_ID" \
  -H "Cookie: $COOKIE"

# Voice Targets
curl -s "https://wordis-bond.com/api/voice/targets?orgId=$ORG_ID" \
  -H "Cookie: $COOKIE"

# Campaigns
curl -s "https://wordis-bond.com/api/campaigns?orgId=$ORG_ID" \
  -H "Cookie: $COOKIE"

# Call Capabilities
curl -s "https://wordis-bond.com/api/call-capabilities?orgId=$ORG_ID" \
  -H "Cookie: $COOKIE"
```

### Step 3: Browser Console Test

1. Open https://wordis-bond.com/voice in browser
2. Open DevTools (F12) > Console
3. Refresh page
4. Check for errors

**Expected Result**: No red errors. Yellow warnings for deprecations are acceptable.

---

## Acceptance Criteria

- [ ] No React errors in console
- [ ] All API calls return 200 (may return empty arrays if no data)
- [ ] Voice Operations page loads completely
- [ ] All UI components render (even if showing "No data" states)
- [ ] User can see the "Quick Dial" interface
- [ ] User can see the "Call Features" section

---

## Database Tables Required

The Voice Operations page requires these tables to exist:

| Table           | Status   | Notes                  |
| --------------- | -------- | ---------------------- |
| users           | Required | Core table             |
| organizations   | Required | Core table             |
| org_members     | Required | Links users to orgs    |
| calls           | Required | Call records           |
| recordings      | Optional | Recording artifacts    |
| voice_configs   | Required | Voice settings per org |
| voice_targets   | Optional | Saved dial targets     |
| campaigns       | Optional | Marketing campaigns    |
| booking_events  | Optional | Scheduled calls        |
| audit_logs      | Optional | Activity logs          |
| shopper_scripts | Optional | Secret shopper scripts |

**If tables are missing**: APIs return empty arrays instead of failing.

---

## Deployment

After making code changes:

1. Commit changes to git
2. Push to main branch
3. Vercel auto-deploys from main
4. Wait for deployment to complete (~2-3 minutes)
5. Run verification steps above

---

## Rollback Plan

If issues persist after deployment:

1. Check Vercel deployment logs for errors
2. Verify environment variables are set correctly
3. Check Supabase connection is working
4. Revert to previous deployment in Vercel dashboard if needed
