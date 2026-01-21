import { NextResponse, NextRequest } from 'next/server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webrtc/dial
 * Server-Side Dialing with SWML Bridge
 * 
 * 1. Accepts phoneNumber and roomName from Client (who is already in the room).
 * 2. Uses SignalWire LAML API to dial the number.
 * 3. Uses inline SWML (Twiml param) to immediately <Connect> the call to the Video Room.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { phoneNumber, roomName } = body

        if (!phoneNumber || !roomName) {
            return NextResponse.json({ success: false, error: 'Missing params' }, { status: 400 })
        }

        const projectId = process.env.SIGNALWIRE_PROJECT_ID
        const apiToken = process.env.SIGNALWIRE_TOKEN
        const spaceUrl = process.env.SIGNALWIRE_SPACE?.replace('https://', '').replace(/\/$/, '')
        const fromNumber = process.env.SIGNALWIRE_NUMBER || '+15550100666'

        if (!projectId || !apiToken || !spaceUrl) {
            return NextResponse.json({ success: false, error: 'Config missing' }, { status: 500 })
        }

        logger.info(`[Dial] Bridging ${phoneNumber} -> Room: ${roomName}`)

        // SWML to bridge PSTN call to Video Room
        // This is passed inline via 'Twiml' parameter to the LAML API
        const inlineSwml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Room>${roomName}</Room>
  </Connect>
</Response>`

        // SignalWire LAML REST API Endpoint
        const endpoint = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls.json`
        const authString = Buffer.from(`${projectId}:${apiToken}`).toString('base64')

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                From: fromNumber,
                To: phoneNumber,
                Twiml: inlineSwml, // Executes this logic when call is picked up
                // MachineDetection: 'Detect' // Optional
            }).toString()
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('[Dial] SignalWire Error', response.status, errorText)
            return NextResponse.json({ success: false, error: `SignalWire Error: ${response.status}` }, { status: 502 })
        }

        const data = await response.json()
        logger.info('[Dial] Call Initiated', data.sid)

        return NextResponse.json({ success: true, callId: data.sid })

    } catch (err: any) {
        logger.error('[Dial] Internal Error', err)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
