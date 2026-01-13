import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import supabaseAdmin from '@/lib/supabaseAdmin'

// Force dynamic rendering - webhooks must be processed dynamically
export const dynamic = 'force-dynamic'

/**
 * Survey Response Webhook Handler
 * 
 * Processes DTMF or voice survey responses from SignalWire.
 * Per MASTER_ARCHITECTURE.txt: Survey is a call modulation.
 */

function parseFormUrlEncoded(body: string) {
  return Object.fromEntries(new URLSearchParams(body))
}

export async function POST(req: Request) {
  // Return 200 OK immediately
  void processSurveyResponseAsync(req).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('survey webhook async processing error', { error: err?.message ?? String(err) })
  })

  return NextResponse.json({ ok: true, received: true })
}

async function processSurveyResponseAsync(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || ''
    let payload: any = null
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text()
      payload = parseFormUrlEncoded(text)
    } else {
      payload = await req.json()
    }

    const callSid = payload.CallSid || payload.CallSid || payload.call_sid
    const digits = payload.Digits || payload.digits || payload.DTMF || payload.dtmf
    const from = payload.From || payload.from

    // eslint-disable-next-line no-console
    console.log('survey webhook processing', { 
      callSid: callSid ? '[REDACTED]' : null, 
      hasDigits: !!digits,
      from: from ? '[REDACTED]' : null
    })

    if (!callSid) {
      // eslint-disable-next-line no-console
      console.warn('survey webhook: missing CallSid, skipping')
      return
    }

    // Find call by call_sid
    const { data: callRows } = await supabaseAdmin
      .from('calls')
      .select('id, organization_id')
      .eq('call_sid', callSid)
      .limit(1)

    const call = callRows?.[0]
    if (!call) {
      // eslint-disable-next-line no-console
      console.warn('survey webhook: call not found', { callSid: '[REDACTED]' })
      return
    }

    const callId = call.id
    const organizationId = call.organization_id

    // Get recording for this call
    const { data: recRows } = await supabaseAdmin
      .from('recordings')
      .select('id')
      .eq('call_sid', callSid)
      .limit(1)

    const recordingId = recRows?.[0]?.id

    // Store survey response in ai_runs for processing
    const { data: systemsRows } = await supabaseAdmin
      .from('systems')
      .select('id')
      .eq('key', 'system-ai')
      .limit(1)

    const systemAiId = systemsRows?.[0]?.id
    if (!systemAiId) {
      return
    }

    // Create survey ai_run entry
    const surveyRunId = uuidv4()
    await supabaseAdmin
      .from('ai_runs')
      .insert({
        id: surveyRunId,
        call_id: callId,
        system_id: systemAiId,
        model: 'assemblyai-survey',
        status: 'queued',
        started_at: new Date().toISOString(),
        output: {
          type: 'survey',
          dtmf_response: digits,
          call_sid: callSid,
          from_number: from
        }
      })

    // Process survey response (will be completed when transcript is available)
    // eslint-disable-next-line no-console
    console.log('survey webhook: survey response recorded', { surveyRunId, callId, recordingId })

  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('survey webhook processing error', { error: err?.message ?? String(err) })
  }
}
