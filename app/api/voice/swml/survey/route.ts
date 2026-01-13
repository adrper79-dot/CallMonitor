import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { buildSurveySWML, buildFallbackSWML } from '@/lib/signalwire/surveySwmlBuilder'

// Force dynamic rendering - SWML must be generated dynamically
export const dynamic = 'force-dynamic'

/**
 * Parse form-encoded data from SignalWire webhook
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
 * POST /api/voice/swml/survey
 * 
 * SignalWire calls this endpoint for inbound survey calls.
 * Returns SWML with AI Survey Bot configuration.
 * 
 * Query params:
 * - configId: voice_configs.id to load survey prompts
 * - orgId: organization_id (fallback if configId not provided)
 */
export async function POST(req: NextRequest) {
  try {
    // Parse request body (SignalWire sends form-urlencoded or JSON)
    const ct = String(req.headers.get('content-type') || '')
    let payload: any = {}
    
    try {
      if (ct.includes('application/json')) {
        payload = await req.json()
      } else {
        const txt = await req.text()
        payload = parseFormEncoded(txt)
      }
    } catch {
      payload = {}
    }

    const callSid = payload.CallSid || payload.call_sid
    const from = payload.From || payload.from
    const to = payload.To || payload.to

    // Get configId or orgId from query params
    const url = new URL(req.url)
    const configId = url.searchParams.get('configId')
    const orgId = url.searchParams.get('orgId')

    // eslint-disable-next-line no-console
    console.log('swml/survey: inbound call', { 
      callSid: callSid ? '[REDACTED]' : null,
      from: from ? '[REDACTED]' : null,
      to: to ? '[REDACTED]' : null,
      configId,
      orgId
    })

    // Fetch voice_configs with survey prompts
    let voiceConfig: any = null
    let organizationId: string | null = null

    if (configId) {
      const { data: vcRows } = await supabaseAdmin
        .from('voice_configs')
        .select('id, organization_id, survey, survey_prompts, survey_voice, survey_webhook_email')
        .eq('id', configId)
        .limit(1)

      voiceConfig = vcRows?.[0]
      organizationId = voiceConfig?.organization_id
    } else if (orgId) {
      const { data: vcRows } = await supabaseAdmin
        .from('voice_configs')
        .select('id, organization_id, survey, survey_prompts, survey_voice, survey_webhook_email')
        .eq('organization_id', orgId)
        .limit(1)

      voiceConfig = vcRows?.[0]
      organizationId = orgId
    }

    // Validate survey is enabled
    if (!voiceConfig || !voiceConfig.survey) {
      // eslint-disable-next-line no-console
      console.warn('swml/survey: survey not enabled or config not found', { configId, orgId })
      return NextResponse.json(
        buildFallbackSWML('Sorry, this survey is not currently available. Goodbye.'),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Build SWML with survey configuration
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.callmonitor.com'
    const callId = callSid || `survey-${Date.now()}`
    
    const swml = buildSurveySWML({
      callId,
      organizationId: organizationId || 'unknown',
      prompts: voiceConfig.survey_prompts || [],
      voice: voiceConfig.survey_voice,
      postPromptWebhook: `${appUrl}/api/survey/ai-results?configId=${voiceConfig.id}&callId=${callId}`,
      recordCall: true
    })

    // eslint-disable-next-line no-console
    console.log('swml/survey: generated SWML', { 
      organizationId,
      configId: voiceConfig.id,
      promptCount: voiceConfig.survey_prompts?.length || 0,
      hasWebhookEmail: !!voiceConfig.survey_webhook_email
    })

    // Create call record if we have a call_sid
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
        // Best effort - call may already exist
        console.warn('swml/survey: could not create call record', { error: (insertErr as any)?.message })
      }
    }

    return NextResponse.json(swml, { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    })
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('swml/survey error', { error: err?.message ?? String(err) })
    
    // Return minimal working SWML for error cases
    return NextResponse.json(
      buildFallbackSWML('We encountered an error. Please try again later. Goodbye.'),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * GET /api/voice/swml/survey
 * 
 * Health check and documentation endpoint
 */
export async function GET() {
  return NextResponse.json({ 
    ok: true, 
    route: '/api/voice/swml/survey', 
    method: 'Use POST for SWML generation',
    description: 'SWML endpoint for AI Survey Bot with SignalWire AI Agent',
    params: {
      configId: 'voice_configs.id to load survey configuration',
      orgId: 'organization_id (fallback)'
    }
  })
}
