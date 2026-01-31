import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { v4 as uuidv4 } from 'uuid'
import { requireAuth, Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/bookings/[id] - Get a single booking by ID
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    const { id } = await params

    const { rows } = await query(
      `SELECT * FROM booking_events WHERE id = $1 LIMIT 1`,
      [id]
    )
    const booking = rows?.[0]

    if (!booking) {
      return Errors.notFound('Booking')
    }

    if (booking.organization_id !== ctx.orgId) {
      return Errors.unauthorized()
    }

    return success({ booking })
  } catch (error: any) {
    logger.error('GET /api/bookings/[id] error', error)
    return Errors.internal(error)
  }
}

/**
 * PATCH /api/bookings/[id] - Update a booking
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    const body = await req.json()
    const { id } = await params

    const { rows } = await query(
      `SELECT * FROM booking_events WHERE id = $1 LIMIT 1`,
      [id]
    )
    const existing = rows?.[0]

    if (!existing) {
      return Errors.notFound('Booking')
    }

    if (existing.organization_id !== ctx.orgId) {
      return Errors.unauthorized()
    }

    if (['completed', 'calling'].includes(existing.status)) {
      return Errors.badRequest('Cannot modify a completed or in-progress booking')
    }

    const allowedFields = [
      'title', 'description', 'start_time', 'end_time',
      'duration_minutes', 'timezone', 'attendee_name',
      'attendee_email', 'attendee_phone', 'modulations', 'notes', 'status'
    ]

    const updates: any[] = []
    const values: any[] = []
    const updatePayload: any = {}

    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        updatePayload[key] = body[key]
        updates.push(`${key} = $${values.length + 1}`)
        values.push(key === 'modulations' ? JSON.stringify(body[key]) : body[key])
      }
    }

    if (updatePayload.start_time && new Date(updatePayload.start_time) <= new Date()) {
      return Errors.badRequest('start_time must be in the future')
    }

    if (updates.length > 0) {
      values.push(id)
      const { rows: updatedRows } = await query(
        `UPDATE booking_events SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
        values
      )

      const booking = updatedRows[0]

      try {
        await query(
          `INSERT INTO audit_logs (
            id, organization_id, user_id, resource_type, resource_id, action, 
            before, after, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            uuidv4(), existing.organization_id, ctx.userId, 'booking_events', id, 'update',
            JSON.stringify({ status: existing.status, start_time: existing.start_time }),
            JSON.stringify(updatePayload)
          ]
        )
      } catch { /* Best effort */ }

      return success({ booking })
    }

    return success({ booking: existing })
  } catch (error: any) {
    logger.error('PATCH /api/bookings/[id] error', error)
    return Errors.internal(error)
  }
}

/**
 * DELETE /api/bookings/[id] - Cancel a booking
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    const { id } = await params

    const { rows } = await query(
      `SELECT * FROM booking_events WHERE id = $1 LIMIT 1`,
      [id]
    )
    const existing = rows?.[0]

    if (!existing) {
      return Errors.notFound('Booking')
    }

    if (existing.organization_id !== ctx.orgId) {
      return Errors.unauthorized()
    }

    const isCreator = existing.created_by === ctx.userId
    if (!['owner', 'admin'].includes(ctx.role) && !isCreator) {
      return Errors.unauthorized('Only owners, admins, or the creator can delete bookings')
    }

    if (existing.status === 'calling') {
      return Errors.badRequest('Cannot delete a booking while call is in progress')
    }

    await query(
      `UPDATE booking_events SET status = 'cancelled' WHERE id = $1`,
      [id]
    )

    try {
      await query(
        `INSERT INTO audit_logs (
          id, organization_id, user_id, resource_type, resource_id, action, 
          before, after, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          uuidv4(), existing.organization_id, ctx.userId, 'booking_events', id, 'delete',
          JSON.stringify({ status: existing.status }),
          JSON.stringify({ status: 'cancelled' })
        ]
      )
    } catch { /* Best effort */ }

    return success({ message: 'Booking cancelled' })
  } catch (error: any) {
    logger.error('DELETE /api/bookings/[id] error', error)
    return Errors.internal(error)
  }
}
