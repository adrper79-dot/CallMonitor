/**
 * Auth Routes - Custom Session-Based Authentication
 * 
 * Handles all authentication for the application:
 * - Session creation/validation
 * - User signup/login
 * - CSRF protection
 * - API key validation for integrations
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
        id: session.user_id,
        email: session.email,
        name: session.name,
        organization_id: session.organization_id,
        role: session.role,
      },
      expires: session.expires,
    })
  } catch (err: any) {
    console.error('Session verification error')
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
      organization_id: keyRecord.organization_id,
      organization_name: keyRecord.organization_name,
      permissions: keyRecord.permissions,
    })
  } catch (err: any) {
    console.error('API key validation error')
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

    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sqlClient = neon(connectionString)

    const existing = await sqlClient`SELECT id FROM users WHERE email = ${email.toLowerCase()}`

    if (existing && existing.length > 0) {
      return c.json({ error: 'User already exists' }, 409)
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user
    try {
      await sqlClient`INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
         VALUES (gen_random_uuid(), ${email.toLowerCase()}, ${name || email.split('@')[0]}, ${passwordHash}, NOW(), NOW())`
    } catch (insertError: any) {
      return c.json({ error: 'Signup failed' }, 500)
    }

    // Get the created user
    let userResult;
    try {
      userResult = await sqlClient`SELECT id, email, name FROM users WHERE email = ${email.toLowerCase()}`
    } catch (selectError: any) {
      return c.json({ error: 'Signup failed' }, 500)
    }

    if (!userResult) {
      return c.json({ error: 'Signup failed' }, 500)
    }

    // Handle both array and single object returns
    const user = Array.isArray(userResult) ? userResult[0] : userResult

    if (!user || !user.id) {
      return c.json({ error: 'Signup failed' }, 500)
    }

    // Create organization if name provided
    if (organizationName) {
      try {
        const orgInsertResult = await sqlClient`
          INSERT INTO organizations (id, name, created_by, created_at)
          VALUES (gen_random_uuid(), ${organizationName}, ${user.id}, NOW())
          RETURNING id`
        
        const orgId = orgInsertResult[0]?.id

        if (orgId) {
          await sqlClient`
            INSERT INTO org_members (id, user_id, organization_id, role, created_at)
            VALUES (gen_random_uuid(), ${user.id}::uuid, ${orgId}, 'admin', NOW())`
        }
      } catch (orgErr: any) {
        // Don't fail signup if org creation fails
      }
    }

    return c.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name }
    })
  } catch (err: any) {
    console.error('Signup error')
    return c.json({ error: 'Signup failed' }, 500)
  }
})

// CSRF token endpoint (required by NextAuth client)
authRoutes.get('/csrf', async (c) => {
  // Generate a CSRF token and store in KV for server-side validation
  const csrf_token = crypto.randomUUID()
  
  // Store token in KV with 10-minute TTL — will be validated on login
  await c.env.KV.put(`csrf:${csrf_token}`, '1', { expirationTtl: 600 })
  
  // Set cookie for same-origin requests
  c.header('Set-Cookie', `csrf-token=${csrf_token}; Path=/; SameSite=None; Secure; HttpOnly`)
  
  return c.json({ csrf_token })
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

// Login endpoint
authRoutes.post('/callback/credentials', async (c) => {
  try {
    const body = await c.req.json()
    // Accept both snake_case and camelCase for backwards compatibility
    const { username, email, password, csrf_token, csrfToken } = body as {
      username?: string
      email?: string
      password?: string
      csrf_token?: string
      csrfToken?: string // Legacy support
    }

    // Use snake_case version if available, otherwise fall back to camelCase
    const csrfTokenValue = csrf_token || csrfToken
    
    // Use email if username not provided
    const loginIdentifier = username || email

    if (!loginIdentifier || !password) {
      return c.json({ error: 'Credentials required' }, 401)
    }

    // Validate CSRF token — must match a token we issued (stored in KV)
    if (!csrfTokenValue) {
      return c.json({ error: 'CSRF token required' }, 401)
    }

    const storedCsrf = await c.env.KV.get(`csrf:${csrfTokenValue}`)
    if (!storedCsrf) {
      return c.json({ error: 'Invalid or expired CSRF token' }, 403)
    }

    // Delete CSRF token after use (one-time use)
    await c.env.KV.delete(`csrf:${csrfTokenValue}`)

    // Find user by email - temporarily use direct neon client
    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sqlClient = neon(connectionString)

    const userResult = await sqlClient`SELECT id, email, name, password_hash FROM users WHERE email = ${loginIdentifier.toLowerCase()}`

    if (!userResult || userResult.length === 0) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    const user = userResult[0]

    // Verify password (supports legacy SHA-256 + new PBKDF2 formats)
    const { valid: validPassword, needsRehash } = await verifyPassword(password, user.password_hash)
    
    if (!validPassword) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    // Transparently upgrade legacy SHA-256 hash to PBKDF2 on successful login
    if (needsRehash) {
      try {
        const upgradedHash = await hashPassword(password)
        await sqlClient`UPDATE users SET password_hash = ${upgradedHash}, updated_at = NOW() WHERE id = ${user.id}`
      } catch (_rehashErr) {
        // Non-fatal — login still succeeds, hash will be upgraded next time
      }
    }

    // Get user's organization
    // Note: org_members.user_id is UUID, users.id is TEXT - need to cast
    const orgResult = await sqlClient`SELECT om.organization_id, om.role, o.name as org_name
       FROM org_members om
       JOIN organizations o ON o.id = om.organization_id
       WHERE om.user_id::text = ${user.id}
       LIMIT 1`

    const org = orgResult?.[0]

    // Create session
    const sessionId = crypto.randomUUID()
    const sessionToken = crypto.randomUUID()
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    try {
      // sessions table has UUID columns for id and user_id (per actual schema check)
      await sqlClient`INSERT INTO public.sessions (id, session_token, user_id, expires)
        VALUES (${sessionId}::uuid, ${sessionToken}, ${user.id}::uuid, ${expires.toISOString()})
        ON CONFLICT (session_token) DO NOTHING`
    } catch (sessionError: any) {
      return c.json({ error: 'Session creation failed' }, 500)
    }

    // For cross-origin requests, we return the token in the response
    // The frontend will store it and send it in Authorization header
    // Also set cookie for same-origin requests with SameSite=None for cross-origin
    c.header('Set-Cookie', `session-token=${sessionToken}; Path=/; Expires=${expires.toUTCString()}; SameSite=None; Secure; HttpOnly`)

    return c.json({
      url: '/dashboard',
      ok: true,
      status: 200,
      session_token: sessionToken,
      expires: expires.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organization_id: org?.organization_id || null,
        role: org?.role || null
      }
    })
  } catch (err: any) {
    console.error('Authentication error')
    return c.json({ error: 'Authentication failed' }, 500)
  }
})

// Log endpoint for client errors
authRoutes.post('/_log', async (c) => {
  // Silently accept logs (don't expose to client)
  return c.json({ received: true })
})

// Signout endpoint - invalidate session
authRoutes.post('/signout', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    
    if (token) {
      // Delete session from database (snake_case per standard)
      const { neon } = await import('@neondatabase/serverless')
      const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
      const sqlClient = neon(connectionString)
      
      await sqlClient`DELETE FROM public.sessions WHERE session_token = ${token}`
    }
    
    // Clear session cookie
    c.header('Set-Cookie', 'session-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure; HttpOnly')
    
    return c.json({ success: true })
  } catch (err: any) {
    console.error('Signout error')
    // Still return success - client should clear local state regardless
    return c.json({ success: true })
  }
})

// Forgot password endpoint
authRoutes.post('/forgot-password', async (c) => {
  try {
    const body = await c.req.json()
    const { email } = body as { email?: string }

    if (!email) {
      return c.json({ error: 'Email required' }, 400)
    }

    // Check if user exists
    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sqlClient = neon(connectionString)

    const userResult = await sqlClient`SELECT id FROM users WHERE email = ${email.toLowerCase()}`
    
    if (!userResult || userResult.length === 0) {
      // Don't reveal if user exists or not for security
      return c.json({ message: 'If an account with that email exists, a password reset link has been sent.' })
    }

    // TODO: Implement actual password reset email sending
    
    return c.json({ message: 'If an account with that email exists, a password reset link has been sent.' })
  } catch (err: any) {
    console.error('Forgot password error')
    return c.json({ error: 'Failed to process request' }, 500)
  }
})

// ─── Password Hashing (PBKDF2-SHA256, 120k iterations) ───────────────────────
// PBKDF2 via Web Crypto API — NIST SP 800-132 recommended for password hashing.
// Unlike raw SHA-256, PBKDF2 applies key stretching (120,000 rounds) making
// brute-force attacks ~120,000x slower per guess.

const PBKDF2_ITERATIONS = 120_000
const PBKDF2_HASH = 'SHA-256'
const SALT_BYTES = 32
const KEY_BYTES = 32

function hexEncode(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexDecode(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

/**
 * Hash a password using PBKDF2 with a random salt.
 * Output format: "pbkdf2:120000:saltHex:derivedKeyHex"
 */
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const saltBuffer = salt.buffer as ArrayBuffer
  const encoder = new TextEncoder()

  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  )

  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuffer, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    keyMaterial,
    KEY_BYTES * 8
  )

  return `pbkdf2:${PBKDF2_ITERATIONS}:${hexEncode(saltBuffer)}:${hexEncode(derived)}`
}

