/**
 * Webhook Subscriptions API
 * 
 * GET /api/webhooks/subscriptions - List all webhook subscriptions
 * POST /api/webhooks/subscriptions - Create a new webhook subscription
 * 
 * Per MASTER_ARCHITECTURE: Webhooks enable BYO integrations
 * Events are: call.*, recording.*, transcript.*, survey.*, scorecard.*
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/pgClient'
import { WebhookEventType, WEBHOOK_EVENT_TYPES, WebhookRetryPolicy } from '@/types/tier1-features'
import crypto from 'crypto'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Generate a secure webhook secret
 */
function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * GET /api/webhooks/subscriptions
 * List all webhook subscriptions for the organization
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Get user's organization and verify admin role
    const { rows: members } = await query(
      `SELECT organization_id, role FROM org_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    )
    const member = members[0]

    if (!member) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: 'Organization membership not found' } },
        { status: 403 }
      )
    }

    // Only owners and admins can view webhooks
    if (!['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners and admins can manage webhooks' } },
        { status: 403 }
      )
    }

    // Get subscriptions
    const { rows: subscriptions } = await query(
      `SELECT * FROM webhook_subscriptions WHERE organization_id = $1 ORDER BY created_at DESC`,
      [member.organization_id]
    )

    // Mask secrets (show only last 4 chars)
    const maskedSubscriptions = subscriptions?.map(sub => ({
      ...sub,
      secret: `whsec_...${sub.secret.slice(-4)}`
    }))

    return NextResponse.json({
      success: true,
      subscriptions: maskedSubscriptions || []
    })
  } catch (error: any) {
    logger.error('[webhooks GET] Error', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/webhooks/subscriptions
 * Create a new webhook subscription
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      name,
      url,
      events,
      headers = {},
      retry_policy = 'exponential',
      max_retries = 5,
      timeout_ms = 30000
    } = body

    // Validate required fields
    if (!name || typeof name !== 'string' || name.length < 1 || name.length > 100) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_NAME', message: 'Name is required (1-100 characters)' } },
        { status: 400 }
      )
    }

    if (!url || !isValidUrl(url)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_URL', message: 'Valid HTTPS URL is required' } },
        { status: 400 }
      )
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'EVENTS_REQUIRED', message: 'At least one event type is required' } },
        { status: 400 }
      )
    }

    // Validate event types
    const invalidEvents = events.filter((e: string) => !WEBHOOK_EVENT_TYPES.includes(e as WebhookEventType))
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_EVENTS',
            message: `Invalid events: ${invalidEvents.join(', ')}`
          }
        },
        { status: 400 }
      )
    }

    // Validate retry policy
    if (!['none', 'fixed', 'exponential'].includes(retry_policy)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_RETRY_POLICY', message: 'Invalid retry policy' } },
        { status: 400 }
      )
    }

    // Get user's organization and verify admin role
    const { rows: members } = await query(
      `SELECT organization_id, role FROM org_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    )
    const member = members[0]

    if (!member) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: 'Organization membership not found' } },
        { status: 403 }
      )
    }

    // Only owners and admins can create webhooks
    if (!['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only owners and admins can create webhooks' } },
        { status: 403 }
      )
    }

    // Check feature flag
    const { rows: flags } = await query(
      `SELECT enabled FROM org_feature_flags WHERE organization_id = $1 AND feature = 'webhooks' LIMIT 1`,
      [member.organization_id]
    )
    const featureFlag = flags[0]

    if (featureFlag?.enabled === false) {
      return NextResponse.json(
        { success: false, error: { code: 'FEATURE_DISABLED', message: 'Webhooks are disabled for this organization' } },
        { status: 403 }
      )
    }

    // Generate webhook secret
    const secret = generateWebhookSecret()

    // Create subscription
    let subscription: any
    try {
      const { rows } = await query(
        `INSERT INTO webhook_subscriptions (
           organization_id, name, url, secret, event_types, headers, retry_policy, max_retries, timeout_ms, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          member.organization_id,
          name,
          url,
          secret,
          JSON.stringify(events), // Maps to event_types in DB
          JSON.stringify(headers || {}),
          retry_policy,
          Math.min(max_retries, 10),
          Math.min(timeout_ms, 60000),
          userId
        ]
      )
      subscription = rows[0]
    } catch (insertError: any) {
      // Handle duplicate URL error
      if (insertError.code === '23505') {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_URL', message: 'A webhook for this URL already exists' } },
          { status: 409 }
        )
      }

      logger.error('[webhooks POST] Insert error', insertError, { organizationId: member.organization_id })
      return NextResponse.json(
        { success: false, error: { code: 'CREATE_FAILED', message: 'Failed to create webhook' } },
        { status: 500 }
      )
    }

    // Log to audit (fire and forget)
    ; (async () => {
      try {
        await query(
          `INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, actor_type, actor_label, after)
            VALUES ($1, $2, $3, 'webhook_subscription', $4, 'create', 'human', $5, $6)`,
          [crypto.randomUUID(), member.organization_id, userId, subscription.id, userId, JSON.stringify({ name, url, events })]
        )
      } catch (err) {
        logger.error('[webhooks POST] Audit log error', err, { subscriptionId: subscription.id })
      }
    })()

    return NextResponse.json({
      success: true,
      subscription: {
        ...subscription,
        // Return full secret only on creation
        secret: subscription.secret
      },
      message: 'Webhook created. Save the secret - it will not be shown again.'
    }, { status: 201 })
  } catch (error: any) {
    logger.error('[webhooks POST] Error', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
