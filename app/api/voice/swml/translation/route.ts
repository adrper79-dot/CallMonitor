/**
 * POST /api/voice/swml/translation
 * 
 * Generic SWML endpoint for calls with Live Translation.
 * Supports both direct calls and conference bridges.
 */


import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { isLiveTranslationPreviewEnabled } from '@/lib/env-validation'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export async function POST(req: NextRequest) {
  // Feature flag
  if (!isLiveTranslationPreviewEnabled()) {
    logger.warn('SWML translation: Live translation preview is disabled')
    return NextResponse.json({
      version: '1.0.0',
      sections: {
        main: [
          { answer: {} },
          { say: { text: 'Live translation is not available for your plan.' } },
          { hangup: {} }
        ]
      }
    })
  }

  try {
    const { searchParams } = new URL(req.url)
    const callId        = searchParams.get('callId')
    const from          = searchParams.get('from')
    const to            = searchParams.get('to')
    const orgId         = searchParams.get('orgId')
    const conference    = searchParams.get('conference')
    const leg           = searchParams.get('leg') // optional: '1', '2', 'agent', 'customer'

    // Required params validation
    if (!callId || !from || !to || !orgId) {
      logger.warn('SWML translation endpoint missing required params', {
        callId, from, to, orgId, conference, leg
      })
      return NextResponse.json({
        version: '1.0.0',
        sections: {
          main: [
            { answer: {} },
            { say: { text: 'Invalid configuration. Ending call.' } },
            { hangup: {} }
          ]
        }
      })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://voxsouth.online'
    const translationWebhook = `${appUrl}/api/webhooks/signalwire?callId=${callId}&type=live_translate`

    const isFirstLeg = !leg || leg === '1' || leg === 'agent' || leg === 'first'

    const sections: any[] = [
      { answer: {} },
      {
        record_call: {
          format: 'wav',
          stereo: true
        }
      }
    ]

    // Greeting (only first leg / agent side)
    if (isFirstLeg) {
      sections.push({
        say: {
          text: 'Connecting your call with real-time translation. Please hold.'
        }
      })
    }

    // Start live translation (correct structure)
    sections.push({
      live_translate: {
        action: 'start',
        webhook: translationWebhook,
        from_lang: from,
        to_lang: to,
        // from_voice: 'elevenlabs.rachel', // optional, recommended for quality
        // to_voice: 'elevenlabs.matthew',
        direction: ['local-caller', 'remote-caller'],
        live_events: true,
        ai_summary: true
      }
    })

    // Connect / join logic
    if (conference) {
      // Join existing conference (bridge mode)
      sections.push({
        conference: {
          name: decodeURIComponent(conference),
          beep: false,
          start_conference_on_enter: true,
          end_conference_on_exit: true,
          record: true,
          recording_status_callback: `${appUrl}/api/webhooks/signalwire?callId=${callId}&type=recording`
        }
      })
    } else {
      // No conference → direct outbound/AI/secret shopper call
      sections.push(
        { say: { text: 'Connected. This call is being monitored with translation.' } },
        { pause: { length: 5 } },
        { hangup: {} }
      )
    }

    const swml = {
      version: '1.0.0',
      sections: {
        main: sections
      }
    }

    logger.info('SWML translation generated', {
      callId,
      languages: `${from} → ${to}`,
      conference: conference || 'none',
      leg,
      webhook: translationWebhook
    })

    return NextResponse.json(swml)

  } catch (err: any) {
    logger.error('Error generating translation SWML', {
      error: err.message,
      stack: err.stack
    })
    return NextResponse.json({
      version: '1.0.0',
      sections: {
        main: [
          { answer: {} },
          { say: { text: 'System error. Ending call.' } },
          { hangup: {} }
        ]
      }
    }, { status: 500 })
  }
}
