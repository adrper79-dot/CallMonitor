/**
 * Billing API - Billing Portal Session
 * POST /api/billing/portal
 * 
 * Creates a Stripe billing portal session for subscription management
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac'
import { createBillingPortalSession } from '@/lib/services/stripeService'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { AppError } from '@/types/app-error'
import { logger } from '@/lib/logger'

// Rate limiting commented out for build
// const rateLimiter = rateLimit({
//   interval: 60 * 1000,
//   uniqueTokenPerInterval: 500,
// })

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
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

    // Role already checked by requireRole at start

    // Create billing portal session
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=billing`
    const portalUrl = await createBillingPortalSession(organizationId, returnUrl)

    return NextResponse.json({ url: portalUrl })
  } catch (error: any) {
    logger.error('POST /api/billing/portal failed', error)
    
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.httpStatus })
    }
    
    return NextResponse.json({ error: 'Failed to create billing portal session' }, { status: 500 })
  }
}
