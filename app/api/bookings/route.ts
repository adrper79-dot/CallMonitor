import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { v4 as uuidv4 } from 'uuid'
import { planSupportsFeature } from '@/lib/rbac'
import { requireAuth, Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'
import { fromZonedTime } from 'date-fns-tz'
import { parseISO, isValid } from 'date-fns'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/bookings - List booking events for the user's organization
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    const { rows: orgRows } = await query(
      `SELECT plan, booking_enabled FROM organizations WHERE id = $1 LIMIT 1`,
      [ctx.orgId]
    )

    const org = orgRows?.[0]
    if (!planSupportsFeature(org?.plan || 'free', 'booking')) {
      return Errors.unauthorized('Booking feature not available on your plan')
    }

    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)

    const conditions: string[] = [`b.organization_id = $1`]
    const params: any[] = [ctx.orgId]

    if (status) {
      conditions.push(`b.status = $${params.length + 1}`)
      params.push(status)
    }
    if (from) {
      conditions.push(`b.start_time >= $${params.length + 1}`)
      params.push(from)
    }
    if (to) {
      conditions.push(`b.start_time <= $${params.length + 1}`)
      params.push(to)
    }

    const whereClause = conditions.join(' AND ')

    // Get count
    const { rows: countRows } = await query(
      `SELECT COUNT(*) as count FROM booking_events b WHERE ${whereClause}`,
      params
    )
    const count = parseInt(countRows?.[0]?.count || '0', 10)

    // Get data
    const { rows: bookings } = await query(
      `SELECT b.*, 
              c.id as call_id, c.status as call_status, c.started_at as call_started_at, c.ended_at as call_ended_at
       FROM booking_events b
       LEFT JOIN calls c ON b.id = c.booking_id
       WHERE ${whereClause}
       ORDER BY b.start_time ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    )

    return success({ bookings: bookings || [], total: count, limit, offset })
  } catch (error: any) {
    // If table doesn't exist (Postgres 42P01), return empty array
    if (error.code === '42P01') {
      logger.info('booking_events table does not exist yet, returning empty array')
      return success({ bookings: [], total: 0, limit: 50, offset: 0 })
    }
    logger.error('GET /api/bookings error', error)
    return Errors.internal(error)
  }
}

/**
 * POST /api/bookings - Create a new booking event
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    const body = await req.json()
    const {
      title, description, start_time, end_time, duration_minutes = 30,
      timezone = 'UTC', attendee_name, attendee_email, attendee_phone,
      from_number, modulations = {}, notes
    } = body

    if (!title || !start_time || !attendee_phone) {
      return Errors.badRequest('title, start_time, and attendee_phone are required')
    }

    if (!attendee_phone.match(/^\+?[1-9]\d{1,14}$/)) {
      return Errors.badRequest('Invalid phone number format (use E.164)')
    }

    const now = new Date()

    let startDate: Date
    try {
      if (timezone && timezone !== 'UTC') {
        startDate = fromZonedTime(start_time, timezone)
      } else {
        startDate = new Date(start_time)
      }

      if (!isValid(startDate)) {
        return Errors.badRequest('Invalid start_time format')
      }
    } catch (e) {
      return Errors.badRequest('Invalid start_time or timezone')
    }

    if (startDate < new Date(now.getTime() - 5 * 60 * 1000)) {
      return Errors.badRequest('start_time cannot be in the past')
    }

    const { rows: orgRows } = await query(
      `SELECT plan, booking_enabled FROM organizations WHERE id = $1 LIMIT 1`,
      [ctx.orgId]
    )

    if (!planSupportsFeature(orgRows?.[0]?.plan || 'free', 'booking')) {
      return Errors.unauthorized('Booking feature not available on your plan')
    }

    const endTime = end_time || new Date(startDate.getTime() + duration_minutes * 60000).toISOString()

    const bookingId = uuidv4()
    const dbNow = now.toISOString()

    const { rows: bookingRows } = await query(
      `INSERT INTO booking_events (
        id, organization_id, user_id, title, description, start_time, end_time, 
        duration_minutes, timezone, attendee_name, attendee_email, attendee_phone, 
        from_number, modulations, notes, status, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $18)
      RETURNING *`,
      [
        bookingId, ctx.orgId, ctx.userId, title, description, start_time, endTime,
        duration_minutes, timezone, attendee_name, attendee_email, attendee_phone,
        from_number || null, JSON.stringify(modulations), notes, 'pending', ctx.userId, dbNow
      ]
    )

    const booking = bookingRows[0]

    try {
      await query(
        `INSERT INTO audit_logs (
          id, organization_id, user_id, resource_type, resource_id, action, 
          before, after, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          uuidv4(), ctx.orgId, ctx.userId, 'booking_events', bookingId, 'create',
          null, JSON.stringify({ title, start_time, attendee_phone: '[REDACTED]' })
        ]
      )
    } catch { /* Best effort */ }

    logger.info('Booking created', { bookingId, orgId: ctx.orgId })

    return NextResponse.json({ success: true, booking }, { status: 201 })
  } catch (error: any) {
    logger.error('POST /api/bookings error', error)
    return Errors.internal(error)
  }
}
