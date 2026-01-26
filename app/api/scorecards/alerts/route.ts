import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireAuth, Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Criteria = {
  id: string
  name: string
  type: 'numeric' | 'boolean' | 'text'
  min?: number
  max?: number
  weight: number
}

function isCriteriaFailed(value: any, criterion: Criteria): boolean {
  if (value === null || value === undefined) return true
  if (criterion.type === 'boolean') return value !== 1
  const min = criterion.min ?? (criterion.type === 'text' ? 70 : 80)
  if (typeof value === 'number') return value < min
  return false
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    const { data: scoredRows, error } = await supabaseAdmin
      .from('scored_recordings')
      .select('id, recording_id, scorecard_id, total_score, scores_json, created_at')
      .eq('organization_id', ctx.orgId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) throw error

    if (!scoredRows?.length) {
      return success({ alerts: [] })
    }

    const scorecardIds = Array.from(new Set(scoredRows.map((row) => row.scorecard_id).filter(Boolean)))
    const recordingIds = Array.from(new Set(scoredRows.map((row) => row.recording_id)))

    const { data: scorecards } = await supabaseAdmin
      .from('scorecards')
      .select('id, name, structure')
      .in('id', scorecardIds.length ? scorecardIds : ['00000000-0000-0000-0000-000000000000'])

    const { data: recordings } = await supabaseAdmin
      .from('recordings')
      .select('id, call_sid')
      .in('id', recordingIds)

    const callSids = Array.from(new Set((recordings || []).map((rec) => rec.call_sid).filter(Boolean)))
    const { data: calls } = await supabaseAdmin
      .from('calls')
      .select('id, call_sid')
      .in('call_sid', callSids.length ? callSids : [''])

    const callIdBySid = new Map((calls || []).map((call) => [call.call_sid, call.id]))
    const recordingById = new Map((recordings || []).map((rec) => [rec.id, rec]))
    const scorecardById = new Map((scorecards || []).map((card) => [card.id, card]))

    const alerts = scoredRows.map((row) => {
      const scorecard = scorecardById.get(row.scorecard_id)
      const criteria: Criteria[] = (scorecard as any)?.structure?.criteria || []
      const failures = criteria
        .map((criterion) => ({
          id: criterion.id,
          name: criterion.name,
          value: row.scores_json?.[criterion.id],
          failed: isCriteriaFailed(row.scores_json?.[criterion.id], criterion)
        }))
        .filter((item) => item.failed)

      const recording = recordingById.get(row.recording_id)
      const callId = (recording as any)?.call_sid ? callIdBySid.get((recording as any).call_sid) : null

      return {
        id: row.id,
        scorecard_id: row.scorecard_id,
        scorecard_name: (scorecard as any)?.name || 'Scorecard',
        total_score: row.total_score,
        failures,
        recording_id: row.recording_id,
        call_id: callId || null,
        created_at: row.created_at
      }
    }).filter((alert) => alert.failures.length > 0 || (alert.total_score ?? 100) < 80)

    return success({ alerts })
  } catch (err: any) {
    logger.error('GET /api/scorecards/alerts error', err)
    return Errors.internal(err)
  }
}
