# 🔍 Recording Not Saved - Diagnostic Flowchart

**Issue:** Call worked perfectly, but no recording in database

---

## 🎯 **START HERE - Run This ONE Query**

```sql
SELECT 
  c.call_sid,
  o.tool_id,
  CASE 
    WHEN o.tool_id IS NULL THEN '🚨 FOUND THE PROBLEM! Organization missing tool_id'
    ELSE '✅ tool_id OK - issue elsewhere'
  END as result
FROM calls c
JOIN organizations o ON o.id = c.organization_id
WHERE c.created_at > NOW() - INTERVAL '1 hour'
ORDER BY c.created_at DESC
LIMIT 1;
```

**How to run:**
1. Open: https://supabase.com/dashboard/project/fiijrhpjpebevfavzlhu/editor
2. Click "SQL Editor"
3. Paste query above
4. Click "Run"
5. Look at the `result` column

---

## 📊 **DIAGNOSTIC FLOWCHART**

```
┌─────────────────────────────────────┐
│ Is tool_id NULL in result above?    │
└─────────────────────────────────────┘
           │
           ├─── YES ──────────────────────────────┐
           │                                      │
           │    🚨 FOUND THE PROBLEM!             │
           │                                      │
           │    The webhook code has this logic:  │
           │    (signalwire webhook line 259-262) │
           │                                      │
           │    if (!orgToolId) {                 │
           │      console.warn('no tool_id')      │
           │      // Recording is SKIPPED!        │
           │    }                                 │
           │                                      │
           │    FIX: I'll create tool for you     │
           │         (tell me your org_id)        │
           │                                      │
           └──────────────────────────────────────┘
           │
           ├─── NO ───────────────────────────────┐
           │                                      │
           │    tool_id exists, continue debugging│
           │                                      │
           ▼                                      │
┌─────────────────────────────────────┐          │
│ Check SignalWire Dashboard:          │          │
│ Does call show Recording section?   │          │
└─────────────────────────────────────┘          │
           │                                      │
           ├─── NO ───────────────────────────────┤
           │                                      │
           │    SignalWire didn't record          │
           │                                      │
           │    Check Vercel logs for:            │
           │    "FULL REST API REQUEST"           │
           │                                      │
           │    If hasRecord=false:               │
           │    → Record param not added (bug)    │
           │                                      │
           │    If hasRecord=true:                │
           │    → SignalWire account issue        │
           │    → Contact SignalWire support      │
           │                                      │
           └──────────────────────────────────────┘
           │
           ├─── YES ──────────────────────────────┐
           │                                      │
           │    SignalWire DID record             │
           │    Issue is webhook/database         │
           │                                      │
           ▼                                      │
┌─────────────────────────────────────┐          │
│ Check Vercel logs for:               │          │
│ "RECORDING DETECTED" or              │          │
│ "NO RECORDING FIELDS"                │          │
└─────────────────────────────────────┘          │
           │                                      │
           ├─── "NO RECORDING FIELDS" ────────────┤
           │                                      │
           │    Webhook signature issue           │
           │    (recording not in payload)        │
           │                                      │
           │    FIX: Already disabled signatures  │
           │    → Need to check webhook URL       │
           │                                      │
           └──────────────────────────────────────┘
           │
           ├─── "RECORDING DETECTED" ─────────────┐
           │                                      │
           │    Webhook received recording        │
           │    but didn't save to DB             │
           │                                      │
           ▼                                      │
┌─────────────────────────────────────┐          │
│ Check audit logs for insert error:  │          │
│                                      │          │
│ SELECT * FROM audit_logs             │          │
│ WHERE resource_type = 'recordings'   │          │
│ AND action = 'error'                 │          │
└─────────────────────────────────────┘          │
           │                                      │
           ├─── Found error ──────────────────────┤
           │                                      │
           │    RLS policy or constraint issue    │
           │    → Share error, I'll fix           │
           │                                      │
           └──────────────────────────────────────┘
```

---

## ⚡ **FASTEST PATH (30 SECONDS)**

**Just run this ONE query and tell me the result:**

```sql
SELECT 
  o.tool_id,
  CASE WHEN o.tool_id IS NULL THEN 'MISSING' ELSE 'OK' END
FROM organizations o
WHERE o.id IN (
  SELECT organization_id FROM calls 
  WHERE created_at > NOW() - INTERVAL '1 hour' 
  LIMIT 1
);
```

**If result is "MISSING":** That's your problem - I'll fix it now  
**If result is "OK":** We need to check SignalWire Dashboard next

---

## 🎯 **TELL ME THESE 3 THINGS**

1. **tool_id status:** MISSING or OK? (from query above)
2. **SignalWire Recording:** Does your call show Recording section?
3. **Vercel logs:** Any logs with "RECORDING" in them?

**I'll have the exact fix ready immediately!** 🚀
