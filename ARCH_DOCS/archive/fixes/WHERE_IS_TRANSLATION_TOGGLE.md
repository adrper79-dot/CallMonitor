# Where to Find the Live Translation Toggle

## 📍 **Location**

The live translation toggle is on the **Voice Operations page** in the **Call Detail View**.

---

## 🗺️ **How to Access It**

### Step 1: Navigate to Voice Operations
**URL:** `/voice`

### Step 2: Select a Call
- You'll see a **call list on the left sidebar**
- Click on any call to open the Call Detail View

### Step 3: Scroll to Call Modulations
- The Call Detail View opens in the center panel
- Scroll down to the **"Call Modulations"** section
- This is where you'll see all the toggles including:
  - ✅ Recording
  - ✅ Transcribe
  - ✅ **Translate** ← This one will show as "Live Translation (Preview)" if you have Business plan + feature flag
  - ✅ After-call Survey
  - ✅ Secret Shopper

---

## 🎯 **Current Issue**

The toggles are **hardcoded to false** in `CallDetailView.tsx` line 164-170:

```typescript
initialModulations={{
  record: false,  // Hardcoded!
  transcribe: false,
  translate: false,  // Should load from voice_configs
  survey: false,
  synthetic_caller: false,
}}
```

**This means:**
- The toggles will ALWAYS show as OFF
- They're not loading from your actual `voice_configs` table
- Changes won't persist

---

## ✅ **The Fix Needed**

The `CallDetailView` component needs to **fetch voice_configs** for the organization and pass real values:

```typescript
// SHOULD BE:
const { config } = useVoiceConfig(organizationId)

initialModulations={{
  record: config?.recording_enabled ?? false,
  transcribe: config?.transcription_enabled ?? false,
  translate: config?.translation_enabled ?? false,
  survey: config?.survey_enabled ?? false,
  synthetic_caller: config?.secret_shopper_enabled ?? false,
}}
```

---

## 🔧 **Quick Fix**

Let me update `CallDetailView.tsx` to actually load from voice_configs:

**File:** `components/voice/CallDetailView.tsx`

**Change needed:**
1. Import `useVoiceConfig` hook
2. Fetch the config for the organization
3. Pass real values to `initialModulations`

---

## 🧪 **For Testing Manually**

If you want to see the toggle without the fix:

1. **Go to** `/voice`
2. **Click any call** in the left sidebar
3. **Scroll down** to "Call Modulations"
4. You'll see toggles (all OFF because hardcoded)

**To see live translation toggle change:**
- Need Business plan in database
- Need `TRANSLATION_LIVE_ASSIST_PREVIEW=true` in env
- Need to fix the component to load from voice_configs

---

## 📊 **Page Structure**

```
/voice page
├── Left Sidebar (25%)
│   └── CallList (click a call here)
├── Main Panel (50%)
│   ├── Target & Campaign Selector
│   ├── Execution Controls
│   └── Call Detail View  ← CallModulations is here!
│       ├── Call Info
│       ├── Status Badges
│       ├── **Call Modulations** ← TOGGLES ARE HERE
│       └── Artifact Viewer
└── Right Sidebar (25%)
    └── Activity Feed
```

---

## 🎯 **Summary**

**Location:** `/voice` page → Select a call → Scroll to "Call Modulations"  
**Current State:** Toggles are visible but hardcoded to OFF  
**What's Needed:** Component needs to load real values from `voice_configs` table

**Want me to fix the component now?** ✅
