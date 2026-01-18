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
import { createClient } from '@supabase/supabase-js'
import { AppError } from '@/types/app-error'
import type { UserRole } from './rbac'

// Create supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('org_members')
    .select('role, organization_id')
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (membershipError || !membership) {
    throw new AppError('User is not part of an organization', 404, 'NO_ORGANIZATION')
  }

  const userRole = membership.role as UserRole

  // Check if user has required role
  const requiredRoles = Array.isArray(role) ? role : [role]
  if (!requiredRoles.includes(userRole)) {
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
