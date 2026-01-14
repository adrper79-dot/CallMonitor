# Recording Debug - Step by Step

**Status:** ✅ Call worked perfectly (no timeout)  
**Issue:** ❌ No recording in database  
**Goal:** Find where recording flow is breaking

---

## 🎯 **QUICK DIAGNOSTIC (5 MINUTES)**

### **Step 1: Check Database (30 seconds)**

Run this in Supabase SQL Editor:

```sql
-- Check recent calls
SELECT id, status, call_sid, started_at, ended_at 
FROM calls 
WHERE created_at > NOW() - INTERVAL '1 hour' 
ORDER BY created_at DESC 
LIMIT 3;
```

**✅ If you see your call:** Copy the `call_sid` value  
**❌ If empty:** Call wasn't saved (different issue)

---

### **Step 2: Check for Recording (30 seconds)**

```sql
-- Check recordings for that call
SELECT * 
FROM recordings 
WHERE created_at > NOW() - INTERVAL '1 hour' 
ORDER BY created_at DESC;
```

**✅ If you see recording:** Great! It's there (maybe just not visible in UI)  
**❌ If empty:** Recording webhook didn't fire or failed (continue debugging)

---

### **Step 3: Check Organization Tool ID (30 seconds)**

```sql
-- Check if organization has tool_id (REQUIRED for recordings)
SELECT o.id, o.name, o.tool_id 
FROM organizations o
WHERE o.id IN (
  SELECT DISTINCT organization_id 
  FROM calls 
  WHERE created_at > NOW() - INTERVAL '1 hour'
);
```

**✅ If tool_id is NOT NULL:** Good, organization can have recordings  
**❌ If tool_id is NULL:** **THIS IS THE PROBLEM!** Organization needs a tool

---

## 🔍 **DEEP DIAGNOSTIC (IF STILL NOT FOUND)**

### **Step 4: Check Vercel Logs**

**Open Vercel Dashboard → Logs → Search for:**

#### **Search 1: "RECORDING ENABLED"**
```
placeSignalWireCall: RECORDING ENABLED { Record: 'true', isSingleLeg: true }
```

**✅ Found:** Record parameter being sent  
**❌ Not found:** Logic error preventing Record param

---

#### **Search 2: "FULL REST API REQUEST"**
```
placeSignalWireCall: FULL REST API REQUEST { 
  hasRecord: true, 
  recordValue: 'true', 
  hasRecordingCallback: true 
}
```

**✅ Found + hasRecord=true:** Recording parameter sent to SignalWire  
**❌ hasRecord=false:** Record parameter not added (bug in code)

---

#### **Search 3: "webhook processing"**
```
signalwire webhook processing { 
  callStatus: 'completed', 
  hasRecording: true, 
  hasRecordingUrl: true 
}
```

**✅ hasRecording=true:** SignalWire sent recording data  
**❌ hasRecording=false:** SignalWire didn't record (see Step 5)

---

#### **Search 4: "RECORDING DETECTED" or "NO RECORDING FIELDS"**

**✅ "RECORDING DETECTED":**
```
signalwire webhook: RECORDING DETECTED { 
  recordingUrl: 'https://...', 
  recordingDuration: 45 
}
```
→ Recording exists, check if DB insert succeeded

**❌ "NO RECORDING FIELDS":**
```
signalwire webhook: Call completed but NO RECORDING FIELDS in payload
```
→ SignalWire didn't record - go to Step 5

---

#### **Search 5: "created recording"**
```
signalwire webhook: created recording { recordingId, callId }
```

**✅ Found:** Recording was inserted to DB! Check recordings table again  
**❌ Not found:** DB insert failed - check for error logs

---

### **Step 5: Check SignalWire Dashboard**

1. Go to SignalWire Dashboard
2. Click "Calls" → Recent Calls
3. Find your test call (look for the To number)
4. Click on the call

**Check for "Recording" section:**

**✅ Recording section exists with URL:**
- SignalWire DID record
- Problem is webhook not firing or DB insert failing
- Check webhook logs for errors

**❌ No Recording section:**
- SignalWire didn't record
- Possible causes:
  - Record parameter not sent
  - SignalWire account doesn't support recording
  - Call too short (< 1 second)

---

## 🚨 **MOST LIKELY ISSUES (RANKED)**

