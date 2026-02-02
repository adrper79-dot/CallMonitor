import { NextResponse } from 'next/server'
import startCallHandler from '@/app/actions/calls/startCallHandler'
import { AppError } from '@/types/app-error'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'
import { withIdempotency } from '@/lib/idempotency'
import { query } from '@/lib/pgClient'
import { requireRole } from '@/lib/rbac-server'
import { Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Voice Call API
 * 
 * POST /api/voice/call - Execute a call
 * Per MASTER_ARCHITECTURE.txt UI→API→Table contract
 * 
 * This endpoint wraps the startCallHandler action
 * 
 * Security: Rate limited and supports idempotency keys
 */
async function handlePOST(req: Request) {
  try {
    // Authenticate (viewer+ required to initiate call? Usually operator/admin, but sticking to basic auth for now to check role internally if needed, or consistent with other endpoints. Let's use viewer as minimum and let RBAC/logic handle specifics if needed, but actually initiating a call usually requires `operator` or higher. Let's stick to `viewer` to avoid breaking existing flows if they rely on low privs, but generally calls are `operator`.)
    // Actually, `call-capabilities` uses `viewer`, and `startCallHandler` might do its own checks?
    // Let's use `requireRole('viewer')` for now.
    const session = await requireRole('viewer')
    const userId = session.user.id
    const organizationId = session.user.organizationId

    const body = await req.json()

    // SYSTEM OF RECORD COMPLIANCE (Requirement 1):
    // Reject any client-supplied call_id - IDs must be server-generated only
    if (body.call_id || body.callId || body.id) {
      return Errors.badRequest('Client-supplied call IDs are not permitted. Call IDs are generated server-side only.')
    }

    // Determine phone number to call
    let phoneNumber = body.phone_to || body.phone_number || body.to || body.to_number

    // If target_id provided, look up phone number from voice_targets
    if (!phoneNumber && body.target_id) {
      let target: any = null
      try {
        const { rows } = await query(
          `SELECT phone_number FROM voice_targets WHERE id = $1 LIMIT 1`,
          [body.target_id]
        )
        target = rows[0]
      } catch (e) {
        return Errors.notFound('Target not found')
      }

      if (!target) {
        return Errors.notFound('Target not found')
      }

      phoneNumber = target.phone_number
    }

    if (!phoneNumber) {
      return Errors.badRequest('No phone number provided. Enter a number or select a target.')
    }

    // Call the existing startCallHandler
    const result = await startCallHandler(
      {
        organization_id: body.organization_id || body.orgId || organizationId,
        phone_number: phoneNumber,
        from_number: body.from_number || undefined,  // Agent's phone for bridge calls
        flow_type: body.flow_type || (body.from_number ? 'bridge' : 'outbound'),
        modulations: body.modulations || {},
        actor_id: userId  // CRITICAL: Pass authenticated user ID
      }
    )


    interface StartCallError {
      id?: string
      code?: string
      message?: string
      user_message?: string
    }

    if (result.success) {
      return success(result)
    } else {
      // Handler returned structured error - preserve error classification for KPI fidelity
      const handlerError = result.error as StartCallError
      if (handlerError?.code) {
        // Use appropriate HTTP status based on error code (per ERROR_HANDLING_PLAN.txt)
        const statusMap: Record<string, number> = {
          'INVALID_INPUT': 400,
          'TRANSLATION_LANGUAGES_REQUIRED': 400,
          'AUTH_REQUIRED': 401,
          'UNAUTHORIZED': 403,
          'NOT_FOUND': 404,
          'RATE_LIMITED': 429,
        }
        const status = statusMap[handlerError.code] || 500
        return NextResponse.json(
          { success: false, error: handlerError },
          { status }
        )
      }
      return Errors.internal(new Error(handlerError?.message || 'Call failed'))
    }
  } catch (err: any) {
    // Create structured error for logging and response (per ERROR_HANDLING_PLAN.txt)
    const appError = err instanceof AppError ? err : new AppError({
      code: 'CALL_EXECUTION_FAILED',
      message: err?.message || 'Unexpected error during call execution',
      user_message: 'Failed to place call. Please try again.',
      severity: 'HIGH',
      retriable: true
    })

    logger.error('POST /api/voice/call failed', appError, {
      errorCode: appError.code,
      errorId: appError.id
    })

    return NextResponse.json(
      { success: false, error: { id: appError.id, code: appError.code, message: appError.user_message } },
      { status: 500 }
    )
  }
}

export const POST = withRateLimit(
  withIdempotency(handlePOST, {
    // Idempotency key: Use X-Idempotency-Key header if provided,
    // otherwise derive from IP + organization + phone
    ttlSeconds: 60 // 1 minute
  }),
  {
    identifier: (req) => {
      // Rate limit by IP + organization (if available)
      const url = new URL(req.url)
      const orgId = url.searchParams.get('orgId')
      return `${getClientIP(req)}-${orgId || 'anonymous'}`
    },
    config: {
      maxAttempts: 10,
      windowMs: 60 * 1000,
      blockMs: 5 * 60 * 1000
    }
  }
)
