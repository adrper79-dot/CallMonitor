/**
 * Billing API - Create Checkout Session
 * POST /api/billing/checkout
 * 
 * Creates a Stripe checkout session for subscription purchase
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { requireRole } from '@/lib/auth/requireRole'
import { createCheckoutSession } from '@/lib/services/stripeService'
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
    const userEmail = user.email || ''

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

    // Check if user has owner/admin role (only they can manage billing)
    await requireRole(userId, organizationId, ['owner', 'admin'])

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
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
