import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const recordingId = params.id

    // Fetch recording
    const { data: recording, error: recordingError } = await (supabaseAdmin as any)
      .from('recordings')
      .select('*')
      .eq('id', recordingId)
      .single()

    if (recordingError) {
      throw recordingError
    }

    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
    }

    // Generate signed URL for recording
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Storage configuration missing' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Extract bucket and path from recording_url
    const urlMatch = recording.recording_url?.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/)
    if (!urlMatch) {
      return NextResponse.json({
        success: true,
        recording,
        signedUrl: recording.recording_url, // Return original URL if can't parse
      })
    }

    const [, bucket, path] = urlMatch

    // Generate signed URL (expires in 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600)

    if (signedUrlError) {
      console.error('Failed to generate signed URL:', signedUrlError)
      // Return original URL as fallback
      return NextResponse.json({
        success: true,
        recording,
        signedUrl: recording.recording_url,
      })
    }

    return NextResponse.json({
      success: true,
      recording,
      signedUrl: signedUrlData?.signedUrl || recording.recording_url,
    })
  } catch (err: any) {
    console.error('GET /api/recordings/[id] error:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch recording' },
      { status: 500 }
    )
  }
}
