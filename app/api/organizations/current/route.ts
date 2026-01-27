/**
 * Organization Current API
 * GET /api/organizations/current
 * 
 * Returns the current user's organization with plan and member count.
 * Per ARCH_DOCS: RBAC enforced, structured error handling.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export async function GET() {
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

    // Get user's organization membership
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('org_members')
      .select(`
        role,
        organization_id,
        organizations (
          id,
          name,
          plan,
          plan_status,
          stripe_customer_id,
          stripe_subscription_id,
          created_at
        )
      `)
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (membershipError || !membership) {
      // User might not have an organization yet - return null org
      return NextResponse.json({
        success: true,
        organization: null,
        role: null,
        message: 'User is not part of any organization'
      })
    }

    const org = membership.organizations as any

    // Get member count
    const { count: memberCount } = await supabaseAdmin
      .from('org_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', org.id)

    // Get subscription status from stripe_subscriptions if available
    let subscription: any = null
    try {
      const { data: sub } = await supabaseAdmin
        .from('stripe_subscriptions')
        .select('status, plan, current_period_end, cancel_at_period_end')
        .eq('organization_id', org.id)
        .order('current_period_end', { ascending: false })
        .limit(1)
        .single()
      
      if (sub) {
        subscription = sub
      }
    } catch {
      // No subscription found - that's okay for free tier
    }

    const planValue: any = subscription?.plan ?? (org as any).plan ?? 'free'
    const planStatusValue: any = subscription?.status ?? (org as any).plan_status ?? 'active'

    return NextResponse.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        plan: planValue,
        plan_status: planStatusValue,
        member_count: memberCount || 1,
        created_at: (org as any).created_at,
        subscription: subscription ? {
          status: subscription.status,
          current_period_end: subscription.current_period_end,
          cancel_at_period_end: subscription.cancel_at_period_end
        } : null
      },
      role: membership.role
    })
  } catch (error: any) {
    logger.error('GET /api/organizations/current failed', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch organization' } },
      { status: 500 }
    )
  }
}
