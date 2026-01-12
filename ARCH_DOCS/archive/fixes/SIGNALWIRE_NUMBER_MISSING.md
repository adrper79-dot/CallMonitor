# 🔴 URGENT: Calls Not Ringing - Missing Environment Variable

## ❌ **Problem**

Outbound calls are failing because `SIGNALWIRE_NUMBER` environment variable is **not configured in Vercel**.

### **Log Evidence:**
```
from_number: undefined  ← This is the optional input parameter
```

The actual SignalWire number comes from `env.SIGNALWIRE_NUMBER` (line 67 of startCallHandler.ts), which is missing.

---

## ✅ **Solution**

### **1. Set Environment Variable in Vercel**

Go to Vercel Dashboard:
1. Open your project
2. Go to **Settings** → **Environment Variables**
3. Add **`SIGNALWIRE_NUMBER`**
4. Value: Your SignalWire phone number (E.164 format)
   - Example: `+15551234567`
5. Apply to: **Production, Preview, Development**
6. Click **Save**

### **2. Required SignalWire Environment Variables**

Make sure ALL of these are set in Vercel:

```bash
# SignalWire Account
SIGNALWIRE_PROJECT_ID=your-project-id
SIGNALWIRE_TOKEN=PTxxx-your-token
SIGNALWIRE_SPACE=your-space-name.signalwire.com
SIGNALWIRE_NUMBER=+15551234567    # ← MISSING!

# App URL (for webhooks)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

---

## 🔍 **How to Find Your SignalWire Number**

### **Option A: SignalWire Dashboard**
1. Go to https://your-space.signalwire.com
2. Click **Phone Numbers** in left menu
3. Copy your purchased number (should start with `+1`)

### **Option B: Check Local .env**
```bash
# Look in your local .env file
grep SIGNALWIRE_NUMBER .env
```

### **Option C: SignalWire API**
```bash
curl -X GET \
  "https://your-space.signalwire.com/api/laml/2010-04-01/Accounts/your-project-id/IncomingPhoneNumbers.json" \
  -u "your-project-id:your-token"
```

---

## 🚨 **Why This Happened**

Looking at your code:
1. **Line 67** in `startCallHandler.ts`:
   ```typescript
   const swNumber = env.SIGNALWIRE_NUMBER  // ← This is undefined!
   ```

2. **Line 71** checks if it's missing:
   ```typescript
   if (!(swProject && swToken && swSpace && swNumber)) {
     if (env.NODE_ENV === 'production') {
       throw new AppError({ code: 'SIGNALWIRE_CONFIG_MISSING', ... })
     }
   }
   ```

3. **In production**, this should throw an error
4. **But you're not seeing it** - which means either:
   - The error is being caught somewhere
   - OR `NODE_ENV` isn't set to 'production'

---

## 🔧 **Immediate Fix Steps**

### **Step 1: Add Environment Variable**
```bash
# In Vercel Dashboard:
SIGNALWIRE_NUMBER=+15551234567  # Your actual SignalWire number
```

### **Step 2: Redeploy**
After adding the environment variable, Vercel will prompt you to redeploy. Click **Redeploy**.

**OR** manually redeploy:
```bash
vercel --prod
```

### **Step 3: Test**
1. Go to your app: `https://your-app.vercel.app`
2. Enter a phone number
3. Click "Start Call"
4. Phone should ring! 📞

---

## ✅ **Verification Checklist**

After deploying, verify:

- [ ] `SIGNALWIRE_NUMBER` is set in Vercel
- [ ] Value starts with `+` (E.164 format)
- [ ] Value matches a number you own in SignalWire
- [ ] All other SignalWire env vars are set
- [ ] `NEXT_PUBLIC_APP_URL` points to your Vercel URL
- [ ] App redeployed after adding env var
- [ ] Test call rings successfully

---

## 🐛 **Additional Debugging**

### **Check Vercel Logs:**
```bash
vercel logs --follow
```

Look for:
- ✅ **GOOD:** `startCallHandler: sending SignalWire POST`
- ❌ **BAD:** `SIGNALWIRE_CONFIG_MISSING`
- ❌ **BAD:** `from: undefined` in SignalWire POST

### **Check SignalWire Dashboard:**
1. Go to **Activity** → **Call Logs**
2. Look for recent attempts
3. Check failure reasons

### **Test Locally:**
```bash
# Make sure .env has SIGNALWIRE_NUMBER
npm run dev

# Try a test call
curl -X POST http://localhost:3000/api/voice/call \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "00000000-0000-0000-0000-000000000000",
    "phone_number": "+15555555555",
    "modulations": {"record": true}
  }'
```

---

## 📝 **Example .env (for reference)**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# SignalWire (ALL required!)
SIGNALWIRE_PROJECT_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890
SIGNALWIRE_TOKEN=PTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SIGNALWIRE_SPACE=your-space-name
SIGNALWIRE_NUMBER=+15551234567    # ← ADD THIS!

# App
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NODE_ENV=production

# NextAuth
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=https://your-app.vercel.app

# Optional
TRANSLATION_LIVE_ASSIST_PREVIEW=true
ASSEMBLYAI_API_KEY=your-key
```

---

## 🎯 **Quick Fix Summary**

**Problem:** `SIGNALWIRE_NUMBER` not set in Vercel  
**Solution:** Add it in Vercel Dashboard → Environment Variables  
**Value:** Your SignalWire phone number (e.g., `+15551234567`)  
**After:** Redeploy and test!

---

## 📞 **Support**

**Still not working?**
1. Check Vercel logs: `vercel logs --follow`
2. Check SignalWire dashboard for error details
3. Verify all 4 SignalWire env vars are set
4. Ensure number format is `+1XXXXXXXXXX` (E.164)
5. Confirm number is active in SignalWire

---

**Created:** January 12, 2026  
**Status:** 🔴 Critical - Blocking outbound calls  
**Priority:** URGENT - Fix immediately!
