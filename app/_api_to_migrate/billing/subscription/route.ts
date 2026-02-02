/**
 * Billing API - Get Subscription
 * GET /api/billing/subscription
 * 
 * Retrieves current subscription details for the user's organization
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac-server'
import { getSubscription, getInvoices, getPaymentMethods } from '@/lib/services/stripeService'
import { logger } from '@/lib/logger'
import { ApiErrors } from '@/lib/errors/apiHandler'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    // Authenticate user (Viewer minimal)
    const session = await requireRole('viewer')
    const organizationId = session.user.organizationId
    const userRole = session.user.role

    // Get subscription details
    const subscription = await getSubscription(organizationId)

    // Get recent invoices
    const invoices = await getInvoices(organizationId, 5)

    // Get payment methods (only for owner/admin)
    let paymentMethods: any[] = []
    if (userRole === 'owner' || userRole === 'admin') {
      try {
        paymentMethods = await getPaymentMethods(organizationId)
      } catch (err) {
        // Ignore errors, implies no payment methods or transient issue
        logger.warn('Failed to fetch payment methods for subscription view', { organizationId })
      }
    }

    return NextResponse.json({
      subscription,
      invoices,
      paymentMethods,
    })
  } catch (error: any) {
    logger.error('GET /api/billing/subscription failed', error)
    return ApiErrors.internal('Failed to fetch subscription')
  }
}
