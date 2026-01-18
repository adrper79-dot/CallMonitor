/**
 * Secret Shopper SWML Builder
 * 
 * Generates SWML JSON for synthetic caller (secret shopper) evaluation calls.
 * Uses SignalWire AI Agent to follow a script, role-play as a customer,
 * and evaluate the target's responses.
 * 
 * Per MASTER_ARCHITECTURE.txt: Secret shopper is a call modulation.
 * Per SECRET_SHOPPER_INFRASTRUCTURE.md: AI-driven QA evaluations.
 * 
 * AI Role Compliance (WORD_IS_BOND_AI_ROLE_IMPLEMENTATION_PLAN.md):
 * - Secret Shopper is repositioned as "AI Quality Evaluation"
 * - Used for INTERNAL QA purposes only, NOT customer-facing agreements
 * - Calls include disclosure that this is an AI-assisted evaluation
 * - AI acts as evaluator/observer, NOT as a negotiating party
 * 
 * IMPORTANT: This feature should NOT be used for contexts involving:
 * - Contract negotiations
 * - Agreement capture
 * - Customer commitments
 */

// QA Evaluation disclosure for AI Role compliance
// Note: This disclosure is for QA purposes - the AI is evaluating service quality
const QA_EVALUATION_DISCLOSURE = `This is an automated quality assurance evaluation call. This call is for internal evaluation purposes only and does not constitute any service agreement or commitment.`

export interface ShopperConfig {
  callId: string
  organizationId: string
  scriptId?: string
  script: string
  persona?: string
  voice?: string
  expectedOutcomes?: Array<{
    type: string
    value: any
    weight?: number
  }>
  targetName?: string
  recordCall?: boolean
}

export interface ShopperSWMLConfig {
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
 * Map language/locale to SignalWire voice ID
 */
function getSignalWireVoice(voiceId?: string): string {
  const voiceMap: Record<string, string> = {
    'en': 'rime.spore',
    'en-US': 'rime.spore',
    'en-female': 'rime.kira',
    'en-male': 'rime.spore',
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
 * Build the AI prompt for the secret shopper agent
 * 
 * The agent role-plays as a customer following a script while evaluating
 * the target's responses naturally.
 */
function buildShopperPrompt(script: string, persona?: string, targetName?: string): string {
  const personaDescription = persona || 'a typical customer who is polite but has specific needs'
  const target = targetName || 'the representative'
  
  return `You are an AI conducting a quality assurance evaluation call. You are role-playing as ${personaDescription}.

YOUR SCRIPT AND OBJECTIVES:
${script}

IMPORTANT GUIDELINES:
1. Stay in character throughout the call - you ARE the customer
2. Follow the script naturally, adapting to responses while hitting key points
3. Don't reveal you're an AI or conducting an evaluation
4. React naturally to what ${target} says - if they answer a question, acknowledge it
5. If they deviate from expected service, note it mentally but stay polite
6. Ask clarifying questions if responses are unclear
7. Complete all script objectives before ending the call
8. Thank them politely at the end

CONVERSATION STYLE:
- Be conversational, not robotic
- Use natural pauses and filler words occasionally
- Show appropriate emotions (frustration if service is poor, satisfaction if good)
- Match the energy and pace of ${target}

After the call, your responses and the conversation will be analyzed for:
- Whether your script objectives were met
- The quality of service provided
- Response times and professionalism
- Sentiment and tone

Begin the call now. Follow your script and objectives.`
}

/**
 * Build SWML JSON for Secret Shopper AI Agent
 * 
 * Generates SignalWire Markup Language configuration for:
 * - Making outbound synthetic caller evaluations
 * - Recording the call for analysis
 * - Role-playing as a customer following a script
 * - Sending results to webhook after call completes
 */
export function buildShopperSWML(config: ShopperConfig): ShopperSWMLConfig {
  const {
    callId,
    organizationId,
    scriptId,
    script,
    persona,
    voice,
    expectedOutcomes,
    targetName,
    recordCall = true
  } = config

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.callmonitor.com'
  const mainSection: Array<any> = []

  // Answer the call (for inbound) or connect (outbound uses REST API)
  mainSection.push({ answer: {} })

  // Add recording
  if (recordCall) {
    mainSection.push({
      record_call: {
        format: 'mp3',
        stereo: true, // Stereo for speaker separation
        recording_status_callback: `${appUrl}/api/webhooks/signalwire`
      }
    })
  }

  // AI Secret Shopper Agent configuration
  mainSection.push({
    ai: {
      prompt: { text: buildShopperPrompt(script, persona, targetName) },
      voice: getSignalWireVoice(voice),
      model: 'gpt-4o-mini',
      temperature: 0.6, // Higher for more natural role-playing
      max_tokens: 250, // Longer responses for natural conversation
      post_prompt_url: `${appUrl}/api/shopper/results?callId=${callId}&scriptId=${scriptId || ''}&orgId=${organizationId}`,
      params: {
        save_conversation: true,
        callmonitor_call_id: callId,
        callmonitor_org_id: organizationId,
        callmonitor_type: 'secret_shopper',
        callmonitor_script_id: scriptId,
        expected_outcomes: expectedOutcomes || []
      }
    }
  })

  // Hangup after evaluation completes
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
export function buildShopperFallbackSWML(message?: string): ShopperSWMLConfig {
  const mainSection: Array<any> = [{ answer: {} }]
  
  if (message) {
    mainSection.push({
      ai: {
        prompt: { text: `Say: "${message}" then hang up politely.` },
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

/**
 * Validate a shopper script for required elements
 */
export function validateShopperScript(script: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!script || script.trim().length < 20) {
    errors.push('Script must be at least 20 characters')
  }
  
  // Check for basic structure
  const hasObjective = script.toLowerCase().includes('objective') || 
                       script.toLowerCase().includes('goal') ||
                       script.toLowerCase().includes('ask') ||
                       script.toLowerCase().includes('request')
  
  if (!hasObjective) {
    errors.push('Script should include clear objectives (e.g., "Ask about...", "Request...")')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}
