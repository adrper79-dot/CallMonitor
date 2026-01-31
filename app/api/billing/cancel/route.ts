/**
 * Billing API - Cancel Subscription
 * POST /api/billing/cancel
 * 
 * Cancels subscription at the end of current billing period
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac-server'
import { cancelSubscription } from '@/lib/services/stripeService'
import { AppError } from '@/types/app-error'
import { logger } from '@/lib/logger'
import { ApiErrors } from '@/lib/errors/apiHandler'

// Force dynamic rendering - uses session via requireRole
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const session = await requireRole(['owner', 'admin'])
    const organizationId = session.user.organizationId

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
