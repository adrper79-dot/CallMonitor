import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { scoreShopperCall, ScoringResult } from '@/app/services/shopperScoring'
import { v4 as uuidv4 } from 'uuid'
import { parseRequestBody, Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/shopper/results
 * Receives results from SignalWire AI Agent after secret shopper call completes.
 */
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const callId = url.searchParams.get('callId')
    const scriptId = url.searchParams.get('scriptId')
    const orgId = url.searchParams.get('orgId')

    const payload = await parseRequestBody(req)

    logger.info('Shopper results: received', {
      callId, scriptId, orgId,
      hasPayload: !!payload,
      payloadKeys: Object.keys(payload)
    })

    if (!callId || !orgId) {
      return Errors.badRequest('Missing callId or orgId')
    }

    const conversation = payload.conversation || payload.messages || []
    const aiSummary = payload.summary || payload.result || ''
    const rawTranscript = payload.transcript || ''

    const { rows: callRows } = await query(
      `SELECT id, organization_id, call_sid FROM calls WHERE id = $1 LIMIT 1`,
      [callId]
    )

    const call = callRows?.[0]
    if (!call) {
      logger.warn('Shopper results: call not found', { callId })
      return Errors.notFound('Call')
    }

    const { rows: recRows } = await query(
      `SELECT id FROM recordings WHERE call_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [callId]
    )

    const recordingId = recRows?.[0]?.id

    let scoringResult: ScoringResult | null = null
    if (recordingId) {
      scoringResult = await scoreShopperCall(callId, recordingId, orgId, scriptId || undefined)
    }

    const resultId = uuidv4()
    // Per ARCH_DOCS Schema.txt: shopper_results uses overall_score, outcome_results, evaluated_by
    await query(
      `INSERT INTO shopper_results (
        id, organization_id, script_id, call_id, recording_id, 
        overall_score, outcome_results, evaluated_at, evaluated_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)`,
      [
        resultId,
        orgId,
        scriptId || null,
        callId,
        recordingId || null,
        scoringResult?.score || null,
        JSON.stringify(scoringResult?.details || []),
        'signalwire-shopper-ai',
        aiSummary || null
      ]
    )

    await query(
      `UPDATE calls SET status = 'completed', ended_at = NOW() WHERE id = $1`,
      [callId]
    )

    try {
      await query(
        `INSERT INTO audit_logs (
          id, organization_id, action, resource_type, resource_id, actor_type, 
          actor_label, after, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          uuidv4(),
          orgId,
          'shopper_evaluation_complete',
          'shopper_result',
          resultId,
          'vendor',
          'signalwire-shopper-ai',
          JSON.stringify({ call_id: callId, script_id: scriptId, overall_score: scoringResult?.score, has_recording: !!recordingId })
        ]
      )
    } catch { /* Best effort */ }

    logger.info('Shopper results: completed', {
      callId, resultId, overall_score: scoringResult?.score, hasRecording: !!recordingId
    })

    return success({
      result_id: resultId,
      overall_score: scoringResult?.score || null,
      outcome_results: scoringResult?.details || []
    })

  } catch (err: any) {
    logger.error('Shopper results error', err)
    return Errors.internal(err)
  }
}

/**
 * GET /api/shopper/results - Fetch shopper results for an organization
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const orgId = url.searchParams.get('orgId')
    const scriptId = url.searchParams.get('scriptId')
    const limit = parseInt(url.searchParams.get('limit') || '20')

    if (!orgId) {
      return Errors.badRequest('orgId required')
    }

    let queryStr = `SELECT * FROM shopper_results WHERE organization_id = $1`
    const params: any[] = [orgId]

    if (scriptId) {
      queryStr += ` AND script_id = $${params.length + 1}`
      params.push(scriptId)
    }

    queryStr += ` ORDER BY evaluated_at DESC LIMIT $${params.length + 1}`
    params.push(limit)

    const { rows: results } = await query(queryStr, params)

    const scores = (results || []).filter((r: any) => r.overall_score !== null).map((r: any) => r.overall_score)
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
      : null

    return success({
      results: results || [],
      stats: {
        total: results?.length || 0,
        average_score: avgScore,
        passed: scores.filter((s: number) => s >= 70).length,
        failed: scores.filter((s: number) => s < 70).length
      }
    })

  } catch (err: any) {
    logger.error('Shopper results GET error', err)
    return Errors.internal(err)
  }
}
