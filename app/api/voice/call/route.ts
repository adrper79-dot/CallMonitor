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
    // Get authenticated session
    const { getServerSession } = await import('next-auth/next')
    const { authOptions } = await import('@/lib/auth')
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }
    
    const body = await req.json()
    const supabaseAdmin = (await import('@/lib/supabaseAdmin')).default
    
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
        return NextResponse.json(
          { success: false, error: { code: 'TARGET_NOT_FOUND', message: 'Target not found' } },
          { status: 404 }
        )
      }
      
      phoneNumber = target.phone_number
    }
    
    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_PHONE_NUMBER', message: 'No phone number provided. Enter a number or select a target.' } },
        { status: 400 }
      )
    }
    
    // Call the existing startCallHandler with actor_id
    const result = await startCallHandler(
      {
        organization_id: body.organization_id || body.orgId,
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
      return NextResponse.json(result)
    } else {
      const error = isApiError(result) ? result.error : { code: 'CALL_START_FAILED', message: 'Failed to start call', severity: 'HIGH' as const }
      return NextResponse.json(
        { success: false, error },
        { status: (error as any).httpStatus || 500 }
      )
    }
  } catch (err: any) {
    const e = err instanceof AppError ? err : new AppError({ 
      code: 'CALL_START_FAILED', 
      message: err?.message ?? 'Unexpected error', 
      user_message: 'Failed to start call', 
      severity: 'HIGH' 
    })
    return NextResponse.json(
      { success: false, error: { id: e.id, code: e.code, message: e.user_message, severity: e.severity } },
      { status: e.httpStatus || 500 }
    )
  }
}

export const POST = withRateLimit(
  withIdempotency(handlePOST, {
    getKey: (req) => {
      // Use organization_id + phone_to as idempotency key if no header provided
      return getClientIP(req) + '-' + Date.now().toString()
    },
    ttlSeconds: 3600 // 1 hour
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
