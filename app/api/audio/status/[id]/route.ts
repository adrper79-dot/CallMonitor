import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireAuth } from '@/lib/api/utils'
import { ApiErrors } from '@/lib/errors/apiHandler'

export const dynamic = 'force-dynamic'

/**
 * GET /api/audio/status/[id]
 * 
 * Poll transcription status for manual audio uploads.
 * Returns status, transcript text (if complete), and any errors.
 * 
 * Used by AudioUpload component to poll until transcription completes.
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
      return ApiErrors.badRequest('Invalid transcript ID')
    }

    // Fetch ai_run record
    const { data: aiRun, error } = await supabaseAdmin
      .from('ai_runs')
      .select('id, status, output, completed_at')
      .eq('id', id)
      .single()

    if (error || !aiRun) {
      return ApiErrors.notFound('Transcript not found')
    }

    // Verify ownership - check organization_id in output
    const output = aiRun.output as Record<string, any> | null
    if (output?.organization_id && output.organization_id !== ctx.orgId) {
      return ApiErrors.forbidden()
    }

    // Build response based on status
    const response: {
      id: string
      status: string
      transcript?: string
      confidence?: number
      error?: string
      completed_at?: string
    } = {
      id: aiRun.id,
      status: aiRun.status
    }

    if (aiRun.status === 'completed' && output?.transcript) {
      response.transcript = typeof output.transcript === 'string' 
        ? output.transcript 
        : output.transcript.text || JSON.stringify(output.transcript)
      response.confidence = output.transcript?.confidence
      response.completed_at = aiRun.completed_at
    }

    if (aiRun.status === 'failed' && output?.error) {
      response.error = typeof output.error === 'string' 
        ? output.error 
        : JSON.stringify(output.error)
    }

    return NextResponse.json(response)
  } catch (error: any) {
    return ApiErrors.internal(error.message || 'Failed to fetch status')
  }
}
