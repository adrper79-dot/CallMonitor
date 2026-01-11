import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { getRBACContext } from '@/lib/middleware/rbac'

/**
 * Get RBAC context for current user and organization
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession()
    const userId = session?.user?.id ?? null

    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required', severity: 'HIGH' } },
        { status: 401 }
      )
    }

    const url = new URL(req.url)
    const organizationId = url.searchParams.get('orgId') || url.searchParams.get('organization_id')

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: { code: 'ORG_REQUIRED', message: 'Organization ID required', severity: 'MEDIUM' } },
        { status: 400 }
      )
    }

    const context = await getRBACContext(organizationId, userId)
    if (!context) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authorized for this organization', severity: 'HIGH' } },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      role: context.role,
      plan: context.plan,
      organization_id: context.organizationId
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'RBAC_ERROR', message: err?.message || 'Failed to get RBAC context', severity: 'HIGH' } },
      { status: 500 }
    )
  }
}
