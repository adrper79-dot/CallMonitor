/**
 * POST /api/voice/swml/translation
 * 
 * SWML endpoint for SignalWire AI Agent live translation.
 * 
 * SignalWire calls this endpoint when a call with live translation is answered.
 * Returns LaML (XML) configuration that connects to an AI Agent for real-time translation.
 * 
 * Note: Despite the path name containing "swml", we return LaML (XML) format
 * because the call is initiated via SignalWire's LaML API which cannot parse JSON.
 * 
 * Query params:
 * - callId: Our internal call ID
 * - orgId: Organization ID
 * - from: Source language code (e.g., 'en', 'es')
 * - to: Target language code (e.g., 'de', 'fr')
 */

import { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const callId = searchParams.get('callId')
    const translateFrom = searchParams.get('from')
    const translateTo = searchParams.get('to')
    const organizationId = searchParams.get('orgId')

    // Validate required params
    if (!callId || !translateFrom || !translateTo || !organizationId) {
      logger.warn('SWML translation endpoint missing params', {
        callId,
        translateFrom,
        translateTo,
        organizationId
      })

      // Return basic LaML that just answers the call
      const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Translation configuration error. Please try again.</Say>
  <Hangup/>
</Response>`
      return new Response(fallbackXml, {
        headers: { 'Content-Type': 'application/xml' }
      })
    }

    // Get AI Agent ID from environment
    const agentId = process.env.SIGNALWIRE_AI_AGENT_ID

    if (!agentId) {
      logger.error('No SIGNALWIRE_AI_AGENT_ID configured for live translation', undefined, {
        callId,
        organizationId
      })

      // Return basic answer without AI - call will connect but no translation
      const noAgentXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Live translation is temporarily unavailable. Your call will continue without translation.</Say>
</Response>`
      return new Response(noAgentXml, {
        headers: { 'Content-Type': 'application/xml' }
      })
    }

    logger.info('Serving live translation LaML', {
      callId,
      organizationId,
      translateFrom,
      translateTo,
      agentId: agentId.substring(0, 8) + '...'
    })

    // Build post-prompt webhook URL for AI Agent completion
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://voxsouth.online'
    const postPromptUrl = `${baseUrl}/api/webhooks/signalwire?type=ai_agent_complete&callId=${callId}`

    // IMPORTANT: <Connect><AI> is not supported in Compatibility API for outbound calls
    // Fallback to basic call without AI translation for now
    // TODO: Implement via Realtime API + AI Agent SDK for server-side orchestration

    logger.warn('AI Agent translation not supported in outbound LAML - using fallback', {
      callId,
      agentId: agentId.substring(0, 8) + '...'
    })

    // Return basic LaML that announces translation is unavailable
    // The call will still connect via the Dial bridge
    const laml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">This call will connect without real-time translation. Translation features are being configured.</Say>
</Response>`

    // Return LaML as XML with proper headers
    // Ensure no extra whitespace or content before/after XML
    return new Response(laml.trim(), {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    })

  } catch (err: any) {
    logger.error('Error building translation LaML', err, {
      url: req.url
    })

    // Fallback: return basic LaML that ends the call gracefully
    const errorXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>A system error occurred. Please try again later.</Say>
  <Hangup/>
</Response>`
    return new Response(errorXml, {
      status: 500,
      headers: { 'Content-Type': 'application/xml' }
    })
  }
}
