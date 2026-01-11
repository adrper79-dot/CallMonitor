import supabaseAdmin from '@/lib/supabaseAdmin'

/**
 * Secret Shopper Scoring Service
 * 
 * Auto-scores secret shopper calls based on expected outcomes.
 * Per MASTER_ARCHITECTURE.txt: Secret shopper is a call modulation.
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

/**
 * Score a secret shopper call based on expected outcomes
 */
export async function scoreShopperCall(
  callId: string,
  recordingId: string,
  organizationId: string
): Promise<ScoringResult | null> {
  try {
    // Get call details
    const { data: callRows } = await supabaseAdmin
      .from('calls')
      .select('started_at, ended_at, status')
      .eq('id', callId)
      .limit(1)

    const call = callRows?.[0]
    if (!call) {
      return null
    }

    // Get recording details
    const { data: recRows } = await supabaseAdmin
      .from('recordings')
      .select('duration_seconds, transcript_json')
      .eq('id', recordingId)
      .limit(1)

    const recording = recRows?.[0]
    if (!recording) {
      return null
    }

    // Get expected outcomes from voice_configs or shopper_campaigns
    // For now, we'll use default outcomes or fetch from voice_configs JSONB
    const expectedOutcomes: ExpectedOutcome[] = [
      { type: 'duration_min', value: 30, weight: 20 }, // Minimum 30 seconds
      { type: 'keyword', value: ['appointment', 'available', 'schedule'], weight: 30 }, // Key phrases
      { type: 'sentiment', value: 'positive', weight: 50 } // Positive sentiment
    ]

    const details: ScoringResult['details'] = []
    let totalScore = 0
    let totalWeight = 0

    // Check each expected outcome
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
          const foundKeywords = keywords.filter(kw => 
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
          // Response time would need to be tracked separately
          passed = true // Placeholder
          reason = 'Response time check not implemented'
          break
      }

      details.push({
        outcome,
        passed,
        weight,
        reason
      })

      if (passed) {
        totalScore += weight
      }
    }

    // Calculate final score (0-100)
    const finalScore = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0

    const result: ScoringResult = {
      score: finalScore,
      details
    }

    // Store score in shopper_results if table exists, or in evidence manifest
    // For now, we'll store it in ai_runs with type='shopper-scoring'
    const { data: systemsRows } = await supabaseAdmin
      .from('systems')
      .select('id')
      .eq('key', 'system-ai')
      .limit(1)

    const systemAiId = systemsRows?.[0]?.id
    if (systemAiId) {
      await supabaseAdmin
        .from('ai_runs')
        .insert({
          id: require('uuid').v4(),
          call_id: callId,
          system_id: systemAiId,
          model: 'shopper-scoring',
          status: 'completed',
          completed_at: new Date().toISOString(),
          output: {
            score: finalScore,
            details,
            expected_outcomes: expectedOutcomes
          }
        })
    }

    return result
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('shopperScoring: error', { error: err?.message, callId, recordingId })
    return null
  }
}
