/**
 * SignalWire Call Placer
 * 
 * Extracted from startCallHandler.ts to enable:
 * - Independent testing
 * - Explicit dependencies (no closures)
 * - Reusability across call flows
 * 
 * ARCH_DOCS Compliance:
 * - SYSTEM_OF_RECORD: Function is a Side Effect (API call), not data mutation
 * - SIGNALWIRE_AI_AGENTS_RESEARCH: Uses LaML POST pattern
 * - Audit logging delegated to caller via onAuditError callback
 */

import { AppError } from '@/types/app-error'
import { logger } from '@/lib/logger'
import { fetchSignalWireWithRetry } from '@/lib/utils/fetchWithRetry'
import { signalWireBreaker } from '@/lib/utils/circuitBreaker'
import { query } from '@/lib/pgClient'

// ============================================================================
// Types
// ============================================================================

/**
 * SignalWire configuration extracted from environment
 */
export interface SignalWireConfig {
    projectId: string
    token: string
    space: string
    number: string
    appUrl: string
}

/**
 * Database client interface for voice_configs queries
 * Using minimal interface to avoid tight coupling to Database
 */
export interface VoiceConfigClient {
    getCallerIdMask(organizationId: string): Promise<{
        caller_id_mask: string | null
        caller_id_verified: boolean
    } | null>

    getTranslationLanguages(organizationId: string): Promise<{
        translate_from: string | null
        translate_to: string | null
    } | null>
}

/**
 * Parameters for placing a SignalWire call
 * All dependencies are explicit - no closures
 */
export interface PlaceCallParams {
    // Required identifiers
    toNumber: string
    callId: string | null
    organizationId: string

    // Optional call configuration
    useLiveTranslation?: boolean
    /** Required if useLiveTranslation=true. Pre-validated by handler per MASTER_ARCHITECTURE. */
    translateFrom?: string
    /** Required if useLiveTranslation=true. Pre-validated by handler per MASTER_ARCHITECTURE. */
    translateTo?: string
    conference?: string
    leg?: string

    // Services (explicit dependencies)
    config: SignalWireConfig
    voiceConfigClient: VoiceConfigClient

    // Callbacks
    onAuditError: (resource: string, resourceId: string | null, payload: unknown) => Promise<void>
}

/**
 * Result of placing a SignalWire call
 */
export interface PlaceCallResult {
    success: true
    callSid: string
}

export interface PlaceCallError {
    success: false
    error: unknown
}

export type PlaceCallResponse = PlaceCallResult | PlaceCallError

// ============================================================================
// Implementation
// ============================================================================

