import { NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { parseRequestBody, swmlResponse } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * SWML Outbound Handler (v2) - Replaces LaML with modern SWML JSON
 * 
 * This endpoint generates SWML (SignalWire Markup Language) JSON responses
 * for outbound calls instead of XML-based LaML.
 * 
 * SWML provides:
 * - Native AI agent integration
 * - Better recording control
 * - Simpler JSON format
 * - Modern SignalWire features
 */
export async function POST(req: Request) {
  const url = new URL(req.url)
  const callId = url.searchParams.get('callId')
  const conference = url.searchParams.get('conference')
  const leg = url.searchParams.get('leg')

  if (conference && callId) {
    const swml = await generateBridgeSWML(conference, callId, leg === '1' || leg === '2' ? parseInt(leg) : undefined)
    return swmlResponse(swml)
  }

  const payload = await parseRequestBody(req)
  const from = payload.From ?? payload.from
  const to = payload.To ?? payload.to
  const callSid = payload.CallSid ?? payload.call_sid

  logger.info('SWML outbound webhook', { from: from ? '[REDACTED]' : null, to: to ? '[REDACTED]' : null, callId })

  const swml = await generateSWML(callSid, to, callId)

  logger.debug('SWML outbound: generated JSON', { sectionCount: swml.sections.main.length, callId })

  return swmlResponse(swml)
}

async function generateSWML(callSid: string | undefined, toNumber: string | undefined, callId?: string | null) {
  let voiceConfig: any = null
  let organizationId: string | null = null

  if (callId) {
    const { data: callRows } = await supabaseAdmin
      .from('calls')
      .select('organization_id')
      .eq('id', callId)
      .limit(1)

    organizationId = callRows?.[0]?.organization_id || null
    logger.debug('SWML outbound: lookup by callId', { callId, found: !!organizationId })
  }

  if (!organizationId && callSid) {
    const { data: callRows } = await supabaseAdmin
      .from('calls')
      .select('organization_id')
      .eq('call_sid', callSid)
      .limit(1)

    organizationId = callRows?.[0]?.organization_id || null
    logger.debug('SWML outbound: fallback lookup by call_sid', { found: !!organizationId })
  }

  if (organizationId) {
    const { data: vcRows } = await supabaseAdmin
      .from('voice_configs')
      .select('record, transcribe, live_translate, translate_from, translate_to, survey, synthetic_caller, survey_prompts, survey_prompts_locales, survey_webhook_email')
      .eq('organization_id', organizationId)
      .limit(1)

    voiceConfig = vcRows?.[0] || null
    logger.debug('SWML outbound: voice_configs loaded', {
      record: voiceConfig?.record,
      transcribe: voiceConfig?.transcribe,
      translate: voiceConfig?.live_translate,
      survey: voiceConfig?.survey,
      surveyPromptsCount: Array.isArray(voiceConfig?.survey_prompts) ? voiceConfig.survey_prompts.length : 0
    })
  } else {
    logger.warn('SWML outbound: could not find organization for call', { callId })
  }

  const sections: any[] = []
  const recordingCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/signalwire${callId ? `?callId=${callId}` : ''}`

  // ============================================================================
  // OUTBOUND CALL SWML STRUCTURE
  // 
  // This SWML is executed when the CALLEE answers. The flow is:
  // 1. Answer the call
  // 2. Recording disclosure (if enabled) - callee hears this
  // 3. Enable call recording
  // 4. Execute call logic (pause for conversation OR secret shopper script)
  // 5. Optionally run survey (secret shopper only)
  // 6. Hangup
  // ============================================================================

  // PHASE 1: ANSWER
  sections.push({ answer: {} })

  // PHASE 2: RECORDING DISCLOSURE (AI Role Compliance)
  if (voiceConfig?.record === true) {
    sections.push({
      play: {
        url: 'say:This call may be recorded for quality assurance and compliance purposes. By continuing, you consent to recording.'
      }
    })
    sections.push({ play: { url: 'silence:1.0' } })
  }

  // PHASE 3: ENABLE RECORDING
  if (voiceConfig?.record === true) {
    logger.info('SWML outbound: enabling recording', { callId, organizationId })
    sections.push({
      record_call: {
        format: 'wav',
        stereo: true,
        recording_status_callback: recordingCallbackUrl
      }
    })
  }

  // PHASE 4: CALL LOGIC
  // Secret Shopper script - System speaks TO the callee
  if (voiceConfig?.synthetic_caller) {
    const script = 'Hello, I\'m calling to inquire about your services. Do you have any availability this week?'
    const scriptLines = script.split(/\n|\|/).filter(line => line.trim())

    for (let i = 0; i < scriptLines.length; i++) {
      const line = scriptLines[i].trim()
      if (line) {
        sections.push({
          play: {
            url: `say:${line}`
          }
        })
        if (i < scriptLines.length - 1) {
          sections.push({ play: { url: 'silence:2.0' } })
        }
      }
    }
    
    sections.push({
      play: {
        url: 'say:Thank you for your time. Goodbye.'
      }
    })
    
    // For secret shopper, we can add survey since it's automated end-to-end
    if (voiceConfig?.survey) {
      appendSurveyToSWML(sections, voiceConfig, callId, organizationId)
    }
    
    sections.push({ hangup: {} })
  } else if (voiceConfig?.survey && !voiceConfig?.synthetic_caller) {
    // Survey enabled but NOT secret shopper - log warning
    // Surveys don't work for regular outbound calls because the callee
    // doesn't stay on the line after the caller hangs up
    logger.warn('SWML outbound: Survey enabled but surveys only work with secret_shopper or bridge mode', {
      callId,
      organizationId,
      hint: 'Enable synthetic_caller for automated surveys, or use bridge mode'
    })
    // Fall through to normal pause behavior
  }

  // For non-secret-shopper calls, just pause to allow conversation
  if (!voiceConfig?.synthetic_caller) {
    sections.push({ play: { url: 'silence:3600.0' } })
    sections.push({ hangup: {} })
  }

  return {
    version: '1.0.0',
    sections: {
      main: sections
    }
  }
}

function resolveSurveyPrompts(voiceConfig: any): { prompts: string[]; locale: string } {
  const promptLocale = voiceConfig?.translate_to || 'en'
  const localized = voiceConfig?.survey_prompts_locales?.[promptLocale]
  if (Array.isArray(localized) && localized.length > 0) {
    return { prompts: localized, locale: promptLocale }
  }

  const defaultPrompts = Array.isArray(voiceConfig?.survey_prompts) ? voiceConfig.survey_prompts : []
  return { prompts: defaultPrompts, locale: promptLocale }
}

function appendSurveyToSWML(sections: any[], voiceConfig: any, callId: string | null | undefined, organizationId: string | null) {
  if (!voiceConfig?.survey) return

  const { prompts: surveyPrompts, locale: promptLocale } = resolveSurveyPrompts(voiceConfig)
  const resolvedPrompts = surveyPrompts.length > 0
    ? surveyPrompts
    : ['On a scale of 1 to 5, how satisfied were you with this interaction?']

  const totalQuestions = resolvedPrompts.length
  logger.info('SWML outbound: adding survey to call', {
    callId,
    organizationId,
    totalQuestions,
    promptLocale
  })

  sections.push({ play: { url: 'silence:1.0' } })
  sections.push({
    play: {
      url: `say:Before you go, I have ${totalQuestions > 1 ? totalQuestions + ' quick questions' : 'a quick question'} for you.`
    }
  })
  sections.push({ play: { url: 'silence:1.0' } })

  const surveyBaseUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/survey`
  const callParam = callId ? `callId=${encodeURIComponent(callId)}` : ''
  const orgParam = organizationId ? `orgId=${encodeURIComponent(organizationId)}` : ''

  for (let i = 0; i < resolvedPrompts.length; i++) {
    const prompt = resolvedPrompts[i]
    const questionIdx = i + 1

    if (totalQuestions > 1) {
      sections.push({
        play: {
          url: `say:Question ${questionIdx} of ${totalQuestions}:`
        }
      })
      sections.push({ play: { url: 'silence:0.5' } })
    }

    sections.push({
      play: {
        url: `say:${prompt}`
      }
    })

    const actionParams = [callParam, orgParam, `q=${questionIdx}`, `total=${totalQuestions}`].filter(Boolean).join('&')
    const actionUrl = surveyBaseUrl + (actionParams ? `?${actionParams}` : '')

    sections.push({
      prompt: {
        play: 'say:Please press a number from 1 to 5.',
        max_digits: 1,
        terminators: '#',
        speech_timeout: 10,
        digit_timeout: 10
      }
    })

    // Note: SWML prompt capture requires additional webhook configuration
    // This is a simplified version - full implementation would need webhook handling

    if (i < resolvedPrompts.length - 1) {
      sections.push({
        play: {
          url: 'say:Let me move to the next question.'
        }
      })
      sections.push({ play: { url: 'silence:0.5' } })
    }
  }

  sections.push({
    play: {
      url: 'say:Thank you for completing our survey. Your feedback is valuable to us.'
    }
  })
}

async function generateBridgeSWML(conferenceName: string, callId: string, leg?: number) {
  const { data: callRows } = await supabaseAdmin
    .from('calls')
    .select('organization_id')
    .eq('id', callId)
    .limit(1)

  const organizationId = callRows?.[0]?.organization_id
  let voiceConfig: any = null

  if (organizationId) {
    const { data: vcRows } = await supabaseAdmin
      .from('voice_configs')
      .select('record, survey, survey_prompts, survey_prompts_locales, translate_to')
      .eq('organization_id', organizationId)
      .limit(1)

    voiceConfig = vcRows?.[0]
  }

  const recordingStatusCallback = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/signalwire?callId=${callId}`
  const sections: any[] = []

  // PHASE 1: ANSWER
  sections.push({ answer: {} })

  // PHASE 2: ENABLE RECORDING
  if (voiceConfig?.record === true) {
    sections.push({
      record_call: {
        format: 'wav',
        stereo: true,
        recording_status_callback: recordingStatusCallback
      }
    })
  }

  // PHASE 3: JOIN CONFERENCE
  // CRITICAL: Use conference verb with proper settings
  sections.push({
    conference: {
      name: conferenceName,
      beep: false,
      start_conference_on_enter: true,
      end_conference_on_exit: true,
      max_participants: 2,
      record: voiceConfig?.record === true,
      recording_status_callback: recordingStatusCallback
    }
  })

  // PHASE 4: SURVEY (if enabled - executed when conference ends)
  if (voiceConfig?.survey) {
    appendSurveyToSWML(sections, voiceConfig, callId, organizationId || null)
  }

  return {
    version: '1.0.0',
    sections: {
      main: sections
    }
  }
}

export async function GET() {
  return NextResponse.json({ 
    ok: true, 
    route: '/api/voice/swml/outbound-v2', 
    method: 'Use POST for SWML generation',
    format: 'JSON (SWML)'
  })
}
