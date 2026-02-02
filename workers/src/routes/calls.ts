/**
 * Calls API Routes
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { getDb } from '../lib/db'
import { requireAuth } from '../lib/auth'

export const callsRoutes = new Hono<{ Bindings: Env }>()

// List calls for organization
callsRoutes.get('/', async (c) => {
  try {
    // Authenticate
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const { organizationId, userId } = session

    // Parse query params
    const url = new URL(c.req.url)
    const status = url.searchParams.get('status')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const db = getDb(c.env)

    // Build query
    let sql = `
      SELECT 
        id, organization_id, system_id, status, started_at, ended_at, 
        created_by, call_sid, COUNT(*) OVER() as total_count
      FROM calls
      WHERE organization_id = $1
    `
    const params: any[] = [organizationId]

    if (status && status !== 'all') {
      if (status === 'active') {
        sql += ` AND status IN ('in_progress', 'ringing')`
      } else {
        sql += ` AND status = $${params.length + 1}`
        params.push(status)
      }
    }

    sql += ` ORDER BY started_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await db.query(sql, params)
    const rows = result.rows || []

    const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0
    const calls = rows.map((row: any) => {
      const { total_count, ...call } = row
      return call
    })

    return c.json({
      success: true,
      calls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err: any) {
    console.error('GET /api/calls error:', err)
    return c.json({ error: err.message || 'Failed to fetch calls' }, 500)
  }
})

// Get single call
callsRoutes.get('/:id', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const callId = c.req.param('id')
    const db = getDb(c.env)

    const result = await db.query(
      `SELECT * FROM calls WHERE id = $1 AND organization_id = $2`,
      [callId, session.organizationId]
    )

    if (!result.rows || result.rows.length === 0) {
      return c.json({ error: 'Call not found' }, 404)
    }

    return c.json({ success: true, call: result.rows[0] })
  } catch (err: any) {
    console.error('GET /api/calls/:id error:', err)
    return c.json({ error: err.message || 'Failed to fetch call' }, 500)
  }
})

// Start a new call
callsRoutes.post('/start', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const body = await c.req.json()
    const { phoneNumber, callerId, systemId } = body

    if (!phoneNumber) {
      return c.json({ error: 'Phone number is required' }, 400)
    }

    const db = getDb(c.env)

    // Create call record
    const result = await db.query(
      `INSERT INTO calls (organization_id, system_id, status, created_by, phone_number, caller_id)
       VALUES ($1, $2, 'pending', $3, $4, $5)
       RETURNING *`,
      [session.organizationId, systemId, session.userId, phoneNumber, callerId]
    )

    const call = result.rows[0]

    // TODO: Trigger actual call via Telnyx
    // This would be: await telnyxClient.calls.create({ ... })

    return c.json({ success: true, call }, 201)
  } catch (err: any) {
    console.error('POST /api/calls/start error:', err)
    return c.json({ error: err.message || 'Failed to start call' }, 500)
  }
})

// End a call
callsRoutes.post('/:id/end', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const callId = c.req.param('id')
    const db = getDb(c.env)

    const result = await db.query(
      `UPDATE calls 
       SET status = 'completed', ended_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [callId, session.organizationId]
    )

    if (!result.rows || result.rows.length === 0) {
      return c.json({ error: 'Call not found' }, 404)
    }

    // TODO: Trigger actual call hangup via Telnyx

    return c.json({ success: true, call: result.rows[0] })
  } catch (err: any) {
    console.error('POST /api/calls/:id/end error:', err)
    return c.json({ error: err.message || 'Failed to end call' }, 500)
  }
})