export async function placeSignalWireCall(params: PlaceCallParams): Promise<PlaceCallResponse> {
    const {
        toNumber,
        callId,
        organizationId,
        useLiveTranslation = false,
        translateFrom,
        translateTo,
        conference,
        leg,
        config,
        voiceConfigClient,
        onAuditError,
    } = params

    logger.info('placeSignalWireCall: ENTERED function', {
        toNumber: toNumber ? '[REDACTED]' : null,
        useLiveTranslation,
        callId,
        conference: conference || 'none',
        leg: leg || 'single'
    })

    // Validate configuration
    const { projectId, token, space, number: swNumber, appUrl } = config

    if (!(projectId && token && space && swNumber)) {
        const missing = []
        if (!projectId) missing.push('SIGNALWIRE_PROJECT_ID')
        if (!token) missing.push('SIGNALWIRE_TOKEN')
        if (!space) missing.push('SIGNALWIRE_SPACE')
        if (!swNumber) missing.push('SIGNALWIRE_NUMBER')

        const e = new AppError({
            code: 'SIGNALWIRE_CONFIG_MISSING',
            message: `SignalWire credentials missing: ${missing.join(', ')}`,
            user_message: 'System configuration error - please contact support',
            severity: 'CRITICAL',
            retriable: false
        })
        await onAuditError('systems', null, e.toJSON())
        logger.error('CRITICAL: SignalWire config missing', undefined, { missing: missing.join(', ') })
        throw e
    }

    const auth = Buffer.from(`${projectId}:${token}`).toString('base64')
    const urlParams = new URLSearchParams()

    // Check for caller ID mask (custom display number)
    let fromNumber = swNumber
    try {
        const callerIdData = await voiceConfigClient.getCallerIdMask(organizationId)
        const callerIdMask = callerIdData?.caller_id_mask
        const isVerified = callerIdData?.caller_id_verified

        // Only use mask if it's set and verified (or if it's a SignalWire number)
        if (callerIdMask && (isVerified || callerIdMask.startsWith('+1'))) {
            fromNumber = callerIdMask
            logger.info('placeSignalWireCall: using caller ID mask', {
                fromNumber,
                original: swNumber,
                masked: true,
                verified: isVerified
            })
        }
    } catch (e) {
        // Best effort - continue with default number
        logger.warn('placeSignalWireCall: failed to fetch caller ID mask', e as Error)
    }

    urlParams.append('From', fromNumber)
    urlParams.append('To', toNumber)


    // Early return if callId is missing
    if (!callId) {
        const e = new AppError({
            code: 'CALL_ID_REQUIRED',
            message: 'callId is required for all outbound calls',
            user_message: 'Call configuration error',
            severity: 'CRITICAL'
        })
        await onAuditError('calls', null, e.toJSON())
        return { success: false, error: e.toJSON() }
    }

    // Strictly validate translation params if live translation is requested
    if (useLiveTranslation) {
        if (!translateFrom || !translateTo) {
            const e = new AppError({
                code: 'TRANSLATION_PARAMS_MISSING',
                message: 'translateFrom and translateTo required when useLiveTranslation=true',
                user_message: 'Invalid call configuration',
                severity: 'HIGH',
                retriable: false
            })
            await onAuditError('calls', callId, e.toJSON())
            return { success: false, error: e.toJSON() }
        }
    }

    // Build SWML URL once, completely
    let swmlUrl = `${appUrl}/api/voice/swml/outbound?callId=${encodeURIComponent(callId)}&orgId=${encodeURIComponent(organizationId)}`

    // Translation parameters
    if (useLiveTranslation && translateFrom && translateTo) {
        swmlUrl += `&from=${encodeURIComponent(translateFrom)}&to=${encodeURIComponent(translateTo)}`
    }

    // Conference parameters for bridge calls
    if (conference) {
        swmlUrl += `&conference=${encodeURIComponent(conference)}`
        if (leg) {
            swmlUrl += `&leg=${encodeURIComponent(leg)}`
        }
    }

    urlParams.append('Url', swmlUrl)

    logger.info('placeSignalWireCall: routing to SWML endpoint', {
        callId,
        organizationId,
        useLiveTranslation,
        translateFrom,
        translateTo,
        conference,
        leg,
        swmlUrl
    })

    // Status callback URLs
    const callIdQueryParam = callId ? `?callId=${encodeURIComponent(callId)}` : ''
    urlParams.append('StatusCallback', `${appUrl}/api/webhooks/signalwire${callIdQueryParam}`)

    // Enable recording at REST API level for ALL calls
    urlParams.append('Record', 'true')
    urlParams.append('RecordingStatusCallback', `${appUrl}/api/webhooks/signalwire${callIdQueryParam}`)
    urlParams.append('RecordingStatusCallbackEvent', 'completed')

    logger.info('placeSignalWireCall: RECORDING ENABLED', {
        Record: 'true',
        RecordingStatusCallback: `${appUrl}/api/webhooks/signalwire`,
        isConferenceCall: !!conference
    })

    const swEndpoint = `https://${space}.signalwire.com/api/laml/2010-04-01/Accounts/${projectId}/Calls.json`

    // Log parameters for debugging (redacted)
    logger.debug('placeSignalWireCall: FULL REST API REQUEST', {
        endpoint: swEndpoint,
        to: toNumber ? '[REDACTED]' : null,
        from: swNumber ? '[REDACTED]' : null,
        hasRecord: urlParams.has('Record'),
        recordValue: urlParams.get('Record'),
        hasRecordingCallback: urlParams.has('RecordingStatusCallback'),
        urlCallback: urlParams.get('Url'),
        statusCallback: urlParams.get('StatusCallback')
    })

    // Execute SignalWire API call with circuit breaker and retry
    let swRes
    try {
        swRes = await signalWireBreaker.execute(async () => {
            return await fetchSignalWireWithRetry(swEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: urlParams
            })
        })
    } catch (fetchErr: any) {
        if (fetchErr instanceof AppError) {
            await onAuditError('calls', callId, fetchErr.toJSON())
            throw fetchErr
        }

        logger.error('placeSignalWireCall: SignalWire fetch error', fetchErr, {
            error: fetchErr?.message ?? String(fetchErr)
        })
        const e = new AppError({
            code: 'SIGNALWIRE_FETCH_FAILED',
            message: 'Failed to reach SignalWire',
            user_message: 'Failed to place call via carrier',
            severity: 'HIGH',
            retriable: true,
            details: { cause: fetchErr?.message ?? String(fetchErr) }
        })
        await onAuditError('calls', callId, e.toJSON())
        throw e
    }

    if (!swRes.ok) {
        const text = await swRes.text()
        logger.error('placeSignalWireCall: SignalWire POST failed', undefined, {
            status: swRes.status,
            body: text
        })
        const e = new AppError({
            code: 'SIGNALWIRE_API_ERROR',
            message: `SignalWire Error: ${swRes.status}`,
            user_message: 'Failed to place call via carrier',
            severity: 'HIGH',
            retriable: true,
            details: { provider_error: text }
        })
        await onAuditError('calls', callId, e.toJSON())
        throw e
    }

    let swData
    try {
        swData = await swRes.json()
    } catch (parseErr) {
        logger.error('placeSignalWireCall: Failed to parse SignalWire JSON response', parseErr, {
            status: swRes.status,
            contentType: swRes.headers.get('content-type')
        })
        const e = new AppError({
            code: 'SIGNALWIRE_RESPONSE_PARSE_FAILED',
            message: 'Invalid response from SignalWire',
            user_message: 'Failed to place call - carrier response error',
            severity: 'HIGH',
            retriable: true
        })
        await onAuditError('calls', callId, e.toJSON())
        throw e
    }

    logger.info('placeSignalWireCall: SignalWire responded', {
        callSid: swData?.sid ? '[REDACTED_SID]' : null
    })

    const callSid = swData?.sid ?? null

    if (!callSid) {
        return { success: false, error: { message: 'No call SID returned from SignalWire' } }
    }

    return { success: true, callSid }
}

