import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/pgClient'
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
  const { rows: membershipRows } = await query(
    `SELECT role FROM org_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
    [organizationId, userId]
  )

  if (!membershipRows || membershipRows.length === 0) {
    return null
  }

  const role = (membershipRows[0].role || 'viewer').toLowerCase() as UserRole

  // Get organization plan
  const { rows: orgRows } = await query(
    `SELECT plan FROM organizations WHERE id = $1 LIMIT 1`,
    [organizationId]
  )

  if (!orgRows || orgRows.length === 0) {
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
    const afterData = { role, reason }
    await query(
      `INSERT INTO audit_logs (
        id, organization_id, user_id, system_id, resource_type, resource_id, action, actor_type, actor_label, before, after, created_at
      ) VALUES ($1, $2, $3, null, $4, null, $5, $6, $7, null, $8, NOW())`,
      [
        uuidv4(),
        organizationId,
        userId,
        'auth',
        'permission_denied',
        'human',
        userId,
        JSON.stringify(afterData)
      ]
    )
  } catch (err) {
    // Best-effort logging
    logger.error('Failed to log permission denial', err as Error)
  }
}
