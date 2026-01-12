# Call Configuration Gap Analysis - Jan 12, 2026

## 🚨 **Critical Issue: Call Configuration Not Persisted**

### **The Problem:**

**User's Question:**
> "Does the codebase have logic to recognize different call requirements per configuration submitted? The code needs to be aware of what config of toggles and fields used to know which call script to use. I don't believe this logic has been built out."

**Answer: The user is CORRECT. The logic is incomplete.**

---

## 🔍 **Current State Analysis:**

### **What We HAVE:**

1. **Call Initiation (`startCallHandler`)** ✅
   - Accepts `flow_type`: `'bridge'` | `'outbound'`
   - Accepts `from_number` (for bridge calls)
   - Accepts `modulations`: record, transcribe, translate, survey, synthetic_caller
   - Places SignalWire call based on `flow_type`

2. **LaML Generation (`generateLaML`)** ⚠️
   - Fetches `voice_configs` from database (organization-wide settings)
   - Generates XML based on config toggles
   - **BUT** doesn't know the specific call type or configuration

### **What We're MISSING:**

1. **❌ No `flow_type` stored in database**
   - LaML doesn't know if this is a bridge or single-leg call
   - Can't determine whether to use `<Dial>` or `<Record>`

2. **❌ No `from_number` stored**
   - For bridge calls, need to know which number to dial back
   - Currently lost after call initiation

3. **❌ No call-specific `modulations` stored**
   - Using organization-wide `voice_configs` instead
   - Can't have different configs for different calls

4. **❌ No `to_number` stored**
   - LaML webhook receives `to` parameter, but it's ambiguous
   - Could be the destination OR the agent (for bridge calls)

---

## 🐛 **Bugs Caused by This Gap:**

### **1. Double Ring Bug (JUST FIXED, BUT...)**
- **Root Cause:** LaML used `<Dial>` for ALL calls
- **My Fix:** Removed `<Dial>` entirely
- **New Problem:** This BREAKS bridge calls!

### **2. Bridge Calls Don't Work**
- **Expected:** Call FROM number, then DIAL destination
- **Actual:** No `<Dial>` in LaML, so bridge doesn't connect

### **3. Wrong Configuration Applied**
- **Expected:** Use call-specific modulations
- **Actual:** Using organization-wide `voice_configs`
- **Result:** All calls for an org get the same script/config

---

## ✅ **Solution: Add Call Metadata to Database**

### **Step 1: Add Fields to `calls` Table**

**Migration:**
```sql
-- Add call configuration fields
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS flow_type TEXT CHECK (flow_type IN ('bridge', 'outbound')),
  ADD COLUMN IF NOT EXISTS from_number TEXT,
  ADD COLUMN IF NOT EXISTS to_number TEXT,
  ADD COLUMN IF NOT EXISTS call_config JSONB;

COMMENT ON COLUMN calls.flow_type IS 'Type of call: bridge (two-party) or outbound (single-leg)';
COMMENT ON COLUMN calls.from_number IS 'For bridge calls: the agent/from number';
COMMENT ON COLUMN calls.to_number IS 'Destination number being called';
COMMENT ON COLUMN calls.call_config IS 'Call-specific modulations: {record, transcribe, translate, survey, synthetic_caller, etc}';

CREATE INDEX IF NOT EXISTS idx_calls_flow_type ON public.calls(flow_type);
```

### **Step 2: Save Call Config in `startCallHandler`**

**File:** `app/actions/calls/startCallHandler.ts`

**Current (lines 370-380):**
```typescript
// Update call with call_sid and status
const updateData: any = { status: 'in-progress' }
if (call_sid) {
  updateData.call_sid = call_sid
}

const { error: updateErr } = await supabaseAdmin.from('calls').update(updateData).eq('id', callId)
```

**Should be:**
```typescript
// Update call with call_sid, status, AND configuration
const updateData: any = { 
  status: 'in-progress',
  flow_type: flow_type || 'outbound',
  from_number: from_number || null,
  to_number: phone_number,
  call_config: effectiveModulations  // Save call-specific config!
}
if (call_sid) {
  updateData.call_sid = call_sid
}

const { error: updateErr } = await supabaseAdmin.from('calls').update(updateData).eq('id', callId)
```

### **Step 3: Use Call Config in `generateLaML`**

**File:** `app/api/voice/laml/outbound/route.ts`

