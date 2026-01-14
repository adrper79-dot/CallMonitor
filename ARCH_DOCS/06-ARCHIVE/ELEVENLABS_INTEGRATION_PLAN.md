# ElevenLabs Integration Plan for Translation

**Date:** January 12, 2026  
**Purpose:** Add high-quality text-to-speech for translated audio  
**Feasibility:** ✅ **HIGHLY FEASIBLE**

---

## 🎯 **WHY ELEVENLABS?**

### **What ElevenLabs Excels At:**
1. ✅ **Ultra-realistic voice synthesis** (29 languages)
2. ✅ **Voice cloning** (maintain caller's voice characteristics)
3. ✅ **Streaming API** (low latency for real-time)
4. ✅ **Multilingual support** (same voice, different languages)
5. ✅ **Emotional prosody** (natural-sounding intonation)

### **Perfect Use Cases:**
- Post-call translation playback (excellent quality)
- Real-time translation audio injection (via streaming API)
- Voice preservation across languages (voice cloning)
- Natural-sounding automated responses

---

## 📊 **CURRENT TRANSLATION FLOW**

### **Post-Call Translation (Production):**
```
Caller speaks Spanish
  ↓
SignalWire records audio
  ↓
AssemblyAI transcribes → "Hola, ¿cómo estás?"
  ↓
OpenAI GPT-3.5 translates → "Hello, how are you?"
  ↓
❌ MISSING: Convert to audio
  ↓
Store as text only
```

### **Live Translation (Preview - Business+ Plan):**
```
Caller speaks Spanish
  ↓
SignalWire AI Agent (real-time)
  ↓
STT → "Hola" → LLM → "Hello" → TTS → Play to listener
  ↓
(Non-authoritative - SignalWire's TTS quality is OK but not great)
```

---

## ✨ **WITH ELEVENLABS**

### **Option A: Post-Call Translation Enhancement**
```
Caller speaks Spanish
  ↓
SignalWire records audio
  ↓
AssemblyAI transcribes → "Hola, ¿cómo estás?"
  ↓
OpenAI translates → "Hello, how are you?"
  ↓
✨ ElevenLabs synthesizes → High-quality English audio file
  ↓
Store both text + audio URL in recordings table
  ↓
UI: Play translated audio with perfect pronunciation
```

**Benefits:**
- ✅ Listeners can **hear** the translation, not just read it
- ✅ Perfect for reviewing calls later
- ✅ Archive quality is professional-grade
- ✅ Supports 29 languages

### **Option B: Live Translation with Better Quality**
```
Caller speaks Spanish
  ↓
SignalWire captures audio chunk
  ↓
AssemblyAI real-time STT → "Hola"
  ↓
OpenAI translates → "Hello"
  ↓
✨ ElevenLabs streaming TTS → High-quality English audio
  ↓
SignalWire injects audio → Listener hears beautiful English
```

**Benefits:**
- ✅ Much better audio quality than SignalWire's TTS
- ✅ Voice cloning possible (maintain caller's voice)
- ✅ Lower latency with streaming API
- ✅ More natural-sounding prosody

---

## 🔧 **IMPLEMENTATION OPTIONS**

### **Option 1: Post-Call Only (Easiest - Recommended First)**

**Complexity:** ⭐⭐☆☆☆ (Easy)  
**Impact:** High (immediate value)  
**Timeline:** 1-2 days

**What it does:**
- After call ends, generate translated audio
- Store alongside transcript
- Play in UI when viewing recordings

**Implementation:**

1. **Add ElevenLabs to translation service:**

```typescript
// In app/services/translation.ts

import { ElevenLabsClient } from 'elevenlabs'

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY
})

export async function translateText(input: TranslationInput): Promise<void> {
  // ... existing translation logic ...
  
  if (translatedText) {
    // Generate audio for translated text
    const audio = await elevenlabs.generate({
      text: translatedText,
      voice: 'Rachel', // Or use voice cloning
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    })
    
    // Upload to Supabase storage
    const audioFileName = `translations/${translationRunId}.mp3`
    const { data: uploadData } = await supabaseAdmin.storage
      .from('recordings')
      .upload(audioFileName, audio, {
        contentType: 'audio/mpeg'
      })
    
    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('recordings')
      .getPublicUrl(audioFileName)
    
    // Update ai_runs with audio URL
    await supabaseAdmin
      .from('ai_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        output: {
          translated_text: translatedText,
          translated_audio_url: publicUrl, // ← New!
          translation_provider: 'openai',
          tts_provider: 'elevenlabs'
        }
      })
      .eq('id', translationRunId)
  }
}
```

2. **Update schema to store audio URL:**

```sql
-- migrations/2026-01-12-add-translation-audio.sql
ALTER TABLE ai_runs 
  ADD COLUMN translated_audio_url text;

COMMENT ON COLUMN ai_runs.translated_audio_url IS 
  'URL to ElevenLabs-generated audio of translated text';
```

3. **Update UI to play audio:**

```tsx
// In components/voice/TranslationView.tsx

export function TranslationView({ aiRun }: { aiRun: AiRun }) {
  const translatedText = aiRun.output?.translated_text
  const audioUrl = aiRun.output?.translated_audio_url
  
  return (
    <div>
      <h3>Translation</h3>
      <p>{translatedText}</p>
      
      {audioUrl && (
        <audio controls src={audioUrl}>
          Your browser does not support audio playback.
        </audio>
      )}
    </div>
  )
}
```

**Cost:** ~$0.30 per 1,000 characters (very affordable)

---

### **Option 2: Real-Time Streaming (Advanced)**

**Complexity:** ⭐⭐⭐⭐☆ (Advanced)  
**Impact:** Very High (game-changer)  
**Timeline:** 1-2 weeks

**What it does:**
- Real-time translation with high-quality audio
- Inject back into SignalWire call
- Much better than SignalWire's built-in TTS

**Implementation:**

```typescript
// New file: app/services/realtimeTranslation.ts

import { ElevenLabsClient } from 'elevenlabs'
import WebSocket from 'ws'

export async function streamTranslatedAudio(
  translatedText: string,
  callSid: string,
  targetLanguage: string
) {
  const elevenlabs = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY
  })
  
  // Use ElevenLabs streaming API
  const stream = await elevenlabs.textToSpeechStream({
    text: translatedText,
    voice_id: 'pNInz6obpgDQGcFmaJgB', // Adam - multilingual
    model_id: 'eleven_multilingual_v2',
    output_format: 'pcm_16000' // Raw PCM for telephony
  })
  
  // Stream to SignalWire using Media Streams
  const signalWireWs = new WebSocket(
    `wss://${process.env.SIGNALWIRE_SPACE}.signalwire.com/...`
  )
  
  for await (const chunk of stream) {
    signalWireWs.send(JSON.stringify({
      event: 'media',
      streamSid: callSid,
      media: {
        payload: chunk.toString('base64')
      }
    }))
  }
}
```

**Challenges:**
- Need to integrate with SignalWire's Media Streams API
- Requires WebSocket handling
- More complex error handling

**Benefits:**
- ✅ Best-in-class audio quality
- ✅ Voice cloning possible
- ✅ Lower latency than current solution

---

### **Option 3: Voice Cloning (Premium)**

**Complexity:** ⭐⭐⭐☆☆ (Moderate)  
**Impact:** Very High (unique feature)  
**Timeline:** 2-3 days

**What it does:**
- Clone caller's voice from their audio
- Speak translation in their own voice
- "Magic" experience

**Implementation:**

```typescript
// 1. Create voice clone from recording
const voiceId = await elevenlabs.voices.clone({
  name: `caller-${callId}`,
  files: [recordingAudioBuffer],
  description: `Voice clone for call ${callId}`
})

