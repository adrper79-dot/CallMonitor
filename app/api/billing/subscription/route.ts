/**
 * Billing API - Get Subscription
 * GET /api/billing/subscription
 * 
 * Retrieves current subscription details for the user's organization
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac-server'
import { getSubscription, getInvoices, getPaymentMethods } from '@/lib/services/stripeService'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { AppError } from '@/types/app-error'
import { logger } from '@/lib/logger'
import { ApiErrors } from '@/lib/errors/apiHandler'

// Force dynamic rendering - uses session via requireRole
export const dynamic = 'force-dynamic'
export const runtime = 'edge'

// Rate limiting commented out for build
// const rateLimiter = rateLimit({
//   interval: 60 * 1000,
//   uniqueTokenPerInterval: 500,
// })

export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    // await rateLimiter.check(req, 60)

    // Authenticate user
    const session = await requireRole('viewer')
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

    // Get subscription details
    const subscription = await getSubscription(organizationId)
    
    // Get recent invoices
    const invoices = await getInvoices(organizationId, 5)
    
    // Get payment methods (only for owner/admin)
    let paymentMethods = []
    try {
      const { data: role } = await supabaseAdmin
        .from('org_members')
        .select('role')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .single()
      
      if (role?.role === 'owner' || role?.role === 'admin') {
        paymentMethods = await getPaymentMethods(organizationId)
      }
    } catch (err) {
      // Ignore errors, just don't return payment methods
    }

    return NextResponse.json({
      subscription,
      invoices,
      paymentMethods,
    })
  } catch (error: any) {
    logger.error('GET /api/billing/subscription failed', error)
    
    if (error instanceof AppError) {
      return ApiErrors.internal(error.message)
    }
    
    return ApiErrors.internal('Failed to fetch subscription')
  }
}
