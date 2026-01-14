import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { getRBACContext } from '@/lib/middleware/rbac'
import { AppError } from '@/types/app-error'
import { logger } from '@/lib/logger'

// Force dynamic rendering - uses headers via getServerSession
export const dynamic = 'force-dynamic'

/**
 * Campaigns API
 * 
 * GET /api/campaigns - List campaigns for organization
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

    // Fetch campaigns
    // Note: campaigns table may not exist yet - return empty array if missing
    const { data: campaigns, error: campaignsErr } = await supabaseAdmin
      .from('campaigns')
      .select('id, name, description, is_active, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    // If table doesn't exist (42P01 error), return empty array instead of failing
    if (campaignsErr) {
      if (campaignsErr.code === '42P01' || campaignsErr.message?.includes('does not exist')) {
        logger.info('Campaigns table does not exist yet, returning empty array', { organizationId })
        return NextResponse.json({
          success: true,
          campaigns: []
        })
      }
      
      logger.error('Failed to fetch campaigns', campaignsErr, { organizationId, userId })
      const err = new AppError({ code: 'DB_QUERY_FAILED', message: 'Failed to fetch campaigns', user_message: 'Could not retrieve campaigns', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      campaigns: campaigns || []
    })
  } catch (err: any) {
    logger.error('GET /api/campaigns failed', err, { organizationId, userId })
    const e = err instanceof AppError ? err : new AppError({ code: 'CAMPAIGNS_ERROR', message: err?.message ?? 'Unexpected', user_message: 'Failed to fetch campaigns', severity: 'HIGH' })
    return NextResponse.json({ success: false, error: { id: e.id, code: e.code, message: e.user_message, severity: e.severity } }, { status: 500 })
  }
}
