import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { query } from '@/lib/pgClient'
import { requireRole } from '@/lib/rbac-server'
import { ApiErrors } from '@/lib/errors/apiHandler'
import { logger } from '@/lib/logger'
import { translateText } from '@/app/services/translation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/calls/[id]/translate
 * 
 * Manually trigger translation for a call's transcript.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: callId } = await params

    if (!callId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callId)) {
      return ApiErrors.badRequest('Invalid call ID')
    }

    // RBAC: Only Owner, Admin, or Operator can trigger translations
    const session = await requireRole('operator')
    const userId = session.user.id
    const organizationId = session.user.organizationId

    const body = await request.json()
    const { toLanguage, fromLanguage, useVoiceCloning } = body

    if (!toLanguage) {
      return ApiErrors.badRequest('toLanguage is required')
    }

    // Validate language code format (2-5 chars)
    if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(toLanguage)) {
      return ApiErrors.badRequest('Invalid toLanguage format. Use ISO codes like "es", "fr", "de", "zh"')
    }

    // Verify call exists and belongs to user's organization
    const { rows: callRows } = await query(
      `SELECT id, organization_id, status FROM calls WHERE id = $1 AND organization_id = $2`,
      [callId, organizationId]
    )

    if (callRows.length === 0) {
      return ApiErrors.notFound('Call not found')
    }

    // Get transcript from recordings or ai_runs
    let transcriptText: string | null = null
    let detectedLanguage: string | null = null
    let recordingUrl: string | null = null

    // First check recordings table
    const { rows: recordings } = await query(
      `SELECT id, transcript_json, recording_url FROM recordings WHERE call_id = $1 LIMIT 1`,
      [callId]
    )

    if (recordings.length > 0 && recordings[0].transcript_json) {
      const transcript = recordings[0].transcript_json as Record<string, any>
      transcriptText = transcript.text || null
      detectedLanguage = transcript.language_code || null
      recordingUrl = recordings[0].recording_url
    }

    // Fallback to ai_runs if no recording transcript
    if (!transcriptText) {
      const { rows: aiRuns } = await query(
        `SELECT id, output FROM ai_runs 
         WHERE call_id = $1 AND model IN ('assemblyai-v1', 'assemblyai-upload') AND status = 'completed'
         ORDER BY completed_at DESC LIMIT 1`,
        [callId]
      )

      if (aiRuns.length > 0) {
        const output = aiRuns[0].output as Record<string, any>
        transcriptText = output?.transcript?.text || null
        detectedLanguage = output?.transcript?.language_code || null
      }
    }

    if (!transcriptText) {
      return ApiErrors.badRequest('No transcript available for this call. Transcription must complete first.')
    }

    // Determine source language
    const sourceLanguage = fromLanguage || detectedLanguage || 'en'

    // Check if same language
    if (sourceLanguage === toLanguage) {
      return ApiErrors.badRequest('Source and target languages are the same')
    }

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return ApiErrors.serviceUnavailable('Translation service not configured')
    }

    // Check if translation already exists for this language pair
    const { rows: existingTranslation } = await query(
      `SELECT id, status, output FROM ai_runs 
       WHERE call_id = $1 AND model = 'assemblyai-translation' LIMIT 10`,
      [callId]
    )

    const existingForLanguage = existingTranslation?.find((t: any) => {
      const output = t.output as Record<string, any>
      return output?.to_language === toLanguage && t.status === 'completed'
    })

    if (existingForLanguage) {
      return NextResponse.json({
        success: true,
        message: 'Translation already exists for this language',
        translation_id: existingForLanguage.id,
        status: 'completed'
      })
    }

    // Get AI system ID
    const { rows: systemsRows } = await query(
      `SELECT id FROM systems WHERE key = 'system-ai' LIMIT 1`,
      []
    )
    const systemAiId = systemsRows[0]?.id

    // Intent capture
    const translationRunId = uuidv4()
    try {
      await query(
        `INSERT INTO audit_logs (id, organization_id, user_id, system_id, resource_type, resource_id, action, before, after, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          uuidv4(),
          organizationId,
          userId,
          systemAiId || null,
          'ai_runs',
          translationRunId,
          'intent:translation_requested',
          null,
          {
            call_id: callId,
            from_language: sourceLanguage,
            to_language: toLanguage,
            provider: 'openai',
            triggered_by: 'manual',
            declared_at: new Date().toISOString()
          }
        ]
      )
    } catch (__) { }

    // Create translation ai_run entry
    try {
      await query(
        `INSERT INTO ai_runs (id, call_id, system_id, model, status, started_at, output)
             VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
        [
          translationRunId,
          callId,
          systemAiId || null,
          'assemblyai-translation',
          'queued',
          {
            from_language: sourceLanguage,
            to_language: toLanguage,
            source_text: transcriptText,
            detected_language: detectedLanguage,
            triggered_by: 'manual'
          }
        ]
      )
    } catch (insertErr) {
      logger.error('Failed to create translation ai_run', insertErr, { callId, translationRunId })
      return ApiErrors.internal('Failed to create translation job')
    }

    // Trigger translation asynchronously
    translateText({
      callId,
      translationRunId,
      text: transcriptText,
      fromLanguage: sourceLanguage,
      toLanguage: toLanguage,
      organizationId,
      recordingUrl: recordingUrl || undefined,
      useVoiceCloning: useVoiceCloning || false
    }).catch((err) => {
      logger.error('Translation failed', err, { callId, translationRunId })
    })

    logger.info('Manual translation triggered', {
      callId,
      translationRunId,
      fromLanguage: sourceLanguage,
      toLanguage
    })

    return NextResponse.json({
      success: true,
      translation_id: translationRunId,
      status: 'queued',
      from_language: sourceLanguage,
      to_language: toLanguage,
      message: 'Translation started. Poll /api/ai-runs/{id}/status for completion.'
    })
  } catch (error: any) {
    logger.error('Translation trigger error', error)
    return ApiErrors.internal(error.message || 'Failed to trigger translation')
  }
}

/**
 * GET /api/calls/[id]/translate
 * 
 * Get all translations for a call
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: callId } = await params

    if (!callId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callId)) {
      return ApiErrors.badRequest('Invalid call ID')
    }

    // Viewer role is sufficient to read translations
    const session = await requireRole('viewer')
    const organizationId = session.user.organizationId

    // Verify call belongs to user's organization
    const { rows: callRows } = await query(
      `SELECT id FROM calls WHERE id = $1 AND organization_id = $2`,
      [callId, organizationId]
    )

    if (callRows.length === 0) {
      return ApiErrors.notFound('Call not found')
    }

    // Get all translations for this call
    const { rows: translations } = await query(
      `SELECT id, status, started_at, completed_at, output 
       FROM ai_runs 
       WHERE call_id = $1 AND model = 'assemblyai-translation' 
       ORDER BY started_at DESC`,
      [callId]
    )

    const formattedTranslations = translations.map((t: any) => {
      const output = t.output as Record<string, any>
      return {
        id: t.id,
        status: t.status,
        from_language: output?.from_language,
        to_language: output?.to_language,
        translated_text: output?.translated_text,
        audio_url: output?.translated_audio_url,
        voice_cloning_used: output?.voice_cloning_used || false,
        started_at: t.started_at,
        completed_at: t.completed_at,
        error: output?.error
      }
    })

    return NextResponse.json({
      success: true,
      call_id: callId,
      translations: formattedTranslations
    })
  } catch (error: any) {
    logger.error('Get translations error', error)
    return ApiErrors.internal(error.message || 'Failed to fetch translations')
  }
}
