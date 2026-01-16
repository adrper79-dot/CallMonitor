# Word Is Bond Call Setup Guide

**Date:** January 12, 2026  
**Purpose:** Explain call flow logic and fix configuration

---

## 🎯 **CALL TYPES & FLOW**

### **Type 1: Single-Leg Outbound Call (Standard)**

**Use Case:** Call a business to monitor their phone system

**Setup:**
- **From:** Your SignalWire number (e.g., +12025551234)
- **To:** Business number you want to monitor (e.g., +17062677235)

**Flow:**
```
Your App → SignalWire REST API
            ↓
         SignalWire dials business number (+17062677235)
            ↓
         Business answers
            ↓
         SignalWire calls your LaML webhook
            ↓
         LaML keeps call alive + records
            ↓
         Recording sent to webhook when complete
```

**Who talks:** YOU (or your agent) ↔ BUSINESS

**Recording:** Single recording of entire conversation

---

### **Type 2: Bridge Call (Two-Party Conference)**

**Use Case:** Connect your agent to a business for monitored conversation

**Setup:**
- **From:** Your agent's number (e.g., +12032987277 - your AI agent)
- **To:** Business number (e.g., +17062677235)

**Flow:**
```
Your App → SignalWire REST API (TWO calls)
            ↓
Call A: SignalWire dials YOUR AGENT (+12032987277)
Call B: SignalWire dials BUSINESS (+17062677235)
            ↓
         Both answer
            ↓
         SignalWire calls LaML webhook for each
            ↓
         LaML joins both to conference room "bridge-{callId}"
            ↓
         Conference connects both parties
            ↓
         Recording happens at conference level
```

**Who talks:** YOUR AGENT ↔ BUSINESS (you monitor)

**Recording:** Single conference recording

---

## 🔍 **YOUR SPECIFIC SETUP**

Based on your description:

### **What You Want:**
- **AI Agent:** +1 (203) 298-7277 (your number)
- **Business to Monitor:** +17062677235

### **Current Issue:**
> "Should they go to my AI agent at +1 (203) 298-7277? There are no recording entries in the Recordings DB table."

**Answer:** It depends on your use case:

#### **Option A: YOU call the business (Single-Leg)**
```
From: {SignalWire Number}
To: +17062677235 (business)
```

**Result:** Business receives call from SignalWire number, YOU answer and talk to business

#### **Option B: Connect your AI agent to business (Bridge)**
```
From: +12032987277 (your AI agent)
To: +17062677235 (business)
Flow Type: bridge
```

**Result:** 
- Call A rings your AI agent (+12032987277)
- Call B rings business (+17062677235)
- Both join conference
- Your AI agent talks to business
- You listen to recording later

---

## 🚨 **WHY NO RECORDINGS?**

### **Root Cause #1: Recording Was in LaML (Wrong)**
**Before Fix:**
```typescript
// In LaML route.ts (WRONG)
if (recordingEnabled) {
  elements.push(`<Record action="..." />`)  // Voicemail recording, NOT call recording
}
```

**Problem:** `<Record>` verb is for voicemail (waits for input, times out after 8 seconds)

**After Fix:**
```typescript
// In startCallHandler.ts (CORRECT)
params.append('Record', 'true')  // REST API level recording
params.append('RecordingStatusCallback', '...')
```

**Result:** SignalWire records automatically, sends webhook when complete

---

### **Root Cause #2: Bridge Calls Had No Conference**
**Before Fix:**
```typescript
// Bridge calls just dialed both numbers separately
// No conference setup → calls never connected
```

**After Fix:**
```typescript
// Create conference room
const conferenceName = `bridge-${callId}`

// Both legs join same conference
params.append('Url', `.../laml/outbound?conference=${conferenceName}&leg=1`)
```

**Result:** Both parties join conference and can talk

---

## 📋 **CALL SETUP DECISION MATRIX**

