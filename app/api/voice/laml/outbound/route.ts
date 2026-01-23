import { NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { parseRequestBody, xmlResponse } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * LaML Outbound Handler - Generates dynamic LaML XML based on voice_configs
 */
export async function POST(req: Request) {
  const url = new URL(req.url)
  const callId = url.searchParams.get('callId')
  const conference = url.searchParams.get('conference')
  const leg = url.searchParams.get('leg')

  if (conference && callId) {
    const xml = await generateBridgeLaML(conference, callId, leg === '1' || leg === '2' ? parseInt(leg) : undefined)
    return xmlResponse(xml)
  }

  const payload = await parseRequestBody(req)
  const from = payload.From ?? payload.from
  const to = payload.To ?? payload.to
  const callSid = payload.CallSid ?? payload.call_sid

  logger.info('LaML outbound webhook', { from: from ? '[REDACTED]' : null, to: to ? '[REDACTED]' : null, callId })

  const xml = await generateLaML(callSid, to, callId)

  logger.debug('LaML outbound: generated XML', { length: xml.length, callId })

  return xmlResponse(xml)
}

async function generateLaML(callSid: string | undefined, toNumber: string | undefined, callId?: string | null): Promise<string> {
  let voiceConfig: any = null
  let organizationId: string | null = null

  if (callId) {
    const { data: callRows } = await supabaseAdmin
      .from('calls')
      .select('organization_id')
      .eq('id', callId)
      .limit(1)

    organizationId = callRows?.[0]?.organization_id || null
    logger.debug('LaML outbound: lookup by callId', { callId, found: !!organizationId })
  }

  if (!organizationId && callSid) {
    const { data: callRows } = await supabaseAdmin
      .from('calls')
      .select('organization_id')
      .eq('call_sid', callSid)
      .limit(1)

    organizationId = callRows?.[0]?.organization_id || null
    logger.debug('LaML outbound: fallback lookup by call_sid', { found: !!organizationId })
  }

  if (organizationId) {
    const { data: vcRows } = await supabaseAdmin
      .from('voice_configs')
      .select('record, transcribe, live_translate, translate_from, translate_to, survey, synthetic_caller, survey_prompts, survey_prompts_locales, survey_webhook_email')
      .eq('organization_id', organizationId)
      .limit(1)

    voiceConfig = vcRows?.[0] || null
    logger.debug('LaML outbound: voice_configs loaded', {
      record: voiceConfig?.record,
      transcribe: voiceConfig?.transcribe,
      translate: voiceConfig?.translate,
      survey: voiceConfig?.survey,
      surveyPromptsCount: Array.isArray(voiceConfig?.survey_prompts) ? voiceConfig.survey_prompts.length : 0
    })
  } else {
    logger.warn('LaML outbound: could not find organization for call', { callId })
  }

  const elements: string[] = []
  const recordingCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/signalwire${callId ? `?callId=${callId}` : ''}`

  // ============================================================================
  // OUTBOUND CALL LaML STRUCTURE
  // 
  // This LaML is executed when the CALLEE answers. The flow is:
  // 1. Recording disclosure (if enabled) - callee hears this
  // 2. <Pause> to allow conversation - caller speaks via REST API connection
  // 3. When caller hangs up, recording callback fires
  //
  // NOTE: Surveys are NOT supported in this flow because there's no way to
  // keep the callee on the line after the caller hangs up. For surveys:

  // ARCH_DOCS COMPLIANCE: This endpoint is deprecated. Please use /api/voice/swml/outbound for all outbound call logic.
  // If called, respond with migration notice and SWML fallback.
  import { NextResponse } from 'next/server'

  export const dynamic = 'force-dynamic'

  export async function POST() {
    return NextResponse.json({
      error: 'This endpoint is deprecated. Use /api/voice/swml/outbound for outbound calls.',
      migration: 'All outbound call logic must use SWML. See ARCH_DOCS for standards.'
    }, { status: 410 })
  }

  export async function GET() {
    return NextResponse.json({
      ok: false,
      route: '/api/voice/laml/outbound',
      migration: 'This endpoint is deprecated. Use /api/voice/swml/outbound.'
    }, { status: 410 })
  }
  // Secret Shopper script - System speaks TO the callee