### **Issue #1: Organization has no tool_id (60% probability)**

**Check:**
```sql
SELECT tool_id FROM organizations WHERE id = 'your-org-id';
```

**If NULL, fix with:**
```sql
-- Create a tool first
INSERT INTO tools (id, name, type, organization_id)
VALUES (gen_random_uuid(), 'Default Recording Tool', 'recording', 'your-org-id')
RETURNING id;

-- Update organization with tool_id
UPDATE organizations 
SET tool_id = 'tool-id-from-above' 
WHERE id = 'your-org-id';
```

---

### **Issue #2: SignalWire not recording (30% probability)**

**Symptoms:**
- Logs show "NO RECORDING FIELDS in payload"
- SignalWire Dashboard shows no Recording section

**Possible causes:**
- Record parameter not being sent (check logs)
- SignalWire account doesn't support recording
- Recording feature not enabled on account

**Fix:**
1. Check SignalWire account features
2. Contact SignalWire support if needed
3. Verify Record parameter in logs

---

### **Issue #3: Webhook failing to insert (10% probability)**

**Symptoms:**
- Logs show "RECORDING DETECTED"
- No "created recording" log
- No recording in database

**Possible causes:**
- RLS policy blocking insert
- Database constraint violation
- Missing fields

**Fix:**
```sql
-- Check audit logs for errors
SELECT * FROM audit_logs 
WHERE resource_type = 'recordings' 
AND action = 'error'
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## 📊 **DECISION TREE**

```
Call worked? 
  YES → Continue
  
Database has call entry?
  YES → Continue
  NO → Check call creation logic
  
Organization has tool_id?
  NO → FIX: Create tool and update organization ⚠️
  YES → Continue
  
Vercel logs show "RECORDING ENABLED"?
  NO → FIX: Check placeSignalWireCall logic
  YES → Continue
  
Vercel logs show hasRecord=true?
  NO → FIX: Record parameter not being added
  YES → Continue
  
Vercel logs show "RECORDING DETECTED"?
  NO → Check SignalWire Dashboard
  YES → Continue (webhook received recording)
  
SignalWire Dashboard shows Recording?
  NO → SignalWire didn't record (account issue)
  YES → Continue
  
Vercel logs show "created recording"?
  NO → Database insert failed (check audit logs)
  YES → Recording should be in DB (query again)
```

---

## ✅ **QUICK WINS TO TRY**

### **Quick Win #1: Check if tool_id is missing (2 minutes)**

Run this query - this is the #1 most likely issue:

```sql
SELECT 
  c.id as call_id,
  c.organization_id,
  o.tool_id,
  CASE 
    WHEN o.tool_id IS NULL THEN '❌ MISSING - THIS IS THE PROBLEM!'
    ELSE '✅ Present'
  END as tool_status
FROM calls c
JOIN organizations o ON o.id = c.organization_id
WHERE c.created_at > NOW() - INTERVAL '1 hour'
ORDER BY c.created_at DESC
LIMIT 1;
```

**If tool_id is NULL:** This is your problem! Recordings require a tool_id.

---

### **Quick Win #2: Check SignalWire Dashboard (2 minutes)**

Fastest way to know if SignalWire recorded:
1. Open SignalWire Dashboard
2. Recent Calls
3. Find your call
4. Look for "Recording" section

**If present:** SignalWire recorded, issue is webhook/database  
**If absent:** SignalWire didn't record, issue is Record parameter

---

## 🎯 **WHAT TO DO NOW**

1. ✅ **Run Quick Win #1** (tool_id check)
2. ✅ **Run Quick Win #2** (SignalWire dashboard)
3. ✅ **Share results** with me

**Tell me:**
- Is tool_id NULL? (from Quick Win #1)
- Does SignalWire show Recording section? (from Quick Win #2)
- Any Vercel logs you see with "RECORDING" in them

**With these 3 pieces of info, I can immediately tell you the exact fix!**

---

## 📝 **HELPER FILES CREATED**

1. **`CHECK_DB_FOR_RECORDING.sql`** - SQL queries to run
2. **`GET_RECORDING_LOGS.ps1`** - PowerShell script for logs
3. **`RECORDING_DEBUG_STEPS.md`** - This file

**Run the SQL queries first - fastest way to find the issue!**
