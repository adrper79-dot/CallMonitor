# 🚀 QUICK START - Fix Authentication NOW

## Problem
Cannot log in to CallMonitor - getting "Invalid login credentials"

## Solution (5 minutes)

### 1. Open PowerShell and navigate to project:
```powershell
cd "c:\Users\Ultimate Warrior\My project\gemini-project"
```

### 2. Copy-paste this entire block:
```powershell
$env:SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpaWpyaHBqcGViZXZmYXZ6bGh1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM3MzIzMCwiZXhwIjoyMDgyOTQ5MjMwfQ.9EFplzv1rMmJ7YwCP5efc4t0BDxuddkqMm0_RH_7_tU"
$env:NEXT_PUBLIC_SUPABASE_URL="https://fiijrhpjpebevfavzlhu.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_lRUy5ZWTCzCNPTuOP9K9Rg_Nh-nEClF"
node scripts/reset-auth-users.js --clear --create
```

### 3. When asked "Are you sure?", type: `yes`

### 4. Wait for completion message

### 5. Login with:
- **Email:** `admin@callmonitor.local`
- **Password:** `CallMonitor2026!`

## ⚠️ CRITICAL: Apply Security Fix

After authentication works, run this SQL in Supabase Dashboard:

**Go to:** https://supabase.com/dashboard/project/fiijrhpjpebevfavzlhu/sql  
**Copy contents of:** `migrations/2026-01-11-add-rls-policies.sql`  
**Execute it**

Without this, users can access each other's data!

---

## Alternative Credentials
- **Email:** `user@callmonitor.local`
- **Password:** `CallMonitor2026!`

---

## Need More Info?
See `AUTH_RESET_INSTRUCTIONS.md` for detailed guide.

## Still Not Working?
Check `AUTH_RESET_SUMMARY.md` for troubleshooting.
