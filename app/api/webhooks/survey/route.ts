import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { parseRequestBody } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Survey Response Webhook Handler - processes DTMF or voice survey responses
 */
export async function POST(req: Request) {
  void processSurveyResponseAsync(req).catch((err) => {
    logger.error('survey webhook async processing error', err)
  })

  return NextResponse.json({ ok: true, received: true })
}

async function processSurveyResponseAsync(req: Request) {
  try {
    const payload = await parseRequestBody(req)

    const callSid = payload.CallSid || payload.call_sid
    const digits = payload.Digits || payload.digits || payload.DTMF || payload.dtmf
    const from = payload.From || payload.from

    logger.info('survey webhook processing', { 
      hasCallSid: !!callSid, hasDigits: !!digits
    })

    if (!callSid) {
      logger.warn('survey webhook: missing CallSid, skipping')
      return
    }

    const { data: callRows } = await supabaseAdmin
      .from('calls')
      .select('id, organization_id')
      .eq('call_sid', callSid)
      .limit(1)

    const call = callRows?.[0]
    if (!call) {
      logger.warn('survey webhook: call not found')
      return
    }

    const { data: systemsRows } = await supabaseAdmin
      .from('systems')
      .select('id')
      .eq('key', 'system-ai')
      .limit(1)

    const systemAiId = systemsRows?.[0]?.id
    if (!systemAiId) return

    const surveyRunId = uuidv4()
    await supabaseAdmin.from('ai_runs').insert({
      id: surveyRunId, call_id: call.id, system_id: systemAiId,
      model: 'assemblyai-survey', status: 'queued',
      started_at: new Date().toISOString(),
      output: { type: 'survey', dtmf_response: digits, call_sid: callSid, from_number: from }
    })

    logger.info('survey webhook: response recorded', { surveyRunId, callId: call.id })

  } catch (err: any) {
    logger.error('survey webhook processing error', err)
  }
}
