/**
 * Billing API - Create Checkout Session
 * POST /api/billing/checkout
 * 
 * Creates a Stripe checkout session for subscription purchase
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac-server'
import { createCheckoutSession } from '@/lib/services/stripeService'
import { query } from '@/lib/pgClient'
import { AppError } from '@/types/app-error'
import { logger } from '@/lib/logger'
import { ApiErrors } from '@/lib/errors/apiHandler'

// Force dynamic rendering - uses session via requireRole
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    // Authenticate user (Owner/Admin only)
    const session = await requireRole(['owner', 'admin'])
    const organizationId = session.user.organizationId
    const userEmail = session.user.email || ''

    // Parse request body
    const body = await req.json()
    const { priceId } = body

    if (!priceId) {
      throw new AppError('Price ID is required', 400, 'MISSING_PRICE_ID')
    }

    // Get organization name for display
    let organizationName = 'Your Organization'
    try {
      const { rows } = await query(
        'SELECT name FROM organizations WHERE id = $1 LIMIT 1',
        [organizationId]
      )
      if (rows.length > 0) {
        organizationName = rows[0].name
      }
    } catch (e) {
      // Fallback to default name if query fails
      logger.warn('Failed to fetch org name for checkout', { organizationId })
    }

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
