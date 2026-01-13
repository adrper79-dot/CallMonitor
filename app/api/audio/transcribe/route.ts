import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

// Use centralized admin client to avoid build-time initialization issues
const supabase = supabaseAdmin

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organization_id, audio_url, filename } = body

    if (!organization_id || !audio_url) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get AssemblyAI key at runtime
    const assemblyAIKey = process.env.ASSEMBLYAI_API_KEY
    if (!assemblyAIKey) {
      return NextResponse.json(
        { error: 'AssemblyAI not configured' },
        { status: 503 }
      )
    }

    // Create AI run record for tracking
    const transcriptId = uuidv4()
    
    const { error: insertError } = await supabase
      .from('ai_runs')
      .insert({
        id: transcriptId,
        call_id: null, // Uploaded files don't have call_id
        system_id: null,
        model: 'assemblyai-upload',
        status: 'pending',
        started_at: new Date().toISOString(),
        output: {
          filename,
          audio_url,
          organization_id
        }
      })

    if (insertError) {
      console.error('Failed to create ai_run record:', insertError)
      return NextResponse.json(
        { error: 'Failed to create transcript record' },
        { status: 500 }
      )
    }

    // Submit to AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': assemblyAIKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio_url,
        language_detection: true
      })
    })

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json()
      console.error('AssemblyAI error:', error)
      
      // Update status to failed
      await supabase
        .from('ai_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          output: {
            filename,
            audio_url,
            organization_id,
            error: error.error || 'AssemblyAI submission failed'
          }
        })
        .eq('id', transcriptId)

      return NextResponse.json(
        { error: 'Transcription failed: ' + (error.error || 'Unknown error') },
        { status: 500 }
      )
    }

    const transcriptData = await uploadResponse.json()

    // Update ai_run with AssemblyAI transcript ID
    await supabase
      .from('ai_runs')
      .update({
        status: 'processing',
        output: {
          filename,
          audio_url,
          organization_id,
          assemblyai_id: transcriptData.id,
          assemblyai_status: transcriptData.status
        }
      })
      .eq('id', transcriptId)

    return NextResponse.json({
      success: true,
      transcript_id: transcriptId,
      assemblyai_id: transcriptData.id,
      status: 'processing'
    })
  } catch (error: any) {
    console.error('Transcription error:', error)
    return NextResponse.json(
      { error: error.message || 'Transcription failed' },
      { status: 500 }
    )
  }
}
