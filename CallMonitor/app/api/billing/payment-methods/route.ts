/**
 * Billing Payment Methods API
 * GET /api/billing/payment-methods
 * 
 * Returns payment methods for the current organization.
 * Per ARCH_DOCS: RBAC enforced, owner/admin only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    // Get authenticated user
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Parse query params
    const url = new URL(req.url)
    const orgId = url.searchParams.get('orgId')

    // Get user's organization if not provided
    let organizationId = orgId
    if (!organizationId) {
      const { data: membership } = await supabaseAdmin
        .from('org_members')
        .select('organization_id')
        .eq('user_id', userId)
        .limit(1)
        .single()

      if (!membership) {
        return NextResponse.json(
          { success: false, error: { code: 'NO_ORGANIZATION', message: 'User is not part of an organization' } },
          { status: 404 }
        )
      }
      organizationId = membership.organization_id
    }

    // Verify user is owner or admin of this organization
    const { data: memberCheck } = await supabaseAdmin
      .from('org_members')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single()

    if (!memberCheck) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authorized for this organization' } },
        { status: 403 }
      )
    }

    // Only owner/admin can view payment methods
    if (!['owner', 'admin'].includes(memberCheck.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only owners and admins can view payment methods' } },
        { status: 403 }
      )
    }

    // Get payment methods
    const { data: paymentMethods, error } = await supabaseAdmin
      .from('stripe_payment_methods')
      .select(`
        id,
        stripe_payment_method_id,
        type,
        is_default,
        card_brand,
        card_last4,
        card_exp_month,
        card_exp_year,
        created_at
      `)
      .eq('organization_id', organizationId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      // Table might not exist yet or no payment methods
      logger.warn('Failed to fetch payment methods', { error: error.message, organizationId })
      return NextResponse.json({
        success: true,
        paymentMethods: []
      })
    }

    // Mask sensitive data
    const maskedPaymentMethods = (paymentMethods || []).map(pm => ({
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
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payment methods' } },
      { status: 500 }
    )
  }
}