| Scenario | From | To | Flow Type | Result |
|----------|------|----|-----------:|--------|
| **Monitor business directly** | SignalWire # | Business # | `outbound` | You call business |
| **AI agent calls business** | AI agent # | Business # | `bridge` | AI ↔ Business (2-party) |
| **Connect caller to business** | Caller # | Business # | `bridge` | Caller ↔ Business (2-party) |
| **Secret shopper test** | SignalWire # | Business # | `outbound` + `synthetic_caller=true` | Automated script calls business |

---

## 🔧 **WHAT WAS FIXED**

### **Fix #1: Enable REST API Recording**
**File:** `app/actions/calls/startCallHandler.ts`

**Change:**
```typescript
// Added to REST API params
params.append('Record', 'true')
params.append('RecordingStatusCallback', `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/signalwire`)
params.append('RecordingStatusCallbackEvent', 'completed')
```

**Impact:** ✅ All single-leg calls now record properly

---

### **Fix #2: Simplified LaML (Keep Call Alive)**
**File:** `app/api/voice/laml/outbound/route.ts`

**Change:**
```xml
<!-- OLD: Used <Record> which timed out after 8 seconds -->
<Response>
  <Record action="..." maxLength="3600"/>
</Response>

<!-- NEW: Use <Pause> to keep call alive -->
<Response>
  <Pause length="3600"/>
  <Hangup/>
</Response>
```

**Impact:** ✅ Calls stay connected for full conversation (up to 1 hour)

---

### **Fix #3: Bridge Calls Use Conference**
**File:** `app/actions/calls/startCallHandler.ts`

**Change:**
```typescript
// Create conference name
const conferenceName = `bridge-${callId}`

// Pass conference to both legs
await placeSignalWireCall(from_number, false, conferenceName, '1')
await placeSignalWireCall(phone_number, false, conferenceName, '2')
```

**LaML Change:**
```xml
<!-- Both legs receive -->
<Response>
  <Dial>
    <Conference record="record-from-answer">bridge-abc123</Conference>
  </Dial>
</Response>
```

**Impact:** ✅ Bridge calls connect both parties via conference

---

### **Fix #4: Conference Recording (Not Duplicate)**
**File:** `app/api/voice/laml/outbound/route.ts`

**Change:**
```xml
<!-- OLD: Recording on <Dial> created 2 recordings -->
<Dial record="record-from-answer">
  <Conference>bridge-abc123</Conference>
</Dial>

<!-- NEW: Recording on <Conference> creates 1 recording -->
<Dial>
  <Conference record="record-from-answer">bridge-abc123</Conference>
</Dial>
```

**Impact:** ✅ Bridge calls create single conference recording

---

## 🎯 **EXPECTED BEHAVIOR AFTER FIX**

### **Single-Leg Call:**
1. ✅ Call connects to business
2. ✅ Conversation happens
3. ✅ Call stays alive until hangup (no 8-second timeout)
4. ✅ Recording saved to database
5. ✅ Transcription triggered (AssemblyAI)
6. ✅ Translation/survey/scoring happen

### **Bridge Call:**
1. ✅ Call A rings your agent (+12032987277)
2. ✅ Call B rings business (+17062677235)
3. ✅ Both join conference when answered
4. ✅ Agent and business can talk
5. ✅ Single conference recording saved
6. ✅ Transcription/translation/scoring happen

---

## 🧪 **HOW TO TEST**

### **Test 1: Single-Leg Call**
```typescript
// In your UI
From: (leave empty - uses SignalWire number)
To: +17062677235
Flow Type: outbound
```

**Expected:**
- Phone +17062677235 rings
- Call connects
- Stays connected until you hang up
- Recording appears in database

**Check:**
```sql
SELECT id, call_sid, recording_url, duration_seconds, status 
FROM recordings 
WHERE created_at > NOW() - INTERVAL '10 minutes' 
ORDER BY created_at DESC;
```

---

### **Test 2: Bridge Call**
```typescript
// In your UI
From: +12032987277 (your AI agent)
To: +17062677235 (business)
Flow Type: bridge
```

**Expected:**
- Your phone (+12032987277) rings
- Business phone (+17062677235) rings
- When both answer, they connect via conference
- Can talk to each other
- Recording appears in database

