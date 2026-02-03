# Live Translation User Flow

**Feature:** SignalWire AI Agent Live Translation  
**Date:** January 15, 2026  
**Version:** 1.0  
**Audience:** End Users, Admins, Operators

---

## 📋 **Table of Contents**

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [User Flow - Step by Step](#user-flow---step-by-step)
4. [Call Flow During Translation](#call-flow-during-translation)
5. [Post-Call Flow](#post-call-flow)
6. [Troubleshooting](#troubleshooting)
7. [FAQs](#faqs)

---

## 🎯 **Overview**

Live Translation enables real-time voice translation during phone calls using SignalWire AI Agents. When enabled, the system:
- Listens to the caller's speech in real-time
- Automatically detects the spoken language
- Translates to the target language
- Speaks the translation back to the caller
- Maintains a 1-3 second latency

**Use Cases:**
- Customer support for multilingual customers
- International sales calls
- Emergency hotlines with language barriers
- Multilingual conference calls

---

## ✅ **Prerequisites**

### **For Your Organization:**

| Requirement | Status | How to Check |
|-------------|--------|--------------|
| **Business Plan or Higher** | Required | Go to `/settings` → Check "Current Plan" |
| **SignalWire Account** | Required | Verify credentials in `.env.local` |
| **Owner or Admin Role** | Required | Go to `/voice` → Check role badge |
| **Database Migration** | Required | Admin must run SQL migration |

### **For Individual Users:**

| Requirement | Notes |
|-------------|-------|
| **Login Access** | Must be authenticated user |
| **Organization Member** | Must belong to organization with Business plan |
| **Role: Owner or Admin** | Viewer/Analyst/Operator roles cannot configure |

---

## 👤 **User Flow - Step by Step**

### **Phase 1: Accessing the Voice Operations Page**

#### **Step 1.1: Login**

1. Navigate to `https://voxsouth.online`
2. Click "Sign In"
3. Authenticate with your credentials
4. You'll be redirected to the dashboard

**Expected Result:** See dashboard with navigation menu.

---

#### **Step 1.2: Navigate to Voice Operations**

1. Click **"Voice"** in the main navigation menu
2. Wait for the Voice Operations page to load

**Expected Result:** See three-column layout:
- **Left:** Call history list
- **Center:** Call controls and features
- **Right:** Activity feed

**URL:** `https://voxsouth.online/voice`

---

### **Phase 2: Configuring Live Translation**

#### **Step 2.1: Locate Call Features Section**

1. In the **center column**, scroll to "Call Features" section
2. Look for the toggle switches

**Expected Result:** See 5 feature toggles:
- Recording
- Transcribe
- **Live Translation** ← (with blue "Preview" badge)
- After-call Survey
- Secret Shopper

**Visual Indicator:** The "Live Translation" toggle should show:
- Blue "Preview" badge
- Info icon (ℹ️) with tooltip

---

#### **Step 2.2: Enable Live Translation**

1. Click the **Live Translation toggle** to turn it ON
2. Toggle changes from gray to red/green (enabled state)
3. Language selector dropdowns appear below

**Expected Result:** See two dropdown menus appear:
```
┌─────────────────────────┐  ┌─────────────────────────┐
│ From Language       [▼] │  │ To Language         [▼] │
│ [Select...]             │  │ [Select...]             │
└─────────────────────────┘  └─────────────────────────┘

┌───────────────────────────────────────────────────────┐
│ ☐ Voice Cloning                                       │
│   Clone caller's voice for translated audio          │
└───────────────────────────────────────────────────────┘
```

**Note:** If you don't see "Live Translation" (only "Translate"), your organization may not have:
- Business plan subscription
- Completed database migration
- Feature flag enabled

---

#### **Step 2.3: Select Source Language**

1. Click the **"From Language"** dropdown
2. Select the language the **caller will speak**

**Available Languages:**
- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Portuguese (pt)
- Chinese (zh)
- Japanese (ja)
- Korean (ko)
- Arabic (ar)
- Hindi (hi)
- Russian (ru)

**Example:** If your caller speaks Spanish, select "Spanish"

**Tip:** You can also leave this blank - SignalWire AI Agent will auto-detect the language. However, selecting it improves accuracy and reduces latency.

---

#### **Step 2.4: Select Target Language**

1. Click the **"To Language"** dropdown
2. Select the language you want the translation **spoken in**

**Example:** If you want to hear English translation, select "English"

**Common Pairings:**
- English → Spanish (US customer support for Spanish speakers)
- Spanish → English (Spanish caller to English agent)
- French → English (International support)
- German → English (European sales calls)

---

#### **Step 2.5: (Optional) Enable Voice Cloning**

1. Locate the **"Voice Cloning"** toggle below language selectors
2. Click to enable if you want to preserve the caller's voice characteristics

**What it does:**
- **OFF:** Translation uses generic TTS voice for target language
- **ON:** Attempts to clone caller's voice and speak translation in their voice

**Note:** Voice cloning quality depends on SignalWire's capabilities. This is experimental.

**Recommendation:** Leave OFF for first test, then enable if generic voices are unsatisfactory.

---

#### **Step 2.6: Save Configuration**

Configuration is automatically saved when:
- You change any toggle
- You select a language
- You enable/disable voice cloning

**Expected Result:** See brief "Updating..." indicator, then:
- "On" label appears next to toggle
- Selected languages persist if you refresh page

**Verification:**
1. Refresh the browser page
2. Check that "Live Translation" is still ON
3. Check that selected languages are still selected

---

### **Phase 3: Making a Translated Call**

#### **Step 3.1: Enter Target Phone Number**

1. Scroll to **"Execution Controls"** section (below Call Features)
2. Look for "Target Number" or "Phone Number" input field
3. Enter the phone number to call in E.164 format

**E.164 Format Examples:**
- US: `+12392027345`
- UK: `+442071234567`
- Mexico: `+525512345678`

**Tip:** Always include the `+` and country code.

---

#### **Step 3.2: (Optional) Select Agent Number**

If your organization has multiple outbound numbers:

1. Look for "From Number" or "Caller ID" dropdown
2. Select which number to use for outbound calling

**Example:** If calling US customers, use your US number.

---

#### **Step 3.3: (Optional) Select Voice Target**

If you have pre-configured voice targets:

1. Look for "Target" or "Campaign" selector
2. Select an existing target to auto-fill number and settings

**Voice Targets** are pre-saved configurations with:
- Target phone number
- Campaign association
- Custom settings

---

#### **Step 3.4: Initiate the Call**

1. Review your settings:
   - ✅ Live Translation: ON
   - ✅ From Language: Selected
   - ✅ To Language: Selected
   - ✅ Target Number: Entered
2. Click the **"Start Call"** button (usually large, red/green)

**Expected Result:** 
- Button changes to "Calling..." state
- Spinner or loading indicator appears
- Call status updates in real-time

**Behind the Scenes:** The system:
1. Creates call record in database
2. Routes request to `/api/voice/call`
3. Handler checks live translation is enabled
4. Routes to `/api/voice/swml/translation` endpoint
5. SignalWire initiates call with AI Agent attached

---

#### **Step 3.5: Call Connects**

**When the call connects:**
1. You'll see "Connected" status
2. Call timer starts
3. Activity feed shows "Call started" event

**For the caller:**
- Phone rings
- They answer
- They hear greeting (if configured)
- AI Agent is listening in real-time

---

### **Phase 4: During the Call**

#### **Step 4.1: Real-Time Translation Happens**

**What the caller experiences:**

```
Caller speaks:
"Hola, necesito ayuda con mi pedido"
        ↓ (1-3 seconds)
AI Agent responds in English:
"Hello, I need help with my order"
```

**Translation Flow:**
1. **Caller speaks** in their native language (e.g., Spanish)
2. **AI Agent listens** via SignalWire RTP audio stream
3. **STT (Speech-to-Text)** converts audio → text
4. **Auto-detect** identifies language (if not specified)
5. **Translation** converts text to target language
6. **TTS (Text-to-Speech)** generates audio in target language
7. **Audio injection** plays translated speech back to call
8. **Latency:** 1-3 seconds total

**What you see in the UI:**
- Call status: "In Progress"
- Call duration timer ticking
- Activity feed may show events

---

#### **Step 4.2: Monitor Call Status**

While call is active:

**Available Actions:**
- View call duration
- See real-time status updates
- Monitor activity feed for events

**NOT Available During Call:**
- Live transcript (this is processed post-call)
- Modify translation settings mid-call
- Switch languages mid-call

**Tip:** Translation settings are locked when call starts. To change them, end the call and start a new one.

---

#### **Step 4.3: End the Call**

**Caller hangs up:**
1. Call automatically ends
2. Status changes to "Completed"
3. Recording is saved to SignalWire
4. Post-call processing begins

**OR**

**You end the call:**
1. Click "End Call" button (if available)
2. Call terminates immediately
3. Same post-call flow begins

---

### **Phase 5: Post-Call Processing**

#### **Step 5.1: Recording Delivery**

**Timeline:** 1-5 minutes after call ends

1. SignalWire processes recording
2. Recording URL becomes available
3. Webhook delivers recording metadata
4. System creates `recordings` table entry

**Fields Stored:**
```sql
recordings:
  - call_sid: Unique call identifier
  - recording_url: SignalWire CDN URL
  - duration_seconds: Call length
  - has_live_translation: TRUE
  - live_translation_provider: 'signalwire'
```

---

#### **Step 5.2: Canonical Transcript Generation**

**Timeline:** 2-10 minutes after recording delivered

**Flow:**
1. System detects new recording
2. Triggers `/api/webhooks/signalwire?type=recording.completed`
3. Webhook handler:
   - Downloads recording from SignalWire (with auth)
   - Uploads to Supabase Storage (public bucket)
   - Submits public URL to AssemblyAI
4. AssemblyAI generates transcript
5. Transcript saved to `ai_runs` table

**Why Post-Call Transcript?**
- ✅ **Authoritative:** Legal/audit evidence
- ✅ **Higher Accuracy:** AssemblyAI has 93.4% WER
- ✅ **Permanent Record:** Stored indefinitely
- ✅ **Searchable:** Can query transcript text
- ✅ **Vendor Independent:** Not tied to SignalWire

**Note:** The live translation is for **real-time conversation assist**. The canonical transcript is for **evidence and audit**.

---

#### **Step 5.3: View Call Details**

**To view completed call:**

1. **In Call List (Left Column):**
   - Find the call in the list
   - Calls are sorted newest → oldest
   - Look for status badge: "Completed"

2. **Click on the call:**
   - Call detail view opens in center column
   - See call metadata:
     - Duration
     - Participants
     - Status
     - Timestamps

3. **Tabs Available:**
   - **Timeline:** Event chronology
   - **Transcript:** Full transcript (when available)
   - **Translation:** Translated text (when available)
   - **Recording:** Audio player
   - **Evidence:** Manifest and artifacts
   - **Notes:** Call notes and disposition

---

#### **Step 5.4: Access Transcript**

**Once transcript is ready:**

1. Navigate to call detail view
2. Click **"Transcript"** tab
3. See full transcript with:
   - Speaker diarization
   - Timestamps
   - Sentiment analysis
   - Key phrases

**Format Example:**
```
[00:00:05] Caller:
"Hola, necesito ayuda con mi pedido"

[00:00:08] Agent (via Translation):
"Hello, I need help with my order"

[00:00:12] Agent Response:
"Of course, I can help you with that. What's your order number?"
```

**Download Options:**
- Plain text (.txt)
- JSON (.json)
- PDF report (.pdf)

---

#### **Step 5.5: Access Translation**

**If post-call translation is enabled:**

1. Click **"Translation"** tab
2. See side-by-side comparison:
   - Original language transcript
   - Translated language transcript

**Note:** This is SEPARATE from live translation:
- **Live Translation:** Real-time audio during call
- **Post-Call Translation:** Text translation of transcript

---

#### **Step 5.6: Listen to Recording**

1. Click **"Recording"** tab
2. Audio player loads
3. Click "Play" to listen

**Features:**
- Playback speed control (0.5x, 1x, 1.5x, 2x)
- Skip forward/backward
- Download recording
- Timestamp markers sync with transcript

**Note:** The recording contains the ORIGINAL audio (before translation). The live translation audio is ephemeral and not recorded.

---

## 🔄 **Call Flow Diagram**

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER INITIATES CALL                        │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│ 1. UI: User clicks "Start Call"                                │
│    - Live Translation: ON                                       │
│    - From: Spanish (es)                                         │
│    - To: English (en)                                           │
│    - Target: +12392027345                                       │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. FRONTEND: POST /api/voice/call                              │
│    - Validates inputs                                           │
│    - Checks authentication                                      │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. BACKEND: startCallHandler()                                  │
│    - Fetches voice_configs from database                       │
│    - Checks: translate === true                                │
│    - Checks: translate_from === 'es'                           │
│    - Checks: translate_to === 'en'                             │
│    - Checks: organization plan === 'business'                  │
│    - Decision: useLiveTranslation = TRUE                       │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. SIGNALWIRE API CALL (LaML)                                   │
│    - Method: POST                                               │
│    - Endpoint: https://SPACE.signalwire.com/api/laml/...      │
│    - Parameters:                                                │
│      • From: +17062677235 (agent number)                       │
│      • To: +12392027345 (target)                               │
│      • Url: https://voxsouth.online/api/voice/swml/...        │
│              ?callId=UUID&from=es&to=en&orgId=UUID            │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. SIGNALWIRE: Initiates call to +12392027345                 │
│    - Phone rings                                                │
│    - Caller answers                                             │
│    - SignalWire fetches SWML from callback URL                 │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. SIGNALWIRE CALLBACK: POST /api/voice/swml/translation       │
│    - Query params: callId, from, to, orgId                     │
│    - buildLiveTranslationSWML() generates config               │
│    - Returns JSON:                                              │
│      {                                                          │
│        "version": "1.0.0",                                     │
│        "sections": {                                            │
│          "main": [                                              │
│            { "answer": {} },                                    │
│            { "ai": {                                            │
│                "prompt": {                                      │
│                  "text": "You are a translator. Translate...", │
│                  "temperature": 0.3                             │
│                },                                               │
│                "params": {                                      │
│                  "language": "es",                              │
│                  "translation_pair": "es-en"                    │
│                }                                                │
│              }                                                  │
│            }                                                    │
│          ]                                                      │
│        }                                                        │
│      }                                                          │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. SIGNALWIRE: Attaches AI Agent to call                       │
│    - AI Agent listens to RTP audio stream                      │
│    - Real-time processing:                                      │
│      1. Audio chunk received                                    │
│      2. STT: Audio → Text ("Hola, necesito ayuda")            │
│      3. Language detection: "es" (Spanish)                     │
│      4. Translation: "Hello, I need help"                      │
│      5. TTS: Text → Audio (English voice)                      │
│      6. Audio injection: Plays to caller                       │
│    - LATENCY: 1-3 seconds total                                │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. DURING CALL: Live Translation Active                        │
│    - Caller speaks Spanish continuously                        │
│    - AI Agent translates to English in real-time              │
│    - Conversation flows naturally                              │
│    - Translation is ephemeral (not recorded)                   │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│ 9. CALL ENDS: Caller hangs up                                  │
│    - SignalWire processes recording                            │
│    - Recording saved to SignalWire CDN                         │
│    - Recording is ORIGINAL audio (Spanish)                     │
│    - Translation audio NOT recorded                            │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│ 10. WEBHOOK: POST /api/webhooks/signalwire                     │
│     - Type: recording.completed                                 │
│     - Recording URL: https://SPACE.signalwire.com/...wav      │
│     - Metadata: duration, call_sid, etc.                       │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│ 11. RECORDING PROCESSING:                                       │
│     a) Download from SignalWire (with HTTP Basic Auth)        │
│     b) Upload to Supabase Storage (public bucket)             │
│     c) Get public URL                                          │
│     d) Submit to AssemblyAI                                    │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│ 12. ASSEMBLYAI: Generates canonical transcript                 │
│     - Processes Spanish audio                                   │
│     - Speaker diarization                                       │
│     - Sentiment analysis                                        │
│     - Saves to ai_runs table                                   │
│     - This is AUTHORITATIVE transcript                         │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│ 13. USER VIEWS RESULTS:                                         │
│     - Call detail page updated                                  │
│     - Transcript tab: Spanish transcript                        │
│     - Recording tab: Spanish audio                             │
│     - Evidence manifest: Complete audit trail                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 **Troubleshooting**

### **Problem 1: "Live Translation" toggle not visible**

**Symptoms:**
- Only see "Translate" (not "Live Translation")
- No "Preview" badge
- No language selectors appear

**Causes & Solutions:**

| Cause | Check | Solution |
|-------|-------|----------|
| **Plan too low** | Go to `/settings` → Check plan | Upgrade to Business plan |
| **Migration not run** | Ask admin | Admin must run SQL migration |
| **Feature flag disabled** | Check Vercel env vars | Set `ENABLE_LIVE_TRANSLATION_PREVIEW=true` |
| **Cache issue** | Try hard refresh | Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac) |

