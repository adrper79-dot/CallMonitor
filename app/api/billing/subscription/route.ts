/**
 * Billing API - Get Subscription
 * GET /api/billing/subscription
 * 
 * Retrieves current subscription details for the user's organization
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { getSubscription, getInvoices, getPaymentMethods } from '@/lib/services/stripeService'
import { supabaseAdmin } from '@/lib/supabase/supabaseAdmin'
import { AppError } from '@/lib/errors/AppError'
import { logger } from '@/lib/logger'
import { rateLimit } from '@/lib/api/rateLimit'

const rateLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
})

export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    await rateLimiter.check(req, 60) // 60 requests per minute

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
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
  }
}
