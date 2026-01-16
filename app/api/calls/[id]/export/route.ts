import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import JSZip from 'jszip'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireAuth, Errors } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Call Export Endpoint - SYSTEM OF RECORD COMPLIANCE (Requirement 10)
 * 
 * Generates a self-contained, deterministic export bundle for a call.
 * Bundle includes:
 * - Call metadata
 * - Recording reference
 * - Transcript(s) with version history
 * - Translation(s)
 * - Scores
 * - Evidence manifest(s)
 * 
 * Export is reproducible from DB state alone.
 */

export interface CallExportBundle {
  bundle_id: string
  bundle_version: '1.0'
  bundle_hash: string
  exported_at: string
  exported_by: string | null
  
  call: {
    id: string
    organization_id: string
    status: string
    call_sid: string | null
    started_at: string | null
    ended_at: string | null
    created_by: string | null
    created_at: string
  }
  
  recording: {
    id: string
    recording_url: string | null
    duration_seconds: number | null
    status: string
    source: string
    media_hash: string | null
    created_at: string
  } | null
  
  transcripts: Array<{
    id: string
    version: number
    text: string | null
    confidence: number | null
    transcript_hash: string
    produced_by: string
    produced_by_model: string | null
    produced_at: string
  }>
  
  translations: Array<{
    id: string
    from_language: string | null
    to_language: string | null
    translated_text: string | null
    produced_by: string
    produced_at: string
  }>
  
  scores: Array<{
    id: string
    scorecard_id: string
    total_score: number
    scores_json: Record<string, any>
    manual_overrides_json: Record<string, any> | null
    created_at: string
  }>
  
  evidence_manifests: Array<{
    id: string
    version: number
    manifest: Record<string, any>
    created_at: string
  }>
  
  audit_trail: Array<{
    action: string
    resource_type: string
    created_at: string
    actor_type: 'user' | 'system'
  }>
  
