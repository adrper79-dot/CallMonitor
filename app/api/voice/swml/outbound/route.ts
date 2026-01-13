import { NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { buildSWML } from '@/lib/signalwire/swmlBuilder'
import { isLiveTranslationPreviewEnabled } from '@/lib/env-validation'

// Force dynamic rendering - SWML must be generated dynamically
export const dynamic = 'force-dynamic'

/**
 * Parse form-encoded data
 */
function parseFormEncoded(text: string): Record<string, any> {
  try {
    const params = new URLSearchParams(text)
    const obj: Record<string, any> = {}
    Array.from(params.entries()).forEach(([k, v]) => { obj[k] = v })
    return obj
  } catch {
    return {}
  }
}

/**
 * SWML Outbound Handler
 * 
 * Generates SWML JSON for live translation calls with SignalWire AI Agent.
 * Per SIGNALWIRE_AI_AGENTS_RESEARCH.md Option 1 (Hybrid Approach)
 * 
 * This endpoint is used ONLY for live translation calls (real_time_translation_preview).
 * Regular calls continue to use LaML endpoint.
 */
export async function POST(req: Request) {
  try {
    const ct = String(req.headers.get('content-type') || '')
    let payload: any = {}
    
    try {
      if (ct.includes('application/json')) {
        payload = await req.json()
      } else {
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
    
    // Extract callId from query params (passed from startCallHandler)
    const url = new URL(req.url)
    const callId = url.searchParams.get('callId')

    // Log minimal info for debugging (do not leak secrets)
    // eslint-disable-next-line no-console
    console.log('swml/outbound webhook', { from, to, callSid: callSid ? '[REDACTED]' : null, callId })

    // Find call by call_sid or callId to get organization_id and voice_configs
    let organizationId: string | null = null
    let voiceConfig: any = null

    if (callSid) {
      const { data: callRows } = await supabaseAdmin
        .from('calls')
        .select('id, organization_id')
        .eq('call_sid', callSid)
        .limit(1)

      if (callRows && callRows[0]) {
        organizationId = callRows[0].organization_id
      }
    } else if (callId) {
      const { data: callRows } = await supabaseAdmin
        .from('calls')
        .select('organization_id')
        .eq('id', callId)
        .limit(1)

      if (callRows && callRows[0]) {
        organizationId = callRows[0].organization_id
      }
    }

    if (!organizationId) {
      // eslint-disable-next-line no-console
      console.warn('swml/outbound: could not find organization_id', { callSid: callSid ? '[REDACTED]' : null, callId })
      // Return minimal working SWML - answer verb (call already initiated via REST API)
      const fallbackSWML = {
        version: '1.0.0',
        sections: {
          main: [
            { answer: {} },
            { hangup: {} }
          ]
        }
      }
      return NextResponse.json(fallbackSWML, { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    // Get voice_configs for this organization
    const { data: vcRows } = await supabaseAdmin
      .from('voice_configs')
      .select('record, translate, translate_from, translate_to')
      .eq('organization_id', organizationId)
      .limit(1)

    voiceConfig = vcRows?.[0] || null

    // Verify live translation is enabled
    if (!voiceConfig?.translate || !voiceConfig?.translate_from || !voiceConfig?.translate_to) {
      // eslint-disable-next-line no-console
      console.warn('swml/outbound: translation not enabled in voice_configs', { organizationId })
      // Return minimal working SWML - answer verb (no AI agent)
      // This shouldn't happen (routing logic should prevent it), but defensive coding
      const fallbackSWML = {
        version: '1.0.0',
        sections: {
          main: [
            { answer: {} },
            { hangup: {} }
          ]
        }
      }
      return NextResponse.json(fallbackSWML, { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    // Check feature flag
    if (!isLiveTranslationPreviewEnabled()) {
      // eslint-disable-next-line no-console
      console.warn('swml/outbound: feature flag disabled', { organizationId })
      // Return minimal working SWML - answer verb (no AI agent)
      // This shouldn't happen (routing logic should prevent it), but defensive coding
      const fallbackSWML = {
        version: '1.0.0',
        sections: {
          main: [
            { answer: {} },
            { hangup: {} }
          ]
        }
      }
      return NextResponse.json(fallbackSWML, { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    // Build SWML with AI Agent configuration
    // Per ARCH_DOCS: SignalWire calls this endpoint after call is answered
    // We return SWML with `answer` verb (not `connect` verb)
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

    // eslint-disable-next-line no-console
    console.log('swml/outbound: generated SWML', { organizationId, callId: finalCallId, hasAI: true })

    return NextResponse.json(swmlConfig, { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    })
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('swml/outbound error', { error: err?.message ?? String(err) })
    
    // Return minimal working SWML - answer verb (call already initiated via REST API)
    const errorSWML = {
      version: '1.0.0',
      sections: {
        main: [
          { answer: {} },
          { hangup: {} }
        ]
      }
    }
    return NextResponse.json(errorSWML, { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function GET(req: Request) {
  // For GET requests, return route info (useful for testing)
  return NextResponse.json({ 
    ok: true, 
    route: '/api/voice/swml/outbound', 
    method: 'Use POST for SWML generation',
    description: 'SWML endpoint for live translation calls with SignalWire AI Agent'
  })
}
