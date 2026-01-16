# Error Check Guide

## Quick Diagnostics

### 1. Check Browser Console (F12)

**Open**: https://voxsouth.online/voice
**DevTools**: Press F12 → Console tab

Look for:
- ❌ Red error messages
- ⚠️ Yellow warnings
- Failed network requests (Network tab)

### 2. Check Network Tab

**Filter by**: XHR/Fetch
**Look for failed requests** (status 400, 500):
- `/api/calls/start` - When clicking "Make Call" button
- `/api/bookings` - When scheduling calls
- `/api/voice/config` - Configuration loading
- `/api/voice/targets` - Target phone numbers

### 3. Common Issues & Solutions

#### Issue: "Could not send call with button"

**Possible causes**:
1. No target phone number selected
2. SignalWire API credentials missing
3. Missing required fields (from_number, etc.)

**Check in console**:
```javascript
// Look for error message in toast/alert
// Or check Network tab for /api/calls/start response
```

**API Response should be**:
```json
{
  "success": true,
  "callId": "uuid-here"
}
```

**If error**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Description"
  }
}
```

#### Issue: "Scheduled call didn't ring"

**Possible causes**:
1. Cron job not running (check Vercel dashboard)
2. Booking not created properly
3. Phone number invalid
4. SignalWire API issue

**Check**:
1. Vercel Dashboard → Cron Jobs → Check execution logs
2. Database: Query `bookings` table for your entry
3. Check `booking_status` field

### 4. Manual API Tests

**Test call creation** (replace YOUR_TOKEN):
```bash
curl -X POST 'https://voxsouth.online/api/calls/start' \
  -H 'Cookie: next-auth.session-token=YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "phone_number": "+12392027345",
    "organization_id": "143a4ad7-403c-4933-a0e6-553b05ca77a2"
  }'
```

**Test bookings**:
```bash
curl 'https://voxsouth.online/api/bookings?orgId=143a4ad7-403c-4933-a0e6-553b05ca77a2' \
  -H 'Cookie: next-auth.session-token=YOUR_TOKEN'
```

### 5. Quick Vercel Log Check

**Via Dashboard**:
1. Go to: https://vercel.com/dashboard
2. Click your project (Word Is Bond)
3. Click "Logs" tab
4. Filter by last 10 minutes
5. Look for POST /api/calls/start or errors

**Via CLI** (if working):
```bash
vercel logs --since 10m | grep -i error
```

### 6. Environment Variables Check

**Required for calls**:
- `SIGNALWIRE_PROJECT_ID`
- `SIGNALWIRE_API_TOKEN`
- `SIGNALWIRE_SPACE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

**Check**: Vercel Dashboard → Settings → Environment Variables

### 7. Database Quick Check

If you have `psql` access:
```sql
-- Check recent bookings
SELECT * FROM bookings 
WHERE organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2'
ORDER BY scheduled_for DESC 
LIMIT 5;

-- Check voice config
SELECT * FROM voice_configs
WHERE organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2';

-- Check recent calls
SELECT id, call_sid, status, phone_to, created_at
FROM calls
WHERE organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2'
ORDER BY created_at DESC
LIMIT 5;
```

---

## What to Report

When you find errors, capture:
1. **Exact error message** from console
2. **HTTP status code** from Network tab
3. **Request URL** that failed
4. **Request payload** (if POST/PUT)
5. **Response body**

Example:
```
Error: POST /api/calls/start returned 500
Response: {
  "success": false,
  "error": {
    "code": "SIGNALWIRE_API_ERROR",
    "message": "Invalid credentials"
  }
}
```
