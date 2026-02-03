/**
 * SignalWire Markup Language (SWML) Builder
 * 
 * Builds SWML JSON for AI Agent integration.
 * Per SIGNALWIRE_AI_AGENTS_RESEARCH.md Option 1 (Hybrid Approach)
 */

import { buildAgentConfig, AgentConfigInput } from './agentConfig'

export interface SWMLConfig {
  version: string
  sections: {
    main: Array<{
      answer?: {}
      ai?: {
        prompt: {
          text: string
        }
        languages?: Array<{
          name: string
          code: string
          voice: string
        }>
        model?: string
        temperature?: number
        max_tokens?: number
      }
      record_call?: {
        format?: string
        stereo?: boolean
        recording_status_callback?: string
      }
      hangup?: {}
    }>
  }
}

/**
 * Map language code to language name
 */
function getLanguageName(code: string): string {
  const langMap: Record<string, string> = {
    'en': 'English',
    'en-US': 'English (US)',
    'es': 'Spanish',
    'es-US': 'Spanish (US)',
    'es-ES': 'Spanish (Spain)',
    'fr': 'French',
    'fr-FR': 'French',
    'de': 'German',
    'de-DE': 'German',
    'it': 'Italian',
    'it-IT': 'Italian',
    'pt': 'Portuguese',
    'pt-BR': 'Portuguese (Brazil)',
    'pt-PT': 'Portuguese (Portugal)',
    'ja': 'Japanese',
    'ja-JP': 'Japanese',
    'zh': 'Chinese',
    'zh-CN': 'Chinese (Simplified)',
    'ko': 'Korean',
    'ko-KR': 'Korean'
  }
  return langMap[code.toLowerCase()] || 'English'
}

/**
 * Map language code to SignalWire voice ID
 * Note: SignalWire uses different voice IDs than the agent config
 * Common format: rime.{voice_id} or provider-specific format
 * Default to common voice IDs for now - may need adjustment based on SignalWire documentation
 */
function getSignalWireVoiceId(langCode: string): string {
  const voiceMap: Record<string, string> = {
    'en': 'rime.spore',
    'en-US': 'rime.spore',
    'es': 'rime.alberto',
    'es-US': 'rime.alberto',
    'es-ES': 'rime.alberto',
    'fr': 'rime.viola',
    'fr-FR': 'rime.viola',
    'de': 'rime.stella',
    'de-DE': 'rime.stella',
    'it': 'rime.paola',
    'it-IT': 'rime.paola',
    'pt': 'rime.luana',
    'pt-BR': 'rime.luana',
    'pt-PT': 'rime.luana',
    'ja': 'rime.akari',
    'ja-JP': 'rime.akari',
    'zh': 'rime.ling',
    'zh-CN': 'rime.ling',
    'ko': 'rime.yeonjun',
    'ko-KR': 'rime.yeonjun'
  }
  return voiceMap[langCode.toLowerCase()] || 'rime.spore'
}

/**
 * Build SWML JSON for live translation with AI Agent
 * 
 * Per ARCH_DOCS SIGNALWIRE_AI_AGENTS_RESEARCH.md: When SignalWire calls our endpoint
 * (after call is initiated via REST API), we return SWML with `answer` verb.
 * 
 * For outbound calls initiated via REST API:
 * - SignalWire POSTs to REST API with From, To, Url
 * - SignalWire initiates call to To number
 * - SignalWire calls our Url endpoint (this SWML endpoint) after call is answered
 * - We return SWML with `answer` verb and AI agent configuration
 */
export function buildSWML(
  input: AgentConfigInput,
  recordCall: boolean = true
): SWMLConfig {
  const agentConfig = buildAgentConfig(input)
  
  const mainSection: Array<any> = []

  // Per ARCH_DOCS: Use `answer` verb when SignalWire calls our endpoint
  // The call is already initiated via REST API, so we use `answer` to handle it
  mainSection.push({ answer: {} })

  // Build AI agent configuration
  const aiConfig: any = {
    prompt: {
      text: agentConfig.agent.prompt.system
    },
    languages: [
      {
        name: getLanguageName(agentConfig.agent.languages.primary),
        code: agentConfig.agent.languages.primary,
        voice: getSignalWireVoiceId(agentConfig.agent.languages.primary)
      }
    ],
    model: agentConfig.agent.model,
    temperature: agentConfig.agent.temperature,
    max_tokens: agentConfig.agent.max_tokens
  }

  // Add secondary language if different from primary
  if (agentConfig.agent.languages.secondary !== agentConfig.agent.languages.primary) {
    aiConfig.languages.push({
      name: getLanguageName(agentConfig.agent.languages.secondary),
      code: agentConfig.agent.languages.secondary,
      voice: getSignalWireVoiceId(agentConfig.agent.languages.secondary)
    })
  }

  mainSection.push({ ai: aiConfig })

  // Add recording if enabled
  // Per SignalWire SWML documentation (January 2026):
  // - Use `record_call` verb (not `record`) for SWML
  // - `recording_status_callback` parameter receives webhook notifications when recording completes
  // - Format: mp3 (default for voice), stereo: false (mono for phone calls)
  // - Webhook will contain RecordingSid, RecordingUrl, RecordingDuration
  // - This is separate from LaML `<Dial record="record-from-answer">` syntax
  if (recordCall) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.callmonitor.com'
    mainSection.push({
      record_call: {
        format: 'mp3',
        stereo: false,
        recording_status_callback: `${appUrl}/api/webhooks/signalwire`
      }
    })
  }

  return {
    version: '1.0.0',
    sections: {
      main: mainSection
    }
  }
}
