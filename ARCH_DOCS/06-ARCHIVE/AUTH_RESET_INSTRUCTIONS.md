# 🔧 Authentication Reset Instructions

## Problem
Users cannot log in - getting "Invalid login credentials" error.

## Root Cause
Users exist in the database but passwords are not properly set or have been lost.

## Solution
Use the provided script to reset users and create fresh test accounts.

---

## Quick Fix (5 minutes)

### Step 1: Open PowerShell in project directory

```powershell
cd "c:\Users\Ultimate Warrior\My project\gemini-project"
```

### Step 2: Run the reset script

```powershell
# Set environment variables
$env:SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpaWpyaHBqcGViZXZmYXZ6bGh1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM3MzIzMCwiZXhwIjoyMDgyOTQ5MjMwfQ.9EFplzv1rMmJ7YwCP5efc4t0BDxuddkqMm0_RH_7_tU"
$env:NEXT_PUBLIC_SUPABASE_URL="https://fiijrhpjpebevfavzlhu.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_lRUy5ZWTCzCNPTuOP9K9Rg_Nh-nEClF"

# Clear old data and create fresh test users
node scripts/reset-auth-users.js --clear --create
```

### Step 3: When prompted, type "yes" to confirm clearing users

### Step 4: Test login

**Test Credentials:**
- **Email:** `admin@callmonitor.local`
- **Password:** `Word Is Bond2026!`

OR

- **Email:** `user@callmonitor.local`
- **Password:** `Word Is Bond2026!`

---

## Script Options

### List current users (no changes)
```bash
node scripts/reset-auth-users.js
```

### Clear all users and organizations
```bash
node scripts/reset-auth-users.js --clear
```

### Create test users (without clearing)
```bash
node scripts/reset-auth-users.js --create
```

### Full reset (recommended)
```bash
node scripts/reset-auth-users.js --clear --create
```

---

## What the script does

1. **Lists all current users** in auth.users table
2. **Clears all data** (if --clear flag used):
   - Deletes all auth.users
   - Deletes all organizations
   - Deletes all org_members
   - Deletes all public.users
3. **Creates test users** (if --create flag used):
   - Creates 2 users in auth.users with proper passwords
   - Creates 1 test organization
   - Links users to organization
   - Creates org_members entries
4. **Tests authentication** to verify it works

---

## Current Database State

### Users found (5):
1. `adrper79@gmail.com` - Last login: 2026-01-12
2. `stepdadstrong@gmail.com` - Last login: 2026-01-09
3. `admin02@callmonitor.local` - Never logged in
4. `admin01@callmonitor.local` - Last login: 2026-01-09
5. `admin@callmonitor.local` - Last login: 2026-01-07

### Organizations found (5+):
- Multiple test organizations exist
- Need cleanup

**Recommendation:** Clear everything and start fresh with known credentials.

---

## ⚠️ IMPORTANT: Security Issues Found

### Critical Issue: No Row Level Security (RLS)
The database tables do NOT have RLS policies enabled. This means:
- Users can potentially access other organizations' data
- No proper data isolation
- Security vulnerability

**This needs to be fixed ASAP after authentication is working.**

See `ARCH_DOCS/archive/fixes/AUTH_DIAGNOSIS_JAN_2026.md` for full details.

---

## Need Help?

### If script fails:
1. Check that Node.js is installed: `node --version`
2. Check that dependencies are installed: `npm install`
3. Verify environment variables are set correctly
4. Check Supabase is accessible: `curl https://fiijrhpjpebevfavzlhu.supabase.co`

### If authentication still fails after reset:
1. Check browser console for errors
2. Verify `.env.local` has correct values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
3. Check NextAuth configuration in `app/api/auth/[...nextauth]/route.ts`

---

## Files Modified/Created

- ✅ Created `scripts/reset-auth-users.js` - Reset script
- ✅ Created `ARCH_DOCS/archive/fixes/AUTH_DIAGNOSIS_JAN_2026.md` - Full diagnosis
- ✅ Created `AUTH_RESET_INSTRUCTIONS.md` - This file

---

## Next Steps After Reset

1. ✅ Verify authentication works
2. ⚠️ **CRITICAL:** Implement RLS policies
3. 🔒 Add password reset functionality
4. 👤 Build user management UI
5. 📝 Update ARCH_DOCS with auth architecture

---

**Date:** January 11, 2026  
**Created by:** AI Assistant  
**Script location:** `scripts/reset-auth-users.js`
