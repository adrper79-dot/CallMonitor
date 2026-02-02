/**
 * Auth Routes (Session validation, token refresh)
 * 
 * Note: Full OAuth flows remain in the UI via NextAuth client-side
 * This handles API-side session validation
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { getDb } from '../lib/db'
import { parseSessionToken, verifySession } from '../lib/auth'

export const authRoutes = new Hono<{ Bindings: Env }>()

// Get current session
authRoutes.get('/session', async (c) => {
  try {
    const token = parseSessionToken(c)
    
    if (!token) {
      return c.json({ user: null, expires: null })
    }

    const session = await verifySession(c, token)
    
    if (!session) {
      return c.json({ user: null, expires: null })
    }

    return c.json({
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
        organizationId: session.organizationId,
        role: session.role,
      },
      expires: session.expires,
    })
  } catch (err: any) {
    console.error('GET /api/auth/session error:', err)
    return c.json({ user: null, expires: null })
  }
})

// Validate API key (for external integrations)
authRoutes.post('/validate-key', async (c) => {
  try {
    const body = await c.req.json()
    const { apiKey } = body

    if (!apiKey) {
      return c.json({ valid: false, error: 'API key required' }, 400)
    }

    const db = getDb(c.env)

    // Check API keys table
    const result = await db.query(
      `SELECT ak.*, o.name as organization_name
       FROM api_keys ak
       JOIN organizations o ON o.id = ak.organization_id
       WHERE ak.key_hash = $1 AND ak.revoked_at IS NULL AND ak.expires_at > NOW()`,
      [await hashApiKey(apiKey)]
    )

    if (!result.rows || result.rows.length === 0) {
      return c.json({ valid: false, error: 'Invalid or expired API key' }, 401)
    }

    const keyRecord = result.rows[0]

    // Update last used
    await db.query(
      `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
      [keyRecord.id]
    )

    return c.json({
      valid: true,
      organizationId: keyRecord.organization_id,
      organizationName: keyRecord.organization_name,
      permissions: keyRecord.permissions,
    })
  } catch (err: any) {
    console.error('POST /api/auth/validate-key error:', err)
    return c.json({ valid: false, error: 'Validation failed' }, 500)
  }
})

// Helper to hash API key (using Web Crypto API)
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
