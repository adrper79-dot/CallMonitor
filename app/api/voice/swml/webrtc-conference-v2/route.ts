/**
 * WebRTC Conference SWML Handler (v2) - Replaces LaML with SWML
 * 
 * Purpose: SWML response that joins participants to WebRTC conference
 * Called by: Voice API when dialing browser client or PSTN number
 * 
 * Query Parameters:
 * - conferenceId: Unique conference room ID
 * - leg: 'browser' or 'pstn' (for tracking)
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { swmlJsonResponse } from '@/lib/api/utils'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const conferenceId = searchParams.get('conferenceId')
    const leg = searchParams.get('leg') || 'unknown'

    if (!conferenceId) {
        logger.error('[webrtc-conference-swml] Missing conferenceId', null)
                return swmlJsonResponse({
            version: '1.0.0',
            sections: {
                main: [
                    { answer: {} },
                    {
                        play: {
                            url: 'say:Conference error. Goodbye.'
                        }
                    },
                    { hangup: {} }
                ]
            }
        })
    }

    logger.info('[webrtc-conference-swml] Joining conference', { conferenceId, leg })

    // Smart conference termination:
    // - If PSTN leg exits → end conference (user hung up intentionally)
    // - If browser leg exits → keep conference open (might reconnect)
    // This prevents wasting money on abandoned conferences while allowing browser reconnects
    const endOnExit = leg === 'pstn'

    logger.info('[webrtc-conference-swml] Conference settings', {
        conferenceId,
        leg,
        endConferenceOnExit: endOnExit
    })

        const swml = {
        version: '1.0.0',
        sections: {
            main: [
                { answer: {} },
                {
                    conference: {
                        name: conferenceId,
                        beep: false,
                        start_conference_on_enter: true,
                        end_conference_on_exit: endOnExit,
                        max_participants: 2,
                        status_callback: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/signalwire?conferenceEvent=true&conferenceId=${conferenceId}`,
                        status_callback_events: ['start', 'end', 'join', 'leave']
                    }
                }
            ]
        }
    }

    return swmlJsonResponse(swml)
}

export async function POST(request: NextRequest) {
    // Handle POST requests the same way (SignalWire can use either)
    return GET(request)
}
