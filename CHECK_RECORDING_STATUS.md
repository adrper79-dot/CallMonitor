# Recording Status Check

**Date:** January 12, 2026  
**Issue:** Single-leg call worked, no timeout, but no recording in DB

---

## ✅ **GOOD NEWS**

Call worked and didn't time out! That means:
- ✅ REST API call successful
- ✅ LaML `<Pause>` keeping call alive
- ✅ Call completed normally

---

## 🔍 **CHECKING RECORDING FLOW**

The recording should happen via these steps:

### **Step 1: REST API Records Call**
```typescript
// In startCallHandler.ts lines 153-156
if (!conference) {
  params.append('Record', 'true')  // ← This tells SignalWire to record
  params.append('RecordingStatusCallback', '${APP_URL}/api/webhooks/signalwire')
  params.append('RecordingStatusCallbackEvent', 'completed')
}
```

**What to check:**
- Is `conference` undefined for single-leg calls? (Should be YES)
- Are these params actually being sent to SignalWire?

---

### **Step 2: SignalWire Records Call**
SignalWire should:
1. Receive `Record=true` parameter
2. Automatically record the call
3. When call ends, POST webhook to `/api/webhooks/signalwire`

**Webhook payload includes:**
- `RecordingSid`: Unique ID for recording
- `RecordingUrl`: URL to download recording
- `RecordingDuration`: Length in seconds

---

### **Step 3: Webhook Creates Database Entry**
```typescript
// In app/api/webhooks/signalwire/route.ts lines 240-363
if (recordingSid && recordingUrl) {
  // Create recording in database
  await supabaseAdmin.from('recordings').insert({
    id: recordingId,
    recording_sid: recordingSid,
    recording_url: recordingUrl,
    duration_seconds: durationSeconds,
    status: 'completed'
  })
}
```

---

## 🧪 **DIAGNOSTIC QUERIES**

### **Check Calls Table:**
```sql
SELECT 
  id, 
  status, 
  call_sid,
  started_at,
  ended_at,
  EXTRACT(EPOCH FROM (ended_at - started_at)) as duration_seconds,
  created_at
FROM calls 
WHERE created_at > NOW() - INTERVAL '30 minutes' 
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** Should see your recent call with status='completed'

---

### **Check Recordings Table:**
```sql
SELECT 
  r.id,
  r.call_sid,
  r.recording_sid,
  r.recording_url,
  r.duration_seconds,
  r.status,
  r.created_at,
  c.id as call_id
FROM recordings r
LEFT JOIN calls c ON c.call_sid = r.call_sid
WHERE r.created_at > NOW() - INTERVAL '30 minutes'
ORDER BY r.created_at DESC
LIMIT 5;
```

**Expected:** Should see recording entry  
**If empty:** Recording webhook didn't fire or failed

---

### **Check Audit Logs:**
```sql
SELECT 
  resource_type,
  resource_id,
  action,
  after,
  created_at
FROM audit_logs
WHERE resource_type IN ('recordings', 'calls')
AND created_at > NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC
LIMIT 20;
```

**Look for:**
- `resource_type='recordings'` with `action='create'`
- Any errors related to recording

---

## 🔍 **POSSIBLE CAUSES**

### **Cause #1: Record Parameter Not Sent**
**Check:** Add logging before SignalWire API call

**Fix:** Add this after line 156 in startCallHandler.ts:
```typescript
console.log('placeSignalWireCall: REST API params', {
  Record: params.get('Record'),
  RecordingStatusCallback: params.get('RecordingStatusCallback'),
  allParams: Array.from(params.entries())
})
```

---

### **Cause #2: SignalWire Not Recording**
**Check:** SignalWire Dashboard
1. Go to https://your-space.signalwire.com/
2. Click "Calls" → Recent calls
3. Find your call
4. Check if "Recording" section exists
5. Look for recording URL

**If no recording in SignalWire:** 
- Record parameter not being sent
- OR SignalWire account doesn't support recording

---

### **Cause #3: Webhook Not Firing**
**Check:** Vercel logs for webhook calls

**Look for:**
```
POST /api/webhooks/signalwire
signalwire webhook processing { callSid: '[REDACTED]', callStatus: 'completed', hasRecording: true }
```

**If no webhook logs:** SignalWire webhook not configured correctly

---

### **Cause #4: Webhook Receiving But Not Creating Record**
**Check:** Webhook logs for errors

**Look for:**
```
signalwire webhook: failed to create recording { error: '...', callId }
```

**Common errors:**
- `recording_sid` already exists (duplicate)
- `tool_id` missing (organization has no tool)
- RLS policy blocking insert

---

## 🔧 **IMMEDIATE DIAGNOSTIC STEPS**

### **Step 1: Check SignalWire Dashboard (5 minutes)**
1. Login to SignalWire
2. Go to recent calls
3. Find your test call
4. Screenshot the call details (especially Recording section)

**Questions:**
- Does Recording section exist?
- What's the recording URL?
- What's the RecordingSid?

---

### **Step 2: Add More Logging (10 minutes)**

**In startCallHandler.ts, after line 156:**
```typescript
// Add this logging
const paramsObj = Object.fromEntries(params.entries())
console.log('placeSignalWireCall: FULL REST API REQUEST', {
  endpoint: swEndpoint,
  params: paramsObj,
  hasRecordParam: params.has('Record'),
  recordValue: params.get('Record')
})
```

**Deploy and test again**

---

### **Step 3: Check Webhook Payload**

**In app/api/webhooks/signalwire/route.ts, add at line 100:**
```typescript
// Log FULL webhook payload (temporarily)
console.log('signalwire webhook: RAW PAYLOAD', {
  callSid,
  callStatus,
  recordingSid: recordingSid || 'MISSING',
  recordingUrl: recordingUrl || 'MISSING',
  recordingDuration: recordingDuration || 'MISSING',
  fullPayload: JSON.stringify(payload).substring(0, 500)
})
```

**Deploy and test again**

---

## 🎯 **QUICK WIN: Test Without My Changes**

To isolate the issue, test if SignalWire recording works at all:

**Option A: Add Record to injected test**
If you have a test script that calls SignalWire directly:
```javascript
// In scripts/make-test-call.js or similar
const params = new URLSearchParams()
params.append('From', '+1234567890')
params.append('To', '+17062677235')
params.append('Url', 'http://demo.twilio.com/docs/voice.xml')  // Test URL
params.append('Record', 'true')  // Add this
params.append('RecordingStatusCallback', 'https://webhook.site/your-unique-url')  // Use webhook.site for testing

