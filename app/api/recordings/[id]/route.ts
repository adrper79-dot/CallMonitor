import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    const { data: recording, error: recordingError } = await supabaseAdmin
      .from('recordings')
      .select('*')
      .eq('id', params.id)
      .single()

    if (recordingError) throw recordingError
    if (!recording) return Errors.notFound('Recording')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return Errors.badRequest('Storage configuration missing')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const urlMatch = recording.recording_url?.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/)
    if (!urlMatch) {
      return success({ recording, signedUrl: recording.recording_url })
    }

    const [, bucket, path] = urlMatch

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600)

    if (signedUrlError) {
      logger.error('Failed to generate signed URL', signedUrlError)
      return success({ recording, signedUrl: recording.recording_url })
    }

    return success({ recording, signedUrl: signedUrlData?.signedUrl || recording.recording_url })
  } catch (err: any) {
    logger.error('GET /api/recordings/[id] error', err)
    return Errors.internal(err)
  }
}
