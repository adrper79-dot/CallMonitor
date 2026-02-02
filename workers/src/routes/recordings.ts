/**
 * Recordings Routes
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { getDb } from '../lib/db'
import { requireRole } from '../lib/auth'
import { isValidUUID } from '../lib/utils'

export const recordingsRoutes = new Hono<{ Bindings: Env }>()

// GET /api/recordings/[id]
recordingsRoutes.get('/:id', async (c) => {
  try {
    const session = await requireRole(c, 'viewer')
    const recordingId = c.req.param('id')

    if (!session) {
      return c.json({ success: false, error: 'Unauthorized' }, 401)
    }

    // Validate UUID format early to prevent DB errors
    if (!isValidUUID(recordingId)) {
      return c.json({ success: false, error: 'Invalid recording ID format' }, 400)
    }

    const db = getDb(c.env)

    // Query by ID AND organization_id for tenant isolation
    const res = await db.query(
      `SELECT id, call_id, call_sid, recording_url, duration_seconds, status, source, media_hash, created_at, organization_id
       FROM recordings
       WHERE id = $1 AND organization_id = $2
       LIMIT 1`,
      [recordingId, session.organizationId]
    )

    const recording = res.rows?.[0]
    if (!recording) {
      return c.json({ success: false, error: 'Recording not found' }, 404)
    }

    // Audit log: Recording access (sensitive media) - non-blocking, best-effort
    void db.query(
      `INSERT INTO audit_logs (organization_id, user_id, resource_type, resource_id, action, after, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        session.organizationId,
        session.userId,
        'recordings',
        recordingId,
        'recording:accessed',
        JSON.stringify({ accessed_at: new Date().toISOString() }),
        new Date().toISOString(),
      ]
    ).catch((e) => console.warn('Failed to write audit log', e))

    const urlMatch = recording.recording_url?.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/)
    if (!urlMatch) {
      return c.json({
        success: true,
        recording,
        signedUrl: recording.recording_url
      })
    }

    const [, bucket, path] = urlMatch

    try {
      // For now, return the original URL since we don't have storage adapter in Worker yet
      // TODO: Implement storage adapter for signed URLs
      return c.json({
        success: true,
        recording,
        signedUrl: recording.recording_url
      })
    } catch (e) {
      console.error('Failed to generate signed URL', e)
      return c.json({
        success: true,
        recording,
        signedUrl: recording.recording_url
      })
    }
  } catch (err: any) {
    console.error('GET /api/recordings/[id] error:', err)
    return c.json({ success: false, error: 'Internal server error' }, 500)
  }
})