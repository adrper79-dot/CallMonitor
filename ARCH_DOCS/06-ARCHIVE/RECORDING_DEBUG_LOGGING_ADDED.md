# Recording Debug Logging Added

**Date:** January 12, 2026  
**Purpose:** Trace why recordings aren't appearing in database

---

## ✅ **WHAT I ADDED**

### **Enhanced Logging in startCallHandler.ts**

**Added after line 154:**
```typescript
console.log('placeSignalWireCall: RECORDING ENABLED', {
  Record: 'true',
  RecordingStatusCallback: '...',
  isSingleLeg: !conference
})
```

**Added after line 158:**
```typescript
console.log('placeSignalWireCall: FULL REST API REQUEST', { 
  endpoint: swEndpoint,
  hasRecord: params.has('Record'),
  recordValue: params.get('Record'),
  hasRecordingCallback: params.has('RecordingStatusCallback'),
  allParamKeys: Object.keys(paramsForLog)
})
```

**This logs:**
- ✅ Whether Record=true is being added
- ✅ Whether RecordingStatusCallback is set
- ✅ All parameters being sent to SignalWire

---

### **Enhanced Logging in signalwire webhook**

**Added after line 108:**
```typescript
console.log('signalwire webhook processing', {
  hasRecording: !!recordingSid,
  hasRecordingUrl: !!recordingUrl,
  recordingStatus: recordingStatus || 'not-present',
  payloadKeys: Object.keys(payload).sort()
})
```

**Added diagnostic for recordings:**
```typescript
if (recordingSid || recordingUrl || recordingStatus) {
  console.log('signalwire webhook: RECORDING DETECTED', {
    recordingSid: '[REDACTED]',
    recordingUrl: recordingUrl ? recordingUrl.substring(0, 50) + '...' : 'MISSING',
    recordingDuration: recordingDuration || 'MISSING'
  })
} else if (callStatus === 'completed') {
  console.warn('signalwire webhook: Call completed but NO RECORDING FIELDS in payload', {
    callSid: '[REDACTED]',
    payloadKeys: Object.keys(payload).sort()
  })
}
```

**This logs:**
- ✅ Whether recording fields are in webhook payload
- ✅ RecordingSid, RecordingUrl, RecordingDuration
- ✅ WARNING if call completed but no recording

---

## 🚀 **NEXT STEPS**

### **1. Deploy Changes:**
```bash
git add .
git commit -m "Debug: Add comprehensive recording logging

- Log Record parameter being sent to SignalWire
- Log all REST API params for debugging
- Log recording fields in webhook payload
- Warn if call completed without recording

This will help diagnose why recordings aren't in database."

git push
```

### **2. Wait for Vercel (2-3 minutes)**

### **3. Hard Refresh:**
```
Ctrl + Shift + F5
```

### **4. Make Test Call**

### **5. Check Vercel Logs:**

**Look for these logs:**

#### **When call starts:**
```
✅ placeSignalWireCall: RECORDING ENABLED { Record: 'true', isSingleLeg: true }
✅ placeSignalWireCall: FULL REST API REQUEST { hasRecord: true, recordValue: 'true', hasRecordingCallback: true }
```

**If you see this:** Recording parameter is being sent correctly

**If you DON'T see this:** Something wrong with code logic

---

#### **When call ends:**
```
✅ signalwire webhook processing { hasRecording: true, hasRecordingUrl: true, recordingStatus: 'completed' }
✅ signalwire webhook: RECORDING DETECTED { recordingUrl: 'https://...', recordingDuration: 45 }
✅ signalwire webhook: created recording { recordingId, callId }
```

**If you see this:** Everything working, recording created

**If you see this instead:**
```
⚠️ signalwire webhook: Call completed but NO RECORDING FIELDS in payload
```

**Then:** SignalWire is NOT recording the call

---

## 🔍 **WHAT THE LOGS TELL US**

### **Scenario A: No "RECORDING ENABLED" log**
**Means:** Code logic preventing Record parameter from being added  
**Fix:** Check if `conference` variable is set when it shouldn't be

---

### **Scenario B: "RECORDING ENABLED" but Record=false**
**Means:** Logic error in Record parameter  
**Fix:** Check parameter code

---

### **Scenario C: Record=true sent, but no webhook with recording**
**Means:** SignalWire received Record=true but didn't record  
**Possible causes:**
- SignalWire account doesn't support recording
- Call too short (< 1 second)
- Recording feature not enabled on account

**Fix:** Check SignalWire dashboard, contact support

---

### **Scenario D: Webhook received with recording, but no DB entry**
**Means:** Webhook processing failed  
**Look for:** Error logs in webhook processing  
**Possible causes:**
- Database insert failed
- RLS policy blocking insert
- Missing tool_id

---

## 📊 **DIAGNOSTIC FLOW**

```
1. startCallHandler sends REST API call
   ↓
   LOG: "RECORDING ENABLED" + "FULL REST API REQUEST"
   ↓
2. SignalWire receives call with Record=true
   ↓
3. SignalWire records call
   ↓
4. Call ends → SignalWire sends webhook
   ↓
   LOG: "webhook processing" + "RECORDING DETECTED"
   ↓
5. Webhook creates DB entry
   ↓
   LOG: "created recording"
   ↓
6. Recording visible in database
```

**Each log tells us which step succeeded/failed!**

---

## 🧪 **TEST CHECKLIST**

After deploying with logging:

- [ ] Deploy to Vercel
- [ ] Hard refresh browser
- [ ] Make test call (single-leg)
- [ ] Let call complete
- [ ] Check Vercel logs for:
  - [ ] "RECORDING ENABLED" log (should be YES)
  - [ ] "hasRecord: true" (should be YES)  
  - [ ] "webhook processing" log (should appear)
  - [ ] "RECORDING DETECTED" or "NO RECORDING FIELDS" (which one?)
  - [ ] "created recording" log (should appear if recording detected)
- [ ] Check database for recording entry
- [ ] Share logs with me if still no recording

---

## 💡 **WHAT TO SHARE**

After test, please share:

**1. Vercel logs containing:**
- "placeSignalWireCall: RECORDING ENABLED"
- "placeSignalWireCall: FULL REST API REQUEST"
- "signalwire webhook processing"
- "signalwire webhook: RECORDING DETECTED" OR "NO RECORDING FIELDS"

**2. Database query results:**
```sql
SELECT id, status, call_sid, created_at 
FROM calls 
WHERE created_at > NOW() - INTERVAL '10 minutes' 
ORDER BY created_at DESC;

SELECT id, call_sid, recording_url, created_at 
FROM recordings 
WHERE created_at > NOW() - INTERVAL '10 minutes' 
ORDER BY created_at DESC;
```

**3. SignalWire Dashboard:**
- Does your test call show a "Recording" section?
- What does it say?

**With these three pieces of info, I can pinpoint exactly where it's breaking!**

---

## ✅ **SUMMARY**

- ✅ Added logging to trace Record parameter
- ✅ Added logging to trace webhook recording fields
- ✅ Added warning for completed calls without recording
- ⏳ Ready to deploy and test
- ⏳ Logs will show exactly where flow breaks

**Deploy, test, and share logs!** 🚀
