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

    // Get recording and transcript (include call_sid for manifest generation)
    const { data: recRows } = await supabaseAdmin
      .from('recordings')
      .select('id, transcript_json, duration_seconds, call_sid')
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

    // Generate new evidence manifest version with scoring included
    // SYSTEM OF RECORD COMPLIANCE: Never update existing manifests, create new version
    try {
      const { generateEvidenceManifest, recordArtifactProvenance } = await import('./evidenceManifest')
      
      // Get call_id from recording
      const { data: callRows } = await supabaseAdmin
        .from('calls')
        .select('id')
        .eq('call_sid', recording.call_sid || '')
        .limit(1)
      
      // Also try to get from recordings table directly if call_sid lookup fails
      let callId = callRows?.[0]?.id
      if (!callId) {
        const { data: recCallRows } = await supabaseAdmin
          .from('recordings')
          .select('call_sid')
          .eq('id', recordingId)
          .limit(1)
        
        if (recCallRows?.[0]?.call_sid) {
          const { data: callBySid } = await supabaseAdmin
            .from('calls')
            .select('id')
            .eq('call_sid', recCallRows[0].call_sid)
            .limit(1)
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
    } catch (manifestErr) {
      // Non-fatal - scoring still succeeded
      logger.warn('scoring: could not generate evidence manifest', manifestErr, { recordingId })
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
