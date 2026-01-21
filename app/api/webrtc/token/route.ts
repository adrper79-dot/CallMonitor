import { NextResponse, NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webrtc/token
 * Generate a SignalWire Video Room Token via Raw REST API (Fetch)
 * 
 * Replaces @signalwire/node to resolve build errors (missing exports).
 * Hardened to prevent 502 errors.
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Auth Check
        let session
        try {
            session = await getServerSession(authOptions)
        } catch (e) {
            console.error('[Token] Auth Check Failed', e)
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
            console.error('[Token] SignalWire Config Missing')
            return NextResponse.json(
                { success: false, error: { code: 'CONFIG_ERROR', message: 'SignalWire config missing' } },
                { status: 500 }
            )
        }

        const roomName = `room-${userId}`
        const userName = `user-${userId.substring(0, 8)}`

        console.log(`[Token] Minting for room: ${roomName} via REST API`)

        // 3. Raw REST API Call
        // Endpoint: https://<space>/api/video/room_tokens
        const endpoint = `https://${spaceUrl}/api/video/room_tokens`
        const authString = Buffer.from(`${projectId}:${apiToken}`).toString('base64')

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                room_name: roomName,
                user_name: userName,
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
            console.error('[Token] Upstream Error:', response.status, errorText)
            return NextResponse.json(
                { success: false, error: { code: 'UPSTREAM_ERROR', message: `SignalWire API: ${response.status}` } },
                { status: 502 }
            )
        }

        const data = await response.json()

        // 4. Success
        return NextResponse.json({
            success: true,
            token: data.token,
            room_name: roomName,
            project_id: projectId
        })

    } catch (err: any) {
        console.error('[Token] Generation Error:', err)
        return NextResponse.json(
            { success: false, error: { code: 'TOKEN_ERROR', message: err.message || 'Failed to mint token' } },
            { status: 500 }
        )
    }
}
