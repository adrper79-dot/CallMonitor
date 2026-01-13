import { NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'

// Force dynamic rendering - uses request.url
export const dynamic = 'force-dynamic'

/**
 * Dynamic LaML Script Endpoint
 * 
 * Returns dynamic LaML XML for a specific call based on callSid.
 * This endpoint is referenced by the LaML outbound handler as a fallback
 * for dynamic script generation.
 * 
 * Per MASTER_ARCHITECTURE.txt: SignalWire calls this endpoint to get
 * call-specific LaML instructions.
 * 
 * Query params:
 * - callSid: SignalWire call SID
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const callSid = searchParams.get('callSid')

    if (!callSid) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_CALL_SID', message: 'callSid query parameter required' } },
        { status: 400 }
      )
    }

    // Find call by call_sid to get organization_id
    const { data: callRows, error: callErr } = await supabaseAdmin
      .from('calls')
      .select('organization_id')
      .eq('call_sid', callSid)
      .limit(1)

    if (callErr || !callRows || callRows.length === 0) {
      // Call not found - return empty response (LaML handler will use fallback)
      return new NextResponse('', { status: 404 })
    }

    const organizationId = callRows[0].organization_id

    // Get voice_configs for this organization
    const { data: vcRows } = await supabaseAdmin
      .from('voice_configs')
      .select('record, transcribe, translate, translate_from, translate_to, survey, synthetic_caller, shopper_script')
      .eq('organization_id', organizationId)
      .limit(1)

    const voiceConfig = vcRows?.[0] || null

    // Generate LaML XML based on voice_configs
    // This is similar to the logic in /api/voice/laml/outbound but can be customized
    const elements: string[] = []

    // Secret Shopper script
    if (voiceConfig?.synthetic_caller) {
      const script = voiceConfig.shopper_script || 
                    'Hello, I\'m calling to inquire about your services. Do you have any availability this week?'
      
      const scriptLines = (script || '').split(/\n|\|/).filter((line: string) => line.trim())
      
      for (let i = 0; i < scriptLines.length; i++) {
        const line = scriptLines[i].trim()
        if (line) {
          elements.push(`<Say voice="alice">${escapeXml(line)}</Say>`)
          if (i < scriptLines.length - 1) {
            elements.push('<Pause length="2"/>')
          }
        }
      }
    }

    // Survey prompts
    if (voiceConfig?.survey) {
      elements.push('<Say voice="alice">Thank you for your time. Before we end, I have a quick survey.</Say>')
      elements.push('<Pause length="1"/>')
      elements.push('<Say>On a scale of 1 to 5, how satisfied were you with this call?</Say>')
      elements.push('<Gather numDigits="1" action="/api/webhooks/survey" method="POST" timeout="10"/>')
    }

    // Main call flow - Dial to destination (from call data)
    const { data: callData } = await supabaseAdmin
      .from('calls')
      .select('to_number')
      .eq('call_sid', callSid)
      .limit(1)

    const toNumber = callData?.[0]?.to_number

    if (toNumber) {
      const recordingEnabled = voiceConfig?.record === true
      const recordingStatusCallback = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/signalwire`
      
      if (recordingEnabled) {
        elements.push(`<Dial record="record-from-answer" recordingStatusCallback="${recordingStatusCallback}" recordingStatusCallbackEvent="completed">`)
        elements.push(`<Number>${escapeXml(toNumber)}</Number>`)
        elements.push('</Dial>')
      } else {
        elements.push(`<Dial><Number>${escapeXml(toNumber)}</Number></Dial>`)
      }
    } else {
      // Fallback: conference bridge
      const confName = callSid || `conf-${Date.now()}`
      elements.push(`<Dial><Conference>${escapeXml(confName)}</Conference></Dial>`)
    }

    // Closing message for secret shopper
    if (voiceConfig?.synthetic_caller) {
      elements.push('<Say voice="alice">Thank you for your time. Goodbye.</Say>')
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${elements.map(el => `  ${el}`).join('\n')}
</Response>`

    return new NextResponse(xml, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' }
    })

  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('voice/script endpoint error', { error: err?.message ?? String(err) })
    // Return empty response - LaML handler will use fallback
    return new NextResponse('', { status: 500 })
  }
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
