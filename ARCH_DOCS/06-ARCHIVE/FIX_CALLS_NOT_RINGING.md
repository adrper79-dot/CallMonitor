# 🔴 URGENT FIX: Calls Not Ringing

## ❌ **The Problem**

Your calls aren't ringing because **`SIGNALWIRE_NUMBER` environment variable is missing in Vercel**.

From your logs:
```
from_number: undefined  ← Missing SignalWire phone number!
```

---

## ✅ **The Fix (5 minutes)**

### **Step 1: Go to Vercel Dashboard**
1. Open https://vercel.com/dashboard
2. Select your project
3. Click **Settings** → **Environment Variables**

### **Step 2: Add Missing Variable**
```
Key:   SIGNALWIRE_NUMBER
Value: +15551234567         ← Your actual SignalWire phone number!
```

**Important:**
- Format must be E.164: `+1XXXXXXXXXX`
- Must match a number you own in SignalWire
- Apply to: **Production, Preview, Development**

### **Step 3: Redeploy**
After saving, Vercel will prompt you to redeploy.
Click **"Redeploy"** or run:
```bash
vercel --prod
```

### **Step 4: Test**
- Go to your app
- Try making a call
- Phone should ring! 📞

---

## 🔍 **Find Your SignalWire Number**

### **Option 1: SignalWire Dashboard**
1. Go to https://your-space.signalwire.com
2. Click **Phone Numbers** in left sidebar
3. Copy your number (format: `+1XXXXXXXXXX`)

### **Option 2: Check Local .env**
```bash
grep SIGNALWIRE_NUMBER .env
# Copy the value from here
```

---

## ✅ **Complete Environment Variable Checklist**

Make sure ALL these are set in Vercel:

```bash
# SignalWire (ALL REQUIRED!)
SIGNALWIRE_PROJECT_ID=your-project-id        ✓
SIGNALWIRE_TOKEN=PTxxx-your-token           ✓
SIGNALWIRE_SPACE=your-space-name            ✓
SIGNALWIRE_NUMBER=+15551234567              ✗ ← ADD THIS!

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# App
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NODE_ENV=production

# NextAuth
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=https://your-app.vercel.app
```

---

## 🐛 **Improved Error Messages**

I also improved the error handling in `startCallHandler.ts` to make this more obvious:

**Before:**
```
❌ "SignalWire credentials missing"  (vague!)
```

**After:**
```
❌ CRITICAL: SignalWire config missing: SIGNALWIRE_NUMBER
```

Now the logs will tell you exactly which variable is missing!

---

## 📊 **Verification**

After deploying, check Vercel logs:

**✅ GOOD:**
```
startCallHandler: sending SignalWire POST { 
  endpoint: 'https://...', 
  to: '+17062677235', 
  from: '+15551234567'  ← Should show your number!
}
```

**❌ BAD:**
```
❌ CRITICAL: SignalWire config missing: SIGNALWIRE_NUMBER
from: undefined
```

---

## 🎯 **Why This Happened**

Your code expects `env.SIGNALWIRE_NUMBER` (line 67 of startCallHandler.ts):
```typescript
const swNumber = env.SIGNALWIRE_NUMBER  // ← This was undefined!
```

Without it:
- SignalWire doesn't know what number to call FROM
- Call initiation fails silently
- Phone never rings

---

## 📞 **Quick Test**

After fixing, test locally first:

```bash
# In terminal:
curl -X POST http://localhost:3000/api/voice/call \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "00000000-0000-0000-0000-000000000000",
    "phone_number": "+15555555555",
    "modulations": {"record": true}
  }'

# Should return:
{"success": true, "call_id": "..."}
```

---

## 🚀 **Summary**

1. **Add** `SIGNALWIRE_NUMBER=+1XXXXXXXXXX` to Vercel
2. **Redeploy** your app
3. **Test** a call
4. **Done!** Phone should ring 📞

---

**Issue:** Missing `SIGNALWIRE_NUMBER` environment variable  
**Impact:** All outbound calls failing  
**Fix Time:** 5 minutes  
**Status:** Ready to fix!

---

**For detailed troubleshooting:** See `ARCH_DOCS/archive/fixes/SIGNALWIRE_NUMBER_MISSING.md`
