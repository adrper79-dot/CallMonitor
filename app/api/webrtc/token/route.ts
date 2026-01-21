import { NextResponse, NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webrtc/token
 * Generate a SignalWire Fabric Subscriber Access Token (SAT)
 * 
 * Flow:
 * 1. Find or Create Subscriber in SignalWire Fabric
 * 2. Generate Token for Subscriber
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Authenticate
        const session = await getServerSession(authOptions)
        const userId = (session?.user as any)?.id // UUID

        if (!userId) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
                { status: 401 }
            )
        }

        // 2. Validate Env
        const projectId = process.env.SIGNALWIRE_PROJECT_ID
        const apiToken = process.env.SIGNALWIRE_TOKEN
        const spaceUrl = process.env.SIGNALWIRE_SPACE?.replace('https://', '').replace(/\/$/, '')

        if (!projectId || !apiToken || !spaceUrl) {
            logger.error('SignalWire credentials missing', { hasProject: !!projectId })
            return NextResponse.json(
                { success: false, error: { code: 'CONFIG_ERROR', message: 'SignalWire config missing' } },
                { status: 500 }
            )
        }

        const authString = Buffer.from(`${projectId}:${apiToken}`).toString('base64')
        const headers = {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json'
        }

        // 3. Find/Create Subscriber
        // We map internal UserID to SignalWire Subscriber Email
        const subscriberEmail = `${userId}@gemini.app`
        let subscriberId: string | null = null

        // A. Check for existing subscriber
        try {
            const searchRes = await fetch(`https://${spaceUrl}/api/fabric/subscribers?email=${encodeURIComponent(subscriberEmail)}`, {
                method: 'GET',
                headers
            })
            if (searchRes.ok) {
                const searchData = await searchRes.json()
                if (searchData.data && searchData.data.length > 0) {
                    subscriberId = searchData.data[0].id
                }
            }
        } catch (e) { /* ignore */ }

        // B. Create if missing
        if (!subscriberId) {
            const createRes = await fetch(`https://${spaceUrl}/api/fabric/subscribers`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    email: subscriberEmail,
                    password: 'Password123!', // Required by API? Using generic placeholder or randomized
                    display_name: `User ${userId.substring(0, 6)}`
                })
            })

            if (!createRes.ok) {
                // Maybe conflict logic failed?
                const txt = await createRes.text()
                logger.error('Failed to create subscriber', { error: txt })
                return NextResponse.json({ success: false, error: { code: 'SUB_ERROR', message: 'Failed to create subscriber' } }, { status: 502 })
            }
            const createData = await createRes.json()
            subscriberId = createData.id
        }

        if (!subscriberId) {
            throw new Error('Could not resolve Subscriber ID')
        }

        // 4. Generate SAT (Subscriber Access Token)
        const tokenRes = await fetch(`https://${spaceUrl}/api/fabric/subscribers/${subscriberId}/tokens`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                some_param: 'if_needed' // Usually empty body works or default
            })
        })

        if (!tokenRes.ok) {
            const txt = await tokenRes.text()
            logger.error('Failed to mint SAT', { error: txt })
            return NextResponse.json({ success: false, error: { code: 'SAT_ERROR', message: 'Failed to mint token' } }, { status: 502 })
        }

        const tokenData = await tokenRes.json()
        // Returns { token: '...' }

        return NextResponse.json({
            success: true,
            token: tokenData.token, // This is the SAT
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
