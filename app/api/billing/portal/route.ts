/**
 * Billing API - Billing Portal Session
 * POST /api/billing/portal
 * 
 * Creates a Stripe billing portal session for subscription management
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { requireRole } from '@/lib/auth/requireRole'
import { createBillingPortalSession } from '@/lib/services/stripeService'
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

    // Check if user has owner/admin role (only they can manage billing)
    await requireRole(userId, organizationId, ['owner', 'admin'])

    // Create billing portal session
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=billing`
    const portalUrl = await createBillingPortalSession(organizationId, returnUrl)

    return NextResponse.json({ url: portalUrl })
  } catch (error: any) {
    logger.error('POST /api/billing/portal failed', error)
    
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    
    return NextResponse.json({ error: 'Failed to create billing portal session' }, { status: 500 })
  }
}
