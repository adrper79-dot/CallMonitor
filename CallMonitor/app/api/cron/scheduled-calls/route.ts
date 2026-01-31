import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import startCallHandler from '@/app/actions/calls/startCallHandler'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/cron/scheduled-calls
 * Vercel Cron job to process scheduled bookings and originate calls.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // SECURITY: Always require CRON_SECRET if configured (not just in production)
    // This prevents unauthorized access to the cron endpoint in all environments
    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        logger.warn('Cron: Unauthorized access attempt', {
          environment: process.env.NODE_ENV,
          hasAuth: !!authHeader
        })
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }
    } else if (process.env.NODE_ENV === 'production') {
      // In production, CRON_SECRET must be set
      logger.error('Cron: CRON_SECRET not configured in production')
      return NextResponse.json({
        success: false,
        error: 'Server configuration error: CRON_SECRET required'
      }, { status: 500 })
    }

    const now = new Date()
    const windowStart = new Date(now.getTime() - 15 * 60000) // Look back 15 minutes
    const windowEnd = new Date(now.getTime() + 60000) // Look ahead 1 minute

    logger.info('Cron: Checking scheduled calls', {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString()
    })

    /*
      Select bookings that are pending and within the time window.
      Join organizations to get plan and tool_id.
    */
    const { rows: bookings } = await query(
      `SELECT b.*, o.plan, o.tool_id 
       FROM booking_events b
       JOIN organizations o ON b.organization_id = o.id
       WHERE b.status = 'pending' 
         AND b.start_time >= $1 
         AND b.start_time <= $2
       LIMIT 10`,
      [windowStart.toISOString(), windowEnd.toISOString()]
    )

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ success: true, message: 'No scheduled calls due', processed: 0 })
    }

    logger.info(`Cron: Found ${bookings.length} bookings to process`)

    const results: { bookingId: string; success: boolean; error?: string; callId?: string }[] = []

    for (const booking of bookings) {
      try {
        await query(
          `UPDATE booking_events SET status = 'calling' WHERE id = $1 AND status = 'pending'`,
          [booking.id]
        )

        const { rows: vcRows } = await query(
          `SELECT * FROM voice_configs WHERE organization_id = $1 LIMIT 1`,
          [booking.organization_id]
        )

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
          modulations,
          actor_id: 'system-cron' // Cron jobs run as system, not a user
        }

        if (booking.from_number) {
          callInput.from_number = booking.from_number
          callInput.flow_type = 'bridge'
        }

        // Updated signature: no longer passes { supabaseAdmin }
        const callResult = await startCallHandler(callInput)

        if (callResult.success && (callResult as any).call) {
          const call = (callResult as any).call
          await query(
            `UPDATE booking_events SET call_id = $1, status = 'completed' WHERE id = $2`,
            [call.id, booking.id]
          )

          results.push({ bookingId: booking.id, success: true, callId: call.id })
          logger.info(`Cron: Call placed for booking ${booking.id}`, { callId: call.id })
        } else {
          await query(
            `UPDATE booking_events SET status = 'failed' WHERE id = $1`,
            [booking.id]
          )
          results.push({
            bookingId: booking.id,
            success: false,
            error: (callResult as any).error?.message || 'Call initiation failed'
          })
          logger.error(`Cron: Call failed for booking ${booking.id}`, undefined, { result: callResult })
        }
      } catch (bookingError: any) {
        await query(
          `UPDATE booking_events SET status = 'failed' WHERE id = $1`,
          [booking.id]
        ).catch(() => { }) // Ignore update error
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