---

### **Problem 2: "Live Translation" toggle is grayed out**

**Symptoms:**
- Toggle is visible but disabled
- Hover shows warning icon

**Causes & Solutions:**

| Cause | Check | Solution |
|-------|-------|----------|
| **Insufficient role** | Check your role badge | Only Owner/Admin can configure |
| **API error** | Open browser console | Check for errors, contact support |
| **Organization issue** | Verify org ID | Re-login, clear cache |

---

### **Problem 3: Language selectors don't appear**

**Symptoms:**
- Toggle is ON
- But no dropdowns show

**Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| **UI state issue** | Refresh page, toggle OFF then ON again |
| **JavaScript error** | Open console, check for errors |
| **Component crash** | Try different browser |

---

### **Problem 4: Call fails immediately**

**Symptoms:**
- Click "Start Call"
- Error: "Call failed"
- No translation happens

**Causes & Solutions:**

| Cause | Check | Solution |
|-------|-------|----------|
| **Invalid phone number** | Check format | Use E.164: `+12392027345` |
| **Missing languages** | Verify both selected | Select both From and To languages |
| **SignalWire issue** | Check Vercel logs | Contact SignalWire support |
| **Insufficient credits** | Check SignalWire account | Top up account |

**Debug Steps:**
1. Open browser console (F12)
2. Click "Start Call"
3. Look for POST `/api/voice/call` request
4. Check response for error message
5. Share error with admin/support

