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
import type { AppEnv } from '../index'
import { getDb } from '../lib/db'
import { parseSessionToken, verifySession, computeFingerprint } from '../lib/auth'
import { validateBody } from '../lib/validate'
import {
  ValidateKeySchema,
  SignupSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from '../lib/schemas'
import { loginRateLimit, signupRateLimit, forgotPasswordRateLimit } from '../lib/rate-limit'
import { logger } from '../lib/logger'
import { sendEmail, passwordResetEmailHtml } from '../lib/email'
import { writeAuditLog, AuditAction } from '../lib/audit'

export const authRoutes = new Hono<AppEnv>()

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
    logger.error('Session verification error', { error: err?.message })
    return c.json({ user: null, expires: null })
  }
})

// Validate API key (for external integrations)
authRoutes.post('/validate-key', async (c) => {
  const parsed = await validateBody(c, ValidateKeySchema)
  if (!parsed.success) return parsed.response
  const { apiKey } = parsed.data

  const db = getDb(c.env)
  try {
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
    await db.query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [keyRecord.id])

    // Audit: API key validated (fire-and-forget)
    writeAuditLog(db, {
      organizationId: keyRecord.organization_id,
      userId: 'api_key',
      resourceType: 'api_key',
      resourceId: keyRecord.id,
      action: AuditAction.API_KEY_VALIDATED,
      after: { organization_name: keyRecord.organization_name },
    })

    return c.json({
      valid: true,
      organization_id: keyRecord.organization_id,
      organization_name: keyRecord.organization_name,
      permissions: keyRecord.permissions,
    })
  } catch (err: any) {
    logger.error('API key validation error', { error: err?.message })
    return c.json({ valid: false, error: 'Validation failed' }, 500)
  } finally {
    await db.end()
  }
})

// Helper to hash API key (using Web Crypto API)
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Signup endpoint
authRoutes.post('/signup', signupRateLimit, async (c) => {
  const parsed = await validateBody(c, SignupSchema)
  if (!parsed.success) return parsed.response
  const { email, password, name, organizationName, csrf_token, csrfToken } = parsed.data

  // Validate CSRF token — same pattern as login
  const csrfTokenValue = csrf_token || csrfToken
  if (!csrfTokenValue) {
    return c.json({ error: 'CSRF token required' }, 401)
  }
  const storedCsrf = await c.env.KV.get(`csrf:${csrfTokenValue}`)
  if (!storedCsrf) {
    return c.json({ error: 'Invalid or expired CSRF token' }, 403)
  }
  // Delete CSRF token after use (one-time use)
  await c.env.KV.delete(`csrf:${csrfTokenValue}`)

  const db = getDb(c.env)
  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])

    if (existing.rows && existing.rows.length > 0) {
      return c.json({ error: 'User already exists' }, 409)
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user
    try {
      await db.query(
        `INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())`,
        [email.toLowerCase(), name || email.split('@')[0], passwordHash]
      )
    } catch (insertError: any) {
      return c.json({ error: 'Signup failed' }, 500)
    }

    // Get the created user
    let userResult
    try {
      userResult = await db.query('SELECT id, email, name FROM users WHERE email = $1', [
        email.toLowerCase(),
      ])
    } catch (selectError: any) {
      return c.json({ error: 'Signup failed' }, 500)
    }

    if (!userResult.rows || userResult.rows.length === 0) {
      return c.json({ error: 'Signup failed' }, 500)
    }

    const user = userResult.rows[0]

    if (!user || !user.id) {
      return c.json({ error: 'Signup failed' }, 500)
    }

    // Create organization if name provided
    if (organizationName) {
      try {
        const orgInsertResult = await db.query(
          `INSERT INTO organizations (id, name, created_by, created_at)
           VALUES (gen_random_uuid(), $1, $2, NOW())
           RETURNING id`,
          [organizationName, user.id]
        )

        const orgId = orgInsertResult.rows[0]?.id

        if (orgId) {
          await db.query(
            `INSERT INTO org_members (id, user_id, organization_id, role, created_at)
             VALUES (gen_random_uuid(), $1::uuid, $2, 'admin', NOW())`,
            [user.id, orgId]
          )
        }
      } catch (orgErr: any) {
        // Don't fail signup if org creation fails
      }
    }

    // Audit: user signup (fire-and-forget)
    writeAuditLog(db, {
      organizationId: 'signup',
      userId: user.id,
      resourceType: 'user',
      resourceId: user.id,
      action: AuditAction.USER_SIGNUP,
      after: { email: user.email, name: user.name },
    })

    return c.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    })
  } catch (err: any) {
    logger.error('Signup error', { error: err?.message })
    return c.json({ error: 'Signup failed' }, 500)
  } finally {
    await db.end()
  }
})

