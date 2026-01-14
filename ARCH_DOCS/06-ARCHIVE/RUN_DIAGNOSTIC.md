# 🚨 URGENT: Run This Diagnostic Now

**Your call worked!** Now let's find where the recording went.

---

## ⚡ **FASTEST DIAGNOSTIC (2 MINUTES)**

### **Option A: Via Supabase Dashboard (EASIEST)**

1. **Open Supabase:**
   ```
   https://supabase.com/dashboard/project/fiijrhpjpebevfavzlhu
   ```

2. **Click "SQL Editor" (left sidebar)**

3. **Paste and run this query:**
   ```sql
   -- Check if organization has tool_id (MOST LIKELY ISSUE)
   SELECT 
     c.id as call_id,
     c.call_sid,
     o.id as org_id,
     o.tool_id,
     CASE 
       WHEN o.tool_id IS NULL THEN '❌ MISSING TOOL_ID - THIS IS THE PROBLEM!'
       ELSE '✅ Tool ID present'
     END as diagnosis
   FROM calls c
   JOIN organizations o ON o.id = c.organization_id
   WHERE c.created_at > NOW() - INTERVAL '1 hour'
   ORDER BY c.created_at DESC
   LIMIT 1;
   ```

4. **Share the result with me**

**If tool_id is NULL:** I'll fix it immediately (this blocks recordings)

---

### **Option B: Via Terminal (FASTER IF YOU'RE COMFORTABLE)**

```powershell
# In your terminal, run:
.\CHECK_DB_FOR_RECORDING.sql
```

Copy the first query and paste into Supabase SQL Editor

---

## 📊 **WHAT TO TELL ME**

After running the query above, tell me:

1. **✅ or ❌**: Is `tool_id` NULL or present?
2. **Call SID:** What's the `call_sid` value?
3. **Organization ID:** What's the `org_id`?

**I'll fix it immediately based on your answer!**

---

## 🔍 **ALSO CHECK SIGNALWIRE (2 MINUTES)**

While waiting for database results:

1. **Go to SignalWire Dashboard:**
   - Login at: https://your-space.signalwire.com
   - Click "Calls"
   - Find your recent call

2. **Look for "Recording" section**

3. **Tell me:**
   - ✅ Does Recording section exist?
   - ✅ What's the status? (completed, in-progress, failed?)
   - ✅ Is there a recording URL?

---

## 💡 **WHY THIS MATTERS**

### **If tool_id is NULL:**
```typescript
// In signalwire webhook, line 259-262
const orgToolId = orgRows?.[0]?.tool_id

if (!orgToolId) {
  console.warn('signalwire webhook: organization has no tool_id, cannot create recording')
  // ❌ Recording is SKIPPED!
}
```

**The webhook sees the recording but CAN'T save it because no tool_id!**

**Fix:** Create tool and link to organization (I'll do this for you)

---

### **If SignalWire didn't record:**
Check if Record parameter was actually sent (Vercel logs)

---

## 🚀 **IMMEDIATE ACTION**

**Right now, do this:**

1. ✅ Copy the SQL query from Step 1 above
2. ✅ Go to Supabase Dashboard → SQL Editor
3. ✅ Paste and run
4. ✅ Tell me if tool_id is NULL

**I'll have the fix ready in 30 seconds!**

---

## 📝 **COMMON SCENARIOS**

### **Scenario A: tool_id is NULL (70% probability)**
**Fix:** Create tool, link to organization (5 minutes)
```sql
-- I'll provide exact SQL based on your org_id
```

### **Scenario B: SignalWire didn't record (20% probability)**
**Fix:** Check Record parameter in logs, verify SignalWire account

### **Scenario C: Webhook failed to insert (10% probability)**
**Fix:** Check audit logs for specific error, fix RLS policy

---

## ✅ **BOTTOM LINE**

**Run that one SQL query** (tool_id check) and tell me the result.

That's the #1 most likely issue and I can fix it immediately!

🎯 **Let's get this recording working now!**
