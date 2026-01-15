import { NextRequest, NextResponse } from 'next/server'
import { generateSpeech } from '@/app/services/elevenlabs'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'
import { requireAuth } from '@/lib/api/utils'

export const dynamic = 'force-dynamic'

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
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'ElevenLabs not configured' }, { status: 503 })
    }

    if (text.length > 5000) {
      return NextResponse.json({ error: 'Text too long (max 5000 characters)' }, { status: 400 })
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

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('recordings')
      .upload(filePath, audioBuffer, { contentType: 'audio/mpeg', upsert: false })

    if (uploadError) {
      logger.error('Storage upload error', uploadError)
      const errorMessage = uploadError.message?.includes('bucket')
        ? 'Storage bucket not configured. Please create a "recordings" bucket in Supabase Storage.'
        : `Failed to save audio: ${uploadError.message || 'Unknown storage error'}`
      return NextResponse.json({ error: errorMessage, details: uploadError.message }, { status: 500 })
    }

    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('recordings')
      .createSignedUrl(filePath, 3600)

    let audioUrl: string
    if (signedUrlError || !signedUrlData?.signedUrl) {
      if (signedUrlError) logger.warn('Failed to create signed URL, falling back to public URL', signedUrlError)
      const { data: urlData } = supabaseAdmin.storage.from('recordings').getPublicUrl(filePath)
      audioUrl = urlData.publicUrl
    } else {
      audioUrl = signedUrlData.signedUrl
    }

    await supabaseAdmin.from('ai_runs').insert({
      id: uuidv4(), call_id: null, system_id: null, model: 'elevenlabs-tts',
      status: 'completed', started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
      output: { text, voice_id, language, audio_url: audioUrl, storage_path: filePath, character_count: text.length, organization_id }
    })

    return NextResponse.json({ success: true, audio_url: audioUrl, storage_path: filePath, expires_in: 3600, character_count: text.length })
  } catch (error: any) {
    logger.error('TTS generation error', error)
    return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 })
  }
}
