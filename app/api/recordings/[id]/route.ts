import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'
import { isValidUUID } from '@/lib/utils/validation'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    // Validate UUID format early to prevent DB errors
    if (!isValidUUID(params.id)) {
      return Errors.badRequest('Invalid recording ID format')
    }

    // Query by ID AND organization_id for tenant isolation (ARCH_DOCS Requirement 6)
    const { data: recording, error: recordingError } = await supabaseAdmin
      .from('recordings')
      .select('id, call_id, call_sid, recording_url, duration_seconds, status, source, media_hash, created_at, organization_id')
      .eq('id', params.id)
      .eq('organization_id', ctx.orgId)
      .single()

    if (recordingError) throw recordingError
    if (!recording) return Errors.notFound('Recording')

    // Audit log: Recording access (sensitive media) - non-blocking, best-effort
    void supabaseAdmin.from('audit_logs').insert({
      organization_id: ctx.orgId,
      user_id: ctx.userId,
      resource_type: 'recordings',
      resource_id: params.id,
      action: 'recording:accessed',
      after: { accessed_at: new Date().toISOString() },
      created_at: new Date().toISOString()
    })

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
