/**
 * Auth utilities for Cloudflare Workers
 * Session validation, token parsing, and fingerprint binding (H2 hardening)
 */

import type { Context, Next } from 'hono'
import type { Env } from '../index'
import { getDb } from './db'
import { logger } from './logger'

export interface Session {
  user_id: string
  email: string
  name: string
  organization_id: string
  role: string
  platform_role?: string
  expires: string
}

/**
 * Compute device fingerprint from request headers.
 * Used to bind sessions to the device that created them (H2 hardening).
 */
export async function computeFingerprint(
  c: Context<{ Bindings: Env; Variables: { session: Session } }>
): Promise<string> {
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
export function parseSessionToken(
  c: Context<{ Bindings: Env; Variables: { session: Session } }>
): string | null {
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
  c: Context<{ Bindings: Env; Variables: { session: Session } }>,
  token: string
): Promise<Session | null> {
  const db = getDb(c.env)
  try {
    logger.info('[verifySession] Verifying session token', {
      token_prefix: token.substring(0, 8) + '...',
      has_token: !!token,
    })

    // Query sessions with user and org membership info
    // Note: Using LEFT JOIN on org_members so users without org membership still work
    // Note: All user ID columns are UUID type — direct comparison, no casts needed
    const result = await db.query(
      `
      SELECT
        s.session_token,
        s.expires,
        u.email,
        u.name,
        u.id as user_id,
        u.platform_role,
        om.organization_id,
        om.role
      FROM public.sessions s
      JOIN public.users u ON u.id = s.user_id
      LEFT JOIN org_members om ON om.user_id = u.id
      WHERE s.session_token = $1 AND s.expires > NOW()
      LIMIT 1
    `,
      [token]
    )

    logger.info('[verifySession] Session query result', {
      found_rows: result.rows?.length || 0,
      has_user: !!result.rows?.[0]?.email,
      has_org: !!result.rows?.[0]?.organization_id,
    })

    if (!result.rows || result.rows.length === 0) {
      return null
    }

    // H2 hardening: validate device fingerprint if one was stored at login
    // Graceful — if no fingerprint in KV (legacy sessions), skip validation
    const row = result.rows[0]

    try {
      const storedFp = await c.env.KV.get(`fp:${token}`)
      if (storedFp) {
        const currentFp = await computeFingerprint(c)
        if (!timingSafeEqual(storedFp, currentFp)) {
          // Fingerprint mismatch — reject session to prevent hijacking
          logger.warn('Fingerprint mismatch detected — session rejected', {
            stored: storedFp,
            current: currentFp,
            session_id: row.id,
          })
          return null
        }
      }
    } catch (err) {
      // KV failure is non-fatal — allow the request through
      logger.warn('Fingerprint check error', { error: err })
    }

    return {
      user_id: row.user_id,
      email: row.email,
      name: row.name,
      organization_id: row.organization_id,
      role: row.role || 'viewer',
      platform_role: row.platform_role,
      expires: row.expires instanceof Date ? row.expires.toISOString() : String(row.expires),
    }
  } catch (error: any) {
    // Don't throw - just return null so routes can return 401
    // CRITICAL: Log the error so silent failures are visible in production
    logger.error('[verifySession] Session verification failed', { error: error?.message || error })
    return null
  } finally {
    await db.end()
  }
}

/**
 * Middleware helper: require authenticated session
 */
export async function requireAuth(
  c: Context<{ Bindings: Env; Variables: { session: Session } }>
): Promise<Session | null> {
  const token = parseSessionToken(c)

  if (!token) {
    return null
  }

  return verifySession(c, token)
}

/**
 * Hono middleware: authenticate and set session in context.
 *
 * This MUST run before requirePlan() so that c.get('session') is populated.
 * Use as: route.get('/path', authMiddleware, requirePlan('pro'), handler)
 */
export const authMiddleware = async (
  c: Context<{ Bindings: Env; Variables: { session: Session } }>,
  next: Next
) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Authentication required', code: 'AUTH_REQUIRED' }, 401)
  }
  c.set('session', session)
  await next()
}

/**
 * Middleware helper: require specific role
 */
export async function requireRole(
  c: Context<{ Bindings: Env; Variables: { session: Session } }>,
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
 * Constant-time string comparison to prevent timing side-channel attacks.
 * Used for hash comparison, fingerprint validation, and token verification.
 * BL-057 / BL-079: Replaces vulnerable === comparisons.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const encoder = new TextEncoder()
  const bufA = encoder.encode(a)
  const bufB = encoder.encode(b)
  let diff = 0
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i] ^ bufB[i]
  }
  return diff === 0
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
