import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'
import startCallHandler from '@/app/actions/calls/startCallHandler'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/scheduled-calls
 * 
 * Vercel Cron job to process scheduled bookings and originate calls.
 * Runs every minute to check for pending bookings due now.
 * 
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/scheduled-calls",
 *     "schedule": "* * * * *"
 *   }]
 * }
 * 
 * Security: Verify CRON_SECRET to prevent unauthorized access
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret (Vercel Cron sends this automatically)
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // In production, require CRON_SECRET
    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn('Cron: Unauthorized access attempt')
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    const now = new Date()
    const windowStart = new Date(now.getTime() - 60000) // 1 minute ago
    const windowEnd = new Date(now.getTime() + 60000)   // 1 minute from now

    console.log('Cron: Checking scheduled calls', { 
      windowStart: windowStart.toISOString(), 
      windowEnd: windowEnd.toISOString() 
    })

    // Find pending bookings due now (within 1-minute window)
    const { data: bookings, error: fetchError } = await supabaseAdmin
      .from('booking_events')
      .select('*, organizations(plan, tool_id)')
      .eq('status', 'pending')
      .gte('start_time', windowStart.toISOString())
      .lte('start_time', windowEnd.toISOString())
      .limit(10) // Process max 10 per run

    if (fetchError) {
      console.error('Cron: Failed to fetch bookings', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch bookings' },
        { status: 500 }
      )
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No scheduled calls due',
        processed: 0
      })
    }

    console.log(`Cron: Found ${bookings.length} bookings to process`)

    const results: { bookingId: string; success: boolean; error?: string; callId?: string }[] = []

    // Process each booking
    for (const booking of bookings) {
      try {
        // Mark as calling first (idempotency)
        await supabaseAdmin
          .from('booking_events')
          .update({ status: 'calling' })
          .eq('id', booking.id)
          .eq('status', 'pending') // Only if still pending

        // Get voice_configs for modulations
        const { data: vcRows } = await supabaseAdmin
          .from('voice_configs')
          .select('*')
          .eq('organization_id', booking.organization_id)
          .limit(1)

        const voiceConfig = vcRows?.[0] || {}

        // Merge booking modulations with voice_configs
        const modulations = {
          record: voiceConfig.record ?? true,
          transcribe: voiceConfig.transcribe ?? false,
          translate: voiceConfig.translate ?? false,
          translate_from: voiceConfig.translate_from,
          translate_to: voiceConfig.translate_to,
          survey: voiceConfig.survey ?? false,
          ...((booking.modulations as any) || {})
        }

        // Originate call via startCallHandler
        // Use from_number for bridge calls if provided
        const callInput: any = {
          organization_id: booking.organization_id,
          phone_number: booking.attendee_phone,
          modulations
        }
        
        // If from_number is provided, use bridge flow
        if (booking.from_number) {
          callInput.from_number = booking.from_number
          callInput.flow_type = 'bridge'
        }
        
        const callResult = await startCallHandler(
          callInput,
          {
            supabaseAdmin
          }
        )

        if (callResult.success && (callResult as any).call) {
          const call = (callResult as any).call
          // Link call to booking
          await supabaseAdmin
            .from('booking_events')
            .update({ 
              call_id: call.id,
              status: 'completed' // Will be updated by webhook when call ends
            })
            .eq('id', booking.id)

          results.push({
            bookingId: booking.id,
            success: true,
            callId: call.id
          })

          console.log(`Cron: Call placed for booking ${booking.id}`, { 
            callId: call.id 
          })
        } else {
          // Call failed
          await supabaseAdmin
            .from('booking_events')
            .update({ status: 'failed' })
            .eq('id', booking.id)

          results.push({
            bookingId: booking.id,
            success: false,
            error: (callResult as any).error?.message || 'Call initiation failed'
          })

          console.error(`Cron: Call failed for booking ${booking.id}`, callResult)
        }
      } catch (bookingError: any) {
        // Mark booking as failed
        await supabaseAdmin
          .from('booking_events')
          .update({ status: 'failed' })
          .eq('id', booking.id)

        results.push({
          bookingId: booking.id,
          success: false,
          error: bookingError?.message || 'Processing error'
        })

        console.error(`Cron: Error processing booking ${booking.id}`, bookingError)
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    console.log(`Cron: Processed ${results.length} bookings`, { successCount, failCount })

    return NextResponse.json({
      success: true,
      processed: results.length,
      successCount,
      failCount,
      results
    })
  } catch (error: any) {
    console.error('Cron: Unexpected error', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Cron job failed' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cron/scheduled-calls
 * 
 * Manual trigger for testing (requires auth)
 */
export async function POST(req: NextRequest) {
  // Reuse GET handler
  return GET(req)
}