**Current (lines 104-124):**
```typescript
// Find call by call_sid to get organization_id
if (callSid) {
  const { data: callRows } = await supabaseAdmin
    .from('calls')
    .select('organization_id')  // ❌ Only gets org_id
    .eq('call_sid', callSid)
    .limit(1)

  organizationId = callRows?.[0]?.organization_id || null

  if (organizationId) {
    // Get voice_configs for this organization
    const { data: vcRows } = await supabaseAdmin
      .from('voice_configs')  // ❌ Uses org-wide config
      .select('record, transcribe, translate, translate_from, translate_to, survey, synthetic_caller')
      .eq('organization_id', organizationId)
      .limit(1)

    voiceConfig = vcRows?.[0] || null
  }
}
```

**Should be:**
```typescript
// Find call by call_sid to get configuration
let callData: any = null
if (callSid) {
  const { data: callRows } = await supabaseAdmin
    .from('calls')
    .select('organization_id, flow_type, from_number, to_number, call_config')  // ✅ Get call metadata
    .eq('call_sid', callSid)
    .limit(1)

  callData = callRows?.[0] || null
  organizationId = callData?.organization_id || null

  // Use call-specific config if available, otherwise fallback to org-wide
  if (callData?.call_config) {
    voiceConfig = callData.call_config  // ✅ Call-specific config
  } else if (organizationId) {
    // Fallback: Get voice_configs for this organization
    const { data: vcRows } = await supabaseAdmin
      .from('voice_configs')
      .select('record, transcribe, translate, translate_from, translate_to, survey, synthetic_caller')
      .eq('organization_id', organizationId)
      .limit(1)

    voiceConfig = vcRows?.[0] || null
  }
}
```

### **Step 4: Generate Correct LaML Based on Call Type**

**Current (lines 188-205):**
```typescript
// Main call flow
// IMPORTANT: For single-leg calls, 'to' is the destination we're ALREADY calling
// ...
if (recordingEnabled) {
  elements.push(`<Record.../>`)  // ❌ Only works for single-leg!
}
```

**Should be:**
```typescript
// Main call flow - Route based on flow_type
const flowType = callData?.flow_type || 'outbound'
const fromNumber = callData?.from_number

if (flowType === 'bridge' && fromNumber) {
  // BRIDGE CALL: Use <Dial> to connect to the other party
  // Current leg is connected to one party, need to dial the other
  const dialNumber = toNumber || phone_number
  
  if (recordingEnabled) {
    elements.push(`<Dial record="record-from-answer" recordingStatusCallback="${recordingStatusCallback}" recordingStatusCallbackEvent="completed">`)
    elements.push(`  <Number>${escapeXml(dialNumber)}</Number>`)
    elements.push('</Dial>')
  } else {
    elements.push(`<Dial><Number>${escapeXml(dialNumber)}</Number></Dial>`)
  }
  
} else {
  // SINGLE-LEG OUTBOUND: Just record (already connected to destination)
  if (recordingEnabled) {
    elements.push(`<Record action="${recordingAction}" recordingStatusCallback="${recordingStatusCallback}" recordingStatusCallbackEvent="completed" maxLength="3600"/>`)
  } else {
    // No recording - just a simple call with optional Say elements
    if (elements.length === 0) {
      elements.push('<Say voice="alice">This is a test call.</Say>')
    }
  }
}
```

---

## 📊 **Call Flow Matrix (After Fix):**

| Call Type | from_number | flow_type | LaML Generated |
|-----------|-------------|-----------|----------------|
| **Simple Outbound** | `null` | `'outbound'` | `<Record/>` |
| **Two-Party Bridge** | `+15551234567` | `'bridge'` | `<Dial><Number>destination</Number></Dial>` |
| **Secret Shopper** | `null` | `'outbound'` | `<Say>script</Say><Record/>` |
| **Translation Call** | `null` | `'outbound'` | `<Record/> + translation metadata` |

---

## 🎯 **Implementation Steps:**

1. ✅ **Create migration** to add fields to `calls` table
2. ✅ **Update `startCallHandler`** to save call config
3. ✅ **Update `generateLaML`** to use call-specific config
4. ✅ **Route LaML logic** based on `flow_type`
5. ✅ **Test each call type:**
   - Simple outbound (current use case)
   - Bridge call (two-party)
   - Secret shopper
   - Translation

---

## 🚨 **CRITICAL: My Recent Fix Broke Bridge Calls**

**Commit `a4446ab`:**
- ✅ Fixed: Single-leg outbound (double ring bug)
- ❌ Broke: Bridge calls (removed ALL `<Dial>` logic)

**Need to:**
1. Add call metadata fields
2. Restore `<Dial>` logic FOR BRIDGE CALLS ONLY
3. Keep `<Record>` logic for single-leg outbound

---

**Status:** Ready to implement. Needs database migration + code changes.
