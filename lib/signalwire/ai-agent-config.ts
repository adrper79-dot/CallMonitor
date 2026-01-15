/**
 * SignalWire AI Agent Configuration Builder
 * 
 * Builds SWML (SignalWire Markup Language) configuration for AI Agents
 * to enable live translation during calls.
 * 
 * Architecture Note:
 * - AI Agent provides LIVE translation (1-3 second latency)
 * - AssemblyAI still provides CANONICAL transcript post-call
 * - AI Agent output is ephemeral and non-authoritative
 */

export interface AIAgentTranslationConfig {
  callId: string
  organizationId: string
  translateFrom: string  // e.g., 'en', 'es', 'fr', 'de'
  translateTo: string    // e.g., 'en', 'es', 'fr', 'de'
  postPromptUrl?: string // Webhook URL for completion
}

export interface SWMLConfig {
  version: string
  sections: {
    main: Array<{
      answer?: Record<string, unknown>
      ai?: {
        prompt: {
          text: string
          temperature?: number
          top_p?: number
        }
        post_prompt_url?: string
        post_prompt?: {
          url: string
        }
        params?: {
          language?: string
          [key: string]: any
        }
      }
      play?: {
        url: string
      }
    }>
  }
}

/**
 * Build SWML configuration for live translation AI Agent
 */
export function buildLiveTranslationSWML(config: AIAgentTranslationConfig): SWMLConfig {
  const {
    callId,
    organizationId,
    translateFrom,
    translateTo,
    postPromptUrl
  } = config

  // Language name mapping for better prompts
  const languageNames: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    ar: 'Arabic',
    ru: 'Russian',
    hi: 'Hindi',
  }

  const fromLang = languageNames[translateFrom] || translateFrom
  const toLang = languageNames[translateTo] || translateTo

  // Build AI Agent prompt for translation
  const prompt = `You are a professional real-time translator for phone calls. Your ONLY job is to listen to speech, translate it accurately, and speak the translation naturally.

SOURCE LANGUAGE: ${fromLang}
TARGET LANGUAGE: ${toLang}

RULES:
1. Translate speech from ${fromLang} to ${toLang} in real-time
2. Maintain tone, intent, and nuance of the original speaker
3. Speak clearly at natural conversational speed
4. Do NOT add commentary, explanations, or opinions
5. Do NOT summarize or paraphrase - translate directly
6. If you detect language switching, adapt automatically
7. If something is unclear, translate what you heard without guessing

RESPONSE FORMAT:
- Speak only the translation, nothing else
- Use natural speech patterns for ${toLang}
- Preserve emphasis and emotion from original

Begin translating now.`

  // Build SWML configuration
  const swml: SWMLConfig = {
    version: '1.0.0',
    sections: {
      main: [
        // Answer the call
        {
          answer: {}
        },
        // Attach AI Agent for translation
        {
          ai: {
            prompt: {
              text: prompt,
              temperature: 0.3,  // Low temperature for accurate translation
              top_p: 0.8
            },
            params: {
              language: translateFrom,  // Source language for STT
              // Additional params for SignalWire AI Agent
              call_id: callId,
              organization_id: organizationId,
              feature: 'live_translation',
              translation_pair: `${translateFrom}-${translateTo}`
            }
          }
        }
      ]
    }
  }

  // Add post-prompt webhook if provided
  if (postPromptUrl) {
    const aiSection = swml.sections.main[1]
    if (aiSection.ai) {
      aiSection.ai.post_prompt = {
        url: postPromptUrl
      }
    }
  }

  return swml
}

/**
 * Build LaML (Legacy XML format) instruction to redirect to SWML endpoint
 * 
 * Used when initiating call via LaML API but want to use SWML for AI Agent.
 * LaML will redirect to SWML endpoint which returns the AI Agent config.
 */
export function buildLaMLRedirectToSWML(swmlEndpointUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect>${swmlEndpointUrl}</Redirect>
</Response>`
}

/**
 * Get voice configuration for TTS based on target language
 * 
 * SignalWire AI Agents support multiple voices per language.
 * These are high-quality neural voices.
 */
export function getVoiceForLanguage(languageCode: string): string {
  const voices: Record<string, string> = {
    'en': 'en-US-Neural2-J',        // Natural English (US)
    'en-US': 'en-US-Neural2-J',
    'en-GB': 'en-GB-Neural2-B',
    'es': 'es-ES-Neural2-A',        // Spanish (Spain)
    'es-ES': 'es-ES-Neural2-A',
    'es-MX': 'es-US-Neural2-A',     // Spanish (Mexico)
    'fr': 'fr-FR-Neural2-A',        // French
    'de': 'de-DE-Neural2-B',        // German
    'it': 'it-IT-Neural2-A',        // Italian
    'pt': 'pt-BR-Neural2-A',        // Portuguese (Brazil)
    'zh': 'cmn-CN-Wavenet-A',       // Chinese (Mandarin)
    'ja': 'ja-JP-Neural2-B',        // Japanese
    'ko': 'ko-KR-Neural2-A',        // Korean
  }

  return voices[languageCode] || voices['en']
}

/**
 * Validate language code is supported
 */
export function isSupportedLanguage(code: string): boolean {
  const supported = [
    'en', 'en-US', 'en-GB',
    'es', 'es-ES', 'es-MX',
    'fr', 'de', 'it', 'pt',
    'zh', 'ja', 'ko', 'ar', 'ru', 'hi'
  ]
  return supported.includes(code)
}

/**
 * Get estimated latency for language pair
 * 
 * Some language pairs have lower latency due to model optimizations.
 * This is for UI display only.
 */
export function getEstimatedLatency(from: string, to: string): string {
  // English <-> European languages: lowest latency
  if ((from === 'en' || to === 'en') && ['es', 'fr', 'de', 'it', 'pt'].includes(from === 'en' ? to : from)) {
    return '1-2 seconds'
  }
  
  // Asian languages: slightly higher latency
  if (['zh', 'ja', 'ko'].includes(from) || ['zh', 'ja', 'ko'].includes(to)) {
    return '2-3 seconds'
  }
  
  // Default
  return '1-3 seconds'
}
