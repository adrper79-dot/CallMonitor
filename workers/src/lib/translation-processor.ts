/**
 * Live Translation Processor — Real-time transcription → translation → TTS → audio injection pipeline
 *
 * Receives transcription segments from Telnyx Call Control v2 webhooks,
 * translates them via OpenAI, synthesizes speech via ElevenLabs, and injects
 * audio into active calls for full voice-to-voice translation.
 *
 * Architecture (lowest latency path):
 *   Telnyx Transcription Webhook → translateAndStore() → OpenAI GPT-4o-mini → ElevenLabs TTS → Telnyx Audio Injection
 *   No WebSocket relay, no Durable Objects, no external transcription API.
 *
 * Latency budget:
 *   Telnyx transcription delivery: ~0.5-1s after utterance
 *   OpenAI translation (gpt-4o-mini): ~0.3-0.5s
 *   ElevenLabs TTS: ~0.5-0.8s
 *   Telnyx audio injection: ~0.2s
 *   Total end-to-end: ~2-3s per utterance
 *
 * @see ARCH_DOCS/02-FEATURES/LIVE_TRANSLATION_FLOW.md
 * @see ARCH_DOCS/02-FEATURES/VOICE_TO_VOICE_TRANSLATION.md
 */

import type { DbClient } from './db'
import { logger } from './logger'
import { synthesizeSpeech, type TTSSegment } from './tts-processor'
import { queueAudioInjection, type AudioInjection } from './audio-injector'

const OPENAI_BASE = 'https://api.openai.com/v1'
const TRANSLATION_MODEL = 'gpt-4o-mini'

/** Language code to human-readable name mapping for translation prompts */
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  zh: 'Chinese (Simplified)',
  ja: 'Japanese',
  pt: 'Portuguese',
  it: 'Italian',
  ko: 'Korean',
  ar: 'Arabic',
}

export interface TranslationSegment {
  callId: string
  organizationId: string
  originalText: string
  sourceLanguage: string
  targetLanguage: string
  segmentIndex: number
  confidence: number
  voiceToVoice?: boolean
  elevenlabsKey?: string
  telnyxKey?: string
  targetCallControlId?: string
  r2Client?: R2Bucket
  r2PublicUrl?: string
}

export interface TranslationResult {
  success: boolean
  translatedText?: string
  segmentIndex: number
  error?: string
}

/**
 * Translate a single transcription segment and store in DB.
 * If voice-to-voice mode is enabled, also synthesize speech and inject audio.
 *
 * This is the hot path — called for every utterance during a live call.
 * Optimized for minimal latency:
 *   1. Single OpenAI call with minimal prompt
 *   2. Single DB INSERT (no SELECT first)
 *
 * **Connection ownership:** The caller is responsible for calling `db.end()`
 * after all translation segments are processed. This function does NOT close
 * the connection, as multiple segments may use the same DbClient in sequence.
 *   3. Optional TTS + audio injection pipeline
 */
