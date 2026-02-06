/**
 * Recordings Routes
 * 
 * Endpoints:
 *   GET  /     - List recordings for organization
 *   GET  /:id  - Get a single recording by ID
 *   DELETE /:id - Delete a recording
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { getDb } from '../lib/db'
import { requireRole } from '../lib/auth'
import { isValidUUID } from '../lib/utils'

export const recordingsRoutes = new Hono<{ Bindings: Env }>()

// GET /api/recordings — list recordings for organization
recordingsRoutes.get('/', async (c) => {
  try {
    const session = await requireRole(c, 'viewer')
    if (!session) {
      return c.json({ success: false, error: 'Unauthorized' }, 401)
    }

    const db = getDb(c.env)
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const offset = (page - 1) * limit
    const callId = c.req.query('call_id')

    let sql = `
      SELECT id, call_id, recording_url, duration_seconds, 
             status, created_at,
             COUNT(*) OVER() as total_count
      FROM recordings
      WHERE organization_id = $1
    `
    const params: any[] = [session.organization_id]

    if (callId && isValidUUID(callId)) {
      sql += ` AND call_id = $${params.length + 1}`
      params.push(callId)
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await db.query(sql, params)
    const rows = result.rows || []
    const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0

    const recordings = rows.map((row: any) => {
      const { total_count, ...recording } = row
      return recording
    })

    return c.json({
      success: true,
      recordings,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err: any) {
    console.error('GET /api/recordings error:', err?.message)
    return c.json({ success: false, error: 'Failed to list recordings' }, 500)
  }
})

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
      `SELECT id, call_id, recording_url, duration_seconds, status, media_hash, created_at, organization_id
       FROM recordings
       WHERE id = $1 AND organization_id = $2
       LIMIT 1`,
      [recordingId, session.organization_id]
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
        session.organization_id,
        session.user_id,
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

// DELETE /api/recordings/:id — delete a recording
recordingsRoutes.delete('/:id', async (c) => {
  try {
    const session = await requireRole(c, 'operator')
    if (!session) {
      return c.json({ success: false, error: 'Unauthorized' }, 401)
    }

    const recordingId = c.req.param('id')

    if (!isValidUUID(recordingId)) {
      return c.json({ success: false, error: 'Invalid recording ID format' }, 400)
    }

    const db = getDb(c.env)

    const result = await db.query(
      `DELETE FROM recordings WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [recordingId, session.organization_id]
    )

    if (!result.rows || result.rows.length === 0) {
      return c.json({ success: false, error: 'Recording not found' }, 404)
    }

    // Audit log: Recording deleted - non-blocking
    void db.query(
      `INSERT INTO audit_logs (organization_id, user_id, resource_type, resource_id, action, after, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        session.organization_id,
        session.user_id,
        'recordings',
        recordingId,
        'recording:deleted',
        JSON.stringify({ deleted_at: new Date().toISOString() }),
        new Date().toISOString(),
      ]
    ).catch((e) => console.warn('Failed to write audit log', e))

    return c.json({ success: true, message: 'Recording deleted' })
  } catch (err: any) {
    console.error('DELETE /api/recordings/[id] error:', err)
    return c.json({ success: false, error: 'Failed to delete recording' }, 500)
  }
})