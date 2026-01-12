# SignalWire Double Call Investigation - Jan 12, 2026

## 🔍 **Current Status**

✅ **Frontend:** Only ONE API call to `/api/calls/start`  
✅ **Backend:** Only ONE webhook to `/api/voice/laml/outbound`  
✅ **No 404 errors** on `/api/voice/script` anymore  
❌ **Phone still rings TWICE**

---

## 🧪 **Investigation Plan**

### **Step 1: Check SignalWire Dashboard**

**What to check:**
1. Go to SignalWire Dashboard → Call Logs
2. Filter by **last 10 minutes**
3. Look for calls to `+17062677235`

**What to look for:**
- **Scenario A: TWO separate calls**
  - Two different Call SIDs
  - Created at nearly same time (1-2 seconds apart)
  - Both show "Completed" status
  - **Conclusion:** Backend is calling SignalWire API twice

- **Scenario B: ONE call with multiple legs**
  - ONE Call SID
  - Shows 2 "legs" or "child calls"
  - **Conclusion:** LaML XML is causing SignalWire to dial twice

- **Scenario C: ONE call, no legs**
  - ONE Call SID
  - No child calls
  - **Conclusion:** Carrier is duplicating the ring (rare)

---

## 📋 **Checklist for SignalWire Dashboard**

### **Basic Info:**
- [ ] How many Call SIDs for `+17062677235` in last 10 min?
- [ ] What are the Call SIDs? (write them down)
- [ ] What are the timestamps? (how far apart?)
- [ ] What is the status of each? (Completed, Failed, etc.)

### **Call Details (for each call):**
- [ ] Click on first call → What does "Call Detail" show?
- [ ] Does it show **"Parent Call"** and **"Child Calls"**?
- [ ] What is the "To" number?
- [ ] What is the "From" number?
- [ ] What is the "Webhook URL" shown?

### **LaML XML (CRITICAL):**
- [ ] Does SignalWire show the LaML XML that was returned?
- [ ] Copy the full XML here:
  ```xml
  (paste here)
  ```

---

## 🔍 **Possible Root Causes**

### **Theory 1: LaML has TWO `<Dial>` commands**

If the LaML XML contains:
```xml
<Response>
  <Dial><Number>+17062677235</Number></Dial>
  <Dial><Number>+17062677235</Number></Dial>  ← DUPLICATE!
</Response>
```

**This would cause two dials!**

Expected (correct) XML:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial><Number>+17062677235</Number></Dial>
</Response>
```

**Length:** ~106 characters (matches our log!)

---

### **Theory 2: Recording configuration causes dial retry**

If LaML has:
```xml
<Dial record="record-from-answer">
  <Number>+17062677235</Number>
</Dial>
<!-- AND THEN -->
<Record/>  ← DUPLICATE dial trigger?
```

SignalWire might be dialing once for the call, then again for recording.

---

### **Theory 3: Backend calling SignalWire API twice**

Even though logs show ONE request, maybe:
- `placeSignalWireCall` is being called twice internally
- SignalWire is receiving two API calls
- Need to check console.log output in Vercel

**To verify:**
Look for these logs in Vercel:
```
placeSignalWireCall: ENTERED function { toNumber: '[REDACTED]', ... }
startCallHandler: signalwire call placed { call_sid: '[REDACTED]', ... }
```

If you see these **twice**, then backend is calling twice.

---

### **Theory 4: SignalWire retry due to webhook failure**

The webhook signature failures (`401 /api/webhooks/signalwire`) might cause:
- SignalWire fails to deliver status update
- SignalWire retries the **entire call**

**Fix:** Disable webhook signature validation temporarily to test.

---

## 🔧 **Temporary Fix to Test Theory 4**

Disable webhook signature validation to see if that's causing the issue:

```typescript
// app/api/webhooks/signalwire/route.ts
export async function POST(req: Request) {
  // TEMPORARILY DISABLE signature validation for testing
  /*
  const authToken = process.env.SIGNALWIRE_TOKEN
  if (authToken) {
    ... signature validation code ...
  }
  */
  
  // Return 200 OK immediately
  void processWebhookAsync(req).catch(...)
  return NextResponse.json({ ok: true, received: true })
}
```

---

## 📊 **Data Collection Form**

Please fill this out after checking SignalWire Dashboard:

**Test Call Details:**
- **Time of call:** ________
- **Number of Call SIDs found:** ________
- **Call SID 1:** ________________
- **Call SID 2 (if exists):** ________________
- **Time difference between calls:** ________ seconds

**LaML XML (from SignalWire Dashboard):**
```xml
(paste full XML here)
```

**Call Legs/Children:**
- **Does call show child calls?** Yes / No
- **How many children?** ________

**Console Logs (from Vercel):**
- **How many times do you see:**
  - `placeSignalWireCall: ENTERED function` = ____
  - `signalwire call placed` = ____
  - `laml/outbound: generated XML` = ____

---

## 🎯 **Next Steps Based on Findings**

### **If TWO Call SIDs:**
→ Backend is calling SignalWire twice  
→ Add more logging to `placeSignalWireCall`  
→ Check for race conditions or duplicate invocations

### **If ONE Call SID with child calls:**
→ LaML XML is causing duplicate dials  
→ Fix `generateLaML` function  
→ Check for duplicate `<Dial>` or `<Record>` commands

### **If ONE Call SID, no children:**
→ Carrier issue (rare)  
→ Contact SignalWire support  
→ Try different phone number to test

### **If webhook signature failures persist:**
→ Temporarily disable signature validation  
→ Test if that fixes the issue  
→ Then debug signature verification logic

---

**Status:** 🔍 **AWAITING SIGNALWIRE DASHBOARD DATA**
