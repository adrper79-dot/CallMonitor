/**
 * POST /api/voice/swml/translation
 * 
 * Generic SWML endpoint for calls with Live Translation.
 * Supports both direct calls and conference bridges.
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const callId = searchParams.get('callId')
    const translateFrom = searchParams.get('from')
    const translateTo = searchParams.get('to')
    const organizationId = searchParams.get('orgId')
    const conference = searchParams.get('conference')
    const leg = searchParams.get('leg')

    // Validate required params
    if (!callId || !translateFrom || !translateTo || !organizationId) {
      logger.warn('SWML translation endpoint missing params', {
        callId, translateFrom, translateTo, organizationId
      })
      // Return basic SWML hangup with best practices
      return NextResponse.json({
        version: '1.0.0',
        sections: {
          main: [
            { answer: {} },
            { say: { text: 'Configuration error.' } },
            { hangup: {} }
          ]
        }
      })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://voxsouth.online'
    const webhookUrl = `${appUrl}/api/webhooks/signalwire?callId=${callId}&type=live_translate`

    const sections: any[] = []

    // 1. Answer and Record
    sections.push({ answer: {} })
    sections.push({
      record_call: {
        format: 'wav',
        stereo: true
      }
    })

    // 2. Play greeting (only for first leg of bridge, or all direct calls)
    if (!leg || leg === '1' || leg === 'first') {
      sections.push({
        play: {
          url: 'say:Connecting your call with real-time translation.'
        }
      })
    }

    // 3. Start Live Translation
    sections.push({
      live_translate: {
        action: {
          start: {
            webhook: webhookUrl,
            from_lang: translateFrom,
            to_lang: translateTo,
            direction: ['local-caller', 'remote-caller'],
            live_events: true,
            ai_summary: true
          }
        }
      }
    })

    // 4. Connect logic
    if (conference) {
      // Bridge mode: Connect to conference
      sections.push({
        connect: {
          to: `conference:${conference}`,
          beep: false,
          start_conference_on_enter: true,
          end_conference_on_exit: true
        }
      })
    } else {
      // Standard mode: Just keep call open (or other logic?)
      // For outbound calls from callPlacer, the 'connect' usually implies connecting TO the user.
      // But if this script is running, the user has already answered.
      // We might need to execute specific logic here.
      // For now, we'll placeholder generic behavior or just hold.
      // But wait, if this is a "Secret Shopper" or AI call, it relies on this script.
      // We'll leave it as a simple hold/pause for now if no conference.
      sections.push({
        play: {
          url: 'silence:3600'
        }
      })
    }

    return NextResponse.json({
      version: '1.0.0',
      sections: {
        main: sections
      }
    })

  } catch (err: any) {
    logger.error('Error serving SWML translation', err)
    return NextResponse.json({
      version: '1.0.0',
      sections: {
        main: [
          { say: { text: 'System error.' } },
          { hangup: {} }
        ]
      }
    }, { status: 500 })
  }
}
