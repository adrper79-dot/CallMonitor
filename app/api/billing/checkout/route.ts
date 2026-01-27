/**
 * Billing API - Create Checkout Session
 * POST /api/billing/checkout
 * 
 * Creates a Stripe checkout session for subscription purchase
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac-server'
import { createCheckoutSession } from '@/lib/services/stripeService'
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
    // Rate limiting
    // await rateLimiter.check(req, 10)

    // Authenticate user
    const session = await requireRole(['owner', 'admin'])
    const userId = session.user.id
    const userEmail = session.user.email || ''

    // Parse request body
    const body = await req.json()
    const { priceId } = body

    if (!priceId) {
      throw new AppError('Price ID is required', 400, 'MISSING_PRICE_ID')
    }

    // Get user's organization
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('org_members')
      .select('organization_id, organizations(id, name)')
      .eq('user_id', userId)
      .single()

    if (membershipError || !membership) {
      throw new AppError('User is not part of an organization', 404, 'NO_ORGANIZATION')
    }

    const organizationId = membership.organization_id
    const organizationName = (membership.organizations as any)?.name || 'Your Organization'

    // Role already checked by requireRole at start

    // Create checkout session
    const successUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=billing&session=success`
    const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=billing&session=cancelled`

    const checkoutUrl = await createCheckoutSession({
      organizationId,
      organizationName,
      userEmail,
      priceId,
      successUrl,
      cancelUrl,
    })

    return NextResponse.json({ url: checkoutUrl })
  } catch (error: any) {
    logger.error('POST /api/billing/checkout failed', error)
    
    if (error instanceof AppError) {
      return ApiErrors.internal(error.message)
    }
    
    return ApiErrors.internal('Failed to create checkout session')
  }
}
