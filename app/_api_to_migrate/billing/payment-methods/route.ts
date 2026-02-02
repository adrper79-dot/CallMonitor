/**
 * Billing Payment Methods API
 * GET /api/billing/payment-methods
 * 
 * Returns payment methods for the current organization.
 * Per ARCH_DOCS: RBAC enforced, owner/admin only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac-server'
import { getPaymentMethods } from '@/lib/services/stripeService'
import { logger } from '@/lib/logger'
import { ApiErrors } from '@/lib/errors/apiHandler'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    // Authenticate user (Owner/Admin only)
    const session = await requireRole(['owner', 'admin'])
    const organizationId = session.user.organizationId

    // Get payment methods from service
    const paymentMethods = await getPaymentMethods(organizationId)

    // Mask sensitive data
    const maskedPaymentMethods = (paymentMethods || []).map((pm: any) => ({
      id: pm.id,
      type: pm.type,
      isDefault: pm.is_default,
      card: pm.type === 'card' ? {
        brand: pm.card_brand,
        last4: pm.card_last4,
        expMonth: pm.card_exp_month,
        expYear: pm.card_exp_year
      } : null,
      createdAt: pm.created_at
    }))

    return NextResponse.json({
      success: true,
      paymentMethods: maskedPaymentMethods
    })
  } catch (error: any) {
    logger.error('GET /api/billing/payment-methods failed', error)
    return ApiErrors.internal('Failed to fetch payment methods')
  }
}
