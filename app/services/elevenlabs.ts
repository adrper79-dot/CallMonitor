/**
 * ElevenLabs Text-to-Speech Service
 * 
 * Provides high-quality voice synthesis for translated text
 */

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'

// Initialize ElevenLabs client
export function getElevenLabsClient() {
  const apiKey = process.env.ELEVENLABS_API_KEY
  
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is not set')
  }
  
  return new ElevenLabsClient({
    apiKey
  })
}

/**
 * Generate audio from text using ElevenLabs
 * 
 * @param text - Text to convert to speech
 * @param targetLanguage - Target language code (e.g., 'es', 'en', 'fr')
 * @param customVoiceId - Optional custom voice ID to use instead of default
 * @returns Audio buffer as ReadableStream
 */
export async function generateSpeech(
  text: string,
  targetLanguage: string = 'en',
  customVoiceId?: string
): Promise<ReadableStream<Uint8Array>> {
  const client = getElevenLabsClient()
  
  // Use custom voice if provided, otherwise use default mapping
  const voiceId = customVoiceId || (targetLanguage === 'en' 
    ? 'EXAVITQu4vr4xnSDxMaL' // Rachel - Natural, professional English
    : 'pNInz6obpgDQGcFmaJgB') // Adam - Multilingual support
  
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
    console.error('ElevenLabs TTS error:', error)
    throw new Error(`ElevenLabs TTS failed: ${error?.message || 'Unknown error'}`)
  }
}

/**
 * Get available voices from ElevenLabs
 */
export async function getAvailableVoices() {
  const client = getElevenLabsClient()
  
  try {
    const voices = await client.voices.getAll()
    return voices
  } catch (error: any) {
    console.error('ElevenLabs get voices error:', error)
    throw new Error(`Failed to get ElevenLabs voices: ${error?.message || 'Unknown error'}`)
  }
}

/**
 * Language code to voice ID mapping
 * Maps common language codes to best ElevenLabs voice
 */
export const LANGUAGE_VOICE_MAP: Record<string, string> = {
  'en': 'EXAVITQu4vr4xnSDxMaL', // Rachel - English
  'es': 'pNInz6obpgDQGcFmaJgB', // Adam - Spanish/Multilingual
  'fr': 'pNInz6obpgDQGcFmaJgB', // Adam - French/Multilingual
  'de': 'pNInz6obpgDQGcFmaJgB', // Adam - German/Multilingual
  'it': 'pNInz6obpgDQGcFmaJgB', // Adam - Italian/Multilingual
  'pt': 'pNInz6obpgDQGcFmaJgB', // Adam - Portuguese/Multilingual
  'pl': 'pNInz6obpgDQGcFmaJgB', // Adam - Polish/Multilingual
  'tr': 'pNInz6obpgDQGcFmaJgB', // Adam - Turkish/Multilingual
  'ru': 'pNInz6obpgDQGcFmaJgB', // Adam - Russian/Multilingual
  'nl': 'pNInz6obpgDQGcFmaJgB', // Adam - Dutch/Multilingual
  'cs': 'pNInz6obpgDQGcFmaJgB', // Adam - Czech/Multilingual
  'ar': 'pNInz6obpgDQGcFmaJgB', // Adam - Arabic/Multilingual
  'zh': 'pNInz6obpgDQGcFmaJgB', // Adam - Chinese/Multilingual
  'ja': 'pNInz6obpgDQGcFmaJgB', // Adam - Japanese/Multilingual
  'hi': 'pNInz6obpgDQGcFmaJgB', // Adam - Hindi/Multilingual
  'ko': 'pNInz6obpgDQGcFmaJgB', // Adam - Korean/Multilingual
}

/**
 * Get voice ID for language
 */
export function getVoiceForLanguage(languageCode: string): string {
  return LANGUAGE_VOICE_MAP[languageCode.toLowerCase()] || LANGUAGE_VOICE_MAP['en']
}
