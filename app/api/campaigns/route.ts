import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { query, withTransaction } from '@/lib/pgClient'
import { getRBACContext } from '@/lib/middleware/rbac'
import { AppError } from '@/types/app-error'
import { logger } from '@/lib/logger'

// Force dynamic rendering - uses headers via getServerSession
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Campaigns API
 * 
 * GET /api/campaigns - List campaigns for organization
 * POST /api/campaigns - Create new campaign
 * Per MASTER_ARCHITECTURE.txt UI→API→Table contract
 */
export async function GET(req: Request) {
  let organizationId: string | null = null
  let userId: string | null = null

  try {
    const session = await getServerSession(authOptions)
    userId = (session?.user as any)?.id ?? null

    if (!userId) {
      const err = new AppError({ code: 'AUTH_REQUIRED', message: 'Authentication required', user_message: 'Authentication required', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    const url = new URL(req.url)
    organizationId = url.searchParams.get('orgId') || url.searchParams.get('organization_id')

    if (!organizationId) {
      const err = new AppError({ code: 'ORG_REQUIRED', message: 'Organization ID required', user_message: 'Organization ID required', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
    }

    // RBAC check
    const rbacContext = await getRBACContext(organizationId, userId)
    if (!rbacContext) {
      const err = new AppError({ code: 'UNAUTHORIZED', message: 'Not authorized', user_message: 'Not authorized for this organization', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    // Fetch campaigns with pagination
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const status = url.searchParams.get('status')
    const offset = (page - 1) * limit

    let sql = `
      SELECT 
        c.*, 
        u.id as user_id, 
        u.name as user_name, 
        u.email as user_email,
        COUNT(*) OVER() as total_count
      FROM campaigns c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.organization_id = $1
    `
    const params = [organizationId] as any[]

    if (status) {
      sql += ` AND c.status = $${params.length + 1}`
      params.push(status)
    }

    sql += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const { rows } = await query(sql, params, { organizationId })

    const campaigns = rows.map(row => ({
      ...row,
      created_by: {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email
      },
      user_id: undefined,
      user_name: undefined,
      user_email: undefined,
      total_count: undefined
    }))

    const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0

    return NextResponse.json({
      success: true,
      campaigns,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (err: any) {
    logger.error('GET /api/campaigns failed', err, { organizationId, userId })
    // Check for "relation does not exist" error
    if (err.message?.includes('does not exist')) {
      logger.info('Campaigns table does not exist yet, returning empty', { organizationId })
      return NextResponse.json({
        success: true,
        campaigns: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 }
      })
    }
    const e = err instanceof AppError ? err : new AppError({ code: 'CAMPAIGNS_ERROR', message: err?.message ?? 'Unexpected', user_message: 'Failed to fetch campaigns', severity: 'HIGH' })
    return NextResponse.json({ success: false, error: { id: e.id, code: e.code, message: e.user_message, severity: e.severity } }, { status: 500 })
  }
}

/**
 * POST /api/campaigns - Create new campaign
 * RBAC: Owner/Admin only
 */
export async function POST(req: Request) {
  let organizationId: string | null = null
  let userId: string | null = null

  try {
    const session = await getServerSession(authOptions)
    userId = (session?.user as any)?.id ?? null

    if (!userId) {
      const err = new AppError({ code: 'AUTH_REQUIRED', message: 'Authentication required', user_message: 'Authentication required', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    const body = await req.json()
    organizationId = body.organizationId

    if (!organizationId) {
      const err = new AppError({ code: 'ORG_REQUIRED', message: 'Organization ID required', user_message: 'Organization ID required', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
    }

    // RBAC check - only owner/admin can create campaigns
    const rbacContext = await getRBACContext(organizationId, userId)
    if (!rbacContext || !['owner', 'admin'].includes(rbacContext.role)) {
      const err = new AppError({ code: 'UNAUTHORIZED', message: 'Insufficient permissions', user_message: 'You do not have permission to create campaigns', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 403 })
    }

    const {
      name,
      description,
      call_flow_type,
      target_list,
      caller_id_id,
      script_id,
      survey_id,
      custom_prompt,
      schedule_type,
      scheduled_at,
      recurring_pattern,
      call_config
    } = body

    // Validation
    if (!name || !call_flow_type || !target_list || !Array.isArray(target_list)) {
      const err = new AppError({ code: 'VALIDATION_ERROR', message: 'Missing required fields', user_message: 'Name, call flow type, and target list are required', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
    }

    if (!['secret_shopper', 'survey', 'outbound', 'test'].includes(call_flow_type)) {
      const err = new AppError({ code: 'VALIDATION_ERROR', message: 'Invalid call_flow_type', user_message: 'Invalid call flow type', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
    }

    // Create campaign and calls in transaction
    const result = await withTransaction(async (client) => {
      // 1. Insert Campaign
      const { rows: campaignRows } = await client.query(
        `INSERT INTO campaigns (
           organization_id, name, description, call_flow_type, target_list,
           caller_id_id, script_id, survey_id, custom_prompt,
           schedule_type, scheduled_at, recurring_pattern, call_config,
           total_targets, created_by, status, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'draft', NOW(), NOW())
         RETURNING *`,
        [
          organizationId,
          name,
          description || null,
          call_flow_type,
          JSON.stringify(target_list),
          caller_id_id || null,
          script_id || null,
          survey_id || null,
          custom_prompt || null,
          schedule_type || 'immediate',
          scheduled_at || null,
          recurring_pattern ? JSON.stringify(recurring_pattern) : null,
          JSON.stringify(call_config || {}),
          target_list.length,
          userId
        ]
      )

      const campaign = campaignRows[0]
      if (!campaign) throw new Error('Failed to create campaign record')

      // 2. Insert Campaign Calls (Batch Insert)
      if (target_list.length > 0) {
        const values: any[] = []
        const placeholders: string[] = []

        target_list.forEach((target: any, index: number) => {
          const pIndex = index * 6
          placeholders.push(`($${pIndex + 1}, $${pIndex + 2}, $${pIndex + 3}, $${pIndex + 4}, $${pIndex + 5}, $${pIndex + 6})`)
          values.push(
            campaign.id,
            target.phone,
            JSON.stringify(target.metadata || {}),
            'pending',
            call_config?.retry_attempts || 3,
            schedule_type === 'immediate' ? null : scheduled_at
          )
        })

        // Split into chunks if too large (Postgres param limit is 65535, safe limit ~1000 targets per batch)
        // For now assuming reasonable list size < 500
        const insertQuery = `
          INSERT INTO campaign_calls (
            campaign_id, target_phone, target_metadata, status, max_attempts, scheduled_for
          ) VALUES ${placeholders.join(', ')}
        `
        await client.query(insertQuery, values)
      }

      // 3. Audit Log
      await client.query(
        `INSERT INTO campaign_audit_log (campaign_id, user_id, action, changes, created_at)
         VALUES ($1, $2, 'created', $3, NOW())`,
        [campaign.id, userId, JSON.stringify({ campaign })]
      )

      return campaign
    }, { organizationId, userId })

    return NextResponse.json({ success: true, campaign: result }, { status: 201 })
  } catch (err: any) {
    logger.error('POST /api/campaigns failed', err, { organizationId, userId })
    const e = err instanceof AppError ? err : new AppError({ code: 'CAMPAIGNS_ERROR', message: err?.message ?? 'Unexpected', user_message: 'Failed to create campaign', severity: 'HIGH' })
    return NextResponse.json({ success: false, error: { id: e.id, code: e.code, message: e.user_message, severity: e.severity } }, { status: 500 })
  }
}
