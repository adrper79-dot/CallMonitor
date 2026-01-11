import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { getRBACContext } from '@/lib/middleware/rbac'
import { AppError } from '@/types/app-error'

/**
 * Real-time Subscription API
 * 
 * Returns Supabase real-time subscription configuration for client.
 * Per PRODUCTION_READINESS_TASKS.md
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession()
    const userId = session?.user?.id ?? null

    if (!userId) {
      const err = new AppError({ code: 'AUTH_REQUIRED', message: 'Authentication required', user_message: 'Authentication required', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    const body = await req.json()
    const organizationId = body.organization_id || body.orgId

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

    // Return subscription configuration
    // Client will use this to set up Supabase real-time subscriptions
    return NextResponse.json({
      success: true,
      config: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        organizationId,
        channels: [
          {
            name: `calls:org=${organizationId}`,
            table: 'calls',
            filter: `organization_id=eq.${organizationId}`
          },
          {
            name: `recordings:org=${organizationId}`,
            table: 'recordings',
            filter: `organization_id=eq.${organizationId}`
          },
          {
            name: `ai_runs:org=${organizationId}`,
            table: 'ai_runs',
            filter: `call_id=in.(SELECT id FROM calls WHERE organization_id=eq.${organizationId})`
          }
        ]
      }
    })
  } catch (err: any) {
    const e = err instanceof AppError ? err : new AppError({ code: 'REALTIME_ERROR', message: err?.message ?? 'Unexpected', user_message: 'Failed to set up real-time subscription', severity: 'HIGH' })
    return NextResponse.json({ success: false, error: { id: e.id, code: e.code, message: e.user_message, severity: e.severity } }, { status: 500 })
  }
}