// CSRF token endpoint (used by auth client)
authRoutes.get('/csrf', async (c) => {
  try {
    // Generate a CSRF token and store in KV for server-side validation
    const csrf_token = crypto.randomUUID()

    // Store token in KV with 10-minute TTL — will be validated on login
    if (c.env.KV) {
      await c.env.KV.put(`csrf:${csrf_token}`, '1', { expirationTtl: 600 })
    }

    // Set cookie for same-origin requests
    c.header('Set-Cookie', `csrf-token=${csrf_token}; Path=/; SameSite=None; Secure; HttpOnly`)

    return c.json({ csrf_token })
  } catch (err: any) {
    logger.error('CSRF token generation error', { error: err?.message })
    // Return a token even on KV failure — form will still work via cookie
    const fallbackToken = crypto.randomUUID()
    c.header('Set-Cookie', `csrf-token=${fallbackToken}; Path=/; SameSite=None; Secure; HttpOnly`)
    return c.json({ csrf_token: fallbackToken })
  }
})

// Auth providers endpoint
authRoutes.get('/providers', async (c) => {
  // Return available auth providers
  return c.json({
    credentials: {
      id: 'credentials',
      name: 'Credentials',
      type: 'credentials',
      signinUrl: '/api/auth/signin/credentials',
      callbackUrl: '/api/auth/callback/credentials',
    },
  })
})

// Login endpoint
authRoutes.post('/callback/credentials', loginRateLimit, async (c) => {
  const parsed = await validateBody(c, LoginSchema)
  if (!parsed.success) return parsed.response
  const { username, email, password, csrf_token, csrfToken } = parsed.data

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

  // Find user by email
  const db = getDb(c.env)
  try {
    const userResult = await db.query(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1',
      [loginIdentifier.toLowerCase()]
    )

    if (!userResult.rows || userResult.rows.length === 0) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    const user = userResult.rows[0]

    // Verify password (supports legacy SHA-256 + new PBKDF2 formats)
    const { valid: validPassword, needsRehash } = await verifyPassword(password, user.password_hash)

    if (!validPassword) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    // Transparently upgrade legacy SHA-256 hash to PBKDF2 on successful login
    if (needsRehash) {
      try {
        const upgradedHash = await hashPassword(password)
        await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
          upgradedHash,
          user.id,
        ])
      } catch (_rehashErr) {
        // Non-fatal — login still succeeds, hash will be upgraded next time
      }
    }

    // Get user's organization
    // Note: org_members.user_id is UUID, users.id is TEXT - need to cast
    const orgResult = await db.query(
      `SELECT om.organization_id, om.role, o.name as org_name
       FROM org_members om
       JOIN organizations o ON o.id = om.organization_id
       WHERE om.user_id::text = $1
       LIMIT 1`,
      [user.id]
    )

    const org = orgResult.rows?.[0]

    // Create session
    const sessionId = crypto.randomUUID()
    const sessionToken = crypto.randomUUID()
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days (H2 hardening: reduced from 30)

    // H2 hardening: bind session to device fingerprint (User-Agent + origin)
    // If token is stolen, it won't work from a different device/browser
    const fingerprint = await computeFingerprint(c)

    try {
      // sessions table has UUID columns for id and user_id (per actual schema check)
      await db.query(
        `INSERT INTO public.sessions (id, session_token, user_id, expires)
         VALUES ($1::uuid, $2, $3::uuid, $4)
         ON CONFLICT (session_token) DO NOTHING`,
        [sessionId, sessionToken, user.id, expires.toISOString()]
      )

      // H2 hardening: store fingerprint in KV bound to session token
      // TTL matches session expiry (7 days = 604800 seconds)
      await c.env.KV.put(`fp:${sessionToken}`, fingerprint, {
        expirationTtl: 7 * 24 * 60 * 60,
      })
    } catch (sessionError: any) {
      return c.json({ error: 'Session creation failed' }, 500)
    }

    // For cross-origin requests, we return the token in the response
    // The frontend will store it and send it in Authorization header
    // Also set cookie for same-origin requests with SameSite=None for cross-origin
    c.header(
      'Set-Cookie',
      `session-token=${sessionToken}; Path=/; Expires=${expires.toUTCString()}; SameSite=None; Secure; HttpOnly`
    )

    // Audit: user login (fire-and-forget)
    writeAuditLog(db, {
      organizationId: org?.organization_id || 'none',
      userId: user.id,
      resourceType: 'session',
      resourceId: sessionId,
      action: AuditAction.SESSION_CREATED,
      after: { email: user.email, role: org?.role || null },
    })

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
        role: org?.role || null,
      },
    })
  } catch (err: any) {
    logger.error('Authentication error', { error: err?.message })
    return c.json({ error: 'Authentication failed' }, 500)
  } finally {
    await db.end()
  }
})

