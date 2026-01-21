# SignalWire Live Translation - Implementation Status

**Date:** January 15, 2026  
**Status:** 🟡 **Backend Complete - UI Pending**  
**Feature:** SignalWire AI Agents for real-time live translation

---

## 🎯 **What We Built**

### **✅ COMPLETED: Backend Infrastructure (5/7 steps)**

#### **1. Database Migration** ✅
**File:** `migrations/2026-01-15-add-live-translation-support.sql`

Added fields to support live translation:
```sql
-- recordings table
has_live_translation BOOLEAN DEFAULT FALSE
live_translation_provider TEXT

-- voice_configs table  
translation_from TEXT  -- e.g., 'en', 'es', 'fr'
translation_to TEXT    -- e.g., 'en', 'es', 'fr'
```

**Run this in Supabase SQL Editor to apply:**
```sql
-- Copy/paste contents of migrations/2026-01-15-add-live-translation-support.sql
```

---

#### **2. Capability Endpoint** ✅
**File:** `app/api/call-capabilities/route.ts`

**Purpose:** Check if organization can use live translation

**Endpoint:** `GET /api/call-capabilities?orgId={uuid}`

**Response:**
```json
{
  "success": true,
  "organization_id": "...",
  "plan": "business",
  "capabilities": {
    "recording": true,
    "transcription": true,
    "real_time_translation": true,        // ← Available for Business+
    "real_time_translation_preview": true  // ← Feature flag
  }
}
```

**Plan Gating:**
- **Free/Pro:** `real_time_translation: false`
- **Business/Enterprise:** `real_time_translation: true`

---

#### **3. Voice Config Validation** ✅
**File:** `app/api/voice/config/route.ts` (Already had it!)

**What it does:**
- Validates `translation_from` and `translation_to` language codes
- Accepts: `en`, `es`, `fr`, `de`, `en-US`, `es-MX`, etc.
- Returns 400 if invalid language code provided

---

#### **4. AI Agent Config Builder** ✅
**File:** `lib/signalwire/ai-agent-config.ts`

**Functions:**
- `buildLiveTranslationSWML()` - Generates SWML config for AI Agent
- `getVoiceForLanguage()` - Maps language codes to TTS voices
- `isSupportedLanguage()` - Validates language support
- `getEstimatedLatency()` - Returns expected latency for language pair

**Supported Languages:**
- English, Spanish, French, German, Italian, Portuguese
- Chinese, Japanese, Korean, Arabic, Russian, Hindi

**Example Output:**
```json
{
  "version": "1.0.0",
  "sections": {
    "main": [
      { "answer": {} },
      {
        "ai": {
          "prompt": {
            "text": "You are a professional real-time translator...",
            "temperature": 0.3,
            "top_p": 0.8
          },
          "params": {
            "language": "en",
            "call_id": "...",
            "organization_id": "...",
            "feature": "live_translation",
            "translation_pair": "en-es"
          }
        }
      }
    ]
  }
}
```

---

#### **5. SWML Endpoint** ✅
**File:** `app/api/voice/swml/translation/route.ts`

**Purpose:** Serve SWML configuration to SignalWire when call is answered

**Endpoint:** `POST /api/voice/swml/translation?callId={id}&orgId={id}&from={lang}&to={lang}`

**What it does:**
1. Receives call details from SignalWire
2. Builds SWML with AI Agent translation prompt
3. Returns JSON config to SignalWire
4. SignalWire attaches AI Agent to call

---

#### **6. Call Handler Integration** ✅
**File:** `app/actions/calls/startCallHandler.ts`

**What changed:**
- Checks if live translation should be enabled:
  ```typescript
  const shouldUseLiveTranslation = 
    isBusinessPlan && 
    isFeatureFlagEnabled && 
    translate === true && 
    !!translate_from && 
    !!translate_to
  ```
