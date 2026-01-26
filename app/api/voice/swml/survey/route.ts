import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { buildSurveySWML, buildFallbackSWML } from '@/lib/signalwire/surveySwmlBuilder'
import { parseRequestBody, swmlJsonResponse } from '@/lib/api/utils'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

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
      const { rows } = await query(
        `SELECT id, organization_id, survey, survey_prompts, survey_prompts_locales, translate_to, survey_voice, survey_webhook_email
         FROM voice_configs WHERE id = $1 LIMIT 1`,
        [configId]
      )

      voiceConfig = rows?.[0]
      organizationId = voiceConfig?.organization_id
    } else if (orgId) {
      const { rows } = await query(
        `SELECT id, organization_id, survey, survey_prompts, survey_prompts_locales, translate_to, survey_voice, survey_webhook_email
         FROM voice_configs WHERE organization_id = $1 LIMIT 1`,
        [orgId]
      )

      voiceConfig = rows?.[0]
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
        await query(
          `INSERT INTO calls (id, organization_id, call_sid, status, started_at)
             VALUES ($1, $2, $3, 'ringing', NOW())`,
          [uuidv4(), organizationId, callSid]
        )
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
