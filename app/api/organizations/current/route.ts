/**
 * Organization Current API
 * GET /api/organizations/current
 * 
 * Returns the current user's organization with plan and member count.
 * Per ARCH_DOCS: RBAC enforced, structured error handling.
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireRole } from '@/lib/rbac-server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    // Authenticate user
    const session = await requireRole('viewer')
    const userId = session.user.id
    const organizationId = session.user.organizationId
    // Note: requireRole ensures the user is a member of *an* organization.
    // If we want to support users with no org, we'd need requireAuth and check org existence separate.
    // But `organizations/current` implies fetching *the* org.

    if (!organizationId) {
      // Should be caught by requireRole, but safe check
      return NextResponse.json({
        success: true,
        organization: null,
        role: null,
        message: 'User is not part of any organization'
      })
    }

    // Get organization details via JOIN
    const { rows: orgRows } = await query(
      `SELECT om.role, om.organization_id,
              o.id, o.name, o.plan, o.plan_status, o.stripe_customer_id, o.stripe_subscription_id, o.created_at
       FROM org_members om
       JOIN organizations o ON om.organization_id = o.id
       WHERE om.user_id = $1 AND om.organization_id = $2
       LIMIT 1`,
      [userId, organizationId]
    )

    if (orgRows.length === 0) {
      return NextResponse.json({
        success: true,
        organization: null,
        role: null,
        message: 'Organization not found'
      })
    }

    const orgRow = orgRows[0]

    // Get member count
    const { rows: countRows } = await query(
      `SELECT COUNT(*) as head_count FROM org_members WHERE organization_id = $1`,
      [organizationId]
    )
    const memberCount = parseInt(countRows[0]?.head_count || '1', 10)

    // Get subscription status
    const { rows: subRows } = await query(
      `SELECT status, plan, current_period_end, cancel_at_period_end
       FROM stripe_subscriptions
       WHERE organization_id = $1
       ORDER BY current_period_end DESC
       LIMIT 1`,
      [organizationId]
    )
    const subscription = subRows[0] || null

    // Determine plan values
    const planValue = subscription?.plan ?? orgRow.plan ?? 'free'
    const planStatusValue = subscription?.status ?? orgRow.plan_status ?? 'active'

    return NextResponse.json({
      success: true,
      organization: {
        id: orgRow.id,
        name: orgRow.name,
        plan: planValue,
        plan_status: planStatusValue,
        member_count: memberCount,
        created_at: orgRow.created_at,
        subscription: subscription ? {
          status: subscription.status,
          current_period_end: subscription.current_period_end,
          cancel_at_period_end: subscription.cancel_at_period_end
        } : null
      },
      role: orgRow.role
    })

  } catch (error: any) {
    logger.error('GET /api/organizations/current failed', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch organization' } },
      { status: 500 }
    )
  }
}
