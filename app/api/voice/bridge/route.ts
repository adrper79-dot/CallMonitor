import { NextResponse, NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/voice/bridge
 * Bridge two PSTN numbers together (Click-to-Call)
 * 
 * Architecture per ARCH_DOCS:
 * - SignalWire-first execution
 * - Audit logged
 * - RBAC enforced
 * 
 * Flow:
 * 1. Dial first number (typically agent)
 * 2. When answered, dial second number (customer)
 * 3. Bridge both legs into a conference
 */
export async function POST(request: NextRequest) {
    try {
        // Auth check
        const session = await getServerSession(authOptions)
        const userId = (session?.user as any)?.id

        if (!userId) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
                { status: 401 }
            )
        }

        // Get user's organization and RBAC
        const { data: member, error: memberError } = await supabaseAdmin
            .from('org_members')
            .select('organization_id, role')
            .eq('user_id', userId)
            .single()

        if (memberError || !member) {
            return NextResponse.json(
                { success: false, error: { code: 'ACCESS_DENIED', message: 'Organization membership not found' } },
                { status: 403 }
            )
        }

        // RBAC: Owner, Admin, Operator can use bridge
        if (!['owner', 'admin', 'operator'].includes(member.role)) {
            return NextResponse.json(
                { success: false, error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Insufficient permissions' } },
                { status: 403 }
            )
        }

        const body = await request.json()
        const { fromNumber, toNumber, callerId } = body

        if (!fromNumber || !toNumber) {
            return NextResponse.json(
                { success: false, error: { code: 'MISSING_PARAMS', message: 'fromNumber and toNumber required' } },
                { status: 400 }
            )
        }

        // SignalWire config
        const projectId = process.env.SIGNALWIRE_PROJECT_ID
        const apiToken = process.env.SIGNALWIRE_TOKEN
        const spaceUrl = process.env.SIGNALWIRE_SPACE?.replace('https://', '').replace(/\/$/, '')
        const defaultCallerId = process.env.SIGNALWIRE_NUMBER || '+15550100666'

        if (!projectId || !apiToken || !spaceUrl) {
            logger.error('[Bridge] SignalWire config missing')
            return NextResponse.json(
                { success: false, error: { code: 'CONFIG_ERROR', message: 'Telephony not configured' } },
                { status: 500 }
            )
        }

        const callerIdToUse = callerId || defaultCallerId
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://voxsouth.online'

        // Create call record first
        const { v4: uuidv4 } = await import('uuid')
        const callId = uuidv4()

        await supabaseAdmin.from('calls').insert({
            id: callId,
            organization_id: member.organization_id,
            created_by: userId,
            status: 'initiating',
            caller_id_used: callerIdToUse
        })

        logger.info('[Bridge] Creating bridge call', { callId, fromNumber, toNumber })

        // Step 1: Dial the first leg (typically agent/operator)
        // When answered, it will fetch TwiML that dials the second leg
        const endpoint = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls.json`
        const authString = Buffer.from(`${projectId}:${apiToken}`).toString('base64')

        // TwiML to dial second number and bridge
        const bridgeTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Connecting your call. Please wait.</Say>
  <Dial callerId="${callerIdToUse}" record="record-from-answer" recordingStatusCallback="${appUrl}/api/webhooks/signalwire">
    <Number>${toNumber}</Number>
  </Dial>
</Response>`

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                From: callerIdToUse,
                To: fromNumber,
                Twiml: bridgeTwiml
            }).toString()
        })

        if (!response.ok) {
            const errorText = await response.text()
            logger.error('[Bridge] SignalWire Error', { status: response.status, error: errorText })

            await supabaseAdmin.from('calls').update({ status: 'failed' }).eq('id', callId)

            return NextResponse.json(
                { success: false, error: { code: 'SIGNALWIRE_ERROR', message: `Bridge failed: ${response.status}` } },
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

        // Audit log
        await supabaseAdmin.from('audit_logs').insert({
            organization_id: member.organization_id,
            user_id: userId,
            resource_type: 'call',
            resource_id: callId,
            action: 'voice:bridge.initiated',
            actor_type: 'human',
            actor_label: userId,
            after: { from: fromNumber, to: toNumber, call_sid: data.sid }
        })

        logger.info('[Bridge] Call initiated', { callId, callSid: data.sid })

        return NextResponse.json({
            success: true,
            callId,
            callSid: data.sid,
            message: 'Bridge call initiated'
        })

    } catch (err: any) {
        logger.error('[Bridge] Internal error', err)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: err.message } },
            { status: 500 }
        )
    }
}
