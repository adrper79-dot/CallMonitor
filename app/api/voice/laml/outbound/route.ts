import { NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'

function parseFormEncoded(text: string) {
  try {
    const params = new URLSearchParams(text)
    const obj: Record<string, string> = {}
    Array.from(params.entries()).forEach(([k, v]) => { obj[k] = v })
    return obj
  } catch {
    return {}
  }
}

/**
 * LaML Outbound Handler
 * 
 * Generates dynamic LaML XML based on voice_configs modulations:
 * - Recording if record=true
 * - Translation prompts if translate=true
 * - Survey prompts if survey=true
 * - Secret shopper script if synthetic_caller=true
 * 
 * Per MEDIA_PLANE_ARCHITECTURE.txt: SignalWire handles all media via LaML
 */
export async function POST(req: Request) {
  // Check URL query parameters first (for bridge calls with conference)
  const url = new URL(req.url)
  const callId = url.searchParams.get('callId')
  const conference = url.searchParams.get('conference')
  const leg = url.searchParams.get('leg') // '1' or '2' for bridge calls

  // If this is a bridge call with a conference, generate conference LaML
  if (conference && callId) {
    const xml = await generateBridgeLaML(conference, callId, leg === '1' || leg === '2' ? parseInt(leg) : undefined)
    return new NextResponse(xml, { status: 200, headers: { 'Content-Type': 'application/xml' } })
  }

  const ct = String(req.headers.get('content-type') || '')
  let payload: any = {}
  try {
    if (ct.includes('application/json')) payload = await req.json()
    else {
      const txt = await req.text()
      payload = parseFormEncoded(txt)
    }
  } catch (e) {
    // best-effort
    try { payload = await req.json() } catch { payload = {} }
  }

  const from = payload.From ?? payload.from
  const to = payload.To ?? payload.to
  const callSid = payload.CallSid ?? payload.CallSid ?? payload.call_sid

  // Log minimal info for debugging (do not leak secrets)
  // eslint-disable-next-line no-console
  console.log('laml/outbound webhook', { from, to, callSid: callSid ? '[REDACTED]' : null })

  // DISABLED: Dynamic script endpoint always returns 404 because call_sid is not saved to DB
  // This is intentional per TOOL_TABLE_ALIGNMENT - call_sid only stored in tools table
  // const dynamic = await tryFetchDynamicScript(callSid)
  // if (dynamic) {
  //   return new NextResponse(dynamic, { status: 200, headers: { 'Content-Type': 'application/xml' } })
  // }

  // Generate LaML based on voice_configs
  const xml = await generateLaML(callSid, to)
  
  // eslint-disable-next-line no-console
  console.log('laml/outbound: generated XML', { length: xml.length, callSid: callSid ? '[REDACTED]' : null })

  return new NextResponse(xml, { status: 200, headers: { 'Content-Type': 'application/xml' } })
}

/**
 * Try to fetch dynamic script from /api/voice/script endpoint
 */
const tryFetchDynamicScript = async (callSid?: string) => {
  try {
    const base = String(process.env.NEXT_PUBLIC_APP_URL || '')
    if (!base || !callSid) return null
    const url = `${base.replace(/\/$/, '')}/api/voice/script?callSid=${encodeURIComponent(callSid)}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return null
    const txt = await res.text()
    if (!txt) return null
    return txt
  } catch (e) {
    return null
  }
}

/**
 * Generate LaML XML based on voice_configs modulations
 */
async function generateLaML(callSid: string | undefined, toNumber: string | undefined): Promise<string> {
  let voiceConfig: any = null
  let organizationId: string | null = null

  // Find call by call_sid to get organization_id
  if (callSid) {
    const { data: callRows } = await supabaseAdmin
      .from('calls')
      .select('organization_id')
      .eq('call_sid', callSid)
      .limit(1)

    organizationId = callRows?.[0]?.organization_id || null

    if (organizationId) {
      // Get voice_configs for this organization
      const { data: vcRows } = await supabaseAdmin
        .from('voice_configs')
        .select('record, transcribe, translate, translate_from, translate_to, survey, synthetic_caller')
        .eq('organization_id', organizationId)
        .limit(1)

      voiceConfig = vcRows?.[0] || null
    }
  }

  // Build LaML response
  const elements: string[] = []

  // Secret Shopper script (synthetic_caller) - inject scripted prompts
  if (voiceConfig?.synthetic_caller) {
    // Get secret shopper script from voice_configs or shopper_scripts
    // For now, we'll use a default script or fetch from a scripts table
    let script: string | null = null
    
    // Try to get script from voice_configs JSONB (if script stored there)
    // Or fetch from shopper_scripts table if it exists
    try {
      const { data: scriptRows } = await supabaseAdmin
        .from('voice_configs')
        .select('*')
        .eq('organization_id', organizationId || '')
        .limit(1)
      
      // Check if script is stored in a JSONB field or separate table
      // For now, use default script
      script = 'Hello, I\'m calling to inquire about your services. Do you have any availability this week?'
    } catch {
      script = 'Hello, I\'m calling to inquire about your services. Do you have any availability this week?'
    }

    // Parse script into LaML Say elements
    // Script format: lines separated by newlines or |, each line becomes a Say element
    const scriptLines = (script || '').split(/\n|\|/).filter(line => line.trim())
    
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

  // Translation prompts (if translation enabled)
  if (voiceConfig?.translate && voiceConfig?.translate_from && voiceConfig?.translate_to) {
    // SignalWire doesn't have built-in translation, but we can inject prompts
    // Actual translation happens post-call via AssemblyAI
    // For now, we just note that translation is enabled
    // In Phase 2 with FreeSWITCH, we could inject real-time translation
  }

  // Recording (always enabled if record=true)
  const recordingEnabled = voiceConfig?.record === true
  const recordingAction = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/signalwire`
  const recordingStatusCallback = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/signalwire`

  // Main call flow for standard outbound calls
  // 
  // IMPORTANT: When SignalWire REST API is called with From/To/Url/Record=true:
  // 1. SignalWire dials the To number
  // 2. When call is answered, SignalWire calls our Url webhook
  // 3. SignalWire automatically records the call (Record=true in REST API)
  // 4. LaML just needs to keep the call alive and optionally add features
  //
  // Key: Recording happens at REST API level, NOT via LaML <Record> verb
  // LaML <Record> is for voicemail recording (waits for input), NOT call recording
  
  // For secret shopper, inject script FIRST (before call connects to agent)
  if (voiceConfig?.synthetic_caller) {
    // Secret shopper scripts already added above (lines 129-163)
    // Add closing message
    elements.push('<Say voice="alice">Thank you for your time. Goodbye.</Say>')
  }
  
  // Survey prompts AFTER call (if survey enabled)
  if (voiceConfig?.survey) {
    elements.push('<Say voice="alice">Thank you for your time. Before we end, I have a quick survey.</Say>')
    elements.push('<Pause length="1"/>')
    elements.push('<Say>On a scale of 1 to 5, how satisfied were you with this call?</Say>')
    elements.push('<Gather numDigits="1" action="/api/webhooks/survey" method="POST" timeout="10"/>')
  }
  
  // Keep call alive for conversation
  // Call will naturally end when either party hangs up
  // This prevents premature timeout while keeping call connected
  // Using very long Pause (1 hour) - call ends when parties hang up
  elements.push('<Pause length="3600"/>')
  
  // Fallback hangup (only reached if call somehow lasts over 1 hour)
  elements.push('<Hangup/>')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${elements.map(el => `  ${el}`).join('\n')}
</Response>`

  return xml
}

/**
 * Generate LaML for bridge call with conference
 * 
 * Bridge calls connect two parties via a conference room:
 * - Leg 1: Your agent/number → Conference
 * - Leg 2: Destination number → Conference
 * 
 * CRITICAL: Recording must be on <Conference>, NOT on <Dial>
 * Recording on <Dial> creates duplicate recordings (one per leg)
 */
async function generateBridgeLaML(conferenceName: string, callId: string, leg?: number): Promise<string> {
  // Get voice_configs for this call to check recording settings
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

  const elements: string[] = []
  const recordingStatusCallback = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/signalwire`
  
  // Dial into conference (no recording attribute on Dial)
  elements.push('<Dial>')
  
  // Conference with recording (if enabled)
  // IMPORTANT: Use record="record-from-answer" on Conference, not Dial
  // This creates ONE recording for the entire conference, not per leg
  if (recordEnabled) {
    elements.push(`  <Conference record="record-from-answer" recordingStatusCallback="${recordingStatusCallback}" recordingStatusCallbackEvent="completed">${escapeXml(conferenceName)}</Conference>`)
  } else {
    elements.push(`  <Conference>${escapeXml(conferenceName)}</Conference>`)
  }
  
  elements.push('</Dial>')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${elements.map(el => `  ${el}`).join('\n')}
</Response>`

  return xml
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

export async function GET(req: Request) {
  // For GET requests, return route info (useful for testing)
  // For actual LaML generation, use POST
  return NextResponse.json({ ok: true, route: '/api/voice/laml/outbound', method: 'Use POST for LaML generation' })
}