- Routes to SWML endpoint when live translation enabled:
  ```typescript
  if (useLiveTranslation) {
    params.append('Url', 
      `/api/voice/swml/translation?callId=${id}&from=${from}&to=${to}`)
  }
  ```
- Falls back to LaML for regular calls

---

## ⏳ **PENDING: UI Components (2/7 steps)**

### **7. Update UI** ⏳
**Files to modify:**
- `components/voice/CallModulations.tsx` - Add live translation toggle
- `components/voice/VoiceConfigForm.tsx` - Add language selectors
- `app/voice/page.tsx` - Show live translation status

**What to add:**
```tsx
// Live Translation Toggle (Business plan only)
<div>
  <input 
    type="checkbox" 
    checked={liveTranslationEnabled}
    onChange={handleToggleLiveTranslation}
    disabled={!capabilities.real_time_translation}
  />
  <label>
    Live Translation (Preview)
    {!capabilities.real_time_translation && (
      <span className="badge">Business Plan</span>
    )}
  </label>
</div>

// Language Selectors (show when live translation enabled)
{liveTranslationEnabled && (
  <div>
    <select value={translateFrom} onChange={...}>
      <option value="en">English</option>
      <option value="es">Spanish</option>
      <option value="fr">French</option>
      <option value="de">German</option>
    </select>
    →
    <select value={translateTo} onChange={...}>
      <option value="en">English</option>
      <option value="es">Spanish</option>
      <option value="fr">French</option>
      <option value="de">German</option>
    </select>
  </div>
)}
```

---

### **8. Test E2E** ⏳
**What to test:**
1. Run database migration
2. Set organization plan to "business" 
3. Enable feature flag (or set `ENABLE_LIVE_TRANSLATION_PREVIEW=true`)
4. Enable live translation in UI
5. Select language pair (e.g., English → Spanish)
6. Make a test call
7. Verify:
   - Call routes to SWML endpoint (check Vercel logs)
   - AI Agent attaches to call (check SignalWire logs)
   - Translation happens in real-time during call
   - Post-call transcript still generated (AssemblyAI)

---

## 🔧 **Configuration Required**

### **1. Run Database Migration**

```sql
-- In Supabase SQL Editor, run:
-- migrations/2026-01-15-add-live-translation-support.sql
```

### **2. Set Organization Plan**

```sql
-- Update your organization to Business plan
UPDATE organizations
SET plan = 'business'
WHERE id = '143a4ad7-403c-4933-a0e6-553b05ca77a2';
```

### **3. Enable Feature Flag**

Add to Vercel environment variables:
```
ENABLE_LIVE_TRANSLATION_PREVIEW=true
```

Or create `lib/env-validation.ts` function:
```typescript
export function isLiveTranslationPreviewEnabled(): boolean {
  return process.env.ENABLE_LIVE_TRANSLATION_PREVIEW === 'true' || 
         process.env.NODE_ENV === 'development'
}
```

---

## 📊 **How It Works**

### **Call Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User initiates call with live translation ON            │
│    - From UI: translate=true, from='en', to='es'           │
│    ↓                                                        │
│ 2. startCallHandler checks capabilities                    │
│    - Is Business plan? ✓                                   │
│    - Feature flag enabled? ✓                               │
│    - Languages configured? ✓                               │
│    ↓                                                        │
│ 3. Routes to SWML endpoint (not LaML)                      │
│    - URL: /api/voice/swml/translation?...                 │
│    ↓                                                        │
│ 4. SignalWire calls SWML endpoint                          │
│    - Gets AI Agent configuration                           │
│    ↓                                                        │
│ 5. SignalWire attaches AI Agent to call                    │
│    - Agent listens to RTP audio                            │
│    - Agent does STT (auto language detection)              │
│    - Agent translates                                      │
│    - Agent does TTS                                        │
│    - Agent injects translated audio                        │
│    - LATENCY: 1-3 seconds                                  │
│    ↓                                                        │
│ 6. Call ends, recording delivered                          │
│    - Standard webhook flow                                 │
│    ↓                                                        │
│ 7. AssemblyAI processes recording                          │
│    - Generates CANONICAL transcript                        │
│    - Stores in ai_runs (authoritative)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 **Architecture Principles**

