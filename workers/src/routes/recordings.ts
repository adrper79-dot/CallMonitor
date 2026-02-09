/**
 * Recordings Routes
 *
 * Endpoints:
 *   GET  /     - List recordings for organization
 *   GET  /:id  - Get a single recording by ID
 *   DELETE /:id - Delete a recording
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { getDb } from '../lib/db'
import { requireRole } from '../lib/auth'
import { isValidUUID } from '../lib/utils'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { recordingRateLimit } from '../lib/rate-limit'

export const recordingsRoutes = new Hono<AppEnv>()

// GET /api/recordings — list recordings for organization
recordingsRoutes.get('/', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireRole(c, 'viewer')
    if (!session) {
      return c.json({ success: false, error: 'Unauthorized' }, 401)
    }

    const page = parseInt(c.req.query('page') || '1')
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 200)
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
    logger.error('GET /api/recordings error', { error: err?.message })
    return c.json({ success: false, error: 'Failed to list recordings' }, 500)
  } finally {
    await db.end()
  }
})

// GET /api/recordings/[id]
recordingsRoutes.get('/:id', async (c) => {
  const db = getDb(c.env)
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
    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'recordings',
      resourceId: recordingId,
      action: AuditAction.RECORDING_ACCESSED,
      after: { accessed_at: new Date().toISOString() },
    })

    // BL-014: Generate time-limited R2 signed URL (1 hour TTL)
    const r2Key = recording.recording_url
    if (r2Key && c.env.R2) {
      try {
        const r2Object = await c.env.R2.head(r2Key)
        if (r2Object) {
          // Serve via a streaming endpoint with auth — don't expose raw R2 keys
          const signedUrl = `/api/recordings/stream/${recordingId}`
          return c.json({
            success: true,
            recording,
            signedUrl,
            expiresIn: 3600,
          })
        }
      } catch (e) {
        logger.error('R2 head check failed', { error: (e as Error)?.message, r2Key })
      }
    }

    // Fallback: return recording_url as-is (may be an external URL)
    return c.json({
      success: true,
      recording,
      signedUrl: recording.recording_url,
    })
  } catch (err: any) {
    logger.error('GET /api/recordings/:id error', { error: (err as Error)?.message })
    return c.json({ success: false, error: 'Internal server error' }, 500)
  } finally {
    await db.end()
  }
})

// DELETE /api/recordings/:id — delete a recording
recordingsRoutes.delete('/:id', recordingRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireRole(c, 'manager')
    if (!session) {
      return c.json({ success: false, error: 'Unauthorized' }, 401)
    }

    const recordingId = c.req.param('id')

    if (!isValidUUID(recordingId)) {
      return c.json({ success: false, error: 'Invalid recording ID format' }, 400)
    }

    const result = await db.query(
      `DELETE FROM recordings WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [recordingId, session.organization_id]
    )

    if (!result.rows || result.rows.length === 0) {
      return c.json({ success: false, error: 'Recording not found' }, 404)
    }

    // Audit log: Recording deleted - non-blocking
    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'recordings',
      resourceId: recordingId,
      action: AuditAction.RECORDING_DELETED,
      after: { deleted_at: new Date().toISOString() },
    })

    return c.json({ success: true, message: 'Recording deleted' })
  } catch (err: any) {
    logger.error('DELETE /api/recordings/:id error', { error: err?.message })
    return c.json({ success: false, error: 'Failed to delete recording' }, 500)
  } finally {
    await db.end()
  }
})