// ============================================================================
// Helper: Extract SignalWire config from environment
// ============================================================================

export function extractSignalWireConfig(env: Record<string, string | undefined>): SignalWireConfig | null {
    const rawSpace = String(env.SIGNALWIRE_SPACE || '')
    const space = rawSpace
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .replace(/\.signalwire\.com$/i, '')
        .trim()

    const projectId = env.SIGNALWIRE_PROJECT_ID
    const token = env.SIGNALWIRE_TOKEN || env.SIGNALWIRE_API_TOKEN
    const number = env.SIGNALWIRE_NUMBER
    const appUrl = env.NEXT_PUBLIC_APP_URL

    if (!projectId || !token || !space || !number || !appUrl) {
        return null
    }

    return { projectId, token, space, number, appUrl }
}

// ============================================================================
// Helper: Create VoiceConfigClient
// ============================================================================

/**
 * Create a VoiceConfigClient adapter using pgClient
 */
export function createVoiceConfigClient(): VoiceConfigClient {
    return {
        async getCallerIdMask(organizationId: string) {
            const { rows } = await query(
                `SELECT caller_id_mask, caller_id_verified FROM voice_configs WHERE organization_id = $1 LIMIT 1`,
                [organizationId]
            )

            return rows?.[0] || null
        },

        async getTranslationLanguages(organizationId: string) {
            const { rows } = await query(
                `SELECT translate_from, translate_to FROM voice_configs WHERE organization_id = $1 LIMIT 1`,
                [organizationId]
            )

            return rows?.[0] || null
        }
    }
}
