import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireAuth } from '@/lib/api/utils'
import { ApiErrors } from '@/lib/errors/apiHandler'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

/**
 * GET /api/ai-runs/[id]/status
 * 
 * Poll status of an AI run (transcription, translation, etc.)
 * Returns status, output, and any errors.
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

    const { id } = await params

    if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
      return ApiErrors.badRequest('Invalid AI run ID')
    }

    // Fetch ai_run record
    const { data: aiRun, error } = await supabaseAdmin
      .from('ai_runs')
      .select('id, call_id, model, status, started_at, completed_at, output')
      .eq('id', id)
      .single()

    if (error || !aiRun) {
      return ApiErrors.notFound('AI run not found')
    }

    // If there's a call_id, verify the call belongs to user's org
    if (aiRun.call_id) {
      const { data: callRow } = await supabaseAdmin
        .from('calls')
        .select('organization_id')
        .eq('id', aiRun.call_id)
        .single()

      if (callRow?.organization_id !== ctx.orgId) {
        return ApiErrors.forbidden()
      }
    } else {
      // For standalone ai_runs (like audio uploads), check org in output
      const output = aiRun.output as Record<string, any> | null
      if (output?.organization_id && output.organization_id !== ctx.orgId) {
        return ApiErrors.forbidden()
      }
    }

    const output = aiRun.output as Record<string, any> | null

    // Build response based on model type
    let response: Record<string, any> = {
      id: aiRun.id,
      model: aiRun.model,
      status: aiRun.status,
      started_at: aiRun.started_at,
      completed_at: aiRun.completed_at
    }

    // Add model-specific fields
    if (aiRun.model === 'assemblyai-translation') {
      response.from_language = output?.from_language
      response.to_language = output?.to_language
      
      if (aiRun.status === 'completed') {
        response.translated_text = output?.translated_text
        response.audio_url = output?.translated_audio_url
        response.voice_cloning_used = output?.voice_cloning_used || false
      }
      
      if (aiRun.status === 'failed') {
        response.error = output?.error
      }
    } else if (aiRun.model?.includes('assemblyai')) {
      // Transcription
      if (aiRun.status === 'completed') {
        response.transcript = output?.transcript?.text
        response.confidence = output?.transcript?.confidence
        response.language_code = output?.transcript?.language_code
      }
      
      if (aiRun.status === 'failed') {
        response.error = output?.error
      }
    } else {
      // Generic ai_run
      if (aiRun.status === 'completed' || aiRun.status === 'failed') {
        response.output = output
      }
    }

    return NextResponse.json(response)
  } catch (error: any) {
    return ApiErrors.internal(error.message || 'Failed to fetch status')
  }
}
