/**
 * Create a SignalWire LaML / SWML XML response
 * Sets correct Content-Type and status
 */
import { NextResponse } from 'next/server'
export function swmlResponse(
  xml: string,
  status = 200,
  headers: Record<string, string> = {}
): NextResponse {
  return new NextResponse(xml, {
    status,
    headers: {
      'Content-Type': 'application/xml',
      ...headers,
    },
  });
}

// Optional alias for legacy imports
export const xmlResponse = swmlResponse;
/**
 * Shared API Utilities
 * 
 * Common patterns extracted to reduce duplication across API routes.
 * Use these instead of copy-pasting the same code.
 */

// ...existing code...
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { AppError } from '@/types/app-error'
import { logger } from '@/lib/logger'

// ─────────────────────────────────────────────────────────────────────────────
// PARSE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse form-encoded or JSON request body (SignalWire webhooks may send either format)
 * Consumes body only once. Supports multi-value form keys.
 */
export async function parseRequestBody(req: Request): Promise<Record<string, string | string[] | any>> {
  const ct = String(req.headers.get('content-type') || '').toLowerCase()
  try {
    if (ct.includes('application/json') || ct.includes('text/json')) {
      return await req.json()
    }
    // Assume form-encoded (SignalWire style) or fallback
    const text = await req.text()
    try {
      return parseFormEncoded(text)
    } catch {
      // Last-ditch: maybe it's JSON despite content-type
      try {
        return JSON.parse(text)
      } catch {
        return {}
      }
    }
  } catch (err) {
    logger.warn('Failed to parse request body', { error: (err as Error).message })
    return {}
  }
}

/**
 * Parse URL-encoded form data to object, supporting multi-value keys (SignalWire webhooks)
 */
export function parseFormEncoded(text: string): Record<string, string | string[]> {
  const params = new URLSearchParams(text)
  const obj: Record<string, string | string[]> = {}
  params.forEach((value, key) => {
    if (key in obj) {
      if (Array.isArray(obj[key])) {
        (obj[key] as string[]).push(value)
      } else {
        obj[key] = [obj[key] as string, value]
      }
    } else {
      obj[key] = value
    }
  })
  return obj
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR RESPONSES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a structured error response
 * @param skipLog - Set to true to skip logging (useful for expected errors like 401 on public polling)
 */
export function errorResponse(
  code: string, 
  message: string, 
  userMessage: string, 
  status: number,
  skipLog = false
): NextResponse {
  const err = new AppError({ 
    code, 
    message, 
    user_message: userMessage, 
    severity: status >= 500 ? 'CRITICAL' : status >= 400 ? 'HIGH' : 'MEDIUM' 
  })
  
  // Only log server errors (5xx) and unexpected client errors
  // Skip logging for expected auth failures (401) and rate limits to reduce noise
  if (!skipLog && status >= 500) {
    logger.error(`API Error: ${code}`, { status, message })
  } else if (!skipLog && status !== 401) {
    // Log 4xx errors except 401 (which is expected for unauthenticated polling)
    logger.warn(`API Error: ${code}`, { status, message })
  }
  // 401s are not logged - they're expected for unauthenticated requests
  
  return NextResponse.json({ 
    success: false, 
    error: { 
      id: err.id, 
      code: err.code, 
      message: err.user_message 
    } 
  }, { status })
}

/**
 * Shorthand error responses
 */
export const Errors = {
  authRequired: () => errorResponse('AUTH_REQUIRED', 'Auth required', 'Please sign in', 401),
  orgNotFound: () => errorResponse('ORG_NOT_FOUND', 'No org', 'Organization not found', 404),
  unauthorized: (msg = 'Not authorized') => errorResponse('UNAUTHORIZED', msg, msg, 403),
  forbidden: (msg = 'Access denied') => errorResponse('FORBIDDEN', msg, msg, 403),
  badRequest: (msg: string) => errorResponse('BAD_REQUEST', msg, msg, 400),
  notFound: (resource: string) => errorResponse('NOT_FOUND', `${resource} not found`, `${resource} not found`, 404),
  internal: (err?: Error) => errorResponse('INTERNAL_ERROR', err?.message || 'Internal error', 'Something went wrong', 500),
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get authenticated user from session
 * Returns null if not authenticated
 */
export async function getAuthUser(): Promise<{ id: string; email?: string } | null> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  
  if (!userId) return null
  
  return {
    id: userId,
    email: session?.user?.email || undefined
  }
}

/**
 * Get user's organization ID and role in a single query
 * Per ARCH_DOCS: org_members is the source of truth for user-org relationships
 */
export async function getUserOrgAndRole(userId: string): Promise<{ orgId: string | null; role: string | null }> {
  const { data } = await supabaseAdmin
    .from('org_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .limit(1)
  return {
    orgId: data?.[0]?.organization_id || null,
    role: data?.[0]?.role || null
  }
}

/**
 * Check if user has required role(s)
 */
export function hasRole(userRole: string | null, required: string | string[]): boolean {
  if (!userRole) return false
  const roles = Array.isArray(required) ? required : [required]
  return roles.includes(userRole)
}

// ─────────────────────────────────────────────────────────────────────────────
// COMBINED AUTH + ORG CHECK
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthContext {
  userId: string
  orgId: string
  role: string
}

/**
 * Get full auth context (user + org + role) in a single query
 * Returns error response if any check fails
 */
export async function requireAuth(): Promise<AuthContext | NextResponse> {
  const user = await getAuthUser()
  if (!user?.id) return Errors.authRequired()

  const { orgId, role } = await getUserOrgAndRole(user.id)
  if (!orgId) return Errors.orgNotFound()
  if (!role) return Errors.unauthorized('Not a member of this organization')

  return { userId: user.id, orgId, role }
}

/**
 * Require specific role(s)
 */
export async function requireRole(roles: string | string[]): Promise<AuthContext | NextResponse> {
  const ctx = await requireAuth()
  if (ctx instanceof NextResponse) return ctx

  if (!hasRole(ctx.role, roles)) {
    return Errors.unauthorized(`Requires role: ${Array.isArray(roles) ? roles.join(' or ') : roles}`)
  }

  return ctx
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE HELPERS  
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Success JSON response
 */
export function success<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status })
}

