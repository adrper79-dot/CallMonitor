/**
 * ElevenLabs Text-to-Speech Service
 * Provides high-quality voice synthesis for translated text with voice cloning support
 */

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { logger } from '@/lib/logger'

export function getElevenLabsClient() {
  const apiKey = process.env.ELEVENLABS_API_KEY
  
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is not set')
  }
  
  return new ElevenLabsClient({ apiKey })
}

export async function generateSpeech(
  text: string,
  targetLanguage: string = 'en',
  customVoiceId?: string
): Promise<ReadableStream<Uint8Array>> {
  const client = getElevenLabsClient()
  
  const voiceId = customVoiceId || (targetLanguage === 'en' 
    ? 'EXAVITQu4vr4xnSDxMaL'
    : 'pNInz6obpgDQGcFmaJgB')
  
  try {
    const audio = await client.textToSpeech.convert(voiceId, {
      text,
      modelId: 'eleven_multilingual_v2',
      voiceSettings: {
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0.0,
        useSpeakerBoost: true
      }
    })
    
    return audio as ReadableStream<Uint8Array>
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

    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: formData,
    })

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
    const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      method: 'DELETE',
      headers: { 'xi-api-key': apiKey },
    })

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
  const client = getElevenLabsClient()
  
  try {
    const voices = await client.voices.getAll()
    return voices
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
