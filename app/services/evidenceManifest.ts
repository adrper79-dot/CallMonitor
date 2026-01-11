import { v4 as uuidv4 } from 'uuid'
import supabaseAdmin from '@/lib/supabaseAdmin'
import crypto from 'crypto'

/**
 * Evidence Manifest Service
 * 
 * Generates immutable evidence manifests that link all call artifacts:
 * - Recording
 * - Transcript
 * - Translation (if enabled)
 * - Survey responses (if enabled)
 * - Scores (if available)
 * 
 * Per MASTER_ARCHITECTURE.txt: Evidence manifests are immutable once finalized
 * and provide complete provenance for audit/export use cases.
 */

export interface ArtifactReference {
  type: 'recording' | 'transcript' | 'translation' | 'survey' | 'score'
  id: string
  uri?: string
  sha256?: string
  metadata?: Record<string, any>
}

export interface EvidenceManifestData {
  manifest_id: string
  created_at: string
  call_id: string
  organization_id: string
  artifacts: ArtifactReference[]
  manifest_hash: string
  producer: string
  version: string
  provenance?: {
    recording_source?: string
    transcription_model?: string
    translation_model?: string
    survey_processor?: string
    scoring_engine?: string
  }
}

/**
 * Generate evidence manifest for a call
 * 
 * @param callId - The call ID
 * @param recordingId - The recording ID (required)
 * @param organizationId - The organization ID
 * @param scorecardId - Optional scorecard ID if scoring was performed
 * @returns The generated manifest ID
 */
