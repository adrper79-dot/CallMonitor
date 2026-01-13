/**
 * Survey SWML Builder
 * 
 * Generates SWML JSON for AI Survey Bot using SignalWire AI Agents.
 * Supports dynamic survey prompts, configurable voice, and post-call results webhook.
 * 
 * Per MASTER_ARCHITECTURE.txt: Survey is a call modulation.
 */

export interface SurveyConfig {
  callId: string
  organizationId: string
  prompts: string[]
  voice?: string
  postPromptWebhook: string
  recordCall?: boolean
}

export interface SurveySWMLConfig {
  version: string
  sections: {
    main: Array<{
      answer?: {}
      ai?: {
        prompt: { text: string }
        voice?: string
        model?: string
        temperature?: number
        max_tokens?: number
        post_prompt_url?: string
        params?: Record<string, any>
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
 * Build the AI prompt for the survey bot
 */
function buildSurveyPrompt(prompts: string[]): string {
  if (prompts.length === 0) {
    return `You are a friendly survey assistant. Ask the caller:
1. How was your overall experience today?
2. On a scale of 1-5, how likely are you to recommend us?
3. Is there anything we could improve?

Wait for each response before asking the next question.
After all questions, thank them and provide a brief summary of their feedback.
Keep responses natural and conversational.`
  }

  const numberedPrompts = prompts.map((q, i) => `${i + 1}. ${q}`).join('\n')
  
  return `You are a professional survey assistant conducting a customer feedback survey.

Ask these questions ONE AT A TIME, waiting for the caller's response before proceeding:

${numberedPrompts}

Guidelines:
- Be friendly and conversational
- Wait for each response before asking the next question
- If the caller seems confused, clarify the question
- After all questions, thank them and summarize their responses briefly
- Keep responses natural - don't sound robotic

Begin by greeting the caller and explaining you have ${prompts.length} quick question${prompts.length > 1 ? 's' : ''} for them.`
}

/**
 * Map language/locale to SignalWire voice ID
 */
function getSignalWireVoice(voiceId?: string): string {
  const voiceMap: Record<string, string> = {
    'en': 'rime.spore',
    'en-US': 'rime.spore',
    'es': 'rime.alberto',
    'es-US': 'rime.alberto',
    'fr': 'rime.viola',
    'de': 'rime.stella',
    'it': 'rime.paola',
    'pt': 'rime.luana',
    'ja': 'rime.akari',
    'zh': 'rime.ling',
    'ko': 'rime.yeonjun'
  }
  
  // If voiceId is already a rime voice or custom voice, use it directly
  if (voiceId?.startsWith('rime.') || voiceId?.includes('.')) {
    return voiceId
  }
  
  return voiceMap[voiceId || 'en'] || 'rime.spore'
}

/**
 * Build SWML JSON for AI Survey Bot
 * 
 * Generates SignalWire Markup Language configuration for:
 * - Answering inbound calls
 * - Running AI-powered survey with custom prompts
 * - Optionally recording the call
 * - Sending results to webhook after survey completes
 */
export function buildSurveySWML(config: SurveyConfig): SurveySWMLConfig {
  const {
    callId,
    organizationId,
    prompts,
    voice,
    postPromptWebhook,
    recordCall = true
  } = config

  const mainSection: Array<any> = []

  // Answer the inbound call
  mainSection.push({ answer: {} })

  // Add optional recording
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

  // AI Survey Bot configuration
  mainSection.push({
    ai: {
      prompt: { text: buildSurveyPrompt(prompts) },
      voice: getSignalWireVoice(voice),
      model: 'gpt-4o-mini',
      temperature: 0.4, // Slightly higher for more natural conversation
      max_tokens: 200,
      post_prompt_url: postPromptWebhook,
      params: {
        save_conversation: true,
        callmonitor_call_id: callId,
        callmonitor_org_id: organizationId,
        callmonitor_type: 'ai_survey'
      }
    }
  })

  // Hangup after survey completes
  mainSection.push({ hangup: {} })

  return {
    version: '1.0.0',
    sections: {
      main: mainSection
    }
  }
}

/**
 * Build a minimal fallback SWML for error cases
 */
export function buildFallbackSWML(message?: string): SurveySWMLConfig {
  const mainSection: Array<any> = [{ answer: {} }]
  
  if (message) {
    mainSection.push({
      ai: {
        prompt: { text: `Say: "${message}" then hang up.` },
        voice: 'rime.spore',
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 50
      }
    })
  }
  
  mainSection.push({ hangup: {} })
  
  return {
    version: '1.0.0',
    sections: { main: mainSection }
  }
}