  provenance: Array<{
    artifact_type: string
    artifact_id: string
    produced_by: string
    produced_at: string
    input_refs: Array<{ type: string; id: string }> | null
  }>
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // SECURITY: Require authentication
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) {
      return ctx
    }

    const callId = params.id
    
    // Validate UUID format (strict UUIDv4 pattern)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callId)) {
      return Errors.badRequest('Invalid call ID format')
    }

    logger.info('callExport: starting export', { callId, userId: ctx.userId })

    // 1. Get call
    const { data: callRows, error: callErr } = await supabaseAdmin
      .from('calls')
      .select('*')
      .eq('id', callId)
      .limit(1)

    if (callErr || !callRows?.[0]) {
      logger.warn('callExport: call not found', { callId })
      return Errors.notFound('Call not found')
    }

    const call = callRows[0]

    // SECURITY: Verify user has access to this call's organization
    const { data: memberRows } = await supabaseAdmin
      .from('org_members')
      .select('id')
      .eq('organization_id', call.organization_id)
      .eq('user_id', ctx.userId)
      .limit(1)

    if (!memberRows?.[0]) {
      logger.warn('callExport: unauthorized access attempt', { callId, userId: ctx.userId })
      return Errors.forbidden('Not authorized to export this call')
    }

    // 2. Get recording (handle null call_sid gracefully)
    let recording = null
    if (call.call_sid) {
      const { data: recRows } = await supabaseAdmin
        .from('recordings')
        .select('id, recording_url, duration_seconds, status, source, media_hash, created_at, call_sid')
        .eq('call_sid', call.call_sid)
        .limit(1)
      recording = recRows?.[0] || null
    }

    // 3. Get transcript versions (prefer versioned table, fallback to recordings.transcript_json)
    const transcripts: CallExportBundle['transcripts'] = []
    
    if (recording) {
      // Try transcript_versions table first
      const { data: tvRows } = await supabaseAdmin
        .from('transcript_versions')
        .select('id, version, transcript_json, transcript_hash, produced_by, produced_by_model, created_at')
        .eq('recording_id', recording.id)
        .order('version', { ascending: true })

      if (tvRows && tvRows.length > 0) {
        for (const tv of tvRows) {
          transcripts.push({
            id: tv.id,
            version: tv.version,
            text: tv.transcript_json?.text || null,
            confidence: tv.transcript_json?.confidence || null,
            transcript_hash: tv.transcript_hash,
            produced_by: tv.produced_by,
            produced_by_model: tv.produced_by_model,
            produced_at: tv.created_at
          })
        }
      } else {
        // Fallback to recordings.transcript_json
        const { data: recTranscript } = await supabaseAdmin
          .from('recordings')
          .select('transcript_json, created_at')
          .eq('id', recording.id)
          .limit(1)

        if (recTranscript?.[0]?.transcript_json) {
          const tj = recTranscript[0].transcript_json
          const hash = crypto.createHash('sha256')
            .update(JSON.stringify(tj))
            .digest('hex')
          
          transcripts.push({
            id: `${recording.id}-transcript-v1`,
            version: 1,
            text: tj.text || null,
            confidence: tj.confidence || null,
            transcript_hash: hash,
            produced_by: 'model',
            produced_by_model: 'assemblyai-v1',
            produced_at: recTranscript[0].created_at
          })
        }
      }
    }

    // 4. Get translations from ai_runs
    const translations: CallExportBundle['translations'] = []
    const { data: translationRows } = await supabaseAdmin
      .from('ai_runs')
      .select('id, output, completed_at')
      .eq('call_id', callId)
      .ilike('model', '%translation%')
      .eq('status', 'completed')

    if (translationRows) {
      for (const tr of translationRows) {
        translations.push({
          id: tr.id,
          from_language: tr.output?.from_language || tr.output?.translate_from || null,
          to_language: tr.output?.to_language || tr.output?.translate_to || null,
          translated_text: tr.output?.translated_text || null,
          produced_by: 'model',
          produced_at: tr.completed_at || new Date().toISOString()
        })
      }
    }

    // 5. Get scores
    const scores: CallExportBundle['scores'] = []
    if (recording) {
      const { data: scoreRows } = await supabaseAdmin
        .from('scored_recordings')
        .select('id, scorecard_id, total_score, scores_json, manual_overrides_json, created_at')
        .eq('recording_id', recording.id)

      if (scoreRows) {
        for (const sr of scoreRows) {
          scores.push({
            id: sr.id,
            scorecard_id: sr.scorecard_id,
            total_score: sr.total_score,
            scores_json: sr.scores_json || {},
            manual_overrides_json: sr.manual_overrides_json || null,
            created_at: sr.created_at
          })
        }
      }
    }

    // 6. Get evidence manifests
    const evidenceManifests: CallExportBundle['evidence_manifests'] = []
    if (recording) {
      const { data: manifestRows } = await supabaseAdmin
        .from('evidence_manifests')
        .select('id, version, manifest, created_at')
        .eq('recording_id', recording.id)
        .order('version', { ascending: true })

      if (manifestRows) {
        for (const em of manifestRows) {
          evidenceManifests.push({
            id: em.id,
            version: em.version || 1,
            manifest: em.manifest || {},
            created_at: em.created_at
          })
        }
      }
    }

    // 7. Get audit trail
    const auditTrail: CallExportBundle['audit_trail'] = []
    const { data: auditRows } = await supabaseAdmin
      .from('audit_logs')
      .select('action, resource_type, user_id, system_id, created_at')
      .or(`resource_id.eq.${callId},resource_id.eq.${recording?.id || 'none'}`)
      .order('created_at', { ascending: true })

    if (auditRows) {
      for (const al of auditRows) {
        auditTrail.push({
          action: al.action,
          resource_type: al.resource_type,
          created_at: al.created_at,
          actor_type: al.user_id ? 'user' : 'system'
        })
      }
    }

    // 8. Get provenance chain
    const provenance: CallExportBundle['provenance'] = []
    if (recording) {
      const { data: provRows } = await supabaseAdmin
        .from('artifact_provenance')
        .select('artifact_type, artifact_id, produced_by, produced_at, input_refs')
        .or(`artifact_id.eq.${recording.id},artifact_id.eq.${callId}`)
        .order('produced_at', { ascending: true })

      if (provRows) {
        for (const p of provRows) {
          provenance.push({
            artifact_type: p.artifact_type,
            artifact_id: p.artifact_id,
            produced_by: p.produced_by,
            produced_at: p.produced_at,
            input_refs: p.input_refs || null
          })
        }
      }
    }

    // Build bundle
    const bundle: CallExportBundle = {
      bundle_id: uuidv4(),
      bundle_version: '1.0',
      bundle_hash: '', // Will be computed
      exported_at: new Date().toISOString(),
      exported_by: ctx.userId,
      
      call: {
        id: call.id,
        organization_id: call.organization_id,
        status: call.status,
        call_sid: call.call_sid,
        started_at: call.started_at,
        ended_at: call.ended_at,
        created_by: call.created_by,
        created_at: call.created_at || call.started_at || new Date().toISOString()
      },
      
      recording: recording ? {
        id: recording.id,
        recording_url: recording.recording_url,
        duration_seconds: recording.duration_seconds,
        status: recording.status,
        source: recording.source || 'signalwire',
        media_hash: recording.media_hash,
        created_at: recording.created_at
      } : null,
      
      transcripts,
      translations,
      scores,
      evidence_manifests: evidenceManifests,
      audit_trail: auditTrail,
      provenance
    }

    // Compute bundle hash (excluding the hash itself)
    const bundleForHash = { ...bundle, bundle_hash: '' }
    const bundleHash = crypto.createHash('sha256')
      .update(JSON.stringify(bundleForHash, Object.keys(bundleForHash).sort()))
      .digest('hex')
    bundle.bundle_hash = `sha256:${bundleHash}`

    // Store export record
    try {
      await supabaseAdmin.from('call_export_bundles').insert({
        id: bundle.bundle_id,
        organization_id: call.organization_id,
        call_id: callId,
        bundle_hash: bundle.bundle_hash,
        artifacts_included: {
          has_recording: !!recording,
          transcript_count: transcripts.length,
          translation_count: translations.length,
          score_count: scores.length,
          manifest_count: evidenceManifests.length,
          audit_count: auditTrail.length
        },
        exported_by: ctx.userId,
        exported_at: bundle.exported_at
      })
    } catch (storeErr) {
      // Non-fatal - export still succeeds
      logger.warn('callExport: could not store export record', { error: String(storeErr) })
    }

    // Audit log
    try {
      await supabaseAdmin.from('audit_logs').insert({
        id: uuidv4(),
        organization_id: call.organization_id,
        user_id: ctx.userId,
        resource_type: 'call_export_bundles',
        resource_id: bundle.bundle_id,
        action: 'create',
        before: null,
        after: {
          call_id: callId,
          bundle_hash: bundle.bundle_hash,
          artifact_count: transcripts.length + translations.length + scores.length + evidenceManifests.length
        },
        created_at: new Date().toISOString()
      })
    } catch (auditErr) {
      // Best-effort
    }

    logger.info('callExport: export complete', {
      callId,
      bundleId: bundle.bundle_id,
      bundleHash: bundle.bundle_hash,
      artifactCount: transcripts.length + translations.length + scores.length
    })

    // Check if ZIP format requested
    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format')
    
    if (format === 'zip') {
      // Generate ZIP bundle with human-readable files
      const zip = new JSZip()
      
      // 1. transcript.txt - Human-readable transcript
      if (transcripts.length > 0) {
        const latestTranscript = transcripts[transcripts.length - 1]
        const transcriptText = formatTranscriptForHumans(latestTranscript)
        zip.file('transcript.txt', transcriptText)
      }
      
      // 2. timeline.json - Full event timeline with provenance
      const timeline = buildTimeline(bundle)
      zip.file('timeline.json', JSON.stringify(timeline, null, 2))
      
      // 3. manifest.json - Evidence manifest
      if (evidenceManifests.length > 0) {
        zip.file('manifest.json', JSON.stringify(evidenceManifests[evidenceManifests.length - 1], null, 2))
      } else {
        // Create synthetic manifest from bundle
        zip.file('manifest.json', JSON.stringify({
          bundle_id: bundle.bundle_id,
          bundle_hash: bundle.bundle_hash,
          call_id: callId,
          exported_at: bundle.exported_at
        }, null, 2))
      }
      
      // 4. README.txt - Human-readable summary
      const readme = generateReadme(bundle, ctx.userId)
      zip.file('README.txt', readme)
      
      // 5. full_bundle.json - Complete bundle for programmatic use
      zip.file('full_bundle.json', JSON.stringify(bundle, null, 2))
      
      // Generate ZIP as blob for response
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      
      return new NextResponse(zipBlob, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="call-${callId}-evidence.zip"`,
          'X-Bundle-Hash': bundle.bundle_hash,
          'X-Bundle-Version': bundle.bundle_version
        }
      })
    }

    // Return bundle as JSON with appropriate headers (default)
    return new NextResponse(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="call-export-${callId}.json"`,
        'X-Bundle-Hash': bundle.bundle_hash,
        'X-Bundle-Version': bundle.bundle_version
      }
    })
  } catch (err: any) {
    logger.error('callExport: error', err)
    return Errors.internal(err)
  }
}

