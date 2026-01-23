import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { buildSurveySWML, buildFallbackSWML } from '@/lib/signalwire/surveySwmlBuilder'
import { parseRequestBody, swmlJsonResponse } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/voice/swml/survey - SignalWire calls this for inbound survey calls
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await parseRequestBody(req)

    const callSid = payload.CallSid || payload.call_sid
    const from = payload.From || payload.from
    const to = payload.To || payload.to

    const url = new URL(req.url)
    const configId = url.searchParams.get('configId')
    const orgId = url.searchParams.get('orgId')

    logger.info('SWML survey: inbound call', { 
      callSid: callSid ? '[REDACTED]' : null,
      configId, orgId
    })

    let voiceConfig: any = null
    let organizationId: string | null = null

    if (configId) {
      const { data: vcRows } = await supabaseAdmin
        .from('voice_configs')
        .select('id, organization_id, survey, survey_prompts, survey_prompts_locales, translate_to, survey_voice, survey_webhook_email')
        .eq('id', configId)
        .limit(1)

      voiceConfig = vcRows?.[0]
      organizationId = voiceConfig?.organization_id
    } else if (orgId) {
      const { data: vcRows } = await supabaseAdmin
        .from('voice_configs')
        .select('id, organization_id, survey, survey_prompts, survey_prompts_locales, translate_to, survey_voice, survey_webhook_email')
        .eq('organization_id', orgId)
        .limit(1)

      voiceConfig = vcRows?.[0]
      organizationId = orgId
    }

    if (!voiceConfig || !voiceConfig.survey) {
      logger.warn('SWML survey: not enabled or config not found', { configId, orgId })
      return swmlJsonResponse(buildFallbackSWML('Sorry, this survey is not currently available. Goodbye.'))
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.callmonitor.com'
    const callId = callSid || `survey-${Date.now()}`
    
    const { prompts: resolvedPrompts } = resolveSurveyPrompts(voiceConfig)
    const swml = buildSurveySWML({
      callId,
      organizationId: organizationId || 'unknown',
      prompts: resolvedPrompts,
      voice: voiceConfig.survey_voice,
      postPromptWebhook: `${appUrl}/api/survey/ai-results?configId=${voiceConfig.id}&callId=${callId}`,
      recordCall: true
    })

    logger.info('SWML survey: generated SWML', { 
      organizationId,
      configId: voiceConfig.id,
      promptCount: resolvedPrompts.length
    })

    if (callSid && organizationId) {
      try {
        const { v4: uuidv4 } = await import('uuid')
        await supabaseAdmin.from('calls').insert({
          id: uuidv4(),
          organization_id: organizationId,
          call_sid: callSid,
          status: 'ringing',
          started_at: new Date().toISOString()
        })
      } catch (insertErr) {
        logger.warn('SWML survey: could not create call record', { error: (insertErr as any)?.message })
      }
    }

    return swmlJsonResponse(swml)
  } catch (err: any) {
    logger.error('SWML survey error', err)
    return swmlJsonResponse(buildFallbackSWML('We encountered an error. Please try again later. Goodbye.'))
  }
}

export async function GET() {
  return NextResponse.json({ 
    ok: true, route: '/api/voice/swml/survey', 
    method: 'Use POST for SWML generation',
    description: 'SWML endpoint for AI Survey Bot',
    params: { configId: 'voice_configs.id', orgId: 'organization_id (fallback)' }
  })
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
