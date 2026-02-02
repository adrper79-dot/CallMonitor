import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireRole } from '@/lib/rbac-server'
import { logger } from '@/lib/logger'
import { ApiErrors } from '@/lib/errors/apiHandler'
import { isValidUUID } from '@/lib/utils/validation'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole('viewer')
    const organizationId = session.user.organizationId
    const callId = params.id

    // Validate UUID format early to prevent DB errors
    if (!isValidUUID(callId)) {
      return ApiErrors.badRequest('Invalid call ID format')
    }

    // Fetch call with organization_id filter for tenant isolation
    const { rows: calls } = await query(
      `SELECT * FROM calls WHERE id = $1 AND organization_id = $2`,
      [callId, organizationId]
    )
    const call = calls[0]

    if (!call) {
      return ApiErrors.notFound('Call not found')
    }

    // Fetch recording if exists - try call_id first (per migration), fallback to call_sid
    let recording: { [key: string]: any } | null = null

    if (call.id) {
      const { rows: recByCallId } = await query(
        `SELECT * FROM recordings WHERE call_id = $1 LIMIT 1`,
        [call.id]
      )
      if (recByCallId.length > 0) {
        recording = recByCallId[0]
      }
    }

    if (!recording && call.call_sid) {
      // Fallback to call_sid
      const { rows: recByCallSid } = await query(
        `SELECT * FROM recordings WHERE call_sid = $1 LIMIT 1`,
        [call.call_sid]
      )
      if (recByCallSid.length > 0) {
        recording = recByCallSid[0]
      }
    }

    // Fetch dependencies in parallel
    const [aiRunsResult, manifestResult, scoreResult] = await Promise.all([
      query(`SELECT * FROM ai_runs WHERE call_id = $1`, [callId]),
      recording ? query(`SELECT * FROM evidence_manifests WHERE recording_id = $1`, [recording.id]) : { rows: [] },
      recording ? query(`SELECT * FROM scored_recordings WHERE recording_id = $1`, [recording.id]) : { rows: [] }
    ])

    const aiRuns = aiRunsResult.rows
    const manifest = manifestResult.rows[0] || null
    const score = scoreResult.rows[0] || null

    // Look for AssemblyAI transcription runs - models used are 'assemblyai-v1' or 'assemblyai-upload'
    const transcriptRun = aiRuns.find((r: any) =>
      r.model === 'assemblyai-v1' ||
      r.model === 'assemblyai-upload' ||
      r.model?.includes('transcription')
    )
    const translation = aiRuns.find((r: any) => r.model?.includes('translation'))
    const survey = aiRuns.find((r: any) => r.model?.includes('survey'))

    // Extract transcript content and status
    const transcript = transcriptRun?.output?.transcript || transcriptRun?.output || recording?.transcript_json || null
    const transcriptionStatus = transcriptRun?.status || null

    return NextResponse.json({
      success: true,
      call,
      recording: recording || null,
      transcript,
      transcriptionStatus,
      translation: translation?.output || null,
      manifest: manifest || null,
      score: score || null,
      survey: survey?.output || null,
    })
  } catch (err: any) {
    logger.error('GET /api/calls/[id] error', err)
    return ApiErrors.internal(err?.message || 'Failed to fetch call details')
  }
}
