import { v4 as uuidv4 } from 'uuid'
import supabaseAdmin from '@/lib/supabaseAdmin'
import crypto from 'crypto'
import { logger } from '@/lib/logger'

/**
 * Evidence Manifest Service - Generates IMMUTABLE evidence manifests for call artifacts
 * 
 * SYSTEM OF RECORD COMPLIANCE:
 * - Manifests are APPEND-ONLY (database trigger prevents updates)
 * - New versions create new rows with parent_manifest_id reference
 * - Each artifact includes produced_by, version, and input_refs
 * - All manifests are cryptographically hashed for integrity verification
 */

export interface ArtifactReference {
  type: 'recording' | 'transcript' | 'translation' | 'survey' | 'score'
  id: string
  uri?: string
  sha256?: string
  produced_by: 'system' | 'human' | 'model'
  produced_by_model?: string
  produced_by_user_id?: string
  produced_at: string
  input_refs?: Array<{ type: string; id: string; hash?: string }>
  version: number
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
  version: number
  parent_manifest_id?: string
  provenance: {
    recording_source?: string
    transcription_model?: string
    translation_model?: string
    survey_processor?: string
    scoring_engine?: string
  }
}

/**
 * Generate an IMMUTABLE evidence manifest for a call's artifacts
 * 
 * SYSTEM OF RECORD COMPLIANCE:
 * - Creates new manifest (never updates existing)
 * - If manifest exists, returns existing ID (idempotent)
 * - All artifacts include full provenance chain
 */
