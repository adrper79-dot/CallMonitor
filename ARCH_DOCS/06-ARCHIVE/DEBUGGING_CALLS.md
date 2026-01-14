# 🔍 Debugging: Calls Still Not Ringing (Despite SIGNALWIRE_NUMBER Being Set)

## 📊 **Current Situation**

**Environment Variable:** ✅ Set correctly
```
SIGNALWIRE_NUMBER=+12027711933
```

**Logs Show:**
```javascript
from_number: undefined,  // ← This is just the optional input param (OK!)
phone_number: '+17062677235'
```

**Problem:** Phone still isn't ringing

---

## 🔍 **Need More Log Details**

The logs you shared only show the **input parameters**. We need to see if SignalWire is actually being called.

### **Look for these log lines in Vercel:**

1. **SignalWire POST attempt:**
   ```
   startCallHandler: sending SignalWire POST {
     endpoint: 'https://...',
     to: '+17062677235',
     from: '+12027711933'  ← Should show your number!
   }
   ```

2. **SignalWire response:**
   ```
   startCallHandler: SignalWire responded { sid: '[REDACTED]' }
   ```

3. **OR errors:**
   ```
   ❌ SignalWire POST failed { status: 400, body: '...' }
   ❌ SIGNALWIRE_FETCH_FAILED
   ❌ CRITICAL: SignalWire config missing: ...
   ```

---

## 🚨 **Possible Issues**

### **1. Missing or Wrong SignalWire Credentials**

Check ALL these in Vercel:

```bash
SIGNALWIRE_PROJECT_ID=your-project-id      # ← Check this!
SIGNALWIRE_TOKEN=PTxxx                     # ← Check this!
SIGNALWIRE_SPACE=your-space-name           # ← Check this!
SIGNALWIRE_NUMBER=+12027711933             # ✅ You have this

NEXT_PUBLIC_APP_URL=https://your-app.vercel.app  # ← Check this!
```

**Common mistakes:**
- `SIGNALWIRE_SPACE` should be just the space name (e.g., `myspace`), NOT the full URL
- `SIGNALWIRE_TOKEN` must start with `PT`
- `NEXT_PUBLIC_APP_URL` must match your actual Vercel URL

### **2. Number Not Active in SignalWire**

**Check SignalWire Dashboard:**
1. Go to https://your-space.signalwire.com
2. Click **Phone Numbers**
3. Find `+12027711933`
4. Check status: Should be **Active** ✅
5. Check if voice-enabled

### **3. SignalWire Space Name Wrong**

Your code parses the space name (line 69):
```typescript
const swSpace = rawSpace.replace(/^https?:\/\//, '')
  .replace(/\/$/, '')
  .replace(/\.signalwire\.com$/i, '')
  .trim()
```

**In Vercel, set it as:**
- ✅ **GOOD:** `myspace` or `myspace.signalwire.com`
- ❌ **BAD:** `https://myspace.signalwire.com/`

### **4. App URL Wrong**

Your webhook URLs use `NEXT_PUBLIC_APP_URL`:
```typescript
params.append('Url', `${env.NEXT_PUBLIC_APP_URL}/api/voice/laml/outbound`)
params.append('StatusCallback', `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/signalwire`)
```

**In Vercel, should be:**
```
NEXT_PUBLIC_APP_URL=https://your-actual-app.vercel.app
```

Without `https://` at the start, URLs will be malformed!

### **5. SignalWire API Rejecting Call**

Check for errors in logs:
```
SignalWire POST failed { status: 400, body: 'Invalid To phone number' }
SignalWire POST failed { status: 403, body: 'Account suspended' }
SignalWire POST failed { status: 401, body: 'Invalid credentials' }
```

---

## ✅ **Debugging Steps**

### **Step 1: Get Full Logs**

In Vercel dashboard:
```bash
# Or via CLI:
vercel logs --follow
```

Look for:
1. `startCallHandler: initiating call`
2. `startCallHandler: sending SignalWire POST`
3. `startCallHandler: SignalWire responded`
4. OR any errors

**Copy the FULL logs and share them**

### **Step 2: Verify All Environment Variables**

In Vercel → Settings → Environment Variables, confirm ALL these are set:

```bash
✓ SIGNALWIRE_PROJECT_ID=xxx
✓ SIGNALWIRE_TOKEN=PTxxx
✓ SIGNALWIRE_SPACE=xxx
✓ SIGNALWIRE_NUMBER=+12027711933
✓ NEXT_PUBLIC_APP_URL=https://xxx.vercel.app
✓ NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
✓ NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
✓ SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
✓ NEXTAUTH_SECRET=xxx
✓ NEXTAUTH_URL=https://xxx.vercel.app
```

### **Step 3: Check SignalWire Dashboard**

1. Go to **Activity** → **Call Logs**
2. Look for recent attempts
3. Check if calls are showing up (even as failed)
4. Check error messages

### **Step 4: Test Locally**

```bash
# Make sure .env has all variables
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

Check terminal output for errors.

---

## 🎯 **What to Share**

Please share:

1. **Full Vercel logs** (especially lines with `startCallHandler:`)
2. **All SignalWire env var names** (NOT values! Just confirm they're set)
3. **Your `NEXT_PUBLIC_APP_URL`** value
4. **SignalWire dashboard** - any failed calls showing up?
5. **Number status** in SignalWire - is `+12027711933` active?

---

## 📝 **Quick Checklist**

- [ ] `SIGNALWIRE_NUMBER=+12027711933` ✅ (You have this)
- [ ] `SIGNALWIRE_PROJECT_ID` is set in Vercel
- [ ] `SIGNALWIRE_TOKEN` starts with `PT`
- [ ] `SIGNALWIRE_SPACE` is just the space name (no https://)
- [ ] `NEXT_PUBLIC_APP_URL` is your Vercel URL with https://
- [ ] Number is **Active** in SignalWire dashboard
- [ ] Number is **Voice Enabled** in SignalWire
- [ ] Redeployed after setting all env vars

---

## 🚀 **Common Fix: SIGNALWIRE_SPACE Format**

Most common issue when env vars ARE set:

**Wrong:**
```
SIGNALWIRE_SPACE=https://myspace.signalwire.com/
```

**Right:**
```
SIGNALWIRE_SPACE=myspace
```

Try updating just the space name format and redeploy!

---

**Next:** Share your full logs and we'll find the exact issue! 🔍
