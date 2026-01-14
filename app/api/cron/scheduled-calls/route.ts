import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import startCallHandler from '@/app/actions/calls/startCallHandler'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/scheduled-calls
 * Vercel Cron job to process scheduled bookings and originate calls.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        logger.warn('Cron: Unauthorized access attempt')
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }
    }

    const now = new Date()
    const windowStart = new Date(now.getTime() - 60000)
    const windowEnd = new Date(now.getTime() + 60000)

    logger.info('Cron: Checking scheduled calls', { 
      windowStart: windowStart.toISOString(), 
      windowEnd: windowEnd.toISOString() 
    })

    const { data: bookings, error: fetchError } = await supabaseAdmin
      .from('booking_events')
      .select('*, organizations(plan, tool_id)')
      .eq('status', 'pending')
      .gte('start_time', windowStart.toISOString())
      .lte('start_time', windowEnd.toISOString())
      .limit(10)

    if (fetchError) {
      logger.error('Cron: Failed to fetch bookings', fetchError)
      return NextResponse.json({ success: false, error: 'Failed to fetch bookings' }, { status: 500 })
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ success: true, message: 'No scheduled calls due', processed: 0 })
    }

    logger.info(`Cron: Found ${bookings.length} bookings to process`)

    const results: { bookingId: string; success: boolean; error?: string; callId?: string }[] = []

    for (const booking of bookings) {
      try {
        await supabaseAdmin
          .from('booking_events')
          .update({ status: 'calling' })
          .eq('id', booking.id)
          .eq('status', 'pending')

        const { data: vcRows } = await supabaseAdmin
          .from('voice_configs')
          .select('*')
          .eq('organization_id', booking.organization_id)
          .limit(1)

        const voiceConfig = vcRows?.[0] || {}

        const modulations = {
          record: voiceConfig.record ?? true,
          transcribe: voiceConfig.transcribe ?? false,
          translate: voiceConfig.translate ?? false,
          translate_from: voiceConfig.translate_from,
          translate_to: voiceConfig.translate_to,
          survey: voiceConfig.survey ?? false,
          ...((booking.modulations as any) || {})
        }

        const callInput: any = {
          organization_id: booking.organization_id,
          phone_number: booking.attendee_phone,
          modulations
        }
        
        if (booking.from_number) {
          callInput.from_number = booking.from_number
          callInput.flow_type = 'bridge'
        }
        
        const callResult = await startCallHandler(callInput, { supabaseAdmin })

        if (callResult.success && (callResult as any).call) {
          const call = (callResult as any).call
          await supabaseAdmin
            .from('booking_events')
            .update({ call_id: call.id, status: 'completed' })
            .eq('id', booking.id)

          results.push({ bookingId: booking.id, success: true, callId: call.id })
          logger.info(`Cron: Call placed for booking ${booking.id}`, { callId: call.id })
        } else {
          await supabaseAdmin.from('booking_events').update({ status: 'failed' }).eq('id', booking.id)
          results.push({
            bookingId: booking.id,
            success: false,
            error: (callResult as any).error?.message || 'Call initiation failed'
          })
          logger.error(`Cron: Call failed for booking ${booking.id}`, undefined, { result: callResult })
        }
      } catch (bookingError: any) {
        await supabaseAdmin.from('booking_events').update({ status: 'failed' }).eq('id', booking.id)
        results.push({ bookingId: booking.id, success: false, error: bookingError?.message || 'Processing error' })
        logger.error(`Cron: Error processing booking ${booking.id}`, bookingError)
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    logger.info(`Cron: Processed ${results.length} bookings`, { successCount, failCount })

    return NextResponse.json({ success: true, processed: results.length, successCount, failCount, results })
  } catch (error: any) {
    logger.error('Cron: Unexpected error', error)
    return NextResponse.json({ success: false, error: error?.message || 'Cron job failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
