# Integration Patches - Apply to Existing Files
**Date:** 2026-02-11
**Purpose:** Integrate Groq/Grok into existing translation and TTS processors

---

## File 1: `workers/src/lib/translation-processor.ts`

### Add imports at top:
```typescript
// ADD these imports after existing imports
import { executeAICompletion } from './ai-router'
import { redactPII } from './pii-redactor'
```

### Replace the OpenAI translation call (lines ~127-174) with:

```typescript
// REPLACE this section:
// const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
//   method: 'POST',
//   headers: {
//     Authorization: `Bearer ${openaiKey}`,
//     'Content-Type': 'application/json',
//   },
//   body: JSON.stringify({
//     model: TRANSLATION_MODEL,
//     messages: [
//       {
//         role: 'system',
//         content: `You are a real-time call translator...`,
//       },
//       { role: 'user', content: originalText },
//     ],
//     max_tokens: 500,
//     temperature: 0.1,
//   }),
// })

// WITH this (smart routing with PII redaction):
const aiResult = await executeAICompletion(
  originalText,
  'translation', // Routes to Groq by default (38% cheaper)
  { OPENAI_API_KEY: openaiKey, GROQ_API_KEY: process.env.GROQ_API_KEY } as any,
  {
    systemPrompt: `You are a real-time call translator. Translate the following ${sourceName} text to ${targetName}. Output ONLY the translated text with no explanation, no quotes, no extra formatting. Preserve the speaker's tone and intent.`,
    temperature: 0.3,
    maxTokens: 500,
    applyPIIRedaction: true, // Redact SSN, CC, etc before translation
    applyPromptSanitization: false, // Skip for transcripts (already validated)
  }
)

const translatedText = aiResult.content

// Log cost savings
logger.info('Translation completed', {
  callId,
  segmentIndex,
  provider: aiResult.provider, // 'groq' or 'openai'
  tokens: aiResult.usage.total_tokens,
  cost_usd: aiResult.cost_usd,
  latency_ms: aiResult.latency_ms,
})
```

---

## File 2: `workers/src/lib/tts-processor.ts`

### Add imports at top:
```typescript
// ADD these imports after existing imports
import { createGrokVoiceClient, getVoiceForLanguage } from './grok-voice-client'
```

### Add feature flag check at top of `synthesizeSpeech` function:

```typescript
export async function synthesizeSpeech(
  db: DbClient,
  elevenlabsKey: string,
  r2Client: any,
  segment: TTSSegment,
  env?: any // Add env parameter
): Promise<TTSResult> {
  const {
    callId,
    organizationId,
    translatedText,
    targetLanguage,
    segmentIndex,
    voiceId,
    r2PublicUrl,
  } = segment

  // Skip empty segments
  if (!translatedText || translatedText.trim().length === 0) {
    return { success: true, segmentIndex }
  }

  // Feature flag: Use Grok Voice if enabled (83% cheaper)
  const useGrokVoice = env?.AI_PROVIDER_GROK_ENABLED === true || env?.AI_PROVIDER_GROK_ENABLED === 'true'

  if (useGrokVoice && env?.GROK_API_KEY) {
    return await synthesizeSpeechWithGrok(db, r2Client, segment, env)
  }

  // Fallback to ElevenLabs (existing code below...)
  const voiceConfig = await getVoiceConfig(db, organizationId)
  // ... rest of existing ElevenLabs code
}
```

### Add new function after `synthesizeSpeech`:

```typescript
/**
 * Synthesize speech using Grok Voice API (83% cheaper than ElevenLabs)
 */
async function synthesizeSpeechWithGrok(
  db: DbClient,
  r2Client: any,
  segment: TTSSegment,
  env: any
): Promise<TTSResult> {
  const { callId, translatedText, targetLanguage, segmentIndex, r2PublicUrl } = segment

  try {
    const grokClient = createGrokVoiceClient(env)
    const voice = getVoiceForLanguage(targetLanguage)

    logger.info('Synthesizing speech with Grok Voice', {
      callId,
      segmentIndex,
      voice,
      language: targetLanguage,
      text_length: translatedText.length,
    })

    // Generate audio
    const ttsResult = await grokClient.textToSpeech(translatedText, {
      voice,
      model: 'grok-voice-1',
      response_format: 'mp3',
      speed: 1.0,
    })

    // Upload to R2
    const timestamp = Date.now()
    const filename = `tts/${timestamp}-${voice}-${targetLanguage}.mp3`

    await r2Client.put(filename, ttsResult.audio, {
      httpMetadata: {
        contentType: 'audio/mpeg',
      },
      customMetadata: {
        callId,
        segmentIndex: segmentIndex.toString(),
        voice,
        language: targetLanguage,
        provider: 'grok-voice',
        duration: ttsResult.duration_seconds.toString(),
      },
    })

    const audioUrl = `${r2PublicUrl || env.PUBLIC_BUCKET_URL}/${filename}`

    logger.info('Grok Voice TTS successful', {
      callId,
      segmentIndex,
      audioUrl,
      duration_seconds: ttsResult.duration_seconds,
      cost_usd: ttsResult.cost_usd,
    })

    return {
      success: true,
      audioUrl,
      durationMs: ttsResult.duration_seconds * 1000,
      segmentIndex,
    }
  } catch (error: any) {
    logger.error('Grok Voice TTS failed', {
      callId,
      segmentIndex,
      error: error?.message,
    })

    return {
      success: false,
      error: error?.message || 'TTS failed',
      segmentIndex,
    }
  }
}
```

---

## File 3: `workers/src/routes/bond-ai.ts`

### Add imports at top:
```typescript
// ADD after existing imports
import { executeBondAIChat } from '../lib/ai-router'
```

### Replace OpenAI call in `/chat` endpoint (around line 114):

Find this section:
```typescript
// const response = await fetch('https://api.openai.com/v1/chat/completions', {
//   method: 'POST',
//   headers: {
//     'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
//     'Content-Type': 'application/json',
//   },
//   body: JSON.stringify({
//     model: 'gpt-4o-mini',
//     messages: conversationMessages,
//     temperature: 0.7,
//     max_tokens: 800,
//   }),
// })
```

Replace with:
```typescript
// Smart routing: Simple queries → Groq, Complex queries → OpenAI
const aiResult = await executeBondAIChat(
  userMessage,
  conversationHistory,
  BOND_AI_SYSTEM_PROMPT,
  c.env
)