### **Two-Layer Translation:**

| Layer | Technology | Purpose | Authority | Timing |
|-------|-----------|---------|-----------|--------|
| **Live Assist** | SignalWire AI Agent | Real-time conversation assist | Non-authoritative | 1-3 seconds |
| **Evidence** | AssemblyAI | Canonical transcript for audit | Authoritative | 2-5 minutes post-call |

### **Why Both?**
- **Live:** User experience (can converse in real-time)
- **Post-call:** Legal/compliance (authoritative evidence)

**Critical Rule:**
> Even if SignalWire provides live translation, AssemblyAI STILL produces the canonical transcript. This preserves auditability, vendor independence, and legal defensibility.

---

## 🚀 **Next Steps**

### **Immediate (You):**
1. [ ] **Run database migration** (copy/paste SQL in Supabase)
2. [ ] **Set plan to business** (`UPDATE organizations SET plan = 'business'`)
3. [ ] **Enable feature flag** (Vercel env var or code)
4. [ ] **Deploy backend** (`git push` - already committed!)

### **UI Development (30-60 min):**
5. [ ] Add live translation toggle to Voice Config UI
6. [ ] Add language selector dropdowns
7. [ ] Check capabilities before showing toggle
8. [ ] Deploy UI changes

### **Testing (30 min):**
9. [ ] Make test call with live translation enabled
10. [ ] Verify in Vercel logs (`/api/voice/swml/translation` called)
11. [ ] Verify in SignalWire dashboard (AI Agent attached)
12. [ ] Test conversation in real-time
13. [ ] Verify post-call transcript still generated

---

## 🐛 **Troubleshooting**

### **"Live translation toggle not showing"**
- Check: Organization plan is "business" or "enterprise"
- Check: `/api/call-capabilities` returns `real_time_translation: true`
- Check: Feature flag enabled

### **"Call fails when live translation enabled"**
- Check Vercel logs for SWML endpoint errors
- Check SignalWire logs for AI Agent attachment errors
- Verify `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_TOKEN`, `SIGNALWIRE_SPACE` set

### **"No translation happening during call"**
- Check: Languages configured in voice_configs
- Check: SWML endpoint returning valid JSON
- Check: SignalWire AI Agent Business plan active
- Contact SignalWire support to verify AI Agent enabled

---

## 📝 **Files Created/Modified**

### **New Files:**
1. `migrations/2026-01-15-add-live-translation-support.sql`
2. `lib/signalwire/ai-agent-config.ts`
3. `app/api/call-capabilities/route.ts`
4. `app/api/voice/swml/translation/route.ts`

### **Modified Files:**
1. `app/actions/calls/startCallHandler.ts` - Live translation routing logic

### **Already Had:**
1. `app/api/voice/config/route.ts` - Language validation (lines 137-151)

---

## 💰 **Cost Implications**

### **SignalWire Business Plan:**
- **Cost:** ~$500/month
- **Includes:** AI Agents, unlimited translation calls
- **No per-minute charges** for AI Agent usage

### **AssemblyAI (unchanged):**
- **Cost:** ~$0.006/minute (transcription)
- **Still used** for post-call canonical transcript

**Total:** Same as before ($500/month SignalWire) - live translation included

---

## ✅ **Summary**

**Backend: 100% Complete** ✅
- Database schema ready
- API endpoints built
- SWML config generator ready
- Call handler integrated
- Feature gating implemented

**Frontend: 0% Complete** ⏳
- Need UI toggle for live translation
- Need language selector dropdowns
- Need capability checking in UI

**Testing: Not Started** ⏳
- Need to run database migration
- Need to set org plan to business
- Need to make test call

**Ready to deploy backend!** Push to Vercel and start UI work.

---

**Next:** Update UI components and test with real call.
