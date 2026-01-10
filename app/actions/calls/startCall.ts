"use server"

import { v4 as uuidv4 } from 'uuid'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { AppError } from '@/types/app-error'
import { getServerSession } from 'next-auth/next'

// Input types
type Modulations = {
  record: boolean
  transcribe: boolean
  survey?: boolean
}

export type StartCallInput = {
  organization_id: string
  phone_number: string
  modulations: Modulations
}

type ApiError = {
  id: string
  code: string
  message: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  retriable?: boolean
  details?: Record<string, any>
}

type ApiResponseSuccess = { success: true; call_id: string }
type ApiResponseError = { success: false; error: ApiError }
type ApiResponse = ApiResponseSuccess | ApiResponseError

const E164_REGEX = /^\+?[1-9]\d{1,14}$/

/**
 * startCall server action
 * - follows ARCH_DOCS/Schema.txt exactly for table/column usage
 * - does NOT invent columns (call_sid is not written to `calls`)
 */
export default async function startCall(input: StartCallInput): Promise<ApiResponse> {
  let capturedActorId: string | null = null
  let capturedSystemCpidId: string | null = null
  let callId: string | null = null

  // helper: best-effort audit write for errors
  async function writeAuditError(resource: string, resourceId: string | null, payload: any) {
    try {
      await supabaseAdmin.from('audit_logs').insert({
        id: uuidv4(),
        organization_id: input.organization_id,
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
      // best-effort: do not block original error
      // eslint-disable-next-line no-console
      console.error('failed to write audit error', e)
    }
  }

  try {
    const { organization_id, phone_number, modulations } = input

    // 0) actor/session lookup — must be first
    const session = await getServerSession()
    const actorId = session?.user?.id ?? null
    capturedActorId = actorId
    if (!actorId) {
      const err = new AppError({ code: 'AUTH_REQUIRED', message: 'Unauthenticated', user_message: 'Authentication required', severity: 'HIGH', retriable: false })
      await writeAuditError('organizations', null, err.toJSON())
      throw err
    }

    // validate organization_id is a UUID (basic guard)
    if (!/^[0-9a-fA-F-]{36}$/.test(organization_id)) {
      const err = new AppError({ code: 'CALL_START_INVALID_ORG', message: 'Invalid organization id', user_message: 'Invalid organization identifier', severity: 'MEDIUM', retriable: false })
      await writeAuditError('organizations', null, err.toJSON())
      throw err
    }

    // 1) organization lookup (use organizations.plan)
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

    // 1.a) membership check — ensure actor belongs to organization
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

    if (!membershipRows || membershipRows.length === 0) {
      const err = new AppError({ code: 'AUTH_ORG_MISMATCH', message: 'Actor not authorized for organization', user_message: 'Not authorized for this organization', severity: 'HIGH', retriable: false })
      await writeAuditError('org_members', null, err.toJSON())
      throw err
    }

    // 2) Validate phone number format (E.164)
    if (!E164_REGEX.test(phone_number)) {
      const err = new AppError({ code: 'CALL_START_INVALID_PHONE', message: 'Invalid phone number format', user_message: 'The phone number provided is invalid. Please verify and try again.', severity: 'MEDIUM', retriable: false })
      await writeAuditError('calls', null, err.toJSON())
      throw err
    }

    // 3) Resolve systems ids for provenance (system-cpid and system-ai)
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
    (systemsRows || []).forEach((s: any) => { systemMap[s.key] = s.id })
    const systemCpidId = systemMap['system-cpid'] ?? null
    const systemAiId = systemMap['system-ai'] ?? null
    capturedSystemCpidId = systemCpidId
    if (!systemCpidId) {
      const e = new AppError({ code: 'CALL_START_SYS_MISSING', message: 'Control system not registered', user_message:'Service misconfiguration', severity:'HIGH', retriable:false })
      await writeAuditError('systems', null, e.toJSON())
      throw e
    }

    // 4) Insert into calls table (use exact Schema.txt columns)
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
      const e = new AppError({ code: 'CALL_START_DB_INSERT', message: 'Failed to create call record', user_message: 'We encountered a system error while starting your call. Please try again.', severity: 'HIGH', retriable: true, details: { cause: insertErr.message } })
      await writeAuditError('calls', callId, e.toJSON())
      throw e
    }

    // 5) Mock SignalWire call creation (do NOT write call_sid to `calls` schema)
    const provisional_call_sid = `csid-${uuidv4()}`

    // 6) If transcribe requested -> insert into ai_runs (exact columns: id, call_id, system_id, model, status)
    if (modulations.transcribe) {
      if (!systemAiId) {
        await writeAuditError('systems', callId, new AppError({ code: 'CALL_START_AI_SYSTEM_MISSING', message: 'AI system not registered', user_message: 'Transcription unavailable right now.', severity: 'MEDIUM', retriable: true }).toJSON())
      } else {
        const aiId = uuidv4()
        const aiRow = {
          id: aiId,
          call_id: callId,
          system_id: systemAiId,
          model: 'assemblyai-v1',
          status: 'queued'
        }
        try {
          const { error: aiErr } = await supabaseAdmin.from('ai_runs').insert(aiRow)
          if (aiErr) {
            await writeAuditError('ai_runs', callId, new AppError({ code: 'AI_TRANSC_INSERT_FAILED', message: 'Failed to enqueue transcription', user_message: 'Transcription could not be started. The call will continue without transcription.', severity: 'MEDIUM', retriable: true, details: { cause: aiErr.message } }).toJSON())
          }
        } catch (e) {
          await writeAuditError('ai_runs', callId, new AppError({ code: 'AI_TRANSC_INSERT_FAILED', message: 'Failed to enqueue transcription', user_message: 'Transcription could not be started. The call will continue without transcription.', severity: 'MEDIUM', retriable: true, details: { cause: (e as any).message } }).toJSON())
        }
      }
    }

    // 7) If recording requested, do NOT create a recordings row here; audit the intent and reference org.tool_id
    if (modulations.record) {
      const orgToolId = org?.tool_id ?? null
      if (!orgToolId) {
        await writeAuditError('calls', callId, new AppError({ code: 'RECORDING_TOOL_NOT_FOUND', message: 'No recording tool available for organization', user_message: 'No recording tool available for your organization', severity: 'MEDIUM', retriable: false }).toJSON())
      } else {
        try {
          await supabaseAdmin.from('audit_logs').insert({
            id: uuidv4(),
            organization_id,
            user_id: capturedActorId,
            system_id: capturedSystemCpidId,
            resource_type: 'calls',
            resource_id: callId,
            action: 'intent:recording_requested',
            before: null,
            after: { tool_id: orgToolId, requested_at: new Date().toISOString() },
            created_at: new Date().toISOString()
          })
        } catch (e) { /* best-effort */ }
      }
    }

    // 8) Fetch canonical persisted call row for provenance and write final create audit
    const { data: persistedCall, error: fetchCallErr } = await supabaseAdmin
      .from('calls')
      .select('*')
      .eq('id', callId)
      .limit(1)

    if (fetchCallErr || !persistedCall?.[0]) {
      const e = new AppError({ code: 'CALL_START_FETCH_PERSISTED_FAILED', message: 'Failed to read back persisted call', user_message: 'We started the call but could not verify its record. Please contact support.', severity: 'HIGH', retriable: true, details: { cause: fetchCallErr?.message } })
      await writeAuditError('calls', callId, e.toJSON())
      throw e
    }

    const canonicalCall = persistedCall[0]

    try {
      await supabaseAdmin.from('audit_logs').insert({
        id: uuidv4(),
        organization_id,
        user_id: capturedActorId,
        system_id: capturedSystemCpidId,
        resource_type: 'calls',
        resource_id: callId,
        action: 'create',
        before: null,
        after: { ...canonicalCall, config: modulations, provisional_call_sid },
        created_at: new Date().toISOString()
      })
    } catch (auditErr) {
      await writeAuditError('audit_logs', callId, new AppError({ code: 'AUDIT_LOG_INSERT_FAILED', message: 'Failed to write audit log', user_message: 'Call started but an internal audit log could not be saved.', severity: 'MEDIUM', retriable: true, details: { cause: (auditErr as any).message } }).toJSON())
    }

    return { success: true, call_id: callId }
  } catch (err: any) {
    if (err instanceof AppError) {
      const payload = err.toJSON()
      try { await supabaseAdmin.from('audit_logs').insert({ id: uuidv4(), organization_id: input.organization_id, user_id: capturedActorId ?? null, system_id: capturedSystemCpidId ?? null, resource_type: 'calls', resource_id: callId ?? null, action: 'error', before: null, after: payload, created_at: new Date().toISOString() }) } catch (e) { /* best-effort */ }
      return { success: false, error: { id: payload.id, code: payload.code, message: payload.user_message ?? payload.message, severity: payload.severity } }
    }

    const unexpected = new AppError({ code: 'CALL_START_UNEXPECTED', message: err?.message ?? 'Unexpected error', user_message: 'An unexpected error occurred while starting the call.', severity: 'CRITICAL', retriable: true, details: { stack: err?.stack } })
    const payload = unexpected.toJSON()
    try { await supabaseAdmin.from('audit_logs').insert({ id: uuidv4(), organization_id: input.organization_id, user_id: null, system_id: null, resource_type: 'calls', resource_id: null, action: 'error', before: null, after: payload, created_at: new Date().toISOString() }) } catch (e) { /* best-effort */ }
    return { success: false, error: { id: payload.id, code: payload.code, message: payload.user_message ?? payload.message, severity: payload.severity } }
  }
}
