import { NextResponse } from 'next/server'
import pgClient from '@/lib/pgClient'
import { v4 as uuidv4 } from 'uuid'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'
import { withIdempotency } from '@/lib/idempotency'
import { logger } from '@/lib/logger'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'edge'

/**
 * Public Signup API
 * 
 * Allows users to create new accounts.
 * Creates a user in Supabase Auth and returns success.
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

    // Use centralized config per architecture
    const { config } = await import('@/lib/config')
    const supabaseUrl = config.supabase.url
    const serviceKey = config.supabase.serviceRoleKey

    if (!supabaseUrl || !serviceKey) {
      logger.error('Signup: Server configuration missing', undefined, { email: '[REDACTED]' })
      return NextResponse.json(
        { success: false, error: { code: 'CONFIG_ERROR', message: 'Server configuration error' } },
        { status: 500 }
      )
    }

    // Create user via Supabase Admin API
    const endpoint = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users`
    const userMetadata: Record<string, any> = {}
    if (name) userMetadata.name = name

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: Object.keys(userMetadata).length ? userMetadata : undefined,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      // Handle common errors
      if (res.status === 422 && data?.message?.includes('already registered')) {
        return NextResponse.json(
          { success: false, error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' } },
          { status: 409 }
        )
      }

      logger.warn('Signup: Auth user creation failed', {
        status: res.status,
        email: '[REDACTED]'
      })
      return NextResponse.json(
        { success: false, error: { code: 'SIGNUP_FAILED', message: data?.message || 'Failed to create account' } },
        { status: res.status }
      )
    }

    // Create user in public.users and organization using Postgres
    // Check if user already exists
    const existingRes = await pgClient.query('SELECT id FROM users WHERE id = $1 LIMIT 1', [data.id])
    const existingUser = existingRes.rows?.[0]

    if (!existingUser) {
      // Get most recent organization if exists
      const orgsRes = await pgClient.query('SELECT id, name FROM organizations ORDER BY created_at DESC LIMIT 1')
      const orgs = orgsRes.rows || []
      let orgId: string | null = null

      if (orgs.length > 0) {
        orgId = orgs[0].id
        logger.info('Signup: Using existing organization', { orgId, email: '[REDACTED]' })
      } else {
        // Create organization
        const newOrgRes = await pgClient.query(
          `INSERT INTO organizations (id, name, plan, plan_status, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [uuidv4(), `${name || email}'s Organization`, 'professional', 'active', data.id, new Date().toISOString()]
        )

        if (!newOrgRes.rows?.[0]) {
          logger.error('Signup: Failed to create organization', undefined, { email: '[REDACTED]' })
          return NextResponse.json(
            { success: false, error: { code: 'ORG_CREATION_FAILED', message: 'Failed to create organization. Please try again.' } },
            { status: 500 }
          )
        }

        orgId = newOrgRes.rows[0].id
        logger.info('Signup: Created organization', { orgId, email: '[REDACTED]' })

        // Create default tool for this organization
        try {
          const toolRes = await pgClient.query(
            `INSERT INTO tools (id, name, description, created_at) VALUES ($1, $2, $3, $4) RETURNING id`,
            [uuidv4(), 'Default Voice Tool', 'Default tool for call recordings and AI services', new Date().toISOString()]
          )

          const tool = toolRes.rows?.[0]
          if (tool) {
            await pgClient.query('UPDATE organizations SET tool_id = $1 WHERE id = $2', [tool.id, orgId])
            logger.info('Signup: Created and linked tool', { toolId: tool.id, orgId })
          }
        } catch (e: any) {
          logger.warn('Signup: Failed to create tool', { error: e?.message, orgId })
        }
      }

      if (!orgId) {
        return NextResponse.json(
          { success: false, error: { code: 'ORG_REQUIRED', message: 'Organization is required but missing' } },
          { status: 500 }
        )
      }

      // Insert user
      try {
        await pgClient.query(
          `INSERT INTO users (id, email, organization_id, role, is_admin, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [data.id, data.email, orgId, 'member', false, new Date().toISOString()]
        )
      } catch (e: any) {
        logger.error('Signup: Failed to create user in public.users', e, { email: '[REDACTED]' })
        return NextResponse.json(
          { success: false, error: { code: 'USER_CREATION_FAILED', message: 'Failed to create user record' } },
          { status: 500 }
        )
      }

      logger.info('Signup: Created user in public.users', { userId: data.id, orgId })

      // Create org membership
      const isFirstUser = orgs.length === 0
      try {
        await pgClient.query(
          `INSERT INTO org_members (id, organization_id, user_id, role, created_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [uuidv4(), orgId, data.id, isFirstUser ? 'owner' : 'member', new Date().toISOString()]
        )
      } catch (e: any) {
        logger.error('Signup: Failed to create org membership', e, { email: '[REDACTED]' })
        return NextResponse.json(
          { success: false, error: { code: 'MEMBER_CREATION_FAILED', message: 'Failed to create organization membership' } },
          { status: 500 }
        )
      }

      logger.info('Signup: Created org_members record', {
        userId: data.id,
        role: isFirstUser ? 'owner' : 'member'
      })

      // Create default voice_configs for new organization
      try {
        await pgClient.query(
          `INSERT INTO voice_configs (id, organization_id, record, transcribe, translate, translation_from, translate_to, survey, synthetic_caller, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [uuidv4(), orgId, true, true, false, 'en-US', 'es-ES', false, false, new Date().toISOString()]
        )
        logger.info('Signup: Created voice_configs', { orgId })
      } catch (e: any) {
        logger.warn('Signup: Failed to create voice_configs', { error: e?.message, orgId })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully. You can now sign in.',
      user: {
        id: data?.id,
        email: data?.email,
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
