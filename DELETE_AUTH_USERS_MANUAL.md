# Manual Authentication User Deletion

**Issue:** Cannot delete users from Supabase Authentication via SQL

---

## 🔧 **Option 1: Delete via Supabase Dashboard (Easiest)**

### **Steps:**

1. Go to **Supabase Dashboard**
2. Navigate to **Authentication → Users**
3. Find each user you want to delete
4. Click the **⋮** menu next to the user
5. Click **Delete User**
6. Confirm deletion

**This bypasses SQL and uses the Supabase Admin API directly.**

---

## 🔧 **Option 2: Use Supabase Admin API**

If dashboard method doesn't work, use the REST API:

```bash
# Get your service role key
# From Supabase Dashboard → Settings → API

# Delete a user
curl -X DELETE \
  'https://YOUR_PROJECT.supabase.co/auth/v1/admin/users/USER_ID' \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

**Replace:**
- `YOUR_PROJECT` with your Supabase project ID
- `USER_ID` with the user's UUID
- `YOUR_SERVICE_ROLE_KEY` with your service role key

---

## 🔧 **Option 3: Clean Public Tables Only (Recommended)**

If you can't delete auth users, just clean the public tables:

**Use:** `CLEANUP_PUBLIC_TABLES_ONLY.sql`

**What this does:**
- ✅ Deletes all application data (calls, recordings, etc.)
- ✅ Deletes all organizations
- ✅ Deletes all public.users records
- ❌ Leaves auth.users intact

**When users login again:**
- They'll go through the login flow
- New records will be created (org, tool, voice_configs)
- They'll have a fresh account

---

## 🎯 **Which Option to Use?**

### **If you want to delete specific auth accounts:**
→ Use **Option 1** (Supabase Dashboard)

### **If you want to start completely fresh:**
→ Use **Option 1** (Dashboard) to delete auth users first
→ Then run `CLEANUP_ALL_USERS_AND_ORGS.sql`

### **If you can't delete auth users at all:**
→ Use **Option 3** (`CLEANUP_PUBLIC_TABLES_ONLY.sql`)
→ Auth users remain but all app data is deleted
→ They can login again and get fresh accounts

---

## 📋 **List of adr* Accounts to Delete**

From your earlier messages:
1. `adrper791@gmail.com` (ID: `c682240c-10ee-4d38-b6cc-25ef910e8f13`)
2. `adrper792@gmail.com` (ID: `abccc4d0-4eab-4352-b326-008de7568f50`)

---

## 🚀 **Recommended Approach**

1. **Try Supabase Dashboard** (Option 1)
   - Go to Authentication → Users
   - Delete both adr* accounts manually
   - Usually works when SQL doesn't

2. **If that fails, use Option 3**
   - Run `CLEANUP_PUBLIC_TABLES_ONLY.sql`
   - Keeps auth accounts but wipes all data
   - Fresh start when they login again

3. **Wait for Vercel deployment** (~2 minutes)

4. **Test signup with new user**
   - Should work perfectly with all fixes!

---

**Try the Supabase Dashboard method first!** 🎯
