import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireRole } from '@/lib/rbac-server'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'
import { ApiErrors } from '@/lib/errors/apiHandler'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function handleGET(req: NextRequest) {
  try {
    // Authenticate and get user context
    const session = await requireRole('viewer')
    const userId = session.user.id
    const userOrgId = session.user.organizationId

    const searchParams = req.nextUrl.searchParams
    const orgId = searchParams.get('orgId')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // If orgId is provided, verify it matches user's org (or user is super-admin - but for now strict isolation)
    if (orgId && orgId !== userOrgId) {
      return ApiErrors.forbidden('Unauthorized access to organization data')
    }

    // Use organizationId from session if not provided param, or verified param
    const targetOrgId = orgId || userOrgId

    // Build Query
    let sql = `
      SELECT 
        id, organization_id, system_id, status, started_at, ended_at, created_by, call_sid,
        COUNT(*) OVER() as total_count
      FROM calls
      WHERE organization_id = $1
    `
    const params: any[] = [targetOrgId]

    if (status && status !== 'all') {
      if (status === 'active') {
        sql += ` AND status IN ('in_progress', 'ringing')`
      } else {
        sql += ` AND status = $${params.length + 1}`
        params.push(status)
      }
    }

    sql += ` ORDER BY started_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const { rows } = await query(sql, params)

    const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0
    const calls = rows.map(row => {
      const { total_count, ...call } = row
      return call
    })

    return NextResponse.json({
      success: true,
      calls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err: any) {
    logger.error('GET /api/calls error', err)
    return ApiErrors.internal(err?.message || 'Failed to fetch calls')
  }
}

// Apply rate limiting: 100 requests per minute per IP (generous for dashboard polling)
export const GET = withRateLimit(handleGET as any, {
  identifier: (req) => getClientIP(req),
  config: {
    maxAttempts: 100,
    windowMs: 60 * 1000, // 1 minute
    blockMs: 5 * 60 * 1000 // 5 minute block on abuse
  }
})
