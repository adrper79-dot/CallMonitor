import { NextResponse, NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webrtc/dial
 * Server-assisted dialing for WebRTC calls
 * 
 * Note: With SIP.js implementation, the browser sends SIP INVITE directly.
 * This endpoint exists for:
 * 1. Logging/tracking calls on the server
 * 2. Future server-assisted dial scenarios
 * 3. Backward compatibility
 * 
 * For direct browser-to-PSTN, the SIP.js UserAgent handles the INVITE.
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

        const body = await request.json()
        const { phoneNumber, sessionId } = body

        if (!phoneNumber) {
            return NextResponse.json(
                { success: false, error: { code: 'MISSING_PARAMS', message: 'phoneNumber required' } },
                { status: 400 }
            )
        }

        // Get user's organization
        const { data: member } = await supabaseAdmin
            .from('org_members')
            .select('organization_id, role')
            .eq('user_id', userId)
            .single()

        if (!member) {
            return NextResponse.json(
                { success: false, error: { code: 'ACCESS_DENIED', message: 'Organization not found' } },
                { status: 403 }
            )
        }

        // Create call record for tracking
        const { v4: uuidv4 } = await import('uuid')
        const callId = uuidv4()

        await supabaseAdmin.from('calls').insert({
            id: callId,
            organization_id: member.organization_id,
            created_by: userId,
            status: 'initiating'
        })

        // Update WebRTC session if provided
        if (sessionId) {
            await supabaseAdmin
                .from('webrtc_sessions')
                .update({
                    call_id: callId,
                    status: 'on_call'
                })
                .eq('id', sessionId)
        }

        logger.info('[WebRTC Dial] Call logged', { callId, phoneNumber, sessionId })

        // With SIP.js, the actual INVITE is sent by the browser.
        // This endpoint just logs and returns the call ID for tracking.
        return NextResponse.json({
            success: true,
            callId,
            message: 'Call logged. SIP INVITE sent by browser.'
        })

    } catch (err: any) {
        logger.error('[WebRTC Dial] Error', err)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: err.message } },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/webrtc/dial
 * End a WebRTC call (cleanup)
 */
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const userId = (session?.user as any)?.id

        if (!userId) {
            return NextResponse.json({ success: true })
        }

        const { searchParams } = new URL(request.url)
        const callId = searchParams.get('callId')

        if (callId) {
            await supabaseAdmin
                .from('calls')
                .update({
                    status: 'completed',
                    ended_at: new Date().toISOString()
                })
                .eq('id', callId)
                .eq('created_by', userId)
        }

        logger.info('[WebRTC Dial] Call ended', { callId })

        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ success: true })
    }
}
