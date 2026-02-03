"use server"

import supabaseAdmin from '@/lib/supabaseAdmin'
import { AppError } from '@/types/app-error'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export type GetCallStatusInput = {
  call_id: string
  organization_id: string
}

type CallSummary = {
  id: string
  organization_id: string | null
  system_id: string | null
  status: string | null
  started_at: string | null
  ended_at: string | null
  created_by: string | null
}

type AiRunSummary = {
  id: string
  call_id: string | null
  system_id: string | null
  model: string | null
  status: string | null
  started_at?: string | null
  completed_at?: string | null
  output?: any | null
}

type RecordingSummary = {
  id: string
  recording_sid: string | null
  recording_url: string | null
  duration_seconds: number | null
  transcript_json?: any | null
  status: string | null
  created_at: string | null
  updated_at?: string | null
  tool_id?: string | null
}

type ManifestSummary = {
  id: string
  recording_id: string
  scorecard_id: string | null
  manifest?: any | null
  created_at: string | null
}

type ApiResponseSuccess = {
  success: true
  call: CallSummary
  modulations?: any | null
  ai_runs: AiRunSummary[] | null
  recordings: RecordingSummary[] | null
  manifest_summary: { count: number; manifests: ManifestSummary[] } | null
}

type ApiError = { id: string; code: string; message: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' }
type ApiResponseError = { success: false; error: ApiError }
type ApiResponse = ApiResponseSuccess | ApiResponseError

export default async function getCallStatus(input: GetCallStatusInput): Promise<ApiResponse> {
  try {
    const { call_id, organization_id } = input

    // basic input guard
    if (!call_id || !organization_id) {
      const err = new AppError({ code: 'CALL_STATUS_INVALID_INPUT', message: 'call_id and organization_id required', user_message: 'Invalid input', severity: 'MEDIUM' })
      return { success: false, error: { id: err.id, code: err.code, message: err.user_message ?? err.message, severity: err.severity as ApiError['severity'] } }
    }

    // 0) session / actor lookup
    const session = await getServerSession(authOptions)
    const actorId = (session?.user as any)?.id ?? null
    if (!actorId) {
      const err = new AppError({ code: 'AUTH_REQUIRED', message: 'Unauthenticated', user_message: 'Authentication required', severity: 'HIGH' })
      return { success: false, error: { id: err.id, code: err.code, message: err.user_message ?? err.message, severity: err.severity as ApiError['severity'] } }
    }

    // 1) membership check (org_members exists in Schema.txt)
    const { data: membershipRows, error: membershipErr } = await supabaseAdmin
      .from('org_members')
      .select('id,role')
      .eq('organization_id', organization_id)
      .eq('user_id', actorId)
      .limit(1)

    if (membershipErr) {
      const err = new AppError({ code: 'AUTH_MEMBERSHIP_LOOKUP_FAILED', message: 'Membership lookup failed', user_message: 'Unable to verify membership', severity: 'HIGH', retriable: true, details: { cause: membershipErr.message } as any })
      return { success: false, error: { id: err.id, code: err.code, message: err.user_message ?? err.message, severity: err.severity as ApiError['severity'] } }
    }

    if (!membershipRows || (Array.isArray(membershipRows) && membershipRows.length === 0)) {
      const err = new AppError({ code: 'AUTH_ORG_MISMATCH', message: 'Actor not authorized for organization', user_message: 'Not authorized for this organization', severity: 'HIGH' })
      return { success: false, error: { id: err.id, code: err.code, message: err.user_message ?? err.message, severity: err.severity as ApiError['severity'] } }
    }

    // 2) Read call (only columns allowed by TOOL_TABLE_ALIGNMENT for calls.GET)
    const { data: callsRows, error: callsErr } = await supabaseAdmin
      .from('calls')
      .select('id,organization_id,system_id,status,started_at,ended_at,created_by')
      .eq('id', call_id)
      .eq('organization_id', organization_id)
      .limit(1)

    if (callsErr) {
      const err = new AppError({ code: 'CALL_FETCH_FAILED', message: 'Failed to fetch call', user_message: 'Unable to fetch call', severity: 'HIGH', retriable: true, details: { cause: callsErr.message } as any })
      return { success: false, error: { id: err.id, code: err.code, message: err.user_message ?? err.message, severity: err.severity as ApiError['severity'] } }
    }

    const callRow = callsRows?.[0]
    if (!callRow) {
      const err = new AppError({ code: 'CALL_NOT_FOUND', message: 'Call not found', user_message: 'Call not found', severity: 'MEDIUM' })
      return { success: false, error: { id: err.id, code: err.code, message: err.user_message ?? err.message, severity: err.severity as ApiError['severity'] } }
    }

    // 3) Read ai_runs for this call (allowed by TOOL_TABLE_ALIGNMENT)
    const { data: aiRows, error: aiErr } = await supabaseAdmin
      .from('ai_runs')
      .select('id,call_id,system_id,model,status,started_at,completed_at,output')
      .eq('call_id', call_id)

    if (aiErr) {
      const err = new AppError({ code: 'CALL_STATUS_DB_AIRUNS_LOOKUP', message: 'AI runs lookup failed', user_message: 'Unable to read AI run information', severity: 'MEDIUM', retriable: true, details: { cause: aiErr.message } as any })
      return { success: false, error: { id: err.id, code: err.code, message: err.user_message ?? err.message, severity: err.severity as ApiError['severity'] } }
    }

    const ai_runs: AiRunSummary[] = (aiRows || []).map((r: any) => ({
      id: r.id,
      call_id: r.call_id ?? null,
      system_id: r.system_id ?? null,
      model: r.model ?? null,
      status: r.status ?? null,
      started_at: r.started_at ?? null,
      completed_at: r.completed_at ?? null,
      output: r.output ?? null
    }))

    // 4) Read most-recent audit_logs for the call to find modulation snapshot / provisional SID
    const { data: auditRows, error: auditErr } = await supabaseAdmin
      .from('audit_logs')
      .select('id,action,after,created_at')
      .eq('resource_type', 'calls')
      .eq('resource_id', call_id)
      .in('action', ['create', 'intent:create'])
      .order('created_at', { ascending: false })
      .limit(1)

    if (auditErr) {
      const err = new AppError({ code: 'CALL_STATUS_AUDIT_LOOKUP_FAILED', message: 'Audit lookup failed', user_message: 'Unable to read call metadata', severity: 'MEDIUM', retriable: true, details: { cause: auditErr.message } as any })
      return { success: false, error: { id: err.id, code: err.code, message: err.user_message ?? err.message, severity: err.severity as ApiError['severity'] } }
    }

    let modulations: any = null
    // provisional_call_sid may be stored in audit `after` object (if present)
    const provisional_call_sid: string | null = (auditRows && auditRows[0] && auditRows[0].after && typeof auditRows[0].after === 'object') ? (auditRows[0].after.provisional_call_sid ?? null) : null
    if (auditRows && auditRows[0] && auditRows[0].after && typeof auditRows[0].after === 'object') {
      modulations = auditRows[0].after.config ?? null
    }

    // 5) Read recordings ONLY if we can resolve call -> call_sid via the audit-derived provisional_call_sid
    let recordings: RecordingSummary[] | null = null
    let manifest_summary: ManifestSummary[] | null = null

    if (provisional_call_sid) {
      // select only columns permitted by TOOL_TABLE_ALIGNMENT for recordings.GET
      const { data: recRows, error: recErr } = await supabaseAdmin
        .from('recordings')
        .select('id,recording_sid,recording_url,duration_seconds,transcript_json,status,created_at,updated_at')
        .eq('call_sid', provisional_call_sid)
        .eq('organization_id', organization_id)

      if (recErr) {
        const err = new AppError({ code: 'CALL_STATUS_DB_RECORDINGS_LOOKUP', message: 'Recordings lookup failed', user_message: 'Unable to read recording information', severity: 'HIGH', retriable: true, details: { cause: recErr.message } as any })
        return { success: false, error: { id: err.id, code: err.code, message: err.user_message ?? err.message, severity: err.severity as ApiError['severity'] } }
      }

      recordings = (recRows || []).map((r: any) => ({
        id: r.id,
        recording_sid: r.recording_sid ?? null,
        recording_url: r.recording_url ?? null,
        duration_seconds: r.duration_seconds ?? null,
        transcript_json: r.transcript_json ?? null,
        status: r.status ?? null,
        created_at: r.created_at ?? null,
        updated_at: r.updated_at ?? null
      }))

      if (recordings && recordings.length > 0) {
        const recordingIds = recordings.map(r => r.id)
        // evidence_manifests.GET allows id, organization_id, recording_id, scorecard_id, manifest, created_at
        const { data: manifests, error: manifestErr } = await supabaseAdmin
          .from('evidence_manifests')
          .select('id,recording_id,scorecard_id,manifest,created_at')
          .in('recording_id', recordingIds)

        if (manifestErr) {
          const err = new AppError({ code: 'CALL_STATUS_DB_MANIFESTS_LOOKUP', message: 'Evidence manifest lookup failed', user_message: 'Unable to read manifest information', severity: 'MEDIUM', retriable: true, details: { cause: manifestErr.message } as any })
          return { success: false, error: { id: err.id, code: err.code, message: err.user_message ?? err.message, severity: err.severity as ApiError['severity'] } }
        }

        manifest_summary = (manifests || []).map((m: any) => ({
          id: m.id,
          recording_id: m.recording_id,
          scorecard_id: m.scorecard_id ?? null,
          manifest: m.manifest ?? null,
          created_at: m.created_at ?? null
        }))
      } else {
        manifest_summary = null
      }
    }

    // 6) Return success (call-rooted). All reads only — NO writes/audit inserts.
    const resp: ApiResponseSuccess = {
      success: true,
      call: {
        id: callRow.id,
        organization_id: callRow.organization_id ?? null,
        system_id: callRow.system_id ?? null,
        status: callRow.status ?? null,
        started_at: callRow.started_at ?? null,
        ended_at: callRow.ended_at ?? null,
        created_by: callRow.created_by ?? null
      },
      modulations: modulations ?? null,
      ai_runs: ai_runs.length ? ai_runs : null,
      recordings,
      manifest_summary: manifest_summary ? { count: manifest_summary.length, manifests: manifest_summary } : null
    }

    return resp
  } catch (err: any) {
    if (err instanceof AppError) {
      const p = err.toJSON()
      return { success: false, error: { id: p.id, code: p.code, message: p.user_message ?? p.message, severity: p.severity as ApiError['severity'] } }
    }
    const unexpected = new AppError({ code: 'CALL_STATUS_UNEXPECTED', message: err?.message ?? 'Unexpected', user_message: 'An unexpected error occurred while retrieving call status.', severity: 'CRITICAL', retriable: true })
    const p = unexpected.toJSON()
    return { success: false, error: { id: p.id, code: p.code, message: p.user_message ?? p.message, severity: p.severity as ApiError['severity'] } }
  }
}
