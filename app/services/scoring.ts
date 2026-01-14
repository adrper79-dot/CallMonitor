import supabaseAdmin from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'

/**
 * Scoring System
 * 
 * Processes transcripts and recordings to generate scored_recordings.
 * Links to evidence manifests per MASTER_ARCHITECTURE.txt
 */

export interface ScorecardStructure {
  criteria: Array<{
    id: string
    name: string
    weight: number
    type: 'numeric' | 'boolean' | 'text'
    min?: number
    max?: number
  }>
}

export interface ScoringResult {
  scorecard_id: string
  scores_json: Record<string, any>
  total_score: number
  manual_overrides_json?: Record<string, any>
}

/**
 * Score a recording using a scorecard
 */
export async function scoreRecording(
  recordingId: string,
  scorecardId: string,
  organizationId: string
): Promise<ScoringResult | null> {
  try {
    // Get scorecard
    const { data: scorecardRows } = await supabaseAdmin
      .from('scorecards')
      .select('id, structure')
      .eq('id', scorecardId)
      .eq('organization_id', organizationId)
      .limit(1)

    const scorecard = scorecardRows?.[0]
    if (!scorecard) {
      return null
    }

    const structure: ScorecardStructure = scorecard.structure as any

    // Get recording and transcript
    const { data: recRows } = await supabaseAdmin
      .from('recordings')
      .select('id, transcript_json, duration_seconds')
      .eq('id', recordingId)
      .limit(1)

    const recording = recRows?.[0]
    if (!recording) {
      return null
    }

    const transcript = recording.transcript_json?.text || ''
    const transcriptLower = transcript.toLowerCase()

    // Score each criterion
    const scores: Record<string, any> = {}
    let totalWeightedScore = 0
    let totalWeight = 0

    for (const criterion of structure.criteria) {
      let score: any = null

      // Simple scoring logic - can be enhanced with AI/NLP
      switch (criterion.type) {
        case 'boolean':
          // Check if transcript contains keywords related to criterion
          // This is a simple implementation - in production, use NLP
          score = transcriptLower.includes(criterion.name.toLowerCase()) ? 1 : 0
          break

        case 'numeric':
          // Extract numeric values or use duration/other metrics
          if (criterion.name.toLowerCase().includes('duration')) {
            const duration = recording.duration_seconds || 0
            const min = criterion.min || 0
            const max = criterion.max || 300
            score = Math.min(100, Math.max(0, ((duration - min) / (max - min)) * 100))
          } else {
            // Default: check for numeric mentions
            const matches = transcript.match(/\d+/g)
            score = matches ? Math.min(100, matches.length * 10) : 0
          }
          break

        case 'text':
          // Use keyword matching or sentiment
          const keywords = criterion.name.split(' ').filter(w => w.length > 3)
          const foundKeywords = keywords.filter(kw => transcriptLower.includes(kw.toLowerCase()))
          score = (foundKeywords.length / keywords.length) * 100
          break
      }

      scores[criterion.id] = score
      const weight = criterion.weight || 1
      totalWeightedScore += (score || 0) * weight
      totalWeight += weight
    }

    const totalScore = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0

    // Create or update scored_recording
    const { data: existingRows } = await supabaseAdmin
      .from('scored_recordings')
      .select('id')
      .eq('recording_id', recordingId)
      .eq('scorecard_id', scorecardId)
      .limit(1)

    const scoredRecordingId = existingRows?.[0]?.id || uuidv4()

    const scoredRecording = {
      id: scoredRecordingId,
      organization_id: organizationId,
      recording_id: recordingId,
      scorecard_id: scorecardId,
      scores_json: scores,
      total_score: totalScore,
      manual_overrides_json: null,
      updated_at: new Date().toISOString()
    }

    if (existingRows?.[0]) {
      // Update existing
      await supabaseAdmin
        .from('scored_recordings')
        .update({
          scores_json: scores,
          total_score: totalScore,
          updated_at: new Date().toISOString()
        }).eq('id', scoredRecordingId)
    } else {
      // Insert new
      await supabaseAdmin
        .from('scored_recordings')
        .insert(scoredRecording)
    }

    // Link to evidence manifest if it exists
    const { data: manifestRows } = await supabaseAdmin
      .from('evidence_manifests')
      .select('id, manifest')
      .eq('recording_id', recordingId)
      .limit(1)

    if (manifestRows?.[0]) {
      // Update manifest to include score
      const manifest = manifestRows[0].manifest as any
      manifest.scoring = {
        scorecard_id: scorecardId,
        total_score: totalScore,
        scores: scores,
        scored_at: new Date().toISOString()
      }

      await supabaseAdmin
        .from('evidence_manifests')
        .update({ manifest }).eq('id', manifestRows[0].id)
    }

    return {
      scorecard_id: scorecardId,
      scores_json: scores,
      total_score: totalScore
    }
  } catch (err: any) {
    logger.error('scoring: error', err, { recordingId, scorecardId })
    return null
  }
}

/**
 * Auto-score recording if scorecard is assigned
 */
export async function autoScoreRecordingIfNeeded(
  recordingId: string,
  organizationId: string
): Promise<void> {
  try {
    // Check if recording has an assigned scorecard
    const { data: recRows } = await supabaseAdmin
      .from('recordings')
      .select('id, call_id')
      .eq('id', recordingId)
      .limit(1)

    const recording = recRows?.[0]
    if (!recording) {
      return
    }

    // Get call to find scorecard assignment (could be on call, campaign, or organization level)
    // For now, check if organization has a default scorecard
    const { data: scorecardRows } = await supabaseAdmin
      .from('scorecards')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_template', false)
      .limit(1)

    if (scorecardRows?.[0]) {
      await scoreRecording(recordingId, scorecardRows[0].id, organizationId)
    }
  } catch (err: any) {
    logger.error('autoScoreRecordingIfNeeded: error', err, { recordingId })
  }
}