---

### **Problem 5: Translation not working during call**

**Symptoms:**
- Call connects successfully
- But no translation happens
- Caller hears original audio only

**Causes & Solutions:**

| Cause | Check | Solution |
|-------|-------|----------|
| **SWML endpoint failed** | Check Vercel logs | Look for `/api/voice/swml/translation` errors |
| **AI Agent not attached** | Check SignalWire dashboard | Verify AI Agent enabled on account |
| **Wrong language codes** | Verify language selections | Use standard codes (en, es, fr, de) |
| **Feature not activated** | Contact SignalWire | Verify AI Agent feature is enabled |

**Verification:**
1. Go to SignalWire Dashboard
2. Navigate to Calls → Recent Calls
3. Find your call
4. Check "AI Agent" column
5. Should show "Attached" status

---

### **Problem 6: Post-call transcript missing**

**Symptoms:**
- Call completed successfully
- Transcript tab shows "Loading..." indefinitely
- Or shows "No transcript available"

**Causes & Solutions:**

| Cause | Timeline | Solution |
|-------|----------|----------|
| **Still processing** | 2-10 minutes | Wait, then refresh |
| **Recording not delivered** | Check after 5 min | Verify recording in SignalWire dashboard |
| **Webhook failed** | Admin check | Admin reviews webhook logs |
| **AssemblyAI error** | Admin check | Admin checks AssemblyAI credits/status |

