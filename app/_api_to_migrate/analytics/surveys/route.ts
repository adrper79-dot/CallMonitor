import { NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { Errors, requireRole, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type SurveyRunRow = {
  output: any
  created_at: string | null
  status: string | null
  call_id: string | null
}

function parseNumericScore(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const match = value.match(/\d+/)
    if (match) {
      const num = Number.parseInt(match[0], 10)
      return Number.isFinite(num) ? num : null
    }
  }
  return null
}

function extractResponses(output: any): Array<{ digit?: string; value?: string }> {
  if (output && Array.isArray(output.responses)) return output.responses
  if (output && output.results && Array.isArray(output.results.responses)) return output.results.responses
  return []
}

function computeMetrics(rows: SurveyRunRow[]) {
  const scoreCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let scoreTotal = 0
  let scoreSamples = 0
  let responseRateTotal = 0
  let responseRateSamples = 0

  const dayCounts: Record<string, number> = {}

  rows.forEach((row) => {
    const responses = extractResponses(row.output)
    responses.forEach((response) => {
      const score = parseNumericScore(response.digit ?? response.value)
      if (score !== null) {
        scoreTotal += score
        scoreSamples += 1
        if (score >= 1 && score <= 5) {
          scoreCounts[score] = (scoreCounts[score] || 0) + 1
        }
      }
    })

    const totalQuestions = Number(row.output?.total_questions ?? responses.length)
    const answeredQuestions = Number(row.output?.questions_answered ?? responses.length)
    if (Number.isFinite(totalQuestions) && totalQuestions > 0) {
      responseRateTotal += Math.min(answeredQuestions, totalQuestions) / totalQuestions
      responseRateSamples += 1
    }

    if (row.created_at) {
      const key = row.created_at.slice(0, 10)
      dayCounts[key] = (dayCounts[key] || 0) + 1
    }
  })

  const avgScore = scoreSamples ? Number((scoreTotal / scoreSamples).toFixed(2)) : null
  const responseRate = responseRateSamples
    ? Number(((responseRateTotal / responseRateSamples) * 100).toFixed(1))
    : null

  const trend7d = Array.from({ length: 7 }, (_, idx) => {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() - (6 - idx))
    const key = date.toISOString().slice(0, 10)
    return { date: key, count: dayCounts[key] || 0 }
  })

  return {
    total_surveys: rows.length,
    avg_score: avgScore,
    response_rate: responseRate,
    score_distribution: scoreCounts,
    trend_7d: trend7d
  }
}

export async function GET() {
  try {
    const ctx = await requireRole(['owner', 'admin', 'analyst'])
    if (ctx instanceof NextResponse) return ctx

    // Use JOIN to get surveys for organization calls
    const { rows: surveys } = await query(
      `SELECT ar.output, ar.created_at, ar.status, ar.call_id
       FROM ai_runs ar
       JOIN calls c ON ar.call_id = c.id
       WHERE c.organization_id = $1
         AND ar.model IN ('laml-dtmf-survey', 'signalwire-ai-survey', 'assemblyai-survey')
         AND ar.status = 'completed'
       ORDER BY ar.created_at DESC
       LIMIT 500`,
      [ctx.orgId]
    )

    const metrics = computeMetrics((surveys || []) as SurveyRunRow[])
    return success({ metrics })
  } catch (err: any) {
    logger.error('Survey analytics: failed to compute metrics', err)
    return Errors.internal(err instanceof Error ? err : new Error('Failed to compute survey metrics'))
  }
}
