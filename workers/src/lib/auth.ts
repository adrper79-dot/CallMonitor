/**
 * Auth utilities for Cloudflare Workers
 * Session validation, token parsing, and fingerprint binding (H2 hardening)
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
 * Compute device fingerprint from request headers.
 * Used to bind sessions to the device that created them (H2 hardening).
 */
export async function computeFingerprint(c: Context<{ Bindings: Env }>): Promise<string> {
  const userAgent = c.req.header('User-Agent') || 'unknown'
  const origin = c.req.header('Origin') || c.req.header('Referer') || 'unknown'
  const raw = `${userAgent}|${origin}`
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
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

    // Prefer direct connection string for consistency with other endpoints
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString

    if (!connectionString) {
      return null
    }

    const sql = neon(connectionString)

    // Query sessions with user and org membership info
    // Note: Using LEFT JOIN on org_members so users without org membership still work
    // Note: sessions.user_id is UUID, users.id is TEXT - cast s.user_id::text for comparison
    // Note: org_members.user_id is UUID, users.id is TEXT - cast om.user_id::text for comparison
    const result = await sql`
      SELECT 
        s.session_token, 
        s.expires, 
        u.email, 
        u.name, 
        u.id as user_id,
        om.organization_id, 
        om.role
      FROM public.sessions s
      JOIN public.users u ON u.id = s.user_id::text
      LEFT JOIN org_members om ON om.user_id::text = u.id
      WHERE s.session_token = ${token} AND s.expires > NOW()
      LIMIT 1
    `

    if (!result || result.length === 0) {
      return null
    }

    // H2 hardening: validate device fingerprint if one was stored at login
    // Graceful — if no fingerprint in KV (legacy sessions), skip validation
    try {
      const storedFp = await c.env.KV.get(`fp:${token}`)
      if (storedFp) {
        const currentFp = await computeFingerprint(c)
        if (storedFp !== currentFp) {
          // Fingerprint mismatch — possible token theft
          return null
        }
      }
    } catch {
      // KV failure is non-fatal — allow the request through
    }

    const row = result[0]

    return {
      user_id: row.user_id,
      email: row.email,
      name: row.name,
      organization_id: row.organization_id,
      role: row.role || 'viewer',
      expires: row.expires instanceof Date ? row.expires.toISOString() : String(row.expires),
    }
  } catch (error: any) {
    // Don't throw - just return null so routes can return 401
    return null
  }
}

/**
 * Middleware helper: require authenticated session
 */
export async function requireAuth(c: Context<{ Bindings: Env }>): Promise<Session | null> {
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
    analyst: 2,
    operator: 3,
    manager: 3,
    compliance: 3,
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

  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...valueParts] = cookie.trim().split('=')
    if (name) {
      cookies[name] = valueParts.join('=')
    }
  })

  return cookies
}