export async function generateEvidenceManifest(
  callId: string,
  recordingId: string,
  organizationId: string,
  scorecardId?: string | null
): Promise<string> {
  try {
    // Check if manifest already exists for this recording
    const { data: existing } = await supabaseAdmin
      .from('evidence_manifests')
      .select('id')
      .eq('recording_id', recordingId)
      .limit(1)

    if (existing && existing.length > 0) {
      // Manifest already exists - return existing ID
      // eslint-disable-next-line no-console
      console.log('evidenceManifest: manifest already exists', { manifestId: existing[0].id, recordingId })
      return existing[0].id
    }

    // Gather all artifacts for this call
    const artifacts: ArtifactReference[] = []
    const provenance: EvidenceManifestData['provenance'] = {}

    // 1. Recording artifact
    const { data: recRows } = await supabaseAdmin
      .from('recordings')
      .select('id, recording_url, duration_seconds, status, created_at')
      .eq('id', recordingId)
      .limit(1)

    const recording = recRows?.[0]
    if (recording) {
      artifacts.push({
        type: 'recording',
        id: recording.id,
        uri: recording.recording_url,
        metadata: {
          duration_seconds: recording.duration_seconds,
          status: recording.status,
          created_at: recording.created_at
        }
      })
      provenance.recording_source = 'signalwire'
    }

    // 2. Transcript artifact (from recordings.transcript_json or ai_runs)
    const { data: transcriptRows } = await supabaseAdmin
      .from('recordings')
      .select('transcript_json')
      .eq('id', recordingId)
      .limit(1)

    if (transcriptRows?.[0]?.transcript_json) {
      const transcript = transcriptRows[0].transcript_json
      artifacts.push({
        type: 'transcript',
        id: `${recordingId}-transcript`,
        metadata: {
          text: transcript.text,
          confidence: transcript.confidence,
          transcript_id: transcript.transcript_id,
          completed_at: transcript.completed_at
        }
      })
      provenance.transcription_model = 'assemblyai-v1'
    }

    // 3. Translation artifact (from ai_runs with model='assemblyai-translation')
    const { data: translationRows } = await supabaseAdmin
      .from('ai_runs')
      .select('id, output, model, completed_at')
      .eq('call_id', callId)
      .eq('model', 'assemblyai-translation')
      .eq('status', 'completed')
      .limit(1)

    if (translationRows && translationRows.length > 0) {
      const translation = translationRows[0]
      artifacts.push({
        type: 'translation',
        id: translation.id,
        metadata: {
          from_language: translation.output?.from_language,
          to_language: translation.output?.to_language,
          translated_text: translation.output?.translated_text,
          completed_at: translation.completed_at
        }
      })
      provenance.translation_model = 'assemblyai-translation'
    }

    // 4. Survey artifact (from evidence_manifests or ai_runs with survey data)
    // Survey data might be stored in the manifest itself or in a separate table
    // For now, we'll check if there's survey data in voice_configs or ai_runs
    const { data: surveyRows } = await supabaseAdmin
      .from('ai_runs')
      .select('id, output')
      .eq('call_id', callId)
      .contains('output', { type: 'survey' })
      .limit(1)

    if (surveyRows && surveyRows.length > 0) {
      const survey = surveyRows[0]
      artifacts.push({
        type: 'survey',
        id: survey.id,
        metadata: {
          responses: survey.output?.responses,
          score: survey.output?.score,
          completed_at: survey.output?.completed_at
        }
      })
      provenance.survey_processor = 'assemblyai-nlp'
    }

    // 5. Score artifact (from scored_recordings)
    if (scorecardId) {
      const { data: scoreRows } = await supabaseAdmin
        .from('scored_recordings')
        .select('id, scores_json, total_score, created_at')
        .eq('recording_id', recordingId)
        .eq('scorecard_id', scorecardId)
        .limit(1)

      if (scoreRows && scoreRows.length > 0) {
        const score = scoreRows[0]
        artifacts.push({
          type: 'score',
          id: score.id,
          metadata: {
            scores: score.scores_json,
            total_score: score.total_score,
            created_at: score.created_at
          }
        })
        provenance.scoring_engine = 'qise-v1'
      }
    }

    // Build manifest data
    const manifestId = uuidv4()
    const createdAt = new Date().toISOString()
    const manifestData: EvidenceManifestData = {
      manifest_id: manifestId,
      created_at: createdAt,
      call_id: callId,
      organization_id: organizationId,
      artifacts,
      manifest_hash: '', // Will calculate below
      producer: 'call_monitor_v1',
      version: '1.0',
      provenance
    }

    // Calculate manifest hash (SHA256 of sorted JSON)
    const manifestJson = JSON.stringify(manifestData, Object.keys(manifestData).sort())
    const hash = crypto.createHash('sha256').update(manifestJson).digest('hex')
    manifestData.manifest_hash = `sha256:${hash}`

    // Store in evidence_manifests table
    const { error: insertErr } = await supabaseAdmin
      .from('evidence_manifests')
      .insert({
        id: manifestId,
        organization_id: organizationId,
        recording_id: recordingId,
        scorecard_id: scorecardId || null,
        manifest: manifestData,
        created_at: createdAt
      })

    if (insertErr) {
      // eslint-disable-next-line no-console
      console.error('evidenceManifest: failed to insert manifest', { error: insertErr.message, callId, recordingId })
      throw new Error(`Failed to store evidence manifest: ${insertErr.message}`)
    }

    // eslint-disable-next-line no-console
    console.log('evidenceManifest: generated manifest', { manifestId, callId, recordingId, artifactCount: artifacts.length })

    return manifestId
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('evidenceManifest: generation error', { error: err?.message, callId, recordingId })
    throw err
  }
}

/**
 * Check if all required artifacts are complete for a call
 * and trigger manifest generation if ready
 */
export async function checkAndGenerateManifest(
  callId: string,
  recordingId: string,
  organizationId: string
): Promise<string | null> {
  try {
    // Check if recording is completed
    const { data: recRows } = await supabaseAdmin
      .from('recordings')
      .select('status, transcript_json')
      .eq('id', recordingId)
      .limit(1)

    const recording = recRows?.[0]
    if (!recording || recording.status !== 'completed') {
      // Recording not ready
      return null
    }

    // Check if transcription is complete (if enabled)
    const { data: vcRows } = await supabaseAdmin
      .from('voice_configs')
      .select('transcribe')
      .eq('organization_id', organizationId)
      .limit(1)

    const shouldHaveTranscript = vcRows?.[0]?.transcribe === true
    if (shouldHaveTranscript && !recording.transcript_json) {
      // Transcript not ready yet
      return null
    }

    // All required artifacts are ready - generate manifest
    return await generateEvidenceManifest(callId, recordingId, organizationId)
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('evidenceManifest: check error', { error: err?.message, callId, recordingId })
    return null
  }
}
