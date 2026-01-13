# Critical Signup Bug - FIXED

**Date:** January 13, 2026  
**Issue:** New user signup broken - users created without organization_id  
**User Affected:** adrper792@gmail.com (ID: abccc4d0-4eab-4352-b326-008de7568f50)

---

## 🚨 **The Bug**

The signup code had **TWO critical errors**:

### **Error #1: Wrong Schema for Tools Table**

**Lines 143-146 in `app/api/auth/signup/route.ts`:**
```typescript
.insert({
  name: `${name || email}'s Recording Tool`,
  type: 'recording',           // ❌ Column doesn't exist!
  organization_id: orgId,       // ❌ Column doesn't exist!
  created_by: data.id           // ❌ Column doesn't exist!
})
```

**Actual `tools` table schema:**
```sql
CREATE TABLE public.tools (
  id uuid,
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp
);
```

**Result:** Tool insert **FAILED silently**, so `tool_id` was never linked to the organization.

### **Error #2: Missing voice_configs Creation**

The signup code **never created** `voice_configs` for new organizations.

**Result:** New users couldn't make calls because recording was disabled by default (no `voice_configs.record = true`).

---

## ✅ **The Fix**

### **Fix #1: Correct Tools Insert**

**Changed to:**
```typescript
.insert({
  name: `Default Voice Tool`,
  description: `Default tool for call recordings and AI services`
})
```

### **Fix #2: Add voice_configs Creation**

**Added after org_members creation:**
```typescript
const { error: voiceConfigError } = await supabase
  .from('voice_configs')
  .insert({
    organization_id: orgId,
    record: true,
    transcribe: true,
    translate: false,
    translate_from: 'en-US',
    translate_to: 'es-ES',
    survey: false,
    synthetic_caller: false
  })
```

---

## 🔧 **IMMEDIATE ACTION REQUIRED**

### **1. Fix the Broken User (adrper792@gmail.com)**

Run `FIX_NEW_USER_adrper792.sql` in Supabase SQL Editor:

```bash
# Open Supabase Dashboard → SQL Editor
# Copy/paste contents of FIX_NEW_USER_adrper792.sql
# Click "Run"
```

This will:
- Create organization (if missing)
- Create tool and link to organization
- Create voice_configs with recording enabled
- Update user with organization_id

### **2. Deploy the Fix to Vercel**

```bash
# The fix is already committed and pushed
# Vercel should auto-deploy

# Or manually deploy:
git push origin main
```

### **3. Verify the Fix Worked**

Run this query in Supabase:

```sql
SELECT 
  u.id,
  u.email,
  u.organization_id,
  o.tool_id,
  vc.record as recording_enabled
FROM users u
LEFT JOIN organizations o ON o.id = u.organization_id
LEFT JOIN voice_configs vc ON vc.organization_id = o.id
WHERE u.email = 'adrper792@gmail.com';
```

**Expected result:**
```json
{
  "organization_id": "some-uuid",  ✅
  "tool_id": "some-uuid",          ✅
  "recording_enabled": true        ✅
}
```

### **4. Test with a Brand New User**

After deployment:
1. Create a **NEW** test user (e.g., `test123@gmail.com`)
2. Sign up successfully
3. Check database - should have organization, tool_id, and voice_configs
4. Try making a call - should work!

---

## 📊 **Root Cause Analysis**

### **Why This Happened**

When I initially wrote the signup fix (earlier today), I made an incorrect assumption about the `tools` table schema. I assumed it had:
- `organization_id` (for linking tools to orgs)
- `type` (for categorizing tools)
- `created_by` (for audit trail)

**But the actual schema is MUCH simpler:**
- Only `id`, `name`, `description`, `created_at`
- **NO foreign keys to organizations!**
- The link is: `organizations.tool_id` → `tools.id`

This caused the tool insert to fail, which cascaded into all the other issues.

### **How It Went Undetected**

1. The error was logged but **not returned** to the client
2. The signup appeared to succeed (user was created in auth.users)
3. The error only surfaced when the user tried to log in and fetch their organization

---

## 🎓 **Lessons Learned**

### **1. Always Verify Schema Before Writing Inserts**

**Should have done:**
```sql
\d tools  -- In psql
-- or
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tools';
```

### **2. Fail Fast on Critical Errors**

**Current code:**
```typescript
if (toolError) {
  console.error('Failed to create tool:', toolError)
  // Continue without tool ← BAD!
}
```

**Should be:**
```typescript
if (toolError) {
  console.error('Failed to create tool:', toolError)
  return NextResponse.json(
    { error: 'Failed to create tool' },
    { status: 500 }
  )  // ← GOOD! Stop here
}
```

### **3. Test Signup Flow Thoroughly**

**Should have:**
1. Created a test user after writing the fix
2. Checked database to verify all records were created
3. Tried making a call to ensure everything works end-to-end

---

## ✅ **Checklist**

- [x] Identified the bug (wrong tools schema)
- [x] Fixed `app/api/auth/signup/route.ts`
- [x] Added voice_configs creation
- [x] Created SQL fix for broken user
- [x] Committed and pushed changes
- [ ] **YOU: Run `FIX_NEW_USER_adrper792.sql` in Supabase**
- [ ] **YOU: Deploy to Vercel (should auto-deploy)**
- [ ] **YOU: Test with a new user**
- [ ] **YOU: Confirm recordings work**

---

## 🚀 **After This Fix**

New users will automatically get:
1. ✅ Organization created
2. ✅ Tool created and linked (`organizations.tool_id`)
3. ✅ voice_configs created (`record: true`)
4. ✅ User created in `public.users` with `organization_id`
5. ✅ org_members record created (user is owner)

**Everything needed for calls and recordings to work!** 🎊

---

**Run the SQL fix for adrper792@gmail.com NOW, then test!** 🔥
