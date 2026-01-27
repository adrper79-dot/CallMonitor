import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireAuth, Errors, success } from '@/lib/api/utils'
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

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    const callId = params.id
    const startTime = Date.now()

    // Fetch call with org verification
    const { data: call, error: callError } = await supabaseAdmin
      .from('calls')
      .select('*')
      .eq('id', callId)
      .eq('organization_id', ctx.orgId)
      .single()

    if (callError || !call) {
      return Errors.notFound('Call not found')
    }

    // Fetch recording
    const { data: recording } = await supabaseAdmin
      .from('recordings')
      .select('id, status, source, duration_seconds, transcript_json, media_hash, is_deleted')
      .eq('call_sid', call.call_sid)
      .single()

    // Fetch AI runs
    const { data: aiRuns } = await supabaseAdmin
      .from('ai_runs')
      .select('id, model, status, started_at, completed_at, output')
      .eq('call_id', callId)
      .order('started_at', { ascending: true })

    // Fetch evidence manifest (current version)
    let manifest: { id: string; version: number; artifact_count: number; manifest_hash: string; created_at: string } | null = null
    if (recording) {
      const { data: manifestRow } = await supabaseAdmin
        .from('evidence_manifests')
        .select('id, version, manifest, created_at')
        .eq('recording_id', recording.id)
        .is('superseded_at', null)
        .order('version', { ascending: false })
        .limit(1)
        .single()

      if (manifestRow) {
        manifest = {
          id: manifestRow.id,
          version: manifestRow.version || 1,
          artifact_count: manifestRow.manifest?.artifacts?.length || 0,
          manifest_hash: manifestRow.manifest?.manifest_hash || '',
          created_at: manifestRow.created_at
        }
      }
    }

    // Fetch score
    let score: { id: string; scorecard_id: string; total_score: number; has_manual_overrides: boolean } | null = null
    if (recording) {
      const { data: scoreRow } = await supabaseAdmin
        .from('scored_recordings')
        .select('id, scorecard_id, total_score, manual_overrides_json')
        .eq('recording_id', recording.id)
        .single()

      if (scoreRow) {
        score = {
          id: scoreRow.id,
          scorecard_id: scoreRow.scorecard_id,
          total_score: scoreRow.total_score,
          has_manual_overrides: !!scoreRow.manual_overrides_json
        }
      }
    }

    // Fetch error timeline (errors only from audit logs)
    const { data: errorLogs } = await supabaseAdmin
      .from('audit_logs')
      .select('created_at, action, after, resource_type, resource_id')
      .eq('resource_id', callId)
      .eq('action', 'error')
      .order('created_at', { ascending: true })

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
    const { data: auditLogs } = await supabaseAdmin
      .from('audit_logs')
      .select('created_at, action, user_id, system_id, resource_type, after')
      .or(`resource_id.eq.${callId},resource_id.eq.${recording?.id || '00000000-0000-0000-0000-000000000000'}`)
      .order('created_at', { ascending: true })
      .limit(100)

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
