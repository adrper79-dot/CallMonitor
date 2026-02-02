import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireRole } from '@/lib/rbac-server'
import { Errors } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Call Debug/Ops View API
 * 
 * SYSTEM OF RECORD COMPLIANCE (Requirement 12):
 * - Answer "What happened on this call?" in under 30 seconds
 * - Single query path to reconstruct a call
 * - Audit logs indexed by resource_id
 * - Error timeline per call
 * 
 * GET /api/calls/[id]/debug - Full operational reconstruction
 */

export interface CallDebugView {
  // Call summary
  call: {
    id: string
    status: string
    call_sid: string | null
    started_at: string | null
    ended_at: string | null
    duration_seconds: number | null
    created_by: string | null
    is_deleted: boolean
  }

  // Recording details
  recording: {
    id: string
    status: string
    source: string
    duration_seconds: number | null
    has_transcript: boolean
    media_hash: string | null
  } | null

  // AI processing status
  ai_runs: Array<{
    id: string
    model: string
    status: string
    started_at: string | null
    completed_at: string | null
    duration_ms: number | null
    error: string | null
  }>

  // Evidence manifest status
  manifest: {
    id: string
    version: number
    artifact_count: number
    manifest_hash: string
    created_at: string
  } | null

  // Scoring status
  score: {
    id: string
    scorecard_id: string
    total_score: number
    has_manual_overrides: boolean
  } | null

  // Error timeline (critical for ops)
  error_timeline: Array<{
    timestamp: string
    error_code: string
    error_message: string
    severity: string
    resource_type: string
    resource_id: string | null
  }>

  // Full audit timeline
  audit_timeline: Array<{
    timestamp: string
    action: string
    actor_type: 'user' | 'system'
    actor_id: string | null
    resource_type: string
    details: any
  }>

