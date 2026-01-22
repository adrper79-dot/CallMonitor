import { NextResponse, NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webrtc/dial
 * Server-Side Dial for WebRTC → PSTN
 * 
 * Architecture:
 * 1. Browser is connected via SIP.js to SignalWire SIP endpoint (web-rtc01)
 * 2. This endpoint uses REST API to dial PSTN number
 * 3. When PSTN answers, we bridge audio back to the SIP endpoint
 * 
 * This is necessary because SIP endpoint doesn't have a PSTN dial plan.
 * Uses SWML (SignalWire Markup Language) via Url for call control.
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

        // SignalWire config
        const projectId = process.env.SIGNALWIRE_PROJECT_ID
        const apiToken = process.env.SIGNALWIRE_TOKEN
        const spaceUrl = process.env.SIGNALWIRE_SPACE?.replace('https://', '').replace(/\/$/, '')
        const callerId = process.env.SIGNALWIRE_NUMBER || '+12027711933'
        const sipDomain = process.env.SIGNALWIRE_SIP_DOMAIN || 'blackkryptonians-589c9fd2c624.sip.signalwire.com'
        const sipUsername = process.env.SIGNALWIRE_SIP_USERNAME || 'web-rtc01'

        if (!projectId || !apiToken || !spaceUrl) {
            logger.error('[WebRTC Dial] SignalWire config missing')
            return NextResponse.json(
                { success: false, error: { code: 'CONFIG_ERROR', message: 'Telephony not configured' } },
                { status: 500 }
            )
        }

        // Create call record
        const { v4: uuidv4 } = await import('uuid')
        const callId = uuidv4()

        await supabaseAdmin.from('calls').insert({
            id: callId,
            organization_id: member.organization_id,
            created_by: userId,
            status: 'initiating',
            caller_id_used: callerId
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


        logger.info('[WebRTC Dial] Initiating PSTN call', { callId, phoneNumber, sipUsername })

        // Format and validate phone number
        const cleanNumber = phoneNumber.replace(/\D/g, '')
        const formattedNumber = cleanNumber.startsWith('1') ? `+${cleanNumber}` : `+1${cleanNumber}`
        if (!formattedNumber.match(/^\+\d{10,15}$/)) {
            logger.error('[WebRTC Dial] Invalid phone number format', { phoneNumber, formattedNumber })
            return NextResponse.json(
                { success: false, error: { code: 'INVALID_PHONE', message: 'Invalid phone number format' } },
                { status: 400 }
            )
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://voxsouth.online'

        // SWML endpoint for outbound PSTN dial + SIP bridge
        const swmlUrl = `${appUrl}/api/voice/swml/dial?callId=${callId}&phoneNumber=${encodeURIComponent(formattedNumber)}&sessionId=${sessionId || ''}`

        const endpoint = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls.json`
        const authString = Buffer.from(`${projectId}:${apiToken}`).toString('base64')

        const requestBody = {
            From: callerId,
            To: formattedNumber,
            Url: swmlUrl,
            MachineDetection: 'Enable',
            MachineDetectionTimeout: '5',
            AsyncAmd: 'true',
        }

        logger.info('[WebRTC Dial] Sending outbound request', { requestBody })

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(requestBody).toString()
        })


        if (!response.ok) {
            const errorText = await response.text()
            let parsedError = {};
            try { parsedError = JSON.parse(errorText || '{}'); } catch {}
            if ((parsedError as any).code === '21211') {
                logger.error('[WebRTC Dial] Missing To parameter', { requestBody });
            }
            logger.error('[WebRTC Dial] SignalWire Error', { status: response.status, error: errorText, requestBody })

            await supabaseAdmin.from('calls').update({ status: 'failed' }).eq('id', callId)

            return NextResponse.json(
                { success: false, error: { code: 'SIGNALWIRE_ERROR', message: `Dial failed: ${response.status}`, details: parsedError } },
                { status: 502 }
            )
        }

        const data = await response.json()

        // Update call record
        await supabaseAdmin.from('calls').update({
            status: 'in-progress',
            call_sid: data.sid,
            started_at: new Date().toISOString()
        }).eq('id', callId)

        logger.info('[WebRTC Dial] PSTN call initiated', { callId, callSid: data.sid })

        return NextResponse.json({
            success: true,
            callId,
            callSid: data.sid,
            message: 'Dialing PSTN, will connect to your browser when answered'
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
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
                { status: 401 }
            )
        }

        const { searchParams } = new URL(request.url)
        const callId = searchParams.get('callId')

        if (!callId) {
            return NextResponse.json(
                { success: false, error: { code: 'MISSING_PARAMS', message: 'callId required' } },
                { status: 400 }
            )
        }

        const { error: updateError } = await supabaseAdmin
            .from('calls')
            .update({
                status: 'completed',
                ended_at: new Date().toISOString()
            })
            .eq('id', callId)
            .eq('created_by', userId)

        if (updateError) {
            logger.error('[WebRTC Dial] Failed to end call', { callId, error: updateError })
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: 'Failed to end call' } },
                { status: 500 }
            )
        }

        logger.info('[WebRTC Dial] Call ended', { callId })

        return NextResponse.json({ success: true })
    } catch (err: any) {
        logger.error('[WebRTC Dial] DELETE error', err)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: err.message } },
            { status: 500 }
        )
    }
}
