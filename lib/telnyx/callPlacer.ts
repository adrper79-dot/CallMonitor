/**
 * Telnyx Call Placer (Phase 7: FINAL_STACK Migration)
 * 
 * Mirrors SignalWire/callPlacer.ts for drop-in replacement.
 * Telnyx CPaaS: REST Calls API + Webhook orchestration.
 * Media fork for realtime AssemblyAI (browser WebRTC or PSTN).
 * 
 * ARCH_DOCS Compliance:
 * - Call-rooted: callId mandatory.
 * - Graceful: Circuit breaker + retry.
 * - Recording: Enabled via record=true.
 * - Realtime: Webhook for stream start → AssemblyAI WS.
 * 
 * Diff from SignalWire:
 * - API: /v2/calls (API key auth).
 * - Webhooks: Standard events (call.initiated, stream.started).
 * - No LaML - use webhooks for orchestration.
 */

import { AppError } from '@/types/app-error'
import { logger } from '@/lib/logger'
import { fetchWithRetry } from '@/lib/utils/fetchWithRetry'
import { telnyxBreaker } from '@/lib/utils/circuitBreaker'
import { query } from '@/lib/pgClient' // Neon client

export interface TelnyxConfig {
    apiKey: string
    number: string // Outbound DIDs
    appUrl: string
}

export interface VoiceConfigClient {
    getCallerIdMask(organizationId: string): Promise<{ caller_id_mask: string | null; caller_id_verified: boolean } | null>
}

export interface PlaceCallParams {
    toNumber: string
    callId: string
    organizationId: string
    config: TelnyxConfig
    voiceConfigClient: VoiceConfigClient
    onAuditError: (resource: string, resourceId: string | null, payload: unknown) => Promise<void>
    useLiveTranslation?: boolean
    translateFrom?: string
    translateTo?: string
}

export interface PlaceCallResult {
    success: true
    callId: string // Telnyx call_control_id
}

export type PlaceCallResponse = PlaceCallResult | { success: false; error: unknown }

export async function placeTelnyxCall(params: PlaceCallParams): Promise<PlaceCallResponse> {
    const { toNumber, callId, organizationId, config, voiceConfigClient, onAuditError } = params

    logger.info('placeTelnyxCall ENTER', { toNumber: '[REDACTED]', callId, organizationId })

    const { apiKey, number: txNumber, appUrl } = config

    if (!apiKey || !txNumber || !appUrl) {
        const e = new AppError({
            code: 'TELNYX_CONFIG_MISSING',
            message: 'Telnyx credentials missing',
            severity: 'CRITICAL'
        })
        await onAuditError('calls', callId, e.toJSON())
        throw e
    }

    // Caller ID mask
    let fromNumber = txNumber
    const callerIdData = await voiceConfigClient.getCallerIdMask(organizationId)
    if (callerIdData?.caller_id_mask && callerIdData.caller_id_verified) {
        fromNumber = callerIdData.caller_id_mask
    }

    // Telnyx Call Control webhook URL (orchestration)
    const webhookUrl = `${appUrl}/api/webhooks/telnyx?callId=${callId}&orgId=${organizationId}`

    const payload = {
        connection_id: crypto.randomUUID(), // Unique for realtime media
        from: fromNumber,
        to: toNumber,
        webhook_url: webhookUrl,
        record: true, // Always record (FINAL_STACK compliance)
        recording_status_webhook_url: webhookUrl,
        // Realtime translation params (Phase 7)
        custom_headers: {
            'X-Call-ID': callId,
            'X-Org-ID': organizationId,
            ...(params.useLiveTranslation && { 
                'X-Translate-From': params.translateFrom,
                'X-Translate-To': params.translateTo 
            })
        }
    }

    const endpoint = 'https://api.telnyx.com/v2/call_control'

    let res
    try {
        res = await telnyxBreaker.execute(async () => {
            return await fetchWithRetry(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Telnyx-Version': 'V2'
                },
                body: JSON.stringify(payload)
            })
        })
    } catch (e) {
        const err = new AppError({ code: 'TELNYX_FETCH_FAILED', message: 'Telnyx API error', details: e })
        await onAuditError('calls', callId, err.toJSON())
        throw err
    }

    if (!res.ok) {
        const text = await res.text()
        const e = new AppError({
            code: 'TELNYX_API_ERROR',
            message: `Telnyx ${res.status}`,
            details: { body: text }
        })
        await onAuditError('calls', callId, e.toJSON())
        throw e
    }

    const data = await res.json()
    const txCallId = data.data?.[0]?.id // call_control_id

    if (!txCallId) {
        return { success: false, error: 'No call ID from Telnyx' }
    }

    logger.info('placeTelnyxCall SUCCESS', { txCallId: '[REDACTED]', callId })

    return { success: true, callId: txCallId }
}

export function extractTelnyxConfig(env: Record<string, string | undefined>): TelnyxConfig | null {
    const apiKey = env.TELNYX_API_KEY
    const number = env.TELNYX_NUMBER
    const appUrl = env.NEXT_PUBLIC_APP_URL

    if (!apiKey || !number || !appUrl) return null

    return { apiKey, number, appUrl }
}

export function createVoiceConfigClient(): VoiceConfigClient {
    return {
        async getCallerIdMask(orgId: string) {
            const { rows } = await query('SELECT caller_id_mask, caller_id_verified FROM voice_configs WHERE organization_id = $1 LIMIT 1', [orgId])
            return rows[0] || null
        }
    }
}