**Note:** Transcript generation is asynchronous. Normal delay is 2-10 minutes after call ends.

---

## ❓ **FAQs**

### **General Questions**

**Q: What's the difference between "Live Translation" and "Translate"?**

**A:** 
- **Live Translation:** Real-time audio translation DURING the call (1-3 sec latency)
- **Translate:** Post-call text translation of the transcript

Both can be enabled simultaneously. Live Translation is for conversation assist. Post-call translation is for documentation.

---

**Q: Do I need to select languages, or will it auto-detect?**

**A:** 
- **Auto-detect works:** You can leave "From Language" blank
- **Better to specify:** Selecting languages improves accuracy and reduces latency by ~500ms

**Recommendation:** If you know the caller's language, select it.

---

**Q: Can I change languages mid-call?**

**A:** No. Translation settings are locked when the call starts. To use different languages, end the current call and start a new one with updated settings.

---

**Q: Is the translation recorded?**

**A:** No. The recording contains the ORIGINAL audio only. The live translation is ephemeral (real-time only, not saved).

**Why?** For legal/audit purposes, we maintain the original untranslated audio as the source of truth.

---

**Q: How accurate is the translation?**

**A:** 
- **General conversation:** 85-95% accurate
- **Technical jargon:** 70-85% accurate
- **Accents/dialects:** 75-90% accurate

