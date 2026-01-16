/**
 * SignalWire AI Agent Configuration Builder
 * 
 * Builds SignalWire AI Agent configuration JSON for live translation.
 * Per TRANSLATION_AGENT_IMPLEMENTATION_PLAN.md and Translation_Agent document.
 */

export interface AgentConfigInput {
  callId: string
  organizationId: string
  translationFrom: string
  translationTo: string
  detectedLanguage?: string
}

export interface SignalWireAgentConfig {
  agent: {
    name: string
    version: string
    description: string
    languages: {
      primary: string
      secondary: string
      target: string
    }
    prompt: {
      system: string
      user: string
    }
    voice: {
      primary: string
      secondary: string
    }
    model: string
    temperature: number
    max_tokens: number
    timeout: number
  }
  execution: {
    type: string
    trigger: string
    on_event: string[]
  }
  metadata: {
    callmonitor_call_id: string
    callmonitor_org_id: string
    callmonitor_provider: string
    canonical_transcript_source: string
    feature_flag: string
  }
  fallback: {
    on_failure: string
    log_to: string
    notify: string
  }
}

/**
 * Build SignalWire AI Agent configuration for live translation
 * 
 * Reference: Translation_Agent document, lines 272-326
 */
export function buildAgentConfig(input: AgentConfigInput): SignalWireAgentConfig {
  const {
    callId,
    organizationId,
    translationFrom,
    translationTo,
    detectedLanguage = translationFrom
  } = input

  // Map language codes to voice codes (SignalWire voice format)
  // Default to en-US-Neural2-J if mapping not found
  const getVoiceForLanguage = (langCode: string): string => {
    const voiceMap: Record<string, string> = {
      'en': 'en-US-Neural2-J',
      'en-US': 'en-US-Neural2-J',
      'es': 'es-US-Neural2-A',
      'es-US': 'es-US-Neural2-A',
      'es-ES': 'es-ES-Neural2-A',
      'fr': 'fr-FR-Neural2-A',
      'fr-FR': 'fr-FR-Neural2-A',
      'de': 'de-DE-Neural2-A',
      'de-DE': 'de-DE-Neural2-A',
      'it': 'it-IT-Neural2-A',
      'it-IT': 'it-IT-Neural2-A',
      'pt': 'pt-BR-Neural2-A',
      'pt-BR': 'pt-BR-Neural2-A',
      'pt-PT': 'pt-PT-Neural2-A',
      'ja': 'ja-JP-Neural2-A',
      'ja-JP': 'ja-JP-Neural2-A',
      'zh': 'zh-CN-Neural2-A',
      'zh-CN': 'zh-CN-Neural2-A',
      'ko': 'ko-KR-Neural2-A',
      'ko-KR': 'ko-KR-Neural2-A'
    }
    return voiceMap[langCode.toLowerCase()] || 'en-US-Neural2-J'
  }

  const primaryVoice = getVoiceForLanguage(translationTo)
  const secondaryVoice = getVoiceForLanguage(detectedLanguage)

  return {
    agent: {
      name: 'Word Is Bond Live Translation Agent (Preview)',
      version: '1.0.0',
      description: 'Real-time bi-directional translation executed by SignalWire AI. Canonical transcript and evidence provided by AssemblyAI.',
      languages: {
        primary: translationTo || 'en-US',
        secondary: detectedLanguage || translationFrom || 'en-US',
        target: translationTo || 'en-US'
      },
      prompt: {
        system: 'You are a live, real-time translator for phone calls. Your role is to listen to one speaker, translate their speech accurately and naturally into the target language, and speak the translation immediately. Do NOT add commentary, summaries, or opinions. Preserve tone, intent, and nuance. Speak clearly and at natural speed. If the speaker switches languages, detect and adapt seamlessly. Do NOT persist any data — this is ephemeral execution only.',
        user: `Translate from ${translationFrom || 'auto'} to ${translationTo || 'en-US'} in real time.`
      },
      voice: {
        primary: primaryVoice,
        secondary: secondaryVoice
      },
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 150,
      timeout: 30000
    },
    execution: {
      type: 'live_translation',
      trigger: 'call_answered',
      on_event: [
        'speech_detected',
        'language_changed',
        'silence_timeout'
      ]
    },
    metadata: {
      callmonitor_call_id: callId,
      callmonitor_org_id: organizationId,
      callmonitor_provider: 'signalwire',
      canonical_transcript_source: 'assemblyai',
      feature_flag: 'translation_live_assist_preview'
    },
    fallback: {
      on_failure: 'continue_without_translation',
      log_to: 'callmonitor_audit_logs',
      notify: 'callmonitor_kpi_live_translation_failure'
    }
  }
}

/**
 * Convert agent config to JSON string for API transmission
 */
export function agentConfigToJson(config: SignalWireAgentConfig): string {
  return JSON.stringify(config, null, 2)
}
