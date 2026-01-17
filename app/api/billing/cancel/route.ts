/**
 * Billing API - Cancel Subscription
 * POST /api/billing/cancel
 * 
 * Cancels subscription at the end of current billing period
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { requireRole } from '@/lib/auth/requireRole'
import { cancelSubscription } from '@/lib/services/stripeService'
import { supabaseAdmin } from '@/lib/supabase/supabaseAdmin'
import { AppError } from '@/lib/errors/AppError'
import { logger } from '@/lib/logger'
import { rateLimit } from '@/lib/api/rateLimit'

const rateLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
})

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    await rateLimiter.check(req, 10) // 10 requests per minute

    // Authenticate user
    const user = await requireAuth(req)
    const userId = user.id

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

    // Check if user has owner role (only owner can cancel subscription)
    await requireRole(userId, organizationId, ['owner'])

    // Cancel subscription
    await cancelSubscription(organizationId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('POST /api/billing/cancel failed', error)
    
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
  }
}
