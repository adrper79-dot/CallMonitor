/**
 * Billing API - Billing Portal Session
 * POST /api/billing/portal
 * 
 * Creates a Stripe billing portal session for subscription management
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac-server'
import { createBillingPortalSession } from '@/lib/services/stripeService'
import { AppError } from '@/types/app-error'
import { logger } from '@/lib/logger'
import { ApiErrors } from '@/lib/errors/apiHandler'

// Force dynamic rendering - uses session via requireRole
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    // Authenticate user & Get Organization
    // requireRole now returns { user: { ..., organizationId } }
    const session = await requireRole(['owner', 'admin'])
    const organizationId = session.user.organizationId

    // Create billing portal session
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=billing`
    const portalUrl = await createBillingPortalSession(organizationId, returnUrl)

    return NextResponse.json({ url: portalUrl })
  } catch (error: any) {
    logger.error('POST /api/billing/portal failed', error)

    if (error instanceof AppError) {
      return ApiErrors.internal(error.message)
    }

    return ApiErrors.internal('Failed to create billing portal session')
  }
}