// Log endpoint for client errors
authRoutes.post('/_log', async (c) => {
  // Silently accept logs (don't expose to client)
  return c.json({ received: true })
})

// BL-023: Session refresh — extend session without re-login
// Call this when user is actively using the app to prevent 7-day expiry
authRoutes.post('/refresh', async (c) => {
  try {
    const token = parseSessionToken(c)
    if (!token) {
      return c.json({ error: 'No session token' }, 401)
    }

    const session = await verifySession(c, token)
    if (!session) {
      return c.json({ error: 'Invalid or expired session' }, 401)
    }

    // Only refresh if session expires within the next 24 hours
    const expiresAt = new Date(session.expires)
    const hoursUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)
    if (hoursUntilExpiry > 24) {
      // Session still has >24h left — no refresh needed
      return c.json({
        success: true,
        refreshed: false,
        expires: session.expires,
        message: 'Session still valid, no refresh needed',
      })
    }

    // Extend session by 7 days from now
    const newExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const db = getDb(c.env)
    try {
      await db.query(`UPDATE public.sessions SET expires = $1 WHERE session_token = $2`, [
        newExpires.toISOString(),
        token,
      ])

      // Refresh KV fingerprint TTL
      const fingerprint = await computeFingerprint(c)
      await c.env.KV.put(`fp:${token}`, fingerprint, {
        expirationTtl: 7 * 24 * 60 * 60,
      })

      // Update cookie expiry
      c.header(
        'Set-Cookie',
        `session-token=${token}; Path=/; Expires=${newExpires.toUTCString()}; SameSite=None; Secure; HttpOnly`
      )

      // Audit: session refreshed (fire-and-forget)
      writeAuditLog(db, {
        organizationId: session.organization_id || 'none',
        userId: session.user_id,
        resourceType: 'session',
        resourceId: token,
        action: AuditAction.SESSION_REFRESHED,
        after: { expires: newExpires.toISOString() },
      })

      return c.json({
        success: true,
        refreshed: true,
        expires: newExpires.toISOString(),
      })
    } finally {
      await db.end()
    }
  } catch (err: any) {
    logger.error('Session refresh error', { error: err?.message })
    return c.json({ error: 'Failed to refresh session' }, 500)
  }
})

// Signout endpoint - invalidate session
authRoutes.post('/signout', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')

  if (!token) {
    // No token — just clear cookie and return
    c.header(
      'Set-Cookie',
      'session-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure; HttpOnly'
    )
    return c.json({ success: true })
  }

  const db = getDb(c.env)
  try {
    // Delete session from database
    await db.query('DELETE FROM public.sessions WHERE session_token = $1', [token])

    // Audit: signout (fire-and-forget)
    writeAuditLog(db, {
      organizationId: 'signout',
      userId: 'unknown',
      resourceType: 'session',
      resourceId: token.substring(0, 8) + '...',
      action: AuditAction.SESSION_REVOKED,
    })

    // H2 hardening: clean up fingerprint from KV
    try {
      await c.env.KV.delete(`fp:${token}`)
    } catch {
      // Non-fatal — KV cleanup best-effort
    }

    // Clear session cookie
    c.header(
      'Set-Cookie',
      'session-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure; HttpOnly'
    )

    return c.json({ success: true })
  } catch (err: any) {
    logger.error('Signout error', { error: err?.message })
    // Still return success - client should clear local state regardless
    return c.json({ success: true })
  } finally {
    await db.end()
  }
})

