/**
 * POST /api/voice/swml/translation
 * 
 * SWML endpoint for SignalWire AI Agent live translation.
 * 
 * SignalWire calls this endpoint when a call with live translation is answered.
 * Returns SWML configuration that attaches an AI Agent for real-time translation.
 * 
 * Query params:
 * - callId: Our internal call ID
 * - from: Source language code (e.g., 'en', 'es')
 * - to: Target language code (e.g., 'de', 'fr')
 */

import { NextRequest, NextResponse } from 'next/server'
import { buildLiveTranslationSWML } from '@/lib/signalwire/ai-agent-config'
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
      
      // Return basic SWML that just answers the call
      return NextResponse.json({
        version: '1.0.0',
        sections: {
          main: [{ answer: {} }]
        }
      })
    }

    // Build post-prompt webhook URL for AI Agent completion
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://voxsouth.online'
    const postPromptUrl = `${baseUrl}/api/webhooks/signalwire?type=ai_agent_complete&callId=${callId}`

    // Build SWML configuration
    const swml = buildLiveTranslationSWML({
      callId,
      organizationId,
      translateFrom,
      translateTo,
      postPromptUrl
    })

    logger.info('Serving live translation SWML', {
      callId,
      organizationId,
      translateFrom,
      translateTo
    })

    // Return SWML as JSON
    return NextResponse.json(swml, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

  } catch (err: any) {
    logger.error('Error building translation SWML', err, {
      url: req.url
    })

    // Fallback: return basic SWML that just answers
    return NextResponse.json({
      version: '1.0.0',
      sections: {
        main: [{ answer: {} }]
      }
    }, { status: 500 })
  }
}