// Log provider used for analytics
logger.info('Bond AI chat completed', {
  org_id,
  user_id,
  provider: aiResult.provider,
  tokens: aiResult.usage.total_tokens,
  cost_usd: aiResult.cost_usd,
  latency_ms: aiResult.latency_ms,
})

const assistantReply = aiResult.content
```

---

## File 4: `workers/src/lib/sentiment-processor.ts`

### Add imports at top:
```typescript
// ADD after existing imports
import { analyzeSentimentWithGroq } from './groq-client'
```

### Replace OpenAI sentiment call with Groq:

Find the OpenAI sentiment API call and wrap it:
```typescript
// ADD feature flag check
const useGroq = env?.AI_PROVIDER_GROQ_ENABLED === true || env?.AI_PROVIDER_GROQ_ENABLED === 'true'

if (useGroq && env?.GROQ_API_KEY) {
  // Use Groq (75% cheaper)
  const result = await analyzeSentimentWithGroq(transcriptSegment, env)

  return {
    score: result.score,
    objections: result.objections,
    escalation: result.escalation,
  }
} else {
  // Fallback to OpenAI (existing code)
  // ... existing OpenAI sentiment code
}
```

---

## File 5: `workers/src/index.ts` (Add env types)

### Update Env interface to include new keys:

Find the `Env` interface and add:
```typescript
export interface Env {
  // Existing keys...
  OPENAI_API_KEY: string
  ASSEMBLYAI_API_KEY: string
  ELEVENLABS_API_KEY: string
  TELNYX_API_KEY: string

  // NEW: Add these
  GROQ_API_KEY: string
  GROK_API_KEY: string

  // NEW: Feature flags
  AI_PROVIDER_GROQ_ENABLED: string
  AI_PROVIDER_GROK_ENABLED: string
  AI_PROVIDER_PREFER_CHEAP: string
  PUBLIC_BUCKET_URL: string

  // Bindings...
  KV: KVNamespace
  R2: R2Bucket
  AUDIO_BUCKET: R2Bucket
  HYPERDRIVE: Hyperdrive
}
```

---

## Testing Checklist

After applying patches:

1. **Compile check:**
   ```bash
   cd workers
   npm run build
   ```

2. **Type check:**
   ```bash
   npm run typecheck
   ```

3. **Deploy:**
   ```bash
   npm run deploy
   ```

4. **Test translation:**
   - Make a test call with translation enabled
   - Check logs: `npx wrangler tail`
   - Look for "provider: groq" in logs

5. **Test TTS:**
   - Enable voice-to-voice translation
   - Check logs for "Grok Voice TTS successful"

6. **Test Bond AI:**
   - Send a simple chat message
   - Check if it routes to Groq (simple) or OpenAI (complex)

7. **Monitor costs:**
   ```sql
   SELECT provider, COUNT(*), SUM(cost_usd)
   FROM ai_operation_logs
   WHERE created_at > NOW() - INTERVAL '1 hour'
   GROUP BY provider;
   ```

---

## Rollback Plan

If issues occur:

1. **Disable Groq/Grok:**
   ```bash
   # Via wrangler.toml
   AI_PROVIDER_GROQ_ENABLED = false
   AI_PROVIDER_GROK_ENABLED = false
   npm run deploy
   ```

2. **Or via secrets:**
   ```bash
   echo "false" | npx wrangler secret put AI_PROVIDER_GROQ_ENABLED
   echo "false" | npx wrangler secret put AI_PROVIDER_GROK_ENABLED
   ```

System will automatically fall back to OpenAI + ElevenLabs.
