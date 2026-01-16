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
      .select('record, transcribe, translate, translate_from, translate_to, survey, synthetic_caller')
      .eq('organization_id', organizationId)
      .limit(1)

    voiceConfig = vcRows?.[0] || null
    logger.debug('LaML outbound: voice_configs loaded', { 
      record: voiceConfig?.record, 
      transcribe: voiceConfig?.transcribe,
      translate: voiceConfig?.translate
    })
  } else {
    logger.warn('LaML outbound: could not find organization for call', { callId })
  }

  const elements: string[] = []
  const recordingCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/signalwire${callId ? `?callId=${callId}` : ''}`

  // Enable recording via LaML <Record> verb if record=true in voice_configs
  // This is a backup to the REST API Record=true parameter
  if (voiceConfig?.record === true) {
    logger.info('LaML outbound: enabling recording via LaML', { callId, organizationId })
    // Record the entire call - maxLength 3600 seconds (1 hour), send callback when done
    elements.push(`<Record maxLength="3600" recordingStatusCallback="${escapeXml(recordingCallbackUrl)}" recordingStatusCallbackEvent="completed" playBeep="false" trim="trim-silence"/>`)
  }

  // Secret Shopper script
  if (voiceConfig?.synthetic_caller) {
    const script = 'Hello, I\'m calling to inquire about your services. Do you have any availability this week?'
    const scriptLines = script.split(/\n|\|/).filter(line => line.trim())
    
    for (let i = 0; i < scriptLines.length; i++) {
      const line = scriptLines[i].trim()
      if (line) {
        elements.push(`<Say voice="alice">${escapeXml(line)}</Say>`)
        if (i < scriptLines.length - 1) {
          elements.push('<Pause length="2"/>')
        }
      }
    }
    elements.push('<Say voice="alice">Thank you for your time. Goodbye.</Say>')
  }
  
  // Survey prompts
  if (voiceConfig?.survey) {
    elements.push('<Say voice="alice">Thank you for your time. Before we end, I have a quick survey.</Say>')
    elements.push('<Pause length="1"/>')
    elements.push('<Say>On a scale of 1 to 5, how satisfied were you with this call?</Say>')
    elements.push('<Gather numDigits="1" action="/api/webhooks/survey" method="POST" timeout="10"/>')
  }
  
  elements.push('<Pause length="3600"/>')
  elements.push('<Hangup/>')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${elements.map(el => `  ${el}`).join('\n')}
</Response>`
}

async function generateBridgeLaML(conferenceName: string, callId: string, leg?: number): Promise<string> {
  const { data: callRows } = await supabaseAdmin
    .from('calls')
    .select('organization_id')
    .eq('id', callId)
    .limit(1)

  const organizationId = callRows?.[0]?.organization_id
  let recordEnabled = false

  if (organizationId) {
    const { data: vcRows } = await supabaseAdmin
      .from('voice_configs')
      .select('record')
      .eq('organization_id', organizationId)
      .limit(1)

    recordEnabled = vcRows?.[0]?.record === true
  }

  const recordingStatusCallback = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/signalwire`
  const elements: string[] = ['<Dial>']
  
  if (recordEnabled) {
    elements.push(`  <Conference record="record-from-answer" recordingStatusCallback="${recordingStatusCallback}" recordingStatusCallbackEvent="completed">${escapeXml(conferenceName)}</Conference>`)
  } else {
    elements.push(`  <Conference>${escapeXml(conferenceName)}</Conference>`)
  }
  
  elements.push('</Dial>')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${elements.map(el => `  ${el}`).join('\n')}
</Response>`
}

function escapeXml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/voice/laml/outbound', method: 'Use POST for LaML generation' })
}
