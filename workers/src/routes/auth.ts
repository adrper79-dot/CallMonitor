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

// Signup endpoint
authRoutes.post('/signup', async (c) => {
  try {
    const body = await c.req.json()
    const { email, password, name, organizationName } = body as {
      email?: string
      password?: string
      name?: string
      organizationName?: string
    }

    if (!email || !password) {
      return c.json({ error: 'Email and password required' }, 400)
    }

    const db = getDb(c.env)

    // Check if user exists
    const existing = await db.query(
      `SELECT id FROM users WHERE email = $1`,
      [email.toLowerCase()]
    )

    if (existing.rows && existing.rows.length > 0) {
      return c.json({ error: 'User already exists' }, 409)
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user
    const userResult = await db.query(
      `INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
       RETURNING id, email, name`,
      [email.toLowerCase(), name || email.split('@')[0], passwordHash]
    )

    const user = userResult.rows[0]

    // Create organization if name provided
    if (organizationName) {
      const orgResult = await db.query(
        `INSERT INTO organizations (id, name, owner_id, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
         RETURNING id`,
        [organizationName, user.id]
      )

      // Add user as org member
      await db.query(
        `INSERT INTO org_members (id, user_id, organization_id, role, created_at)
         VALUES (gen_random_uuid(), $1, $2, 'owner', NOW())`,
        [user.id, orgResult.rows[0].id]
      )

      // Create default voice config
      await db.query(
        `INSERT INTO voice_configs (id, organization_id, record, transcribe, translate, survey, updated_at)
         VALUES (gen_random_uuid(), $1, true, false, false, false, NOW())`,
        [orgResult.rows[0].id]
      )
    }

    // Create AuthJS user record (insert if not exists)
    try {
      await db.query(
        `INSERT INTO "authjs"."users" (id, email, name, "emailVerified")
         VALUES ($1, $2, $3, NULL)`,
        [user.id, email.toLowerCase(), name || email.split('@')[0]]
      )
    } catch (authErr: any) {
      // Ignore duplicate key errors - user may already exist in authjs
      if (!authErr.message?.includes('duplicate') && !authErr.message?.includes('unique')) {
        throw authErr
      }
    }

    return c.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name }
    })
  } catch (err: any) {
    console.error('POST /api/auth/signup error:', err)
    return c.json({ error: 'Signup failed', details: err.message }, 500)
  }
})

// CSRF token endpoint (required by NextAuth client)
authRoutes.get('/csrf', async (c) => {
  // Generate a CSRF token
  const csrfToken = crypto.randomUUID()
  
  // Set cookie
  c.header('Set-Cookie', `next-auth.csrf-token=${csrfToken}; Path=/; SameSite=Lax; Secure; HttpOnly`)
  
  return c.json({ csrfToken })
})

// Auth providers endpoint (NextAuth format)
authRoutes.get('/providers', async (c) => {
  // Return available auth providers in NextAuth format
  return c.json({
    credentials: {
      id: 'credentials',
      name: 'Credentials',
      type: 'credentials',
      signinUrl: '/api/auth/signin/credentials',
      callbackUrl: '/api/auth/callback/credentials'
    }
  })
})

// Credentials callback (NextAuth login)
authRoutes.post('/callback/credentials', async (c) => {
  try {
    const body = await c.req.json()
    const { username, password, csrfToken } = body as {
      username?: string
      password?: string
      csrfToken?: string
    }

    if (!username || !password) {
      return c.json({ error: 'Credentials required' }, 401)
    }

    const db = getDb(c.env)

    // Find user by email
    const userResult = await db.query(
      `SELECT id, email, name, password_hash FROM users WHERE email = $1`,
      [username.toLowerCase()]
    )

    if (!userResult.rows || userResult.rows.length === 0) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    const user = userResult.rows[0]

    // Verify password
    const validPassword = await verifyPassword(password, user.password_hash)
    if (!validPassword) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    // Get user's organization
    const orgResult = await db.query(
      `SELECT om.organization_id, om.role, o.name as org_name
       FROM org_members om
       JOIN organizations o ON o.id = om.organization_id
       WHERE om.user_id = $1
       LIMIT 1`,
      [user.id]
    )

    const org = orgResult.rows?.[0]

    // Create session
    const sessionToken = crypto.randomUUID()
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    await db.query(
      `INSERT INTO "authjs"."sessions" ("sessionToken", "userId", expires)
       VALUES ($1, $2, $3)`,
      [sessionToken, user.id, expires.toISOString()]
    )

    // Set session cookie
    const isSecure = c.req.url.startsWith('https')
    const cookieName = isSecure ? '__Secure-next-auth.session-token' : 'next-auth.session-token'
    c.header('Set-Cookie', `${cookieName}=${sessionToken}; Path=/; Expires=${expires.toUTCString()}; SameSite=Lax${isSecure ? '; Secure' : ''}; HttpOnly`)

    return c.json({
      url: '/dashboard',
      ok: true,
      status: 200
    })
  } catch (err: any) {
    console.error('POST /api/auth/callback/credentials error:', err)
    return c.json({ error: 'Authentication failed', details: err.message }, 500)
  }
})

// Log endpoint for NextAuth client errors
authRoutes.post('/_log', async (c) => {
  // Silently accept logs (don't expose to client)
  try {
    const body = await c.req.json()
    console.log('Auth client log:', JSON.stringify(body).slice(0, 200))
  } catch {
    // Ignore parse errors
  }
  return c.json({ received: true })
})

// Helper to verify password
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash || !hash.includes(':')) return false
  
  const [saltHex, storedHash] = hash.split(':')
  const encoder = new TextEncoder()
  const data = encoder.encode(saltHex + password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  return computedHash === storedHash
}

// Helper to hash password
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  
  const data = encoder.encode(saltHex + password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  return `${saltHex}:${hash}`
}