**Note:** SignalWire AI Agents use state-of-the-art NLP models. Accuracy improves over time as models are updated.

---

**Q: What's the latency?**

**A:** 
- **Typical:** 1-3 seconds from speech to translated audio
- **Best case:** <1 second
- **Worst case:** 4-5 seconds (poor connection or complex sentence)

**For comparison:**
- Human interpreter: 3-5 seconds
- Video call lag: 200-500ms

---

**Q: Does it work with multiple speakers?**

**A:** Yes, but with limitations:
- ✅ AI Agent translates all speech on the call
- ⚠️ Cannot distinguish speakers in real-time
- ⚠️ If multiple people talk simultaneously, translation may overlap

**Best practice:** Structured turn-taking (one person speaks at a time).

---

**Q: Can I use this for conference calls?**

**A:** Partially supported:
- ✅ Works for 1-on-1 calls
- ⚠️ Works for small groups (2-3 people) if turn-taking is structured
- ❌ Not recommended for large conferences (5+ people)

**Limitation:** AI Agent translates the entire audio stream. With many speakers, translations may become confusing.

---

**Q: What languages are supported?**

**A:** Currently 12 languages:
- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Portuguese (pt)
- Chinese (zh)
- Japanese (ja)
- Korean (ko)
- Arabic (ar)
- Hindi (hi)
- Russian (ru)

