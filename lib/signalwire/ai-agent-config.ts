/**
 * SignalWire AI Agent Configuration Builder
// ARCH_DOCS COMPLIANCE: LAML redirect builder is deprecated. Use SWML endpoints directly.
// If called, throw migration error.
export function buildLaMLRedirectToSWML(swmlEndpointUrl: string): never {
  throw new Error('LAML redirect builder is deprecated. Use SWML endpoints directly. See ARCH_DOCS.')
}
 * 
 * AI Role Compliance (WORD_IS_BOND_AI_ROLE_IMPLEMENTATION_PLAN.md):
 * - Translation is a NEUTRAL SERVICE (accessibility support)
 * - AI assists communication but does NOT negotiate or make commitments
 * - Disclosure is given that translation is AI-assisted
 * - Original language preserved for canonical record
 * 
 * Required Environment Variables for Live Translation:
 * - SIGNALWIRE_AI_AGENT_ID: The AI Agent ID from SignalWire dashboard
 * - TRANSLATION_LIVE_ASSIST_PREVIEW: Must be "true" to enable feature
 */

import { logger } from '@/lib/logger'

// Translation disclosure for AI Role compliance
const TRANSLATION_DISCLOSURE = `This call includes AI-powered real-time translation. Translation is provided to assist communication and may not capture every nuance. Please confirm understanding of important terms directly with the other party.`

export interface AIAgentTranslationConfig {
  callId: string
  organizationId: string
  translateFrom: string  // e.g., 'en', 'es', 'fr', 'de'
  translateTo: string    // e.g., 'en', 'es', 'fr', 'de'
  postPromptUrl?: string // Webhook URL for completion
  agentId?: string       // SignalWire AI Agent ID (from dashboard)
}

export interface SWMLConfig {
  version: string
  sections: {
    main: Array<{
      answer?: Record<string, unknown>
      ai?: {
        agent?: string  // SignalWire AI Agent ID (required for AI features)
        prompt?: {
          text?: string
          confidence?: number
          temperature?: number
          top_p?: number
          presence_penalty?: number
          frequency_penalty?: number
        }
        post_prompt_url?: string
        post_prompt?: {
          url?: string
          top_p?: number
          temperature?: number
          presence_penalty?: number
          frequency_penalty?: number
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
 * 
 * IMPORTANT: Requires a SignalWire AI Agent to be created in the dashboard first.
 * The agent ID must be passed in config or set via SIGNALWIRE_AI_AGENT_ID env var.
 */
export function buildLiveTranslationSWML(config: AIAgentTranslationConfig): SWMLConfig {
  const {
    callId,
    organizationId,
    translateFrom,
    translateTo,
    postPromptUrl,
    agentId
  } = config

  // Get AI Agent ID from config or environment variable
  const aiAgentId = agentId || process.env.SIGNALWIRE_AI_AGENT_ID
  
  if (!aiAgentId) {
    logger.error('LIVE_TRANSLATION_FAILED: No SignalWire AI Agent ID configured', undefined, {
      callId,
      organizationId,
      translateFrom,
      translateTo,
      resolution: 'Set SIGNALWIRE_AI_AGENT_ID environment variable with agent ID from SignalWire dashboard'
    })
    // Return basic SWML without AI Agent - call will proceed but without live translation
    return {
      version: '1.0.0',
      sections: {
        main: [{ answer: {} }]
      }
    }
  }

  // Build SWML configuration with AI Agent reference
  // Format matches SignalWire's expected SWML structure
  // Includes translation disclosure for AI Role compliance
  const translationPrompt = `IMPORTANT: At the start of the call, announce: "${TRANSLATION_DISCLOSURE}"

Then proceed to translate between ${translateFrom} and ${translateTo}. You are a neutral translation service - you translate what is said but do not add opinions, negotiate, or make commitments on behalf of any party.`

  const swml: SWMLConfig = {
    version: '1.0.0',
    sections: {
      main: [
        // AI Agent block - references pre-created agent in SignalWire
        {
          ai: {
            agent: aiAgentId,  // CRITICAL: Reference to SignalWire AI Agent
            prompt: {
              text: translationPrompt,
              confidence: 0.6,
              temperature: 0.3,
              top_p: 1.0,
              presence_penalty: 0.0,
              frequency_penalty: 0.0
            },
            post_prompt: {
              top_p: 1.0,
              temperature: 0.0,
              presence_penalty: 0.0,
              frequency_penalty: 0.0
            },
            params: {
              language: translateFrom,
              call_id: callId,
              organization_id: organizationId,
              feature: 'live_translation',
              translation_pair: `${translateFrom}-${translateTo}`,
              disclosure_given: true  // Track that disclosure was provided
            }
          }
        }
      ]
    }
  }

  // Add post-prompt webhook URL if provided
  if (postPromptUrl && swml.sections.main[0].ai) {
    swml.sections.main[0].ai.post_prompt_url = postPromptUrl
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