// POST to SignalWire
```

**If this works:** Issue is in our code  
**If this fails:** SignalWire account or config issue

---

### **Option B: Use SignalWire Dashboard**
1. Go to SignalWire Dashboard
2. Click "Phone Numbers"
3. Click your number
4. Set "Record Calls" to ON
5. Save
6. Make test call

**If this works:** REST API Record parameter issue  
**If this fails:** Account doesn't support recording

---

## 📊 **EXPECTED VS ACTUAL**

### **Expected Flow:**
```
startCallHandler → REST API with Record=true
  ↓
SignalWire records call
  ↓
Call ends → Webhook fires with RecordingSid/RecordingUrl
  ↓
Webhook creates recording in database
  ↓
Recording visible in DB
```

### **Actual (Current):**
```
startCallHandler → REST API with Record=true (✅ code is correct)
  ↓
SignalWire records call (❓ unknown)
  ↓
Call ends → Webhook fires? (❓ unknown)
  ↓
Webhook creates recording? (❓ unknown)
  ↓
No recording in DB (❌ confirmed)
```

---

## 🚀 **NEXT ACTIONS**

### **Priority 1: Check SignalWire Dashboard**
- [ ] Login to SignalWire
- [ ] Find recent test call
- [ ] Check if Recording section exists
- [ ] Note RecordingSid and RecordingUrl

**This tells us:** Is SignalWire actually recording?

---

### **Priority 2: Check Database for Call**
```sql
SELECT * FROM calls 
WHERE created_at > NOW() - INTERVAL '30 minutes' 
ORDER BY created_at DESC 
LIMIT 1;
```

**Copy the `call_sid` value**

---

### **Priority 3: Search Vercel Logs for That Call**
In Vercel dashboard:
1. Go to Logs
2. Search for the `call_sid` value
3. Look for any webhook calls
4. Check for errors

---

### **Priority 4: Add Diagnostic Logging**
Apply the logging changes above, deploy, test again

---

## 💡 **LIKELY SCENARIOS**

### **Scenario A: SignalWire Not Recording (60% probability)**
- Record parameter not being sent (typo, wrong placement)
- OR SignalWire account doesn't support recording
- **Fix:** Check SignalWire dashboard, verify params

### **Scenario B: Webhook Not Firing (30% probability)**
- RecordingStatusCallback URL wrong
- Webhook signature validation blocking it
- **Fix:** Check webhook logs, disable signature validation temporarily

### **Scenario C: Webhook Failing to Insert (10% probability)**
- Database constraint violation
- RLS policy blocking insert
- Missing tool_id
- **Fix:** Check audit logs for errors

---

## 🔍 **LET'S START HERE**

**Please run these 2 queries and share results:**

```sql
-- Query 1: Recent calls
SELECT id, status, call_sid, started_at, ended_at, created_at
FROM calls 
WHERE created_at > NOW() - INTERVAL '30 minutes' 
ORDER BY created_at DESC;

-- Query 2: Recent recordings
SELECT id, call_sid, recording_sid, recording_url, status, created_at
FROM recordings 
WHERE created_at > NOW() - INTERVAL '30 minutes' 
ORDER BY created_at DESC;
```

**And check SignalWire Dashboard:**
1. Does your test call show a Recording section?
2. What's the recording URL (if any)?

**With this info, I can pinpoint exactly where the flow is breaking!**
