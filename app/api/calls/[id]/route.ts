import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'

// Force dynamic rendering - uses headers via getServerSession
export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const callId = params.id

    // Fetch call
    const { data: call, error: callError } = await (supabaseAdmin as any)
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single()

    if (callError) {
      throw callError
    }

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    // Fetch recording if exists
    const { data: recording } = await (supabaseAdmin as any)
      .from('recordings')
      .select('*')
      .eq('call_sid', call.call_sid)
      .single()

    // Fetch transcript/translation from ai_runs
    const { data: aiRuns } = await (supabaseAdmin as any)
      .from('ai_runs')
      .select('*')
      .eq('call_id', callId)

    const transcript = aiRuns?.find((r: any) => r.model?.includes('transcription'))
    const translation = aiRuns?.find((r: any) => r.model?.includes('translation'))

    // Fetch evidence manifest
    const { data: manifest } = await (supabaseAdmin as any)
      .from('evidence_manifests')
      .select('*')
      .eq('recording_id', recording?.id)
      .single()

    // Fetch score
    const { data: score } = await (supabaseAdmin as any)
      .from('scored_recordings')
      .select('*')
      .eq('recording_id', recording?.id)
      .single()

    return NextResponse.json({
      success: true,
      call,
      recording: recording || null,
      transcript: transcript?.output || recording?.transcript_json || null,
      translation: translation?.output || null,
      manifest: manifest || null,
      score: score || null,
    })
  } catch (err: any) {
    console.error('GET /api/calls/[id] error:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch call details' },
      { status: 500 }
    )
  }
}
