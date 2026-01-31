/**
 * Server-only RBAC Middleware
 * 
 * This file contains server-only authentication and authorization functions.
 * It's separated from lib/rbac.ts to avoid bundling server dependencies in client code.
 * 
 * Per ARCH_DOCS: RBAC enforced via org_members table
 */

import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/pgClient'

import { AppError } from '@/types/app-error'
import type { UserRole } from './rbac'

export interface RBACSession {
  user: {
    id: string
    email?: string | null
    name?: string | null
    role: UserRole
    organizationId: string
  }
}

/**
 * Require specific role for API route
 * Used as middleware in API routes to check user role
 * 
 * @param role - Required role (or array of roles)
 * @returns User session if authorized
 * @throws AppError if unauthorized
 */
export async function requireRole(role: UserRole | UserRole[]): Promise<RBACSession> {
  // Get NextAuth session
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    throw new AppError('Unauthorized', 401, 'AUTH_REQUIRED')
  }

  const userId = (session.user as any).id
  if (!userId) {
    throw new AppError('Unauthorized', 401, 'AUTH_REQUIRED')
  }

  // Get user role from org_members table
  const { rows } = await query(
    `SELECT role, organization_id FROM org_members WHERE user_id = $1 LIMIT 1`,
    [userId]
  )
  const membership = rows[0]

  if (!membership) {
    throw new AppError('User is not part of an organization', 404, 'NO_ORGANIZATION')
  }

  const userRole = membership.role as UserRole

  // Role hierarchy: owner > admin > operator > analyst > viewer
  // Higher roles have all permissions of lower roles
  const roleHierarchy: Record<UserRole, number> = {
    'owner': 5,
    'admin': 4,
    'operator': 3,
    'analyst': 2,
    'viewer': 1
  }

  const userRoleLevel = roleHierarchy[userRole] || 0

  // Check if user has required role (or higher)
  const requiredRoles = Array.isArray(role) ? role : [role]
  const meetsRequirement = requiredRoles.some(r => {
    const requiredLevel = roleHierarchy[r] || 0
    return userRoleLevel >= requiredLevel
  })

  if (!meetsRequirement) {
    throw new AppError('Insufficient permissions', 403, 'INSUFFICIENT_ROLE')
  }

  // Return session with user info
  return {
    user: {
      id: userId,
      email: session.user.email,
      name: session.user.name,
      role: userRole,
      organizationId: membership.organization_id
    }
  }
}
