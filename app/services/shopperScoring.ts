import { query } from '@/lib/pgClient'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

/**
 * Secret Shopper Scoring Service
 * Auto-scores secret shopper calls based on expected outcomes.
 */

export interface ExpectedOutcome {
  type: 'duration_min' | 'duration_max' | 'keyword' | 'sentiment' | 'response_time'
  value: any
  weight?: number
}

export interface ScoringResult {
  score: number // 0-100
  details: Array<{
    outcome: ExpectedOutcome
    passed: boolean
    weight: number
    reason: string
  }>
}

const DEFAULT_OUTCOMES: ExpectedOutcome[] = [
  { type: 'duration_min', value: 30, weight: 20 },
  { type: 'keyword', value: ['appointment', 'available', 'schedule', 'help'], weight: 30 },
  { type: 'sentiment', value: 'positive', weight: 50 }
]

async function getExpectedOutcomes(organizationId: string, scriptId?: string): Promise<ExpectedOutcome[]> {
  try {
    if (scriptId) {
      const { rows: scriptRows } = await query(
        `SELECT expected_outcomes FROM shopper_scripts WHERE id = $1 LIMIT 1`,
        [scriptId]
      )

      if (scriptRows?.[0]?.expected_outcomes) {
        return scriptRows[0].expected_outcomes as ExpectedOutcome[]
      }
    }

    const { rows: configRows } = await query(
      `SELECT shopper_expected_outcomes FROM voice_configs 
       WHERE organization_id = $1 AND shopper_expected_outcomes IS NOT NULL 
       LIMIT 1`,
      [organizationId]
    )

    if (configRows?.[0]?.shopper_expected_outcomes) {
      return configRows[0].shopper_expected_outcomes as ExpectedOutcome[]
    }

    return DEFAULT_OUTCOMES
  } catch (err) {
    logger.error('getExpectedOutcomes error', err)
    return DEFAULT_OUTCOMES
  }
}

export async function scoreShopperCall(
  callId: string,
  recordingId: string,
  organizationId: string,
  scriptId?: string
): Promise<ScoringResult | null> {
  try {
    const { rows: callRows } = await query(
      `SELECT started_at, ended_at, status FROM calls WHERE id = $1 LIMIT 1`,
      [callId]
    )

    const call = callRows?.[0]
    if (!call) return null

    const { rows: recRows } = await query(
      `SELECT duration_seconds, transcript_json FROM recordings WHERE id = $1 LIMIT 1`,
      [recordingId]
    )

    const recording = recRows?.[0]
    if (!recording) return null

    const expectedOutcomes = await getExpectedOutcomes(organizationId, scriptId)

    const details: ScoringResult['details'] = []
    let totalScore = 0
    let totalWeight = 0

    for (const outcome of expectedOutcomes) {
      const weight = outcome.weight || 1
      totalWeight += weight

      let passed = false
      let reason = ''

      switch (outcome.type) {
        case 'duration_min':
          const duration = recording.duration_seconds || 0
          passed = duration >= outcome.value
          reason = `Call duration: ${duration}s (required: ${outcome.value}s)`
          break

        case 'duration_max':
          const maxDuration = recording.duration_seconds || 0
          passed = maxDuration <= outcome.value
          reason = `Call duration: ${maxDuration}s (max: ${outcome.value}s)`
          break

        case 'keyword':
          const transcript = recording.transcript_json?.text || ''
          const keywords = Array.isArray(outcome.value) ? outcome.value : [outcome.value]
          const foundKeywords = keywords.filter((kw: string) =>
            transcript.toLowerCase().includes(kw.toLowerCase())
          )
          passed = foundKeywords.length > 0
          reason = `Keywords found: ${foundKeywords.length}/${keywords.length} (${foundKeywords.join(', ')})`
          break

        case 'sentiment':
          const sentiment = recording.transcript_json?.sentiment || 'neutral'
          passed = sentiment === outcome.value ||
            (outcome.value === 'positive' && ['positive', 'very_positive'].includes(sentiment))
          reason = `Sentiment: ${sentiment} (required: ${outcome.value})`
          break

        case 'response_time':
          passed = true
          reason = 'Response time check not implemented'
          break
      }

      details.push({ outcome, passed, weight, reason })

      if (passed) {
        totalScore += weight
      }
    }

    const finalScore = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0

    const result: ScoringResult = { score: finalScore, details }

    const { rows: systemsRows } = await query(
      `SELECT id FROM systems WHERE key = 'system-ai' LIMIT 1`,
      []
    )

    const systemAiId = systemsRows?.[0]?.id
    if (systemAiId) {
      await query(
        `INSERT INTO ai_runs (
          id, call_id, system_id, model, status, completed_at, 
          produced_by, is_authoritative, output
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          uuidv4(),
          callId,
          systemAiId,
          'shopper-scoring',
          'completed',
          new Date().toISOString(),
          'model',
          true,
          JSON.stringify({ score: finalScore, details, expected_outcomes: expectedOutcomes })
        ]
      )
    }

    return result
  } catch (err: any) {
    logger.error('shopperScoring error', err, { callId, recordingId })
    return null
  }
}
