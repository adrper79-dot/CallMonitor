import { NextResponse } from 'next/server'
import pgClient, { query, withTransaction } from '@/lib/pgClient'
import { v4 as uuidv4 } from 'uuid'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'
import { withIdempotency } from '@/lib/idempotency'
import { logger } from '@/lib/logger'
import { scrypt, randomBytes } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Public Signup API
 * 
 * Allows users to create new accounts.
 * Creates a user in local Postgres database with hashed password.
 * 
 * Per MASTER_ARCHITECTURE: Capability-driven security with rate limiting
 * Security: Rate limited (5/hour per IP) + idempotent (prevents duplicate accounts)
 */
async function handleSignup(req: Request) {
  try {
    const body = await req.json()
    const email = body?.email
    const password = body?.password
    const name = body?.name

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'Email and password are required' } },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_EMAIL', message: 'Invalid email format' } },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' } },
        { status: 400 }
      )
    }

    // Check if email already exists
    const { rows: existingUsers } = await query(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [email]
    )

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' } },
        { status: 409 }
      )
    }

    // Hash password
    const salt = randomBytes(16).toString('hex')
    const derivedBuffer = (await scryptAsync(password, salt, 64)) as Buffer
    const derived = derivedBuffer.toString('hex')
    const passwordHash = `${salt}:${derived}`

    // Generate IDs
    const userId = uuidv4()
    const orgId = uuidv4()
    const toolId = uuidv4()
    const voiceConfigId = uuidv4()
    const orgMemberId = uuidv4()

    // Perform creation in transaction
    await withTransaction(async (client) => {
      // 1. Create Organization
      await client.query(
        `INSERT INTO organizations (id, name, plan, plan_status, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orgId, `${name || email.split('@')[0]}'s Organization`, 'professional', 'active', userId, new Date().toISOString()]
      )

      // 2. Create Default Tool & Link to Org
      await client.query(
        `INSERT INTO tools (id, name, description, created_at) 
         VALUES ($1, 'Default Voice Tool', 'Default tool for call recordings and AI services', $2)`,
        [toolId, new Date().toISOString()]
      )

      await client.query(
        `UPDATE organizations SET tool_id = $1 WHERE id = $2`,
        [toolId, orgId]
      )

      // 3. Create User
      await client.query(
        `INSERT INTO users (id, email, password_hash, organization_id, role, is_admin, name, created_at)
         VALUES ($1, $2, $3, $4, 'owner', true, $5, $6)`,
        [userId, email, passwordHash, orgId, name || null, new Date().toISOString()]
      )

      // 4. Create Org Membership
      await client.query(
        `INSERT INTO org_members (id, organization_id, user_id, role, created_at)
         VALUES ($1, $2, $3, 'owner', $4)`,
        [orgMemberId, orgId, userId, new Date().toISOString()]
      )

      // 5. Create Default Voice Config
      await client.query(
        `INSERT INTO voice_configs (
           id, organization_id, record, transcribe, translate, 
           translation_from, translate_to, survey, synthetic_caller, created_at
         ) VALUES ($1, $2, true, true, false, 'en-US', 'es-ES', false, false, $3)`,
        [voiceConfigId, orgId, new Date().toISOString()]
      )
    })

    logger.info('Signup: Account created successfully', { userId, orgId, email })

    return NextResponse.json({
      success: true,
      message: 'Account created successfully. You can now sign in.',
      user: {
        id: userId,
        email: email,
      }
    })

  } catch (err: any) {
    logger.error('Signup: Unexpected error', err)
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: err?.message || 'Internal server error' } },
      { status: 500 }
    )
  }
}

// HIGH-3: Apply idempotency to prevent duplicate account creation on retry
// HIGH-1: Apply rate limiting per architecture: Security boundaries (5/hour per IP)
export const POST = withRateLimit(
  withIdempotency(handleSignup, {
    getKey: async (req) => {
      // Clone request to read body without consuming it
      const clonedReq = req.clone()
      try {
        const body = await clonedReq.json()
        // Use email as idempotency key - same email = same signup attempt
        return `signup-${body?.email?.toLowerCase() || 'unknown'}`
      } catch {
        return `signup-${Date.now()}`
      }
    },
    ttlSeconds: 3600 // 1 hour - matches rate limit window
  }),
  {
    identifier: (req) => getClientIP(req),
    config: {
      maxAttempts: 5, // 5 signup attempts
      windowMs: 60 * 60 * 1000, // per hour
      blockMs: 60 * 60 * 1000 // 1 hour block on abuse
    }
  }
)