export async function translateAndStore(
  db: DbClient,
  openaiKey: string,
  segment: TranslationSegment
): Promise<TranslationResult> {
  const {
    callId,
    organizationId,
    originalText,
    sourceLanguage,
    targetLanguage,
    segmentIndex,
    confidence,
    voiceToVoice = false,
    elevenlabsKey,
    telnyxKey,
    targetCallControlId,
    r2Client,
    r2PublicUrl,
  } = segment

  // Skip empty or whitespace-only segments
  if (!originalText || originalText.trim().length === 0) {
    return { success: true, translatedText: '', segmentIndex }
  }

  // If source and target are the same, pass through without API call
  if (sourceLanguage === targetLanguage) {
    await insertTranslation(db, {
      callId,
      organizationId,
      originalText,
      translatedText: originalText,
      sourceLanguage,
      targetLanguage,
      segmentIndex,
      confidence,
    })
    return { success: true, translatedText: originalText, segmentIndex }
  }

  const sourceName = LANGUAGE_NAMES[sourceLanguage] || sourceLanguage
  const targetName = LANGUAGE_NAMES[targetLanguage] || targetLanguage

  try {
    const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: TRANSLATION_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a real-time call translator. Translate the following ${sourceName} text to ${targetName}. Output ONLY the translated text with no explanation, no quotes, no extra formatting. Preserve the speaker's tone and intent.`,
          },
          { role: 'user', content: originalText },
        ],
        max_tokens: 500,
        temperature: 0.1, // Low temperature for consistent translations
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      logger.error('OpenAI translation failed', {
        status: response.status,
        callId,
        segmentIndex,
        error: errText.substring(0, 200),
      })
      // Store original text as fallback so SSE still delivers something
      await insertTranslation(db, {
        callId,
        organizationId,
        originalText,
        translatedText: `[Translation unavailable] ${originalText}`,
        sourceLanguage,
        targetLanguage,
        segmentIndex,
        confidence: 0,
      })
      return { success: false, error: 'OpenAI API error', segmentIndex }
    }

    const result = await response.json<{
      choices: Array<{ message: { content: string } }>
      usage?: { total_tokens: number }
    }>()

    const translatedText = result.choices?.[0]?.message?.content?.trim() || originalText

    // Log token usage for cost tracking
    if (result.usage) {
      logger.info('Translation token usage', {
        callId,
        segmentIndex,
        tokens: result.usage.total_tokens,
      })
    }

    await insertTranslation(db, {
      callId,
      organizationId,
      originalText,
      translatedText,
      sourceLanguage,
      targetLanguage,
      segmentIndex,
      confidence,
    })

    // If voice-to-voice mode is enabled, synthesize speech and inject audio
    if (voiceToVoice && elevenlabsKey && telnyxKey && targetCallControlId && r2Client) {
      try {
        // Synthesize speech
        const ttsResult = await synthesizeSpeech(db, elevenlabsKey, r2Client, {
          callId,
          organizationId,
          translatedText,
          targetLanguage,
          segmentIndex,
          r2PublicUrl,
        })

        if (ttsResult.success && ttsResult.audioUrl && ttsResult.durationMs) {
          // Inject audio into call
          const injectionResult = await queueAudioInjection(db, telnyxKey, {
            callId,
            segmentIndex,
            audioUrl: ttsResult.audioUrl,
            durationMs: ttsResult.durationMs,
            targetCallControlId,
            organizationId,
          })

          if (injectionResult.success) {
            logger.info('Voice-to-voice translation completed', {
              callId,
              segmentIndex,
              injectionId: injectionResult.injectionId,
            })
          } else {
            logger.warn('Audio injection failed, text-only translation available', {
              callId,
              segmentIndex,
              error: injectionResult.error,
            })
          }
        } else {
          logger.warn('TTS synthesis failed, falling back to text-only', {
            callId,
            segmentIndex,
            error: ttsResult.error,
          })
        }
      } catch (voiceErr: any) {
        logger.error('Voice-to-voice pipeline error', {
          callId,
          segmentIndex,
          error: voiceErr?.message,
        })
        // Continue with text-only translation even if voice fails
      }
    }

    return { success: true, translatedText, segmentIndex }
  } catch (err: any) {
    logger.error('Translation processor error', {
      callId,
      segmentIndex,
      error: err?.message,
    })

    // Best-effort: store original text so stream doesn't go silent
    try {
      await insertTranslation(db, {
        callId,
        organizationId,
        originalText,
        translatedText: `[Translation error] ${originalText}`,
        sourceLanguage,
        targetLanguage,
        segmentIndex,
        confidence: 0,
      })
    } catch {
      // Double failure — log and move on
    }

    return { success: false, error: err?.message, segmentIndex }
  }
}

/**
 * Insert a translation segment into the `call_translations` table.
 * Uses the existing table schema — no new tables or columns needed.
 */
async function insertTranslation(
  db: DbClient,
  data: {
    callId: string
    organizationId: string
    originalText: string
    translatedText: string
    sourceLanguage: string
    targetLanguage: string
    segmentIndex: number
    confidence: number
  }
): Promise<void> {
  await db.query(
    `INSERT INTO call_translations (
      call_id, organization_id, original_text, translated_text,
      source_language, target_language, segment_index, confidence, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT DO NOTHING`,
    [
      data.callId,
      data.organizationId,
      data.originalText,
      data.translatedText,
      data.sourceLanguage,
      data.targetLanguage,
      data.segmentIndex,
      data.confidence,
    ]
  )
}

/**
 * Look up the voice config for a call's organization to get translation settings.
 * Returns null if translation is not enabled.
 */
export async function getTranslationConfig(
  db: DbClient,
  organizationId: string
): Promise<{ translate_from: string; translate_to: string; live_translate: boolean } | null> {
  const result = await db.query(
    `SELECT translate, translate_from, translate_to, live_translate
     FROM voice_configs
     WHERE organization_id = $1
     LIMIT 1`,
    [organizationId]
  )

  const config = result.rows[0]
  if (!config || !config.translate || !config.translate_from || !config.translate_to) {
    return null
  }

  return {
    translate_from: config.translate_from,
    translate_to: config.translate_to,
    live_translate: config.live_translate ?? false,
  }
}
