/**
 * WebRTC Browser-to-PSTN Call API
 * 
 * Purpose: Initiate browser-to-PSTN calls via Voice API conference bridging
 * Architecture: Creates a SignalWire conference room and bridges both:
 *   1. Browser WebRTC client (subscriber)
 *   2. PSTN destination number
 * 
 * Per AI Role Policy (AI_ROLE_POLICY.md):
 * - This is system infrastructure (not AI speaking commitments)
 * - Humans initiate calls, system bridges them
 * - All audit logging and tracking per standards
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'
import { AppError } from '@/types/app-error'

export const dynamic = 'force-dynamic'

const E164_REGEX = /^\+?[1-9]\d{1,14}$/

interface WebRTCCallRequest {
    destination: string  // E.164 phone number
    subscriber_id: string  // SignalWire Fabric subscriber ID
}

/**
 * POST /api/voice/webrtc-call
 * Initiate a browser-to-PSTN call via conference bridging
 */
export async function POST(request: NextRequest) {
    const callId = uuidv4()
    let userId: string | null = null
    let organizationId: string | null = null

    try {
        // 1. Authenticate user
        const session = await getServerSession(authOptions)
        userId = (session?.user as any)?.id

        if (!userId) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
                { status: 401 }
            )
        }

        // 2. Parse and validate request
        const body: WebRTCCallRequest = await request.json()
        const { destination, subscriber_id } = body

        if (!destination || !subscriber_id) {
            return NextResponse.json(
                { success: false, error: { code: 'INVALID_REQUEST', message: 'destination and subscriber_id required' } },
                { status: 400 }
            )
        }

        // Validate E.164 format
        if (!E164_REGEX.test(destination)) {
            return NextResponse.json(
                { success: false, error: { code: 'INVALID_PHONE_NUMBER', message: 'Destination must be valid E.164 format' } },
                { status: 400 }
            )
        }

        // 3. Get user's organization
        const { data: member, error: memberError } = await supabaseAdmin
            .from('org_members')
            .select('organization_id')
            .eq('user_id', userId)
            .single()

        if (memberError || !member) {
            logger.error('[webrtc-call] User not in organization', { userId, error: memberError })
            return NextResponse.json(
                { success: false, error: { code: 'NO_ORGANIZATION', message: 'User must belong to an organization' } },
                { status: 403 }
            )
        }

        organizationId = member.organization_id

        // 4. Get SignalWire credentials
        const swProject = process.env.SIGNALWIRE_PROJECT_ID
        const swToken = process.env.SIGNALWIRE_TOKEN
        const swSpace = process.env.SIGNALWIRE_SPACE
        const swNumber = process.env.SIGNALWIRE_NUMBER
        const appUrl = process.env.NEXT_PUBLIC_APP_URL

        if (!swProject || !swToken || !swSpace || !swNumber || !appUrl) {
            logger.error('[webrtc-call] SignalWire config missing', null)
            return NextResponse.json(
                { success: false, error: { code: 'CONFIG_ERROR', message: 'System configuration error' } },
                { status: 500 }
            )
        }

        // Normalize space name
        const spaceName = swSpace.replace(/^https?:\/\//, '').replace(/\.signalwire\.com.*$/, '').trim()
        const signalwireDomain = `${spaceName}.signalwire.com`

        // 5. Create conference ID
        const conferenceId = `webrtc-${callId.substring(0, 8)}`

        // 6. Create call record in database
        const { data: dbCall, error: callError } = await supabaseAdmin
            .from('calls')
            .insert({
                id: callId,
                organization_id: organizationId,
                phone_number: destination,
                from_number: swNumber,
                status: 'initiating',
                flow_type: 'webrtc_conference',
                created_at: new Date().toISOString()
            })
            .select()
            .single()

        if (callError) {
            logger.error('[webrtc-call] Failed to create call record', callError, { callId })
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: 'Failed to create call record' } },
                { status: 500 }
            )
        }

        // 7. Dial browser client into conference
        const auth = Buffer.from(`${swProject}:${swToken}`).toString('base64')

        const browserCallParams = new URLSearchParams({
            From: swNumber,
            To: `client:${subscriber_id}`,  // Fabric subscriber addressing
            Url: `${appUrl}/api/voice/laml/webrtc-conference?conferenceId=${conferenceId}&leg=browser`,
            StatusCallback: `${appUrl}/api/webhooks/signalwire?callId=${callId}&leg=browser`
        })

        logger.info('[webrtc-call] Dialing browser client', {
            callId,
            conferenceId,
            subscriberId: subscriber_id
        })

        const browserCallResponse = await fetch(
            `https://${signalwireDomain}/api/laml/2010-04-01/Accounts/${swProject}/Calls`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: browserCallParams.toString()
            }
        )

        if (!browserCallResponse.ok) {
            const errorText = await browserCallResponse.text()
            logger.error('[webrtc-call] Failed to dial browser client', null, {
                status: browserCallResponse.status,
                error: errorText
            })
            throw new AppError({
                code: 'SIGNALWIRE_ERROR',
                message: 'Failed to dial browser client',
                user_message: 'Failed to connect to browser',
                severity: 'HIGH'
            })
        }

        const browserCallData = await browserCallResponse.json()
        const browserCallSid = browserCallData.sid

        // 8. Dial PSTN number into same conference
        const pstnCallParams = new URLSearchParams({
            From: swNumber,
            To: destination,
            Url: `${appUrl}/api/voice/laml/webrtc-conference?conferenceId=${conferenceId}&leg=pstn`,
            StatusCallback: `${appUrl}/api/webhooks/signalwire?callId=${callId}&leg=pstn`
        })

        logger.info('[webrtc-call] Dialing PSTN number', {
            callId,
            conferenceId,
            destination: destination.substring(0, 5) + '...'  // Redact for privacy
        })

        const pstnCallResponse = await fetch(
            `https://${signalwireDomain}/api/laml/2010-04-01/Accounts/${swProject}/Calls`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: pstnCallParams.toString()
            }
        )

        if (!pstnCallResponse.ok) {
            const errorText = await pstnCallResponse.text()
            logger.error('[webrtc-call] Failed to dial PSTN number', null, {
                status: pstnCallResponse.status,
                error: errorText
            })
            throw new AppError({
                code: 'SIGNALWIRE_ERROR',
                message: 'Failed to dial PSTN number',
                user_message: 'Failed to connect call',
                severity: 'HIGH'
            })
        }

        const pstnCallData = await pstnCallResponse.json()
        const pstnCallSid = pstnCallData.sid

        // 9. Update call record with SIDs
        await supabaseAdmin
            .from('calls')
            .update({
                call_sid: pstnCallSid,  // Primary SID is PSTN leg
                status: 'ringing',
                updated_at: new Date().toISOString()
            })
            .eq('id', callId)

        // 10. Audit log
        await supabaseAdmin.from('audit_logs').insert({
            organization_id: organizationId,
            user_id: userId,
            resource_type: 'call',
            resource_id: callId,
            action: 'webrtc:call.initiated',
            actor_type: 'human',
            actor_label: userId,
            after: {
                call_id: callId,
                conference_id: conferenceId,
                browser_sid: browserCallSid,
                pstn_sid: pstnCallSid,
                destination
            },
            created_at: new Date().toISOString()
        })

        logger.info('[webrtc-call] Conference bridging initiated', {
            callId,
            conferenceId,
            browserCallSid: browserCallSid.substring(0, 10) + '...',
            pstnCallSid: pstnCallSid.substring(0, 10) + '...'
        })

        return NextResponse.json({
            success: true,
            call_id: callId,
            conference_id: conferenceId,
            status: 'connecting'
        }, { status: 201 })

    } catch (error: any) {
        logger.error('[webrtc-call] Error', error, { callId, userId, organizationId })

        // Audit error
        if (organizationId && userId) {
            await supabaseAdmin.from('audit_logs').insert({
                organization_id: organizationId,
                user_id: userId,
                resource_type: 'call',
                resource_id: callId,
                action: 'error',
                actor_type: 'human',
                actor_label: userId,
                after: {
                    error: error instanceof AppError ? error.toJSON() : { message: error?.message }
                },
                created_at: new Date().toISOString()
            })
        }

        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to initiate call' } },
            { status: 500 }
        )
    }
}
