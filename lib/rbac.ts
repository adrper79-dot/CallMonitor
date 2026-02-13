/**
 * RBAC (Role-Based Access Control) and Plan Gating
 *
 * Per MASTER_ARCHITECTURE.txt RBAC matrix:
 * - Canonical roles: Owner, Admin, Manager/Operator/Compliance, Agent/Analyst, Viewer/Member
 * - Plans: Base, Pro, Insights, Global
 * - Plan controls availability, Role controls authority
 *
 * Role hierarchy (matches workers/src/lib/auth.ts):
 *   owner(5) > admin(4) > manager=operator=compliance(3) > agent=analyst(2) > viewer=member(1)
 */

export type UserRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'operator'
  | 'compliance'
  | 'agent'
  | 'analyst'
  | 'viewer'
  | 'member'

/**
 * Role hierarchy levels — must stay in sync with workers/src/lib/auth.ts
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  viewer: 1,
  member: 1,
  agent: 2,
  analyst: 2,
  operator: 3,
  manager: 3,
  compliance: 3,
  admin: 4,
  owner: 5,
}

/**
 * Normalize any role string to a canonical UserRole.
 * Unknown strings fall back to 'member' (lowest privilege).
 */
export function normalizeRole(raw: string | undefined | null): UserRole {
  if (!raw) return 'member'
  const lowered = raw.toLowerCase().trim()
  if (lowered in ROLE_HIERARCHY) return lowered as UserRole
  return 'member'
}
export type Plan =
  | 'base'
  | 'pro'
  | 'insights'
  | 'global'
  | 'business'
  | 'free'
  | 'enterprise'
  | 'trial'
  | 'standard'
  | 'active'

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
  recording: ['pro', 'insights', 'global', 'business', 'enterprise', 'standard', 'active'],
  transcription: ['pro', 'insights', 'global', 'business', 'enterprise', 'standard', 'active'],
  translation: ['pro', 'insights', 'global', 'business', 'enterprise'],
  real_time_translation_preview: ['business', 'enterprise'],
  survey: ['insights', 'global', 'business', 'enterprise'],
  secret_shopper: ['insights', 'global', 'business', 'enterprise'],
  booking: ['business', 'enterprise'], // Cal.com-style scheduling
  voice_cloning: ['business', 'enterprise'], // ElevenLabs voice cloning
}

/**
 * Role permissions matrix
 */
const ROLE_PERMISSIONS: Record<UserRole, Record<string, ('read' | 'write' | 'execute')[]>> = {
  owner: {
    voice_config: ['read', 'write'],
    call: ['read', 'execute'],
    recording: ['read', 'write'],
    transcript: ['read'],
    translation: ['read'],
    survey: ['read'],
    secret_shopper: ['read', 'write', 'execute'],
    booking: ['read', 'write', 'execute'], // Full booking access
  },
  admin: {
    voice_config: ['read', 'write'],
    call: ['read', 'execute'],
    recording: ['read', 'write'],
    transcript: ['read'],
    translation: ['read'],
    survey: ['read'],
    secret_shopper: ['read', 'write', 'execute'],
    booking: ['read', 'write', 'execute'], // Full booking access
  },
  manager: {
    voice_config: ['read'],
    call: ['read', 'execute'],
    recording: ['read'],
    transcript: ['read'],
    translation: ['read'],
    survey: ['read'],
    secret_shopper: ['read', 'execute'],
    booking: ['read', 'write', 'execute'],
  },
  operator: {
    voice_config: ['read'],
    call: ['read', 'execute'],
    recording: ['read'],
    transcript: ['read'],
    translation: ['read'],
    survey: ['read'],
    secret_shopper: ['read', 'execute'],
    booking: ['read', 'write', 'execute'], // Can create/manage bookings
  },
  compliance: {
    voice_config: ['read'],
    call: ['read'],
    recording: ['read'],
    transcript: ['read'],
    translation: ['read'],
    survey: ['read'],
    secret_shopper: ['read'],
    booking: ['read'],
  },
  agent: {
    voice_config: ['read'],
    call: ['read', 'execute'],
    recording: ['read'],
    transcript: ['read'],
    translation: ['read'],
    survey: ['read'],
    secret_shopper: ['read'],
    booking: ['read', 'write'],
  },
  analyst: {
    voice_config: ['read'],
    call: ['read'],
    recording: ['read'],
    transcript: ['read'],
    translation: ['read'],
    survey: ['read'],
    secret_shopper: ['read'],
    booking: ['read'], // View only
  },
  viewer: {
    voice_config: ['read'], // masked
    call: ['read'], // masked
    recording: ['read'], // masked
    transcript: ['read'], // masked
    translation: ['read'], // masked
    survey: ['read'], // masked
    secret_shopper: ['read'], // masked
    booking: ['read'], // View only, masked
  },
  member: {
    voice_config: ['read'],
    call: ['read'],
    recording: ['read'],
    transcript: ['read'],
    translation: ['read'],
    survey: ['read'],
    secret_shopper: ['read'],
    booking: ['read'],
  },
}