// ========== Helper Functions for ZIP Export ==========

function formatTranscriptForHumans(transcript: {
  text: string | null
  confidence: number | null
  produced_by: string
  produced_by_model: string | null
  produced_at: string
  version: number
}): string {
  const lines: string[] = []
  
  lines.push('=' .repeat(60))
  lines.push('CANONICAL TRANSCRIPT')
  lines.push('=' .repeat(60))
  lines.push('')
  lines.push(`Version: ${transcript.version}`)
  lines.push(`Produced by: ${transcript.produced_by_model || transcript.produced_by}`)
  lines.push(`Produced at: ${new Date(transcript.produced_at).toLocaleString()}`)
  if (transcript.confidence) {
    lines.push(`Confidence: ${(transcript.confidence * 100).toFixed(1)}%`)
  }
  lines.push('')
  lines.push('-'.repeat(60))
  lines.push('')
  lines.push(transcript.text || '(No transcript text available)')
  lines.push('')
  lines.push('-'.repeat(60))
  lines.push('')
  lines.push('This transcript is the canonical source of truth.')
  lines.push('It is immutable and cannot be modified after creation.')
  
  return lines.join('\n')
}

function buildTimeline(bundle: CallExportBundle): Array<{
  timestamp: string
  event_type: string
  description: string
  artifact_id?: string
  producer?: string
  is_authoritative: boolean
}> {
  const events: Array<{
    timestamp: string
    event_type: string
    description: string
    artifact_id?: string
    producer?: string
    is_authoritative: boolean
  }> = []
  
  // Call created
  events.push({
    timestamp: bundle.call.created_at,
    event_type: 'call_created',
    description: 'Call initiated',
    artifact_id: bundle.call.id,
    producer: 'system',
    is_authoritative: true
  })
  
  // Call started
  if (bundle.call.started_at) {
    events.push({
      timestamp: bundle.call.started_at,
      event_type: 'call_started',
      description: 'Call answered',
      artifact_id: bundle.call.id,
      producer: 'system',
      is_authoritative: true
    })
  }
  
  // Recording
  if (bundle.recording) {
    events.push({
      timestamp: bundle.recording.created_at,
      event_type: 'recording_created',
      description: `Source recording captured (${bundle.recording.duration_seconds || 0}s)`,
      artifact_id: bundle.recording.id,
      producer: bundle.recording.source,
      is_authoritative: true
    })
  }
  
  // Transcripts
  for (const t of bundle.transcripts) {
    events.push({
      timestamp: t.produced_at,
      event_type: 'transcript_created',
      description: `Canonical transcript v${t.version} produced`,
      artifact_id: t.id,
      producer: t.produced_by_model || t.produced_by,
      is_authoritative: true
    })
  }
  
  // Translations
  for (const t of bundle.translations) {
    events.push({
      timestamp: t.produced_at,
      event_type: 'translation_created',
      description: `Translation ${t.from_language || '?'} → ${t.to_language || '?'}`,
      artifact_id: t.id,
      producer: t.produced_by,
      is_authoritative: true
    })
  }
  
  // Scores
  for (const s of bundle.scores) {
    events.push({
      timestamp: s.created_at,
      event_type: 'score_created',
      description: `Call scored: ${s.total_score} points`,
      artifact_id: s.id,
      producer: 'system',
      is_authoritative: true
    })
  }
  
  // Evidence manifests
  for (const m of bundle.evidence_manifests) {
    events.push({
      timestamp: m.created_at,
      event_type: 'manifest_created',
      description: `Evidence manifest v${m.version} created`,
      artifact_id: m.id,
      producer: 'system_cas',
      is_authoritative: true
    })
  }
  
  // Call ended
  if (bundle.call.ended_at) {
    events.push({
      timestamp: bundle.call.ended_at,
      event_type: 'call_ended',
      description: `Call ended (status: ${bundle.call.status})`,
      artifact_id: bundle.call.id,
      producer: 'system',
      is_authoritative: true
    })
  }
  
  // Export
  events.push({
    timestamp: bundle.exported_at,
    event_type: 'bundle_exported',
    description: 'Evidence bundle exported',
    artifact_id: bundle.bundle_id,
    producer: 'system',
    is_authoritative: true
  })
  
  // Sort chronologically
  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

function generateReadme(bundle: CallExportBundle, exportedBy: string | null): string {
  const lines: string[] = []
  
  lines.push('CALL EVIDENCE BUNDLE')
  lines.push('=' .repeat(60))
  lines.push('')
  lines.push(`Call ID: ${bundle.call.id}`)
  lines.push(`Status: ${bundle.call.status}`)
  if (bundle.call.started_at) {
    lines.push(`Date: ${new Date(bundle.call.started_at).toLocaleString()}`)
  }
  if (bundle.recording?.duration_seconds) {
    const mins = Math.floor(bundle.recording.duration_seconds / 60)
    const secs = bundle.recording.duration_seconds % 60
    lines.push(`Duration: ${mins}:${secs.toString().padStart(2, '0')}`)
  }
  lines.push('')
  
  lines.push('CONTENTS')
  lines.push('-'.repeat(60))
  lines.push('- transcript.txt    : Canonical transcript (human-readable)')
  lines.push('- timeline.json     : Full event timeline with provenance')
  lines.push('- manifest.json     : Evidence manifest')
  lines.push('- full_bundle.json  : Complete bundle (programmatic)')
  lines.push('- README.txt        : This file')
  lines.push('')
  
  lines.push('ARTIFACT SUMMARY')
  lines.push('-'.repeat(60))
  lines.push(`- Recording: ${bundle.recording ? 'Yes' : 'No'}`)
  lines.push(`- Transcripts: ${bundle.transcripts.length}`)
  lines.push(`- Translations: ${bundle.translations.length}`)
  lines.push(`- Scores: ${bundle.scores.length}`)
  lines.push(`- Evidence Manifests: ${bundle.evidence_manifests.length}`)
  lines.push('')
  
  lines.push('AUTHORITY')
  lines.push('-'.repeat(60))
  lines.push('All artifacts in this bundle are authoritative and legally defensible.')
  if (bundle.transcripts.length > 0) {
    const t = bundle.transcripts[bundle.transcripts.length - 1]
    lines.push(`Transcript produced by: ${t.produced_by_model || t.produced_by}`)
  }
  if (bundle.recording) {
    lines.push(`Recording source: ${bundle.recording.source}`)
    lines.push('Recording is immutable and cannot be modified.')
  }
  lines.push('')
  
  lines.push('PROVENANCE')
  lines.push('-'.repeat(60))
  lines.push('See timeline.json for full creation details of each artifact.')
  lines.push(`Bundle hash: ${bundle.bundle_hash}`)
  lines.push('')
  
  lines.push('EXPORT INFORMATION')
  lines.push('-'.repeat(60))
  lines.push(`Exported by: ${exportedBy || 'system'}`)
  lines.push(`Export time: ${bundle.exported_at}`)
  lines.push(`Bundle version: ${bundle.bundle_version}`)
  lines.push('')
  
  lines.push('=' .repeat(60))
  lines.push('This bundle was generated by Word Is Bond System of Record')
  lines.push('https://voxsouth.online')
  
  return lines.join('\n')
}
