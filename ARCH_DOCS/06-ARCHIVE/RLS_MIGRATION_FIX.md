# RLS Migration Fix - Table Not Found Error

**Error:** `relation "public.voice_targets" does not exist`  
**Cause:** Original migration tried to apply RLS to optional tables that don't exist yet  
**Solution:** Use the **safe version** of the migration

---

## ✅ **FIXED - Use This File**

**New Migration File:** `migrations/2026-01-11-add-rls-policies-safe.sql`

**What's Different:**
- ✅ Applies RLS to **9 core tables** (required)
- ✅ **Conditionally** applies RLS to optional tables (if they exist)
- ✅ Uses `DROP POLICY IF EXISTS` (can be re-run safely)
- ✅ Includes success message at the end

---

## 🚀 **How to Apply (Choose One)**

### Option 1: Supabase Dashboard (Easiest)
1. Go to: https://supabase.com/dashboard/project/fiijrhpjpebevfavzlhu
2. Click: **SQL Editor**
3. Click: **"+ New query"**
4. **Copy & Paste** entire contents of:  
   `migrations/2026-01-11-add-rls-policies-safe.sql`
5. Click: **"Run"**
6. ✅ Should show "Success" and a notice: "RLS Migration Complete!"

### Option 2: Command Line
```bash
psql $DATABASE_URL < migrations/2026-01-11-add-rls-policies-safe.sql
```

---

## 📋 **Core Tables Protected (Always)**

These 9 tables will have RLS enabled:
1. ✅ `users`
2. ✅ `organizations`
3. ✅ `org_members`
4. ✅ `calls`
5. ✅ `recordings`
6. ✅ `ai_runs`
7. ✅ `evidence_manifests`
8. ✅ `voice_configs`
9. ✅ `audit_logs`

---

## 🔍 **Optional Tables (If They Exist)**

The migration will automatically detect and protect these if they exist:
- `voice_targets`
- `campaigns`
- `surveys`
- `scorecards`
- `scored_recordings`
- `test_configs`
- `test_results`
- `monitored_numbers`
- `kpi_logs`
- `test_statistics`

---

## ✅ **Verification**

After applying, run this in SQL Editor to verify:

```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'organizations', 'org_members', 'calls', 'recordings', 'ai_runs', 'evidence_manifests', 'voice_configs', 'audit_logs')
ORDER BY tablename;
```

**Expected:** All 9 core tables show `rowsecurity = true`

---

## 🔒 **What RLS Does**

**Row Level Security** ensures:
- ✅ Users only see their organization's data
- ✅ Cannot access other organizations' calls/recordings
- ✅ Prevents SQL injection data leaks
- ✅ Organization-level data isolation

**Critical for production!** Without RLS:
- ❌ User A can see User B's calls
- ❌ Organization data exposed across orgs
- ❌ Major security vulnerability

---

## 📝 **Policy Summary**

### Users Table
- Can view their own record
- Can view users in their org
- Can update their own record
- Only admins can create/delete users

### Organizations Table
- Can view their own org
- Admins can view all orgs
- Owners can update their org
- Only admins can create orgs

### Calls & Recordings
- Can only view/create calls in their org
- Webhooks can insert (system operations)

### Audit Logs
- Can view logs for their org only
- System can always insert (for tracking)

---

## 🎯 **Next Steps**

1. **Apply the safe migration** (5 minutes)
2. **Verify RLS is enabled** (1 minute)
3. **Test your app** - should work normally
4. **🎉 Production ready!**

---

## ⚠️ **Troubleshooting**

### If Migration Fails:
- Check you're using the **-safe** version
- Ensure you have Supabase service role permissions
- Try running via SQL Editor instead of psql

### If App Breaks After RLS:
- Your app likely uses **anon key** somewhere it should use **service role key**
- Check API routes - they should use `supabaseAdmin` not `supabase`
- Webhooks MUST use service role key (they already do)

### To Temporarily Disable RLS (Testing Only):
```sql
ALTER TABLE public.calls DISABLE ROW LEVEL SECURITY;
-- Test your app
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
-- Re-enable when done
```

---

**Status:** ✅ **READY TO APPLY**  
**File:** `migrations/2026-01-11-add-rls-policies-safe.sql`  
**Time:** ~5 minutes  
**Risk:** Low (safe version, conditional checks)
