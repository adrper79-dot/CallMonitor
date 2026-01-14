/**
 * Shared API Utilities
 * 
 * Common patterns extracted to reduce duplication across API routes.
 * Use these instead of copy-pasting the same code.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { AppError } from '@/types/app-error'
import { logger } from '@/lib/logger'

// ─────────────────────────────────────────────────────────────────────────────
// PARSE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse form-encoded or JSON request body
 * Handles SignalWire webhooks which may send either format
 */
export async function parseRequestBody(req: Request): Promise<Record<string, any>> {
  const ct = String(req.headers.get('content-type') || '')
  
  try {
    if (ct.includes('application/json')) {
      return await req.json()
    } else {
      const text = await req.text()
      return parseFormEncoded(text)
    }
  } catch {
    // Fallback: try JSON anyway
    try {
      return await req.json()
    } catch {
      return {}
    }
  }
}

/**
 * Parse URL-encoded form data to object
 */
export function parseFormEncoded(text: string): Record<string, string> {
  try {
    const params = new URLSearchParams(text)
    const obj: Record<string, string> = {}
    params.forEach((v, k) => { obj[k] = v })
    return obj
  } catch {
    return {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR RESPONSES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a structured error response
 */
export function errorResponse(
  code: string, 
  message: string, 
  userMessage: string, 
  status: number
): NextResponse {
  const err = new AppError({ 
    code, 
    message, 
    user_message: userMessage, 
    severity: status >= 500 ? 'CRITICAL' : 'HIGH' 
  })
  
  logger.warn(`API Error: ${code}`, { status, message })
  
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
 * Get user's organization ID
 */
export async function getUserOrg(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('users')
    .select('organization_id')
    .eq('id', userId)
    .limit(1)
  
  return data?.[0]?.organization_id || null
}

/**
 * Get user's role in organization
 */
export async function getUserRole(userId: string, orgId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('org_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .limit(1)
  
  return data?.[0]?.role || null
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
 * Get full auth context (user + org + role)
 * Returns error response if any check fails
 */
export async function requireAuth(): Promise<AuthContext | NextResponse> {
  const user = await getAuthUser()
  if (!user) return Errors.authRequired()
  
  const orgId = await getUserOrg(user.id)
  if (!orgId) return Errors.orgNotFound()
  
  const role = await getUserRole(user.id, orgId)
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
  return NextResponse.json({ success: true, ...data }, { status })
}

/**
 * SWML/XML response for SignalWire
 */
export function swmlResponse(swml: object): NextResponse {
  return NextResponse.json(swml, { 
    status: 200, 
    headers: { 'Content-Type': 'application/json' } 
  })
}

export function xmlResponse(xml: string): NextResponse {
  return new NextResponse(xml, { 
    status: 200, 
    headers: { 'Content-Type': 'application/xml' } 
  })
}