  // Diagnostic flags
  diagnostics: {
    has_recording: boolean
    has_transcript: boolean
    has_translation: boolean
    has_score: boolean
    has_manifest: boolean
    has_errors: boolean
    is_complete: boolean
    completion_percentage: number
    warnings: string[]
  }
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: callId } = await params
    const startTime = Date.now()

    // Authenticate (Viewer+ allowed)
    const session = await requireRole('viewer')
    const organizationId = session.user.organizationId

    // Fetch call with org verification
    const { rows: callRows } = await query(
      `SELECT * FROM calls WHERE id = $1 AND organization_id = $2 LIMIT 1`,
      [callId, organizationId]
    )

    if (callRows.length === 0) {
      return Errors.notFound('Call not found')
    }

    const call = callRows[0]

    // Fetch recording
    let recording: any = null
    if (call.call_sid) {
      const { rows: recRows } = await query(
        `SELECT id, status, source, duration_seconds, transcript_json, media_hash, is_deleted 
             FROM recordings WHERE call_sid = $1 LIMIT 1`,
        [call.call_sid]
      )
      recording = recRows[0] || null
    }

    // Fetch AI runs
    const { rows: aiRuns } = await query(
      `SELECT id, model, status, started_at, completed_at, output
       FROM ai_runs WHERE call_id = $1 ORDER BY started_at ASC`,
      [callId]
    )

    // Fetch evidence manifest (current version)
    let manifest: { id: string; version: number; artifact_count: number; manifest_hash: string; created_at: string } | null = null
    if (recording) {
      const { rows: manifestRow } = await query(
        `SELECT id, version, manifest, created_at
         FROM evidence_manifests
         WHERE recording_id = $1 AND superseded_at IS NULL
         ORDER BY version DESC LIMIT 1`,
        [recording.id]
      )

      if (manifestRow.length > 0) {
        manifest = {
          id: manifestRow[0].id,
          version: manifestRow[0].version || 1,
          artifact_count: manifestRow[0].manifest?.artifacts?.length || 0,
          manifest_hash: manifestRow[0].manifest?.manifest_hash || '',
          created_at: manifestRow[0].created_at
        }
      }
    }

    // Fetch score
    let score: { id: string; scorecard_id: string; total_score: number; has_manual_overrides: boolean } | null = null
    if (recording) {
      const { rows: scoreRow } = await query(
        `SELECT id, scorecard_id, total_score, manual_overrides_json
         FROM scored_recordings WHERE recording_id = $1 LIMIT 1`,
        [recording.id]
      )

      if (scoreRow.length > 0) {
        score = {
          id: scoreRow[0].id,
          scorecard_id: scoreRow[0].scorecard_id,
          total_score: scoreRow[0].total_score,
          has_manual_overrides: !!scoreRow[0].manual_overrides_json
        }
      }
    }

    // Fetch error timeline (errors only from audit logs)
    const { rows: errorLogs } = await query(
      `SELECT created_at, action, after, resource_type, resource_id
       FROM audit_logs
       WHERE resource_id = $1 AND action = 'error'
       ORDER BY created_at ASC`,
      [callId]
    )

    const errorTimeline = (errorLogs || []).map((el: any) => ({
      timestamp: el.created_at,
      error_code: el.after?.code || 'UNKNOWN',
      error_message: el.after?.message || el.after?.user_message || 'Unknown error',
      severity: el.after?.severity || 'MEDIUM',
      resource_type: el.resource_type,
      resource_id: el.resource_id
    }))

    // Also check AI runs for errors
    const aiErrors = (aiRuns || [])
      .filter((ar: any) => ar.status === 'failed')
      .map((ar: any) => ({
        timestamp: ar.completed_at || ar.started_at,
        error_code: ar.output?.error_code || 'AI_RUN_FAILED',
        error_message: ar.output?.error || `AI run ${ar.model} failed`,
        severity: 'HIGH',
        resource_type: 'ai_runs',
        resource_id: ar.id
      }))

    const fullErrorTimeline = [...errorTimeline, ...aiErrors]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    // Fetch full audit timeline
    const { rows: auditLogs } = await query(
      `SELECT created_at, action, user_id, system_id, resource_type, after
       FROM audit_logs
       WHERE resource_id = $1 OR resource_id = $2
       ORDER BY created_at ASC
       LIMIT 100`,
      [callId, recording?.id || '00000000-0000-0000-0000-000000000000']
    )

    const auditTimeline = (auditLogs || []).map((al: any) => ({
      timestamp: al.created_at,
      action: al.action,
      actor_type: al.system_id ? 'system' as const : 'user' as const,
      actor_id: al.user_id || al.system_id || null,
      resource_type: al.resource_type,
      details: al.after
    }))

    // Calculate diagnostics
    const hasRecording = !!recording && recording.status === 'completed'
    const hasTranscript = !!recording?.transcript_json
    const hasTranslation = (aiRuns || []).some((ar: any) =>
      ar.model?.includes('translation') && ar.status === 'completed'
    )
    const hasScore = !!score
    const hasManifest = !!manifest
    const hasErrors = fullErrorTimeline.length > 0
    const isComplete = call.status === 'completed' && hasRecording

    // Calculate completion percentage
    let completionSteps = 0
    let totalSteps = 3 // call started, call completed, recording
    if (call.status !== 'pending') completionSteps++
    if (call.status === 'completed') completionSteps++
    if (hasRecording) completionSteps++
    if (hasTranscript) { totalSteps++; completionSteps++ }
    if (hasManifest) { totalSteps++; completionSteps++ }

    const completionPercentage = Math.round((completionSteps / totalSteps) * 100)

    // Generate warnings
    const warnings: string[] = []
    if (call.status === 'failed') warnings.push('Call failed')
    if (call.status === 'in-progress' && call.started_at) {
      const elapsed = Date.now() - new Date(call.started_at).getTime()
      if (elapsed > 30 * 60 * 1000) warnings.push('Call in-progress for over 30 minutes')
    }
    if (recording && recording.status !== 'completed') warnings.push('Recording not completed')
    if (hasErrors) warnings.push(`${fullErrorTimeline.length} error(s) recorded`)
    if (!hasManifest && isComplete) warnings.push('No evidence manifest generated')

    // Calculate duration
    const callDuration = call.started_at && call.ended_at
      ? Math.round((new Date(call.ended_at).getTime() - new Date(call.started_at).getTime()) / 1000)
      : null

    // Format AI runs
    const formattedAiRuns = (aiRuns || []).map((ar: any) => ({
      id: ar.id,
      model: ar.model,
      status: ar.status,
      started_at: ar.started_at,
      completed_at: ar.completed_at,
      duration_ms: ar.started_at && ar.completed_at
        ? new Date(ar.completed_at).getTime() - new Date(ar.started_at).getTime()
        : null,
      error: ar.status === 'failed' ? (ar.output?.error || 'Unknown error') : null
    }))

    const debugView: CallDebugView = {
      call: {
        id: call.id,
        status: call.status,
        call_sid: call.call_sid,
        started_at: call.started_at,
        ended_at: call.ended_at,
        duration_seconds: callDuration,
        created_by: call.created_by,
        is_deleted: call.is_deleted || false
      },

      recording: recording ? {
        id: recording.id,
        status: recording.status,
        source: recording.source || 'signalwire',
        duration_seconds: recording.duration_seconds,
        has_transcript: !!recording.transcript_json,
        media_hash: recording.media_hash
      } : null,

      ai_runs: formattedAiRuns,
      manifest,
      score,
      error_timeline: fullErrorTimeline,
      audit_timeline: auditTimeline,

      diagnostics: {
        has_recording: hasRecording,
        has_transcript: hasTranscript,
        has_translation: hasTranslation,
        has_score: hasScore,
        has_manifest: hasManifest,
        has_errors: hasErrors,
        is_complete: isComplete,
        completion_percentage: completionPercentage,
        warnings
      }
    }

    const queryTime = Date.now() - startTime
    logger.info('debug: generated call debug view', {
      callId,
      queryTimeMs: queryTime,
      isComplete,
      hasErrors
    })

    // Add query time to response headers
    return new NextResponse(JSON.stringify({ success: true, data: debugView }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Query-Time-Ms': queryTime.toString(),
        'X-Call-Status': call.status,
        'X-Completion-Percentage': completionPercentage.toString()
      }
    })
  } catch (err: any) {
    logger.error('GET /api/calls/[id]/debug error', err)
    return Errors.internal(err)
  }
}
