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

        // Check if live translation is enabled
        const { data: voiceConfig } = await supabaseAdmin
            .from('voice_configs')
            .select('live_translate, translate_from, translate_to')
            .eq('organization_id', member.organization_id)
            .single()

        const translationEnabled = voiceConfig?.live_translate === true &&
            voiceConfig?.translate_from &&
            voiceConfig?.translate_to

        logger.info('[Bridge] Creating bridge call', {
            callId,
            fromNumber,
            toNumber,
            translationEnabled,
            languages: translationEnabled ? `${voiceConfig.translate_from} → ${voiceConfig.translate_to}` : 'none'
        })

        // Step 1: Dial the first leg (typically agent/operator)
        // When answered, it will fetch TwiML that dials the second leg
        const endpoint = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls.json`
        const authString = Buffer.from(`${projectId}:${apiToken}`).toString('base64')

        // SWML endpoint for conference bridge with translation
        // live_translate requires SWML (JSON), not LAML (XML)
        const conferenceName = `bridge-${callId}`
        const swmlUrl = `${appUrl}/api/voice/swml/bridge?callId=${callId}&conferenceName=${encodeURIComponent(conferenceName)}&leg=first`

        logger.info('[Bridge] Using SWML for translation support', { swmlUrl })

        // Dial first number (fromNumber) - SignalWire will fetch SWML from our endpoint
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                From: callerIdToUse,
                To: fromNumber,
                Url: swmlUrl  // Use Url instead of Twiml for SWML
            }).toString()
        })

        if (!response.ok) {
            const errorText = await response.text()
            logger.error('[Bridge] SignalWire Error (first leg)', { status: response.status, error: errorText })

            await supabaseAdmin.from('calls').update({ status: 'failed' }).eq('id', callId)

            return NextResponse.json(
                { success: false, error: { code: 'SIGNALWIRE_ERROR', message: `Bridge failed: ${response.status}` } },
                { status: 502 }
            )
        }

        const firstLegData = await response.json()

        // Now dial second number (toNumber) into the same conference
        const swmlUrl2 = `${appUrl}/api/voice/swml/bridge?callId=${callId}&conferenceName=${encodeURIComponent(conferenceName)}&leg=second`

        logger.info('[Bridge] Dialing second leg with SWML', { swmlUrl: swmlUrl2 })

        const response2 = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                From: callerIdToUse,
                To: toNumber,
                Url: swmlUrl2
            }).toString()
        })

        if (!response2.ok) {
            const errorText = await response2.text()
            logger.error('[Bridge] SignalWire Error (second leg)', { status: response2.status, error: errorText })
            // First leg is already connected, log but don't fail the whole bridge
            logger.warn('[Bridge] Second leg failed but first leg connected', { callId })
        }

        const secondLegData = await response2.json()

        // Update call record with first leg SID
        await supabaseAdmin.from('calls').update({
            status: 'in-progress',
            call_sid: firstLegData.sid,
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
            after: {
                from: fromNumber,
                to: toNumber,
                first_leg_sid: firstLegData.sid,
                second_leg_sid: secondLegData.sid,
                conference: conferenceName
            }
        })

        logger.info('[Bridge] Both legs initiated', {
            callId,
            firstLegSid: firstLegData.sid,
            secondLegSid: secondLegData.sid,
            conference: conferenceName
        })

        return NextResponse.json({
            success: true,
            callId,
            firstLegSid: firstLegData.sid,
            secondLegSid: secondLegData.sid,
            conference: conferenceName,
            message: 'Bridge call initiated - both parties will be connected in conference'
        })

    } catch (err: any) {
        logger.error('[Bridge] Internal error', err)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: err.message } },
            { status: 500 }
        )
    }
}
