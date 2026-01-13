# Database Cleanup Instructions

**Date:** January 13, 2026  
**Purpose:** Delete all users and organizations to start fresh

---

## ⚠️ **WARNING**

This will delete **ALL** user data including:
- ✅ All users (auth + public)
- ✅ All organizations
- ✅ All calls and recordings
- ✅ All AI runs and transcriptions
- ✅ All voice configs
- ✅ All tools

**Users will need to sign up again from scratch!**

---

## 📋 **Instructions**

### **Option 1: Full Cleanup (Recommended)**

1. Open Supabase Dashboard → SQL Editor
2. Copy/paste contents of `CLEANUP_ALL_USERS_AND_ORGS.sql`
3. Click **Run**
4. Wait for completion (~30 seconds)
5. Verify all counts show `0`

### **Option 2: Keep Specific Users**

If you want to keep certain admin users, modify the cleanup script:

```sql
-- Instead of:
DELETE FROM auth.users;

-- Use:
DELETE FROM auth.users 
WHERE email NOT IN ('admin@yourcompany.com', 'keep@example.com');
```

---

## ✅ **After Cleanup**

1. **Database is clean** ✅
2. **All tables empty** ✅
3. **Ready for new signups** ✅

### **Test New Signup Flow:**

1. Go to your app
2. Sign up with a new user (e.g., `test001@gmail.com`)
3. Should work perfectly with all fixes applied
4. Verify in database:

```sql
SELECT 
  u.email,
  u.organization_id IS NOT NULL as has_org,
  o.tool_id IS NOT NULL as has_tool,
  vc.record as recording_enabled
FROM users u
JOIN organizations o ON o.id = u.organization_id
JOIN voice_configs vc ON vc.organization_id = o.id
WHERE u.email = 'test001@gmail.com';

-- Expected: has_org=true, has_tool=true, recording_enabled=true
```

4. Make a test call
5. Verify recording:

```sql
SELECT 
  c.call_sid,
  r.recording_url IS NOT NULL as has_recording
FROM calls c
LEFT JOIN recordings r ON r.call_sid = c.call_sid
ORDER BY c.started_at DESC
LIMIT 1;

-- Expected: has_recording=true
```

---

## 🎯 **What Happens Next**

With all fixes deployed:

1. ✅ New users signup → Creates org + tool + voice_configs
2. ✅ User can login → No 500 errors
3. ✅ User makes call → Recording works (all call types)
4. ✅ Recording appears in database
5. ✅ Everything just works!

---

**Run `CLEANUP_ALL_USERS_AND_ORGS.sql` when ready!** 🚀
