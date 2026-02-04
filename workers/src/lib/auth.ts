/**
 * Auth utilities for Cloudflare Workers
 * Session validation and token parsing
 */

import type { Context } from 'hono'
import type { Env } from '../index'
import { getDb } from './db'

export interface Session {
  user_id: string
  email: string
  name: string
  organization_id: string
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
    return cookies['session-token'] || null
  }

  return null
}

export async function verifySession(
  c: Context<{ Bindings: Env }>,
  token: string
): Promise<Session | null> {
  try {
    // Use neon client for consistency
    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    const result = await sql`
      SELECT s.session_token, s.expires, u.email, u.name, u.id as user_id,
             om.organization_id, om.role
      FROM public.sessions s
      JOIN public.users u ON u.id = s.user_id::text
      LEFT JOIN org_members om ON om.user_id = u.id
      WHERE s.session_token = ${token} AND s.expires > NOW()
      LIMIT 1
    `

    if (!result || result.length === 0) {
      return null
    }

    const row = result[0]

    return {
      user_id: row.user_id,
      email: row.email,
      name: row.name,
      organization_id: row.organization_id,
      role: row.role || 'viewer',
      expires: row.expires.toISOString(),
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