// 2. Use cloned voice for translation
const audio = await elevenlabs.generate({
  text: translatedText,
  voice: voiceId,
  model_id: 'eleven_multilingual_v2'
})
```

**Use case:**
- Agent hears customer speaking in their own voice, but in agent's language
- Incredibly natural-sounding

**Cost:** Higher ($99/month for voice cloning feature)

---

## 💰 **PRICING**

### **ElevenLabs Pricing Tiers:**

| Tier | Price | Characters/month | Best For |
|------|-------|------------------|----------|
| Free | $0 | 10,000 | Testing |
| Starter | $5 | 30,000 | Light usage |
| Creator | $22 | 100,000 | Moderate usage |
| Pro | $99 | 500,000 | Heavy usage |
| Scale | $330 | 2,000,000 | Enterprise |

**Cost per call (estimated):**
- Average call transcript: ~500 characters
- Translation cost: ~$0.15 per call with Creator plan
- **Very affordable!**

---

## 🚀 **RECOMMENDED IMPLEMENTATION PATH**

### **Phase 1: Post-Call Translation Audio (Start Here)**

**Week 1:**
- [ ] Sign up for ElevenLabs account (Start with Free tier)
- [ ] Add `ELEVENLABS_API_KEY` to environment variables
- [ ] Install ElevenLabs SDK: `npm install elevenlabs`
- [ ] Modify `app/services/translation.ts` to generate audio
- [ ] Add migration for `translated_audio_url` column
- [ ] Update UI to play translated audio
- [ ] Test with a few calls

**Deliverables:**
- ✅ Translated text + audio stored
- ✅ UI plays translated audio
- ✅ Works for all 29 supported languages

---

### **Phase 2: Improve Voice Quality (Optional)**

**Week 2-3:**
- [ ] Experiment with different voices
- [ ] Add voice selection in settings
- [ ] Test emotional prosody settings
- [ ] Optimize for specific languages

---

### **Phase 3: Real-Time Streaming (Advanced)**

**Week 4-6:**
- [ ] Implement ElevenLabs streaming API
- [ ] Integrate with SignalWire Media Streams
- [ ] Add WebSocket handling
- [ ] Test latency and quality
- [ ] Fallback to text-only if streaming fails

---

### **Phase 4: Voice Cloning (Premium Feature)**

**Week 7-8:**
- [ ] Upgrade to Pro plan ($99/month)
- [ ] Implement voice cloning from recordings
- [ ] Store voice IDs in database
- [ ] Use cloned voices for translations
- [ ] Add UI to enable/disable voice cloning

---

## 📋 **FILES TO CREATE/MODIFY**

### **New Files:**
1. `app/services/elevenlabs.ts` - ElevenLabs client wrapper
2. `migrations/2026-01-12-add-translation-audio.sql` - Schema update
3. `ELEVENLABS_INTEGRATION_PLAN.md` - This file

### **Modified Files:**
1. `app/services/translation.ts` - Add audio generation
2. `components/voice/TranslationView.tsx` - Add audio player
3. `.env.example` - Add `ELEVENLABS_API_KEY`
4. `lib/env-validation.ts` - Validate ElevenLabs key

---

## 🧪 **TESTING CHECKLIST**

- [ ] Test with Spanish → English translation
- [ ] Test with English → Spanish translation
- [ ] Test with 29 supported languages
- [ ] Test audio playback in different browsers
- [ ] Test with long translations (>1000 chars)
- [ ] Test error handling (API failures)
- [ ] Test cost tracking (characters used)
- [ ] Test storage limits (audio file sizes)

---

## ⚠️ **CONSIDERATIONS**

### **Pros:**
- ✅ Best-in-class TTS quality
- ✅ 29 languages supported
- ✅ Voice cloning possible
- ✅ Streaming API available
- ✅ Easy to integrate
- ✅ Affordable pricing

### **Cons:**
- ⚠️ Additional API dependency
- ⚠️ Costs scale with usage
- ⚠️ Voice cloning requires Pro plan
- ⚠️ Real-time streaming is complex

### **Alternatives Considered:**

| Service | Pros | Cons |
|---------|------|------|
| Google Cloud TTS | ✅ Reliable, ✅ Cheap | ❌ Robotic quality |
| AWS Polly | ✅ Good quality, ✅ Cheap | ❌ Not as natural |
| Azure TTS | ✅ Good quality | ❌ Complex setup |
| **ElevenLabs** | ✅ **Best quality** | ⚠️ Higher cost |

**Verdict:** ElevenLabs is worth it for the quality!

---

## 📊 **ARCHITECTURE INTEGRATION**

### **Updated Translation Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│                     TRANSLATION PIPELINE                     │
└─────────────────────────────────────────────────────────────┘

Call Audio
  ↓
SignalWire (Records)
  ↓
AssemblyAI (Transcribes - Canonical)
  ↓ "Hola, ¿cómo estás?"
  
OpenAI GPT-3.5 (Translates Text)
  ↓ "Hello, how are you?"
  
✨ ElevenLabs (Synthesizes Audio)
  ↓ 🔊 High-quality English audio
  
Supabase Storage (Stores Audio)
  ↓
ai_runs.translated_audio_url (Reference)
  ↓
UI (Plays Audio)
```

**Aligns with:**
- ✅ AssemblyAI as canonical source (transcription)
- ✅ OpenAI for translation (text)
- ✅ ElevenLabs for audio (new layer)
- ✅ Supabase for storage (persistence)

---

## ✅ **RECOMMENDATION**

**Start with Phase 1: Post-Call Translation Audio**

**Why:**
1. ✅ Easy to implement (1-2 days)
2. ✅ Immediate value (hear translations)
3. ✅ Low risk (post-call only)
4. ✅ Affordable (Free tier for testing)
5. ✅ High quality (better than reading text)

**Next Steps:**
1. Sign up for ElevenLabs: https://elevenlabs.io/
2. Get API key
3. I'll implement the integration
4. Test with a few calls
5. Deploy!

**Want me to implement Phase 1 now?** 🚀
