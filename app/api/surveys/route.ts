import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { getRBACContext } from '@/lib/middleware/rbac'
import { AppError } from '@/types/app-error'

// Force dynamic rendering - uses headers via getServerSession
export const dynamic = 'force-dynamic'

/**
 * Surveys API
 * 
 * GET /api/surveys - List surveys for organization
 * Per MASTER_ARCHITECTURE.txt UI→API→Table contract
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

    // Check plan - surveys require Insights plan
    if (!['insights', 'global', 'enterprise'].includes(rbacContext.plan)) {
      const err = new AppError({ code: 'PLAN_LIMIT_EXCEEDED', message: 'Plan does not support surveys', user_message: 'This feature requires Insights plan or higher', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 403 })
    }

    // Fetch surveys
    const { data: surveys, error: surveysErr } = await supabaseAdmin
      .from('surveys')
      .select('id, name, description, questions, is_active, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (surveysErr) {
      const err = new AppError({ code: 'DB_QUERY_FAILED', message: 'Failed to fetch surveys', user_message: 'Could not retrieve surveys', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      surveys: surveys || []
    })
  } catch (err: any) {
    const e = err instanceof AppError ? err : new AppError({ code: 'SURVEYS_ERROR', message: err?.message ?? 'Unexpected', user_message: 'Failed to fetch surveys', severity: 'HIGH' })
    return NextResponse.json({ success: false, error: { id: e.id, code: e.code, message: e.user_message, severity: e.severity } }, { status: 500 })
  }
}
