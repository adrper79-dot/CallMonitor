import { query } from '@/lib/pgClient'
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
    const { rows: scorecardRows } = await query(
      `SELECT id, structure FROM scorecards WHERE id = $1 AND organization_id = $2 LIMIT 1`,
      [scorecardId, organizationId]
    )

    const scorecard = scorecardRows?.[0]
    if (!scorecard) {
      return null
    }

    const structure: ScorecardStructure = scorecard.structure as any

    // Get recording and transcript (include call_sid for manifest generation)
    const { rows: recRows } = await query(
      `SELECT id, transcript_json, duration_seconds, call_sid FROM recordings WHERE id = $1 LIMIT 1`,
      [recordingId]
    )

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
    const { rows: existingRows } = await query(
      `SELECT id FROM scored_recordings WHERE recording_id = $1 AND scorecard_id = $2 LIMIT 1`,
      [recordingId, scorecardId]
    )

    const scoredRecordingId = existingRows?.[0]?.id || uuidv4()
    const now = new Date().toISOString()

    if (existingRows?.[0]) {
      // Update existing
      await query(
        `UPDATE scored_recordings 
         SET scores_json = $1, total_score = $2, updated_at = $3
         WHERE id = $4`,
        [JSON.stringify(scores), totalScore, now, scoredRecordingId]
      )
    } else {
      // Insert new
      await query(
        `INSERT INTO scored_recordings (
          id, organization_id, recording_id, scorecard_id, scores_json, 
          total_score, manual_overrides_json, updated_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
        [
          scoredRecordingId,
          organizationId,
          recordingId,
          scorecardId,
          JSON.stringify(scores),
          totalScore,
          null, // manual_overrides_json
          now
        ]
      )
    }

    // Generate new evidence manifest version with scoring included
    // SYSTEM OF RECORD COMPLIANCE: Never update existing manifests, create new version
    try {
      const { generateEvidenceManifest, recordArtifactProvenance } = await import('./evidenceManifest')

      // Get call_id from recording
      const { rows: callRows } = await query(
        `SELECT id FROM calls WHERE call_sid = $1 LIMIT 1`,
        [recording.call_sid || '']
      )

      // Also try to get from recordings table directly if call_sid lookup fails
      let callId = callRows?.[0]?.id
      if (!callId) {
        // Since we already fetched recording, we might check if recording has call_id (if schema supports it)
        // Or re-query if recording row didn't include it (original select didn't include call_id)
        const { rows: recCallRows } = await query(
          `SELECT call_id, call_sid FROM recordings WHERE id = $1 LIMIT 1`,
          [recordingId]
        )

        // If recording has call_id, use it
        if (recCallRows?.[0]?.call_id) {
          callId = recCallRows[0].call_id
        } else if (recCallRows?.[0]?.call_sid) {
          // Fallback to call_sid again if needed
          const { rows: callBySid } = await query(
            `SELECT id FROM calls WHERE call_sid = $1 LIMIT 1`,
            [recCallRows[0].call_sid]
          )
          callId = callBySid?.[0]?.id
        }
      }

      if (callId) {
        // This creates a new manifest version (v2+) with scoring included
        await generateEvidenceManifest(callId, recordingId, organizationId, scorecardId)
      }

      // Record score provenance
      await recordArtifactProvenance(organizationId, 'score', scoredRecordingId, {
        produced_by: 'model',
        produced_by_model: 'qise-v1',
        parent_artifact_id: recordingId,
        parent_artifact_type: 'recording',
        input_refs: [
          { type: 'recording', id: recordingId },
          { type: 'scorecard', id: scorecardId }
        ],
        version: 1,
        metadata: { total_score: totalScore }
      })
    } catch (manifestErr: any) {
      // Non-fatal - scoring still succeeded
      logger.warn('scoring: could not generate evidence manifest', { error: manifestErr?.message || String(manifestErr), recordingId })
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
    // Check if recording exists
    const { rows: recRows } = await query(
      `SELECT id FROM recordings WHERE id = $1 LIMIT 1`,
      [recordingId]
    )

    if (!recRows || recRows.length === 0) {
      return
    }

    // Get call to find scorecard assignment (could be on call, campaign, or organization level)
    // For now, check if organization has a default scorecard
    const { rows: scorecardRows } = await query(
      `SELECT id FROM scorecards WHERE organization_id = $1 AND is_template = false LIMIT 1`,
      [organizationId]
    )

    if (scorecardRows?.[0]) {
      await scoreRecording(recordingId, scorecardRows[0].id, organizationId)
    }
  } catch (err: any) {
    logger.error('autoScoreRecordingIfNeeded: error', err, { recordingId })
  }
}