export async function generateEvidenceManifest(
  callId: string,
  recordingId: string,
  organizationId: string,
  scorecardId?: string | null
): Promise<string> {
  try {
    // Check for existing manifest (without scoring) - return if exists for idempotency
    const { data: existing } = await supabaseAdmin
      .from('evidence_manifests')
      .select('id, version')
      .eq('recording_id', recordingId)
      .is('superseded_at', null)
      .order('version', { ascending: false })
      .limit(1)

    // If manifest exists and no new scorecard, return existing
    if (existing?.[0] && !scorecardId) {
      logger.debug('evidenceManifest: manifest already exists', { manifestId: existing[0].id, recordingId })
      return existing[0].id
    }

    const artifacts: ArtifactReference[] = []
    const provenance: EvidenceManifestData['provenance'] = {}
    const now = new Date().toISOString()

    // Get recording with source information
    const { data: recRows } = await supabaseAdmin
      .from('recordings')
      .select('id, recording_url, duration_seconds, status, created_at, source, media_hash, created_by')
      .eq('id', recordingId)
      .limit(1)

    const recording = recRows?.[0]
    if (recording) {
      artifacts.push({
        type: 'recording',
        id: recording.id,
        uri: recording.recording_url,
        sha256: recording.media_hash || undefined,
        produced_by: 'system',
        produced_by_model: recording.source || 'signalwire',
        produced_at: recording.created_at,
        input_refs: [],
        version: 1,
        metadata: {
          duration_seconds: recording.duration_seconds,
          status: recording.status,
          source: recording.source || 'signalwire'
        }
      })
      provenance.recording_source = recording.source || 'signalwire'
    }

    // Get transcript from transcript_versions (preferred) or recordings.transcript_json (fallback)
    const { data: transcriptVersionRows } = await supabaseAdmin
      .from('transcript_versions')
      .select('id, version, transcript_json, transcript_hash, produced_by, produced_by_model, created_at')
      .eq('recording_id', recordingId)
      .order('version', { ascending: false })
      .limit(1)

    if (transcriptVersionRows?.[0]) {
      const tv = transcriptVersionRows[0]
      artifacts.push({
        type: 'transcript',
        id: tv.id,
        sha256: tv.transcript_hash,
        produced_by: tv.produced_by as 'system' | 'human' | 'model',
        produced_by_model: tv.produced_by_model,
        produced_at: tv.created_at,
        input_refs: [{ type: 'recording', id: recordingId, hash: recording?.media_hash }],
        version: tv.version,
        metadata: {
          text: tv.transcript_json?.text,
          confidence: tv.transcript_json?.confidence
        }
      })
      provenance.transcription_model = tv.produced_by_model || 'assemblyai-v1'
    } else {
      // Fallback to recordings.transcript_json
      const { data: transcriptRows } = await supabaseAdmin
        .from('recordings')
        .select('transcript_json')
        .eq('id', recordingId)
        .limit(1)

      if (transcriptRows?.[0]?.transcript_json) {
        const transcript = transcriptRows[0].transcript_json
        const transcriptHash = crypto.createHash('sha256')
          .update(JSON.stringify(transcript))
          .digest('hex')
        
        artifacts.push({
          type: 'transcript',
          id: `${recordingId}-transcript`,
          sha256: transcriptHash,
          produced_by: 'model',
          produced_by_model: 'assemblyai-v1',
          produced_at: now,
          input_refs: [{ type: 'recording', id: recordingId }],
          version: 1,
          metadata: {
            text: transcript.text,
            confidence: transcript.confidence,
            transcript_id: transcript.transcript_id
          }
        })
        provenance.transcription_model = 'assemblyai-v1'
      }
    }

    // Get translation from ai_runs
    const { data: translationRows } = await supabaseAdmin
      .from('ai_runs')
      .select('id, output, model, completed_at, system_id')
      .eq('call_id', callId)
      .ilike('model', '%translation%')
      .eq('status', 'completed')
      .limit(1)

    if (translationRows?.[0]) {
      const translation = translationRows[0]
      artifacts.push({
        type: 'translation',
        id: translation.id,
        produced_by: 'model',
        produced_by_model: translation.model,
        produced_at: translation.completed_at || now,
        input_refs: [{ type: 'transcript', id: `${recordingId}-transcript` }],
        version: 1,
        metadata: {
          from_language: translation.output?.from_language,
          to_language: translation.output?.to_language
        }
      })
      provenance.translation_model = translation.model || 'assemblyai-translation'
    }

    // Get survey from ai_runs
    const { data: surveyRows } = await supabaseAdmin
      .from('ai_runs')
      .select('id, output, completed_at')
      .eq('call_id', callId)
      .contains('output', { type: 'survey' })
      .limit(1)

    if (surveyRows?.[0]) {
      const survey = surveyRows[0]
      artifacts.push({
        type: 'survey',
        id: survey.id,
        produced_by: 'model',
        produced_by_model: 'assemblyai-nlp',
        produced_at: survey.completed_at || now,
        input_refs: [{ type: 'transcript', id: `${recordingId}-transcript` }],
        version: 1,
        metadata: { responses: survey.output?.responses }
      })
      provenance.survey_processor = 'assemblyai-nlp'
    }

    // Get score if scorecardId provided
    if (scorecardId) {
      const { data: scoreRows } = await supabaseAdmin
        .from('scored_recordings')
        .select('id, scores_json, total_score, created_at, manual_overrides_json')
        .eq('recording_id', recordingId)
        .eq('scorecard_id', scorecardId)
        .limit(1)

      if (scoreRows?.[0]) {
        const score = scoreRows[0]
        artifacts.push({
          type: 'score',
          id: score.id,
          produced_by: score.manual_overrides_json ? 'human' : 'model',
          produced_by_model: 'qise-v1',
          produced_at: score.created_at,
          input_refs: [
            { type: 'transcript', id: `${recordingId}-transcript` },
            { type: 'recording', id: recordingId }
          ],
          version: 1,
          metadata: {
            total_score: score.total_score,
            scorecard_id: scorecardId,
            has_manual_overrides: !!score.manual_overrides_json
          }
        })
        provenance.scoring_engine = 'qise-v1'
      }
    }

    // Determine version number
    const newVersion = existing?.[0]?.version ? existing[0].version + 1 : 1
    const parentManifestId = existing?.[0]?.id || null

    // Generate manifest
    const manifestId = uuidv4()
    const manifestData: EvidenceManifestData = {
      manifest_id: manifestId,
      created_at: now,
      call_id: callId,
      organization_id: organizationId,
      artifacts,
      manifest_hash: '',
      producer: 'call_monitor_v1',
      version: newVersion,
      parent_manifest_id: parentManifestId || undefined,
      provenance
    }

    // Generate cryptographic hash of manifest
    const manifestJson = JSON.stringify(manifestData, Object.keys(manifestData).sort())
    const hash = crypto.createHash('sha256').update(manifestJson).digest('hex')
    manifestData.manifest_hash = `sha256:${hash}`

    // Insert new manifest (APPEND-ONLY - database trigger prevents updates)
    const { error: insertErr } = await supabaseAdmin.from('evidence_manifests').insert({
      id: manifestId,
      organization_id: organizationId,
      recording_id: recordingId,
      scorecard_id: scorecardId || null,
      manifest: manifestData,
      created_at: now,
      version: newVersion,
      parent_manifest_id: parentManifestId
    })

    if (insertErr) {
      logger.error('evidenceManifest: failed to insert manifest', insertErr, { callId, recordingId })
      throw new Error(`Failed to store evidence manifest: ${insertErr.message}`)
    }

    // Mark previous manifest as superseded (if exists)
    if (parentManifestId) {
      // Note: This update is allowed because we're only marking supersession, not changing content
      // The trigger allows this specific operation via WHEN clause
      await supabaseAdmin.from('evidence_manifests')
        .update({ superseded_at: now, superseded_by: manifestId })
        .eq('id', parentManifestId)
        .then(() => {
          // If trigger blocks this, it's okay - the new manifest is still valid
        })
        .catch(() => {
          logger.warn('evidenceManifest: could not mark parent as superseded (trigger may prevent)', { parentManifestId })
        })
    }

    // Record provenance
    await recordArtifactProvenance(organizationId, 'evidence_manifest', manifestId, {
      produced_by: 'system',
      produced_by_system_id: null,
      input_refs: artifacts.map(a => ({ type: a.type, id: a.id, hash: a.sha256 })),
      version: newVersion,
      metadata: { artifact_count: artifacts.length }
    })

    logger.info('evidenceManifest: generated manifest', {
      manifestId,
      callId,
      recordingId,
      artifactCount: artifacts.length,
      version: newVersion
    })

    return manifestId
  } catch (err: any) {
    logger.error('evidenceManifest: generation error', err, { callId, recordingId })
    throw err
  }
}

