/**
 * Billing Invoices API
 * GET /api/billing/invoices
 * 
 * Returns invoice history for the current organization.
 * Per ARCH_DOCS: RBAC enforced, pagination supported.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac-server'
import { query } from '@/lib/pgClient'
import { logger } from '@/lib/logger'
import { ApiErrors } from '@/lib/errors/apiHandler'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    // Authenticate user (Viewer role minimal)
    const session = await requireRole('viewer')
    const organizationId = session.user.organizationId

    // Parse query params
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 50)
    const offset = (page - 1) * limit

    // Get invoices with pagination
    // Using direct query for pagination support, as service layer is simple
    const { rows: invoices } = await query(
      `SELECT * FROM stripe_invoices
       WHERE organization_id = $1
       ORDER BY invoice_date DESC
       LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    )

    // Get total count for pagination
    const { rows: countRows } = await query(
      `SELECT COUNT(*) as total FROM stripe_invoices WHERE organization_id = $1`,
      [organizationId]
    )
    const total = parseInt(countRows[0]?.total || '0', 10)

    return NextResponse.json({
      success: true,
      invoices: invoices || [],
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error: any) {
    logger.error('GET /api/billing/invoices failed', error)
    return ApiErrors.internal('Failed to fetch invoices')
  }
}
