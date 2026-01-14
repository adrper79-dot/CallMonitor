# 🚨 CRITICAL BUG: New Users Not Getting organization_id

**Date:** January 12, 2026  
**Severity:** CRITICAL - Blocks all core functionality  
**Impact:** New users cannot make calls or create recordings

---

## 🔍 **ROOT CAUSE IDENTIFIED**

### **The Bug:**

In `app/api/auth/signup/route.ts`, lines 136-166:

```typescript
// Create user in public.users
if (orgId) {  // ← BUG IS HERE
  const { error: userError } = await supabase
    .from('users')
    .insert({
      id: data.id,
      email: data.email,
      organization_id: orgId,
      role: 'member',
      is_admin: false
    })
  // ...
}
```

**Problem:** User is ONLY created in `public.users` if `orgId` exists.

**But on lines 127-132:**
```typescript
if (orgError) {
  console.error('Failed to create organization:', orgError)
  // Continue without org - we'll handle this gracefully
} else {
  orgId = newOrg.id
}
```

**If organization creation fails, `orgId` stays NULL, so:**
- ❌ User is created in `auth.users` (line 57-71)
- ❌ But NOT created in `public.users` (skipped because `orgId` is null)
- ✅ Signup returns success anyway (line 169-176)

---

## 💥 **CONSEQUENCES**

### **What Happens When User Tries to Make a Call:**

1. **User signs up** → `auth.users` entry created
2. **Organization creation fails** → `orgId` = null
3. **`public.users` insert skipped** → No user record
4. **User logs in successfully** → Session shows authenticated user
5. **User tries to start call** → ❌ FAILS

**Why calls fail:**
```typescript
// In startCallHandler.ts, the call is inserted:
await supabase.from('calls').insert({
  organization_id: session.user.organization_id,  // ← NULL!
  // ...
})
```

**Schema constraint:**
```sql
-- From Schema.txt line 90
CONSTRAINT calls_organization_id_fkey FOREIGN KEY (organization_id) 
  REFERENCES public.organizations(id)
```

If `organization_id` is NULL or invalid, the call insert fails!

---

### **Why Recordings Fail:**

Even if call somehow works, recordings REQUIRE:

```sql
-- From Schema.txt lines 263-272
recordings (
  organization_id uuid NOT NULL,  -- ← REQUIRED
  tool_id uuid NOT NULL,           -- ← REQUIRED
  // ...
)
```

**Both are NULL for users without organization!**

---

## 🎯 **REQUIRED FIXES**

### **Fix #1: Never Allow Signup Without Organization**

```typescript
// In app/api/auth/signup/route.ts

// After organization creation (line 116-132)
if (!orgId) {
  // ❌ FAIL THE SIGNUP
  return NextResponse.json(
    { 
      success: false, 
      error: { 
        code: 'ORG_CREATION_FAILED', 
        message: 'Failed to create organization. Please try again.' 
      } 
    },
    { status: 500 }
  )
}

// Create user in public.users (no more if(orgId) check!)
const { error: userError } = await supabase
  .from('users')
  .insert({
    id: data.id,
    email: data.email,
    organization_id: orgId,  // ← Now guaranteed to exist
    role: 'member',
    is_admin: false
  })

if (userError) {
  console.error('Failed to create user in public.users:', userError)
  return NextResponse.json(
    { success: false, error: { code: 'USER_CREATION_FAILED', message: 'Failed to create user record' } },
    { status: 500 }
  )
}
```

---

### **Fix #2: Create Default Tool for New Organization**

