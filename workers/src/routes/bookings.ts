/**
 * Bookings Routes - Booking/appointment management
 *
 * Endpoints:
 *   GET    /     - List bookings for org
 *   POST   /     - Create a booking
 *   PATCH  /:id  - Update booking (e.g. cancel)
 *   DELETE /:id  - Delete a booking
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { getDb } from '../lib/db'
import { requireAuth } from '../lib/auth'
import { validateBody } from '../lib/validate'
import { CreateBookingSchema, UpdateBookingSchema } from '../lib/schemas'
import { logger } from '../lib/logger'
import { idempotent } from '../lib/idempotency'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { bookingRateLimit } from '../lib/rate-limit'

export const bookingsRoutes = new Hono<AppEnv>()

// GET / — list bookings
bookingsRoutes.get('/', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const limit = c.req.query('limit') || '10'
    const status = c.req.query('status') || null

    let query = `
      SELECT * FROM booking_events 
      WHERE organization_id = $1
    `
    const params: any[] = [session.organization_id]

    if (status) {
      query += ` AND status = $2`
      params.push(status)
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`

    const result = await db.query(query, params.concat([limit]))

    return c.json({
      success: true,
      bookings: result.rows,
    })
  } catch (err: any) {
    logger.error('GET /api/bookings error', { error: err?.message })
    return c.json({ error: 'Failed to list bookings' }, 500)
  } finally {
    await db.end()
  }
})

// POST / — create a booking
bookingsRoutes.post('/', bookingRateLimit, idempotent(), async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const parsed = await validateBody(c, CreateBookingSchema)
    if (!parsed.success) return parsed.response
    const {
      call_id,
      title,
      description,
      start_time,
      end_time,
      duration_minutes,
      attendee_name,
      attendee_email,
      attendee_phone,
      from_number,
      notes,
      status,
    } = parsed.data

    const result = await db.query(
      `INSERT INTO booking_events (
        organization_id, call_id, title, description, start_time, end_time,
        duration_minutes, attendee_name, attendee_email, attendee_phone,
        from_number, notes, status, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      RETURNING *`,
      [
        session.organization_id,
        call_id || null,
        title,
        description || '',
        start_time,
        end_time,
        duration_minutes,
        attendee_name || null,
        attendee_email || null,
        attendee_phone,
        from_number || null,
        notes || null,
        status || 'pending',
        session.user_id,
      ]
    )

    const booking = result.rows[0]

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'bookings',
      resourceId: booking.id,
      action: AuditAction.BOOKING_CREATED,
      after: { title, status: status || 'pending', start_time, attendee_phone },
    })

    return c.json({ success: true, booking }, 201)
  } catch (err: any) {
    logger.error('POST /api/bookings error', { error: err?.message })
    return c.json({ error: 'Failed to create booking' }, 500)
  } finally {
    await db.end()
  }
})

// PATCH /:id — update booking (cancel, reschedule, etc.)
bookingsRoutes.patch('/:id', bookingRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const bookingId = c.req.param('id')
    const parsed = await validateBody(c, UpdateBookingSchema)
    if (!parsed.success) return parsed.response
    const { status, title, description, start_time, end_time, notes } = parsed.data

    const result = await db.query(
      `UPDATE booking_events
       SET status = COALESCE($3, status),
           title = COALESCE($4, title),
           description = COALESCE($5, description),
           start_time = COALESCE($6, start_time),
           end_time = COALESCE($7, end_time),
           notes = COALESCE($8, notes),
           updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [bookingId, session.organization_id, status, title, description, start_time, end_time, notes]
    )

    if (!result.rows || result.rows.length === 0) {
      return c.json({ error: 'Booking not found' }, 404)
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'bookings',
      resourceId: bookingId,
      action: AuditAction.BOOKING_UPDATED,
      after: { status, title, description, start_time },
    })

    return c.json({ success: true, booking: result.rows[0] })
  } catch (err: any) {
    logger.error('PATCH /api/bookings/:id error', { error: err?.message })
    return c.json({ error: 'Failed to update booking' }, 500)
  } finally {
    await db.end()
  }
})

// DELETE /:id — delete a booking
bookingsRoutes.delete('/:id', bookingRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const bookingId = c.req.param('id')

    const result = await db.query(
      `DELETE FROM booking_events WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [bookingId, session.organization_id]
    )

    if (!result.rows || result.rows.length === 0) {
      return c.json({ error: 'Booking not found' }, 404)
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'bookings',
      resourceId: bookingId,
      action: AuditAction.BOOKING_DELETED,
    })

    return c.json({ success: true, message: 'Booking deleted' })
  } catch (err: any) {
    logger.error('DELETE /api/bookings/:id error', { error: err?.message })
    return c.json({ error: 'Failed to delete booking' }, 500)
  } finally {
    await db.end()
  }
})
