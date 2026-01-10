"use server"

import { v4 as uuidv4 } from 'uuid'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { AppError } from '@/types/app-error'
import { getServerSession } from 'next-auth/next'

export type GetCallStatusInput = {
  call_id: string
  organization_id: string
}

type CallSummary = {
  id: string
  organization_id: string
  system_id: string | null
  status: string | null
  started_at: string | null
  ended_at: string | null
  created_by: string | null
}

type AiRunSummary = {
  id: string
  system_id: string | null
  model: string | null
  status: string | null
  started_at?: string | null
  completed_at?: string | null
}

type RecordingSummary = {
  id: string
  recording_sid: string | null
  recording_url: string | null
  duration_seconds: number | null
  status: string | null
  created_at: string | null
  tool_id: string | null
}

type ManifestSummary = {
  id: string
  recording_id: string
  scorecard_id: string | null
  created_at: string | null
}

type ApiResponseSuccess = {
  success: true
  call: CallSummary
  modulations?: any | null
  ai_runs: AiRunSummary[]
  recordings: RecordingSummary[]
  manifest_summary: { count: number; manifests: ManifestSummary[] }
}

type ApiError = { id: string; code: string; message: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' }
type ApiResponseError = { success: false; error: ApiError }
type ApiResponse = ApiResponseSuccess | ApiResponseError

export default async function getCallStatus(input: GetCallStatusInput): Promise<ApiResponse> {
  let capturedActorId: string | null = null
  try {
    const { call_id, organization_id } = input

    // session/actor
    const session = await getServerSession()
    const actorId = session?.user?.id ?? null
    capturedActorId = actorId
    if (!actorId) {
      const err = new AppError({ code: 'AUTH_REQUIRED', message: 'Unauthenticated', user_message: 'Authentication required', severity: 'HIGH', retriable: false })
      throw err
    }

    // validate ids (basic)
    if (!/^[0-9a-fA-F-]{36}$/.test(organization_id) || !/^[0-9a-fA-F-]{36}$/.test(call_id)) {
      const err = new AppError({ code: 'INVALID_IDS', message: 'Invalid identifiers', user_message: 'Invalid identifiers provided', severity: 'MEDIUM', retriable: false })
      throw err
    }

    // ownership/membership check
    const { data: membershipRows, error: membershipErr } = await supabaseAdmin
      .from('org_members')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('user_id', actorId)
      .limit(1)

    if (membershipErr) {
      const err = new AppError({ code: 'AUTH_MEMBERSHIP_LOOKUP_FAILED', message: 'Membership lookup failed', user_message: 'Unable to verify membership', severity: 'HIGH', retriable: true })
      throw err
    }

    if (!membershipRows || membershipRows.length === 0) {
      const err = new AppError({ code: 'AUTH_ORG_MISMATCH', message: 'Actor not authorized for organization', user_message: 'Not authorized for this organization', severity: 'HIGH', retriable: false })
      throw err
    }

    // read call
    const { data: callsRows, error: callsErr } = await supabaseAdmin
      .from('calls')
      .select('id,organization_id,system_id,status,started_at,ended_at,created_by')
      .eq('id', call_id)
      .eq('organization_id', organization_id)
      .limit(1)

    if (callsErr) {
      const err = new AppError({ code: 'CALL_FETCH_FAILED', message: 'Failed to fetch call', user_message: 'Unable to fetch call', severity: 'HIGH', retriable: true })
      throw err
    }

    const callRow = callsRows?.[0]
    if (!callRow) {
      const err = new AppError({ code: 'CALL_NOT_FOUND', message: 'Call not found', user_message: 'Call not found', severity: 'MEDIUM', retriable: false })
      throw err
    }

    // read ai_runs for this call
    const { data: aiRows } = await supabaseAdmin
      .from('ai_runs')
      .select('id,system_id,model,status,started_at,completed_at')
      .eq('call_id', call_id)

    const ai_runs: AiRunSummary[] = (aiRows || []).map((r: any) => ({ id: r.id, system_id: r.system_id, model: r.model, status: r.status, started_at: r.started_at ?? null, completed_at: r.completed_at ?? null }))

    // read audit_logs to extract modulations / provisional_call_sid
    const { data: auditRows } = await supabaseAdmin
      .from('audit_logs')
      .select('id,action,after,created_at')
      .eq('resource_type', 'calls')
      .eq('resource_id', call_id)
      .in('action', ['create','intent:create'])
      .order('created_at', { ascending: false })
      .limit(1)

    let modulations: any = null
    let provisional_call_sid: string | null = null
    if (auditRows && auditRows.length > 0) {
      const after = auditRows[0].after
      if (after && typeof after === 'object') {
        modulations = after.config ?? null
        provisional_call_sid = after.provisional_call_sid ?? null
      }
    }

    // recordings: use provisional_call_sid to find recordings
    let recordings: RecordingSummary[] = []
    let manifest_summary: ManifestSummary[] = []
    if (provisional_call_sid) {
      const { data: recRows } = await supabaseAdmin
        .from('recordings')
        .select('id,recording_sid,recording_url,duration_seconds,status,created_at,tool_id')
        .eq('call_sid', provisional_call_sid)
        .eq('organization_id', organization_id)

      recordings = (recRows || []).map((r: any) => ({ id: r.id, recording_sid: r.recording_sid ?? null, recording_url: r.recording_url ?? null, duration_seconds: r.duration_seconds ?? null, status: r.status ?? null, created_at: r.created_at ?? null, tool_id: r.tool_id ?? null }))

      if (recordings.length > 0) {
        const recordingIds = recordings.map(r => r.id)
        const { data: manifests } = await supabaseAdmin
          .from('evidence_manifests')
          .select('id,recording_id,scorecard_id,created_at')
          .in('recording_id', recordingIds)

        manifest_summary = (manifests || []).map((m: any) => ({ id: m.id, recording_id: m.recording_id, scorecard_id: m.scorecard_id ?? null, created_at: m.created_at ?? null }))
      }
    }

    // write read audit
    try {
      await supabaseAdmin.from('audit_logs').insert({
        id: uuidv4(),
        organization_id,
        user_id: capturedActorId,
        system_id: null,
        resource_type: 'calls',
        resource_id: call_id,
        action: 'read',
        before: null,
        after: { requested_at: new Date().toISOString() },
        created_at: new Date().toISOString()
      })
    } catch (e) {
      // best-effort
    }

    const resp: ApiResponseSuccess = {
      success: true,
      call: {
        id: callRow.id,
        organization_id: callRow.organization_id,
        system_id: callRow.system_id ?? null,
        status: callRow.status ?? null,
        started_at: callRow.started_at ?? null,
        ended_at: callRow.ended_at ?? null,
        created_by: callRow.created_by ?? null
      },
      modulations,
      ai_runs,
      recordings,
      manifest_summary: { count: manifest_summary.length, manifests: manifest_summary }
    }

    return resp
  } catch (err: any) {
    if (err instanceof AppError) {
      const p = err.toJSON()
      return { success: false, error: { id: p.id, code: p.code, message: p.user_message ?? p.message, severity: p.severity } }
    }
    const unexpected = new AppError({ code: 'CALL_STATUS_UNEXPECTED', message: err?.message ?? 'Unexpected', user_message: 'An unexpected error occurred while retrieving call status.', severity: 'CRITICAL', retriable: true })
    const p = unexpected.toJSON()
    return { success: false, error: { id: p.id, code: p.code, message: p.user_message ?? p.message, severity: p.severity } }
  }
}
