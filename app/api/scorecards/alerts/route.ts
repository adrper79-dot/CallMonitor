import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireAuth, Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

    const { rows } = await query(
      `SELECT 
        sr.id, sr.recording_id, sr.scorecard_id, sr.total_score, sr.scores_json, sr.created_at,
        s.name as scorecard_name, s.structure,
        r.call_sid,
        c.id as call_id
       FROM scored_recordings sr
       JOIN scorecards s ON sr.scorecard_id = s.id
       JOIN recordings r ON sr.recording_id = r.id
       LEFT JOIN calls c ON r.call_sid = c.call_sid
       WHERE sr.organization_id = $1
       ORDER BY sr.created_at DESC
       LIMIT 30`,
      [ctx.orgId]
    )

    const alerts = (rows || []).map((row) => {
      const criteria: Criteria[] = (row.structure as any)?.criteria || []
      const failures = criteria
        .map((criterion) => ({
          id: criterion.id,
          name: criterion.name,
          value: row.scores_json?.[criterion.id],
          failed: isCriteriaFailed(row.scores_json?.[criterion.id], criterion)
        }))
        .filter((item) => item.failed)

      return {
        id: row.id,
        scorecard_id: row.scorecard_id,
        scorecard_name: row.scorecard_name || 'Scorecard',
        total_score: row.total_score,
        failures,
        recording_id: row.recording_id,
        call_id: row.call_id || null,
        created_at: row.created_at
      }
    }).filter((alert) => alert.failures.length > 0 || (alert.total_score ?? 100) < 80)

    return success({ alerts })
  } catch (err: any) {
    logger.error('GET /api/scorecards/alerts error', err)
    return Errors.internal(err)
  }
}