/**
 * Check if conditions are met and generate manifest
 */
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

/**
 * Record artifact provenance for chain of custody tracking
 * 
 * SYSTEM OF RECORD COMPLIANCE:
 * - Records who/what/when/how for every artifact
 * - Immutable (database trigger prevents updates)
 */
export async function recordArtifactProvenance(
  organizationId: string,
  artifactType: 'recording' | 'transcript' | 'translation' | 'survey' | 'score' | 'evidence_manifest',
  artifactId: string,
  options: {
    produced_by: 'system' | 'human' | 'model'
    produced_by_model?: string
    produced_by_user_id?: string
    produced_by_system_id?: string | null
    parent_artifact_id?: string
    parent_artifact_type?: string
    input_refs?: Array<{ type: string; id: string; hash?: string }>
    version?: number
    metadata?: Record<string, any>
  }
): Promise<string | null> {
  try {
    const provenanceId = uuidv4()
    
    const { error } = await supabaseAdmin.from('artifact_provenance').insert({
      id: provenanceId,
      organization_id: organizationId,
      artifact_type: artifactType,
      artifact_id: artifactId,
      parent_artifact_id: options.parent_artifact_id,
      parent_artifact_type: options.parent_artifact_type,
      produced_by: options.produced_by,
      produced_by_model: options.produced_by_model,
      produced_by_user_id: options.produced_by_user_id,
      produced_by_system_id: options.produced_by_system_id,
      input_refs: options.input_refs,
      version: options.version || 1,
      metadata: options.metadata,
      produced_at: new Date().toISOString()
    })

    if (error) {
      // Table may not exist yet - log warning but don't fail
      logger.warn('evidenceManifest: could not record provenance', { error: error.message, artifactId })
      return null
    }

    return provenanceId
  } catch (err: any) {
    logger.warn('evidenceManifest: provenance recording error', err, { artifactId })
    return null
  }
}

/**
 * Create a new transcript version (immutable)
 * 
 * SYSTEM OF RECORD COMPLIANCE:
 * - Each transcript is a new versioned row
 * - Never updates existing transcripts
 * - Includes cryptographic hash and full provenance
 */
export async function createTranscriptVersion(
  recordingId: string,
  organizationId: string,
  transcriptJson: any,
  options: {
    produced_by: 'system' | 'human' | 'model'
    produced_by_model?: string
    produced_by_user_id?: string
    input_refs?: Array<{ type: string; id: string; hash?: string }>
  }
): Promise<{ id: string; version: number } | null> {
  try {
    // Get current max version
    const { data: existing } = await supabaseAdmin
      .from('transcript_versions')
      .select('version')
      .eq('recording_id', recordingId)
      .order('version', { ascending: false })
      .limit(1)

    const newVersion = (existing?.[0]?.version || 0) + 1
    const transcriptHash = crypto.createHash('sha256')
      .update(JSON.stringify(transcriptJson))
      .digest('hex')

    const versionId = uuidv4()

    const { error } = await supabaseAdmin.from('transcript_versions').insert({
      id: versionId,
      recording_id: recordingId,
      organization_id: organizationId,
      version: newVersion,
      transcript_json: transcriptJson,
      transcript_hash: transcriptHash,
      produced_by: options.produced_by,
      produced_by_model: options.produced_by_model,
      produced_by_user_id: options.produced_by_user_id,
      input_refs: options.input_refs
    })

    if (error) {
      logger.error('evidenceManifest: failed to create transcript version', error, { recordingId })
      return null
    }

    // Record provenance
    await recordArtifactProvenance(organizationId, 'transcript', versionId, {
      produced_by: options.produced_by,
      produced_by_model: options.produced_by_model,
      produced_by_user_id: options.produced_by_user_id,
      parent_artifact_id: recordingId,
      parent_artifact_type: 'recording',
      input_refs: options.input_refs,
      version: newVersion
    })

    logger.info('evidenceManifest: created transcript version', { versionId, recordingId, version: newVersion })

    return { id: versionId, version: newVersion }
  } catch (err: any) {
    logger.error('evidenceManifest: transcript version error', err, { recordingId })
    return null
  }
}
