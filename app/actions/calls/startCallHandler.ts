import { v4 as uuidv4 } from 'uuid'
import { AppError } from '@/types/app-error'
import { isLiveTranslationPreviewEnabled } from '@/lib/env-validation'

const E164_REGEX = /^\+?[1-9]\d{1,14}$/

export type Modulations = {
  record: boolean
  transcribe: boolean
  translate?: boolean
  survey?: boolean
  synthetic_caller?: boolean
}

export type StartCallInput = {
  organization_id: string
  from_number?: string
  phone_number: string
  flow_type?: 'bridge' | 'outbound'
  modulations: Modulations
}

export type StartCallDeps = {
  supabaseAdmin: any
  signalwireCall?: (params: { from: string; to: string; url: string; statusCallback: string }) => Promise<{ call_sid: string }>
  env?: Record<string, string | undefined>
}

type ApiResponseSuccess = { success: true; call_id: string }
type ApiResponseError = { success: false; error: any }
type ApiResponse = ApiResponseSuccess | ApiResponseError

export default async function startCallHandler(input: StartCallInput, deps: StartCallDeps): Promise<ApiResponse> {
  const { supabaseAdmin, signalwireCall, env = process.env } = deps
  let capturedActorId: string | null = null
  let capturedSystemCpidId: string | null = null
  let callId: string | null = null
  // track organization_id here so audit helpers and catch blocks
  // always reference the effective organization (after overrides)
  let organization_id: string = input.organization_id

  async function writeAuditError(resource: string, resourceId: string | null, payload: any) {
    try {
      await supabaseAdmin.from('audit_logs').insert({
        id: uuidv4(),
        organization_id,
        user_id: capturedActorId,
        system_id: capturedSystemCpidId,
        resource_type: resource,
        resource_id: resourceId,
        action: 'error',
        before: null,
        after: payload,
        created_at: new Date().toISOString()
      })
    } catch (e) {
      // best-effort
      // eslint-disable-next-line no-console
      console.error('failed to write audit error', e)
    }
  }

  // helper to place a single SignalWire call (returns sid)
  const placeSignalWireCall = async (
    toNumber: string, 
    useLiveTranslation: boolean = false, 
    conference?: string,
    leg?: string
  ) => {
    // eslint-disable-next-line no-console
    console.log('placeSignalWireCall: ENTERED function', { 
      toNumber: toNumber ? '[REDACTED]' : null, 
      useLiveTranslation, 
      callId,
      conference: conference || 'none',
      leg: leg || 'single'
    })
    
    const swProject = env.SIGNALWIRE_PROJECT_ID
    const swToken = env.SIGNALWIRE_TOKEN
    const swNumber = env.SIGNALWIRE_NUMBER
    const rawSpace = String(env.SIGNALWIRE_SPACE || '')
    const swSpace = rawSpace.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/\.signalwire\.com$/i, '').trim()

    // eslint-disable-next-line no-console
    console.log('placeSignalWireCall: extracted config', { 
      hasProject: !!swProject, 
      hasToken: !!swToken, 
      hasSpace: !!swSpace, 
      hasNumber: !!swNumber,
      rawSpace: rawSpace ? rawSpace.substring(0, 20) + '...' : null,
      extractedSpace: swSpace || null
    })

    if (!(swProject && swToken && swSpace && swNumber)) {
      // Build detailed error message showing what's missing
      const missing = []
      if (!swProject) missing.push('SIGNALWIRE_PROJECT_ID')
      if (!swToken) missing.push('SIGNALWIRE_TOKEN')
      if (!swSpace) missing.push('SIGNALWIRE_SPACE')
      if (!swNumber) missing.push('SIGNALWIRE_NUMBER')
      
      if (env.NODE_ENV === 'production') {
        const e = new AppError({ 
          code: 'SIGNALWIRE_CONFIG_MISSING', 
          message: `SignalWire credentials missing: ${missing.join(', ')}`, 
          user_message: 'System configuration error - please contact support', 
          severity: 'CRITICAL', 
          retriable: false 
        })
        await writeAuditError('systems', null, e.toJSON())
        // eslint-disable-next-line no-console
        console.error('❌ CRITICAL: SignalWire config missing:', missing.join(', '))
        throw e
      }
      // mock SID in non-production
      // eslint-disable-next-line no-console
      console.warn('⚠️ SignalWire config incomplete (using mock):', missing.join(', '))
      return `mock-${uuidv4()}`
    }

    const auth = Buffer.from(`${swProject}:${swToken}`).toString('base64')
    const params = new URLSearchParams()
    params.append('From', swNumber)
    params.append('To', toNumber)
    
    // Route to SWML endpoint for live translation, LaML for regular calls
    if (useLiveTranslation && callId) {
      params.append('Url', `${env.NEXT_PUBLIC_APP_URL}/api/voice/swml/outbound?callId=${encodeURIComponent(callId)}`)
      // eslint-disable-next-line no-console
      console.log('startCallHandler: routing to SWML endpoint for live translation', { callId })
    } else {
      // Build LaML URL with parameters
      let lamlUrl = `${env.NEXT_PUBLIC_APP_URL}/api/voice/laml/outbound?callId=${encodeURIComponent(callId)}`
      
      // Add conference parameters for bridge calls
      if (conference) {
        lamlUrl += `&conference=${encodeURIComponent(conference)}`
        if (leg) {
          lamlUrl += `&leg=${encodeURIComponent(leg)}`
        }
      }
      
      params.append('Url', lamlUrl)
    }
    params.append('StatusCallback', `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/signalwire`)
    
    // Enable recording at REST API level if requested
    // This is the CORRECT way to record calls - NOT via LaML <Record> verb
    // SignalWire will automatically record the call and POST recording to StatusCallback
    // NOTE: For conference/bridge calls, recording is handled by <Conference record="..."> in LaML
    if (!conference) {
      params.append('Record', 'true')
      params.append('RecordingStatusCallback', `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/signalwire`)
      params.append('RecordingStatusCallbackEvent', 'completed')
    }

    const swEndpoint = `https://${swSpace}.signalwire.com/api/laml/2010-04-01/Accounts/${swProject}/Calls.json`
    // eslint-disable-next-line no-console
    console.log('startCallHandler: sending SignalWire POST', { endpoint: swEndpoint, to: toNumber, from: swNumber })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    let swRes
    try {
      swRes = await fetch(swEndpoint, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
        signal: controller.signal
      })
    } catch (fetchErr: any) {
      // eslint-disable-next-line no-console
      console.error('startCallHandler: SignalWire fetch error', { error: fetchErr?.message ?? String(fetchErr) })
      const e = new AppError({ code: 'SIGNALWIRE_FETCH_FAILED', message: 'Failed to reach SignalWire', user_message: 'Failed to place call via carrier', severity: 'HIGH', retriable: true, details: { cause: fetchErr?.message ?? String(fetchErr) } })
      await writeAuditError('calls', callId, e.toJSON())
      throw e
    } finally {
      clearTimeout(timeout)
    }

    if (!swRes.ok) {
      const text = await swRes.text()
      // eslint-disable-next-line no-console
      console.error('startCallHandler: SignalWire POST failed', { status: swRes.status, body: text })
      const e = new AppError({ code: 'SIGNALWIRE_API_ERROR', message: `SignalWire Error: ${swRes.status}`, user_message: 'Failed to place call via carrier', severity: 'HIGH', retriable: true, details: { provider_error: text } })
      await writeAuditError('calls', callId, e.toJSON())
      throw e
    }

    const swData = await swRes.json()
    // eslint-disable-next-line no-console
    console.log('startCallHandler: SignalWire responded', { sid: swData?.sid ? '[REDACTED]' : null })
    return swData?.sid ?? null
  }

  try {
    let { from_number, phone_number, flow_type, modulations } = input
    organization_id = input.organization_id
    
    // lightweight tracing for debugging call placement (avoid logging secrets)
    // Logs: organization and phone to help trace attempts in runtime logs
    // DO NOT log credentials or provider tokens
    // eslint-disable-next-line no-console
    console.log('startCallHandler: initiating call', { organization_id, from_number, phone_number, flow_type, modulations })

    // actor/session lookup
    // Note: Session lookup removed - actorId must be provided in input or handled by caller
    let actorId = (input as any).actor_id ?? null
    capturedActorId = actorId
    if (!actorId) {
      // allow a developer/testing fallback actor in non-production using the
      // provided UUID to exercise flows without a real session.
      if (env.NODE_ENV !== 'production') {
        actorId = '28d68e05-ab20-40ee-b935-b19e8927ae68'
        capturedActorId = actorId
        // eslint-disable-next-line no-console
        console.warn('startCallHandler: using dev fallback actorId', { actorId })
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
    const { data: orgRows, error: orgErr } = await supabaseAdmin
      .from('organizations')
      .select('id,plan,tool_id')
      .eq('id', organization_id)
      .limit(1)

    if (orgErr) {
      const err = new AppError({ code: 'CALL_START_DB_ORG_LOOKUP', message: 'Organization lookup failed', user_message: 'Unable to verify organization.', severity: 'HIGH', retriable: true, details: { cause: orgErr.message } })
      await writeAuditError('organizations', null, err.toJSON())
      throw err
    }

    const org = orgRows?.[0]
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

    // membership check
    const { data: membershipRows, error: membershipErr } = await supabaseAdmin
      .from('org_members')
      .select('id,role')
      .eq('organization_id', organization_id)
      .eq('user_id', actorId)
      .limit(1)

    if (membershipErr) {
      const err = new AppError({ code: 'AUTH_MEMBERSHIP_LOOKUP_FAILED', message: 'Membership lookup failed', user_message: 'Unable to verify membership', severity: 'HIGH', retriable: true, details: { cause: membershipErr.message } })
      await writeAuditError('org_members', null, err.toJSON())
      throw err
    }

    // enforce canonical modulations from voice_configs (do NOT allow client override)
    // default to conservative (all false) when no config present
    let effectiveModulations: Modulations & { translate_from?: string | null; translate_to?: string | null } = { record: false, transcribe: false, translate: false }
    try {
      const { data: vcRows, error: vcErr } = await supabaseAdmin.from('voice_configs').select('record,transcribe,translate,translate_from,translate_to,survey,synthetic_caller').eq('organization_id', organization_id).limit(1)
      if (!vcErr && vcRows && vcRows[0]) {
        const cfg: any = vcRows[0]
        effectiveModulations.record = !!cfg.record
        effectiveModulations.transcribe = !!cfg.transcribe
        effectiveModulations.translate = !!cfg.translate
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

    // phone validation
    if (!E164_REGEX.test(phone_number)) {
      const err = new AppError({ code: 'CALL_START_INVALID_PHONE', message: 'Invalid phone number format', user_message: 'The phone number provided is invalid. Please verify and try again.', severity: 'MEDIUM', retriable: false })
      await writeAuditError('calls', null, err.toJSON())
      throw err
    }

    // systems lookup
    const { data: systemsRows, error: systemsErr } = await supabaseAdmin
      .from('systems')
      .select('id,key')
      .in('key', ['system-cpid', 'system-ai'])

    if (systemsErr) {
      const e = new AppError({ code: 'CALL_START_SYS_LOOKUP_FAILED', message: 'System lookup failed', user_message: 'Service error', severity: 'HIGH', retriable: true, details: { cause: systemsErr.message } })
      await writeAuditError('systems', null, e.toJSON())
      throw e
    }

    const systemMap: Record<string, string> = {}
    ;(systemsRows || []).forEach((s: any) => { systemMap[s.key] = s.id })
    const systemCpidId = systemMap['system-cpid'] ?? null
    const systemAiId = systemMap['system-ai'] ?? null
    capturedSystemCpidId = systemCpidId
    if (!systemCpidId) {
      const e = new AppError({ code: 'CALL_START_SYS_MISSING', message: 'Control system not registered', user_message:'Service misconfiguration', severity:'HIGH', retriable:false })
      await writeAuditError('systems', null, e.toJSON())
      throw e
    }

    // insert calls row
    callId = uuidv4()
    const callRow = {
      id: callId,
      organization_id,
      system_id: systemCpidId,
      status: 'pending',
      started_at: null,
      ended_at: null,
      created_by: actorId
    }

    const { error: insertErr } = await supabaseAdmin.from('calls').insert(callRow)
    if (insertErr) {
      // eslint-disable-next-line no-console
      console.error('startCallHandler: failed to insert call row', { callId, error: insertErr?.message })
      const e = new AppError({ code: 'CALL_START_DB_INSERT', message: 'Failed to create call record', user_message: 'We encountered a system error while starting your call. Please try again.', severity: 'HIGH', retriable: true, details: { cause: insertErr.message } })
      await writeAuditError('calls', callId, e.toJSON())
      throw e
    }

    

    // execute SignalWire (via injected caller if available)
    let call_sid: string | null = null
    if (signalwireCall) {
      // eslint-disable-next-line no-console
      console.log('startCallHandler: using injected signalwireCall to place outbound call')
      if (flow_type === 'bridge' && from_number && E164_REGEX.test(from_number)) {
        // place two legs: agent leg then destination leg
        const sidA = await signalwireCall({ from: String(env.SIGNALWIRE_NUMBER || ''), to: from_number, url: String(env.NEXT_PUBLIC_APP_URL) + '/api/voice/laml/outbound', statusCallback: String(env.NEXT_PUBLIC_APP_URL) + '/api/webhooks/signalwire' })
        const sidB = await signalwireCall({ from: String(env.SIGNALWIRE_NUMBER || ''), to: phone_number, url: String(env.NEXT_PUBLIC_APP_URL) + '/api/voice/laml/outbound', statusCallback: String(env.NEXT_PUBLIC_APP_URL) + '/api/webhooks/signalwire' })
        call_sid = sidB.call_sid
        // eslint-disable-next-line no-console
        console.log('startCallHandler: injected signalwireCall bridge created', { a: sidA.call_sid ? '[REDACTED]' : null, b: sidB.call_sid ? '[REDACTED]' : null })
      } else {
        const sw = await signalwireCall({ from: String(env.SIGNALWIRE_NUMBER || ''), to: phone_number, url: String(env.NEXT_PUBLIC_APP_URL) + '/api/voice/laml/outbound', statusCallback: String(env.NEXT_PUBLIC_APP_URL) + '/api/webhooks/signalwire' })
        call_sid = sw.call_sid
        // eslint-disable-next-line no-console
        console.log('startCallHandler: injected signalwireCall returned', { call_sid: call_sid ? '[REDACTED]' : null })
      }
    } else {
      // no injected caller: use shared helper which handles config and mocks
      // Check if live translation should be enabled (Business plan + feature flag + translate enabled)
      const plan = String(org.plan ?? '').toLowerCase()
      const isBusinessPlan = ['business', 'enterprise'].includes(plan)
      const isFeatureFlagEnabled = isLiveTranslationPreviewEnabled()
      const shouldUseLiveTranslation = isBusinessPlan && isFeatureFlagEnabled && effectiveModulations.translate === true && !!effectiveModulations.translate_from && !!effectiveModulations.translate_to
      
      // eslint-disable-next-line no-console
      console.log('startCallHandler: about to place SignalWire call', { 
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
        const sidA = await placeSignalWireCall(from_number, false, conferenceName, '1')
        // Call leg B (destination) - joins same conference
        const sidB = await placeSignalWireCall(phone_number, false, conferenceName, '2')
        call_sid = sidB
        // eslint-disable-next-line no-console
        console.log('startCallHandler: signalwire bridge created', { 
          conference: conferenceName,
          legA: sidA ? '[REDACTED]' : null, 
          legB: sidB ? '[REDACTED]' : null 
        })
      } else {
        call_sid = await placeSignalWireCall(phone_number, shouldUseLiveTranslation)
        // eslint-disable-next-line no-console
        console.log('startCallHandler: signalwire call placed', { call_sid: call_sid ? '[REDACTED]' : null, liveTranslation: shouldUseLiveTranslation })
      }
    }

    // Update call with call_sid and status
    // NOTE: TOOL_TABLE_ALIGNMENT doesn't list call_sid, but it's required for webhook processing
    // Without call_sid, webhooks cannot find calls to update status/recordings/transcriptions
    const updateData: any = { status: 'in-progress' }
    if (call_sid) {
      updateData.call_sid = call_sid
    }
    
    const { error: updateErr } = await supabaseAdmin.from('calls').update(updateData).eq('id', callId)
    if (updateErr) {
      // eslint-disable-next-line no-console
      console.error('startCallHandler: failed to update call', { callId, error: updateErr?.message })
      await writeAuditError('calls', callId, { message: 'Failed to save call_sid', error: updateErr.message })
    } else {
      // eslint-disable-next-line no-console
      console.log('startCallHandler: updated call with call_sid', { callId, hasSid: !!call_sid })
    }

    // enqueue ai run if requested (driven by voice_configs, not client input)
    if (effectiveModulations.transcribe) {
      if (!systemAiId) {
        await writeAuditError('systems', callId, new AppError({ code: 'CALL_START_AI_SYSTEM_MISSING', message: 'AI system not registered', user_message: 'Transcription unavailable right now.', severity: 'MEDIUM', retriable: true }).toJSON())
      } else {
        const aiId = uuidv4()
        const aiRow = { id: aiId, call_id: callId, system_id: systemAiId, model: 'assemblyai-v1', status: 'queued' }
        try {
          const { error: aiErr } = await supabaseAdmin.from('ai_runs').insert(aiRow)
          if (aiErr) {
            // eslint-disable-next-line no-console
            console.error('startCallHandler: failed to insert ai_run', { callId, error: aiErr?.message })
            await writeAuditError('ai_runs', callId, new AppError({ code: 'AI_TRANSC_INSERT_FAILED', message: 'Failed to enqueue transcription', user_message: 'Transcription could not be started. The call will continue without transcription.', severity: 'MEDIUM', retriable: true, details: { cause: aiErr.message } }).toJSON())
          }
        } catch (e) {
          await writeAuditError('ai_runs', callId, new AppError({ code: 'AI_TRANSC_INSERT_FAILED', message: 'Failed to enqueue transcription', user_message: 'Transcription could not be started. The call will continue without transcription.', severity: 'MEDIUM', retriable: true, details: { cause: (e as any).message } }).toJSON())
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
        const aiRow = { id: aiId, call_id: callId, system_id: systemAiId, model: 'assemblyai-translation-v1', status: 'queued', meta: { translate_from: fromLang, translate_to: toLang } }
        try {
          const { error: aiErr } = await supabaseAdmin.from('ai_runs').insert(aiRow)
          if (aiErr) {
            // eslint-disable-next-line no-console
            console.error('startCallHandler: failed to insert ai_run (translation)', { callId, error: aiErr?.message })
            await writeAuditError('ai_runs', callId, new AppError({ code: 'AI_TRANSL_INSERT_FAILED', message: 'Failed to enqueue translation', user_message: 'Translation could not be started. The call will continue without translation.', severity: 'MEDIUM', retriable: true, details: { cause: aiErr.message } }).toJSON())
          }
        } catch (e) {
          await writeAuditError('ai_runs', callId, new AppError({ code: 'AI_TRANSL_INSERT_FAILED', message: 'Failed to enqueue translation', user_message: 'Translation could not be started. The call will continue without translation.', severity: 'MEDIUM', retriable: true, details: { cause: (e as any).message } }).toJSON())
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
          await supabaseAdmin.from('audit_logs').insert({ id: uuidv4(), organization_id, user_id: capturedActorId, system_id: capturedSystemCpidId, resource_type: 'calls', resource_id: callId, action: 'intent:recording_requested', before: null, after: { tool_id: orgToolId, requested_at: new Date().toISOString() }, created_at: new Date().toISOString() })
        } catch (e) { }
      }
    }

    // fetch canonical call
    const { data: persistedCall, error: fetchCallErr } = await supabaseAdmin.from('calls').select('*').eq('id', callId).limit(1)
    if (fetchCallErr || !persistedCall?.[0]) {
      // eslint-disable-next-line no-console
      console.error('startCallHandler: failed to fetch persisted call', { callId, error: fetchCallErr?.message })
      const e = new AppError({ code: 'CALL_START_FETCH_PERSISTED_FAILED', message: 'Failed to read back persisted call', user_message: 'We started the call but could not verify its record. Please contact support.', severity: 'HIGH', retriable: true, details: { cause: fetchCallErr?.message } })
      await writeAuditError('calls', callId, e.toJSON())
      throw e
    }

    const canonicalCall = persistedCall[0]
    try {
      await supabaseAdmin.from('audit_logs').insert({ id: uuidv4(), organization_id, user_id: capturedActorId, system_id: capturedSystemCpidId, resource_type: 'calls', resource_id: callId, action: 'create', before: null, after: { ...canonicalCall, config: effectiveModulations, call_sid }, created_at: new Date().toISOString() })
    } catch (auditErr) {
      // eslint-disable-next-line no-console
      console.error('startCallHandler: failed to insert audit log', { callId, error: (auditErr as any)?.message })
      await writeAuditError('audit_logs', callId, new AppError({ code: 'AUDIT_LOG_INSERT_FAILED', message: 'Failed to write audit log', user_message: 'Call started but an internal audit log could not be saved.', severity: 'MEDIUM', retriable: true, details: { cause: (auditErr as any).message } }).toJSON())
    }

    // eslint-disable-next-line no-console
    console.log('startCallHandler: call flow completed', { callId })
    return { success: true, call_id: callId }
  } catch (err: any) {
    if (err instanceof AppError) {
      const payload = err.toJSON()
      try { await supabaseAdmin.from('audit_logs').insert({ id: uuidv4(), organization_id, user_id: capturedActorId ?? null, system_id: capturedSystemCpidId ?? null, resource_type: 'calls', resource_id: callId ?? null, action: 'error', before: null, after: payload, created_at: new Date().toISOString() }) } catch (e) { }
      return { success: false, error: { id: payload.id, code: payload.code, message: payload.user_message ?? payload.message, severity: payload.severity } }
    }
    // log the unexpected error for debugging
    // eslint-disable-next-line no-console
    console.error('startCallHandler unexpected error', err)
    const unexpected = new AppError({ code: 'CALL_START_UNEXPECTED', message: err?.message ?? 'Unexpected error', user_message: 'An unexpected error occurred while starting the call.', severity: 'CRITICAL', retriable: true, details: { stack: err?.stack } })
    const payload = unexpected.toJSON()
    try { await supabaseAdmin.from('audit_logs').insert({ id: uuidv4(), organization_id, user_id: null, system_id: null, resource_type: 'calls', resource_id: null, action: 'error', before: null, after: payload, created_at: new Date().toISOString() }) } catch (e) { }
    return { success: false, error: { id: payload.id, code: payload.code, message: payload.user_message ?? payload.message, severity: payload.severity } }
  }
}
