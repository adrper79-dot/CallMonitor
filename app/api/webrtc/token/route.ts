import { NextResponse, NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webrtc/token
 * Generate a SignalWire Relay V3 JWT
 * 
 * Required for Voice.Client (PSTN Calling).
 * Replaces Video Room Tokens logic as we pivot to Voice-First architecture.
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

        // Relay V3 JWT Endpoint
        const endpoint = `https://${spaceUrl}/api/relay/rest/jwt`

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                resource: `user-${userId}`, // Unique resource ID for this user's client
                expires_in: 3600 // 1 hour
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            logger.error('Failed to mint Relay JWT', { status: response.status, error: errorText })
            return NextResponse.json(
                { success: false, error: { code: 'TOKEN_ERROR', message: 'Failed to mint token' } },
                { status: 502 }
            )
        }

        const data = await response.json()

        return NextResponse.json({
            success: true,
            token: data.jwt_token, // Relay V3 returns 'jwt_token'
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
