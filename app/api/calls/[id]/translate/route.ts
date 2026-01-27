import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireAuth } from '@/lib/api/utils'
import { ApiErrors } from '@/lib/errors/apiHandler'
import { logger } from '@/lib/logger'
import { translateText } from '@/app/services/translation'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

/**
 * POST /api/calls/[id]/translate
 * 
 * Manually trigger translation for a call's transcript.
 * Useful when:
 * - Translation wasn't enabled during the call
 * - Translation failed and needs to be retried
 * - User wants to translate to a different language
 * 
 * Body: {
 *   toLanguage: string (e.g., 'es', 'fr', 'de')
 *   fromLanguage?: string (optional, auto-detected from transcript)
 *   useVoiceCloning?: boolean (optional, default false)
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) {
      return ctx
    }

    const { id: callId } = await params

    if (!callId || !/^[0-9a-fA-F-]{36}$/.test(callId)) {
      return ApiErrors.badRequest('Invalid call ID')
    }

    // RBAC: Only Owner, Admin, or Operator can trigger translations
    // Viewer and Analyst roles are read-only per ARCH_DOCS RBAC model
    const { data: membership } = await supabaseAdmin
      .from('org_members')
      .select('role')
      .eq('organization_id', ctx.orgId)
      .eq('user_id', ctx.userId)
      .single()

    const userRole = membership?.role || 'viewer'
    if (!['owner', 'admin', 'operator'].includes(userRole)) {
      logger.warn('Translate POST: unauthorized role attempt', { userId: ctx.userId, role: userRole })
      return ApiErrors.forbidden()
    }

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
    const { data: callRow, error: callErr } = await supabaseAdmin
      .from('calls')
      .select('id, organization_id, status')
      .eq('id', callId)
      .eq('organization_id', ctx.orgId)
      .single()

    if (callErr || !callRow) {
      return ApiErrors.notFound('Call not found')
    }

    // Get transcript from recordings or ai_runs
    let transcriptText: string | null = null
    let detectedLanguage: string | null = null
    let recordingUrl: string | null = null

    // First check recordings table
    const { data: recordings } = await supabaseAdmin
      .from('recordings')
      .select('id, transcript_json, recording_url')
      .eq('call_id', callId)
      .limit(1)

    if (recordings && recordings.length > 0 && recordings[0].transcript_json) {
      const transcript = recordings[0].transcript_json as Record<string, any>
      transcriptText = transcript.text || null
      detectedLanguage = transcript.language_code || null
      recordingUrl = recordings[0].recording_url
    }

    // Fallback to ai_runs if no recording transcript
    if (!transcriptText) {
      const { data: aiRuns } = await supabaseAdmin
        .from('ai_runs')
        .select('id, output')
        .eq('call_id', callId)
        .in('model', ['assemblyai-v1', 'assemblyai-upload'])
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)

      if (aiRuns && aiRuns.length > 0) {
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
    const { data: existingTranslation } = await supabaseAdmin
      .from('ai_runs')
      .select('id, status, output')
      .eq('call_id', callId)
      .eq('model', 'assemblyai-translation')
      .limit(10)

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
    const { data: systemsRows } = await supabaseAdmin
      .from('systems')
      .select('id')
      .eq('key', 'system-ai')
      .limit(1)

    const systemAiId = systemsRows?.[0]?.id

    // Intent capture: Record intent:translation_requested BEFORE execution (ARCH_DOCS compliance)
    // "You initiate intent. We orchestrate execution."
    const translationRunId = uuidv4()
    try {
      await supabaseAdmin.from('audit_logs').insert({
        id: uuidv4(),
        organization_id: ctx.orgId,
        user_id: ctx.userId,
        system_id: systemAiId || null,
        resource_type: 'ai_runs',
        resource_id: translationRunId,
        action: 'intent:translation_requested',
        before: null,
        after: {
          call_id: callId,
          from_language: sourceLanguage,
          to_language: toLanguage,
          provider: 'openai',
          triggered_by: 'manual',
          declared_at: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      })
    } catch (__) {}

    // Create translation ai_run entry
    const { error: insertErr } = await supabaseAdmin
      .from('ai_runs')
      .insert({
        id: translationRunId,
        call_id: callId,
        system_id: systemAiId || null,
        model: 'assemblyai-translation',
        status: 'queued',
        started_at: new Date().toISOString(),
        output: {
          from_language: sourceLanguage,
          to_language: toLanguage,
          source_text: transcriptText,
          detected_language: detectedLanguage,
          triggered_by: 'manual'
        }
      })

    if (insertErr) {
      logger.error('Failed to create translation ai_run', insertErr, { callId, translationRunId })
      return ApiErrors.internal('Failed to create translation job')
    }

    // Trigger translation asynchronously (don't wait)
    translateText({
      callId,
      translationRunId,
      text: transcriptText,
      fromLanguage: sourceLanguage,
      toLanguage: toLanguage,
      organizationId: ctx.orgId,
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) {
      return ctx
    }

    const { id: callId } = await params

    if (!callId || !/^[0-9a-fA-F-]{36}$/.test(callId)) {
      return ApiErrors.badRequest('Invalid call ID')
    }

    // Verify call belongs to user's organization
    const { data: callRow } = await supabaseAdmin
      .from('calls')
      .select('id, organization_id')
      .eq('id', callId)
      .eq('organization_id', ctx.orgId)
      .single()

    if (!callRow) {
      return ApiErrors.notFound('Call not found')
    }

    // Get all translations for this call
    const { data: translations, error } = await supabaseAdmin
      .from('ai_runs')
      .select('id, status, started_at, completed_at, output')
      .eq('call_id', callId)
      .eq('model', 'assemblyai-translation')
      .order('started_at', { ascending: false })

    if (error) {
      return ApiErrors.internal('Failed to fetch translations')
    }

    const formattedTranslations = (translations || []).map((t: any) => {
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
