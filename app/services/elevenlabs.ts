/**
 * ElevenLabs Text-to-Speech Service
 * 
 * Provides high-quality voice synthesis for translated text
 * Includes voice cloning support for caller voice preservation
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
 * Clone a voice from an audio sample using ElevenLabs Instant Voice Cloning
 * 
 * @param audioBuffer - Audio buffer (minimum 30 seconds recommended)
 * @param name - Name for the cloned voice
 * @param description - Optional description
 * @returns Created voice ID
 */
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
    // ElevenLabs Instant Voice Cloning API
    // Uses multipart/form-data for audio upload
    const formData = new FormData()
    formData.append('name', name)
    if (description) {
      formData.append('description', description)
    }
    
    // Create a Blob from the buffer
    // Copy buffer content to a new ArrayBuffer to avoid TypeScript type issues
    const arrayBuffer = audioBuffer.buffer.slice(
      audioBuffer.byteOffset,
      audioBuffer.byteOffset + audioBuffer.byteLength
    ) as ArrayBuffer
    const audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' })
    formData.append('files', audioBlob, 'voice_sample.mp3')
    
    // Optional: Add labels for organization
    formData.append('labels', JSON.stringify({ source: 'callmonitor', type: 'instant_clone' }))

    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs voice clone error:', errorText)
      throw new Error(`Voice cloning failed: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log('ElevenLabs voice cloned successfully:', { voiceId: result.voice_id, name })
    
    return {
      voiceId: result.voice_id,
      name: result.name || name
    }
  } catch (error: any) {
    console.error('ElevenLabs voice cloning error:', error)
    throw new Error(`Voice cloning failed: ${error?.message || 'Unknown error'}`)
  }
}

/**
 * Delete a cloned voice from ElevenLabs
 * 
 * @param voiceId - The voice ID to delete
 */
export async function deleteClonedVoice(voiceId: string): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is not set')
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      method: 'DELETE',
      headers: {
        'xi-api-key': apiKey,
      },
    })

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text()
      console.error('ElevenLabs voice delete error:', errorText)
      // Don't throw - voice may already be deleted
    }
    
    console.log('ElevenLabs voice deleted:', { voiceId })
  } catch (error: any) {
    console.error('ElevenLabs voice deletion error:', error)
    // Don't throw - deletion is best-effort
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
