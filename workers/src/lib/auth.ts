/**
 * Auth utilities for Cloudflare Workers
 * Session validation and token parsing
 */

import type { Context } from 'hono'
import type { Env } from '../index'
import { getDb } from './db'

export interface Session {
  userId: string
  email: string
  name: string
  organizationId: string
  role: string
  expires: string
}

/**
 * Parse session token from request cookies or Authorization header
 */
export function parseSessionToken(c: Context<{ Bindings: Env }>): string | null {
  // Check Authorization header first (for API clients)
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  // Check cookies (for browser sessions)
  const cookieHeader = c.req.header('Cookie')
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader)
    // Check our custom cookie first, then NextAuth cookies
    return cookies['session-token'] ||
           cookies['next-auth.session-token'] || 
           cookies['__Secure-next-auth.session-token'] ||
           cookies['__Host-next-auth.session-token'] ||
           null
  }

  return null
}

/**
 * Verify session token and return session data
 */
export async function verifySession(
  c: Context<{ Bindings: Env }>,
  token: string
): Promise<Session | null> {
  try {
    const db = getDb(c.env)

    // Query session from database (NextAuth pg-adapter schema)
    // Note: NextAuth may store tokens hashed depending on configuration
    const result = await db.query(
      `SELECT s.*, u.email, u.name, u.id as user_id, 
              om.organization_id, om.role
       FROM "authjs"."sessions" s
       JOIN "authjs"."users" u ON u.id = s."userId"
       LEFT JOIN org_members om ON om.user_id = u.id
       WHERE s."sessionToken" = $1 AND s.expires > NOW()
       LIMIT 1`,
      [token]
    )

    if (!result.rows || result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]

    return {
      userId: row.user_id,
      email: row.email,
      name: row.name,
      organizationId: row.organization_id,
      role: row.role || 'viewer',
      expires: row.expires,
    }
  } catch (error) {
    console.error('Session verification error:', error)
    return null
  }
}

/**
 * Middleware helper: require authenticated session
 */
export async function requireAuth(
  c: Context<{ Bindings: Env }>
): Promise<Session | null> {
  const token = parseSessionToken(c)
  
  if (!token) {
    return null
  }

  return verifySession(c, token)
}

/**
 * Middleware helper: require specific role
 */
export async function requireRole(
  c: Context<{ Bindings: Env }>,
  requiredRole: string
): Promise<Session | null> {
  const session = await requireAuth(c)
  
  if (!session) {
    return null
  }

  const roleHierarchy: Record<string, number> = {
    viewer: 1,
    agent: 2,
    manager: 3,
    admin: 4,
    owner: 5,
  }

  const userLevel = roleHierarchy[session.role] || 0
  const requiredLevel = roleHierarchy[requiredRole] || 0

  if (userLevel < requiredLevel) {
    return null
  }

  return session
}

/**
 * Parse cookie header string into object
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...valueParts] = cookie.trim().split('=')
    if (name) {
      cookies[name] = valueParts.join('=')
    }
  })

  return cookies
}
