import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'
import { planSupportsFeature } from '@/lib/rbac'
import { requireAuth, Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'
import { fromZonedTime } from 'date-fns-tz'
import { parseISO, isValid } from 'date-fns'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

/**
 * GET /api/bookings - List booking events for the user's organization
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    const { data: orgRows } = await supabaseAdmin
      .from('organizations')
      .select('plan, booking_enabled')
      .eq('id', ctx.orgId)
      .limit(1)

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

    let query = supabaseAdmin
      .from('booking_events')
      .select('*, calls(id, status, started_at, ended_at)')
      .eq('organization_id', ctx.orgId)
      .order('start_time', { ascending: true })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (from) query = query.gte('start_time', from)
    if (to) query = query.lte('start_time', to)

    const { data: bookings, error, count } = await query

    // If table doesn't exist (42P01 error), return empty array instead of failing
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        logger.info('booking_events table does not exist yet, returning empty array')
        return success({ bookings: [], total: 0, limit, offset })
      }
      logger.error('GET /api/bookings error', error)
      return Errors.internal(error)
    }

    return success({ bookings: bookings || [], total: count, limit, offset })
  } catch (error: any) {
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

    // Handle timezone conversion
    // If start_time is an ISO string without offset (e.g. 2026-01-20T10:00:00), it's treated as local to the specified timezone.
    // fromZonedTime converts that "Wall Time" in "Timezone" to absolute UTC Date.
    let startDate: Date
    try {
      if (timezone && timezone !== 'UTC') {
        // If start_time string has 'Z' or offset, fromZonedTime respects it.
        // If it has no offset, it applies the timezone.
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

    const { data: orgRows } = await supabaseAdmin
      .from('organizations')
      .select('plan, booking_enabled')
      .eq('id', ctx.orgId)
      .limit(1)

    if (!planSupportsFeature(orgRows?.[0]?.plan || 'free', 'booking')) {
      return Errors.unauthorized('Booking feature not available on your plan')
    }

    const endTime = end_time || new Date(startDate.getTime() + duration_minutes * 60000).toISOString()

    const bookingId = uuidv4()
    const insertData: any = {
      id: bookingId, organization_id: ctx.orgId, user_id: ctx.userId,
      title, description, start_time, end_time: endTime, duration_minutes,
      timezone, attendee_name, attendee_email, attendee_phone,
      modulations, notes, status: 'pending', created_by: ctx.userId
    }

    if (from_number) insertData.from_number = from_number

    const { data: booking, error } = await supabaseAdmin
      .from('booking_events')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      logger.error('POST /api/bookings error', error)
      return Errors.internal(error)
    }

    try {
      await supabaseAdmin.from('audit_logs').insert({
        id: uuidv4(), organization_id: ctx.orgId, user_id: ctx.userId,
        resource_type: 'booking_events', resource_id: bookingId, action: 'create',
        before: null, after: { title, start_time, attendee_phone: '[REDACTED]' },
        created_at: new Date().toISOString()
      })
    } catch { /* Best effort */ }

    logger.info('Booking created', { bookingId, orgId: ctx.orgId })

    return NextResponse.json({ success: true, booking }, { status: 201 })
  } catch (error: any) {
    logger.error('POST /api/bookings error', error)
    return Errors.internal(error)
  }
}
