/**
 * WebRTC Conference LaML Handler
 * 
 * Purpose: LaML response that joins participants to WebRTC conference
 * Called by: Voice API when dialing browser client or PSTN number
 * 
 * Query Parameters:
 * - conferenceId: Unique conference room ID
 * - leg: 'browser' or 'pstn' (for tracking)
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const conferenceId = searchParams.get('conferenceId')
    const leg = searchParams.get('leg') || 'unknown'

    if (!conferenceId) {
        logger.error('[webrtc-conference] Missing conferenceId', null)
        return new NextResponse(
            `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Conference error. Goodbye.</Say>
  <Hangup/>
</Response>`,
            {
                status: 400,
                headers: { 'Content-Type': 'application/xml' }
            }
        )
    }

    logger.info('[webrtc-conference] Joining conference', { conferenceId, leg })

    // Smart conference termination:
    // - If PSTN leg exits → end conference (user hung up intentionally)
    // - If browser leg exits → keep conference open (might reconnect)
    // This prevents wasting money on abandoned conferences while allowing browser reconnects
    const endOnExit = leg === 'pstn' ? 'true' : 'false'

    logger.info('[webrtc-conference] Conference settings', {
        conferenceId,
        leg,
        endConferenceOnExit: endOnExit
    })

    const laml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference 
      beep="false"
      startConferenceOnEnter="true"
      endConferenceOnExit="${endOnExit}"
      maxParticipants="2"
      statusCallback="${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/signalwire?conferenceEvent=true&amp;conferenceId=${conferenceId}"
      statusCallbackEvent="start end join leave">${conferenceId}</Conference>
  </Dial>
</Response>`

    return new NextResponse(laml, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
    })
}

export async function POST(request: NextRequest) {
    // Handle POST requests the same way (SignalWire can use either)
    return GET(request)
}
