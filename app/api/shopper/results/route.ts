import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { scoreShopperCall } from '@/app/services/shopperScoring'
import { v4 as uuidv4 } from 'uuid'
import { parseRequestBody, Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

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

    const { data: callRows } = await supabaseAdmin
      .from('calls')
      .select('id, organization_id, call_sid')
      .eq('id', callId)
      .limit(1)

    const call = callRows?.[0]
    if (!call) {
      logger.warn('Shopper results: call not found', { callId })
      return Errors.notFound('Call')
    }

    const { data: recRows } = await supabaseAdmin
      .from('recordings')
      .select('id')
      .eq('call_id', callId)
      .order('created_at', { ascending: false })
      .limit(1)

    const recordingId = recRows?.[0]?.id

    let scoringResult = null
    if (recordingId) {
      scoringResult = await scoreShopperCall(callId, recordingId, orgId, scriptId || undefined)
    }

    const resultId = uuidv4()
    // Per ARCH_DOCS Schema.txt: shopper_results uses overall_score, outcome_results, evaluated_by
    // NOT: score, score_breakdown, ai_summary, conversation_log, raw_transcript, status
    const { error: insertErr } = await supabaseAdmin
      .from('shopper_results')
      .insert({
        id: resultId,
        organization_id: orgId,
        script_id: scriptId || null,
        call_id: callId,
        recording_id: recordingId || null,
        overall_score: scoringResult?.score || null,
        outcome_results: scoringResult?.details || [],
        evaluated_at: new Date().toISOString(),
        evaluated_by: 'signalwire-shopper-ai',
        notes: aiSummary || null
      })

    if (insertErr) {
      logger.error('Shopper results: failed to store results', insertErr)
    }

    await supabaseAdmin
      .from('calls')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('id', callId)

    try {
      await supabaseAdmin.from('audit_logs').insert({
        id: uuidv4(),
        organization_id: orgId,
        action: 'shopper_evaluation_complete',
        resource_type: 'shopper_result',
        resource_id: resultId,
        actor_type: 'vendor',
        actor_label: 'signalwire-shopper-ai',
        details: { call_id: callId, script_id: scriptId, overall_score: scoringResult?.score, has_recording: !!recordingId }
      })
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

    let query = supabaseAdmin
      .from('shopper_results')
      .select('*')
      .eq('organization_id', orgId)
      .order('evaluated_at', { ascending: false })
      .limit(limit)

    if (scriptId) {
      query = query.eq('script_id', scriptId)
    }

    const { data: results, error } = await query

    if (error) {
      logger.error('Shopper results GET error', error)
      return Errors.internal(error)
    }

    const scores = (results || []).filter(r => r.overall_score !== null).map(r => r.overall_score)
    const avgScore = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null

    return success({
      results: results || [],
      stats: {
        total: results?.length || 0,
        average_score: avgScore,
        passed: scores.filter(s => s >= 70).length,
        failed: scores.filter(s => s < 70).length
      }
    })

  } catch (err: any) {
    logger.error('Shopper results GET error', err)
    return Errors.internal(err)
  }
}
