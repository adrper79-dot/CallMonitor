"use server"

import { v4 as uuidv4 } from 'uuid'
import pgClient from '@/lib/pgClient'
import { AppError } from '@/types/app-error'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { fetchAssemblyAIWithRetry } from '@/lib/utils/fetchWithRetry'
import { assemblyAIBreaker } from '@/lib/utils/circuitBreaker'

export type TriggerTranscriptionInput = {
  recording_id: string
  organization_id: string
}

type ApiError = { id: string; code: string; message: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' }
type ApiResponseSuccess = { success: true; ai_run_id: string }
type ApiResponseError = { success: false; error: ApiError }
type ApiResponse = ApiResponseSuccess | ApiResponseError

/**
 * Tables/columns used (from ARCH_DOCS/Schema.txt):
 * - recordings: id, organization_id, call_sid, recording_sid, recording_url, duration_seconds, transcript_json, status, created_at, updated_at, tool_id, created_by
 * - ai_runs: id, call_id, system_id, model, status, started_at, completed_at, output
 * - audit_logs: id, organization_id, user_id, system_id, resource_type, resource_id, action, before, after, created_at
 * - organizations: id, plan, tool_id
 * - org_members: id, organization_id, user_id, role
 *
 * TOOL_TABLE_ALIGNMENT permissions (from ARCH_DOCS/TOOL_TABLE_ALIGNMENT):
 * - recordings: POST allowed (organization_id, call_sid, recording_url, duration_seconds, source, ai_metadata), GET allowed (id, organization_id, call_sid, ...)
 * - ai_runs: POST/GET/PUT added earlier to allow creating and updating ai_runs
 * - audit_logs: POST allowed for writing audits
 * - organizations: GET allowed for plan
 */

export default async function triggerTranscription(input: TriggerTranscriptionInput): Promise<ApiResponse> {
  let capturedActorId: string | null = null
  let aiId: string | null = null
  try {
    const { recording_id, organization_id } = input

    // session/actor
    const session = await getServerSession(authOptions)
    const actorId = (session?.user as any)?.id ?? null
    capturedActorId = actorId
    if (!actorId) {
      // best-effort audit for unauthenticated access (user_id will be null)
      try {
        await pgClient.query(`INSERT INTO audit_logs (id, organization_id, user_id, system_id, resource_type, resource_id, action, before, after, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [uuidv4(), input.organization_id ?? null, null, null, 'auth', null, 'error', null, { code: 'AUTH_REQUIRED', message: 'Unauthenticated access attempted' }, new Date().toISOString()])
      } catch (__) {}

      const err = new AppError({ code: 'AUTH_REQUIRED', message: 'Unauthenticated', user_message: 'Authentication required', severity: 'HIGH', retriable: false })
      throw err
    }

    // basic id validation
    if (!/^[0-9a-fA-F-]{36}$/.test(recording_id) || !/^[0-9a-fA-F-]{36}$/.test(organization_id)) {
      const err = new AppError({ code: 'INVALID_IDS', message: 'Invalid identifiers', user_message: 'Invalid identifiers provided', severity: 'MEDIUM', retriable: false })
      throw err
    }

    // verify recording exists and belongs to organization
    const recRes = await pgClient.query(`SELECT id, organization_id, call_sid, status, tool_id, created_by, recording_url FROM recordings WHERE id = $1 LIMIT 1`, [recording_id])
    const rec = recRes?.rows?.[0]
    if (!rec) {
      const e = new AppError({ code: 'RECORDING_NOT_FOUND', message: 'Recording not found', user_message: 'Recording not found', severity: 'MEDIUM', retriable: false })
      throw e
    }

    if (rec.organization_id !== organization_id) {
      const e = new AppError({ code: 'AUTH_ORG_MISMATCH', message: 'Organization mismatch', user_message: 'Recording does not belong to the specified organization', severity: 'HIGH', retriable: false })
      throw e
    }

    // ownership/membership check via org_members if present
    const membershipRes = await pgClient.query(`SELECT id, role FROM org_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1`, [organization_id, actorId])
    const membershipRows = membershipRes?.rows || []
    if (!membershipRows || membershipRows.length === 0) {
      const e = new AppError({ code: 'AUTH_ORG_MISMATCH', message: 'Actor not authorized for organization', user_message: 'Not authorized for this organization', severity: 'HIGH', retriable: false })
      throw e
    }

    // RBAC: Only Owner, Admin, or Operator can trigger transcription
    // Per ARCH_DOCS RBAC matrix: AI operations require 'execute' permission on 'transcript'
    const userRole = membershipRows[0]?.role || 'viewer'
    if (!['owner', 'admin', 'operator'].includes(userRole)) {
      const e = new AppError({ code: 'AUTH_FORBIDDEN', message: 'Insufficient permissions to trigger transcription', user_message: 'You do not have permission to perform this action', severity: 'HIGH', retriable: false })
      throw e
    }

    // MASTER_ARCHITECTURE enforcement: call-rooted requirement.
    // Schema: recordings.call_sid is text. We now rely on canonical mapping stored in calls.call_sid (added to schema via migration).
    // Resolve call_id from calls.call_sid so ai_runs.call_id can be populated.
    let resolvedCallId: string | null = null
    if (rec.call_sid) {
      const callRes = await pgClient.query(`SELECT id FROM calls WHERE call_sid = $1 LIMIT 1`, [rec.call_sid])
      const callRow = callRes?.rows?.[0]
      if (!callRow) {
        const e = new AppError({ code: 'CALL_NOT_FOUND', message: 'Call not found for recording.call_sid', user_message: 'Call not found for this recording', severity: 'HIGH', retriable: false })
        // audit the missing call
        try {
          await pgClient.query(`INSERT INTO audit_logs (id, organization_id, user_id, system_id, resource_type, resource_id, action, before, after, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [uuidv4(), organization_id, capturedActorId, null, 'recordings', recording_id, 'error', null, { error: e.message, call_sid: rec.call_sid }, new Date().toISOString()])
        } catch (__) {}
        throw e
      }

      resolvedCallId = callRow.id
    }

    // check recording status allows transcription
    // NOTE: Schema.txt defines recordings.status default 'pending' but does not enumerate allowed values.
    // We treat 'pending' as allowable; if status is 'completed' or 'processing' we consider invalid.
    const status = rec.status as string | null
    if (status && ['processing', 'completed'].includes(status)) {
      const e = new AppError({ code: 'RECORDING_INVALID_STATUS', message: 'Recording status does not allow transcription', user_message: 'Recording is not in a transcribable state', severity: 'HIGH', retriable: false })
      throw e
    }

    if (!rec.recording_url) {
      const e = new AppError({ code: 'RECORDING_URL_MISSING', message: 'Recording has no URL', user_message: 'Recording file not available', severity: 'HIGH', retriable: false })
      throw e
    }

    // check organization plan limits
    const orgRes = await pgClient.query(`SELECT id, plan FROM organizations WHERE id = $1 LIMIT 1`, [organization_id])
    const org = orgRes?.rows?.[0]
    if (!org) {
      const e = new AppError({ code: 'ORG_NOT_FOUND', message: 'Organization not found', user_message: 'Organization not found', severity: 'HIGH', retriable: false })
      throw e
    }
    if (org.plan === 'free') {
      const e = new AppError({ code: 'PLAN_LIMIT_EXCEEDED', message: 'Plan does not permit transcription', user_message: 'Your plan does not allow transcription. Please upgrade.', severity: 'HIGH', retriable: false })
      throw e
    }

    // Intent capture: Record intent:transcription_requested BEFORE execution (ARCH_DOCS compliance)
    // "You initiate intent. We orchestrate execution."
    try {
      await pgClient.query(`INSERT INTO audit_logs (id, organization_id, user_id, system_id, resource_type, resource_id, action, before, after, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [uuidv4(), organization_id, capturedActorId, null, 'recordings', recording_id, 'intent:transcription_requested', null, { recording_id, call_id: resolvedCallId, provider: 'assemblyai', declared_at: new Date().toISOString() }, new Date().toISOString()])
    } catch (__) {}

    // Execute AssemblyAI (Intelligence Plane) with retry and circuit breaker
    let aaiRes
    try {
      aaiRes = await assemblyAIBreaker.execute(async () => {
        return await fetchAssemblyAIWithRetry('https://api.assemblyai.com/v2/transcript', {
          method: 'POST',
          headers: {
            'Authorization': process.env.ASSEMBLYAI_API_KEY!,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            audio_url: rec.recording_url,
            webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/assemblyai`
          })
        })
      })
    } catch (fetchErr: any) {
      // Error already logged and wrapped by retry utility or circuit breaker
      if (fetchErr instanceof AppError) {
        throw fetchErr
      }
      const e = new AppError({ code: 'ASSEMBLYAI_FETCH_FAILED', message: 'Failed to reach AssemblyAI', user_message: 'Transcription service unavailable', severity: 'HIGH', retriable: true, details: { cause: fetchErr?.message } })
      throw e
    }

    if (!aaiRes.ok) {
      const errText = await aaiRes.text()
      const e = new AppError({ code: 'ASSEMBLYAI_API_ERROR', message: `AssemblyAI Error: ${aaiRes.status}`, user_message: 'Transcription service unavailable', severity: 'HIGH', retriable: true, details: { provider_error: errText } })
      throw e
    }

    const aaiData = await aaiRes.json()
    const job_id = aaiData.id

    // insert into ai_runs (exact columns: id, call_id, system_id, model, status)
    aiId = uuidv4()
    const aiRow = {
      id: aiId,
      call_id: resolvedCallId,
      system_id: null,
      model: 'assemblyai-v1',
      status: 'queued',
      job_id: job_id, // Persist vendor job ID
      produced_by: 'model',
      is_authoritative: true
    }

    // Note: Schema defines ai_runs.call_id foreign key to calls.id. If recording has call reference elsewhere, you should populate call_id.
    try {
      await pgClient.query(`INSERT INTO ai_runs (id, call_id, system_id, model, status, job_id, produced_by, is_authoritative, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [aiId, resolvedCallId, null, 'assemblyai-v1', 'queued', job_id, 'model', true, new Date().toISOString()])
    } catch (aiErr: any) {
      const e = new AppError({ code: 'AI_RUN_INSERT_FAILED', message: 'Failed to enqueue transcription', user_message: 'Could not start transcription', severity: 'HIGH', retriable: true, details: { cause: aiErr.message } } as any)
      // audit the failure
      try {
        await pgClient.query(`INSERT INTO audit_logs (id, organization_id, user_id, system_id, resource_type, resource_id, action, actor_type, actor_label, before, after, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [uuidv4(), organization_id, capturedActorId, null, 'ai_runs', aiId, 'error', capturedActorId ? 'human' : 'system', capturedActorId || 'transcription-trigger', null, { error: aiErr.message }, new Date().toISOString()])
      } catch (__) {}
      throw e
    }

    // audit log entry (success)
    try {
      await pgClient.query(`INSERT INTO audit_logs (id, organization_id, user_id, system_id, resource_type, resource_id, action, actor_type, actor_label, before, after, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [uuidv4(), organization_id, capturedActorId, null, 'ai_runs', aiId, 'create', capturedActorId ? 'human' : 'system', capturedActorId || 'transcription-trigger', null, { requested_at: new Date().toISOString(), model: 'assemblyai-v1', job_id, recording_id }, new Date().toISOString()])
    } catch (e) {
      // best-effort
    }

    return { success: true, ai_run_id: aiId }
  } catch (err: any) {
    // Attempt to write an error audit (best-effort). Prefer resource ai_runs if we have aiId, otherwise record recordings resource.
      try {
      const resource_type = aiId ? 'ai_runs' : 'recordings'
      const resource_id = aiId ?? input.recording_id
      const errBody = err instanceof AppError ? { code: err.code, message: err.message } : { message: String(err?.message ?? err) }
      await pgClient.query(`INSERT INTO audit_logs (id, organization_id, user_id, system_id, resource_type, resource_id, action, actor_type, actor_label, before, after, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [uuidv4(), input.organization_id, capturedActorId, null, resource_type, resource_id, 'error', capturedActorId ? 'human' : 'system', capturedActorId || 'transcription-trigger', null, { error: errBody }, new Date().toISOString()])
    } catch (__) {
      // best-effort
    }

    if (err instanceof AppError) {
      const p = err.toJSON()
      return { success: false, error: { id: p.id, code: p.code, message: p.user_message ?? p.message, severity: (p.severity as ApiError['severity']) ?? 'MEDIUM' } }
    }
    const unexpected = new AppError({ code: 'TRANSCR_TRIGGER_UNEXPECTED', message: err?.message ?? 'Unexpected', user_message: 'An unexpected error occurred while triggering transcription', severity: 'CRITICAL', retriable: true })
    const p = unexpected.toJSON()
    return { success: false, error: { id: p.id, code: p.code, message: p.user_message ?? p.message, severity: (p.severity as ApiError['severity']) ?? 'CRITICAL' } }
  }
}
