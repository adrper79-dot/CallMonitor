import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { getRBACContext } from '@/lib/middleware/rbac'
import { AppError } from '@/types/app-error'

// Force dynamic rendering - uses headers via getServerSession
export const dynamic = 'force-dynamic'
export const runtime = 'edge'

/**
 * Shopper Scripts API
 * 
 * GET /api/shopper/scripts - List secret shopper scripts for organization
 * Per MASTER_ARCHITECTURE.txt UI→API→Table contract
 * 
 * Note: Scripts may be stored in voice_configs.shopper_script or a separate table
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id ?? null

    if (!userId) {
      const err = new AppError({ code: 'AUTH_REQUIRED', message: 'Authentication required', user_message: 'Authentication required', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    const url = new URL(req.url)
    const organizationId = url.searchParams.get('orgId') || url.searchParams.get('organization_id')

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

    // Check plan - secret shopper requires Insights plan
    if (!['insights', 'global', 'enterprise'].includes(rbacContext.plan)) {
      const err = new AppError({ code: 'PLAN_LIMIT_EXCEEDED', message: 'Plan does not support secret shopper', user_message: 'This feature requires Insights plan or higher', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 403 })
    }

    // Fetch scripts from voice_configs (stored as shopper_script text field)
    // For now, we'll return scripts from voice_configs
    // In the future, this could be a separate shopper_scripts table
    const { data: configs, error: configsErr } = await supabaseAdmin
      .from('voice_configs')
      .select('id, shopper_script, shopper_expected_outcomes')
      .eq('organization_id', organizationId)
      .not('shopper_script', 'is', null)

    // If table doesn't exist (42P01 error), return empty array instead of failing
    if (configsErr) {
      if (configsErr.code === '42P01' || configsErr.message?.includes('does not exist')) {
        return NextResponse.json({ success: true, scripts: [] })
      }
      const err = new AppError({ code: 'DB_QUERY_FAILED', message: 'Failed to fetch shopper scripts', user_message: 'Could not retrieve shopper scripts', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
    }

    // Format scripts for response
    const scripts = (configs || []).map((config: any) => ({
      id: config.id,
      script: config.shopper_script,
      expected_outcomes: config.shopper_expected_outcomes || []
    }))

    return NextResponse.json({
      success: true,
      scripts
    })
  } catch (err: any) {
    const e = err instanceof AppError ? err : new AppError({ code: 'SHOPPER_SCRIPTS_ERROR', message: err?.message ?? 'Unexpected', user_message: 'Failed to fetch shopper scripts', severity: 'HIGH' })
    return NextResponse.json({ success: false, error: { id: e.id, code: e.code, message: e.user_message, severity: e.severity } }, { status: 500 })
  }
}
