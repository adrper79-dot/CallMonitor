import { NextRequest, NextResponse } from 'next/server'
import { generateSpeech } from '@/app/services/elevenlabs'
import supabaseAdmin from '@/lib/supabaseAdmin'
import storage from '@/lib/storage'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'
import { requireAuth } from '@/lib/api/utils'
import { ApiErrors } from '@/lib/errors/apiHandler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication (TTS costs money!)
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) {
      return ctx
    }

    const body = await request.json()
    const { text, voice_id, language } = body
    // Use authenticated user's org instead of trusting client-provided value
    const organization_id = ctx.orgId

    if (!text) {
      return ApiErrors.badRequest('Missing required fields')
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return ApiErrors.serviceUnavailable('ElevenLabs')
    }

    if (text.length > 5000) {
      return ApiErrors.badRequest('Text too long (max 5000 characters)')
    }

    const audioStream = await generateSpeech(text, language, voice_id)
    
    const chunks: Uint8Array[] = []
    const reader = audioStream.getReader()
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    
    const audioBuffer = Buffer.concat(chunks)

    const fileName = `${uuidv4()}.mp3`
    const filePath = `tts/${organization_id}/${fileName}`

    // Upload using storage adapter
    await storage.upload('recordings', filePath, audioBuffer, 'audio/mpeg')
    let audioUrl: string
    try {
      const signed = await storage.createSignedUrl('recordings', filePath, 3600)
      audioUrl = signed?.signedUrl || signed
    } catch (e) {
      logger.warn('Failed to create signed URL, falling back to public URL', e as any)
      const pub = await storage.getPublicUrl('recordings', filePath)
      audioUrl = pub.publicURL || pub.publicUrl
    }

    await supabaseAdmin.from('ai_runs').insert({
      id: uuidv4(), call_id: null, system_id: null, model: 'elevenlabs-tts',
      status: 'completed', started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
      produced_by: 'model',
      is_authoritative: true,
      output: { text, voice_id, language, audio_url: audioUrl, storage_path: filePath, character_count: text.length, organization_id }
    })

    return NextResponse.json({ success: true, audio_url: audioUrl, storage_path: filePath, expires_in: 3600, character_count: text.length })
  } catch (error: any) {
    logger.error('TTS generation error', error)
    return ApiErrors.internal(error.message || 'Generation failed')
  }
}