**Check:**
```sql
-- Should see ONE call with conference recording
SELECT c.id, c.status, r.recording_url, r.duration_seconds
FROM calls c
LEFT JOIN recordings r ON r.call_sid = c.call_sid
WHERE c.created_at > NOW() - INTERVAL '10 minutes'
ORDER BY c.created_at DESC;
```

---

## 📊 **LAML VERB REFERENCE**

| Verb | Purpose | Use Case | Example |
|------|---------|----------|---------|
| `<Dial>` | Create outbound call | Connect to another number | `<Dial><Number>+1234</Number></Dial>` |
| `<Conference>` | Join conference room | Bridge multiple parties | `<Conference>room-123</Conference>` |
| `<Record>` | Record voicemail | Capture message after beep | `<Record maxLength="60"/>` (NOT for call recording!) |
| `<Say>` | Text-to-speech | Play message | `<Say>Hello</Say>` |
| `<Pause>` | Wait | Keep call alive | `<Pause length="3600"/>` |
| `<Gather>` | Collect DTMF | Get user input | `<Gather numDigits="1"/>` |
| `<Hangup>` | End call | Terminate | `<Hangup/>` |

**REST API Recording:** Use `Record=true` parameter (for call recording)  
**LaML Recording:** Use `<Conference record="...">` (for conference recording)

---

## ❓ **FAQ**

### **Q: Why was `<Record>` verb wrong?**
**A:** `<Record>` is for voicemail recording:
- Plays beep
- Waits for user to speak
- Times out after silence (8 seconds default)
- NOT for recording conversations

**Correct:** REST API `Record=true` parameter

---

### **Q: Why do bridge calls need conferences?**
**A:** Without conference:
- Two separate calls exist
- No audio connection between them
- Each party hears nothing

**With conference:**
- Both calls join same "room"
- Audio bridges between parties
- One recording captures both sides

---

### **Q: What if I want to monitor but not participate?**
**A:** Use single-leg call with secret shopper:
```typescript
From: (empty)
To: Business
Flow Type: outbound
Modulations: { synthetic_caller: true }
```

**Result:** Automated script calls business, you listen to recording

---

### **Q: How do I know if recording worked?**
**A:** Check three places:

1. **Supabase recordings table:**
```sql
SELECT * FROM recordings WHERE created_at > NOW() - INTERVAL '1 hour';
```

2. **SignalWire Dashboard:**
- Go to Calls → Recent calls
- Click on call
- Look for "Recording" section

3. **Vercel logs:**
```
signalwire webhook: created recording { recordingId, callId }
```

---

## ✅ **DEPLOYMENT CHECKLIST**

- [x] REST API recording enabled (startCallHandler.ts)
- [x] LaML simplified to keep call alive (laml/outbound/route.ts)
- [x] Bridge calls use conference (startCallHandler.ts)
- [x] Conference recording on `<Conference>` not `<Dial>` (laml/outbound/route.ts)
- [ ] Deploy to Vercel
- [ ] Test single-leg call
- [ ] Test bridge call
- [ ] Verify recordings in database
- [ ] Check transcription triggers

---

## 🚀 **NEXT STEPS**

1. **Deploy fixes:**
```bash
git add .
git commit -m "Fix: Enable REST API recording + conference bridge calls"
git push
```

2. **Wait for Vercel deployment** (2-3 minutes)

3. **Test single-leg call:**
   - Leave "From" empty
   - "To": +17062677235
   - Click "Start Call"
   - Verify call connects and stays alive
   - Check database for recording

4. **Test bridge call:**
   - "From": +12032987277 (your AI agent)
   - "To": +17062677235
   - "Flow Type": bridge
   - Click "Start Call"
   - Answer both phones
   - Verify they connect
   - Check database for recording

5. **Monitor logs:**
```bash
vercel logs [deployment-url]
```

---

**Fixes Applied:** ✅ All 4 critical fixes implemented  
**Expected Result:** Calls connect, stay alive, record properly, trigger AI services  
**Status:** Ready for deployment and testing
