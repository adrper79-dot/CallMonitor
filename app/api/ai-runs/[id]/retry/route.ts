import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireAuth } from '@/lib/api/utils'
import { ApiErrors } from '@/lib/errors/apiHandler'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai-runs/[id]/retry
 * 
 * Retry a failed AI run (translation, transcription, etc.)
 * Creates a new ai_run entry and re-triggers the processing.
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

    const { id } = await params

    if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
      return ApiErrors.badRequest('Invalid AI run ID')
    }

    // Fetch the failed ai_run
    const { data: aiRun, error } = await supabaseAdmin
      .from('ai_runs')
      .select('id, call_id, model, status, output')
      .eq('id', id)
      .single()

    if (error || !aiRun) {
      return ApiErrors.notFound('AI run not found')
    }

    // Only allow retry for failed runs
    if (aiRun.status !== 'failed') {
      return ApiErrors.badRequest(`Cannot retry AI run with status: ${aiRun.status}. Only 'failed' runs can be retried.`)
    }

    // Verify ownership via call or output.organization_id
    let organizationId: string | null = null

    if (aiRun.call_id) {
      const { data: callRow } = await supabaseAdmin
        .from('calls')
        .select('organization_id')
        .eq('id', aiRun.call_id)
        .single()

      if (callRow?.organization_id !== ctx.orgId) {
        return ApiErrors.forbidden()
      }
      organizationId = callRow.organization_id
    } else {
      const output = aiRun.output as Record<string, any> | null
      if (output?.organization_id && output.organization_id !== ctx.orgId) {
        return ApiErrors.forbidden()
      }
      organizationId = output?.organization_id || ctx.orgId
    }

    const output = aiRun.output as Record<string, any> | null

    // Handle retry based on model type
    if (aiRun.model === 'assemblyai-translation') {
      // Retry translation
      if (!process.env.OPENAI_API_KEY) {
        return ApiErrors.serviceUnavailable('Translation service not configured')
      }

      const sourceText = output?.source_text
      if (!sourceText) {
        return ApiErrors.badRequest('Original source text not found. Cannot retry translation.')
      }

      // Reset the ai_run to queued status
      await supabaseAdmin
        .from('ai_runs')
        .update({
          status: 'queued',
          started_at: new Date().toISOString(),
          completed_at: null,
          output: {
            ...output,
            error: null,
            retry_count: (output?.retry_count || 0) + 1,
            retried_at: new Date().toISOString()
          }
        })
        .eq('id', id)

      // Re-trigger translation
      const { translateText } = await import('@/app/services/translation')
      
      translateText({
        callId: aiRun.call_id || '',
        translationRunId: id,
        text: sourceText,
        fromLanguage: output?.from_language || 'en',
        toLanguage: output?.to_language || 'es',
        organizationId: organizationId!,
        recordingUrl: output?.recording_url,
        useVoiceCloning: output?.voice_cloning_requested || false
      }).catch((err) => {
        logger.error('Translation retry failed', err, { aiRunId: id })
      })

      logger.info('Translation retry triggered', { aiRunId: id })

      return NextResponse.json({
        success: true,
        ai_run_id: id,
        status: 'queued',
        message: 'Translation retry started'
      })
    } else if (aiRun.model?.includes('assemblyai') && aiRun.model !== 'assemblyai-translation') {
      // Retry transcription - need recording URL
      const recordingUrl = output?.recording_url || output?.audio_url

      if (!recordingUrl) {
        return ApiErrors.badRequest('Recording URL not found. Cannot retry transcription.')
      }

      if (!process.env.ASSEMBLYAI_API_KEY) {
        return ApiErrors.serviceUnavailable('Transcription service not configured')
      }

      // Reset the ai_run to queued status
      await supabaseAdmin
        .from('ai_runs')
        .update({
          status: 'queued',
          started_at: new Date().toISOString(),
          completed_at: null,
          output: {
            ...output,
            error: null,
            retry_count: (output?.retry_count || 0) + 1,
            retried_at: new Date().toISOString()
          }
        })
        .eq('id', id)

      // Submit to AssemblyAI
      const assemblyRes = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          'Authorization': process.env.ASSEMBLYAI_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audio_url: recordingUrl,
          language_detection: true,
          webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/assemblyai`
        })
      })

      if (!assemblyRes.ok) {
        const errorData = await assemblyRes.json()
        await supabaseAdmin
          .from('ai_runs')
          .update({
            status: 'failed',
            output: { ...output, error: errorData.error || 'AssemblyAI submission failed' }
          })
          .eq('id', id)
        
        return ApiErrors.internal('Failed to resubmit to AssemblyAI')
      }

      const assemblyData = await assemblyRes.json()

      await supabaseAdmin
        .from('ai_runs')
        .update({
          status: 'processing',
          output: {
            ...output,
            job_id: assemblyData.id,
            assemblyai_status: assemblyData.status
          }
        })
        .eq('id', id)

      logger.info('Transcription retry triggered', { aiRunId: id, assemblyaiId: assemblyData.id })

      return NextResponse.json({
        success: true,
        ai_run_id: id,
        status: 'processing',
        message: 'Transcription retry started'
      })
    } else {
      return ApiErrors.badRequest(`Retry not supported for model: ${aiRun.model}`)
    }
  } catch (error: any) {
    logger.error('Retry error', error)
    return ApiErrors.internal(error.message || 'Failed to retry')
  }
}
