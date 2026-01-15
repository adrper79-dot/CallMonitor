import { NextResponse } from 'next/server'
import startCallHandler from '@/app/actions/calls/startCallHandler'
import { AppError } from '@/types/app-error'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'
import { withIdempotency } from '@/lib/idempotency'
import { isApiError } from '@/types/api'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

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
    // Import utilities
    const { requireAuth, Errors, success } = await import('@/lib/api/utils')
    
    // Use requireAuth helper for consistent authentication
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) {
      // Authentication failed - return the error response
      return ctx
    }
    
    const userId = ctx.userId
    
    const body = await req.json()
    const supabaseAdmin = (await import('@/lib/supabaseAdmin')).default
    
    // SYSTEM OF RECORD COMPLIANCE (Requirement 1):
    // Reject any client-supplied call_id - IDs must be server-generated only
    if (body.call_id || body.callId || body.id) {
      return Errors.badRequest('Client-supplied call IDs are not permitted. Call IDs are generated server-side only.')
    }
    
    // Determine phone number to call
    let phoneNumber = body.phone_to || body.phone_number || body.to || body.to_number
    
    // If target_id provided, look up phone number from voice_targets
    if (!phoneNumber && body.target_id) {
      const { data: target, error: targetError } = await supabaseAdmin
        .from('voice_targets')
        .select('phone_number')
        .eq('id', body.target_id)
        .single()
      
      if (targetError || !target) {
        return Errors.notFound('Target not found')
      }
      
      phoneNumber = target.phone_number
    }
    
    if (!phoneNumber) {
      return Errors.badRequest('No phone number provided. Enter a number or select a target.')
    }
    
    // Call the existing startCallHandler with actor_id
    const result = await startCallHandler(
      {
        organization_id: body.organization_id || body.orgId || ctx.orgId,
        phone_number: phoneNumber,
        from_number: body.from_number || undefined,  // Agent's phone for bridge calls
        flow_type: body.flow_type || (body.from_number ? 'bridge' : 'outbound'),
        modulations: body.modulations || {},
        actor_id: userId  // CRITICAL: Pass authenticated user ID
      },
      {
        supabaseAdmin
      }
    )

    if (result.success) {
      return success(result)
    } else {
      // Handler returned structured error - preserve error classification for KPI fidelity
      const handlerError = (result as any).error
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
    const { logger } = await import('@/lib/logger')
    const { AppError } = await import('@/types/app-error')
    
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
    // otherwise derive from IP + organization + phone (stable across retries)
    // NOTE: Date.now() was removed as it defeats idempotency (each retry is unique)
    ttlSeconds: 60 // 1 minute - short window to prevent duplicate calls
  }),
  {
    identifier: (req) => {
      // Rate limit by IP + organization (if available)
      const url = new URL(req.url)
      const orgId = url.searchParams.get('orgId')
      return `${getClientIP(req)}-${orgId || 'anonymous'}`
    },
    config: {
      maxAttempts: 10, // Allow more attempts for call initiation
      windowMs: 60 * 1000, // 1 minute window
      blockMs: 5 * 60 * 1000 // 5 minute block
    }
  }
)
