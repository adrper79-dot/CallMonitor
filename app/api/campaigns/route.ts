import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { getRBACContext } from '@/lib/middleware/rbac'
import { AppError } from '@/types/app-error'
import { logger } from '@/lib/logger'

// Force dynamic rendering - uses headers via getServerSession
export const dynamic = 'force-dynamic'
export const runtime = 'edge'

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

    let query = supabaseAdmin
      .from('campaigns')
      .select('*, created_by:users!campaigns_created_by_fkey(id, name, email)', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: campaigns, error: campaignsErr, count } = await query

    // If table doesn't exist (42P01 error), return empty array instead of failing
    if (campaignsErr) {
      if (campaignsErr.code === '42P01' || campaignsErr.message?.includes('does not exist')) {
        logger.info('Campaigns table does not exist yet, returning empty array', { organizationId })
        return NextResponse.json({
          success: true,
          campaigns: [],
          pagination: { page, limit, total: 0, pages: 0 }
        })
      }
      
      logger.error('Failed to fetch campaigns', campaignsErr, { organizationId, userId })
      const err = new AppError({ code: 'DB_QUERY_FAILED', message: 'Failed to fetch campaigns', user_message: 'Could not retrieve campaigns', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      campaigns: campaigns || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (err: any) {
    logger.error('GET /api/campaigns failed', err, { organizationId, userId })
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

    // Create campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .insert({
        organization_id: organizationId,
        name,
        description,
        call_flow_type,
        target_list,
        caller_id_id,
        script_id,
        survey_id,
        custom_prompt,
        schedule_type: schedule_type || 'immediate',
        scheduled_at,
        recurring_pattern,
        call_config: call_config || {},
        total_targets: target_list.length,
        created_by: userId,
        status: 'draft'
      })
      .select()
      .single()

    if (campaignError) {
      logger.error('Error creating campaign', campaignError, { organizationId, userId })
      const err = new AppError({ code: 'DB_INSERT_FAILED', message: 'Failed to create campaign', user_message: 'Could not create campaign', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
    }

    // Create campaign_calls records
    const campaignCalls = target_list.map((target: any) => ({
      campaign_id: campaign.id,
      target_phone: target.phone,
      target_metadata: target.metadata || {},
      status: 'pending',
      max_attempts: call_config?.retry_attempts || 3,
      scheduled_for: schedule_type === 'immediate' ? null : scheduled_at
    }))

    const { error: callsError } = await supabaseAdmin
      .from('campaign_calls')
      .insert(campaignCalls)

    if (callsError) {
      logger.error('Error creating campaign calls', callsError, { campaignId: campaign.id })
      // Rollback campaign
      await supabaseAdmin.from('campaigns').delete().eq('id', campaign.id)
      const err = new AppError({ code: 'DB_INSERT_FAILED', message: 'Failed to create campaign calls', user_message: 'Could not create campaign calls', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
    }

    // Audit log
    await supabaseAdmin.from('campaign_audit_log').insert({
      campaign_id: campaign.id,
      user_id: userId,
      action: 'created',
      changes: { campaign }
    })

    return NextResponse.json({ success: true, campaign }, { status: 201 })
  } catch (err: any) {
    logger.error('POST /api/campaigns failed', err, { organizationId, userId })
    const e = err instanceof AppError ? err : new AppError({ code: 'CAMPAIGNS_ERROR', message: err?.message ?? 'Unexpected', user_message: 'Failed to create campaign', severity: 'HIGH' })
    return NextResponse.json({ success: false, error: { id: e.id, code: e.code, message: e.user_message, severity: e.severity } }, { status: 500 })
  }
}
