import { NextRequest, NextResponse } from 'next/server'
import { generateSpeech } from '@/app/services/elevenlabs'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Use centralized admin client to avoid build-time initialization issues
const supabase = supabaseAdmin

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, voice_id, language, organization_id } = body

    if (!text || !organization_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: 'ElevenLabs not configured' },
        { status: 503 }
      )
    }

    // Validate text length
    if (text.length > 5000) {
      return NextResponse.json(
        { error: 'Text too long (max 5000 characters)' },
        { status: 400 }
      )
    }

    // Generate speech with ElevenLabs
    const audioStream = await generateSpeech(text, language, voice_id)
    
    // Convert stream to buffer
    const chunks: Uint8Array[] = []
    const reader = audioStream.getReader()
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    
    const audioBuffer = Buffer.concat(chunks)

    // Upload to Supabase Storage
    const fileName = `${uuidv4()}.mp3`
    const filePath = `tts/${organization_id}/${fileName}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(filePath, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: false
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      // Provide more specific error messages
      const errorMessage = uploadError.message?.includes('bucket')
        ? 'Storage bucket not configured. Please create a "recordings" bucket in Supabase Storage.'
        : `Failed to save audio: ${uploadError.message || 'Unknown storage error'}`
      return NextResponse.json(
        { error: errorMessage, details: uploadError.message },
        { status: 500 }
      )
    }

    // Generate signed URL with 1-hour expiration for better security
    // This prevents permanent public access to audio files
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('recordings')
      .createSignedUrl(filePath, 3600) // 1 hour expiration

    // Fallback to public URL if signed URL fails
    let audioUrl: string
    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.warn('Failed to create signed URL, falling back to public URL:', signedUrlError?.message)
      const { data: urlData } = supabase.storage
        .from('recordings')
        .getPublicUrl(filePath)
      audioUrl = urlData.publicUrl
    } else {
      audioUrl = signedUrlData.signedUrl
    }

    // Create AI run record for tracking
    await supabase
      .from('ai_runs')
      .insert({
        id: uuidv4(),
        call_id: null,
        system_id: null,
        model: 'elevenlabs-tts',
        status: 'completed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        output: {
          text,
          voice_id,
          language,
          audio_url: audioUrl,
          storage_path: filePath, // Store path for regenerating signed URLs
          character_count: text.length,
          organization_id
        }
      })

    return NextResponse.json({
      success: true,
      audio_url: audioUrl,
      storage_path: filePath, // Client can request new signed URL if expired
      expires_in: 3600, // 1 hour
      character_count: text.length
    })
  } catch (error: any) {
    console.error('TTS generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Generation failed' },
      { status: 500 }
    )
  }
}
