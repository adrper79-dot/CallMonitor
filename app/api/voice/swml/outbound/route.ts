import { NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { buildSWML } from '@/lib/signalwire/swmlBuilder'
import { isLiveTranslationPreviewEnabled } from '@/lib/env-validation'
import { parseRequestBody, swmlResponse } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const FALLBACK_SWML = {
  version: '1.0.0',
  sections: { main: [ { answer: {} }, { hangup: {} } ] }
}

/**
 * SWML Outbound Handler - Live translation calls with SignalWire AI Agent
 */
export async function POST(req: Request) {
  try {
    const payload = await parseRequestBody(req)

    const from = payload.From ?? payload.from
    const to = payload.To ?? payload.to
    const callSid = payload.CallSid ?? payload.call_sid

    const url = new URL(req.url)
    const callId = url.searchParams.get('callId')

    logger.info('SWML outbound webhook', { from: from ? '[REDACTED]' : null, to: to ? '[REDACTED]' : null, callId })

    let organizationId: string | null = null
    let voiceConfig: any = null

    if (callSid) {
      const { data: callRows } = await supabaseAdmin
        .from('calls')
        .select('id, organization_id')
        .eq('call_sid', callSid)
        .limit(1)

      if (callRows?.[0]) {
        organizationId = callRows[0].organization_id
      }
    } else if (callId) {
      const { data: callRows } = await supabaseAdmin
        .from('calls')
        .select('organization_id')
        .eq('id', callId)
        .limit(1)

      if (callRows?.[0]) {
        organizationId = callRows[0].organization_id
      }
    }

    if (!organizationId) {
      logger.warn('SWML outbound: could not find organization_id', { callId })
      return swmlResponse(FALLBACK_SWML)
    }

    const { data: vcRows } = await supabaseAdmin
      .from('voice_configs')
      .select('record, live_translate, translate_from, translate_to')
      .eq('organization_id', organizationId)
      .limit(1)

    voiceConfig = vcRows?.[0] || null

    if (!voiceConfig?.live_translate || !voiceConfig?.translate_from || !voiceConfig?.translate_to) {
      logger.warn('SWML outbound: translation not enabled', { organizationId })
      return swmlResponse(FALLBACK_SWML)
    }

    if (!isLiveTranslationPreviewEnabled()) {
      logger.warn('SWML outbound: feature flag disabled', { organizationId })
      return swmlResponse(FALLBACK_SWML)
    }

    const finalCallId = callId || callSid || `swml-${Date.now()}`
    const swmlConfig = buildSWML(
      {
        callId: finalCallId,
        organizationId,
        translationFrom: voiceConfig.translate_from,
        translationTo: voiceConfig.translate_to
      },
      voiceConfig.record === true
    )

    logger.info('SWML outbound: generated SWML', { organizationId, callId: finalCallId })

    return swmlResponse(swmlConfig)
  } catch (err: any) {
    logger.error('SWML outbound error', err)
    return swmlResponse(FALLBACK_SWML)
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true, route: '/api/voice/swml/outbound',
    method: 'Use POST for SWML generation',
    description: 'SWML endpoint for live translation calls'
  })
}
