/**
 * Billing Invoices API
 * GET /api/billing/invoices
 * 
 * Returns invoice history for the current organization.
 * Per ARCH_DOCS: RBAC enforced, pagination supported.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

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
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 50)
    const offset = (page - 1) * limit

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

    // Verify user is member of this organization
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

    // Get invoices with pagination
    const { data: invoices, error, count } = await supabaseAdmin
      .from('stripe_invoices')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('invoice_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      // Table might not exist yet or no invoices
      logger.warn('Failed to fetch invoices', { error: error.message, organizationId })
      return NextResponse.json({
        success: true,
        invoices: [],
        pagination: { page, limit, total: 0, pages: 0 }
      })
    }

    return NextResponse.json({
      success: true,
      invoices: invoices || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error: any) {
    logger.error('GET /api/billing/invoices failed', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch invoices' } },
      { status: 500 }
    )
  }
}
