/**
 * Webhook Delivery Logs API
 * 
 * GET /api/webhooks/subscriptions/[id]/deliveries - Get delivery logs for a webhook
 * 
 * Query params:
 * - limit (default 50, max 100)
 * - offset (pagination)
 * - status (filter: pending|delivered|failed|retrying)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/pgClient'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

/**
 * GET /api/webhooks/subscriptions/[id]/deliveries
 * Get delivery logs for a specific webhook
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const webhookId = params.id

    // Get user's organization and verify access
    const { rows: members } = await query(
      `SELECT organization_id, role FROM org_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    )
    const member = members[0]

    if (!member) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: 'Organization membership not found' } },
        { status: 403 }
      )
    }

    // Only owners and admins can view delivery logs
    if (!['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners and admins can view delivery logs' } },
        { status: 403 }
      )
    }

    // Verify webhook exists and belongs to organization
    const { rows: webhooks } = await query(
      `SELECT id FROM webhook_subscriptions WHERE id = $1 AND organization_id = $2 LIMIT 1`,
      [webhookId, member.organization_id]
    )
    const webhook = webhooks[0]

    if (!webhook) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found' } },
        { status: 404 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const statusFilter = searchParams.get('status')

    // Build query
    let sql = `SELECT * FROM webhook_deliveries WHERE subscription_id = $1`
    const sqlParams: any[] = [webhookId]

    if (statusFilter && ['pending', 'processing', 'delivered', 'failed', 'retrying'].includes(statusFilter)) {
      sql += ` AND status = $2`
      sqlParams.push(statusFilter)
    }

    // Get total count (separate query for count accuracy)
    let countSql = `SELECT COUNT(*) as exact_count FROM webhook_deliveries WHERE subscription_id = $1`
    let countParams = [webhookId]
    if (statusFilter && ['pending', 'processing', 'delivered', 'failed', 'retrying'].includes(statusFilter)) {
      countSql += ` AND status = $2`
      countParams.push(statusFilter)
    }

    const { rows: countRows } = await query(countSql, countParams)
    const totalCount = parseInt(countRows[0].exact_count)

    // Add ordering and pagination
    sql += ` ORDER BY created_at DESC LIMIT $${sqlParams.length + 1} OFFSET $${sqlParams.length + 2}`
    sqlParams.push(limit, offset)

    const { rows: deliveries } = await query(sql, sqlParams)

    return NextResponse.json({
      success: true,
      deliveries: deliveries || [],
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    })
  } catch (error: any) {
    logger.error('[deliveries GET] Error', error, { webhookId: params.id })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
