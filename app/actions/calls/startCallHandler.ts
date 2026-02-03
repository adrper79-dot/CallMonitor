
import { v4 as uuidv4 } from 'uuid'
import { AppError } from '@/types/app-error'
import { isLiveTranslationPreviewEnabled } from '@/lib/env-validation'
import { logger } from '@/lib/logger'
import { bestEffortAuditLog, logAuditError } from '@/lib/monitoring/auditLogMonitor'
import { trackUsage, checkUsageLimits } from '@/lib/services/usageTracker'
import { CallerIdService } from '@/lib/services/callerIdService'
import {
  placeSignalWireCall as placeSignalWireCallExternal,
  extractSignalWireConfig,
  createVoiceConfigClient,
  type PlaceCallResponse
} from '@/lib/signalwire/callPlacer'
import { query } from '@/lib/pgClient'

const E164_REGEX = /^\+?[1-9]\d{1,14}$/

export type Modulations = {
  record: boolean
  transcribe: boolean
  translate?: boolean
  translate_from?: string
  translate_to?: string
  survey?: boolean
  synthetic_caller?: boolean
}

export type StartCallInput = {
  organization_id: string
  from_number?: string
  phone_number: string
  flow_type?: 'bridge' | 'outbound'
  modulations: Modulations
  actor_id?: string  // Authenticated user ID for RBAC
}

export type StartCallDeps = {
  // Deprecated: No longer needed with pgClient
  signalwireCall?: (params: { from: string; to: string; url: string; statusCallback: string }) => Promise<{ call_sid: string }>
  env?: Record<string, string | undefined>
}

type ApiResponseSuccess = { success: true; call_id: string }
type ApiResponseError = { success: false; error: unknown }
type ApiResponse = ApiResponseSuccess | ApiResponseError

