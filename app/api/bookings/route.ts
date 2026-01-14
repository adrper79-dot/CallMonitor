import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'
import { AppError } from '@/types/app-error'
import { planSupportsFeature } from '@/lib/rbac'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/bookings
 * 
 * List booking events for the user's organization
 * Supports filtering by status, date range
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user's organization
    const { data: userRows } = await supabaseAdmin
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .limit(1)

    const orgId = userRows?.[0]?.organization_id
    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Check booking capability
    const { data: orgRows } = await supabaseAdmin
      .from('organizations')
      .select('plan, booking_enabled')
      .eq('id', orgId)
      .limit(1)

    const org = orgRows?.[0]
    if (!planSupportsFeature(org?.plan || 'free', 'booking')) {
      return NextResponse.json(
        { success: false, error: 'Booking feature not available on your plan' },
        { status: 403 }
      )
    }

    // Parse query params
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)

    // Build query
    let query = supabaseAdmin
      .from('booking_events')
      .select('*, calls(id, status, started_at, ended_at)')
      .eq('organization_id', orgId)
      .order('start_time', { ascending: true })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }
    if (from) {
      query = query.gte('start_time', from)
    }
    if (to) {
      query = query.lte('start_time', to)
    }

    const { data: bookings, error, count } = await query

    if (error) {
      console.error('GET /api/bookings error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch bookings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      bookings: bookings || [],
      total: count,
      limit,
      offset
    })
  } catch (error: any) {
    console.error('GET /api/bookings error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/bookings
 * 
 * Create a new booking event
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const {
      title,
      description,
      start_time,
      end_time,
      duration_minutes = 30,
      timezone = 'UTC',
      attendee_name,
      attendee_email,
      attendee_phone,
      from_number,  // Your number (for bridge calls)
      modulations = {},
      notes
    } = body

    // Validate required fields
    if (!title || !start_time || !attendee_phone) {
      return NextResponse.json(
        { success: false, error: 'title, start_time, and attendee_phone are required' },
        { status: 400 }
      )
    }

    // Validate phone format (basic E.164 check)
    if (!attendee_phone.match(/^\+?[1-9]\d{1,14}$/)) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number format (use E.164)' },
        { status: 400 }
      )
    }

    // Validate start_time is not in the past (allow calls starting now)
    const startDate = new Date(start_time)
    const now = new Date()
    // Allow calls up to 5 minutes in the past (for immediate scheduling)
    if (startDate < new Date(now.getTime() - 5 * 60 * 1000)) {
      return NextResponse.json(
        { success: false, error: 'start_time cannot be in the past' },
        { status: 400 }
      )
    }

    // Get user's organization
    const { data: userRows } = await supabaseAdmin
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .limit(1)

    const orgId = userRows?.[0]?.organization_id
    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Check booking capability
    const { data: orgRows } = await supabaseAdmin
      .from('organizations')
      .select('plan, booking_enabled')
      .eq('id', orgId)
      .limit(1)

    const org = orgRows?.[0]
    if (!planSupportsFeature(org?.plan || 'free', 'booking')) {
      return NextResponse.json(
        { success: false, error: 'Booking feature not available on your plan' },
        { status: 403 }
      )
    }

    // Calculate end_time if not provided
    const endTime = end_time || new Date(startDate.getTime() + duration_minutes * 60000).toISOString()

    // Create booking
    const bookingId = uuidv4()
    const insertData: any = {
      id: bookingId,
      organization_id: orgId,
      user_id: userId,
      title,
      description,
      start_time,
      end_time: endTime,
      duration_minutes,
      timezone,
      attendee_name,
      attendee_email,
      attendee_phone,
      modulations,
      notes,
      status: 'pending',
      created_by: userId
    }
    
    // Add from_number if provided (for bridge calls)
    if (from_number) {
      insertData.from_number = from_number
    }
    
    const { data: booking, error } = await supabaseAdmin
      .from('booking_events')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('POST /api/bookings error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create booking' },
        { status: 500 }
      )
    }

    // Audit log
    try {
      await supabaseAdmin.from('audit_logs').insert({
        id: uuidv4(),
        organization_id: orgId,
        user_id: userId,
        resource_type: 'booking_events',
        resource_id: bookingId,
        action: 'create',
        before: null,
        after: { title, start_time, attendee_phone: '[REDACTED]' },
        created_at: new Date().toISOString()
      })
    } catch {
      // Best effort
    }

    console.log('Booking created:', { bookingId, orgId, startTime: start_time })

    return NextResponse.json({
      success: true,
      booking
    }, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/bookings error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
