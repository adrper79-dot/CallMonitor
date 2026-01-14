# Recording Issue - Complete Diagnosis

**Date:** January 12, 2026  
**Status:** 🚨 **CRITICAL - NO RECORDINGS BEING CREATED**

---

## 📊 **What We Found**

Looking at your 10 most recent calls:
- ❌ **0 out of 10 have recordings**
- ❌ **8 out of 10 stuck "in-progress"**  
- ⚠️ **2 "completed" but no recordings**
- ⚠️ **Several have `call_sid: null`** (SignalWire never returned SID)

---

## 🔍 **The 3 Possible Problems**

### **Problem #1: Organization Missing tool_id** 🔴

**From webhook handler (line 282-284):**
```typescript
if (!orgToolId) {
  console.warn('organization has no tool_id, cannot create recording')
}
```

**What this means:**
- Your organization record might not have a `tool_id`
- Recordings table REQUIRES `tool_id` (NOT NULL constraint)
- Webhook silently fails to create recording

**How to check:**
```sql
SELECT id, name, tool_id 
FROM organizations
WHERE id = '77249446-3201-4b00-9b96-fe7c4b16b593';
```

**If tool_id is NULL, recordings will NEVER be created!**

---

### **Problem #2: Webhooks Not Arriving** 🔴

**Evidence:**
- Most calls stuck "in-progress"
- No `started_at` timestamp
- No webhook updates

**Possible causes:**
1. **Webhook URL misconfigured in SignalWire**
   - Should be: `https://your-app.vercel.app/api/webhooks/signalwire`
   - Check SignalWire dashboard → Phone Numbers → Configure

2. **Webhooks being rejected**
   - 401 Unauthorized (signature validation issue)
   - 500 Internal Server Error (processing error)

3. **Network/firewall blocking webhooks**

**How to check:**
- Go to SignalWire Dashboard → Call Logs
- Find recent call
- Check "Webhooks" tab
- See if webhooks were sent and what response code

---

### **Problem #3: Recording Not Enabled at SignalWire Level** 🟡

**Your logs showed:**
```javascript
Record: true  // ✅ This is correct
```

But SignalWire might not be sending recording webhooks if:
- Recording parameter not formatted correctly
- StatusCallback URL not set
- Recording feature not enabled on account

---

## 🎯 **IMMEDIATE DIAGNOSTIC STEPS**

### **Step 1: Check Organization tool_id (CRITICAL)**

Run in Supabase:
```sql
SELECT 
  o.id,
  o.name,
  o.tool_id,
  t.name as tool_name
FROM organizations o
LEFT JOIN tools t ON t.id = o.tool_id
WHERE o.id = '77249446-3201-4b00-9b96-fe7c4b16b593';
```

**Expected:** tool_id should NOT be NULL  
**If NULL:** This is your problem! Need to create/link a tool.

---

### **Step 2: Run Full Diagnostic**

I created `DIAGNOSE_RECORDING_ISSUE.sql` - run it in Supabase.

This will tell you:
- ✅ Organization has tool_id?
- ✅ Recording enabled in voice_configs?
- ✅ How many calls have call_sid? (= webhooks arrived)
- ✅ How many recordings exist?

---

### **Step 3: Check SignalWire Dashboard**

1. Go to https://signalwire.com
2. Your project → **Call Logs**
3. Find call from 12:55 PM or 1:48 PM
4. Click on the call
5. Check:
   - **Duration:** Did call actually connect?
   - **Recordings:** Does SignalWire show a recording?
   - **Webhooks:** Were webhooks sent? What response?

---

## 🔧 **LIKELY FIX: Create tool_id**

If your organization is missing `tool_id`, here's the fix:

```sql
-- 1. Create a default tool for your organization
INSERT INTO tools (
  id,
  organization_id,
  name,
  description,
  type,
  config,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  '77249446-3201-4b00-9b96-fe7c4b16b593',  -- Your org ID
  'Default Tool',
  'Default tool for recordings and calls',
  'voice',
  '{"provider": "signalwire"}'::jsonb,
  NOW(),
  NOW()
)
RETURNING id;

-- 2. Copy the returned tool ID

-- 3. Update your organization with the tool_id
UPDATE organizations
SET tool_id = 'PASTE_TOOL_ID_HERE'
WHERE id = '77249446-3201-4b00-9b96-fe7c4b16b593';
```

---

## 📋 **The call_sid vs call_id Issue**

**You're right - this was never fully fixed!**

The problem:
- `calls` table stores `call_sid` (SignalWire's ID)
- `recordings` table also uses `call_sid` to link
- Webhook looks up call by `call_sid`
- JOIN should work: `recordings.call_sid = calls.call_sid`

**But your data shows:**
- Some calls have `call_sid: null`
- These are calls where SignalWire API never returned a SID
- Usually means the API call failed

**For those calls with call_sid:**
- Line 327 in webhook: `call_sid: callSid` ✅ Correct
- Should create recording with matching call_sid
- JOIN should work

**The real issue is probably the missing tool_id!**

---

## 🚨 **SUMMARY: What to Do RIGHT NOW**

1. **Run this query:**
   ```sql
   SELECT tool_id FROM organizations 
   WHERE id = '77249446-3201-4b00-9b96-fe7c4b16b593';
   ```

2. **If tool_id is NULL:**
   - Run the SQL fix above to create a tool
   - This is 99% likely your problem!

3. **Check SignalWire Dashboard:**
   - See if recordings exist there
   - Check webhook delivery status

4. **Run full diagnostic:**
   - Use `DIAGNOSE_RECORDING_ISSUE.sql`

---

## 💡 **Why This Happens**

When users sign up, your signup flow (that we fixed earlier) now creates:
1. Organization ✅
2. User ✅  
3. Default Tool ✅ (FIXED)
4. Links tool_id to organization ✅ (FIXED)

**BUT** your organization was created BEFORE we fixed the signup flow!

So your org doesn't have a tool_id, and recordings can't be created.

---

## 🎯 **Next Steps**

1. **Check tool_id** (1 query)
2. **If NULL, create tool** (2 queries to fix)
3. **Make new test call**
4. **Recording should work!** ✅

**Run the tool_id check query and tell me the result!** 🔍
