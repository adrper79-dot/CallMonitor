import { NextResponse, NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webrtc/token
 * Generate a SignalWire Video Room Token
 * 
 * Architecture: Server-Side Dialing
 * Browser joins a Room. Server dials PSTN into the Room.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const userId = (session?.user as any)?.id

        if (!userId) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
                { status: 401 }
            )
        }

        const projectId = process.env.SIGNALWIRE_PROJECT_ID
        const apiToken = process.env.SIGNALWIRE_TOKEN
        const spaceUrl = process.env.SIGNALWIRE_SPACE?.replace('https://', '').replace(/\/$/, '')

        if (!projectId || !apiToken || !spaceUrl) {
            return NextResponse.json(
                { success: false, error: { code: 'CONFIG_ERROR', message: 'SignalWire config missing' } },
                { status: 500 }
            )
        }

        const authString = Buffer.from(`${projectId}:${apiToken}`).toString('base64')
        const endpoint = `https://${spaceUrl}/api/video/room_tokens`

        // Create token for room-userID
        const roomName = `room-${userId}`

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                room_name: roomName,
                user_name: `user-${userId.substring(0, 8)}`,
                permissions: [
                    'room.self.audio_mute',
                    'room.self.audio_unmute',
                    'room.member.audio.publish',
                    'room.member.audio.subscribe'
                ]
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            return NextResponse.json(
                { success: false, error: { code: 'TOKEN_ERROR', message: 'Failed to mint video token' } },
                { status: 502 }
            )
        }

        const data = await response.json()

        return NextResponse.json({
            success: true,
            token: data.token,
            room_name: roomName, // Inform client of room name
            project_id: projectId
        })

    } catch (err) {
        logger.error('Token generation error', err)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal error' } },
            { status: 500 }
        )
    }
}
