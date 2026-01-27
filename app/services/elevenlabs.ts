/**
 * ElevenLabs Text-to-Speech Service
 * Provides high-quality voice synthesis for translated text with voice cloning support
 */

import { logger } from '@/lib/logger'
import { fetchElevenLabsWithRetry } from '@/lib/utils/fetchWithRetry'
import { elevenLabsBreaker } from '@/lib/utils/circuitBreaker'

export function ensureElevenLabsApiKey() {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY environment variable is not set')
  return apiKey
}

export async function generateSpeech(
  text: string,
  targetLanguage: string = 'en',
  customVoiceId?: string
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = ensureElevenLabsApiKey()

  const voiceId = customVoiceId || (targetLanguage === 'en'
    ? 'EXAVITQu4vr4xnSDxMaL'
    : 'pNInz6obpgDQGcFmaJgB')

  try {
    // ElevenLabs TTS REST endpoint - stream audio back
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`
    const body = {
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const textErr = await res.text()
      logger.error('ElevenLabs TTS fetch error', undefined, { status: res.status, body: textErr })
      throw new Error(`ElevenLabs TTS failed: ${res.status} - ${textErr}`)
    }

    // Return the response body stream (ReadableStream)
    if (res.body) return res.body as unknown as ReadableStream<Uint8Array>

    // Fallback: convert to stream from arrayBuffer
    const buffer = Buffer.from(await res.arrayBuffer())
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(buffer))
        controller.close()
      }
    })
    return stream
  } catch (error: any) {
    logger.error('ElevenLabs TTS error', error)
    throw new Error(`ElevenLabs TTS failed: ${error?.message || 'Unknown error'}`)
  }
}

export async function cloneVoice(
  audioBuffer: Buffer,
  name: string,
  description?: string
): Promise<{ voiceId: string; name: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is not set')
  }

  try {
    const formData = new FormData()
    formData.append('name', name)
    if (description) {
      formData.append('description', description)
    }
    
    const arrayBuffer = audioBuffer.buffer.slice(
      audioBuffer.byteOffset,
      audioBuffer.byteOffset + audioBuffer.byteLength
    ) as ArrayBuffer
    const audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' })
    formData.append('files', audioBlob, 'voice_sample.mp3')
    formData.append('labels', JSON.stringify({ source: 'callmonitor', type: 'instant_clone' }))

    let response
    try {
      response = await elevenLabsBreaker.execute(async () => {
        return await fetchElevenLabsWithRetry('https://api.elevenlabs.io/v1/voices/add', {
          method: 'POST',
          headers: { 'xi-api-key': apiKey },
          body: formData,
        })
      })
    } catch (fetchErr: any) {
      logger.error('ElevenLabs voice clone fetch error', fetchErr)
      throw new Error(`Voice cloning failed: ${fetchErr?.message || 'Network error'}`)
    }

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('ElevenLabs voice clone error', undefined, { error: errorText })
      throw new Error(`Voice cloning failed: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    logger.info('ElevenLabs voice cloned successfully', { voiceId: result.voice_id, name })
    
    return { voiceId: result.voice_id, name: result.name || name }
  } catch (error: any) {
    logger.error('ElevenLabs voice cloning error', error)
    throw new Error(`Voice cloning failed: ${error?.message || 'Unknown error'}`)
  }
}

export async function deleteClonedVoice(voiceId: string): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is not set')
  }

  try {
    let response
    try {
      response = await elevenLabsBreaker.execute(async () => {
        return await fetchElevenLabsWithRetry(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
          method: 'DELETE',
          headers: { 'xi-api-key': apiKey },
        })
      })
    } catch (fetchErr: any) {
      logger.warn('ElevenLabs voice delete fetch error', { error: fetchErr?.message })
      return
    }

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text()
      logger.warn('ElevenLabs voice delete error', { error: errorText })
    }
    
    logger.debug('ElevenLabs voice deleted', { voiceId })
  } catch (error: any) {
    logger.warn('ElevenLabs voice deletion error', { error: error?.message })
  }
}

export async function getAvailableVoices() {
  const apiKey = ensureElevenLabsApiKey()
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: { 'xi-api-key': apiKey }
    })
    if (!res.ok) {
      const body = await res.text()
      logger.error('ElevenLabs voices fetch error', undefined, { status: res.status, body })
      throw new Error(`Failed to fetch voices: ${res.status}`)
    }
    const data = await res.json()
    return data
  } catch (error: any) {
    logger.error('ElevenLabs get voices error', error)
    throw new Error(`Failed to get ElevenLabs voices: ${error?.message || 'Unknown error'}`)
  }
}

export const LANGUAGE_VOICE_MAP: Record<string, string> = {
  'en': 'EXAVITQu4vr4xnSDxMaL',
  'es': 'pNInz6obpgDQGcFmaJgB',
  'fr': 'pNInz6obpgDQGcFmaJgB',
  'de': 'pNInz6obpgDQGcFmaJgB',
  'it': 'pNInz6obpgDQGcFmaJgB',
  'pt': 'pNInz6obpgDQGcFmaJgB',
  'pl': 'pNInz6obpgDQGcFmaJgB',
  'tr': 'pNInz6obpgDQGcFmaJgB',
  'ru': 'pNInz6obpgDQGcFmaJgB',
  'nl': 'pNInz6obpgDQGcFmaJgB',
  'cs': 'pNInz6obpgDQGcFmaJgB',
  'ar': 'pNInz6obpgDQGcFmaJgB',
  'zh': 'pNInz6obpgDQGcFmaJgB',
  'ja': 'pNInz6obpgDQGcFmaJgB',
  'hi': 'pNInz6obpgDQGcFmaJgB',
  'ko': 'pNInz6obpgDQGcFmaJgB',
}

export function getVoiceForLanguage(languageCode: string): string {
  return LANGUAGE_VOICE_MAP[languageCode.toLowerCase()] || LANGUAGE_VOICE_MAP['en']
}
