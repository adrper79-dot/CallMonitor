# URGENT: 3 Actions Required

**Date:** January 13, 2026  
**Status:** 🚨 **CRITICAL FIXES DEPLOYED - IMMEDIATE ACTION NEEDED**

---

## 🎯 **TL;DR - Do These 3 Things NOW**

1. ✅ **Run SQL fix** for broken user (adrper792@gmail.com)
2. ⏳ **Wait for Vercel deployment** (~2 minutes)
3. 🧪 **Test recordings** (make a new call)

---

## 📋 **Action #1: Fix Broken User (adrper792@gmail.com)**

### **Run This SQL in Supabase SQL Editor:**

Open: `FIX_NEW_USER_adrper792.sql`

Or copy/paste this:

```sql
DO $$
DECLARE
  v_user_id uuid := 'abccc4d0-4eab-4352-b326-008de7568f50';
  v_org_id uuid;
  v_tool_id uuid;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM users
  WHERE id = v_user_id;
  
  IF v_org_id IS NULL THEN
    -- Create organization
    INSERT INTO organizations (name, plan, plan_status, created_by)
    VALUES ('adrper792@gmail.com''s Organization', 'professional', 'active', v_user_id)
    RETURNING id INTO v_org_id;
    
    -- Create tool
    INSERT INTO tools (name, description)
    VALUES ('Default Voice Tool', 'Default tool for call recordings')
    ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO v_tool_id;
    
    -- Link tool to organization
    UPDATE organizations SET tool_id = v_tool_id WHERE id = v_org_id;
    
    -- Update user with organization_id
    UPDATE users SET organization_id = v_org_id WHERE id = v_user_id;
    
    -- Create voice_configs
    INSERT INTO voice_configs (
      organization_id, record, transcribe, translate
    ) VALUES (v_org_id, true, true, false);
    
    -- Create org_members
    INSERT INTO org_members (organization_id, user_id, role)
    VALUES (v_org_id, v_user_id, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;
    
    RAISE NOTICE 'User fixed!';
  ELSE
    -- User has org, check tool_id and voice_configs
    SELECT tool_id INTO v_tool_id FROM organizations WHERE id = v_org_id;
    
    IF v_tool_id IS NULL THEN
      INSERT INTO tools (name, description)
      VALUES ('Default Voice Tool', 'Default tool for call recordings')
      ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
      RETURNING id INTO v_tool_id;
      
      UPDATE organizations SET tool_id = v_tool_id WHERE id = v_org_id;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM voice_configs WHERE organization_id = v_org_id) THEN
      INSERT INTO voice_configs (organization_id, record, transcribe, translate)
      VALUES (v_org_id, true, true, false);
    END IF;
    
    RAISE NOTICE 'User already had org, fixed tool and voice_configs';
  END IF;
END $$;
```

### **Verify the Fix:**

```sql
SELECT 
  u.email,
  u.organization_id IS NOT NULL as has_org,
  o.tool_id IS NOT NULL as has_tool,
  vc.record as recording_enabled
FROM users u
LEFT JOIN organizations o ON o.id = u.organization_id
LEFT JOIN voice_configs vc ON vc.organization_id = o.id
WHERE u.email = 'adrper792@gmail.com';

-- Expected: has_org=true, has_tool=true, recording_enabled=true
```

---

## ⏳ **Action #2: Wait for Vercel Deployment**

I just pushed TWO critical fixes:

### **Fix #1: Signup Fix** (Commit `ac6537a`)
- Corrected `tools` table schema
- Added `voice_configs` creation for new users

### **Fix #2: Recording Fix** (Commit `fe809ae`)
- Enabled `Record=true` for ALL calls (including conferences)
- Previously, conference calls were NOT being recorded!

### **Check Deployment Status:**

Go to: **Vercel Dashboard → Deployments**

Wait for status to show: **✅ Ready**

(Usually takes ~2 minutes)

---

## 🧪 **Action #3: Test Everything**

After Vercel deployment completes:

### **Test A: Login as adrper792@gmail.com**

1. Login at your app
2. Should see dashboard (no 500 error)
3. ✅ **Expected:** Works!

### **Test B: Make a Call**

1. Make a test call (any type: single-leg or bridge)
2. Wait 60 seconds for call to complete
3. Run this SQL:

