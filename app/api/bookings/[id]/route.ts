import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/bookings/[id]
 * 
 * Get a single booking by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id } = params

    // Get booking with related call
    const { data: booking, error } = await supabaseAdmin
      .from('booking_events')
      .select('*, calls(id, status, started_at, ended_at, call_sid)')
      .eq('id', id)
      .single()

    if (error || !booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Verify user has access to this booking's organization
    const { data: memberRows } = await supabaseAdmin
      .from('org_members')
      .select('id')
      .eq('organization_id', booking.organization_id)
      .eq('user_id', userId)
      .limit(1)

    if (!memberRows || memberRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Not authorized' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      booking
    })
  } catch (error: any) {
    console.error('GET /api/bookings/[id] error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/bookings/[id]
 * 
 * Update a booking (reschedule, update details, cancel)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id } = params
    const body = await req.json()

    // Get existing booking
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('booking_events')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Verify user has access
    const { data: memberRows } = await supabaseAdmin
      .from('org_members')
      .select('id, role')
      .eq('organization_id', existing.organization_id)
      .eq('user_id', userId)
      .limit(1)

    if (!memberRows || memberRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Not authorized' },
        { status: 403 }
      )
    }

    // Check if booking can be modified
    if (['completed', 'calling'].includes(existing.status)) {
      return NextResponse.json(
        { success: false, error: 'Cannot modify a completed or in-progress booking' },
        { status: 400 }
      )
    }

    // Build update payload
    const allowedFields = [
      'title', 'description', 'start_time', 'end_time', 
      'duration_minutes', 'timezone', 'attendee_name', 
      'attendee_email', 'attendee_phone', 'modulations', 
      'notes', 'status'
    ]
    
    const updatePayload: any = {}
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        updatePayload[key] = body[key]
      }
    }

    // Validate new start_time if provided
    if (updatePayload.start_time) {
      const startDate = new Date(updatePayload.start_time)
      if (startDate <= new Date()) {
        return NextResponse.json(
          { success: false, error: 'start_time must be in the future' },
          { status: 400 }
        )
      }
    }

    // Update booking
    const { data: booking, error: updateError } = await supabaseAdmin
      .from('booking_events')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('PATCH /api/bookings/[id] error:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update booking' },
        { status: 500 }
      )
    }

    // Audit log
    try {
      await supabaseAdmin.from('audit_logs').insert({
        id: uuidv4(),
        organization_id: existing.organization_id,
        user_id: userId,
        resource_type: 'booking_events',
        resource_id: id,
        action: 'update',
        before: { status: existing.status, start_time: existing.start_time },
        after: updatePayload,
        created_at: new Date().toISOString()
      })
    } catch {
      // Best effort
    }

    return NextResponse.json({
      success: true,
      booking
    })
  } catch (error: any) {
    console.error('PATCH /api/bookings/[id] error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/bookings/[id]
 * 
 * Delete (cancel) a booking
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id } = params

    // Get existing booking
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('booking_events')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Verify user has access (must be owner, admin, or creator)
    const { data: memberRows } = await supabaseAdmin
      .from('org_members')
      .select('id, role')
      .eq('organization_id', existing.organization_id)
      .eq('user_id', userId)
      .limit(1)

    if (!memberRows || memberRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Not authorized' },
        { status: 403 }
      )
    }

    const role = memberRows[0].role
    const isCreator = existing.created_by === userId
    if (!['owner', 'admin'].includes(role) && !isCreator) {
      return NextResponse.json(
        { success: false, error: 'Only owners, admins, or the creator can delete bookings' },
        { status: 403 }
      )
    }

    // Check if booking can be deleted
    if (existing.status === 'calling') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete a booking while call is in progress' },
        { status: 400 }
      )
    }

    // Soft delete by setting status to cancelled (or hard delete)
    const { error: deleteError } = await supabaseAdmin
      .from('booking_events')
      .update({ status: 'cancelled' })
      .eq('id', id)

    if (deleteError) {
      console.error('DELETE /api/bookings/[id] error:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete booking' },
        { status: 500 }
      )
    }

    // Audit log
    try {
      await supabaseAdmin.from('audit_logs').insert({
        id: uuidv4(),
        organization_id: existing.organization_id,
        user_id: userId,
        resource_type: 'booking_events',
        resource_id: id,
        action: 'delete',
        before: { status: existing.status },
        after: { status: 'cancelled' },
        created_at: new Date().toISOString()
      })
    } catch {
      // Best effort
    }

    return NextResponse.json({
      success: true,
      message: 'Booking cancelled'
    })
  } catch (error: any) {
    console.error('DELETE /api/bookings/[id] error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
