import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'
import { requireAuth } from '@/lib/api/utils'
import { ApiErrors } from '@/lib/errors/apiHandler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication (transcription costs money!)
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) {
      return ctx
    }

    const body = await request.json()
    const { audio_url, filename } = body
    // Use authenticated user's org instead of trusting client-provided value
    const organization_id = ctx.orgId

    if (!audio_url) {
      return ApiErrors.badRequest('Missing required fields')
    }

    const assemblyAIKey = process.env.ASSEMBLYAI_API_KEY
    if (!assemblyAIKey) {
      return ApiErrors.serviceUnavailable('AssemblyAI not configured')
    }

    const transcriptId = uuidv4()
    
    const { error: insertError } = await supabaseAdmin.from('ai_runs').insert({
      id: transcriptId, call_id: null, system_id: null,
      model: 'assemblyai-upload', status: 'pending',
      started_at: new Date().toISOString(),
      produced_by: 'model',
      is_authoritative: true,
      output: { filename, audio_url, organization_id }
    })

    if (insertError) {
      logger.error('Failed to create ai_run record', insertError)
      return ApiErrors.internal('Failed to create transcript record')
    }

    const uploadResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: { 'Authorization': assemblyAIKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        audio_url, 
        language_detection: true,
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/assemblyai`
      })
    })

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json()
      logger.error('AssemblyAI error', error)
      
      await supabaseAdmin.from('ai_runs').update({
        status: 'failed', completed_at: new Date().toISOString(),
        produced_by: 'model',
        is_authoritative: true,
        output: { filename, audio_url, organization_id, error: error.error || 'AssemblyAI submission failed' }
      }).eq('id', transcriptId)

      return ApiErrors.internal('Transcription failed: ' + (error.error || 'Unknown error'))
    }

    const transcriptData = await uploadResponse.json()

    await supabaseAdmin.from('ai_runs').update({
      status: 'processing',
      produced_by: 'model',
      is_authoritative: true,
      output: { filename, audio_url, organization_id, job_id: transcriptData.id, assemblyai_status: transcriptData.status }
    }).eq('id', transcriptId)

    return NextResponse.json({ success: true, transcript_id: transcriptId, assemblyai_id: transcriptData.id, status: 'processing' })
  } catch (error: any) {
    logger.error('Transcription error', error)
    return ApiErrors.internal(error.message || 'Transcription failed')
  }
}