/**
 * Check if a user has permission for a feature/action
 */
export function hasPermission(
  role: UserRole,
  plan: Plan,
  feature: string,
  action: 'read' | 'write' | 'execute'
): boolean {
  // Normalize role and plan
  const normalizedRole = normalizeRole(role)
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
export function canPerformAction(
  role: UserRole,
  resource: string,
  action: 'read' | 'write' | 'execute'
): boolean {
  const normalizedRole = normalizeRole(role)
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
export const API_PERMISSIONS: Record<
  string,
  { role: UserRole[]; plan?: Plan[]; action: 'read' | 'write' | 'execute' }
> = {
  'POST /api/voice/call': {
    role: ['owner', 'admin', 'manager', 'operator', 'agent'],
    plan: ['base', 'pro', 'insights', 'global', 'business', 'enterprise', 'standard', 'active'],
    action: 'execute',
  },
  'PUT /api/voice/config': {
    role: ['owner', 'admin'],
    plan: ['base', 'pro', 'insights', 'global', 'business', 'enterprise', 'standard', 'active'],
    action: 'write',
  },
  'GET /api/voice/config': {
    role: ['owner', 'admin', 'manager', 'operator', 'compliance', 'agent', 'analyst', 'viewer', 'member'],
    plan: ['base', 'pro', 'insights', 'global', 'business', 'enterprise', 'standard', 'active'],
    action: 'read',
  },
  'GET /api/recordings': {
    role: ['owner', 'admin', 'manager', 'operator', 'compliance', 'agent', 'analyst', 'viewer', 'member'],
    plan: ['pro', 'insights', 'global', 'business', 'enterprise', 'standard', 'active'],
    action: 'read',
  },
  'GET /api/transcripts': {
    role: ['owner', 'admin', 'manager', 'operator', 'compliance', 'agent', 'analyst', 'viewer', 'member'],
    plan: ['pro', 'insights', 'global', 'business', 'enterprise', 'standard', 'active'],
    action: 'read',
  },
  'GET /api/surveys/results': {
    role: ['owner', 'admin', 'manager', 'operator', 'compliance', 'agent', 'analyst', 'viewer', 'member'],
    plan: ['insights', 'global', 'business', 'enterprise'],
    action: 'read',
  },
  'GET /api/shopper/results': {
    role: ['owner', 'admin', 'manager', 'operator', 'compliance', 'analyst', 'viewer'],
    plan: ['insights', 'global', 'business', 'enterprise'],
    action: 'read',
  },
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

// NOTE: requireRole has been moved to lib/rbac-server.ts to avoid bundling
// server dependencies in client code. Import from there for API routes.
// export { requireRole } from './rbac-server'
