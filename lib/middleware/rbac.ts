import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { checkApiPermission, UserRole, Plan } from '@/lib/rbac'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'

/**
 * RBAC Middleware
 * 
 * Checks role and plan permissions before allowing API access.
 * Returns 403 Forbidden if permission denied.
 */

export interface RBACContext {
  userId: string
  organizationId: string
  role: UserRole
  plan: Plan
}

/**
 * Get RBAC context for a request
 */
export async function getRBACContext(
  organizationId: string,
  userId?: string | null
): Promise<RBACContext | null> {
  if (!userId) {
    return null
  }

  // Get user's role in organization
  const { data: membershipRows, error: membershipErr } = await supabaseAdmin
    .from('org_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .limit(1)

  if (membershipErr || !membershipRows || membershipRows.length === 0) {
    return null
  }

  const role = (membershipRows[0].role || 'viewer').toLowerCase() as UserRole

  // Get organization plan
  const { data: orgRows, error: orgErr } = await supabaseAdmin
    .from('organizations')
    .select('plan')
    .eq('id', organizationId)
    .limit(1)

  if (orgErr || !orgRows || orgRows.length === 0) {
    return null
  }

  const plan = (orgRows[0].plan || 'free').toLowerCase() as Plan

  return {
    userId,
    organizationId,
    role,
    plan
  }
}

/**
 * RBAC middleware wrapper for API routes
 */
export function withRBAC(
  handler: (req: Request, context: RBACContext) => Promise<Response>,
  options?: {
    requireRole?: UserRole[]
    requirePlan?: Plan[]
    requireAction?: 'read' | 'write' | 'execute'
  }
) {
  return async (req: Request, { params }: { params?: Record<string, string> }): Promise<Response> => {
    try {
      // Get session
      const session = await getServerSession(authOptions)
      const userId = (session?.user as any)?.id ?? null

      if (!userId) {
        return NextResponse.json(
          { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required', severity: 'HIGH' } },
          { status: 401 }
        )
      }

      // Extract organization_id from request (query param, body, or params)
      const url = new URL(req.url)
      const orgIdFromQuery = url.searchParams.get('orgId') || url.searchParams.get('organization_id')
      
      let organizationId: string | null = null
      if (orgIdFromQuery) {
        organizationId = orgIdFromQuery
      } else {
        // Try to get from body (for POST/PUT)
        try {
          const body = await req.clone().json().catch(() => ({}))
          organizationId = body.organization_id || body.orgId || null
        } catch {
          // Body not JSON or not available
        }
      }

      if (!organizationId) {
        return NextResponse.json(
          { success: false, error: { code: 'ORG_REQUIRED', message: 'Organization ID required', severity: 'MEDIUM' } },
          { status: 400 }
        )
      }

      // Get RBAC context
      const context = await getRBACContext(organizationId, userId)
      if (!context) {
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authorized for this organization', severity: 'HIGH' } },
          { status: 401 }
        )
      }

      // Check role requirement
      if (options?.requireRole && !options.requireRole.includes(context.role)) {
        // Log permission denial
        await logPermissionDenial(userId, organizationId, context.role, 'insufficient_role')
        
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions', severity: 'HIGH' } },
          { status: 403 }
        )
      }

      // Check plan requirement
      if (options?.requirePlan && !options.requirePlan.includes(context.plan)) {
        await logPermissionDenial(userId, organizationId, context.role, 'insufficient_plan')
        
        return NextResponse.json(
          { success: false, error: { code: 'PLAN_LIMIT', message: 'This feature requires a higher plan', severity: 'MEDIUM' } },
          { status: 403 }
        )
      }

      // Check API endpoint permission
      const endpoint = url.pathname
      const method = req.method
      const permissionCheck = checkApiPermission(endpoint, method, context.role, context.plan)
      
      if (!permissionCheck.allowed) {
        await logPermissionDenial(userId, organizationId, context.role, permissionCheck.reason || 'permission_denied')
        
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: permissionCheck.reason || 'Access denied', severity: 'HIGH' } },
          { status: 403 }
        )
      }

      // Call handler with context
      return await handler(req, context)
    } catch (err: any) {
      logger.error('RBAC middleware error', err, { errorMessage: err?.message })
      return NextResponse.json(
        { success: false, error: { code: 'RBAC_ERROR', message: 'Authorization check failed', severity: 'HIGH' } },
        { status: 500 }
      )
    }
  }
}

/**
 * Log permission denial to audit_logs
 */
async function logPermissionDenial(
  userId: string,
  organizationId: string,
  role: UserRole,
  reason: string
) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      id: uuidv4(),
      organization_id: organizationId,
      user_id: userId,
      system_id: null,
      resource_type: 'auth',
      resource_id: null,
      action: 'permission_denied',
      actor_type: 'human',
      actor_label: userId,
      before: null,
      after: { role, reason },
      created_at: new Date().toISOString()
    })
  } catch (err) {
    // Best-effort logging
    logger.error('Failed to log permission denial', err as Error)
  }
}
