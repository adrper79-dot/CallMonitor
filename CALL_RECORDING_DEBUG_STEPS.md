# How to Check If Your Call Recorded

**Date:** January 12, 2026  
**Purpose:** Quick diagnostic steps to verify call recording

---

## 🔍 **QUICK CHECK (2 minutes)**

### **Step 1: Check Database**

Go to **Supabase SQL Editor** and run:

```sql
-- Check most recent call
SELECT 
  id,
  status,
  call_sid,
  created_at,
  organization_id
FROM calls
WHERE created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
- Should see your call with `status = 'completed'` or `'in-progress'`
- Note the `id` (call_id) for next query

---

### **Step 2: Check Recording**

Using the `call_id` from above:

```sql
-- Replace 'YOUR_CALL_ID' with actual ID
SELECT 
  id,
  recording_url,
  status,
  duration_seconds,
  has_live_translation,
  created_at
FROM recordings
WHERE call_id = 'YOUR_CALL_ID';
```

**Expected Result:**
- If recording exists → ✅ Call was recorded!
- If no rows → ❌ Recording not created

---

### **Step 3: Check Vercel Logs (Alternative)**

**Via Vercel Dashboard:**
1. Go to https://vercel.com
2. Your Project → Deployments
3. Click most recent "Ready" deployment
4. Click "Runtime Logs" tab
5. Search for:
   - `"startCallHandler"`
   - `"signalwire call placed"`
   - `"Record: true"` or `"Record=true"`

---

## 📋 **WHAT TO LOOK FOR IN LOGS**

### **Call Initiation (Should See):**
```
startCallHandler: about to place SignalWire call
  shouldUseLiveTranslation: true/false
  plan: "business"
  isBusinessPlan: true/false
  isFeatureFlagEnabled: true/false
```

### **Recording Parameter (Should See):**
```
startCallHandler: placing call with Record parameter
  Record: true
```

### **Call Placed (Should See):**
```
startCallHandler: signalwire call placed
  call_sid: [REDACTED]
  liveTranslation: true/false
```

### **SWML Routing (If Translation Enabled):**
```
startCallHandler: routing to SWML endpoint for live translation
  callId: xxx-xxx-xxx
```

---

## 🚨 **COMMON ISSUES**

### **Issue #1: No Call Record in Database**
**Symptom:** Query returns no rows  
**Cause:** Call never initiated or failed early  
**Check:**
- Vercel logs for errors
- Organization has valid tool_id
- User has permissions

---

### **Issue #2: Call Record Exists, No Recording**
**Symptom:** Call in DB, but no recording row  
**Cause:** Recording not created by SignalWire webhook  
**Check:**
```sql
-- Check if recording parameter was set
-- Look in Vercel logs for:
"Record: true" or "Record=true"
```

**Possible causes:**
- Recording not enabled in voice_configs
- SignalWire didn't send recording webhook
- Webhook processing failed

---

### **Issue #3: Feature Flag Not Enabled**
**Symptom:** `shouldUseLiveTranslation: false` in logs  
**Cause:** `TRANSLATION_LIVE_ASSIST_PREVIEW` not set  
**Fix:**
```bash
# Local
echo TRANSLATION_LIVE_ASSIST_PREVIEW=true >> .env.local

# Vercel
# Settings → Environment Variables → Add
TRANSLATION_LIVE_ASSIST_PREVIEW=true
```

---

### **Issue #4: Recording Webhook Not Received**
**Symptom:** Call completed, but recording status = 'pending'  
**Cause:** SignalWire webhook not sent or failed  
**Check:**
1. SignalWire Dashboard → Call Logs
2. Look for webhook status
3. Check webhook URL is correct

---

## 🔧 **DIAGNOSTIC QUERIES**

### **Full Call + Recording Status:**
```sql
SELECT 
  c.id as call_id,
  c.status as call_status,
  c.call_sid,
  c.created_at as call_created,
  c.ended_at as call_ended,
  r.id as recording_id,
  r.recording_url,
  r.status as recording_status,
  r.duration_seconds,
  r.has_live_translation
FROM calls c
LEFT JOIN recordings r ON r.call_id = c.id
WHERE c.created_at > NOW() - INTERVAL '10 minutes'
ORDER BY c.created_at DESC
LIMIT 5;
```

---

### **Check Voice Config:**
```sql
SELECT 
  record,
  transcribe,
  translate,
  translate_from,
  translate_to
FROM voice_configs
WHERE organization_id = (
  SELECT organization_id 
  FROM calls 
  ORDER BY created_at DESC 
  LIMIT 1
);
```

**Expected:**
- `record: true` (for recording to work)
- `translate: true` (for translation to work)

---

## 📊 **FULL DIAGNOSTIC SCRIPT**

Run this in Supabase SQL Editor:

```sql
-- File: CHECK_RECENT_CALL.sql
-- (Already created in your project root)
```

Or copy/paste from: `CHECK_RECENT_CALL.sql`

---

## ✅ **SUCCESS CHECKLIST**

After making a call, you should see:

### **In Vercel Logs:**
- [ ] `startCallHandler: about to place SignalWire call`
- [ ] `Record: true` or `Record=true`
- [ ] `startCallHandler: signalwire call placed`
- [ ] If translation: `routing to SWML endpoint`

### **In Database (calls table):**
- [ ] New row with your call
- [ ] `status = 'completed'` (after call ends)
- [ ] `call_sid` populated

### **In Database (recordings table):**
- [ ] New row linked to call_id
- [ ] `recording_url` populated
- [ ] `status = 'completed'`
- [ ] If translation: `has_live_translation = true`

---

## 🎯 **NEXT STEPS**

1. **Run Database Queries** (above) to check current status
2. **If no recording:**
   - Check voice_configs (`record = true`?)
   - Check Vercel logs for errors
   - Verify feature flag enabled
3. **If recording exists but no translation:**
   - Check voice_configs (`translate = true`?)
   - Check feature flag `TRANSLATION_LIVE_ASSIST_PREVIEW`
   - Check logs for SWML routing

---

## 📞 **QUICK ANSWER**

**To answer your question: "Did it record per the logging?"**

**Run this ONE query in Supabase:**
```sql
SELECT 
  c.id,
  c.status as call_status,
  c.created_at,
  r.recording_url IS NOT NULL as has_recording,
  r.status as recording_status,
  r.has_live_translation
FROM calls c
LEFT JOIN recordings r ON r.call_id = c.id
WHERE c.created_at > NOW() - INTERVAL '10 minutes'
ORDER BY c.created_at DESC
LIMIT 1;
```

**Result means:**
- `has_recording = true` → ✅ YES, recorded!
- `has_recording = false` → ❌ NO, not recorded
- No rows → ❌ Call not found (may have failed)

---

**Need help interpreting results? Share the output!** 🚀
