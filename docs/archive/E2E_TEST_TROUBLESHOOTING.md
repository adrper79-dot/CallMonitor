# E2E Test Troubleshooting Guide

**Issue:** `execute_call` step failing in E2E test  
**Error:** `[object Object]` (error not properly serialized)

---

## 🔍 Diagnostic Steps

### Step 1: Check Vercel Logs

The most detailed error information will be in Vercel logs:

```powershell
# Real-time logs
vercel logs https://voxsouth.online --follow

# Or check recent logs
vercel logs https://voxsouth.online
```

Look for errors related to:
- `startCallHandler`
- `SignalWire`
- `SIGNALWIRE_PROJECT_ID`
- `SIGNALWIRE_TOKEN`

---

### Step 2: Verify SignalWire Environment Variables

Run this in Vercel dashboard or via SQL:

```sql
-- Check which env vars are configured (run in Supabase)
SELECT 
  '1. SIGNALWIRE_PROJECT_ID' as var_name,
  CASE WHEN current_setting('app.signalwire_project_id', true) IS NOT NULL 
    THEN '✅ Set' ELSE '❌ Missing' END as status;
```

Required SignalWire variables:
- `SIGNALWIRE_PROJECT_ID` - Your SignalWire project ID
- `SIGNALWIRE_TOKEN` (or `SIGNALWIRE_API_TOKEN`) - Auth token
- `SIGNALWIRE_SPACE` - Your space URL (e.g., `example.signalwire.com`)
- `SIGNALWIRE_NUMBER` - From number for calls (e.g., `+15551234567`)

---

### Step 3: Check Environment Variables in Vercel

1. Go to Vercel → Your Project → Settings → Environment Variables
2. Verify these are set:

| Variable | Example | Status |
|----------|---------|--------|
| `SIGNALWIRE_PROJECT_ID` | `a1b2c3d4-...` | Required |
| `SIGNALWIRE_TOKEN` | `PT...` | Required |
| `SIGNALWIRE_SPACE` | `yourspace.signalwire.com` | Required |
| `SIGNALWIRE_NUMBER` | `+17062677235` | Required |
| `SERVICE_API_KEY` | `sk_e2e_...` | Required for E2E test |

---

### Step 4: Test with Enhanced Error Details

I've updated the E2E endpoint and test script to show full error details. Redeploy and run:

```powershell
# After redeploying
$env:SERVICE_API_KEY = "sk_e2e_7x9kM2pL5qR8wT1yU4vN6bC3dF0gH"
node scripts/live-e2e-authenticated.js 143a4ad7-403c-4933-a0e6-553b05ca77a2
```

Now you should see detailed error messages instead of `[object Object]`.

---

## 🐛 Common Issues

### Issue 1: SignalWire Credentials Missing

**Error:** "SignalWire project ID required" or similar

**Fix:**
1. Check Vercel env vars are set
2. Redeploy after adding/changing env vars
3. Verify in Vercel logs

### Issue 2: Organization Not Found

**Error:** "Organization not found: [uuid]"

**Fix:**
Run this SQL to verify org exists:
```sql
SELECT id, name, plan FROM organizations 
WHERE id = '143a4ad7-403c-4933-a0e6-553b05ca77a2';
```

### Issue 3: No Owner User Found

**Error:** Errors related to `ownerId` being null

**Fix:**
Run this SQL to verify ownership:
```sql
SELECT om.user_id, om.role, u.email
FROM org_members om
JOIN users u ON om.user_id = u.id
WHERE om.organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2'
AND om.role = 'owner';
```

If empty, add yourself as owner:
```sql
INSERT INTO org_members (id, organization_id, user_id, role)
SELECT gen_random_uuid(), '143a4ad7-403c-4933-a0e6-553b05ca77a2', u.id, 'owner'
FROM users u 
WHERE u.email = 'stepdadstrong@gmail.com'
ON CONFLICT DO NOTHING;
```

---

## 📊 Test with Direct API Call

If the script still fails, test the endpoint directly:

```powershell
# Test E2E endpoint is reachable
curl https://voxsouth.online/api/test/e2e

# Expected response:
# {
#   "success": true,
#   "message": "E2E Test endpoint ready",
#   "service_key_configured": true,
#   "available_actions": [...]
# }
```

---

## 🔧 Next Steps

1. ✅ Deploy updated code (improved error messages)
2. ⏳ Check Vercel logs for the real error
3. ⏳ Run test again with detailed output
4. ⏳ Share the full error message for further diagnosis

**Updated code includes better error serialization - deploy and retest!**
