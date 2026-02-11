/**
 * Grok Voice API Client - Real-time voice synthesis by xAI
 *
 * Grok Voice provides low-latency text-to-speech at $0.05/minute.
 * Compatible with OpenAI Realtime API specification.
 *
 * Features:
 * - Multiple expressive voices (Ara, Eve, Leo)
 * - Multilingual support
 * - <1 second time-to-first-audio
 * - 5x faster than competitors
 *
 * Pricing: $0.05 per minute of connection time
 *
 * @module workers/src/lib/grok-voice-client
 */

import type { Env } from '../index'
import { logger } from './logger'

export type GrokVoice = 'ara' | 'eve' | 'leo'

export interface GrokTTSOptions {
  voice?: GrokVoice
  model?: 'grok-voice-1' | 'grok-voice-1-hd'
  response_format?: 'mp3' | 'wav' | 'pcm16'
  speed?: number // 0.25 to 4.0
}

export interface GrokTTSResponse {
  audio: ArrayBuffer
  duration_seconds: number
  cost_usd: number
}

/**
 * Grok Voice API Client
 *
 * Note: Grok Voice API is primarily WebSocket-based for real-time
 * conversations. This client provides HTTP-based TTS for batch
 * audio generation (compatible with OpenAI TTS endpoint format).
 */
export class GrokVoiceClient {
  private apiKey: string
  private baseURL = 'https://api.x.ai/v1'

  constructor(apiKey: string) {
    if (!apiKey || apiKey === 'placeholder-grok-key') {
      logger.warn('Grok Voice API key not configured - using placeholder')
    }
    this.apiKey = apiKey
  }

  /**
   * Generate speech from text
   *
   * Compatible with OpenAI /v1/audio/speech endpoint
   */
  async textToSpeech(
    text: string,
    options: GrokTTSOptions = {}
  ): Promise<GrokTTSResponse> {
    const {
      voice = 'ara', // Default to Ara voice
      model = 'grok-voice-1',
      response_format = 'mp3',
      speed = 1.0,
    } = options

    const startTime = Date.now()

    try {
      const response = await fetch(`${this.baseURL}/audio/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: text,
          voice,
          response_format,
          speed,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `Grok Voice API error: ${response.status} ${response.statusText} - ${errorText}`
        )
      }

      const audioBuffer = await response.arrayBuffer()
      const latency = Date.now() - startTime

      // Estimate duration (rough: ~150 words per minute at normal speed)
      const wordCount = text.split(/\s+/).length
      const estimatedDurationSeconds = (wordCount / 150) * 60 / speed

      // Calculate cost ($0.05 per minute)
      const costUsd = (estimatedDurationSeconds / 60) * 0.05

      logger.info('Grok Voice TTS successful', {
        voice,
        text_length: text.length,
        audio_bytes: audioBuffer.byteLength,
        latency_ms: latency,
        duration_seconds: estimatedDurationSeconds,
        cost_usd: costUsd,
      })

      return {
        audio: audioBuffer,
        duration_seconds: estimatedDurationSeconds,
        cost_usd: costUsd,
      }
    } catch (error: any) {
      logger.error('Grok Voice API call failed', {
        error: error?.message,
        text_length: text?.length,
        latency_ms: Date.now() - startTime,
      })
      throw error
    }
  }

  /**
   * Get available voices
   */
  getAvailableVoices(): Array<{ id: GrokVoice; name: string; description: string }> {
    return [
      {
        id: 'ara',
        name: 'Ara',
        description: 'Warm, professional female voice. Excellent for customer service.',
      },
      {
        id: 'eve',
        name: 'Eve',
        description: 'Clear, confident female voice. Great for announcements.',
      },
      {
        id: 'leo',
        name: 'Leo',
        description: 'Friendly, approachable male voice. Ideal for casual conversations.',
      },
    ]
  }
}

/**
 * Create Grok Voice client instance
 */
export function createGrokVoiceClient(env: Env): GrokVoiceClient {
  const apiKey = env.GROK_API_KEY || 'placeholder-grok-key'
  return new GrokVoiceClient(apiKey)
}

/**
 * Language to voice mapping
 *
 * Maps target language to best Grok voice for natural accent
 */
export const GROK_VOICE_LANGUAGE_MAP: Record<string, GrokVoice> = {
  // English variants
  en: 'ara',
  'en-US': 'ara',
  'en-GB': 'eve',
  'en-AU': 'eve',

  // Romance languages
  es: 'ara', // Spanish
  fr: 'eve', // French
  it: 'ara', // Italian
  pt: 'ara', // Portuguese

  // Germanic languages
  de: 'leo', // German
  nl: 'leo', // Dutch

  // Asian languages
  zh: 'eve', // Chinese
  ja: 'ara', // Japanese
  ko: 'ara', // Korean

  // Other
  ar: 'leo', // Arabic
  hi: 'ara', // Hindi
  ru: 'leo', // Russian

  // Default fallback
  default: 'ara',
}

/**
 * Helper: Get best voice for target language
 */
export function getVoiceForLanguage(language: string): GrokVoice {
  return GROK_VOICE_LANGUAGE_MAP[language] || GROK_VOICE_LANGUAGE_MAP.default
}

/**
 * Helper: Synthesize translated speech
 *
 * Convenience function for voice-to-voice translation pipeline
 */
export async function synthesizeTranslatedSpeech(
  translatedText: string,
  targetLanguage: string,
  env: Env
): Promise<{ audioUrl: string; durationSeconds: number; costUsd: number }> {
  const client = createGrokVoiceClient(env)
  const voice = getVoiceForLanguage(targetLanguage)

  const result = await client.textToSpeech(translatedText, {
    voice,
    model: 'grok-voice-1',
    response_format: 'mp3',
    speed: 1.0,
  })

  // Upload to R2 storage
  const timestamp = Date.now()
  const filename = `tts/${timestamp}-${voice}-${targetLanguage}.mp3`

  try {
    await env.AUDIO_BUCKET.put(filename, result.audio, {
      httpMetadata: {
        contentType: 'audio/mpeg',
      },
      customMetadata: {
        voice,
        language: targetLanguage,
        duration: result.duration_seconds.toString(),
        provider: 'grok-voice',
      },
    })

    // Generate public URL (assuming R2 bucket has public access configured)
    const audioUrl = `${env.PUBLIC_BUCKET_URL}/${filename}`

    logger.info('TTS audio uploaded to R2', {
      filename,
      url: audioUrl,
      duration_seconds: result.duration_seconds,
    })

    return {
      audioUrl,
      durationSeconds: result.duration_seconds,
      costUsd: result.cost_usd,
    }
  } catch (error: any) {
    logger.error('Failed to upload TTS audio to R2', {
      error: error?.message,
      filename,
    })
    throw error
  }
}

/**
 * Calculate Grok Voice cost
 *
 * Pricing: $0.05 per minute
 */
export function calculateGrokVoiceCost(durationSeconds: number): number {
  return (durationSeconds / 60) * 0.05
}
