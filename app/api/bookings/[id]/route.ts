import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'
import { requireAuth, Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

/**
 * GET /api/bookings/[id] - Get a single booking by ID
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    const { id } = await params
      .single()

    if (error || !booking) {
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

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('booking_events')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
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
    
    const updatePayload: any = {}
    for (const key of allowedFields) {
      if (body[key] !== undefined) updatePayload[key] = body[key]
    }

    if (updatePayload.start_time && new Date(updatePayload.start_time) <= new Date()) {
      return Errors.badRequest('start_time must be in the future')
    }

    const { data: booking, error: updateError } = await supabaseAdmin
      .from('booking_events')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      logger.error('PATCH /api/bookings/[id] error', updateError)
      return Errors.internal(updateError)
    }

    try {
      await supabaseAdmin.from('audit_logs').insert({
        id: uuidv4(), organization_id: existing.organization_id, user_id: ctx.userId,
        resource_type: 'booking_events', resource_id: id, action: 'update',
        before: { status: existing.status, start_time: existing.start_time },
        after: updatePayload, created_at: new Date().toISOString()
      })
    } catch { /* Best effort */ }

    return success({ booking })
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

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('booking_events')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
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

    const { error: deleteError } = await supabaseAdmin
      .from('booking_events')
      .update({ status: 'cancelled' })
      .eq('id', id)

    if (deleteError) {
      logger.error('DELETE /api/bookings/[id] error', deleteError)
      return Errors.internal(deleteError)
    }

    try {
      await supabaseAdmin.from('audit_logs').insert({
        id: uuidv4(), organization_id: existing.organization_id, user_id: ctx.userId,
        resource_type: 'booking_events', resource_id: id, action: 'delete',
        before: { status: existing.status }, after: { status: 'cancelled' },
        created_at: new Date().toISOString()
      })
    } catch { /* Best effort */ }

    return success({ message: 'Booking cancelled' })
  } catch (error: any) {
    logger.error('DELETE /api/bookings/[id] error', error)
    return Errors.internal(error)
  }
}
