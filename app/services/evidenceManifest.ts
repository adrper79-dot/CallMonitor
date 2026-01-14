import { v4 as uuidv4 } from 'uuid'
import supabaseAdmin from '@/lib/supabaseAdmin'
import crypto from 'crypto'
import { logger } from '@/lib/logger'

/**
 * Evidence Manifest Service - Generates immutable evidence manifests for call artifacts
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

export async function generateEvidenceManifest(
  callId: string,
  recordingId: string,
  organizationId: string,
  scorecardId?: string | null
): Promise<string> {
  try {
    const { data: existing } = await supabaseAdmin
      .from('evidence_manifests')
      .select('id')
      .eq('recording_id', recordingId)
      .limit(1)

    if (existing?.[0]) {
      logger.debug('evidenceManifest: manifest already exists', { manifestId: existing[0].id, recordingId })
      return existing[0].id
    }

    const artifacts: ArtifactReference[] = []
    const provenance: EvidenceManifestData['provenance'] = {}

    const { data: recRows } = await supabaseAdmin
      .from('recordings')
      .select('id, recording_url, duration_seconds, status, created_at')
      .eq('id', recordingId)
      .limit(1)

    const recording = recRows?.[0]
    if (recording) {
      artifacts.push({
        type: 'recording', id: recording.id, uri: recording.recording_url,
        metadata: { duration_seconds: recording.duration_seconds, status: recording.status, created_at: recording.created_at }
      })
      provenance.recording_source = 'signalwire'
    }

    const { data: transcriptRows } = await supabaseAdmin
      .from('recordings')
      .select('transcript_json')
      .eq('id', recordingId)
      .limit(1)

    if (transcriptRows?.[0]?.transcript_json) {
      const transcript = transcriptRows[0].transcript_json
      artifacts.push({
        type: 'transcript', id: `${recordingId}-transcript`,
        metadata: { text: transcript.text, confidence: transcript.confidence, transcript_id: transcript.transcript_id }
      })
      provenance.transcription_model = 'assemblyai-v1'
    }

    const { data: translationRows } = await supabaseAdmin
      .from('ai_runs')
      .select('id, output, model, completed_at')
      .eq('call_id', callId)
      .eq('model', 'assemblyai-translation')
      .eq('status', 'completed')
      .limit(1)

    if (translationRows?.[0]) {
      const translation = translationRows[0]
      artifacts.push({
        type: 'translation', id: translation.id,
        metadata: { from_language: translation.output?.from_language, to_language: translation.output?.to_language }
      })
      provenance.translation_model = 'assemblyai-translation'
    }

    const { data: surveyRows } = await supabaseAdmin
      .from('ai_runs')
      .select('id, output')
      .eq('call_id', callId)
      .contains('output', { type: 'survey' })
      .limit(1)

    if (surveyRows?.[0]) {
      const survey = surveyRows[0]
      artifacts.push({ type: 'survey', id: survey.id, metadata: { responses: survey.output?.responses } })
      provenance.survey_processor = 'assemblyai-nlp'
    }

    if (scorecardId) {
      const { data: scoreRows } = await supabaseAdmin
        .from('scored_recordings')
        .select('id, scores_json, total_score, created_at')
        .eq('recording_id', recordingId)
        .eq('scorecard_id', scorecardId)
        .limit(1)

      if (scoreRows?.[0]) {
        const score = scoreRows[0]
        artifacts.push({ type: 'score', id: score.id, metadata: { total_score: score.total_score } })
        provenance.scoring_engine = 'qise-v1'
      }
    }

    const manifestId = uuidv4()
    const createdAt = new Date().toISOString()
    const manifestData: EvidenceManifestData = {
      manifest_id: manifestId, created_at: createdAt, call_id: callId,
      organization_id: organizationId, artifacts, manifest_hash: '',
      producer: 'call_monitor_v1', version: '1.0', provenance
    }

    const manifestJson = JSON.stringify(manifestData, Object.keys(manifestData).sort())
    const hash = crypto.createHash('sha256').update(manifestJson).digest('hex')
    manifestData.manifest_hash = `sha256:${hash}`

    const { error: insertErr } = await supabaseAdmin.from('evidence_manifests').insert({
      id: manifestId, organization_id: organizationId, recording_id: recordingId,
      scorecard_id: scorecardId || null, manifest: manifestData, created_at: createdAt
    })

    if (insertErr) {
      logger.error('evidenceManifest: failed to insert manifest', insertErr, { callId, recordingId })
      throw new Error(`Failed to store evidence manifest: ${insertErr.message}`)
    }

    logger.info('evidenceManifest: generated manifest', { manifestId, callId, recordingId, artifactCount: artifacts.length })

    return manifestId
  } catch (err: any) {
    logger.error('evidenceManifest: generation error', err, { callId, recordingId })
    throw err
  }
}

export async function checkAndGenerateManifest(
  callId: string, recordingId: string, organizationId: string
): Promise<string | null> {
  try {
    const { data: recRows } = await supabaseAdmin
      .from('recordings')
      .select('status, transcript_json')
      .eq('id', recordingId)
      .limit(1)

    const recording = recRows?.[0]
    if (!recording || recording.status !== 'completed') return null

    const { data: vcRows } = await supabaseAdmin
      .from('voice_configs')
      .select('transcribe')
      .eq('organization_id', organizationId)
      .limit(1)

    const shouldHaveTranscript = vcRows?.[0]?.transcribe === true
    if (shouldHaveTranscript && !recording.transcript_json) return null

    return await generateEvidenceManifest(callId, recordingId, organizationId)
  } catch (err: any) {
    logger.error('evidenceManifest: check error', err, { callId, recordingId })
    return null
  }
}