```sql
SELECT 
  c.id as call_id,
  c.call_sid,
  c.status,
  c.started_at,
  r.id as recording_id,
  r.recording_url IS NOT NULL as has_url,
  r.status as recording_status,
  CASE 
    WHEN r.id IS NOT NULL THEN '🎉 SUCCESS!'
    ELSE '❌ Still broken'
  END as result
FROM calls c
LEFT JOIN recordings r ON r.call_sid = c.call_sid
ORDER BY c.started_at DESC NULLS LAST
LIMIT 1;
```

4. ✅ **Expected:** `result: "🎉 SUCCESS!"`

### **Test C: Create Brand New User**

1. Sign up with a new email (e.g., `test789@gmail.com`)
2. Should work end-to-end
3. Check database:

```sql
SELECT 
  u.email,
  u.organization_id IS NOT NULL as has_org,
  o.tool_id IS NOT NULL as has_tool,
  vc.record as recording_enabled
FROM users u
LEFT JOIN organizations o ON o.id = u.organization_id
LEFT JOIN voice_configs vc ON vc.organization_id = o.id
WHERE u.email = 'test789@gmail.com';
```

4. ✅ **Expected:** `has_org=true, has_tool=true, recording_enabled=true`

---

## 🐛 **What Was Wrong**

### **Bug #1: Signup Code Used Wrong Schema**

**The code tried to insert:**
```typescript
.insert({
  name: '...',
  type: 'recording',        // ❌ Column doesn't exist!
  organization_id: orgId,   // ❌ Column doesn't exist!
  created_by: userId        // ❌ Column doesn't exist!
})
```

**Actual `tools` table schema:**
```sql
CREATE TABLE tools (
  id uuid,
  name text UNIQUE,
  description text
  -- NO type, organization_id, or created_by!
);
```

**Result:** Tool insert failed, so no `tool_id` was linked to organization.

### **Bug #2: Conference Calls NOT Recording**

**The code skipped `Record=true` for conference calls:**
```typescript
if (!conference) {
  params.append('Record', 'true')  // Only for single-leg!
} else {
  // SKIPPED for conferences - relied on LaML only
}
```

**The LaML had:** `<Conference record="record-from-answer">`

**BUT:** SignalWire was ignoring the LaML attribute!

**Result:** NO recordings created for conference/bridge calls.

### **Bug #3: Missing voice_configs Creation**

The signup code never created `voice_configs` at all.

**Result:** New users couldn't make calls (recording disabled by default).

---

## ✅ **What Was Fixed**

### **Fix #1: Corrected Tools Insert**

```typescript
.insert({
  name: 'Default Voice Tool',
  description: 'Default tool for call recordings'
  // ✅ Only fields that exist!
})
```

### **Fix #2: Enabled Record=true for ALL Calls**

```typescript
// ALWAYS enable recording at REST API level
params.append('Record', 'true')
params.append('RecordingStatusCallback', '...')
// Works for BOTH single-leg AND conference calls!
```

### **Fix #3: Added voice_configs Creation**

```typescript
await supabase
  .from('voice_configs')
  .insert({
    organization_id: orgId,
    record: true,
    transcribe: true,
    ...
  })
```

---

## 📊 **Expected Results After All 3 Actions**

1. ✅ Old user (adrper792) can login and use the app
2. ✅ Recordings work for ALL call types (single-leg AND conferences)
3. ✅ New user signup works perfectly end-to-end
4. ✅ All new users automatically get:
   - Organization
   - Tool (linked via `tool_id`)
   - `voice_configs` with `record: true`

---

## 🚨 **CHECKLIST**

- [ ] **YOU:** Run `FIX_NEW_USER_adrper792.sql` in Supabase
- [ ] **AUTOMATIC:** Vercel deploys latest code (~2 min)
- [ ] **YOU:** Login as adrper792@gmail.com (should work)
- [ ] **YOU:** Make a test call (any type)
- [ ] **YOU:** Verify recording in database
- [ ] **YOU:** Create new test user
- [ ] **YOU:** Verify new user has org/tool/voice_configs

---

## 🎉 **After This**

Everything should work:
- ✅ User signup creates all necessary records
- ✅ Recordings work for all call types
- ✅ No more 500 errors
- ✅ No more missing organization_id

**DO ACTION #1 NOW (run the SQL), then wait for Vercel deployment!** 🚀