**Note:** More languages may be added in future updates.

---

**Q: Does voice cloning work?**

**A:** Experimental. Voice cloning attempts to preserve the caller's voice characteristics when speaking the translation. 

**Current status:**
- ✅ Feature is implemented
- ⚠️ Quality depends on SignalWire's voice cloning capabilities
- 🔬 Still being tested

**Recommendation:** Try both with and without voice cloning to compare quality.

---

**Q: How much does live translation cost?**

**A:** 
- **For Business plan:** Included (no additional charge)
- **Per-minute cost:** $0 (unlimited AI Agent usage)
- **Only pay:** Base SignalWire plan ($500/month)

**Note:** AssemblyAI post-call transcripts are charged separately (~$0.0042/min), but this is minimal.

---

### **Technical Questions**

**Q: What happens if the AI Agent crashes mid-call?**

**A:** 
- Call continues normally (no disconnection)
- Translation stops
- Original audio continues
- System logs error for debugging

**Recovery:** User would need to end call and restart with translation enabled.

---

**Q: Can I test this without making a real call?**

**A:** Not currently. The AI Agent only activates on live calls. 

**Alternative:** Use your own phone number as the target to test the feature.

---

**Q: Is PII/sensitive data safe?**

**A:** Yes, with caveats:
- ✅ Audio is encrypted in transit (TLS/SRTP)
- ✅ Original recording is stored securely
- ⚠️ Live translation audio passes through SignalWire's AI Agent servers
- ⚠️ Translation text may be processed by third-party AI models

**Compliance:**
- HIPAA: Not compliant (AI processing involves third parties)
- GDPR: Compliant (with proper data processing agreements)
- PCI-DSS: Do not use for payment card information

---

**Q: Can I integrate this with my CRM?**

**A:** Yes, via API:
- Webhook notifications when call starts/ends
- REST API to fetch call details, transcripts
- Evidence manifest with full call metadata

**See:** API documentation for integration details.

---

**Q: What if the caller speaks multiple languages in one call?**

**A:** 
- ✅ AI Agent can detect language switches
- ✅ Will translate each segment to target language
- ⚠️ May have slight delay when switching languages

**Example:** If caller switches from Spanish to English mid-call, AI Agent detects this and adjusts.

---

## 📞 **Support**

### **Need Help?**

| Issue | Contact |
|-------|---------|
| **Technical problems** | support@voxsouth.online |
| **Billing/plan questions** | billing@voxsouth.online |
| **Feature requests** | product@voxsouth.online |
| **SignalWire issues** | support@signalwire.com |

### **Additional Resources**

- **SignalWire AI Agent Docs:** https://developer.signalwire.com/ai
- **AssemblyAI Docs:** https://www.assemblyai.com/docs
- **Architecture Docs:** `ARCH_DOCS/01-CORE/GRAPHICAL_ARCHITECTURE.md`
- **Status Report:** `SIGNALWIRE_LIVE_TRANSLATION_STATUS.md`

---

## 📝 **Document History**

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-01-15 | Initial user flow documentation | System |

---

**End of Document**
