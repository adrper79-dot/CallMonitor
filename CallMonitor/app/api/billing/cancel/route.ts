/**
 * Billing API - Cancel Subscription
 * POST /api/billing/cancel
 * 
 * Cancels subscription at the end of current billing period
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac-server'
import { cancelSubscription } from '@/lib/services/stripeService'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { AppError } from '@/types/app-error'
import { logger } from '@/lib/logger'
import { ApiErrors } from '@/lib/errors/apiHandler'

// Force dynamic rendering - uses session via requireRole
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Rate limiting commented out for build
// const rateLimiter = rateLimit({
//   interval: 60 * 1000,
//   uniqueTokenPerInterval: 500,
// })

export async function POST(req: NextRequest) {
  try {
    // await rateLimiter.check(req, 10)

    // Authenticate user
    const session = await requireRole(['owner', 'admin'])
    const userId = session.user.id

    // Get user's organization
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('org_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single()

    if (membershipError || !membership) {
      throw new AppError('User is not part of an organization', 404, 'NO_ORGANIZATION')
    }

    const organizationId = membership.organization_id

    // Role already checked by requireRole above

    // Cancel subscription
    await cancelSubscription(organizationId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('POST /api/billing/cancel failed', error)
    
    if (error instanceof AppError) {
      return ApiErrors.internal(error.message)
    }
    
    return ApiErrors.internal('Failed to cancel subscription')
  }
}
