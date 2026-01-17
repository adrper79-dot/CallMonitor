/**
 * RBAC (Role-Based Access Control) and Plan Gating
 * 
 * Per MASTER_ARCHITECTURE.txt RBAC matrix:
 * - Roles: Owner, Admin, Operator, Analyst, Viewer
 * - Plans: Base, Pro, Insights, Global
 * - Plan controls availability, Role controls authority
 */

export type UserRole = 'owner' | 'admin' | 'operator' | 'analyst' | 'viewer'
export type Plan = 'base' | 'pro' | 'insights' | 'global' | 'business' | 'free' | 'enterprise' | 'trial' | 'standard' | 'active'

export interface PermissionCheck {
  role: UserRole
  plan: Plan
  feature: string
  action: 'read' | 'write' | 'execute'
}

/**
 * Feature-to-Plan mapping
 */
const FEATURE_PLANS: Record<string, Plan[]> = {
  'recording': ['pro', 'insights', 'global', 'business', 'enterprise', 'standard', 'active'],
  'transcription': ['pro', 'insights', 'global', 'business', 'enterprise', 'standard', 'active'],
  'translation': ['global', 'business', 'enterprise'],
  'real_time_translation_preview': ['business', 'enterprise'],
  'survey': ['insights', 'global', 'business', 'enterprise'],
  'secret_shopper': ['insights', 'global', 'business', 'enterprise'],
  'booking': ['business', 'enterprise'],  // Cal.com-style scheduling
  'voice_cloning': ['business', 'enterprise'],  // ElevenLabs voice cloning
}

/**
 * Role permissions matrix
 */
const ROLE_PERMISSIONS: Record<UserRole, Record<string, ('read' | 'write' | 'execute')[]>> = {
  owner: {
    'voice_config': ['read', 'write'],
    'call': ['read', 'execute'],
    'recording': ['read', 'write'],
    'transcript': ['read'],
    'translation': ['read'],
    'survey': ['read'],
    'secret_shopper': ['read', 'write', 'execute'],
    'booking': ['read', 'write', 'execute'],  // Full booking access
  },
  admin: {
    'voice_config': ['read', 'write'],
    'call': ['read', 'execute'],
    'recording': ['read', 'write'],
    'transcript': ['read'],
    'translation': ['read'],
    'survey': ['read'],
    'secret_shopper': ['read', 'write', 'execute'],
    'booking': ['read', 'write', 'execute'],  // Full booking access
  },
  operator: {
    'voice_config': ['read'],
    'call': ['read', 'execute'],
    'recording': ['read'],
    'transcript': ['read'],
    'translation': ['read'],
    'survey': ['read'],
    'secret_shopper': ['read', 'execute'],
    'booking': ['read', 'write', 'execute'],  // Can create/manage bookings
  },
  analyst: {
    'voice_config': ['read'],
    'call': ['read'],
    'recording': ['read'],
    'transcript': ['read'],
    'translation': ['read'],
    'survey': ['read'],
    'secret_shopper': ['read'],
    'booking': ['read'],  // View only
  },
  viewer: {
    'voice_config': ['read'], // masked
    'call': ['read'], // masked
    'recording': ['read'], // masked
    'transcript': ['read'], // masked
    'translation': ['read'], // masked
    'survey': ['read'], // masked
    'secret_shopper': ['read'], // masked
    'booking': ['read'],  // View only, masked
  },
}

/**
 * Check if a user has permission for a feature/action
 */
export function hasPermission(role: UserRole, plan: Plan, feature: string, action: 'read' | 'write' | 'execute'): boolean {
  // Normalize role and plan
  const normalizedRole = role.toLowerCase() as UserRole
  const normalizedPlan = plan.toLowerCase() as Plan

  // Check plan availability first
  const requiredPlans = FEATURE_PLANS[feature]
  if (requiredPlans && !requiredPlans.includes(normalizedPlan)) {
    return false
  }

  // Check role permissions
  const rolePerms = ROLE_PERMISSIONS[normalizedRole]
  if (!rolePerms) {
    return false
  }

  const featurePerms = rolePerms[feature]
  if (!featurePerms) {
    return false
  }

  return featurePerms.includes(action)
}

/**
 * Check if plan supports a feature
 */
export function planSupportsFeature(plan: Plan, feature: string): boolean {
  const normalizedPlan = plan.toLowerCase() as Plan
  const requiredPlans = FEATURE_PLANS[feature]
  if (!requiredPlans) {
    // Feature available on all plans
    return true
  }
  return requiredPlans.includes(normalizedPlan)
}

