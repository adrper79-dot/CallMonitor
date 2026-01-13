import { NextRequest, NextResponse } from 'next/server'
import { generateSpeech } from '@/app/services/elevenlabs'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

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
      return NextResponse.json(
        { error: 'Failed to save audio' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('recordings')
      .getPublicUrl(filePath)

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
          audio_url: urlData.publicUrl,
          character_count: text.length,
          organization_id
        }
      })

    return NextResponse.json({
      success: true,
      audio_url: urlData.publicUrl,
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