export default async function startCallHandler(input: StartCallInput, deps: StartCallDeps = {}): Promise<ApiResponse> {
  const { signalwireCall, env = process.env } = deps
  let capturedActorId: string | null = null
  let capturedSystemCpidId: string | null = null
  let callId: string | null = null
  // track organization_id here so audit helpers and catch blocks
  // always reference the effective organization (after overrides)
  let organization_id: string = input.organization_id

  async function writeAuditError(resource: string, resourceId: string | null, payload: unknown) {
    // Use standardized monitored audit logging helper
    await logAuditError({
      organizationId: organization_id,
      actorId: capturedActorId,
      systemId: capturedSystemCpidId,
      resource,
      resourceId,
      payload
    })
  }

  // Adapter function: wraps extracted callPlacer with closure context
  // This maintains backward compatibility while using the extracted module
  const placeSignalWireCall = async (
    toNumber: string,
    useLiveTranslation: boolean = false,
    translateFrom?: string,
    translateTo?: string,
    conference?: string,
    leg?: string
  ): Promise<string | null> => {
    // Extract SignalWire config from environment
    const config = extractSignalWireConfig(env)

    if (!config) {
      const missing: string[] = []
      if (!env.SIGNALWIRE_PROJECT_ID) missing.push('SIGNALWIRE_PROJECT_ID')
      if (!env.SIGNALWIRE_TOKEN && !env.SIGNALWIRE_API_TOKEN) missing.push('SIGNALWIRE_TOKEN')
      if (!env.SIGNALWIRE_SPACE) missing.push('SIGNALWIRE_SPACE')
      if (!env.SIGNALWIRE_NUMBER) missing.push('SIGNALWIRE_NUMBER')
      if (!env.NEXT_PUBLIC_APP_URL) missing.push('NEXT_PUBLIC_APP_URL')

      const e = new AppError({
        code: 'SIGNALWIRE_CONFIG_MISSING',
        message: `SignalWire credentials missing: ${missing.join(', ')}`,
        user_message: 'System configuration error - please contact support',
        severity: 'CRITICAL',
        retriable: false
      })
      await writeAuditError('systems', null, e.toJSON())
      logger.error('CRITICAL: SignalWire config missing', undefined, { missing: missing.join(', ') })
      throw e
    }

    // Create voice config client (now using pgClient internally)
    const voiceConfigClient = createVoiceConfigClient()

    // Call extracted function with explicit parameters
    const result: PlaceCallResponse = await placeSignalWireCallExternal({
      toNumber,
      callId,
      organizationId: organization_id,
      useLiveTranslation,
      translateFrom,
      translateTo,
      conference,
      leg,
      config,
      voiceConfigClient,
      onAuditError: writeAuditError
    })

    if (result.success) {
      return result.callSid
    } else {
      // For backward compatibility, return null on non-throwing errors
      return null
    }
  }

  try {
    let { from_number, phone_number, flow_type, modulations } = input
    organization_id = input.organization_id

    // lightweight tracing for debugging call placement (avoid logging secrets)
    // Logs: organization and phone to help trace attempts in runtime logs
    // DO NOT log credentials or provider tokens
    logger.info('startCallHandler: initiating call', { organization_id, from_number: '[REDACTED]', phone_number: '[REDACTED]', flow_type, modulations })

    // actor/session lookup
    // Note: Session lookup removed - actorId must be provided in input or handled by caller
    let actorId = input.actor_id ?? null
    capturedActorId = actorId
    if (!actorId) {
      // allow a developer/testing fallback actor in non-production using the
      // provided UUID to exercise flows without a real session.
      if (env.NODE_ENV !== 'production') {
        actorId = '28d68e05-ab20-40ee-b935-b19e8927ae68'
        capturedActorId = actorId
        logger.warn('startCallHandler: using dev fallback actorId', { actorId })
      } else {
        const err = new AppError({ code: 'AUTH_REQUIRED', message: 'Unauthenticated', user_message: 'Authentication required', severity: 'HIGH', retriable: false })
        await writeAuditError('organizations', null, err.toJSON())
        throw err
      }
    }

    // basic org id guard
    if (!/^[0-9a-fA-F-]{36}$/.test(organization_id)) {
      const err = new AppError({ code: 'CALL_START_INVALID_ORG', message: 'Invalid organization id', user_message: 'Invalid organization identifier', severity: 'MEDIUM', retriable: false })
      await writeAuditError('organizations', null, err.toJSON())
      throw err
    }

    // organization lookup
    let org: any = null
    try {
      const { rows } = await query(
        `SELECT id, plan, tool_id FROM organizations WHERE id = $1 LIMIT 1`,
        [organization_id]
      )
      org = rows[0]
    } catch (orgErr: any) {
      const err = new AppError({ code: 'CALL_START_DB_ORG_LOOKUP', message: 'Organization lookup failed', user_message: 'Unable to verify organization.', severity: 'HIGH', retriable: true, details: { cause: orgErr.message } })
      await writeAuditError('organizations', null, err.toJSON())
      throw err
    }

    if (!org) {
      const err = new AppError({ code: 'CALL_START_ORG_NOT_FOUND', message: 'Organization not found', user_message: 'Organization not found.', severity: 'HIGH', retriable: false })
      await writeAuditError('organizations', null, err.toJSON())
      throw err
    }

    if (org.plan === 'free') {
      const err = new AppError({ code: 'CALL_START_PLAN_LIMIT_EXCEEDED', message: 'Plan does not permit outbound calls', user_message: 'Your plan does not allow outbound calls. Please upgrade.', severity: 'HIGH', retriable: false })
      await writeAuditError('organizations', org.id, err.toJSON())
      throw err
    }

    // Check usage limits before executing call
    const usageCheck = await checkUsageLimits(organization_id, org.plan, 'call')
    if (!usageCheck.allowed) {
      const err = new AppError({
        code: 'USAGE_LIMIT_EXCEEDED',
        message: usageCheck.reason || 'Usage limit exceeded',
        user_message: usageCheck.reason || 'Your monthly call limit has been reached. Please upgrade your plan.',
        severity: 'MEDIUM',
        retriable: false
      })
      await writeAuditError('calls', callId, err.toJSON())
      throw err
    }

    // membership check
    let membershipRows: any[] = []
    try {
      const { rows } = await query(
        `SELECT id, role FROM org_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
        [organization_id, actorId]
      )
      membershipRows = rows
    } catch (membershipErr: any) {
      const err = new AppError({ code: 'AUTH_MEMBERSHIP_LOOKUP_FAILED', message: 'Membership lookup failed', user_message: 'Unable to verify membership', severity: 'HIGH', retriable: true, details: { cause: membershipErr.message } })
      await writeAuditError('org_members', null, err.toJSON())
      throw err
    }

    // enforce canonical modulations from voice_configs (do NOT allow client override)
    // default to conservative (all false) when no config present
    let effectiveModulations: Modulations & { translate_from?: string | null; translate_to?: string | null } = { record: false, transcribe: false, translate: false }
    try {
      const { rows: vcRows } = await query(
        `SELECT record, transcribe, live_translate, translate_from, translate_to, survey, synthetic_caller 
         FROM voice_configs WHERE organization_id = $1 LIMIT 1`,
        [organization_id]
      )

      if (vcRows && vcRows[0]) {
        const cfg = vcRows[0]
        effectiveModulations.record = !!cfg.record
        effectiveModulations.transcribe = !!cfg.transcribe
        effectiveModulations.translate = !!cfg.live_translate
        effectiveModulations.survey = !!cfg.survey
        effectiveModulations.synthetic_caller = !!cfg.synthetic_caller
        if (typeof cfg.translate_from === 'string') effectiveModulations.translate_from = cfg.translate_from
        if (typeof cfg.translate_to === 'string') effectiveModulations.translate_to = cfg.translate_to
      }
    } catch (e) {
      // best-effort: if voice_configs absent or lookup fails, keep conservative defaults
    }

    if (!membershipRows || membershipRows.length === 0) {
      const err = new AppError({ code: 'AUTH_ORG_MISMATCH', message: 'Actor not authorized for organization', user_message: 'Not authorized for this organization', severity: 'HIGH', retriable: false })
      await writeAuditError('org_members', null, err.toJSON())
      throw err
    }

    // RBAC enforcement per ARCH_DOCS RBAC Matrix: Only Owner/Admin/Operator can execute calls
    const userRole = membershipRows[0].role?.toLowerCase() || 'viewer'
    const allowedCallRoles = ['owner', 'admin', 'operator']
    if (!allowedCallRoles.includes(userRole)) {
      const err = new AppError({
        code: 'CALL_EXECUTE_FORBIDDEN',
        message: 'Insufficient permissions to execute calls',
        user_message: 'You do not have permission to place calls. Only Owners, Admins, and Operators can place calls.',
        severity: 'HIGH',
        retriable: false
      })
      await writeAuditError('org_members', null, { ...err.toJSON(), role: userRole, required_roles: allowedCallRoles })
      throw err
    }

    // CALLER ID VALIDATION per GOVERNED_CALLER_ID spec
    // Validates user has permission to use the specified caller ID
    let callerIdValidation: { allowed: boolean; callerIdNumberId: string | null; phoneNumber: string | null; reason?: string } | null = null
    const callerIdService = new CallerIdService()
    callerIdValidation = await callerIdService.validateCallerIdForUser(
      organization_id,
      actorId,
      from_number
    )

    if (!callerIdValidation.allowed) {
      const err = new AppError({
        code: 'CALLER_ID_NOT_PERMITTED',
        message: callerIdValidation.reason || 'Caller ID not permitted',
        user_message: callerIdValidation.reason || 'You do not have permission to use this caller ID.',
        severity: 'HIGH',
        retriable: false,
        details: { requested_from_number: '[REDACTED]' }
      })
      await writeAuditError('caller_id_permissions', null, { ...err.toJSON(), reason: callerIdValidation.reason })
      throw err
    }

    // Use validated caller ID (may have been resolved from default rule)
    from_number = callerIdValidation.phoneNumber || from_number
    logger.info('startCallHandler: caller ID validated', {
      callerId: '[REDACTED]',
      callerIdNumberId: callerIdValidation.callerIdNumberId
    })

    // phone validation
    if (!E164_REGEX.test(phone_number)) {
      const err = new AppError({ code: 'CALL_START_INVALID_PHONE', message: 'Invalid phone number format', user_message: 'The phone number provided is invalid. Please verify and try again.', severity: 'MEDIUM', retriable: false })
      await writeAuditError('calls', null, err.toJSON())
      throw err
    }

    // systems lookup
    let systemsRows: any[] = []
    try {
      const { rows } = await query(
        `SELECT id, key FROM systems WHERE key IN ('system-cpid', 'system-ai')`,
        []
      )
      systemsRows = rows
    } catch (systemsErr: any) {
      const e = new AppError({ code: 'CALL_START_SYS_LOOKUP_FAILED', message: 'System lookup failed', user_message: 'Service error', severity: 'HIGH', retriable: true, details: { cause: systemsErr.message } })
      await writeAuditError('systems', null, e.toJSON())
      throw e
    }

    const systemMap: Record<string, string> = {}
      ; (systemsRows || []).forEach((s: any) => { systemMap[s.key] = s.id })
    const systemCpidId = systemMap['system-cpid'] ?? null
    const systemAiId = systemMap['system-ai'] ?? null
    capturedSystemCpidId = systemCpidId
    if (!systemCpidId) {
      const e = new AppError({ code: 'CALL_START_SYS_MISSING', message: 'Control system not registered', user_message: 'Service misconfiguration', severity: 'HIGH', retriable: false })
      await writeAuditError('systems', null, e.toJSON())
      throw e
    }

    // insert calls row
    callId = uuidv4()

    try {
      await query(
        `INSERT INTO calls (id, organization_id, system_id, status, started_at, ended_at, created_by, caller_id_number_id, caller_id_used)
             VALUES ($1, $2, $3, 'pending', NULL, NULL, $4, $5, $6)`,
        [
          callId,
          organization_id,
          systemCpidId,
          actorId,
          callerIdValidation?.callerIdNumberId || null,
          from_number || null
        ]
      )
    } catch (insertErr: any) {
      logger.error('startCallHandler: failed to insert call row', undefined, { callId, error: insertErr?.message })
      const e = new AppError({ code: 'CALL_START_DB_INSERT', message: 'Failed to create call record', user_message: 'We encountered a system error while starting your call. Please try again.', severity: 'HIGH', retriable: true, details: { cause: insertErr.message } })
      await writeAuditError('calls', callId, e.toJSON())
      throw e
    }

    // Intent capture: Record intent:call_start BEFORE execution (ARCH_DOCS compliance)
    // "You initiate intent. We orchestrate execution."
    await bestEffortAuditLog(
      async () => await query(
        `INSERT INTO audit_logs (id, organization_id, user_id, system_id, resource_type, resource_id, action, actor_type, actor_label, after, created_at)
         VALUES ($1, $2, $3, $4, 'calls', $5, 'intent:call_start', $6, $7, $8, NOW())`,
        [
          uuidv4(),
          organization_id,
          capturedActorId, // Assuming capturedActorId is correctly typed (string or null)
          capturedSystemCpidId,
          callId,
          capturedActorId ? 'human' : 'system',
          capturedActorId || 'cpid-call-handler',
          JSON.stringify({
            flow_type,
            modulations: effectiveModulations,
            record_enabled: effectiveModulations?.record ?? false,
            declared_at: new Date().toISOString()
          })
        ]
      ),
      { resource: 'calls', resourceId: callId, action: 'intent:call_start' }
    )

    // execute SignalWire (via injected caller if available)
    let call_sid: string | null = null
    if (signalwireCall) {
      logger.info('startCallHandler: using injected signalwireCall to place outbound call')
      if (flow_type === 'bridge' && from_number && E164_REGEX.test(from_number)) {
        // place two legs: agent leg then destination leg
        const sidA = await signalwireCall({ from: String(env.SIGNALWIRE_NUMBER || ''), to: from_number, url: String(env.NEXT_PUBLIC_APP_URL) + '/api/voice/swml/outbound-v2', statusCallback: String(env.NEXT_PUBLIC_APP_URL) + '/api/webhooks/signalwire' })
        const sidB = await signalwireCall({ from: String(env.SIGNALWIRE_NUMBER || ''), to: phone_number, url: String(env.NEXT_PUBLIC_APP_URL) + '/api/voice/swml/outbound-v2', statusCallback: String(env.NEXT_PUBLIC_APP_URL) + '/api/webhooks/signalwire' })
        call_sid = sidB.call_sid
        logger.info('startCallHandler: injected signalwireCall bridge created', { a: sidA.call_sid ? '[REDACTED]' : null, b: sidB.call_sid ? '[REDACTED]' : null })
      } else {
        const sw = await signalwireCall({ from: String(env.SIGNALWIRE_NUMBER || ''), to: phone_number, url: String(env.NEXT_PUBLIC_APP_URL) + '/api/voice/swml/outbound-v2', statusCallback: String(env.NEXT_PUBLIC_APP_URL) + '/api/webhooks/signalwire' })
        call_sid = sw.call_sid
        logger.info('startCallHandler: injected signalwireCall returned', { call_sid: call_sid ? '[REDACTED]' : null })
      }
    } else {
      // no injected caller: use shared helper which handles config and mocks
      // Check if live translation should be enabled (Business plan + feature flag + translate enabled)
      const plan = String(org.plan ?? '').toLowerCase()
      const isFeatureFlagEnabled = isLiveTranslationPreviewEnabled()
      // Allow translation in dev/preview even for non-business plans if feature flag is on
      const isBusinessPlan = ['business', 'enterprise'].includes(plan) || (env.NODE_ENV !== 'production' && isFeatureFlagEnabled)
      const shouldUseLiveTranslation = isBusinessPlan && isFeatureFlagEnabled && effectiveModulations.translate === true && !!effectiveModulations.translate_from && !!effectiveModulations.translate_to

      logger.info('startCallHandler: about to place SignalWire call', {
        flow_type,
        has_from_number: !!from_number,
        from_number_valid: from_number ? E164_REGEX.test(from_number) : false,
        shouldUseLiveTranslation,
        plan,
        isBusinessPlan,
        isFeatureFlagEnabled
      })

      if (flow_type === 'bridge' && from_number && E164_REGEX.test(from_number)) {
        // Bridge calls: Connect two parties via conference room
        // Create unique conference name for this call
        const conferenceName = `bridge-${callId}`

        // Call leg A (your agent/number) - joins conference
        const sidA = await placeSignalWireCall(
          from_number,
          shouldUseLiveTranslation,
          effectiveModulations.translate_from,
          effectiveModulations.translate_to,
          conferenceName,
          '1'
        )
        // Call leg B (destination) - joins same conference
        const sidB = await placeSignalWireCall(
          phone_number,
          shouldUseLiveTranslation,
          effectiveModulations.translate_from,
          effectiveModulations.translate_to,
          conferenceName,
          '2'
        )
        call_sid = sidB
        logger.info('startCallHandler: signalwire bridge created', {
          conference: conferenceName,
          legA: sidA ? '[REDACTED]' : null,
          legB: sidB ? '[REDACTED]' : null,
          liveTranslation: shouldUseLiveTranslation
        })
      } else {
        call_sid = await placeSignalWireCall(
          phone_number,
          shouldUseLiveTranslation,
          effectiveModulations.translate_from,
          effectiveModulations.translate_to
        )
        logger.info('startCallHandler: signalwire call placed', { call_sid: call_sid ? '[REDACTED]' : null, liveTranslation: shouldUseLiveTranslation })
      }
    }

    // Update call with call_sid and status
    // Use 'in_progress' (underscore) to match database enum and UI components
    let updateSql = `UPDATE calls SET status = 'in_progress'`
    const updateParams: any[] = []
    if (call_sid) {
      updateSql += `, call_sid = $1`
      updateParams.push(call_sid)
    }
    updateSql += ` WHERE id = $${updateParams.length + 1}`
    updateParams.push(callId)

    try {
      await query(updateSql, updateParams)

      // Track call usage (best-effort, don't fail call if tracking fails)
      try {
        await trackUsage({
          organizationId: organization_id,
          callId,
          metric: 'call',
          quantity: 1,
          metadata: {
            phone_number,
            flow_type,
            plan: org.plan,
            call_sid: call_sid || null
          }
        })
      } catch (usageErr: any) {
        logger.error('startCallHandler: failed to track call usage', usageErr, { callId, organization_id })
      }
      logger.info('startCallHandler: updated call with call_sid', { callId, hasSid: !!call_sid })

    } catch (updateErr: any) {
      logger.error('startCallHandler: failed to update call', undefined, { callId, error: updateErr?.message })
      await writeAuditError('calls', callId, { message: 'Failed to save call_sid', error: updateErr.message })
    }

    // enqueue ai run if requested (driven by voice_configs, not client input)
    if (effectiveModulations.transcribe) {
      if (!systemAiId) {
        await writeAuditError('systems', callId, new AppError({ code: 'CALL_START_AI_SYSTEM_MISSING', message: 'AI system not registered', user_message: 'Transcription unavailable right now.', severity: 'MEDIUM', retriable: true }).toJSON())
      } else {
        const aiId = uuidv4()
        try {
          await query(
            `INSERT INTO ai_runs (id, call_id, system_id, model, status, produced_by, is_authoritative)
                 VALUES ($1, $2, $3, 'assemblyai-v1', 'queued', 'model', true)`,
            [aiId, callId, systemAiId]
          )
        } catch (e: any) {
          logger.error('startCallHandler: failed to insert ai_run', undefined, { callId, error: e?.message })
          await writeAuditError('ai_runs', callId, new AppError({ code: 'AI_TRANSC_INSERT_FAILED', message: 'Failed to enqueue transcription', user_message: 'Transcription could not be started. The call will continue without transcription.', severity: 'MEDIUM', retriable: true, details: { cause: e.message } }).toJSON())
        }
      }
    }
    // enqueue translation run if requested (driven by voice_configs)
    if (effectiveModulations.translate) {
      // require languages to be present; if missing, record an audit and skip enqueuing
      const fromLang = effectiveModulations.translate_from ?? null
      const toLang = effectiveModulations.translate_to ?? null
      if (!fromLang || !toLang) {
        await writeAuditError('ai_runs', callId, new AppError({ code: 'AI_TRANSL_LANG_MISSING', message: 'Translation configured but language codes missing', user_message: 'Translation configuration incomplete; skipping translation.', severity: 'MEDIUM', retriable: false }).toJSON())
      } else if (!systemAiId) {
        await writeAuditError('systems', callId, new AppError({ code: 'CALL_START_AI_SYSTEM_MISSING', message: 'AI system not registered', user_message: 'Translation unavailable right now.', severity: 'MEDIUM', retriable: true }).toJSON())
      } else {
        const aiId = uuidv4()
        try {
          await query(
            `INSERT INTO ai_runs (id, call_id, system_id, model, status, produced_by, is_authoritative, output)
                 VALUES ($1, $2, $3, 'assemblyai-translation-v1', 'queued', 'model', true, $4)`,
            [aiId, callId, systemAiId, JSON.stringify({ translate_from: fromLang, translate_to: toLang, pending: true })]
          )
        } catch (e: any) {
          logger.error('startCallHandler: failed to insert ai_run (translation)', undefined, { callId, error: e?.message })
          await writeAuditError('ai_runs', callId, new AppError({ code: 'AI_TRANSL_INSERT_FAILED', message: 'Failed to enqueue translation', user_message: 'Translation could not be started. The call will continue without translation.', severity: 'MEDIUM', retriable: true, details: { cause: e.message } }).toJSON())
        }
      }
    }

    // enqueue survey run if requested (driven by voice_configs)
    if (effectiveModulations.survey) {
      if (!systemAiId) {
        await writeAuditError('systems', callId, new AppError({ code: 'CALL_START_AI_SYSTEM_MISSING', message: 'AI system not registered', user_message: 'Survey unavailable right now.', severity: 'MEDIUM', retriable: true }).toJSON())
      } else {
        const aiId = uuidv4()
        try {
          await query(
            `INSERT INTO ai_runs (id, call_id, system_id, model, status, produced_by, is_authoritative, output)
                VALUES ($1, $2, $3, 'assemblyai-survey', 'queued', 'model', true, $4)`,
            [aiId, callId, systemAiId, JSON.stringify({ pending: true })]
          )
        } catch (e: any) {
          logger.error('startCallHandler: failed to insert ai_run (survey)', undefined, { callId, error: e?.message })
          await writeAuditError('ai_runs', callId, new AppError({ code: 'AI_SURVEY_INSERT_FAILED', message: 'Failed to enqueue survey', user_message: 'Survey could not be started.', severity: 'MEDIUM', retriable: true, details: { cause: e.message } }).toJSON())
        }
      }
    }

    // recording intent audit (driven by voice_configs)
    if (effectiveModulations.record) {
      const orgToolId = org?.tool_id ?? null
      if (!orgToolId) {
        await writeAuditError('calls', callId, new AppError({ code: 'RECORDING_TOOL_NOT_FOUND', message: 'No recording tool available for organization', user_message: 'No recording tool available for your organization', severity: 'MEDIUM', retriable: false }).toJSON())
      } else {
        try {
          await query(
            `INSERT INTO audit_logs (id, organization_id, user_id, system_id, resource_type, resource_id, action, actor_type, actor_label, after, created_at)
                 VALUES ($1, $2, $3, $4, 'calls', $5, 'intent:recording_requested', $6, $7, $8, NOW())`,
            [
              uuidv4(),
              organization_id,
              capturedActorId,
              capturedSystemCpidId,
              callId,
              capturedActorId ? 'human' : 'system',
              capturedActorId || 'cpid-call-handler',
              JSON.stringify({ tool_id: orgToolId, requested_at: new Date().toISOString() })
            ]
          )
        } catch (e) { }
      }
    }

    // fetch canonical call
    let persistedCall: any[] = []
    try {
      const { rows } = await query(`SELECT * FROM calls WHERE id = $1 LIMIT 1`, [callId])
      persistedCall = rows
    } catch (fetchCallErr: any) {
      logger.error('startCallHandler: failed to fetch persisted call', undefined, { callId, error: fetchCallErr?.message })
      const e = new AppError({ code: 'CALL_START_FETCH_PERSISTED_FAILED', message: 'Failed to read back persisted call', user_message: 'We started the call but could not verify its record. Please contact support.', severity: 'HIGH', retriable: true, details: { cause: fetchCallErr?.message } })
      await writeAuditError('calls', callId, e.toJSON())
      throw e
    }

    if (!persistedCall?.[0]) {
      // ... (error handling same as above)
      const e = new AppError({ code: 'CALL_START_FETCH_PERSISTED_FAILED', message: 'Failed to read back persisted call', user_message: 'We started the call but could not verify its record. Please contact support.', severity: 'HIGH', retriable: true })
      await writeAuditError('calls', callId, e.toJSON())
      throw e
    }

    const canonicalCall = persistedCall[0]
    try {
      await query(
        `INSERT INTO audit_logs (id, organization_id, user_id, system_id, resource_type, resource_id, action, actor_type, actor_label, after, created_at)
             VALUES ($1, $2, $3, $4, 'calls', $5, 'create', $6, $7, $8, NOW())`,
        [
          uuidv4(),
          organization_id,
          capturedActorId,
          capturedSystemCpidId,
          callId,
          capturedActorId ? 'human' : 'system',
          capturedActorId || 'cpid-call-handler',
          JSON.stringify({ ...canonicalCall, config: effectiveModulations, call_sid })
        ]
      )
    } catch (auditErr: any) {
      logger.error('startCallHandler: failed to insert audit log', auditErr as Error, { callId })
      await writeAuditError('audit_logs', callId, new AppError({ code: 'AUDIT_LOG_INSERT_FAILED', message: 'Failed to write audit log', user_message: 'Call started but an internal audit log could not be saved.', severity: 'MEDIUM', retriable: true, details: { cause: auditErr.message } }).toJSON())
    }

    logger.info('startCallHandler: call flow completed', { callId })
    return { success: true, call_id: callId }
  } catch (err: any) {
    if (err instanceof AppError) {
      const payload = err.toJSON()
      try { await query(`INSERT INTO audit_logs (id, organization_id, user_id, system_id, resource_type, resource_id, action, actor_type, actor_label, after, created_at) VALUES ($1, $2, $3, $4, 'calls', $5, 'error', $6, $7, $8, NOW())`, [uuidv4(), organization_id, capturedActorId ?? null, capturedSystemCpidId ?? null, callId ?? null, capturedActorId ? 'human' : 'system', capturedActorId || 'cpid-call-handler', JSON.stringify(payload)]) } catch (e) { }
      return { success: false, error: { id: payload.id, code: payload.code, message: payload.user_message ?? payload.message, severity: payload.severity } }
    }
    // log the unexpected error for debugging
    logger.error('startCallHandler unexpected error', err)
    const unexpected = new AppError({ code: 'CALL_START_UNEXPECTED', message: err?.message ?? 'Unexpected error', user_message: 'An unexpected error occurred while starting the call.', severity: 'CRITICAL', retriable: true, details: { stack: err?.stack } })
    const payload = unexpected.toJSON()
    try { await query(`INSERT INTO audit_logs (id, organization_id, user_id, system_id, resource_type, resource_id, action, actor_type, actor_label, after, created_at) VALUES ($1, $2, null, null, 'calls', null, 'error', 'system', 'cpid-call-handler', $3, NOW())`, [uuidv4(), organization_id, JSON.stringify(payload)]) } catch (e) { }
    return { success: false, error: { id: payload.id, code: payload.code, message: payload.user_message ?? payload.message, severity: payload.severity } }
  }
}
