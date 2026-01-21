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
 * We use LAML to dial PSTN and connect to the SIP user.
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

        // Format phone number
        const cleanNumber = phoneNumber.replace(/\D/g, '')
        const formattedNumber = cleanNumber.startsWith('1') ? `+${cleanNumber}` : `+1${cleanNumber}`

        // LAML to connect PSTN call to the SIP endpoint
        // When the PSTN party answers, <Dial> connects them to the SIP user
        const bridgeTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}">
    <Sip>sip:${sipUsername}@${sipDomain}</Sip>
  </Dial>
</Response>`

        // REST API endpoint
        const endpoint = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls.json`
        const authString = Buffer.from(`${projectId}:${apiToken}`).toString('base64')

        // Dial the PSTN number, when answered connect to our SIP endpoint
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                From: callerId,
                To: formattedNumber,
                Twiml: bridgeTwiml
            }).toString()
        })

        if (!response.ok) {
            const errorText = await response.text()
            logger.error('[WebRTC Dial] SignalWire Error', { status: response.status, error: errorText })

            await supabaseAdmin.from('calls').update({ status: 'failed' }).eq('id', callId)

            return NextResponse.json(
                { success: false, error: { code: 'SIGNALWIRE_ERROR', message: `Dial failed: ${response.status}` } },
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
