import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { getRBACContext } from '@/lib/middleware/rbac'
import { AppError } from '@/types/app-error'

/**
 * Voice Targets API
 * 
 * GET /api/voice/targets - List voice targets for organization
 * Per MASTER_ARCHITECTURE.txt UI→API→Table contract
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession()
    const userId = session?.user?.id ?? null

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

    // Fetch voice targets
    const { data: targets, error: targetsErr } = await supabaseAdmin
      .from('voice_targets')
      .select('id, phone_number, name, description, is_active, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (targetsErr) {
      const err = new AppError({ code: 'DB_QUERY_FAILED', message: 'Failed to fetch voice targets', user_message: 'Could not retrieve voice targets', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      targets: targets || []
    })
  } catch (err: any) {
    const e = err instanceof AppError ? err : new AppError({ code: 'VOICE_TARGETS_ERROR', message: err?.message ?? 'Unexpected', user_message: 'Failed to fetch voice targets', severity: 'HIGH' })
    return NextResponse.json({ success: false, error: { id: e.id, code: e.code, message: e.user_message, severity: e.severity } }, { status: 500 })
  }
}
