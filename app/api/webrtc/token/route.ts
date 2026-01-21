import { NextResponse, NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { RestClient } from '@signalwire/node'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webrtc/token
 * Generate a SignalWire Video Room Token via @signalwire/node
 * 
 * Robust implementation to avoid 502 Bad Gateway errors.
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Auth Check with explicit catch to avoid crash
        let session
        try {
            session = await getServerSession(authOptions)
        } catch (e) {
            console.error('Auth Check Failed', e)
            return NextResponse.json({ success: false, error: 'Auth Service Failure' }, { status: 500 })
        }

        const userId = (session?.user as any)?.id // Explicit any

        if (!userId) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
                { status: 401 }
            )
        }

        // 2. Config Check
        const projectId = process.env.SIGNALWIRE_PROJECT_ID
        const apiToken = process.env.SIGNALWIRE_TOKEN
        const spaceUrl = process.env.SIGNALWIRE_SPACE?.replace('https://', '').replace(/\/$/, '')

        if (!projectId || !apiToken || !spaceUrl) {
            console.error('SignalWire Config Missing', { projectId: !!projectId, apiToken: !!apiToken, spaceUrl })
            return NextResponse.json(
                { success: false, error: { code: 'CONFIG_ERROR', message: 'SignalWire config missing' } },
                { status: 500 }
            )
        }

        // 3. Initialize RestClient
        // Note: signalwireSpaceUrl is expected in options
        const client = new RestClient(projectId, apiToken, { signalwireSpaceUrl: spaceUrl })

        const roomName = `room-${userId}`
        const userName = `user-${userId.substring(0, 8)}`

        console.log(`[Token] Minting for room: ${roomName} user: ${userName}`)

        // 4. Create Token via SDK
        // The SDK handles retries and errors better than raw fetch
        const tokenResult = await client.video.roomTokens.create({
            roomName: roomName,
            userName: userName,
            permissions: [
                'room.self.audio_mute',
                'room.self.audio_unmute',
                'room.member.audio.publish',
                'room.member.audio.subscribe'
            ]
        })

        // 5. Success
        return NextResponse.json({
            success: true,
            token: tokenResult.token,
            room_name: roomName,
            project_id: projectId
        })

    } catch (err: any) {
        console.error('[Token] Generation Error:', err)
        // Return explicit error to avoid 502
        return NextResponse.json(
            { success: false, error: { code: 'TOKEN_ERROR', message: err.message || 'Failed to mint token' } },
            { status: 500 }
        )
    }
}
