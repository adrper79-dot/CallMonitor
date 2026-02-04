import { Hono } from 'hono'
import type { Env } from '../index'
import { getDb } from '../lib/db'
import { requireAuth } from '../lib/auth'

export const bookingsRoutes = new Hono<{ Bindings: Env }>()

bookingsRoutes.get('/', async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const limit = c.req.query('limit') || '10'
  const status = c.req.query('status') || null

  const db = getDb(c.env)

  let query = `
    SELECT * FROM booking_events 
    WHERE organization_id = $1
  `
  const params = [session.organizationId]

  if (status) {
    query += ` AND status = $2`
    params.push(status)
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`

  const result = await db.query(query, params.concat([limit]))

  return c.json({
    bookings: result.rows
  })
})