/**
 * Verify a password against a stored hash.
 * Supports both new PBKDF2 format and legacy SHA-256 format for migration.
 * Returns { valid, needsRehash } so callers can upgrade hashes transparently.
 */
async function verifyPassword(password: string, storedHash: string): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!storedHash) return { valid: false, needsRehash: false }

  // New PBKDF2 format: "pbkdf2:iterations:saltHex:hashHex"
  if (storedHash.startsWith('pbkdf2:')) {
    const parts = storedHash.split(':')
    if (parts.length !== 4) return { valid: false, needsRehash: false }

    const iterations = parseInt(parts[1], 10)
    const salt = hexDecode(parts[2])
    const saltBuffer = salt.buffer as ArrayBuffer
    const expectedHash = parts[3]
    const encoder = new TextEncoder()

    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
    )

    const derived = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBuffer, iterations, hash: PBKDF2_HASH },
      keyMaterial,
      KEY_BYTES * 8
    )

    const valid = hexEncode(derived) === expectedHash
    // Rehash if iteration count has been bumped since this hash was created
    return { valid, needsRehash: valid && iterations < PBKDF2_ITERATIONS }
  }

  // Legacy SHA-256 format: "saltHex:hashHex" — verify then flag for rehash
  if (storedHash.includes(':')) {
    const [saltHex, expectedHash] = storedHash.split(':')
    const encoder = new TextEncoder()
    const data = encoder.encode(saltHex + password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const computedHash = hexEncode(hashBuffer)
    const valid = computedHash === expectedHash
    return { valid, needsRehash: valid } // Always rehash legacy hashes
  }

  return { valid: false, needsRehash: false }
}