/**
 * Get all features available for a plan
 */
export function getPlanFeatures(plan: Plan): string[] {
  const normalizedPlan = plan.toLowerCase() as Plan
  return Object.entries(FEATURE_PLANS)
    .filter(([_, plans]) => plans.includes(normalizedPlan))
    .map(([feature]) => feature)
}

/**
 * Check if role can perform action on resource
 */
export function canPerformAction(role: UserRole, resource: string, action: 'read' | 'write' | 'execute'): boolean {
  const normalizedRole = role.toLowerCase() as UserRole
  const rolePerms = ROLE_PERMISSIONS[normalizedRole]
  if (!rolePerms) {
    return false
  }

  const resourcePerms = rolePerms[resource]
  if (!resourcePerms) {
    return false
  }

  return resourcePerms.includes(action)
}

/**
 * API endpoint permission requirements
 */
export const API_PERMISSIONS: Record<string, { role: UserRole[], plan?: Plan[], action: 'read' | 'write' | 'execute' }> = {
  'POST /api/voice/call': { role: ['owner', 'admin', 'operator'], plan: ['base', 'pro', 'insights', 'global', 'business', 'enterprise', 'standard', 'active'], action: 'execute' },
  'PUT /api/voice/config': { role: ['owner', 'admin'], plan: ['base', 'pro', 'insights', 'global', 'business', 'enterprise', 'standard', 'active'], action: 'write' },
  'GET /api/voice/config': { role: ['owner', 'admin', 'operator', 'analyst', 'viewer'], plan: ['base', 'pro', 'insights', 'global', 'business', 'enterprise', 'standard', 'active'], action: 'read' },
  'GET /api/recordings': { role: ['owner', 'admin', 'operator', 'analyst', 'viewer'], plan: ['pro', 'insights', 'global', 'business', 'enterprise', 'standard', 'active'], action: 'read' },
  'GET /api/transcripts': { role: ['owner', 'admin', 'operator', 'analyst', 'viewer'], plan: ['pro', 'insights', 'global', 'business', 'enterprise', 'standard', 'active'], action: 'read' },
  'GET /api/surveys/results': { role: ['owner', 'admin', 'operator', 'analyst', 'viewer'], plan: ['insights', 'global', 'business', 'enterprise'], action: 'read' },
  'GET /api/shopper/results': { role: ['owner', 'admin', 'operator', 'analyst', 'viewer'], plan: ['insights', 'global', 'business', 'enterprise'], action: 'read' },
}

/**
 * Check API endpoint permission
 */
export function checkApiPermission(
  endpoint: string,
  method: string,
  role: UserRole,
  plan: Plan
): { allowed: boolean; reason?: string } {
  const key = `${method} ${endpoint}`
  const permission = API_PERMISSIONS[key]

  if (!permission) {
    // Unknown endpoint - deny by default
    return { allowed: false, reason: 'Unknown endpoint' }
  }

  // Check role
  if (!permission.role.includes(role)) {
    return { allowed: false, reason: 'Insufficient role' }
  }

  // Check plan if specified
  if (permission.plan && !permission.plan.includes(plan)) {
    return { allowed: false, reason: 'Plan does not support this feature' }
  }

  return { allowed: true }
}

/**
 * Require specific role for API route
 * Used as middleware in API routes to check user role
 * 
 * @param role - Required role (or array of roles)
 * @returns User session if authorized
 * @throws AppError if unauthorized
 */
export async function requireRole(role: UserRole | UserRole[]): Promise<any> {
  const { createServerClient } = await import('@supabase/ssr')
  const { cookies } = await import('next/headers')
  const { AppError } = await import('@/types/app-error')
  
  // Create Supabase client with cookies
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Cookie setting can fail in server component
          }
        },
      },
    }
  )

  // Get session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  
  if (sessionError || !session) {
    throw new AppError('Unauthorized', 401, 'AUTH_REQUIRED')
  }

  // Get user role from user metadata or organization membership
  const userId = session.user.id
  const userRole = session.user.user_metadata?.role as UserRole || 'viewer'

  // Check if user has required role
  const requiredRoles = Array.isArray(role) ? role : [role]
  if (!requiredRoles.includes(userRole)) {
    throw new AppError('Insufficient permissions', 403, 'INSUFFICIENT_ROLE')
  }

  return session
}
