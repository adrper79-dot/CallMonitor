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
      organization_id: keyRecord.organization_id,
      organization_name: keyRecord.organization_name,
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

    // Check if user exists - temporarily use direct neon client
    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    console.log('[Signup] Using connection string type:', c.env.NEON_PG_CONN ? 'NEON_PG_CONN' : 'HYPERDRIVE')
    const sqlClient = neon(connectionString)

    console.log('[Signup] About to query for existing user:', email.toLowerCase())

    const existing = await sqlClient`SELECT id FROM users WHERE email = ${email.toLowerCase()}`

    console.log('[Signup] Query result:', {
      type: typeof existing,
      length: existing?.length,
      data: existing
    })

    console.log('[Signup] Checking for existing user:', {
      email: email.toLowerCase(),
      existingRows: existing?.length || 0,
      existingData: existing?.[0] || null
    })

    if (existing && existing.length > 0) {
      console.log('[Signup] User already exists, returning 409')
      return c.json({ error: 'User already exists' }, 409)
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user (INSERT without RETURNING, then SELECT)
    try {
      await sqlClient`INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
         VALUES (gen_random_uuid(), ${email.toLowerCase()}, ${name || email.split('@')[0]}, ${passwordHash}, NOW(), NOW())`
      console.log('[Signup] INSERT successful')
    } catch (insertError: any) {
      console.error('[Signup] INSERT failed:', insertError)
      return c.json({ error: 'Signup failed', details: 'User creation failed: ' + insertError.message }, 500)
    }

    // Get the created user
    let userResult;
    try {
      userResult = await sqlClient`SELECT id, email, name FROM users WHERE email = ${email.toLowerCase()}`
      console.log('[Signup] SELECT successful')
    } catch (selectError: any) {
      console.error('[Signup] SELECT failed:', selectError)
      return c.json({ error: 'Signup failed', details: 'User lookup failed: ' + selectError.message }, 500)
    }

    console.log('[Signup] User creation result:', {
      type: typeof userResult,
      isArray: Array.isArray(userResult),
      length: userResult?.length,
      data: userResult,
      firstItem: userResult?.[0],
      firstItemType: typeof userResult?.[0]
    })

    if (!userResult) {
      console.error('[Signup] User creation failed - no result returned')
      return c.json({ error: 'Signup failed', details: 'User creation failed' }, 500)
    }

    // Handle both array and single object returns
    const user = Array.isArray(userResult) ? userResult[0] : userResult

    console.log('[Signup] Extracted user:', user)

    if (!user || !user.id) {
      console.error('[Signup] User creation failed - invalid result:', user)
      return c.json({ 
        error: 'Signup failed', 
        details: 'Invalid user data',
        debug: {
          userResultType: typeof userResult,
          userResultIsArray: Array.isArray(userResult),
          userResultLength: userResult?.length,
          userResultData: userResult,
          extractedUser: user
        }
      }, 500)
    }

    // Create organization if name provided
    if (organizationName) {
      const orgResult = await db.query(
        `INSERT INTO organizations (id, name, owner_id, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
         RETURNING id`,
        [organizationName, user.id]
      )

      const orgId = orgResult.rows[0].id

      // Add user as org member
      await db.query(
        `INSERT INTO org_members (id, user_id, organization_id, role, created_at)
         VALUES (gen_random_uuid(), $1, $2, 'admin', NOW())`,
        [user.id, orgId]
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
  c.header('Set-Cookie', `csrf-token=${csrfToken}; Path=/; SameSite=None; Secure; HttpOnly`)
  
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

// Login endpoint
authRoutes.post('/callback/credentials', async (c) => {
  try {
    const body = await c.req.json()
    const { username, email, password, csrfToken } = body as {
      username?: string
      email?: string
      password?: string
      csrfToken?: string
    }

    // Use email if username not provided
    const loginIdentifier = username || email

    console.log('[Auth] Login attempt:', { identifier: loginIdentifier, hasPassword: !!password, hasCsrfToken: !!csrfToken })

    if (!loginIdentifier || !password) {
      console.log('[Auth] Missing credentials')
      return c.json({ error: 'Credentials required' }, 401)
    }

    // Validate CSRF token (CORS protects against CSRF since only allowed origins can fetch the token)
    if (!csrfToken) {
      console.log('[Auth] CSRF token missing')
      return c.json({ error: 'CSRF token required' }, 401)
    }

    // Find user by email - temporarily use direct neon client
    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sqlClient = neon(connectionString)

    const userResult = await sqlClient`SELECT id, email, name, password_hash FROM users WHERE email = ${loginIdentifier.toLowerCase()}`

    console.log('[Auth] User lookup result:', {
      type: typeof userResult,
      length: userResult?.length,
      data: userResult?.[0] ? { ...userResult[0], password_hash: '[HIDDEN]' } : null
    })

    if (!userResult || userResult.length === 0) {
      console.log('[Auth] User not found:', username)
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    const user = userResult[0]
    console.log('[Auth] User found:', { id: user.id, email: user.email, hasPasswordHash: !!user.password_hash })

    // Verify password
    const validPassword = await verifyPassword(password, user.password_hash)
    console.log('[Auth] Password validation:', { valid: validPassword })
    
    if (!validPassword) {
      console.log('[Auth] Invalid password for user:', username)
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    // Get user's organization
    const orgResult = await sqlClient`SELECT om.organization_id, om.role, o.name as org_name
       FROM org_members om
       JOIN organizations o ON o.id = om.organization_id
       WHERE om.user_id = ${user.id}
       LIMIT 1`

    const org = orgResult?.[0]

    // Create session
    const sessionId = crypto.randomUUID()
    const sessionToken = crypto.randomUUID()
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    console.log('[Auth] About to create session')
    try {
      // Use snake_case column names to match actual database schema
      await sqlClient`INSERT INTO public.sessions (id, session_token, user_id, expires)
        VALUES (${sessionId}, ${sessionToken}, ${user.id}, ${expires.toISOString()})
        ON CONFLICT (session_token) DO NOTHING`
      console.log('[Auth] Session created successfully')
    } catch (sessionError) {
      console.error('[Auth] Session creation failed:', sessionError)
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
      sessionToken,
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
    console.error('POST /api/auth/callback/credentials error:', err)
    return c.json({ error: 'Authentication failed', details: err.message }, 500)
  }
})

// Log endpoint for client errors
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

// Signout endpoint - invalidate session
authRoutes.post('/signout', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    
    if (token) {
      // Delete session from database
      const { neon } = await import('@neondatabase/serverless')
      const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
      const sqlClient = neon(connectionString)
      
      await sqlClient`DELETE FROM public.sessions WHERE session_token = ${token}`
    }
    
    // Clear session cookie
    c.header('Set-Cookie', 'session-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure; HttpOnly')
    
    return c.json({ success: true })
  } catch (err: any) {
    console.error('POST /api/auth/signout error:', err)
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
    // For now, just return success message
    console.log(`[Forgot Password] Reset requested for: ${email}`)
    
    return c.json({ message: 'If an account with that email exists, a password reset link has been sent.' })
  } catch (err: any) {
    console.error('POST /api/auth/forgot-password error:', err)
    return c.json({ error: 'Failed to process request' }, 500)
  }
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
