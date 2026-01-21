import { NextResponse, NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webrtc/token
 * Generate a SignalWire JWT Token for the WebRTC Client
 * Replaces direct SIP Credentials.
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Authenticate user via NextAuth
        const session = await getServerSession(authOptions)
        const userId = (session?.user as any)?.id

        if (!userId) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
                { status: 401 }
            )
        }

        // 2. Validate Credentials
        const projectId = process.env.SIGNALWIRE_PROJECT_ID
        const apiToken = process.env.SIGNALWIRE_TOKEN // Correct env name
        const spaceUrl = process.env.SIGNALWIRE_SPACE?.replace('https://', '').replace(/\/$/, '') // Correct env name

        if (!projectId || !apiToken || !spaceUrl) {
            logger.error('SignalWire credentials missing for Token generation', {
                hasProject: !!projectId,
                hasToken: !!apiToken,
                hasSpace: !!spaceUrl
            })
            return NextResponse.json(
                { success: false, error: { code: 'CONFIG_ERROR', message: 'SignalWire credentials missing' } },
                { status: 500 }
            )
        }

        // 3. Request Token from SignalWire REST API
        // Using Relay REST endpoint to mint a JWT
        const authString = Buffer.from(`${projectId}:${apiToken}`).toString('base64')

        // Attempt to mint a 'video' type token which is often used for Unified SDK / WebRTC
        const endpoint = `https://${spaceUrl}/api/relay/rest/jwt`

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                resource: `user-${userId}`, // Unique resource for the user
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            logger.error('Failed to mint SignalWire Token', { status: response.status, error: errorText })
            return NextResponse.json(
                { success: false, error: { code: 'UPSTREAM_ERROR', message: 'Failed to generate token' } },
                { status: 502 }
            )
        }

        const data = await response.json()
        // data should contain { jwt_token: '...' }

        return NextResponse.json({
            success: true,
            token: data.jwt_token,
            project_id: projectId
        })

    } catch (err) {
        logger.error('Token generation handler error', err)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal error' } },
            { status: 500 }
        )
    }
}
