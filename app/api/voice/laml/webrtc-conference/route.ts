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

    // LaML to join conference
    // - beep="false": No beep when participants join
    // - startConferenceOnEnter="true": Start conference immediately
    // - endConferenceOnExit="true": End conference when last person leaves
    // - waitUrl="": No hold music (optional, can add)

    const laml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference 
      beep="false"
      startConferenceOnEnter="true"
      endConferenceOnExit="true"
      maxParticipants="2">${conferenceId}</Conference>
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