// Forgot password endpoint
authRoutes.post('/forgot-password', forgotPasswordRateLimit, async (c) => {
  const parsed = await validateBody(c, ForgotPasswordSchema)
  if (!parsed.success) return parsed.response
  const { email, csrf_token, csrfToken } = parsed.data

  // Validate CSRF token — same pattern as login/signup
  const csrfTokenValue = csrf_token || csrfToken
  if (!csrfTokenValue) {
    return c.json({ error: 'CSRF token required' }, 401)
  }
  const storedCsrf = await c.env.KV.get(`csrf:${csrfTokenValue}`)
  if (!storedCsrf) {
    return c.json({ error: 'Invalid or expired CSRF token' }, 403)
  }
  await c.env.KV.delete(`csrf:${csrfTokenValue}`)

  // Check if user exists
  const db = getDb(c.env)
  try {
    const userResult = await db.query('SELECT id FROM users WHERE email = $1', [
      email.toLowerCase(),
    ])

    if (!userResult.rows || userResult.rows.length === 0) {
      // Don't reveal if user exists or not for security
      return c.json({
        message: 'If an account with that email exists, a password reset link has been sent.',
      })
    }

    // Generate a crypto-random reset token and store in KV (1-hour TTL)
    const resetToken = crypto.randomUUID() + '-' + crypto.randomUUID()
    const userId = userResult.rows[0].id
    await c.env.KV.put(`reset:${resetToken}`, userId, { expirationTtl: 3600 })

    // Construct reset URL (points to frontend reset-password page)
    const appUrl = c.env.NEXT_PUBLIC_APP_URL || 'https://voxsouth.online'
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`

    // Send password reset email via Resend (fire-and-forget)
    sendEmail(c.env.RESEND_API_KEY, {
      to: email.toLowerCase(),
      subject: 'Reset your Word Is Bond password',
      html: passwordResetEmailHtml(resetUrl, 60),
      text: `Reset your password: ${resetUrl}\n\nThis link expires in 60 minutes.`,
    }).catch((err) => logger.error('Failed to send reset email', { error: err?.message }))

    // Audit: password reset requested (fire-and-forget)
    writeAuditLog(db, {
      organizationId: 'password_reset',
      userId,
      resourceType: 'user',
      resourceId: userId,
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      after: { email: email.toLowerCase() },
    })

    return c.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    })
  } catch (err: any) {
    logger.error('Forgot password error', { error: err?.message })
    return c.json({ error: 'Failed to process request' }, 500)
  } finally {
    await db.end()
  }
})

// Reset password endpoint — validates token from KV, updates password
authRoutes.post('/reset-password', forgotPasswordRateLimit, async (c) => {
  const parsed = await validateBody(c, ResetPasswordSchema)
  if (!parsed.success) return parsed.response
  const { token, password } = parsed.data

  // Validate reset token from KV
  const userId = await c.env.KV.get(`reset:${token}`)
  if (!userId) {
    return c.json({ error: 'Invalid or expired reset token' }, 400)
  }

  // Delete token immediately (one-time use)
  await c.env.KV.delete(`reset:${token}`)

  // Hash new password and update in database
  const db = getDb(c.env)
  try {
    const hashedPassword = await hashPassword(password)
    const result = await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email',
      [hashedPassword, userId]
    )

    if (!result.rows || result.rows.length === 0) {
      return c.json({ error: 'User not found' }, 404)
    }

    logger.info('Password reset successful', { userId })

    // Audit: password reset completed (fire-and-forget)
    writeAuditLog(db, {
      organizationId: 'password_reset',
      userId,
      resourceType: 'user',
      resourceId: userId,
      action: AuditAction.PASSWORD_RESET_COMPLETED,
      after: { email: result.rows[0].email },
    })

    return c.json({ message: 'Password has been reset successfully' })
  } catch (err: any) {
    logger.error('Reset password error', { error: err?.message })
    return c.json({ error: 'Failed to reset password' }, 500)
  } finally {
    await db.end()
  }
})

// ─── Password Hashing (PBKDF2-SHA256, 120k iterations) ───────────────────────
// PBKDF2 via Web Crypto API — NIST SP 800-132 recommended for password hashing.
// Unlike raw SHA-256, PBKDF2 applies key stretching (120,000 rounds) making
// brute-force attacks ~120,000x slower per guess.

const PBKDF2_ITERATIONS = 100_000
const PBKDF2_HASH = 'SHA-256'
const SALT_BYTES = 32
const KEY_BYTES = 32

function hexEncode(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
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
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
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
async function verifyPassword(
  password: string,
  storedHash: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
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
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
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
