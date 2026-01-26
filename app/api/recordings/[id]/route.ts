import { NextRequest, NextResponse } from 'next/server'
import pgClient from '@/lib/pgClient'
import storage from '@/lib/storage'
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
    const res = await pgClient.query(
      `SELECT id, call_id, call_sid, recording_url, duration_seconds, status, source, media_hash, created_at, organization_id
       FROM recordings
       WHERE id = $1 AND organization_id = $2
       LIMIT 1`,
      [params.id, ctx.orgId]
    )

    const recording = res.rows?.[0]
    if (!recording) return Errors.notFound('Recording')

    // Audit log: Recording access (sensitive media) - non-blocking, best-effort
    void pgClient.query(
      `INSERT INTO audit_logs (organization_id, user_id, resource_type, resource_id, action, after, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        ctx.orgId,
        ctx.userId,
        'recordings',
        params.id,
        'recording:accessed',
        JSON.stringify({ accessed_at: new Date().toISOString() }),
        new Date().toISOString(),
      ]
    ).catch((e) => logger.warn('Failed to write audit log', e))

    const urlMatch = recording.recording_url?.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/)
    if (!urlMatch) {
      return success({ recording, signedUrl: recording.recording_url })
    }

    const [, bucket, path] = urlMatch

    try {
      const signed = await storage.createSignedUrl(bucket, path, 3600)
      const signedUrl = signed?.signedUrl || signed
      return success({ recording, signedUrl: signedUrl || recording.recording_url })
    } catch (e) {
      logger.error('Failed to generate signed URL via adapter', e)
      return success({ recording, signedUrl: recording.recording_url })
    }
  } catch (err: any) {
    logger.error('GET /api/recordings/[id] error', err)
    return Errors.internal(err)
  }
}