```typescript
// After creating organization (line 116-132)
if (newOrg) {
  orgId = newOrg.id
  
  // Create default tool for this organization
  const { data: tool, error: toolError } = await supabase
    .from('tools')
    .insert({
      name: `${name || email}'s Recording Tool`,
      type: 'recording',
      organization_id: orgId,
      created_by: data.id
    })
    .select('id')
    .single()
  
  if (tool) {
    // Link tool to organization
    await supabase
      .from('organizations')
      .update({ tool_id: tool.id })
      .eq('id', orgId)
  }
}
```

**Why this matters:**
- Recordings REQUIRE `tool_id` (NOT NULL constraint)
- Organization needs `tool_id` to enable recording features
- Without tool, webhook skips recording creation (line 259-262 in signalwire webhook)

---

### **Fix #3: Add Diagnostic Logging**

```typescript
console.log('Signup: created organization', { orgId, email })
console.log('Signup: created tool', { toolId: tool?.id, orgId })
console.log('Signup: created user in public.users', { userId: data.id, orgId })
```

---

### **Fix #4: Fix NextAuth Callback (Same Issue)**

In `app/api/auth/[...nextauth]/route.ts`, lines 202-228 have the SAME bug:

```typescript
if (!existingUser) {
  // Get or create organization
  let orgId: string | null = null
  
  // ... (lines 206-227)
  
  if (orgId) {  // ← SAME BUG
    // Create user in public.users
  }
}
```

Apply same fix here!

---

## 🧪 **TEST SCENARIOS**

### **Test #1: New User Signup**
```bash
# Create new user
POST /api/auth/signup
{
  "email": "newuser@test.com",
  "password": "Test1234!",
  "name": "New User"
}

# Expected:
✅ User created in auth.users
✅ Organization created
✅ Tool created and linked to organization
✅ User created in public.users with organization_id
✅ org_members entry created
```

### **Test #2: Verify Database**
```sql
-- Check user has organization
SELECT u.id, u.email, u.organization_id, o.name, o.tool_id
FROM users u
JOIN organizations o ON o.id = u.organization_id
WHERE u.email = 'newuser@test.com';

-- Expected: organization_id and tool_id are NOT NULL
```

### **Test #3: User Can Make Call**
```
1. Login as new user
2. Start a call
3. Expected: Call starts successfully, records, creates transcript
```

---

## 📊 **BEFORE vs AFTER**

### **BEFORE (Current Bug):**
```
User Signup
  ↓
Create auth.users ✅
  ↓
Try create organization
  ↓ (fails)
orgId = null ❌
  ↓
Skip public.users insert (if orgId check fails) ❌
  ↓
Return success ✅ (lies!)
  ↓
User tries to make call → FAILS ❌
```

### **AFTER (Fixed):**
```
User Signup
  ↓
Create auth.users ✅
  ↓
Create organization
  ↓ (if fails → return error, stop signup)
orgId exists ✅
  ↓
Create tool for organization ✅
  ↓
Link tool_id to organization ✅
  ↓
Create public.users with organization_id ✅
  ↓ (if fails → return error)
Return success ✅ (truthful!)
  ↓
User can make calls → WORKS ✅
User can create recordings → WORKS ✅
```

---

## 🚀 **DEPLOYMENT CHECKLIST**

- [ ] Fix signup route (`app/api/auth/signup/route.ts`)
- [ ] Fix NextAuth callback (`app/api/auth/[...nextauth]/route.ts`)
- [ ] Add tool creation logic
- [ ] Add error handling (never return success on failure)
- [ ] Add logging
- [ ] Test with new user signup
- [ ] Verify database entries
- [ ] Test call creation
- [ ] Test recording creation
- [ ] Deploy to production
- [ ] Monitor logs for signup errors

---

## 💡 **WHY THIS BUG WENT UNNOTICED**

1. **Test users** were likely created via scripts that properly set `organization_id`
2. **First users** might have signed up when code was different
3. **Silent failure** - signup returns success even though it failed
4. **Cascading failures** - other features fail but don't point to missing org

---

## ✅ **SUMMARY**

**Bug:** User created in `auth.users` but not `public.users` when org creation fails  
**Impact:** All functionality broken (calls, recordings, everything)  
**Fix:** Never allow signup to succeed without organization + tool  
**Priority:** CRITICAL - Fix immediately

**This bug explains why recordings aren't working!**
